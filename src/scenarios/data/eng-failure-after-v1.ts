import type { Scenario } from "@/scenarios/types";
import { ENG_FAILURE_AFTER_V1_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-ENG p.1–10  : ENG 1(2) FAIL (IN FLIGHT) procedure
// FCTM OP-020               : Single-engine after V1 — crew technique

export const engFailureAfterV1: Scenario = {
  meta: ENG_FAILURE_AFTER_V1_META,
  brief: {
    situation:
      "Departing VIDP RWY 28. Two seconds after passing V1 at 145 kt, a MASTER WARNING fires and ECAM displays ENG 1 FAIL — no fire. The engine has flamed out. Asymmetric thrust requires immediate rudder application.",
    job: "Maintain directional control with rudder. Climb out at V2+10 on SRS. Secure the engine via ECAM procedure. Accelerate to green dot single-engine, then plan return to VIDP.",
  },

  triggers: [
    {
      id: "after_v1",
      atMs: 6_000,
      description: "V1 passed — committed to takeoff",
      effects: [],
    },
    {
      id: "engine_fail",
      atMs: 8_000,
      description: "ENG 1 FAIL — flameout, asymmetric thrust",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 FAIL" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "eng1_fail",   line: "ENG 1 FAIL",                     level: "warning" },
            { id: "land_asap",   line: "LAND ASAP",                       level: "warning" },
            { id: "ecam_idle",   line: "THR LEVER (ENG1).......IDLE",     level: "caution" },
            { id: "ecam_master", line: "ENG 1 MASTER..........OFF",       level: "caution" },
            { id: "ecam_n1",     line: "ENG 1 N1................0",       level: "advisory" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── AVIATE ────────────────────────────────────────────────────────────────
    {
      id: "continue_rotation",
      label: "CONTINUE ROTATION",
      action: "V2+10",
      hint: "PF maintains rotation — do NOT reduce thrust. Follow SRS guidance, target V2+10 kt. Apply rudder into live engine.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
    },
    {
      id: "positive_rate_gear_up",
      label: "POSITIVE RATE — GEAR UP",
      action: "CALL",
      hint: "PM calls 'POSITIVE RATE'. PF responds 'GEAR UP'. PM selects gear lever UP.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["continue_rotation"],
    },
    {
      id: "engage_ap_fma",
      label: "AP1 ENGAGE — READ FMA",
      action: "CONFIRM",
      hint: "PF: engage AP1 at ~100 ft (V2+10 stable). Read FMA aloud: SRS — NAV — AP1 ENGAGED.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requires: ["positive_rate_gear_up"],
    },
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM pushes MASTER WARN glareshield light — silences CRC, resets red light.",
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
      id: "four_hundred_ft_cmd",
      label: "400 FT — ECAM ACTIONS",
      action: "ANNOUNCE",
      hint: "PM: 'ECAM ACTIONS' — PF acknowledges. Aviate complete and MW cancelled first.",
      variant: "advisory",
      group: "flightcheck",
      crew: "PM",
      requires: ["engage_ap_fma"],
    },

    // ── ECAM PROCEDURE ────────────────────────────────────────────────────────
    {
      id: "thr_lever_idle",
      label: "THR LEVER 1",
      action: "IDLE",
      hint: "PM retards ENG 1 thrust lever to IDLE. FCOM step 1.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_idle",
      requires: ["four_hundred_ft_cmd"],
    },
    {
      id: "eng1_master_off",
      label: "ENG 1 MASTER",
      action: "OFF",
      hint: "PM: 'ENG 1 MASTER, CONFIRM OFF?' — PF: 'CONFIRM' — PM sets OFF. Closes LP + HP fuel SOVs, FADEC de-energised.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_master",
      confirmRequired: true,
      requires: ["thr_lever_idle"],
      afterEffect: {
        delayMs: 2_000,
        triggerId: "secondary_failures",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "hyd_g_pump", line: "HYD G ENG1 PUMP...LO PR", level: "caution" },
              { id: "elec_gen1",  line: "ELEC GEN 1............OFF", level: "caution" },
            ],
          },
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM pushes MASTER CAUTION light — silences SC chime. Secondary cautions remain on ECAM.",
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
    {
      id: "crew_crosscheck",
      label: "ECAM CROSSCHECK",
      action: "CONFIRM",
      hint: "PM→PF: 'ECAM ACTIONS COMPLETE. ENG 1 MASTER OFF. NO FIRE.' PF: 'CHECKED, MONITOR.'",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["eng1_master_off"],
    },
    {
      id: "level_off_maa",
      label: "LVL OFF MAA",
      action: "SELECT",
      hint: "PF: at MIN ACCEL ALT select OP CLB. Hold speed, monitor SRS→CLB transition on FMA.",
      variant: "switch",
      crew: "PF",
      requires: ["eng1_master_off"],
    },
    {
      id: "accel_clean",
      label: "ACCEL TO GREEN DOT",
      action: "CONFIRM",
      hint: "PF: accelerate to green dot (single-engine clean speed). Retract flaps in stages. Verify CONFIG CLEAN on ECAM.",
      variant: "switch",
      crew: "PF",
      requires: ["level_off_maa"],
    },

    // ── CRM / COMMS ───────────────────────────────────────────────────────────
    {
      id: "golden_rules",
      label: "GOLDEN RULES",
      action: "CONFIRM",
      hint: "PF calls rules, PM confirms. Fly → Navigate → Communicate.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      notes: [
        "① FLY · NAVIGATE · COMMUNICATE — in this order, with appropriate tasksharing",
        "② Use APPROPRIATE AUTOMATION — pilot judgment prevails",
        "③ Understand your FMA — Monitor · Announce · Confirm · Understand",
        "④ Take ACTION if unexpected — PF changes automation / PM: Question · Challenge · Take-over",
      ],
    },
    {
      id: "oeb_check",
      label: "OEB CHECK",
      action: "CONFIRM",
      hint: "PM: check QRH OEB list for applicable bulletins modifying ENG 1 FAIL procedure. If none applicable — state 'NO APPLICABLE OEB'.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_crosscheck"],
    },
    {
      id: "wx_request",
      label: "WX / ATIS",
      action: "REQUEST",
      hint: "PM requests ATIS or direct from Delhi Approach: wind, QNH, vis, RVR RWY 28.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_crosscheck"],
    },
    {
      id: "ldg_perf",
      label: "LDG PERF",
      action: "CHECK",
      hint: "SE approach: Vapp +5 kt. VIDP RWY 28 LDA 4430 m — ADEQUATE for single-engine CONF FULL.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_request"],
    },
    {
      id: "fordec",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC. PM cross-checks each element. Agree and commit.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["ldg_perf"],
      notes: [
        "F — FACTS: ENG 1 failed — no fire. Single engine. VIDP 15 min. RWY 28 LDA 4430 m. Full CFR on field.",
        "O — OPTIONS: ① Return VIDP RWY 28  ② Divert nearest alternate  ③ Continue (NOT viable)",
        "R — RISKS & BENEFITS: VIDP = known field, full CFR, adequate LDA. Divert = longer flight.",
        "D — DECISION: LAND ASAP — return VIDP RWY 28 with full emergency declared.",
        "E — EXECUTION: ILS RWY 28, Cat 1, SE approach Vapp+5 kt, full emergency, CFR standing by.",
        "C — CHECK-BACK: PM confirms 'AGREED — LAND VIDP RWY 28, FULL EMERGENCY'",
      ],
    },
    {
      id: "fmgc_prep",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: enter VIDP in DEST, select RWY 28, insert ILS 110.30 / CRS 282. Set Vapp = Vref+5 kt (SE).",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
    },
    {
      id: "nis_brief",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "Interphone to SCCM — NATURE: engine failure, ENG 1 shut down. INTENTIONS: landing VIDP RWY 28. TIME: approx 15 min. SPECIAL: crew at stations, prepare for emergency landing.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
      notes: [
        "N — NATURE: 'Engine failure, ENG 1 shut down, no fire, aircraft fully serviceable'",
        "I — INTENTIONS: 'Returning and landing runway 28 Delhi VIDP'",
        "T — TIME: 'Approximately 15 minutes to landing'",
        "S — SPECIAL: 'Crew at stations. On brace command — BRACE BRACE BRACE.'",
      ],
    },
    {
      id: "pax_pa",
      label: "PASSENGER PA",
      action: "CONFIRM",
      hint: "PA: 'Ladies and gentlemen, this is your Captain. We are returning to Delhi as a precaution. Remain seated, seatbelts fastened.'",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["nis_brief"],
    },
    {
      id: "go_around_review",
      label: "GO-AROUND REVIEW",
      action: "CONFIRM",
      hint: "PF briefs go-around plan (ENG 2 only) and confirms fuel state is adequate for alternate if approach is missed.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fmgc_prep"],
      notes: [
        "GO-AROUND: TOGA (ENG 2 only) — SRS engages — positive rate GEAR UP — maintain V2+10",
        "FUEL CHECK: confirm total fuel vs [DEST + ALTN + FINAL RESERVE].",
        "Emergency services attend runway — do NOT delay evacuation call if required.",
      ],
    },
    {
      id: "atc_emergency_services",
      label: "ATC — EMERG SVCS",
      action: "ADVISE",
      hint: "PM advises ATC: 'IFLY101, request Category 3 emergency services on runway 28. CFR vehicles, ambulances, and medical standby required.'",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["go_around_review"],
    },
    {
      id: "approach_brief",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF briefs: ILS RWY 28 VIDP, SE CAT 1. DA 200 ft. Vapp +5 kt. Non-normal: HYD GRN LO PR, GEN 1 INOP. Go-around briefed.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["atc_emergency_services"],
    },
    {
      id: "approach_prep",
      label: "APPROACH PREP",
      action: "COMPLETE",
      hint: "PM: set ILS RWY 28 freq 110.30 / CRS 282. BARO minima 200 ft. Autobrake MED. Spoilers ARM.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["approach_brief"],
    },
    {
      id: "approach_cl",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs approach checklist.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_prep"],
      notes: [
        "BARO ................. QNH SET",
        "MDA/DH ............... 200 ft SET",
        "SEAT BELTS ........... ON",
        "AUTOBRAKE ............ MED",
        "SPOILERS ............. ARM (green)",
        "LANDING LIGHTS ....... ON",
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
        "GEAR ................. DOWN — 3 GREEN",
        "FLAPS ................ FULL",
        "SPOILERS ............. ARM (green)",
        "AUTOBRAKE ............ MED (SET)",
        "CABIN ................ ADVISED",
      ],
    },
  ],

  statusItems: [
    { id: "st_eng1",  line: "ENG 1....................INOP",    severity: "caution"  },
    { id: "st_hyd",   line: "HYD GRN ENG1 PUMP.....LO PR",     severity: "caution"  },
    { id: "st_elec",  line: "ELEC GEN 1...............INOP",    severity: "caution"  },
    { id: "st_appr",  line: "APPR CAT.................CAT 1",   severity: "advisory" },
    { id: "st_maxfl", line: "MAX FL.....................FL250",  severity: "memo"     },
  ],

  distractions: [
    {
      id: "atc_radar",
      atMs: 28_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, radar contact. Confirm maintaining runway heading 280.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, engine failure, maintaining 280, MAYDAY", correct: true },
        { id: "b", label: "Affirm, maintaining 280",                                                  correct: false },
      ],
    },
    {
      id: "atc_intentions",
      atMs: 42_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, state your intentions.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, returning VIDP, request immediate approach runway 28, full emergency", correct: true },
        { id: "b", label: "IFLY101 continuing to destination",                                                     correct: false },
      ],
    },
    {
      id: "atc_final",
      atMs: 100_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, runway 28 clear. Confirm souls on board and fuel.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, 186 POB, 8.4 tonnes fuel, CFR required",  correct: true  },
        { id: "b", label: "IFLY101, 186 POB, no CFR required",                        correct: false },
        { id: "c", label: "IFLY101, continuing to destination",                        correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "LAND_ASAP",
      label: "LAND ASAP",
      description: "Land at the nearest suitable aerodrome with full emergency services. FCOM directive for ENG FAIL.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Return to VIDP — valid as nearest suitable option. RWY 28 LDA 4430 m adequate for SE landing.",
      tone: "primary",
    },
    {
      value: "DIVERT",
      label: "DIVERT",
      description: "Divert to alternate — only if genuinely closer than departure field.",
      tone: "secondary",
    },
    {
      value: "CONTINUE",
      label: "CONTINUE",
      description: "Press on to destination. Not appropriate — single-engine to destination cannot be justified.",
      tone: "danger",
    },
  ],

  engineDisplay: {
    warningTrigger: "engine_fail",
    eng1: {
      rows: [
        {
          label: "THR LVR",
          states: [
            { when: { step: "thr_lever_idle" },  value: { v: "IDLE", c: "green" } },
            { when: { trigger: "engine_fail" },   value: { v: "MCT/FLX", c: "amber" } },
            { value: { v: "CLB", c: "green" } },
          ],
        },
        {
          label: "N1", unit: "%",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "0.0", c: "amber" } },
            { when: { trigger: "engine_fail" },  value: { v: "0.0", c: "amber" } },
            { value: { v: "84.2", c: "green" } },
          ],
        },
        {
          label: "EGT", unit: "°C",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "180", c: "amber" } },
            { when: { trigger: "engine_fail" },  value: { v: "620", c: "amber" } },
            { value: { v: "620", c: "green" } },
          ],
        },
        {
          label: "FF", unit: "KG/H",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "0", c: "amber" } },
            { when: { trigger: "engine_fail" },  value: { v: "0", c: "amber" } },
            { value: { v: "2400", c: "green" } },
          ],
        },
        {
          label: "STATUS",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "SHUT DOWN", c: "amber" } },
            { when: { trigger: "engine_fail" },  value: { v: "FAILED", c: "amber" } },
            { value: { v: "NORMAL", c: "green" } },
          ],
        },
      ],
      trays: [
        {
          title: "ENG PANEL",
          note: "FCOM step 2 — MASTER OFF: fuel SOV + oil SOV close, FADEC de-energised",
          switches: [
            {
              label: "MASTER", sub: "ENG 1",
              states: [
                { when: { step: "eng1_master_off" }, value: "off" as const },
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
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "618",  c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "2350", c: "green" } }] },
        { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
  },

  systemTabs: [
    {
      id: "eng", label: "ENG",
      alertStates: [{ when: { trigger: "engine_fail" }, value: true }, { value: false }],
      autoSelect: { trigger: "engine_fail" },
      sections: [
        {
          title: "ENG 1",
          colorStates: [
            { when: { step: "eng1_master_off" }, value: "amber" },
            { when: { trigger: "engine_fail" },  value: "amber" },
            { value: "dim" },
          ],
          rows: [
            {
              label: "N1", unit: "%",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "0.0", c: "amber" } },
                { when: { trigger: "engine_fail" },  value: { v: "0.0", c: "amber" } },
                { value: { v: "84.2", c: "green" } },
              ],
            },
            {
              label: "STATUS",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "SHUT DOWN", c: "amber" } },
                { when: { trigger: "engine_fail" },  value: { v: "FAILED", c: "amber" } },
                { value: { v: "NORMAL", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "ENG 2",
          colorStates: [{ value: "dim" }],
          rows: [
            { label: "N1",     unit: "%",  states: [{ value: { v: "84.2",  c: "green" } }] },
            { label: "STATUS",             states: [{ value: { v: "NORMAL", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ENG PANEL",
        note: "FCOM step 2 — MASTER OFF: fuel SOV + oil SOV close, FADEC de-energised",
        switches: [
          {
            label: "MASTER", sub: "ENG 1",
            states: [
              { when: { step: "eng1_master_off" }, value: "off" as const },
              { value: "norm" as const },
            ],
          },
        ],
      },
    },
    {
      id: "hyd", label: "HYD",
      alertStates: [{ when: { step: "eng1_master_off" }, value: true }, { value: false }],
      sections: [
        {
          title: "GREEN SYS",
          colorStates: [
            { when: { step: "eng1_master_off" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "ENG 1 PUMP",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "LO PR", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "PRESSURE", unit: "PSI", states: [{ value: { v: "3000", c: "green" } }] },
          ],
        },
        {
          title: "BLUE SYS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ELEC PUMP", states: [{ value: { v: "AUTO / ON", c: "green" } }] },
            { label: "PRESSURE", unit: "PSI", states: [{ value: { v: "3000", c: "green" } }] },
          ],
        },
        {
          title: "YELLOW SYS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ENG 2 PUMP", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "PRESSURE", unit: "PSI", states: [{ value: { v: "3000", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "HYD PANEL",
        note: "FCOM DSC-29: ENG 1 MASTER OFF closes fuel SOV — GRN ENG1 pump loses prime. Blue ELEC pump auto-pressurises.",
        switches: [
          {
            label: "GRN", sub: "ENG1 PMP",
            states: [
              { when: { step: "eng1_master_off" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BLU", sub: "ELEC PMP", states: [{ value: "auto" as const }] },
        ],
      },
    },
    {
      id: "elec", label: "ELEC",
      alertStates: [{ when: { step: "eng1_master_off" }, value: true }, { value: false }],
      sections: [
        {
          title: "AC NETWORK",
          colorStates: [
            { when: { step: "eng1_master_off" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "GEN 1",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "FAULT / OFF", c: "amber" } },
                { value: { v: "ON", c: "green" } },
              ],
            },
            { label: "GEN 2",    states: [{ value: { v: "ON — NORM", c: "green" } }] },
            {
              label: "AC BUS 1",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "← GEN 2 (BTC)", c: "amber" } },
                { value: { v: "GEN 1", c: "green" } },
              ],
            },
            { label: "AC BUS 2", states: [{ value: { v: "GEN 2", c: "green" } }] },
            {
              label: "BUS TIE",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "CLOSED (AUTO)", c: "cyan" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "DC NETWORK",
          colorStates: [{ value: "green" }],
          rows: [
            {
              label: "TR 1",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "FAULT", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "TR 2",    states: [{ value: { v: "NORM", c: "green" } }] },
            {
              label: "ESS TR",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "AUTO (ALTN)", c: "cyan" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "BAT 1/2", states: [{ value: { v: "AUTO", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ELEC PANEL",
        note: "FCOM DSC-24: MASTER OFF de-energises FADEC → IDG 1 stops generating → GEN 1 FAULT. BTC auto-closes. No crew action required.",
        switches: [
          {
            label: "GEN 1", sub: "IDG 1",
            states: [
              { when: { step: "eng1_master_off" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BUS TIE", sub: "CONTCTR", states: [{ value: "auto" as const }] },
        ],
      },
    },
    {
      id: "air", label: "AIR",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "BLEED",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ENG 1 BLEED", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "ENG 2 BLEED", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "X BLEED",     states: [{ value: { v: "AUTO", c: "green" } }] },
          ],
        },
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
  ],
};
