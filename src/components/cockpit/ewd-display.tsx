"use client";

import type { ScenarioState } from "@/engine/state";
import type { ECAMLevel, Scenario, StatusItem } from "@/scenarios/types";

// ─── Airbus A320 ECAM display color specification ─────────────────────────────
// Source: Airbus FCOM DSC-31-60 "ECAM — General" + Airbus published display values.
// Do NOT map these to Tailwind palette — ECAM colors are system-defined.
const C = {
  red:    "#FF3333",  // Level 3 WARNING  — fire, emergency, LAND ASAP
  amber:  "#FFB300",  // Level 2 CAUTION  — action required, pending items
  green:  "#00D060",  // NORMAL / completed action / memo
  cyan:   "#00CFFF",  // ADVISORY         — informational, ATC NOTIFY
  white:  "#E6E8EC",  // STATUS page text
  dim:    "#3A4050",  // Inactive text, borders, header labels
  border: "#1C2130",  // Internal dividers
} as const;

function levelColor(level: ECAMLevel): string {
  switch (level) {
    case "warning":  return C.red;
    case "caution":  return C.amber;
    case "advisory": return C.cyan;
    case "memo":     return C.green;
  }
}

function statusColor(severity: StatusItem["severity"]): string {
  switch (severity) {
    case "caution":  return C.amber;
    case "advisory": return C.cyan;
    case "memo":     return C.green;
  }
}

export function EwdDisplay({
  state,
  scenario,
}: {
  state: ScenarioState;
  scenario: Scenario;
}) {
  // ecamMsgId → step: for tracking which action lines are complete
  const ecamToStep = new Map(
    scenario.steps
      .filter((s) => !!s.ecamRef)
      .map((s) => [s.ecamRef as string, s]),
  );

  // STATUS page appears once every required (non-optional) step is done
  const requiredDone = scenario.steps
    .filter((s) => !s.optional)
    .every((s) => !!state.completedSteps[s.id]);

  const messages = state.ecamMessages;

  return (
    <div
      className="border border-[var(--color-border)] font-mono select-none flex flex-col"
      style={{ backgroundColor: "#000000" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-[5px] border-b"
        style={{ borderColor: C.border }}
      >
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.25em", textTransform: "uppercase" }}>
          E/WD
        </span>

        {state.masterWarnActive ? (
          <span
            className="animate-pulse font-bold"
            style={{ color: C.red, fontSize: "9px", letterSpacing: "0.2em" }}
          >
            ▲ MASTER WARN
          </span>
        ) : (
          <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.15em" }}>
            {messages.length === 0 ? "NORM" : `${messages.length} MSG`}
          </span>
        )}

        {/* ENG 1 N1 readout — goes to dashes during fire */}
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.1em" }}>
          ENG 1 N1{" "}
          <span style={{ color: state.masterWarnActive ? C.red : C.green }}>
            {state.masterWarnActive ? "- - -" : "84.2"}
          </span>
          {" "}%
        </span>
      </div>

      {/* ── ECAM warnings + procedure ───────────────────────────────────────── */}
      <div className="px-4 py-3 flex flex-col gap-[3px]" style={{ minHeight: "200px" }}>
        {messages.length === 0 ? (
          <div className="mt-4 flex flex-col gap-1">
            <MemoRow color={C.green} size="sm">— NORMAL —</MemoRow>
            <MemoRow color={C.dim}   size="xs">ALL WARNINGS CLEAR</MemoRow>
          </div>
        ) : (
          messages.map((m) => {
            const linkedStep  = ecamToStep.get(m.id);
            const isCompleted = linkedStep ? !!state.completedSteps[linkedStep.id] : false;

            // Title = warning-level with no step link (ENG 1 FIRE, LAND ASAP)
            const isTitle      = m.level === "warning" && !linkedStep;
            // Action line = has a step link → shows □/✓ and turns green when done
            const isActionLine = !!linkedStep;
            // System caution = non-title, no step link (secondary failures HYD/AIR/ELEC)

            const color = isCompleted ? C.green : levelColor(m.level);

            if (isTitle) {
              return <TitleRow key={m.id} color={color}>{m.line}</TitleRow>;
            }

            if (isActionLine) {
              return (
                <ActionRow key={m.id} color={color} completed={isCompleted}>
                  {m.line}
                </ActionRow>
              );
            }

            // System caution / secondary failure — no checkbox, slight indent
            return (
              <SystemRow key={m.id} color={color}>{m.line}</SystemRow>
            );
          })
        )}
      </div>

      {/* ── STATUS page ─────────────────────────────────────────────────────── */}
      {/* Appears after all required ECAM actions are complete (mirrors A320 STS page). */}
      {requiredDone && scenario.statusItems && scenario.statusItems.length > 0 && (
        <>
          <div
            className="mx-4 border-t flex items-center gap-3 py-[5px]"
            style={{ borderColor: C.border }}
          >
            <span
              style={{ color: C.white, fontSize: "10px", letterSpacing: "0.2em", fontWeight: 600 }}
            >
              STATUS
            </span>
            <div className="flex-1" style={{ borderTop: `1px solid ${C.border}` }} />
          </div>

          <div className="px-4 pb-3 flex flex-col gap-[3px]">
            {scenario.statusItems.map((item) => (
              <div
                key={item.id}
                className="flex items-baseline"
                style={{
                  color: statusColor(item.severity),
                  fontSize: "11px",
                  letterSpacing: "0.06em",
                  lineHeight: "1.55",
                  fontWeight: 500,
                }}
              >
                {item.line}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Row sub-components ───────────────────────────────────────────────────────

/** Large warning title — "ENG 1 FIRE", "LAND ASAP" */
function TitleRow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        color,
        fontSize: "14px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        lineHeight: "1.4",
        marginBottom: "2px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Procedure action line — amber when pending, green when complete.
 * NO strikethrough: the real A320 ECAM does not cross through completed items;
 * it simply changes color to green.
 */
function ActionRow({
  color,
  completed,
  children,
}: {
  color: string;
  completed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-baseline gap-[5px]"
      style={{
        color,
        opacity: completed ? 0.6 : 1,
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.06em",
        lineHeight: "1.55",
        transition: "color 0.35s ease, opacity 0.35s ease",
      }}
    >
      <span style={{ fontSize: "10px", lineHeight: 1, flexShrink: 0, minWidth: "12px" }}>
        {completed ? "✓" : "□"}
      </span>
      {/* No textDecoration — green color alone signals completion, per Airbus ECAM convention */}
      <span>{children}</span>
    </div>
  );
}

/** Secondary system fault line (no step link) — shown without checkbox */
function SystemRow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        color,
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.06em",
        lineHeight: "1.55",
        paddingLeft: "17px", // align with ActionRow text after the checkbox
      }}
    >
      {children}
    </div>
  );
}

/** Generic memo row (normal state) */
function MemoRow({
  color,
  size,
  children,
}: {
  color: string;
  size: "sm" | "xs";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        color,
        fontSize: size === "sm" ? "12px" : "10px",
        letterSpacing: "0.08em",
        lineHeight: "1.4",
      }}
    >
      {children}
    </div>
  );
}
