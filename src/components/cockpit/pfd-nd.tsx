"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { Scenario, ScenarioPhase } from "@/scenarios/types";
import { defaultAircraftState, type AircraftState } from "@/avionics/core/aircraftState";
import { departureCleanup, type DepartureConfig } from "@/avionics/core/departureCleanup";
import { approachMarkers, type ApproachConfigData } from "@/avionics/core/approachConfig";

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


// ─── INTEGRATION NOTE (3 lines) ───────────────────────────────────────────────
// File: src/components/cockpit/pfd-nd.tsx, inside buildAircraftState().
// Paste this block RIGHT AFTER the closing `}` of the `dual-hyd-g-y` branch (after
// line 386) and BEFORE `const fireActive = fired("fire_warn");`. Self-contained, returns early.
// ──────────────────────────────────────────────────────────────────────────────

  // ── RTO LOW SPEED — ENG 1 FIRE below V1, ground reject ────────────────────
  // GROUND event, never airborne. Driver = STEPS (no altitude, no governor, no
  // liveAttitude). Three phases:
  //   accel  (accel_phase fired, not yet rejected) → takeoff roll, speed rising,
  //           MAN FLX · SRS armed(cyan) · RWY, A/THR armed(blue).
  //   reject (rto_call / thr_levers_close) → levers idle/reverse, decelerating,
  //           FMA reverts (thrust → MAN, SRS gone → vert/lat BLANK), MASTER WARN.
  //   stopped (park_brake / eng_shutdown) → speed 0, brakes set, all modes blank.
  // Law NORMAL throughout, vs 0, pitch ~0, fieldElev 777 (VIDP RWY 28).
  // ALL speeds are DRAFT — SME to confirm ground FMA (MAN FLX vs TOGA, RWY label,
  // exact blank-on-reject, and whether eng1Failed symbology should show on ground).
  if (scenario?.meta?.slug === "rto-low-speed") {
    const rolling  = fired("accel_phase");                       // takeoff roll begun (~90 kt)
    const rejected = step("rto_call") || step("thr_levers_close"); // reject decision made
    const stopped  = step("park_brake") || step("eng_shutdown");   // full stop, brakes set

    // FMA + values per phase (blank string "" where no mode is engaged).
    let thrMode = "MAN FLX", vertMode = "SRS", latMode = "RWY";  // DRAFT: MAN FLX vs TOGA — SME
    let srs = true;                                  // SRS ARMED → cyan (never engages, no liftoff)
    let athrArmed = true, athrActive = false;        // A/THR armed (blue) during the roll
    let speed = 0, vs = 0, pitch = 0;                // DRAFT speeds; vs 0 + pitch ~0 on the ground

    if (stopped) {
      // FULL STOP — parking brake set, engine being secured. No managed modes.
      thrMode = ""; vertMode = ""; latMode = ""; srs = false; athrArmed = false;
      speed = 0; vs = 0; pitch = 0;                  // DRAFT: stationary
    } else if (rejected) {
      // REJECT — thrust levers idle/reverse, decelerating hard. FMA REVERTS: thrust
      // → MAN (levers out of detent), SRS gone → vertical + lateral BLANK. MASTER WARN.
      thrMode = "MAN"; vertMode = ""; latMode = ""; srs = false; athrArmed = false;
      speed = 55; vs = 0; pitch = 0;                 // DRAFT: mid-deceleration snapshot
    } else if (rolling) {
      // ACCEL — takeoff roll through ~90 kt (below V1) when the fire warning fires.
      // MAN FLX · SRS armed(cyan) · RWY (defaults above).
      speed = 90; vs = 0; pitch = 0;                 // DRAFT: ~90 kt at fire warning
    }
    // else: lined up / start of roll — MAN FLX · SRS armed · RWY, speed ~0 (defaults above).

    // MASTER WARN from fire_warn_ground (sets masterWarnActive) until cancel_master_warn.
    const masterWarn = !!(s?.masterWarnActive && !step("cancel_master_warn"));
    const masterCaut = !!(s?.masterCautActive && !step("cancel_master_caut"));

    return {
      ...defaultAircraftState,
      apEngaged: false,           // hand-flown ground roll / reject — no AP
      athrActive,
      athrArmed,
      srsCyan: srs,               // SRS cyan (armed) while shown; blank after reject
      masterWarn,
      masterCaut,
      eng1Failed: false,          // DRAFT: engine still running pre-MASTER-OFF; keep PFD engine-out
      eng2Failed: false,          //        symbology/beta-target OFF on the ground (SME to confirm)
      thrMode,
      thrCue: undefined,
      vertMode,
      latMode,
      speed,
      altitude: 777,              // on the runway at VIDP field elevation — never climbs
      vs,                         // 0 on the ground
      pitch,                      // ~0 on the ground
      bank: 0,
      gs: Math.max(speed - 2, 0),
      tas: speed + 2,
      vmax: 220,                  // low-speed takeoff default; speed never nears the barber pole
      law: 'NORMAL',              // NORMAL law throughout (no degradation)
      fieldElev: 777,             // VIDP → RA reads ~0 (correctly, on the ground)
      selectedSpeed: speed,       // cyan selected bug tracks speed — NOT a magenta managed V2
      speedManaged: false,        // force cyan (no V2 magenta) [audit]
      selectedAlt: 777,           // DRAFT: keep the ALT bug at field elev (not the 3000 default)
      selectedHdg: 280,           // VIDP RWY 28 (~280°)
      heading: 280,
      track: 280,
    };
  }

