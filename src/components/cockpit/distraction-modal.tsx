"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ScenarioDistraction, DistractionKind } from "@/scenarios/types";

const KIND_STYLE: Record<
  DistractionKind,
  { accent: string; bg: string; badge: string; icon: string }
> = {
  atc:         { accent: "#00D060", bg: "#00D06012", badge: "ATC",      icon: "📡" },
  crew:        { accent: "#00CFFF", bg: "#00CFFF10", badge: "CREW",     icon: "🎧" },
  cabin:       { accent: "#FFB300", bg: "#FFB30010", badge: "CABIN",    icon: "🔔" },
  company:     { accent: "#4F8CFF", bg: "#4F8CFF10", badge: "OPS",      icon: "📟" },
  flightcheck: { accent: "#E6E8EC", bg: "#E6E8EC08", badge: "PF CHECK", icon: "✈"  },
};

const AUTO_DISMISS_DEFAULT = 20_000;

// Comms exchange direction colours — INBOUND (ATC → crew) green, OUTBOUND (crew → ATC) blue.
// Same card layout / sequence; colour just encodes who's transmitting. [user 2026-07-07]
const DIR_IN = "#35C46E", DIR_OUT = "#5C9CF5";

// ─── ATC/Comms modal — always LEFT side ──────────────────────────────────────
// Positions on the left half of the screen so the crew action popup (right)
// can be visible simultaneously. No backdrop — cockpit stays readable.

