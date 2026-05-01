"use client";

import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, ScenarioStep, ControlVariant } from "@/scenarios/types";

export function CockpitControls({
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
  // Find the first uncompleted, requirements-met step — that's "next"
  const nextStep = scenario.steps.find((s) => stepStatus(s, state) === "current");

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
          PROCEDURE — CLICK TO ACTUATE
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
          {scenario.steps.length} CONTROLS
        </div>
      </div>

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(scenario.steps.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {scenario.steps.map((step) => {
          const status = stepStatus(step, state);
          return (
            <Control
              key={step.id}
              step={step}
              status={status}
              isNext={nextStep?.id === step.id}
              disabled={disabled || status === "done" || status === "locked"}
              onClick={() => perform({ kind: "STEP", stepId: step.id })}
            />
          );
        })}
      </div>
    </div>
  );
}

type Status = "pending" | "locked" | "current" | "done";

function stepStatus(step: ScenarioStep, state: ScenarioState): Status {
  if (state.completedSteps[step.id]) return "done";
  const requirementsMet = (step.requires ?? []).every(
    (r) => !!state.completedSteps[r],
  );
  if (!requirementsMet) return "locked";
  return "current";
}

function variantAccent(v: ControlVariant): string {
  switch (v) {
    case "warning":
      return "var(--color-red)";
    case "caution":
      return "var(--color-amber)";
    case "advisory":
      return "var(--color-blue)";
    case "switch":
    default:
      return "var(--color-amber)";
  }
}

function Control({
  step,
  status,
  isNext,
  disabled,
  onClick,
}: {
  step: ScenarioStep;
  status: Status;
  isNext: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const accent = variantAccent(step.variant);
  const showHighlight = isNext && !disabled;

  const borderColor =
    status === "done"
      ? "var(--color-green)"
      : showHighlight
      ? "var(--color-amber)"
      : status === "locked"
      ? "var(--color-border)"
      : accent;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={step.hint}
      className={`group relative flex flex-col items-center gap-2 p-3 border rounded-sm transition-all disabled:cursor-not-allowed ${
        showHighlight
          ? "ring-2 ring-[var(--color-amber)] ring-offset-1 ring-offset-[var(--color-surface)]"
          : ""
      } ${status === "locked" ? "opacity-50" : ""}`}
      style={{
        borderColor,
        backgroundColor:
          status === "done"
            ? "var(--color-green-soft)"
            : showHighlight
            ? "var(--color-amber-soft)"
            : "var(--color-surface-2)",
      }}
    >
      {showHighlight && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[var(--color-amber)] text-[var(--color-bg)] font-mono text-[9px] uppercase tracking-[0.15em] rounded-sm whitespace-nowrap">
          DO THIS
        </span>
      )}

      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-center">
        {step.label}
      </span>

      {step.variant === "switch" ? (
        <span
          className="font-mono text-base tracking-[0.15em]"
          style={{
            color: status === "done" ? "var(--color-green)" : "var(--color-text)",
          }}
        >
          {status === "done" ? step.action : "—"}
        </span>
      ) : (
        <div
          className={`h-7 w-7 rounded-full border-2 transition-all ${
            showHighlight && status !== "done" ? "animate-pulse" : ""
          }`}
          style={{
            borderColor: status === "done" ? "var(--color-green)" : accent,
            backgroundColor:
              status === "done"
                ? "var(--color-green)"
                : showHighlight
                ? "var(--color-amber-soft)"
                : "transparent",
          }}
        />
      )}

      <span className="font-sans text-[11px] text-[var(--color-text-faint)] leading-tight text-center min-h-[28px]">
        {step.hint}
      </span>

      <span
        className="font-mono text-[9px] uppercase tracking-[0.15em]"
        style={{
          color:
            status === "done"
              ? "var(--color-green)"
              : status === "locked"
              ? "var(--color-text-faint)"
              : accent,
        }}
      >
        {status === "done"
          ? "DONE"
          : status === "locked"
          ? "WAITING"
          : step.action}
      </span>
    </button>
  );
}
