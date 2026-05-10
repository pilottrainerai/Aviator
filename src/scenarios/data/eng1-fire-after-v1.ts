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

    // ── G1 ── MASTER WARN cancel — available any time after the CRC fires
    // FCOM: the MASTER WARN pushlight can be pressed at any time to silence the CRC.
    // No prerequisite — the glareshield light is always pressable once it illuminates.
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM cancels MASTER WARN FIRST — pushes glareshield light to silence CRC and reset the red light. ECAM procedure stays displayed. Aviate continues; no ECAM actions until 400 ft and flight path stabilised.",
      variant: "warning",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: [],
      afterEffect: {
        delayMs: 400,
        triggerId: "mw_cancelled",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
        ],
      },
    },

    // ── 400 FT GATE ── AVIATE complete → NAVIGATE SID/EO → "ECAM ACTIONS"
    // FCTM Golden Rules: 400 ft AGL gates the start of ECAM.  Aviate + flight
    // path stabilised must come first; Master Warning cancelled.  PM then
    // announces "AVIATE COMPLETE, NAVIGATE SID/EO PROCEDURE" and PF orders
    // "ECAM ACTIONS".
    {
      id: "four_hundred_ft_cmd",
      label: "400 FT — AVIATE COMPLETE, ECAM ACTIONS",
      action: "ANNOUNCE",
      hint: "At 400 ft AGL with flight path stabilised, PM announces 'AVIATE COMPLETE, NAVIGATE SID OR EO PROCEDURE'. PF orders 'ECAM ACTIONS'. Master Warning must be cancelled first.",
      variant: "advisory",
      group: "flightcheck",
      requires: ["engage_ap_fma", "cancel_master_warn"],
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
      hardware: true,
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
      hardware: true,
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
      hardware: true,
      ecamRef: "ecam_fire_pb",
      confirmRequired: true,
      afterEffect: {
        // 2 s delay: secondary systems respond to FIRE PB isolation
        // FCOM DSC-31-15: secondary failures appear on E/WD right column with * prefix.
        // Removed the SECONDARY FAILURES header and itemised lines from ECAM at user
        // request; the consequences are still surfaced via tab alerts and STATUS page.
        delayMs: 2_000,
        triggerId: "secondary_failures",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "sec_hyd",       line: "* HYD",               level: "caution"  },
              { id: "sec_elec",      line: "* ELEC",              level: "caution"  },
              { id: "sec_air_bleed", line: "* AIR BLEED",         level: "caution"  },
            ],
          },
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },

    // ── G2 ── MASTER CAUTION cancel — available any time after the SC chime fires
    // FCOM: the MASTER CAUTION pushlight can be pressed at any time to silence the SC chime.
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM pushes MASTER CAUTION light — silences single-chime, resets amber light. Secondary cautions remain on ECAM.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: [],
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
      hardware: true,
      ecamRef: "ecam_agent1",
      afterEffect: {
        // 25 s after Agent 1: silence the warning + clear the primary procedure
        // lines so the crew can proceed with the rest of the procedure. The
        // fire visual indicators (FIRE pb red, FIRE light on master, ENG ✕)
        // STAY LIT until both agents are discharged (training-driven choice —
        // FCOM behaviour would extinguish here in the typical case).
        delayMs: 25_000,
        triggerId: "primary_ecam_cleared",
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

    // ── 5 ── Both-agent rule: fire only extinguishes after AGENT 2 is also
    // discharged (training simplification — forces the crew to complete the
    // full bottle sequence). Per strict FCOM, Agent 2 is optional and only
    // used if fire persists 30 s after Agent 1.
    {
      id: "agent2",
      label: "AGENT 2",
      action: "DISCH",
      hint: "PM: discharge AGENT 2 to fully extinguish the fire. Last bottle — no restart possible after.",
      variant: "caution",
      requires: ["agent1"],
      crew: "PM",
      hardware: true,
      afterEffect: {
        // 5 s: bottle discharges, fire dies out, FIRE pb red light goes off,
        // FIRE light on master panel goes off, ENG ✕ marker clears.
        delayMs: 5_000,
        triggerId: "fire_extinguished",
        effects: [],
      },
    },

    // ── 5b ── ENGINE SECURED — PM announce per FCTM
    // FCTM line 12852: "An engine is considered as secured when the ECAM
    // actions of the procedures are performed until […] Fire extinguished or
    // 'AGENT 2 DISCH' for an engine fire."  The fire_extinguished trigger
    // fires 5 s after AGENT 2 (fire pb red light + ENG MASTER FIRE light
    // both go off); PM then announces "ENGINE SECURED" and the crew may
    // proceed with the acceleration sequence (level off MAA → S speed →
    // clean).  Per FCTM line 12848 the flight crew must DELAY the
    // acceleration until the engine is secured.
    {
      id: "engine_secured",
      label: "ENGINE SECURED",
      action: "ANNOUNCE",
      hint: "After AGENT 2 discharge and fire extinguishes (FIRE pb red light + ENG MASTER FIRE light go off), PM announces 'ENGINE SECURED'. PF acknowledges. Engine is now secured per FCTM (12852).",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["agent2"],
    },

    // ── 6 ── FCTM AOP-30-30: at minimum acceleration altitude (MAA), PF
    // PUSHES the V/S knob to set V/S 0 — levels off the aircraft so the crew
    // can accelerate and clean up the configuration while still single-engine.
    // SRS automatically reverts to CLB / OP CLB when the new altitude is
    // captured, but the level-off command is V/S 0 (not OP CLB).  Acceleration
    // is delayed until the engine is secured (FCTM 12848) — hence requires
    // engine_secured.
    {
      id: "level_off_maa",
      label: "V/S 0 AT MAA",
      action: "SELECT",
      hint: "PF: at minimum acceleration altitude PUSH V/S knob → V/S 0. Aircraft levels off, A/THR maintains target speed; SRS reverts as the level-off captures. Begin accel + flap retraction.",
      variant: "switch",
      requires: ["engine_secured"],
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

    // ── POST-ECAM SEQUENCE — FCTM AOP-30-30 (lines 2759-2810) ────────────────
    // The strict order per FCTM is:
    //   1. (Primary ECAM lines cleared)
    //   2. Secondary failures announced (HYD / ELEC / AIR BLEED)
    //   3. PM announces "STATUS" when STATUS page appears
    //   4. PF orders "STOP ECAM" — ECAM actions stopped
    //   5. After Takeoff CL, OEB, system reset (as applicable)
    //   6. STATUS — READ by PF (includes INOP SYS in red)
    //   7. PM: "REMOVE STATUS?" — PF: "CONFIRM" — PM: STS pb PRESS
    //   8. PM announces "ECAM ACTIONS COMPLETE"
    //
    // We model this as a chain of steps gated on the previous one so the
    // crew goes through them in order.

    // ── 1 ── Announce secondary failures (just what the ECAM shows)
    {
      id: "announce_sec_failures",
      label: "SEC FAIL ANNOUNCE",
      action: "ANNOUNCE",
      hint: "PM reads what's affected on the ECAM secondary failures column and announces: 'HYD …, ELEC …, AIR BLEED …'. PF acknowledges.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["engine_secured"],
      notes: [
        // Affected systems after ENG 1 FIRE pb push + AGENT 1 — draft list,
        // refine as scenario logic is firmed up.
        "HYD — GREEN system LO PR. ENG 1 pump SOV closed by FIRE pb. PTU may transfer YELLOW → GREEN.",
        "ELEC — GEN 1 LOST. IDG 1 deactivated by FIRE pb. AC BUS 1 powered via BUS TIE from GEN 2 (or APU GEN if started).",
        "AIR BLEED — BLEED 1 LOST. ENG 1 bleed SOV closed by FIRE pb. PACK 1 SHUT DOWN; X-BLEED may auto-open to feed PACK 1 from BLEED 2.",
      ],
    },

    // ── 2 ── Announce STATUS page
    {
      id: "announce_status",
      label: "STATUS — ANNOUNCE",
      action: "ANNOUNCE",
      hint: "When STATUS page appears: PM announces 'STATUS' to indicate the ECAM has reached the STATUS phase.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["announce_sec_failures"],
    },

    // ── 3 ── STOP ECAM — PF orders, PM stops
    {
      id: "stop_ecam",
      label: "STOP ECAM",
      action: "ORDER",
      hint: "PF: 'STOP ECAM' — PM stops ECAM actions. PF asks for After Takeoff Checklist, any computer resets, and any OEB review before reading STATUS.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["announce_status"],
    },

    // ── 4 ── After Takeoff Checklist (normal CL)
    {
      id: "after_takeoff_cl",
      label: "AFTER TAKEOFF CL",
      action: "COMPLETE",
      hint: "PM runs After Takeoff CL: gear UP, flaps UP, spoilers DISARM, packs ON. FCTM: 'good compromise between necessary ECAM application and system analysis vs delay in system status check.'",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["stop_ecam"],
    },

    // ── CRM CHECKLIST ────────────────────────────────────────────────────────────
    // These steps appear in the CRM Checklist panel, not CockpitControls.
    // ATC MAYDAY is declared via the ATC distraction calls (not a separate step here).
    // Sequence: Golden Rules → WX + LDG perf → NIS → PAX → OPS → Approach brief → Prep

    // ── 5 ── OEB / Computer Reset check — between After Takeoff CL and STATUS read
    // FCTM: at this stage the crew considers any system reset per QRH reset
    // table (e.g. successful reset → STATUS page disappears).  Also reviews
    // QRH OEB list for any applicable bulletin modifying the procedure.
    {
      id: "oeb_check",
      label: "OEB / RESET CHECK",
      action: "CONFIRM",
      hint: "PM: review QRH OEB list and consider any applicable system reset per QRH reset table. Don't apply system resets from memory. If none applicable — 'NO APPLICABLE OEB OR RESET.' PF acknowledges.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["after_takeoff_cl"],
    },

    // ── 6 ── STATUS — READ (PF reads the STATUS page)
    {
      id: "read_status",
      label: "STATUS — READ",
      action: "READ",
      hint: "PF reads the STATUS page line by line — APPR PROC (any conditional procedure), INOP SYS in red (CAT 3, BLUE HYD…), and any associated SE approach notes. Preview procedures to evaluate workload.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["oeb_check"],
      notes: [
        "Reference: QRH ABNORMAL — ONE ENG INOPERATIVE supplementary procedure (apply after ECAM is complete for SE flight management — drift-down, perf, fuel).",
        "Reference: QRH ABNORMAL — ONE ENG INOPERATIVE LANDING procedure (apply during approach planning — Vapp computation, flap setting, autobrake, autoland eligibility, go-around).",
      ],
    },

    // ── 7 ── ECAM ACTIONS COMPLETE — final announce by PM
    // FCTM: after STATUS read, PM "REMOVE STATUS?" / PF "CONFIRM" / PM STS pb
    // PRESS, then PM announces "ECAM ACTIONS COMPLETE."  Modelled here as a
    // single confirmation step.
    {
      id: "crew_crosscheck",
      label: "ECAM ACTIONS COMPLETE",
      action: "ANNOUNCE",
      hint: "PM 'REMOVE STATUS?' — PF 'CONFIRM' — PM presses STS pb. PM announces 'ECAM ACTIONS COMPLETE.'",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["read_status"],
    },

    // ── CR1 ── WX / ATIS — requires CHCLM crosscheck complete
    {
      id: "wx_request",
      label: "WX / ATIS",
      action: "REQUEST",
      hint: "PM requests latest weather from Delhi Approach: wind dir/speed, QNH, temp, vis, RVR RWY 28.",
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

    // ── CR3 ── NITS briefing — cabin crew via interphone (Nature · Intentions · Time · Special)
    // FCOM: cabin crew briefed AFTER decision is made so intentions and time are confirmed.
    {
      id: "nis_brief",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "Interphone to SCCM — NATURE: engine fire, ENG 1 shut down. INTENTIONS: landing VIDP RWY 28. TIME: approx 15 min. SPECIAL: precautionary or emergency landing per Captain's decision.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
      notes: [
        "N — NATURE: 'Engine fire, ENG 1 shut down, aircraft serviceable'",
        "I — INTENTIONS: 'Returning and landing runway 28 Delhi VIDP'",
        "T — TIME: 'Approximately 15 minutes to landing'",
        "S — SPECIAL: 'Crew at stations. Precautionary or emergency landing per Captain's decision.'",
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

    // ── CR5b ── Approach preparation — set up MCDU / radios / autobrake
    // (FCOM SOP: prep BEFORE the briefing, so the briefing can reference
    // the configured PERF / approach data.)
    {
      id: "approach_prep",
      label: "APPROACH PREP",
      action: "COMPLETE",
      hint: "PM: set ILS RWY 28 freq 110.30 / CRS 282. BARO minima 200 ft / QNH set. Autobrake MED. Spoilers ARM. Landing lights ON. Confirm seat belts.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fmgc_prep"],
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
      requires: ["approach_prep"],
    },

    // ── CR6 ── Approach briefing — normal + non-normal, using STATUS page items.
    // Go-around plan is briefed as PART of this step (see go_around_review below
    // which is a continuation of the briefing flow).
    {
      id: "approach_brief",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF briefs: ILS RWY 28 VIDP, single-engine CAT 1. DA 200 ft. Vapp +5 kt. Non-normal items from STATUS: APPR CAT 1, HYD GRN LO PR, GEN 1 INOP. Go-around briefed. Reference QRH ONE ENG INOPERATIVE LANDING procedure.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["atc_emergency_services"],
      notes: [
        "Reference: QRH ABNORMAL — ONE ENG INOPERATIVE LANDING (Vapp, flap setting, autobrake, autoland eligibility, EO go-around).",
      ],
    },

    // ── CR6b ── Go-around review — DURING the approach briefing.
    // FCOM SOP: GA plan + fuel cross-check is briefed as part of approach
    // brief, not as a separate pre-briefing item.
    {
      id: "go_around_review",
      label: "GO-AROUND REVIEW",
      action: "CONFIRM",
      hint: "PF briefs go-around plan and confirms fuel state is adequate for alternate if approach is missed.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["approach_brief"],
      notes: [
        "GO-AROUND: TOGA (ENG 2 only) — SRS engages — positive rate GEAR UP — maintain V2+10",
        "FMA: TOGA → SRS / NAV / AP1 — monitor and call FMA at each transition",
        "FUEL CHECK: confirm total fuel vs [DEST + ALTN + FINAL RESERVE]. If marginal — LAND VIDP.",
        "RUNWAY VACATION: vacate via first available exit (Golf / Foxtrot). Brake to stop if needed.",
        "Emergency services attend runway — do NOT delay evacuation call if required.",
      ],
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
      requires: ["go_around_review"],
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
  // FCOM PRO-ABN-ENG p.39-42: ENG SHUT DOWN STATUS page after ENG FIRE PB pushed.
  statusItems: [
    // ── Left column: limitations & directives ────────────────────────────────
    { id: "st_eng1",       line: "ENG 1 SHUT DOWN",                severity: "caution"  },
    { id: "st_avoid_ice",  line: "AVOID ICING CONDITIONS",          severity: "caution"  },
    { id: "st_appr",       line: "APPR CAT . . . . CAT 1",         severity: "advisory" },
    { id: "st_ldg_dist",   line: "LDG DIST PROC . . . . APPLY",    severity: "caution"  },
    { id: "st_fuel_incr",  line: "FUEL CONSUMPT INCRSD",            severity: "advisory" },
    { id: "st_fms",        line: "FMS PRED UNRELIABLE",              severity: "advisory" },
    // ── Right column: INOP SYS ───────────────────────────────────────────────
    { id: "st_inop_cat3",  line: "CAT 3 DUAL",     severity: "advisory", inopSys: true },
    { id: "st_inop_bleed", line: "ENG 1 BLEED",    severity: "caution",  inopSys: true },
    { id: "st_inop_pack",  line: "PACK 1",          severity: "caution",  inopSys: true },
    { id: "st_inop_galley",line: "MAIN GALLEY",     severity: "memo",     inopSys: true },
    { id: "st_inop_gen",   line: "GEN 1",           severity: "caution",  inopSys: true },
    { id: "st_inop_pump",  line: "G ENG 1 PUMP",    severity: "caution",  inopSys: true },
    { id: "st_inop_ice",   line: "WING A. ICE",     severity: "caution",  inopSys: true },
    { id: "st_inop_steep", line: "STEEP APPR",      severity: "advisory", inopSys: true },
  ],

  // ── Distractions — FCOM-realistic ATC sequence ─────────────────────────────
  // Realism rule: during the high-workload phase (initial MAYDAY through ECAM
  // completion) the crew sticks to "STANDBY / CONTINUING CHECKLIST" responses.
  // ATC reciprocally avoids POB/fuel/intent questions until the workload eases.
  // Only AFTER checklists + performance + decision making does the crew advise
  // intentions and accept the operational interrogation.
  //
  // Use of STANDBY: most calls during the early phase have STANDBY (system pb)
  // as a *correct* discipline.  A correct = "standby" run still scores well —
  // resurface delays simulate ATC giving the crew room.
  distractions: [
    // ① Tower → Departure handoff (low workload, just before fire)
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
      ],
    },

    // ② Initial MAYDAY — BRIEF, essential info only.  No runway, no intentions.
    {
      id: "atc_radar_contact_mayday",
      atMs: 42_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, Delhi Departure, radar contact.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — short, no premature commitments
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, engine fire engine 1, maintaining runway track, climbing 3 000 feet, standby", correct: true  },
        // Wrong — over-committal during high workload
        { id: "b", label: "MAYDAY IFLY101, engine fire, returning immediate, request runway 28 ILS, full emergency",                     correct: false },
        // Wrong — under-informative (no MAYDAY)
        { id: "c", label: "Maintaining runway track, climbing 3 000, IFLY101",                                                            correct: false },
      ],
    },

    // ③ ATC acknowledges + provides vectors/altitude — NO questions during workload
    {
      id: "atc_vectors_climb",
      atMs: 70_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, roger MAYDAY, radar contact, continue runway track, climb 4 000 feet, standing by for your call.",
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
        // Also valid — but the system STANDBY button is the cleaner response here
        { id: "b", label: "Unable at this time, IFLY101",                                     correct: true  },
        // Wrong — premature commitment
        { id: "c", label: "IFLY101 returning Delhi, request runway 28 ILS",                   correct: false },
      ],
    },

    // ⑤ Workload eased — ATC asks for ready (post-ECAM, post-decision)
    {
      id: "atc_advise_when_ready",
      atMs: 150_000,
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, advise when ready.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — pilot now informs INTENTION (no POB yet — ATC will ask)
        { id: "a", label: "IFLY101, fire extinguished, returning Delhi, request vectors for ILS runway 28", correct: true  },
        // Wrong — too narrow, doesn't include decision context
        { id: "b", label: "IFLY101 ready",                                                     correct: false },
      ],
    },

    // ⑥ NOW ATC asks the operational questions (POB / fuel / services)
    {
      id: "atc_pob_fuel_services",
      atMs: 180_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, roger, vectors runway 28 ILS, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY101, 186 persons on board, 8.4 tonnes fuel, endurance 3 hours, request full emergency services on the runway", correct: true  },
        { id: "b", label: "Standby IFLY101",                                                                                                   correct: false },
      ],
    },

    // ⑦ ATC clears for approach + tower handoff
    {
      id: "atc_cleared_approach",
      atMs: 210_000,
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, cleared for the ILS approach runway 28, contact Delhi Tower 118.10 when established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Cleared for the ILS runway 28, contact Tower 118.10 when established, IFLY101", correct: true  },
        { id: "b", label: "Roger, IFLY101",                                                                  correct: false },
      ],
    },

    // ⑧ Tower contact
    {
      id: "atc_tower_contact",
      atMs: 235_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, Delhi Tower, continue ILS approach runway 28, report established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 28, will report established, IFLY101",      correct: true  },
        { id: "b", label: "Switching, IFLY101",                                                correct: false },
      ],
    },

    // ⑨ Landing clearance — readback required
    {
      id: "atc_cleared_to_land",
      atMs: 260_000,
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, runway 28 cleared to land, wind 280 at 8, emergency services in position.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Cleared to land runway 28, IFLY101",                                correct: true  },
        { id: "b", label: "Roger, IFLY101",                                                    correct: false },
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

  // ── Engine Display DSL ───────────────────────────────────────────────────────
  engineDisplay: {
    warningTrigger: "fire_warn",
    controlPanel: [
      { stepId: "thr_lever_idle",  kind: "thr_lever", label: "THR LVR",  sub: "IDLE"    },
      { stepId: "eng1_master_off", kind: "master",    label: "MASTER",   sub: "ENG 1"   },
      { stepId: "eng1_fire_pb",    kind: "fire_pb",   label: "ENG 1",    sub: "FIRE PB" },
      { stepId: "agent1",          kind: "agent",     label: "AGENT 1",  sub: "DISCH"   },
      { stepId: "agent2",          kind: "agent",     label: "AGENT 2",  sub: "DISCH"   },
    ],
    eng1: {
      rows: [
        {
          label: "THR LVR", unit: undefined,
          states: [
            { when: { step: "thr_lever_idle" }, value: { v: "IDLE", c: "green" } },
            { when: { trigger: "fire_warn" },   value: { v: "MCT/FLX", c: "amber" } },
            { value: { v: "CLB", c: "green" } },
          ],
        },
        {
          label: "N1", unit: "%",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "0.0", c: "amber" } },
            { when: { trigger: "fire_warn" },    value: { v: "- -", c: "red" } },
            { value: { v: "84.2", c: "green" } },
          ],
        },
        {
          label: "EGT", unit: "°C",
          states: [
            { when: { step: "eng1_fire_pb" },  value: { v: "180", c: "amber" } },
            { when: { trigger: "fire_warn" },  value: { v: "820", c: "red" } },
            { value: { v: "620", c: "green" } },
          ],
        },
        {
          label: "FF", unit: "KG/H",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "0", c: "amber" } },
            { when: { trigger: "fire_warn" },    value: { v: "0", c: "red" } },
            { value: { v: "2400", c: "green" } },
          ],
        },
        {
          label: "STATUS", unit: undefined,
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "SHUT DOWN", c: "amber" } },
            { when: { trigger: "fire_warn" },    value: { v: "FIRE", c: "red" } },
            { value: { v: "NORMAL", c: "green" } },
          ],
        },
      ],
    },
    eng2: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.2", c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "618",  c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "2350", c: "green" } }] },
        { label: "STATUS", unit: undefined, states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
  },

  // ── System Display DSL (4 tabs: ENG, HYD, ELEC, AIR) ────────────────────────
  systemTabs: [
    // ── ENG tab ───────────────────────────────────────────────────────────────
    {
      id: "eng", label: "ENG",
      alertStates: [{ when: { trigger: "fire_warn" }, value: true }, { value: false }],
      autoSelect: { trigger: "fire_warn" },
      sections: [
        {
          title: "ENG 1",
          colorStates: [
            { when: { trigger: "fire_warn" }, value: "red" },
            { value: "dim" },
          ],
          rows: [
            {
              label: "THR LVR",
              states: [
                { when: { step: "thr_lever_idle" }, value: { v: "IDLE", c: "green" } },
                { when: { trigger: "fire_warn" },   value: { v: "MCT/FLX", c: "amber" } },
                { value: { v: "CLB", c: "green" } },
              ],
            },
            {
              label: "N1", unit: "%",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "0.0", c: "amber" } },
                { when: { trigger: "fire_warn" },    value: { v: "- -", c: "red" } },
                { value: { v: "84.2", c: "green" } },
              ],
            },
            {
              label: "EGT", unit: "°C",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "180", c: "amber" } },
                { when: { trigger: "fire_warn" }, value: { v: "820", c: "red" } },
                { value: { v: "620", c: "green" } },
              ],
            },
            {
              label: "FF", unit: "KG/H",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "0", c: "amber" } },
                { when: { trigger: "fire_warn" },    value: { v: "0", c: "red" } },
                { value: { v: "2400", c: "green" } },
              ],
            },
            {
              label: "STATUS",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "SHUT DOWN", c: "amber" } },
                { when: { trigger: "fire_warn" },    value: { v: "FIRE", c: "red" } },
                { value: { v: "NORMAL", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "ENG 2",
          colorStates: [{ value: "dim" }],
          rows: [
            { label: "N1",     unit: "%",    states: [{ value: { v: "84.2", c: "green" } }] },
            { label: "EGT",    unit: "°C",   states: [{ value: { v: "618",  c: "green" } }] },
            { label: "FF",     unit: "KG/H", states: [{ value: { v: "2350", c: "green" } }] },
            { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ENG + FIRE PANEL",
        note: "Step 2: MASTER OFF (fuel SOV + oil SOV close). Step 3: FIRE PB → HYD/bleed/IDG SOVs + fuel shutoff. Steps 4-5: AGENT 1 → AGENT 2 if fire persists (30 s each)",
        switches: [
          {
            label: "MASTER", sub: "ENG 1",
            states: [
              { when: { step: "eng1_master_off" }, value: "off" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "FIRE PB", sub: "ENG 1",
            states: [
              { when: { step: "eng1_fire_pb" },   value: "off"  as const },
              { when: { trigger: "fire_warn" },    value: "fire" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "AGENT 1", sub: "DISCH",
            states: [
              { when: { step: "agent1" },          value: "off"   as const },
              { when: { step: "eng1_fire_pb" },    value: "armed" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "AGENT 2", sub: "DISCH",
            states: [
              { when: { step: "agent2" },          value: "off"   as const },
              { when: { step: "agent1" },          value: "armed" as const },
              { value: "norm" as const },
            ],
          },
        ],
      },
    },

    // ── HYD tab ───────────────────────────────────────────────────────────────
    {
      id: "hyd", label: "HYD",
      alertStates: [{ when: { step: "eng1_fire_pb" }, value: true }, { value: false }],
      autoSelect: { step: "eng1_fire_pb" },
      sections: [
        {
          title: "GREEN SYS",
          colorStates: [
            { when: { step: "eng1_fire_pb" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "ENG 1 PUMP",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "LO PR", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            {
              label: "PRESSURE", unit: "PSI",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "LO PR", c: "amber" } },
                { value: { v: "3000", c: "green" } },
              ],
            },
            { label: "RESERVOIR", states: [{ value: { v: "NORM", c: "green" } }] },
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
        title: "HYD PANEL — AFFECTED",
        note: "FCOM DSC-29-10: FIRE PB closes green HYD fire SOV → GRN ENG 1 pump shows LO PR (FAULT). Blue ELEC pump auto-activates → maintains brakes, NW steering, spoilers. No crew action required.",
        switches: [
          {
            label: "GRN", sub: "ENG1 PMP",
            states: [
              { when: { step: "eng1_fire_pb" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BLU", sub: "ELEC PMP", states: [{ value: "auto" as const }] },
        ],
      },
    },

    // ── ELEC tab ──────────────────────────────────────────────────────────────
    {
      id: "elec", label: "ELEC",
      alertStates: [{ when: { step: "eng1_fire_pb" }, value: true }, { value: false }],
      sections: [
        {
          title: "AC NETWORK",
          colorStates: [
            { when: { step: "eng1_fire_pb" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "GEN 1",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "FAULT / OFF", c: "amber" } },
                { value: { v: "ON", c: "green" } },
              ],
            },
            { label: "GEN 2", states: [{ value: { v: "ON — NORM", c: "green" } }] },
            {
              label: "AC BUS 1",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "← GEN 2 (BTC)", c: "amber" } },
                { value: { v: "GEN 1", c: "green" } },
              ],
            },
            { label: "AC BUS 2", states: [{ value: { v: "GEN 2", c: "green" } }] },
            {
              label: "BUS TIE",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "CLOSED (AUTO)", c: "cyan" } },
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
                { when: { step: "eng1_fire_pb" }, value: { v: "FAULT", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "TR 2",   states: [{ value: { v: "NORM", c: "green" } }] },
            {
              label: "ESS TR",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "AUTO (ALTN)", c: "cyan" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "BAT 1/2", states: [{ value: { v: "AUTO", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ELEC PANEL — AFFECTED",
        note: "FCOM DSC-24-10: FIRE PB disconnects IDG 1 → GEN 1 FAULT/OFF. Bus Tie Contactor (sw in AUTO) auto-closes → AC BUS 1 now fed by GEN 2. TR 1 may show FAULT; ESS TR switches to ALTN supply. No crew action required.",
        switches: [
          {
            label: "GEN 1", sub: "IDG 1",
            states: [
              { when: { step: "eng1_fire_pb" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BUS TIE", sub: "CONTCTR", states: [{ value: "auto" as const }] },
        ],
      },
    },

    // ── AIR tab ───────────────────────────────────────────────────────────────
    {
      id: "air", label: "AIR",
      alertStates: [{ when: { step: "eng1_fire_pb" }, value: true }, { value: false }],
      sections: [
        {
          title: "BLEED",
          colorStates: [
            { when: { step: "eng1_fire_pb" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "ENG 1 BLEED",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "FAULT (SOV CL)", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "ENG 2 BLEED", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "X BLEED",     states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "APU BLEED",   states: [{ value: { v: "OFF",  c: "dim"   } }] },
          ],
        },
        {
          title: "PACKS",
          colorStates: [
            { when: { step: "eng1_fire_pb" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "PACK 1",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "FAULT / OFF", c: "amber" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            { label: "PACK 2",    states: [{ value: { v: "AUTO — NORM", c: "green" } }] },
            { label: "CABIN ΔP",  states: [{ value: { v: "NORM",        c: "green" } }] },
            {
              label: "DUCT TEMP",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "PACK 2 ONLY", c: "cyan" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "AIR PANEL — AFFECTED",
        note: "FCOM DSC-21-10: FIRE PB closes bleed SOV → ENG 1 BLEED FAULT. PACK 1 loses bleed supply → FAULT/OFF. X BLEED stays AUTO (closed) — PACK 2 uses ENG 2 bleed only (single pack ops). Cabin ΔP maintained by PACK 2.",
        switches: [
          {
            label: "ENG 1", sub: "BLEED",
            states: [
              { when: { step: "eng1_fire_pb" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "PACK 1", sub: "FLOW",
            states: [
              { when: { step: "eng1_fire_pb" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "X BLEED", sub: "SEL", states: [{ value: "auto" as const }] },
        ],
      },
    },
  ],
};
