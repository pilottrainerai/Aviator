import type { Scenario } from "@/scenarios/types";
import { ENG1_FIRE_AFTER_V1_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-ENG P 39–42  : ENG 1(2) FIRE (IN FLIGHT) procedure
// FCOM DSC-29, DSC-21, DSC-24: Secondary system effects of FIRE PB
// FCTM OP-020                : Engine fire after V1 — crew technique
// Airbus Golden Rules         : Fly · Navigate · Communicate

export const eng1FireAfterV1: Scenario = {
  meta: ENG1_FIRE_AFTER_V1_META,
  brief: {
    situation:
      "Departing runway 28 at New Delhi Indira Gandhi (VIDP). Two seconds after passing V1 at 145 kt, a MASTER WARNING fires and the ECAM displays ENG 1 FIRE. You are climbing through approximately 400 ft AGL with gear retracting.",
    job: "PF: Aviate — maintain V2+10, engage AP1, command ECAM ACTIONS. PM: Execute ECAM procedure in order. Both: LAND ASAP decision.",
  },

  // ── Timed system events ─────────────────────────────────────────────────────
  triggers: [
    {
      id: "after_v1",
      atMs: 6_000,
      description: "V1 passed — committed to takeoff, rotation in progress",
      effects: [],
    },
    {
      id: "fire_warn",
      atMs: 8_000,
      description: "ENG 1 FIRE — MASTER WARN, CRC, fire light on FIRE panel",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 FIRE" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "eng1_fire",    line: "ENG 1 FIRE",                         level: "warning" },
            { id: "land_asap",   line: "LAND ASAP",                           level: "warning" },
            { id: "ecam_thr",    line: "THR LEVER (ENG 1)......IDLE",         level: "caution" },
            { id: "ecam_master", line: "ENG 1 MASTER...........OFF",          level: "caution" },
            { id: "ecam_fire_pb",line: "ENG 1 FIRE P/B.........PUSH",         level: "caution" },
            { id: "ecam_agent1", line: "AGENT 1 AFTER 10 S....DISCH",         level: "caution" },
            // ATC NOTIFY removed from ECAM messages — handled via ATC distraction mechanic
          ],
        },
      ],
    },
    // FCTM OP-020: ECAM actions begin at 400 ft AGL — PM announces, PF commands
    {
      id: "four_hundred_ft",
      atMs: 18_000,
      description: "400 ft AGL — PM announces 'ECAM ACTIONS', procedure begins",
      effects: [
        {
          type: "ADD_ECAM",
          messages: [
            { id: "ecam_400ft", line: "400 FT — ECAM ACTIONS", level: "advisory" },
          ],
        },
      ],
    },
    // Minimum Acceleration Altitude — informational only, no ECAM message
    {
      id: "min_accel_alt",
      atMs: 55_000,
      description: "Minimum Acceleration Altitude ~1500 ft — level off, accelerate, clean",
      effects: [],
    },
  ],

  // ── Procedure steps ──────────────────────────────────────────────────────────
  steps: [
    // ══ AVIATE PHASE ══════════════════════════════════════════════════════════
    // PF keeps flying throughout. These steps run in parallel with glareshield.

    // ── AV1 ── PF continues rotation (flightcheck popup)
    {
      id: "continue_rotation",
      label: "CONTINUE ROTATION",
      action: "V2+10",
      hint: "PF maintains rotation — do NOT reduce thrust. Follow flight directors, target V2+10 kt on SRS guidance.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
    },

    // ── AV2 ── PM calls Positive Rate → PF commands Gear Up (flightcheck popup)
    {
      id: "positive_rate_gear_up",
      label: "POSITIVE RATE — GEAR UP",
      action: "CALL",
      hint: "PM calls 'POSITIVE RATE'. PF responds 'GEAR UP'. PM selects gear lever UP. Verify GEAR UP indication.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["continue_rotation"],
    },

    // ── AV3 ── PF engages AP1 at ~100 ft and reads FMA aloud (flightcheck popup)
    {
      id: "engage_ap_fma",
      label: "AP1 ENGAGE — READ FMA",
      action: "CONFIRM",
      hint: "PF: engage AP1 at ~100 ft (V2+10 stable). Read FMA aloud: 'SRS — NAV — AP1 ENGAGED'. Monitor A/THR active.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requires: ["positive_rate_gear_up"],
    },

    // ── G1 ── MASTER WARN cancel — after AP is engaged (aviate sequence complete)
    // FCTM OP-020: PF aviate first (rotation → gear up → AP1 engaged → read FMA),
    // THEN PM cancels CRC. AP engagement confirms aircraft is stable before any distraction.
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM pushes MASTER WARN glareshield light — silences CRC, resets red light. ECAM procedure remains displayed.",
      variant: "warning",
      crew: "PM",
      group: "glareshield",
      requires: ["engage_ap_fma"],
      afterEffect: {
        delayMs: 400,
        triggerId: "mw_cancelled",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
        ],
      },
    },

    // ── 400 FT GATE ── PM announces "ECAM ACTIONS" (flightcheck popup)
    // Only unlocks after aviate complete + MW cancelled.
    {
      id: "four_hundred_ft_cmd",
      label: "400 FT — ECAM ACTIONS",
      action: "ANNOUNCE",
      hint: "PM: 'ECAM ACTIONS' — PF acknowledges. Aviate complete and MW cancelled first.",
      variant: "advisory",
      group: "flightcheck",
      requires: ["cancel_master_warn", "engage_ap_fma"],
      crew: "PM",
    },

    // ── ECAM PROCEDURE ─────────────────────────────────────────────────────────
    // Sequential steps — each requires the previous. PM works through in order.

    // ── 1 ── FCOM: "THR LEVER (AFFECTED) → IDLE"
    {
      id: "thr_lever_idle",
      label: "THR LEVER 1",
      action: "IDLE",
      hint: "PM retards ENG 1 thrust lever to IDLE. Reduces thrust before fuel isolation.",
      variant: "switch",
      crew: "PM",
      ecamRef: "ecam_thr",
      requires: ["four_hundred_ft_cmd"],
    },

    // ── 2 ── FCOM: "ENG MASTER (AFFECTED) → OFF"
    // Airbus confirm-before-action: PM calls "ENG 1 MASTER, CONFIRM OFF?" → PF: "CONFIRM" → PM sets OFF.
    {
      id: "eng1_master_off",
      label: "ENG 1 MASTER",
      action: "OFF",
      hint: "PM: 'ENG 1 MASTER, CONFIRM OFF?' — PF: 'CONFIRM' — PM sets OFF. Closes LP + HP fuel shut-off valves.",
      variant: "switch",
      requires: ["thr_lever_idle"],
      crew: "PM",
      ecamRef: "ecam_master",
      confirmRequired: true,
    },

    // ── 3 ── FCOM: "ENG FIRE P/B (AFFECTED) → PUSH"
    // Airbus confirm-before-action: PM calls "ENG 1 FIRE P/B, CONFIRM PUSH?" → PF: "CONFIRM" → PM pushes.
    // Arms squibs · closes bleed + HYD fire SOV · cuts FADEC · deactivates IDG.
    {
      id: "eng1_fire_pb",
      label: "ENG 1 FIRE P/B",
      action: "PUSH",
      hint: "PM: 'ENG 1 FIRE P/B, CONFIRM PUSH?' — PF: 'CONFIRM' — PM pushes. Arms squibs, closes bleed + HYD SOV, cuts FADEC.",
      variant: "warning",
      requires: ["eng1_master_off"],
      crew: "PM",
      ecamRef: "ecam_fire_pb",
      confirmRequired: true,
      afterEffect: {
        // 2 s delay: secondary systems respond to FIRE PB isolation
        delayMs: 2_000,
        triggerId: "secondary_failures",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              // FCOM DSC-29: Green HYD engine pump lost (fire SOV closed)
              { id: "hyd_g_pump",      line: "HYD G ENG1 PUMP......LO PR",  level: "caution"  },
              // FCOM DSC-21: Pack 1 bleed air lost → single pack operation
              { id: "air_single_pack", line: "AIR SINGLE PACK OPER",         level: "advisory" },
              // FCOM DSC-24: IDG 1 deactivated → GEN 1 offline
              { id: "elec_gen1",       line: "ELEC GEN 1............OFF",    level: "caution"  },
            ],
          },
          // Secondary cautions re-illuminate MASTER CAUTION (amber)
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },

    // ── G2 ── MASTER CAUTION cancel — after secondary failures appear (glareshield)
    // FCOM: PM pushes MASTER CAUTION light → silences SC chime, resets amber light.
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM pushes MASTER CAUTION light — silences single-chime, resets amber light. Secondary cautions remain on ECAM.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      requires: ["eng1_fire_pb"],
      afterEffect: {
        delayMs: 300,
        triggerId: "mc_cancelled",
        effects: [
          { type: "SET_MASTER_CAUT", active: false },
        ],
      },
    },

    // ── 4 ── FCOM: "AGENT 1 AFTER 10 S → DISCH"
    // 10 s allows N1 to decay → reduces nacelle ventilation → higher agent concentration.
    {
      id: "agent1",
      label: "AGENT 1",
      action: "DISCH",
      hint: "PM waits ECAM 10 s countdown after FIRE pb — N1 decay maximises agent concentration. Then discharge.",
      variant: "caution",
      requires: ["eng1_fire_pb"],
      crew: "PM",
      ecamRef: "ecam_agent1",
      afterEffect: {
        // 25 s: nominal fire extinction (within the 30 s Agent 2 decision window)
        delayMs: 25_000,
        triggerId: "fire_extinguished",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
          { type: "SET_ALARM_LABEL", label: null },
          {
            type: "CLEAR_ECAM",
            // Clear fire warning + primary procedure lines.
            // Secondary failures (hyd_g_pump, air_single_pack, elec_gen1) persist on STATUS page.
            ids: ["eng1_fire", "land_asap", "ecam_thr", "ecam_master", "ecam_fire_pb", "ecam_agent1", "ecam_400ft", "ecam_maa"],
          },
        ],
      },
    },

    // ── 5 ── FCOM: "IF FIRE AFTER 30 S → AGENT 2 → DISCH" (conditional, optional)
    {
      id: "agent2",
      label: "AGENT 2",
      action: "DISCH",
      hint: "PM: only if FIRE light still on 30 s after Agent 1. Last bottle — no restart possible after.",
      variant: "caution",
      requires: ["agent1"],
      crew: "PM",
      optional: true,
    },

    // ── 6 ── FCTM: Level off at Minimum Acceleration Altitude (~1500 ft)
    {
      id: "level_off_maa",
      label: "LVL OFF MAA",
      action: "SELECT",
      hint: "PF: at MIN ACCEL ALT select OP CLB or LVL CHG. Hold speed, monitor SRS→CLB transition on FMA.",
      variant: "switch",
      requires: ["agent1"],
      crew: "PF",
    },

    // ── 7 ── FCTM: Accelerate through S speed, retract flaps to CLEAN
    {
      id: "accel_clean",
      label: "ACCEL / CLEAN",
      action: "CONFIRM",
      hint: "PF: at S speed retract FLAPS 1, then at green dot retract FLAPS 0. Verify CONFIG CLEAN on ECAM.",
      variant: "switch",
      requires: ["level_off_maa"],
      crew: "PF",
    },

    // ── CHCLM CROSSCHECK ──────────────────────────────────────────────────────
    // After ECAM actions complete: PM cross-checks with PF before proceeding.
    // This step GATES all subsequent CRM/comms actions — pilots cannot advance
    // until the ECAM crosscheck is verbally confirmed.
    {
      id: "crew_crosscheck",
      label: "ECAM CROSSCHECK",
      action: "CONFIRM",
      hint: "PM→PF: 'ECAM ACTIONS COMPLETE. AGENT 1 DISCHARGED. FIRE LIGHT [STATUS].' PF: 'CHECKED, MONITOR.'",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["agent1"],
    },

    // ── CRM CHECKLIST ────────────────────────────────────────────────────────────
    // These steps appear in the CRM Checklist panel, not CockpitControls.
    // ATC MAYDAY is declared via the ATC distraction calls (not a separate step here).
    // Sequence: Golden Rules → WX + LDG perf → NIS → PAX → OPS → Approach brief → Prep

    // ── CR0 ── Golden Rules — available from the start (no requires)
    {
      id: "golden_rules",
      label: "GOLDEN RULES",
      action: "CONFIRM",
      hint: "PF calls rules, PM responds CONFIRMED. Confirms crew is following Airbus priority sequence.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      notes: [
        "① FLY · NAVIGATE · COMMUNICATE — in this order, with appropriate tasksharing",
        "② Use APPROPRIATE AUTOMATION — pilot judgment prevails, including manual flight",
        "③ Understand your FMA — Monitor · Announce · Confirm · Understand",
        "④ Take ACTION if unexpected — PF changes automation / PM: Question · Challenge · Take-over",
      ],
    },

    // ── CR-OEB ── OEB Check — at STATUS, before post-ECAM actions
    // FCOM: at STATUS page, flight crew checks for applicable OEBs that modify procedure.
    {
      id: "oeb_check",
      label: "OEB CHECK",
      action: "CONFIRM",
      hint: "PM: check QRH OEB list for any applicable bulletin modifying ENG 1 FIRE procedure. If none applicable — state 'NO APPLICABLE OEB'. PF acknowledges.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_crosscheck"],
    },

    // ── CR1 ── WX / ATIS — requires CHCLM crosscheck complete
    {
      id: "wx_request",
      label: "WX / ATIS",
      action: "REQUEST",
      hint: "PM requests ATIS or direct from Delhi Approach: wind dir/speed, QNH, temp, vis, RVR RWY 28. Note contamination risk.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_crosscheck"],
    },

    // ── CR2 ── Landing distance — single-engine performance check
    {
      id: "ldg_perf",
      label: "LDG PERF",
      action: "CHECK",
      hint: "SE approach: Vapp +5 kt. RWY 28 VIDP LDA 4430 m / factored SE dist ~2200 m — ADEQUATE. Set Vapp + LW on MCDU.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_request"],
    },

    // ── CR2b ── FORDEC — structured decision after wx + performance confirmed
    // Airbus Threat & Error Management: FORDEC is the standard crew decision framework.
    {
      id: "fordec",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC discussion. PM cross-checks each element. Agree and commit to decision before proceeding.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["ldg_perf"],
      notes: [
        "F — FACTS: ENG 1 fire secured. Single engine. VIDP 15 min. RWY 28 LDA 4430 m. Full CFR on field.",
        "O — OPTIONS: ① Return VIDP RWY 28  ② Divert nearest alternate  ③ Continue (NOT viable)",
        "R — RISKS & BENEFITS: VIDP = known field, full CFR, adequate LDA. Divert = longer flight, unfamiliar.",
        "D — DECISION: LAND ASAP — return VIDP RWY 28 with full emergency declared.",
        "E — EXECUTION: ILS RWY 28, Cat 1, SE approach Vapp+5 kt, full emergency, CFR standing by.",
        "C — CHECK-BACK: PM confirms 'AGREED — LAND VIDP RWY 28, FULL EMERGENCY'",
      ],
    },

    // ── CR2c ── FMGC Preparation — enter diversion/arrival in MCDU
    {
      id: "fmgc_prep",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: enter VIDP in DEST, select RWY 28, insert ILS 110.30 / CRS 282. Set Vapp = Vref+5 kt (SE). Check F-PLN fuel + ALTN. PF confirms on MCDU.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
    },

    // ── CR3 ── NIS briefing — cabin crew via interphone (Nature · Intentions · Special instructions)
    // FCOM: cabin crew briefed AFTER decision is made so intentions are confirmed.
    {
      id: "nis_brief",
      label: "NIS BRIEF",
      action: "CONFIRM",
      hint: "Interphone — NATURE: engine fire, single engine. INTENTIONS: landing VIDP RWY 28. SPECIAL: brace for emergency, crew at stations.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
      notes: [
        "N — NATURE: 'Engine fire, ENG 1 shut down, returning to Delhi'",
        "I — INTENTIONS: 'Landing runway 28 VIDP, approximately 15 minutes'",
        "S — SPECIAL: 'Crew at stations. On brace command — BRACE BRACE BRACE'",
      ],
    },

    // ── CR4 ── Passenger PA — after NIS brief to cabin crew
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

    // ── CR5 ── Company OPS — ACARS / VHF (optional)
    {
      id: "company_notify",
      label: "OPS NOTIFY",
      action: "CONFIRM",
      hint: "ACARS or VHF: 'OPS, IFLY101, MAYDAY declared, ENG 1 FIRE, returning VIDP RWY 28, request CFR + ground support.'",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_crosscheck"],
      optional: true,
    },

    // ── CR5b ── Go-around review + fuel status — before approach phase
    {
      id: "go_around_review",
      label: "GO-AROUND REVIEW",
      action: "CONFIRM",
      hint: "PF briefs go-around plan and confirms fuel state is adequate for alternate if approach is missed.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fmgc_prep"],
      notes: [
        "GO-AROUND: TOGA (ENG 2 only) — SRS engages — positive rate GEAR UP — maintain V2+10",
        "FMA: TOGA → SRS / NAV / AP1 — monitor and call FMA at each transition",
        "FUEL CHECK: confirm total fuel vs [DEST + ALTN + FINAL RESERVE]. If marginal — LAND VIDP.",
        "RUNWAY VACATION: vacate via first available exit (Golf / Foxtrot). Brake to stop if needed.",
        "Emergency services attend runway — do NOT delay evacuation call if required.",
      ],
    },

    // ── CR5c ── Advise ATC of emergency services required
    {
      id: "atc_emergency_services",
      label: "ATC — EMERG SVCS",
      action: "ADVISE",
      hint: "PM advises ATC: 'IFLY101, request Category 3 emergency services on runway 28. Require CFR vehicles, ambulances, and medical standby.'",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["go_around_review"],
    },

    // ── CR6 ── Approach briefing — normal + non-normal, using STATUS page items
    {
      id: "approach_brief",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF briefs: ILS RWY 28 VIDP, single-engine CAT 1. DA 200 ft. Vapp +5 kt. Non-normal items from STATUS: APPR CAT 1, HYD GRN LO PR, GEN 1 INOP. Go-around briefed.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["atc_emergency_services"],
    },

    // ── CR7 ── Approach preparation — MCDU, radio, checklist
    {
      id: "approach_prep",
      label: "APPROACH PREP",
      action: "COMPLETE",
      hint: "PM: set ILS RWY 28 freq 110.30 / CRS 282. BARO minima 200 ft / QNH set. Autobrake MED. Spoilers ARM. Landing lights ON. Confirm seat belts.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["approach_brief"],
    },

    // ── APPROACH CHECKLIST ──────────────────────────────────────────────────
    {
      id: "approach_cl",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs approach checklist. Call each item, PF cross-checks and responds. Complete before top of descent.",
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
        "APPROACH USING HIGHEST LEVEL OF AUTOMATION",
      ],
    },

    // ── LANDING CHECKLIST ───────────────────────────────────────────────────
    {
      id: "landing_cl",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs landing checklist at 1000 ft on final. PF confirms each item. Cross-check standard callouts throughout approach.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_cl"],
      notes: [
        "GEAR ................. DOWN — 3 GREEN",
        "FLAPS ................ FULL (or as required)",
        "SPOILERS ............. ARM (green)",
        "AUTOBRAKE ............ MED (SET)",
        "CABIN ................ ADVISED",
        "STANDARD CALLOUTS: 1000 ft / 500 ft / 100 ft / 50-40-30-20-10 RETARD",
      ],
    },
  ],

  // ── Status page ─────────────────────────────────────────────────────────────
  // Shown after all required ECAM actions are complete (FCOM STATUS page logic).
  // Reflects systems degraded by ENG 1 shutdown + FIRE PB isolation.
  statusItems: [
    { id: "st_eng1",    line: "ENG 1....................INOP",      severity: "caution"  },
    { id: "st_hyd",     line: "HYD GRN ENG1 PUMP.....LO PR",       severity: "caution"  },
    { id: "st_air",     line: "AIR SINGLE PACK OPER",               severity: "advisory" },
    { id: "st_elec",    line: "ELEC GEN 1...............INOP",      severity: "caution"  },
    { id: "st_appr",    line: "APPR CAT.................CAT 1",     severity: "advisory" },
    { id: "st_maxfl",   line: "MAX FL.....................FL250",    severity: "memo"     },
  ],

  // ── Distractions — ATC only ─────────────────────────────────────────────────
  // ATC calls arrive mid-procedure as genuine distractions.
  // Pilot may respond "Stand By" — the call will resurface after standbyResurfaceMs.
  // They must eventually declare MAYDAY and complete the full ATC sequence.
  distractions: [
    // ① T+28s — ATC radar contact (fires only after 400 ft gate passed)
    {
      id: "atc_heading_check",
      atMs: 28_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message:
        "IFLY101, radar contact. Confirm maintaining runway heading 280.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, engine fire, maintaining 280, MAYDAY", correct: true  },
        { id: "b", label: "Affirm, maintaining 280",                                              correct: false },
      ],
    },

    // ② T+40s — ATC requesting intentions (clean, realistic)
    {
      id: "atc_intentions",
      atMs: 40_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message:
        "IFLY101, state your intentions.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101 — returning VIDP, request immediate approach runway 28, full emergency", correct: true  },
        { id: "b", label: "IFLY101 continuing to destination",                                                      correct: false },
      ],
    },

    // ③ T+98s — ATC clears for immediate return
    {
      id: "atc_final_decision",
      atMs: 98_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message:
        "IFLY101, runway 28 clear for immediate return. Confirm souls on board and fuel.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, runway 28, 186 POB, 8.4 tonnes fuel, CFR required", correct: true  },
        { id: "b", label: "IFLY101 requesting runway 10 instead",                               correct: false },
        { id: "c", label: "IFLY101 no CFR required",                                            correct: false },
      ],
    },
  ],

  // ── Strategic decisions ─────────────────────────────────────────────────────
  decisions: [
    {
      value: "LAND_ASAP",
      label: "LAND ASAP",
      description:
        "Land at the nearest suitable aerodrome with full emergency fire services available. FCOM directive for a confirmed engine fire.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description:
        "Return to VIDP — valid if it is the nearest suitable option. Runway 28 LDA 4430 m is more than adequate for single-engine landing.",
      tone: "primary",
    },
    {
      value: "DIVERT",
      label: "DIVERT",
      description:
        "Divert to a planned alternate — only justified if it is genuinely closer than the departure field.",
      tone: "secondary",
    },
    {
      value: "CONTINUE",
      label: "CONTINUE",
      description:
        "Press on to destination. Not appropriate — engine is shut down, single-engine flight to destination cannot be justified.",
      tone: "danger",
    },
  ],
};
