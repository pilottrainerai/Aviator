"use client";

import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario } from "@/scenarios/types";
import { getApplicableRequiredSteps } from "@/lib/scenarios/step-applicability";

export function DecisionPanel({
  scenario,
  state,
  perform,
  disabled,
}: {
  scenario: Scenario;
  state: ScenarioState;
  perform: (action: PilotAction) => void;
  disabled?: boolean;
}) {
  // Decision unlocks once the first non-optional step has been completed
  const requiredSteps = getApplicableRequiredSteps(scenario, state);
  const completedRequired = requiredSteps.filter((step) => !!state.completedSteps[step.id]).length;
  const halfWay = requiredSteps.length > 0
    ? completedRequired >= Math.ceil(requiredSteps.length / 2)
    : true;
  const decisionAvailable = halfWay && !state.masterWarnActive
    ? true
    : completedRequired >= requiredSteps.length - 1;

  const made = !!state.decision;

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      {made && (
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-amber)] mb-2">
          COMMITTED · {state.decision!.value.replace(/_/g, " ")}
        </div>
      )}

      {!decisionAvailable && !made && (
        <div className="py-2 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
            UNLOCKS AFTER PROCEDURE
          </p>
        </div>
      )}

      {(decisionAvailable || made) && (
        <div className="grid grid-cols-2 gap-2">
          {scenario.decisions.map((d) => {
            const selected = made && state.decision!.value === d.value;
            const color =
              d.tone === "danger"
                ? "var(--color-red)"
                : d.tone === "secondary"
                ? "var(--color-blue)"
                : "var(--color-green)";
            return (
              <button
                key={d.value}
                type="button"
                disabled={disabled || made}
                onClick={() => perform({ kind: "DECISION", value: d.value })}
                className="group flex flex-col items-start gap-0.5 px-2 py-1.5 border rounded-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: selected ? color : "var(--color-border)",
                  backgroundColor: selected
                    ? d.tone === "danger"
                      ? "var(--color-red-soft)"
                      : d.tone === "secondary"
                      ? "var(--color-blue-soft)"
                      : "var(--color-green-soft)"
                    : "var(--color-surface-2)",
                }}
              >
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: selected ? color : "var(--color-text)" }}
                >
                  {d.label}
                </span>
                <span className="font-sans text-[10px] text-[var(--color-text-muted)] leading-snug">
                  {d.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
