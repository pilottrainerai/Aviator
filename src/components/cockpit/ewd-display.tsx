"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ScenarioState } from "@/engine/state";
import type { ECAMLevel, Scenario } from "@/scenarios/types";
import { EwdGauges } from "./ewd-gauges";

// Airbus A320 E/WD colour spec — matches the engine-warning-display artwork
const C = {
  red:    "#ed1e24",
  amber:  "#e8a13a",
  green:  "#5aba47",
  cyan:   "#2dc3e8",
  white:  "#ffffff",
  dim:    "#6A7488",
  border: "#1C2130",
} as const;
// B612 — the typeface Airbus + ENAC commissioned specifically for cockpit displays;
// the closest legally-usable match to the real ECAM/DU font (bundled via layout.tsx).
const EWD_FONT = "var(--font-b612)";

// ECAM system prefixes rendered UNDERLINED before a boxed failure name / caution
// (per the model + user direction: "the system underlined like AUTO, like HYD").
// NOTE: "ENG" is deliberately absent so "ENG 1 FAIL" stays whole-boxed.
const SYS_PREFIXES = ["AUTO FLT", "F/CTL", "HYD", "ELEC", "AIR", "FUEL", "APU", "BLEED", "COND", "BRAKES", "NAV"];
function splitPrefix(line: string): { prefix: string; rest: string } | null {
  for (const p of SYS_PREFIXES) {
    if (line === p) return null;                       // whole line is the system — don't split
    if (line.startsWith(p + " ")) return { prefix: p, rest: line.slice(p.length + 1) };
  }
  return null;
}

// FCOM E/WD lower section holds a maximum of 7 lines; beyond that the content
// overflows below the fold, signalled by the green ↓ arrow (CLR to scroll).
const MAX_EWD_LINES = 7;

function levelColor(level: ECAMLevel): string {
  switch (level) {
    case "warning":  return C.red;
    case "caution":  return C.amber;
    case "advisory": return C.cyan;
    case "remark":   return C.white;
    case "memo":     return C.green;
  }
}

// Messages that belong to the RIGHT column (secondary failures panel)
function isRightCol(line: string) {
  return line === "LAND ASAP" || line === "SECONDARY FAILURES" || line.startsWith("* ");
}

// FCOM AGENT 1 arming window — keep in sync with fire-panel.tsx
const AGENT1_ARM_MS = 10_000;

