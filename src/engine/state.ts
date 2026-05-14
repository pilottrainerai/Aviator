/**
 * Generic scenario state. Pure data — no aircraft systems, no scenario-specific
 * fields. The reducer mutates only via reduce(state, event).
 */

import type { ECAMMessage } from "@/scenarios/types";

export type ScenarioState = {
  /** Wall-clock ms since session start, set by the most recent event */
  tMs: number;
  /** stepId → tMs the step completed.  Truthy = done; the numeric value
   *  is used by countdown UIs (AGENT arm timer, 30 s fire-warn window). */
  completedSteps: Record<string, number>;
  /** triggerId → tMs the trigger fired */
  triggersFired: Record<string, number>;
  /** Live ECAM messages */
  ecamMessages: ECAMMessage[];
  /** MASTER WARN glareshield light (red, flashing) — CRC active */
  masterWarnActive: boolean;
  /** MASTER CAUTION glareshield light (amber, steady) — SC chime active */
  masterCautActive: boolean;
  /** Optional alarm label rendered alongside MASTER WARN */
  alarmLabel: string | null;
  /** Pilot's strategic decision, if any */
  decision: { value: string; tMs: number } | null;
};

export const initialScenarioState = (): ScenarioState => ({
  tMs: 0,
  completedSteps: {},
  triggersFired: {},
  ecamMessages: [],
  masterWarnActive: false,
  masterCautActive: false,
  alarmLabel: null,
  decision: null,
});

export type { ECAMMessage } from "@/scenarios/types";
