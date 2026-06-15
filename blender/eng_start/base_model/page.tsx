"use client";

// ENG START panel dev sandbox — free orbit + per-part edit panel so each element
// (panel / knobs / buttons / centre / decals) can be tuned and SEEN. Persists to localStorage.
import { useEffect, useState } from "react";
import { EngStartPanel3D, ENG_TUNE_DEFAULT, type EngTune } from "@/components/cockpit/eng-start-panel-3d";

const KEY = "engStartTune.v1";

export default function EngStartPanel3DDevPage() {
  const [tune, setTune] = useState<EngTune>(ENG_TUNE_DEFAULT);
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v) setTune({ ...ENG_TUNE_DEFAULT, ...JSON.parse(v) }); } catch { /* ignore */ }
  }, []);
  const save = (t: EngTune) => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignore */ } return t; };
  // set a nested value: set("panel","roughness",v) / set("knob","color",v) / set("buttonBlack",null,v) / set("decalColor",null,v)
  const set = (grp: keyof EngTune, key: string | null, v: number | string) =>
    setTune((t) => save(key == null ? { ...t, [grp]: v } as EngTune : { ...t, [grp]: { ...(t[grp] as object), [key]: v } }));

  const box: React.CSSProperties = { position: "fixed", top: 16, right: 16, zIndex: 10, width: 248, maxHeight: "92vh", overflowY: "auto",
    display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.94)",
    border: "1px solid #2a313b", fontFamily: "monospace", fontSize: 12, color: "#cdd6e0" };
  const hdr: React.CSSProperties = { letterSpacing: 1, color: "#8aabbb", textTransform: "uppercase", marginTop: 8, fontSize: 11 };
  const rowS: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
  const numS: React.CSSProperties = { width: 48, background: "#161b22", color: "#eef6ff", border: "1px solid #3a434f", borderRadius: 4, padding: "2px 4px", fontFamily: "monospace", fontSize: 11, textAlign: "right" };
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

  // numeric slider+box row bound to tune[grp][key]
  const num = (label: string, grp: keyof EngTune, key: string | null, min: number, max: number, step: number) => {
    const cur = key ? (tune[grp] as Record<string, number>)[key] : (tune[grp] as unknown as number);
    return (
      <label key={`${grp}.${key ?? "v"}`} style={rowS}>
        <span style={{ width: 72 }}>{label}</span>
        <input type="range" min={min} max={max} step={step} value={cur} onChange={(e) => set(grp, key, Number(e.target.value))} style={{ flex: 1 }} />
        <input type="number" min={min} max={max} step={step} value={cur} onChange={(e) => set(grp, key, clamp(Number(e.target.value), min, max))} style={numS} />
      </label>
    );
  };
  const color = (label: string, grp: keyof EngTune, key: string | null, val: string) => (
    <label key={`${grp}.col`} style={rowS}>
      <span style={{ width: 72 }}>{label}</span>
      <input type="color" value={val} onChange={(e) => set(grp, key, e.target.value)} style={{ flex: 1, height: 22, background: "transparent", border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0 }} />
    </label>
  );

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <EngStartPanel3D tune={tune} />
      <div style={box}>
        <div style={{ letterSpacing: 1, color: "#dfe6f0", fontWeight: 700 }}>ENG START · PARTS</div>

        <div style={hdr}>Panel (Blue base)</div>
        {num("Roughness", "panel", "roughness", 0, 1, 0.02)}
        {num("Metalness", "panel", "metalness", 0, 3, 0.02)}
        {num("Clearcoat", "panel", "clearcoat", 0, 1, 0.02)}
        {num("Reflections", "panel", "env", 0, 6, 0.05)}

        <div style={hdr}>Knobs / MODE selector (metal)</div>
        {color("Color", "knob", "color", tune.knob.color)}
        {num("Roughness", "knob", "roughness", 0, 1, 0.02)}
        {num("Metalness", "knob", "metalness", 0, 1, 0.02)}
        {num("Reflections", "knob", "env", 0, 4, 0.05)}

        <div style={hdr}>Buttons (black)</div>
        {num("Blackness", "buttonBlack", null, 0, 100, 1)}

        <div style={hdr}>Centre piece (Material)</div>
        {color("Color", "center", "color", tune.center.color)}
        {num("Roughness", "center", "roughness", 0, 1, 0.02)}
        {num("Metalness", "center", "metalness", 0, 1, 0.02)}

        <div style={hdr}>Decals (markings)</div>
        {color("Color", "decalColor", null, tune.decalColor)}

        <button type="button" onClick={() => setTune(save(ENG_TUNE_DEFAULT))}
          style={{ marginTop: 10, padding: "5px 8px", fontSize: 11, color: "#eef6ff", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>
          Reset all
        </button>
      </div>
    </main>
  );
}
