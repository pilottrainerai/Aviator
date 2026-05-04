"use client";

import { useEffect, useRef } from "react";
import type { ScenarioState } from "@/engine/state";
import { defaultAircraftState, type AircraftState } from "@/avionics/core/aircraftState";

// Map ScenarioState → AircraftState
function buildAircraftState(s?: ScenarioState): AircraftState {
  const fireActive  = !!(s?.triggersFired?.["fire_warn"] || s?.masterWarnActive);
  const eng1Failed  = !!(s?.triggersFired?.["fire_warn"]);
  const apEngaged   = !!(s?.completedSteps?.["engage_ap_fma"]);
  const masterWarn  = !!(s?.masterWarnActive && !s?.completedSteps?.["cancel_master_warn"]);
  const masterCaut  = !!(s?.masterCautActive && !s?.completedSteps?.["cancel_master_caut"]);

  return {
    ...defaultAircraftState,
    apEngaged,
    masterWarn,
    masterCaut,
    eng1Failed,
    eng2Failed: false,
    thrMode: fireActive ? "IDLE" : "CLB",
    vertMode: apEngaged ? "CLB" : "SRS",
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

export function NdCanvas({ state }: { state?: ScenarioState }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const stateRef   = useRef<AircraftState>(buildAircraftState(state));
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current = buildAircraftState(state);
  }, [state]);

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
      app.stage.addChild(nd);

      app.ticker.add(() => { nd.update(stateRef.current); });

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
