"use client";

// DESCENT PROFILE — DUAL HYD G+Y procedure progress, plotted by ALTITUDE.
//   A continuous descent from FL350 → GND. Every item sits at the altitude it
//   actually happens (copied from the live dual-hyd-g-y scenario). The aircraft
//   glides down as the procedure progresses; the current step pops up with its
//   prominent points. Driven by the `progress` prop (0..1 = required steps done).
//
// Self-contained (own palette/markup) so it drops into the PROCEDURE PROGRESS
// region without depending on the app's Tailwind tokens.

import { useEffect, useMemo, useRef, useState } from "react";

const TONE: Record<string, string> = {
  warn: "#ff5d5d", cyan: "#38bdf8", blue: "#5aa2ff", amber: "#f6b24b", green: "#34d399",
};

// named phase bar — decision-making sits HIGH (FL240s), not at 10,000.
const PHASES = [
  { nm: "IDENTIFY",      t: "warn",  al: "FL350" },
  { nm: "ECAM ACTIONS",  t: "blue",  al: "↓ FL260" },
  { nm: "DECISION",      t: "amber", al: "FL240" },
  { nm: "APPROACH PREP", t: "cyan",  al: "FL220–15k" },
  { nm: "HOLD",          t: "green", al: "7,000" },
  { nm: "FINAL · LAND",  t: "green", al: "GND" },
];

const AXIS: [string, number][] = [
  ["FL350", 35000], ["25,000", 25000], ["15,000", 15000], ["10,000", 10000], ["7,000", 7000], ["GND", 0],
];

type Step = {
  ph: number; t: string; x: number; ft: number; side: "up" | "down";
  nm: string; qrh?: boolean; bullets: string[]; why: string; y?: number;
};

