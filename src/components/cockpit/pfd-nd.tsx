"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { Scenario, ScenarioPhase } from "@/scenarios/types";
import { defaultAircraftState, type AircraftState } from "@/avionics/core/aircraftState";

function lerp(a: number, b: number, alpha: number): number {
  const v = a + (b - a) * alpha;
  return Math.abs(b - v) < 0.5 ? b : v;   // snap when close enough
}

// ENG 1 FIRE after V1 — scenario-phase flight model
// Each completed step advances the aircraft to a physically accurate snapshot.
// Values match FCTM OP-020 technique and FCOM SRS/CLB performance data for VIDP ISA.
export function getActiveScenarioPhase(scenario?: Scenario, elapsedMs?: number): ScenarioPhase | null {
  if (!scenario?.phases?.length || elapsedMs == null) return null;

  let active: ScenarioPhase | null = null;
  for (const phase of scenario.phases) {
    if (phase.atMs <= elapsedMs) active = phase;
    else break;
  }

  return active;
}

function buildAircraftStateFromPhase(phase: ScenarioPhase, s?: ScenarioState): AircraftState {
  const pfd = phase.pfd;
  const nd = phase.nd;
  const speed = pfd?.speed ?? defaultAircraftState.speed;
  const altitude = pfd?.altitude ?? defaultAircraftState.altitude;
  const heading = nd?.heading ?? defaultAircraftState.heading;
  const targetSpeedNumeric = pfd?.targetSpeed && /^\d+$/.test(pfd.targetSpeed)
    ? Number(pfd.targetSpeed)
    : null;

  return {
    ...defaultAircraftState,
    speed,
    altitude,
    heading,
    pitch: defaultAircraftState.pitch,
    bank: defaultAircraftState.bank,
    vs: pfd?.verticalSpeed ?? defaultAircraftState.vs,
    selectedSpeed: targetSpeedNumeric ?? speed,
    selectedAlt: pfd?.targetAltitude ?? defaultAircraftState.selectedAlt,
    selectedHdg: heading,
    apEngaged: !!(pfd?.ap1 || pfd?.ap2),
    athrActive: pfd?.athr === true,
    athrArmed:  pfd?.athr === false,
    thrMode: pfd?.fmaThrust ?? defaultAircraftState.thrMode,
    thrCue: pfd?.fmaThrCue,
    vertMode: pfd?.fmaPitch ?? defaultAircraftState.vertMode,
    latMode: pfd?.fmaLateral ?? defaultAircraftState.latMode,
    masterWarn: !!s?.masterWarnActive || !!pfd?.flags?.some((flag) => /master warn/i.test(flag)),
    masterCaut: !!s?.masterCautActive || !!pfd?.flags?.some((flag) => /master caut/i.test(flag)),
    eng1Failed: defaultAircraftState.eng1Failed,
    eng2Failed: defaultAircraftState.eng2Failed,
    gs: Math.max(speed - 2, 0),
    tas: speed + 2,
    windDir: defaultAircraftState.windDir,
    windSpd: defaultAircraftState.windSpd,
    track: heading,
  };
}

// Step-driven ring lookup — ring appears when prereqStep is done and stepId is not yet done.
// Replaces the timing-based getActiveScenarioPhase for PF action overlays.
export function getActivePfActionPhase(scenario?: Scenario, state?: ScenarioState): ScenarioPhase | null {
  if (!scenario?.phases) return null;
  for (let i = scenario.phases.length - 1; i >= 0; i--) {
    const phase = scenario.phases[i];
    if (!phase.pfAction) continue;
    const { stepId, prereqStep } = phase.pfAction;
    if (stepId && state?.completedSteps?.[stepId]) continue;
    if (prereqStep && !state?.completedSteps?.[prereqStep]) continue;
    return phase;
  }
  return null;
}

