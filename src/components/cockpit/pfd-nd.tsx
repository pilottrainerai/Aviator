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

export function buildAircraftState(s?: ScenarioState, scenario?: Scenario, elapsedMs?: number): AircraftState {
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
    const onIls           = step("configure_for_approach"); // established on ILS → SPEED · LOC · G/S
    const gearDown        = step("lgr_gravity");            // L/G gravity extended → DIRECT LAW

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

    if (gearDown) {
      // Final, gear down — DIRECT LAW (FCOM: at L/G DN), VAPP = VREF+25 (~160 kt, STATUS)
      thrMode = "SPEED"; vertMode = "G/S"; latMode = "LOC"; apOn = false;
      speed = 160; altitude = 1_500; vs = -700; pitch = 1; tas = 165; vmax = 230; law = 'DIRECT';
    } else if (onIls) {
      // Hand-flown ILS RWY 27 — AP INOP, FD + A/THR (still ALTERNATE LAW until gear down)
      thrMode = "SPEED"; vertMode = "G/S"; latMode = "LOC"; apOn = false;
      speed = 180; altitude = 3_000; vs = -700; pitch = 1; tas = 189; vmax = 230; law = 'ALTN';
    } else if (cleared10000) {
      // Passing FL220 ATC cleared continued descent to 10 000 ft → the aircraft
      // continues down (FCU selected alt = 10 000). From 10 000 ft the FMA is
      // OPEN DES · NAV (rejoining the approach track), ALTERNATE LAW.
      thrMode = "SPEED"; vertMode = "OP DES"; latMode = "NAV"; apOn = false;
      speed = 290; altitude = 10_000; vs = -3_000; pitch = -3; tas = 320; vmax = 330; law = 'ALTN';
    } else if (startDescent) {
      // DESCENT card (after MAYDAY) → descending to FL200 @ 3000 fpm on the 2 NM right
      // offset; holds FL200 through ECAM / STATUS / planning. FMA: A/THR SPEED · OP DES · HDG.
      thrMode = "SPEED"; vertMode = "OP DES"; latMode = "HDG"; apOn = false;
      speed = 290; altitude = 20_000; vs = -3_000; pitch = -3; tas = 360; vmax = 330; law = 'ALTN';
    } else if (failed) {
      // Just after failure (CANCEL → AVIATE → NAVIGATE) — level FL350, ALTERNATE LAW.
      // SAME FMA as cruise except AP 1+2 dropped out: MACH · ALT CRZ · NAV, no AP.
      thrMode = "MACH"; vertMode = "ALT CRZ"; latMode = "NAV"; apOn = false;
      speed = 265; altitude = 35_000; vs = 0; pitch = 2; tas = 450; vmax = 330; law = 'ALTN';
    }
    // else: cruise before the failure — MACH / ALT CRZ / NAV, AP1 + A/THR (NORMAL LAW)

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
      selectedSpeed: speed,
      selectedAlt: altitude,
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