// The SIGNIFICANT procedural milestones (per FCOM/QRH) — the actions the crew must
// actually DO, placed at the altitude they happen. Routine ATC/descent mechanics
// (DESCENT, DESCEND-10,000, CHANGEOVER) are deliberately NOT cards — they're not a
// procedural criterion. Card order == live order, so the active card tracks the crew.
const STEPS: Step[] = [
  { ph: 0, t: "warn",  x: 5,  ft: 35000, side: "down", nm: "IDENTIFY",          bullets: ["HYD G+Y SYS LO PR (red · CRC)", "MASTER WARN — cancel", "ALTN LAW · gravity gear · no anti-skid"], why: "Dual hyd loss → ALTN LAW now, DIRECT at gear down: slats/flaps slow, gravity gear, no normal brakes/steering." },
  { ph: 0, t: "blue",  x: 11, ft: 34600, side: "up",   nm: "AVIATE · NAVIGATE", bullets: ["PF flies the aircraft", "PM: divert VABB — ILS 27", "Nearest suitable runway"], why: "Fly first, then commit early to the nearest suitable runway — decide while you still have height & time." },
  { ph: 0, t: "cyan",  x: 17, ft: 34000, side: "down", nm: "MAYDAY",            bullets: ["MAYDAY ×3 · IFLY101", "Dual hyd failure · unable RVSM", "Request offset + descent"], why: "MAYDAY buys priority, the descent you need, the offset off the airway, and ground emergency services." },
  { ph: 1, t: "blue",  x: 23, ft: 31000, side: "up",   nm: "ECAM ACTIONS",      bullets: ["PTU . . . . . . OFF", "GREEN ENG-1 PUMP . . OFF", "YELLOW ENG-2 PUMP . . OFF"], why: "The drill reconfigures hydraulics — PTU off (no dry cycling), affected engine pumps off." },
  { ph: 1, t: "warn",  x: 29, ft: 30000, side: "down", nm: "LAND ASAP",         bullets: ["RED — land nearest suitable", "MANEUVER WITH CARE"], why: "RED LAND ASAP = land at the nearest airport where a safe approach can be made." },
  { ph: 1, t: "blue",  x: 35, ft: 28000, side: "up",   nm: "STATUS · INOP",     bullets: ["ALTN LAW (PROT LOST)", "L/G gravity only · ANTI SKID INOP", "APPR SPD VREF+25 · FLAP 3"], why: "STATUS tells you HOW to land — gravity gear, FLAP 3, no anti-skid, accu brakes, VREF+25." },
  { ph: 1, t: "cyan",  x: 41, ft: 26000, side: "down", nm: "QRH SUMMARY", qrh: true, bullets: ["Crew crosscheck — actions complete", "QRH cruise summary read", "MAX SPD 320 / 0.77"], why: "Crosscheck + QRH summary lock in configuration and limits before going lower." },
  { ph: 2, t: "amber", x: 47, ft: 24500, side: "up",   nm: "WEATHER",           bullets: ["Mumbai: wind · RWY 27", "QNH · ILS 27 in use"], why: "Weather feeds the landing decision — runway, wind and approach type confirmed first." },
  { ph: 2, t: "amber", x: 53, ft: 23500, side: "down", nm: "DECISION · FORDEC", bullets: ["Landing performance check", "FORDEC → commit VABB ILS 27", "Decided EARLY — time still in hand"], why: "FORDEC is the structured decision, made HIGH (~FL235) so the whole approach can be set up unhurried." },
  { ph: 2, t: "cyan",  x: 59, ft: 22500, side: "up",   nm: "INFORM ATC · NITS", bullets: ["Inform ATC of intentions", "Request ARFF / emergency services", "NITS to SCCM · pax PA · company"], why: "ATC, cabin and company all need the plan; emergency services pre-positioned for arrival." },
  { ph: 3, t: "cyan",  x: 65, ft: 19000, side: "down", nm: "QRH REVIEW", qrh: true, bullets: ["FMGC: DEST VABB · ILS 27", "QRH review — THE APPROACH", "…THE LANDING · THE GO-AROUND"], why: "The QRH approach/landing/go-around pages drive how this approach must be flown." },
  { ph: 3, t: "blue",  x: 71, ft: 16000, side: "up",   nm: "APPROACH PREP",     bullets: ["VAPP = VREF + 25", "Landing FLAP 3", "GPWS FLAP MODE . . . OFF"], why: "Speeds and config set well before final so the approach is flown clean." },
  { ph: 3, t: "amber", x: 77, ft: 14000, side: "down", nm: "APPROACH BRIEFING", bullets: ["THE APPROACH — ILS 27 · long final", "THE LANDING — FLAP 3 · accu brakes", "THE GO-AROUND — DIRECT law"], why: "Shared mental model — approach, landing technique and go-around all briefed." },
  { ph: 4, t: "green", x: 83, ft: 7000,  side: "up",   nm: "HOLD / VECTORS",    bullets: ["~10,500 ready? → long vectors", "Not ready → hold (2-min legs)", "Level 7,000 · approach checklist"], why: "Don't rush an unstable setup — buy track miles if preparation isn't complete." },
  { ph: 5, t: "blue",  x: 90, ft: 3700,  side: "up",   nm: "FINAL CONFIG",      bullets: ["Descend 3,700 · FLAP 3 · LOC", "GRAVITY GEAR → DIRECT LAW", "Stabilise at VAPP by ~2,500 ft"], why: "Gravity gear + DIRECT law change the feel — be configured & stable before gear." },
  { ph: 5, t: "green", x: 97, ft: 200,   side: "up",   nm: "LANDING",           bullets: ["ILS 27 · G/S–LOC", "Landing CL @ 3,000", "Accu brakes only · no anti-skid"], why: "No anti-skid, accu brakes only — touchdown technique is where it all pays off." },
];

// live link: scenario step id → the significant card it activates. Every card maps
// to the FCOM/QRH step that proves it; the active card follows what the crew does.
const STEP_CARD: Record<string, number> = {
  cancel_master_warn: 0, maintain_control: 1, declare_mayday: 2, ecam_actions: 3,
  land_asap_card: 4, announce_status: 5, qrh_summary_gy: 6, weather_obtained: 7,
  fordec_hyd: 8, inform_atc_intentions: 9, qrh_review: 10, approach_prep_hyd: 11,
  approach_brief_hyd: 12, at_hold_7000: 13, descend_3700: 14, gs_intercept: 15,
};

