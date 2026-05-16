"use client";

import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario } from "@/scenarios/types";

// ─── A320 Glareshield — MASTER WARN / MASTER CAUTION pushbutton lights ────────
// FCOM DSC-31-20: MASTER WARN = red, flashing, CRC active.
//                 MASTER CAUTION = amber, steady, single-chime active.
// PM pushes the illuminated light to cancel audio + reset the light.
// ECAM messages remain displayed regardless.

export function GlareshieldPanel({
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
  // Collect all glareshield steps by variant — supports any number of cancel steps
  const allMwSteps = scenario.steps.filter((s) => s.group === "glareshield" && s.variant === "warning");
  const allMcSteps = scenario.steps.filter((s) => s.group === "glareshield" && s.variant === "caution");

  if (!allMwSteps.length && !allMcSteps.length) return null;

  // Current actionable step = first one not yet completed
  const mwStep = allMwSteps.find((s) => !state.completedSteps[s.id]) ?? null;
  const mcStep = allMcSteps.find((s) => !state.completedSteps[s.id]) ?? null;

  // All done = every step of that type is completed
  const mwDone = allMwSteps.length > 0 && allMwSteps.every((s) => !!state.completedSteps[s.id]);
  const mcDone = allMcSteps.length > 0 && allMcSteps.every((s) => !!state.completedSteps[s.id]);

  // Check requires on the current active step
  const mwReqsMet = (mwStep?.requires ?? []).every((r) => !!state.completedSteps[r]);
  const mcReqsMet = (mcStep?.requires ?? []).every((r) => !!state.completedSteps[r]);

  const mwAviatePending = state.masterWarnActive && !!mwStep && !mwReqsMet;

  return (
    <div
      className="border font-mono"
      style={{ borderColor: "#1C2130", backgroundColor: "#050709" }}
    >
      {/* Buttons row — no header, compact */}
      <div className="flex gap-3 px-3 py-2">
        {/* ── MASTER WARN ── */}
        {allMwSteps.length > 0 && (
          <MasterButton
            id={mwStep?.id ?? "cancel_master_warn"}
            label="MASTER"
            sublabel="WARN"
            symbol="⚡"
            active={state.masterWarnActive && !!mwStep && !mwDone}
            done={mwDone}
            activeColor="#FF3333"
            activeBg="#FF333318"
            activeBorder="#FF3333"
            inactiveBg="#120808"
            inactiveBorder="#3A1010"
            pulse
            disabled={disabled || mwDone || !state.masterWarnActive || !mwReqsMet || !mwStep}
            crew="PM"
            activeLabel={mwAviatePending ? "AVIATE FIRST" : "CRC ACTIVE"}
            doneLabel=""
            onClick={() => mwStep && perform({ kind: "STEP", stepId: mwStep.id })}
          />
        )}

        {/* ── MASTER CAUTION ── */}
        {allMcSteps.length > 0 && (
          <MasterButton
            id={mcStep?.id ?? "cancel_master_caut"}
            label="MASTER"
            sublabel="CAUT"
            symbol="△"
            active={state.masterCautActive && !!mcStep && !mcDone && mcReqsMet}
            done={mcDone}
            activeColor="#FFB300"
            activeBg="#FFB30018"
            activeBorder="#FFB300"
            inactiveBg="#100D00"
            inactiveBorder="#3A2E00"
            pulse={false}
            disabled={disabled || mcDone || !state.masterCautActive || !mcReqsMet || !mcStep}
            crew="PM"
            activeLabel="SC ACTIVE"
            doneLabel=""
            onClick={() => mcStep && perform({ kind: "STEP", stepId: mcStep.id })}
          />
        )}
      </div>
    </div>
  );
}

function MasterButton({
  label,
  sublabel,
  symbol,
  active,
  done,
  activeColor,
  activeBg,
  activeBorder,
  inactiveBg,
  inactiveBorder,
  pulse,
  disabled,
  crew,
  activeLabel,
  doneLabel,
  onClick,
}: {
  id: string;
  label: string;
  sublabel: string;
  symbol: string;
  active: boolean;
  done: boolean;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
  inactiveBg: string;
  inactiveBorder: string;
  pulse: boolean;
  disabled?: boolean;
  crew: "PF" | "PM";
  activeLabel: string;
  doneLabel: string;
  onClick: () => void;
}) {
  const color = active ? activeColor : done ? "#3A4050" : "#2A3040";
  const bg    = active ? activeBg   : done ? "#0A0D14"  : inactiveBg;
  const border = active ? activeBorder : done ? "#1C2130" : inactiveBorder;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-[3px] border-2 transition-all disabled:cursor-not-allowed ${
        active && pulse ? "animate-pulse" : ""
      }`}
      style={{
        width: "90px",
        height: "70px",
        backgroundColor: bg,
        borderColor: border,
        borderRadius: "2px",
        boxShadow: active ? `0 0 12px ${activeColor}40, inset 0 0 8px ${activeColor}20` : "none",
      }}
    >
      {/* Symbol */}
      <span style={{ fontSize: "16px", color, lineHeight: 1 }}>
        {symbol}
      </span>

      {/* Label lines */}
      <span style={{ fontSize: "8px", letterSpacing: "0.15em", color, fontWeight: 700, textTransform: "uppercase", lineHeight: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: "9px", letterSpacing: "0.12em", color, fontWeight: 800, textTransform: "uppercase", lineHeight: 1 }}>
        {sublabel}
      </span>

      {/* Status chip */}
      <span
        style={{
          fontSize: "7px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: active ? activeColor : done ? "#00D060" : "#3A4050",
          marginTop: "1px",
        }}
      >
        {done ? doneLabel : active ? activeLabel : "STANDBY"}
      </span>

      {/* Crew badge */}
      {active && (
        <span
          className="absolute top-1 right-1 px-1 py-[1px] rounded-sm"
          style={{
            fontSize: "7px",
            letterSpacing: "0.08em",
            backgroundColor: crew === "PM" ? "#FFB30020" : "#00CFFF20",
            color: crew === "PM" ? "#FFB300" : "#00CFFF",
          }}
        >
          {crew}
        </span>
      )}
    </button>
  );
}
