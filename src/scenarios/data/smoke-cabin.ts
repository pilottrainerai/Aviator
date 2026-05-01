import type { Scenario } from "@/scenarios/types";
import { SMOKE_CABIN_META } from "@/scenarios/registry";

export const smokeCabin: Scenario = {
  meta: SMOKE_CABIN_META,
  brief: {
    situation:
      "The senior cabin crew reports thick smoke in the cabin, source unknown. ECAM displays SMOKE CABIN. The flight deck is clear but conditions are deteriorating.",
    job: "Don oxygen masks at 100%, establish crew communication, run the smoke procedure to identify the source, and decide whether to land immediately.",
  },
  triggers: [
    {
      id: "smoke",
      atMs: 4_000,
      description: "SMOKE CABIN",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "SMOKE CABIN" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "smoke_cab", line: "SMOKE CABIN", level: "warning" },
            { id: "smoke_unkn", line: "SOURCE UNKNOWN", level: "caution" },
          ],
        },
      ],
    },
  ],
  steps: [
    {
      id: "masks_100",
      label: "OXYGEN MASKS",
      action: "ON / 100%",
      hint: "Don masks at 100% oxygen, regulators to EMER if needed.",
      variant: "warning",
    },
    {
      id: "comm",
      label: "CREW COMM",
      action: "ESTABLISH",
      hint: "Establish flight-deck communication via the mask interphone.",
      variant: "caution",
      requires: ["masks_100"],
    },
    {
      id: "smoke_proc",
      label: "SMOKE PROCEDURE",
      action: "RUN",
      hint: "Apply the SMOKE / FUMES procedure to isolate the source.",
      variant: "switch",
      requires: ["masks_100"],
      afterEffect: {
        delayMs: 5_000,
        triggerId: "source_isolated",
        effects: [
          { type: "CLEAR_ECAM", ids: ["smoke_unkn"] },
        ],
      },
    },
    {
      id: "signs",
      label: "PAX SIGNS",
      action: "ON",
      hint: "Seatbelts on. No-smoking on. Brief the cabin.",
      variant: "switch",
      requires: ["smoke_proc"],
    },
  ],
  decisions: [
    {
      value: "LAND_IMMEDIATELY",
      label: "LAND IMMEDIATELY",
      description: "Smoke source not isolated — land at the nearest field, no delay.",
      tone: "primary",
    },
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Divert to the nearest suitable airport.",
      tone: "primary",
    },
    {
      value: "CONTINUE_BRIEFLY",
      label: "CONTINUE BRIEFLY",
      description: "Continue if the source is positively isolated and stable.",
      tone: "secondary",
    },
    {
      value: "PRESS_ON",
      label: "PRESS ON",
      description: "Continue normal flight plan — never appropriate with active smoke.",
      tone: "danger",
    },
  ],
};
