"use client";

// HUB_TAG: ENG1_FIRE_PANEL_HUB_BASELINE_V1

import { useEffect, useId, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, SysSwState } from "@/scenarios/types";
import { evalSysCase, SYS_COLORS } from "@/components/cockpit/system-display";
import { EngineFireScenarioPanel } from "@/components/cockpit/engine-fire-panel-scenario";
import { FirePanel3D } from "@/components/cockpit/fire-panel-3d";
import { FireTestPanel3D } from "@/components/cockpit/fire-test-panel-3d";

// ── New (3-section) FireTestPanel3D ──────────────────────────────────────────
// PROMOTED 2026-06-15: the FINAL panel (tag fire-panel-FINAL-2026-06-15) now renders
// in production too, replacing the legacy FirePanel3D in the scenario.
const USE_NEW_FIRE_PANEL = true;
// The on-screen layout/edit tooling stays DEV-ONLY — trainees never see or trigger it.
const SHOW_LAYOUT_EDITOR = process.env.NODE_ENV !== "production";
// Dev layout editor: every action-panel element is a freely movable + scalable
// frame, positioned in viewport coords and persisted per-element in localStorage.
// Lets the whole action panel be laid out by hand (inside OR outside its column).
const DEV_BOX_PREFIX = "fireDevBox.v6.";
type DevBox = { x: number; y: number; w: number; h: number };
function readDevBox(id: string, def: DevBox): DevBox {
  if (typeof window === "undefined") return def;
  try {
    const raw = window.localStorage.getItem(DEV_BOX_PREFIX + id);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return def;
}
function writeDevBox(id: string, b: DevBox) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(DEV_BOX_PREFIX + id, JSON.stringify(b)); } catch { /* ignore */ }
}
function resetDevBoxes() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(DEV_BOX_PREFIX) || k.startsWith("fireDevContent."))
    .forEach((k) => window.localStorage.removeItem(k));
}

// Wraps ONE action-panel element. In edit mode you MOVE it by dragging the body
// (an overlay scrim) and RESIZE it from ALL FOUR edges + FOUR corners — left/right
// stretch X, top/bottom stretch Y, anchoring the opposite edge. `fill` elements
// (the 3D panel) get a real pixel canvas at the box size so stretching is crisp;
// others scale to fit. When edit mode is off the element is fully interactive
// (clickable / orbitable) with no chrome. Dev-only; production untouched.
function DevMovable({ id, label, def, fill, editMode, onBodyDrag, onBodyDragEnd, onWheel, popDelay, relative, container, children }: {
  id: string; label: string; def: DevBox; fill?: boolean; editMode: boolean;
  // When onBodyDrag is set, dragging the BODY pans content (normalized deltas) and
  // the wheel calls onWheel (zoom) — used for the 3D panel. Otherwise the body just
  // moves the frame. The move BAR always moves the frame.
  onBodyDrag?: (ndx: number, ndy: number) => void; onBodyDragEnd?: () => void; onWheel?: (e: React.WheelEvent) => void;
  // Stagger (ms) for the spring-in animation when the frame mounts (pops out).
  popDelay?: number;
  // relative: position ABSOLUTE within the parent (a nested item) instead of fixed.
  // container: a wrapper frame — no body scrim, children stay interactive so nested
  // items receive their own drags; only the bar moves it.
  relative?: boolean; container?: boolean;
  children: React.ReactNode;
}) {
  const MINW = 48, MINH = 40;
  const [box, setBox] = useState<DevBox>(def);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setBox(readDevBox(id, def)); /* hydrate once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const measuring = !fill && !nat;
  useEffect(() => {
    if (fill || nat || !measureRef.current) return;
    const r = measureRef.current.getBoundingClientRect();
    if (r.width && r.height) {
      const n = { w: Math.round(r.width), h: Math.round(r.height) };
      setNat(n);
      setBox((b) => (b.w && b.h ? b : { ...b, w: n.w, h: n.h }));
    }
  });
  const ref = useRef(box); ref.current = box;
  // Generic pointer gesture: `apply` maps the pointer delta to a new box.
  const gesture = (apply: (dx: number, dy: number, b0: DevBox) => DevBox) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    // Capture the pointer so the live 3D canvas under the scrim can't steal the drag.
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const b0 = ref.current; const ox = e.clientX, oy = e.clientY;
    const onMove = (ev: PointerEvent) => setBox(apply(ev.clientX - ox, ev.clientY - oy, b0));
    const onUp = () => { writeDevBox(id, ref.current); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const move = gesture((dx, dy, b0) => ({ ...b0, x: b0.x + dx, y: b0.y + dy }));
  const resize = (edges: { l?: boolean; r?: boolean; t?: boolean; b?: boolean }) => gesture((dx, dy, b0) => {
    let { x, y, w, h } = b0;
    if (edges.r) w = Math.max(MINW, b0.w + dx);
    if (edges.l) { const nw = Math.max(MINW, b0.w - dx); x = b0.x + (b0.w - nw); w = nw; }
    if (edges.b) h = Math.max(MINH, b0.h + dy);
    if (edges.t) { const nh = Math.max(MINH, b0.h - dy); y = b0.y + (b0.h - nh); h = nh; }
    return { x, y, w, h };
  });
  // Body-pan gesture: reports incremental normalized deltas (fraction of the box).
  const bodyPan = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    let lx = e.clientX, ly = e.clientY;
    const onMove = (ev: PointerEvent) => {
      onBodyDrag?.((ev.clientX - lx) / Math.max(1, ref.current.w), (ev.clientY - ly) / Math.max(1, ref.current.h));
      lx = ev.clientX; ly = ev.clientY;
    };
    const onUp = () => { onBodyDragEnd?.(); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  // Content pan (non-fill controls): reposition the control INSIDE its frame.
  // The control keeps its aspect (uniform scale-to-fit) and is offset by cpan.
  const CONTENT_KEY = `fireDevContent.${id}`;
  const [cpan, setCpan] = useState({ cx: 0, cy: 0 });
  useEffect(() => { if (fill) return; try { const r = window.localStorage.getItem(CONTENT_KEY); if (r) setCpan({ cx: 0, cy: 0, ...JSON.parse(r) }); } catch { /* ignore */ } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const cpanRef = useRef(cpan); cpanRef.current = cpan;
  const contentPan = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const c0 = cpanRef.current; const ox = e.clientX, oy = e.clientY;
    const onMove = (ev: PointerEvent) => setCpan({ cx: c0.cx + (ev.clientX - ox), cy: c0.cy + (ev.clientY - oy) });
    const onUp = () => { try { window.localStorage.setItem(CONTENT_KEY, JSON.stringify(cpanRef.current)); } catch { /* ignore */ } window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const fit = (!fill && nat) ? Math.min(box.w / nat.w, box.h / nat.h) : 1;
  const A = "#8aabbb", EDGE = 10, COR = 18;
  const handle = (on: React.PointerEventHandler, style: React.CSSProperties) =>
    (<div onPointerDown={on} style={{ position: "absolute", touchAction: "none", zIndex: 4, ...style }} />);
  return (
    <div style={{ position: relative ? "absolute" : "fixed", left: box.x, top: box.y, width: measuring ? "auto" : box.w, height: measuring ? "auto" : box.h, zIndex: 45,
      animation: relative ? undefined : `fire-pop-in 0.5s cubic-bezier(.2,.85,.3,1) ${popDelay ?? 0}ms both` }}>
      <div style={{ position: "relative", width: measuring ? "auto" : box.w, height: measuring ? "auto" : box.h, overflow: measuring ? "visible" : "hidden", border: editMode ? `1px dashed ${A}66` : "none" }}>
        {fill ? (
          <div style={{ position: "absolute", inset: 0, pointerEvents: (editMode && !container) ? "none" : undefined }}>{children}</div>
        ) : (
          <div ref={measureRef} style={{ position: measuring ? "static" : "absolute", top: measuring ? 0 : "50%", left: measuring ? 0 : "50%",
            display: "inline-block", pointerEvents: editMode ? "none" : undefined, transformOrigin: "center center",
            transform: measuring ? undefined : `translate(-50%, -50%) translate(${cpan.cx}px, ${cpan.cy}px) scale(${fit})` }}>
            {children}
          </div>
        )}
        {/* Edit mode chrome: a body scrim (pans the 3D model + wheel-zooms when
            onBodyDrag is set, else moves the frame) plus a move bar (always moves
            the frame). */}
        {editMode && !measuring && (
          <>
            {!container && (
            <div onPointerDown={onBodyDrag ? bodyPan : contentPan} onWheel={onWheel}
              title={onBodyDrag ? "drag = pan model · wheel = zoom" : "drag = position inside · bar = move frame"}
              style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "none", zIndex: 2, background: "transparent" }} />
            )}
            <div onPointerDown={move} title="drag to move"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 18, zIndex: 3, cursor: "move", touchAction: "none", userSelect: "none",
                display: "flex", alignItems: "center", gap: 6, padding: "0 7px", boxSizing: "border-box",
                background: "rgba(14,20,28,0.92)", borderBottom: `1px solid ${A}66`,
                fontFamily: "monospace", fontSize: 9, letterSpacing: "0.06em", color: A, whiteSpace: "nowrap" }}>
              ✥ {label} · {Math.round(box.w)}×{Math.round(box.h)}
              <span style={{ marginLeft: "auto", color: "#7c8696" }}>{onBodyDrag ? "bar=move · drag=pan · wheel=zoom" : "bar=move · drag=position inside"}</span>
            </div>
          </>
        )}
      </div>
      {/* Resize from all 4 edges + 4 corners, on the un-clipped outer frame. */}
      {editMode && !measuring && (
        <>
          {handle(resize({ l: true }),        { top: 0, left: -4, width: EDGE, height: box.h, cursor: "ew-resize" })}
          {handle(resize({ r: true }),        { top: 0, right: -4, width: EDGE, height: box.h, cursor: "ew-resize" })}
          {handle(resize({ t: true }),        { top: -4, left: 0, width: box.w, height: EDGE, cursor: "ns-resize" })}
          {handle(resize({ b: true }),        { bottom: -4, left: 0, width: box.w, height: EDGE, cursor: "ns-resize" })}
          {handle(resize({ t: true, l: true }), { top: -5, left: -5, width: COR, height: COR, cursor: "nwse-resize" })}
          {handle(resize({ t: true, r: true }), { top: -5, right: -5, width: COR, height: COR, cursor: "nesw-resize" })}
          {handle(resize({ b: true, l: true }), { bottom: -5, left: -5, width: COR, height: COR, cursor: "nesw-resize" })}
          {handle(resize({ b: true, r: true }), { bottom: -5, right: -5, width: COR, height: COR, cursor: "nwse-resize", background: `linear-gradient(135deg, transparent 42%, ${A} 42%)` })}
        </>
      )}
    </div>
  );
}

// Baked default layout for the popped-out action panel (exported from the dev
// layout editor). Used when there's no per-element localStorage override, so a
// fresh session / production shows this exact arrangement when the procedure pops.
const VIEW_DEFAULT = { x: -0.2976, y: -0.0142, zoom: 0.7032 };

// Combined action-panel layout: ONE outer frame (fixed viewport coords) holding
// the thrust levers, master, and 3D fire panel as nested items positioned
// RELATIVE to the outer. Outer moves/resizes/pops as a unit; each item nudges
// inside it. (New keys — leaves the old separate-frame layout untouched.)
const COMBO_OUTER: DevBox = { x: 380, y: 130, w: 1500, h: 392 };
const COMBO_INNER: Record<string, DevBox> = {
  panel3d:         { x: 284, y: 24, w: 1210, h: 360 },
  thr_lever_idle:  { x: 6,   y: 24, w: 150,  h: 360 },
  eng1_master_off: { x: 162, y: 24, w: 116,  h: 360 },
};

// ─── CSS keyframes (AGENT arming pulse, TEST pulse) ─────────────────────────
// Injected once via <style> in the panel root.
const FIRE_PANEL_CSS = `
@keyframes agent-arming-pulse {
  0%, 100% { background-color: rgba(255, 179, 0, 0.12); box-shadow: inset 0 0 2px rgba(255,179,0,0.30); }
  50%      { background-color: rgba(255, 179, 0, 0.55); box-shadow: 0 0 6px rgba(255,179,0,0.65); }
}
@keyframes agent-arming-edge-pulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(255, 179, 0, 0.45), 0 0 4px rgba(255, 179, 0, 0.30); }
  50%      { box-shadow: 0 0 0 1.5px rgba(255, 179, 0, 0.95), 0 0 8px rgba(255, 179, 0, 0.70); }
}
@keyframes fire-light-pulse {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 1; }
}
@keyframes fire-pop-in {
  0%   { opacity: 0; transform: translateY(40px) scale(0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
`;

