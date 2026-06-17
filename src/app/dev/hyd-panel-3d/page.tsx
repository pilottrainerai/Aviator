"use client";

// HYD panel dev sandbox — free orbit + EDIT BAR to dial the button press positions
// (NEUTRAL / IN / OUT) and cross-check the cap colour against the live fire panel.
import { useEffect, useState } from "react";
import { HydPanel3D, HYD_TUNE_DEFAULT, type HydTune, type HydPos } from "@/components/cockpit/hyd-panel-3d";

const KEY = "hydTune.v14"; // bump on every default change to discard stale saved tunes so new defaults load without a manual Reset

export default function HydPanel3DDevPage() {
  const [tune, setTune] = useState<HydTune>(HYD_TUNE_DEFAULT);
  const [pos, setPos] = useState<HydPos>("neutral");
  const [collapsed, setCollapsed] = useState(false); // dev edit bar collapse toggle
  const [latched, setLatched] = useState(false); // false = rests at neutral, true = rests at out
  // Play the real press: dip to IN momentarily, then settle at the toggled resting state.
  const press = () => {
    setPos("in");
    const settle = latched ? "neutral" : "out";
    setLatched((v) => !v);
    setTimeout(() => setPos(settle as HydPos), 190);
  };
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v) setTune({ ...HYD_TUNE_DEFAULT, ...JSON.parse(v) }); } catch { /* ignore */ } }, []);
  const set = (k: keyof HydTune, v: number | string) => setTune((t) => { const n = { ...t, [k]: v }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; });

  const rowS: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
  const numS: React.CSSProperties = { width: 78, background: "#161b22", color: "#eef6ff", border: "1px solid #3a434f", borderRadius: 4, padding: "2px 6px", fontFamily: "monospace", fontSize: 11, textAlign: "right" };
  // editing a position slider auto-previews that position so the cap moves live
  const posForKey: Partial<Record<keyof HydTune, HydPos>> = { neutralY: "neutral", inY: "in", outY: "out" };
  const setPos2 = (k: keyof HydTune, v: number) => { const p = posForKey[k]; if (p) setPos(p); set(k, v); };
  const num = (label: string, k: keyof HydTune, min: number, max: number, step: number) => (
    <label key={k} style={rowS}>
      <span style={{ width: 86 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={tune[k] as number} onChange={(e) => setPos2(k, Number(e.target.value))} style={{ flex: 1 }} />
      <input type="number" min={min} max={max} step={step} value={tune[k] as number} onChange={(e) => setPos2(k, Number(e.target.value))} style={numS} />
    </label>
  );
  const posBtn = (p: HydPos, label: string): React.CSSProperties => ({
    flex: 1, padding: "6px 8px", fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: "pointer", border: "1px solid #3a434f",
    fontFamily: "monospace", color: pos === p ? "#05070a" : "#cdd6e0", background: pos === p ? "#8aabbb" : "#2a313b",
  });

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <HydPanel3D tune={tune} pos={pos} />

      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10, width: 270, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.95)", border: "1px solid #2a313b",
        fontFamily: "monospace", fontSize: 12, color: "#cdd6e0" }}>
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", letterSpacing: 1, color: "#dfe6f0", fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: 12, padding: 0 }}>
          <span>HYD · PANEL + BUTTON EDIT</span>
          <span style={{ color: "#8aabbb" }}>{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed && <>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>PANEL (FACE) — fire hue + faked sheen</div>
        <label style={rowS}>
          <span style={{ width: 86 }}>Colour</span>
          <input type="color" value={tune.panelColor} onChange={(e) => set("panelColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
        </label>
        {num("Roughness", "panelRough", 0, 1, 0.02)}
        {num("Metalness", "panelMetal", 0, 3, 0.02)}
        {num("Clearcoat", "panelClear", 0, 1, 0.02)}
        {num("Reflections", "panelEnv", 0, 6, 0.05)}
        {num("Sheen top", "sheenTop", 0.5, 2.5, 0.05)}
        {num("Sheen bot", "sheenBot", 0.1, 1.5, 0.05)}

        <button type="button" onClick={press}
          style={{ marginTop: 4, padding: "8px 8px", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#05070a", background: "#8aabbb", border: "1px solid #3a434f", borderRadius: 6, cursor: "pointer", fontFamily: "monospace" }}>
          ▶ PRESS  (neutral → in → stays)
        </button>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>PREVIEW POSITION</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={posBtn("neutral", "NEUTRAL")} onClick={() => setPos("neutral")}>NEUTRAL</button>
          <button type="button" style={posBtn("in", "IN")} onClick={() => setPos("in")}>IN</button>
          <button type="button" style={posBtn("out", "OUT")} onClick={() => setPos("out")}>STAYS</button>
        </div>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>ABSOLUTE CAP POSITIONS (border stays fixed)</div>
        {num("Neutral", "neutralY", -0.05, 0.05, 0.001)}
        {num("In", "inY", -0.05, 0.05, 0.001)}
        {num("Stays", "outY", -0.05, 0.05, 0.001)}
        <div style={{ marginTop: 4, padding: "4px 6px", borderRadius: 4, background: "#161b22", color: "#9fe6c0", fontSize: 11 }}>
          N {(tune.neutralY as number).toFixed(3)}  ·  I {(tune.inY as number).toFixed(3)}  ·  S {(tune.outY as number).toFixed(3)}
        </div>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>BUTTON COLOURS (live fire: cap #070a0e / border #222730)</div>
        <label style={rowS}>
          <span style={{ width: 86 }}>Cap</span>
          <input type="color" value={tune.capColor} onChange={(e) => set("capColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
        </label>
        <label style={rowS}>
          <span style={{ width: 86 }}>Border / frame</span>
          <input type="color" value={tune.borderColor} onChange={(e) => set("borderColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
        </label>
        <label style={rowS}>
          <span style={{ width: 86 }}>RAT switch</span>
          <input type="color" value={tune.ratColor} onChange={(e) => set("ratColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
        </label>

        <button type="button" onClick={() => { setTune(HYD_TUNE_DEFAULT); try { localStorage.setItem(KEY, JSON.stringify(HYD_TUNE_DEFAULT)); } catch { /* ignore */ } }}
          style={{ marginTop: 10, padding: "5px 8px", fontSize: 11, color: "#eef6ff", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>Reset</button>
        </>}
      </div>
    </main>
  );
}
