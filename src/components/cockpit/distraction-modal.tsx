"use client";

import { useEffect, useRef, useState } from "react";
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

// ─── ATC/Comms modal — always LEFT side ──────────────────────────────────────
// Positions on the left half of the screen so the crew action popup (right)
// can be visible simultaneously. No backdrop — cockpit stays readable.

export function DistractionModal({
  distraction,
  onRespond,
  onStandby,
}: {
  distraction: ScenarioDistraction;
  onRespond: (choiceId: string, correct: boolean) => void;
  onStandby: () => void;
}) {
  const autoDismissMs = distraction.autoDismissMs ?? AUTO_DISMISS_DEFAULT;
  const [remainingMs, setRemainingMs] = useState(autoDismissMs);
  const startedAt = useRef(performance.now());

  useEffect(() => {
    startedAt.current = performance.now();
    setRemainingMs(autoDismissMs);
  }, [distraction.id, autoDismissMs]);

  useEffect(() => {
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
  }, [autoDismissMs, onStandby, distraction.id]);

  const style = KIND_STYLE[distraction.kind];
  const pct = Math.max(0, (remainingMs / autoDismissMs) * 100);
  const secLeft = Math.ceil(remainingMs / 1000);
  const resurfaceSec = Math.round((distraction.standbyResurfaceMs ?? 25_000) / 1000);

  return (
    <>
      <style>{`
        @keyframes atc-from-left {
          0%   { opacity: 0; transform: translateY(-50%) translateX(-32px) scale(0.95); }
          70%  { transform: translateY(-50%) translateX(4px) scale(1.01); }
          100% { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
        }
      `}</style>

      {/* Dim backdrop behind left panel only — subtle to not block cockpit */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 48, background: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, transparent 75%)", pointerEvents: "none" }}
      />

      <div
        className="fixed font-mono"
        style={{
          left: "32px",
          top: "50%",
          zIndex: 50,
          width: "min(460px, 40vw)",
          backgroundColor: "#060B0D",
          border: `2px solid ${style.accent}`,
          borderRadius: "4px",
          boxShadow: `0 0 48px ${style.accent}40, 0 12px 40px rgba(0,0,0,0.85)`,
          animation: "atc-from-left 0.26s cubic-bezier(0.34, 1.3, 0.64, 1) both",
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: "3px", background: `linear-gradient(90deg, ${style.accent}, ${style.accent}00)` }} />

        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3"
          style={{ backgroundColor: style.bg, borderBottom: `1px solid ${style.accent}30` }}
        >
          <span style={{ fontSize: "15px" }}>{style.icon}</span>
          <span
            className="px-2 py-[3px] rounded-sm"
            style={{
              fontSize: "8px",
              letterSpacing: "0.2em",
              fontWeight: 700,
              backgroundColor: style.accent + "28",
              color: style.accent,
              border: `1px solid ${style.accent}50`,
            }}
          >
            {style.badge}
          </span>
          <span style={{ color: style.accent, fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em" }}>
            {distraction.from}
          </span>
          <span
            className="ml-auto animate-pulse"
            style={{ color: style.accent, fontSize: "9px", letterSpacing: "0.15em", fontWeight: 700 }}
          >
            INBOUND
          </span>
        </div>

        {/* Message */}
        <div className="px-5 py-4">
          <p style={{ color: "#D4D8E8", fontSize: "14px", lineHeight: "1.65", letterSpacing: "0.02em" }}>
            &ldquo;{distraction.message}&rdquo;
          </p>
        </div>

        {/* Choices */}
        <div className="px-5 pb-3 flex flex-col gap-2 border-t" style={{ borderColor: "#111820" }}>
          <div style={{ color: "#3A4858", fontSize: "9px", letterSpacing: "0.2em", paddingTop: "12px" }}>
            SELECT RESPONSE:
          </div>
          {distraction.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => onRespond(choice.id, choice.correct)}
              className="text-left px-4 py-3 border transition-all"
              style={{
                borderColor: style.accent + "40",
                backgroundColor: style.accent + "0A",
                color: "#D0D8E4",
                fontSize: "12px",
                lineHeight: "1.45",
                borderRadius: "2px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = style.accent;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = style.accent + "1C";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = style.accent + "40";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = style.accent + "0A";
              }}
            >
              {choice.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onStandby}
            className="text-left px-4 py-2.5 border border-dashed flex items-center justify-between mt-1"
            style={{
              borderColor: "#FFB30050",
              backgroundColor: "#FFB3000A",
              color: "#FFB300",
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              borderRadius: "2px",
            }}
          >
            <span>STAND BY</span>
            <span style={{ fontSize: "9px", color: "#4A5566", letterSpacing: "0.06em", textTransform: "none" }}>
              calls back in ~{resurfaceSec}s
            </span>
          </button>
        </div>

        {/* Countdown bar */}
        <div className="px-5 pb-4 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ color: "#2E3A48", fontSize: "8px", letterSpacing: "0.15em" }}>AUTO STAND BY IN</span>
            <span style={{ color: pct < 30 ? "#FF3333" : "#4A5566", fontSize: "9px", letterSpacing: "0.1em" }}>
              {secLeft}s
            </span>
          </div>
          <div className="w-full overflow-hidden" style={{ height: "2px", backgroundColor: "#0E1620", borderRadius: "1px" }}>
            <div
              className="h-full transition-all duration-100"
              style={{ width: `${pct}%`, backgroundColor: pct < 30 ? "#FF3333" : style.accent }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