// ── RAPID DEPRESS — EMERGENCY DESCENT FMA model ────────────────────────────
// DRAFT — SME-gated (structural descent speed VMO 350 vs reduced 320; VS magnitude).
// Cruise 270/M.78/FL350 (MACH · ALT CRZ · NAV, AP1 + A/THR, NORMAL law, VMAX
// M.82/350) → CAB PR EXCESS CAB ALT warning → EMER DESCENT (THR IDLE · OP DES +
// ALT armed(blue) toward FL100 · NAV; selected/cyan speed near VMO; SPD BRK →
// steepen; nose-down) → ALT★ capture FL100 via the §5c governor (mirrors G+Y).
// LAW STAYS NORMAL throughout — depress is NOT an F/CTL failure, so there is NO
// ALTN/DIRECT, NO amber-X, NO USE MAN PITCH TRIM (do NOT copy the G+Y law logic).
// Step-gated like the FIRE / G+Y models; sits AFTER the G+Y branch, before DEFAULT.
if (scenario?.meta?.slug === "rapid-depress") {
  // Gates. `depress` is a TRIGGER (triggersFired); the rest are completed STEPS,
  // except the two ECAM-transition triggers noted inline.
  const depress     = fired("depress");             // CAB PR EXCESS CAB ALT warning fired (co-fires ECAM id `cabin_alt`) — still CRUISE, descent not yet initiated
  const descentInit = step("emer_descent_init");    // EMER DESCENT INITIATE done → THR IDLE, OP DES, ALT armed FL100 (trigger `descent_started` then adds ECAM `emer_in_prog` ~5 s later — same PFD state)
  const spdBrakeOut = step("spd_brakes_ext");        // SPD BRK FULL → steepen the descent
  const spdMax      = step("spd_max");               // accelerate to max appropriate descent speed (structural → reduced, see DRAFT below)
  const levelOff    = step("level_off_10k");         // LEVEL OFF FL100 confirmed
  const cabNorm     = fired("below_10000ft");        // trigger fired 8 s after level_off_10k → adds ECAM `cab_norm` (CABIN ALT — NORMAL); level at FL100

  // ── Cruise defaults — 270 kt / M.78 / FL350 ─────────────────────────────────
  // MACH · ALT CRZ · NAV, AP1 + A/THR active, NORMAL law. VMAX = VMO/MMO red
  // barber = M.82 / 350 KCAS (NOT the 220 takeoff default — that would falsely
  // redden the whole cruise/descent tape). VLS ~205 sits well below cruise speed.
  let thrMode = "MACH", vertMode = "ALT CRZ", latMode = "NAV";
  let apOn = true;
  let speed = 270, altitude = 35_000, vs = 0, pitch = 2, tas = 460, vmax = 350;
  let law: AircraftState['law'] = 'NORMAL';   // depress ≠ F/CTL failure → law NEVER degrades here
  let selAlt: number | undefined;             // FCU selected altitude (the ALT bug)
  let altArmed = false;                       // ALT armed (blue) → descending toward selAlt
  let vls: number | undefined = 205;          // FL350 clean VLS — below every speed we set (no false amber)
  let speedManaged = true;                    // managed MACH cruise → MAGENTA bug; goes cyan (selected) in the descent

  if (cabNorm || levelOff) {
    // LEVEL at FL100 — emergency descent complete, cabin altitude back to NORMAL.
    // THR reverts to SPEED, ALT green (level), speed reduced. AP/A-THR available (NORMAL law).
    thrMode = "SPEED"; vertMode = "ALT"; latMode = "NAV"; apOn = true;
    speed = 250; altitude = 10_000; vs = 0; pitch = 2; tas = 290; vmax = 350;
    selAlt = 10_000; altArmed = false; speedManaged = false;   // cyan selected speed
  } else if (descentInit) {
    // EMER DESCENT IN PROGRESS — THR IDLE · OP DES · NAV. ALT armed (blue) toward
    // FL100 (selAlt 10 000). Speed is SELECTED (pilot pulls the SPD knob) → cyan.
    // OP DES commands THR IDLE (FCOM), so the col-1 FMA reads THR IDLE not SPEED.
    thrMode = "THR IDLE"; vertMode = "OP DES"; latMode = "NAV"; apOn = true;
    selAlt = 10_000; altArmed = true; speedManaged = false;    // cyan selected speed near VMO
    // DRAFT [SME]: STATUS shows STRUCTURAL CHECK REQUIRED, so this branch flies the
    // REDUCED structural descent speed ~320 (not VMO 350). If NON-structural, target
    // VMO 350. VS: −4000 clean (before speed brake) → −6000 once SPD BRK is FULL.
    // Nose-DOWN pitch ~−5 clean → ~−8 with the boards out (spec: −5 to −10).
    speed = spdBrakeOut ? 320 : 300;                 // 300 building up → 320 max (structural cap) [DRAFT-SME]
    vs    = spdBrakeOut ? -6000 : -4000;
    pitch = spdBrakeOut ? -8 : -5;
    tas   = 490; vmax = 350;
    void spdMax;   // speed target reached progressively via spdBrakeOut; spdMax = the "accelerate/hold max" callout, no distinct PFD delta
  } else if (depress) {
    // CAB PR EXCESS CAB ALT warning just fired — masks on / MW cancel in progress,
    // EMER DESCENT not yet initiated: still LEVEL at FL350, unchanged cruise FMA
    // (MACH · ALT CRZ · NAV, AP1 + A/THR, NORMAL law). Only the master warning is up.
    thrMode = "MACH"; vertMode = "ALT CRZ"; latMode = "NAV"; apOn = true;
    speed = 270; altitude = 35_000; vs = 0; pitch = 2; tas = 460; vmax = 350;
  }
  // else: cruise before the bang — MACH / ALT CRZ / NAV, AP1 + A/THR, NORMAL law.

  // ── §5c altitude governor — REAL ALT★ capture at FL100 (mirror of G+Y) ───────
  // As the LIVE tape descends onto the selected altitude, ramp VS → 0 so the
  // aircraft GENUINELY levels (OP DES → ALT* → ALT) and holds 0 while level. Only
  // the capture ramp is needed here (no 250-kt speed band — the 250 limit does not
  // apply during an emergency descent). Altitude motion tracks this VS in the PFD loop.
  if (liveAlt != null && vs < 0) {
    const a = liveAlt;
    if (altArmed && selAlt != null) {
      const toGo = a - selAlt;                       // ft still to lose to FL100
      const cz = Math.max(200, Math.abs(vs) / 6);    // ALT* capture zone (FCOM level-off)
      if (toGo <= cz) vs = Math.round(vs * Math.max(0, toGo / cz));  // → genuine 0 at FL100
    }
  }

  // Selected/target speed never commanded below the amber VLS band.
  if (vls != null) speed = Math.max(speed, vls);

  const masterWarn = !!(s?.masterWarnActive && !step("cancel_master_warn"));
  const masterCaut = !!(s?.masterCautActive && !step("cancel_master_caut"));

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
    speedManaged,
    selectedSpeed: speed,                 // cyan when speedManaged=false (descent), magenta when true (cruise)
    selectedAlt: selAlt ?? altitude,
    altArmed,
    // NO fieldElev override: default (777) still leaves AGL = 10 000 − 777 ≈ 9 200 ft
    // at the LOWEST point (FL100), far above the RA's < 2500 AGL gate → RA stays
    // HIDDEN for the whole scenario (real cruise/descent altitude, not the 777 default
    // that made every other scenario falsely read "on the runway").
    selectedHdg: 270,   // right turn heading 270 — scenario MAYDAY / ATC clearance
    heading: 270,
    track: 271,
    windDir: 270,       // wind 270/6 — scenario ATC weather
    windSpd: 6,
  };
}

  // ── SMOKE / FUMES (cabin) — cruise smoke → diversion to Mumbai ───────────── DRAFT
  // Cruise 280/FL320 (MACH · ALT CRZ · NAV, AP1 + A/THR, NORMAL LAW, magenta managed
  // bug) → FORDEC decision to divert → descend + HOLD IGAMA FL150 → cleared approach,
  // descend 3 000 + intercept → ILS RWY 27 Mumbai (VABB, fieldElev 39) FLAPS FULL,
  // VAPP ~140 → rollout. **NORMAL LAW THROUGHOUT** (no ALTN/DIRECT, no amber-X, no
  // USE MAN PITCH TRIM) — AP + A/THR remain AVAILABLE, so managed modes + the magenta
  // (managed) speed bug are legal the whole arc. Reuses the G+Y §5c descent governor
  // (capture ramp) + the RWY 27 ILS DME/GS geometry — but NONE of G+Y's jammed-flap
  // SPD-SEL dance and NONE of its law degradation. Arc is ATC-card-driven, so this
  // gates on the COARSE procedure steps that are present (fordec_smk / approach_brief /
  // approach_cl / landing_cl); the descend-to-FL150 leg AND the hold-at-FL150 are ONE
  // gate (fordec_smk) — the governor renders the descent then the level-off from the
  // single selAlt=15 000 target. [audit smoke-cabin row, 2026-07-11 · DRAFT / SME]
  if (scenario?.meta?.slug === "smoke-cabin") {
    const divert     = step("fordec_smk");       // FORDEC decision → divert: descend + HOLD FL150 (IGAMA)
    const apprBrief  = step("approach_brief");   // cleared the approach → descend 3 000 + intercept RWY 27
    const onIls      = step("approach_cl");      // established ILS RWY 27, FLAPS FULL, VAPP
    const landing    = step("landing_cl");       // short final → touchdown → rollout

    // Defaults = CRUISE 280/FL320 ≈ M.79. vmax = VMO 330 (NOT the 220 takeoff default,
    // which would falsely redden the tape). Law NORMAL, AP + A/THR on, managed bug.
    let thrMode = "MACH", vertMode = "ALT CRZ", latMode = "NAV";
    let apOn = true;
    let speed = 280, altitude = 32_000, vs = 0, pitch = 2, tas = 462, vmax = 330;
    const law: AircraftState['law'] = 'NORMAL';   // never degrades in this scenario
    let heading = 90;                             // initial investigation heading 090 (scenario ATC)
    let selAlt: number | undefined;               // FCU selected alt (the bug); defaults to current alt
    let altArmed = false;                         // ALT armed (blue) while descending to the target
    let vls: number | undefined;                  // VLS amber strip (set low on approach so decel isn't falsely amber)
    let fSpeed: number | undefined, vfeNext: number | undefined;

    if (landing) {
      // ROLLOUT — full stop on RWY 27, Mumbai (VABB, ~39 ft). AP/A-THR out, FMA columns
      // BLANK (no autoland ROLL OUT/RWY on a manual smoke-diversion landing). speed → 0.
      // ponytail: landing_cl is the LAST gate, so it stands in for touchdown+rollout —
      // the scenario has no discrete physical-touchdown step. selAlt stays the missed-
      // approach alt (3 000) the crew set on the FCU. [DRAFT / SME — add a touched_down
      // gate if a decel-from-VAPP rollout animation is wanted]
      thrMode = ""; vertMode = ""; latMode = ""; apOn = false;
      speed = 0; altitude = 39; vs = 0; pitch = 0; tas = 0; vmax = 230; heading = 270; selAlt = 3_000;
    } else if (onIls) {
      // ILS FINAL RWY 27 — established GS + LOC, FLAPS FULL, AP-COUPLED (AP available →
      // coupled approach; SME: coupled vs raw). FMA SPEED · G/S · LOC. VAPP ~140 held to
      // the flare. Tape descends the 3° slope to the field. [DRAFT — VAPP is a placeholder]
      thrMode = "SPEED"; vertMode = "G/S"; latMode = "LOC"; apOn = true;
      speed = 140; altitude = 39; vs = -730; pitch = 1; tas = 143; vmax = 230; heading = 270;
      vls = 132; fSpeed = 138; vfeNext = 177; selAlt = 3_000;
    } else if (apprBrief) {
      // CLEARED APPROACH — descend FL150 → 3 000, decelerate + configure, intercept the
      // RWY 27 localizer. Managed descent (AP on): DES · NAV → ALT/LOC at the 3 000
      // platform. Governor levels at 3 000; localizer captures as range closes.
      thrMode = "THR IDLE"; vertMode = "DES"; latMode = "NAV"; apOn = true;
      speed = 210; altitude = 3_000; vs = -1_500; pitch = -1; tas = 216; vmax = 250; heading = 230;
      vls = 145; fSpeed = 168; vfeNext = 185; selAlt = 3_000; altArmed = true;
    } else if (divert) {
      // FORDEC → DIVERT — descend + HOLD IGAMA FL150. ONE gate covers both the descent
      // and the hold: managed DES · NAV (AP on), governor ramps VS → 0 at 15 000, then
      // holds. Below the transition the descent stays >250 (FL150 is above the 10 000
      // limit). [audit: descent + hold FL150 merged — coarsest sensible gate]
      thrMode = "THR IDLE"; vertMode = "DES"; latMode = "NAV"; apOn = true;
      speed = 270; altitude = 15_000; vs = -2_000; pitch = -2; tas = 330; vmax = 320; heading = 180;
      selAlt = 15_000; altArmed = true;
    }
    // else: CRUISE before the FORDEC decision — smoke detected/assessed but flight path
    // unchanged (280 / FL320, MACH · ALT CRZ · NAV, AP1 + A/THR, NORMAL). Cruise regardless
    // of smoke_detect/cancel_master_caut/signs_on/cabin_brief/smoke_assessment/wx_ldg_smk.

    // ── §5c descent governor (REUSED from G+Y) — genuine level-off at every target ────
    // As the LIVE altitude captures the selected altitude, ramp VS → 0 (ALT* → ALT) so
    // the aircraft truly levels (hold at FL150, level at 3 000). No 250/10 000 band here:
    // both targets sit at/below approach speeds already. [audit: "let the governor run"]
    if (liveAlt != null && vs < 0 && altArmed && selAlt != null) {
      const toGo = liveAlt - selAlt;                 // ft still to lose
      const cz   = Math.max(200, Math.abs(vs) / 6);  // ALT* capture zone (FCOM level-off)
      if (toGo <= cz) vs = Math.round(vs * Math.max(0, toGo / cz));  // → genuine 0 at level
    }
    // At/near a managed level-off the FMA shows ALT (green), thrust SPEED — switch the
    // descending DES/idle presentation to the level presentation by altitude proximity.
    if (altArmed && selAlt != null && liveAlt != null && Math.abs(liveAlt - selAlt) < 300) {
      vertMode = "ALT"; thrMode = "SPEED"; vs = 0;
      if (divert && !apprBrief) speed = 235;   // holding speed at FL150 (managed) once level
      if (apprBrief) latMode = "LOC";          // localizer captured at the 3 000 platform
    }

    // ── RWY 27 ILS DME + GS/LOC deviation (REUSED geometry) ───────────────────────────
    //   Established (onIls/landing): true 3° geometry to the threshold, dme = (a−39)/318.
    //   Intercept (apprBrief, descending to/level 3 000): hold the DME ahead of the GS so
    //     the diamond reads fly-up (aircraft below the descending 3° path) → 0 at capture.
    // GS altitude = 39 + dme·318; deviation (dots) = (GSalt−alt)/(dme·37), fly-up only.
    let dme = 100, gsDev = 0, locDev = 0;
    if (liveAlt != null) {
      const a = liveAlt;
      // intercept progress from the live tape (3 000 platform): 1 far/deflected, 0 aligned
      const apI = Math.max(0, Math.min(1, (a - 3_000) / 12_000));
      if (onIls || landing) {
        dme = Math.max(0, (a - 39) / 318);           // on the glide → true 3°
      } else if (apprBrief) {
        dme = 12;                                     // ~1.9 dots below the GS at 3 000 → fly-up
        locDev = -0.6 * apI;                          // localizer deflected left, easing to centre
      }
      const gsAlt = 39 + dme * 318;
      gsDev = Math.max(0, Math.min(2, (gsAlt - a) / Math.max(1, dme * 37)));
    }

    // SMOKE / FUMES is a MASTER CAUTION (not a warning); LAND ASAP is amber. masterCaut
    // holds until the crew cancels it; no master warning in this scenario.
    const masterCaut = !!(s?.masterCautActive && !step("cancel_master_caut"));

    return {
      ...defaultAircraftState,
      apEngaged: apOn,
      masterWarn: false,
      masterCaut,
      eng1Failed: false,
      eng2Failed: false,
      thrMode,
      thrCue: undefined,
      vertMode,
      latMode,
      athrActive: true,      // A/THR available/active throughout (NORMAL, AP on)
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
      law,                   // NORMAL for the whole arc
      vls,
      fSpeed,
      vfeNext,
      gsDev,
      locDev,
      dme,
      fieldElev: 39,         // divert destination Mumbai VABB (~39 ft) → RA reads 0 only at touchdown
      speedManaged: true,    // managed speed → MAGENTA bug (AP + A/THR available)
      selectedSpeed: speed,  // managed target = current commanded speed
      selectedAlt: selAlt ?? altitude,
      altArmed,
      selectedHdg: heading,
      heading,
      track: heading + 1,
      windDir: 270,          // wind 270/6 — scenario ATC weather (RWY 27)
      windSpd: 6,
    };
  }