// FCOM "AGENT 1 AFTER 10 S → DISCH" arming delay
const AGENT_ARM_DELAY_MS = 10_000;

// ─── FCOM ECAM color palette ─────────────────────────────────────────────────
// Source: Airbus FCOM DSC-31-60 "ECAM display" color spec
const C = {
  red:    "#FF3333",
  amber:  "#FFB300",
  green:  "#00D060",
  white:  "#E8ECF4",
  cyan:   "#00CFFF",
  dim:    "#6A7488",
  dimLo:  "#3A4252",
  bg:     "#000000",
  bezel:  "#1E2430",
  btnFace:"#0E1118",
  panel:  "#080C12",
  ledOff: "#060A0E",
} as const;

// ─── Phillips-head panel screw ────────────────────────────────────────────────
// 5 × 5 px corner screw matching the FCOM photo trim.  Two-tone radial
// gradient (#B8C0C8 → #4A5260) with a faint cross slot at ~30°.
function PanelScrew({
  top, left, right, bottom,
}: { top?: number; left?: number; right?: number; bottom?: number }) {
  return (
    <div style={{
      position: "absolute",
      width: "5px", height: "5px",
      top, left, right, bottom,
      borderRadius: "50%",
      background: "radial-gradient(circle at 32% 32%, #C4CCD4 0%, #6A7280 60%, #2A303C 100%)",
      boxShadow: "0 1px 1px rgba(0,0,0,0.5), inset 0 -0.5px 0.5px rgba(0,0,0,0.45)",
      zIndex: 5,
    }}>
      {/* Phillips cross slot — two tiny dark lines crossed at ~30° */}
      <div style={{
        position: "absolute", top: "2px", left: "0.5px",
        width: "4px", height: "1px",
        background: "rgba(20,24,32,0.85)",
        transform: "rotate(30deg)",
        transformOrigin: "50% 50%",
      }} />
      <div style={{
        position: "absolute", top: "0.5px", left: "2px",
        width: "1px", height: "4px",
        background: "rgba(20,24,32,0.85)",
        transform: "rotate(30deg)",
        transformOrigin: "50% 50%",
      }} />
    </div>
  );
}

// ─── DSL switch state rendering ───────────────────────────────────────────────
const DSL_SW_COLORS: Record<SysSwState, string> = {
  norm:  C.green,
  fault: C.amber,
  off:   C.dimLo,
  auto:  C.green,
  open:  C.amber,
  fire:  C.red,
  armed: C.cyan,
};
const DSL_SW_LABELS: Record<SysSwState, string> = {
  norm:  "NORM",
  fault: "FAULT",
  off:   "OFF",
  auto:  "AUTO",
  open:  "OPEN",
  fire:  "FIRE",
  armed: "ARM",
};

// ─── SVG N1 Circular Gauge ────────────────────────────────────────────────────
// Matches A320 ECAM upper-display N1 arc layout.
// 0 % = 8 o'clock (240° from top CW), 100 % = 4 o'clock (480° = 120° from top CW)
// Total sweep = 240°

function pt(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: +(cx + r * Math.sin(rad)).toFixed(2),
    y: +(cy - r * Math.cos(rad)).toFixed(2),
  };
}

function arcD(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const s = pt(cx, cy, r, startDeg);
  const e = pt(cx, cy, r, endDeg);
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function N1Gauge({
  n1,
  label,
  color,
  size = 88,
}: {
  n1: number;
  label: string;
  color: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2 + 2;
  const r = size / 2 - 10;
  const START = 240;
  const SWEEP = 240;
  const valueAngle = START + (Math.min(100, Math.max(0, n1)) / 100) * SWEEP;
  const needle = pt(cx, cy, r - 5, valueAngle);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track ring */}
      <path
        d={arcD(cx, cy, r, START, START + SWEEP)}
        fill="none"
        stroke={C.dimLo}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Value arc */}
      {n1 > 0.5 && (
        <path
          d={arcD(cx, cy, r, START, valueAngle)}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
      {/* Red arc: warning zone 97-100% */}
      <path
        d={arcD(cx, cy, r, START + 0.97 * SWEEP, START + SWEEP)}
        fill="none"
        stroke={C.red}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Tick marks at 0, 25, 50, 75, 100 % */}
      {[0, 25, 50, 75, 100].map((pct) => {
        const a = START + (pct / 100) * SWEEP;
        const outer = pt(cx, cy, r + 4, a);
        const inner = pt(cx, cy, r - 1, a);
        return (
          <line
            key={pct}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={C.dim}
            strokeWidth="1"
          />
        );
      })}
      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needle.x}
        y2={needle.y}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="3" fill={color} />
      {/* N1 value */}
      <text
        x={cx}
        y={cy + 2}
        fontSize="15"
        fill={color}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {n1.toFixed(n1 < 1 ? 0 : 1)}
      </text>
      {/* Label */}
      <text
        x={cx}
        y={size - 3}
        fontSize="8"
        fill={C.dim}
        textAnchor="middle"
        fontFamily="monospace"
        letterSpacing="0.1em"
      >
        {label}
      </text>
    </svg>
  );
}

// ─── Parameter row (EGT / N2 / FF) ───────────────────────────────────────────

function Param({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: "36px" }}>
      <span
        style={{ fontSize: "6px", color: C.dim, letterSpacing: "0.12em", fontFamily: "monospace" }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "11px",
          color,
          fontFamily: "monospace",
          fontWeight: 700,
          lineHeight: 1.15,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: "6px", color: C.dim, fontFamily: "monospace" }}>{unit}</span>
    </div>
  );
}

// ─── Airbus overhead-panel pushbutton ─────────────────────────────────────────
// Structure mirrors real Airbus pushbutton-switch:
//   • Top section  = LED indicator (illuminated when state is active)
//   • Bottom section = label + sublabel
//   • Outer bezel = dark metal frame

type BtnState = "normal" | "active" | "done" | "armed" | "disabled";

// Map the legend text to FCOM-correct color semantics.
// FCOM DSC-26-20-20: FIRE = red, SQUIB = white, DISCH = amber.
function legendColor(text: string, fallback: string): string {
  const u = text.trim().toUpperCase();
  if (u === "FIRE") return C.red;
  if (u.startsWith("SQUIB") || u === "ARMED") return C.white;
  if (u === "DISCH") return C.amber;
  return fallback;
}

