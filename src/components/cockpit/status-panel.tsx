"use client";

// A320 ECAM STATUS page — FCOM PRO-ABN-ENG p.39-42
// Appears after all required ECAM actions are complete.
// Mirrors real A320 STATUS page: advisory=cyan, caution=amber, memo=green.

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
  const requiredDone = scenario.steps
    .filter((s) => !s.optional)
    .every((s) => !!state.completedSteps[s.id]);

  if (!requiredDone || !scenario.statusItems?.length) return null;

  return (
    <div
      className="font-mono select-none border"
      style={{
        flexShrink: 0,
        marginTop: "4px",
        backgroundColor: "#000000",
        borderColor: C.border,
        maxHeight: "220px",
        overflowY: "auto",
      }}
    >
      {/* STATUS header — FCOM style: white label + separator */}
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

      {/* Status items — each on its own line, left-padded like real STATUS page */}
      <div className="px-4 py-2 flex flex-col gap-[4px]">
        {scenario.statusItems.map((item) => (
          <div
            key={item.id}
            className="flex items-baseline gap-2"
            style={{ color: statusColor(item.severity), fontSize: "11px", letterSpacing: "0.05em", lineHeight: "1.5", fontWeight: 500 }}
          >
            <span style={{ color: C.dim, fontSize: "8px", lineHeight: 1, flexShrink: 0 }}>◈</span>
            {item.line}
          </div>
        ))}
      </div>

      {/* FCOM procedure reminder */}
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
