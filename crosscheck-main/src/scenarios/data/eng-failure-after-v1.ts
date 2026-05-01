import type { Scenario } from "@/scenarios/types";
import { ENG_FAILURE_AFTER_V1_META } from "@/scenarios/registry";

export const engFailureAfterV1: Scenario = {
  meta: ENG_FAILURE_AFTER_V1_META,
  brief: {
    situation:
      "Two seconds after passing V1, ENG 1 fails — no fire, but asymmetric thrust. Yaw and roll into the dead engine. ECAM displays ENG 1 FAIL.",
    job: "Maintain centerline with rudder, climb out at V2, secure the engine, and make the right landing call.",
  },
  triggers: [
    { id: "after_v1", atMs: 6_000, description: "V1 passed", effects: [] },
    {
      id: "engine_fail",
      atMs: 8_000,
      description: "ENG 1 FAIL",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 FAIL" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "eng1_fail", line: "ENG 1 FAIL", level: "warning" },
            { id: "eng1_thrust_loss", line: "THR LEVERS....IDLE", level: "caution" },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      id: "rudder",
      label: "RUDDER",
      action: "AS REQ",
      hint: "Apply rudder to maintain centerline against the yaw.",
      variant: "switch",
    },
    {
      id: "pitch_v2",
      label: "PITCH",
      action: "V2 + 10",
      hint: "Hold V2 + 10 in the climb. Do not chase airspeed.",
      variant: "switch",
    },
    {
      id: "ecam_actions",
      label: "ECAM ACTIONS",
      action: "EXECUTE",
      hint: "Run the ENG 1 FAIL ECAM line items.",
      variant: "switch",
      requires: ["rudder", "pitch_v2"],
      afterEffect: {
        delayMs: 4_000,
        triggerId: "ecam_complete",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
          { type: "SET_ALARM_LABEL", label: null },
          { type: "CLEAR_ECAM", ids: ["eng1_thrust_loss"] },
        ],
      },
    },
    {
      id: "green_dot",
      label: "GREEN DOT",
      action: "ESTABLISH",
      hint: "Establish green-dot speed for clean single-engine climb.",
      variant: "switch",
      requires: ["ecam_actions"],
    },
  ],
  decisions: [
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Turn back and land at the departure airport.",
      tone: "primary",
    },
    {
      value: "LAND_ASAP",
      label: "LAND ASAP",
      description: "Land at the nearest suitable airport, no delay.",
      tone: "primary",
    },
    {
      value: "DIVERT",
      label: "DIVERT",
      description: "Land at an alternate on the route.",
      tone: "secondary",
    },
    {
      value: "CONTINUE",
      label: "CONTINUE",
      description: "Press on with the original flight plan.",
      tone: "danger",
    },
  ],
};
