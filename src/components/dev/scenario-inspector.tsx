"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DEV — Scenario Inspector (reusable)
// Pick any step (the legend) and see the WHOLE expected structure at that point:
//   • progression — which steps/gates are already DONE, which is the ACTIVE gate
//   • the procedure card (crew, group, requires, hint, notes)
//   • the FMA + fuller PFD readout computed for that point
//   • the ATC call(s) gated on that step
// Used both as a standalone /dev page and as an in-session overlay (onClose set).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import type { Scenario } from "@/scenarios/types";
import { buildAircraftState } from "@/components/cockpit/pfd-nd";

const C = { bg: "#0A0F18", panel: "#101722", line: "#1C2530", green: "#50FA7B", amber: "#FFD700", dim: "#77839A", text: "#E5E9F0" };

export function ScenarioInspector({ scenario, initialStepId, onClose, onSeek }: { scenario: Scenario; initialStepId?: string; onClose?: () => void; onSeek?: (stepIds: string[]) => void }) {
  const steps = scenario.steps;
  const distractions = scenario.distractions ?? [];

  const idxOf = (id?: string) => Math.max(0, steps.findIndex((s) => s.id === id));
  const [sel, setSel] = useState(() => idxOf(initialStepId));
  useEffect(() => { if (initialStepId) setSel(idxOf(initialStepId)); /* eslint-disable-next-line */ }, [initialStepId]);

  const step = steps[sel];

  // Synthetic state at the selected step: every step up to & including it is done.
  const fma = useMemo(() => {
    const completedSteps: Record<string, boolean> = {};
    steps.slice(0, sel + 1).forEach((s) => { completedSteps[s.id] = true; });
    return buildAircraftState({ completedSteps, triggersFired: { structural_fail: true } } as never, scenario, 0);
  }, [sel, scenario, steps]);

  const atc = useMemo(() => distractions.filter((d) => d.requiresStep === step.id), [step.id, distractions]);

  const lbl = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", gap: 8, fontSize: 12, padding: "1px 0" }}>
      <span style={{ color: C.dim, minWidth: 100, textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
      <span style={{ color: C.text }}>{v}</span>
    </div>
  );

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: "ui-monospace,Menlo,monospace", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span><span style={{ color: C.green, fontWeight: 700, letterSpacing: ".12em" }}>SCENARIO INSPECTOR</span>
          <span style={{ color: C.dim, marginLeft: 12, fontSize: 12 }}>{scenario.meta?.slug} · {steps.length} steps · {distractions.length} ATC</span></span>
        {onClose && <button onClick={onClose} style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text, padding: "3px 12px", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>✕ Close</button>}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* LEFT — legend with done/active/pending markers */}
        <div style={{ flex: "0 0 320px", borderRight: `1px solid ${C.line}`, overflowY: "auto" }}>
          {steps.map((s, i) => {
            const done = i < sel, active = i === sel;
            return (
              <button key={s.id} onClick={() => setSel(i)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 12px", fontSize: 11,
                  background: active ? C.panel : "transparent", border: "none",
                  borderLeft: `3px solid ${active ? C.green : "transparent"}`,
                  color: active ? C.text : done ? "#5c6b80" : C.dim, cursor: "pointer" }}>
                <span style={{ marginRight: 6, color: done ? C.green : active ? C.amber : C.dim }}>{done ? "✓" : active ? "►" : "·"}</span>
                <span style={{ color: C.amber, marginRight: 6 }}>{String(i + 1).padStart(2, "0")}</span>
                {s.id}
                {(s as { hardware?: boolean }).hardware && <span style={{ color: C.green, marginLeft: 6 }}>HW</span>}
                {(s as { optional?: boolean }).optional && <span style={{ color: C.dim, marginLeft: 6 }}>OPT</span>}
              </button>
            );
          })}
        </div>

        {/* RIGHT — fixed detail for the selected point */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          {/* progression */}
          <div style={{ color: C.dim, fontSize: 11, marginBottom: 8 }}>
            At this point: <span style={{ color: C.green }}>{sel} done</span> · <span style={{ color: C.amber }}>active gate ► {step.id}</span> · {steps.length - sel - 1} remaining
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            <span style={{ color: C.amber }}>{String(sel + 1).padStart(2, "0")}</span> · {step.label}
            <span style={{ color: C.dim, fontSize: 13, fontWeight: 400 }}>  ({step.id})</span>
          </div>
          <div style={{ color: C.green, fontSize: 13, marginBottom: 8 }}>{step.action}</div>
          {onSeek && (
            <button
              onClick={() => onSeek(steps.slice(0, sel + 1).map((s) => s.id))}
              style={{ background: "#13203a", border: `1px solid ${C.green}`, color: C.green, fontFamily: "inherit",
                padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontSize: 12, marginBottom: 12 }}>
              ⏩ SEEK SCENARIO TO HERE (sets steps 1–{sel + 1} done, play from this point)
            </button>
          )}

          <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ color: C.dim, fontSize: 9, letterSpacing: ".2em", marginBottom: 6 }}>▸ PROCEDURE CARD</div>
            {lbl("crew", (step as { crew?: string }).crew ?? "—")}
            {lbl("group", (step as { group?: string }).group ?? "—")}
            {lbl("flags", `${(step as { hardware?: boolean }).hardware ? "HARDWARE " : ""}${(step as { optional?: boolean }).optional ? "OPTIONAL" : ""}` || "—")}
            {lbl("requires", JSON.stringify((step as { requires?: string[]; requiresTrigger?: string }).requires ?? (step as { requiresTrigger?: string }).requiresTrigger ?? "—"))}
            <div style={{ marginTop: 4 }}>{lbl("hint", <span style={{ whiteSpace: "pre-wrap" }}>{step.hint}</span>)}</div>
            {(step as { notes?: string[] }).notes && (
              <ul style={{ margin: "6px 0 0 16px", color: C.text, fontSize: 11 }}>
                {(step as { notes?: string[] }).notes!.map((n, i) => <li key={i} style={{ marginBottom: 2 }}>{n}</li>)}
              </ul>
            )}
          </div>

          <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ color: C.dim, fontSize: 9, letterSpacing: ".2em", marginBottom: 6 }}>▸ FMA / PFD AT THIS STEP</div>
            <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 4 }}>
              <span><span style={{ color: C.dim }}>A/THR </span><b style={{ color: C.green }}>{fma.thrMode || "—"}</b></span>
              <span><span style={{ color: C.dim }}>VERT </span><b style={{ color: C.green }}>{fma.vertMode || "—"}</b></span>
              <span><span style={{ color: C.dim }}>LAT </span><b style={{ color: C.green }}>{fma.latMode || "—"}</b></span>
              <span><span style={{ color: C.dim }}>AP </span><b style={{ color: fma.apEngaged ? C.green : C.dim }}>{fma.apEngaged ? "AP1" : "—"}</b></span>
              <span><span style={{ color: C.dim }}>A/THR </span><b style={{ color: fma.athrActive ? C.green : C.dim }}>{fma.athrActive ? "ON" : "—"}</b></span>
            </div>
            {lbl("law", fma.law ?? "—")}
            {lbl("altitude", `${Math.round(fma.altitude)} ft   (selected ${Math.round((fma as { selectedAlt?: number }).selectedAlt ?? fma.altitude)} ft)`)}
            {lbl("speed", `${Math.round(fma.speed)} kt   (Vmax ${Math.round((fma as { vmax?: number }).vmax ?? 0)})`)}
            {lbl("v/s", `${Math.round(fma.vs)} fpm`)}
            {lbl("heading", `${Math.round((fma as { heading?: number }).heading ?? 0)}°   (sel ${Math.round((fma as { selectedHdg?: number }).selectedHdg ?? 0)}°)`)}
          </div>

          <div style={{ border: `1px solid ${atc.length ? C.amber : C.line}`, borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ color: atc.length ? C.amber : C.dim, fontSize: 9, letterSpacing: ".2em", marginBottom: 6 }}>▸ ATC CALL(S) GATED ON THIS STEP ({atc.length})</div>
            {atc.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>— none —</div>}
            {atc.map((d) => (
              <div key={d.id} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: C.amber }}>{d.id}</span>
                  <span style={{ color: C.dim, marginLeft: 8 }}>{d.from}</span>
                  <span style={{ color: C.dim, marginLeft: 8 }}>gap {((d as { gapAfterMs?: number }).gapAfterMs ?? 15000) / 1000}s</span>
                  {(d as { atAltitudeBelowFt?: number }).atAltitudeBelowFt && <span style={{ color: C.green, marginLeft: 8 }}>≤{(d as { atAltitudeBelowFt?: number }).atAltitudeBelowFt}ft</span>}
                  {(d as { completesStep?: string }).completesStep && <span style={{ color: C.green, marginLeft: 8 }}>→{(d as { completesStep?: string }).completesStep}</span>}
                </div>
                <div style={{ color: C.text, fontSize: 12, margin: "3px 0" }}>“{d.message}”</div>
                {(d.choices ?? []).map((c, i) => (
                  <div key={i} style={{ fontSize: 11, color: c.correct ? C.green : C.dim }}>{c.correct ? "✔" : "✘"} {c.label}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