export function buildAircraftState(s?: ScenarioState, scenario?: Scenario, elapsedMs?: number, liveAlt?: number, liveSpd?: number): AircraftState {
  void elapsedMs; // PFD is step-driven only — no timing jumps

  const step  = (id: string) => !!(s?.completedSteps?.[id]);
  const fired = (id: string) => !!(s?.triggersFired?.[id]);

  // ── DUAL HYD G+Y SYS LO PR — cruise hydraulic failure FMA model ───────────
  // Cruise FL350 → ALTERNATE LAW + AP lost at failure → hand-flown ILS → DIRECT
  // LAW at gear-down. FMA boxes per the DUAL HYD G+Y Workbook V3 control-law
  // timeline (user-authorised spec). A/THR remains active throughout (FD avail,
  // AP 1+2 INOP). Step-gated like the FIRE model; FIRE logic below is untouched.
  if (scenario?.meta?.slug === "dual-hyd-g-y") {
    const failed          = fired("structural_fail");
    const startDescent    = step("start_descent");          // DESCENT card → descending to FL200 @ 3000 fpm
    const cleared10000    = step("cleared_10000");          // ATC "descend 10000" ack (passing FL220) → continue to 10 000
    const descend3700     = step("descend_3700");           // [P31] approach cleared → OP DES to 3 700, level off
    const onIls           = step("configure_for_approach"); // configure FLAP 3 at 5 000 → ALT level, LOC captured
    const gsIntercept     = step("gs_intercept");           // glideslope captured → G/S · LOC, descending
    const gearDown        = step("lgr_gravity");            // L/G gravity extended → DIRECT LAW, ~3 000, landing CL
    const landingFinal    = step("landing_cl_hyd");         // short final on the ILS (G/S · LOC, VAPP), descending to the flare
    // TOUCHDOWN → ROLLOUT → full stop: driven by the PHYSICAL touchdown only. The moment the runner marks
    // `touched_down` (tape reaches the runway) the FD ILS modes DROP and the speed decelerates to ZERO over
    // the rollout. NOT keyed to `request_taxi_to_stand` — that comms card must FOLLOW the full stop (it is
    // gated on the `full_stop` gate), never drive it (that let a prematurely-available taxi card collapse
    // the PFD to 0 kt while still airborne). [user 2026-07-04]
    const stopped         = step("touched_down");
    const holdCleared     = step("hold_cleared");           // ATC hold clearance (atc_hold_clr) → descend 10 000 → 7 000 hold
    const atHold7000      = step("at_hold_7000");           // LEVEL at 7 000 (hold/vectors) → speed reduced to 210 kt
    // [Trainer ALT logic #1] ECAM action panel still popped (pump actions in progress) →
    // HOLD the initial cleared altitude FL200; only continue down toward 10 000 once the
    // panel retracts (all pumps done).
    // FCOM HYD G+Y SYS LO PR = PTU OFF → AFFECTED PUMPS OFF (GRN ENG 1, YEL ENG 2). YELLOW ELEC
    // PUMP ON is FCOM-conditional (only if Y lost by ENG 2 PUMP LO PR) → NOT this leak scenario, and
    // it was removed from the steps. The gate must NOT require it (a phantom step = panel never
    // retracts = FL200 never releases). [user 2026-07-05, FCOM L104945]
    const ecamPanelActive = !!(step("ecam_actions") &&
      !(step("ptu_off") && step("grn_eng1_pump_off") && step("yel_eng2_pump_off")));

    // CAS / TAS chosen so the PFD Mach readout (computed from TAS) is realistic:
    // FL350 ≈ M.78, descending values fall off naturally. speed stays well clear
    // of the VLS amber strip (SPD_VLS 147) — no red/amber on the tape at cruise.
    let thrMode = "MACH", vertMode = "ALT CRZ", latMode = "NAV";
    let apOn = true;
    // vmax = VMO/MMO red barber pole. At cruise it must sit ABOVE the cruise
    // speed (not on it) — the default 220 is a takeoff value and would falsely
    // paint the 265-kt cruise as overspeed.
    let speed = 265, altitude = 35_000, vs = 0, pitch = 2, tas = 450, vmax = 330; // FL350 cruise ≈ M.78
    let law: AircraftState['law'] = 'NORMAL';  // F/CTL law — drives amber-X / MAN PITCH TRIM on PFD
    let selAlt: number | undefined;            // FCU selected altitude (the bug); defaults to current alt
    let altArmed = false;                      // ALT armed in the FMA (descending toward the selected alt)
    let vls: number | undefined;               // VLS amber strip (set low on the FLAP-3 approach so the decelerating speed isn't falsely amber) [user 2026-07-01]
    // ILS deviation (dots) — intercepting the RWY 27 approach: GS fly-up (below the glidepath,
    // DME-scaled 2→1→0) + LOC deflected LEFT (intercepting from the right), both → 0 at capture
    // (gs_intercept). [user 2026-07-04]
    let gsDev = 0, locDev = 0;
    // approach-intercept progress from the LIVE tape (7 000 → 5 000 platform): 1 far, 0 at platform
    const apI = liveAlt != null ? Math.max(0, Math.min(1, (liveAlt - 5_000) / 2_000)) : 1;

    if (stopped) {
      // FULL STOP on RWY 27, Mumbai (VABB, ~39 ft) — HAND-FLOWN, so after touchdown the FD ILS modes
      // drop and A/THR is disconnected: the FMA vert/lat/thrust columns are BLANK (NO autoland ROLL OUT
      // / RWY — those are managed modes that never engage on a manual landing). DIRECT LAW. [user 2026-07-01]
      thrMode = ""; vertMode = ""; latMode = ""; apOn = false;
      // selAlt stays the MISSED-APPROACH altitude (7 000) the pilot set on the FCU — NOT field
      // elevation. The FCU target doesn't change on landing/rollout. [user 2026-07-04]
      speed = 0; altitude = 39; vs = 0; pitch = 0; tas = 0; vmax = 230; law = 'DIRECT'; selAlt = 7_000;
    } else if (landingFinal) {
      // SHORT FINAL — HAND-FLOWN (AP INOP): the FD stays on the ILS, so the FMA is SPEED · G/S · LOC,
      // still descending the 3° slope. Speed HELD at VAPP = VREF + 25 (~160 kt) until the flare — not
      // bled to VREF here. NO FLARE / ROLL OUT (AUTOLAND managed modes, FCOM LIM-AFS-20). [user 2026-07-01]
      thrMode = "SPEED"; vertMode = "G/S"; latMode = "LOC"; apOn = false;
      speed = 160; altitude = 39; vs = -730; pitch = 1; tas = 163; vmax = 230; law = 'DIRECT'; selAlt = 7_000; vls = 132;
    } else if (gsIntercept) {
      // [P31] LAST mode change — Glideslope + localizer CAPTURED (AFTER the gravity gear) →
      // G/S · LOC, descending the 3° slope from 5 000. ROD is GEOMETRY: GS(~158) × 5.3 ≈ 840 fpm.
      // [user 2026-06-30] Once established on GS *and* LOC → set the MISSED-APPROACH altitude
      // on the FCU = 7 000 (selAlt). Not set before capture.
      thrMode = "SPEED"; vertMode = "G/S"; latMode = "LOC"; apOn = false;
      speed = 160; altitude = 3_000; vs = -840; pitch = 1; tas = 165; vmax = 230; law = 'DIRECT'; selAlt = 7_000; vls = 132;
    } else if (gearDown) {
      // [P31] Gravity gear DOWN — BEFORE the GS/LOC capture. LEVEL at 5 000 in ALT, VS 0, on a
      // HEADING; DIRECT LAW (FCOM: at L/G DN → USE MAN PITCH TRIM). [user 2026-07-05: platform 5 000]
      thrMode = "SPEED"; vertMode = "ALT"; latMode = "HDG"; apOn = false;
      speed = 165; altitude = 5_000; vs = 0; pitch = 1; tas = 170; vmax = 230; law = 'DIRECT'; vls = 135;
      locDev = -0.3;   // still intercepting the localizer (nearly aligned); GS from geometry below
    } else if (onIls) {
      // [P35] CONFIGURE — FLAP 3, decelerate to VAPP. LEVEL at 5 000 in ALT, VS 0, maintaining
      // a HEADING (localizer not yet captured). Hand-flown, ALTERNATE LAW. [user 2026-07-05]
      thrMode = "SPEED"; vertMode = "ALT"; latMode = "HDG"; apOn = false;
      // Same target/capture as descend3700 (selAlt 5 000 + altArmed) so the governor
      // output is IDENTICAL across the descend → configure handoff — no VS blip
      // even though the level gate opens at 5 100 (still capturing). Governor ramps
      // this to 0 at 5 000 and HOLDS 0 while level. [user 2026-07-05]
      // [user 2026-07-05] By CONFIGURE the flaps are already selected and the aircraft is at VAPP
      // (VREF+25 ≈ 165) — NOT 180. Holding VAPP here removes the re-accel that made the gear card
      // read ~185; the speed stays at VAPP through configure → gear → G/S.
      speed = 165; altitude = 5_000; vs = -1_000; pitch = 1; tas = 168; vmax = 230; law = 'ALTN'; vls = 140; selAlt = 5_000; altArmed = true;
      locDev = -0.6;   // configuring, LOC not yet captured; GS from geometry below
    } else if (descend3700) {
      // [P33] Cleared "descend 5 000 + approach" at 7 000 → V/S mode on a HEADING: V/S −1000 (idle)
      // so the surplus drag DECELERATES 250 → green dot (213) across the 30→22 NM / 7 000→5 000 leg;
      // LEVEL OFF at 5 000 @ green dot @ ~22 NM — ~2.5 dots below the G/S, giving ~6.4 NM of margin
      // to slow through the config before capture. [user 2026-07-06: more reaction margin]
      thrMode = "SPEED"; vertMode = "V/S"; latMode = "HDG"; apOn = false;
      speed = 213; altitude = 5_000; vs = -1000; pitch = -2; tas = 234; vmax = 250; law = 'ALTN'; selAlt = 5_000; altArmed = true;
      locDev = -0.6 - 0.4 * apI;   // LOC deflected left, easing toward centre; GS from geometry below
    } else if (atHold7000) {
      // Level at 7 000 (hold / long vectors), speed → 210 kt. The gate fires at 7 600 (unlocks the
      // approach CL early), so this step CONTINUES the capture to 7 000 (selAlt 7 000 + altArmed +
      // descending vs) — the governor ramps VS→0 AT 7 000 and holds. NOT a hard vs=0 (that stopped
      // the descent at ~7 600 and crept down = "levels off at 7 200"). G2 seamless handoff. [user 2026-07-04]
      // vertMode is the DESCENDING mode (OP DES) — the gate fires at 7 600 so the aircraft is still
      // descending when this phase is entered. The latch drives OP DES → ALT* → ALT via altitude
      // proximity. Was "ALT": with altArmed also true that showed ALT green + ALT armed-blue AT ONCE
      // while still descending (double ALT). [user 2026-07-06]
      thrMode = "SPEED"; vertMode = "OP DES"; latMode = "NAV"; apOn = false;   // NAV until vectors for approach [user 2026-07-05]
      // [user 2026-07-06] Hold 7 000 at 250 kt (was 210) — the decel to green dot happens on the
      // 7 000→5 000 V/S leg, not before, so the aircraft arrives 5 000 @ green dot.
      speed = 250; altitude = 7_000; vs = -1_500; pitch = 1; tas = 275; vmax = 320; law = 'ALTN'; selAlt = 7_000; altArmed = true;
    } else if (holdCleared) {
      // ATC cleared the hold/vectors at 7 000 → descend 10 000 → 7 000. BELOW 10 000 the speed is
      // 250 kt (250 speed limit) and the rate is ~1 500 fpm; then LEVEL at 7 000 (→ `atHold7000`, 210 kt).
      // Driven by ALTITUDE CAPTURE (altArmed → OP DES → ALT* → ALT). altitude is the TARGET (7 000). [user 2026-07-01]
      thrMode = "SPEED"; vertMode = "OP DES"; latMode = "NAV"; apOn = false;
      speed = 250; altitude = 7_000; vs = -1_500; pitch = -2; tas = 270; vmax = 320; law = 'ALTN'; selAlt = 7_000; altArmed = true;
    } else if (cleared10000 && !ecamPanelActive) {
      // Passing FL220 ATC cleared continued descent to 10 000 ft → once the ECAM panel
      // has retracted (pumps done) the aircraft continues down (FCU selected alt = 10 000).
      // FMA OPEN DES · NAV, ALTERNATE LAW. ALT armed (blue) → ALT* → ALT capture at 10 000
      // per FCOM DSC-22-30-100 (every level-off). While the panel is popped it holds FL200.
      thrMode = "SPEED"; vertMode = "OP DES"; latMode = "NAV"; apOn = false;
      speed = 290; altitude = 10_000; vs = -3_000; pitch = -3; tas = 320; vmax = 330; law = 'ALTN'; selAlt = 10_000; altArmed = true;
    } else if (startDescent) {
      // DESCENT card (after MAYDAY) → descending to FL200 @ 3000 fpm on the 2 NM right
      // offset; holds FL200 through ECAM / STATUS / planning. FMA: A/THR SPEED · OP DES · HDG.
      // ALT armed (blue) → ALT* → ALT capture at FL200 per FCOM (every level-off).
      thrMode = "SPEED"; vertMode = "OP DES"; latMode = "NAV"; apOn = false;   // NAV from top of descent, not vectored yet [user 2026-07-05]
      speed = 290; altitude = 20_000; vs = -3_000; pitch = -3; tas = 360; vmax = 330; law = 'ALTN'; selAlt = 20_000; altArmed = true;
    } else if (failed) {
      // Just after failure (CANCEL → AVIATE → NAVIGATE) — level FL350, ALTERNATE LAW.
      // SAME FMA as cruise except AP 1+2 dropped out: MACH · ALT CRZ · NAV, no AP.
      thrMode = "MACH"; vertMode = "ALT CRZ"; latMode = "NAV"; apOn = false;
      speed = 265; altitude = 35_000; vs = 0; pitch = 2; tas = 450; vmax = 330; law = 'ALTN';
    }
    // else: cruise before the failure — MACH / ALT CRZ / NAV, AP1 + A/THR (NORMAL LAW)
    if (vertMode === "OP DES") thrMode = "THR IDLE";   // FCOM: OP DES engages THR IDLE, not SPEED [user 2026-07-05]

    // ── Altitude-driven descent governor (SHARED — EVERY level-off uses this) ─
    // (a) SPEED/VS SCHEDULE across the 10 000 changeover: hold 290 kt / −3000 fpm
    //     ABOVE 10 000, decelerate to 250 kt / −1500 fpm across 9 000–11 000 (the
    //     250-kt limit). (b) REAL LEVEL-OFF: as the LIVE altitude captures the
    //     selected altitude, ramp VS → 0 (ALT* → ALT) so the aircraft GENUINELY
    //     levels — VS truly holds 0 while level and ramps 0 → schedule again on the
    //     NEXT descent (no snap; before this the step pinned vs=−3000 through the
    //     hold and the re-descent revealed it in one frame). ONE governor drives
    //     FL200 / 10 000 / 7 000 / 5 000 identically, so no segment can behave
    //     differently. Altitude motion tracks this VS in the PFD loop. [user 2026-07-04]
    if (liveAlt != null && vs < 0) {
      const a = liveAlt;
      // Band applies ONLY to the HIGH descent (targets AT/above 10 000: FL200, 10 000).
      // The 10 000→7 000 / 7 000→5 000 legs must NOT re-enter it (that forced −2250 at
      // 10 000 leaving the level = the "jump"); they use their own gentle step VS +
      // the capture ramp below. [user 2026-07-04]
      // Decel to 250 kt COMPLETES by 10 000 (the 250-below-10 000 limit) — window
      // 10 000–11 500, so the aircraft is at 250 as it passes the limit, with VS
      // −3000→−1500 easing across the SAME window (speed+VS coordinated). [user 2026-07-04]
      if (a > 8_000 && selAlt != null && selAlt >= 10_000) {
        if (a > 11_500)      { speed = 290; vs = -3000; }
        else if (a < 10_000) { speed = 250; vs = -1500; }
        else { const f = (a - 10_000) / 1_500; speed = 250 + f * 40; vs = -1500 - f * 1500; }
      }
      if (altArmed && selAlt != null) {
        const toGo = a - selAlt;                       // ft still to lose to the target
        const cz = Math.max(200, Math.abs(vs) / 6);    // ALT* capture zone (FCOM level-off)
        if (toGo <= cz) vs = Math.round(vs * Math.max(0, toGo / cz));  // → genuine 0 at level
      }
    }

    // [user 2026-07-05] FLAP-lever deceleration during the config cards at 5 000 (QRH SPD SEL =
    // VFE NEXT − 5): as each FLAP is taken BOTH the actual speed AND the SPD SEL bug (cyan) step
    // down, so the marker rises into view and the selected speed tracks the configuration — it is
    // no longer stuck at 210. Applies only in the descend-3700 (level-5 000) window; only lowers.
    let selSpd: number | undefined;   // SPD SEL bug (cyan) — dialed to VFE-next−5 while configuring
    if (descend3700 && !onIls) {
      if      (step("flap_3")) { speed = Math.min(speed, 165); selSpd = 165; }   // → VAPP (VREF + 25)
      else if (step("flap_2")) { speed = Math.min(speed, 180); selSpd = 180; }   // VFE NEXT CONF 3 − 5
      else if (step("flap_1")) { speed = Math.min(speed, 195); selSpd = 195; }   // VFE NEXT CONF 2 − 5
    }

    // G6 (§5c): the selected/target speed is NEVER commanded below the amber VLS band.
    // A speed reduction is floored at VLS — never select into the amber. [user 2026-07-04]
    if (vls != null) speed = Math.max(speed, vls);

    // ── DME to RWY 27 threshold + GLIDESLOPE deviation — option (a) profile [user 2026-07-06] ──
    //   Descent (≥ 5 000): 7 000 = 30 NM, 5 000 = 20 NM (idle 10 000→7 000, V/S 7 000→5 000).
    //   LEVEL at 5 000: the aircraft closes range while altitude holds — DME creeps 20 → 15.60 tied
    //     to the CONFIG (flap) progression (clean 20 · F1 ~18.5 · F2 ~17 · F3/config 15.60), so the
    //     3° GS descends onto the aircraft AS it configures (diamond ~1.9 dots-up → captured).
    //   Below 5 000 (on the GS): true 3° geometry to the threshold (15.60 NM @ 5 000).
    // GS altitude = 39 + DME·318; deviation (dots) = (GSalt−alt)/(DME·37 ft/dot), fly-up only.
    // Computed HERE (needs the flap steps) and passed to svg-pfd `drawILS` so readout + diamond agree.
    let dme = 100;
    if (liveAlt != null) {
      const a = liveAlt;
      if (a >= 5_000) {
        dme = a < 7_000 ? 22 + (a - 5_000) * 0.004          // 22 NM @ 5 000 → 30 NM @ 7 000
                        : 30 + (a - 7_000) * 0.00267;        // 30 NM @ 7 000 → 38 NM @ 10 000
        // LEVEL at 5 000: the DME closes in real range with each action (values = the DME the aircraft
        // is AT when that step is taken) — FLAP 1 ≈ 21 · FLAP 2 ≈ 20 · FLAP 3 ≈ 19 · GEAR ≈ 17 ·
        // G/S captured 15.60. svg-pfd LERPS the DME so it eases between these, never a direct jump.
        // Flaps = the 4.4 NM decel; gear then holds ~1.4 NM before the glide. [user 2026-07-06]
        if (a < 5_150 && step("at_level_3700")) {
          const cfg = (gsIntercept || landingFinal) ? 1                     // on the glide → 15.60
                    : gearDown ? 0.78125                                    // GEAR down → 17 NM
                    : (onIls || step("flap_3")) ? 0.46875                   // FLAP 3 → 19 NM
                    : step("flap_2") ? 0.3125                               // FLAP 2 → 20 NM
                    : step("flap_1") ? 0.156                                // FLAP 1 → 21 NM
                    : 0;                                                     // clean (level-off) → 22 NM
          dme = 22 - cfg * (22 - 15.60);
        }
      } else {
        dme = Math.max(0, (a - 39) / 318);                   // true 3° below 5 000 (15.60 NM @ 5 000)
      }
      const gsAlt = 39 + dme * 318;
      gsDev = Math.max(0, Math.min(2, (gsAlt - a) / Math.max(1, dme * 37)));
    }

    const masterWarn = !!(s?.masterWarnActive && !step("cancel_master_warn"));
    const masterCaut = !!(s?.masterCautActive && !step("cancel_master_caut"));

    // ── Characteristic speeds on the tape (FCOM DSC-31-40 visibility · DSC-22_10-50-20 def).
    // Only ONE green marker shows at a time, chosen by FLAP-LEVER position; VFE NEXT (amber =)
    // sits above it. In G+Y the FLAPS are jammed and the SLATS move slowly on Blue, but the
    // markers follow the LEVER (FCOM: "appears when the flap SELECTOR is in position …").
    //
    // CONFIG PROGRESSION is DETERMINISTIC on the FLAP-SELECTION cards (QRH abnormal-approach
    // technique — SPD SEL = VFE NEXT − 5, step the lever 1 → 2 → 3). The marker follows the
    // LEVER, exactly as the real FMGC does — more accurate than inferring it from decel speed:
    //   clean                                   → green dot · VFE next 230 (CONF 1)
    //   FLAP 1 (flap_1)                          → S 187     · VFE next 200 (CONF 2)
    //   FLAP 2 (flap_2)                          → F 168     · VFE next 185 (CONF 3)
    //   FLAP 3 / configure / gs / gear / final   → F 168     · VFE next 177 (FULL)
    // GW ≈ MLW 64.5 t: GREEN DOT from the QRH table (208 @ ≤FL200, +10 kt/FL100 → ~223 @ FL350);
    // S = 1.23·VS₀ ≈ 187; F = 1.26·VS₁₊F ≈ 168. PURELY ADDITIVE. [user 2026-07-05, QRH + FCOM]
    void liveSpd;
    let greenDot: number | undefined, sSpeed: number | undefined, fSpeed: number | undefined, vfeNext: number | undefined;
    const flap1 = step("flap_1"), flap2 = step("flap_2"), flap3 = step("flap_3");
    if (!stopped) {
      if (flap3 || onIls || gsIntercept || gearDown || landingFinal) { fSpeed = 168; vfeNext = 177; }  // CONF 3 (FLAP 3/landing) → F · next FULL
      else if (flap2)                                                { fSpeed = 168; vfeNext = 185; }  // CONF 2 → F · next CONF 3
      else if (flap1)                                                { sSpeed = 187; vfeNext = 200; }  // CONF 1 → S · next CONF 2
      else {                                                                                            // clean → green dot · next CONF 1
        const alt = liveAlt ?? altitude;
        if (alt < 20_000) { greenDot = Math.round(208 + Math.max(0, (alt / 100 - 200) / 100) * 10); vfeNext = 230; }
      }
    }

    // [user 2026-07-05] BARO minimum (MDA) appears on the PFD once APPROACH PREPARATION is
    // complete (approach_prep_hyd — the card where MDA/DH is set per chart). Hidden before that.
    const showBaroMin = step("approach_prep_hyd");

    return {
      ...defaultAircraftState,
      apEngaged: apOn,
      masterWarn,
      masterCaut,
      eng1Failed: false,
      eng2Failed: false,
      thrMode,
      thrCue: undefined,
      vertMode,
      latMode,
      athrActive: true,
      athrArmed: false,
      srsCyan: false,
      speed,
      altitude,
      vs,
      pitch,
      bank: 0,
      gs: Math.max(speed - 2, 0),
      tas,
      vmax,
      law,
      vls,
      greenDot,
      sSpeed,
      fSpeed,
      vfeNext,
      showBaroMin,
      gsDev,
      locDev,
      dme,
      fieldElev: 39,   // divert destination = Mumbai VABB (~39 ft AMSL) → RA reads 0 only at touchdown [user 2026-07-01]
      selectedSpeed: selSpd ?? speed,   // SPD SEL bug follows VFE-next−5 while configuring [user 2026-07-05]
      selectedAlt: selAlt ?? altitude,
      altArmed,
      selectedHdg: 200,   // heading 200 — scenario MAYDAY call
      heading: 200,
      track: 201,
      windDir: 270,       // wind 270/6 — scenario ATC weather
      windSpd: 6,
    };
  }

  const fireActive  = fired("fire_warn");
  const eng1Failed  = fireActive;
  const gearUp              = step("positive_rate_gear_up");
  const apEngaged           = step("engage_ap_fma");
  const atFourHundredFt     = fired("four_hundred_ft");
  const ecamActionsStarted  = step("four_hundred_ft_cmd");
  const thrIdle             = step("thr_lever_idle");
  const mwCancelled = step("cancel_master_warn");
  const ecamDone    = step("engine_secured") || fired("fire_extinguished");
  // Aircraft reaches minimum acceleration altitude (2300 ft baro / 1500 ft RA at VIDP)
  // after the engine ECAM procedure is complete. This is altitude-driven, not procedure-driven —
  // the ECAM completion is used as the timing proxy for reaching MAA in the step model.
  const atMaa       = ecamDone;
  const levelOff    = step("level_off_maa");
  const accelClean  = step("accel_clean");
  const mctOpClb    = step("mct_open_clb");
  const masterWarn  = !!(s?.masterWarnActive && !mwCancelled);
  const masterCaut  = !!(s?.masterCautActive && !step("cancel_master_caut"));

  // ALT pulled → OP CLB engaged (intermediate: before levers reach MCT)
  const opClbDone = step("pull_alt_op_clb");

  // ── FMA modes per workbook V3 phase table ─────────────────────────────────
  // Col 1 row 1 (engaged): MAN TOGA until levers reach MCT → THR MCT
  const thrMode  = mctOpClb ? 'THR MCT' : 'MAN TOGA';
  // Col 1 row 3 (flashing white cue): LVR MCT flashes after OP CLB is selected (ALT knob pulled),
  // before the live engine lever is moved to MCT.
  const thrCue   = opClbDone && !mctOpClb ? 'LVR MCT' : undefined;
  // Col 2 (vertical): SRS → V/S → OP CLB (OP CLB engages on ALT pull, before MCT set)
  const vertMode = (opClbDone || mctOpClb) ? 'OP CLB' : levelOff ? 'V/S' : 'SRS';
  // A/THR: armed (cyan) from fire warning until MCT engaged, then active (green)
  const athrActive = mctOpClb;
  const athrArmed  = fireActive && !mctOpClb;
  // SRS green (active) once fire warning fires; cyan (armed) before
  const srsCyan    = fireActive ? false : !levelOff && !opClbDone && !mctOpClb;

  // ── Flight values — step-driven, per workbook V3 flight model ─────────────
  let speed, altitude, vs, pitch, bank, gs, tas;

  if (mctOpClb) {
    // THR MCT + OP CLB — climbing away from MAA, single engine
    speed = 220; altitude = 3500; vs = 1400; pitch = 5; bank = 0;
    gs    = 218; tas = 224;
  } else if (opClbDone) {
    // ALT pulled, OP CLB engaged — LVR MCT still flashing, MCT not yet set
    speed = 212; altitude = 2400; vs = 600; pitch = 3; bank = 0;
    gs    = 210; tas = 216;
  } else if (accelClean) {
    // Green dot reached — level at MAA 2300 ft, LVR MCT flashing, accelerating clean
    speed = 210; altitude = 2300; vs = 0; pitch = 0; bank = 0;
    gs    = 208; tas = 214;
  } else if (levelOff) {
    // MAA (2300 ft baro, 1500 ft RA at VIDP) — V/S = 0 selected, holding level
    speed = 185; altitude = 2300; vs = 0; pitch = 0; bank = 0;
    gs    = 183; tas = 189;
  } else if (atMaa) {
    // Minimum acceleration altitude (2300 ft baro, 1500 ft RA at VIDP) — SRS active,
    // V/S push pending. PF ring prompts PUSH V/S ZERO.
    speed = 175; altitude = 2300; vs = 400; pitch = 2; bank = 0;
    gs    = 173; tas = 179;
  } else if (ecamActionsStarted) {
    // ECAM actions running — aircraft climbs continuously toward MAA (2 300 ft / 1 500 ft RA)
    // No freeze here; individual ECAM steps happen during the climb.
    speed = 165; altitude = 2300; vs = 2200; pitch = 9; bank = 0;
    gs    = 163; tas = 169;
  } else if (atFourHundredFt && apEngaged) {
    // 400 ft gate reached — ECAM ACTIONS unlocked, climbing through 400 ft RA / 1177 ft MSL
    speed = 163; altitude = 1177; vs = 2100; pitch = 10; bank = 0;
    gs    = 161; tas = 167;
  } else if (apEngaged || gearUp) {
    // Gear up + positive climb confirmed — at 100 ft RA / 877 ft MSL.
    // AP1 prompt appears here (not at 50 ft). Altitude stays 877 until 400 ft trigger.
    speed = 158; altitude = 877; vs = 2000; pitch = 12; bank = 0;
    gs    = 156; tas = 162;
  } else if (fireActive) {
    // ENG 1 FIRE — triggered at V1+2s, climbing through ~50 ft RA / 827 ft MSL
    speed = 152; altitude = 827; vs = 1500; pitch = 13; bank = 0;
    gs    = 150; tas = 156;
  } else {
    // V1 ground roll — fire not yet triggered, aircraft at VIDP runway elevation
    speed = 145; altitude = 777; vs = 0; pitch = 6; bank = 0;
    gs    = 143; tas = 149;
  }

  return {
    ...defaultAircraftState,
    // FMA
    apEngaged,
    masterWarn,
    masterCaut,
    eng1Failed,
    eng2Failed:   false,
    thrMode,
    thrCue,
    vertMode,
    latMode:      'NAV',
    athrActive,
    athrArmed,
    srsCyan,
    // Flight values
    speed,
    altitude,
    vs,
    pitch,
    bank,
    gs,
    tas,
    selectedSpeed: 165,   // SRS target (V2+10 = 145+10+10)
    selectedAlt:   3000,  // FCU pre-selected ~3000ft QNH
    selectedHdg:   280,   // RWY 28
    heading:       280,
    track:         281,
    windDir:       260,
    windSpd:       12,
  };
}

