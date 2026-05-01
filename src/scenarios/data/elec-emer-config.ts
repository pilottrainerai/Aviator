import type { Scenario } from "@/scenarios/types";
import { ELEC_EMER_CONFIG_META } from "@/scenarios/registry";

export const elecEmerConfig: Scenario = {
  meta: ELEC_EMER_CONFIG_META,
  brief: {
    situation:
      "Total loss of normal electrical power. The aircraft transitions to emergency electrical configuration on battery and RAT. You have limited time before battery exhaustion.",
    job: "Activate the emergency electrical configuration, deploy the RAT, run ECAM, and plan an immediate descent and landing.",
  },
  triggers: [
    {
      id: "elec_loss",
      atMs: 4_000,
      description: "ELEC EMER CONFIG",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ELEC EMER CONFIG" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "elec_emer", line: "ELEC EMER CONFIG", level: "warning" },
            { id: "elec_battery", line: "BATTERY ONLY", level: "caution" },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      id: "emer_pb",
      label: "EMER ELEC PWR",
      action: "MAN ON",
      hint: "Manually activate emergency electrical configuration.",
      variant: "warning",
    },
    {
      id: "ram_air",
      label: "RAM AIR (RAT)",
      action: "DEPLOY",
      hint: "Deploy ram air turbine for emergency hydraulic + electrical power.",
      variant: "warning",
      requires: ["emer_pb"],
    },
    {
      id: "ecam_actions",
      label: "ECAM ACTIONS",
      action: "RUN",
      hint: "Step through battery-only configuration items.",
      variant: "switch",
      requires: ["emer_pb"],
      afterEffect: {
        delayMs: 4_000,
        triggerId: "ecam_complete",
        effects: [
          { type: "CLEAR_ECAM", ids: ["elec_battery"] },
          { type: "SET_MASTER_WARN", active: false },
        ],
      },
    },
    {
      id: "descend",
      label: "DESCENT",
      action: "INITIATE",
      hint: "Battery has limited duration — plan immediate descent.",
      variant: "switch",
      requires: ["ecam_actions"],
    },
  ],
  decisions: [
    {
      value: "LAND_IMMEDIATELY",
      label: "LAND IMMEDIATELY",
      description: "Nearest suitable airport, immediate approach.",
      tone: "primary",
    },
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Divert to the nearest field with sufficient infrastructure.",
      tone: "primary",
    },
    {
      value: "CONTINUE_TO_DESTINATION",
      label: "CONTINUE",
      description: "Continue to destination — battery won't last that long.",
      tone: "danger",
    },
  ],
};
