/**
 * Generic scenario events. Pilot actions and system effects are both
 * expressed as events; the reducer is the single source of state truth.
 */

import type { TriggerEffect } from "@/scenarios/types";

export type PilotAction =
  | { kind: "STEP"; stepId: string }
  | { kind: "DECISION"; value: string };

export type SystemTrigger =
  | { kind: "TRIGGER"; triggerId: string; effects: TriggerEffect[] }
  | { kind: "EFFECT"; sourceId: string; effects: TriggerEffect[] };

export type ScenarioEvent =
  | ({ tMs: number; source: "pilot" } & PilotAction)
  | ({ tMs: number; source: "system" } & SystemTrigger);

export type Event = ScenarioEvent;