function AirbusPB({
  topText,
  topColor,
  label,
  sublabel,
  state: btnState,
  onClick,
  wide = false,
  large = false,
  legendLit = false,
}: {
  topText: string;
  topColor: string;
  label: string;
  sublabel?: string;
  state: BtnState;
  onClick?: () => void;
  wide?: boolean;
  large?: boolean;
  /** Force the top-legend cell to display lit (e.g. FIRE light red) even when
   *  the pb is otherwise disabled or in a non-actionable state.  FCOM
   *  DSC-26-20-20: "ENG 1(2) FIRE light comes on red whenever the engine fire
   *  warning for the corresponding engine is active, regardless of pushbutton
   *  position." */
  legendLit?: boolean;
}) {
  const isClickable = onClick && btnState !== "disabled" && btnState !== "done";
  const legendCol = legendColor(topText, topColor);
  const pbOut = btnState === "done";

  // FCOM DSC-26-20-20: ENG 1(2) FIRE pb is a guarded rectangular pushbutton.
  // The guard is a thin metal wireframe cage hinged at the top — visible above
  // the pb when stowed; flips up and back when the crew lifts it before the
  // push.  Pb face shows "FIRE" (red legend) + "PUSH" beneath.
  const guardLifted = large && (btnState === "active" || btnState === "armed" || btnState === "done" || legendLit);
  // Unique gradient id for the SVG wire-frame guard (avoids `defs` collisions
  // between the two FIRE pbs that render side-by-side on the panel).
  const guardId = useId().replace(/:/g, "");

  const bezelBorder =
    btnState === "active" ? legendCol :
    btnState === "armed"  ? C.white :
    btnState === "done"   ? C.amber :
    legendLit             ? legendCol :
    "#2A303C";

  // ledBg / ledTextColor: lit whenever btnState is active/armed/done OR the
  // caller explicitly says legendLit (fire-light-on-pb-not-yet-pushed case).
  // FCOM DSC-26-20-20: the WHOLE pb face lights up red when the FIRE light is
  // active — both the legend cell and the body, treated as one continuous
  // red surface.  At rest the FIRE pb keeps its baked-in orange-red body
  // (vertical gradient #C24018 → #8C2A10) with off-white "FIRE" / "PUSH"
  // text — that's the physical pb appearance under panel lighting, NOT a
  // dim-LED effect.  When the FIRE warning fires, the legend lights to
  // pure red with pure-white text + glow.
  const isFire = topText.trim().toUpperCase() === "FIRE";
  const lit = btnState === "active" || legendLit;
  const FIRE_BODY_GRADIENT = "linear-gradient(180deg, #C24018 0%, #8C2A10 100%)";
  const FIRE_LEGEND_OFFWHITE = "#FFE4D0";
  const ledBg =
    lit                    ? legendCol :                  // lit: solid red
    btnState === "armed"   ? `${C.white}28` :
    btnState === "done"    ? `${legendCol}25` :
    isFire                 ? FIRE_BODY_GRADIENT :        // baseline orange-red gradient
    C.ledOff;

  const ledTextColor =
    lit                    ? "#FFFFFF" :
    btnState === "armed"   ? C.white :
    btnState === "done"    ? legendCol :
    isFire                 ? FIRE_LEGEND_OFFWHITE :       // off-white legend on orange-red
    C.dimLo;

  // FIRE-pb-only 3-D depth: top highlight + bottom pillow shadow.  Gives the
  // physical-pushbutton look (vs the v1 flat sticker).  Layered with the
  // state-driven halo so both can apply at once.
  const fireDepthShadow = (isFire && large)
    ? "inset 0 1px 0 rgba(255, 200, 170, 0.22), inset 0 -2px 4px rgba(0, 0, 0, 0.40)"
    : null;
  const stateShadow =
    lit                    ? `0 0 14px ${legendCol}90, inset 0 0 6px ${legendCol}20` :
    btnState === "armed"   ? `0 0 10px ${C.white}50` :
    btnState === "done"    ? `0 0 8px ${legendCol}40` :
    null;
  const containerShadow = [stateShadow, fireDepthShadow].filter(Boolean).join(", ") || "none";

  return (
    <div
      style={{
        cursor: isClickable ? "pointer" : "default",
        // PLAN v3: large (FIRE pb) = 96 px wide × ~72 px tall (LANDSCAPE).
        // v2 had this backwards (82 × 96 portrait).
        width: large ? "96px" : wide ? "80px" : "68px",
        userSelect: "none",
        // FIRE pb's physical body is always bright orange-red — "disabled"
        // (not-yet-clickable) doesn't mean physically dimmer.  Skip the
        // brightness filter for isFire so the baseline gradient + the
        // bottom-corner Phillips screws stay visible at rest.
        filter: (btnState === "disabled" && !isFire) ? "brightness(0.4)" : "none",
        position: "relative",
      }}
    >
      {/* Recessed metal frame around the pb — gives the "in the panel" look. */}
      {large && (
        <>
          <div
            style={{
              position: "absolute",
              top: "-4px", left: "-4px", right: "-4px", bottom: "-4px",
              background: "linear-gradient(135deg, #5A6470 0%, #2E3440 60%, #1A1E28 100%)",
              border: "1px solid #14181F",
              borderRadius: "3px",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.10), inset 0 -1px 1px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.55)",
              zIndex: 0,
            }}
          />
          {/* Phillips-head screws at the two BOTTOM corners (top corners are
              occupied by the wire-guard hinge knuckles). */}
          <PanelScrew bottom={-3} left={-3} />
          <PanelScrew bottom={-3} right={-3} />
        </>
      )}

      {/* Wireframe metal guard — only on FIRE pb (large).  Hinged at the top of
          the pb body, lifts up and back when the pb becomes actionable.
          Drawn as a thin metal frame with two diagonal wires forming an X. */}
      {large && (
        <div style={{
          position: "absolute", top: "-2px", left: "-2px", right: "-2px",
          height: "0", perspective: "260px", zIndex: 4,
          pointerEvents: guardLifted ? "none" : "auto",
        }}>
          {/* Hinge knuckles at top corners — small metal pivots */}
          {[ "left", "right" ].map(side => (
            <div key={side} style={{
              position: "absolute", top: "-2px",
              [side]: "-1px",
              width: "5px", height: "5px",
              background: "radial-gradient(circle at 30% 30%, #B0B8C0 0%, #5A6470 50%, #1A1E28 100%)",
              borderRadius: "50%",
              border: "1px solid #14181F",
              zIndex: 6,
              boxShadow: "0 1px 1px rgba(0,0,0,0.55)",
            } as React.CSSProperties} />
          ))}
          {/* SVG wire-frame guard, hinged at top.  PLAN v3: viewBox 96 × 18
              to match the landscape pb shape; non-scaling strokes keep the
              wire weight constant. */}
          <div style={{
            position: "absolute",
            top: "0", left: "0", right: "0",
            height: "18px",
            transformOrigin: "50% 0%",
            transform: guardLifted
              ? "rotateX(-115deg) translateZ(0)"
              : "rotateX(0deg) translateZ(0)",
            transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
            backfaceVisibility: "hidden",
            filter: guardLifted
              ? "none"
              : "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
          }}>
            <svg
              viewBox="0 0 96 18"
              preserveAspectRatio="none"
              width="100%"
              height="100%"
              style={{ display: "block", overflow: "visible" }}
            >
              <defs>
                <linearGradient id={`fireGuardWire-${guardId}`} x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%"   stopColor="#4A5260"/>
                  <stop offset="50%"  stopColor="#C0C8D0"/>
                  <stop offset="100%" stopColor="#4A5260"/>
                </linearGradient>
              </defs>
              {/* Outer rectangular frame */}
              <rect
                x="1.5" y="1.5" width="93" height="15"
                fill="rgba(40,46,56,0.10)"
                stroke={`url(#fireGuardWire-${guardId})`}
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
                rx="1.5"
              />
              {/* X diagonals */}
              <line
                x1="2" y1="2" x2="94" y2="16"
                stroke={`url(#fireGuardWire-${guardId})`}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="94" y1="2" x2="2" y2="16"
                stroke={`url(#fireGuardWire-${guardId})`}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              {/* Center pivot dot where the wires cross */}
              <circle cx="48" cy="9" r="1.6" fill="#C8D0D8" opacity={guardLifted ? 0.5 : 1}/>
            </svg>
          </div>
        </div>
      )}

      {/* Outer bezel — pops up slightly when pushed (out) */}
      <div
        onClick={isClickable ? onClick : undefined}
        style={{
          backgroundColor: C.bezel,
          border: `2px solid ${bezelBorder}`,
          // PLAN v3: 6 px radius — proportional to the shorter 72 px height
          // (was 8 px on the tall portrait body).
          borderRadius: large ? "6px" : "2px",
          padding: "2px",
          boxShadow: containerShadow,
          transition: "box-shadow 0.2s, border-color 0.2s, transform 0.25s",
          transform: pbOut ? "translateY(-3px)" : "translateY(0)",
          cursor: isClickable ? "pointer" : "default",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* "OUT" indicator — small amber dot in the top-right when the pb has
            been pushed AND the fire is no longer detected.  Sim-only training
            cue so the crew can see the pb is mechanically out even when the
            FIRE light is off (kept per Build-Mode Open Question #1). */}
        {pbOut && !lit && (
          <div style={{
            position: "absolute", top: "-1px", right: "-1px",
            width: "6px", height: "6px",
            backgroundColor: C.amber, borderRadius: "50%",
            boxShadow: `0 0 4px ${C.amber}`,
            zIndex: 3,
          }} />
        )}

        {/* Four corner red FIRE indicator dots — lit independently of pb position
            per FCOM (red lights come on whenever fire warning is active). */}
        {lit && large && (
          <>
            {[
              { top: 3, left: 3 },
              { top: 3, right: 3 },
              { bottom: 3, left: 3 },
              { bottom: 3, right: 3 },
            ].map((pos, i) => (
              <div key={i}
                style={{
                  position: "absolute", ...pos,
                  width: 4, height: 4, borderRadius: "50%",
                  background: legendCol,
                  boxShadow: `0 0 5px ${legendCol}`,
                  zIndex: 2,
                }}
              />
            ))}
          </>
        )}

        {/* Top legend cell — "FIRE" (red) for the FIRE pb.  PLAN v3: legend
            cell ≈ 30 px tall (was ~40), bigger 20 px sans-serif "FIRE"
            text now that the pb is landscape-oriented. */}
        <div
          style={{
            background: ledBg,
            borderRadius: large ? "5px 5px 0 0" : "1px 1px 0 0",
            padding: large ? "5px 6px 5px" : "4px 5px",
            textAlign: "center",
            minHeight: large ? "20px" : "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <span
            style={{
              fontSize: large ? "20px" : "8px",
              fontFamily: "var(--font-cockpit)",
              fontWeight: 800,
              letterSpacing: large ? "0.04em" : "0.12em",
              color: ledTextColor,
              textTransform: "uppercase",
              textShadow: lit ? `0 0 10px ${legendCol}, 0 0 4px #fff` : btnState === "done" ? `0 0 6px ${legendCol}80` : "none",
            }}
          >
            {topText}
          </span>
        </div>

        {/* Bottom face — the engine label and "PUSH" instruction.  Shares the
            legend cell's background at all times so the WHOLE pb looks like
            one continuous surface (FCOM DSC-26-20-20: pb face is a single
            illuminated surface; dark-cockpit convention keeps the dim-red
            baseline continuous across top + bottom on the FIRE pb). */}
        <div
          style={{
            background: isFire ? ledBg : (lit ? legendCol : C.btnFace),
            borderRadius: large ? "0 0 5px 5px" : "0 0 1px 1px",
            // PLAN v3: bottom face ≈ 38 px tall (was 56).  Label + PUSH stack
            // is now ~25 px of content, centred with 6 / 7 px padding so the
            // whole pb hits ~72 px total height.
            padding: large ? "6px 6px 7px" : "5px 5px 4px",
            textAlign: "center",
            borderTop: isFire ? "none" : `1px solid ${lit ? legendCol : bezelBorder + "40"}`,
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              fontSize: large ? "11px" : "9px",
              fontFamily: "var(--font-cockpit)",
              fontWeight: 700,
              letterSpacing: large ? "0.04em" : "0.08em",
              // FIRE pb at rest: off-white label on orange-red body.
              color: lit ? "#FFFFFF" : (isFire ? FIRE_LEGEND_OFFWHITE : C.white),
              lineHeight: 1.2,
              textTransform: "uppercase",
              textShadow: lit ? "0 0 4px rgba(0,0,0,0.6)" : "none",
            }}
          >
            {label}
          </div>
          {/* "PUSH" sub-legend — appears only on large pbs (the FIRE pb) */}
          {large && (
            <div
              style={{
                fontSize: "10px",
                fontFamily: "var(--font-cockpit)",
                color: lit ? "#FFFFFF" : FIRE_LEGEND_OFFWHITE,
                fontWeight: 700,
                letterSpacing: "0.14em",
                marginTop: "4px",
                textTransform: "uppercase",
                textShadow: lit ? "0 0 4px rgba(0,0,0,0.6)" : "none",
                transition: "color 0.2s",
              }}
            >
              PUSH
            </div>
          )}
          {sublabel && !large && (
            <div
              style={{
                fontSize: "7px",
                fontFamily: "monospace",
                color: C.dim,
                letterSpacing: "0.08em",
                marginTop: "1px",
                textTransform: "uppercase",
              }}
            >
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DSL interactive control: AGENT 1 / AGENT 2 pb-sw (FCOM-accurate) ────────
// Source: FCOM DSC-26-20-20 — "FIRE PANEL"
// Shape: small rectangular pb-sw with TWO stacked indicator cells:
//   • SQUIB cell (top)  — lights white when squib is armed (after FIRE pb pushed,
//                          before agent fired)
//   • DISCH cell (bottom) — lights amber when agent has discharged
// Label below: "AGENT 1" / "AGENT 2".  No flip-up guard — bare pb on the panel.
function AgentPb({
  done, active, clickable, onClick, label, sub,
}: {
  done: boolean; active: boolean; clickable: boolean; onClick: () => void;
  label: string; sub?: string;
}) {
  // Track when this agent step first became active so we can run the FCOM
  // 10-second arming countdown ("AGENT 1 AFTER 10 S → DISCH").
  const [activeAt, setActiveAt] = useState<number | null>(null);
  useEffect(() => {
    if (active && activeAt === null) setActiveAt(Date.now());
    else if (!active && activeAt !== null) setActiveAt(null);
  }, [active, activeAt]);

  // Re-render every 100 ms during the 10-s arming window so the SQUIB pulse
  // and countdown badge stay live.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!activeAt || done) return;
    const elapsed = Date.now() - activeAt;
    if (elapsed >= AGENT_ARM_DELAY_MS) return;
    const t = setInterval(() => tick(n => n + 1), 100);
    return () => clearInterval(t);
  }, [activeAt, done]);

  const elapsed = activeAt ? Date.now() - activeAt : 0;
  const arming    = active && !done && elapsed < AGENT_ARM_DELAY_MS;
  const isArmed   = active && !done && elapsed >= AGENT_ARM_DELAY_MS;
  const isClickable = clickable && isArmed;
  const countdownSec = arming ? Math.max(0, Math.ceil((AGENT_ARM_DELAY_MS - elapsed) / 1000)) : 0;

  // FCOM DSC-26-20-20: SQUIB comes on white when the flight crew releases the
  // FIRE pb (i.e., the AGENT pb-sw becomes active). It stays white until the
  // agent is discharged. The 10-s arming countdown is procedural (waiting for
  // N1 to decay) — it does NOT delay the SQUIB white indication.
  // DISCH comes on amber when the corresponding fire bottle has lost pressure.
  const squibLit = active && !done;        // armed (white) — strict Airbus
  const dischLit = done;                   // agent fired (amber)
  const accent =
    dischLit ? C.amber :
    squibLit ? C.white :
    arming   ? `${C.amber}80` :
    C.dimLo;

  return (
    <div
      style={{
        userSelect: "none",
        // Per PLAN: AGENT pb 50 × 54 px (slightly taller than wide) — matches
        // the FCOM photo proportions; was 52 × 52.
        width: "50px",
        // Photo shows the AGENT bezel + corner screws fully visible at rest
        // (only the SQUIB / DISCH cells stay dark).  Don't fade the whole
        // pb to 0.45 — keep the trim crisp.
        opacity: (!active && !done) ? 0.85 : 1,
        transition: "opacity 0.2s",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}
    >
      <div
        onClick={isClickable ? onClick : undefined}
        style={{
          cursor: isClickable ? "pointer" : "default",
          width: "50px", height: "54px",
          position: "relative",
        }}
      >
        {/* Recessed frame around the pb */}
        <div style={{
          position: "absolute",
          top: "-3px", left: "-3px", right: "-3px", bottom: "-3px",
          background: "linear-gradient(135deg, #5A6470 0%, #2E3440 60%, #1A1E28 100%)",
          border: "1px solid #14181F",
          borderRadius: "2px",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.10), inset 0 -1px 1px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.55)",
          zIndex: 0,
        }} />
        {/* Phillips-head screws at all four corners. */}
        <PanelScrew top={-2}    left={-2} />
        <PanelScrew top={-2}    right={-2} />
        <PanelScrew bottom={-2} left={-2} />
        <PanelScrew bottom={-2} right={-2} />

        {/* AGENT pb body — rounded rectangle (~4 px) with a recessed inner
            shadow so the SQUIB / DISCH cells sit INSIDE the bezel rather
            than floating on top.  Outer boundary glows by state:
              - arming (10-s wait): amber pulse on the outer ring
              - armed (squibLit):   solid white halo
              - discharged:         solid amber halo */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundColor: C.bezel,
          border: `1.5px solid ${accent}`,
          // PLAN v2: rounded ~4 px (was 2 px) for the bezel, matches photo.
          borderRadius: "4px",
          padding: "3px",
          display: "flex", flexDirection: "column",
          gap: "2px",
          animation: arming ? "agent-arming-edge-pulse 1s ease-in-out infinite" : undefined,
          boxShadow:
            arming   ? undefined :  // animation drives the box-shadow during arming
            dischLit ? `0 0 0 1.5px ${C.amber}, 0 0 12px ${C.amber}90, 0 0 20px ${C.amber}40, inset 0 0 4px rgba(0,0,0,0.55)` :
            squibLit ? `0 0 0 1.5px ${C.white}, 0 0 10px ${C.white}80,  0 0 18px ${C.white}40, inset 0 0 4px rgba(0,0,0,0.55)` :
                       "inset 0 0 4px rgba(0,0,0,0.55)",
          transition: arming ? undefined : "all 0.2s",
          zIndex: 1,
        }}>
          {/* SQUIB cell — strict Airbus FCOM (DSC-26-20-20): white when AGENT
              pb-sw is active (after FIRE pb pushed), off otherwise. The
              pulsing arming indicator lives on the OUTER BOUNDARY of the
              AGENT pb, not on this inner cell. */}
          <div style={{
            flex: 1,
            backgroundColor: squibLit ? `${C.white}30` : C.ledOff,
            // PLAN v2: ~3 px cell radius (was 1 px) so the inner cells echo
            // the rounded bezel.
            borderRadius: "3px",
            display: "flex",
            alignItems: "center", justifyContent: "center",
            transition: "background-color 0.2s",
          }}>
            <span style={{
              fontSize: "9px",
              fontFamily: "var(--font-cockpit)",
              fontWeight: 800,
              color: squibLit ? C.white : C.dimLo,
              letterSpacing: "0.06em",
              textShadow: squibLit ? `0 0 4px ${C.white}` : "none",
            }}>SQUIB</span>
          </div>

          {/* DISCH cell (bottom half) */}
          <div style={{
            flex: 1,
            backgroundColor: dischLit ? `${C.amber}30` : C.ledOff,
            borderRadius: "3px",
            display: "flex",
            alignItems: "center", justifyContent: "center",
            transition: "background-color 0.2s",
          }}>
            <span style={{
              fontSize: "9px",
              fontFamily: "var(--font-cockpit)",
              fontWeight: 800,
              color: dischLit ? C.amber : C.dimLo,
              letterSpacing: "0.06em",
              textShadow: dischLit ? `0 0 4px ${C.amber}` : "none",
            }}>DISCH</span>
          </div>
        </div>
      </div>

      {/* Label below the pb body */}
      <div style={{
        marginTop: "6px",
        textAlign: "center",
        fontSize: "8px",
        fontFamily: "var(--font-cockpit)",
        fontWeight: 700,
        color: dischLit ? C.amber : squibLit ? C.white : arming ? C.amber : C.dim,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        transition: "color 0.2s",
      }}>
        {label}
        {sub && (
          <span style={{
            display: "block", fontSize: "7px",
            fontFamily: "var(--font-cockpit)",
            color: C.dim, marginTop: "1px", letterSpacing: "0.06em",
          }}>
            {sub}
          </span>
        )}
      </div>

      {/* Countdown badge during the FCOM 10-s arming window */}
      {arming && countdownSec > 0 && (
        <div style={{
          marginTop: "3px",
          padding: "1px 6px",
          backgroundColor: `${C.amber}20`,
          border: `1px solid ${C.amber}80`,
          borderRadius: "2px",
          fontSize: "8px", fontFamily: "monospace", fontWeight: 800,
          color: C.amber,
          letterSpacing: "0.08em",
          animation: "fire-light-pulse 1s ease-in-out infinite",
        }}>
          IN {countdownSec}S
        </div>
      )}
    </div>
  );
}

// ─── Master switch (lever-style) ─────────────────────────────────────────────

function MasterSwitch({ on }: { on: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
      {/* Label */}
      <span
        style={{
          fontSize: "7px",
          fontFamily: "monospace",
          color: C.dim,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        ENG 1 MASTER
      </span>
      {/* Switch body */}
      <div
        style={{
          width: "40px",
          height: "50px",
          backgroundColor: C.bezel,
          border: `1.5px solid ${on ? C.green : C.dimLo}`,
          borderRadius: "3px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px",
          boxShadow: on ? `0 0 8px ${C.green}40` : "none",
          transition: "all 0.2s",
        }}
      >
        {/* ON indicator */}
        <div
          style={{
            fontSize: "8px",
            fontFamily: "monospace",
            fontWeight: 700,
            color: on ? C.green : C.dimLo,
            letterSpacing: "0.1em",
          }}
        >
          ON
        </div>
        {/* Lever knob */}
        <div
          style={{
            width: "24px",
            height: "16px",
            backgroundColor: on ? "#2E3A28" : "#1A1E28",
            border: `1px solid ${on ? C.green : C.dim}`,
            borderRadius: "2px",
            transform: on ? "translateY(-4px)" : "translateY(4px)",
            transition: "transform 0.2s",
          }}
        />
        {/* OFF indicator */}
        <div
          style={{
            fontSize: "8px",
            fontFamily: "monospace",
            fontWeight: 700,
            color: on ? C.dimLo : C.amber,
            letterSpacing: "0.1em",
          }}
        >
          OFF
        </div>
      </div>
    </div>
  );
}

// ─── THR Lever indicator ──────────────────────────────────────────────────────

function ThrLeverIndicator({ idle }: { idle: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
      <span
        style={{
          fontSize: "7px",
          fontFamily: "monospace",
          color: C.dim,
          letterSpacing: "0.12em",
        }}
      >
        THR LVR 1
      </span>
      <div
        style={{
          width: "28px",
          height: "60px",
          backgroundColor: C.bezel,
          border: `1.5px solid ${C.dimLo}`,
          borderRadius: "3px",
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* Gate marks */}
        {["CLB", "MCT", "IDLE"].map((pos, i) => (
          <div
            key={pos}
            style={{
              position: "absolute",
              right: "-18px",
              top: `${8 + i * 18}px`,
              fontSize: "6px",
              fontFamily: "monospace",
              color: C.dim,
              letterSpacing: "0.06em",
            }}
          >
            {pos}
          </div>
        ))}
        {/* Lever body */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: idle ? "36px" : "8px",
            width: "16px",
            height: "16px",
            backgroundColor: idle ? C.amber : "#3A4252",
            border: `1px solid ${idle ? C.amber : C.dim}`,
            borderRadius: "2px",
            transition: "top 0.3s ease",
            boxShadow: idle ? `0 0 6px ${C.amber}60` : "none",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "7px",
          fontFamily: "monospace",
          color: idle ? C.amber : C.green,
          letterSpacing: "0.1em",
          fontWeight: 700,
        }}
      >
        {idle ? "IDLE" : "CLB"}
      </span>
    </div>
  );
}

// ─── Engine parameter column ─────────────────────────────────────────────────

function EngineColumn({
  engNum,
  n1,
  egt,
  n2,
  ff,
  failed,
}: {
  engNum: 1 | 2;
  n1: number;
  egt: number;
  n2: number;
  ff: number;
  failed: boolean;
}) {
  const col = failed ? C.amber : C.green;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Engine label */}
      <span
        style={{
          fontSize: "8px",
          fontFamily: "monospace",
          color: failed ? C.amber : C.dim,
          letterSpacing: "0.2em",
          fontWeight: 700,
        }}
      >
        ENG {engNum}
        {failed && (
          <span style={{ color: C.red, marginLeft: "4px" }}>✕</span>
        )}
      </span>

      {/* N1 circular gauge */}
      <N1Gauge n1={n1} label="N1 %" color={col} size={72} />

      {/* EGT / N2 / FF */}
      <div className="flex gap-1 justify-center">
        <Param label="EGT" value={egt.toFixed(0)} unit="°C" color={col} />
        <Param label="N2"  value={n2.toFixed(0)}  unit="%" color={col} />
        <Param label="FF"  value={ff >= 1000 ? (ff / 1000).toFixed(1) + "k" : ff.toFixed(0)} unit="KG/H" color={col} />
      </div>
    </div>
  );
}

// ─── DSL OHP switch (fire-panel variant) ─────────────────────────────────────
function DslOHPSwitch({ label, sub, swState }: { label: string; sub?: string; swState: SysSwState }) {
  const ledColor = DSL_SW_COLORS[swState];
  const ledText  = DSL_SW_LABELS[swState];
  const isFault  = swState === "fault" || swState === "open";
  const isAlarm  = swState === "fire" || swState === "armed";
  const isOff    = swState === "off";
  const ledBg = (isFault || isAlarm) ? ledColor + "50" : isOff ? "#1A1018" : ledColor + "22";
  const ledTextColor = (isFault || isAlarm) ? ledColor : isOff ? "#886655" : ledColor;
  const bezelBorder = (isFault || isAlarm) ? ledColor : "#3A4A5A";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "52px" }}>
      <div style={{ width: "52px", backgroundColor: "#141A24", border: `1.5px solid ${bezelBorder}`, borderRadius: "3px", padding: "2px", boxShadow: (isFault || isAlarm) ? `0 0 8px ${ledColor}80, inset 0 0 4px ${ledColor}20` : "inset 0 1px 2px rgba(0,0,0,0.6)", transition: "border-color 0.2s, box-shadow 0.2s" }}>
        <div style={{ backgroundColor: ledBg, borderRadius: "2px 2px 0 0", padding: "4px 3px", textAlign: "center", minHeight: "20px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${bezelBorder}` }}>
          <span style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 800, letterSpacing: "0.06em", color: ledTextColor, textTransform: "uppercase", textShadow: (isFault || isAlarm) ? `0 0 6px ${ledColor}` : "none" }}>{ledText}</span>
        </div>
        <div style={{ backgroundColor: "#0C1018", borderRadius: "0 0 2px 2px", padding: "4px 3px", textAlign: "center" }}>
          <div style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.05em", color: "#C8D4E0", lineHeight: 1.2, textTransform: "uppercase" }}>{label}</div>
          {sub && <div style={{ fontSize: "7px", fontFamily: "monospace", color: C.dim, letterSpacing: "0.04em", marginTop: "2px", textTransform: "uppercase" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── DSL Param row for engine display ────────────────────────────────────────
function DslEngRow({ label, value, color, unit }: { label: string; value: string; color: string; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between px-2 py-[1px]" style={{ borderBottom: "1px solid #1C2130" }}>
      <span style={{ color: "#8A9AAE", fontSize: "8px", letterSpacing: "0.08em", fontFamily: "monospace" }}>{label}</span>
      <span style={{ color, fontSize: "9px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.06em" }}>
        {value}{unit && <span style={{ color: "#6A7A8A", fontSize: "7px", marginLeft: "2px" }}>{unit}</span>}
      </span>
    </div>
  );
}

// ─── DSL tray (engine panel) ──────────────────────────────────────────────────
function DslTray({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "6px 6px 8px", borderTop: "1px solid #1C2130", backgroundColor: "#050810", marginTop: "2px" }}>
      <div style={{ color: "#8AABBB", fontSize: "7px", letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: "6px", textTransform: "uppercase" }}>OHP — {title}</div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{children}</div>
      {note && <div style={{ marginTop: "6px", paddingTop: "4px", borderTop: "1px solid #1C2130", color: "#9AABB8", fontSize: "7px", fontFamily: "monospace", letterSpacing: "0.04em", lineHeight: 1.6 }}>{note}</div>}
    </div>
  );
}

// ─── DSL Engine parameter column (rows only, no trays) ───────────────────────
function DslEnginePanel({ engNum, panel, state, warningActive }: { engNum: 1 | 2; panel: import("@/scenarios/types").EnginePanelDef; state: ScenarioState; warningActive: boolean }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontSize: "7px", fontFamily: "monospace", color: warningActive ? C.amber : C.dim, letterSpacing: "0.2em", fontWeight: 700, padding: "1px 4px 1px" }}>
        ENG {engNum}{warningActive && <span style={{ color: C.red, marginLeft: "4px" }}>✕</span>}
      </span>
      {panel.rows.map((row) => {
        const val = evalSysCase(row.states, state);
        return (
          <DslEngRow key={row.label} label={row.label} value={val.v} color={SYS_COLORS[val.c]} unit={row.unit} />
        );
      })}
    </div>
  );
}

