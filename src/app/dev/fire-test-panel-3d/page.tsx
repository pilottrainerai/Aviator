"use client";

import { useCallback, useEffect, useState } from "react";
import { FireTestPanel3D } from "@/components/cockpit/fire-test-panel-3d";

// FIRE panel dev sandbox. TEST lights every pb; click the 3D controls to run the
// drill (press R to reset). Bottom-left: AGENT darkness. Bottom-right: PANEL
// front-face material — settings stored PER tone-map.
type Tone = "none" | "agx" | "aces";
type PanelSet = { color: string; roughness: number; metalness: number; clearcoat: number; env: number };
const AGENT_DEF = { capBlack: 40, aroundBlack: 22 }; // 0 = base grey, 100 = full black
const CAP_BASE = [70, 80, 92];      // grey the cap darkens from
const AROUND_BASE = [92, 104, 120]; // grey the surround darkens from
const toneDef = (): PanelSet => ({ color: "#ffffff", roughness: 0.6, metalness: 0.2, clearcoat: 0.0, env: 1.2 });

const rgbToHex = (a: number[]) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const blackHex = (base: number[], b: number) => rgbToHex(base.map((v) => v * (1 - b / 100)));

export default function FireTestPanel3DDevPage() {
  const [fireDetected, setFireDetected] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const reset = useCallback(() => { setFireDetected(false); setResetSignal((n) => n + 1); }, []);

  const [agent, setAgent] = useState(AGENT_DEF);
  const [tone, setTone] = useState<Tone>("none");
  const [byTone, setByTone] = useState<Record<Tone, PanelSet>>({ none: toneDef(), agx: toneDef(), aces: toneDef() });
  useEffect(() => {
    try { const a = localStorage.getItem("fireAgentBlack.v1"); if (a) setAgent({ ...AGENT_DEF, ...JSON.parse(a) }); } catch { /* ignore */ }
    try { const p = localStorage.getItem("firePanelByTone.v1"); if (p) { const o = JSON.parse(p); setByTone((b) => ({ none: { ...b.none, ...o.none }, agx: { ...b.agx, ...o.agx }, aces: { ...b.aces, ...o.aces } })); if (o.tone) setTone(o.tone); } } catch { /* ignore */ }
  }, []);
  const setAgentVal = (k: "capBlack" | "aroundBlack", v: number) =>
    setAgent((a) => { const n = { ...a, [k]: v }; try { localStorage.setItem("fireAgentBlack.v1", JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const savePanel = (b: Record<Tone, PanelSet>, t: Tone) => { try { localStorage.setItem("firePanelByTone.v1", JSON.stringify({ ...b, tone: t })); } catch { /* ignore */ } };
  const setPanelVal = (k: keyof PanelSet, v: string | number) => setByTone((b) => { const n = { ...b, [tone]: { ...b[tone], [k]: v } }; savePanel(n, tone); return n; });
  const cur = byTone[tone];
  const capHex = blackHex(CAP_BASE, agent.capBlack);
  const aroundHex = blackHex(AROUND_BASE, agent.aroundBlack);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "r" || e.key === "R") reset(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  const box: React.CSSProperties = { position: "fixed", bottom: 16, zIndex: 10, display: "flex", flexDirection: "column", gap: 8,
    padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.92)", border: "1px solid #2a313b", fontFamily: "monospace", fontSize: 12, color: "#cdd6e0", minWidth: 270 };
  const title: React.CSSProperties = { letterSpacing: 1, color: "#8aabbb", textTransform: "uppercase" };
  const rowS: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
  const btn: React.CSSProperties = { marginTop: 2, padding: "4px 8px", fontSize: 11, color: "#eef6ff", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" };

  const BlackSlider = ({ label, hex, k }: { label: string; hex: string; k: "capBlack" | "aroundBlack" }) => (
    <label style={rowS}>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: hex, border: "1px solid #3a434f" }} />
      <span style={{ width: 96 }}>{label}</span>
      <input type="range" min={0} max={100} step={1} value={agent[k]} onChange={(e) => setAgentVal(k, Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ color: "#7c8696", width: 28, textAlign: "right" }}>{agent[k]}</span>
    </label>
  );
  const Slider = ({ label, k, min, max, step }: { label: string; k: keyof PanelSet; min: number; max: number; step: number }) => (
    <label style={rowS}><span style={{ width: 78 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={cur[k] as number} onChange={(e) => setPanelVal(k, Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ color: "#7c8696", width: 34, textAlign: "right" }}>{Number(cur[k]).toFixed(2)}</span></label>
  );

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <FireTestPanel3D fireDetected={fireDetected} resetSignal={resetSignal}
        agentCapColor={capHex} agentAsmColor={aroundHex}
        panelRoughness={cur.roughness} panelMetalness={cur.metalness}
        panelClearcoat={cur.clearcoat} envIntensity={cur.env} toneMapping={tone} />

      <button type="button" onClick={() => (fireDetected ? reset() : setFireDetected(true))}
        style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", padding: "14px 28px", fontSize: 18, fontWeight: 700, letterSpacing: 1,
          color: "#eef6ff", background: fireDetected ? "#555c66" : "#c62828", border: "2px solid #ff8a80", borderRadius: 10, cursor: "pointer", boxShadow: "0 4px 18px rgba(0,0,0,0.5)", zIndex: 10 }}>
        {fireDetected ? "↺ RESET" : "🔥 TEST — trigger FIRE"}
      </button>

      {/* AGENT darkness — more black on the cap + surround */}
      <div style={{ ...box, left: 16 }}>
        <div style={title}>agent — black amount</div>
        <BlackSlider label="Button (cap)" hex={capHex} k="capBlack" />
        <BlackSlider label="Around it" hex={aroundHex} k="aroundBlack" />
        <button type="button" style={btn} onClick={() => { setAgent(AGENT_DEF); try { localStorage.setItem("fireAgentBlack.v1", JSON.stringify(AGENT_DEF)); } catch { /* ignore */ } }}>Reset agent</button>
      </div>

      {/* PANEL front-face material — per tone-map */}
      <div style={{ ...box, right: 16 }}>
        <div style={{ ...rowS, justifyContent: "space-between" }}>
          <span style={title}>panel · front face</span>
          <select value={tone} onChange={(e) => { const t = e.target.value as Tone; setTone(t); savePanel(byTone, t); }}
            style={{ background: "#161b22", color: "#cdd6e0", border: "1px solid #3a434f", borderRadius: 4, padding: "2px 4px" }}>
            <option value="none">None</option><option value="agx">AgX</option><option value="aces">ACES</option>
          </select>
        </div>
        <Slider label="Roughness" k="roughness" min={0} max={1} step={0.02} />
        <Slider label="Metalness" k="metalness" min={0} max={3} step={0.02} />
        <Slider label="Clearcoat" k="clearcoat" min={0} max={1} step={0.02} />
        <Slider label="Reflections" k="env" min={0} max={6} step={0.05} />
        <span style={{ color: "#7c8696", fontSize: 10 }}>saved per tone-map ({tone})</span>
        <button type="button" style={btn} onClick={() => { const n = { ...byTone, [tone]: toneDef() }; setByTone(n); savePanel(n, tone); }}>Reset {tone}</button>
      </div>
    </main>
  );
}
