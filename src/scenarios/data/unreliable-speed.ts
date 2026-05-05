import type { Scenario } from "@/scenarios/types";
import { UNRELIABLE_SPEED_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-FLT p.1   : UNRELIABLE SPEED / IAS DISAGREE procedure
// FCTM ABN-070           : Unreliable speed technique
// QRH 2.10               : Unreliable Speed — pitch/thrust table

export const unreliableSpeed: Scenario = {
  meta: UNRELIABLE_SPEED_META,
  brief: {
    situation:
      "Shortly after takeoff passing FL150. ECAM displays NAV ADR 1 FAULT and NAV IAS DISCREPANCY — amber MASTER CAUTION and single chime. Two PFDs show conflicting airspeeds. The autopilot has disconnected. 'UNRELIABLE SPEED' is a memory item call-out.",
    job: "Immediately disconnect AP/FD/A-THR. Apply FCOM pitch+thrust table (15°/TOGA below thrust red alt). Identify and isolate the faulty ADR. Check probe/window heat ON. Use STBY ISIS as backup speed reference.",
  },

  triggers: [
    {
      id: "pitot_fail",
      atMs: 5_000,
      description: "ADR 1 failure — NAV ADR 1 FAULT, IAS disagree, speed unreliable",
      effects: [
        // FCOM PRO-ABN-NAV: ADR single failure = CAUTION (L2), amber MASTER CAUTION, SC chime
        // "SPEED UNRELIABLE" is a MEMORY ITEM call-out — not an ECAM message
        // The ECAM shows NAV ADR 1 FAULT (caution) + NAV IAS DISCREPANCY (caution)
        { type: "SET_MASTER_CAUT", active: true },
        { type: "SET_ALARM_LABEL", label: "SPEED UNRELIABLE" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "adr_fault",        line: "NAV ADR 1 FAULT",              level: "caution"  },
            { id: "ias_disagree",     line: "NAV IAS DISCREPANCY",           level: "caution"  },
            { id: "autopilot_off",    line: "AP DISCONNECTED",               level: "advisory" },
            { id: "fmgc_warn",        line: "FMGC UNRELIABLE DATA",          level: "advisory" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── IMMEDIATE — MEMORY ITEMS ──────────────────────────────────────────────
    // FCOM PRO-ABN-NAV: Memory items: AP OFF, A/THR OFF, FD OFF, then pitch+thrust table
    {
      id: "ap_fd_disc",
      label: "AP / FD / A-THR",
      action: "ALL OFF",
      hint: "PF: IMMEDIATELY disconnect AP, A/THR, and both FDs. Call 'UNRELIABLE SPEED'. Fly raw data. Do NOT chase speed indications. This is a MEMORY ITEM.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      hardware: true,
    },
    {
      id: "pitch_thrust",
      label: "PITCH + THRUST TABLE",
      action: "APPLY",
      hint: "PF: IMMEDIATELY apply FCOM pitch/thrust table. CLIMB below thrust red alt: 15° nose up + TOGA. Above thrust red alt below FL100: 10°/CLB. Above FL100: 5°/CLB. Fly ATTITUDE — do NOT chase speed.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      hardware: true,
      requires: ["ap_fd_disc"],
    },
    {
      id: "adr_disagree",
      label: "ADR DISAGREE CHECK",
      action: "IDENTIFY",
      hint: "PM: compare ADR 1, ADR 2, ADR 3 on both PFDs — use STBY ISIS as backup reference (independent pitot). Identify the faulty ADR. ADR3 and STBY speeds use the same probe.",
      variant: "switch",
      crew: "PM",
      requires: ["pitch_thrust"],
      afterEffect: {
        delayMs: 3_000,
        triggerId: "rvsm_lost",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "rvsm_msg", line: "RVSM AIRSPACE — CHECK WITH ATC", level: "advisory" },
            ],
          },
        ],
      },
    },
    {
      id: "cancel_master_caut_initial",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM: cancel MASTER CAUTION (ADR 1 FAULT is a CAUTION, not Warning). Silences SC chime. ECAM procedure remains displayed.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      afterEffect: {
        delayMs: 400,
        triggerId: "mc_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
    },
    {
      id: "adr_off",
      label: "FAULTY ADR — OFF",
      action: "SWITCH OFF",
      hint: "PM: switch off faulty ADR pushbutton (ADIRS panel). FCOM: if at least one ADR confirmed reliable — switch unreliable ADR(s) OFF. Monitor remaining 2 ADRs — they should agree. If above FL250 with all ADRs suspect: keep ONE ADR ON, switch other two OFF.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["adr_disagree"],
    },
    {
      id: "spd_check",
      label: "SPEED CROSS-CHECK",
      action: "CONFIRM",
      hint: "PM: cross-check: ASI (both), ISIS, Mach. If 2 ADRs agree — speeds reliable. If all unreliable — continue flying attitude table.",
      variant: "switch",
      crew: "PM",
      requires: ["adr_off"],
    },
    {
      id: "probe_heat_on",
      label: "PROBE / WINDOW HEAT",
      action: "ON",
      hint: "PM: FCOM step after ADR disagree check — ensure ALL probe and window heat is ON. Ice accretion is the most common cause of ADR disagreement.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["adr_disagree"],
    },

    // ── CRM / COMMS ───────────────────────────────────────────────────────────
    {
      id: "atc_notify_speed",
      label: "ATC NOTIFY",
      action: "ADVISE",
      hint: "PM: 'IFLY101, speed unreliable, unable RVSM, request block FL130–FL150, possible diversion.'",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["spd_check"],
    },
    {
      id: "crew_brief_speed",
      label: "CREW BRIEF",
      action: "CONFIRM",
      hint: "PM: brief cabin crew — precautionary descent, possible diversion.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["spd_check"],
    },
    {
      id: "wx_ldg_speed",
      label: "WX / LDG PERF",
      action: "CHECK",
      hint: "PM: nearest airport wx. Normal Vapp if 2 ADRs agree. Use ISIS if only 1 ADR remaining.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["atc_notify_speed"],
    },
    {
      id: "fordec_speed",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC. If 2 ADRs agree — may continue carefully. If any doubt — land asap.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_ldg_speed"],
      notes: [
        "F — FACTS: ADR 1 faulty, isolated. 2 remaining ADRs agree. ISIS intact. Speed now reliable.",
        "O — OPTIONS: Continue carefully with 2 valid ADRs. OR divert nearest.",
        "R — RISKS: If remaining ADR fails, speed unreliable again. Approach raw data only.",
        "D — DECISION: Divert to nearest airport — fly raw data ILS, manual approach.",
        "E — EXECUTION: ISIS as reference. Vapp cross-checked on 2 ADRs. Manual approach.",
        "C — CHECK-BACK: PM confirms.",
      ],
    },
    {
      id: "nis_brief_speed",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "PM: SCCM brief — precautionary landing, normal approach expected.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec_speed"],
      notes: [
        "N — NATURE: 'Instrument malfunction — precautionary landing'",
        "I — INTENTIONS: 'Diverting to nearest suitable airport'",
        "T — TIME: 'Approximately X minutes to landing'",
        "S — SPECIAL: 'Normal landing expected. Remain seated.'",
      ],
    },
    {
      id: "approach_brief",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF: manual ILS approach using ISIS + 2 ADRs cross-checked. Normal Vapp. No autoland.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fordec_speed"],
    },
    {
      id: "approach_cl",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs approach checklist.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_brief"],
      notes: [
        "BARO ............. QNH SET",
        "MDA/DH ........... SET",
        "SEAT BELTS ....... ON",
        "AUTOBRAKE ........ MED",
        "SPOILERS ......... ARM",
        "AIRSPEED REFERENCE: ISIS + 2 ADRs",
      ],
    },
    {
      id: "landing_cl",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs landing checklist at 1000 ft on final.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_cl"],
      notes: [
        "GEAR ............. DOWN — 3 GREEN",
        "FLAPS ............ CONF FULL",
        "SPOILERS ......... ARM",
        "AUTOBRAKE ........ MED",
        "CABIN ............ ADVISED",
      ],
    },
  ],

  statusItems: [
    // ── Left column: FCOM PRO-ABN-NAV NAV ADR 1 FAULT STATUS ─────────────────
    { id: "st_adr",   line: "NAV ADR 1 FAULT",       severity: "caution"  },
    { id: "st_ias",   line: "NAV IAS DISCREPANCY",    severity: "caution"  },
    { id: "st_rvsm",  line: "RVSM INOP",             severity: "memo"     },
    { id: "st_isis",  line: "STBY ISIS IN USE",       severity: "memo"     },
    { id: "st_appr",  line: "APPR RAW DATA",          severity: "advisory" },
    // ── Right column: INOP SYS (FCOM NAV ADR 1 FAULT STATUS right column) ────
    { id: "st_inop_adr",   line: "ADR 1",          severity: "caution",  inopSys: true },
    { id: "st_inop_gpws",  line: "GPWS",           severity: "caution",  inopSys: true },
    { id: "st_inop_cat3s", line: "CAT 3 SINGLE",   severity: "advisory", inopSys: true },
    { id: "st_inop_cat3d", line: "CAT 3 DUAL",     severity: "advisory", inopSys: true },
  ],

  distractions: [
    {
      id: "atc_initial",
      atMs: 10_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, climb FL250, direct KARNAL.",
      standbyResurfaceMs: 20_000,
      choices: [
        { id: "a", label: "IFLY101, unable RVSM, speed unreliable, request block altitude, possible diversion", correct: true  },
        { id: "b", label: "IFLY101, climbing FL250 direct KARNAL",                                               correct: false },
      ],
    },
    {
      id: "atc_block",
      atMs: 25_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, block altitude approved FL130–FL150. Confirm airspeed capability.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY101, speed unreliable, ADR isolated, 2 ADRs agree, request vectors nearest airport, possible diversion", correct: true  },
        { id: "b", label: "IFLY101, all OK, continuing to destination",                                                                   correct: false },
      ],
    },
    {
      id: "atc_approach",
      atMs: 120_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, cleared ILS RWY 28, wind calm, QNH 1013. Note RVSM not available.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY101, cleared ILS RWY 28, ADR 1 isolated, manual approach ISIS reference, confirm souls 186", correct: true  },
        { id: "b", label: "IFLY101, standard approach, all fine",                                                             correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Land at nearest field — raw data approach, manual ILS.",
      tone: "primary",
    },
    {
      value: "LAND_ASAP",
      label: "LAND ASAP",
      description: "Land as soon as possible — do not risk further ADR failures.",
      tone: "primary",
    },
    {
      value: "CONTINUE_MONITORED",
      label: "CONTINUE MONITORED",
      description: "Continue carefully if 2 ADRs agree and conditions are stable — increased risk.",
      tone: "secondary",
    },
    {
      value: "CONTINUE_FULL",
      label: "CONTINUE FULL IFR",
      description: "Continue IFR with unreliable speed indication — never appropriate.",
      tone: "danger",
    },
  ],

  engineDisplay: {
    warningTrigger: "pitot_fail",
    eng1: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.2",  c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "620",   c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "2400",  c: "green" } }] },
        { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
    eng2: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.2",  c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "618",   c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "2350",  c: "green" } }] },
        { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
  },

  systemTabs: [
    {
      id: "eng", label: "ENG",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "BOTH ENGINES",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ENG 1 N1", unit: "%", states: [{ value: { v: "84.2", c: "green" } }] },
            { label: "ENG 2 N1", unit: "%", states: [{ value: { v: "84.2", c: "green" } }] },
            { label: "STATUS",              states: [{ value: { v: "NORM",  c: "green" } }] },
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
            { label: "GEN 1",    states: [{ value: { v: "ON — NORM", c: "green" } }] },
            { label: "GEN 2",    states: [{ value: { v: "ON — NORM", c: "green" } }] },
            { label: "AC BUS 1", states: [{ value: { v: "NORM",      c: "green" } }] },
            { label: "AC BUS 2", states: [{ value: { v: "NORM",      c: "green" } }] },
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
            { label: "CABIN ΔP", states: [{ value: { v: "NORM", c: "green" } }] },
          ],
        },
      ],
    },
    {
      id: "adiru", label: "ADIRU",
      alertStates: [{ when: { trigger: "pitot_fail" }, value: true }, { value: false }],
      autoSelect: { trigger: "pitot_fail" },
      sections: [
        {
          title: "ADR",
          colorStates: [
            { when: { trigger: "pitot_fail" }, value: "amber" },
            { value: "dim" },
          ],
          rows: [
            {
              label: "ADR 1",
              states: [
                { when: { step: "adr_off" },       value: { v: "OFF (ISOLATED)", c: "dim" } },
                { when: { trigger: "pitot_fail" }, value: { v: "FAULT", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "ADR 2", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "ADR 3", states: [{ value: { v: "NORM", c: "green" } }] },
            {
              label: "ISIS",
              states: [
                { when: { trigger: "pitot_fail" }, value: { v: "OPERATIVE", c: "cyan" } },
                { value: { v: "STANDBY", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "IR",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "IR 1", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "IR 2", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "IR 3", states: [{ value: { v: "NORM", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ADIRU PANEL",
        note: "FCOM DSC-34: Isolate faulty ADR. Cross-check remaining 2. ISIS as backup gravity-operated airspeed. Apply QRH 2.10 pitch/thrust table until speeds confirmed reliable.",
        switches: [
          {
            label: "ADR 1",
            states: [
              { when: { step: "adr_off" },       value: "off" as const },
              { when: { trigger: "pitot_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "ADR 2", states: [{ value: "norm" as const }] },
          { label: "ADR 3", states: [{ value: "norm" as const }] },
        ],
      },
    },
  ],
};
