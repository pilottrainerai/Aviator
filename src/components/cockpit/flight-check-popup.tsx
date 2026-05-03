"use client";

import { useEffect, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, ScenarioStep } from "@/scenarios/types";

// ─── Priority tiers ───────────────────────────────────────────────────────────
// Three visual themes based on task criticality — not by group, by severity.
// CRITICAL  = red/amber  → glareshield warning, confirmRequired ECAM steps
// PROCEDURE = navy/cyan  → ECAM actions, flightcheck (normal ops)
// ADVISORY  = teal/blue  → CRM comms, checklists

type Theme = {
  bodyBg: string;      // card background (not pure black)
  border: string;      // border color
  headerBg: string;    // header strip background
  accent: string;      // text / button accent
  glow: string;        // box-shadow glow
  badge: string;       // top-left badge text
};

const THEMES: Record<string, Theme> = {
  critical: {
    bodyBg:   "#0F0707",
    border:   "#FF3333",
    headerBg: "#FF333322",
    accent:   "#FF3333",
    glow:     "0 0 40px #FF333340, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "CRITICAL",
  },
  caution: {
    bodyBg:   "#0F0C05",
    border:   "#FFB300",
    headerBg: "#FFB30020",
    accent:   "#FFB300",
    glow:     "0 0 40px #FFB30035, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "CAUTION",
  },
  pf: {
    bodyBg:   "#05090F",
    border:   "#00CFFF",
    headerBg: "#00CFFF18",
    accent:   "#00CFFF",
    glow:     "0 0 40px #00CFFF30, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "PF",
  },
  pm: {
    bodyBg:   "#080A05",
    border:   "#FFB300",
    headerBg: "#FFB30018",
    accent:   "#FFB300",
    glow:     "0 0 35px #FFB30028, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "PM",
  },
  crm: {
    bodyBg:   "#050A10",
    border:   "#4F8CFF",
    headerBg: "#4F8CFF16",
    accent:   "#4F8CFF",
    glow:     "0 0 35px #4F8CFF28, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "CRM",
  },
  checklist: {
    bodyBg:   "#050E08",
    border:   "#00D060",
    headerBg: "#00D06018",
    accent:   "#00D060",
    glow:     "0 0 35px #00D06028, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "CHECKLIST",
  },
};

function resolveTheme(step: ScenarioStep, executePhase: boolean): Theme {
  const { group, crew, variant, confirmRequired } = step;

  // Execute phase (second click on confirmRequired) — always caution amber
  if (executePhase) return THEMES.caution;

  // Glareshield warning (MASTER WARN) — critical red
  if (group === "glareshield" && variant === "warning") return THEMES.critical;

  // confirmRequired ECAM steps (MASTER OFF, FIRE PB) — caution amber
  if (confirmRequired) return THEMES.caution;

  // Glareshield caution (MASTER CAUT)
  if (group === "glareshield") return THEMES.caution;

  // Checklists
  if (group === "chclm") return THEMES.checklist;

  // CRM communications
  if (group === "comms") return THEMES.crm;

  // Procedure / flightcheck — split PF (cyan) vs PM (amber)
  if (crew === "PF") return THEMES.pf;
  return THEMES.pm;
}

// ─── Step sequencing ──────────────────────────────────────────────────────────