// refined A320 side silhouette, nose to the right
const PLANE = (
  <svg viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M27 18 L9 2 L21 6 L37 17 Z" fill="#acc0da" />
    <path d="M22 24 L3 21.5 L6 26 L23 27 Z" fill="#acc0da" />
    <path d="M70 30 L44 45 L43 41 L46 41.5 L58 44 L83 31 Z" fill="#b9cbe2" />
    <ellipse cx="58" cy="33.6" rx="9.2" ry="3.7" fill="#8499b5" />
    <ellipse cx="66.5" cy="33.6" rx="2.7" ry="3" fill="#46586f" />
    <path d="M112 25 C104 18.5, 82 16.7, 30 17.8 C20 18.1, 14 20, 14 25 C14 30, 20 31.9, 30 32.2 C82 33.3, 104 31.5, 112 25 Z" fill="#eef4fc" />
    <rect x="30" y="24.3" width="74" height="1.5" rx="0.7" fill="#36c6e0" opacity="0.85" />
    <path d="M101 21.3 L108.5 22.5 L106.5 24.4 L99 23.4 Z" fill="#1b2c42" />
    <g fill="#7f96b2">
      {[40, 46, 52, 58, 64, 70, 76, 82, 88].map((cx) => <circle key={cx} cx={cx} cy="22" r="1" />)}
    </g>
  </svg>
);

const VB_W = 1000, VB_H = 520;
const altY = (ft: number) => 13 + (35000 - Math.max(0, Math.min(35000, ft))) / 35000 * 77;
const ftLabel = (ft: number) => (ft >= 18000 ? "FL" + Math.round(ft / 100) : ft <= 300 ? "GND" : ft.toLocaleString() + " ft");

function roundPath(pts: { x: number; y: number }[], r: number) {
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const v1 = { x: p0.x - p1.x, y: p0.y - p1.y }, v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1, l2 = Math.hypot(v2.x, v2.y) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = { x: p1.x + v1.x / l1 * rr, y: p1.y + v1.y / l1 * rr };
    const b = { x: p1.x + v2.x / l2 * rr, y: p1.y + v2.y / l2 * rr };
    d += ` L ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const e = pts[pts.length - 1];
  d += ` L ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  return d;
}

