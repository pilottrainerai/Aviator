"use client";

import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario } from "@/scenarios/types";

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
  const requiredSteps = scenario.steps.filter((s) => !s.optional);
  const halfWay = requiredSteps.length > 0
    ? Object.keys(state.completedSteps).length >= Math.ceil(requiredSteps.length / 2)
    : true;
  const decisionAvailable = halfWay && !state.masterWarnActive
    ? true
    : Object.keys(state.completedSteps).length >= requiredSteps.length - 1;

  const made = !!state.decision;

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
            Strategic decision
          </div>
          <div className="font-sans text-[13px] text-[var(--color-text-muted)] mt-0.5">
            What's your plan after the abnormality?
          </div>
        </div>
        {made && (
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-amber)]">
            COMMITTED · {state.decision!.value.replace(/_/g, " ")}
          </div>
        )}
      </div>

      {!decisionAvailable && !made && (
        <div className="border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
            UNLOCKS AFTER THE PROCEDURE
          </p>
        </div>
      )}

      {(decisionAvailable || made) && (
        <div className="grid grid-cols-2 gap-3">
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
                className="group flex flex-col items-start gap-1.5 p-4 border rounded-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="font-mono text-xs uppercase tracking-[0.15em]"
                  style={{ color: selected ? color : "var(--color-text)" }}
                >
                  {d.label}
                </span>
                <span className="font-sans text-[12px] text-[var(--color-text-muted)] leading-snug">
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