// ─── DSL interactive control: THR LEVERS (twin, FCOM-realistic) ──────────────
// FCOM DSC-22_10-40-30 / DSC-70-90-20-40: thrust levers have 5 detents.
// Pedestal layout: ENG 1 left, ENG 2 right. Lever clicks into each detent.
// Detent positions (top → bottom): TOGA · FLX/MCT · CL · IDLE
// (FLX and MCT share a detent — distinguished by flight phase)
type Detent = "TOGA" | "FLX/MCT" | "CL" | "IDLE";
const DETENTS: Detent[] = ["TOGA", "FLX/MCT", "CL", "IDLE"];
const DETENT_TOP_PX: Record<Detent, number> = { "TOGA": 6, "FLX/MCT": 32, "CL": 58, "IDLE": 84 };
const DETENT_COLOR: Record<Detent, string> = { "TOGA": C.white, "FLX/MCT": C.white, "CL": C.green, "IDLE": C.amber };

function ThrLever({ engNum, detent, isAffected, isClickable, onClick }: {
  engNum: 1 | 2; detent: Detent; isAffected: boolean; isClickable: boolean; onClick?: () => void;
}) {
  const leverColor = DETENT_COLOR[detent];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: isClickable ? "pointer" : "default" }}
         onClick={isClickable ? onClick : undefined}>
      <span style={{ fontSize: "7px", fontFamily: "monospace", color: C.dim, letterSpacing: "0.12em" }}>
        ENG {engNum}
      </span>
      {/* Lever track with detent gates (notches only — labels live in the
          shared center placard rendered by DslThrLeverCtrl, not on each lever) */}
      <div style={{
        width: "30px", height: "112px", backgroundColor: C.bezel,
        border: `1.5px solid ${isAffected ? C.amber : C.dimLo}`,
        borderRadius: "3px", position: "relative",
        boxShadow: isAffected ? `0 0 8px ${C.amber}50` : "none",
        transition: "all 0.2s",
      }}>
        {DETENTS.map((d) => (
          <div key={d} style={{
            position: "absolute",
            left: engNum === 1 ? "auto" : "-3px",
            right: engNum === 1 ? "-3px" : "auto",
            top: `${DETENT_TOP_PX[d] + 6}px`,
            width: "5px", height: "2px",
            backgroundColor: detent === d ? leverColor : C.dim,
            borderRadius: "1px",
            transition: "background-color 0.2s",
          }} />
        ))}
        {/* Lever knob — snaps to detent (no smooth between-detent state) */}
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          top: `${DETENT_TOP_PX[detent]}px`,
          width: "20px", height: "14px",
          backgroundColor: leverColor === C.green ? `${C.green}40` : leverColor === C.amber ? `${C.amber}50` : "#2A303C",
          border: `1.5px solid ${leverColor}`, borderRadius: "2px",
          transition: "top 0.25s cubic-bezier(0.4, 1.6, 0.6, 1)",
          boxShadow: `0 0 4px ${leverColor}80`,
        }} />
      </div>
      {/* Current detent label below each lever */}
      <span style={{ fontSize: "7px", fontFamily: "monospace", fontWeight: 700, color: leverColor, letterSpacing: "0.08em" }}>
        {detent}
      </span>
    </div>
  );
}

