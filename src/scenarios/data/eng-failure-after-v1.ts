import type { Scenario } from "@/scenarios/types";
import { ENG_FAILURE_AFTER_V1_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-ENG p.36-38   : ENG 1(2) FAIL — in-flight ECAM procedure
// FCOM PRO-ABN-ENG p.71-75   : ENG 1(2) SHUT DOWN — STATUS + secondary failures
// FCTM (abnormal procedures) : ENGINE FAILURE AFTER V1 — crew flow & technique
//
// Key FCOM facts:
//   • Alert level: CAUTION (amber SC chime + MASTER CAUTION, NOT Master Warning)
//   • Trigger: engine core speed below idle, MASTER lever ON, FIRE pb not pushed
//   • In-flight procedure: IGN → IDLE → wait 30 s → if no relight → MASTER OFF
//   • No LAND ASAP for pure flameout without damage (that appears on ENG FIRE)
//   • Secondary failures after MASTER OFF: HYD G ENG1 pump, GEN 1, ENG 1 BLEED
//   • ENG SHUT DOWN STATUS: TCAS → TA required
//
// Key FCTM technique (Engine Failure After V1 flow):
//   PF 0-400ft: rotate 12.5° SRS, β TARGET = 0, RUDDER TRIM ~2 units, AP1 ON
//   PM 0-400ft: "ROTATE" → "GEAR UP" → "POSITIVE CLIMB"
//   400ft: PM calls "ECAM ACTIONS" → PM runs ECAM → call ENGINE SECURED
//   Acc altitude: push OP CLB → F/S/GD flap retraction → MCT
//   Note: for FLX takeoff, TOGA on live engine considered below F speed (VMCA margin)

export const engFailureAfterV1: Scenario = {
  meta: ENG_FAILURE_AFTER_V1_META,
  brief: {
    situation:
      "Departing VIDP RWY 28 in FLEX thrust. Two seconds after passing V1 at 145 kt, a MASTER CAUTION fires with a single chime — ECAM displays ENG 1 FAIL. No fire. The engine has flamed out. Asymmetric thrust demands immediate rudder correction.",
    job: "Maintain directional control. Follow SRS to V2+10. Run the ECAM: IGN → IDLE → wait 30 s for relight → if none, MASTER OFF. Accelerate to green dot single-engine, then FORDEC and return VIDP.",
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
      description: "ENG 1 FAIL — flameout, N2 decaying, asymmetric thrust",
      effects: [
        { type: "SET_MASTER_CAUT", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 FAIL" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "eng1_fail",   line: "ENG 1 FAIL",                    level: "caution" },
            { id: "ecam_ign",    line: "ENG MODE SEL.....IGN",           level: "caution" },
            { id: "ecam_idle",   line: "THR LEVER 1......IDLE",          level: "caution" },
            { id: "ecam_master", line: "ENG MASTER 1....OFF",            level: "caution" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── AVIATE (0–400 ft) ─────────────────────────────────────────────────────
    {
      id: "continue_rotation",
      label: "CONTINUE ROTATION",
      action: "V2+10",
      hint: "PF maintains rotation — do NOT reduce thrust. Rotate to 12.5° pitch, follow SRS. Apply rudder into live engine (ENG 2) to maintain β = 0 on FD sideslip indicator.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
    },
    {
      id: "rudder_trim",
      label: "RUDDER TRIM",
      action: "APPLY",
      hint: "FCTM: PF applies rudder trim toward live engine (~2 units) to reduce sustained pedal force. Reduces PF workload during climb-out. Reset trim in late approach before thrust reduction.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requires: ["continue_rotation"],
    },
    {
      id: "positive_rate_gear_up",
      label: "POSITIVE RATE — GEAR UP",
      action: "CALL",
      hint: "PM calls 'POSITIVE RATE' → PF: 'GEAR UP' → PM selects gear lever UP. PM follows up: 'POSITIVE CLIMB'.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["continue_rotation"],
    },
    {
      id: "engage_ap_fma",
      label: "AP1 ENGAGE — READ FMA",
      action: "CONFIRM",
      hint: "PF engages AP1 at ~100 ft (speed stable at V2+10). Read FMA aloud: SRS — NAV — AP1 ENGAGED. AP holds SRS guidance on ENG-OUT performance.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requires: ["positive_rate_gear_up"],
    },
    {
      // ENG FAIL is MASTER CAUTION (amber, SC chime) — NOT Master Warning
      id: "cancel_master_caut_initial",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM pushes amber MASTER CAUTION glareshield light — silences single-chime SC. ENG 1 FAIL remains on ECAM. This is a CAUTION, not a Warning.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      afterEffect: {
        delayMs: 400,
        triggerId: "mc_initial_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
    },

    // ── ECAM ACTIONS (400 ft+) ────────────────────────────────────────────────
    {
      id: "four_hundred_ft_cmd",
      label: "400 FT — ECAM ACTIONS",
      action: "ANNOUNCE",
      hint: "PM: 'ECAM ACTIONS' — PF acknowledges. Aviate complete, MASTER CAUT cancelled. PM now reads and action the ECAM procedure.",
      variant: "advisory",
      group: "flightcheck",
      crew: "PM",
      requires: ["engage_ap_fma"],
    },
    {
      // FCOM FIRST step for ENG FAIL in-flight: ENG MODE SEL → IGN
      // IGN = continuous ignition, confirms the immediate relight the FADEC is already attempting
      id: "eng_mode_sel_ign",
      label: "ENG MODE SEL",
      action: "IGN",
      hint: "PM: ENG MODE SEL → IGN. Selects continuous ignition — confirms the FADEC relight attempt already in progress. FCOM first step for ENG 1(2) FAIL in flight.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_ign",
      requires: ["four_hundred_ft_cmd"],
    },
    {
      id: "thr_lever_idle",
      label: "THR LEVER 1",
      action: "IDLE",
      hint: "PM retards ENG 1 thrust lever to IDLE detent. FCOM step 2. Reduces fuel flow and confirms lever position before relight countdown.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_idle",
      requires: ["eng_mode_sel_ign"],
    },
    {
      // FCOM: wait 30 s after ENG FAIL alert triggers for relight; if none → MASTER OFF
      id: "relight_wait",
      label: "RELIGHT — MONITOR 30 s",
      action: "MONITOR",
      hint: "FADEC attempts relight with continuous ignition selected. Monitor N2 and EGT for positive indication. FCOM: if no relight after 30 s from alert → proceed to ENG MASTER OFF.",
      variant: "advisory",
      crew: "PM",
      group: "flightcheck",
      requires: ["thr_lever_idle"],
    },
    {
      // No relight confirmed — proceed to MASTER OFF
      // afterEffect: secondary failures: HYD G ENG1 pump, GEN 1, ENG 1 BLEED (FCOM DSC-29/24/36)
      id: "eng1_master_off",
      label: "ENG 1 MASTER",
      action: "OFF",
      hint: "PM: 'ENG 1 MASTER, CONFIRM OFF?' → PF: 'CONFIRM' → PM sets OFF. No relight after 30 s. No fire — no AGENT discharge. Closes LP + HP fuel SOVs, FADEC de-energised.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_master",
      confirmRequired: true,
      requires: ["relight_wait"],
      afterEffect: {
        delayMs: 2_000,
        triggerId: "secondary_failures",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "hyd_g_pump",  line: "HYD G ENG1 PUMP...LO PR",    level: "caution" },
              { id: "elec_gen1",   line: "GEN 1 FAULT..........OFF",    level: "caution" },
              { id: "air_bleed1",  line: "ENG 1 BLEED.......FAULT",     level: "caution" },
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
      hint: "PM pushes MASTER CAUTION light — silences SC chime for secondary failures (HYD, ELEC, AIR BLEED). These cautions remain on ECAM for STATUS review.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      afterEffect: {
        delayMs: 300,
        triggerId: "mc_secondary_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
    },
    {
      id: "engine_secured_call",
      label: "ENGINE SECURED",
      action: "CALL",
      hint: "PM→PF: 'ENGINE SECURED — ENG 1 MASTER OFF — NO FIRE.' PF: 'CHECKED, CONTINUE ECAM.' Engine is secured when ECAM actioned to ENG MASTER OFF (no damage case).",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["eng1_master_off"],
    },
    {
      id: "atc_panpan",
      label: "ATC — PAN PAN",
      action: "TRANSMIT",
      hint: "PM transmits: 'MAYDAY MAYDAY MAYDAY, Delhi Departure, IFLY101, ENG 1 failure, maintaining RWY HDG 280, 3000 ft passing, request immediate return RWY 28.' FCTM: call once engine secured.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["engine_secured_call"],
    },
    {
      id: "tcas_ta",
      label: "TCAS MODE SEL",
      action: "TA",
      hint: "PM: TCAS MODE SEL → TA. FCOM ENG SHUT DOWN STATUS requirement. Prevents RA commands on single-engine which could compromise control.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["eng1_master_off"],
    },

    // ── CLEAN UP (Eng-Out Acc Altitude, min 1500 ft AGL) ─────────────────────
    {
      id: "level_off_maa",
      label: "LVL OFF — ENG OUT ACC ALT",
      action: "SELECT",
      hint: "PF: at Eng-Out Accel Altitude (min 1500 ft AGL with engine secured), push OP CLB. SRS → CLB transition on FMA. Hold speed — do not accelerate yet.",
      variant: "switch",
      crew: "PF",
      requires: ["eng1_master_off"],
    },
    {
      id: "accel_f_speed",
      label: "CONF 1 — F SPEED",
      action: "SELECT",
      hint: "PM: 'F SPEED' call. PF selects CONF 1. Do not reduce below F until flaps moved — VMCA margin with single engine.",
      variant: "switch",
      crew: "PM",
      requires: ["level_off_maa"],
    },
    {
      id: "accel_s_speed",
      label: "FLAPS 0 — S SPEED",
      action: "SELECT",
      hint: "PM: 'S SPEED' call. PF selects FLAPS 0 (CONF 0). Aircraft now clean. Accelerate to Green Dot.",
      variant: "switch",
      crew: "PM",
      requires: ["accel_f_speed"],
    },
    {
      id: "accel_green_dot",
      label: "MCT — GREEN DOT",
      action: "SET",
      hint: "PF: when speed trend arrow reaches Green Dot — set MCT on live engine (ENG 2). If already in MCT gate: CL then back to MCT. Climb at Green Dot single-engine.",
      variant: "switch",
      crew: "PF",
      requires: ["accel_s_speed"],
    },
    {
      id: "crew_crosscheck",
      label: "ECAM STATUS",
      action: "REVIEW",
      hint: "PM continues ECAM STATUS. Review: HYD G ENG1 PUMP LO PR, GEN 1 INOP, ENG 1 BLEED FAULT, PACK 1 (monitor). No further crew actions — awareness items only.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["accel_green_dot"],
    },

    // ── CRM / COMMS ───────────────────────────────────────────────────────────
    {
      id: "golden_rules",
      label: "GOLDEN RULES",
      action: "CONFIRM",
      hint: "PF calls rules, PM confirms.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      notes: [
        "① FLY · NAVIGATE · COMMUNICATE — aviate first, always",
        "② APPROPRIATE AUTOMATION — AP on, FMGS managing — monitor FMA at every mode change",
        "③ UNDERSTAND FMA — Monitor · Announce · Confirm · Understand every change",
        "④ ACT if UNEXPECTED — PF changes automation / PM: Question · Challenge · Take-over",
      ],
    },
    {
      id: "fordec",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC. PM cross-checks each element.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["crew_crosscheck"],
      notes: [
        "F — FACTS: ENG 1 flameout — no fire. No relight. VIDP 15 min. RWY 28 LDA 4430 m. Full CFR on field. GEN 1 INOP, HYD G ENG1 pump LO PR.",
        "O — OPTIONS: ① Return VIDP RWY 28  ② Divert nearest alternate  ③ Continue destination (NOT viable — LAND ASAP STATUS)",
        "R — RISKS & BENEFITS: VIDP = known field, full CFR, adequate LDA, familiar crew. Divert = longer single-engine exposure.",
        "D — DECISION: LAND ASAP — return VIDP RWY 28 with full emergency declared.",
        "E — EXECUTION: ILS RWY 28, CAT 1 SE approach, Vapp = Vref+5 kt, full emergency, CFR standby.",
        "C — CHECK-BACK: PM confirms 'AGREED — LAND VIDP RWY 28, FULL EMERGENCY'",
      ],
    },
    {
      id: "fmgc_prep",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: enter VIDP in DEST, select RWY 28, insert ILS 110.30 / CRS 282. Set Vapp = Vref+5 kt for SE approach (CONF FULL, one pack possible).",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
    },
    {
      id: "nis_brief",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "PM on interphone to SCCM.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
      notes: [
        "N — NATURE: 'Engine failure, ENG 1 shut down — no fire. Aircraft fully controllable.'",
        "I — INTENTIONS: 'Returning and landing runway 28 Delhi VIDP — approximately 15 minutes.'",
        "T — TIME: '15 minutes to landing.'",
        "S — SPECIAL: 'Crew at stations. On brace command — BRACE BRACE BRACE. Await my call.'",
      ],
    },
    {
      id: "pax_pa",
      label: "PASSENGER PA",
      action: "CONFIRM",
      hint: "PF PA: 'Ladies and gentlemen, this is your Captain. We are returning to Delhi as a precaution. Remain seated with seatbelts fastened. The cabin crew will look after you.'",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["nis_brief"],
    },
    {
      id: "go_around_review",
      label: "GO-AROUND REVIEW",
      action: "CONFIRM",
      hint: "PF briefs single-engine go-around plan. Confirm fuel vs DEST+ALTN+FINAL RESERVE.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fmgc_prep"],
      notes: [
        "GO-AROUND: TOGA on ENG 2 only — SRS engages — positive rate GEAR UP — V2+10 — clean up — MCT at Green Dot.",
        "FUEL CHECK: confirm total vs [DEST + ALTN + FINAL RESERVE 30 min]. Declare emergency to ensure priority.",
        "NOTE: rudder trim reset before thrust reduction — anticipate increased rudder force at zero trim.",
        "NOTE: with TOGA on one engine and VMCA consideration, do not reduce below F speed before full thrust.",
      ],
    },
    {
      id: "atc_emergency_services",
      label: "ATC — EMERG SVCS",
      action: "ADVISE",
      hint: "PM: 'MAYDAY IFLY101, request Category 3 emergency services runway 28. CFR vehicles, ambulances, medical standby required. 186 POB, 8.4 tonnes fuel.'",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["go_around_review"],
    },
    {
      id: "approach_brief",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF briefs: ILS RWY 28 VIDP, SE CAT 1. DA 200 ft. Vapp Vref+5. Abnormals: HYD G ENG1 PUMP LO PR, GEN 1 INOP, ENG 1 BLEED FAULT. Rudder trim reset before flare. Go-around briefed.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["atc_emergency_services"],
    },
    {
      id: "approach_prep",
      label: "APPROACH PREP",
      action: "COMPLETE",
      hint: "PM: ILS RWY 28 freq 110.30 / CRS 282. BARO minima 200 ft. Autobrake MED. Spoilers ARM. Reset rudder trim to zero before final approach.",
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
      hint: "PM runs landing checklist at 1000 ft final. Rudder trim confirmed at zero.",
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
        "RUDDER TRIM .......... ZERO (reset before thrust reduction)",
      ],
    },
  ],

  statusItems: [
    { id: "st_eng1",   line: "ENG 1..............SHUT DOWN",   severity: "caution"  },
    { id: "st_hyd",    line: "HYD G ENG1 PUMP...LO PR",        severity: "caution"  },
    { id: "st_gen1",   line: "GEN 1...................INOP",    severity: "caution"  },
    { id: "st_bleed",  line: "ENG 1 BLEED...........FAULT",    severity: "caution"  },
    { id: "st_pack",   line: "PACK 1 (MONITOR)",               severity: "advisory" },
    { id: "st_galley", line: "MAIN GALLEY..............SHED",   severity: "memo"     },
    { id: "st_appr",   line: "APPR CAT.................CAT 1", severity: "advisory" },
    { id: "st_maxfl",  line: "MAX FL....................FL250", severity: "memo"     },
    { id: "st_tcas",   line: "TCAS MODE SEL................TA", severity: "advisory" },
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
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, engine failure ENG 1, maintaining 280, passing 2000 ft, MAYDAY", correct: true },
        { id: "b", label: "Affirm, maintaining runway heading 280, climbing", correct: false },
      ],
    },
    {
      id: "atc_intentions",
      atMs: 45_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, state your intentions.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, requesting immediate return, ILS runway 28, full emergency services required", correct: true },
        { id: "b", label: "IFLY101 continuing to destination Bangalore, single engine", correct: false },
        { id: "c", label: "IFLY101, request flight level 250 for drift down", correct: false },
      ],
    },
    {
      id: "atc_final",
      atMs: 100_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, runway 28 ILS established, confirm souls on board and fuel remaining.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, 186 souls on board, 8.4 tonnes fuel, Category 3 emergency services required", correct: true  },
        { id: "b", label: "IFLY101, 186 POB, 8.4 tonnes, no emergency services needed — routine landing", correct: false },
        { id: "c", label: "IFLY101, unable confirm — stand by", correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "LAND_ASAP",
      label: "LAND ASAP",
      description: "Land at the nearest suitable aerodrome. FCOM ENG SHUT DOWN STATUS directive — full emergency declared.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Return VIDP RWY 28 — nearest suitable, full CFR, LDA 4430 m adequate for SE CONF FULL.",
      tone: "primary",
    },
    {
      value: "DIVERT",
      label: "DIVERT",
      description: "Divert to alternate — only if genuinely closer/more suitable than VIDP.",
      tone: "secondary",
    },
    {
      value: "CONTINUE",
      label: "CONTINUE",
      description: "Press on to destination. Not justified — LAND ASAP status, single-engine, secondary failures.",
      tone: "danger",
    },
  ],

  engineDisplay: {
    warningTrigger: "engine_fail",
    // Interactive ECAM controls — rendered in the engine display panel, clickable in order
    controlPanel: [
      { stepId: "eng_mode_sel_ign", kind: "mode_sel",  label: "MODE SEL",  sub: "IGN"   },
      { stepId: "thr_lever_idle",   kind: "thr_lever", label: "THR LVR",   sub: "IDLE"  },
      { stepId: "relight_wait",     kind: "monitor",   label: "RELIGHT",   sub: "30s"   },
      { stepId: "eng1_master_off",  kind: "master",    label: "MASTER",    sub: "ENG 1" },
    ],
    eng1: {
      rows: [
        {
          label: "THR LVR",
          states: [
            { when: { step: "thr_lever_idle" },  value: { v: "IDLE", c: "amber" } },
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
            { when: { step: "eng1_master_off" }, value: { v: "160", c: "amber" } },
            { when: { trigger: "engine_fail" },  value: { v: "480", c: "amber" } },
            { value: { v: "622", c: "green" } },
          ],
        },
        {
          label: "FF", unit: "KG/H",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "0", c: "amber" } },
            { when: { trigger: "engine_fail" },  value: { v: "0", c: "amber" } },
            { value: { v: "2380", c: "green" } },
          ],
        },
        {
          label: "N2", unit: "%",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "0.0", c: "amber" } },
            { when: { trigger: "engine_fail" },  value: { v: "0.0", c: "amber" } },
            { value: { v: "82.5", c: "green" } },
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
          note: "MASTER OFF: fuel SOV + HP SOV close, FADEC de-energised — no FIRE pb, no agent",
          switches: [
            {
              label: "MASTER", sub: "ENG 1",
              states: [
                { when: { step: "eng1_master_off" }, value: "off" as const },
                { value: "norm" as const },
              ],
            },
            {
              label: "ENG MODE", sub: "SEL",
              states: [
                { when: { step: "eng_mode_sel_ign" }, value: "auto" as const },
                { value: "norm" as const },
              ],
            },
          ],
        },
      ],
    },
    eng2: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.5", c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "618",  c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "2350", c: "green" } }] },
        { label: "N2",     unit: "%",    states: [{ value: { v: "82.5", c: "green" } }] },
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
              label: "N2", unit: "%",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "0.0", c: "amber" } },
                { when: { trigger: "engine_fail" },  value: { v: "0.0", c: "amber" } },
                { value: { v: "82.5", c: "green" } },
              ],
            },
            {
              label: "EGT", unit: "°C",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "160", c: "amber" } },
                { when: { trigger: "engine_fail" },  value: { v: "480", c: "amber" } },
                { value: { v: "622", c: "green" } },
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
            { label: "N1",     unit: "%",  states: [{ value: { v: "84.5",  c: "green" } }] },
            { label: "N2",     unit: "%",  states: [{ value: { v: "82.5",  c: "green" } }] },
            { label: "STATUS",             states: [{ value: { v: "NORMAL", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ENG PANEL",
        note: "FCOM: first ECAM action → ENG MODE SEL IGN. Then THR LEVER IDLE. After 30 s no relight → MASTER OFF. No FIRE pb, no AGENT discharge.",
        switches: [
          {
            label: "ENG MODE", sub: "SEL",
            states: [
              { when: { step: "eng_mode_sel_ign" }, value: "auto" as const },
              { value: "norm" as const },
            ],
          },
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
            { label: "ELEC PUMP", states: [{ value: { v: "AUTO", c: "green" } }] },
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
        note: "FCOM DSC-29: MASTER OFF closes fuel SOV → GRN ENG1 pump loses prime. Blue ELEC pump auto-pressurises. No crew action on HYD panel.",
        switches: [
          {
            label: "GRN", sub: "ENG1 PMP",
            states: [
              { when: { step: "eng1_master_off" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BLU", sub: "ELEC PMP", states: [{ value: "auto" as const }] },
          { label: "YLW", sub: "ENG2 PMP", states: [{ value: "norm" as const }] },
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
            { label: "GEN 2", states: [{ value: { v: "ON — NORM", c: "green" } }] },
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
            {
              label: "MAIN GAL",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "SHED", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "ELEC PANEL",
        note: "FCOM DSC-24: MASTER OFF → IDG 1 stops → GEN 1 FAULT. BTC auto-closes (AC BUS 1 → GEN 2). Main galley load-shed. No crew action required.",
        switches: [
          {
            label: "GEN 1", sub: "IDG 1",
            states: [
              { when: { step: "eng1_master_off" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "GEN 2",     sub: "IDG 2",    states: [{ value: "norm" as const }] },
          { label: "BUS TIE",   sub: "CONTCTR",  states: [{ value: "auto" as const }] },
        ],
      },
    },
    {
      id: "air", label: "AIR",
      alertStates: [{ when: { step: "eng1_master_off" }, value: true }, { value: false }],
      sections: [
        {
          title: "BLEED",
          colorStates: [
            { when: { step: "eng1_master_off" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "ENG 1 BLEED",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "FAULT / OFF", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "ENG 2 BLEED", states: [{ value: { v: "NORM", c: "green" } }] },
            {
              label: "X BLEED",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "AUTO (open)", c: "cyan" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "PACKS",
          colorStates: [
            { when: { step: "eng1_master_off" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "PACK 1",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "MONITOR", c: "amber" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            { label: "PACK 2",   states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "CABIN ΔP", states: [{ value: { v: "NORM", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "AIR PANEL",
        note: "FCOM DSC-36: ENG 1 MASTER OFF → ENG 1 bleed stops. XBLEED AUTO opens if needed. Pack 1 may lose source — monitor. No OHP action unless WAI ON.",
        switches: [
          {
            label: "ENG 1", sub: "BLEED",
            states: [
              { when: { step: "eng1_master_off" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "ENG 2", sub: "BLEED",   states: [{ value: "norm" as const }] },
          { label: "X BLEED",               states: [{ value: "auto" as const }] },
          { label: "PACK 1",                states: [{ value: "auto" as const }] },
          { label: "PACK 2",                states: [{ value: "auto" as const }] },
        ],
      },
    },
  ],
};
