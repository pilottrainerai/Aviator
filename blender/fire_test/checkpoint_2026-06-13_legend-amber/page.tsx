"use client";

import { useCallback, useEffect, useState } from "react";
import { FireTestPanel3D } from "@/components/cockpit/fire-test-panel-3d";

// Interactive ENG1 + APU + ENG2 FIRE panel. TEST lights every FIRE pb red; then on
// ANY section run the drill by clicking the real 3D controls:
//   lift guard → push FIRE pb (SQUIB white) → AGENT 1 / AGENT 2 (DISCH amber).
// Press R to reset. The same base-case treatment drives all three sections.
export default function FireTestPanel3DDevPage() {
  const [fireDetected, setFireDetected] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [drill, setDrill] = useState<{ guardOpen: boolean[]; pbDone: boolean[]; disch: boolean[][] }>({
    guardOpen: [false, false, false], pbDone: [false, false, false], disch: [[false, false], [false], [false, false]],
  });

  const TUNING_DEFAULTS = {
    firePopOut: 0.15, agentShrink: 0.05, agentCapLight: 0, agentAsmLight: 1,
    squibColor: "#ffffff", squibLight: 6, dischColor: "#ff9f00", dischLight: 5,
  } as const;
  const [firePopOut, setFirePopOut] = useState<number>(TUNING_DEFAULTS.firePopOut);
  const [agentShrink, setAgentShrink] = useState<number>(TUNING_DEFAULTS.agentShrink);
  const [agentCapLight, setAgentCapLight] = useState<number>(TUNING_DEFAULTS.agentCapLight);
  const [agentAsmLight, setAgentAsmLight] = useState<number>(TUNING_DEFAULTS.agentAsmLight);
  const [squibColor, setSquibColor] = useState<string>(TUNING_DEFAULTS.squibColor);
  const [squibLight, setSquibLight] = useState<number>(TUNING_DEFAULTS.squibLight);
  const [dischColor, setDischColor] = useState<string>(TUNING_DEFAULTS.dischColor);
  const [dischLight, setDischLight] = useState<number>(TUNING_DEFAULTS.dischLight);

  const resetTuning = useCallback(() => {
    setFirePopOut(TUNING_DEFAULTS.firePopOut); setAgentShrink(TUNING_DEFAULTS.agentShrink);
    setAgentCapLight(TUNING_DEFAULTS.agentCapLight); setAgentAsmLight(TUNING_DEFAULTS.agentAsmLight);
    setSquibColor(TUNING_DEFAULTS.squibColor); setSquibLight(TUNING_DEFAULTS.squibLight);
    setDischColor(TUNING_DEFAULTS.dischColor); setDischLight(TUNING_DEFAULTS.dischLight);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => { setFireDetected(false); setResetSignal((n) => n + 1); }, []);
  const onState = useCallback((s: { guardOpen: boolean[]; pbDone: boolean[]; disch: boolean[][] }) => setDrill(s), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "r" || e.key === "R") reset(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  const SECTIONS = ["ENG1", "APU", "ENG2"];
  const chip = (on: boolean, label: string) => (
    <span style={{ color: on ? "#7CFC8A" : "#8a97a6" }}>{on ? "✓" : "✗"} {label}</span>
  );

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <FireTestPanel3D
        fireDetected={fireDetected}
        resetSignal={resetSignal}
        onState={onState}
        firePopOut={firePopOut}
        agentShrink={agentShrink}
        agentCapLight={agentCapLight}
        agentAsmLight={agentAsmLight}
        squibColor={squibColor}
        squibLight={squibLight}
        dischColor={dischColor}
        dischLight={dischLight}
      />

      {/* TEMP per-section status readout (top-left). Strip before final. */}
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 10, background: "rgba(8,12,18,0.92)",
        border: "1px solid #2b3a4d", borderRadius: 8, padding: "8px 12px", color: "#dfe8f2",
        font: "12px ui-monospace, monospace", display: "flex", flexDirection: "column", gap: 4 }}>
        {chip(fireDetected, "FIRE (TEST)")}
        {SECTIONS.map((sec, i) => (
          <div key={sec} style={{ display: "flex", gap: 8 }}>
            <b style={{ width: 40 }}>{sec}</b>
            {chip(drill.guardOpen[i], "guard")}
            {chip(drill.pbDone[i], "PB")}
            {drill.disch[i].map((d, j) => <span key={j}>{chip(d, `A${j + 1}`)}</span>)}
          </div>
        ))}
      </div>

      {/* TEMP tuning panel (shared across all sections). Strip before final. */}
      <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 10, background: "rgba(8,12,18,0.92)",
        border: "1px solid #2b3a4d", borderRadius: 8, padding: "12px 16px", color: "#dfe8f2",
        font: "13px ui-monospace, monospace", width: 290, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 11, opacity: 0.65 }}>Run on any section: TEST → lift guard → push FIRE pb (SQUIB) → AGENT 1/2 (DISCH). R resets.</span>
        <label>FIRE pb pop-out: <b>{firePopOut.toFixed(2)}</b>
          <input type="range" min={0} max={0.5} step={0.01} value={firePopOut} onChange={(e) => setFirePopOut(Number(e.target.value))} style={{ width: "100%" }} /></label>
        <label>AGENT cap brightness: <b>{agentCapLight}</b>
          <input type="range" min={0} max={70} step={1} value={agentCapLight} onChange={(e) => setAgentCapLight(Number(e.target.value))} style={{ width: "100%" }} /></label>
        <label>AGENT assembly brightness: <b>{agentAsmLight}</b>
          <input type="range" min={0} max={80} step={1} value={agentAsmLight} onChange={(e) => setAgentAsmLight(Number(e.target.value))} style={{ width: "100%" }} /></label>
        <label>AGENT press depth: <b>{agentShrink.toFixed(2)}</b>
          <input type="range" min={0} max={0.4} step={0.01} value={agentShrink} onChange={(e) => setAgentShrink(Number(e.target.value))} style={{ width: "100%" }} /></label>
        <hr style={{ width: "100%", borderColor: "#2b3a4d", opacity: 0.4 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>SQUIB colour
          <input type="color" value={squibColor} onChange={(e) => setSquibColor(e.target.value)} style={{ width: 40, height: 24, border: "none", background: "none", cursor: "pointer" }} />
          <code style={{ fontSize: 11, opacity: 0.7 }}>{squibColor}</code></label>
        <label>SQUIB glow: <b>{squibLight.toFixed(1)}</b>
          <input type="range" min={0} max={12} step={0.5} value={squibLight} onChange={(e) => setSquibLight(Number(e.target.value))} style={{ width: "100%" }} /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>DISCH colour
          <input type="color" value={dischColor} onChange={(e) => setDischColor(e.target.value)} style={{ width: 40, height: 24, border: "none", background: "none", cursor: "pointer" }} />
          <code style={{ fontSize: 11, opacity: 0.7 }}>{dischColor}</code></label>
        <label>DISCH glow: <b>{dischLight.toFixed(1)}</b>
          <input type="range" min={0} max={12} step={0.5} value={dischLight} onChange={(e) => setDischLight(Number(e.target.value))} style={{ width: "100%" }} /></label>
        <button type="button" onClick={resetTuning} style={{ padding: "6px 10px", background: "transparent", color: "#dfe8f2", border: "1px solid #4a5a6d", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>↺ Reset tuning</button>
      </div>

      {/* TEST trigger (stands in for the FCOM ENG FIRE TEST pb). */}
      <button type="button" onClick={() => (fireDetected ? reset() : setFireDetected(true))}
        style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", padding: "14px 28px",
          fontSize: 18, fontWeight: 700, letterSpacing: 1, color: "#eef6ff", background: fireDetected ? "#555c66" : "#c62828",
          border: "2px solid #ff8a80", borderRadius: 10, cursor: "pointer", boxShadow: "0 4px 18px rgba(0,0,0,0.5)", zIndex: 10 }}>
        {fireDetected ? "↺ RESET" : "🔥 TEST — trigger FIRE"}
      </button>
    </main>
  );
}