function DslThrLeverCtrl({ done, active, clickable, onClick }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void }) {
  // ENG 1 = the affected engine in the scenario step. ENG 2 = static reference at CL.
  const eng1Detent: Detent = done ? "IDLE" : "CL";
  const eng2Detent: Detent = "CL";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", opacity: (!active && !done) ? 0.45 : 1, transition: "opacity 0.2s" }}>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.amber : C.dim, letterSpacing: "0.15em", textTransform: "uppercase" }}>
        THRUST LEVERS
      </span>
      <div style={{
        display: "flex", gap: "10px", alignItems: "flex-start",
        padding: "8px 10px",
        backgroundColor: "#0A0E16",
        border: `1px solid ${active ? `${C.amber}60` : "#1C2130"}`,
        borderRadius: "4px",
        transition: "border-color 0.2s",
      }}>
        <ThrLever engNum={1} detent={eng1Detent} isAffected={active || done} isClickable={clickable} onClick={onClick} />

        {/* Shared detent placard between the two levers (FCOM-realistic — the
            detent labels are printed on the pedestal, not on each lever) */}
        <div style={{
          position: "relative",
          paddingTop: "12px",  // align with top of lever track (matches "ENG N" header above the lever)
          height: "112px",
          minWidth: "48px",
        }}>
          {DETENTS.map((d) => {
            const eng1Active = eng1Detent === d;
            const eng2Active = eng2Detent === d;
            const labelColor =
              eng1Active && (active || done) ? DETENT_COLOR[d] :
              eng2Active                      ? DETENT_COLOR[d] :
                                                C.dim;
            return (
              <div key={d} style={{
                position: "absolute",
                top: `${DETENT_TOP_PX[d] + 14}px`, // +14 = 12 (paddingTop) + 2 (visually align to notch midpoint)
                left: 0, right: 0,
                fontSize: "7px", fontFamily: "monospace",
                color: labelColor,
                fontWeight: eng1Active || eng2Active ? 700 : 400,
                letterSpacing: "0.04em",
                transition: "color 0.2s",
                textAlign: "center",
              }}>
                {d}
              </div>
            );
          })}
        </div>

        <ThrLever engNum={2} detent={eng2Detent} isAffected={false} isClickable={false} />
      </div>
      <span style={{ fontSize: "7px", fontFamily: "monospace", color: done ? C.amber : active ? C.amber : C.dimLo, letterSpacing: "0.1em", fontWeight: 700, minHeight: "10px" }}>
        {done ? "ENG 1 → IDLE ✓" : active ? "▸ RETARD ENG 1 → IDLE" : ""}
      </span>
    </div>
  );
}

// ─── DSL interactive control: ENG MODE SEL ───────────────────────────────────
function DslModeSelCtrl({ done, active, clickable, onClick }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : C.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>MODE SEL</span>
      <div style={{ width: "62px", height: "62px", backgroundColor: C.bezel, border: `2px solid ${active ? C.green : done ? C.green : C.dimLo}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 0 12px ${C.green}50` : done ? `0 0 10px ${C.green}40` : "none", transition: "all 0.2s", position: "relative" }}>
        <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 800, color: done ? C.green : active ? C.green : C.dim, letterSpacing: "0.06em", textTransform: "uppercase" }}>{done ? "IGN" : "NORM"}</span>
        {[0, 90, 180, 270].map(a => {
          const r = 28, rad = (a * Math.PI) / 180;
          return <div key={a} style={{ position: "absolute", width: "2px", height: "6px", backgroundColor: C.dimLo, top: `${31 - r * Math.cos(rad) - 3}px`, left: `${31 + r * Math.sin(rad) - 1}px`, transform: `rotate(${a}deg)`, transformOrigin: "center" }} />;
        })}
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : C.dim, letterSpacing: "0.08em", fontWeight: 700 }}>{done ? "IGN ✓" : "SEL →"}</span>
    </div>
  );
}

// ─── DSL interactive control: ENG MASTER lever (FCOM-accurate) ───────────────
// Source: FCOM DSC-70-90-20 — "ENG MODE Selector and ENG MASTER Levers"
// Layout (per FCOM photo on the pedestal):
//   • Square lever knob with "ENG 1" / "ENG 2" embossed on its face.
//   • Lever travels vertically inside a small housing.
//     ON detent at top, OFF detent at bottom. ON / OFF text labels are placed
//     to the RIGHT of the slot, not above/below.
//   • A separate small FIRE / FAULT indicator box sits BELOW the lever housing
//     (not on the lever itself).  FIRE = red, FAULT = amber.
function DslMasterSwCtrl({ done, active, clickable, onClick, label, warningActive }: {
  done: boolean; active: boolean; clickable: boolean; onClick: () => void;
  label: string; warningActive?: boolean;
}) {
  // Lever position: ON (top) by default → OFF (bottom) once the step is done.
  const position: "ON" | "OFF" = done ? "OFF" : "ON";
  const fireLight = !!warningActive;   // red while fire detected for this engine
  const faultLight = false;            // not modeled in this scenario
  const accent = active ? C.amber : done ? C.amber : C.dimLo;
  const engNum = label.includes("2") ? "2" : "1";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.45 : 1, transition: "opacity 0.2s" }}
    >
      {/* "MASTER 1/2" panel label above the lever housing */}
      <span style={{ fontSize: "7px", fontFamily: "monospace", color: C.dim, letterSpacing: "0.18em", textTransform: "uppercase" }}>
        MASTER {engNum}
      </span>

      {/* Lever housing — narrow vertical slot with ON/OFF labels on the right.
          The slot + FIRE/FAULT box are wrapped in their own column so the
          FIRE/FAULT sits inline (same vertical axis) directly below the slot,
          per FCOM photo. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
       {/* Column: slot above, FIRE/FAULT directly below — both 30px wide,
           horizontally centered as a stack */}
       <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
        {/* The slot the square lever knob rides in */}
        <div style={{
          position: "relative",
          width: "30px", height: "62px",
          backgroundColor: "#040608",
          border: `2px solid ${active ? `${C.amber}90` : done ? `${C.amber}70` : "#1C2130"}`,
          borderRadius: "3px",
          boxShadow:
            active ? `0 0 8px ${C.amber}50, inset 0 1px 2px rgba(0,0,0,0.6)` :
            done   ? `0 0 6px ${C.amber}30, inset 0 1px 2px rgba(0,0,0,0.6)` :
                     "inset 0 1px 2px rgba(0,0,0,0.6)",
          transition: "all 0.2s",
        }}>
          {/* Lever knob — square with ENG number embossed */}
          <div style={{
            position: "absolute",
            top: position === "ON" ? "3px" : "31px",
            left: "50%",
            transform: `translateX(-50%) rotateX(${position === "OFF" ? "-12deg" : "0deg"})`,
            transformOrigin: "50% 100%",
            transition: "top 0.42s cubic-bezier(0.2, 1.55, 0.5, 1), transform 0.42s cubic-bezier(0.2, 1.55, 0.5, 1)",
            width: "26px", height: "26px",
            background: "linear-gradient(180deg, #2E3440 0%, #181C24 100%)",
            border: `1.5px solid ${accent}`,
            borderRadius: "2px",
            boxShadow:
              position === "OFF"
                ? `0 2px 3px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.10)`
                : `0 -1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: "10px", fontFamily: "monospace", fontWeight: 800,
              color: "#D8DCE4",
              letterSpacing: "0.04em",
              textShadow: "0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.10)",
              lineHeight: 1, textAlign: "center",
            }}>
              ENG<br />{engNum}
            </span>
          </div>
        </div>

        {/* Square FIRE / FAULT indicator INLINE below the slot (same column,
            same horizontal centerline as the lever knob).  FCOM photo shows
            this directly in line with the master switch. */}
        <div style={{
          width: "30px", height: "30px",
          backgroundColor: "#0A0E16",
          border: `1.5px solid ${fireLight || faultLight ? "#5A6470" : "#1C2130"}`,
          borderRadius: "2px",
          padding: "2px",
          boxShadow: fireLight ? `0 0 5px ${C.red}50` : "none",
          transition: "all 0.2s",
          display: "flex", flexDirection: "column", gap: "1px",
        }}>
          <div style={{
            flex: 1,
            backgroundColor: fireLight ? C.red : "#06080C",
            borderRadius: "1px",
            boxShadow: fireLight ? `0 0 4px ${C.red}, inset 0 0 2px #FFB0B0` : "inset 0 1px 1px rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "6px", fontFamily: "monospace", fontWeight: 900,
            color: fireLight ? "#FFFFFF" : "#1A1E28",
            letterSpacing: "0.06em",
            textShadow: fireLight ? `0 0 3px ${C.red}` : "none",
          }}>FIRE</div>
          <div style={{
            flex: 1,
            backgroundColor: faultLight ? C.amber : "#06080C",
            borderRadius: "1px",
            boxShadow: faultLight ? `0 0 3px ${C.amber}` : "inset 0 1px 1px rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "6px", fontFamily: "monospace", fontWeight: 900,
            color: faultLight ? "#000000" : "#1A1E28",
            letterSpacing: "0.06em",
          }}>FAULT</div>
        </div>
       </div>

        {/* ON / OFF labels stacked to the right of the slot column */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "62px", paddingTop: "1px", paddingBottom: "1px" }}>
          <span style={{
            fontSize: "8px", fontFamily: "monospace", fontWeight: 700,
            color: position === "ON" ? C.green : "#3A4252",
            letterSpacing: "0.1em",
            transition: "color 0.2s",
          }}>ON</span>
          <span style={{
            fontSize: "8px", fontFamily: "monospace", fontWeight: 700,
            color: position === "OFF" ? C.amber : "#3A4252",
            letterSpacing: "0.1em",
            transition: "color 0.2s",
          }}>OFF</span>
        </div>
      </div>

      <span style={{ fontSize: "8px", fontFamily: "monospace",
        color: done ? C.amber : active ? C.green : C.dimLo,
        letterSpacing: "0.08em", fontWeight: 700, minHeight: "10px",
      }}>
        {done ? "OFF ✓" : active ? "▸ CONFIRM → OFF" : ""}
      </span>
    </div>
  );
}

