import type { Scenario } from "@/scenarios/types";
import { ENG1_FIRE_AFTER_V1_META } from "@/scenarios/registry";

export const eng1FireAfterV1: Scenario = {
  meta: ENG1_FIRE_AFTER_V1_META,
  brief: {
    situation:
      "You are taking off in an A320. Two seconds after passing V1, the MASTER WARN illuminates and the ECAM displays ENG 1 FIRE.",
    job: "Run the abnormal procedure in real time, contain the fire, and make the right landing decision.",
  },
  triggers: [
    {
      id: "after_v1",
      atMs: 6_000,
      description: "V1 passed",
      effects: [],
    },
    {
      id: "fire_warn",
      atMs: 8_000,
      description: "ENG 1 FIRE warning",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 FIRE" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "eng1_fire", line: "ENG 1 FIRE", level: "warning" },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      id: "eng1_master_off",
      label: "ENG 1 MASTER",
      action: "OFF",
      hint: "Cut fuel to engine 1 immediately on confirmed fire.",
      variant: "switch",
    },
    {
      id: "eng1_fire_pb",
      label: "ENG 1 FIRE",
      action: "PUSH",
      hint: "Isolates the engine and arms the extinguisher agents.",
      variant: "warning",
      requires: ["eng1_master_off"],
    },
    {
      id: "agent1",
      label: "AGENT 1",
      action: "DISCHARGE",
      hint: "First extinguisher bottle. Wait 30s for effect.",
      variant: "caution",
      requires: ["eng1_fire_pb"],
      afterEffect: {
        delayMs: 5_000,
        triggerId: "fire_extinguished",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
          { type: "SET_ALARM_LABEL", label: null },
          { type: "CLEAR_ECAM", ids: ["eng1_fire"] },
        ],
      },
    },
    {
      id: "agent2",
      label: "AGENT 2",
      action: "DISCHARGE",
      hint: "Backup bottle. Use only if AGENT 1 doesn't extinguish.",
      variant: "caution",
      requires: ["agent1"],
      optional: true,
    },
  ],
  decisions: [
    {
      value: "LAND_ASAP",
      label: "LAND ASAP",
      description: "Land at the nearest suitable airport, no delay.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Turn back and land at the departure airport.",
      tone: "primary",
    },
    {
      value: "DIVERT",
      label: "DIVERT",
      description: "Land at an alternate airport on the route.",
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