// ═══════════════════════════════════════════════════════════════════════════
// DRAFT — SME-GATED. Paste inside buildAircraftState(), IMMEDIATELY AFTER the
// closing `}` of the `if (scenario?.meta?.slug === "dual-hyd-g-y") { … }` block
// (i.e. right after line 386, before `const fireActive = fired("fire_warn");`).
// Self-contained: uses only the step()/fired() helpers already defined at the
// top of buildAircraftState. Mirrors the G+Y branch pattern exactly.
// Source: PFD-scenario-audit.md (elec-emer rows + Detail, 2026-07-11).
// ═══════════════════════════════════════════════════════════════════════════

  // ── EMER ELEC CONFIG — cruise total AC loss → RAT → hand-flown ILS Mumbai ──
  // Cruise FL330 → generators lost → ELEC EMER CONFIG (RAT + EMER GEN, BAT 30 min).
  // AP 1+2 INOP + A/THR INOP + FD unusable → HAND-FLOWN throughout (blank thrust
  // FMA col). ALTERNATE LAW from the failure; DIRECT LAW once the L/G is down
  // (STATUS: WHEN L/G DN → DIRECT LAW) → amber-X + USE MAN PITCH TRIM. Both radio
  // altimeters are INOP (STATUS INOP: RA 1+2) → RA suppressed via `raInop`. VMAX
  // 320 kt (STATUS: MAX SPEED 320 KT). Expedited V/S descent (no managed modes,
  // A/THR gone) FL330 → FL150 → 3 000 → ILS RWY 27, FLAP 3, VApp = VREF+10 ≈ 140.
  // Step-gated like G+Y; the arc is otherwise ATC-card-driven so the coarse
  // procedure steps below are the only gates available. [DRAFT — SME pilot review]
  if (scenario?.meta?.slug === "elec-emer-config") {
    const failed     = fired("gen_loss");             // AC BUS 1+2 lost → ELEC EMER CONFIG → ALTN law, AP+A/THR INOP
    const mayday     = step("atc_mayday_elec");       // MAYDAY declared + descent cleared → expedited V/S descent to FL150
    const fordec     = step("fordec_elec");           // FORDEC decision made → continue descent toward 3 000
    const apprBrief  = step("approach_brief_elec");   // approach briefed → cleared descend 3 000 for the ILS
    const apprPrep   = step("approach_prep_elec");    // approach prep (MDA/DH set per chart) → BARO min on the PFD
    const apprCl     = step("approach_cl_elec");      // approach CL → FLAP 3 selected, LOC captured, on the ILS
    const landingCl  = step("landing_cl_elec");       // landing CL → L/G DOWN (gravity) → DIRECT law + USE MAN PITCH TRIM

    // Defaults = the post-failure EMER ELEC cruise (FL330). thrMode is BLANK
    // (col-1) because A/THR is INOP — there is no thrust FMA. AP off, hand-flown.
    let thrMode = "", vertMode = "ALT CRZ", latMode = "HDG";
    let apOn = false;
    let speed = 270, altitude = 33_000, vs = 0, pitch = 2, tas = 460, vmax = 320;
    let law: AircraftState['law'] = 'ALTN';   // ALTERNATE LAW from the failure (STATUS: ALTN LAW: PROT LOST)
    let selAlt: number | undefined;
    let altArmed = false;
    let vls: number | undefined;
    let hdg = 160;                            // MAYDAY call heading 160 (scenario)
    let fSpeed: number | undefined;           // green "F" — FLAP-3 approach marker

    if (landingCl) {
      // L/G DOWN (gravity) on short final → DIRECT LAW: amber-X pitch bars + USE
      // MAN PITCH TRIM (FCOM DSC-27/DSC-22-30-100). Hand-flown raw ILS: lateral
      // LOC captured, vertical V/S on the 3° slope (no G/S managed mode — A/THR &
      // AP INOP). Speed held at VApp = VREF+10 ≈ 140 to the flare. RWY 27 = hdg 270.
      thrMode = ""; vertMode = "V/S"; latMode = "LOC"; apOn = false;
      speed = 140; altitude = 39; vs = -700; pitch = 1; tas = 143; law = 'DIRECT';
      selAlt = 3_000; vls = 130; fSpeed = 140; hdg = 270;
    } else if (apprCl) {
      // CONFIGURE — FLAP 3 selected, LOC captured, established on the ILS descending
      // the slope in V/S. Still ALTERNATE LAW (gear not yet down). Decelerated to
      // VApp ≈ 140. thrust FMA blank (A/THR INOP).
      thrMode = ""; vertMode = "V/S"; latMode = "LOC"; apOn = false;
      speed = 140; altitude = 39; vs = -700; pitch = 1; tas = 143; law = 'ALTN';
      selAlt = 3_000; vls = 130; fSpeed = 140; hdg = 270;
    } else if (fordec || apprBrief) {
      // Descent FL150 → 3 000 for the approach (V/S, hand-flown, ALTERNATE LAW).
      // Decelerating toward the FLAP-3 approach speed on a radar heading.
      thrMode = ""; vertMode = "V/S"; latMode = "HDG"; apOn = false;
      speed = 180; altitude = 3_000; vs = -1_800; pitch = -1; tas = 188; law = 'ALTN';
      selAlt = 3_000; altArmed = true; vls = 130; hdg = 240;
    } else if (mayday) {
      // MAYDAY declared + ATC descent clearance → EXPEDITED descent FL330 → FL150
      // in V/S (no managed OP DES — A/THR INOP). ALTERNATE LAW, hand-flown on a
      // heading. Speed 270, brisk V/S near the RAT/limit envelope (MAX 320).
      thrMode = ""; vertMode = "V/S"; latMode = "HDG"; apOn = false;
      speed = 270; altitude = 15_000; vs = -2_500; pitch = -3; tas = 340; law = 'ALTN';
      selAlt = 15_000; altArmed = true; hdg = 180;
    } else if (failed) {
      // EMER ELEC CONFIG established, still level at FL330 (CANCEL warn → memory
      // items → RAT/EMER GEN). ALTERNATE LAW, AP 1+2 + A/THR INOP: blank thrust
      // FMA, ALT CRZ · HDG. VMAX 320. (This is the audit's "cruise 270/FL330".)
      thrMode = ""; vertMode = "ALT CRZ"; latMode = "HDG"; apOn = false;
      speed = 270; altitude = 33_000; vs = 0; pitch = 2; tas = 460; law = 'ALTN';
    } else {
      // Pre-failure cruise — NORMAL LAW, AP1 + A/THR, managed: MACH · ALT CRZ · NAV.
      thrMode = "MACH"; vertMode = "ALT CRZ"; latMode = "NAV"; apOn = true;
      speed = 270; altitude = 33_000; vs = 0; pitch = 2; tas = 460; law = 'NORMAL'; hdg = 90;
    }

    // ── §5c ALT* capture governor (COPIED from the G+Y branch) ────────────────
    // As the LIVE tape captures the selected altitude, ramp VS → 0 (ALT* → ALT)
    // so the aircraft GENUINELY levels at FL150 / 3 000 instead of snapping. Same
    // capture-zone math as G+Y so both level-offs behave identically. [FCOM level-off]
    if (liveAlt != null && vs < 0 && altArmed && selAlt != null) {
      const toGo = liveAlt - selAlt;                 // ft still to lose to the target
      const cz = Math.max(200, Math.abs(vs) / 6);    // ALT* capture zone
      if (toGo <= cz) vs = Math.round(vs * Math.max(0, toGo / cz));  // → genuine 0 at level
    }

    // G6 (§5c): never command the selected speed below the amber VLS band.
    if (vls != null) speed = Math.max(speed, vls);

    // ── ILS RWY 27 geometry (VABB, 39 ft) — reused from the G+Y approach ──────
    // Only while configured on the approach (apprCl / landingCl). LOC captured on
    // final; a slight left offset while intercepting. G/S diamond is informational
    // (fly-up, DME-scaled) — vertical guidance is flown in V/S, not managed G/S.
    let gsDev = 0, locDev = 0, dme = 100;
    if (liveAlt != null && (apprCl || landingCl)) {
      const a = liveAlt;
      dme = Math.max(0, (a - 39) / 318);             // true 3° to the RWY 27 threshold
      const gsAlt = 39 + dme * 318;
      gsDev = Math.max(0, Math.min(2, (gsAlt - a) / Math.max(1, dme * 37)));
      locDev = landingCl ? 0 : -0.4;                 // captured on final; intercepting before gear
    }

    const masterWarn = !!(s?.masterWarnActive && !step("cancel_master_warn"));
    const masterCaut = !!(s?.masterCautActive && !step("cancel_master_caut"));

    // BARO minimum (MDA) appears once approach PREPARATION is complete.
    const showBaroMin = apprPrep;

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
      athrActive: false,      // A/THR INOP (EMER ELEC) — no managed thrust, blank FMA col-1
      athrArmed: false,       // not armed either (pb unpowered)
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
      fSpeed,                 // green "F" (FLAP-3 approach speed) shown on the approach
      showBaroMin,
      gsDev,
      locDev,
      dme,
      raInop: true,           // RA 1+2 INOP (EMER ELEC) → svg-pfd suppresses the Radio Altimeter, all phases
      fieldElev: 39,          // divert = Mumbai VABB (~39 ft AMSL)
      selectedSpeed: speed,   // SPD SEL bug = CYAN (speedManaged omitted/false — selected, not managed)
      speedManaged: false,
      selectedAlt: selAlt ?? altitude,
      altArmed,
      selectedHdg: hdg,
      heading: hdg,
      track: hdg + 1,
      windDir: 270,           // scenario weather: wind 270/6
      windSpd: 6,
    };
  }

