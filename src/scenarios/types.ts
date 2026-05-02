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
  /** Optional: references an ECAMMessage.id — that message turns green when this step is done */
  ecamRef?: string;
  /** "PF" = Pilot Flying, "PM" = Pilot Monitoring. Displayed as a badge on the control. */
  crew?: "PF" | "PM";
  /**
   * "procedure" (default) = shown in CockpitControls (ECAM actions).
   * "comms" = shown in CommChecklist (crew / cabin / pax / company confirmations).
   */
  /** "flightcheck" = timed PF/PM coordination popup, gates ECAM actions */
  group?: "procedure" | "comms" | "glareshield" | "chclm" | "flightcheck";
  /** Optional structured bullet points shown in CommChecklist when the card is active */
  notes?: readonly string[];
  /**
   * Airbus confirm-before-action: two-phase button.
   * First click = verbal confirmation (PF→PM), second click = execute.
   * Used for irreversible actions: MASTER OFF, FIRE PB.
   */
  confirmRequired?: boolean;
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
  | { type: "SET_MASTER_CAUT"; active: boolean }
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

/** Source of a distraction communication */
export type DistractionKind = "atc" | "crew" | "cabin" | "company" | "flightcheck";

export type DistractionChoice = {
  id: string;
  label: string;
  /** Whether this is the correct/expected response for scoring */
  correct: boolean;
};

export type ScenarioDistraction = {
  id: string;
  /** Wall-clock ms after session start when this fires */
  atMs: number;
  kind: DistractionKind;
  /** Display name of the caller — "ATC LONDON", "PURSER", "F/O", etc. */
  from: string;
  message: string;
  choices: DistractionChoice[];
  /** Auto-dismiss after this many ms if not responded to (default 20 000) */
  autoDismissMs?: number;
  /** If pilot says Stand By, re-surface after this many ms (default 25 000) */
  standbyResurfaceMs?: number;
};

export type StatusItem = {
  id: string;
  /** Formatted line as it appears on the A320 STATUS page */
  line: string;
  /** caution = amber, advisory = cyan, memo = green */
  severity: "caution" | "advisory" | "memo";
};

export type Scenario = {
  meta: RegistryMeta;
  brief: ScenarioBrief;
  steps: ScenarioStep[];
  triggers: ScenarioTrigger[];
  decisions: ScenarioDecision[];
  /** Items shown on the STATUS page after all required ECAM actions are complete */
  statusItems?: readonly StatusItem[];
  /** Timed interruptions that simulate a real flying environment */
  distractions?: readonly ScenarioDistraction[];
};