export function EwdDisplay({
  state,
  scenario,
  live,
}: {
  state: ScenarioState;
  scenario: Scenario;
  live?: import("./ewd-gauges").EngineSet;
}) {
  // Live wall-clock tick — drives the AGENT 1 10-s countdown text in the
  // ECAM line ("AGENT 1 AFTER 7 S ... DISCH").  Only runs while the FIRE
  // pb is pushed and AGENT 1 isn't yet done.  We capture Date.now() at
  // the moment FIRE pb completes (because the engine's state.tMs is
  // session-relative — performance.now() based — and doesn't tick with
  // wall clock between events).
  const firePbAt   = state.completedSteps["eng1_fire_pb"];
  const agent1Done = !!state.completedSteps["agent1"];
  const ticking    = !!firePbAt && !agent1Done;
  const [, setTick] = useState(0);
  const [firePbWallMs, setFirePbWallMs] = useState<number | null>(null);
  useEffect(() => {
    if (firePbAt && firePbWallMs === null) {
      setFirePbWallMs(Date.now());
    }
  }, [firePbAt, firePbWallMs]);
  useEffect(() => {
    if (!ticking) return;
    const i = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(i);
  }, [ticking]);

  // FCOM ECAM: LAND ASAP downgrades from red (warning) to amber (caution)
  // once the fire is extinguished — the directive becomes "land at the
  // nearest suitable airport" rather than "land immediately".
  const fireExtinguished = !!state.triggersFired["fire_extinguished"];

  const ecamToStep = new Map(
    scenario.steps
      .filter((s) => !!s.ecamRef)
      .map((s) => [s.ecamRef as string, s]),
  );

  const messages = state.ecamMessages;
  const leftMsgs  = messages.filter((m) => !isRightCol(m.line));
  const rightMsgs = messages.filter((m) =>  isRightCol(m.line));

  function renderMsg(m: (typeof messages)[number]) {
    const linkedStep  = ecamToStep.get(m.id);
    const isCompleted = linkedStep ? !!state.completedSteps[linkedStep.id] : false;

    // Effective level for this row (after FCOM overrides like LAND ASAP
    // downgrading once the fire is out).
    let effectiveLevel: ECAMLevel = m.level;
    if (m.id === "land_asap" && fireExtinguished) effectiveLevel = "caution";

    const color = isCompleted ? C.green : levelColor(effectiveLevel);

    // AGENT 1 dynamic countdown — only while the 10-s window is open and
    // the step isn't yet done.  Renders "AGENT 1 AFTER N S....DISCH"
    // counting from 10 → 0, then "AGENT 1 NOW...........DISCH".
    let displayLine = m.line;
    if (m.id === "ecam_agent1" && firePbWallMs && !agent1Done) {
      const elapsed = Date.now() - firePbWallMs;
      const remaining = Math.max(0, Math.ceil((AGENT1_ARM_MS - elapsed) / 1000));
      displayLine = remaining > 0
        ? `AGENT 1 AFTER ${remaining} S....DISCH`
        : `AGENT 1 NOW...........DISCH`;
    }

    // Special line — LAND ASAP / AUTO FLT AP OFF: coloured text, NOT boxed
    // [FCOM DSC-31-15]. Checked BEFORE the boxed-title branch so a warning-level
    // "…AP OFF" line isn't boxed. A leading system prefix (AUTO FLT) is underlined.
    const isSpecial = displayLine === "LAND ASAP" || /\bAP OFF$/.test(displayLine);
    if (isSpecial) {
      const sp = splitPrefix(displayLine);
      return <SpecialLine key={m.id} color={color} prefix={sp?.prefix}>{sp ? sp.rest : displayLine}</SpecialLine>;
    }
    // Boxed PRIMARY FAILURE title (warning level) — FCOM DSC-31-15: "a primary
    // failure is displayed as a boxed title". The system prefix (HYD, F/CTL…)
    // renders UNDERLINED before the box; only the failure name is boxed.
    if (!linkedStep && (m.level === "warning" || m.line === "ENG 1 FAIL")) {
      const sp = splitPrefix(displayLine);
      return <TitleRow key={m.id} color={color} prefix={sp?.prefix}>{sp ? sp.rest : displayLine}</TitleRow>;
    }
    // SECONDARY FAILURES section header — white label, no bullet
    if (m.line === "SECONDARY FAILURES") {
      return <SectionHeaderRow key={m.id}>{m.line}</SectionHeaderRow>;
    }
    // Asterisk item: * HYD, * ELEC, * AIR BLEED
    if (m.line.startsWith("* ")) {
      return <AsteriskRow key={m.id} color={color}>{m.line.slice(2)}</AsteriskRow>;
    }
    // Corrective action line — cyan "– ITEM ..... ACTION". Linked lines auto-clear
    // when the step is done; an unlinked advisory limitation with a dot leader
    // (e.g. MAX SPEED …… 320/.77) also renders with the dash, per the model.
    if (linkedStep || (m.level === "advisory" && displayLine.includes(".."))) {
      return <ActionRow key={m.id} color={color}>{displayLine}</ActionRow>;
    }
    // Advisory / system callout — underline a leading system prefix if present.
    const sp = splitPrefix(displayLine);
    return <SystemRow key={m.id} color={color} prefix={sp?.prefix}>{sp ? sp.rest : displayLine}</SystemRow>;
  }

  // Non-ECAM MEMO (shown when no warning is active) — state-driven per FCOM.
  const memoItems = scenario.engineDisplay?.memo ?? [];
  const hasWarnings = messages.length > 0;
  // FCOM DSC-31-15: an action line automatically clears once its step is performed.
  // Filter completed action lines out so the remaining ones shift up and the next
  // becomes current. (Non-action lines — titles, secondaries, LAND ASAP — stay.)
  const isDoneAction = (m: (typeof messages)[number]) => {
    const s = ecamToStep.get(m.id);
    return !!s && !!state.completedSteps[s.id];
  };
  const visibleLeft = leftMsgs.filter((m) => !isDoneAction(m));
  // 7-line E/WD clamp — show the first 7; the rest overflow below the fold and
  // are signalled by the green ↓ arrow. As action lines auto-clear, the list
  // shrinks and previously-hidden lines rise into view (arrow disappears at ≤7).
  const clampedLeft  = visibleLeft.slice(0, MAX_EWD_LINES);
  const leftOverflow = visibleLeft.length > MAX_EWD_LINES;
  const memoColor = (mi: (typeof memoItems)[number]) => (mi.color ? C[mi.color] : C.green);

  return (
    <div
      className="border border-[var(--color-border)] select-none flex flex-col"
      style={{ backgroundColor: "#000000", fontFamily: EWD_FONT, flex: "1 1 0", minHeight: 0 }}
    >
      {/* Engine primary gauge cluster + slat/flap indicator (top ~⅔ of the E/WD) */}
      <EwdGauges state={state} scenario={scenario} live={live} />

      {/* Lower E/WD — MEMO when clean, or the ECAM warning tree on a failure.
          Two sections per FCOM: bottom-left = primary + actions / memo;
          bottom-right = LAND ASAP + secondary failures / right memos. */}
      <div className="flex" style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", position: "relative" }}>
        {/* Divider lines — SVG overlay drawn to the reference model's exact geometry
            (ewd_gy_model.html). preserveAspectRatio="none" maps model coords to the
            box (the lower-area aspect ~3.0 matches, so strokes stay near-uniform):
              • horizontal separator = TWO segments with a central gap (x2347→2755)
              • vertical column separator = inset top & bottom; does NOT touch the
                horizontal line (Airbus lines don't join)
              • green ↓ overflow arrow = separate, in the gutter, only when >7 lines */}
        <svg viewBox="0 2730 4097 1367" preserveAspectRatio="none" aria-hidden
             style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <line x1="19.1"   y1="2735"    x2="2347.78" y2="2735"    stroke={C.white} strokeWidth={10} />
          <line x1="2755.01" y1="2735"   x2="4075.8"  y2="2735"    stroke={C.white} strokeWidth={10} />
          <line x1="2548.99" y1="2824.74" x2="2548.99" y2="3907.72" stroke={C.white} strokeWidth={10} />
          {hasWarnings && leftOverflow && (
            <>
              <line x1="2549" y1="3975" x2="2549" y2="4028" stroke={C.green} strokeWidth={33} />
              <polygon points="2494,4024 2604,4024 2549,4090" fill={C.green} />
            </>
          )}
        </svg>
        {/* LEFT (~62%) — clamped to 7 lines; remainder overflows below the fold */}
        <div className="flex flex-col" style={{ flex: "1 1 0", gap: "0px", padding: "6px 6px 4px 10px", overflow: "hidden" }}>
          {hasWarnings
            ? clampedLeft.map(renderMsg)
            : memoItems.filter((mi) => !mi.right).map((mi, i) => (
                <MemoLine key={`ml${i}`} color={memoColor(mi)}>{mi.line}</MemoLine>
              ))}
        </div>
        {/* RIGHT (~38%) — LAND ASAP + secondary failures / right-column memos */}
        <div className="flex flex-col" style={{ width: "38%", flexShrink: 0, gap: "0px", padding: "6px 6px 4px 12px", overflow: "hidden" }}>
          {hasWarnings
            ? rightMsgs.map(renderMsg)
            : memoItems.filter((mi) => mi.right).map((mi, i) => (
                <MemoLine key={`mr${i}`} color={memoColor(mi)}>{mi.line}</MemoLine>
              ))}
        </div>
      </div>
    </div>
  );
}

