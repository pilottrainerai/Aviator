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
      "Shortly after takeoff through FL150. ECAM displays SPEED UNRELIABLE and IAS DISAGREE. Two ADRs are showing different airspeeds. The autopilot has disconnected.",
    job: "Stop chasing airspeed. Apply the QRH 2.10 pitch+thrust table IMMEDIATELY. Identify and isolate the faulty ADR. Use ISIS as backup. Plan diversion.",
  },

  triggers: [
    {
      id: "pitot_fail",
      atMs: 5_000,
      description: "ADR 1 failure — speed unreliable, IAS disagree",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "SPEED UNRELIABLE" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "speed_unreliable", line: "SPEED UNRELIABLE",            level: "warning"  },
            { id: "ias_disagree",     line: "IAS DISCREPANCY",              level: "caution"  },
            { id: "adr_fault",        line: "ADR 1 FAULT",                  level: "caution"  },
            { id: "autopilot_off",    line: "A/THR DISCONNECTED",           level: "advisory" },
            { id: "fmgc_warn",        line: "FMGC UNRELIABLE DATA",         level: "advisory" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── IMMEDIATE — MEMORY ITEMS ──────────────────────────────────────────────
    {
      id: "pitch_thrust",
      label: "PITCH + THRUST TABLE",
      action: "APPLY",
      hint: "PF: IMMEDIATELY apply QRH 2.10 pitch/thrust table. CLIMB: 5° nose up + TOGA/MCT. Do NOT chase the speed indications. Fly ATTITUDE.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      hardware: true,
    },
    {
      id: "ap_disc",
      label: "AP / A-THR",
      action: "DISC",
      hint: "PF: AP and A-THR disconnect if spurious inputs. FD may be unreliable — use raw data. Fly manually on attitude + power.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      requires: ["pitch_thrust"],
    },
    {
      id: "adr_disagree",
      label: "ADR DISAGREE CHECK",
      action: "IDENTIFY",
      hint: "PM: compare ADR 1, ADR 2, ADR 3 — use ISIS as reference (gravity-operated, independent). Identify the faulty ADR.",
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
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARN after pitch/thrust applied.",
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
      id: "adr_off",
      label: "FAULTY ADR — OFF",
      action: "SWITCH OFF",
      hint: "PM: switch off faulty ADR pushbutton (ADIRS panel). Monitor remaining 2 ADRs — they should agree.",
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
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM: cancel MASTER CAUTION once ADR isolation confirmed.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      afterEffect: {
        delayMs: 300,
        triggerId: "mc_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
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
    { id: "st_adr",   line: "ADR 1 FAULT",                       severity: "caution"  },
    { id: "st_ias",   line: "IAS UNRELIABLE",                     severity: "caution"  },
    { id: "st_rvsm",  line: "RVSM INOP",                          severity: "memo"     },
    { id: "st_isis",  line: "ISIS IN USE",                         severity: "memo"     },
    { id: "st_appr",  line: "APPR RAW DATA",                       severity: "advisory" },
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
