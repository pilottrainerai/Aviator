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
  magenta:"#cf92c1",   // T.O / LDG INHIBIT memo
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

// FCOM E/WD lower section line capacity; beyond that content overflows below the
// fold, signalled by the green ↓ arrow. The full ENG FIRE tree is 8 lines (title +
// 5 actions + "IF FIRE AFTER 30 S:" + AGENT 2) and must NOT overflow [user 2026-07-09].
const MAX_EWD_LINES = 7;   // title + 6 lines = 7 total max, then the ↓ overflow arrow — verified against the ENG FIRE reference frame (title + 6 lines + arrow) [user 2026-07-14]

// Lower E/WD reference scale — the memo/warning HTML is authored at EWD_LOWER_W px then
// transform-scaled ×EWD_LOWER_SCALE to fill the 4097-unit lower SVG, so its text lands at the
// reference size (~130, same as the engine-cluster numbers) instead of tiny fixed px. The row
// components keep their existing px sizes; only the wrapper scales. 347 × 11.81 ≈ 4097. [user 2026-07-14]
const EWD_LOWER_W = 347;
const EWD_LOWER_SCALE = 4097 / EWD_LOWER_W;   // ≈ 11.81

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

    // Action items (incl. AGENT 1 / AGENT 2 DISCH) are CYAN/BLUE per FCOM DSC-31-60; only the
    // IF/conditional headers ("IF FIRE AFTER 30 S:") are white (remark level). [user 2026-07-14]
    const color = isCompleted ? C.green : levelColor(effectiveLevel);

    // AGENT 1 dynamic countdown — only while the 10-s window is open and
    // the step isn't yet done.  Renders "AGENT 1 AFTER N S....DISCH"
    // counting from 10 → 0, then "AGENT 1..............DISCH" (FCOM E/WD: once the
    // 10 s elapse the line is just the action, no "NOW"). [user 2026-07-12]
    let displayLine = m.line;
    if (m.id === "ecam_agent1" && firePbWallMs && !agent1Done) {
      const elapsed = Date.now() - firePbWallMs;
      const remaining = Math.max(0, Math.ceil((AGENT1_ARM_MS - elapsed) / 1000));
      displayLine = remaining > 0
        ? `AGENT 1 AFTER ${remaining} S....DISCH`
        : `AGENT 1..............DISCH`;
    }

    // Special line — LAND ASAP / AUTO FLT AP OFF: coloured text, NOT boxed
    // [FCOM DSC-31-15]. Checked BEFORE the boxed-title branch so a warning-level
    // "…AP OFF" line isn't boxed. A leading system prefix (AUTO FLT) is underlined.
    const isSpecial = displayLine === "LAND ASAP" || /\bAP OFF$/.test(displayLine);
    if (isSpecial) {
      const sp = splitPrefix(displayLine);
      return <SpecialLine key={m.id} color={color} prefix={sp?.prefix}>{sp ? sp.rest : displayLine}</SpecialLine>;
    }
    // ENG n SHUT DOWN title — AMBER, whole title boxed. Verified against the Bond
    // Aviation ECAM lecture (232294071 pp.60-62): the independent ENG 1(2) SHUT DOWN
    // title is amber with a box around the entire title. [user 2026-07-12, ref PDF]
    if (/ SHUT DOWN$/.test(displayLine)) {
      return <ShutDownTitleRow key={m.id}>{displayLine}</ShutDownTitleRow>;
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
      {/* Engine primary gauge cluster + slat/flap indicator. Reference proportion
          2730/4097 = 66.7% so the gauges + the lower tree share ONE scale (both at PFD
          size, matching the reference E/WD SVG). [user 2026-07-14] */}
      <div style={{ flex: "0 0 66.7%", minHeight: 0, overflow: "hidden" }}>
        <EwdGauges state={state} scenario={scenario} live={live} />
      </div>

      {/* Lower E/WD — MEMO when clean, or the ECAM warning tree on a failure, rendered at
          REFERENCE SCALE. The whole lower third is ONE SVG (viewBox 4097×1367 = the reference
          E/WD memo area) so the text + dividers scale WITH the panel exactly like the engine
          cluster above — no longer tiny fixed-px HTML. The dynamic tree (titles, cyan action
          rows with the leading “–” + dot leaders, LAND ASAP, secondaries, 7-line clamp) lives
          UNCHANGED inside a <foreignObject> that is transform-scaled ×EWD_LOWER_SCALE, so the
          existing row components keep their px sizes and every behaviour. Two FCOM sections:
          bottom-left = primary + actions / memo; bottom-right = LAND ASAP + secondaries.
          [user 2026-07-14: "this size is correct, fit it there, don't break anything"] */}
      <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        <svg viewBox="0 0 4097 1367" preserveAspectRatio="xMidYMin meet"
             style={{ display: "block", width: "100%", height: "100%" }}>
          {/* Dynamic warning tree / memo — the existing HTML, scaled to reference size.
              Design width 347px × EWD_LOWER_SCALE(11.81) = 4097 units; left col 62.2% ends
              exactly at the x=2549 vertical divider. */}
          <foreignObject x={0} y={0} width={4097} height={1367}>
            <div
              style={{
                width: `${EWD_LOWER_W}px`,
                height: `${Math.round(1367 / EWD_LOWER_SCALE)}px`,
                transformOrigin: "top left",
                transform: `scale(${EWD_LOWER_SCALE})`,
                overflow: "hidden",
              }}
            >
              <div className="flex" style={{ width: "100%", height: "100%" }}>
                {/* LEFT — ECAM tree. RIGHT edge = the LEFT horizontal divider's END (x2347.78 = 57.3%),
                    right-padding 0, so the action lines finish exactly where the LEFT white line finishes.
                    (Correct per user — the columns align to the horizontal lines, NOT the vertical divider,
                    which sits in the gap between them.) [user 2026-07-14] */}
                <div className="flex flex-col" style={{ width: "57.3%", flexShrink: 0, gap: "0px", padding: "6px 0 4px 10px", overflow: "hidden" }}>
                  {hasWarnings
                    ? clampedLeft.map(renderMsg)
                    : memoItems.filter((mi) => !mi.right).map((mi, i) => (
                        <MemoLine key={`ml${i}`} color={memoColor(mi)}>{mi.line}</MemoLine>
                      ))}
                </div>
                {/* GAP — the divider zone (x2347.78 → 2755.01, 9.94%): the vertical white line sits here;
                    the left column ends at the left line's end, the right column starts at the right line's
                    start. No content. [user 2026-07-14] */}
                <div style={{ width: "9.94%", flexShrink: 0 }} aria-hidden />
                {/* RIGHT — LAND ASAP + secondary failures. LEFT edge = the RIGHT horizontal divider's START
                    (x2755.01), left-padding 0, so they begin exactly where the RIGHT white line begins. [user 2026-07-14] */}
                <div className="flex flex-col" style={{ flex: "1 1 0", gap: "0px", padding: "6px 6px 4px 0", overflow: "hidden" }}>
                  {hasWarnings
                    ? rightMsgs.map(renderMsg)
                    : memoItems.filter((mi) => mi.right).map((mi, i) => (
                        <MemoLine key={`mr${i}`} color={memoColor(mi)}>{mi.line}</MemoLine>
                      ))}
                </div>
              </div>
            </div>
          </foreignObject>
          {/* Divider lines — 15 px, reference geometry: horizontal separator = TWO segments
              with a central gap (x2347→2755); vertical column separator inset top & bottom,
              does NOT touch the horizontal line (Airbus lines don't join); green ↓ overflow
              arrow only when the left tree exceeds 7 lines. */}
          <line x1={19.1}    y1={8}   x2={2347.78} y2={8}    stroke={C.white} strokeWidth={15} />
          <line x1={2755.01} y1={8}   x2={4075.8}  y2={8}    stroke={C.white} strokeWidth={15} />
          <line x1={2548.99} y1={94}  x2={2548.99} y2={1177} stroke={C.white} strokeWidth={15} />
          {hasWarnings && leftOverflow && (
            <>
              <line x1={2549} y1={1245} x2={2549} y2={1298} stroke={C.green} strokeWidth={33} />
              <polygon points="2494,1294 2604,1294 2549,1360" fill={C.green} />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

// ─── Row components ───────────────────────────────────────────────────────────

function TitleRow({ color, prefix, children }: { color: string; prefix?: string; children: React.ReactNode }) {
  // Primary failure title = coloured, UNDERLINED, NOT boxed — per the real E/WD
  // reference frame (ENG 1 FIRE fire-01/02): the title is red + underlined, no box.
  // Applies to every primary title (ENG 1 FIRE, HYD G+Y SYS LO PR …). [user 2026-07-09]
  const u = { textDecoration: "underline", textUnderlineOffset: "2px" } as const;
  return (
    <div className="flex items-baseline" style={{ alignSelf: "flex-start", gap: "6px", marginBottom: "2px" }}>
      {prefix && (
        <span style={{ color, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", ...u }}>{prefix}</span>
      )}
      <span style={{ color, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", lineHeight: "1.1", ...u }}>
        {children}
      </span>
    </div>
  );
}

function ShutDownTitleRow({ children }: { children: string }) {
  // "ENG 1 SHUT DOWN" → "ENG 1" amber UNDERLINED (the system prefix) + only "SHUT DOWN" amber BOXED.
  // Per the user's reference E/WD image only "SHUT DOWN" is boxed, and the "ENG 1" prefix is
  // underlined like every other ECAM system prefix. [user 2026-07-14]
  const txt = String(children).trim();
  const mm = txt.match(/^(.*?)\s*(SHUT DOWN)$/);
  const prefix = mm ? mm[1] : "";
  const boxed = mm ? mm[2] : txt;
  return (
    <div className="flex" style={{ alignSelf: "flex-start", marginBottom: "2px", alignItems: "center", gap: "5px" }}>
      {prefix && (
        <span style={{ color: C.amber, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", lineHeight: "1.15", textDecoration: "underline", textUnderlineOffset: "2px" }}>{prefix}</span>
      )}
      <span style={{ color: C.amber, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", lineHeight: "1.15", border: `1px solid ${C.amber}`, padding: "0 3px" }}>
        {boxed}
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
  // Corrective action: "– ITEM ......... ACTION" with the action RIGHT-JUSTIFIED and a
  // dot leader that auto-fills the gap (real E/WD, FCOM DSC-31-15). We split the authored
  // string on its dot run, so alignment no longer depends on the hand-counted dots — every
  // action lines up at the right regardless of item length. [user 2026-07-09]
  const s = typeof children === "string" ? children : String(children ?? "");
  const m = s.match(/^(.*?)\.{2,}(.*)$/);
  const item = m ? m[1] : s;
  const action = m ? m[2] : "";
  return (
    <div className="flex items-baseline" style={{ gap: "4px", color, fontSize: "10px", fontWeight: 500, letterSpacing: "0.03em", lineHeight: "1.35" }}>
      <span style={{ flexShrink: 0 }}>–</span>
      <span style={{ flexShrink: 0 }}>{item}</span>
      {action && (
        <>
          <span aria-hidden style={{ flex: "1 1 auto", overflow: "hidden", whiteSpace: "nowrap", opacity: 0.9 }}>{".".repeat(120)}</span>
          <span style={{ flexShrink: 0 }}>{action}</span>
        </>
      )}
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