// ============================================================================
// buildAircraftState branch for scenario slug "nav-adr-1-2-fault"
// Place this block DIRECTLY AFTER the closing `}` of the `dual-hyd-g-y` branch
// in buildAircraftState() (pfd-nd.tsx), before the FIRE-model default logic.
// DRAFT — SME pilot review required (all values tagged DRAFT are airmanship, not
// lifted verbatim from FCOM tables). Branch is self-contained; touches no other
// scenario. New AircraftState fields used: `spdUnreliable`, `law`, `vmax`.
// ============================================================================

  // ── NAV ADR 1+2 FAULT — climb FL150 → dual ADR fault → UNRELIABLE SPEED + ALTN LAW ──
  // Two ADRs give the SAME erroneous air data → the FMGC drops AP + A/THR and the
  // F/CTL reverts to ALTERNATE LAW; the CAPT PFD keeps showing the bad (present-but-
  // wrong) speed until AIR DATA SWTG → CAPT 3 puts the CAPT on the good ADR3.
  // No approach/DIRECT yet (no gear steps exist) → gsDev/locDev/dme left unset.
  // Law NORMAL→ALTN at the fault; the pfd-fma-logic skill draws the amber-X + low-speed
  // strip from the `law` field, so no amber-X handling is needed here.
  if (scenario?.meta?.slug === "nav-adr-1-2-fault") {
    const faulted = fired("adr_12_fail");            // ADR 1+2 fault → AP+A/THR trip, ALTN law, unreliable speed
    const adr3Sel = step("air_data_swtg_capt3");     // AIR DATA SWTG → CAPT 3: CAPT PFD now on the reliable ADR3
    const adrsOff = step("adr1_off") && step("adr2_off"); // both bad ADRs OFF → single reliable source, level block FL150
    const status  = step("read_status");             // STATUS reviewed → settled level hold, 250 kt

    // Fault window = the fault has fired AND the CAPT is still on the erroneous source.
    // The intermediate procedure gates (adr_12_fault, ap_disc, athr_disc, fctl_altn,
    // maintain_control, callout_unreliable_speed, gpws_sys_off, max_speed_set) are
    // real steps the runner tracks but they do NOT change this PFD snapshot — the
    // whole window shows the same unreliable-speed / ALTN / AP-off picture. [DRAFT]
    const faultWindow = faulted && !adr3Sel;

    // Defaults = pre-fault CLB: 286 kt / FL150 climb, AP1 + A/THR, NORMAL law.
    // VMAX 340 (clean, below VMO 350) so the climb speed is NOT falsely red. [DRAFT]
    let thrMode = "THR CLB", vertMode = "OP CLB", latMode = "NAV";
    let apOn = true, athrOn = true;
    let speed = 286, altitude = 15_000, vs = 1500, pitch = 5, tas = 360, vmax = 340;
    let law: AircraftState['law'] = 'NORMAL';
    let spdUnreliable = false;
    let selAlt: number | undefined;
    let altArmed = false;

    // VMAX in every post-fault phase = 320, NOT VMO 350. SME NOTE: 320 is a
    // MANEUVERING / turbulence-penetration limit imposed for the unreliable-air-data
    // + ALTN-law condition, not the structural VMO (350). Confirm the exact value /
    // whether it renders as a barber-pole vs an amber marker with SME. [DRAFT]

    if (status) {
      // STATUS reviewed on ADR3 (reliable) — settled level hold at the FL150-ish block,
      // 250 kt clean, hand-flown, ALTN law, AP + A/THR still OFF. [DRAFT]
      thrMode = "SPEED"; vertMode = "ALT"; latMode = "HDG"; apOn = false; athrOn = false;
      speed = 250; altitude = 15_000; vs = 0; pitch = 2; tas = 315; vmax = 320; law = 'ALTN';
      selAlt = 15_000;
    } else if (adrsOff) {
      // ADR 1+2 OFF — single reliable ADR3, leveled and holding the FL150-ish block.
      // Hand-flown, ALTN. vertMode ALT (level). [DRAFT]
      thrMode = "SPEED"; vertMode = "ALT"; latMode = "HDG"; apOn = false; athrOn = false;
      speed = 272; altitude = 15_000; vs = 0; pitch = 3; tas = 340; vmax = 320; law = 'ALTN';
      selAlt = 15_000;
    } else if (adr3Sel) {
      // AIR DATA SWTG → CAPT 3 — reliable speed RESTORED (272 kt, spdUnreliable cleared).
      // Re-establishing control on V/S, hand-flown, ALTN law. [DRAFT]
      thrMode = "SPEED"; vertMode = "V/S"; latMode = "HDG"; apOn = false; athrOn = false;
      speed = 272; altitude = 15_000; vs = -200; pitch = 3; tas = 340; vmax = 320; law = 'ALTN';
      selAlt = 15_000;
    } else if (faultWindow) {
      // FAULT WINDOW — ADR1+2 erroneous, still feeding the CAPT PFD → UNRELIABLE SPEED
      // (present-but-wrong value, drawn amber, NO red flag → `spdUnreliable`, not `spdFlag`).
      // AP + A/THR tripped OFF (apOn/athrOn false); FMA vertical column BLANK (vertMode "");
      // lateral reverts to HDG; MAN THR in col 1. NORMAL → ALTN law. VMAX = maneuvering 320.
      // Crew holds attitude while diagnosing → vs ~0. [DRAFT]
      // (Alternative per audit: set `spdFlag: true` here if the CAPT is deemed to have LOST
      //  the source rather than see a wrong value — kept simplest: spdUnreliable for the
      //  whole window, cleared at air_data_swtg_capt3.)
      thrMode = "MAN THR"; vertMode = ""; latMode = "HDG"; apOn = false; athrOn = false;
      speed = 286; altitude = 15_000; vs = 0; pitch = 4; tas = 360; vmax = 320; law = 'ALTN';
      spdUnreliable = true;
    }
    // else: pre-fault CLB — defaults above (THR CLB · OP CLB · NAV, AP1 + A/THR, NORMAL, climbing).

    const masterWarn = !!s?.masterWarnActive;
    const masterCaut = !!s?.masterCautActive;

    return {
      ...defaultAircraftState,
      apEngaged: apOn,
      athrActive: athrOn,
      athrArmed: false,
      masterWarn,
      masterCaut,
      eng1Failed: false,
      eng2Failed: false,
      srsCyan: false,
      thrMode,
      thrCue: undefined,
      vertMode,
      latMode,
      speed,
      altitude,
      vs,
      pitch,
      bank: 0,
      gs: Math.max(speed - 2, 0),
      tas,
      vmax,
      law,
      spdUnreliable,           // fault window only → amber present-but-wrong speed; cleared at ADR3 switch
      selectedSpeed: speed,
      selectedAlt: selAlt ?? altitude,
      altArmed,
      selectedHdg: 90,
      heading: 90,
      track: 91,
      windDir: 270,
      windSpd: 6,
    };
  }

