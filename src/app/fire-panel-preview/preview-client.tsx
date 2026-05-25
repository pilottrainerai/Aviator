"use client";

import { useState } from "react";
import { FirePanel } from "@/components/cockpit/fire-panel";
import { eng1FireAfterV1 } from "@/scenarios/data/eng1-fire-after-v1";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";

// ─── Four canned states to flip between ──────────────────────────────────────

const STATES: { label: string; state: ScenarioState }[] = [
  {
    label: "① Before fire warning",
    state: {
      tMs: 0,
      completedSteps: {},
      triggersFired: {},
      ecamMessages: [],
      masterWarnActive: false,
      masterCautActive: false,
      alarmLabel: null,
      decision: null,
    },
  },
  {
    label: "② FIRE warning active — FIRE PB available",
    state: {
      tMs: 30_000,
      completedSteps: {
        continue_rotation: 1,
        positive_rate_gear_up: 2,
        engage_ap_fma: 3,
        cancel_master_warn: 4,
        four_hundred_ft_cmd: 5,
        thr_lever_idle: 6,
        eng1_master_off: 7,
      },
      triggersFired: { fire_warn: 8000 },
      ecamMessages: [],
      masterWarnActive: true,
      masterCautActive: false,
      alarmLabel: "ENG 1 FIRE",
      decision: null,
    },
  },
  {
    label: "③ FIRE PB pushed — AGENT 1 available",
    state: {
      tMs: 45_000,
      completedSteps: {
        continue_rotation: 1,
        positive_rate_gear_up: 2,
        engage_ap_fma: 3,
        cancel_master_warn: 4,
        four_hundred_ft_cmd: 5,
        thr_lever_idle: 6,
        eng1_master_off: 7,
        eng1_fire_pb: 8,
      },
      triggersFired: { fire_warn: 8000 },
      ecamMessages: [],
      masterWarnActive: false,
      masterCautActive: false,
      alarmLabel: "ENG 1 FIRE",
      decision: null,
    },
  },
  {
    label: "④ AGENT 1 discharged — AGENT 2 available",
    state: {
      tMs: 60_000,
      completedSteps: {
        continue_rotation: 1,
        positive_rate_gear_up: 2,
        engage_ap_fma: 3,
        cancel_master_warn: 4,
        four_hundred_ft_cmd: 5,
        thr_lever_idle: 6,
        eng1_master_off: 7,
        eng1_fire_pb: 8,
        agent1: 9,
      },
      triggersFired: { fire_warn: 8000 },
      ecamMessages: [],
      masterWarnActive: false,
      masterCautActive: false,
      alarmLabel: null,
      decision: null,
    },
  },
];

export function FirePanelPreviewClient() {
  const [idx, setIdx] = useState(0);
  const { label, state } = STATES[idx];

  const perform = (action: PilotAction) => {
    console.log("perform:", action);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
      {/* State picker */}
      <div className="flex flex-wrap gap-2 justify-center">
        {STATES.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className="font-mono text-[9px] uppercase tracking-[0.15em] px-3 py-1.5 border transition-colors"
            style={{
              borderColor: i === idx ? "#00CFFF" : "#2A3040",
              color: i === idx ? "#00CFFF" : "#4A5060",
              background: i === idx ? "#00CFFF10" : "transparent",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Current state label */}
      <p className="font-mono text-[10px] text-[#4A5060] tracking-wider">{label}</p>

      {/* The actual component */}
      <FirePanel
        scenario={eng1FireAfterV1}
        state={state}
        perform={perform}
        disabled={false}
      />

      {/* What each button does */}
      <div
        className="w-full font-mono text-[9px] text-[#3A4050] border border-[#1C2130] p-4 flex flex-col gap-1"
        style={{ background: "#060809" }}
      >
        <span className="text-[#5A6070] mb-1 uppercase tracking-wider">Step wiring</span>
        <span>ENG 1 FIRE PUSH  →  step: <span className="text-[#00CFFF]">eng1_fire_pb</span>  (requires thr_lever_idle + eng1_master_off)</span>
        <span>AGENT 1 DISCH    →  step: <span className="text-[#00CFFF]">agent1</span>          (requires eng1_fire_pb)</span>
        <span>AGENT 2 DISCH    →  step: <span className="text-[#00CFFF]">agent2</span>          (requires agent1, optional)</span>
        <span>APU / ENG 2      →  display-only, not wired</span>
      </div>
    </div>
  );
}
