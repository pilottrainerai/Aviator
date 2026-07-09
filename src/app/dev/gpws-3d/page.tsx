"use client";

// GPWS panel dev sandbox — free orbit + PANEL + BUTTON EDIT bar (mirrors the HYD
// panel's editor): face / sheen / cap / frame + the cap-position (neutral / in /
// stays) press model, copied EXACTLY from HYD. Persists to localStorage.
import { useEffect, useState } from "react";
import { GpwsPanel3D, GPWS_TUNE_DEFAULT, GPWS_BTN_ORDER, GPWS_BTN_LABELS, GPWS_HAS_FAULT, GPWS_ON_LABEL, type GpwsTune, type GpwsPos, type GpwsBtnKey, type GpwsLights } from "@/components/cockpit/gpws-3d";

const KEY = "gpwsTune.v11"; // bump on default changes to discard stale saved tunes

export default function GpwsPanel3DDevPage() {
  const [tune, setTune] = useState<GpwsTune>(GPWS_TUNE_DEFAULT);
  const [pos, setPos] = useState<GpwsPos>("neutral");
  const [latched, setLatched] = useState(false); // false = rests at neutral, true = rests at stays
  const [collapsed, setCollapsed] = useState(false);
  const [lights, setLights] = useState<GpwsLights>({}); // FCOM DSC-34 button legend lights
  const toggleLight = (key: GpwsBtnKey, field: "on" | "fault") => setLights((p) => ({ ...p, [key]: { ...p[key], [field]: !p[key]?.[field] } }));
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v) setTune({ ...GPWS_TUNE_DEFAULT, ...JSON.parse(v) }); } catch { /* ignore */ } }, []);
  const set = (k: keyof GpwsTune, v: number | string) => setTune((t) => { const n = { ...t, [k]: v }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; });

  // Play the real press: dip to IN momentarily, then settle at the toggled resting state.
  const press = () => {
    setPos("in");
    const settle: GpwsPos = latched ? "neutral" : "stays";
    setLatched((v) => !v);
    setTimeout(() => setPos(settle), 190);
  };
  // editing a position slider auto-previews that position so the cap moves live
  const posForKey: Partial<Record<keyof GpwsTune, GpwsPos>> = { neutralY: "neutral", inY: "in", staysY: "stays" };
  const setPos2 = (k: keyof GpwsTune, v: number) => { const p = posForKey[k]; if (p) setPos(p); set(k, v); };

  const rowS: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
  const numS: React.CSSProperties = { width: 78, background: "#161b22", color: "#eef6ff", border: "1px solid #3a434f", borderRadius: 4, padding: "2px 6px", fontFamily: "monospace", fontSize: 11, textAlign: "right" };
  const colorS: React.CSSProperties = { flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" };
  const num = (label: string, k: keyof GpwsTune, min: number, max: number, step: number, prev = false) => (
    <label key={k} style={rowS}>
      <span style={{ width: 92 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={tune[k] as number} onChange={(e) => (prev ? setPos2 : set)(k, Number(e.target.value))} style={{ flex: 1 }} />
      <input type="number" min={min} max={max} step={step} value={tune[k] as number} onChange={(e) => (prev ? setPos2 : set)(k, Number(e.target.value))} style={numS} />
    </label>
  );
  const color = (label: string, k: keyof GpwsTune) => (
    <label key={k} style={rowS}>
      <span style={{ width: 92 }}>{label}</span>
      <input type="color" value={tune[k] as string} onChange={(e) => set(k, e.target.value)} style={colorS} />
    </label>
  );
  const posBtn = (p: GpwsPos): React.CSSProperties => ({
    flex: 1, padding: "6px 8px", fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: "pointer", border: "1px solid #3a434f",
    fontFamily: "monospace", color: pos === p ? "#05070a" : "#cdd6e0", background: pos === p ? "#8aabbb" : "#2a313b",
  });

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <GpwsPanel3D tune={tune} pos={pos} lights={lights} />

      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10, width: 272, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.95)", border: "1px solid #2a313b",
        fontFamily: "monospace", fontSize: 12, color: "#cdd6e0" }}>
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", letterSpacing: 1, color: "#dfe6f0", fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: 12, padding: 0 }}>
          <span>GPWS · PANEL + BUTTON EDIT</span>
          <span style={{ color: "#8aabbb" }}>{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed && <>
          <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>PANEL (FACE) — steel-blue + faked sheen</div>
          {color("Colour", "panelColor")}
          {num("Roughness", "panelRough", 0, 1, 0.02)}
          {num("Metalness", "panelMetal", 0, 3, 0.02)}
          {num("Clearcoat", "panelClear", 0, 1, 0.02)}
          {num("Reflections", "panelEnv", 0, 6, 0.05)}

          <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 4 }}>SHEEN per edge (1.0 = neutral)</div>
          {num("Sheen top", "sheenT", 0.1, 2.5, 0.05)}
          {num("Sheen bot", "sheenB", 0.1, 2.5, 0.05)}
          {num("Sheen left", "sheenL", 0.1, 2.5, 0.05)}
          {num("Sheen right", "sheenR", 0.1, 2.5, 0.05)}

          <button type="button" onClick={press}
            style={{ marginTop: 4, padding: "8px 8px", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#05070a", background: "#8aabbb", border: "1px solid #3a434f", borderRadius: 6, cursor: "pointer", fontFamily: "monospace" }}>
            ▶ PRESS  (neutral → in → stays)
          </button>

          <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>PREVIEW POSITION</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" style={posBtn("neutral")} onClick={() => setPos("neutral")}>NEUTRAL</button>
            <button type="button" style={posBtn("in")} onClick={() => setPos("in")}>IN</button>
            <button type="button" style={posBtn("stays")} onClick={() => setPos("stays")}>STAYS</button>
          </div>

          <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>ABSOLUTE CAP POSITIONS (frame stays fixed)</div>
          {num("Neutral", "neutralY", -0.06, 0.06, 0.001, true)}
          {num("In", "inY", -0.06, 0.06, 0.001, true)}
          {num("Stays", "staysY", -0.06, 0.06, 0.001, true)}
          <div style={{ marginTop: 4, padding: "4px 6px", borderRadius: 4, background: "#161b22", color: "#9fe6c0", fontSize: 11 }}>
            N {tune.neutralY.toFixed(3)}  ·  I {tune.inY.toFixed(3)}  ·  S {tune.staysY.toFixed(3)}
          </div>

          <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>BUTTONS · GPWS TEST (cap = canvas black · frame/housing = metal)</div>
          {color("Cap", "capColor")}
          {color("Frame", "frameColor")}
          {color("Housing", "housingColor")}
          <div style={{ color: "#7d8794", fontSize: 9, lineHeight: 1.3, margin: "2px 0" }}>darker colour = blacker edges · Rough ↓ = crisper edges · Refl = glint brightness / warm-brown amount</div>
          {num("Metalness", "frameMetal", 0, 1, 0.02)}
          {num("Roughness", "frameRough", 0, 1, 0.02)}
          {num("Reflections", "frameEnv", 0, 4, 0.05)}

          <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 8 }}>GPWS LIGHTS — FCOM DSC-34 (OFF white · LDG FLAP 3 ON blue · SYS/TERR FAULT amber)</div>
          {GPWS_BTN_ORDER.map((key) => {
            const st = lights[key] ?? {};
            const chip = (active: boolean, label: string, bg: string, fn: () => void) => (
              <button type="button" onClick={fn}
                style={{ width: 56, padding: "4px 0", fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                  color: active ? "#05070a" : "#8893a2", background: active ? bg : "#222730", border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer" }}>{label}</button>
            );
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ flex: 1, fontSize: 10 }}>{GPWS_BTN_LABELS[key]}</span>
                {GPWS_HAS_FAULT[key] && chip(!!st.fault, "FAULT", "#ff9f00", () => toggleLight(key, "fault"))}
                {chip(!!st.on, GPWS_ON_LABEL[key], "#f3f6fa", () => toggleLight(key, "on"))}
              </div>
            );
          })}
          <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>Legend DIM colour (unlit)</div>
          {color("Legend", "legendColor")}

          <button type="button" onClick={() => {
            const dump = JSON.stringify(tune, null, 2);
            console.log("[GPWS settings dump]\n" + dump);
            navigator.clipboard?.writeText(dump).catch(() => {});
          }}
            style={{ marginTop: 10, padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#05070a", background: "#8aabbb", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer", fontFamily: "monospace" }}>⧉ COPY SETTINGS JSON</button>
          <button type="button" onClick={() => { setTune(GPWS_TUNE_DEFAULT); try { localStorage.setItem(KEY, JSON.stringify(GPWS_TUNE_DEFAULT)); } catch { /* ignore */ } }}
            style={{ marginTop: 6, padding: "5px 8px", fontSize: 11, color: "#eef6ff", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>Reset</button>
        </>}
      </div>
    </main>
  );
}