// ── 3-LINE INTEGRATION NOTE ──────────────────────────────────────────────────
// 1. Paste the block after the dual-hyd-g-y branch's closing brace in
//    buildAircraftState() (pfd-nd.tsx ~line 386); it reuses the existing
//    step()/fired() helpers and the ...defaultAircraftState spread — no imports.
// 2. New AircraftState fields USED: `spdUnreliable` (fault window), `law` (NORMAL→ALTN),
//    `vmax` (340 climb → 320 maneuvering) — all already defined on AircraftState;
//    `spdFlag`/`fdOff`/`raInop` NOT used here. Requires svg-pfd to render the amber
//    `spdUnreliable` value + the ALTN amber-X (law) — confirm those draw paths exist.
// 3. All values are DRAFT → SME pilot review before user-visible; wire the gate names
//    (adr_12_fail trigger + air_data_swtg_capt3 / adr1_off / adr2_off / read_status
//    steps) to the scenario .ts with scenario-alt-logic; other listed gates are no-op here.

  // ── UNRELIABLE SPEED — ADR 1 erroneous → memory items, hand-flown ─────────────
  // DRAFT — SME REVIEW REQUIRED (all values/FMA below are unverified against FCOM/QRH).
  // Climb passing FL150 when ADR 1 gives an ERRONEOUS PRESENT VALUE (no flag): the
  // airspeed shown is wrong-but-present, AP auto-disconnects, and the crew fly the
  // MEMORY ITEMS — AP/FD/A-THR OFF, pitch+thrust table (5°/CLB above FL100), raw data.
  // Then the faulty ADR is switched OFF (source LOST → red SPD flag), and finally the
  // two remaining ADRs agree → speeds reliable again, still hand-flown (no autoland).
  //
  // DRAFT-SME: LAW stays NORMAL throughout. A SINGLE ADR failure does NOT degrade the
  // flight-control law — ELAC still has two valid ADRs, so pitch limits stay green "="
  // (no amber-X, no USE MAN PITCH TRIM). Contrast nav-adr-1-2-fault (dual ADR → ALTN).
  // Confirm with SME that no transient ALTN law occurs at the disagree. [FCOM DSC-27]
  //
  // Gating (reconciled to the real scenario ids in unreliable-speed.ts):
  //   fault    = trigger `pitot_fail`  (the ECAM ids adr_fault/ias_disagree/autopilot_off
  //              are ADD_ECAM message ids, NOT triggers/steps — cannot be gated here).
  //   memory   = step  `ap_fd_disc` / `pitch_thrust` (AP/FD/A-THR OFF, attitude flown).
  //   isolate  = step  `adr_off`     (faulty ADR OFF → source lost → red SPD flag).
  //   reliable = step  `spd_check` || `probe_heat_on` (2 ADRs agree → valid speed back).
  //   approach = step  `approach_cl` || `landing_cl`  (raw-data ILS — coarse/future).
  // Failure WINDOW = fault fired AND NOT isolated (spdUnreliable present-but-wrong value).
  if (scenario?.meta?.slug === "unreliable-speed") {
    const failed   = fired("pitot_fail");                                 // ADR1 erroneous — memory-item window opens
    const isolated = step("adr_off");                                     // faulty ADR switched OFF → source LOST (red SPD flag)
    const reliable = step("spd_check") || step("probe_heat_on");          // remaining 2 ADRs agree → speeds reliable again
    const approach = step("approach_cl") || step("landing_cl");           // raw-data approach (hand-flown ILS)

    // Defaults = pre-failure managed climb (THR CLB · CLB · NAV, AP1 + A/THR, NORMAL law).
    let thrMode = "THR CLB", vertMode = "CLB", latMode = "NAV";
    let apOn = true, athrOn = true, fdOff = false;
    let spdUnreliable = false, spdFlag = false, speedManaged = true;
    // VMAX = VMO ~340/M.82 region (NEVER the 220 takeoff default — that would falsely
    // redden the 250–300 kt tape). Held across every phase of this scenario.
    let speed = 300, altitude = 15_000, vs = 1_800, pitch = 8, tas = 380, vmax = 340;
    const law: AircraftState['law'] = 'NORMAL';   // single ADR → law UNCHANGED (DRAFT-SME above)
    let vls: number | undefined, greenDot: number | undefined;

    if (approach) {
      // Raw-data approach back to Delhi (VIDP) — hand-flown, NO autoland: FD stays OFF so
      // the FMA vert/lat columns are BLANK, A/THR off, speed flown manually to VAPP. COARSE
      // placeholder — full ILS deviation + descent governor are FUTURE work. [DRAFT-SME]
      thrMode = "MAN"; vertMode = ""; latMode = ""; apOn = false; athrOn = false; fdOff = true;
      speed = 135; altitude = 3_000; vs = -700; pitch = 2; tas = 140;   // vmax 340, law NORMAL
    } else if (reliable) {
      // SPEEDS RELIABLE — 2 ADRs agree, valid speed restored (both flags FALSE). Still
      // ALL-OFF and hand-flown (raw data): AP/FD/A-THR remain OFF → blank FMA vert/lat.
      thrMode = "MAN"; vertMode = ""; latMode = ""; apOn = false; athrOn = false; fdOff = true;
      speed = 250; altitude = 14_000; vs = 0; pitch = 3; tas = 275;     // level in the block, valid tape
      greenDot = 215; vls = 160;   // characteristic speeds legal again once source trusted
    } else if (isolated) {
      // FAULTY ADR OFF — source LOST. The red "SPD" flag REPLACES the airspeed scale
      // (FCOM DSC-31-40 item 6); there is no present value now (spdUnreliable → false,
      // spdFlag → true). Still hand-flown on the pitch+thrust table, memory items held.
      thrMode = "MAN"; vertMode = ""; latMode = ""; apOn = false; athrOn = false; fdOff = true;
      spdFlag = true;
      speed = 250; altitude = 14_000; vs = 0; pitch = 5; tas = 275;     // speed underlies gs; tape hidden by the flag
    } else if (failed) {
      // FAILURE WINDOW — ADR 1 erroneous PRESENT VALUE (wrong-but-present, amber, NO flag):
      // spdUnreliable → true. AP auto-dropped; crew fly the MEMORY ITEMS — AP/FD/A-THR OFF
      // (blank FD bars + FMA vert/lat cols via fdOff), thrust MANUAL, pitch HELD ~5°/CLB
      // (above FL100 QRH row). vs 1000 → 0 as the attitude stabilises into the block alt.
      // Suppress the speed bug + VLS while the source is suspect (do not cue a bad target).
      thrMode = "MAN"; vertMode = ""; latMode = ""; apOn = false; athrOn = false; fdOff = true;
      spdUnreliable = true;
      speed = 210; altitude = 14_000; vs = 1_000; pitch = 5; tas = 270; // 210 = erroneous amber reading (arbitrary — not chased)
    }
    // else: pre-failure managed climb (defaults above) — THR CLB · CLB · NAV, AP1 + A/THR.

    return {
      ...defaultAircraftState,
      apEngaged: apOn,
      athrActive: athrOn,
      athrArmed: false,
      srsCyan: false,
      masterWarn: false,
      masterCaut: !!(s?.masterCautActive && !step("cancel_master_caut_initial")),
      eng1Failed: false,
      eng2Failed: false,
      thrMode,
      thrCue: undefined,
      vertMode,
      latMode,
      // Abnormal-instrument flags (svg-pfd consumes these — SME-gated draw paths):
      spdUnreliable,   // amber present-but-wrong value (failure window)
      spdFlag,         // red SPD flag replaces the scale (ADR OFF → source lost)
      fdOff,           // both FD OFF → blank FD bars + FMA vert/lat cols (hand-flown)
      speed,
      altitude,
      vs,
      pitch,
      bank: 0,
      // ponytail: gs tied to the tape speed (coarse). In reality gs comes from IRS/GPS and
      // stays valid even while the ADR is erroneous — refine if the ND groundspeed matters.
      gs: Math.max(speed - 2, 0),
      tas,
      vmax,
      law,
      vls,
      greenDot,
      speedManaged: apOn ? speedManaged : false,   // managed magenta bug only while AP/managed climb
      selectedSpeed: speed,
      selectedAlt: apOn ? 25_000 : altitude,       // cleared FL250 pre-fail; no FCU target once hand-flown
      selectedHdg: 280,
      heading: 280,      // ponytail: heading held 280 (coarse) — ATC turns 120/240 not modelled on the PFD
      track: 281,
      fieldElev: 777,    // return to Delhi VIDP (~777 ft) → RA reads AGL; RA still INOP (>2500) in the climb/block
    };
  }

  const fireActive  = fired("fire_warn");
  const eng1Failed  = fireActive;
  const gearUp              = step("positive_rate_gear_up");
  const apEngaged           = step("engage_ap_fma");
  const atFourHundredFt     = fired("four_hundred_ft");
  const ecamActionsStarted  = step("four_hundred_ft_cmd");
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

  // ── APPROACH PHASE gates (return VIDP RWY 28, ILS; platform 3 000 ft) [DRAFT-SME · 2026-07-12] ──
  // Checked BEFORE the climb ladder so a completed approach step wins over mctOpClb. Each config card
  // (flap 1 → 2 → gear → 3 → full) decelerates on the 3 000 ft platform; ils_established captures the ILS.
  const apDescent  = step("approach_prep") || step("approach_brief"); // level at the 3 000 platform (climb-out tops here), vectoring
  const apFlap1    = step("flap_1");
  const apFlap2    = step("flap_2");
  const apGearDn   = step("gear_down");
  const apFlap3    = step("flap_3");
  const apFlapFull = step("flap_full");
  const apConfig   = apFlap1 || apFlap2 || apGearDn || apFlap3 || apFlapFull; // level 3 000, configuring
  const apEstab    = step("ils_established");                        // G/S · LOC captured, descend the ILS
  const apFinal    = step("landing_cl");                             // short final, VAPP
  const stopped    = step("touched_down");                           // main-gear touchdown → ROLLOUT, decelerate to 0 [user 2026-07-13]
  const apPrep     = apDescent;                                      // alias for the FMA/vertMode expressions
  const approaching = (apDescent || apConfig || apEstab || apFinal) && !stopped;   // rollout ≠ approach

  // ── FMA modes per workbook V3 phase table ─────────────────────────────────
  // On the ROLLOUT (touched_down) the AP/FD drop and the FMA columns go BLANK (hand-flown rollout,
  // no autoland ROLL OUT) — same as G+Y. [user 2026-07-13]
  // Col 1 (engaged): approach = SPEED (level intercept + G/S) / THR IDLE (open descent);
  // MOST-SPECIFIC FIRST — steps accumulate, so apPrep stays true through config/final and must be
  // checked LAST or it shadows SPEED (bug caught by the buildAircraftState assertion 2026-07-12).
  const thrMode  = stopped ? ''
                 : (apDescent || apConfig || apEstab || apFinal) ? 'SPEED'
                 : mctOpClb ? 'THR MCT' : 'MAN TOGA';
  // Col 1 row 3 (flashing white cue): LVR MCT after OP CLB selected; none on the approach.
  const thrCue   = approaching ? undefined
                 : (opClbDone && !mctOpClb ? 'LVR MCT' : undefined);
  // Col 2 (vertical): approach = ALT (level 3 000 platform, vectoring + configuring, GS armed)
  //                 → G/S (ils_established + final, descending the slope from 3 000).
  const vertMode = stopped ? ''
                 : (apEstab || apFinal) ? 'G/S'
                 : (apDescent || apConfig) ? 'ALT'
                 : (opClbDone || mctOpClb) ? 'OP CLB' : levelOff ? 'V/S' : 'SRS';
  // Col 3 (lateral): approach = NAV (vectored/intercepting) → LOC (captured at ils_established).
  const apLat    = stopped ? '' : (apEstab || apFinal) ? 'LOC' : 'NAV';
  // A/THR: active (green) throughout the approach; off on the rollout; else the climb arming logic.
  const athrActive = stopped ? false : approaching ? true : mctOpClb;
  const athrArmed  = approaching ? false : (fireActive && !mctOpClb);
  // SRS never shows on the approach.
  const srsCyan    = approaching ? false
                   : (fireActive ? false : !levelOff && !opClbDone && !mctOpClb);

  // ── Flight values — step-driven, per workbook V3 flight model ─────────────
  let speed, altitude, vs, pitch, bank, gs, tas;
  // Approach-phase overrides — undefined / default ⇒ climb path unchanged [DRAFT-SME]
  let apVmax: number | undefined;
  let apSelAlt: number | undefined, apAltArmed = false;
  let gsDev = 0, locDev = 0, dme: number | undefined = undefined;

  // ── APPROACH → LANDING (platform 3 000 ft; NORMAL law — fire keeps hydraulics). Each config card
  //    decelerates through the flap schedule; ils_established captures the ILS. Values DRAFT-SME —
  //    tune live like the takeoff. Platform 3 000 = the climb-out top, so the aircraft LEVELS here (no descent to it) then descends the ILS. [2026-07-12]
  //    during vectoring so apDescent descends TO the 3 000 platform (no climb→descend blip). [2026-07-12]
  if (stopped) {
    // ── ROLLOUT / FULL STOP ── main gear down on VIDP RWY 28 (777 ft). AP off, hand-flown; the speed
    // DECELERATES to 0 (the svg-pfd on-ground fast decel does the ramp, like G+Y). law NORMAL — the fire
    // scenario keeps its hydraulics (not DIRECT). [user 2026-07-13: "show the deceleration after landing"]
    speed = 0; altitude = 777; vs = 0; pitch = 0; bank = 0; gs = 0; tas = 0;
    apVmax = 177;
    gsDev = 0; locDev = 0;                                                            // off the ILS on the ground
  } else if (apFinal) {
    // ── SHORT FINAL ── ILS (G/S · LOC), VAPP = VREF+5 ≈ 145 kt (single-engine), CONF FULL,
    // descending 2000→field to the flare. law NORMAL. vs SIGNED for SvgPfd (descent < 0). [DRAFT-SME]
    speed = 145; altitude = 777; vs = -700; pitch = 2; bank = 0; gs = 143; tas = 149;
    apVmax = 177;
    gsDev = 0.1; locDev = 0; dme = 3;                                                 // captured, threshold close
  } else if (apEstab) {
    // ── ILS ESTABLISHED ── G/S + LOC captured, descending the 3° slope from the 3 000 platform,
    // CONF FULL at VAPP. [DRAFT-SME]
    speed = 150; altitude = 3000; vs = -750; pitch = 1; bank = 0; gs = 148; tas = 154;
    apVmax = 177;
    gsDev = 0.1; locDev = 0; dme = 5;                                                 // just captured
  } else if (apFlapFull) {
    // ── FLAP FULL ── CONF FULL, level 3 000, decel to VAPP; LOC centred, GS coming down. [DRAFT-SME]
    speed = 150; altitude = 3000; vs = 0; pitch = 2; bank = 0; gs = 148; tas = 154;
    apVmax = 177;
    gsDev = 0.8; locDev = 0; dme = 6;
  } else if (apFlap3) {
    // ── FLAP 3 ── CONF 3, level 3 000, decel ~165. [DRAFT-SME]
    speed = 165; altitude = 3000; vs = 0; pitch = 2; bank = 0; gs = 163; tas = 169;
    apVmax = 185;
    gsDev = 1.2; locDev = -0.1; dme = 7;
  } else if (apGearDn) {
    // ── GEAR DOWN ── level 3 000, gear down 3 green (normal, GREEN via PTU), decel ~175. [DRAFT-SME]
    speed = 175; altitude = 3000; vs = 0; pitch = 1; bank = 0; gs = 173; tas = 179;
    apVmax = 200;
    gsDev = 1.8; locDev = -0.2; dme = 9;                                              // GS above (fly-up)
  } else if (apFlap2) {
    // ── FLAP 2 ── CONF 2, level 3 000, F speed ~185. [DRAFT-SME]
    speed = 185; altitude = 3000; vs = 0; pitch = 1; bank = 0; gs = 183; tas = 189;
    apVmax = 200;
    gsDev = 2.0; locDev = -0.4; dme = 11;
  } else if (apFlap1) {
    // ── FLAP 1 ── CONF 1, level 3 000, S speed ~205 (decel from green dot). [DRAFT-SME]
    speed = 205; altitude = 3000; vs = 0; pitch = 0; bank = 0; gs = 203; tas = 209;
    apVmax = 230;
    gsDev = 2.0; locDev = -0.6; dme = 13;                                             // intercepting
  } else if (apDescent) {
    // ── INITIAL APPROACH ── LEVEL at the 3 000 ft platform (the climb-out tops here), CLEAN, being
    // vectored for the ILS, decel toward green dot. FMA ALT · SPEED. Not on the ILS yet. [DRAFT-SME]
    speed = 220; altitude = 3000; vs = 0; pitch = 0; bank = 0; gs = 218; tas = 224;
    apVmax = 340;
    apSelAlt = 3000; apAltArmed = false;
    gsDev = 0; locDev = 0; dme = 16;                                                  // ILS not captured
  } else if (mctOpClb) {
    // THR MCT + OP CLB — climbing to the FCU-selected 3000, single engine. altitude = the TARGET (3000);
    // the capture ramp below eases VS → 0 into it (ALT* → ALT), so it LEVELS OFF, not a frozen climb. [user 2026-07-12]
    speed = 220; altitude = 3000; vs = 1000; pitch = 5; bank = 0;
    gs    = 218; tas = 224;
  } else if (opClbDone) {
    // ALT pulled, OP CLB engaged AFTER green dot — LVR MCT still flashing. Climbing toward the selected 3000.
    speed = 220; altitude = 3000; vs = 900; pitch = 3; bank = 0;
    gs    = 218; tas = 224;
  } else if (accelClean) {
    // Clean config reached and accelerated to GREEN DOT (218) — level at MAA 2300 ft, LVR MCT flashing.
    // Slats retracted (lever 1→0) at S speed; the tape marker has changed S → green dot. GREEN DOT REACHED
    // here, BEFORE OP CLB is pulled (user 2026-07-12: green dot must be reached, then OP CLB selected).
    speed = 218; altitude = 2300; vs = 0; pitch = 0; bank = 0;  // = green dot
    gs    = 216; tas = 222;
  } else if (levelOff) {
    // MAA (2300 ft) — V/S = 0, level, ACCELERATING (not holding). The aircraft accelerates from V2+10
    // toward green dot; the crew retracts the slats at S (205). Target 210 = just past S, below VFE 1+F
    // (~215) so it can't overspeed the flaps if the crew is slow to clean up. [user 2026-07-12: was frozen at 185]
    speed = 210; altitude = 2300; vs = 0; pitch = 0; bank = 0;
    gs    = 208; tas = 214;
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

  // ── ALTITUDE CAPTURE (§5c) — level off at the selected 3000, don't freeze-climb ────────────────
  // On the OP CLB legs the aircraft climbs TO 3000 (altitude = target). As the LIVE altitude nears it,
  // ease VS → 0 so it captures (ALT* → ALT) smoothly instead of holding a frozen 1000 fpm. Same governor
  // as the G+Y descent, mirrored for a climb. [user 2026-07-12: "level off at 3000 with ALT*/ALT, VS reducing"]
  const climbCapture = opClbDone || mctOpClb;
  if (climbCapture && liveAlt != null && vs > 0) {
    const toGo = 3000 - liveAlt;                     // ft still to climb to the selected alt
    const cz   = Math.max(200, vs / 6);              // capture zone (bigger for a faster climb)
    if (toGo <= cz) vs = Math.max(0, Math.round(vs * (toGo / cz) / 50) * 50);   // ramp VS → 0 into 3000
  }

  // ── ILS DME from ALTITUDE (Mumbai ILS, G+Y model) ─────────────────────────────────────────────
  // On the glideslope (descending) the DME tracks the height geometrically: 3° slope → dist ≈ AGL/318
  // (AGL = liveAlt − field 777). The LEVEL configuring keeps its horizontal closure (per-phase dme).
  // So at 3000 ft the descent reads ≈7 NM and the diamond/readout move WITH the altitude. [user 2026-07-12]
  if (approaching && vs < 0 && liveAlt != null) {
    dme = Math.max(0.3, Math.round((liveAlt - 777) / 318 * 10) / 10);
  }

  // ── DEPARTURE ACCELERATION & CLEANUP (shared governor, not hand-coded per phase) ──────────────
  // From V2 the char-speed marker follows the flap lever ON A SPEED SCHEDULE: 1+F → green "S" until
  // slats retract at S → clean → green dot, accelerating to the climb speed. Driven by the LIVE
  // (animated) speed when available (5th arg) so the S→green-dot flip happens exactly as the aircraft
  // crosses S, else the phase target. Not run on the approach (which has its own CONF 2/3/FULL F).
  // Single source of truth = departureCleanup(); reuse it for every departure PFD. [user 2026-07-12]
  const ENG_FIRE_DEP: DepartureConfig = {
    takeoffConf: 1,          // CONF 1+F takeoff → lever 1 → green "S"
    v1: 140, vr: 145, v2: 150,
    sSpeed: 205, fSpeed: 160, greenDot: 218, climbSpeed: 230,  // DRAFT-SME
  };
  const airborne = fireActive || gearUp || apEngaged;          // past liftoff → takeoff speeds cleared
  const clean = approaching ? null : departureCleanup(ENG_FIRE_DEP, liveSpd ?? speed, airborne);
  // CONFIG change = the crew RETRACTED the slats at S (the slats_up gate: accel_clean card + speed ≥ S).
  // ALL config-dependent PFD elements (char-speed S→green dot, VLS band) flip on THIS — in lockstep with
  // the E/WD flap — so nothing cleans up before S or before the crew calls "flaps up". [user 2026-07-12]
  const slatsUp = step("slats_up");

  // ── APPROACH DECELERATION & CONFIGURATION (shared governor, mirror of the cleanup) ────────────
  // As the flaps EXTEND (scenario flap steps), the char-speed marker + MAGENTA managed target follow
  // the flap lever DOWN: green dot → S → F → F → VAPP; VLS/α-band drop with each config. The config is
  // taken from the flap STEPS (authoritative), most-specific first (they accumulate). Single source of
  // truth = approachMarkers(); reuse for every approach PFD. Fixes: CONF 1 now shows S (was green dot →
  // "only F again and again"), target now MAGENTA managed. [user 2026-07-12]
  const ENG_FIRE_APPR: ApproachConfigData = {
    // MAX LANDING WEIGHT — A320-200 MLW ≈ 64.5 t (overweight immediate return after the fire).
    // Green dot = 2·W + 85 = 214 (FCOM DSC-22-10-50-20). S ≈ GD − 10; F = min flap retract; VAPP = VREF + 5.
    // VLS drops per config (1.28·VS clean → 1.23·VS landing). [user 2026-07-12 "max landing weight" — DRAFT-SME]
    greenDot: 214, sSpeed: 204, fSpeed: 156, vApp: 138,
    vls: { clean: 195, conf1: 172, conf2: 150, conf3: 140, full: 133 },
  };
  const apprConf = (apFinal || apEstab || apFlapFull) ? 4
                 : apFlap3 ? 3
                 : (apGearDn || apFlap2) ? 2
                 : apFlap1 ? 1 : 0;                            // apDescent / clean
  const appr = approaching ? approachMarkers(ENG_FIRE_APPR, apprConf) : null;

  return {
    ...defaultAircraftState,
    // FMA
    apEngaged: stopped ? false : apEngaged,   // AP disconnected at touchdown → hand-flown rollout
    masterWarn,
    masterCaut,
    eng1Failed,
    eng2Failed:   false,
    // BETA TARGET (FCOM DSC-27-20-10-50): the blue β-target replaces the yellow slip index when in
    // flight, CONF 1/2/3, N1 > 80%, AND N1 split > 35%. A FIRE is NOT a failure — at the fire warning
    // BOTH engines are still at TOGA (symmetric, split < 35%), so NO β. The split only crosses 35%
    // when ENG 1 lever is pulled to IDLE, i.e. β appears at THR IDLE, not with the fire. [user 2026-07-11,
    // stated twice: "beta does not come during fire warning, it comes when thrust is reduced"]
    // ponytail: gated on the thr_lever_idle step (no per-engine-N1/CONF fields to compute the literal
    // rule); tighten if the state ever exposes per-engine N1 + CONF (β should drop at symmetric thrust).
    beta:         step("thr_lever_idle"),
    thrMode,
    thrCue,
    vertMode,
    latMode:      apLat,
    athrActive,
    athrArmed,
    srsCyan,
    // Flight values — on the APPROACH the displayed speed follows the FCOM char-speed schedule
    // (green dot → S → F → VAPP = the governor's managedTarget), NOT hand-set phase values. The live
    // lerp animates the deceleration between configs. [user 2026-07-12: "speed from FCOM logic, not your own"]
    speed:         approaching ? (appr?.managedTarget ?? speed) : speed,
    altitude,
    vs,
    pitch,
    bank,
    gs,
    tas,
    selectedSpeed: approaching ? (appr?.managedTarget ?? speed) : (levelOff ? 230 : 165),  // after level-off crew selects 230 kt (VFE CONF 1) throughout acceleration; pre-level-off = SRS V2+10
    speedManaged:  approaching ? true : !levelOff,   // MAGENTA (managed) during SRS departure + approach; CYAN (selected) after level-off at MAA
    selectedAlt:   apSelAlt ?? 3000,  // approach descent → platform; else FCU pre-selected ~3000ft QNH
    selectedHdg:   280,   // RWY 28
    heading:       280,
    track:         281,
    windDir:       260,
    windSpd:       12,
    fieldElev:     777,   // VIDP — so SvgPfd RA reads AGL correctly on the runway (not the 39 default)
    altArmed:      approaching ? apAltArmed : (opClbDone || mctOpClb),  // ALT armed on the climb to 3000 (→ ALT*/ALT capture) + approach descent
    // VMAX = the red/black barber-pole top. Correct A320 logic: VMO (350) when CLEAN, VFE of the current
    // flap config when flaps are out. DEPARTURE: CONF 1+F → VFE 1 = 230, then VMO 350 once the crew
    // retracts at S (slatsUp). APPROACH: apVmax steps down per config (230→200→185→177). [user 2026-07-14]
    vmax:          approaching ? (apVmax ?? 350) : (slatsUp ? 350 : 230),
    // ── ILS deviations (approach) — 0 during the climb, set by the approach blocks ──
    gsDev,                              // glideslope: + = fly-up (below path); ~0 = captured
    locDev,                             // localizer:  − = diamond left; ~0 = captured
    dme,                                // NM to RWY 28 threshold — feeds the svg-pfd ILS readout + G/S geometry
    // Low-speed band: APPROACH drops with each flap step (governor); DEPARTURE rises to the clean values
    // ONLY when the crew retracts at S (slatsUp) — in lockstep with the char-speed marker + E/WD flap, so
    // nothing cleans up before the "flaps up" call at S. [user 2026-07-12]
    vls:           approaching ? appr?.vls       : (slatsUp ? 152 : 130),
    alphaProt:     approaching ? appr?.alphaProt : (slatsUp ? 144 : 116),
    alphaMax:      approaching ? appr?.alphaMax  : (slatsUp ? 136 : 108),
    // Characteristic speeds (FCOM DSC-22-10-50-20). APPROACH: governor (green dot → S → F → FULL).
    // DEPARTURE: **S while airborne in CONF 1+F, → green dot the moment the crew retracts at S (slatsUp)**
    // — same gate as the flap/VLS, so the config flips as ONE. V1/VR only on the ground roll.
    greenDot:      approaching ? appr?.greenDot : (slatsUp ? ENG_FIRE_DEP.greenDot : undefined),
    sSpeed:        approaching ? appr?.sSpeed   : (airborne && !slatsUp ? ENG_FIRE_DEP.sSpeed : undefined),
    fSpeed:        approaching ? appr?.fSpeed   : undefined,
    // VFE NEXT amber "=" — the max speed for the NEXT flap config; shown on the approach as the crew
    // decelerates + configures (undefined on departure/retraction and at FULL). [user 2026-07-14, audit D1]
    vfeNext:       approaching ? appr?.vfeNext  : undefined,
    // Takeoff speeds — cyan V1 "1" + VR circle, shown during the ground roll, CLEARED at liftoff
    // (airborne = fire/gear/AP). From the same governor so V1/VR live with the cleanup config. [DRAFT]
    v1:            approaching ? undefined : clean?.v1,
    vr:            approaching ? undefined : clean?.vr,
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