export function DistractionModal({
  distraction,
  onRespond,
  onStandby,
  liveAltFt,
  inline = false,
  noAutoDismiss = false,
  flashing = false,
}: {
  distraction: ScenarioDistraction;
  onRespond: (choiceId: string, correct: boolean) => void;
  onStandby: () => void;
  /** Current aircraft altitude in feet — substituted for [ALT] in message and choice labels */
  liveAltFt?: number;
  /** true = render as a block inside the right panel (no fixed position, no backdrop) */
  inline?: boolean;
  /** true = card NEVER auto-collapses; it stays until answered (no countdown to standby) */
  noAutoDismiss?: boolean;
  /** true = this card is the active surface → the deep ring + breathing lift (ccLift). */
  flashing?: boolean;
}) {
  const altStr = liveAltFt != null ? String(Math.round(liveAltFt / 100) * 100) : "[ALT]";
  // [STATION] = the controlling agency, dynamic on the changeover: once the aircraft is
  // through 15 000 ft it's Mumbai Approach, otherwise still Mumbai Control. [STATION_CAPS]
  // is the same in upper case for the card header (`from`).
  const station = liveAltFt != null && liveAltFt <= 15_000 ? "Mumbai Approach" : "Mumbai Control";
  const subAlt = (text: string) =>
    text
      .replace(/\[ALT\]/g, altStr)
      .replace(/\[STATION_CAPS\]/g, station.toUpperCase())
      .replace(/\[STATION\]/g, station);

  const autoDismissMs = distraction.autoDismissMs ?? AUTO_DISMISS_DEFAULT;
  const [remainingMs, setRemainingMs] = useState(autoDismissMs);
  const startedAt = useRef(performance.now());

  useEffect(() => {
    startedAt.current = performance.now();
    setRemainingMs(autoDismissMs);
  }, [distraction.id, autoDismissMs]);

  useEffect(() => {
    if (noAutoDismiss) return;   // comm card stays until answered — no auto-collapse
    const id = setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      const left = autoDismissMs - elapsed;
      if (left <= 0) {
        clearInterval(id);
        onStandby();
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [autoDismissMs, onStandby, distraction.id, noAutoDismiss]);

  const style = KIND_STYLE[distraction.kind];
  // Crew-initiated card = the crew is making the call → whole card is OUTBOUND; the message
  // field is a redundant context prompt, so it isn't shown. ATC cards show the INBOUND message
  // (green) and drop the pilotSays top leg (one clean inbound → one outbound). [user 2026-07-07]
  const crewInit = distraction.kind === "crew";
  const pct = Math.max(0, (remainingMs / autoDismissMs) * 100);
  const secLeft = Math.ceil(remainingMs / 1000);
  const resurfaceSec = Math.round((distraction.standbyResurfaceMs ?? 25_000) / 1000);

  // Full-size card content — used in overlay mode
  const cardContent = (compact: boolean) => (
    <>
      {/* Top accent bar */}
      <div style={{ height: "2px", background: `linear-gradient(90deg, ${style.accent}, ${style.accent}00)` }} />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4"
        style={{ backgroundColor: style.bg, borderBottom: `1px solid ${style.accent}30`, paddingTop: compact ? "8px" : "10px", paddingBottom: compact ? "8px" : "10px" }}
      >
        <span style={{ fontSize: compact ? "11px" : "13px" }}>{style.icon}</span>
        <span
          className="px-1.5 py-[2px] rounded-sm"
          style={{ fontSize: "7px", letterSpacing: "0.2em", fontWeight: 700, backgroundColor: style.accent + "28", color: style.accent, border: `1px solid ${style.accent}50` }}
        >
          {style.badge}
        </span>
        <span style={{ color: style.accent, fontSize: compact ? "10px" : "11px", fontWeight: 600, letterSpacing: "0.08em" }}>
          {subAlt(distraction.from)}
        </span>
        <span className="ml-auto animate-pulse" style={{ color: crewInit ? DIR_OUT : DIR_IN, fontSize: "8px", letterSpacing: "0.15em", fontWeight: 700 }}>
          {crewInit ? "▲ OUTBOUND" : "▼ INBOUND"}
        </span>
      </div>

      {/* Inbound — ATC's transmission (green). Crew-initiated cards have no inbound leg: the
          crew's call lives in the options below, so we skip the context prompt entirely. */}
      {!crewInit && (
        <div style={{ padding: compact ? "8px 16px" : "12px 16px" }}>
          <div style={{ color: DIR_IN, fontSize: "8px", letterSpacing: "0.2em", fontWeight: 700, marginBottom: "4px" }}>▼ INBOUND · ATC → FLIGHT CREW</div>
          <p style={{ color: "#D8EFE2", fontSize: compact ? "11px" : "13px", lineHeight: "1.55", letterSpacing: "0.02em", borderLeft: `3px solid ${DIR_IN}`, background: `${DIR_IN}0E`, borderRadius: "6px", padding: compact ? "7px 11px" : "9px 12px" }}>
            &ldquo;{subAlt(distraction.message)}&rdquo;
          </p>
        </div>
      )}

      {/* Choices — or Acknowledge button for info-only cards (empty choices) */}
      <div
        className="flex flex-col"
        style={{ borderTop: "1px solid #111820", padding: compact ? "8px 16px 8px" : "0 16px 12px", gap: compact ? "6px" : "6px" }}
      >
        {(!distraction.choices || distraction.choices.length === 0) ? (
          <button
            type="button"
            onClick={() => onRespond("ack", true)}
            className="text-left border transition-all"
            style={{
              padding: compact ? "8px 10px" : "12px 12px",
              borderColor: style.accent + "60",
              backgroundColor: style.accent + "14",
              color: style.accent,
              fontSize: compact ? "10px" : "12px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textAlign: "center",
              borderRadius: "2px",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = style.accent + "28"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = style.accent + "14"; }}
          >
            ACKNOWLEDGE ✓
          </button>
        ) : (
          <div style={{ paddingTop: compact ? "0" : "10px" }}>
            <div className="flex items-center justify-between" style={{ color: DIR_OUT, fontSize: "7px", letterSpacing: "0.2em", fontWeight: 700, paddingBottom: "6px" }}>
              <span>{crewInit ? "CREW CALL" : "CREW READBACK"}</span>{/* crew header already says OUTBOUND — no second one */}<span>{crewInit ? "" : "OUTBOUND ▲"}</span>
            </div>
            {distraction.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onRespond(choice.id, choice.correct)}
                className="text-left border transition-all"
                style={{
                  padding: compact ? "6px 10px" : "10px 12px",
                  borderColor: DIR_OUT + "40",
                  backgroundColor: DIR_OUT + "0A",
                  color: "#D0D8E4",
                  fontSize: compact ? "10px" : "11px",
                  lineHeight: "1.45",
                  borderRadius: "2px",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = DIR_OUT; (e.currentTarget as HTMLButtonElement).style.backgroundColor = DIR_OUT + "1C"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = DIR_OUT + "40"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = DIR_OUT + "0A"; }}
              >
                {subAlt(choice.label)}
              </button>
            ))}
          </div>
        )}
        {distraction.choices && distraction.choices.length > 0 && (
          <button
            type="button"
            onClick={onStandby}
            className="text-left border border-dashed flex items-center justify-between"
            style={{
              padding: compact ? "5px 10px" : "8px 12px",
              borderColor: "#FFB30050",
              backgroundColor: "#FFB3000A",
              color: "#FFB300",
              fontSize: "9px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              borderRadius: "2px",
            }}
          >
            <span>STAND BY</span>
            <span style={{ fontSize: "8px", color: "#4A5566", textTransform: "none" }}>calls back in ~{resurfaceSec}s</span>
          </button>
        )}
      </div>

      {/* Countdown */}
      <div style={{ padding: compact ? "4px 16px 8px" : "8px 16px 12px" }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "#2E3A48", fontSize: "7px", letterSpacing: "0.15em" }}>AUTO STAND BY IN</span>
          <span style={{ color: pct < 30 ? "#FF3333" : "#4A5566", fontSize: "8px", letterSpacing: "0.1em" }}>{secLeft}s</span>
        </div>
        <div className="w-full overflow-hidden" style={{ height: "2px", backgroundColor: "#0E1620", borderRadius: "1px" }}>
          <div className="h-full transition-all duration-100" style={{ width: `${pct}%`, backgroundColor: pct < 30 ? "#FF3333" : style.accent }} />
        </div>
      </div>
    </>
  );

  if (inline) {
    return (
      <>
        <style>{`@keyframes comms-fade-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div
          className="w-full"
          style={{
            fontFamily: "var(--font-procedure)",
            backgroundColor: "#070C12",
            // Full border + lift (matches the procedure card) — replaces the old
            // border-left side-stripe.
            border: `1px solid ${style.accent}55`,
            borderRadius: "8px",
            overflow: "hidden",
            // Lighter, cooler drop-shadow for the white column (see flight-check-popup).
            boxShadow: `0 0 0 1px ${style.accent}22, 0 8px 22px rgba(15,20,30,0.16), inset 0 1px 0 rgba(255,255,255,0.05)`,
            // When this is the active surface, ccGlowOut overrides the box-shadow with a
            // bright OUTER breathing glow (cyan for comms) — blooms around the card in its
            // black well, so the card reads as a lifted object.
            animation: flashing
              ? "comms-fade-in 0.2s ease-out both, ccGlowOut 1.5s ease-in-out infinite"
              : "comms-fade-in 0.2s ease-out both",
            ...(flashing ? { "--cc-fc": "0,207,255" } : {}),
          } as CSSProperties}
        >
          {cardContent(true)}
        </div>
      </>
    );
  }

  // ── OVERLAY MODE — fixed left-side panel ──────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes atc-from-left {
          0%   { opacity: 0; transform: translateY(-50%) translateX(-32px) scale(0.95); }
          70%  { transform: translateY(-50%) translateX(4px) scale(1.01); }
          100% { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
        }
      `}</style>
      <div className="fixed inset-0" style={{ zIndex: 48, background: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, transparent 75%)", pointerEvents: "none" }} />
      <div
        className="fixed font-mono"
        style={{
          left: "32px", top: "50%", zIndex: 50,
          width: "min(460px, 40vw)",
          backgroundColor: "#060B0D",
          border: `2px solid ${style.accent}`,
          borderRadius: "4px",
          boxShadow: `0 0 48px ${style.accent}40, 0 12px 40px rgba(0,0,0,0.85)`,
          animation: "atc-from-left 0.26s cubic-bezier(0.34, 1.3, 0.64, 1) both",
        }}
      >
        {cardContent(false)}
      </div>
    </>
  );
}