// ─── DSL interactive control: monitor/advisory ───────────────────────────────
function DslMonitorCtrl({ done, active, clickable, onClick, label, sub }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.35 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : C.dim, letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", maxWidth: "60px", lineHeight: 1.2 }}>{label}</span>
      <div style={{ width: "60px", height: "64px", backgroundColor: C.bezel, border: `2px solid ${done ? C.green : active ? C.cyan : C.dimLo}`, borderRadius: "4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px", boxShadow: active ? `0 0 10px ${C.cyan}40` : done ? `0 0 8px ${C.green}40` : "none", transition: "all 0.2s" }}>
        <span style={{ fontSize: active ? "16px" : "13px", fontFamily: "monospace", fontWeight: 800, color: done ? C.green : active ? C.cyan : C.dimLo, lineHeight: 1 }}>{done ? "✓" : active ? "…" : "—"}</span>
        {sub && <span style={{ fontSize: "7px", fontFamily: "monospace", color: done ? C.green : active ? C.cyan : C.dimLo, letterSpacing: "0.06em", textAlign: "center", lineHeight: 1.3, textTransform: "uppercase" }}>{sub}</span>}
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : active ? C.cyan : C.dimLo, letterSpacing: "0.08em", fontWeight: 700 }}>{done ? "DONE" : active ? "ACTIVE" : "WAIT"}</span>
    </div>
  );
}

// ─── DSL interactive control: MASTER WARN cancel ────────────────────────────
function DslCancelWarnCtrl({ done, active, clickable, onClick }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.dim : active ? C.red : C.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>MASTER</span>
      <div style={{ width: "64px", height: "32px", backgroundColor: done ? "#1A1A1A" : active ? C.red : "#3A1010", border: `2px solid ${done ? C.dimLo : active ? C.red : "#6A2020"}`, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 0 14px ${C.red}80` : "none", transition: "all 0.2s" }}>
        <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 800, color: done ? C.dimLo : active ? C.white : "#8A3030", letterSpacing: "0.1em" }}>{done ? "CLR" : "WARN"}</span>
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.dim : active ? C.red : C.dimLo, letterSpacing: "0.08em", fontWeight: 700 }}>{active ? "PUSH" : "WAIT"}</span>
    </div>
  );
}

// ─── DSL interactive control: MASTER CAUT cancel ────────────────────────────
function DslCancelCautCtrl({ done, active, clickable, onClick }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.dim : active ? C.amber : C.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>MASTER</span>
      <div style={{ width: "64px", height: "32px", backgroundColor: done ? "#1A1A1A" : active ? C.amber : "#3A2A00", border: `2px solid ${done ? C.dimLo : active ? C.amber : "#6A4A00"}`, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 0 12px ${C.amber}70` : "none", transition: "all 0.2s" }}>
        <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 800, color: done ? C.dimLo : active ? "#0A0800" : "#8A6000", letterSpacing: "0.1em" }}>{done ? "CLR" : "CAUT"}</span>
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.dim : active ? C.amber : C.dimLo, letterSpacing: "0.08em", fontWeight: 700 }}>{active ? "PUSH" : "WAIT"}</span>
    </div>
  );
}

// ─── DSL interactive control: O2 MASK ───────────────────────────────────────
function DslO2MaskCtrl({ done, active, clickable, onClick, label, sub }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void; label: string; sub?: string }) {
  const col = done ? C.green : active ? C.white : C.dimLo;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : active ? C.white : C.dim, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      {/* Mask body — circular with O2 legend */}
      <div style={{ width: "64px", height: "64px", backgroundColor: C.bezel, border: `2px solid ${col}`, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", boxShadow: active ? `0 0 14px ${C.white}40` : done ? `0 0 10px ${C.green}40` : "none", transition: "all 0.2s", position: "relative" }}>
        {/* O2 symbol */}
        <span style={{ fontSize: "18px", fontFamily: "monospace", fontWeight: 900, color: col, lineHeight: 1, letterSpacing: "-1px" }}>O₂</span>
        <span style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 800, color: col, letterSpacing: "0.06em" }}>{done ? "ON ✓" : sub ?? "100%"}</span>
        {/* Mask strap indicators */}
        {["-18px", "18px"].map((t) => (
          <div key={t} style={{ position: "absolute", top: t, left: "50%", transform: "translateX(-50%)", width: "20px", height: "4px", backgroundColor: col + "60", borderRadius: "2px" }} />
        ))}
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: col, letterSpacing: "0.08em", fontWeight: 700 }}>{done ? "DONNED" : active ? "DON NOW" : "WAIT"}</span>
    </div>
  );
}