// ─── PFD Action Overlay ────────────────────────────────────────────────────────
// Green pulsing ring + coaching hint when the active phase has a pfAction.

const PF_RING_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  border: "3px solid #00ff00",
  boxSizing: "border-box",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingBottom: "8px",
  gap: "4px",
};

export function PfActionOverlay({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => void;
}) {
  return (
    <div style={PF_RING_STYLE} onClick={onConfirm}>
      <div style={{
        background: "rgba(0,0,0,0.75)",
        border: "1px solid #00ff0060",
        color: "#00ff00",
        fontSize: "10px",
        fontFamily: "monospace",
        fontWeight: 700,
        letterSpacing: "0.1em",
        padding: "2px 10px",
        borderRadius: "2px",
        whiteSpace: "nowrap",
      }}>
        ▶ PF — {label}
      </div>
    </div>
  );
}

// ─── PFD Canvas ────────────────────────────────────────────────────────────────

export function PfdCanvas({
  state,
  scenario,
  elapsedMs,
  onPfAction,
}: {
  state?: ScenarioState;
  scenario?: Scenario;
  elapsedMs?: number;
  onPfAction?: (phaseId: string) => void;
}) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const stateRef   = useRef<AircraftState>(buildAircraftState(state, scenario, elapsedMs));
  const targetRef  = useRef<AircraftState>(buildAircraftState(state, scenario, elapsedMs));
  const cleanupRef = useRef<(() => void) | null>(null);

  // Track which phases the PF has already confirmed so the ring doesn't reappear.
  const [confirmedPhases, setConfirmedPhases] = useState<Set<string>>(new Set());

  // Keep targetRef in sync with React props — stateRef lerps toward it each frame
  useEffect(() => {
    targetRef.current = buildAircraftState(state, scenario, elapsedMs);
  }, [elapsedMs, scenario, state]);

  const activePhase  = getActivePfActionPhase(scenario, state);
  const pfAction     = activePhase?.pfAction;
  const needsConfirm = !!(pfAction && activePhase && !confirmedPhases.has(activePhase.id));

  const handleConfirm = useCallback(() => {
    if (!activePhase || !pfAction) return;
    setConfirmedPhases(prev => new Set(prev).add(activePhase.id));
    onPfAction?.(activePhase.id);
  }, [activePhase, pfAction, onPfAction]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;

    let cancelled = false;

    (async () => {
      const { Application } = await import("pixi.js");
      const { PFDRenderer }  = await import("@/avionics/pfd/PFDRenderer");

      if (cancelled) return;

      const app = new Application();
      await app.init({
        width:           1024,
        height:          1024,
        background:      0x000000,
        antialias:       true,
        resolution:      1,
        autoDensity:     false,
      });

      if (cancelled) { app.destroy(true); return; }

      app.canvas.style.width  = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.display = "block";
      el.appendChild(app.canvas);

      const pfd = new PFDRenderer();
      app.stage.addChild(pfd);

      app.ticker.add(() => {
        const t = targetRef.current;
        const c = stateRef.current;
        const dt = app.ticker.deltaMS / 1000;   // seconds since last frame

        // Altitude — constant 2 000 ft/min so 100→400 ft takes ~9 s
        const CLIMB_FT_PER_SEC = 2000 / 60;
        const altDiff  = t.altitude - c.altitude;
        const altStep  = Math.sign(altDiff) * Math.min(Math.abs(altDiff), CLIMB_FT_PER_SEC * dt);
        const newAlt   = Math.abs(altDiff) < 0.5 ? t.altitude : c.altitude + altStep;

        // VS — follows altitude movement. Frozen when altitude is frozen.
        const isMoving = Math.abs(t.altitude - newAlt) > 0.5;
        const newVs    = isMoving ? lerp(c.vs, altDiff > 0 ? t.vs : -t.vs, 0.08) : c.vs;

        stateRef.current = {
          ...t,                                  // FMA modes, flags, AP state — instant
          altitude: newAlt,
          vs:       newVs,
          speed:    lerp(c.speed, t.speed, 0.015),
          pitch:    lerp(c.pitch, t.pitch, 0.02),
        };
        pfd.update(stateRef.current);
      });

      cleanupRef.current = () => { app.destroy(true, true); };
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      {needsConfirm && pfAction && (
        <PfActionOverlay
          label={pfAction.label}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

// ─── ND Canvas ─────────────────────────────────────────────────────────────────

const ND_RANGE_OPTIONS = [5, 10, 20, 40] as const;

export function NdCanvas({ state, scenario, elapsedMs, paused }: { state?: ScenarioState; scenario?: Scenario; elapsedMs?: number; paused?: boolean }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const stateRef   = useRef<AircraftState>(buildAircraftState(state, scenario, elapsedMs));
  const cleanupRef = useRef<(() => void) | null>(null);
  const pausedRef  = useRef(paused);
  // Hold the NDRenderer instance so the range-cycle effect can poke it.
  // Typed loosely because the renderer is imported asynchronously.
  const ndRef      = useRef<{ setRange: (nm: number) => void } | null>(null);

  const [rangeIdx, setRangeIdx] = useState(1);    // default 10 NM

  useEffect(() => {
    stateRef.current = buildAircraftState(state, scenario, elapsedMs);
  }, [elapsedMs, scenario, state]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Whenever the range index changes, push the new NM into the renderer.
  useEffect(() => {
    ndRef.current?.setRange(ND_RANGE_OPTIONS[rangeIdx]);
  }, [rangeIdx]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;

    let cancelled = false;

    (async () => {
      const { Application } = await import("pixi.js");
      const { NDRenderer }  = await import("@/avionics/nd/NDRenderer");

      if (cancelled) return;

      const app = new Application();
      await app.init({
        width:       1024,
        height:      1024,
        background:  0x000000,
        antialias:   true,
        resolution:  1,
        autoDensity: false,
      });

      if (cancelled) { app.destroy(true); return; }

      app.canvas.style.width  = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.display = "block";
      el.appendChild(app.canvas);

      const nd = new NDRenderer();
      nd.setRange(ND_RANGE_OPTIONS[rangeIdx]);     // initial range
      ndRef.current = nd;
      app.stage.addChild(nd);

      app.ticker.add(() => { if (!pausedRef.current) nd.update(stateRef.current); });

      cleanupRef.current = () => {
        ndRef.current = null;
        app.destroy(true, true);
      };
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycleRange = () => setRangeIdx((i: number) => (i + 1) % ND_RANGE_OPTIONS.length);

  return (
    <div
      ref={mountRef}
      onClick={cycleRange}
      style={{ width: "100%", height: "100%", cursor: "pointer" }}
    />
  );
}

// ─── Exported composite ────────────────────────────────────────────────────────

export function PfdNd({
  state,
  scenario,
  elapsedMs,
  onPfAction,
}: {
  state?: ScenarioState;
  scenario?: Scenario;
  elapsedMs?: number;
  onPfAction?: (phaseId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="border border-[var(--color-border)] bg-black overflow-hidden"
           style={{ aspectRatio: "1", maxHeight: "280px" }}>
        <PfdCanvas state={state} scenario={scenario} elapsedMs={elapsedMs} onPfAction={onPfAction} />
      </div>
      <div className="border border-[var(--color-border)] bg-black overflow-hidden"
           style={{ aspectRatio: "1", maxHeight: "280px" }}>
        <NdCanvas state={state} scenario={scenario} elapsedMs={elapsedMs} />
      </div>
    </div>
  );
}
