"use client";

// Context Display — the lower-left SD region as a tab shell.
//   SYSTEM  → the existing <SystemDisplay> (SD synoptic), unchanged. Default.
//   QRH     → the scenario's qrhSummary in real black-on-white QRH format.
//   GRAPHIC → reserved space for the handling-technique diagram (built later).
// Tabs are tappable manually. In addition, the display AUTO-SWITCHES to follow
// the active procedure step: a step tagged `opensContextTab` (or whose label
// mentions "summary") pulls the matching tab up (e.g. QRH during the QRH read /
// review). It reverts to SYSTEM on untagged steps. The auto-switch only fires
// when the active step changes, so a manual tap is respected within a step.

import { useEffect, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { Scenario, ScenarioStep } from "@/scenarios/types";
import { SystemDisplay } from "./system-display";
import { QrhSummaryCard } from "./qrh-summary-card";

type Tab = "system" | "qrh" | "graphic" | "info";

// Which tab a step wants up: explicit tag wins; otherwise a label mention of
// "summary" routes to the QRH tab (the trainee's "summary" cue). Untagged → system.
function tabForStep(step: ScenarioStep | null | undefined): Tab {
  if (!step) return "system";
  if (step.opensContextTab) return step.opensContextTab;
  if (/summary/i.test(step.label)) return "qrh";
  return "system";
}

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: "system", label: "SYSTEM", sub: "SD" },
  { id: "qrh", label: "QRH", sub: "SUMMARY" },
  { id: "graphic", label: "GRAPHIC", sub: "TECHNIQUE" },
  { id: "info", label: "INFO", sub: "LEARN MORE" },
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

function AdditionalInfo({
  items,
}: {
  items?: Scenario["additionalInfo"];
}) {
  if (!items || items.length === 0) {
    return <Centered>No additional information for this scenario yet.</Centered>;
  }
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "10px", background: "#0D1117" }}>
      {items.map((it, i) => {
        const authoritative = it.verified && it.source.type !== "experience";
        const badge =
          it.source.type === "video"
            ? { text: it.source.url ? "VIDEO ↗" : "VIDEO", color: "#3DA4FF", bg: "#10243A" }
            : authoritative
              ? { text: `VERIFIED · ${it.source.ref ?? it.source.type.toUpperCase()}`, color: "#5BD6A0", bg: "#10261E" }
              : { text: "UNVERIFIED · PENDING SME", color: "#E0A33B", bg: "#2A2110" };
        return (
          <div
            key={i}
            style={{
              marginBottom: "10px",
              border: "1px solid #1C2130",
              borderRadius: "4px",
              background: "#11161F",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "7px 9px", borderBottom: "1px solid #1C2130" }}>
              <span style={{ color: "#E8ECF4", fontSize: "12px", fontWeight: 700, letterSpacing: "0.02em", fontFamily: "monospace" }}>
                {it.title}
              </span>
              <span style={{ flexShrink: 0, color: badge.color, background: badge.bg, fontSize: "8.5px", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 6px", borderRadius: "3px", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                {badge.text}
              </span>
            </div>
            <div style={{ padding: "8px 9px", color: "#AEB7C7", fontSize: "11px", lineHeight: 1.55, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
              {it.body}
              {it.source.url && (
                <div style={{ marginTop: "7px" }}>
                  <a href={it.source.url} target="_blank" rel="noopener noreferrer" style={{ color: "#3DA4FF", fontSize: "10px", textDecoration: "underline" }}>
                    Open reference ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ContextDisplay({
  state,
  scenario,
  activeStep,
}: {
  state: ScenarioState;
  scenario: Scenario;
  /** The current/next procedure step. Drives the auto-switch (e.g. → QRH on the
   *  QRH summary/review steps). Optional: when absent the display is fully manual. */
  activeStep?: ScenarioStep | null;
}) {
  const [tab, setTab] = useState<Tab>("system");

  // Auto-switch to follow the active step — but only when the step actually
  // changes, so a manual tap is honored for the rest of that step.
  const lastStepId = useRef<string | null>(null);
  useEffect(() => {
    const id = activeStep?.id ?? null;
    if (id === lastStepId.current) return;
    lastStepId.current = id;
    setTab(tabForStep(activeStep));
  }, [activeStep]);

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
            <QrhSummaryCard summary={scenario.qrhSummary} activeSections={activeStep?.qrhHighlightSections} />
          ) : (
            <Centered>No QRH summary defined for this scenario.</Centered>
          ))}
        {tab === "graphic" && <GraphicPlaceholder />}
        {tab === "info" && <AdditionalInfo items={scenario.additionalInfo} />}
      </div>
    </div>
  );
}
