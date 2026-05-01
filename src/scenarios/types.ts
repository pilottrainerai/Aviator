/**
 * Scenario authoring types. A scenario is fully described by data:
 * steps (the procedure), triggers (timed system events), and decisions
 * (the strategic call). The engine, runner, and UI are all driven from
 * this shape — no per-scenario code.
 */

import type {
  ScenarioMeta as RegistryMeta,
} from "./registry";

export type ECAMLevel = "warning" | "caution" | "advisory" | "memo";

export type ECAMMessage = {
  id: string;
  line: string;
  level: ECAMLevel;
};

export type ControlVariant =
  | "switch" // Two-state labeled switch (e.g., MASTER → OFF)
  | "warning" // Red illuminated pushbutton (FIRE pb)
  | "caution" // Amber illuminated pushbutton (AGENT)
  | "advisory"; // Blue informational pushbutton

export type DecisionTone = "primary" | "secondary" | "danger";

export type ScenarioStep = {
  id: string;
  /** Top label rendered on the control */
  label: string;
  /** Action label (e.g., "OFF", "PUSH", "DISCHARGE") */
  action: string;
  /** Description shown under the control + in the coach hint */
  hint: string;
  variant: ControlVariant;
  /** This step is only enabled / counted as "next" after these steps are completed */
  requires?: string[];
  /** Optional: skipping does not penalize correctness */
  optional?: boolean;
  /** Optional: side-effect that fires `delayMs` after this step is completed */
  afterEffect?: {
    delayMs: number;
    triggerId: string;
    effects: TriggerEffect[];
  };
};

export type TriggerEffect =
  | { type: "ADD_ECAM"; messages: ECAMMessage[] }
  | { type: "CLEAR_ECAM"; ids: string[] }
  | { type: "SET_MASTER_WARN"; active: boolean }
  | { type: "SET_ALARM_LABEL"; label: string | null };

export type ScenarioTrigger = {
  id: string;
  atMs: number;
  effects: TriggerEffect[];
  /** Description for the event log */
  description: string;
};

export type ScenarioDecision = {
  value: string;
  label: string;
  description: string;
  tone: DecisionTone;
};

export type ScenarioBrief = {
  situation: string;
  job: string;
};

export type Scenario = {
  meta: RegistryMeta;
  brief: ScenarioBrief;
  steps: ScenarioStep[];
  triggers: ScenarioTrigger[];
  decisions: ScenarioDecision[];
};
