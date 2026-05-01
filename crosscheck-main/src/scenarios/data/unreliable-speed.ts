import type { Scenario } from "@/scenarios/types";
import { UNRELIABLE_SPEED_META } from "@/scenarios/registry";

export const unreliableSpeed: Scenario = {
  meta: UNRELIABLE_SPEED_META,
  brief: {
    situation:
      "Airspeed indications disagree across captain, FO, and standby. Pitot or static blockage suspected. Autopilot disengages.",
    job: "Stop chasing airspeed. Fly pitch and thrust by reference. Disengage automation, run the unreliable-speed memory items, and divert.",
  },
  triggers: [
    {
      id: "unreliable",
      atMs: 4_000,
      description: "Speed disagree",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ANTI ICE / SPD DISAGREE" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "spd_disagree", line: "IAS DISCREPANCY", level: "caution" },
            { id: "ap_off", line: "AUTOPILOT OFF", level: "caution" },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      id: "fly_pitch",
      label: "PITCH + THRUST",
      action: "FLY MANUALLY",
      hint: "Establish reference pitch and thrust setting. Stop chasing the airspeed needle.",
      variant: "switch",
    },
    {
      id: "ap_disengage",
      label: "AUTOPILOT",
      action: "OFF",
      hint: "Disengage autopilot — it's working from contaminated data.",
      variant: "switch",
      requires: ["fly_pitch"],
    },
    {
      id: "fd_off",
      label: "FLIGHT DIRECTORS",
      action: "OFF",
      hint: "Turn off flight directors so they don't drive the wrong target.",
      variant: "switch",
      requires: ["ap_disengage"],
    },
    {
      id: "unreliable_memory",
      label: "UNRELIABLE SPD",
      action: "RUN MEMORY",
      hint: "Apply the unreliable-airspeed memory items, then refer to QRH.",
      variant: "caution",
      requires: ["fd_off"],
      afterEffect: {
        delayMs: 4_000,
        triggerId: "stable",
        effects: [
          { type: "CLEAR_ECAM", ids: ["ap_off"] },
          { type: "SET_MASTER_WARN", active: false },
        ],
      },
    },
  ],
  decisions: [
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Land at the nearest field with a clear approach.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Return to a known field with familiar approach.",
      tone: "primary",
    },
    {
      value: "CONTINUE_VISUAL",
      label: "CONTINUE VFR",
      description: "Continue in clear visual conditions — only with confirmed visual reference.",
      tone: "secondary",
    },
    {
      value: "PRESS_ON_IFR",
      label: "PRESS ON IFR",
      description: "Continue IFR with bad airspeed — never appropriate.",
      tone: "danger",
    },
  ],
};
