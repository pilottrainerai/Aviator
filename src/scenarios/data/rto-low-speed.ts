import type { Scenario } from "@/scenarios/types";
import { RTO_LOW_SPEED_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-ENG p.35   : ENG FIRE on ground / RTO procedure
// FCTM OP-010              : Rejected Takeoff technique
// QRH RTO memory items

export const rtoLowSpeed: Scenario = {
  meta: RTO_LOW_SPEED_META,
  brief: {
    situation:
      "VIDP RWY 28, during takeoff roll at approximately 90 kt. ENG 1 fire warning illuminates. Speed is BELOW V1. The go/no-go decision must be made in under one second.",
    job: "Reject — call STOP, close thrust levers, apply max brakes, ground spoilers, max reverse. Vacate the runway. Assess for evacuation.",
  },

  triggers: [
    {
      id: "accel_phase",
      atMs: 3_000,
      description: "Accelerating through 90 kt on takeoff roll",
      effects: [],
    },
    {
      id: "fire_warn_ground",
      atMs: 6_000,
      description: "ENG 1 FIRE warning on ground — below V1",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 FIRE" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "eng1_fire_gnd", line: "ENG 1 FIRE",                    level: "warning" },
            { id: "rto_call",      line: "BELOW V1 — RTO",                 level: "warning" },
            { id: "ecam_idle",     line: "THR LEVERS......IDLE / REVERSE", level: "caution" },
            { id: "ecam_brakes",   line: "BRAKES..............MAX",        level: "caution" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── IMMEDIATE ACTIONS ─────────────────────────────────────────────────────
    {
      id: "rto_call",
      label: "STOP STOP STOP",
      action: "CALL",
      hint: "PF calls 'STOP STOP STOP' — reject below V1 only. This is a memory item. Decision made in <1 s. Close thrust levers immediately.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      hardware: true,
    },
    {
      id: "thr_levers_close",
      label: "THR LEVERS",
      action: "IDLE",
      hint: "PF: thrust levers to idle immediately on rejection. FCOM step 1 of RTO.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      ecamRef: "ecam_idle",
      requires: ["rto_call"],
    },
    {
      id: "max_brakes",
      label: "BRAKES",
      action: "MAX",
      hint: "PF: full manual toe brakes — override autobrake. Do NOT pump brakes. ANTI-SKID is active.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      ecamRef: "ecam_brakes",
      requires: ["rto_call"],
    },
    {
      id: "ground_spoilers",
      label: "GROUND SPOILERS",
      action: "EXTEND",
      hint: "PF: ARM spoilers — they extend automatically with thrust reversal. Confirm 'SPOILERS GREEN' on ECAM F/CTL page.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      requires: ["rto_call"],
    },
    {
      id: "reverse_thrust",
      label: "REVERSE THRUST",
      action: "MAX",
      hint: "PM: apply max reverse thrust (both engines). Reduce to idle reverser before 70 kt to avoid FOD ingestion.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["thr_levers_close"],
    },
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARN once aircraft stopping action is established.",
      variant: "warning",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      afterEffect: {
        delayMs: 400,
        triggerId: "mw_cancelled",
        effects: [{ type: "SET_MASTER_WARN", active: false }],
      },
    },
    {
      id: "atc_notify",
      label: "ATC NOTIFY",
      action: "MAYDAY",
      hint: "PM: notify tower: 'MAYDAY MAYDAY MAYDAY, IFLY101, RTO engine fire, stopping runway 28, emergency services required.'",
      variant: "caution",
      crew: "PM",
      group: "comms",
      requires: ["rto_call"],
    },
    {
      id: "vacate_rwy",
      label: "VACATE RUNWAY",
      action: "IF SAFE",
      hint: "PF: if aircraft stopped safely, vacate via first taxiway if brakes allow. If brake temp HIGH — HOLD POSITION.",
      variant: "switch",
      crew: "PF",
      requires: ["max_brakes"],
    },
    {
      id: "park_brake",
      label: "PARK BRAKE",
      action: "SET",
      hint: "PM: set parking brake once stopped. Do NOT taxi if brake temperature is elevated — await CFR assessment.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["vacate_rwy"],
    },
    {
      id: "eng_shutdown",
      label: "ENG SHUTDOWN",
      action: "BOTH ENG",
      hint: "PM: shut down both engines once stopped. MASTER switches → OFF. Follow ECAM ENG FIRE on ground procedure.",
      variant: "switch",
      crew: "PM",
      requires: ["park_brake"],
    },
    {
      id: "fire_pb_gnd",
      label: "ENG 1 FIRE P/B",
      action: "PUSH",
      hint: "PM: pull ENG 1 FIRE PB — arms squibs. Confirms crew: 'ENG 1 FIRE P/B CONFIRM PUSH?' → 'CONFIRM'.",
      variant: "warning",
      crew: "PM",
      hardware: true,
      confirmRequired: true,
      requires: ["eng_shutdown"],
    },
    {
      id: "agent1_gnd",
      label: "AGENT 1",
      action: "DISCH",
      hint: "PM: discharge AGENT 1 once squibs armed. Wait for N1 decay (~10 s). Monitor FIRE light.",
      variant: "caution",
      crew: "PM",
      hardware: true,
      requires: ["fire_pb_gnd"],
    },
    {
      id: "evacuation_assess",
      label: "EVACUATION ASSESS",
      action: "DECISION",
      hint: "PIC: assess need for evacuation. Criteria: visible fire or smoke entering cabin, structural damage, CFR advises. Brief crew.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["park_brake"],
    },
  ],

  statusItems: [
    { id: "st_eng1",    line: "ENG 1............SHUT DOWN", severity: "caution" },
    { id: "st_rto",     line: "RTO COMPLETE",               severity: "memo"    },
    { id: "st_cfr",     line: "CFR ATTENDING",              severity: "memo"    },
  ],

  distractions: [
    {
      id: "atc_tower",
      atMs: 8_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, confirm intentions.",
      standbyResurfaceMs: 15_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, RTO, engine fire, stopping runway 28, emergency services required", correct: true },
        { id: "b", label: "IFLY101 continuing takeoff",                                                         correct: false },
      ],
    },
    {
      id: "atc_clear",
      atMs: 35_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, confirm aircraft stopped and emergency?",
      standbyResurfaceMs: 20_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, stopped RWY 28, 186 POB, engine fire, CFR required immediately", correct: true },
        { id: "b", label: "IFLY101, stopped, all good, no CFR needed",                                      correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "EVACUATE",
      label: "EVACUATE",
      description: "Order evacuation — if fire or smoke confirmed, or structural damage suspected.",
      tone: "primary",
    },
    {
      value: "HOLD_FOR_ASSESSMENT",
      label: "HOLD FOR ASSESSMENT",
      description: "Hold position, await CFR assessment. Appropriate if aircraft stopped safely and no visible fire.",
      tone: "secondary",
    },
    {
      value: "CONTINUE_TAXI",
      label: "CONTINUE TAXI",
      description: "Taxi to gate with an unextinguished engine fire — never appropriate.",
      tone: "danger",
    },
  ],

  engineDisplay: {
    warningTrigger: "fire_warn_ground",
    eng1: {
      rows: [
        {
          label: "THR LVR",
          states: [
            { when: { step: "thr_levers_close" }, value: { v: "IDLE", c: "amber" } },
            { when: { trigger: "fire_warn_ground" }, value: { v: "TAKEOFF", c: "red" } },
            { value: { v: "TAKEOFF", c: "green" } },
          ],
        },
        {
          label: "N1", unit: "%",
          states: [
            { when: { step: "eng_shutdown" }, value: { v: "0.0", c: "amber" } },
            { when: { trigger: "fire_warn_ground" }, value: { v: "FIRE", c: "red" } },
            { value: { v: "84.2", c: "green" } },
          ],
        },
        {
          label: "STATUS",
          states: [
            { when: { step: "eng_shutdown" }, value: { v: "SHUT DOWN", c: "amber" } },
            { when: { trigger: "fire_warn_ground" }, value: { v: "FIRE", c: "red" } },
            { value: { v: "NORMAL", c: "green" } },
          ],
        },
      ],
      trays: [
        {
          title: "GROUND PANEL",
          note: "FCOM PRO-ABN-ENG: RTO → stop → ENG MASTER OFF → FIRE PB → AGENT 1 if fire persists",
          switches: [
            {
              label: "THR LVR", sub: "ENG 1",
              states: [
                { when: { step: "thr_levers_close" }, value: "off" as const },
                { when: { trigger: "fire_warn_ground" }, value: "fault" as const },
                { value: "norm" as const },
              ],
            },
            {
              label: "FIRE PB", sub: "ENG 1",
              states: [
                { when: { step: "fire_pb_gnd" }, value: "off" as const },
                { when: { trigger: "fire_warn_ground" }, value: "fire" as const },
                { value: "norm" as const },
              ],
            },
            {
              label: "AGENT 1", sub: "DISCH",
              states: [
                { when: { step: "agent1_gnd" }, value: "off" as const },
                { when: { step: "fire_pb_gnd" }, value: "armed" as const },
                { value: "norm" as const },
              ],
            },
          ],
        },
      ],
    },
    eng2: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.2", c: "green" } }] },
        { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
  },

  systemTabs: [
    {
      id: "eng", label: "ENG",
      alertStates: [{ when: { trigger: "fire_warn_ground" }, value: true }, { value: false }],
      autoSelect: { trigger: "fire_warn_ground" },
      sections: [
        {
          title: "ENG 1",
          colorStates: [
            { when: { step: "eng_shutdown" }, value: "amber" },
            { when: { trigger: "fire_warn_ground" }, value: "red" },
            { value: "dim" },
          ],
          rows: [
            {
              label: "N1", unit: "%",
              states: [
                { when: { step: "eng_shutdown" }, value: { v: "0.0", c: "amber" } },
                { when: { trigger: "fire_warn_ground" }, value: { v: "FIRE", c: "red" } },
                { value: { v: "84.2", c: "green" } },
              ],
            },
            {
              label: "STATUS",
              states: [
                { when: { step: "eng_shutdown" }, value: { v: "SHUT DOWN", c: "amber" } },
                { when: { trigger: "fire_warn_ground" }, value: { v: "FIRE", c: "red" } },
                { value: { v: "NORMAL", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "ENG 2",
          colorStates: [{ value: "dim" }],
          rows: [
            { label: "N1",     unit: "%", states: [{ value: { v: "84.2",  c: "green" } }] },
            { label: "STATUS",            states: [{ value: { v: "NORMAL", c: "green" } }] },
          ],
        },
      ],
    },
    {
      id: "hyd", label: "HYD",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "ALL SYSTEMS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "GREEN SYS",  states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "BLUE SYS",   states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "YELLOW SYS", states: [{ value: { v: "NORM", c: "green" } }] },
          ],
        },
      ],
    },
    {
      id: "elec", label: "ELEC",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "AC NETWORK",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "GEN 1",    states: [{ value: { v: "ON",    c: "green" } }] },
            { label: "GEN 2",    states: [{ value: { v: "ON",    c: "green" } }] },
            { label: "AC BUS 1", states: [{ value: { v: "GEN 1", c: "green" } }] },
            { label: "AC BUS 2", states: [{ value: { v: "GEN 2", c: "green" } }] },
          ],
        },
      ],
    },
    {
      id: "air", label: "AIR",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "PACKS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "PACK 1",   states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "PACK 2",   states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "CABIN ΔP", states: [{ value: { v: "N/A",  c: "dim"   } }] },
          ],
        },
      ],
    },
  ],
};
