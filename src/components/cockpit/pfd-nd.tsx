"use client";

import { useEffect, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import { defaultAircraftState, type AircraftState } from "@/avionics/core/aircraftState";

// ENG 1 FIRE after V1 — scenario-phase flight model
// Each completed step advances the aircraft to a physically accurate snapshot.
// Values match FCTM OP-020 technique and FCOM SRS/CLB performance data for VIDP ISA.
export function buildAircraftState(s?: ScenarioState): AircraftState {
  const step  = (id: string) => !!(s?.completedSteps?.[id]);
  const fired = (id: string) => !!(s?.triggersFired?.[id]);

  const fireActive  = fired("fire_warn");
  const eng1Failed  = fireActive;
  const apEngaged   = step("engage_ap_fma");
  const thrIdle     = step("thr_lever_idle");
  const mwCancelled = step("cancel_master_warn");
  const ecamDone    = step("agent1");
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

// ─── PFD Canvas ────────────────────────────────────────────────────────────────

export function PfdCanvas({ state }: { state?: ScenarioState }) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const stateRef  = useRef<AircraftState>(buildAircraftState(state));
  const cleanupRef = useRef<(() => void) | null>(null);

  // Keep stateRef in sync with React props
  useEffect(() => {
    stateRef.current = buildAircraftState(state);
  }, [state]);

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

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── ND Canvas ─────────────────────────────────────────────────────────────────

const ND_RANGE_OPTIONS = [5, 10, 20, 40] as const;

export function NdCanvas({ state }: { state?: ScenarioState }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const stateRef   = useRef<AircraftState>(buildAircraftState(state));
  const cleanupRef = useRef<(() => void) | null>(null);
  // Hold the NDRenderer instance so the range-cycle effect can poke it.
  // Typed loosely because the renderer is imported asynchronously.
  const ndRef      = useRef<{ setRange: (nm: number) => void } | null>(null);

  const [rangeIdx, setRangeIdx] = useState(1);    // default 10 NM

  useEffect(() => {
    stateRef.current = buildAircraftState(state);
  }, [state]);

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

      app.ticker.add(() => { nd.update(stateRef.current); });

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

export function PfdNd({ state }: { state?: ScenarioState }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="border border-[var(--color-border)] bg-black overflow-hidden"
           style={{ aspectRatio: "1", maxHeight: "280px" }}>
        <PfdCanvas state={state} />
      </div>
      <div className="border border-[var(--color-border)] bg-black overflow-hidden"
           style={{ aspectRatio: "1", maxHeight: "280px" }}>
        <NdCanvas state={state} />
      </div>
    </div>
  );
}
