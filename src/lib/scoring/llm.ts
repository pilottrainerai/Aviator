/**
 * LLM-backed scorer + debrief. Uses Groq + Llama 3.3 70B by default.
 * Falls back to the deterministic mock scorer when the LLM is unavailable
 * or returns malformed JSON. The mock is also the ground-truth fallback —
 * we never ship a 0/0/0 because the model timed out.
 */

import type { ScenarioEvent } from "@/engine/events";
import type { ScenarioState } from "@/engine/state";
import type { Scenario } from "@/scenarios/types";
import type { DebriefRubric, StoredDebrief } from "@/lib/sessions/store";
import { getLLM, isLLMConfigured } from "@/lib/llm";
import { getApplicableRequiredSteps, isStepApplicable } from "@/lib/scenarios/step-applicability";
import { scoreSessionMock } from "./mock";

type Args = {
  scenario: Scenario;
  events: ScenarioEvent[];
  finalState: ScenarioState;
};

type LLMOut = {
  rubric: DebriefRubric;
  compositeScore: number;
  narrative: string;
};

function summarizeEvents(events: ScenarioEvent[]): string {
  return events
    .map((e) => {
      const t = (e.tMs / 1000).toFixed(1) + "s";
      switch (e.kind) {
        case "STEP":
          return `${t} [pilot] STEP ${e.stepId}`;
        case "DECISION":
          return `${t} [pilot] DECISION ${e.value}`;
        case "TRIGGER":
          return `${t} [system] TRIGGER ${e.triggerId}`;
        case "EFFECT":
          return `${t} [system] EFFECT ${e.sourceId}`;
      }
    })
    .join("\n");
}

function buildPrompt(scenario: Scenario, events: ScenarioEvent[], finalState: ScenarioState): string {
  const requiredSteps = getApplicableRequiredSteps(scenario, finalState)
    .map((s) => `- ${s.id}: ${s.label} ${s.action} (${s.hint})`)
    .join("\n");
  const optionalSteps = scenario.steps
    .filter((s) => s.optional || !isStepApplicable(s, finalState))
    .map((s) => `- ${s.id}: ${s.label} ${s.action} (${s.hint})`)
    .join("\n");
  const decisionOptions = scenario.decisions
    .map((d) => `- ${d.value} (${d.tone}): ${d.label} — ${d.description}`)
    .join("\n");

  return `Scenario: ${scenario.meta.title}

Situation: ${scenario.brief.situation}
Pilot's job: ${scenario.brief.job}

Required procedure steps:
${requiredSteps}

Optional steps:
${optionalSteps || "(none)"}

Decision options (correct = primary, acceptable = secondary, wrong = danger):
${decisionOptions}

Action log:
${summarizeEvents(events)}

Score this run on three axes (0-100 each):
1. correctness — did the right action items happen
2. sequence — were they in valid order (respecting prerequisites)
3. decision — was the strategic decision sound

Return strict JSON only, matching this shape:
{
  "rubric": {
    "correctness": { "score": 0-100, "evidence": "1-2 sentences" },
    "sequence": { "score": 0-100, "evidence": "1-2 sentences" },
    "decision": { "score": 0-100, "evidence": "1-2 sentences" }
  },
  "compositeScore": 0-100,
  "narrative": "3-5 sentences of debrief, focusing on what to fix on the next run"
}`;
}

function isLLMOut(x: unknown): x is LLMOut {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.compositeScore !== "number") return false;
  if (typeof o.narrative !== "string") return false;
  const r = o.rubric as Record<string, { score?: unknown; evidence?: unknown }> | undefined;
  if (!r) return false;
  for (const axis of ["correctness", "sequence", "decision"] as const) {
    const a = r[axis];
    if (!a || typeof a.score !== "number" || typeof a.evidence !== "string") return false;
  }
  return true;
}

export async function scoreSession({
  scenario,
  events,
  finalState,
}: Args): Promise<Pick<StoredDebrief, "rubric" | "compositeScore" | "narrative">> {
  if (!isLLMConfigured()) {
    return scoreSessionMock({ scenario, events, finalState });
  }

  try {
    const llm = getLLM();
    const out = await llm.complete({
      messages: [
        {
          role: "system",
          content:
            "You are a type-rated A320 examiner debriefing a pilot. You return strict JSON only — no preamble, no code fences. Be direct, specific, and brief. Avoid hedging.",
        },
        { role: "user", content: buildPrompt(scenario, events, finalState) },
      ],
      responseFormat: "json",
      temperature: 0.2,
    });

    const parsed: unknown = JSON.parse(out.text);
    if (!isLLMOut(parsed)) {
      console.warn("[score] LLM returned unexpected shape; falling back to mock");
      return scoreSessionMock({ scenario, events, finalState });
    }
    return parsed;
  } catch (err) {
    console.warn("[score] LLM scoring failed, falling back to mock:", err);
    return scoreSessionMock({ scenario, events, finalState });
  }
}
