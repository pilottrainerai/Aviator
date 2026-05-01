"use client";

import type { ScenarioState } from "@/engine/state";
import type { Scenario, ScenarioStep } from "@/scenarios/types";

type Status = "pending" | "current" | "done" | "skip";

function stepRowStatus(step: ScenarioStep, state: ScenarioState): Status {
  if (state.completedSteps[step.id]) return "done";
  if (step.optional) {
    // Mark optional step as "skip" if a later step (one that requires it transitively or comes after) has been done
    // Simplified: if all non-optional steps are done, skip the optional ones
    return "pending";
  }
  const requirementsMet = (step.requires ?? []).every(
    (r) => !!state.completedSteps[r],
  );
  return requirementsMet ? "current" : "pending";
}

function nextHint(scenario: Scenario, state: ScenarioState): {
  primary: string;
  secondary?: string;
} {
  if (state.decision) {
    return {
      primary: "Procedure complete.",
      secondary: "End the session for your debrief, or wait for auto-finalize.",
    };
  }

  // Find the first non-optional step that's "current"
  const next = scenario.steps.find(
    (s) => !s.optional && stepRowStatus(s, state) === "current",
  );
  if (next) {
    return {
      primary: `Next: ${next.label} ${next.action}`,
      secondary: next.hint,
    };
  }

  // No "current" step — either waiting for trigger or all done
  if (Object.keys(state.completedSteps).length === 0) {
    return {
      primary: "Stand by.",
      secondary: "Watch for the abnormality.",
    };
  }

  // All required done — prompt for decision
  const requiredDone = scenario.steps
    .filter((s) => !s.optional)
    .every((s) => state.completedSteps[s.id]);
  if (requiredDone) {
    return {
      primary: "Make your strategic decision.",
      secondary: "LAND ASAP, RETURN TO FIELD, or DIVERT — pick the right call.",
    };
  }

  return { primary: "Continue the procedure." };
}

export function GuidancePanel({
  scenario,
  state,
}: {
  scenario: Scenario;
  state: ScenarioState;
}) {
  const next = nextHint(scenario, state);
  const required = scenario.steps.filter((s) => !s.optional);
  const done = required.filter((s) => state.completedSteps[s.id]).length;

  return (
    <div className="border border-[var(--color-brand)] bg-[var(--color-surface)] flex flex-col">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)]">
          COACH
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
          {done} / {required.length}
        </div>
      </div>

      <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-brand-soft)]">
        <p className="font-sans text-base text-[var(--color-text)] font-medium leading-snug">
          {next.primary}
        </p>
        {next.secondary && (
          <p className="font-sans text-sm text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
            {next.secondary}
          </p>
        )}
      </div>

      <ol className="divide-y divide-[var(--color-border)]">
        {scenario.steps.map((s) => (
          <StepRow key={s.id} step={s} state={state} />
        ))}
      </ol>
    </div>
  );
}

function StepRow({ step, state }: { step: ScenarioStep; state: ScenarioState }) {
  const status = stepRowStatus(step, state);
  const color =
    status === "done"
      ? "var(--color-green)"
      : status === "current"
      ? "var(--color-brand)"
      : "var(--color-border)";

  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <Indicator status={status} color={color} />
      <span
        className={`font-sans text-sm flex-1 ${
          status === "done"
            ? "line-through text-[var(--color-text-muted)]"
            : status === "current"
            ? "text-[var(--color-text)] font-medium"
            : "text-[var(--color-text-muted)]"
        }`}
      >
        {step.label} {step.action}
        {step.optional && (
          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-faint)]">
            OPTIONAL
          </span>
        )}
      </span>
      <span
        className="font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ color }}
      >
        {status}
      </span>
    </li>
  );
}

function Indicator({
  status,
  color,
}: {
  status: Status;
  color: string;
}) {
  if (status === "done") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke={color} strokeWidth="1.5" />
        <path
          d="M5.5 9.5L8 12L12.5 6.5"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "current") {
    return (
      <div className="relative h-[18px] w-[18px]">
        <div
          className="absolute inset-0 rounded-full border-[1.5px] animate-pulse"
          style={{ borderColor: color }}
        />
        <div
          className="absolute inset-[5px] rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    );
  }
  return (
    <div
      className="h-[18px] w-[18px] rounded-full border-[1.5px]"
      style={{ borderColor: color }}
    />
  );
}
