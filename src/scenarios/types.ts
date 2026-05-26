/**
 * Scenario authoring types. A scenario is fully described by data:
 * steps (the procedure), triggers (timed system events), and decisions
 * (the strategic call). The engine, runner, and UI are all driven from
 * this shape — no per-scenario code.
 */

import type {
  ScenarioMeta as RegistryMeta,
} from "./registry";
import type { AirportOption } from "@/data/india-airports";

export type { AirportOption };

// FCOM DSC-31-60 ECAM colour convention:
//   warning  = red    (CRC alarm, critical)
//   caution  = amber  (SC chime, non-critical)
//   advisory = cyan   (procedure ACTION items: "THR LEVER 1 ... IDLE")
//   remark   = white  (conditional headers / remarks: "·IF FIRE WARN AFTER 30 S")
//   memo     = green  (normal/satisfied indications)
export type ECAMLevel = "warning" | "caution" | "advisory" | "remark" | "memo";

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
  /**
   * True for steps confirmed by a physical left-panel control (pushbutton, switch, lever).
   * FlightCheckPopup skips these — they complete when the pilot presses the hardware.
   */
  hardware?: boolean;
  /**
   * This step is only surfaced in the FlightCheckPopup after the named trigger has fired.
   * Use to gate procedure cards on system events (e.g. engine failure trigger).
   */
  requiresTrigger?: string;
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
  /** Wall-clock ms after session start when this fires.  If `requiresStep` is
   *  set, this becomes a *minimum* delay — the distraction only fires once
   *  the step is complete AND the elapsed time has reached atMs. */
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
  /** If set, this distraction only fires once the named step is complete.
   *  Use for ATC calls that must come after a procedural milestone — e.g.
   *  ATC requesting briefing info only after the crew has finished ECAM. */
  requiresStep?: string;
  /** Optional. The pilot's call to ATC that PRECEDES the ATC message in this
   *  exchange.  When set, the distraction modal renders it as the first line
   *  ("FLIGHT CREW → ATC") so the user sees the full back-and-forth: pilot's
   *  call → ATC's response → crew's readback (choices).  Use for pilot-
   *  initiated calls and for any call where seeing the pilot's prior message
   *  adds training value.  Omit for routine ATC-initiated calls. */
  pilotSays?: string;
};

export type StatusItem = {
  id: string;
  /** Formatted line as it appears on the A320 STATUS page */
  line: string;
  /** caution = amber, advisory = cyan, memo = green */
  severity: "caution" | "advisory" | "memo";
  /** If true, item appears in the right-hand INOP SYS column (FCOM STATUS layout) */
  inopSys?: boolean;
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
  /** Declarative system display tabs (if absent, SystemDisplay falls back to hardcoded ENG 1 FIRE pages) */
  systemTabs?: readonly SysTabDef[];
  /** Declarative engine/fire panel config (if absent, FirePanel falls back to hardcoded ENG 1 FIRE rendering) */
  engineDisplay?: EngineDisplayDef;
  /** Phase-by-phase cockpit channel state: PFD, ND, PF, PM, ATC, overhead */
  phases?: readonly ScenarioPhase[];
  /** If present, a pre-start airport picker is shown in the briefing screen. */
  airports?: readonly AirportOption[];
};

// ─── System / Engine display DSL ─────────────────────────────────────────────
// Declarative config for SystemDisplay + FirePanel. Pure data, no functions.
// The component resolves each "states" array in order — first matching when wins.

export type SysColor = "green" | "amber" | "red" | "cyan" | "dim";
export type SysSwState = "norm" | "fault" | "off" | "auto" | "open" | "fire" | "armed";

/** Condition: undefined = always matches (use as final/default case) */
export type SysWhen = { step?: string; trigger?: string };
export type SysCase<T> = { when?: SysWhen; value: T };
export type SysVal = { v: string; c: SysColor };

export type SysRowDef    = { label: string; unit?: string; states: SysCase<SysVal>[] };
export type SysSwitchDef = { label: string; sub?: string;  states: SysCase<SysSwState>[] };
export type SysTrayDef   = { title: string; note?: string; switches: SysSwitchDef[] };
export type SysSectionDef = {
  title: string;
  colorStates: SysCase<SysColor>[];
  rows: SysRowDef[];
};
export type SysTabDef = {
  id: string; label: string;
  alertStates: SysCase<boolean>[];
  autoSelect?: SysWhen;
  sections: SysSectionDef[];
  tray?: SysTrayDef;
};
export type EngTrayDef     = { title: string; note?: string; switches: SysSwitchDef[] };
export type EnginePanelDef = { rows: SysRowDef[]; trays?: EngTrayDef[] };

/** Interactive hardware control shown in the engine display ECAM panel */
export type EngControlKind = "thr_lever" | "mode_sel" | "master" | "fire_pb" | "agent" | "monitor"
  | "o2_mask" | "toggle_sw" | "emer_pb" | "spd_brk" | "cancel_warn" | "cancel_caut";