function nextPendingStep(steps: ScenarioStep[], state: ScenarioState): ScenarioStep | null {
  for (const s of steps) {
    if (s.optional) continue;
    if (state.completedSteps[s.id]) continue;
    const met = (s.requires ?? []).every((r) => !!state.completedSteps[r]);
    if (met) return s;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlightCheckPopup({
  scenario,
  state,
  perform,
  disabled,
  compact,
}: {
  scenario: Scenario;
  state: ScenarioState;
  perform: (action: PilotAction) => void;
  disabled?: boolean;
  /** true = ATC modal also showing; raise z-index above ATC backdrop */
  compact?: boolean;
}) {
  const step = nextPendingStep(scenario.steps, state);

  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    setPendingConfirm(false);
  }, [step?.id]);

  if (!step) return null;

  const isExecutePhase = !!(step.confirmRequired && pendingConfirm);
  const theme = resolveTheme(step, isExecutePhase);

  const handleConfirm = () => {
    if (step.confirmRequired && !pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    setPendingConfirm(false);
    perform({ kind: "STEP", stepId: step.id });
  };

  return (
    <>
      <style>{`
        @keyframes crew-from-right {
          0%   { opacity: 0; transform: translateY(-50%) translateX(32px) scale(0.95); }
          65%  { transform: translateY(-50%) translateX(-5px) scale(1.01); }
          100% { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
        }
      `}</style>

      {/* Subtle backdrop on the right half — dims cockpit behind the card */}
      {!compact && (
        <div
          className="fixed inset-0"
          style={{
            zIndex: 38,
            background: "linear-gradient(270deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, transparent 75%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Card — right side */}
      <div
        className="fixed font-mono"
        style={{
          top: "50%",
          right: "32px",
          zIndex: 40,
          width: "min(520px, 44vw)",
          backgroundColor: theme.bodyBg,
          border: `2px solid ${theme.border}`,
          borderRadius: "4px",
          boxShadow: theme.glow,
          animation: "crew-from-right 0.24s cubic-bezier(0.34, 1.4, 0.64, 1) both",
        }}
      >
        {/* ── Top accent bar ────────────────────────────────────────── */}
        <div
          style={{
            height: "3px",
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}00)`,
          }}
        />

        {/* ── Header ───────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-3"
          style={{ backgroundColor: theme.headerBg, borderBottom: `1px solid ${theme.border}30` }}
        >
          {/* Priority badge */}
          <span
            className="px-2 py-[3px] rounded-sm font-mono"
            style={{
              fontSize: "8px",
              letterSpacing: "0.2em",
              fontWeight: 700,
              backgroundColor: theme.accent + "28",
              color: theme.accent,
              border: `1px solid ${theme.accent}50`,
            }}
          >
            {theme.badge}
          </span>

          {/* Step label */}
          <span
            style={{
              color: isExecutePhase ? "#FFB300" : theme.accent,
              fontSize: "13px",
              letterSpacing: "0.14em",
              fontWeight: 700,
              textTransform: "uppercase",
              flex: 1,
            }}
          >
            {step.label}
          </span>

          {/* Action chip */}
          <span
            className="px-3 py-1 border rounded-sm"
            style={{
              fontSize: "9px",
              letterSpacing: "0.15em",
              fontWeight: 700,
              textTransform: "uppercase",
              borderColor: theme.accent + "60",
              color: theme.accent,
              backgroundColor: theme.accent + "14",
            }}
          >
            {step.action}
          </span>

          {/* Status indicator */}
          <span
            className={isExecutePhase ? "animate-pulse" : ""}
            style={{
              fontSize: "8px",
              letterSpacing: "0.18em",
              color: isExecutePhase ? "#FFB300" : theme.accent + "99",
              textTransform: "uppercase",
              marginLeft: "4px",
            }}
          >
            {isExecutePhase ? "⚠ CONFIRM BEFORE ACTION" : step.group === "chclm" ? "CHECKLIST" : step.group === "comms" ? "CRM" : "ACTION REQUIRED"}
          </span>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="px-6 py-5">
          <p
            style={{
              color: "#D8DCE6",
              fontSize: "13px",
              lineHeight: "1.65",
              letterSpacing: "0.025em",
            }}
          >
            {step.hint}
          </p>

          {/* Notes (FORDEC, NIS, G/A review, checklists) */}
          {step.notes && step.notes.length > 0 && (
            <div
              className="mt-4 rounded-sm px-4 py-3"
              style={{
                backgroundColor: theme.accent + "0C",
                border: `1px solid ${theme.accent}25`,
              }}
            >
              <ul className="flex flex-col gap-[5px]">
                {step.notes.map((note, i) => (
                  <li
                    key={i}
                    style={{
                      color: "#9AAABB",
                      fontSize: "11px",
                      letterSpacing: "0.04em",
                      lineHeight: "1.6",
                      fontFamily: "monospace",
                    }}
                  >
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Footer — confirm button ───────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: `1px solid ${theme.border}25` }}
        >
          {/* Crew assignment indicator */}
          <span style={{ color: theme.accent + "70", fontSize: "9px", letterSpacing: "0.2em" }}>
            {step.crew ?? "PM"} — {step.group?.toUpperCase() ?? "PROCEDURE"}
          </span>

          <button
            type="button"
            disabled={disabled}
            onClick={handleConfirm}
            className="font-mono uppercase tracking-widest transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              fontWeight: 700,
              padding: "10px 28px",
              borderRadius: "2px",
              border: `2px solid ${isExecutePhase ? "#FFB300" : theme.accent}`,
              backgroundColor: isExecutePhase ? "#FFB30022" : theme.accent + "1E",
              color: isExecutePhase ? "#FFB300" : theme.accent,
              boxShadow: `0 0 16px ${isExecutePhase ? "#FFB30040" : theme.accent + "30"}`,
            }}
          >
            {isExecutePhase ? "EXECUTE ▶" : step.confirmRequired ? "CONFIRM?" : "CONFIRM ✓"}
          </button>
        </div>
      </div>
    </>
  );
}
