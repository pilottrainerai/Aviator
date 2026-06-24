"use client";

// Context Display — the lower-left SD region as a manually-switched tab shell.
//   SYSTEM  → the existing <SystemDisplay> (SD synoptic), unchanged. Default.
//   QRH     → the scenario's qrhSummary in real black-on-white QRH format.
//   GRAPHIC → reserved space for the handling-technique diagram (built later).
// Tabs are manual (instructor or trainee taps them) — nothing auto-switches.
// Wired in dev-gated (?dev=1); the live flow renders <SystemDisplay> directly.

import { useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { Scenario } from "@/scenarios/types";
import { SystemDisplay } from "./system-display";
import { QrhSummaryCard } from "./qrh-summary-card";

type Tab = "system" | "qrh" | "graphic";

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: "system", label: "SYSTEM", sub: "SD" },
  { id: "qrh", label: "QRH", sub: "SUMMARY" },
  { id: "graphic", label: "GRAPHIC", sub: "TECHNIQUE" },
];

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "20px",
        color: "#6A7488",
        fontSize: "11px",
        lineHeight: 1.5,
        fontFamily: "monospace",
      }}
    >
      <div>{children}</div>
    </div>
  );
}

function GraphicPlaceholder() {
  return (
    <div
      style={{
        height: "100%",
        background:
          "repeating-linear-gradient(45deg,#0d1117,#0d1117 12px,#0f141b 12px,#0f141b 24px)",
      }}
    >
      <Centered>
        <div style={{ fontSize: "30px", opacity: 0.45 }}>📉</div>
        <div style={{ color: "#E8ECF4", fontSize: "13px", letterSpacing: "0.04em", marginTop: "8px" }}>
          TECHNIQUE GRAPHIC
        </div>
        <div style={{ maxWidth: "320px", marginTop: "6px" }}>
          Reserved space. The “stabilise at VAPP” diagram goes here: decelerate &amp;
          auto-trim through the elevators → CONF 3 + VAPP @ 2500 ft AAL → L/G DOWN →
          DIRECT LAW (mean elevator = centred-stick reference).
        </div>
      </Centered>
    </div>
  );
}

export function ContextDisplay({
  state,
  scenario,
}: {
  state: ScenarioState;
  scenario: Scenario;
}) {
  const [tab, setTab] = useState<Tab>("system");

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#0D1117",
        border: "1px solid #1C2130",
        borderRadius: "4px",
      }}
    >
      {/* Tab strip */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "4px 4px 0 4px",
          background: "#0B0F15",
          borderBottom: "1px solid #1C2130",
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "5px 4px",
                textAlign: "center",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: active ? "#fff" : "#6A7488",
                background: active ? "#22303F" : "#161B22",
                border: "1px solid #1C2130",
                borderBottom: "none",
                borderRadius: "4px 4px 0 0",
                boxShadow: active ? "inset 0 -2px 0 #3DA4FF" : "none",
                fontFamily: "monospace",
              }}
            >
              {t.label}
              <span
                style={{
                  display: "block",
                  fontSize: "7.5px",
                  fontWeight: 500,
                  color: active ? "#BCD6F0" : "#6A7488",
                  marginTop: "1px",
                }}
              >
                {t.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active pane */}
      <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        {tab === "system" && <SystemDisplay state={state} scenario={scenario} />}
        {tab === "qrh" &&
          (scenario.qrhSummary ? (
            <QrhSummaryCard summary={scenario.qrhSummary} />
          ) : (
            <Centered>No QRH summary defined for this scenario.</Centered>
          ))}
        {tab === "graphic" && <GraphicPlaceholder />}
      </div>
    </div>
  );
}
