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
//   ATC: declare PAN PAN (urgency, no damage) on first contact with Departure; upgrade to MAYDAY only if condition worsens

export const engFailureAfterV1: Scenario = {
  meta: ENG_FAILURE_AFTER_V1_META,
  brief: {
    situation:
      "Departing VIDP RWY 28 in FLEX thrust. Two seconds after passing V1 at 145 kt, a MASTER CAUTION fires with a single chime — ECAM displays ENG 1 FAIL. No fire. The engine has flamed out. Asymmetric thrust demands immediate rudder correction.",
    job: "V1 is passed — takeoff committed. Memory item: maintain direction. Follow SRS to V2+10. Run the ECAM at 400 ft: IGN → IDLE → 30 s relight wait → if none, MASTER OFF. Accelerate clean to green dot single-engine. FORDEC, declare PAN PAN, return VIDP.",
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

    // ENGINE SECURED — per FCTM 12850: for engine failure WITHOUT damage,
    // engine is secured at "ENG MASTER OFF" (no FIRE pb, no agents needed).
    {
      id: "engine_secured_call",
      label: "ENGINE SECURED",
      action: "ANNOUNCE",
      hint: "After ENG MASTER OFF (no fire, no damage), PM announces 'ENGINE SECURED'. PF acknowledges.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["eng1_master_off"],
    },

    // LAND ASAP — amber per FCOM (engine shutdown without damage/fire).
    // Acknowledges the LAND ASAP indication; crew commits to nearest suitable
    // airport (no rush / no immediate threat like a fire — amber semantics).
    {
      id: "announce_land_asap",
      label: "LAND ASAP",
      action: "ANNOUNCE",
      hint: "PF announces 'LAND ASAP' (amber on ECAM). Engine shutdown without damage / fire — land at the nearest suitable airport. Amber = urgency, not distress.",
      variant: "caution",
      crew: "PF",
      group: "chclm",
      requires: ["engine_secured_call"],
    },

    // PAN PAN — for engine failure WITHOUT damage (FCOM: PAN PAN, not MAYDAY).
    // Captain may upgrade to MAYDAY if conditions warrant.
    {
      id: "atc_pan_pan",
      label: "PAN PAN",
      action: "DECLARE",
      hint: "Call ATC: 'PAN PAN PAN PAN PAN PAN, IFLY101, engine failure engine 1, maintaining runway track, climbing 3 000 feet, STANDBY.' Brief — declare, state, standby. Captain may upgrade to MAYDAY if conditions worsen.",
      variant: "caution",
      crew: "PM",
      group: "comms",
      requires: ["announce_land_asap"],
      notes: [
        "PAN PAN × 3 (×2 if abbreviated)",
        "Callsign",
        "Nature: engine failure engine 1 (no fire)",
        "Position / heading / altitude",
        "STANDBY — defer intentions until workload eases",
        "Upgrade to MAYDAY only if condition worsens (damage indicated, fire, control issue)",
      ],
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
      label: "V/S 0 AT MAA",
      action: "SELECT",
      hint: "PF: at minimum acceleration altitude PUSH V/S knob → V/S 0. Aircraft levels off, A/THR maintains target speed; SRS reverts as the level-off captures. Acceleration delayed until engine secured (FCTM 12850).",
      variant: "switch",
      crew: "PF",
      requires: ["eng1_master_off"],
    },
    // Task-sharing per callouts.txt — single-engine cleanup:
    //   PF CALLS the new config ("FLAPS 1" / "FLAPS UP").
    //   PM CHECKS AS, CALLS the new config back, and SELECTS the flap lever.
    //   PF NEVER moves the flap lever; PM operates it.  Do not retract below
    //   F speed — VMCA margin on single engine.
    {
      id: "accel_f_speed",
      label: "FLAPS 1 — F SPEED",
      action: "SELECT",
      hint: "PM: 'F SPEED'. PF: 'FLAPS 1'. PM: checks AS, calls 'FLAPS 1' back, selects flap lever to 1. PF monitors selection. Do not retract below F speed — VMCA margin required on single engine.",
      variant: "switch",
      crew: "PM",
      requires: ["level_off_maa"],
    },
    {
      id: "accel_s_speed",
      label: "FLAPS UP — S SPEED",
      action: "SELECT",
      hint: "PM: 'S SPEED'. PF: 'FLAPS UP'. PM: checks AS, calls 'FLAPS UP' back, selects flap lever to 0. PF monitors selection. Aircraft now clean — accelerate to Green Dot.",
      variant: "switch",
      crew: "PM",
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
      notes: [
        "Reference: QRH ABNORMAL — ONE ENG INOPERATIVE supplementary procedure (SE flight management — drift-down, perf, fuel).",
        "Reference: QRH ABNORMAL — ONE ENG INOPERATIVE LANDING procedure (approach planning — Vapp, flap setting, autobrake, EO go-around).",
      ],
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
      hint: "PM: 'PAN PAN IFLY101, request Category 3 emergency services runway 28. CFR vehicles, ambulances, medical standby required. 186 POB, 8.4 tonnes fuel.'",
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
    // ── Left column: STATUS limitations & directives (FCOM PRO-ABN-ENG ENG SHUT DOWN) ──
    { id: "st_land_asap",  line: "LAND ASAP",                    severity: "caution"  },
    { id: "st_eng1",       line: "ENG 1 SHUT DOWN",               severity: "caution"  },
    { id: "st_appr",       line: "APPR CAT . . . . CAT 1",       severity: "advisory" },
    { id: "st_ldg_dist",   line: "LDG DIST PROC . . . . APPLY",  severity: "caution"  },
    { id: "st_fuel_incr",  line: "FUEL CONSUMPT INCRSD",          severity: "advisory" },
    { id: "st_fms",        line: "FMS PRED UNRELIABLE",            severity: "advisory" },
    // ── Right column: INOP SYS (FCOM STATUS page right column) ──────────────
    { id: "st_bleed",      line: "ENG 1 BLEED",     severity: "caution",  inopSys: true },
    { id: "st_gen1",       line: "GEN 1",            severity: "caution",  inopSys: true },
    { id: "st_hyd",        line: "G ENG 1 PUMP",     severity: "caution",  inopSys: true },
    { id: "st_pack",       line: "PACK 1",           severity: "caution",  inopSys: true },
    { id: "st_galley",     line: "MAIN GALLEY",       severity: "memo",     inopSys: true },
    { id: "st_cat3",       line: "CAT 3 DUAL",       severity: "advisory", inopSys: true },
    { id: "st_steep",      line: "STEEP APPR",       severity: "advisory", inopSys: true },
  ],

  // ── Distractions — FCOM-realistic ATC sequence ─────────────────────────────
  // Realism rule: during the high-workload phase (initial PAN PAN through ECAM
  // completion) the crew sticks to "STANDBY / CONTINUING CHECKLIST" responses.
  // ATC reciprocally avoids POB/fuel/intent questions until the workload eases.
  // Only AFTER checklists + performance + decision making does the crew advise
  // intentions and accept the operational interrogation.
  //
  // Phraseology: engine failure WITHOUT damage is PAN PAN per FCOM / ICAO Annex 10
  // (urgency, not distress). Captain may upgrade to MAYDAY if condition worsens.
  //
  // Use of STANDBY: most calls during the early phase have STANDBY (system pb)
  // as a *correct* discipline.  A correct = "standby" run still scores well —
  // resurface delays simulate ATC giving the crew room.
  distractions: [
    // ① Tower → Departure handoff (low workload, just before failure)
    {
      id: "atc_handoff_to_departure",
      atMs: 25_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, contact Delhi Departure 124.85.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Delhi Departure 124.85, IFLY101",                                 correct: true  },
        { id: "b", label: "Roger, IFLY101",                                                  correct: false },
        // Wrong — off-by-one-digit frequency readback (classic stress error)
        { id: "c", label: "Delhi Departure 124.95, IFLY101",                                 correct: false },
      ],
    },

    // ② Initial PAN PAN — BRIEF, essential info only.  No runway, no intentions.
    {
      id: "atc_radar_contact_pan_pan",
      atMs: 42_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, Delhi Departure, radar contact.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — short, no premature commitments
        { id: "a", label: "PAN PAN PAN PAN PAN PAN, IFLY101, engine failure engine 1, no fire, maintaining runway track, climbing 3 000 feet, standby", correct: true  },
        // Wrong — over-committal during high workload
        { id: "b", label: "PAN PAN IFLY101, engine failure, returning immediate, request runway 28 ILS, full emergency",                                 correct: false },
        // Wrong — under-informative (no PAN PAN urgency call)
        { id: "c", label: "Maintaining runway track, climbing 3 000, IFLY101",                                                                            correct: false },
        // Wrong — MAYDAY over-declared for a clean shutdown without damage
        { id: "d", label: "MAYDAY MAYDAY MAYDAY, IFLY101, engine failure engine 1, no fire, maintaining runway track, climbing 3 000 feet, standby",     correct: false },
      ],
    },

    // ③ ATC acknowledges + provides vectors/altitude — NO questions during workload
    {
      id: "atc_vectors_climb",
      atMs: 70_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, roger PAN PAN, radar contact, continue runway track, climb 4 000 feet.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Continuing runway track, climbing 4 000, IFLY101",                correct: true  },
        // Wrong — pilot offering intentions/info before workload eased
        { id: "b", label: "IFLY101, returning Delhi, request runway 28, 186 souls, 8.4 t fuel", correct: false },
      ],
    },

    // ④ ATC offers vectors when ready — pilot should STANDBY (still ECAM-busy)
    //    Correct response = STANDBY pb (system-provided), or "Continuing checklist".
    {
      id: "atc_vectors_when_ready",
      atMs: 105_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, vectors available when ready, no reported traffic.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — concise discipline phrase during high workload
        { id: "a", label: "Continuing checklist, will advise, IFLY101",                       correct: true  },
        // Also valid — concrete deferral with intent to come back when ready
        { id: "b", label: "Unable at this time, request hold, will advise when ready for approach, IFLY101", correct: true  },
        // Wrong — premature commitment
        { id: "c", label: "IFLY101 returning Delhi, request runway 28 ILS",                   correct: false },
      ],
    },

    // ⑤ ATC prompts for briefing requirements — STEP-TRIGGERED on
    //   crew_crosscheck ("ECAM ACTIONS COMPLETED") so this only fires once
    //   the crew has finished ECAM, not on a fixed clock.  atMs is a floor
    //   (won't fire before this even if the step is done early).
    {
      id: "atc_info_request_prompt",
      atMs: 150_000,
      requiresStep: "crew_crosscheck",
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, Delhi Approach, advise any requirements for the approach and any assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — PM asks for what they need to brief the approach
        { id: "a", label: "Request latest Delhi weather, runway in use, NOTAMs, and expected approach type, IFLY101", correct: true },
        // Wrong — standby after workload has eased + ATC has prompted
        { id: "b", label: "Standby IFLY101",                                                  correct: false },
        // Wrong — premature commitment without info to brief on
        { id: "c", label: "Request vectors ILS runway 28, IFLY101",                           correct: false },
      ],
    },

    // ⑦ NEW — ATC delivers the briefing info; full readback expected
    {
      id: "atc_provides_briefing_info",
      atMs: 200_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, roger standby. … Delhi wind 280 at 8, runway 28 in use, NOTAMs nil significant, expect ILS runway 28.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — full readback of the items needed for the approach brief
        { id: "a", label: "Wind 280 at 8, runway 28, ILS runway 28, no significant NOTAMs, IFLY101", correct: true  },
        // Wrong — minimal acknowledgement loses the data
        { id: "b", label: "Roger, IFLY101",                                                          correct: false },
        // Wrong — partial readback, missed approach type
        { id: "c", label: "Wind 280 at 8, runway 28, IFLY101",                                       correct: false },
      ],
    },

    // ⑧ ATC asks the operational questions (POB / fuel / services) — was ⑥
    {
      id: "atc_pob_fuel_services",
      atMs: 225_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — full ops info; full emergency services standard for SE landing
        { id: "a", label: "IFLY101, 186 persons on board, 8.4 tonnes fuel, endurance 3 hours, request full emergency services on the runway", correct: true  },
        // Wrong — standby after ATC has explicitly asked for ops data
        { id: "b", label: "Standby IFLY101",                                                                                                   correct: false },
        // Wrong — confusing partial info ("no services" inconsistent with SE-landing standard)
        { id: "c", label: "IFLY101, 186 POB, 8.4 tonnes, no emergency services required",                                                      correct: false },
      ],
    },

    // ⑨ NEW — Ready-for-approach call (PM-initiated style; ATC prompts)
    {
      id: "atc_ready_for_approach",
      atMs: 250_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, advise when ready for approach.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — concrete intention with the requested config
        { id: "a", label: "IFLY101 ready, request vectors for ILS runway 28",                  correct: true  },
        // Wrong — too narrow, no intention conveyed
        { id: "b", label: "Ready, IFLY101",                                                    correct: false },
        // Wrong — standby is inconsistent after the crew has gone through briefing
        { id: "c", label: "Standby IFLY101",                                                   correct: false },
      ],
    },

    // ⑩ ATC clears for ILS — intercept heading + altitude + clearance + tower
    //    handoff (was ⑦, expanded with intercept heading per real ATC clearance)
    {
      id: "atc_cleared_approach",
      atMs: 275_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, turn left heading 240, descend 3 000 feet, cleared ILS runway 28 approach, contact Delhi Tower 118.10 when established.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — full readback of every clearance element
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 28, contact Tower 118.10 when established, IFLY101", correct: true  },
        // Wrong — bare acknowledgement loses the clearance content
        { id: "b", label: "Roger, IFLY101",                                                                                          correct: false },
        // Wrong — partial readback (missing heading + altitude + tower freq)
        { id: "c", label: "Cleared ILS runway 28, IFLY101",                                                                          correct: false },
      ],
    },

    // ⑪ Tower contact — was ⑧
    {
      id: "atc_tower_contact",
      atMs: 300_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, Delhi Tower, continue ILS approach runway 28, report established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 28, will report established, IFLY101",      correct: true  },
        { id: "b", label: "Switching, IFLY101",                                                correct: false },
      ],
    },

    // ⑫ Landing clearance — readback required — was ⑨
    {
      id: "atc_cleared_to_land",
      atMs: 325_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, runway 28 cleared to land, wind 280 at 8, emergency services in position.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Cleared to land runway 28, IFLY101",                                correct: true  },
        { id: "b", label: "Roger, IFLY101",                                                    correct: false },
        // Wrong — runway number mis-readback (listening trap on a high-workload call)
        { id: "c", label: "Cleared to land runway 29, IFLY101",                                correct: false },
      ],
    },
  ],

  // ── Phase-based cockpit channel state ─────────────────────────────────────
  // FCTM source: A320 FCTM OP-020 Engine Failure After V1 (all phases)
  // Each phase captures PFD, ND, PF task, PM task, ATC, and overhead state.
  phases: [

    // ── PHASE 1 — V1 PASSED (T+6s) ──────────────────────────────────────────
    {
      id: "v1_passed",
      label: "V1 PASSED — TAKEOFF COMMITTED",
      atMs: 6_000,
      pfd: {
        speed: 145,
        targetSpeed: "V2",
        altitude: 0,
        targetAltitude: 3_000,
        verticalSpeed: 0,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: false,
        athr: false,
        notes: ["SRS armed on FD — will capture at rotation", "ENG OUT not yet displayed"],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Runway centreline track 280 shown"],
      },
      pf: {
        task: "Maintain runway centreline with rudder, do NOT reduce thrust, prepare to rotate at VR",
        callouts: [
          { role: "PF", speech: "V1 — CONTINUE" },
        ],
      },
      pm: {
        task: "Monitor airspeed, call VR, watch for tyre/directional problem",
        callouts: [
          { role: "PM", speech: "V1" },
        ],
      },
    },

    // ── PHASE 2 — ENG 1 FAIL (T+8s) ────────────────────────────────────────
    {
      id: "eng1_fail",
      label: "ENG 1 FAIL — ASYMMETRIC THRUST",
      atMs: 8_000,
      pfd: {
        speed: 147,
        targetSpeed: "V2",
        altitude: 0,
        targetAltitude: 3_000,
        verticalSpeed: 0,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: false,
        athr: false,
        flags: ["MASTER CAUT (amber)", "ENG 1 FAIL — SC chime"],
        notes: [
          "MASTER CAUTION illuminates amber — single chime",
          "N2 decaying on ENG 1, ENG 2 at full FLEX",
          "Asymmetric yaw — LEFT yaw toward failed engine",
          "FMA col 5: ENG OUT (amber) appears",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        notes: ["Track deviation possible — yaw correction required"],
      },
      pf: {
        task: "MEMORY ITEM: apply right rudder immediately to zero β (sideslip). Do NOT pull back. Do NOT reduce thrust.",
        callouts: [
          { role: "PF", speech: "MEMORY ITEMS — MAINTAIN DIRECTION" },
        ],
      },
      pm: {
        task: "Identify ECAM — ENG 1 FAIL. Do NOT touch MASTER CAUT yet. Call VR.",
        callouts: [
          { role: "PM", speech: "ECAM — ENG 1 FAIL" },
          { role: "PM", speech: "ROTATE" },
        ],
      },
      overhead: {
        items: ["ENG 1 MASTER — remains ON (failure, not fire)", "No fire panel action"],
        notes: ["FCTM: do not touch any overhead items during directional control phase"],
      },
    },

    // ── PHASE 3 — ROTATION (T+10s) ──────────────────────────────────────────
    {
      id: "rotation",
      label: "ROTATION — VR 12.5°",
      atMs: 10_000,
      pfd: {
        speed: 152,
        targetSpeed: "V2+10",
        altitude: 50,
        targetAltitude: 3_000,
        verticalSpeed: 800,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: false,
        athr: false,
        notes: [
          "FD pitch bar commands 12.5° nose up",
          "β target = 0 — sideslip ball centered with right rudder",
          "SRS active: targeting V2+10 on pitch",
          "Speed trend arrow pointing up — accelerating through V2",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        notes: ["Track 280 — possible minor deviation corrected with bank"],
      },
      pf: {
        task: "Rotate smoothly to 12.5° pitch, follow FD, target V2+10. Hold right rudder — β = 0. Do NOT bank.",
        callouts: [
          { role: "PF", speech: "ROTATING — V2+10 TARGET" },
        ],
      },
      pm: {
        task: "Call 'POSITIVE RATE' once positive climb confirmed. Watch VSI and altimeter.",
        callouts: [
          { role: "PM", speech: "POSITIVE RATE" },
          { role: "PF", speech: "GEAR UP" },
          { role: "PM", speech: "GEAR UP — SELECTING" },
        ],
      },
    },

    // ── PHASE 4 — GEAR UP / AP1 ENGAGE (~100 ft, T+14s) ────────────────────
    {
      id: "gear_up_ap1",
      label: "GEAR UP — AP1 ENGAGED",
      atMs: 14_000,
      pfd: {
        speed: 163,
        targetSpeed: "V2+10",
        altitude: 120,
        targetAltitude: 3_000,
        verticalSpeed: 1_800,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        notes: [
          "AP1 engaged at ~100 ft — SRS holds V2+10 on pitch channel",
          "NAV engaged — tracking runway track then SID",
          "FMA col 5: AP1 (white), ENG OUT (amber)",
          "CLB armed in row 2 — will engage at acceleration altitude",
          "Rudder trim applied ~2 units right (toward ENG 2)",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["AP holding RWY TRK → NAV capture"],
      },
      pf: {
        task: "Engage AP1. Read FMA aloud. Apply rudder trim ~2 units toward ENG 2. Monitor SRS holding V2+10.",
        callouts: [
          { role: "PF", speech: "AP1 ENGAGE" },
          { role: "PF", speech: "FMA: MAN TOGA — SRS — NAV — AP1 — ENG OUT. CHECKED." },
          { role: "PF", speech: "RUDDER TRIM — 2 UNITS RIGHT" },
        ],
      },
      pm: {
        task: "Confirm gear up / 3 off. Cancel MASTER CAUTION once AP stable. Monitor speed.",
        callouts: [
          { role: "PM", speech: "GEAR UP — 3 OFF" },
          { role: "PM", speech: "MASTER CAUTION — CANCELLING" },
        ],
      },
    },

    // ── PHASE 5 — 400 FT / ECAM ACTIONS START (T+18s) ──────────────────────
    {
      id: "ecam_actions_start",
      label: "400 FT — ECAM ACTIONS",
      atMs: 18_000,
      pfd: {
        speed: 170,
        targetSpeed: "V2+10",
        altitude: 400,
        targetAltitude: 3_000,
        verticalSpeed: 2_000,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        notes: [
          "400 ft AGL — FCTM gate for ECAM actions",
          "SRS commanding V2+10 — AP holding nicely",
          "CLB armed — will engage at ~1000 ft (eng-out acc alt)",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
      },
      pf: {
        task: "Call ECAM ACTIONS. Monitor FD, speed, altitude. Do not touch controls while PM works ECAM.",
        callouts: [
          { role: "PF", speech: "FOUR HUNDRED FEET — ECAM ACTIONS" },
          { role: "PM", speech: "ECAM ACTIONS" },
        ],
      },
      pm: {
        task: "Acknowledge ECAM ACTIONS. Read first ECAM line aloud. Begin ENG MODE SEL → IGN.",
        callouts: [
          { role: "PM", speech: "ENG MODE SEL — IGN" },
        ],
      },
    },

    // ── PHASE 6 — ECAM: IGN → IDLE (T+20s) ─────────────────────────────────
    {
      id: "ecam_ign_idle",
      label: "ECAM — MODE SEL IGN / THR LEVER IDLE",
      atMs: 20_000,
      pfd: {
        speed: 175,
        targetSpeed: "V2+10",
        altitude: 550,
        targetAltitude: 3_000,
        verticalSpeed: 2_000,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        notes: ["Speed building through V2+10 — SRS pitching down slightly to hold target"],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
      },
      pf: {
        task: "Monitor altitude, speed, SRS guidance. Confirm each ECAM step called by PM.",
        callouts: [
          { role: "PM", speech: "ENG MODE SEL — IGN — CHECKED" },
          { role: "PM", speech: "THR LEVER 1 — IDLE" },
          { role: "PF", speech: "CONFIRMED" },
        ],
      },
      pm: {
        task: "Set ENG MODE SEL to IGN. Retard ENG 1 THR LEVER to IDLE detent. Start 30-second relight timer mentally.",
        callouts: [
          { role: "PM", speech: "THR LEVER 1 IDLE — SELECTING" },
          { role: "PM", speech: "RELIGHT — MONITORING 30 SECONDS" },
        ],
      },
      overhead: {
        items: ["ENG MODE SEL — IGN (centre overhead panel)"],
        notes: ["FCOM: IGN selects continuous ignition — FADEC relight attempt confirmed"],
      },
    },

    // ── PHASE 7 — 30-SECOND RELIGHT WAIT (T+22s → T+52s) ───────────────────
    {
      id: "relight_monitor",
      label: "RELIGHT MONITOR — 30 SECONDS",
      atMs: 22_000,
      pfd: {
        speed: 180,
        targetSpeed: "V2+10",
        altitude: 800,
        targetAltitude: 3_000,
        verticalSpeed: 1_800,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        notes: [
          "Monitor ENG 1 N2 on ECAM SD — ENG page",
          "Watch EGT for any positive sign of relight",
          "No change in ENG 1 indications — flameout confirmed",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
      },
      pf: {
        task: "Continue monitoring FD, speed, altitude. Aviate — let PM run the relight monitor.",
        callouts: [
          { role: "PM", speech: "N2 DECAYING — NO RELIGHT INDICATION" },
          { role: "PF", speech: "ROGER, MONITORING" },
        ],
      },
      pm: {
        task: "Watch SD ENG page: N2, EGT, FF on ENG 1. Call any positive relight sign. After 30 s with no relight — call ENG MASTER OFF.",
        callouts: [
          { role: "PM", speech: "30 SECONDS — NO RELIGHT. ENG 1 MASTER — CONFIRM OFF?" },
          { role: "PF", speech: "CONFIRM" },
        ],
      },
    },

    // ── PHASE 8 — ENG MASTER OFF + SECONDARY FAILURES (T+52s) ──────────────
    {
      id: "master_off_secondary",
      label: "ENG 1 MASTER OFF — SECONDARY FAILURES",
      atMs: 52_000,
      pfd: {
        speed: 188,
        targetSpeed: "V2+10",
        altitude: 950,
        targetAltitude: 3_000,
        verticalSpeed: 1_600,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        flags: ["MASTER CAUT (amber) — secondary failures"],
        notes: [
          "Second MASTER CAUTION fires: HYD, ELEC, AIR BLEED",
          "ENG 1 now fully shut down — no fuel flow",
          "FCTM: call ENGINE SECURED after MASTER OFF (no damage)",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
      },
      pf: {
        task: "Monitor aircraft — AP holding SRS. Confirm ENG MASTER OFF.",
        callouts: [
          { role: "PM", speech: "ENG 1 MASTER — OFF" },
          { role: "PM", speech: "ENGINE SECURED" },
          { role: "PF", speech: "ENGINE SECURED — ROGER" },
          { role: "PM", speech: "MASTER CAUTION — CANCELLING" },
        ],
      },
      pm: {
        task: "Set ENG MASTER 1 OFF. Call ENGINE SECURED. Cancel second MASTER CAUTION. Note secondary failures: HYD G ENG1 PUMP, GEN 1, ENG 1 BLEED.",
        callouts: [
          { role: "PM", speech: "SECONDARY FAILURES — HYD, ELEC, AIR BLEED — NOTED" },
        ],
      },
      overhead: {
        items: [
          "ENG 1 MASTER — OFF (confirmed by PM, cross-checked by PF)",
          "TCAS MODE SEL — TA (FCOM STATUS requirement after ENG SHUT DOWN)",
        ],
        notes: ["No FIRE pb, no AGENT — this is a failure, not a fire"],
      },
    },

    // ── PHASE 9 — ACCELERATION ALTITUDE / CLEAN UP (T+55s) ─────────────────
    {
      id: "accel_altitude",
      label: "ENG-OUT ACCELERATION ALTITUDE — LEVEL OFF / CLEAN",
      atMs: 55_000,
      pfd: {
        speed: 195,
        targetSpeed: "F SPD",
        altitude: 1_000,
        targetAltitude: 3_000,
        verticalSpeed: 0,
        fmaThrust: "MAN TOGA",
        fmaPitch: "ALT",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        notes: [
          "PF selects OP CLB or V/S 0 at eng-out acc alt (~1000 ft AGL)",
          "SRS → ALT on pitch channel as level-off captures",
          "Speed building — watch for F speed (flap retraction threshold)",
          "FCTM: do NOT retract flaps below F speed on single engine (VMCA margin)",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Range expanded to 20 nm to plan return routing"],
      },
      pf: {
        task: "At eng-out acc alt: push OP CLB or select V/S 0. Call flap retraction at F speed. Monitor speed for VMCA margin.",
        callouts: [
          { role: "PF", speech: "ACCELERATION ALTITUDE — LEVEL OFF" },
          { role: "PM", speech: "F SPEED" },
          { role: "PF", speech: "FLAPS 1" },
          { role: "PM", speech: "FLAPS 1 — SELECTING" },
        ],
      },
      pm: {
        task: "Call F speed when reached. Select flap lever on PF command. Call S speed. Monitor speed vs VMCA.",
        callouts: [
          { role: "PM", speech: "S SPEED" },
          { role: "PF", speech: "FLAPS UP" },
          { role: "PM", speech: "FLAPS UP — SELECTING" },
        ],
      },
    },

    // ── PHASE 10 — MCT / GREEN DOT / SE CLIMB (T+75s) ──────────────────────
    {
      id: "se_climb",
      label: "MCT SET — SINGLE-ENGINE CLIMB AT GREEN DOT",
      atMs: 75_000,
      pfd: {
        speed: 215,
        targetSpeed: "GREEN DOT",
        altitude: 2_000,
        targetAltitude: 3_000,
        verticalSpeed: 800,
        fmaThrust: "MAN MCT",
        fmaPitch: "CLB",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        notes: [
          "MCT set on ENG 2 — FMA col 1 shows MAN MCT",
          "CLB active on pitch — targeting FCU altitude 3000 ft",
          "Green Dot: single-engine best climb speed (~210 kt at this weight)",
          "Aircraft clean — FLAPS 0, gear up",
          "Rudder trim 2 units right still applied — confirm before approach",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Begin planning return routing — expect radar vectors VIDP RWY 28"],
      },
      pf: {
        task: "Set MCT on ENG 2 when at Green Dot. Monitor CLB mode. Prepare for FORDEC and LAND ASAP decision.",
        callouts: [
          { role: "PF", speech: "GREEN DOT — MCT SETTING" },
          { role: "PF", speech: "LAND ASAP — RETURNING VIDP" },
        ],
      },
      pm: {
        task: "Confirm ECAM ACTIONS COMPLETED. Read STATUS page. TCAS TA confirmed. Begin FORDEC with PF.",
        callouts: [
          { role: "PM", speech: "ECAM ACTIONS COMPLETED" },
          { role: "PM", speech: "READING STATUS — ENG 1 SHUT DOWN, HYD G ENG1 PUMP LO PR, GEN 1 INOP, ENG 1 BLEED, PACK 1 MONITOR, CAT 1, MAX FL 250, TCAS TA" },
          { role: "PF", speech: "CHECKED" },
        ],
      },
      atc: {
        initiatedBy: "PM",
        transmissions: [
          { role: "PM", station: "IFLY101", speech: "PAN PAN PAN PAN PAN PAN, IFLY101, engine failure engine 1, no fire, maintaining runway track, climbing 3 000 feet, standby" },
          { role: "ATC", station: "DELHI DEP", speech: "IFLY101, roger PAN PAN, radar contact, continue runway track, climb 4 000 feet." },
          { role: "PM", station: "IFLY101", speech: "Continuing runway track, climbing 4 000, IFLY101" },
        ],
      },
      overhead: {
        items: [
          "ENG 1 MASTER — OFF (confirmed)",
          "ENG MODE SEL — IGN (remains set from ECAM)",
          "TCAS — TA (set per STATUS requirement)",
        ],
        notes: ["No further overhead actions unless OEB requires computer resets"],
      },
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
