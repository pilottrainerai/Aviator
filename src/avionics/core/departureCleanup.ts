// A320 departure — "ACCELERATION & CLEANUP" phase governor.
//
// The climb counterpart to the §5c descent governor. From V2 to the clean climb the aircraft
// retracts flaps/slats ON A SPEED SCHEDULE (FCOM DSC-22-10-50-20 characteristic speeds; FCTM
// "Standard Departure"): the PFD characteristic-speed marker follows the flap LEVER the pilot
// selects at each speed, and once clean the aircraft accelerates to the climb speed.
//
// Call departureCleanup() for ANY departure PFD instead of hand-coding the S / F / green-dot
// markers per scenario — pass the scenario's speeds once and the markers become automatic and
// speed-driven. This is the single source of truth for the takeoff→climb cleanup.
//
// Speed schedule (the config falls through 2 → 1 → 0 as each char speed is reached):
//   CONF 2/3 takeoff (lever 2/3) → green "F"  until speed ≥ F  → retract to CONF 1
//   CONF 1 / 1+F     (lever 1)   → green "S"  until speed ≥ S  → retract to CONF 0 (clean)
//   clean (lever 0)              → green dot ; accelerate to the climb speed (≥ 230, default 250)
// On the takeoff roll (airborne = false) the takeoff speeds V1 / VR show (V2 is the SRS magenta
// bug, handled by the caller); all of them clear at liftoff.

export interface DepartureConfig {
  /** takeoff flap setting: 1 = CONF 1+F, 2 = CONF 2, 3 = CONF 3 */
  takeoffConf: 1 | 2 | 3;
  v1: number;
  vr: number;
  v2: number;
  /** min slat retract speed (CONF 1 → clean) — green "S" */
  sSpeed: number;
  /** min flap retract speed (CONF 2/3 → 1) — green "F"; unused for a CONF 1+F takeoff */
  fSpeed: number;
  /** clean best-L/D — green dot */
  greenDot: number;
  /** managed target once clean — FCTM: accelerate to at least 230; default 250 (below FL100) */
  climbSpeed?: number;
}

export interface CleanupMarkers {
  v1?: number;
  vr?: number;
  sSpeed?: number;
  fSpeed?: number;
  greenDot?: number;
  /** inferred current config (0 = clean) — for callers that gate other logic on the config */
  conf: 0 | 1 | 2 | 3;
  /** managed climb-speed target once clean (undefined until clean) */
  climbSpeed?: number;
}

/**
 * Resolve the characteristic-speed markers for the departure acceleration & cleanup phase.
 *
 * @param cfg      the scenario's takeoff config + characteristic speeds
 * @param speed    the speed to schedule against — pass the LIVE (animated) CAS for a continuous
 *                 retraction that flips S→green dot exactly as the aircraft crosses each speed,
 *                 or a phase-target speed for step-gated behaviour.
 * @param airborne false on the takeoff roll (show V1/VR), true after liftoff.
 */
export function departureCleanup(cfg: DepartureConfig, speed: number, airborne: boolean): CleanupMarkers {
  // Takeoff roll — takeoff speeds only (V2 = the SRS managed bug, set by the caller).
  if (!airborne) return { v1: cfg.v1, vr: cfg.vr, conf: cfg.takeoffConf };
  // CONF 2/3 (lever 2/3) → F, until the flaps come up at F speed:
  if (cfg.takeoffConf >= 2 && speed < cfg.fSpeed) return { fSpeed: cfg.fSpeed, conf: cfg.takeoffConf };
  // CONF 1 / 1+F (lever 1, including retracted-from-2/3) → S, until the slats come up at S speed:
  if (speed < cfg.sSpeed) return { sSpeed: cfg.sSpeed, conf: 1 };
  // Clean (lever 0) → green dot; accelerate to the climb speed.
  return { greenDot: cfg.greenDot, conf: 0, climbSpeed: cfg.climbSpeed ?? 250 };
}
