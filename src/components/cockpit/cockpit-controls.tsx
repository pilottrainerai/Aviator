"use client";

import { useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, ScenarioStep, ControlVariant } from "@/scenarios/types";

// Step IDs per phase — drives section headers in the sequential checklist
const AVIATE_IDS  = ["continue_rotation", "positive_rate_gear_up", "engage_ap_fma"];
const GATE_ID     = "four_hundred_ft_cmd";
const ECAM_IDS    = ["thr_lever_idle", "eng1_master_off", "eng1_fire_pb", "agent1", "agent2", "level_off_maa", "accel_clean"];

const CREW_LABEL: Record<"PF" | "PM", { bg: string; color: string }> = {
  PF: { bg: "#00CFFF18", color: "#00CFFF" },
  PM: { bg: "#FFB30018", color: "#FFB300" },
};

const C = {
  border:   "#1C2130",
  sectionBg:"#050709",
  dim:      "#5A626F",
  text:     "#E6E8EC",
  green:    "#00D060",
  greenBg:  "#00D06009",
  amber:    "#FFB300",
  amberBg:  "#FFB30012",
  red:      "#FF3333",
  redBg:    "#FF333310",
  blue:     "#4F8CFF",
  blueBg:   "#4F8CFF0C",
  bg:       "#060809",
} as const;

type StepStatus = "done" | "current" | "locked";

function getStatus(step: ScenarioStep, state: ScenarioState): StepStatus {
  if (state.completedSteps[step.id]) return "done";
  const reqsMet = (step.requires ?? []).every((r) => !!state.completedSteps[r]);
  return reqsMet ? "current" : "locked";
}

function accentFor(v: ControlVariant): string {
  switch (v) {
    case "warning":  return C.red;
    case "caution":  return C.amber;
    case "advisory": return C.blue;
    default:         return C.amber;
  }
}

function bgFor(v: ControlVariant): string {
  switch (v) {
    case "warning":  return C.redBg;
    case "caution":  return C.amberBg;
    case "advisory": return C.blueBg;
    default:         return C.amberBg;
  }
}

