"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { Scenario, ScenarioPhase } from "@/scenarios/types";
import { defaultAircraftState, type AircraftState } from "@/avionics/core/aircraftState";

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
  void scenario; void elapsedMs; // PFD is step-driven only — no timing jumps

  const step  = (id: string) => !!(s?.completedSteps?.[id]);
  const fired = (id: string) => !!(s?.triggersFired?.[id]);

  const fireActive  = fired("fire_warn");
  const eng1Failed  = fireActive;
  const apEngaged   = step("engage_ap_fma");
  const thrIdle     = step("thr_lever_idle");
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
  } else if (thrIdle) {
    // ENG 1 TL at IDLE — climbing through ~1200 ft
    speed = 168; altitude = 1200; vs = 2000; pitch = 8; bank = 0;
    gs    = 166; tas = 172;
  } else if (apEngaged) {
    // AP1 engaged, SRS active — ~700 ft
    speed = 166; altitude = 700; vs = 2100; pitch = 8; bank = 0;
    gs    = 164; tas = 170;
  } else if (fireActive) {
    // Fire warning — 400 ft AGL, gear retracting
    speed = 165; altitude = 400; vs = 2200; pitch = 9; bank = 0;
    gs    = 163; tas = 169;
  } else {
    // Pre-fire: V1 rotation — 200 ft AGL
    speed = 157; altitude = 200; vs = 1600; pitch = 10; bank = 0;
    gs    = 155; tas = 161;
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
  const mountRef  = useRef<HTMLDivElement>(null);
  const stateRef  = useRef<AircraftState>(buildAircraftState(state, scenario, elapsedMs));
  const cleanupRef = useRef<(() => void) | null>(null);

  // Track which phases the PF has already confirmed so the ring doesn't reappear.
  const [confirmedPhases, setConfirmedPhases] = useState<Set<string>>(new Set());

  // Keep stateRef in sync with React props
  useEffect(() => {
    stateRef.current = buildAircraftState(state, scenario, elapsedMs);
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

      app.ticker.add(() => { pfd.update(stateRef.current); });

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
