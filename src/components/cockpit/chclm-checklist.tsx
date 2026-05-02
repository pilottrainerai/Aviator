"use client";

import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario } from "@/scenarios/types";

// ─── CHCLM Crosscheck — appears at the bottom of the ECAM flow ────────────────
// After ECAM actions are complete (Agent 1 discharged), PM verbally confirms
// ECAM actions complete and PF acknowledges before the CRM checklist unlocks.
// "Pilots CANNOT advance to the next action without confirming this."

const C = {
  border:   "#1C2130",
  accent:   "#00CFFF",
  green:    "#00D060",
  amber:    "#FFB300",
  dim:      "#5A626F",
  text:     "#E6E8EC",
  bg:       "#000000",
  accentBg: "#00CFFF0A",
  greenBg:  "#00D06010",
} as const;

// The primary ECAM steps we want to cross-reference
const ECAM_STEPS = [
  { id: "four_hundred_ft_cmd", label: "400 FT ECAM ACTIONS CALLED" },
  { id: "thr_lever_idle",      label: "THR LEVER 1 — IDLE" },
  { id: "eng1_master_off",     label: "ENG 1 MASTER — OFF" },
  { id: "eng1_fire_pb",        label: "ENG 1 FIRE P/B — PUSHED" },
  { id: "agent1",              label: "AGENT 1 — DISCHARGED" },
];

export function ChclmChecklist({
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
  const agentDone     = !!state.completedSteps["agent1"];
  const chclmStep     = scenario.steps.find((s) => s.id === "crew_crosscheck");
  const chclmDone     = !!state.completedSteps["crew_crosscheck"];

  // Only render once Agent 1 is discharged
  if (!agentDone || !chclmStep) return null;

  const statusItems = scenario.statusItems ?? [];

  return (
    <div
      className="border-2 font-mono flex flex-col"
      style={{
        borderColor: chclmDone ? C.green : C.accent,
        backgroundColor: C.bg,
        boxShadow: chclmDone ? `0 0 16px ${C.green}20` : `0 0 16px ${C.accent}20`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{
          borderColor: chclmDone ? C.green + "40" : C.accent + "40",
          backgroundColor: chclmDone ? C.greenBg : C.accentBg,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              color: chclmDone ? C.green : C.accent,
              fontSize: "9px",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            CHCLM CROSSCHECK
          </span>
          <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.1em" }}>
            ECAM ACTIONS COMPLETE
          </span>
        </div>
        {chclmDone ? (
          <span style={{ color: C.green, fontSize: "9px", letterSpacing: "0.15em" }}>
            CONFIRMED ✓
          </span>
        ) : (
          <span
            className="animate-pulse"
            style={{ color: C.accent, fontSize: "9px", letterSpacing: "0.15em" }}
          >
            CONFIRM REQUIRED
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-0">
        {/* Left column — ECAM procedure crosscheck */}
        <div className="border-r" style={{ borderColor: C.border }}>
          <div
            className="px-3 py-1.5 border-b"
            style={{ borderColor: C.border }}
          >
            <span style={{ color: C.dim, fontSize: "8px", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              PROCEDURE COMPLETE
            </span>
          </div>
          <div className="px-3 py-2 flex flex-col gap-1">
            {ECAM_STEPS.map(({ id, label }) => {
              const done = !!state.completedSteps[id];
              return (
                <div
                  key={id}
                  className="flex items-center gap-2"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.04em",
                    color: done ? C.green : C.dim,
                    lineHeight: "1.5",
                  }}
                >
                  <span style={{ fontSize: "9px", flexShrink: 0, minWidth: "12px", color: done ? C.green : C.dim }}>
                    {done ? "✓" : "□"}
                  </span>
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column — STATUS crosscheck */}
        <div>
          <div
            className="px-3 py-1.5 border-b"
            style={{ borderColor: C.border }}
          >
            <span style={{ color: C.dim, fontSize: "8px", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              STATUS / SYSTEMS
            </span>
          </div>
          <div className="px-3 py-2 flex flex-col gap-1">
            {statusItems.map((item) => {
              const statusColor =
                item.severity === "caution"  ? "#FFB300" :
                item.severity === "advisory" ? "#00CFFF" :
                                              "#00D060";
              return (
                <div
                  key={item.id}
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.04em",
                    color: statusColor,
                    lineHeight: "1.5",
                  }}
                >
                  {item.line}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Verbal crosscheck callout */}
      {!chclmDone && (
        <div
          className="px-4 py-2 border-t"
          style={{ borderColor: C.accent + "30", backgroundColor: C.accentBg }}
        >
          <p style={{ color: "#7A8494", fontSize: "10px", lineHeight: "1.5", letterSpacing: "0.03em" }}>
            <span style={{ color: C.accent, fontWeight: 700 }}>PM→PF: </span>
            &ldquo;ECAM ACTIONS COMPLETE. AGENT 1 DISCHARGED. FIRE LIGHT [STATUS].&rdquo;
            &nbsp;&nbsp;
            <span style={{ color: C.amber, fontWeight: 700 }}>PF→PM: </span>
            &ldquo;CHECKED, MONITOR.&rdquo;
          </p>
        </div>
      )}

      {/* Confirm button */}
      <div className="px-4 py-3 border-t" style={{ borderColor: C.border }}>
        {chclmDone ? (
          <div
            className="flex items-center justify-center gap-2 py-2"
            style={{ color: C.green, fontSize: "10px", letterSpacing: "0.15em" }}
          >
            <span>✓</span>
            <span>CROSSCHECK COMPLETE — CRM CHECKLIST UNLOCKED</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => perform({ kind: "STEP", stepId: "crew_crosscheck" })}
            className="w-full py-2.5 border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: C.accent,
              backgroundColor: C.accentBg,
              color: C.accent,
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.accent + "20";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.accentBg;
            }}
          >
            CONFIRM CROSSCHECK — PM CREW
          </button>
        )}
      </div>
    </div>
  );
}