export function CockpitControls({
  scenario,
  state,
  perform,
  disabled,
}: {
  scenario: Scenario;
  state: ScenarioState;
  perform: (action: PilotAction) => void;
  disabled?: boolean;
}) {
  const procedureSteps = scenario.steps.filter(
    (s) => !s.group || s.group === "procedure",
  );

  const [pendingConfirm, setPendingConfirm] = useState<Set<string>>(new Set());

  const handleClick = (step: ScenarioStep) => {
    if (step.confirmRequired && !pendingConfirm.has(step.id)) {
      setPendingConfirm((prev) => new Set([...prev, step.id]));
    } else {
      perform({ kind: "STEP", stepId: step.id });
      setPendingConfirm((prev) => {
        const next = new Set(prev);
        next.delete(step.id);
        return next;
      });
    }
  };

  const aviateSteps = procedureSteps.filter((s) => AVIATE_IDS.includes(s.id));
  const gateStep    = procedureSteps.find((s) => s.id === GATE_ID);
  const ecamSteps   = procedureSteps.filter((s) => ECAM_IDS.includes(s.id));
  const gateDone    = !!state.completedSteps[GATE_ID];

  return (
    <div
      className="border font-mono flex flex-col"
      style={{ borderColor: C.border, backgroundColor: C.bg }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: C.border, backgroundColor: C.sectionBg }}
      >
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.25em", textTransform: "uppercase" }}>
          PROCEDURE — FCOM PRO-ABN-ENG
        </span>
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.1em" }}>
          FLY · NAVIGATE · COMMUNICATE
        </span>
      </div>

      {/* ── ① AVIATE ───────────────────────────────────────────────────────── */}
      <PhaseHeader label="① AVIATE" color={C.amber} />
      {aviateSteps.map((step) => (
        <StepRow
          key={step.id}
          step={step}
          status={getStatus(step, state)}
          confirmed={pendingConfirm.has(step.id)}
          disabled={disabled}
          onClick={() => handleClick(step)}
        />
      ))}

      {/* ── 400 FT GATE ────────────────────────────────────────────────────── */}
      {gateStep && (
        <>
          <div
            className="px-4 py-1 border-t flex items-center gap-3"
            style={{ borderColor: C.border, backgroundColor: C.sectionBg }}
          >
            <span style={{ color: C.dim, fontSize: "8px", letterSpacing: "0.25em", textTransform: "uppercase" }}>
              400 FT GATE
            </span>
            <span style={{ color: C.dim, fontSize: "8px" }}>—</span>
            <span style={{ color: C.dim, fontSize: "8px", letterSpacing: "0.08em" }}>
              aviate + MW cancel required
            </span>
          </div>
          <StepRow
            step={gateStep}
            status={getStatus(gateStep, state)}
            confirmed={pendingConfirm.has(gateStep.id)}
            disabled={disabled}
            onClick={() => handleClick(gateStep)}
          />
        </>
      )}

      {/* ── ② ECAM ACTIONS ─────────────────────────────────────────────────── */}
      {gateDone && (
        <>
          <PhaseHeader label="② ECAM ACTIONS" color={C.blue} />
          {ecamSteps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              status={getStatus(step, state)}
              confirmed={pendingConfirm.has(step.id)}
              disabled={disabled}
              onClick={() => handleClick(step)}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Phase section header ──────────────────────────────────────────────────────
function PhaseHeader({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="px-4 py-1 border-t"
      style={{ borderColor: C.border, backgroundColor: C.sectionBg }}
    >
      <span
        style={{
          color,
          fontSize: "8px",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Single step row ───────────────────────────────────────────────────────────
function StepRow({
  step,
  status,
  confirmed,
  disabled,
  onClick,
}: {
  step: ScenarioStep;
  status: StepStatus;
  confirmed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const accent   = accentFor(step.variant);
  const rowBg    = status === "done" ? C.greenBg : status === "current" ? (confirmed ? C.amberBg : bgFor(step.variant)) : "transparent";
  const isCurrent = status === "current";
  const isDone    = status === "done";
  const isLocked  = status === "locked";

  return (
    <div
      className="border-t flex items-center gap-3 px-4 py-2.5"
      style={{
        borderColor: C.border,
        backgroundColor: rowBg,
        opacity: isLocked ? 0.38 : 1,
        // Left accent bar indicates current step
        borderLeft: isCurrent
          ? `3px solid ${confirmed ? C.amber : accent}`
          : "3px solid transparent",
      }}
    >
      {/* Status icon */}
      <span
        style={{
          fontSize: "14px",
          color: isDone ? C.green : isCurrent ? (confirmed ? C.amber : accent) : C.dim,
          width: "18px",
          flexShrink: 0,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {isDone ? "✓" : isLocked ? "○" : confirmed ? "→" : "›"}
      </span>

      {/* Label + hint */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: isDone ? C.green : isCurrent ? C.text : C.dim,
              fontWeight: isCurrent ? 700 : 400,
            }}
          >
            {step.label}
          </span>
          {step.crew && (
            <span
              style={{
                fontSize: "7px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "1px 5px",
                borderRadius: "2px",
                backgroundColor: CREW_LABEL[step.crew].bg,
                color: CREW_LABEL[step.crew].color,
                fontWeight: 700,
              }}
            >
              {step.crew}
            </span>
          )}
          {step.optional && (
            <span style={{ fontSize: "7px", color: C.dim, letterSpacing: "0.05em" }}>OPT</span>
          )}
        </div>
        {/* Hint shown only on current step */}
        {isCurrent && (
          <span
            style={{
              fontSize: "9px",
              color: C.dim,
              letterSpacing: "0.02em",
              marginTop: "3px",
              lineHeight: "1.4",
            }}
          >
            {step.hint}
          </span>
        )}
      </div>

      {/* Action button — only for current step */}
      {isCurrent && (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          style={{
            flexShrink: 0,
            fontSize: "9px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontWeight: 700,
            backgroundColor: confirmed ? C.amber : accent,
            color: "#000",
            border: "none",
            borderRadius: "2px",
            padding: "6px 12px",
            minWidth: "80px",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {confirmed
            ? "EXECUTE"
            : step.confirmRequired
            ? "CONFIRM?"
            : step.action}
        </button>
      )}

      {/* Done badge */}
      {isDone && (
        <span
          style={{ fontSize: "8px", letterSpacing: "0.1em", color: C.green, flexShrink: 0 }}
        >
          {step.action}
        </span>
      )}
    </div>
  );
}

