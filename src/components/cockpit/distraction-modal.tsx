"use client";

import { useEffect, useRef, useState } from "react";
import type { ScenarioDistraction, DistractionKind } from "@/scenarios/types";

// ─── Color palette per communication source ───────────────────────────────────
const KIND_STYLE: Record<
  DistractionKind,
  { accent: string; bg: string; badge: string; icon: string }
> = {
  atc:         { accent: "#00D060", bg: "#00D06010", badge: "ATC",        icon: "📡" },
  crew:        { accent: "#00CFFF", bg: "#00CFFF10", badge: "CREW",       icon: "🎧" },
  cabin:       { accent: "#FFB300", bg: "#FFB30010", badge: "CABIN",      icon: "🔔" },
  company:     { accent: "#4F8CFF", bg: "#4F8CFF10", badge: "OPS",        icon: "📟" },
  flightcheck: { accent: "#E6E8EC", bg: "#E6E8EC08", badge: "PF CHECK",   icon: "✈" },
};

const AUTO_DISMISS_DEFAULT = 20_000;

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

  // Countdown + auto-dismiss (treated as Stand By if timer runs out)
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
  }, [autoDismissMs, onStandby]);

  const style = KIND_STYLE[distraction.kind];
  const pct = Math.max(0, (remainingMs / autoDismissMs) * 100);
  const secLeft = Math.ceil(remainingMs / 1000);
  const resurfaceSec = Math.round((distraction.standbyResurfaceMs ?? 25_000) / 1000);

  return (
    <>
      {/* Backdrop — dims cockpit but doesn't hide it */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.60)" }}
      />

      {/* Modal card — front and center */}
      <div
        className="fixed z-50 font-mono shadow-2xl"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(540px, 92vw)",
          backgroundColor: "#0A0D14",
          border: `2px solid ${style.accent}`,
          borderRadius: "2px",
          boxShadow: `0 0 40px ${style.accent}30`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 border-b"
          style={{ borderColor: style.accent + "40", backgroundColor: style.bg }}
        >
          <span style={{ fontSize: "14px" }}>{style.icon}</span>
          <span
            style={{
              color: style.accent,
              fontSize: "9px",
              letterSpacing: "0.25em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {style.badge}
          </span>
          <span
            style={{
              color: style.accent,
              fontSize: "11px",
              letterSpacing: "0.1em",
              fontWeight: 600,
            }}
          >
            {distraction.from}
          </span>
          <span
            className="ml-auto animate-pulse"
            style={{ color: style.accent, fontSize: "9px", letterSpacing: "0.1em", fontWeight: 700 }}
          >
            INBOUND CALL
          </span>
        </div>

        {/* Message */}
        <div className="px-4 py-4">
          <p
            style={{
              color: "#D4D8E0",
              fontSize: "14px",
              lineHeight: "1.6",
              letterSpacing: "0.02em",
              fontFamily: "inherit",
            }}
          >
            &ldquo;{distraction.message}&rdquo;
          </p>
        </div>

        {/* Response choices */}
        <div
          className="px-4 pb-2 flex flex-col gap-2 border-t"
          style={{ borderColor: "#1C2130" }}
        >
          <div
            style={{ color: "#5A626F", fontSize: "9px", letterSpacing: "0.2em", paddingTop: "10px", marginBottom: "2px" }}
          >
            SELECT RESPONSE:
          </div>
          {distraction.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => onRespond(choice.id, choice.correct)}
              className="text-left px-3 py-2.5 border transition-all hover:border-opacity-80"
              style={{
                borderColor: style.accent + "50",
                backgroundColor: style.bg,
                color: "#E6E8EC",
                fontSize: "11px",
                lineHeight: "1.4",
                letterSpacing: "0.03em",
                borderRadius: "2px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = style.accent;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = style.accent + "18";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = style.accent + "50";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = style.bg;
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>

        {/* Stand By button */}
        <div className="px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={onStandby}
            className="w-full text-left px-3 py-2 border border-dashed flex items-center justify-between"
            style={{
              borderColor: "#FFB30060",
              backgroundColor: "#FFB30008",
              color: "#FFB300",
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              borderRadius: "2px",
            }}
          >
            <span>STAND BY</span>
            <span style={{ fontSize: "9px", color: "#5A626F", letterSpacing: "0.08em", textTransform: "none" }}>
              ATC will call back in ~{resurfaceSec}s
            </span>
          </button>
        </div>

        {/* Countdown bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span style={{ color: "#3A4050", fontSize: "9px", letterSpacing: "0.1em" }}>
              AUTO STAND BY IN
            </span>
            <span
              style={{
                color: pct < 30 ? "#FF3333" : "#5A626F",
                fontSize: "9px",
                letterSpacing: "0.1em",
              }}
            >
              {secLeft}s
            </span>
          </div>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: "2px", backgroundColor: "#1C2130" }}
          >
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${pct}%`,
                backgroundColor: pct < 30 ? "#FF3333" : style.accent,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
