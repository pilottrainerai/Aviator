"use client";

import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, SysSwState } from "@/scenarios/types";
import { evalSysCase, SYS_COLORS } from "@/components/cockpit/system-display";

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

function AirbusPB({
  topText,
  topColor,
  label,
  sublabel,
  state: btnState,
  onClick,
  wide = false,
  large = false,
}: {
  topText: string;
  topColor: string;
  label: string;
  sublabel?: string;
  state: BtnState;
  onClick?: () => void;
  wide?: boolean;
  large?: boolean;
}) {
  const isClickable = onClick && btnState !== "disabled" && btnState !== "done";

  const glowColor =
    btnState === "active"  ? C.red
    : btnState === "armed" ? C.white
    : btnState === "done"  ? C.green
    : "transparent";

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      style={{
        cursor: isClickable ? "pointer" : "default",
        width: large ? "96px" : wide ? "80px" : "68px",
        userSelect: "none",
        filter: btnState === "disabled" ? "brightness(0.4)" : "none",
      }}
    >
      {/* Outer bezel */}
      <div
        style={{
          backgroundColor: C.bezel,
          border: `2px solid ${btnState === "active" ? C.red : btnState === "armed" ? C.amber : "#2A303C"}`,
          borderRadius: "3px",
          padding: "2px",
          boxShadow:
            btnState === "active"
              ? `0 0 14px ${C.red}80, inset 0 0 6px ${C.red}20`
              : btnState === "armed"
              ? `0 0 10px ${C.amber}60`
              : btnState === "done"
              ? `0 0 8px ${C.green}40`
              : "none",
          transition: "box-shadow 0.2s, border-color 0.2s",
        }}
      >
        {/* LED indicator area */}
        <div
          style={{
            backgroundColor:
              btnState === "active"  ? `${C.red}CC`
              : btnState === "armed" ? `${C.white}20`
              : btnState === "done"  ? `${C.green}25`
              : C.ledOff,
            borderRadius: "2px 2px 0 0",
            padding: large ? "7px 6px 5px" : "4px 5px",
            textAlign: "center",
            minHeight: large ? "34px" : "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.2s",
          }}
        >
          <span
            style={{
              fontSize: large ? "10px" : "8px",
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color:
                btnState === "active"  ? "#FFFFFF"
                : btnState === "armed" ? C.white
                : btnState === "done"  ? C.green
                : C.dimLo,
              textTransform: "uppercase",
              textShadow: btnState === "active" ? `0 0 8px ${C.red}` : "none",
            }}
          >
            {topText}
          </span>
        </div>

        {/* Button face / label area */}
        <div
          style={{
            backgroundColor: C.btnFace,
            borderRadius: "0 0 2px 2px",
            padding: large ? "8px 6px 6px" : "5px 5px 4px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: large ? "11px" : "9px",
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: C.white,
              lineHeight: 1.2,
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>
          {sublabel && (
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

      {/* Guard frame indicator for FIRE pb */}
      {btnState === "active" && large && (
        <div
          style={{
            height: "2px",
            backgroundColor: C.red,
            borderRadius: "0 0 2px 2px",
            marginTop: "1px",
            boxShadow: `0 0 6px ${C.red}`,
          }}
        />
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

// ─── DSL interactive control: THR LEVER ──────────────────────────────────────
function DslThrLeverCtrl({ done, active, clickable, onClick }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.amber : C.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>THR LVR 1</span>
      <div style={{ width: "36px", height: "76px", backgroundColor: C.bezel, border: `2px solid ${active ? C.amber : done ? C.amber : C.dimLo}`, borderRadius: "4px", position: "relative", boxShadow: active ? `0 0 10px ${C.amber}60` : done ? `0 0 8px ${C.amber}40` : "none", transition: "all 0.2s" }}>
        {["CLB","MCT","IDLE"].map((pos, i) => (
          <div key={pos} style={{ position: "absolute", right: "-26px", top: `${8 + i * 20}px`, fontSize: "7px", fontFamily: "monospace", color: C.dimLo, letterSpacing: "0.06em" }}>{pos}</div>
        ))}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: done ? "46px" : "8px", width: "22px", height: "16px", backgroundColor: done ? `${C.amber}CC` : "#3A4252", border: `1.5px solid ${done ? C.amber : C.dim}`, borderRadius: "3px", transition: "top 0.35s ease", boxShadow: done ? `0 0 6px ${C.amber}60` : "none" }} />
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.amber : C.green, letterSpacing: "0.1em", fontWeight: 700 }}>{done ? "IDLE ✓" : "CLB"}</span>
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

// ─── DSL interactive control: ENG MASTER ─────────────────────────────────────
function DslMasterSwCtrl({ done, active, clickable, onClick, label }: { done: boolean; active: boolean; clickable: boolean; onClick: () => void; label: string }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: clickable ? "pointer" : "default", opacity: (!active && !done) ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.amber : C.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      <div style={{ width: "52px", height: "68px", backgroundColor: C.bezel, border: `2px solid ${active ? C.amber : done ? C.amber : C.dimLo}`, borderRadius: "4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "6px 5px", boxShadow: active ? `0 0 12px ${C.amber}60` : done ? `0 0 10px ${C.amber}40` : "none", transition: "all 0.2s" }}>
        <div style={{ fontSize: "9px", fontFamily: "monospace", fontWeight: 800, color: done ? C.dimLo : C.green, letterSpacing: "0.12em" }}>ON</div>
        <div style={{ width: "28px", height: "18px", backgroundColor: done ? "#1A1E28" : "#2E3A28", border: `1.5px solid ${done ? C.dim : C.green}`, borderRadius: "3px", transform: done ? "translateY(6px)" : "translateY(-6px)", transition: "transform 0.25s, background-color 0.2s", boxShadow: done ? "none" : `0 0 4px ${C.green}40` }} />
        <div style={{ fontSize: "9px", fontFamily: "monospace", fontWeight: 800, color: done ? C.amber : C.dimLo, letterSpacing: "0.12em" }}>OFF</div>
      </div>
      <span style={{ fontSize: "8px", fontFamily: "monospace", color: done ? C.amber : C.green, letterSpacing: "0.08em", fontWeight: 700 }}>{done ? "OFF ✓" : "ON"}</span>
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
  controls, scenario, state, perform, disabled, warningActive,
}: {
  controls: import("@/scenarios/types").EngControlDef[];
  scenario: Scenario;
  state: ScenarioState;
  perform: (a: PilotAction) => void;
  disabled?: boolean;
  warningActive: boolean;
}) {
  const isDone   = (id: string) => !!state.completedSteps[id];
  const allDone  = controls.every(c => isDone(c.stepId));

  return (
    <div style={{ borderTop: "1px solid #1C2130", backgroundColor: warningActive ? "#060A12" : "#050709", padding: "6px 10px 8px" }}>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <div style={{ flex: 1, height: "1px", backgroundColor: warningActive ? `${C.amber}30` : "#1C2130" }} />
        <span style={{ fontSize: "7px", fontFamily: "monospace", letterSpacing: "0.25em", color: warningActive ? C.amber : C.dim, textTransform: "uppercase" }}>ACTION PANEL</span>
        <div style={{ flex: 1, height: "1px", backgroundColor: warningActive ? `${C.amber}30` : "#1C2130" }} />
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center", alignItems: "flex-end", flexWrap: "wrap", paddingLeft: "6px", paddingRight: "6px" }}>
        {controls.map((ctrl) => {
          const done    = isDone(ctrl.stepId);
          const step    = scenario.steps.find(s => s.id === ctrl.stepId);
          const reqsMet = (step?.requires ?? []).every(r => !!state.completedSteps[r]);
          const active  = !done && reqsMet && warningActive;
          const clickable = !done && reqsMet && warningActive && !disabled;
          const onClick = () => { if (clickable) perform({ kind: "STEP", stepId: ctrl.stepId }); };

          switch (ctrl.kind) {
            case "thr_lever": return <DslThrLeverCtrl key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} />;
            case "mode_sel":  return <DslModeSelCtrl  key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} />;
            case "master":    return <DslMasterSwCtrl key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} />;
            case "fire_pb":   return (
              <AirbusPB key={ctrl.stepId} topText={done ? "ARMED" : active ? "FIRE" : "FIRE"} topColor={C.red} label={ctrl.label} sublabel={ctrl.sub} large
                state={done ? "done" : active ? "active" : "disabled"} onClick={clickable ? onClick : undefined} />
            );
            case "agent":     return (
              <AirbusPB key={ctrl.stepId} topText={done ? "DISCH" : active ? "SQUIB ARM" : "SQUIB"} topColor={done ? C.green : active ? C.white : C.dim}
                label={ctrl.label} sublabel={ctrl.sub} large state={done ? "done" : active ? "active" : "disabled"} onClick={clickable ? onClick : undefined} />
            );
            case "cancel_warn": return <DslCancelWarnCtrl key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} />;
            case "cancel_caut": return <DslCancelCautCtrl key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} />;
            case "o2_mask":     return <DslO2MaskCtrl     key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
            case "toggle_sw":   return <DslToggleSwCtrl   key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
            case "emer_pb":     return <DslEmerPbCtrl     key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
            case "spd_brk":     return <DslSpdBrkCtrl     key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} />;
            default:            return <DslMonitorCtrl    key={ctrl.stepId} done={done} active={active} clickable={clickable} onClick={onClick} label={ctrl.label} sub={ctrl.sub} />;
          }
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

    // Collect trays from both panels (full-width below grid)
    const allTrays = [...(ed.eng1.trays ?? []), ...(ed.eng2.trays ?? [])];

    return (
      <div
        className="border border-[var(--color-border)] font-mono select-none flex flex-col"
        style={{ backgroundColor: C.panel, flex: "1 1 0", minHeight: 0, overflowY: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-[5px] border-b" style={{ borderColor: "#1C2130" }}>
          <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.25em", textTransform: "uppercase" }}>ENGINE DISPLAY</span>
          {warningActive && (
            <span className="animate-pulse font-bold" style={{ color: C.amber, fontSize: "8px", letterSpacing: "0.2em" }}>
              ▲ {state.alarmLabel ?? "CAUTION"}
            </span>
          )}
        </div>

        {/* Engine parameter grid — equal-height columns, no trays here */}
        <div className="grid grid-cols-[1fr_1px_1fr] gap-x-2 px-1 pt-2 pb-1" style={{ alignItems: "start" }}>
          <DslEnginePanel engNum={1} panel={ed.eng1} state={state} warningActive={warningActive} />
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
