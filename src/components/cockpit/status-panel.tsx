"use client";

// A320 ECAM STATUS page — FCOM PRO-ABN-ENG p.39-42
// Two-column layout: left = status/limitations, right = INOP SYS.
// Appears after all required ECAM actions are complete.

import type { Scenario } from "@/scenarios/types";
import type { ScenarioState } from "@/engine/state";

const C = {
  red:    "#FF3333",
  amber:  "#FFB300",
  green:  "#00D060",
  cyan:   "#00CFFF",
  white:  "#E8ECF4",
  dim:    "#6A7488",
  border: "#1C2130",
} as const;

function statusColor(severity: "caution" | "advisory" | "memo"): string {
  switch (severity) {
    case "caution":  return C.amber;
    case "advisory": return C.cyan;
    case "memo":     return C.green;
  }
}

export function StatusPanel({
  scenario,
  state,
}: {
  scenario: Scenario;
  state: ScenarioState;
}) {
  const ecamActionsDone = scenario.steps
    .filter((s) => !!s.ecamRef)
    .every((s) => !!state.completedSteps[s.id]);

  if (!ecamActionsDone || !scenario.statusItems?.length) return null;

  const leftItems  = scenario.statusItems.filter((i) => !i.inopSys);
  const rightItems = scenario.statusItems.filter((i) =>  i.inopSys);

  return (
    <div
      className="font-mono select-none border"
      style={{
        flexShrink: 0,
        marginTop: "4px",
        backgroundColor: "#000000",
        borderColor: C.border,
        maxHeight: "240px",
        overflowY: "auto",
      }}
    >
      {/* STATUS header */}
      <div
        className="flex items-center gap-2 px-3 py-[5px] border-b"
        style={{ borderColor: C.border }}
      >
        <span style={{ color: C.white, fontSize: "10px", letterSpacing: "0.2em", fontWeight: 700 }}>
          STATUS
        </span>
        <div style={{ flex: 1, height: "1px", backgroundColor: C.border }} />
        <span style={{ color: C.dim, fontSize: "8px", letterSpacing: "0.15em" }}>
          FCOM PRO-ABN-ENG
        </span>
      </div>

      {/* Two-column body */}
      <div className="flex" style={{ minHeight: 0 }}>

        {/* LEFT — status / limitations */}
        <div className="flex flex-col gap-[4px]" style={{ flex: "1 1 0", padding: "8px 8px 8px 14px" }}>
          {leftItems.map((item) => (
            <div
              key={item.id}
              className="flex items-baseline gap-2"
              style={{ color: statusColor(item.severity), fontSize: "11px", letterSpacing: "0.05em", lineHeight: "1.5", fontWeight: 500 }}
            >
              <span style={{ color: C.dim, fontSize: "7px", lineHeight: 1, flexShrink: 0 }}>◈</span>
              {item.line}
            </div>
          ))}
        </div>

        {/* RIGHT — INOP SYS (only when items exist) */}
        {rightItems.length > 0 && (
          <div
            className="flex flex-col gap-[4px]"
            style={{
              width: "130px",
              flexShrink: 0,
              borderLeft: `1px solid ${C.border}`,
              padding: "8px 10px 8px 10px",
            }}
          >
            {/* INOP SYS header */}
            <div style={{ color: C.white, fontSize: "8px", letterSpacing: "0.2em", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px", marginBottom: "4px" }}>
              INOP SYS
            </div>
            {rightItems.map((item) => (
              <div
                key={item.id}
                style={{ color: statusColor(item.severity), fontSize: "10px", letterSpacing: "0.05em", lineHeight: "1.5", fontWeight: 500 }}
              >
                {item.line}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FCOM reminder footer */}
      <div
        className="px-3 py-[5px] border-t"
        style={{ borderColor: C.border }}
      >
        <span style={{ color: C.dim, fontSize: "8px", letterSpacing: "0.1em" }}>
          REFER TO QRH / FCOM FOR APPLICABLE PROCEDURES
        </span>
      </div>
    </div>
  );
}
