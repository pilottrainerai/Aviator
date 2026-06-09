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
    { id: "st_inop_cat3s", line: "CAT 3 SINGLE",   severity: "caution",  inopSys: true },
    { id: "st_inop_cat3d", line: "CAT 3 DUAL",     severity: "caution",  inopSys: true },
  ],

  // ── ATC sequence — mirrors eng1-fire-after-v1 ──────────────────────────────
  // Unreliable speed = PAN PAN (urgent, not life-threatening).  Crew works
  // pitch/thrust memory item first, isolates the faulty ADR, then plans a
  // raw-data approach back to Delhi.  RVSM lost → block altitude requested.
  distractions: [
    // ① ATC issues normal climb clearance — pilot declares PAN PAN
    {
      id: "atc_handoff_climb",
      atMs: 10_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, climb FL250, direct KARNAL.",
      standbyResurfaceMs: 20_000,
      choices: [
        // Correct — PAN PAN × 3 = 6 words; nature + navigation (heading) + unable RVSM + block request + standby; no airport
        { id: "a", label: "PAN PAN PAN PAN PAN PAN, IFLY101, unreliable airspeed, heading 280, unable RVSM, request block altitude FL130 to FL150, standby", correct: true  },
        { id: "b", label: "IFLY101, climbing FL250 direct KARNAL",                                                                                             correct: false },
        // Wrong — premature MAYDAY for what is a PAN PAN situation
        { id: "c", label: "MAYDAY MAYDAY MAYDAY, IFLY101, declaring emergency",                                                                                 correct: false },
      ],
    },

    // ② ATC grants the block + asks for capability
    {
      id: "atc_block_grant",
      atMs: 30_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, roger PAN PAN, block altitude approved FL130 to FL150, turn right heading 120 for radar identification.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Block FL130 to FL150, right heading 120, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                                      correct: false },
        // Wrong — drops the heading (traffic-separation critical when unable RVSM)
        { id: "c", label: "Block FL130 to FL150, IFLY101",                      correct: false },
      ],
    },

    // ③ ATC asks for endurance/intentions — pilot must communicate ISIS use
    {
      id: "atc_intentions_query",
      atMs: 65_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, say current capability, intentions, and any assistance required.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY101, ADR 1 isolated, two remaining ADRs in agreement, using STBY ISIS as reference, AP and A/THR disconnected, request return Delhi for raw-data approach", correct: true  },
        { id: "b", label: "Standby IFLY101",                                                                                                                                                   correct: false },
        // Wrong — under-informative for ATC routing
        { id: "c", label: "IFLY101, no issue, continuing climb",                                                                                                                                 correct: false },
      ],
    },

    // ③b Hold request — PM requests holding at block altitude while completing FORDEC
    {
      id: "pm_hold_req",
      atMs: 85_000,
      requiresStep: "fordec_speed",
      kind: "crew",
      from: "PM",
      message: "FORDEC complete. PM requests holding at block altitude to set up for the raw-data approach before accepting vectors. Select the correct call.",
      choices: [
        { id: "a", label: "Delhi Departure, IFLY101, request holding at block FL130 to FL150, completing approach brief", correct: true  },
        // Wrong — selects approach before setup complete
        { id: "b", label: "Delhi Departure, IFLY101, request immediate vectors ILS runway 28",                              correct: false },
        // Wrong — continues climb into restricted airspace
        { id: "c", label: "Delhi Departure, IFLY101, request climb FL250",                                                  correct: false },
      ],
    },

    // ③c ATC grants hold — crew reads back
    {
      id: "atc_hold_clr",
      atMs: 100_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, roger, maintain block FL130 to FL150, report ready for approach, Delhi Approach on 124.50 when ready.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Maintaining block FL130 to FL150, Delhi Approach 124.50 when ready, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                  correct: false },
        // Wrong — drops the frequency
        { id: "c", label: "Maintaining block FL130 to FL150, IFLY101",                                      correct: false },
      ],
    },

    // ④ Briefing prompt
    {
      id: "atc_briefing_prompt",
      atMs: 110_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, Delhi Approach, advise approach requirements and any assistance.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Request latest Delhi weather, runway in use, NOTAMs, expected approach type, IFLY101", correct: true  },
        { id: "b", label: "Standby IFLY101",                                                                       correct: false },
        { id: "c", label: "Request immediate vectors ILS 28, IFLY101",                                              correct: false },
      ],
    },

    // ⑤ Briefing info — full readback
    {
      id: "atc_briefing_info",
      atMs: 145_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, wind 280 at 8, runway 28 in use, NOTAMs nil significant, expect ILS runway 28, QNH 1013.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Wind 280 at 8, runway 28, ILS runway 28, QNH 1013, no significant NOTAMs, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                      correct: false },
        { id: "c", label: "Wind 280 at 8, runway 28, ILS, IFLY101",                                            correct: false },
      ],
    },

    // ⑥ POB / fuel / services
    {
      id: "atc_pob_fuel_services",
      atMs: 175_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY101, 186 persons on board, 7 tonnes fuel, endurance 2 hours, request fire services as a precaution, no medical required, raw-data approach", correct: true  },
        { id: "b", label: "Standby IFLY101",                                                                                                                                   correct: false },
        // Wrong — over-callout (full emergency not warranted for PAN)
        { id: "c", label: "IFLY101, 186 POB, request full emergency, all services",                                                                                              correct: false },
      ],
    },

    // ⑦ Ready for approach
    {
      id: "atc_ready_for_approach",
      atMs: 200_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, advise when ready for approach.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY101 ready, request vectors for ILS runway 28, raw-data approach, STBY ISIS as speed reference", correct: true  },
        { id: "b", label: "Ready, IFLY101",                                                                                      correct: false },
        { id: "c", label: "Standby IFLY101",                                                                                      correct: false },
      ],
    },

    // ⑧ Approach clearance
    {
      id: "atc_cleared_approach",
      atMs: 225_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, turn left heading 240, descend 3 000 feet, cleared ILS runway 28 approach, contact Delhi Tower 118.10 when established.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 28, contact Tower 118.10 when established, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                                            correct: false },
        { id: "c", label: "Cleared ILS runway 28, IFLY101",                                                                            correct: false },
      ],
    },

    // ⑨ Tower contact
    {
      id: "atc_tower_contact",
      atMs: 250_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, Delhi Tower, continue ILS approach runway 28, report established.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 28, will report established, IFLY101", correct: true  },
        { id: "b", label: "Switching, IFLY101",                                          correct: false },
      ],
    },

    // ⑩ Cleared to land
    {
      id: "atc_cleared_to_land",
      atMs: 275_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, runway 28 cleared to land, wind 280 at 8, fire services in position as a precaution.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Cleared to land runway 28, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                       correct: false },
        { id: "c", label: "Cleared to land runway 27, IFLY101", correct: false },
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
    controlPanel: [
      { stepId: "ap_fd_disc",    kind: "toggle_sw" as const, label: "AP/FD/A-THR", sub: "OFF"   },
      { stepId: "pitch_thrust",  kind: "monitor"   as const, label: "PITCH+THR",   sub: "TABLE" },
      { stepId: "adr_off",       kind: "toggle_sw" as const, label: "FAULTY ADR",  sub: "OFF"   },
      { stepId: "probe_heat_on", kind: "toggle_sw" as const, label: "PROBE HEAT",  sub: "ON"    },
    ],
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
