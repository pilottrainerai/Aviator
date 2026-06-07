/**
 * Scenario library metadata. Drives /scenarios and the run-route lookup.
 * Full scenario data (steps/triggers/decisions) lives under ./data/ and is
 * pulled together via ./index.ts to avoid circular imports.
 */

export type ScenarioSystem =
  | "engines"
  | "fire"
  | "hydraulics"
  | "electrical"
  | "pressurization"
  | "flight-controls"
  | "smoke-fumes"
  | "other";

export type ScenarioPhase = "takeoff" | "cruise" | "approach" | "any";

export type ScenarioDifficulty = "easy" | "moderate" | "hard";

export type ScenarioStatus = "available" | "coming_soon";

export type ScenarioMeta = {
  slug: string;
  title: string;
  system: ScenarioSystem;
  phase: ScenarioPhase;
  status: ScenarioStatus;
  difficulty: ScenarioDifficulty;
  estimatedMinutes: number;
  summary: string;
  runHref?: string;
};

export const SYSTEM_LABEL: Record<ScenarioSystem, string> = {
  engines: "Engines",
  fire: "Fire / Smoke",
  hydraulics: "Hydraulics",
  electrical: "Electrical",
  pressurization: "Pressurization",
  "flight-controls": "Flight Controls",
  "smoke-fumes": "Smoke / Fumes",
  other: "Other",
};

export const PHASE_LABEL: Record<ScenarioPhase, string> = {
  takeoff: "TAKEOFF",
  cruise: "CRUISE",
  approach: "APPROACH",
  any: "ANY PHASE",
};

export const DIFFICULTY_LABEL: Record<ScenarioDifficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

const runHref = (slug: string) => `/train/${slug}`;

export const ENG1_FIRE_AFTER_V1_META: ScenarioMeta = {
  slug: "eng1-fire-after-v1",
  title: "ENG 1 FIRE after V1",
  system: "fire",
  phase: "takeoff",
  status: "available",
  difficulty: "hard",
  estimatedMinutes: 5,
  summary:
    "Engine 1 fire warning illuminates two seconds after passing V1 on takeoff roll. Run the abnormal procedure, contain the fire, and make the right landing call.",
  runHref: runHref("eng1-fire-after-v1"),
};

export const ENG1_FIRE_AFTER_V1_PERSISTENT_FIRE_META: ScenarioMeta = {
  slug: "eng1-fire-after-v1-persistent-fire",
  title: "ENG 1 FIRE after V1 — Persistent Fire",
  system: "fire",
  phase: "takeoff",
  status: "available",
  difficulty: "hard",
  estimatedMinutes: 6,
  summary:
    "A training variant where AGENT 1 does not extinguish the warning. Recognize the 30-second monitoring gate, discharge AGENT 2, and continue the return with the engine secured.",
  runHref: runHref("eng1-fire-after-v1-persistent-fire"),
};

export const ENG_FAILURE_AFTER_V1_META: ScenarioMeta = {
  slug: "eng-failure-after-v1",
  title: "ENG FAILURE after V1",
  system: "engines",
  phase: "takeoff",
  status: "available",
  difficulty: "moderate",
  estimatedMinutes: 5,
  summary:
    "Asymmetric thrust at the worst possible moment. Maintain centerline, climb out, secure the failed engine, and decide.",
  runHref: runHref("eng-failure-after-v1"),
};

export const RTO_LOW_SPEED_META: ScenarioMeta = {
  slug: "rto-low-speed",
  title: "Rejected Takeoff",
  system: "engines",
  phase: "takeoff",
  status: "available",
  difficulty: "easy",
  estimatedMinutes: 3,
  summary:
    "Below V1, an abnormal triggers. The decision is binary: reject or commit. Discriminate signal from noise under time pressure.",
  runHref: runHref("rto-low-speed"),
};

export const DUAL_HYD_G_Y_META: ScenarioMeta = {
  slug: "dual-hyd-g-y",
  title: "DUAL HYD G+Y LO PR",
  system: "hydraulics",
  phase: "cruise",
  status: "available",
  difficulty: "hard",
  estimatedMinutes: 12,
  summary:
    "Loss of green and yellow hydraulic systems. Manage degraded flight controls, plan a flapless approach, and brief the configuration.",
  runHref: runHref("dual-hyd-g-y"),
};

export const ELEC_EMER_CONFIG_META: ScenarioMeta = {
  slug: "elec-emer-config",
  title: "ELEC EMER CONFIG",
  system: "electrical",
  phase: "cruise",
  status: "available",
  difficulty: "hard",
  estimatedMinutes: 15,
  summary:
    "Battery-only flight after total electrical loss. Run the emergency electrical configuration and plan an immediate landing.",
  runHref: runHref("elec-emer-config"),
};

export const RAPID_DEPRESS_META: ScenarioMeta = {
  slug: "rapid-depress",
  title: "Rapid Depressurization",
  system: "pressurization",
  phase: "cruise",
  status: "available",
  difficulty: "hard",
  estimatedMinutes: 8,
  summary:
    "Cabin altitude rising. Don oxygen, initiate emergency descent, communicate with cabin and ATC, plan a diversion.",
  runHref: runHref("rapid-depress"),
};

export const SMOKE_CABIN_META: ScenarioMeta = {
  slug: "smoke-cabin",
  title: "Smoke / Fumes — Cabin",
  system: "smoke-fumes",
  phase: "cruise",
  status: "available",
  difficulty: "hard",
  estimatedMinutes: 10,
  summary:
    "Smoke source unknown. Apply the smoke procedure, isolate suspected sources, and decide whether to continue or land immediately.",
  runHref: runHref("smoke-cabin"),
};

export const UNRELIABLE_SPEED_META: ScenarioMeta = {
  slug: "unreliable-speed",
  title: "Unreliable Speed",
  system: "flight-controls",
  phase: "any",
  status: "available",
  difficulty: "hard",
  estimatedMinutes: 10,
  summary:
    "Pitot or static system failure. Identify the bad indication, fly pitch + thrust, ignore the noise, configure for landing.",
  runHref: runHref("unreliable-speed"),
};

export const NAV_ADR_1_2_META: ScenarioMeta = {
  slug: "nav-adr-1-2-fault",
  title: "NAV ADR 1+2 FAULT",
  system: "flight-controls",
  phase: "cruise",
  status: "available",
  difficulty: "hard",
  estimatedMinutes: 10,
  summary:
    "Both ADR 1 and ADR 2 fail in the climb. Identify the surviving ADR, switch off the affected units, and fly on STBY ISIS while managing alternate law.",
  runHref: runHref("nav-adr-1-2-fault"),
};

export const SCENARIOS: ScenarioMeta[] = [
  ENG1_FIRE_AFTER_V1_META,
  ENG1_FIRE_AFTER_V1_PERSISTENT_FIRE_META,
  ENG_FAILURE_AFTER_V1_META,
  RTO_LOW_SPEED_META,
  DUAL_HYD_G_Y_META,
  ELEC_EMER_CONFIG_META,
  RAPID_DEPRESS_META,
  SMOKE_CABIN_META,
  UNRELIABLE_SPEED_META,
  NAV_ADR_1_2_META,
];

export function getScenarioMeta(slug: string): ScenarioMeta | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}