// ─── DSL interactive control: overhead pushbutton-light (FCOM style) ─────────
// A320 FCOM: pushbutton-lights have a light legend window at top (shows FAULT/OFF/ON)
// that is DARK in normal state. Light illuminates only when action is needed or done.
// Button face = system label (black background, white text).
function DslToggleSwCtrl({ done, active, clickable, onClick, label, sub }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void; label: string; sub?: string }) {
  const subUp = sub?.toUpperCase() ?? "";
  const isOffAction  = subUp === "OFF";
  const isIgn        = subUp === "IGN";
  const isReset      = subUp === "RESET";

  // LED window: dark when idle; FAULT (amber) when action needed; result state when done
  let ledText  = "";
  let ledColor: string = C.dim;
  let ledBg: string    = C.ledOff;
  let bezelCol: string = C.dimLo;
  let glow     = "none";

  if (!done && active) {
    ledText  = isOffAction ? "FAULT" : isIgn ? "NORM" : isReset ? "FAULT" : "FAULT";
    ledColor = C.amber;
    ledBg    = C.amber + "28";
    bezelCol = C.amber;
    glow     = `0 0 10px ${C.amber}50`;
  } else if (done) {
    if (isOffAction) {
      ledText  = "OFF";
      ledColor = C.white;
      ledBg    = "#FFFFFF14";
      bezelCol = C.white;
      glow     = `0 0 8px ${C.white}30`;
    } else if (isIgn) {
      ledText  = "IGN";
      ledColor = C.green;
      ledBg    = C.green + "20";
      bezelCol = C.green;
      glow     = `0 0 8px ${C.green}40`;
    } else if (isReset) {
      ledText  = "NORM";
      ledColor = C.green;
      ledBg    = C.green + "18";
      bezelCol = C.green;
      glow     = `0 0 8px ${C.green}30`;
    } else {
      ledText  = sub ?? "ON";
      ledColor = C.green;
      ledBg    = C.green + "18";
      bezelCol = C.green;
      glow     = `0 0 8px ${C.green}30`;
    }
  }

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.35 : 1, transition: "opacity 0.2s" }}
    >
      {/* Pushbutton housing — matches FCOM overhead panel width */}
      <div style={{ width: "68px", backgroundColor: C.bezel, border: `2px solid ${bezelCol}`, borderRadius: "4px", padding: "2px", boxShadow: glow, transition: "all 0.2s" }}>
        {/* LED legend window (top) — dark = normal, illuminated = abnormal */}
        <div style={{ height: "30px", backgroundColor: ledBg, borderRadius: "2px 2px 0 0", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${done || active ? bezelCol + "50" : "#1C2130"}`, transition: "background-color 0.2s" }}>
          {ledText ? (
            <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 900, color: ledColor, letterSpacing: "0.1em", textTransform: "uppercase", textShadow: (done || active) ? `0 0 8px ${ledColor}` : "none" }}>
              {ledText}
            </span>
          ) : (
            <span style={{ fontSize: "7px", fontFamily: "monospace", color: C.dimLo, letterSpacing: "0.08em" }}>●</span>
          )}
        </div>
        {/* Button face (bottom) — black with white label */}
        <div style={{ backgroundColor: C.btnFace, borderRadius: "0 0 2px 2px", padding: "8px 4px 7px", textAlign: "center" }}>
          <div style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 800, color: C.white, letterSpacing: "0.05em", textTransform: "uppercase", lineHeight: 1.25 }}>{label}</div>
          {sub && <div style={{ fontSize: "7px", fontFamily: "monospace", color: C.dim, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "2px" }}>{sub}</div>}
        </div>
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? ledColor : active ? ledColor : C.dimLo, letterSpacing: "0.08em", fontWeight: 700, minHeight: "12px" }}>
        {done ? "✓" : active ? "▶ PUSH" : ""}
      </span>
    </div>
  );
}

// ─── DSL interactive control: guarded emergency pushbutton ───────────────────
// Modelled on A320 guarded pushbuttons (RAT MAN ON, EMER ELEC, PAX OXY)
function DslEmerPbCtrl({ done, active, clickable, onClick, label, sub }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : active ? C.white : C.dim, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", maxWidth: "70px", lineHeight: 1.2 }}>{label}</span>
      {/* Guard housing */}
      <div style={{ padding: "3px", border: `1.5px solid ${done ? C.green : active ? "#8AABBB" : C.dimLo}`, borderRadius: "5px", backgroundColor: done ? "#001A08" : active ? "#0A1410" : "#060A0E", transition: "all 0.2s" }}>
        {/* Guard cap indicator */}
        <div style={{ fontSize: "7px", fontFamily: "monospace", color: done ? C.green : active ? "#8AABBB" : C.dimLo, textAlign: "center", letterSpacing: "0.1em", marginBottom: "2px", textTransform: "uppercase" }}>{done ? "ACTD" : "GUARD"}</div>
        {/* Button */}
        <div style={{ width: "56px", height: "48px", backgroundColor: done ? C.green + "20" : active ? "#152015" : C.bezel, border: `2px solid ${done ? C.green : active ? C.green : C.dimLo}`, borderRadius: "3px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", boxShadow: active ? `0 0 12px ${C.green}50` : done ? `0 0 10px ${C.green}40` : "none", transition: "all 0.2s" }}>
          <span style={{ fontSize: done ? "14px" : "16px", fontFamily: "monospace", fontWeight: 800, color: done ? C.green : active ? C.green : C.dimLo, lineHeight: 1 }}>{done ? "✓" : "▶"}</span>
          {sub && <span style={{ fontSize: "7px", fontFamily: "monospace", color: done ? C.green : active ? C.green : C.dimLo, letterSpacing: "0.05em", textAlign: "center", textTransform: "uppercase", lineHeight: 1.2 }}>{sub}</span>}
        </div>
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : active ? C.green : C.dimLo, letterSpacing: "0.08em", fontWeight: 700 }}>{done ? "ACTD ✓" : active ? "PUSH" : "WAIT"}</span>
    </div>
  );
}

// ─── DSL interactive control: speed brake lever ─────────────────────────────
function DslSpdBrkCtrl({ done, active, clickable, onClick }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : C.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>SPD BRK</span>
      <div style={{ width: "34px", height: "76px", backgroundColor: C.bezel, border: `2px solid ${active ? C.amber : done ? C.green : C.dimLo}`, borderRadius: "4px", position: "relative", boxShadow: active ? `0 0 10px ${C.amber}60` : done ? `0 0 8px ${C.green}40` : "none", transition: "all 0.2s" }}>
        {["RET","½","FULL"].map((pos, i) => (
          <div key={pos} style={{ position: "absolute", right: "-28px", top: `${8 + i * 20}px`, fontSize: "7px", fontFamily: "monospace", color: C.dimLo, letterSpacing: "0.04em" }}>{pos}</div>
        ))}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: done ? "46px" : active ? "22px" : "8px", width: "18px", height: "14px", backgroundColor: done ? `${C.green}CC` : active ? `${C.amber}CC` : "#3A4252", border: `1.5px solid ${done ? C.green : active ? C.amber : C.dim}`, borderRadius: "3px", transition: "top 0.35s ease", boxShadow: done ? `0 0 5px ${C.green}60` : active ? `0 0 5px ${C.amber}60` : "none" }} />
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.green : active ? C.amber : C.dim, letterSpacing: "0.1em", fontWeight: 700 }}>{done ? "FULL ✓" : "RET"}</span>
    </div>
  );
}

// ─── DSL interactive ECAM control panel ──────────────────────────────────────
function DslControlPanel({
  controls, scenario, state, perform, disabled, warningActive, fireLit,
}: {
  controls: import("@/scenarios/types").EngControlDef[];
  scenario: Scenario;
  state: ScenarioState;
  perform: (a: PilotAction) => void;
  disabled?: boolean;
  warningActive: boolean;
  fireLit: boolean;
}) {
  const isDone   = (id: string) => !!state.completedSteps[id];
  const allDone  = controls.every(c => isDone(c.stepId));

  // Dev layout-edit mode: ON = drag bodies to move + edge/corner resize handles;
  // OFF = elements are fully interactive (clickable / orbitable). Persisted.
  const [editMode, setEditMode] = useState(true);
  useEffect(() => { try { const v = window.localStorage.getItem("fireDevEdit"); if (v != null) setEditMode(v === "1"); } catch { /* ignore */ } }, []);
  const toggleEdit = () => setEditMode((p) => { const n = !p; try { window.localStorage.setItem("fireDevEdit", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  // Edit only takes effect where the dev editor is available — never in production
  // (so a stale localStorage `fireDevEdit=1` can't leave the panel popped/editable for trainees).
  const edit = SHOW_LAYOUT_EDITOR && editMode;

  // Deterministic view of the 3D model within its (fixed) frame: pan x/y + zoom.
  // Drag the body to pan (move the whole panel left/right/up/down), wheel to zoom.
  const [view3d, setView3d] = useState(VIEW_DEFAULT);
  useEffect(() => { try { const r = window.localStorage.getItem("fire3dView.v1"); if (r) setView3d({ ...VIEW_DEFAULT, ...JSON.parse(r) }); } catch { /* ignore */ } }, []);
  const view3dRef = useRef(view3d); view3dRef.current = view3d;
  const persistView = () => { try { window.localStorage.setItem("fire3dView.v1", JSON.stringify(view3dRef.current)); } catch { /* ignore */ } };
  const PAN_GAIN = 2;
  const onPanDrag = (ndx: number, ndy: number) => setView3d((v) => ({ ...v, x: v.x + ndx * PAN_GAIN, y: v.y - ndy * PAN_GAIN }));
  const onZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setView3d((v) => {
      const next = { ...v, zoom: Math.max(0.5, Math.min(5, v.zoom * factor)) };
      try { window.localStorage.setItem("fire3dView.v1", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Pop-out lifecycle: the action panel rises out once the PF commands ECAM ACTIONS
  // at 400 ft (step `four_hundred_ft_cmd`), and retracts 3 s after AGENT 2 is
  // discharged (or the fire is extinguished, for the agent-1-only path).
  const ecamActionsStarted = !!state.completedSteps["four_hundred_ft_cmd"];
  const retractTrigger = !!state.completedSteps["agent2"] || !!state.triggersFired["fire_extinguished"];
  const [retracted, setRetracted] = useState(false);
  useEffect(() => {
    if (!retractTrigger) { setRetracted(false); return; }
    const t = setTimeout(() => setRetracted(true), 3000);
    return () => clearTimeout(t);
  }, [retractTrigger]);
  // Edit mode keeps it popped so the layout can be arranged anytime. With edit
  // off it follows the real trigger: pop on ECAM ACTIONS, retract 3 s after agent 2.
  const popped = USE_NEW_FIRE_PANEL && (edit || (ecamActionsStarted && !retracted));

  // Export the current arrangement (every element's box + the 3D view) as JSON so
  // it can be baked in as the default layout.
  const exportLayout = () => {
    const boxes: Record<string, unknown> = {};
    const content: Record<string, unknown> = {};
    try {
      Object.keys(window.localStorage).forEach((k) => {
        if (k.startsWith(DEV_BOX_PREFIX)) boxes[k.slice(DEV_BOX_PREFIX.length)] = JSON.parse(window.localStorage.getItem(k) || "null");
        else if (k.startsWith("fireDevContent.")) content[k.slice("fireDevContent.".length)] = JSON.parse(window.localStorage.getItem(k) || "null");
      });
    } catch { /* ignore */ }
    const json = JSON.stringify({ boxes, content, view: view3dRef.current }, null, 2);
    try { void navigator.clipboard?.writeText(json); } catch { /* ignore */ }
    console.log("FIRE PANEL LAYOUT EXPORT >>>\n" + json);
    window.prompt("Layout copied to clipboard — paste this to Claude:", json);
  };

  return (
    <div style={{ borderTop: "1px solid #1C2130", backgroundColor: warningActive ? "#060A12" : "#050709", padding: "6px 10px 8px" }}>
      {/* Dev-only layout editor. Each action-panel element is a movable/resizable
          frame (see DevMovable) when edit mode is on; positions persist per element. */}
      {SHOW_LAYOUT_EDITOR && (
        <div style={{
          position: "fixed", bottom: 12, left: 12, zIndex: 60,
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", borderRadius: 8,
          background: "rgba(10,14,20,0.92)", border: "1px solid #2a313b",
          fontFamily: "monospace", color: "#cdd6e0", fontSize: 10,
        }}>
          <span style={{ letterSpacing: 1, color: "#8aabbb", textTransform: "uppercase" }}>layout · dev</span>
          <button type="button" onClick={toggleEdit}
            style={{ padding: "3px 9px", fontSize: 10, fontWeight: 700, color: editMode ? "#05070a" : "#cdd6e0",
              background: editMode ? "#8aabbb" : "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>
            Edit: {editMode ? "ON" : "OFF"}
          </button>
          <span style={{ color: "#7c8696" }}>drag body = move · edges/corners = resize</span>
          <button type="button" onClick={exportLayout}
            style={{ padding: "3px 9px", fontSize: 10, fontWeight: 700, color: "#05070a",
              background: "#7ad9a5", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>
            ⤓ Export layout
          </button>
          <button type="button" onClick={() => { resetDevBoxes(); try { window.localStorage.removeItem("fire3dView.v1"); } catch { /* ignore */ } window.location.reload(); }}
            style={{ padding: "3px 8px", fontSize: 10, color: "#eef6ff",
              background: "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>
            Reset layout
          </button>
        </div>
      )}
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <div style={{ flex: 1, height: "1px", backgroundColor: warningActive ? `${C.amber}30` : "#1C2130" }} />
        <span style={{ fontSize: "7px", fontFamily: "monospace", letterSpacing: "0.25em", color: warningActive ? C.amber : C.dim, textTransform: "uppercase" }}>ACTION PANEL</span>
        <div style={{ flex: 1, height: "1px", backgroundColor: warningActive ? `${C.amber}30` : "#1C2130" }} />
      </div>

      {/* Two-column layout: left 40% = thrust levers + master, right 60% = 3D fire panel */}
      {(() => {
        const firePbCtrl  = controls.find(c => c.kind === "fire_pb");
        const agentCtrls  = controls.filter(c => c.kind === "agent");
        const agent1Ctrl  = agentCtrls[0];
        const agent2Ctrl  = agentCtrls[1];
        const agent2Available = !!state.triggersFired["fire_persists_30s"] && !state.triggersFired["fire_extinguished"];
        const performStep = (id?: string) => {
          if (!id || disabled) return;
          perform({ kind: "STEP", stepId: id });
        };

        const sideControls = controls.filter(c => c.kind !== "fire_pb" && c.kind !== "agent");

        const fp3dFireDetected = fireLit;
        const fp3dFirePbDone   = isDone(firePbCtrl?.stepId ?? "");
        const fp3dAgent1Disch  = isDone(agent1Ctrl?.stepId ?? "");
        const fp3dAgent2Disch  = isDone(agent2Ctrl?.stepId ?? "");
        const fp3dActiveStepId =
          !fp3dFirePbDone && fp3dFireDetected ? "eng1_fire_pb" :
          fp3dFirePbDone  && !fp3dAgent1Disch  ? "agent1" :
          fp3dAgent1Disch && !fp3dAgent2Disch && agent2Available ? "agent2" : undefined;

        // Render one side control (lever / master / etc.) at natural size.
        const renderCtrl = (ctrl: import("@/scenarios/types").EngControlDef) => {
          const done      = isDone(ctrl.stepId);
          const step      = scenario.steps.find(s => s.id === ctrl.stepId);
          const reqsMet   = (step?.requires ?? []).every(r => !!state.completedSteps[r]);
          const active    = !done && reqsMet && warningActive;
          const clickable = !done && reqsMet && warningActive && !disabled;
          const onClick   = () => { if (clickable) perform({ kind: "STEP", stepId: ctrl.stepId }); };
          switch (ctrl.kind) {
            case "thr_lever":   return <DslThrLeverCtrl  done={done} active={active} clickable={clickable} onClick={onClick} />;
            case "mode_sel":    return <DslModeSelCtrl   done={done} active={active} clickable={clickable} onClick={onClick} />;
            case "master":      return <DslMasterSwCtrl  done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} warningActive={fireLit} />;
            case "cancel_warn": return <DslCancelWarnCtrl done={done} active={active} clickable={clickable} onClick={onClick} />;
            case "cancel_caut": return <DslCancelCautCtrl done={done} active={active} clickable={clickable} onClick={onClick} />;
            case "o2_mask":     return <DslO2MaskCtrl     done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
            case "toggle_sw":   return <DslToggleSwCtrl   done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
            case "emer_pb":     return <DslEmerPbCtrl     done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
            case "spd_brk":     return <DslSpdBrkCtrl     done={done} active={active} clickable={clickable} onClick={onClick} />;
            default:            return <DslMonitorCtrl    done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
          }
        };

        const panel3d = USE_NEW_FIRE_PANEL ? (
          <FireTestPanel3D
            controlled framing="eng1" panX={view3d.x} panY={view3d.y} zoom={view3d.zoom}
            fireDetected={fp3dFireDetected} firePbDone={fp3dFirePbDone}
            agent1Disch={fp3dAgent1Disch} agent2Disch={fp3dAgent2Disch}
            onPushFirePb={() => performStep(firePbCtrl?.stepId)}
            onPushAgent1={() => performStep(agent1Ctrl?.stepId)}
            onPushAgent2={() => performStep(agent2Ctrl?.stepId)}
          />
        ) : (
          <FirePanel3D
            fireDetected={fp3dFireDetected} firePbDone={fp3dFirePbDone}
            agent1Disch={fp3dAgent1Disch} agent2Disch={fp3dAgent2Disch}
            agent2Available={agent2Available} activeStepId={fp3dActiveStepId}
            onPushFirePb={() => performStep(firePbCtrl?.stepId)}
            onPushAgent1={() => performStep(agent1Ctrl?.stepId)}
            onPushAgent2={() => performStep(agent2Ctrl?.stepId)}
          />
        );

        // NEW PANEL: the action panel POPS OUT (rises) into the saved/baked floating
        // layout once the PF commands ECAM ACTIONS at 400 ft, and retracts 3 s after
        // AGENT 2 / fire out (see `popped`). Otherwise it stays inline in the column.
        if (popped) {
          // One combined ACTION PANEL frame (moves/resizes/pops as a unit) holding
          // the 3D fire panel + thrust levers + master, each nudgeable inside it.
          return (
            <DevMovable id="combo_outer" label="ACTION PANEL" fill container editMode={edit} popDelay={0} def={COMBO_OUTER}>
              {/* Shared container surface so the three items read as ONE panel/box. */}
              <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "linear-gradient(180deg,#0c121b,#070b11)", border: "1px solid #283140", borderRadius: 8, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 30px rgba(0,0,0,0.5)" }} />
              {firePbCtrl && (
                <DevMovable id="combo_panel3d" label="3D FIRE PANEL" fill relative editMode={edit}
                  onBodyDrag={onPanDrag} onBodyDragEnd={persistView} onWheel={onZoom} def={COMBO_INNER.panel3d}>
                  <div style={{ position: "absolute", inset: 0, background: "transparent" }}>{panel3d}</div>
                </DevMovable>
              )}
              {sideControls.map((ctrl, i) => (
                <DevMovable key={ctrl.stepId} id={`combo_${ctrl.stepId}`} label={(ctrl.label || ctrl.kind).toUpperCase()} relative editMode={edit}
                  def={COMBO_INNER[ctrl.stepId] ?? { x: 6 + i * 156, y: 24, w: 150, h: 360 }}>
                  <div style={{ padding: 8 }}>{renderCtrl(ctrl)}</div>
                </DevMovable>
              ))}
            </DevMovable>
          );
        }

        // INLINE: idle (action not yet started) and production — the panels stay in
        // the action panel column.
        return (
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <div style={{ flex: "0 0 38%", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
              {sideControls.map((ctrl) => <div key={ctrl.stepId}>{renderCtrl(ctrl)}</div>)}
            </div>
            {firePbCtrl && (
              <div style={{ flex: "1 1 0", height: "202px", position: "relative", background: "#080C12" }}>
                <div style={{ position: "absolute", inset: 0 }}>{panel3d}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Status memo line */}
      <div style={{ marginTop: "6px", minHeight: "14px", textAlign: "center" }}>
        {allDone ? (
          <span style={{ color: C.green, fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.1em" }}>✓ ACTIONS COMPLETE</span>
        ) : warningActive ? (
          <span style={{ color: C.amber, fontSize: "8px", fontFamily: "monospace", letterSpacing: "0.08em" }}>
            {(() => {
              const next = controls.find(c => !isDone(c.stepId));
              const nextStep = scenario.steps.find(s => s.id === next?.stepId);
              const reqsMet = (nextStep?.requires ?? []).every(r => !!state.completedSteps[r]);
              if (!next) return null;
              return reqsMet ? `▸ ${next.label}${next.sub ? " → " + next.sub : ""}` : "◈ COMPLETE PRIOR STEPS FIRST";
            })()}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main FirePanel ───────────────────────────────────────────────────────────

export function FirePanel({
  scenario,
  state,
  perform,
  disabled,
}: {
  scenario: Scenario;
  state: ScenarioState;
  perform: (a: PilotAction) => void;
  disabled?: boolean;
}) {
  const done = (id: string) => !!state.completedSteps[id];

  // Use DSL path if scenario.engineDisplay is present
  if (scenario.engineDisplay) {
    const ed = scenario.engineDisplay;
    const warningActive = ed.warningTrigger ? !!state.triggersFired[ed.warningTrigger] : false;
    // FIRE visuals (red FIRE pb, engine-panel fire indicator, header CAUTION
    // badge) extinguish once the `fire_extinguished` trigger fires — the
    // engine is still INOP, but the fire itself is out.  Action clickability
    // stays on `warningActive` so post-fire steps (level off, accel/clean)
    // remain available.
    const fireExtinguished = !!state.triggersFired["fire_extinguished"];
    const fireLit = warningActive && !fireExtinguished;

    // Collect trays from both panels (full-width below grid)
    const allTrays = [...(ed.eng1.trays ?? []), ...(ed.eng2.trays ?? [])];

    return (
      <div
        className="border border-[var(--color-border)] font-mono select-none flex flex-col"
        style={{ backgroundColor: C.panel, flex: "1 1 0", minHeight: 0, overflowY: "auto" }}
      >
        <style>{FIRE_PANEL_CSS}</style>
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-[2px] border-b" style={{ borderColor: "#1C2130" }}>
          <span style={{ color: C.dim, fontSize: "8px", letterSpacing: "0.25em", textTransform: "uppercase" }}>ENGINE DISPLAY</span>
          {fireLit && (
            <span className="animate-pulse font-bold" style={{ color: C.amber, fontSize: "7px", letterSpacing: "0.2em" }}>
              ▲ {state.alarmLabel ?? "CAUTION"}
            </span>
          )}
        </div>

        {/* Engine parameter grid — equal-height columns, no trays here */}
        <div className="grid grid-cols-[1fr_1px_1fr] gap-x-2 px-1 pt-0 pb-0" style={{ alignItems: "start" }}>
          <DslEnginePanel engNum={1} panel={ed.eng1} state={state} warningActive={fireLit} />
          <div style={{ backgroundColor: "#1C2130", alignSelf: "stretch" }} />
          <DslEnginePanel engNum={2} panel={ed.eng2} state={state} warningActive={false} />
        </div>

        {/* Interactive ECAM control panel — only when controlPanel defined */}
        {ed.controlPanel && (
          <DslControlPanel
            controls={ed.controlPanel}
            scenario={scenario}
            state={state}
            perform={perform}
            disabled={disabled}
            warningActive={warningActive}
            fireLit={fireLit}
          />
        )}

        {/* OHP indicator trays — full width, below controls */}
        {allTrays.map(tray => (
          <DslTray key={tray.title} title={tray.title} note={tray.note}>
            {tray.switches.map(sw => {
              const swState = evalSysCase(sw.states, state);
              return <DslOHPSwitch key={sw.label} label={sw.label} sub={sw.sub} swState={swState} />;
            })}
          </DslTray>
        ))}

        {/* Memo footer when no control panel */}
        {!ed.controlPanel && (
          <div className="px-3 py-2 border-t" style={{ borderColor: "#1C2130" }}>
            <span style={{ color: C.dim, fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.08em" }}>
              {warningActive ? `▲ ${state.alarmLabel ?? "CAUTION"}` : "— NORMAL —"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Legacy hardcoded ENG 1 FIRE mode ─────────────────────────────────────
  const fireWarn = !!state.triggersFired["fire_warn"];

  // ENG 1 parameters — degrade progressively as steps are completed
  const eng1MasterOff = done("eng1_master_off");
  const eng1FirePbDone = done("eng1_fire_pb");
  const eng1N1  = eng1MasterOff ? 0   : fireWarn ? 0   : 82;
  const eng1EGT = eng1FirePbDone ? 180 : fireWarn ? 820 : 620;
  const eng1N2  = eng1MasterOff ? 0   : fireWarn ? 0   : 91;
  const eng1FF  = eng1MasterOff ? 0   : fireWarn ? 0   : 2400;

  // ENG 2 — always normal
  const eng2N1  = 84;
  const eng2EGT = 618;
  const eng2N2  = 91;
  const eng2FF  = 2350;

  // Pushbutton states
  const thrState: BtnState   = done("thr_lever_idle")  ? "done"   : fireWarn ? "active" : "disabled";
  const masterState: BtnState= done("eng1_master_off") ? "done"   : done("thr_lever_idle") ? "active" : "disabled";
  const firePbState: BtnState= done("eng1_fire_pb")    ? "done"   : done("eng1_master_off") ? "active" : fireWarn ? "armed" : "disabled";
  const agent1State: BtnState= done("agent1") ? "done" : done("eng1_fire_pb") ? "active" : "disabled";
  const agent2State: BtnState= done("agent2") ? "done" : done("agent1") ? "active" : "disabled";

  function step(id: string) {
    if (!disabled) perform({ kind: "STEP", stepId: id });
  }

  return (
    <div
      className="border border-[var(--color-border)] font-mono select-none flex flex-col"
      style={{ backgroundColor: C.panel, flex: "1 1 0", minHeight: 0 }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-[5px] border-b"
        style={{ borderColor: "#1C2130" }}
      >
        <span
          style={{
            color: C.dim,
            fontSize: "9px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          ENGINE DISPLAY
        </span>
        {fireWarn && (
          <span
            className="animate-pulse font-bold"
            style={{ color: C.red, fontSize: "8px", letterSpacing: "0.2em" }}
          >
            ▲ ENG 1 FIRE
          </span>
        )}
      </div>

      {/* ── Engine gauges ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_1px_1fr] gap-x-2 px-2 pt-3 pb-1 items-start">
        <EngineColumn
          engNum={1}
          n1={eng1N1}
          egt={eng1EGT}
          n2={eng1N2}
          ff={eng1FF}
          failed={fireWarn}
        />

        {/* Vertical divider */}
        <div style={{ backgroundColor: "#1C2130", alignSelf: "stretch" }} />

        <EngineColumn
          engNum={2}
          n1={eng2N1}
          egt={eng2EGT}
          n2={eng2N2}
          ff={eng2FF}
          failed={false}
        />
      </div>

      {/* ── FIRE PANEL section ─────────────────────────────────────────────── */}
      <div
        className="mx-3 mt-2 px-3 py-2 border flex flex-col gap-3"
        style={{
          borderColor: fireWarn ? `${C.red}40` : "#1C2130",
          backgroundColor: fireWarn ? `${C.red}06` : "transparent",
          borderRadius: "2px",
        }}
      >
        {/* Fire panel header */}
        <div className="flex items-center gap-2">
          <div
            style={{
              height: "1px",
              flex: 1,
              backgroundColor: fireWarn ? `${C.red}40` : "#1C2130",
            }}
          />
          <span
            style={{
              fontSize: "8px",
              letterSpacing: "0.25em",
              color: fireWarn ? C.red : C.dim,
              fontFamily: "monospace",
            }}
          >
            FIRE PANEL
          </span>
          <div
            style={{
              height: "1px",
              flex: 1,
              backgroundColor: fireWarn ? `${C.red}40` : "#1C2130",
            }}
          />
        </div>

        {/* Row 1: FIRE P/B (large, centre) + MASTER switch + THR lever */}
        <div className="flex items-start justify-around gap-3">
          {/* Large ENG FIRE pushbutton */}
          <AirbusPB
            topText={done("eng1_fire_pb") ? "ARMED" : fireWarn ? "FIRE" : "FIRE"}
            topColor={C.red}
            label="ENG 1"
            sublabel="FIRE P/B"
            state={firePbState}
            large
            onClick={() => step("eng1_fire_pb")}
          />

          {/* Master switch */}
          <div
            onClick={() => !done("eng1_master_off") && done("thr_lever_idle") && step("eng1_master_off")}
            style={{ cursor: masterState === "active" ? "pointer" : "default" }}
          >
            <MasterSwitch on={!done("eng1_master_off")} />
          </div>

          {/* THR Lever indicator */}
          <div
            onClick={() => fireWarn && !done("thr_lever_idle") && step("thr_lever_idle")}
            style={{ cursor: thrState === "active" ? "pointer" : "default" }}
          >
            <ThrLeverIndicator idle={done("thr_lever_idle")} />
          </div>
        </div>

        {/* Row 2: AGENT 1 + AGENT 2 */}
        <div className="flex justify-around gap-2 pb-1">
          <AirbusPB
            topText={done("agent1") ? "DISCH" : done("eng1_fire_pb") ? "SQUIB ARM" : "SQUIB"}
            topColor={done("agent1") ? C.green : done("eng1_fire_pb") ? C.white : C.dim}
            label="AGENT 1"
            sublabel="DISCH"
            state={agent1State}
            onClick={() => step("agent1")}
          />
          <AirbusPB
            topText={done("agent2") ? "DISCH" : done("agent1") ? "SQUIB ARM" : "SQUIB"}
            topColor={done("agent2") ? C.green : done("agent1") ? C.white : C.dim}
            label="AGENT 2"
            sublabel="DISCH"
            state={agent2State}
            onClick={() => step("agent2")}
          />

          {/* MC cancel indicator */}
          <div className="flex flex-col items-center gap-1">
            <span style={{ fontSize: "7px", color: C.dim, letterSpacing: "0.1em" }}>MSTR CAUT</span>
            <div
              style={{
                width: "40px",
                height: "36px",
                backgroundColor: C.bezel,
                border: `1.5px solid ${state.masterCautActive ? C.amber : C.dimLo}`,
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: state.masterCautActive ? `0 0 8px ${C.amber}60` : "none",
                transition: "all 0.2s",
              }}
            >
              <span
                style={{
                  fontSize: "7px",
                  fontFamily: "monospace",
                  fontWeight: 700,
                  color: state.masterCautActive ? C.amber : C.dimLo,
                  letterSpacing: "0.06em",
                }}
              >
                {done("cancel_master_caut") ? "CLR" : state.masterCautActive ? "CAUT" : "NORM"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Memo / status footer ────────────────────────────────────────────── */}
      <div
        className="px-3 py-2 mt-1 border-t flex flex-col gap-[3px]"
        style={{ borderColor: "#1C2130" }}
      >
        {done("eng1_fire_pb") && !done("agent1") && (
          <div style={{ color: C.amber, fontSize: "9px", letterSpacing: "0.08em", fontFamily: "monospace" }}>
            ◈ WAIT 10 s — N1 DECAY BEFORE AGENT DISCH
          </div>
        )}
        {done("agent1") && !done("agent2") && (
          <div style={{ color: C.cyan, fontSize: "9px", letterSpacing: "0.08em", fontFamily: "monospace" }}>
            ◈ AGENT 1 DISCHARGED — MONITOR FIRE LIGHT 30 s
          </div>
        )}
        {done("agent1") && done("cancel_master_caut") && (
          <div style={{ color: C.green, fontSize: "9px", letterSpacing: "0.08em", fontFamily: "monospace" }}>
            ✓ ENGINE SECURED — CONTINUE ECAM
          </div>
        )}
        {!fireWarn && (
          <div style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.08em", fontFamily: "monospace" }}>
            — NORMAL —
          </div>
        )}
      </div>
    </div>
  );
}
