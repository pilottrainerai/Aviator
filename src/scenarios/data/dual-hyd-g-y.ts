import type { Scenario } from "@/scenarios/types";
import { DUAL_HYD_G_Y_META } from "@/scenarios/registry";

export const dualHydGY: Scenario = {
  meta: DUAL_HYD_G_Y_META,
  brief: {
    situation:
      "In cruise, both green and yellow hydraulic systems lose pressure. Flight controls degrade significantly. Flaps are limited to position 3.",
    job: "Recognize the failure, run ECAM actions, prepare for a degraded landing, brief the cabin, and decide where to put it down.",
  },
  triggers: [
    {
      id: "hyd_loss",
      atMs: 4_000,
      description: "HYD G+Y LO PR",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "HYD G+Y LO PR" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "hyd_g_y", line: "HYD G+Y LO PR", level: "warning" },
            { id: "flap_limit", line: "F/CTL ALTN LAW", level: "caution" },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      id: "recognize",
      label: "FAILURE",
      action: "IDENTIFY",
      hint: "Confirm both green and yellow systems are lost — not a spurious indication.",
      variant: "switch",
    },
    {
      id: "ecam_actions",
      label: "ECAM ACTIONS",
      action: "RUN",
      hint: "Step through the ECAM line by line.",
      variant: "switch",
      requires: ["recognize"],
      afterEffect: {
        delayMs: 5_000,
        triggerId: "ecam_complete",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
          { type: "CLEAR_ECAM", ids: ["flap_limit"] },
        ],
      },
    },
    {
      id: "flaps_3",
      label: "FLAPS",
      action: "3 (MAX)",
      hint: "Maximum flap setting available is FLAPS 3. Plan accordingly.",
      variant: "switch",
      requires: ["ecam_actions"],
    },
    {
      id: "landing_dist",
      label: "LDG DIST",
      action: "COMPUTE",
      hint: "Calculate the increased landing distance from the QRH performance section.",
      variant: "switch",
      requires: ["flaps_3"],
    },
    {
      id: "cabin_brief",
      label: "CABIN",
      action: "BRIEF",
      hint: "Brief the senior cabin crew member on the degraded landing.",
      variant: "caution",
      requires: ["landing_dist"],
    },
  ],
  decisions: [
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Land at the nearest suitable airport with adequate runway.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Return to departure if runway length is adequate.",
      tone: "primary",
    },
    {
      value: "DESTINATION",
      label: "DESTINATION",
      description: "Continue to destination — only if performance is acceptable.",
      tone: "secondary",
    },
    {
      value: "CONTINUE_AS_FILED",
      label: "CONTINUE AS FILED",
      description: "Treat the failure as routine — never appropriate here.",
      tone: "danger",
    },
  ],
};
