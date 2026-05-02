"use client";

import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, ScenarioStep } from "@/scenarios/types";

const CREW_BADGE: Record<"PF" | "PM", { bg: string; text: string }> = {
  PF: { bg: "#00CFFF22", text: "#00CFFF" },
  PM: { bg: "#FFB30022", text: "#FFB300" },
};

const C = {
  border:    "#1C2130",
  dim:       "#5A626F",
  text:      "#E6E8EC",
  cyan:      "#00CFFF",
  green:     "#00D060",
  amber:     "#FFB300",
  greenSoft: "#00D06010",
  cyanSoft:  "#00CFFF0C",
  goldSoft:  "#FFB30008",
} as const;

type Status = "locked" | "current" | "done";

function stepStatus(step: ScenarioStep, state: ScenarioState): Status {
  if (state.completedSteps[step.id]) return "done";
  const requirementsMet = (step.requires ?? []).every((r) => !!state.completedSteps[r]);
  return requirementsMet ? "current" : "locked";
}

export function CommChecklist({
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
  const commsSteps = scenario.steps.filter((s) => s.group === "comms");
  if (commsSteps.length === 0) return null;

  const requiredSteps = commsSteps.filter((s) => !s.optional);
  const doneCount = commsSteps.filter((s) => state.completedSteps[s.id]).length;
  const requiredDone = requiredSteps.every((s) => state.completedSteps[s.id]);

  return (
    <div
      className="border font-mono flex flex-col"
      style={{ borderColor: C.border, backgroundColor: "#000000" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-[5px] border-b"
        style={{ borderColor: C.border }}
      >
        <span
          style={{
            color: C.cyan,
            fontSize: "9px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          CRM CHECKLIST
        </span>
        <span style={{ color: requiredDone ? C.green : C.dim, fontSize: "9px", letterSpacing: "0.12em" }}>
          {doneCount}/{commsSteps.length}{requiredDone ? " — COMPLETE" : ""}
        </span>
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {commsSteps.map((step) => {
          const status = stepStatus(step, state);
          const isUnlocked = status === "current";
          const isDone = status === "done";
          const isLocked = status === "locked";
          const isGoldenRules = step.id === "golden_rules";

          return (
            <div
              key={step.id}
              className="border-b last:border-b-0"
              style={{
                borderColor: C.border,
                backgroundColor: isDone
                  ? C.greenSoft
                  : isUnlocked && isGoldenRules
                  ? C.goldSoft
                  : isUnlocked
                  ? C.cyanSoft
                  : "transparent",
                opacity: isLocked ? 0.45 : 1,
              }}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-3 py-2">
                {/* Status indicator */}
                <span
                  style={{
                    fontSize: "11px",
                    color: isDone ? C.green : isUnlocked ? (isGoldenRules ? C.amber : C.cyan) : C.dim,
                    flexShrink: 0,
                    width: "12px",
                    textAlign: "center",
                  }}
                >
                  {isDone ? "✓" : isUnlocked ? "›" : "○"}
                </span>

                {/* Label */}
                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: isDone ? C.green : isUnlocked ? C.text : C.dim,
                      fontWeight: isUnlocked ? 700 : 500,
                    }}
                  >
                    {step.label}
                    {isGoldenRules && (
                      <span
                        style={{
                          marginLeft: "6px",
                          fontSize: "8px",
                          letterSpacing: "0.1em",
                          color: C.amber,
                          fontWeight: 400,
                        }}
                      >
                        AIRBUS
                      </span>
                    )}
                  </span>
                  {/* Plain hint — shown only when no notes */}
                  {isUnlocked && !step.notes && (
                    <span
                      style={{
                        fontSize: "9px",
                        color: "#7A8494",
                        lineHeight: "1.4",
                        marginTop: "2px",
                      }}
                    >
                      {step.hint}
                    </span>
                  )}
                </div>

                {/* Crew badge */}
                {step.crew && (
                  <span
                    className="px-1.5 py-[2px] rounded-sm flex-shrink-0"
                    style={{
                      fontSize: "8px",
                      letterSpacing: "0.1em",
                      backgroundColor: CREW_BADGE[step.crew].bg,
                      color: CREW_BADGE[step.crew].text,
                    }}
                  >
                    {step.crew}
                  </span>
                )}

                {/* Confirm button */}
                {!isDone && (
                  <button
                    type="button"
                    disabled={disabled || isLocked}
                    onClick={() => perform({ kind: "STEP", stepId: step.id })}
                    className="flex-shrink-0 px-2 py-1 border rounded-sm disabled:cursor-not-allowed transition-colors"
                    style={{
                      fontSize: "8px",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      borderColor: isUnlocked
                        ? (isGoldenRules ? C.amber + "80" : C.cyan + "80")
                        : C.dim + "40",
                      color: isUnlocked ? (isGoldenRules ? C.amber : C.cyan) : C.dim,
                      backgroundColor: isUnlocked
                        ? (isGoldenRules ? "#FFB30010" : C.cyanSoft)
                        : "transparent",
                    }}
                  >
                    {step.optional ? "OPT" : "CONFIRM"}
                  </button>
                )}
              </div>

              {/* Notes — bullet list, shown when active OR done */}
              {step.notes && (isUnlocked || isDone) && (
                <div
                  className="px-3 pb-2 flex flex-col gap-[3px]"
                  style={{ paddingLeft: "28px" }}
                >
                  {step.notes.map((note, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-[5px]"
                      style={{
                        fontSize: "9px",
                        lineHeight: "1.5",
                        letterSpacing: "0.03em",
                        color: isDone ? "#7A8494" : "#D4D8E0",
                      }}
                    >
                      <span
                        style={{
                          color: isDone ? C.green : C.amber,
                          flexShrink: 0,
                          fontSize: "8px",
                        }}
                      >
                        {isDone ? "✓" : "›"}
                      </span>
                      {note}
                    </div>
                  ))}
                  {isUnlocked && (
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "8px",
                        letterSpacing: "0.1em",
                        color: C.dim,
                        textTransform: "uppercase",
                      }}
                    >
                      {step.hint}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
