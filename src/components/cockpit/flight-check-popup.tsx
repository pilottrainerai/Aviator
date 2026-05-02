"use client";

import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, ScenarioStep } from "@/scenarios/types";

// PF/PM coordination popups — fire sequentially as each step's requires are met.
// These represent crew callouts that must happen before ECAM actions can begin.

const CREW_COLOR: Record<"PF" | "PM", { accent: string; bg: string; badge: string }> = {
  PF: { accent: "#00CFFF", bg: "#00CFFF12", badge: "PF" },
  PM: { accent: "#FFB300", bg: "#FFB30012", badge: "PM" },
};

function activeFlightCheck(
  steps: ScenarioStep[],
  state: ScenarioState,
): ScenarioStep | null {
  for (const s of steps) {
    if (s.group !== "flightcheck") continue;
    if (state.completedSteps[s.id]) continue;
    const met = (s.requires ?? []).every((r) => !!state.completedSteps[r]);
    if (met) return s;
  }
  return null;
}

export function FlightCheckPopup({
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
  const step = activeFlightCheck(scenario.steps, state);
  if (!step) return null;

  const c = step.crew ? CREW_COLOR[step.crew] : CREW_COLOR.PF;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-30 font-mono shadow-2xl"
      style={{
        transform: "translateX(-50%)",
        width: "min(560px, 92vw)",
        backgroundColor: "#0A0D14",
        border: `1px solid ${c.accent}60`,
        borderRadius: "2px",
      }}
    >
      {/* Strip header */}
      <div
        className="flex items-center gap-3 px-4 py-[6px] border-b"
        style={{ borderColor: c.accent + "30", backgroundColor: c.bg }}
      >
        {/* Crew badge */}
        <span
          className="px-2 py-[2px] rounded-sm"
          style={{
            fontSize: "8px",
            letterSpacing: "0.15em",
            backgroundColor: c.accent + "25",
            color: c.accent,
            fontWeight: 700,
          }}
        >
          {c.badge}
        </span>

        {/* Label */}
        <span
          style={{
            color: c.accent,
            fontSize: "10px",
            letterSpacing: "0.18em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {step.label}
        </span>

        {/* Action chip */}
        <span
          className="ml-1 px-2 py-[1px] border rounded-sm"
          style={{
            fontSize: "8px",
            letterSpacing: "0.12em",
            borderColor: c.accent + "50",
            color: c.accent,
            textTransform: "uppercase",
          }}
        >
          {step.action}
        </span>

        <span
          className="ml-auto animate-pulse"
          style={{ color: c.accent, fontSize: "8px", letterSpacing: "0.15em" }}
        >
          CREW ACTION REQUIRED
        </span>
      </div>

      {/* Hint + confirm row */}
      <div className="flex items-center gap-4 px-4 py-3">
        <p
          style={{
            flex: 1,
            color: "#D4D8E0",
            fontSize: "11px",
            lineHeight: "1.55",
            letterSpacing: "0.02em",
          }}
        >
          {step.hint}
        </p>

        <button
          type="button"
          disabled={disabled}
          onClick={() => perform({ kind: "STEP", stepId: step.id })}
          className="flex-shrink-0 px-4 py-2 border-2 rounded-sm font-mono uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            fontSize: "9px",
            letterSpacing: "0.18em",
            borderColor: c.accent,
            backgroundColor: c.accent + "20",
            color: c.accent,
          }}
        >
          CONFIRM ✓
        </button>
      </div>
    </div>
  );
}
