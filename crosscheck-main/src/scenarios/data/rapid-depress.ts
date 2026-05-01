import type { Scenario } from "@/scenarios/types";
import { RAPID_DEPRESS_META } from "@/scenarios/registry";

export const rapidDepress: Scenario = {
  meta: RAPID_DEPRESS_META,
  brief: {
    situation:
      "At cruise altitude, cabin altitude is rising rapidly. The CABIN ALT HI warning illuminates. Time of useful consciousness without oxygen is seconds.",
    job: "Don oxygen, announce on PA, initiate emergency descent to 10,000 ft, declare emergency to ATC, plan a diversion.",
  },
  triggers: [
    {
      id: "depress",
      atMs: 4_000,
      description: "CABIN ALT HI",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "CABIN ALT HI" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "cabin_alt", line: "CABIN ALT HI", level: "warning" },
            { id: "excess_cabin", line: "EXCESS CABIN ALT", level: "caution" },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      id: "oxygen",
      label: "CREW OXYGEN MASKS",
      action: "ON / 100%",
      hint: "Don your mask immediately. 100% oxygen, microphone on.",
      variant: "warning",
    },
    {
      id: "pa_announce",
      label: "PASSENGERS",
      action: "PA — MASKS ON",
      hint: "Announce to passengers via PA: oxygen masks on now.",
      variant: "caution",
      requires: ["oxygen"],
    },
    {
      id: "emer_descent",
      label: "EMER DESCENT",
      action: "INITIATE",
      hint: "Begin emergency descent to 10,000 ft or MEA, whichever is higher.",
      variant: "warning",
      requires: ["oxygen"],
      afterEffect: {
        delayMs: 5_000,
        triggerId: "level_off",
        effects: [
          { type: "CLEAR_ECAM", ids: ["excess_cabin"] },
          { type: "SET_MASTER_WARN", active: false },
        ],
      },
    },
    {
      id: "atc_squawk",
      label: "ATC",
      action: "SQUAWK 7700",
      hint: "Declare emergency to ATC, transponder 7700.",
      variant: "caution",
      requires: ["emer_descent"],
    },
  ],
  decisions: [
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Divert to the nearest airport with adequate facilities.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Return to departure if it remains the closest suitable.",
      tone: "primary",
    },
    {
      value: "CONTINUE_LOW",
      label: "CONTINUE LOW",
      description: "Continue at low altitude — only viable if range/fuel allows.",
      tone: "secondary",
    },
    {
      value: "RECLIMB",
      label: "RE-CLIMB",
      description: "Re-climb after the leak — never appropriate without diagnosis.",
      tone: "danger",
    },
  ],
};
