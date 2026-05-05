"use client";

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
    case "memo":     return C.green;
  }
}

// Messages that belong to the RIGHT column (secondary failures panel)
function isRightCol(line: string) {
  return line === "LAND ASAP" || line === "SECONDARY FAILURES" || line.startsWith("* ");
}

export function EwdDisplay({
  state,
  scenario,
}: {
  state: ScenarioState;
  scenario: Scenario;
}) {
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
    const color       = isCompleted ? C.green : levelColor(m.level);

    // Large title: ENG 1 FAIL, LAND ASAP (directives / procedure headers)
    if (!linkedStep && (m.level === "warning" || m.line === "LAND ASAP" || m.line === "ENG 1 FAIL")) {
      return <TitleRow key={m.id} color={color}>{m.line}</TitleRow>;
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
          {m.line}
        </ActionRow>
      );
    }
    // Advisory / system callout
    return <SystemRow key={m.id} color={color}>{m.line}</SystemRow>;
  }

  return (
    <div
      className="border border-[var(--color-border)] font-mono select-none flex flex-col"
      style={{ backgroundColor: "#000000", flex: "1 1 0", minHeight: 0 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-[5px] border-b"
        style={{ borderColor: C.border }}
      >
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.25em" }}>ECAM</span>
        <span style={{ color: state.masterWarnActive ? C.red : C.dim, fontSize: "9px", letterSpacing: "0.15em" }}>
          {messages.length === 0 ? "NORM" : `${messages.length} MSG`}
        </span>
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.1em" }}>
          ENG 1 N1{" "}
          <span style={{ color: state.masterWarnActive ? C.red : C.green }}>
            {state.masterWarnActive ? "- - -" : "84.2"}
          </span>
          {" "}%
        </span>
      </div>

      {/* Two-column body */}
      <div className="flex" style={{ flex: "1 1 0", minHeight: "200px", overflow: "hidden" }}>

        {/* LEFT — primary procedure */}
        <div
          className="flex flex-col gap-[3px]"
          style={{ flex: "1 1 0", padding: "10px 8px 10px 14px", overflowY: "auto" }}
        >
          {leftMsgs.length === 0 ? (
            <>
              <MemoRow color={C.green} size="sm">— NORMAL —</MemoRow>
              <MemoRow color={C.dim}   size="xs">ALL WARNINGS CLEAR</MemoRow>
            </>
          ) : (
            leftMsgs.map(renderMsg)
          )}
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
