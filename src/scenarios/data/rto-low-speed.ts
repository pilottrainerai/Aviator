import type { Scenario } from "@/scenarios/types";
import { RTO_LOW_SPEED_META } from "@/scenarios/registry";

export const rtoLowSpeed: Scenario = {
  meta: RTO_LOW_SPEED_META,
  brief: {
    situation:
      "You are accelerating on takeoff roll. Below V1, an ENG 1 STALL warning illuminates. The decision is binary: reject or commit.",
    job: "Reject the takeoff cleanly: throttles to idle, max reverse, max manual braking, declare emergency. Stop the aircraft on the runway.",
  },
  triggers: [
    {
      id: "engine_stall",
      atMs: 4_000,
      description: "ENG 1 STALL warning",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 STALL" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "eng1_stall", line: "ENG 1 STALL", level: "warning" },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      id: "throttles_idle",
      label: "THROTTLES",
      action: "IDLE",
      hint: "Power back to idle. The reject is committed.",
      variant: "switch",
    },
    {
      id: "reversers_max",
      label: "REVERSERS",
      action: "MAX REVERSE",
      hint: "Apply maximum reverse thrust on both engines.",
      variant: "switch",
      requires: ["throttles_idle"],
    },
    {
      id: "brakes_max",
      label: "BRAKES",
      action: "MAX MANUAL",
      hint: "Override autobrake with maximum manual braking.",
      variant: "switch",
      requires: ["throttles_idle"],
    },
    {
      id: "atc_declare",
      label: "ATC",
      action: "DECLARE EMERGENCY",
      hint: "Tell ATC you are rejecting, declare the nature.",
      variant: "caution",
      requires: ["throttles_idle"],
      afterEffect: {
        delayMs: 4_000,
        triggerId: "stopped",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
          { type: "SET_ALARM_LABEL", label: null },
          { type: "CLEAR_ECAM", ids: ["eng1_stall"] },
        ],
      },
    },
  ],
  decisions: [
    {
      value: "HOLD_ON_RUNWAY",
      label: "HOLD ON RUNWAY",
      description: "Stop and hold position. Await fire/rescue assessment.",
      tone: "primary",
    },
    {
      value: "EVACUATE",
      label: "EVACUATE",
      description: "Order evacuation if fire or smoke is confirmed.",
      tone: "primary",
    },
    {
      value: "TAXI_OFF",
      label: "TAXI CLEAR",
      description: "Taxi off the runway only if positively safe to do so.",
      tone: "secondary",
    },
    {
      value: "ATTEMPT_TAKEOFF",
      label: "RE-ATTEMPT",
      description: "Attempt takeoff again after a reject — never appropriate.",
      tone: "danger",
    },
  ],
};
