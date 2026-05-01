/**
 * Generic scenario state. Pure data — no aircraft systems, no scenario-specific
 * fields. The reducer mutates only via reduce(state, event).
 */

import type { ECAMMessage } from "@/scenarios/types";

export type ScenarioState = {
  /** Wall-clock ms since session start, set by the most recent event */
  tMs: number;
  /** stepId → completion order (1, 2, 3, ...) */
  completedSteps: Record<string, number>;
  /** triggerId → tMs the trigger fired */
  triggersFired: Record<string, number>;
  /** Live ECAM messages */
  ecamMessages: ECAMMessage[];
  /** Big red banner active */
  masterWarnActive: boolean;
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
  alarmLabel: null,
  decision: null,
});

export type { ECAMMessage } from "@/scenarios/types";
