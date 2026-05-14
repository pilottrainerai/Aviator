"use client";

import { useEffect, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { ECAMLevel, Scenario } from "@/scenarios/types";

// Airbus A320 ECAM color spec — FCOM DSC-31-60
const C = {
  red:    "#FF3333",
  amber:  "#FFB300",
  green:  "#00D060",
  cyan:   "#00CFFF",
  white:  "#E6E8EC",
  dim:    "#6A7488",
  border: "#1C2130",
} as const;

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
}: {
  state: ScenarioState;
  scenario: Scenario;
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

    // Large title: ENG 1 FAIL, LAND ASAP (directives / procedure headers)
    if (!linkedStep && (m.level === "warning" || m.line === "LAND ASAP" || m.line === "ENG 1 FAIL")) {
      return <TitleRow key={m.id} color={color}>{displayLine}</TitleRow>;
    }
    // SECONDARY FAILURES section header — white label, no bullet
    if (m.line === "SECONDARY FAILURES") {
      return <SectionHeaderRow key={m.id}>{m.line}</SectionHeaderRow>;
    }
    // Asterisk item: * HYD, * ELEC, * AIR BLEED
    if (m.line.startsWith("* ")) {
      return <AsteriskRow key={m.id} color={color}>{m.line.slice(2)}</AsteriskRow>;
    }
    // Action line with checkbox □/✓
    if (linkedStep) {
      return (
        <ActionRow key={m.id} color={color} completed={isCompleted}>
          {displayLine}
        </ActionRow>
      );
    }
    // Advisory / system callout
    return <SystemRow key={m.id} color={color}>{displayLine}</SystemRow>;
  }

  return (
    <div
      className="border border-[var(--color-border)] font-mono select-none flex flex-col"
      style={{ backgroundColor: "#000000", flex: "1 1 0", minHeight: 0 }}
    >
      {/* Header — only the ECAM label is shown when nothing is wrong.
          Once a message exists OR master warning is active, the message
          count badge and ENG 1 N1 read-out reappear. */}
      <div
        className="flex items-center justify-between px-3 py-[5px] border-b"
        style={{ borderColor: C.border }}
      >
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.25em" }}>ECAM</span>
        {messages.length > 0 && (
          <span style={{ color: state.masterWarnActive ? C.red : C.dim, fontSize: "9px", letterSpacing: "0.15em" }}>
            {messages.length} MSG
          </span>
        )}
        {(messages.length > 0 || state.masterWarnActive) && (
          <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.1em" }}>
            ENG 1 N1{" "}
            <span style={{ color: state.masterWarnActive ? C.red : C.green }}>
              {state.masterWarnActive ? "- - -" : "84.2"}
            </span>
            {" "}%
          </span>
        )}
      </div>

      {/* Two-column body */}
      <div className="flex" style={{ flex: "1 1 0", minHeight: "200px", overflow: "hidden" }}>

        {/* LEFT — primary procedure */}
        <div
          className="flex flex-col gap-[3px]"
          style={{ flex: "1 1 0", padding: "10px 8px 10px 14px", overflowY: "auto" }}
        >
          {/* When there are no ECAM messages, leave the column blank —
              per user spec, only the "ECAM" header label should remain. */}
          {leftMsgs.length > 0 && leftMsgs.map(renderMsg)}
        </div>

        {/* RIGHT — secondary failures (visible only after MASTER OFF) */}
        {rightMsgs.length > 0 && (
          <div
            className="flex flex-col gap-[3px]"
            style={{
              width: "120px",
              flexShrink: 0,
              borderLeft: `1px solid ${C.border}`,
              padding: "10px 10px 10px 10px",
              overflowY: "auto",
            }}
          >
            {rightMsgs.map(renderMsg)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row components ───────────────────────────────────────────────────────────

function TitleRow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ color, fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", lineHeight: "1.4", marginBottom: "2px" }}>
      {children}
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
    <div className="flex items-baseline" style={{ gap: "5px" }}>
      <span style={{ color, fontSize: "12px", fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>*</span>
      <span style={{ color, fontSize: "11px", letterSpacing: "0.06em", lineHeight: "1.6", fontWeight: 600 }}>
        {children}
      </span>
    </div>
  );
}

function ActionRow({ color, completed, children }: { color: string; completed: boolean; children: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline gap-[5px]"
      style={{ color, opacity: completed ? 0.6 : 1, fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", lineHeight: "1.55", transition: "color 0.35s ease, opacity 0.35s ease" }}
    >
      <span style={{ fontSize: "10px", lineHeight: 1, flexShrink: 0, minWidth: "12px" }}>
        {completed ? "✓" : "□"}
      </span>
      <span>{children}</span>
    </div>
  );
}

function SystemRow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ color, fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", lineHeight: "1.55", paddingLeft: "17px" }}>
      {children}
    </div>
  );
}

function MemoRow({ color, size, children }: { color: string; size: "sm" | "xs"; children: React.ReactNode }) {
  return (
    <div style={{ color, fontSize: size === "sm" ? "12px" : "10px", letterSpacing: "0.08em", lineHeight: "1.4" }}>
      {children}
    </div>
  );
}
