import type { FlapConf } from "@/scenarios/types";

// ─── Phase-dependent engine indications for the E/WD ─────────────────────────
// Confirmed reference set (pilot-confirmed DRAFT — SME sign-off before release).
//
//  • N1  — anchored to the FCOM (19 May 2021) N1 MODE THRUST CONTROL tables
//          (EFB-THR-N1: MAX CLIMB N1 / MAX CRUISE N1), plus TOGA at takeoff and idle.
//  • EGT / N2 / FF — representative CFM56-5B figures (not FCOM-tabulated per phase).
//  • FOB / weights — FCOM LIM (A320): MTOW 73 500 kg · MLW 66 300 kg · MZFW 62 800 kg,
//          so max fuel at MTOW takeoff ≈ 10 700 kg, at MLW landing ≈ 3 500 kg.
//
// Takeoff is framed at Max Takeoff Weight, landing at Max Landing Weight.

export type FlightPhase = "takeoff" | "climb" | "cruise" | "descent" | "landing";

export type PhaseEngineValues = {
  label: string;
  n1: string; egt: string; n2: string; ff: string;   // both engines equal in normal ops
  fob: string;
  thrustMode: string; thrustN1: string;
  flap: FlapConf;
};

export const PHASE_ENGINE_VALUES: Record<FlightPhase, PhaseEngineValues> = {
  takeoff: { label: "T.O", n1: "95", egt: "750", n2: "98", ff: "2500", fob: "10700", thrustMode: "TOGA", thrustN1: "95.0", flap: "2"    },
  climb:   { label: "CLB", n1: "88", egt: "700", n2: "96", ff: "2100", fob: "9000",  thrustMode: "CLB",  thrustN1: "88.0", flap: "0"    },
  cruise:  { label: "CRZ", n1: "84", egt: "600", n2: "94", ff: "1150", fob: "5000",  thrustMode: "CLB",  thrustN1: "84.0", flap: "0"    },
  descent: { label: "DES", n1: "35", egt: "380", n2: "68", ff: "300",  fob: "4000",  thrustMode: "IDLE", thrustN1: "35.0", flap: "0"    },
  landing: { label: "LDG", n1: "35", egt: "400", n2: "70", ff: "350",  fob: "3500",  thrustMode: "IDLE", thrustN1: "35.0", flap: "FULL" },
};

export const PHASE_ORDER: FlightPhase[] = ["takeoff", "climb", "cruise", "descent", "landing"];
