"use client";

// EVAC panel dev sandbox — free orbit + per-part edit panel so each element
// (panel / buttons / metal / shaft / indicator / decals) can be tuned and SEEN.
// Persists to localStorage. Render-first: interaction wired in a later pass.
import { useEffect, useState } from "react";
import { EvacPanel3D, EVAC_TUNE_DEFAULT, type EvacTune, type EvacBtnPos } from "@/components/cockpit/evac-3d";

const KEY = "evacTune.v6";

export default function EvacPanel3DDevPage() {
  const [tune, setTune] = useState<EvacTune>(EVAC_TUNE_DEFAULT);
  const [active, setActive] = useState(false); // EVAC COMMAND pressed → alert active (EVAC flashes red, ON white)
  const [hornSignal, setHornSignal] = useState(0); // increments per HORN SHUT OFF press → momentary dip
  const [btnPos, setBtnPos] = useState<EvacBtnPos>("auto"); // BUTTON EDIT preview ("auto" = live)
  const [collapsed, setCollapsed] = useState(false); // edit panel collapse/close toggle
  // Play a preview press: dip to IN, then settle at STAYS (returns to AUTO/live after).
  const playPress = () => { setBtnPos("in"); setTimeout(() => setBtnPos("stays"), 190); };
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) {
        const p = JSON.parse(v) as Partial<EvacTune>;
        // shallow-merge top level, but DEEP-merge nested groups so newly-added fields
        // (e.g. guard.angle / capt.angle) fall back to defaults instead of undefined.
        setTune({
          ...EVAC_TUNE_DEFAULT, ...p,
          panel: { ...EVAC_TUNE_DEFAULT.panel, ...(p.panel ?? {}) },
          metal: { ...EVAC_TUNE_DEFAULT.metal, ...(p.metal ?? {}) },
          shaft: { ...EVAC_TUNE_DEFAULT.shaft, ...(p.shaft ?? {}) },
          guard: { ...EVAC_TUNE_DEFAULT.guard, ...(p.guard ?? {}) },
          capt: { ...EVAC_TUNE_DEFAULT.capt, ...(p.capt ?? {}) },
          btn: { ...EVAC_TUNE_DEFAULT.btn, ...(p.btn ?? {}) },
          emissive: { ...EVAC_TUNE_DEFAULT.emissive, ...(p.emissive ?? {}) },
        });
      }
    } catch { /* ignore */ }
  }, []);
  const save = (t: EvacTune) => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignore */ } return t; };
  const set = (grp: keyof EvacTune, key: string | null, v: number | string) =>
    setTune((t) => save(key == null ? { ...t, [grp]: v } as EvacTune : { ...t, [grp]: { ...(t[grp] as object), [key]: v } }));

  const box: React.CSSProperties = { position: "fixed", top: 16, left: 16, zIndex: 10, width: 282, maxHeight: "92vh", overflowX: "hidden", overflowY: "auto",
    display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.94)",
    border: "1px solid #2a313b", fontFamily: "monospace", fontSize: 12, color: "#cdd6e0" };
  const hdr: React.CSSProperties = { letterSpacing: 1, color: "#8aabbb", textTransform: "uppercase", marginTop: 8, fontSize: 11 };
  const rowS: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
  const numS: React.CSSProperties = { width: 70, flex: "0 0 auto", background: "#161b22", color: "#eef6ff", border: "1px solid #3a434f", borderRadius: 4, padding: "2px 4px", fontFamily: "monospace", fontSize: 11, textAlign: "right" };
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

  const num = (label: string, grp: keyof EvacTune, key: string | null, min: number, max: number, step: number) => {
    const cur = key ? (tune[grp] as unknown as Record<string, number>)[key] : (tune[grp] as unknown as number);
    return (
      <label key={`${grp}.${key ?? "v"}`} style={rowS}>
        <span style={{ width: 72 }}>{label}</span>
        <input type="range" min={min} max={max} step={step} value={cur} onChange={(e) => set(grp, key, Number(e.target.value))} style={{ flex: 1 }} />
        <input type="number" min={min} max={max} step={step} value={cur} onChange={(e) => set(grp, key, clamp(Number(e.target.value), min, max))} style={numS} />
      </label>
    );
  };
  const color = (label: string, grp: keyof EvacTune, key: string | null, val: string) => (
    <label key={`${grp}.${key ?? "col"}`} style={rowS}>
      <span style={{ width: 72 }}>{label}</span>
      <input type="color" value={val} onChange={(e) => set(grp, key, e.target.value)} style={{ flex: 1, height: 22, background: "transparent", border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0 }} />
    </label>
  );

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <EvacPanel3D tune={tune} active={active} hornSignal={hornSignal} btnPos={btnPos}
        onCommand={() => setActive((a) => !a)}
        onHorn={() => setHornSignal((n) => n + 1)}
        onCapt={() => setTune((t) => save({ ...t, capt: { ...t.capt, angle: (t.capt.angle ?? 19) > -10 ? -40 : 19 } }))}
      />

      {/* Pushbutton tests — COMMAND latches the alert; HORN SHUT OFF is momentary */}
      <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 11, display: "flex", gap: 10 }}>
        <button type="button" onClick={() => setActive((a) => !a)}
          style={{ padding: "10px 18px", fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1, borderRadius: 8, cursor: "pointer",
            border: "1px solid #3a434f", color: active ? "#fff" : "#cdd6e0", background: active ? "#c21807" : "#2a313b" }}>
          {active ? "● EVAC ALERT ACTIVE — press to stop" : "EVAC COMMAND — press to activate"}
        </button>
        <button type="button" onClick={() => setHornSignal((n) => n + 1)}
          style={{ padding: "10px 18px", fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1, borderRadius: 8, cursor: "pointer",
            border: "1px solid #3a434f", color: "#cdd6e0", background: "#2a313b" }}>
          HORN SHUT OFF — press
        </button>
      </div>

      <div style={box}>
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", letterSpacing: 1, color: "#dfe6f0", fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: 12, padding: 0 }}>
          <span>EVAC · PANEL + BUTTON EDIT</span>
          <span style={{ color: "#8aabbb" }}>{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed && <>

        <div style={hdr}>PANEL (FACE) — matched to base_hyd_no1</div>
        {color("Colour", "panel", "color", tune.panel.color ?? "#456a93")}
        {num("Roughness", "panel", "roughness", 0, 1, 0.02)}
        {num("Metalness", "panel", "metalness", 0, 3, 0.02)}
        {num("Clearcoat", "panel", "clearcoat", 0, 1, 0.02)}
        {num("Reflections", "panel", "env", 0, 6, 0.05)}
        {num("Sheen top", "panel", "sheenT", 0.1, 2.5, 0.05)}
        {num("Sheen bot", "panel", "sheenB", 0.1, 2.5, 0.05)}
        {num("Sheen left", "panel", "sheenL", 0.1, 2.5, 0.05)}
        {num("Sheen right", "panel", "sheenR", 0.1, 2.5, 0.05)}

        <button type="button" onClick={playPress}
          style={{ marginTop: 4, padding: "8px 8px", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#05070a", background: "#8aabbb", border: "1px solid #3a434f", borderRadius: 6, cursor: "pointer", fontFamily: "monospace" }}>
          ▶ PRESS  (neutral → in → stays)
        </button>

        <div style={hdr}>PREVIEW POSITION (auto = live)</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["auto", "neutral", "in", "stays"] as EvacBtnPos[]).map((p) => (
            <button key={p} type="button" onClick={() => setBtnPos(p)}
              style={{ flex: 1, padding: "6px 4px", fontSize: 10, fontWeight: 700, borderRadius: 5, cursor: "pointer", border: "1px solid #3a434f",
                fontFamily: "monospace", color: btnPos === p ? "#05070a" : "#cdd6e0", background: btnPos === p ? "#8aabbb" : "#2a313b" }}>
              {p === "stays" ? "STAYS" : p.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={hdr}>ABSOLUTE CAP POSITIONS (border stays fixed)</div>
        {num("Neutral", "btn", "neutralY", -0.09, 0.09, 0.001)}
        {num("In", "btn", "inY", -0.09, 0.09, 0.001)}
        {num("Stays", "btn", "staysY", -0.09, 0.09, 0.001)}

        <div style={hdr}>BUTTON COLOURS (matched to HYD: cap #05070a / border #15171e)</div>
        {color("Cap", "btn", "capColor", tune.btn.capColor)}
        {color("Border", "btn", "borderColor", tune.btn.borderColor)}
        <div style={{ fontSize: 10, color: "#6b7480", lineHeight: 1.4, marginTop: 4 }}>
          COMMAND latches to STAYS while active; HORN SHUT OFF dips to IN and returns to NEUTRAL.
        </div>

        <div style={hdr}>Metal (bezels / rings)</div>
        {color("Color", "metal", "color", tune.metal.color)}
        {num("Roughness", "metal", "roughness", 0, 1, 0.02)}
        {num("Metalness", "metal", "metalness", 0, 1, 0.02)}
        {num("Reflections", "metal", "env", 0, 4, 0.05)}

        <div style={hdr}>Buttons (black)</div>
        {num("Blackness", "buttonBlack", null, 0, 100, 1)}

        <div style={hdr}>COMMAND guard ↕ (hinges on rod)</div>
        {num("Angle", "guard", "angle", -90, 90, 1)}
        <div style={{ fontSize: 10, color: "#6b7480", lineHeight: 1.35, marginTop: 2 }}>
          Swings about the rod. Dial to CLOSED (flat over button) for rest; note the OPEN angle too.
        </div>

        <div style={hdr}>CAPT selector ↕ (tilts up/down)</div>
        {num("Angle", "capt", "angle", -60, 60, 1)}
        <div style={{ fontSize: 10, color: "#6b7480", lineHeight: 1.35, marginTop: 2 }}>
          Tilts about its base. CAPT (down) = 19, CAPT &amp; PURS (up) = −40.
        </div>

        <div style={hdr}>Guard hinge rod (Material)</div>
        {color("Color", "shaft", "color", tune.shaft.color)}
        {num("Roughness", "shaft", "roughness", 0, 1, 0.02)}
        {num("Metalness", "shaft", "metalness", 0, 1, 0.02)}

        <div style={{ fontSize: 10, color: "#6b7480", lineHeight: 1.4, marginTop: 8 }}>
          EVAC / ON lights: use the red <b>EVAC COMMAND</b> button (bottom) to test the alert.
        </div>

        <div style={hdr}>Decals (markings)</div>
        {color("Color", "decalColor", null, tune.decalColor)}

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button type="button" onClick={() => { const j = JSON.stringify(tune, null, 2); navigator.clipboard?.writeText(j).catch(() => {}); window.prompt("Tune JSON — copy this and paste it to Claude to bake as the base:", j); }}
            style={{ flex: 1, padding: "5px 8px", fontSize: 11, color: "#05070a", background: "#7ad9a5", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer", fontWeight: 700 }}>
            Copy tune JSON
          </button>
          <button type="button" onClick={() => setTune(save(EVAC_TUNE_DEFAULT))}
            style={{ flex: 1, padding: "5px 8px", fontSize: 11, color: "#eef6ff", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>
            Reset all
          </button>
        </div>
        </>}
      </div>
    </main>
  );
}
