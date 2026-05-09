"use client";

import { useState, useEffect } from "react";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, SysSwState } from "@/scenarios/types";
import { evalSysCase, SYS_COLORS } from "@/components/cockpit/system-display";

// ─── CSS keyframes (AGENT arming pulse, TEST pulse) ─────────────────────────
// Injected once via <style> in the panel root.
const FIRE_PANEL_CSS = `
@keyframes agent-arming-pulse {
  0%, 100% { background-color: rgba(255, 179, 0, 0.12); box-shadow: inset 0 0 2px rgba(255,179,0,0.30); }
  50%      { background-color: rgba(255, 179, 0, 0.55); box-shadow: 0 0 6px rgba(255,179,0,0.65); }
}
@keyframes fire-light-pulse {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 1; }
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

  const bezelBorder =
    btnState === "active" ? legendCol :
    btnState === "armed"  ? C.white :
    btnState === "done"   ? C.amber :
    legendLit             ? legendCol :
    "#2A303C";

  // ledBg / ledTextColor: lit whenever btnState is active/armed/done OR the
  // caller explicitly says legendLit (fire-light-on-pb-not-yet-pushed case).
  const lit = btnState === "active" || legendLit;
  const ledBg =
    lit                    ? `${legendCol}CC` :
    btnState === "armed"   ? `${C.white}28` :
    btnState === "done"    ? `${legendCol}25` :
    C.ledOff;

  const ledTextColor =
    lit                    ? "#FFFFFF" :
    btnState === "armed"   ? C.white :
    btnState === "done"    ? legendCol :
    C.dimLo;

  const containerShadow =
    lit                    ? `0 0 14px ${legendCol}90, inset 0 0 6px ${legendCol}20` :
    btnState === "armed"   ? `0 0 10px ${C.white}50` :
    btnState === "done"    ? `0 0 8px ${legendCol}40` :
    "none";

  return (
    <div
      style={{
        cursor: isClickable ? "pointer" : "default",
        width: large ? "108px" : wide ? "80px" : "68px",
        userSelect: "none",
        filter: btnState === "disabled" ? "brightness(0.4)" : "none",
        position: "relative",
      }}
    >
      {/* Recessed metal frame around the pb — gives the "in the panel" look. */}
      {large && (
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
          {/* The wireframe guard frame, hinged at top */}
          <div style={{
            position: "absolute",
            top: "0", left: "0", right: "0",
            height: "20px",
            transformOrigin: "50% 0%",
            transform: guardLifted
              ? "rotateX(-115deg) translateZ(0)"
              : "rotateX(0deg) translateZ(0)",
            transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
            backfaceVisibility: "hidden",
          }}>
            {/* Outer frame — thin metal outline */}
            <div style={{
              position: "absolute", inset: 0,
              border: "1.5px solid #6A7488",
              borderRadius: "2px",
              backgroundColor: "rgba(40, 46, 56, 0.10)",
              boxShadow: guardLifted
                ? "none"
                : "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.4)",
            }} />
            {/* Diagonal wire 1 (top-left → bottom-right) */}
            <div style={{
              position: "absolute",
              top: "50%", left: "0",
              width: "100%", height: "1.2px",
              transformOrigin: "50% 50%",
              transform: "rotate(28deg)",
              background: "linear-gradient(90deg, #4A5260 0%, #B0B8C0 50%, #4A5260 100%)",
              boxShadow: "0 1px 0 rgba(0,0,0,0.45)",
              opacity: guardLifted ? 0.4 : 1,
            }} />
            {/* Diagonal wire 2 (top-right → bottom-left) */}
            <div style={{
              position: "absolute",
              top: "50%", left: "0",
              width: "100%", height: "1.2px",
              transformOrigin: "50% 50%",
              transform: "rotate(-28deg)",
              background: "linear-gradient(90deg, #4A5260 0%, #B0B8C0 50%, #4A5260 100%)",
              boxShadow: "0 1px 0 rgba(0,0,0,0.45)",
              opacity: guardLifted ? 0.4 : 1,
            }} />
            {/* Center pivot dot — where the two wires cross */}
            <div style={{
              position: "absolute",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "3px", height: "3px",
              background: "radial-gradient(circle at 30% 30%, #C8D0D8 0%, #5A6470 100%)",
              borderRadius: "50%",
              opacity: guardLifted ? 0.5 : 1,
            }} />
          </div>
        </div>
      )}

      {/* Outer bezel — pops up slightly when pushed (out) */}
      <div
        onClick={isClickable ? onClick : undefined}
        style={{
          backgroundColor: C.bezel,
          border: `2px solid ${bezelBorder}`,
          borderRadius: "2px",
          padding: "2px",
          boxShadow: containerShadow,
          transition: "box-shadow 0.2s, border-color 0.2s, transform 0.25s",
          transform: pbOut ? "translateY(-3px)" : "translateY(0)",
          cursor: isClickable ? "pointer" : "default",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* "OUT" indicator — small amber dot when pb has been pushed AND fire
            is no longer detected (so the user can see the pb is mechanically
            out even with the FIRE light off) */}
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

        {/* Top legend cell — "FIRE" (red) for the FIRE pb */}
        <div
          style={{
            backgroundColor: ledBg,
            borderRadius: "1px 1px 0 0",
            padding: large ? "8px 6px 6px" : "4px 5px",
            textAlign: "center",
            minHeight: large ? "26px" : "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.2s",
          }}
        >
          <span
            style={{
              fontSize: large ? "16px" : "8px",
              fontFamily: "monospace",
              fontWeight: 800,
              letterSpacing: "0.12em",
              color: ledTextColor,
              textTransform: "uppercase",
              textShadow: lit ? `0 0 10px ${legendCol}, 0 0 4px #fff` : btnState === "done" ? `0 0 6px ${legendCol}80` : "none",
            }}
          >
            {topText}
          </span>
        </div>

        {/* Bottom face — the engine label and "PUSH" instruction */}
        <div
          style={{
            backgroundColor: C.btnFace,
            borderRadius: "0 0 1px 1px",
            padding: large ? "5px 6px 7px" : "5px 5px 4px",
            textAlign: "center",
            borderTop: `1px solid ${bezelBorder}40`,
          }}
        >
          <div
            style={{
              fontSize: large ? "10px" : "9px",
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: C.white,
              lineHeight: 1.2,
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>
          {/* "PUSH" sub-legend — appears only on large pbs (the FIRE pb) */}
          {large && (
            <div
              style={{
                fontSize: "8px",
                fontFamily: "monospace",
                color: btnState === "active" ? legendCol : C.dim,
                fontWeight: 700,
                letterSpacing: "0.18em",
                marginTop: "3px",
                textTransform: "uppercase",
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

  const squibLit = isArmed;                // armed, ready to fire (solid white)
  const dischLit = done;                   // agent fired (solid amber)
  const accent =
    dischLit ? C.amber :
    squibLit ? C.white :
    arming   ? `${C.amber}80` :
    C.dimLo;

  return (
    <div
      style={{
        userSelect: "none",
        width: "52px",
        opacity: (!active && !done) ? 0.45 : 1,
        transition: "opacity 0.2s",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}
    >
      <div
        onClick={isClickable ? onClick : undefined}
        style={{
          cursor: isClickable ? "pointer" : "default",
          width: "52px", height: "52px",
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

        {/* Square pb body — equal width and height per FCOM AGENT pb proportions */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundColor: C.bezel,
          border: `1.5px solid ${accent}`,
          borderRadius: "2px",
          padding: "3px",
          display: "flex", flexDirection: "column",
          gap: "2px",
          boxShadow:
            dischLit ? `0 0 8px ${C.amber}50` :
            squibLit ? `0 0 6px ${C.white}40` :
            arming   ? `0 0 4px ${C.amber}45` :
            "none",
          transition: "all 0.2s",
          zIndex: 1,
        }}>
          {/* SQUIB cell — pulses amber during arming, solid white when armed */}
          <div style={{
            flex: 1,
            backgroundColor: arming ? undefined : (squibLit ? `${C.white}30` : C.ledOff),
            animation: arming ? "agent-arming-pulse 1s ease-in-out infinite" : undefined,
            borderRadius: "1px",
            display: "flex",
            alignItems: "center", justifyContent: "center",
            transition: "background-color 0.2s",
          }}>
            <span style={{
              fontSize: "9px", fontFamily: "monospace", fontWeight: 800,
              color: squibLit ? C.white : arming ? C.amber : C.dimLo,
              letterSpacing: "0.08em",
              textShadow: squibLit ? `0 0 4px ${C.white}` : arming ? `0 0 3px ${C.amber}` : "none",
            }}>SQUIB</span>
          </div>

          {/* DISCH cell (bottom half) */}
          <div style={{
            flex: 1,
            backgroundColor: dischLit ? `${C.amber}30` : C.ledOff,
            borderRadius: "1px",
            display: "flex",
            alignItems: "center", justifyContent: "center",
            transition: "background-color 0.2s",
          }}>
            <span style={{
              fontSize: "9px", fontFamily: "monospace", fontWeight: 800,
              color: dischLit ? C.amber : C.dimLo,
              letterSpacing: "0.08em",
              textShadow: dischLit ? `0 0 4px ${C.amber}` : "none",
            }}>DISCH</span>
          </div>
        </div>
      </div>

      {/* Label below the pb body */}
      <div style={{
        marginTop: "6px",
        textAlign: "center",
        fontSize: "8px", fontFamily: "monospace", fontWeight: 700,
        color: dischLit ? C.amber : squibLit ? C.white : arming ? C.amber : C.dim,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        transition: "color 0.2s",
      }}>
        {label}
        {sub && (
          <span style={{ display: "block", fontSize: "7px", color: C.dim, marginTop: "1px", letterSpacing: "0.08em" }}>
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
    <div className="flex items-baseline justify-between px-2 py-[3px]" style={{ borderBottom: "1px solid #1C2130" }}>
      <span style={{ color: "#8A9AAE", fontSize: "9px", letterSpacing: "0.08em", fontFamily: "monospace" }}>{label}</span>
      <span style={{ color, fontSize: "11px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.06em" }}>
        {value}{unit && <span style={{ color: "#6A7A8A", fontSize: "8px", marginLeft: "3px" }}>{unit}</span>}
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
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: warningActive ? C.amber : C.dim, letterSpacing: "0.2em", fontWeight: 700, padding: "4px 8px 2px" }}>
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
  // Dev mode (?dev=1) — gates the P1/P2/P3 reference tags on procedure controls.
  // Computed in useEffect so SSR and first client render agree (no hydration
  // mismatch); the tags appear right after mount.
  const [isDevMode, setIsDevMode] = useState(false);
  useEffect(() => {
    setIsDevMode(new URLSearchParams(window.location.search).has("dev"));
  }, []);

  return (
    <div style={{ borderTop: "1px solid #1C2130", backgroundColor: warningActive ? "#060A12" : "#050709", padding: "6px 10px 8px" }}>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <div style={{ flex: 1, height: "1px", backgroundColor: warningActive ? `${C.amber}30` : "#1C2130" }} />
        <span style={{ fontSize: "7px", fontFamily: "monospace", letterSpacing: "0.25em", color: warningActive ? C.amber : C.dim, textTransform: "uppercase" }}>ACTION PANEL</span>
        <div style={{ flex: 1, height: "1px", backgroundColor: warningActive ? `${C.amber}30` : "#1C2130" }} />
      </div>

      {/* Controls row — each control wrapped with a P1/P2/P3 reference tag
          for change requests (no functional effect). */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center", alignItems: "flex-end", flexWrap: "wrap", paddingLeft: "6px", paddingRight: "6px" }}>
        {controls.map((ctrl, idx) => {
          const done    = isDone(ctrl.stepId);
          const step    = scenario.steps.find(s => s.id === ctrl.stepId);
          const reqsMet = (step?.requires ?? []).every(r => !!state.completedSteps[r]);
          const active  = !done && reqsMet && warningActive;
          const clickable = !done && reqsMet && warningActive && !disabled;
          const onClick = () => { if (clickable) perform({ kind: "STEP", stepId: ctrl.stepId }); };

          let inner: React.ReactNode;
          switch (ctrl.kind) {
            case "thr_lever":   inner = <DslThrLeverCtrl   done={done} active={active} clickable={clickable} onClick={onClick} />; break;
            case "mode_sel":    inner = <DslModeSelCtrl    done={done} active={active} clickable={clickable} onClick={onClick} />; break;
            case "master":      inner = <DslMasterSwCtrl   done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} warningActive={warningActive} />; break;
            case "fire_pb":     inner = (
              <AirbusPB topText="FIRE" topColor={C.red} label={ctrl.label} sublabel={ctrl.sub} large
                legendLit={fireLit}
                state={done ? "done" : active ? "active" : "disabled"} onClick={clickable ? onClick : undefined} />
            ); break;
            case "agent":       inner = <AgentPb done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />; break;
            case "cancel_warn": inner = <DslCancelWarnCtrl done={done} active={active} clickable={clickable} onClick={onClick} />; break;
            case "cancel_caut": inner = <DslCancelCautCtrl done={done} active={active} clickable={clickable} onClick={onClick} />; break;
            case "o2_mask":     inner = <DslO2MaskCtrl     done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />; break;
            case "toggle_sw":   inner = <DslToggleSwCtrl   done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />; break;
            case "emer_pb":     inner = <DslEmerPbCtrl     done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />; break;
            case "spd_brk":     inner = <DslSpdBrkCtrl     done={done} active={active} clickable={clickable} onClick={onClick} />; break;
            default:            inner = <DslMonitorCtrl    done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
          }

          return (
            <div key={ctrl.stepId} style={{ position: "relative" }}>
              {isDevMode && (
                <span style={{
                  position: "absolute",
                  top: "-9px",
                  left: "-4px",
                  padding: "2px 6px",
                  backgroundColor: "#FFEB3B",   // bright yellow — high contrast, dev-only
                  color: "#000",
                  fontSize: "11px",
                  fontWeight: 800,
                  fontFamily: "monospace",
                  letterSpacing: "0.05em",
                  borderRadius: "3px",
                  boxShadow: "0 0 0 1px #000, 0 1px 3px rgba(0,0,0,0.6)",
                  pointerEvents: "none",
                  zIndex: 10,
                }}>P{idx + 1}</span>
              )}
              {inner}
            </div>
          );
        })}
      </div>

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
        <div className="flex items-center justify-between px-3 py-[5px] border-b" style={{ borderColor: "#1C2130" }}>
          <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.25em", textTransform: "uppercase" }}>ENGINE DISPLAY</span>
          {fireLit && (
            <span className="animate-pulse font-bold" style={{ color: C.amber, fontSize: "8px", letterSpacing: "0.2em" }}>
              ▲ {state.alarmLabel ?? "CAUTION"}
            </span>
          )}
        </div>

        {/* Engine parameter grid — equal-height columns, no trays here */}
        <div className="grid grid-cols-[1fr_1px_1fr] gap-x-2 px-1 pt-2 pb-1" style={{ alignItems: "start" }}>
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
