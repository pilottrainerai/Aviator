// A320 approach — "DECELERATION & CONFIGURATION" phase governor.
//
// The MIRROR of the departure cleanup (departureCleanup.ts): on the approach the aircraft
// DECELERATES and EXTENDS flaps, and the PFD characteristic-speed marker + the MAGENTA managed
// target follow the flap lever DOWN through the configs (FCOM DSC-22-10-50-20; FCTM "Deceleration
// & Configuration"). Managed approach speed = VMAN of the current config.
//
// Config schedule (the flap step is authoritative — the scenario drives it, not the speed):
//   CONF 0 (clean)  → green dot ; managed = green dot
//   CONF 1 (lever 1)→ green "S" ; managed = S
//   CONF 2 (lever 2)→ green "F" ; managed = F
//   CONF 3 (lever 3)→ green "F" ; managed = F
//   CONF FULL       → (no char marker) ; managed = VAPP
// Magenta managed bug steps DOWN green dot → S → F → F → VAPP; green marker green dot → S → F → F →
// (none). F is shown in BOTH CONF 2 and 3 (FCOM) — correct, not a stuck marker. VLS / α-Prot / α-Max
// DROP with each config so the amber/red band moves as the flaps extend.

export interface ApproachConfigData {
  greenDot: number; // CONF 0 maneuvering (clean best-L/D)
  sSpeed: number;   // CONF 1 maneuvering (min slat)
  fSpeed: number;   // CONF 2/3 maneuvering (min flap)
  vApp: number;     // CONF FULL managed target (VREF + additive)
  /** lowest-selectable-speed per config — decreases as flaps extend (FCOM DSC-22-10-50-20) */
  vls: { clean: number; conf1: number; conf2: number; conf3: number; full: number };
}

export type ApproachConf = 0 | 1 | 2 | 3 | 4; // 4 = FULL

export interface ApproachMarkers {
  conf: ApproachConf;
  greenDot?: number;
  sSpeed?: number;
  fSpeed?: number;
  /** magenta managed-speed bug = VMAN of the current config */
  managedTarget: number;
  vls: number;
  alphaProt: number;
  alphaMax: number;
  /** VFE NEXT — amber "=" showing the VFE of the NEXT (more extended) flap config, so the crew knows
   *  when they can select it. Standard A320 flap-limit speeds. undefined at FULL (no next). [user 2026-07-14] */
  vfeNext?: number;
}

// α-Prot / α-Max are aerodynamic (AoA) offsets below VLS — fixed spacing on the tape.
const band = (vls: number) => ({ vls, alphaProt: vls - 8, alphaMax: vls - 16 });
// VFE of the NEXT flap config (standard A320): clean→CONF1 230, 1→CONF2 200, 2→CONF3 185, 3→FULL 177.
const VFE_NEXT: Record<ApproachConf, number | undefined> = { 0: 230, 1: 200, 2: 185, 3: 177, 4: undefined };

/**
 * Resolve the approach characteristic-speed marker, managed target and low-speed band for a config.
 * @param conf the CURRENT flap configuration (0=clean … 4=FULL), taken from the scenario's flap steps.
 */
export function approachMarkers(cfg: ApproachConfigData, conf: ApproachConf): ApproachMarkers {
  switch (conf) {
    case 0:  return { conf, greenDot: cfg.greenDot, managedTarget: cfg.greenDot, vfeNext: VFE_NEXT[0], ...band(cfg.vls.clean) };
    case 1:  return { conf, sSpeed: cfg.sSpeed,     managedTarget: cfg.sSpeed,   vfeNext: VFE_NEXT[1], ...band(cfg.vls.conf1) };
    case 2:  return { conf, fSpeed: cfg.fSpeed,     managedTarget: cfg.fSpeed,   vfeNext: VFE_NEXT[2], ...band(cfg.vls.conf2) };
    case 3:  return { conf, fSpeed: cfg.fSpeed,     managedTarget: cfg.fSpeed,   vfeNext: VFE_NEXT[3], ...band(cfg.vls.conf3) };
    default: return { conf: 4,                      managedTarget: cfg.vApp,     vfeNext: VFE_NEXT[4], ...band(cfg.vls.full) }; // FULL
  }
}
