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

export function buildAircraftState(s?: ScenarioState, scenario?: Scenario, elapsedMs?: number): AircraftState {
  const activePhase = getActiveScenarioPhase(scenario, elapsedMs);
  if (activePhase) {
    return buildAircraftStateFromPhase(activePhase, s);
  }

  const step  = (id: string) => !!(s?.completedSteps?.[id]);
  const fired = (id: string) => !!(s?.triggersFired?.[id]);

  const fireActive  = fired("fire_warn");
  const eng1Failed  = fireActive;
  const apEngaged   = step("engage_ap_fma");
  const thrIdle     = step("thr_lever_idle");
  const mwCancelled = step("cancel_master_warn");
  const ecamDone    = step("engine_secured") || fired("fire_extinguished");
  const levelOff    = step("level_off_maa");
  const accelClean  = step("accel_clean");
  const masterWarn  = !!(s?.masterWarnActive && !mwCancelled);
  const masterCaut  = !!(s?.masterCautActive && !step("cancel_master_caut"));

  // ── FMA modes ──────────────────────────────────────────────────────────────
  // Col 1 (A/THR): MAN TOGA pre-TRA; THR MCT after acceleration alt (single engine)
  const thrMode  = levelOff ? 'THR MCT' : 'MAN TOGA';
  // Col 2 (vertical): SRS from liftoff → CLB after acceleration alt
  const vertMode = levelOff ? 'CLB' : 'SRS';

  // ── Flight values per phase ────────────────────────────────────────────────
  // Phase logic: each step advances the aircraft to the next snapshot.
  // Speeds/altitudes per FCTM OP-020 ENG FIRE after V1 — VIDP, ~77t, ISA.
  let speed, altitude, vs, pitch, bank, gs, tas;

  if (accelClean) {
    // Accelerating through S/F speeds, flap retraction complete
    speed = 210; altitude = 2200; vs = 1200; pitch = 5; bank = 0;
    gs    = 208; tas = 212;
  } else if (levelOff) {
    // Minimum Acceleration Altitude ~1500ft — level off, hold speed
    speed = 185; altitude = 1500; vs = 100; pitch = 2; bank = 0;
    gs    = 183; tas = 187;
  } else if (ecamDone) {
    // ECAM actions complete, continuing climb on SRS
    speed = 172; altitude = 1100; vs = 1800; pitch = 7; bank = 0;
    gs    = 170; tas = 174;
  } else if (thrIdle) {
    // ENG 1 TL at IDLE, ENG 2 still TOGA — climbing through ~800ft
    speed = 168; altitude = 800; vs = 2000; pitch = 8; bank = 0;
    gs    = 166; tas = 170;
  } else if (apEngaged) {
    // AP1 engaged, SRS tracking V2+10 — ~600ft
    speed = 166; altitude = 600; vs = 2100; pitch = 8; bank = 0;
    gs    = 164; tas = 168;
  } else if (fireActive) {
    // Fire warning, 400ft AGL, gear retracting
    speed = 165; altitude = 400; vs = 2200; pitch = 9; bank = 0;
    gs    = 163; tas = 167;
  } else {
    // Pre-fire: just past V1, rotating — 200ft AGL
    speed = 157; altitude = 200; vs = 1600; pitch = 10; bank = 0;
    gs    = 155; tas = 159;
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
    vertMode,
    latMode:      'NAV',
    athrActive:   true,
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
  alignItems: "flex-end",
  justifyContent: "center",
  paddingBottom: "8px",
};

export function PfActionOverlay({
  label,
  hint,
  coachMs = 8_000,
  onConfirm,
}: {
  label: string;
  hint: string;
  coachMs?: number;
  onConfirm: () => void;
}) {
  const [coaching, setCoaching] = useState(false);

  useEffect(() => {
    setCoaching(false);
    const t = setTimeout(() => setCoaching(true), coachMs);
    return () => clearTimeout(t);
  }, [coachMs, label]);

  return (
    <>
      <div style={PF_RING_STYLE} onClick={onConfirm}>
        {coaching && (
          <div style={{
            background: "rgba(0,0,0,0.88)",
            border: "1px solid #00ff00",
            color: "#00ff00",
            fontSize: "11px",
            fontFamily: "monospace",
            padding: "5px 10px",
            borderRadius: "4px",
            textAlign: "center",
            maxWidth: "90%",
            lineHeight: 1.4,
          }}>
            PF ACTION: {label}
            <div style={{ color: "#aaa", fontSize: "10px", marginTop: "2px" }}>{hint}</div>
          </div>
        )}
      </div>
    </>
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

  const activePhase  = getActiveScenarioPhase(scenario, elapsedMs);
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
          hint={pfAction.hint}
          coachMs={pfAction.coachMs}
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
