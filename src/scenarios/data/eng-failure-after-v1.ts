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
//   PF 0-400ft: memory item → MAINTAIN DIRECTION (β TARGET = 0, rudder)
//   PF at VR: rotate 12.5° SRS, hold V2+10
//   PM 0-400ft: "ROTATE" → "GEAR UP" → "POSITIVE CLIMB"
//   PF: RUDDER TRIM ~2 units toward live engine (ENG 2), AP1 ON at ~100 ft
//   400ft: PF calls "ECAM ACTIONS" → PM acknowledges, runs ECAM → PM calls ENGINE SECURED
//   Acc altitude: push OP CLB → F/S/GD flap retraction → MCT
//   Note: for FLX takeoff, TOGA on live engine considered below F speed (VMCA margin)
//   ATC: declare MAYDAY to TOWER before accepting frequency change; full call to Departure

export const engFailureAfterV1: Scenario = {
  meta: ENG_FAILURE_AFTER_V1_META,
  brief: {
    situation:
      "Departing VIDP RWY 28 in FLEX thrust. Two seconds after passing V1 at 145 kt, a MASTER CAUTION fires with a single chime — ECAM displays ENG 1 FAIL. No fire. The engine has flamed out. Asymmetric thrust demands immediate rudder correction.",
    job: "V1 is passed — takeoff committed. Memory item: maintain direction. Follow SRS to V2+10. Run the ECAM at 400 ft: IGN → IDLE → 30 s relight wait → if none, MASTER OFF. Accelerate clean to green dot single-engine. FORDEC, declare MAYDAY, return VIDP.",
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
    {
      id: "four_hundred_ft",
      atMs: 18_000,
      description: "400 ft AGL — PF calls ECAM ACTIONS",
      effects: [
        {
          type: "ADD_ECAM",
          messages: [
            { id: "ecam_400ft", line: "400 FT — ECAM ACTIONS", level: "advisory" },
          ],
        },
      ],
    },
    {
      id: "min_accel_alt",
      atMs: 55_000,
      description: "Engine-out acceleration altitude ~1000 ft AGL — level off, accelerate, clean",
      effects: [],
    },
  ],

  steps: [
    // ── V1 GATE (fires when after_v1 trigger fires at T+6s) ──────────────────
    {
      id: "v1_continue",
      label: "V1 — CONTINUE TAKEOFF",
      action: "COMMIT",
      hint: "V1 passed — takeoff is committed. Airbus policy: once V1 is crossed, continue the takeoff even with an engine failure. Do NOT reduce thrust. Maintain directional control.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requiresTrigger: "after_v1",
    },

    // ── MEMORY ITEMS (gates on engine_fail at T+8s) ───────────────────────────
    {
      id: "maintain_direction",
      label: "MAINTAIN DIRECTION — MEMORY ITEM",
      action: "RUDDER",
      hint: "FCTM MEMORY ITEM: immediately apply rudder toward the live engine (ENG 2 — right pedal) to stop yaw. Target β = ZERO on the FD sideslip indicator. Maintain nose straight on the runway heading.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requiresTrigger: "engine_fail",
      requires: ["v1_continue"],
    },

    // ── AVIATE (PF continues rotation, PM calls Gear Up) ─────────────────────
    {
      id: "continue_rotation",
      label: "ROTATION — VR 12.5°",
      action: "ROTATE",
      hint: "PF rotates at VR to 12.5° pitch, follows SRS guidance targeting V2+10 kt. Hold rotation attitude — do NOT chase pitch. β = 0 maintained with rudder throughout.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requires: ["maintain_direction"],
    },
    {
      id: "positive_rate_gear_up",
      label: "POSITIVE RATE — GEAR UP",
      action: "CALL",
      hint: "PM calls 'POSITIVE RATE'. PF: 'GEAR UP'. PM selects gear lever UP. Verify GEAR UP indication. PM follows: 'POSITIVE CLIMB'.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["continue_rotation"],
    },
    {
      id: "rudder_trim",
      label: "RUDDER TRIM",
      action: "APPLY",
      hint: "FCTM: PF applies rudder trim toward live engine (~2 units toward ENG 2) above 150 kt to reduce sustained pedal force during climb-out. Reset trim to ZERO before approach thrust reduction.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requires: ["continue_rotation"],
    },
    {
      id: "engage_ap_fma",
      label: "AP1 ENGAGE — READ FMA",
      action: "CONFIRM",
      hint: "PF engages AP1 at ~100 ft once speed stable at V2+10. Read FMA aloud: SRS — NAV — AP1 ENGAGED. AP holds SRS guidance on engine-out performance.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requires: ["positive_rate_gear_up"],
    },

    // ── GLARESHIELD ──────────────────────────────────────────────────────────
    // ENG FAIL is MASTER CAUTION (amber, SC chime) — NOT Master Warning
    {
      id: "cancel_master_caut_initial",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM pushes amber MASTER CAUTION glareshield light — silences single SC chime. ENG 1 FAIL remains on ECAM. This is a CAUTION (amber), not a Warning (red).",
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

    // ── 400 FT ECAM GATE ─────────────────────────────────────────────────────
    {
      id: "four_hundred_ft_cmd",
      label: "400 FT — ECAM ACTIONS",
      action: "ANNOUNCE",
      hint: "PF: 'ECAM ACTIONS' — PM acknowledges and begins ECAM procedure. FCTM: PF commands at 400 ft; PM executes and reads actions.",
      variant: "advisory",
      group: "flightcheck",
      crew: "PF",
      requires: ["engage_ap_fma"],
    },

    // ── ECAM ACTIONS (FCOM: IGN → IDLE → 30s wait → MASTER OFF) ──────────────
    {
      id: "eng_mode_sel_ign",
      label: "ENG MODE SEL",
      action: "IGN",
      hint: "PM: ENG MODE SEL → IGN. FCOM first step for ENG 1(2) FAIL in flight. Selects continuous ignition — confirms the FADEC relight attempt already in progress.",
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
      hint: "PM retards ENG 1 thrust lever to IDLE detent. FCOM step 2. Reduces fuel flow, confirms lever position before 30 s relight countdown.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_idle",
      requires: ["eng_mode_sel_ign"],
    },
    {
      id: "relight_wait",
      label: "RELIGHT — MONITOR 30 s",
      action: "MONITOR",
      hint: "FADEC attempts relight with continuous ignition selected. Monitor N2 and EGT for positive indication. FCOM: if no relight after 30 s from alert — proceed to ENG MASTER OFF.",
      variant: "advisory",
      crew: "PM",
      group: "flightcheck",
      requires: ["thr_lever_idle"],
    },
    {
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
              { id: "land_asap",      line: "LAND ASAP",           level: "caution"  },
              { id: "sec_fail_hdr",   line: "SECONDARY FAILURES",  level: "advisory" },
              { id: "hyd_g_pump",     line: "* HYD",               level: "caution"  },
              { id: "elec_gen1",      line: "* ELEC",              level: "caution"  },
              { id: "air_bleed1",     line: "* AIR BLEED",         level: "caution"  },
            ],
          },
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },

    // Secondary failures MASTER CAUT
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM pushes MASTER CAUTION — silences SC chime for secondary failures (HYD, ELEC, AIR BLEED). Cautions remain on ECAM for STATUS review.",
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

    // Engine secured call + TCAS (parallel after MASTER OFF)
    {
      id: "engine_secured_call",
      label: "ENGINE SECURED",
      action: "CALL",
      hint: "PM→PF: 'ENGINE SECURED — ENG 1 MASTER OFF — NO FIRE.' PF: 'CHECKED.' Engine is secured once ECAM actioned to ENG MASTER OFF (no damage, no fire).",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["eng1_master_off"],
    },
    {
      id: "atc_mayday_inform",
      label: "MAYDAY — INFORM ATC",
      action: "CALL",
      hint: "PM declares MAYDAY to Delhi Tower — ENG 1 failure, engine shut down, maintaining runway heading, engine-out climb procedure. Tower acknowledges and provides handoff to Departure 124.3.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["engine_secured_call"],
    },
    {
      id: "tcas_ta",
      label: "TCAS MODE SEL",
      action: "TA",
      hint: "PM: TCAS MODE SEL → TA. FCOM ENG SHUT DOWN STATUS requirement — prevents RA commands on single-engine which could compromise control.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["eng1_master_off"],
    },

    // ── CLEAN UP (Eng-Out Acc Altitude, min 1000 ft AGL) ─────────────────────
    {
      id: "level_off_maa",
      label: "LVL OFF — ENG OUT ACC ALT",
      action: "SELECT",
      hint: "PF: at Eng-Out Accel Altitude (min 1000 ft AGL, engine secured), push OP CLB. SRS → CLB transition on FMA. Hold speed — do not accelerate until altitude reached.",
      variant: "switch",
      crew: "PF",
      requires: ["eng1_master_off"],
    },
    {
      id: "accel_f_speed",
      label: "CONF 1 — F SPEED",
      action: "SELECT",
      hint: "PM calls 'F SPEED'. PF calls 'CONF 1' and selects flap lever to CONF 1. PM cross-checks selection. Do not retract below F speed — VMCA margin required on single engine.",
      variant: "switch",
      crew: "PF",
      requires: ["level_off_maa"],
    },
    {
      id: "accel_s_speed",
      label: "FLAPS 0 — S SPEED",
      action: "SELECT",
      hint: "PM calls 'S SPEED'. PF calls 'FLAPS 0' and selects CONF 0. PM cross-checks selection. Aircraft now clean — accelerate to Green Dot.",
      variant: "switch",
      crew: "PF",
      requires: ["accel_f_speed"],
    },
    {
      id: "accel_green_dot",
      label: "MCT — GREEN DOT",
      action: "SET",
      hint: "PF: when speed reaches Green Dot — set MCT on live engine (ENG 2). Climb at Green Dot single-engine. If already in MCT gate: CL then back to MCT.",
      variant: "switch",
      crew: "PF",
      requires: ["accel_s_speed"],
    },

    // ── SECONDARY ECAM READ (after MCT set) ───────────────────────────────────
    {
      id: "ecam_secondary_read",
      label: "ECAM — SECONDARY FAILURES",
      action: "READ",
      hint: "PM reads secondary system failures from SD after engine secured. PF cross-checks and acknowledges each item.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["accel_green_dot"],
      notes: [
        "HYD G ENG1 PUMP...LO PR  — Green sys ENG1 pump lost. Blue ELEC pump auto — no crew action.",
        "GEN 1 FAULT.........OFF  — IDG1 stopped. BTC auto-closes, AC BUS 1 fed by GEN 2.",
        "ENG 1 BLEED......FAULT   — ENG 1 bleed stops. XBLEED AUTO opens. Pack 1 monitor.",
      ],
    },
    {
      id: "ecam_stop",
      label: "STOP ECAM",
      action: "CALL",
      hint: "PF calls 'STOP' — ECAM reading complete. All primary actions done and secondary failures read. Proceed to STATUS check.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      requires: ["ecam_secondary_read"],
    },

    // ── STATUS PHASE ──────────────────────────────────────────────────────────
    {
      id: "normal_checklist_check",
      label: "AFTER T/O CL",
      action: "COMPLETE",
      hint: "PF: 'Any NORMAL CHECKLIST?' — PM runs After Takeoff checklist. Note items already complete or N/A due to failure.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["ecam_stop"],
      notes: [
        "PACKS ............. CHECK (single pack ops — PACK 2 AUTO)",
        "SEAT BELTS ........ ON",
        "LANDING GEAR ...... UP / 3 OFF",
        "ENGINE MODE SEL ... IGN (already set per ECAM)",
        "FLAPS ............. 0 (clean / as required)",
      ],
    },
    {
      id: "oeb_computer_check",
      label: "OEB / COMPUTER RESETS",
      action: "CHECK",
      hint: "PF: 'Any OEB? Any COMPUTER RESETS?' — PM checks for applicable OEB items and required computer resets. No resets required for pure flameout — awareness check only.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      requires: ["normal_checklist_check"],
    },
    {
      id: "read_status",
      label: "READ STATUS",
      action: "CALL",
      hint: "PF: 'READ STATUS' — PM reads the ECAM STATUS page aloud. PF cross-checks each item.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      requires: ["oeb_computer_check"],
    },
    {
      id: "crew_crosscheck",
      label: "ECAM STATUS — PM READS",
      action: "REVIEW",
      hint: "PM reads STATUS page aloud. Items: ENG 1 SHUT DOWN, HYD G ENG1 PUMP LO PR, GEN 1 INOP, ENG 1 BLEED FAULT, PACK 1 MONITOR, APPR CAT 1, MAX FL 250, TCAS TA. PF: 'CHECKED' after each item.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["read_status"],
    },
    {
      id: "ecam_completed",
      label: "ECAM ACTIONS COMPLETED",
      action: "ANNOUNCE",
      hint: "PM: 'ECAM ACTIONS COMPLETED.' PF acknowledges. All primary ECAM procedures complete, secondary failures reviewed, STATUS read.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["crew_crosscheck"],
    },

    // ── CRM / COMMS ───────────────────────────────────────────────────────────
    {
      id: "golden_rules",
      label: "GOLDEN RULES",
      action: "CONFIRM",
      hint: "PF calls rules, PM confirms. Cross-check only — informational.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      optional: true,
      notes: [
        "① FLY · NAVIGATE · COMMUNICATE — aviate first, always",
        "② APPROPRIATE AUTOMATION — AP on, FMGS managing — monitor FMA at every mode change",
        "③ UNDERSTAND FMA — Monitor · Announce · Confirm · Understand every change",
        "④ ACT if UNEXPECTED — PF changes automation / PM: Question · Challenge · Take-over",
      ],
    },
    {
      id: "wx_request",
      label: "WEATHER / ATIS",
      action: "REQUEST",
      hint: "PM requests weather and ATIS for VIDP from ATC or via ACARS. Confirm QNH, visibility, and runway in use for ILS 28. Required before calculating landing performance.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["ecam_completed"],
    },
    {
      id: "ldg_perf",
      label: "LDG PERF",
      action: "CHECK",
      hint: "SE approach: Vapp = Vref+5 kt. RWY 28 VIDP LDA 4430 m / factored SE dist ~2200 m — ADEQUATE. Confirm LW and Vapp on MCDU.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_request"],
    },
    {
      id: "fordec",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC once landing performance is known. PM cross-checks each element.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["ldg_perf"],
      notes: [
        "F — FACTS: ENG 1 flameout — no fire. No relight. VIDP 15 min. RWY 28 LDA 4430 m. Full CFR on field. GEN 1 INOP, HYD G ENG1 pump LO PR.",
        "O — OPTIONS: ① Return VIDP RWY 28  ② Divert nearest alternate  ③ Continue destination (NOT viable — LAND ASAP STATUS)",
        "R — RISKS & BENEFITS: VIDP = known field, full CFR, adequate LDA. Divert = longer single-engine exposure.",
        "D — DECISION: LAND ASAP — return VIDP RWY 28 with full emergency declared.",
        "E — EXECUTION: ILS RWY 28, CAT 1 SE approach, Vapp = Vref+5 kt, full emergency, CFR standby.",
        "C — CHECK-BACK: PM confirms 'AGREED — LAND VIDP RWY 28, FULL EMERGENCY'",
      ],
    },
    {
      id: "inform_atc_intentions",
      label: "INFORM ATC — INTENTIONS",
      action: "CALL",
      hint: "After FORDEC decision: PM informs Delhi Departure/Approach of return intentions. State decision to return VIDP RWY 28, request ILS vectors, confirm emergency services required.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
    },
    {
      id: "fmgc_prep",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: enter VIDP in DEST, select RWY 28, insert ILS 110.30 / CRS 282. Set Vapp = Vref+5 kt for SE approach. Check F-PLN fuel + ALTN.",
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
        "NOTE: rudder trim reset to ZERO before thrust reduction — anticipate increased rudder force.",
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
      hint: "PM: ILS RWY 28 freq 110.30 / CRS 282. BARO minima 200 ft / QNH set. Autobrake MED. Spoilers ARM. Reset rudder trim to zero before final approach.",
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
    // ── Left column: STATUS limitations & directives ──────────────────────────
    { id: "st_land_asap", line: "LAND ASAP",             severity: "caution"  },
    { id: "st_eng1",      line: "ENG 1 SHUT DOWN",       severity: "caution"  },
    { id: "st_appr",      line: "APPR CAT . . . . CAT 1", severity: "advisory" },
    { id: "st_maxfl",     line: "MAX FL . . . . . FL250", severity: "memo"     },
    { id: "st_tcas",      line: "TCAS . . . . . . TA",   severity: "advisory" },
    // ── Right column: INOP SYS ───────────────────────────────────────────────
    { id: "st_bleed",  line: "ENG 1 BLEED",     severity: "caution",  inopSys: true },
    { id: "st_gen1",   line: "GEN 1",            severity: "caution",  inopSys: true },
    { id: "st_hyd",    line: "G ENG 1 PUMP",     severity: "caution",  inopSys: true },
    { id: "st_pack",   line: "PACK 1 (MONITOR)", severity: "advisory", inopSys: true },
    { id: "st_galley", line: "MAIN GALLEY",       severity: "memo",     inopSys: true },
  ],

  // ── Distractions ─────────────────────────────────────────────────────────────
  // FCTM radio discipline: declare MAYDAY to Tower BEFORE accepting frequency change.
  // Correct sequence: (1) MAYDAY to Tower → Tower acknowledges + hands off
  //                   (2) Full MAYDAY call to Departure/Radar
  distractions: [
    // ① T+65s (~800 ft AGL / 1600 ft AMSL) — Delhi Tower hands off to Departure
    // Pilot MUST declare MAYDAY to Tower first, then accept frequency change.
    // "Standby" resurfaces the call — pilot still has to declare before accepting.
    {
      id: "tower_freq_change",
      atMs: 65_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, passing 1600, contact Delhi Departure 124.3. Good day.",
      standbyResurfaceMs: 30_000,
      choices: [
        {
          id: "a",
          label: "MAYDAY MAYDAY MAYDAY, Delhi Tower, IFLY101 — ENG 1 failure, engine shut down, maintaining runway heading 280, climbing. Wilco 124.3 after acknowledgement.",
          correct: true,
        },
        {
          id: "b",
          label: "IFLY101 Wilco, contacting Departure 124.3. Good day.",
          correct: false,
        },
      ],
    },

    // ② T+145s — Delhi Departure initial call (after handoff)
    // Pilot delivers full MAYDAY call including position, SOB, fuel.
    // Intentions (return RWY 28) are stated AFTER FORDEC — not in this initial call.
    {
      id: "departure_mayday",
      atMs: 145_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, Delhi Departure, identified. Go ahead.",
      standbyResurfaceMs: 30_000,
      choices: [
        {
          id: "a",
          label: "MAYDAY MAYDAY MAYDAY, Delhi Departure, IFLY101 — ENG 1 failure, engine shut down, passing 2400 feet runway heading 280, 186 souls on board, 8.4 tonnes fuel, Category 3 emergency.",
          correct: true,
        },
        {
          id: "b",
          label: "IFLY101, single engine, request return to VIDP, runway 28.",
          correct: false,
        },
        {
          id: "c",
          label: "IFLY101 request lower, climbing 4000.",
          correct: false,
        },
      ],
    },

    // ③ T+280s — Delhi Approach vectors for ILS
    {
      id: "approach_ifd_confirm",
      atMs: 280_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, radar vectors ILS runway 28. Confirm souls on board and fuel remaining.",
      standbyResurfaceMs: 30_000,
      choices: [
        {
          id: "a",
          label: "MAYDAY IFLY101, 186 souls on board, 8.4 tonnes fuel, Category 3 emergency services required runway 28.",
          correct: true,
        },
        {
          id: "b",
          label: "IFLY101, 186 POB, 8.4 tonnes — no emergency services needed.",
          correct: false,
        },
        {
          id: "c",
          label: "IFLY101 unable confirm — stand by.",
          correct: false,
        },
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
