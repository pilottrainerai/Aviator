"use client";

// THROTTLE quadrant dev sandbox — free orbit + a compact edit bar to dial the
// base-panel finish (our standard steel-blue) and the black lever/trigger/metal tones.
// RENDER-FIRST: levers are static; the detented throw is a later FCOM-driven pass.
import { useEffect, useRef, useState } from "react";
import { Throttle3D, THROTTLE_TUNE_DEFAULT, REV_LEVER_DOWN, type ThrottleTune, type RevLever, type CamInfo } from "@/components/cockpit/throttle-3d";
import { EngStartPanel3D } from "@/components/cockpit/eng-start-panel-3d";

const KEY = "throttleTune.v2"; // bump: tune reshaped (decalEnv → arch; glossy-metal lever defaults)

// Detent angles (deg) calibrated from the gate texture marks, anchored to the user's
// IDLE=0° / FULL REV=−21° (0.0386°/px): CL +20, FLX/MCT +28, TOGA +36. Forward +, reverse −.
const DETENTS: [string, number][] = [["FULL REV", -21], ["IDLE", 0], ["CL", 20], ["FLX/MCT", 28], ["TOGA", 36]];

export default function Throttle3DDevPage() {
  const [tune, setTune] = useState<ThrottleTune>(THROTTLE_TUNE_DEFAULT);
  const [collapsed, setCollapsed] = useState(false);
  const [lever1, setLever1] = useState(0); // TLV1 (ENG1) throw angle
  const [lever2, setLever2] = useState(0); // TLV2 (ENG2) throw angle
  const [linked, setLinked] = useState(true); // move both together
  const [cam, setCam] = useState<CamInfo | null>(null); // live throttle orbit-camera pose
  const [textBold, setTextBold] = useState(1); // engraved-label thickening (px) for small-size legibility
  const [textGlow, setTextGlow] = useState(0.9); // engraved-label emissive (self-lit) so labels read at any angle/glare
  const [tiltX, setTiltX] = useState(0); // pedestal pitch (deg) — turn the gate face toward the camera
  const [tiltY, setTiltY] = useState(0); // pedestal yaw (deg)
  const set1 = (v: number) => { setLever1(v); if (linked) setLever2(v); };
  const set2 = (v: number) => { setLever2(v); if (linked) setLever1(v); };

  // Reverse-LEVER pivot angle (Cube.005/011 flap): − down (normal), + up (reverse). Both together. Saved.
  const REVLKEY = "throttleRevLever.v1";
  const [revLever, setRevLever] = useState<RevLever>(REV_LEVER_DOWN);
  useEffect(() => { try { const s = localStorage.getItem(REVLKEY); if (s) setRevLever({ ...REV_LEVER_DOWN, ...JSON.parse(s) }); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(REVLKEY, JSON.stringify(revLever)); } catch {} }, [revLever]);
  // Trim-wheel controls removed 2026-07-13 (wheel paused/hidden). Resume later.

  // ── ENG START 3D panel — floating, draggable box over the throttle. User does the placing:
  // drag the header to move, drag the bottom-right corner to resize. Position persists.
  const BOXKEY = "throttleEngStartBox.v1";
  const [box, setBox] = useState({ x: 769, y: 624, w: 380, h: 320 }); // user-set: ENG START touching the throttle base [2026-07-14]
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => { try { const s = localStorage.getItem(BOXKEY); if (s) setBox((b) => ({ ...b, ...JSON.parse(s) })); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(BOXKEY, JSON.stringify(box)); } catch {} }, [box]);
  const onDragDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - box.x, dy: e.clientY - box.y };
    const move = (ev: PointerEvent) => { if (drag.current) setBox((b) => ({ ...b, x: ev.clientX - drag.current!.dx, y: ev.clientY - drag.current!.dy })); };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setTune({ ...THROTTLE_TUNE_DEFAULT, ...JSON.parse(s) }); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(tune)); } catch {} }, [tune]);

  const setGroup = <K extends keyof ThrottleTune>(grp: K, k: keyof ThrottleTune[K], v: number | string) =>
    setTune((t) => ({ ...t, [grp]: { ...(t[grp] as object), [k]: v } }));

  const rowS: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 11 };
  const numS: React.CSSProperties = { width: 52, background: "#11161d", color: "#cdd6e0", border: "1px solid #3a434f", borderRadius: 4, fontSize: 10, padding: "1px 3px", fontFamily: "monospace" };

  const num = <K extends keyof ThrottleTune>(label: string, grp: K, k: keyof ThrottleTune[K], min: number, max: number, step: number) => {
    const v = (tune[grp] as unknown as Record<string, number>)[k as string];
    return (
      <label key={`${String(grp)}.${String(k)}`} style={rowS}>
        <span style={{ width: 78 }}>{label}</span>
        <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => setGroup(grp, k, Number(e.target.value))} style={{ flex: 1 }} />
        <input type="number" min={min} max={max} step={step} value={v} onChange={(e) => setGroup(grp, k, Number(e.target.value))} style={numS} />
      </label>
    );
  };
  const colr = <K extends keyof ThrottleTune>(label: string, grp: K, k: keyof ThrottleTune[K]) => {
    const v = (tune[grp] as unknown as Record<string, string>)[k as string];
    return (
      <label key={`${String(grp)}.${String(k)}c`} style={rowS}>
        <span style={{ width: 78 }}>{label}</span>
        <input type="color" value={v} onChange={(e) => setGroup(grp, k, e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
      </label>
    );
  };
  const hdr = (t: string): React.CSSProperties => ({ color: "#8aabbb", fontSize: 10, marginTop: 6 });

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <Throttle3D tune={tune} lever1Deg={lever1} lever2Deg={lever2} showTrimWheels={true} onCamera={setCam} revLever={revLever} textBold={textBold} textGlow={textGlow} tiltX={tiltX} tiltY={tiltY} />

      {/* THROTTLE camera readout — orbit/zoom the throttle, read these to reproduce the angle. */}
      <div style={{ position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 30,
        padding: "6px 12px", borderRadius: 8, background: "rgba(10,14,20,0.94)", border: "1px solid #2a313b",
        fontFamily: "monospace", fontSize: 11, color: "#cdd6e0", whiteSpace: "nowrap" }}>
        <span style={{ color: "#8aabbb", fontWeight: 700, letterSpacing: 1 }}>THROTTLE CAM&nbsp;&nbsp;</span>
        {cam ? (
          <span style={{ color: "#ffd23f" }}>
            az {cam.az}°&nbsp; polar {cam.polar}°&nbsp; dist {cam.dist}&nbsp; target [{cam.target.join(", ")}]&nbsp; pos [{cam.pos.join(", ")}]
          </span>
        ) : <span style={{ color: "#7d8794" }}>orbit the panel to read it…</span>}
      </div>

      {/* ENG START 3D panel — drag header to place, drag corner to resize. Transparent overlay. */}
      <div style={{ position: "fixed", left: box.x, top: box.y, width: box.w, height: box.h, zIndex: 20,
        resize: "both", overflow: "hidden", border: "1px solid #2a313b", borderRadius: 8,
        background: "transparent", boxShadow: "0 6px 24px rgba(0,0,0,0.45)" }}
        onMouseUp={(e) => { const el = e.currentTarget; setBox((b) => (el.offsetWidth !== b.w || el.offsetHeight !== b.h ? { ...b, w: el.offsetWidth, h: el.offsetHeight } : b)); }}>
        <div onPointerDown={onDragDown}
          style={{ height: 22, cursor: "move", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 8px", background: "rgba(10,14,20,0.92)", borderBottom: "1px solid #2a313b",
            fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "#8aabbb", letterSpacing: 1, touchAction: "none" }}>
          <span>ENG START</span>
          <span style={{ color: "#ffd23f" }}>x{Math.round(box.x)} y{Math.round(box.y)} w{Math.round(box.w)} h{Math.round(box.h)}</span>
        </div>
        <div style={{ width: "100%", height: "calc(100% - 22px)" }}>
          <EngStartPanel3D controlled bg="transparent" />
        </div>
      </div>

      {/* LEFT — MOVEMENT. TLV1 (ENG1) and TLV2 (ENG2) move INDEPENDENTLY (Link = together). */}
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 10, width: 236, display: "flex", flexDirection: "column", gap: 8,
        padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.95)", border: "1px solid #2a313b",
        fontFamily: "monospace", fontSize: 12, color: "#cdd6e0" }}>
        <div style={{ letterSpacing: 1, color: "#dfe6f0", fontWeight: 700 }}>MOVEMENT · THRUST LEVERS</div>
        <div style={{ color: "#7d8794", fontSize: 9, lineHeight: 1.35 }}>TLV1 (ENG1) + TLV2 (ENG2). − reverse / 0 idle / + forward to TOGA.</div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#8aabbb", cursor: "pointer" }}>
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} /> Link (move both together)
        </label>
        {([["TLV1 · ENG1", lever1, set1], ["TLV2 · ENG2", lever2, set2]] as [string, number, (v: number) => void][]).map(([label, val, setter]) => (
          <div key={label} style={{ borderTop: "1px solid #222a35", paddingTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ color: "#dfe6f0", fontSize: 11, fontWeight: 700 }}>{label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {DETENTS.map(([dl, deg]) => (
                <button key={dl} type="button" onClick={() => setter(deg)}
                  style={{ flex: "1 0 30%", padding: "5px 3px", fontSize: 9, fontWeight: 700, fontFamily: "monospace",
                    color: val === deg ? "#05070a" : "#cdd6e0", background: val === deg ? "#8aabbb" : "#2a313b",
                    border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer" }}>
                  {dl}
                </button>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ width: 34 }}>Throw</span>
              <input type="range" min={-26} max={40} step={0.5} value={val} onChange={(e) => setter(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ width: 32, textAlign: "right" }}>{val.toFixed(0)}°</span>
            </label>
          </div>
        ))}
        {/* REVERSE LEVERS — pivot the Cube.005/011 flap about its hinge: − down (normal), + up (reverse). */}
        <div style={{ borderTop: "1px solid #222a35", paddingTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ color: "#dfe6f0", fontSize: 11, fontWeight: 700 }}>REVERSE LEVER · pivot</div>
          <div style={{ color: "#7d8794", fontSize: 9, lineHeight: 1.35 }}>Cube.005/011 flap on each grip. − = down (normal) · + = up (reverse). Both levers. Saved.</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 40 }}>Angle</span>
            <input type="range" min={-70} max={60} step={1} value={revLever.l1} onChange={(e) => { const v = Number(e.target.value); setRevLever({ l1: v, l2: v }); }} style={{ flex: 1 }} />
            <span style={{ width: 40, textAlign: "right", color: "#ffd23f" }}>{revLever.l1}°</span>
          </label>
        </div>
        <div style={{ color: "#7d8794", fontSize: 9, lineHeight: 1.35, marginTop: 2 }}>Pitch trim wheels: ORIGINAL wheels shown (static). Completion/spin paused.</div>
      </div>

      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10, width: 264, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 5,
        padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.95)", border: "1px solid #2a313b",
        fontFamily: "monospace", fontSize: 12, color: "#cdd6e0" }}>
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", letterSpacing: 1, color: "#dfe6f0", fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: 12, padding: 0 }}>
          <span>THROTTLE · LOOK EDIT</span>
          <span style={{ color: "#8aabbb" }}>{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed && <>
          <div style={hdr("")}>LABEL LEGIBILITY (thicken engraved text)</div>
          <label style={rowS}>
            <span style={{ width: 78 }}>Text bold</span>
            <input type="range" min={0} max={3} step={1} value={textBold} onChange={(e) => setTextBold(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ width: 52, textAlign: "right", fontFamily: "monospace", fontSize: 10 }}>{textBold === 0 ? "orig" : `+${textBold}px`}</span>
          </label>
          <label style={rowS}>
            <span style={{ width: 78 }}>Text glow</span>
            <input type="range" min={0} max={3} step={0.1} value={textGlow} onChange={(e) => setTextGlow(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ width: 52, textAlign: "right", fontFamily: "monospace", fontSize: 10 }}>{textGlow === 0 ? "off" : textGlow.toFixed(1)}</span>
          </label>
          <div style={hdr("")}>PEDESTAL TILT (turn gate toward camera)</div>
          <label style={rowS}>
            <span style={{ width: 78 }}>Tilt X (pitch)</span>
            <input type="range" min={-60} max={60} step={1} value={tiltX} onChange={(e) => setTiltX(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ width: 52, textAlign: "right", fontFamily: "monospace", fontSize: 10, color: "#ffd23f" }}>{tiltX}°</span>
          </label>
          <label style={rowS}>
            <span style={{ width: 78 }}>Tilt Y (yaw)</span>
            <input type="range" min={-60} max={60} step={1} value={tiltY} onChange={(e) => setTiltY(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ width: 52, textAlign: "right", fontFamily: "monospace", fontSize: 10, color: "#ffd23f" }}>{tiltY}°</span>
          </label>
          <div style={hdr("")}>BASE PANEL (our standard steel-blue)</div>
          {colr("Colour", "panel", "color")}
          {num("Roughness", "panel", "roughness", 0, 1, 0.02)}
          {num("Metalness", "panel", "metalness", 0, 3, 0.02)}
          {num("Clearcoat", "panel", "clearcoat", 0, 1, 0.02)}
          {num("Reflections", "panel", "env", 0, 3, 0.05)}
          <div style={hdr("")}>SHEEN per edge (1.0 = flat)</div>
          {num("Sheen top", "panel", "sheenT", 0.1, 2.5, 0.05)}
          {num("Sheen bot", "panel", "sheenB", 0.1, 2.5, 0.05)}
          {num("Sheen left", "panel", "sheenL", 0.1, 2.5, 0.05)}
          {num("Sheen right", "panel", "sheenR", 0.1, 2.5, 0.05)}

          <div style={hdr("")}>THRUST LEVERS (black)</div>
          {colr("Lever col", "lever", "color")}
          {num("Lever rough", "lever", "roughness", 0, 1, 0.02)}
          {num("Lever metal", "lever", "metalness", 0, 1, 0.02)}
          {num("Lever refl", "lever", "env", 0, 3, 0.05)}
          {colr("Trigger col", "trigger", "color")}
          {num("Trig rough", "trigger", "roughness", 0, 1, 0.02)}
          {num("Trig metal", "trigger", "metalness", 0, 1, 0.02)}

          <div style={hdr("")}>CHROME PINS</div>
          {colr("Metal col", "metal", "color")}
          {num("Metal metal", "metal", "metalness", 0, 1, 0.02)}
          {num("Metal refl", "metal", "env", 0, 3, 0.05)}

          <div style={hdr("")}>STRIPED ARCHES (crisp B/W)</div>
          {num("Arch refl", "arch", "env", 0, 1, 0.02)}
          {num("Arch rough", "arch", "roughness", 0, 1, 0.02)}

          <button type="button" onClick={() => setTune(THROTTLE_TUNE_DEFAULT)}
            style={{ marginTop: 8, padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#cdd6e0", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer", fontFamily: "monospace" }}>
            Reset defaults
          </button>
        </>}
      </div>
    </main>
  );
}