// ─── Row components ───────────────────────────────────────────────────────────

function TitleRow({ color, prefix, children }: { color: string; prefix?: string; children: React.ReactNode }) {
  // Primary failure = boxed title (FCOM DSC-31-15). Optional underlined system
  // prefix (HYD, F/CTL…) sits before the box; only the failure name is boxed.
  return (
    <div className="flex items-baseline" style={{ alignSelf: "flex-start", gap: "6px", marginBottom: "2px" }}>
      {prefix && (
        <span style={{ color, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textDecoration: "underline", textUnderlineOffset: "2px" }}>{prefix}</span>
      )}
      <span style={{ color, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", lineHeight: "1.1", border: `1.5px solid ${color}`, padding: "0px 5px" }}>
        {children}
      </span>
    </div>
  );
}

function MemoLine({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ color, fontSize: "11px", fontWeight: 500, letterSpacing: "0.05em", lineHeight: "1.35" }}>
      {children}
    </div>
  );
}

// Special line (LAND ASAP, AUTO FLT AP OFF) — bold coloured text, NOT boxed
// (FCOM DSC-31-15). Optional leading system prefix (AUTO FLT) is underlined.
function SpecialLine({ color, prefix, children }: { color: string; prefix?: string; children: React.ReactNode }) {
  return (
    <div style={{ color, fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", lineHeight: "1.15", marginBottom: "2px" }}>
      {prefix && <span style={{ textDecoration: "underline", textUnderlineOffset: "2px" }}>{prefix}</span>}
      {prefix ? " " : ""}{children}
    </div>
  );
}

function SectionHeaderRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={{ color: C.white, fontSize: "9px", letterSpacing: "0.2em", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px" }}>
        {children}
      </div>
    </div>
  );
}

function AsteriskRow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline" style={{ gap: "4px" }}>
      <span style={{ color, fontSize: "11px", fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>*</span>
      <span style={{ color, fontSize: "10px", letterSpacing: "0.04em", lineHeight: "1.35", fontWeight: 600 }}>
        {children}
      </span>
    </div>
  );
}

function ActionRow({ color, children }: { color: string; children: ReactNode }) {
  // Corrective action: leading "–" line + item ..... action. Auto-clears (is
  // filtered out) once the step is done, so it never renders a "completed" state.
  return (
    <div className="flex items-baseline" style={{ gap: "4px", color, fontSize: "10px", fontWeight: 500, letterSpacing: "0.03em", lineHeight: "1.35" }}>
      <span style={{ flexShrink: 0 }}>–</span>
      <span>{children}</span>
    </div>
  );
}

function SystemRow({ color, prefix, children }: { color: string; prefix?: string; children: React.ReactNode }) {
  // A system caution/advisory line; a leading system prefix (HYD, F/CTL…) is underlined.
  return (
    <div style={{ color, fontSize: "10px", fontWeight: 500, letterSpacing: "0.04em", lineHeight: "1.35", paddingLeft: prefix ? "0px" : "14px" }}>
      {prefix && <span style={{ textDecoration: "underline", textUnderlineOffset: "2px" }}>{prefix}</span>}
      {prefix ? " " : ""}{children}
    </div>
  );
}