export type EngControlDef  = { stepId: string; kind: EngControlKind; label: string; sub?: string };

export type EngineDisplayDef = {
  eng1: EnginePanelDef;
  eng2: EnginePanelDef;
  warningTrigger?: string;
  /** Interactive ECAM procedure controls rendered below engine gauges */
  controlPanel?: EngControlDef[];
};

// ─── Scenario Channels (phase-based cockpit state) ────────────────────────────
// Each ScenarioPhase captures a snapshot of all cockpit channels at a key
// moment in the scenario. Pure data — no engine or UI logic.

/** What the PFD is showing at this phase */
export type PFDSnapshot = {
  /** Indicated airspeed in knots, e.g. 145 */
  speed?: number;
  /** Target speed label shown on speed tape, e.g. "V2+10", "Vapp+5" */
  targetSpeed?: string;
  /** Pressure altitude in feet */
  altitude?: number;
  /** Target altitude set in FCU, in feet */
  targetAltitude?: number;
  /** Vertical speed in ft/min (positive = climb) */
  verticalSpeed?: number;
  /** FMA column 1 — thrust mode, e.g. "MAN TOGA", "A/THR" */
  fmaThrust?: string;
  /** FMA column 2 — pitch mode, e.g. "SRS", "OP CLB", "ALT" */
  fmaPitch?: string;
  /** FMA column 3 — lateral mode, e.g. "NAV", "TRACK", "LOC" */
  fmaLateral?: string;
  /** AP1 engaged */
  ap1?: boolean;
  /** AP2 engaged */
  ap2?: boolean;
  /** A/THR active */
  athr?: boolean;
  /** Any red flags or amber cautions visible on PFD face */
  flags?: string[];
  /** Free-text notes for instructor / debrief context */
  notes?: string[];
};

/** What the ND is showing at this phase */
export type NDSnapshot = {
  /** Display mode: ARC (most common in flight), ROSE NAV, PLAN, ILS */
  mode?: "ARC" | "ROSE NAV" | "ROSE ILS" | "PLAN";
  /** Range ring setting in nm */
  range?: number;
  /** Magnetic heading */
  heading?: number;
  /** Active waypoint or destination shown, e.g. "VIDP" */
  activeWpt?: string;
  /** Whether terrain display is on */
  terrain?: boolean;
  /** Whether weather radar is on */
  wxr?: boolean;
  /** Free-text notes, e.g. "Radar return 20 nm ahead" */
  notes?: string[];
};

/** A single spoken line by PF, PM, or ATC */
export type CockpitLine = {
  /** Who is speaking */
  role: "PF" | "PM" | "ATC" | "PURSER" | "OPS";
  /** Callsign or station label shown before the speech, e.g. "DELHI DEP" */
  station?: string;
  /** The spoken words exactly as they should be said */
  speech: string;
};

/** What the Pilot Flying is doing and saying at this phase */
export type PFState = {
  /** Primary task description, e.g. "Maintain V2+10, monitor SRS guidance" */
  task: string;
  /** Spoken callouts in order */
  callouts?: CockpitLine[];
};

/** What the Pilot Monitoring is doing and saying at this phase */
export type PMState = {
  /** Primary task description, e.g. "Work through ECAM procedure" */
  task: string;
  /** Spoken callouts in order */
  callouts?: CockpitLine[];
};

/** ATC exchange at this phase — one or more transmissions in sequence */
export type ATCChannel = {
  /** All transmissions in this exchange, in chronological order */
  transmissions: CockpitLine[];
  /** Whether this is pilot-initiated or ATC-initiated */
  initiatedBy: "PF" | "PM" | "ATC";
};

/** Which overhead panel items are active / being actioned at this phase */
export type OverheadSnapshot = {
  /** Panel items being touched or monitored, e.g. "APU MASTER — ON", "ENG 1 MASTER — OFF" */
  items: string[];
  /** Free-text notes */
  notes?: string[];
};

/**
 * A named phase in the scenario timeline.
 * Each phase begins at `atMs` and runs until the next phase starts.
 * All channel fields are optional — only populate what changes at this phase.
 */
export type ScenarioPhase = {
  /** Unique id, e.g. "fire_detected", "ecam_actions", "agent_discharged" */
  id: string;
  /** Human-readable label shown in debrief timeline, e.g. "ENG 1 FIRE DETECTED" */
  label: string;
  /** Wall-clock ms from session start when this phase begins */
  atMs: number;
  /** PFD state at the start of this phase */
  pfd?: PFDSnapshot;
  /** ND state at the start of this phase */
  nd?: NDSnapshot;
  /** Pilot Flying state */
  pf?: PFState;
  /** Pilot Monitoring state */
  pm?: PMState;
  /** ATC exchange occurring in this phase */
  atc?: ATCChannel;
  /** Overhead panel state */
  overhead?: OverheadSnapshot;
};
