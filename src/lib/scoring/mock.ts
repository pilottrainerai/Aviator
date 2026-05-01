/**
 * Generic, rules-based scorer. Reads the scenario definition (steps + decisions)
 * and the action log, returning a multi-axis rubric with evidence text.
 *
 * Used when GROQ_API_KEY is not set, and as a determinism floor under the LLM
 * scorer (which lands in /lib/scoring/llm.ts). SME pass required on the
 * narrative templates before user-visible release.
 */

import type { ScenarioEvent } from "@/engine/events";
import type { ScenarioState } from "@/engine/state";
import type { Scenario } from "@/scenarios/types";
import type { DebriefRubric, StoredDebrief } from "@/lib/sessions/store";

type Args = {
  scenario: Scenario;
  events: ScenarioEvent[];
  finalState: ScenarioState;
};

function scoreCorrectness(scenario: Scenario, events: ScenarioEvent[]) {
  const required = scenario.steps.filter((s) => !s.optional);
  const completedIds = new Set(
    events.filter((e): e is Extract<ScenarioEvent, { kind: "STEP" }> => e.kind === "STEP")
      .map((e) => e.stepId),
  );
  const missing = required.filter((s) => !completedIds.has(s.id));
  const score = required.length === 0
    ? 100
    : Math.round(((required.length - missing.length) / required.length) * 100);
  const evidence =
    missing.length === 0
      ? "All required action items completed."
      : `Missing: ${missing.map((s) => `${s.label} ${s.action}`).join(", ")}.`;
  return { score, evidence };
}

function scoreSequence(scenario: Scenario, events: ScenarioEvent[]) {
  const stepEvents = events.filter(
    (e): e is Extract<ScenarioEvent, { kind: "STEP" }> => e.kind === "STEP",
  );
  const stepTimes = new Map(stepEvents.map((e) => [e.stepId, e.tMs]));

  const violations: string[] = [];
  for (const step of scenario.steps) {
    if (!step.requires?.length) continue;
    const stepTime = stepTimes.get(step.id);
    if (stepTime == null) continue;
    for (const reqId of step.requires) {
      const reqTime = stepTimes.get(reqId);
      const reqStep = scenario.steps.find((s) => s.id === reqId);
      if (reqTime == null) {
        violations.push(`${step.label} performed without ${reqStep?.label ?? reqId}`);
      } else if (reqTime > stepTime) {
        violations.push(
          `${step.label} performed before ${reqStep?.label ?? reqId}`,
        );
      }
    }
  }
  const score = Math.max(0, 100 - violations.length * 25);
  const evidence =
    violations.length === 0
      ? "Procedural sequence respected."
      : violations.join("; ") + ".";
  return { score, evidence };
}

function scoreDecision(scenario: Scenario, events: ScenarioEvent[]) {
  const decisionEvent = events.find(
    (e): e is Extract<ScenarioEvent, { kind: "DECISION" }> => e.kind === "DECISION",
  );
  if (!decisionEvent) {
    return { score: 0, evidence: "No strategic decision was made." };
  }
  const def = scenario.decisions.find((d) => d.value === decisionEvent.value);
  if (!def) {
    return { score: 0, evidence: `Unknown decision "${decisionEvent.value}".` };
  }
  if (def.tone === "primary") {
    return {
      score: 100,
      evidence: `Selected ${def.label} — appropriate response.`,
    };
  }
  if (def.tone === "secondary") {
    return {
      score: 70,
      evidence: `${def.label} is acceptable, but a more decisive call exists.`,
    };
  }
  return {
    score: 10,
    evidence: `${def.label} — ${def.description.toLowerCase()}`,
  };
}

function buildNarrative(
  rubric: DebriefRubric,
  scenario: Scenario,
  events: ScenarioEvent[],
): string {
  const lines: string[] = [];
  lines.push(
    `Run summary for ${scenario.meta.title}. Composite score reflects performance across the three axes.`,
  );
  lines.push("");
  lines.push("Correctness — " + rubric.correctness.evidence);
  lines.push("Sequence — " + rubric.sequence.evidence);
  lines.push("Decision quality — " + rubric.decision.evidence);
  lines.push("");

  const completedIds = new Set(
    events.filter((e): e is Extract<ScenarioEvent, { kind: "STEP" }> => e.kind === "STEP")
      .map((e) => e.stepId),
  );
  const missingRequired = scenario.steps
    .filter((s) => !s.optional && !completedIds.has(s.id));

  if (missingRequired.length > 0) {
    lines.push(
      `On the next attempt, prioritize ${missingRequired[0].label} ${missingRequired[0].action} — ${missingRequired[0].hint.toLowerCase()}`,
    );
  } else if (rubric.sequence.score < 100) {
    lines.push(
      "Re-run paying attention to ordering. The procedure expects each step's prerequisites to be done first.",
    );
  } else if (rubric.decision.score < 80) {
    lines.push(
      "Procedure execution was clean — sharpen the strategic decision next time.",
    );
  } else {
    lines.push("Strong run. Try a more time-pressured variant next.");
  }
  return lines.join("\n");
}

export function scoreSessionMock({
  scenario,
  events,
}: Args): Pick<StoredDebrief, "rubric" | "compositeScore" | "narrative"> {
  const rubric: DebriefRubric = {
    correctness: scoreCorrectness(scenario, events),
    sequence: scoreSequence(scenario, events),
    decision: scoreDecision(scenario, events),
  };
  const compositeScore = Math.round(
    rubric.correctness.score * 0.4 +
      rubric.sequence.score * 0.3 +
      rubric.decision.score * 0.3,
  );
  const narrative = buildNarrative(rubric, scenario, events);
  return { rubric, compositeScore, narrative };
}
