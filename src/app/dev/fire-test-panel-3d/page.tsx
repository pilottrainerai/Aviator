"use client";

import { useCallback, useEffect, useState } from "react";
import { FireTestPanel3D } from "@/components/cockpit/fire-test-panel-3d";

// Self-contained interactive ENG 1 FIRE panel — nothing around it. The whole
// FCOM drill is driven by clicking the real 3D controls on the panel itself:
//
//   FIRE pb (lit red on load)  →  AGENT 1  (arms 10 s after the pb)  →  AGENT 2
//
// There is no surrounding UI chrome (no status pills, no HTML control buttons,
// no labels/frame) — just the panel, full-bleed, behaving like the real thing.
// Press R to reset the drill; ?fire=0 starts with the fire not yet detected.
export default function FireTestPanel3DDevPage() {
  // Cold start: NO fire yet. The ENG 1 FIRE pb is unlit & guarded, identical to
  // ENG 2 / APU. The TEST button triggers the fire (FCOM ENG FIRE TEST PB), then
  // the drill is GUARD → FIRE pb → AGENT 1 → AGENT 2. ?fire=1 starts hot.
  const [fireDetected, setFireDetected] = useState(false);
  const [firePbDone, setFirePbDone] = useState(false);
  const [agent1Disch, setAgent1Disch] = useState(false);
  const [agent2Disch, setAgent2Disch] = useState(false);
  // DEBUG only: ?press=0..1 freezes both AGENT caps at that press depth so the
  // press effect can be screenshotted/compared. Undefined = normal behaviour.
  const [pressOverride, setPressOverride] = useState<number | undefined>(undefined);
  // DEBUG only: ?free=1 lets you click the AGENT caps to replay the spring
  // immediately, skipping the guard → FIRE gating. TEMP, for tuning.
  const [freePlay, setFreePlay] = useState(false);
  // DEBUG only: live guard angle tuning via on-screen sliders. TEMP scaffolding.
  // Guard angles, confirmed via live tuning: CLOSED 0° (matches ENG2/APU),
  // OPEN −140° (clean 140° swing).
  const guardClosedDeg = 0;
  const guardOpenDeg = -140;
  // Live tuning for the FIRE pb pop-out + AGENT button. TEMP scaffolding.
  // Single source of truth for the original values — the Reset button snaps
  // every control back to these so you always know the baseline.
  const TUNING_DEFAULTS = {
    firePopOut: 0.15, // flush (0) until pushed, then travels out to this
    fireCasingColor: "#b12e29", // the GLB's own dark-red casing
    agentShrink: 0.05, // AGENT press depth
    agentCapLight: 0, // cap = pure black
    agentAsmLight: 1, // assembly = near-black
    squibColor: "#ffffff", // FCOM: SQUIB comes on WHITE when the FIRE pb is released
    squibLight: 6, // SQUIB glow intensity
    dischColor: "#ff9f00", // FCOM: DISCH comes on AMBER (Airbus caution amber — a yellow-orange, not yellow)
    dischLight: 5, // DISCH glow intensity
  } as const;
  const [firePopOut, setFirePopOut] = useState<number>(TUNING_DEFAULTS.firePopOut);
  // Carry the FIRE pb's two screws (Cylinder024/025, ~0.19 from the button centre)
  // OUT with the button when it pops. 0.25 includes both and nothing else (the
  // assembly list is already filtered to small parts within 0.34 of the button).
  const fireAsmRadius = 0.25;
  const [fireCasingColor, setFireCasingColor] = useState<string>(TUNING_DEFAULTS.fireCasingColor);
  const [agentShrink, setAgentShrink] = useState<number>(TUNING_DEFAULTS.agentShrink);
  const [agentCapLight, setAgentCapLight] = useState<number>(TUNING_DEFAULTS.agentCapLight);
  const [agentAsmLight, setAgentAsmLight] = useState<number>(TUNING_DEFAULTS.agentAsmLight);
  const [squibColor, setSquibColor] = useState<string>(TUNING_DEFAULTS.squibColor);
  const [squibLight, setSquibLight] = useState<number>(TUNING_DEFAULTS.squibLight);
  const [dischColor, setDischColor] = useState<string>(TUNING_DEFAULTS.dischColor);
  const [dischLight, setDischLight] = useState<number>(TUNING_DEFAULTS.dischLight);
  const [playSignal, setPlaySignal] = useState(0);

  const resetTuning = useCallback(() => {
    setFirePopOut(TUNING_DEFAULTS.firePopOut);
    setFireCasingColor(TUNING_DEFAULTS.fireCasingColor);
    setAgentShrink(TUNING_DEFAULTS.agentShrink);
    setAgentCapLight(TUNING_DEFAULTS.agentCapLight);
    setAgentAsmLight(TUNING_DEFAULTS.agentAsmLight);
    setSquibColor(TUNING_DEFAULTS.squibColor);
    setSquibLight(TUNING_DEFAULTS.squibLight);
    setDischColor(TUNING_DEFAULTS.dischColor);
    setDischLight(TUNING_DEFAULTS.dischLight);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    setFireDetected(false);
    setFirePbDone(false);
    setAgent1Disch(false);
    setAgent2Disch(false);
  }, []);

  // Optional QA presets: ?fire=0&pb=1&a1=1&a2=1 jumps straight to a given step.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("fire")) setFireDetected(q.get("fire") === "1");
    if (q.has("pb")) setFirePbDone(q.get("pb") === "1");
    if (q.has("a1")) setAgent1Disch(q.get("a1") === "1");
    if (q.has("a2")) setAgent2Disch(q.get("a2") === "1");
    if (q.has("press")) setPressOverride(Number(q.get("press")));
    if (q.has("free")) setFreePlay(q.get("free") === "1");
  }, []);

  // R resets the drill — the only affordance besides the panel itself, kept off
  // the keyboard so the view stays clean ("nothing around it").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  const activeStepId =
    !firePbDone && fireDetected ? "eng1_fire_pb" :
    firePbDone && !agent1Disch ? "agent1" :
    agent1Disch && !agent2Disch ? "agent2" :
    undefined;

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "#05070a",
        overflow: "hidden",
      }}
    >
      <FireTestPanel3D
        fireDetected={fireDetected}
        firePbDone={firePbDone}
        agent1Disch={agent1Disch}
        agent2Disch={agent2Disch}
        agent2Available={true}
        activeStepId={activeStepId}
        onFireDetect={() => setFireDetected(true)}
        onPushFirePb={() => setFirePbDone(true)}
        onPushAgent1={() => setAgent1Disch(true)}
        onPushAgent2={() => setAgent2Disch(true)}
        pressOverride={pressOverride}
        freePlay={freePlay}
        guardClosedDeg={guardClosedDeg}
        guardOpenDeg={guardOpenDeg}
        firePopOut={firePopOut}
        firePopLive
        fireAsmRadius={fireAsmRadius}
        fireCasingColor={fireCasingColor}
        agentShrink={agentShrink}
        agentCapLight={agentCapLight}
        agentAsmLight={agentAsmLight}
        squibColor={squibColor}
        squibLight={squibLight}
        dischColor={dischColor}
        dischLight={dischLight}
        playSignal={playSignal}
      />

      {/* TEMP diagnostic: shows which drill steps have actually fired, so a click
          that doesn't register is obvious (stays ✗). Remove with the tuning panel. */}
      <div
        style={{
          position: "fixed", top: 16, left: 16, zIndex: 10,
          background: "rgba(8,12,18,0.92)", border: "1px solid #2b3a4d",
          borderRadius: 8, padding: "8px 12px", color: "#dfe8f2",
          font: "13px ui-monospace, monospace", display: "flex", gap: 12,
        }}
      >
        {[
          ["FIRE", fireDetected],
          ["PB", firePbDone],
          ["A1 DISCH", agent1Disch],
          ["A2 DISCH", agent2Disch],
        ].map(([label, on]) => (
          <span key={label as string} style={{ color: on ? "#7CFC8A" : "#8a97a6" }}>
            {on ? "✓" : "✗"} {label}
          </span>
        ))}
      </div>

      {/* TEMP tuning panel for the FIRE pb pop-out + AGENT button. Dial them in,
          tell me the numbers, I bake them and remove this. */}
      <div
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 10,
          background: "rgba(8,12,18,0.92)", border: "1px solid #2b3a4d",
          borderRadius: 8, padding: "12px 16px", color: "#dfe8f2",
          font: "13px ui-monospace, monospace", width: 290,
          display: "flex", flexDirection: "column", gap: 10,
        }}
      >
        <label>
          FIRE pb pop-out: <b>{firePopOut.toFixed(2)}</b>
          <input type="range" min={0} max={0.5} step={0.01} value={firePopOut}
            onChange={(e) => setFirePopOut(Number(e.target.value))} style={{ width: "100%" }} />
          <span style={{ fontSize: 11, opacity: 0.6 }}>flush until pushed; lift guard → click button → pops out to this. R resets.</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          casing colour
          <input type="color" value={fireCasingColor}
            onChange={(e) => setFireCasingColor(e.target.value)}
            style={{ width: 40, height: 24, background: "none", border: "none", cursor: "pointer" }} />
          <code style={{ fontSize: 11, opacity: 0.7 }}>{fireCasingColor}</code>
        </label>
        <hr style={{ width: "100%", borderColor: "#2b3a4d", opacity: 0.4 }} />
        <label>
          AGENT cap (button) brightness: <b>{agentCapLight}</b>
          <input type="range" min={0} max={70} step={1} value={agentCapLight}
            onChange={(e) => setAgentCapLight(Number(e.target.value))} style={{ width: "100%" }} />
          <span style={{ fontSize: 11, opacity: 0.6 }}>0 = pure black</span>
        </label>
        <label>
          AGENT assembly brightness: <b>{agentAsmLight}</b>
          <input type="range" min={0} max={80} step={1} value={agentAsmLight}
            onChange={(e) => setAgentAsmLight(Number(e.target.value))} style={{ width: "100%" }} />
          <span style={{ fontSize: 11, opacity: 0.6 }}>0 = pure black</span>
        </label>
        <label>
          AGENT press depth: <b>{agentShrink.toFixed(2)}</b>
          <input type="range" min={0} max={0.4} step={0.01} value={agentShrink}
            onChange={(e) => setAgentShrink(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
        <button type="button" onClick={() => setPlaySignal((n) => n + 1)}
          style={{ padding: "6px 10px", background: "#1f6feb", color: "#fff",
            border: "1px solid #7fb0ff", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ▶ Press AGENT 1 (preview spring)
        </button>
        <hr style={{ width: "100%", borderColor: "#2b3a4d", opacity: 0.4 }} />
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          run the test on the panel: TEST → lift guard → push FIRE pb (SQUIB lights) →
          AGENT 1 / 2 (DISCH lights). Tune the colours below while lit.
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          SQUIB colour
          <input type="color" value={squibColor}
            onChange={(e) => setSquibColor(e.target.value)}
            style={{ width: 40, height: 24, background: "none", border: "none", cursor: "pointer" }} />
          <code style={{ fontSize: 11, opacity: 0.7 }}>{squibColor}</code>
        </label>
        <label>
          SQUIB glow: <b>{squibLight.toFixed(1)}</b>
          <input type="range" min={0} max={12} step={0.5} value={squibLight}
            onChange={(e) => setSquibLight(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          DISCH colour
          <input type="color" value={dischColor}
            onChange={(e) => setDischColor(e.target.value)}
            style={{ width: 40, height: 24, background: "none", border: "none", cursor: "pointer" }} />
          <code style={{ fontSize: 11, opacity: 0.7 }}>{dischColor}</code>
        </label>
        <label>
          DISCH glow: <b>{dischLight.toFixed(1)}</b>
          <input type="range" min={0} max={12} step={0.5} value={dischLight}
            onChange={(e) => setDischLight(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
        <hr style={{ width: "100%", borderColor: "#2b3a4d", opacity: 0.4 }} />
        <button type="button" onClick={resetTuning}
          style={{ padding: "6px 10px", background: "transparent", color: "#dfe8f2",
            border: "1px solid #4a5a6d", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          ↺ Reset all to original
        </button>
        <span style={{ fontSize: 11, opacity: 0.55, textAlign: "center" }}>
          original: pop {TUNING_DEFAULTS.firePopOut} · casing {TUNING_DEFAULTS.fireCasingColor} ·
          cap {TUNING_DEFAULTS.agentCapLight} · asm {TUNING_DEFAULTS.agentAsmLight} ·
          press {TUNING_DEFAULTS.agentShrink}
        </span>
      </div>

      {/* TEMP scaffolding: on-screen TEST button = the "fire" trigger (stands in for
          the FCOM ENG FIRE TEST PB). Click it to start the fire, then run the drill
          on the panel: GUARD → FIRE pb → AGENT 1 → AGENT 2. Removed before checkpoint. */}
      <button
        type="button"
        onClick={() => (fireDetected ? reset() : setFireDetected(true))}
        style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "14px 28px",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 1,
          color: "#eef6ff",
          background: fireDetected ? "#555c66" : "#c62828",
          border: "2px solid #ff8a80",
          borderRadius: 10,
          cursor: "pointer",
          boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
          zIndex: 10,
        }}
      >
        {fireDetected ? "↺ RESET" : "🔥 TEST — trigger ENG 1 FIRE"}
      </button>
    </main>
  );
}