export function DescentProfile({ progress, currentStepId, liveAlt }: { progress: number; currentStepId?: string; liveAlt?: number }) {
  const prog = Math.max(0, Math.min(1, progress));
  STEPS.forEach((s) => (s.y = altY(s.ft)));

  const pathD = useMemo(
    () => roundPath(STEPS.map((s) => ({ x: s.x / 100 * VB_W, y: s.y! / 100 * VB_H })), Math.min(VB_W, VB_H) * 0.05),
    [],
  );

  const pathRef = useRef<SVGPathElement>(null);
  const [geo, setGeo] = useState<{ total: number; stepFrac: number[] } | null>(null);

  // measure path → total length + each step's fraction along it (once)
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const S = 1000;
    const samp: [number, number, number][] = [];
    for (let s = 0; s <= S; s++) { const L = total * s / S; const q = path.getPointAtLength(L); samp.push([L, q.x, q.y]); }
    const stepFrac = STEPS.map((s) => {
      const px = s.x / 100 * VB_W, py = s.y! / 100 * VB_H;
      let bL = 0, bd = 1e18;
      for (const [L, x, y] of samp) { const dd = (x - px) ** 2 + (y - py) ** 2; if (dd < bd) { bd = dd; bL = L; } }
      return bL / total;
    });
    setGeo({ total, stepFrac });
  }, [pathD]);

  // how far ALONG the path the aircraft physically is — by LIVE ALTITUDE (the honest
  // spine). ft is monotonically descending across STEPS, so interpolate the path
  // fraction between the two cards that bracket the current altitude. Falls back to
  // the procedure % only if no live altitude is supplied.
  const pathFrac = useMemo(() => {
    if (liveAlt == null || !geo) return prog;
    if (liveAlt >= STEPS[0].ft) return 0;
    for (let i = 0; i < STEPS.length - 1; i++) {
      const a0 = STEPS[i].ft, a1 = STEPS[i + 1].ft;
      if (liveAlt <= a0 && liveAlt >= a1) {
        const t = (a0 - liveAlt) / ((a0 - a1) || 1);
        return geo.stepFrac[i] + t * (geo.stepFrac[i + 1] - geo.stepFrac[i]);
      }
    }
    return 1;
  }, [liveAlt, geo, prog]);

  // active card = the live step the crew is on (exact link); else nearest card by
  // where the aircraft physically is (altitude), so it stays consistent with the plane.
  const active = useMemo(() => {
    if (currentStepId && STEP_CARD[currentStepId] != null) return STEP_CARD[currentStepId];
    if (!geo) return 0;
    let best = 0, bd = 1e18;
    geo.stepFrac.forEach((f, i) => { const dd = Math.abs(f - pathFrac); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }, [geo, pathFrac, currentStepId]);

  // plane position (viewBox coords → %) + heading — driven by LIVE altitude
  const plane = useMemo(() => {
    const path = pathRef.current;
    if (!geo || !path) return null;
    const L = pathFrac * geo.total;
    const p = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(geo.total, L + 1));
    const angle = Math.atan2((p2.y - p.y) * (VB_H / VB_W), p2.x - p.x) * 180 / Math.PI;
    return { left: p.x / VB_W * 100, top: p.y / VB_H * 100, angle };
  }, [geo, pathFrac]);

  const act = STEPS[active];
  const curPh = act.ph;
  const cardLeft = Math.max(16, Math.min(84, act.x));
  const cardTop = act.y! + (act.side === "up" ? -19 : 19);

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#eaf1f9", border: "1px solid #22344b", borderRadius: 10, overflow: "hidden", background: "radial-gradient(120% 100% at 14% -10%, #0a1830 0%, #060c18 60%, #04070f 100%)" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px 7px" }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8.5, letterSpacing: "0.25em", color: "#38bdf8", textTransform: "uppercase" }}>Descent Profile · by altitude</span>
        <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 9, color: "#62748c" }}>
          {ftLabel(act.ft)} · {act.nm}
        </span>
      </div>

      {/* phase bar */}
      <div style={{ display: "flex", gap: 5, padding: "0 14px 8px" }}>
        {PHASES.map((p, i) => {
          const st = i < curPh ? "done" : i === curPh ? "active" : "";
          const tone = TONE[p.t];
          return (
            <div key={p.nm} style={{
              flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 1, padding: "5px 8px 6px",
              borderRadius: 8, border: `1px solid ${st === "active" ? tone : "#22344b"}`,
              background: st === "active" ? "linear-gradient(180deg,#13243a,#0d1828)" : "#0c1726aa",
              boxShadow: st === "active" ? `0 0 0 1px ${tone}, 0 0 16px -4px ${tone}` : "none",
              opacity: st === "active" ? 1 : st === "done" ? 0.62 : 0.4, transition: "all .5s cubic-bezier(.4,0,.4,1)",
            }}>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 7.5, letterSpacing: "0.04em", color: st === "active" ? tone : st === "done" ? "#34d399" : "#62748c" }}>{p.al}</span>
              <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: st === "active" ? "#fff" : "#9aabc0" }}>{p.nm}</span>
            </div>
          );
        })}
      </div>

      {/* chart */}
      <div style={{ position: "relative", height: 360, margin: "0 12px" }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id="dpg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff7a7a" /><stop offset=".2" stopColor="#36c6e0" />
              <stop offset=".55" stopColor="#7dd3c8" /><stop offset=".8" stopColor="#f6b24b" /><stop offset="1" stopColor="#34d399" />
            </linearGradient>
          </defs>
          {AXIS.map(([, ft]) => <line key={ft} x1={40} y1={altY(ft) / 100 * VB_H} x2={VB_W} y2={altY(ft) / 100 * VB_H} stroke="#16263b" strokeWidth={1} strokeDasharray="2 9" />)}
          <path ref={pathRef} d={pathD} fill="none" stroke="#2c4663" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.5} strokeDasharray="2 9" />
          <path d={pathD} fill="none" stroke="url(#dpg)" strokeWidth={3.6} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={geo?.total ?? 0} strokeDashoffset={geo ? geo.total * (1 - pathFrac) : 0}
            style={{ transition: "stroke-dashoffset .7s cubic-bezier(.4,0,.4,1)", filter: "drop-shadow(0 0 6px #36c6e088)" }} />
          {/* dotted leader: marker dot → active card edge */}
          <line
            x1={act.x / 100 * VB_W} y1={act.y! / 100 * VB_H}
            x2={cardLeft / 100 * VB_W}
            y2={cardTop / 100 * VB_H + (act.side === "up" ? 1 : -1) * VB_H * 0.05}
            stroke={TONE[act.t]} strokeWidth={1.6} strokeDasharray="2 4" strokeLinecap="round"
            opacity={0.75} style={{ transition: "all .4s cubic-bezier(.4,0,.4,1)" }}
          />
        </svg>

        {/* altitude labels */}
        {AXIS.map(([l, ft]) => (
          <div key={l} style={{ position: "absolute", left: 0, top: `${altY(ft)}%`, transform: "translateY(-50%)", fontFamily: "ui-monospace, monospace", fontSize: 9, color: "#62748c", letterSpacing: "0.05em", background: "#060c18cc", padding: "1px 5px", borderRadius: 3 }}>{l}</div>
        ))}

        {/* breadcrumb markers */}
        {STEPS.map((s, i) => {
          const done = geo ? geo.stepFrac[i] < pathFrac - 0.005 : false;
          const isAct = i === active;
          const tone = TONE[s.t];
          return (
            <div key={s.nm} style={{
              position: "absolute", left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%,-50%)${isAct ? " scale(1.3)" : ""}`,
              width: 10, height: 10, borderRadius: "50%",
              background: done || isAct ? tone : "#0c1726",
              border: `2px solid ${done || isAct ? tone : "#2c4663"}`,
              boxShadow: isAct ? `0 0 0 3px #060c18, 0 0 14px ${tone}` : done ? `0 0 8px -1px ${tone}` : "none",
              opacity: done || isAct ? 1 : 0.5, transition: "all .4s",
            }} />
          );
        })}

        {/* plane */}
        {plane && (
          <div style={{
            position: "absolute", left: `${plane.left}%`, top: `${plane.top}%`, width: 76, height: 31,
            transform: `translate(-50%,-50%) rotate(${plane.angle}deg)`,
            transition: "left .7s cubic-bezier(.4,0,.4,1), top .7s cubic-bezier(.4,0,.4,1), transform .7s cubic-bezier(.4,0,.4,1)",
            filter: "drop-shadow(0 5px 11px #000c) drop-shadow(0 0 14px #36c6e0aa)", zIndex: 6,
          }}>{PLANE}</div>
        )}

        {/* runway */}
        <div style={{ position: "absolute", left: `${STEPS[STEPS.length - 1].x}%`, top: `calc(${STEPS[STEPS.length - 1].y}% + 14px)`, transform: "translate(-50%,-50%) rotate(-3deg)", height: 7, width: 48, borderRadius: 3, background: "repeating-linear-gradient(90deg,#2a3a4f 0 11px,#13567f 11px 22px)", boxShadow: "0 0 16px #34d39955" }} />

        {/* active card */}
        {act && (
          <div key={active} style={{
            position: "absolute", left: `${cardLeft}%`, top: `${cardTop}%`, transform: "translate(-50%,-50%)",
            width: "clamp(178px,17vw,236px)", zIndex: 7, background: "linear-gradient(180deg,#13233a,#0c1626)",
            border: `1px solid ${TONE[act.t]}`, borderRadius: 12, padding: "10px 13px 11px",
            boxShadow: `0 0 0 1px ${TONE[act.t]}, 0 16px 42px #000a, 0 0 40px -8px ${TONE[act.t]}`,
            animation: "dpPop .3s cubic-bezier(.34,1.4,.5,1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: TONE[act.t], boxShadow: `0 0 8px ${TONE[act.t]}` }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em" }}>{act.nm}</span>
              {act.qrh && <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8, letterSpacing: "0.12em", color: "#06101c", background: "#38bdf8", padding: "1px 5px", borderRadius: 4 }}>QRH</span>}
              <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: "#f6b24b", fontWeight: 600 }}>{ftLabel(act.ft)}</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              {act.bullets.map((b) => (
                <li key={b} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: "#eaf1f9", lineHeight: 1.34 }}>
                  <span style={{ flex: "none", width: 6, height: 6, marginTop: 5, borderRadius: "50%", background: TONE[act.t], boxShadow: `0 0 6px ${TONE[act.t]}` }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* key point */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 12px 12px", padding: "7px 13px", borderRadius: 9, background: "linear-gradient(90deg,#0d1828,#0b1322)", border: `1px solid ${TONE[act.t]}`, boxShadow: `0 0 20px -8px ${TONE[act.t]}` }}>
        <span style={{ flex: "none", fontFamily: "ui-monospace, monospace", fontSize: 8.5, letterSpacing: "0.2em", color: TONE[act.t], textTransform: "uppercase" }}>Key point</span>
        <span style={{ fontSize: 11.5, color: "#eaf1f9", lineHeight: 1.3 }}>{act.why}</span>
      </div>

      <style>{`@keyframes dpPop{from{opacity:0;transform:translate(-50%,-50%) scale(.9)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>
    </div>
  );
}
