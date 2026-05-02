"use client";

import type { ScenarioState } from "@/engine/state";

// ─── Airbus FCTM OP-020 — Engine fire after V1 — PF technique ─────────────────
// AVIATE → NAVIGATE → COMMUNICATE sequence from FCTM + Golden Rules.
// Phase logic is keyed to ENG 1 FIRE scenario step IDs.

type Phase = "standby" | "aviate" | "navigate" | "communicate" | "prepare";

function derivePhase(state: ScenarioState): Phase {
  const anyWarning = state.masterWarnActive || state.masterCautActive;
  // Standby: no warning yet and PF hasn't started the aviate sequence
  if (!anyWarning && !state.completedSteps["continue_rotation"]) return "standby";
  // Aviate: fire warning active, or working through aviate steps up to 400ft gate
  if (!state.completedSteps["four_hundred_ft_cmd"]) return "aviate";
  // Navigate: ECAM procedure in progress through accel/clean
  if (!state.completedSteps["crew_crosscheck"])     return "navigate";
  // Communicate: CRM checklist, ATC, NIS brief, PAX PA
  if (!state.completedSteps["approach_brief"])      return "communicate";
  return "prepare";
}

// ─── FCTM cues per phase ──────────────────────────────────────────────────────
const PHASES: {
  phase: Phase;
  label: string;
  number: string;
  cues: string[];
}[] = [
  {
    phase: "aviate",
    label: "AVIATE",
    number: "①",
    cues: [
      "GOLDEN RULES: FLY · NAVIGATE · COMMUNICATE",
      "PF: Continue rotation — follow flight directors, maintain V2+10 kt",
      "PM: Call 'Positive Rate' when climb established",
      "PM: Call 'Gear Up' → PF selects gear lever UP",
      "At ~100 ft: PF engages AP1, reads FMA aloud — SRS active",
      "PM: Push MASTER WARN glareshield light to silence CRC",
    ],
  },
  {
    phase: "navigate",
    label: "NAVIGATE",
    number: "②",
    cues: [
      "MW cancelled — set HDG 280° for VIDP return",
      "At 400 ft: PM announces 'ECAM ACTIONS', begins sequential procedure",
      "Step by step: THR IDLE → MASTER OFF (confirm) → FIRE PB (confirm) → AGENT DISCH",
      "At MIN ACCEL ALT: select LVL OFF / OP CLB",
      "Accelerate to S speed → retract FLAPS CLEAN",
      "CHCLM crosscheck: PM→PF 'ECAM ACTIONS COMPLETE'",
    ],
  },
  {
    phase: "communicate",
    label: "COMMUNICATE",
    number: "③",
    cues: [
      "CHCLM complete — ATC MAYDAY declared (via distraction calls)",
      "Request WX / ATIS RWY 28 — check LDG PERF",
      "PM: NIS brief to cabin crew (Nature · Intentions · Special)",
      "PF: PAX PA — remain seated, precautionary return",
    ],
  },
  {
    phase: "prepare",
    label: "PREPARE",
    number: "④",
    cues: [
      "Review STATUS: ENG INOP · HYD LO PR · SINGLE PACK · GEN 1 INOP",
      "Approach brief: ILS 28, CAT 1, Vapp +5, go-around plan",
      "Approach prep: ILS freq/CRS, BARO min, MCDU set",
      "OPS notify (optional): ACARS/VHF, request CFR + ground support",
    ],
  },
];

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  active:   "#00CFFF",
  done:     "#00D060",
  pending:  "#3A4050",
  activeBg: "#00CFFF0F",
  text:     "#E6E8EC",
  dim:      "#5A626F",
  border:   "#1C2130",
} as const;

export function PfAviatePanel({ state }: { state: ScenarioState }) {
  const current = derivePhase(state);

  if (current === "standby") {
    return (
      <div
        className="border border-[var(--color-border)] font-mono flex flex-col"
        style={{ backgroundColor: "#000000" }}
      >
        <Header />
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <span style={{ color: C.dim, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            STANDBY
          </span>
          <span style={{ color: C.dim, fontSize: "10px", letterSpacing: "0.1em" }}>
            Watching for abnormality
          </span>
        </div>
      </div>
    );
  }

  const phaseOrder: Phase[] = ["aviate", "navigate", "communicate", "prepare"];
  const currentIdx = phaseOrder.indexOf(current);

  return (
    <div
      className="border border-[var(--color-border)] font-mono flex flex-col"
      style={{ backgroundColor: "#000000" }}
    >
      <Header />

      <div className="flex flex-col">
        {PHASES.map(({ phase, label, number, cues }) => {
          const idx = phaseOrder.indexOf(phase);
          const isActive  = phase === current;
          const isDone    = idx < currentIdx;
          const isPending = idx > currentIdx;

          const labelColor = isActive ? C.active : isDone ? C.done : C.pending;

          return (
            <div
              key={phase}
              className="border-b last:border-b-0"
              style={{
                borderColor: C.border,
                backgroundColor: isActive ? C.activeBg : "transparent",
              }}
            >
              {/* Phase header row */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span style={{ color: labelColor, fontSize: "10px", fontWeight: 700 }}>
                  {number}
                </span>
                <span
                  style={{
                    color: labelColor,
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    fontWeight: isActive ? 700 : 500,
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </span>
                {isActive && (
                  <span
                    className="ml-auto animate-pulse"
                    style={{ color: C.active, fontSize: "8px", letterSpacing: "0.15em" }}
                  >
                    ACTIVE
                  </span>
                )}
                {isDone && (
                  <span
                    className="ml-auto"
                    style={{ color: C.done, fontSize: "8px", letterSpacing: "0.15em" }}
                  >
                    COMPLETE
                  </span>
                )}
                {isPending && (
                  <span
                    className="ml-auto"
                    style={{ color: C.pending, fontSize: "8px", letterSpacing: "0.15em" }}
                  >
                    AHEAD
                  </span>
                )}
              </div>

              {/* Cues — only shown for active and done phases */}
              {(isActive || isDone) && (
                <div className="px-3 pb-2 flex flex-col gap-[3px]">
                  {cues.map((cue, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-[5px]"
                      style={{
                        color: isDone ? "#7A8494" : C.text,
                        opacity: 1,
                        fontSize: "10px",
                        lineHeight: "1.5",
                        letterSpacing: "0.04em",
                      }}
                    >
                      <span style={{ color: isDone ? C.done : C.active, flexShrink: 0, fontSize: "9px" }}>
                        {isDone ? "✓" : "›"}
                      </span>
                      {cue}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div
      className="flex items-center justify-between px-3 py-[5px] border-b"
      style={{ borderColor: C.border }}
    >
      <span
        style={{ color: "#00CFFF", fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700 }}
      >
        PF
      </span>
      <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.15em" }}>
        AVIATE · NAVIGATE · COMM
      </span>
      <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.1em" }}>
        FCTM OP-020
      </span>
    </div>
  );
}
