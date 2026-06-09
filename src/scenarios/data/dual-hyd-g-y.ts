import type { Scenario } from "@/scenarios/types";
import { DUAL_HYD_G_Y_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-HYD p.21  : DUAL HYD G+Y LO PR — in-flight procedure
// FCOM DSC-29            : Hydraulic system architecture
// FCTM ABN-020           : Hydraulic failure technique

export const dualHydGY: Scenario = {
  meta: DUAL_HYD_G_Y_META,
  brief: {
    situation:
      "Cruise FL350, VIDP–VABB. A turbine blade release has damaged both GREEN and YELLOW hydraulic return lines simultaneously — system pressure on both circuits drops below 1 450 PSI. HYD G+Y SYS LO PR warning fires (Level 3, red, CRC). Both engines and AC buses remain normal — BLUE system continues on its ELEC pump (RAT NOT deployed for pure G+Y loss). F/CTL reverts to ALTERNATE LAW (PROT LOST); STABILIZER, SPOILERS 1/2/4/5, FLAPS, YAW DAMPER, ANTI SKID and NW STEERING all INOP.",
    job: "Fly the aircraft first — alternate law, MANEUVER WITH CARE, MAX 320 KT / M.77. Run the HYD G+Y SYS LO PR ECAM per FCOM PRO-ABN-HYD: PTU OFF → AFFECTED PUMPS OFF → YELLOW ELEC PUMP ON (if Y lost by ENG 2 PUMP LO PR). PM declares MAYDAY to ATC once aircraft under control. Land FLAP 3 at VREF+25 kt; gravity gear extension AFTER stabilised at VAPP (so trim reference is set before direct law). Divert to nearest suitable airport with adequate runway.",
  },

  triggers: [
    {
      id: "structural_fail",
      atMs: 4_000,
      // FCOM PRO-ABN-HYD HYD G+Y SYS LO PR triggering condition: alert fires
      // when GREEN and YELLOW system pressures both ≤ 1 450 PSI (alert resets
      // if pressure ≥ 1 750 PSI).  Level 3 = MASTER WARN red + CRC.
      // BLUE system is unaffected by G+Y loss — it continues on its normal
      // ELEC pump (RAT only auto-deploys for dual AC bus loss / dual engine
      // failure; pure hyd-G+Y loss does NOT deploy the RAT).
      description: "HYD G+Y SYS LO PR — green AND yellow pressure ≤ 1 450 PSI. Level 3 WARNING (CRC + MASTER WARN), LAND ASAP red.",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "HYD G+Y SYS LO PR" },
        {
          type: "ADD_ECAM",
          messages: [
            // Left column — primary procedure (FCOM PRO-ABN-HYD P 42/48)
            { id: "hyd_gy_lo",     line: "HYD G+Y SYS LO PR",   level: "warning"  },
            { id: "hyd_g_sep",     line: "HYD G SYS LO PR",     level: "caution"  },
            { id: "hyd_y_lo",      line: "HYD Y SYS LO PR",     level: "caution"  },
            // ECAM action lines (in FCOM order).  AFFECTED PUMPS is split
            // into G ENG 1 PUMP and Y ENG 2 PUMP so each step turns its line
            // green when the corresponding pushbutton is pressed.
            { id: "ecam_ptu_off",  line: "PTU.........OFF",         level: "advisory" },
            { id: "ecam_g_pump",   line: "G ENG 1 PUMP...OFF",       level: "advisory" },
            { id: "ecam_y_pump",   line: "Y ENG 2 PUMP...OFF",       level: "advisory" },
            { id: "ecam_y_elec",   line: "Y ELEC PUMP.....ON",       level: "advisory" },
            { id: "ecam_manuv",    line: "MANEUVER WITH CARE",       level: "remark"   },
            // Right column — LAND ASAP (SECONDARY FAILURES appear later,
            // after main ECAM actions are complete — see afterEffect on
            // yel_elec_pump_on below)
            { id: "land_asap",     line: "LAND ASAP",            level: "warning"  },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── AVIATE FIRST (FCTM PR-AEP-HYD: "PF will be very busy flying the
    //    aircraft … The PF will maneuver with care to avoid high hydraulic
    //    demand on the remaining systems.")  MAYDAY comes later — it is a
    //    PM call (see atc_mayday below), and ECAM actions begin first.
    {
      id: "maintain_control",
      label: "FLY THE AIRCRAFT",
      action: "MAINTAIN CONTROL",
      hint: "PF: AVIATE.  F/CTL has reverted to ALTERNATE LAW — PROT LOST.  Keep wings level, smooth inputs.  Aircraft retains ailerons + roll spoilers from BLUE system but stabilizer, flaps, yaw damper, AP all INOP.  Do NOT make abrupt or full-deflection control inputs.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      requiresTrigger: "structural_fail",
    },
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARNING — silences CRC. HYD G+Y SYS LO PR is Level 3 RED WARNING. ECAM procedure remains displayed.",
      variant: "warning",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: ["maintain_control"],
      afterEffect: {
        delayMs: 400,
        triggerId: "mw_hyd_cancelled",
        effects: [{ type: "SET_MASTER_WARN", active: false }],
      },
    },
    {
      id: "ptu_off",
      label: "PTU",
      action: "OFF",
      hint: "PM: HYD overhead — PTU pushbutton → OFF. FCOM PRO-ABN-HYD: PTU is the first ECAM action for G+Y loss; deactivate to prevent dry cycling.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_ptu_off",
      requires: ["cancel_master_warn"],
    },
    {
      id: "grn_eng1_pump_off",
      label: "ENG 1 PUMP",
      action: "OFF",
      hint: "PM: HYD overhead — GREEN ENG 1 PUMP pushbutton → OFF. FCOM: AFFECTED PUMPS OFF — GREEN system pressure unrecoverable; switch off to stop dry running.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_g_pump",
      requires: ["ptu_off"],
    },
    {
      id: "yel_eng2_pump_off",
      label: "ENG 2 PUMP",
      action: "OFF",
      hint: "PM: HYD overhead — YELLOW ENG 2 PUMP pushbutton → OFF. FCOM: AFFECTED PUMPS OFF — YELLOW system pressure unrecoverable; switch off.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_y_pump",
      requires: ["grn_eng1_pump_off"],
    },
    {
      id: "yel_elec_pump_on",
      label: "YELLOW ELEC PUMP",
      action: "ON",
      hint: "PM: HYD overhead — YELLOW ELEC PUMP pushbutton → ON. FCOM: if yellow sys lost by ENG 2 PUMP LO PR — YELLOW ELEC PUMP ON to charge accumulator. 7 full brake applications available.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_y_elec",
      requires: ["yel_eng2_pump_off"],
      afterEffect: {
        delayMs: 3_000,
        triggerId: "secondary_hyd",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              // Secondary failures appear AFTER main ECAM actions complete.
              // FCOM PRO-ABN-HYD shows "SECONDARY FAILURES" as a document
              // section label only — on the actual EWD the items are prefixed
              // with "*" (the asterisk IS the secondary-failure indicator),
              // no literal "SECONDARY FAILURES" header text is rendered.
              { id: "sec_fctl",      line: "* F/CTL",                    level: "caution"  },
              { id: "sec_wheel",     line: "* WHEEL",                    level: "caution"  },
              { id: "steering_inop", line: "ROLL OUT: NO NW STG/ANTI SKID", level: "caution"  },
              { id: "ptu_off_msg",   line: "HYD PTU......OFF",            level: "advisory" },
            ],
          },
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },
    // ── SECONDARY FAILURES — PM reads, PF cross-checks ────────────────────────
    // FCOM PRO-ABN-HYD lists * F/CTL and * WHEEL as secondary failures.
    // PM reads each one and the associated consequences; PF acknowledges.
    {
      id: "announce_sec_failures",
      label: "ECAM — SECONDARY FAILURES",
      action: "READ",
      hint: "PM reads each secondary failure from the SD/EWD after main ECAM is complete. PF cross-checks and acknowledges each line.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["yel_elec_pump_on"],
      notes: [
        "* F/CTL — Flight controls degraded.  ALTN LAW (PROT LOST): only load factor limitation + hi/lo speed stability remain.  STABILIZER, YAW DAMPER, AP 1+2 all INOP.  Ailerons + Elevator AVAIL (Blue).  Spoilers: 1 per wing only.  Slats slow only; FLAPS INOP.  DIRECT LAW when L/G DN.  MAX SPEED 320 KT / M.77.  MANEUVER WITH CARE.",
        "* WHEEL — Braking & steering degraded.  NORMAL brakes INOP, ANTI SKID INOP, NW STEERING INOP, AUTO BRAKE INOP, L/G RETRACTION INOP.  Gear extension by GRAVITY only.  Yellow accumulator brakes: ~7 full applications available, MAX BRK PR 1 000 PSI.  Plan long, straight rollout.",
      ],
    },
    {
      id: "fctl_check",
      label: "FCTL PAGE CHECK",
      action: "CONFIRM",
      hint: "PM: verify FCTL page on the SD — ailerons + elevator available (Blue); STABILIZER + YAW DAMPER + FLAPS INOP; spoilers 1/wing. F/CTL ALTN LAW (PROT LOST); DIRECT LAW after L/G DN. MAN PITCH TRIM NOT used in G+Y SYS LO PR (stabilizer inop).",
      variant: "switch",
      crew: "PM",
      requires: ["announce_sec_failures"],
    },
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM: cancel MASTER CAUTION glareshield light — silences SC chime triggered by the secondary failures appearing. ECAM remains on display.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: ["announce_sec_failures"],
      afterEffect: {
        delayMs: 300,
        triggerId: "mc_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
    },

    // ── MANEUVER DISCIPLINE — explicit PF reminder per FCOM action line
    {
      id: "speed_set",
      label: "MANEUVER WITH CARE",
      action: "MAX 320/M.77",
      hint: "PF: announces 'MANEUVER WITH CARE.' Apply MAX SPEED 320 KT / M.77 per FCOM PRO-ABN-HYD. F/CTL in ALTERNATE LAW (PROT LOST) — smooth, modest sidestick inputs only. Ailerons + elevator are available on BLUE; spoilers limited to 1/wing. Slats slow. Loss of high-speed protection is the reason for the speed limit.",
      variant: "switch",
      crew: "PF",
      requires: ["cancel_master_caut"],
    },

    // ── STATUS PHASE ─────────────────────────────────────────────────────────
    // Mirror of FCTM AOP-30-30 + ENG 1 FAIL pattern: after main ECAM cleared
    // and secondary failures announced, the SD switches to STATUS page; PF
    // commands STOP ECAM, then OEB/RESET check, then PM READS STATUS aloud,
    // then PM announces ECAM ACTIONS COMPLETED.
    {
      id: "announce_status",
      label: "ECAM — STATUS",
      action: "ANNOUNCE",
      hint: "PM announces 'STATUS' as the SD switches to the STATUS page. PF acknowledges.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["speed_set"],
    },
    {
      id: "stop_ecam",
      label: "STOP ECAM",
      action: "CALL",
      hint: "PF: 'STOP ECAM.' ECAM actions are stopped before reviewing STATUS and conducting the approach prep. PM acknowledges and removes hand from CLR.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["announce_status"],
    },
    {
      id: "oeb_check",
      label: "OEB / COMPUTER RESETS",
      action: "CHECK",
      hint: "PF: 'Any OEB? Any COMPUTER RESETS?' PM checks for applicable OEB items + required computer resets per QRH reset table. Do NOT reset from memory. If none — 'NO APPLICABLE OEB OR RESET.'",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["stop_ecam"],
    },
    {
      id: "read_status",
      label: "READ STATUS",
      action: "CALL",
      hint: "PF: 'READ STATUS' — PM reads the STATUS page aloud line by line. PF cross-checks and acknowledges.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["oeb_check"],
      notes: [
        "Reference: FCOM PRO-ABN-HYD STATUS page (PRO-ABN-HYD P 43/48).",
        "Reference: QRH ABNORMAL — DUAL HYD G+Y LO PR summary (AOP-30-60 Use of Summaries).",
      ],
    },
    {
      id: "status_read_aloud",
      label: "STATUS — PM READS",
      action: "REVIEW",
      hint: "PM reads each STATUS line aloud; PF: 'CHECKED' after each. Covers limits, approach procedure, INOP SYS list.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["read_status"],
      notes: [
        "MAX SPEED .......... 320 / M.77",
        "MAX BRK PR ......... 1 000 PSI",
        "MANEUVER WITH CARE",
        "APPR PROC: DUAL HYD LO PR",
        "FOR LDG ............. USE FLAP 3",
        "GPWS FLAP MODE ...... OFF",
        "WHEN CONF 3 + VAPP: L/G ........ GRVTY EXTN  (QRH L/G GRAVITY EXTENSION)",
        "APPR SPD ........... VREF +25 KT",
        "LDG DIST PROC ...... APPLY",
        "ALTN LAW: PROT LOST.  WHEN L/G DN: DIRECT LAW.",
        "BRK Y ACCU PR ONLY (≈ 7 full applications)",
        "INOP SYS: G+Y HYD, F/CTL PROT, STABILIZER, REVERSER 1+2, SPLR 1+2+4+5, FLAPS, LAF, YAW DAMPER, AP 1+2, ANTI SKID, N/W STRG, NORM BRK, AUTO BRK, L/G RETRACT, CAT 2, GLS AUTOLAND, STEEP APPR.",
      ],
    },
    {
      id: "crew_crosscheck",
      label: "ECAM ACTIONS COMPLETED",
      action: "ANNOUNCE",
      hint: "PM: 'ECAM ACTIONS COMPLETED.' PF acknowledges. Primary ECAM cleared, secondary failures reviewed, STATUS read aloud.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["status_read_aloud"],
    },

    // ── PERFORMANCE & DECISION ───────────────────────────────────────────────
    {
      id: "ldg_perf",
      label: "LANDING PERFORMANCE",
      action: "COMPUTE",
      hint: "PM: use QRH / EFB to compute landing distance per LDG DIST PROC. Inputs: FLAP 3, VAPP = VREF+25 kt (~160 kt), Y accumulator brakes only, ANTI SKID INOP, no auto-brake, REVERSERS INOP. Apply factored landing distance. Confirm divert runway LDA exceeds required.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_crosscheck"],
    },
    {
      id: "fordec_hyd",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC. The decision drives diversion airport, runway selection, and the approach plan. PM contributes facts + check-back.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["ldg_perf"],
      notes: [
        "F — FACTS: Dual G+Y HYD loss.  F/CTL ALTN LAW (DIRECT LAW at L/G DN).  Flaps INOP, slats slow.  Stabilizer + Y damper + AP all INOP.  Gear by gravity only, no retract.  Y accumulator brakes (~7 applications), no anti-skid, no NW steering, no reversers.  Blue system NORMAL.",
        "O — OPTIONS: ① VABB RWY 27 (3 445 m) — long, full CFR, our planned alternate.  ② VAAH RWY 23 (2 743 m) — shorter, check LDG DIST.  ③ Continue VABB destination — NOT viable, LAND ASAP red applies.",
        "R — RISKS / BENEFITS: VAPP ~160 kt (high) + no anti-skid + accumulator brakes → long high-speed rollout, runway excursion possible.  VABB longer = more margin; VAAH shorter = LDG DIST may not fit.",
        "D — DECISION: Divert VABB RWY 27 — LAND ASAP, full emergency declared, CFR Cat 3.",
        "E — EXECUTION: ILS RWY 27, hand-flown approach (AP INOP), stabilize at VAPP CONF 3 → gravity gear → land → accumulator brakes → max reverse N/A → straight-track rollout.",
        "C — CHECK-BACK: PM confirms 'AGREED — VABB RWY 27, FULL EMERGENCY, FLAP 3, VAPP +25.'",
      ],
    },

    // ── COMMS ────────────────────────────────────────────────────────────────
    {
      id: "inform_atc_intentions",
      label: "INFORM ATC — INTENTIONS + BRIEFING",
      action: "CALL",
      hint: "Pilot-initiated call to ATC. PM: 'Mumbai Control, IFLY101 — dual hydraulic failure GREEN and YELLOW, MAYDAY emergency confirmed, request immediate vectors VABB runway 27 ILS. Request latest weather, runway in use, NOTAMs, expected approach type. 186 souls on board.' Combines intentions + briefing request in one call.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec_hyd"],
      notes: [
        "Pilot-initiated.  This is YOUR call to ATC, not a response.",
        "Format (ICAO §5.6.1 + §emergency): 3× MAYDAY + station + callsign + nature + intentions + position/level + souls + briefing request.",
        "ATC reply (wx / RWY / NOTAMs / approach type) appears as an ATC distraction once this step is checked off — read back the full set.",
      ],
    },
    {
      id: "fmgc_prep",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: F-PLN — insert DEST VABB.  Select RWY 27, insert ILS frequency + course.  Set VAPP = VREF +25 kt (FLAP 3).  Check fuel vs DEST + FINAL RESERVE 30 min — declare on frequency if not adequate.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec_hyd"],
    },
    {
      id: "nis_brief_hyd",
      label: "NITS BRIEF (SCCM)",
      action: "CONFIRM",
      hint: "Captain conducts the NITS brief on the interphone with the Senior Cabin Crew Member (SCCM).  If aircraft state allows and the FO can fly comfortably for a few minutes (aircraft trimmed, stable), Captain temporarily transfers control — 'YOU HAVE CONTROL' — does the brief, then 'I HAVE CONTROL' back.  Otherwise the brief is delegated to the FO.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fordec_hyd"],
      notes: [
        "N — NATURE: 'We have a technical issue with the hydraulic system. The aircraft is fully controllable.'",
        "I — INTENTIONS: 'We are diverting to Mumbai and will be landing on runway 27. Full emergency services will meet the aircraft as a precaution.'",
        "T — TIME: 'Approximately 25 minutes to landing.'",
        "S — SPECIAL: 'Prepare the cabin for landing in the normal way. I will give you a further update before descent. Any questions?'",
      ],
    },
    {
      id: "pax_pa",
      label: "PASSENGER PA",
      action: "ANNOUNCE",
      hint: "Captain (PF) PA — confident tone, no alarming language.  Brief technical issue, decision to divert, reassurance that aircraft is under control, instructions to follow cabin crew, time to landing.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["nis_brief_hyd"],
      notes: [
        "'Ladies and gentlemen, this is your Captain speaking.'",
        "'As you may have felt, we've had a technical issue with one of our systems. Our priority is your safety, and as a precaution we are diverting to Mumbai.'",
        "'The situation is under control and the aircraft is flying normally.'",
        "'We expect to land in approximately 25 minutes. Please remain in your seats with your seatbelts fastened and follow any instructions from our cabin crew.'",
        "'Thank you for your patience and understanding. We will keep you informed.'",
      ],
    },
    {
      id: "inform_company",
      label: "INFORM COMPANY",
      action: "CALL",
      hint: "PM contacts Company Ops on dedicated frequency / ACARS / SATCOM.  Inform: situation, decision to divert, diversion airfield, ETA, full emergency declared, passenger and fuel state, services required at the destination.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["pax_pa"],
      notes: [
        "Format: 'Company, IFLY101 — dual hydraulic failure GREEN and YELLOW.'",
        "'Diverting to VABB, landing runway 27, ETA in approximately 25 minutes.'",
        "'Full emergency declared. 186 souls on board, 12 tonnes fuel remaining.'",
        "'Request: ground handling on standby at remote stand, engineering team to meet aircraft, passenger handling for onward routing.'",
        "Send message via ACARS as a written record where possible.",
      ],
    },
    {
      id: "go_around_review",
      label: "GO-AROUND REVIEW",
      action: "CONFIRM",
      hint: "PF briefs go-around plan with dual-hyd constraints.  L/G RETRACTION INOP (gear stays down).  FLAPS INOP — already at maximum lift.  HAND-FLOWN GA (AP 1+2 INOP).  Maneuver with care in alternate law.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["inform_company"],
      notes: [
        "GO-AROUND CALL: 'GO AROUND — FLAPS' is non-standard here (no flap change available).  Use 'GO AROUND, MAX REVERSE N/A, FOLLOW SRS.'",
        "TOGA: both engines healthy — TOGA + SRS will give positive climb.  Limit pitch — alternate law, no Alpha Floor.",
        "GEAR: STAYS DOWN (retraction INOP).  Expect additional drag — anticipate trimming for positive climb.",
        "SPEED: maintain VAPP, build to green dot only once positive climb established.",
        "TURN: minimum bank turns only (≤15°) — alternate law, reduced lateral control authority.",
      ],
    },
    {
      id: "atc_emergency_svcs",
      label: "ATC — EMERGENCY SERVICES",
      action: "ADVISE",
      hint: "PM: 'Mumbai Approach, IFLY101 — confirm full emergency services on runway 27.  Flapless approach, VAPP plus 25, accumulator brakes only, no anti-skid, no nose-wheel steering, long high-speed rollout expected, possible runway excursion.  Request foam runway and CFR vehicles in position.'  Per ICAO phraseology §10.8 SQUAWK MAYDAY [7700] if not already.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["go_around_review"],
    },

    // ── APPROACH PHASE ───────────────────────────────────────────────────────
    {
      id: "approach_brief_hyd",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF leads the approach brief.  Cover: ILS RWY 27, MDA/DH, VAPP = VREF+25 kt, FLAP 3 (final config), AP INOP (hand-flown), stabilize at VAPP BEFORE gravity gear (FCOM: ensures trim reference set before DIRECT LAW activates at gear extension), accumulator brakes only (~7 applications), anti-skid INOP, NW steering INOP, GPWS FLAP MODE OFF, GO-AROUND per brief.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["atc_emergency_svcs"],
      notes: [
        "Approach type: ILS RWY 27.",
        "Configuration: FLAP 3 (not FULL — flaps INOP for G+Y).",
        "Speed: VAPP = VREF + 25 kt (FCOM STATUS).",
        "Hand-flown: AP 1+2 INOP — FD + A/THR available.",
        "Trim reference: stabilize at VAPP first, THEN gravity gear (DIRECT LAW activates at L/G DN).",
        "Braking: Y accumulator brakes (~7 applications); ANTI SKID + AUTO BRK + N/W STRG INOP.",
        "Reverse: INOP (REVERSER 1+2 INOP).",
        "GPWS: FLAP MODE OFF (FCOM STATUS — prevents spurious GPWS warning for FLAP 3 landing).",
      ],
    },
    {
      id: "approach_prep_hyd",
      label: "APPROACH PREP",
      action: "COMPLETE",
      hint: "PM: set ILS 27 manually on RMP 1 (auto-tune may not match selected RWY in FMGC).  Set BARO QNH.  Set MDA/DH per chart.  Verify auto-brake selector → OFF (auto-brake INOP).  Spoilers ARM (still arms, but G+Y lost — only 1 SPLR/wing).  Landing lights ON.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["approach_brief_hyd"],
    },
    {
      id: "gpws_flap_mode",
      label: "GPWS FLAP MODE",
      action: "OFF",
      hint: "PM: GPWS FLAP MODE pb → OFF.  FCOM STATUS item — prevents spurious GPWS 'TOO LOW FLAP' warning during the FLAP 3 landing.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["approach_prep_hyd"],
    },
    {
      id: "approach_cl_hyd",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs the approach checklist — note items affected by dual-hyd config.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["gpws_flap_mode"],
      notes: [
        "BARO .............. QNH SET",
        "MDA / DH .......... SET",
        "ECAM STATUS ....... REVIEWED  (DUAL HYD LO PR APPR PROC reviewed)",
        "MIN FUEL .......... CHECKED",
        "SEAT BELTS ........ ON",
        "AUTOBRAKE ......... OFF  (INOP — accumulator brakes only)",
        "SPOILERS .......... ARM  (1 SPLR/wing, but arm anyway)",
        "GPWS FLAP MODE .... OFF  (already done)",
        "LANDING LIGHTS .... ON",
        "CABIN ............. ADVISED — BRACE BRIEF complete",
      ],
    },
    {
      id: "lgr_gravity",
      label: "GEAR — GRAVITY EXTN",
      action: "DEPLOY AT VAPP",
      hint: "PM: ONLY after PF confirms STABILIZED AT VAPP, CONF 3.  Pull the L/G GRAVITY EXTN handle; rotate one click at a time, 30 s settling between clicks.  Confirm 3 GREENS.  Reason for VAPP-first sequence (FCOM): at L/G DN the F/CTL reverts to DIRECT LAW — the mean elevator position at that moment becomes the centered-stick reference, so being trimmed at VAPP before gear ensures the correct reference.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["approach_cl_hyd"],
    },
    {
      id: "landing_cl_hyd",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs landing checklist at 1000 ft on final. Gear to extend at Vapp only when stabilized.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_cl_hyd"],
      notes: [
        "GEAR: GRAVITY EXTN — AT VAPP CONF 3 (NOT BEFORE)",
        "FLAPS: CONF 3 (VREF+25 kt)",
        "EXPECT: direct law after gear down, accumulator brakes, long rollout, max reverse",
        "USE MAN PITCH TRIM warning after L/G DN — DISREGARD (FCOM note)",
      ],
    },

    // ── AFTER LANDING — request taxi to stand ─────────────────────────────────
    // Aircraft is stopped on or near the runway with no nose-wheel steering
    // and limited braking.  Cannot taxi normally.  Crew requests assistance
    // (tow, or follow-me + tug) to clear the runway / proceed to a stand.
    {
      id: "request_taxi_to_stand",
      label: "REQUEST TAXI TO STAND",
      action: "CALL",
      hint: "After aircraft fully stopped: PM calls Tower / Ground to advise stopped on the runway with no NW steering. Request a tow or follow-me vehicle to clear the runway and proceed to a remote stand.  Confirm services available, brakes still set, doors closed unless evacuation ordered.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["landing_cl_hyd"],
      notes: [
        "Call: 'Mumbai Tower, IFLY101 — landed and stopped on runway 27. Confirm parking brake set, no immediate evacuation. Nose-wheel steering inoperative — request tow or follow-me to clear runway and proceed to remote stand.'",
        "Wait for ATC instructions before any manoeuvre.",
        "If conditions deteriorate (fire / smoke / fuel leak detected by ARFF), be prepared for evacuation order.",
      ],
    },
  ],

  statusItems: [
    // ── Left column: FCOM PRO-ABN-HYD HYD G+Y SYS LO PR STATUS ──────────────
    { id: "st_max_spd",   line: "MAX SPEED . . . . . . 320/0.77",  severity: "caution"  },
    { id: "st_max_brk",   line: "MAX BRK PR . . . . 1 000 PSI",    severity: "caution"  },
    { id: "st_manv",      line: "MANEUVER WITH CARE",                severity: "caution"  },
    { id: "st_fctl",      line: "FCTL ALTN LAW (PROT LOST)",         severity: "caution"  },
    { id: "st_dir_law",   line: "WHEN L/G DN: DIRECT LAW",          severity: "caution"  },
    { id: "st_stab",      line: "STABILIZER . . . . . . . INOP",    severity: "caution"  },
    { id: "st_gear",      line: "L/G GRVTY EXTN ONLY",              severity: "caution"  },
    { id: "st_brakes",    line: "BRK Y ACCU PR ONLY",                severity: "caution"  },
    { id: "st_noskid",    line: "ANTI SKID . . . . . . . INOP",     severity: "caution"  },
    { id: "st_nosteer",   line: "N/W STRG . . . . . . . INOP",      severity: "caution"  },
    { id: "st_gpws",      line: "GPWS FLAP MODE . . . . . OFF",     severity: "caution"  },
    { id: "st_appr",      line: "DUAL HYD LO PR APPR PROC",         severity: "advisory" },
    { id: "st_vapp",      line: "APPR SPD . . . . VREF+25 KT",      severity: "memo"     },
    { id: "st_ldg3",      line: "FOR LDG . . . . USE FLAP 3",       severity: "memo"     },
    { id: "st_ldg_dist",  line: "LDG DIST PROC . . . . APPLY",      severity: "memo"     },
    { id: "st_fuel_incr", line: "FUEL CONSUMPT INCRSD",               severity: "advisory" },
    { id: "st_fms",       line: "FMS PRED UNRELIABLE",                severity: "advisory" },
    { id: "st_slats",     line: "SLATS SLOW",                          severity: "advisory" },
    // ── Right column: INOP SYS (FCOM STATUS right column) ────────────────────
    { id: "st_inop_hyd",  line: "G+Y HYD",           severity: "caution",  inopSys: true },
    { id: "st_inop_fctl", line: "F/CTL PROT",         severity: "caution",  inopSys: true },
    { id: "st_inop_stab", line: "STABILIZER",          severity: "caution",  inopSys: true },
    { id: "st_inop_rev",  line: "REVERSER 1+2",        severity: "caution",  inopSys: true },
    { id: "st_inop_splr", line: "SPLR 1+2+ 4+5",      severity: "caution",  inopSys: true },
    { id: "st_inop_flap", line: "FLAPS",               severity: "caution",  inopSys: true },
    { id: "st_inop_laf",  line: "LAF",                 severity: "caution",  inopSys: true },
    { id: "st_inop_yaw",  line: "YAW DAMPER",          severity: "caution",  inopSys: true },
    { id: "st_inop_ap",   line: "AP 1+2",              severity: "caution",  inopSys: true },
    { id: "st_inop_ask",  line: "ANTI SKID",           severity: "caution",  inopSys: true },
    { id: "st_inop_nws",  line: "N/W STRG",            severity: "caution",  inopSys: true },
    { id: "st_inop_nbrk", line: "NORM BRK",            severity: "caution",  inopSys: true },
    { id: "st_inop_abrk", line: "AUTO BRK",            severity: "caution",  inopSys: true },
    { id: "st_inop_lgr",  line: "L/G RETRACT",         severity: "caution",  inopSys: true },
    { id: "st_inop_cat2", line: "CAT 2",               severity: "caution",  inopSys: true },
    { id: "st_inop_gls",  line: "GLS AUTOLAND",        severity: "caution",  inopSys: true },
    { id: "st_inop_steep",line: "STEEP APPR",          severity: "caution",  inopSys: true },
  ],

  // ── ATC sequence — cruise phase rule: first ATC contact IS the MAYDAY ────────
  // Phase rule (cruise): no prior Tower handoff/STANDBY sequence; the routine
  // check-in call from Mumbai Control triggers the immediate MAYDAY declaration.
  // STANDBY discipline: ATC queries during ECAM → STANDBY correct on kind:"atc"
  // cards. Kind:"crew" cards test deliberate crew-initiated calls — no standby
  // option (rule §0.9 of atc-comms skill).
  distractions: [
    // ① ATC routine check-in fires just after failure — crew responds with MAYDAY
    // Correct MAYDAY: nature + unable RVSM + request descent + standby.
    // No airport / vectors in the initial call — intentions come after FORDEC.
    {
      id: "atc_handoff_checkin",
      atMs: 10_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, Mumbai Control, checking in, maintain FL350.",
      standbyResurfaceMs: 20_000,
      choices: [
        // Correct — nature + heading + offset request + unable RVSM + descent request + standby
        // Heading states current navigation; offset gives lateral separation; descent exits RVSM block
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, heading 200, unable RVSM, request 2 miles right offset and descent flight level two five zero, standby",  correct: true  },
        // Wrong — missing heading and offset; ATC cannot plan separation without navigation info
        { id: "b", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, unable RVSM, request descent flight level two five zero, standby",                                          correct: false },
        // Wrong — standby only; MAYDAY must be declared immediately
        { id: "c", label: "Standby IFLY101",                                                                                                                                                   correct: false },
        // Wrong — airports and vectors in initial MAYDAY; intentions come after FORDEC
        { id: "d", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, maintaining FL350, request immediate vectors nearest suitable airport with 3 000 m runway, standby",        correct: false },
      ],
    },

    // ② ATC acknowledges MAYDAY — crew reads back BOTH offset and descent level
    {
      id: "atc_mayday_ack",
      atMs: 25_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, roger MAYDAY, radar contact. Maintain 2 miles right offset, descend flight level two four zero.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — both items read back (offset is a safety separation instruction)
        { id: "a", label: "2 miles right offset, descending flight level two four zero, IFLY101",  correct: true  },
        // Wrong — offset dropped (protects against conflicting traffic in RVSM block)
        { id: "b", label: "Descending flight level two four zero, IFLY101",                         correct: false },
        // Wrong — bare acknowledgement
        { id: "c", label: "Roger IFLY101",                                                          correct: false },
      ],
    },

    // ③ ATC asks if assistance required — STANDBY while ECAM not yet started
    {
      id: "atc_assistance_req",
      atMs: 70_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, assistance required?",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — ECAM not yet running; focus on aircraft; advise when ready
        { id: "a", label: "Standby IFLY101",                                               correct: true  },
        // Wrong — requests routing before ECAM started (too early to commit)
        { id: "b", label: "Request vectors nearest suitable airport, IFLY101",             correct: false },
        // Wrong — "negative" implies no assistance needed; serious emergency is active
        { id: "c", label: "Negative IFLY101",                                              correct: false },
      ],
    },

    // ④ ATC offers vectors — crew defers while checklist running
    {
      id: "atc_vectors_when_ready",
      atMs: 120_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, vectors available when ready, descend at your discretion.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — acknowledge without committing; ECAM in progress
        { id: "a", label: "Continuing checklist, will advise when ready, IFLY101", correct: true  },
        { id: "b", label: "Standby IFLY101",                                        correct: true  },
        // Wrong — premature routing commitment before ECAM and FORDEC done
        { id: "c", label: "IFLY101, turn left direct Mumbai, descend FL100",        correct: false },
      ],
    },

    // ⑤ ECAM complete — crew requests Mumbai weather before FORDEC
    // Kind:"crew" — deliberate crew-initiated call; no standby option.
    {
      id: "atc_weather_request",
      atMs: 250_000,
      requiresStep: "crew_crosscheck",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "ECAM complete. Select the correct weather request.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — weather request only; airport decision comes after landing performance + FORDEC
        { id: "a", label: "Mumbai Approach, IFLY101, request latest weather Mumbai, runway in use, QNH",   correct: true  },
        // Wrong — airport/runway stated before FORDEC and landing performance are done
        { id: "b", label: "Mumbai Approach, IFLY101, diverting Mumbai, request weather runway 27",          correct: false },
        // Wrong — skips weather entirely; requests vectors prematurely
        { id: "c", label: "Mumbai Approach, IFLY101, request immediate vectors ILS runway 27",              correct: false },
      ],
    },

    // ⑥ ATC delivers weather — full readback required (QNH critical for landing distance)
    {
      id: "atc_weather_delivery",
      atMs: 260_000,
      requiresStep: "crew_crosscheck",
      kind: "atc",
      from: "MUMBAI APPROACH",
      pilotSays: "Mumbai Approach, IFLY101, request latest weather Mumbai, runway in use, QNH.",
      message: "IFLY101, Mumbai Approach, wind 270 at 6, runway 27 in use, QNH 1013, expect ILS runway 27.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — full readback including QNH (needed for landing distance computation)
        { id: "a", label: "Wind 270 at 6, runway 27, QNH 1013, ILS runway 27, IFLY101",  correct: true  },
        // Wrong — QNH dropped (affects landing distance at accumulator-brake approach speed)
        { id: "b", label: "Wind 270 at 6, runway 27, ILS runway 27, IFLY101",             correct: false },
        // Wrong — bare acknowledgement
        { id: "c", label: "Roger IFLY101",                                                 correct: false },
      ],
    },

    // ⑦ Hold request — crew needs time for FORDEC + approach brief
    // Kind:"crew" — deliberate crew-initiated call; no standby option.
    {
      id: "pm_hold_req",
      atMs: 300_000,
      requiresStep: "crew_crosscheck",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Request holding from Mumbai Approach.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — states reason; gives ATC expectation of further delay
        { id: "a", label: "Mumbai Approach, IFLY101, request holding, require time for crew coordination and approach preparation",  correct: true  },
        // Wrong — commits to descent/approach before FORDEC and approach brief done
        { id: "b", label: "Mumbai Approach, IFLY101, request descent 3 000 feet, vectors ILS runway 27",                            correct: false },
        // Wrong — vague; no hold requested; ATC cannot plan separation
        { id: "c", label: "Mumbai Approach, IFLY101, not ready, continuing on track",                                                correct: false },
      ],
    },

    // ⑧ ATC issues hold clearance — full readback: fix + altitude + direction
    {
      id: "atc_hold_clr",
      atMs: 310_000,
      requiresStep: "crew_crosscheck",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, hold SAPAV, maintain 7 000 feet, left-hand pattern, expect further clearance time 25.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — fix + altitude + direction all read back
        { id: "a", label: "Hold SAPAV, 7 000 feet, left-hand, IFLY101",  correct: true  },
        // Wrong — altitude dropped
        { id: "b", label: "Hold SAPAV, left-hand, IFLY101",               correct: false },
        // Wrong — bare acknowledgement
        { id: "c", label: "Roger IFLY101",                                 correct: false },
      ],
    },

    // ⑨ ATC asks POB + endurance — respond with facts; no technical aircraft status
    {
      id: "atc_pob_fuel_services",
      atMs: 330_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — POB + fuel + endurance; no technical aircraft status (ATC does not need it)
        { id: "a", label: "186 persons on board, 12 tonnes fuel, endurance 2 hours 30, IFLY101",                                                                                              correct: true  },
        // Wrong — standby not acceptable once ECAM complete and holding
        { id: "b", label: "Standby IFLY101",                                                                                                                                                  correct: false },
        // Wrong — under-informative; no fuel or endurance stated
        { id: "c", label: "IFLY101, 186 POB, standard approach",                                                                                                                              correct: false },
      ],
    },

    // ⑩ Advise intentions — FORDEC complete; commit to VABB (training test: VAAH too short)
    // Kind:"crew" — deliberate crew-initiated call; no standby option.
    {
      id: "atc_intentions_advise",
      atMs: 380_000,
      requiresStep: "fordec_hyd",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "FORDEC complete. Advise intentions to ATC.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — VABB RWY 27 (3 445 m): adequate for flapless + accumulator-brake landing
        { id: "a", label: "Mumbai Approach, IFLY101, diverting Mumbai, request vectors ILS runway 27, flap 3 approach",  correct: true  },
        // Wrong — VAAH RWY 23 (2 743 m): insufficient for flapless with accumulator brakes only
        { id: "b", label: "Mumbai Approach, IFLY101, diverting Ahmedabad, request vectors runway 23",                   correct: false },
        // Wrong — no clear divert decision communicated to ATC
        { id: "c", label: "Mumbai Approach, IFLY101, requesting descent 3 000 feet",                                    correct: false },
      ],
    },

    // ⑪ Emergency services — concise; no technical aircraft status
    // Kind:"crew" — deliberate crew-initiated call; no standby option.
    {
      id: "atc_emg_services_req",
      atMs: 390_000,
      requiresStep: "fordec_hyd",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Request emergency services for runway 27.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — "full emergency services" only; ATC does not need technical aircraft details
        { id: "a", label: "Mumbai Approach, IFLY101, request full emergency services runway 27",                                                                                                              correct: true  },
        // Wrong — overloads frequency with technical status ATC cannot act on
        { id: "b", label: "Mumbai Approach, IFLY101, request full emergency services runway 27, flapless approach, accumulator brakes only, no anti-skid, no nose-wheel steering, long rollout expected",  correct: false },
        // Wrong — piecemeal; "fire trucks only" is not "full emergency services"
        { id: "c", label: "Mumbai Approach, IFLY101, request fire trucks and foam runway 27",                                                                                                                correct: false },
      ],
    },

    // ⑫ ATC asks ready for approach
    {
      id: "atc_ready_for_approach",
      atMs: 450_000,
      requiresStep: "fordec_hyd",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, advise when ready for approach.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY101 ready, request vectors ILS runway 27, flap 3 approach, Vapp plus 25 knots",  correct: true  },
        { id: "b", label: "Ready, IFLY101",                                                                       correct: false },
        { id: "c", label: "Standby IFLY101",                                                                      correct: false },
      ],
    },

    // ⑬ ILS clearance — full readback including frequency change
    {
      id: "atc_cleared_approach",
      atMs: 480_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      pilotSays: "Mumbai Approach, IFLY101, ready for the approach, request vectors for ILS runway 27.",
      message: "IFLY101, roger, turn left heading 240, descend 3 000 feet, cleared ILS runway 27 approach, contact Mumbai Tower 118.10 when established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 27, contact Tower 118.10 when established, IFLY101",  correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                                             correct: false },
        { id: "c", label: "Cleared ILS runway 27, IFLY101",                                                                           correct: false },
      ],
    },

    // ⑭ Tower contact
    {
      id: "atc_tower_contact",
      atMs: 510_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      pilotSays: "Mumbai Tower, IFLY101, established ILS runway 27, MAYDAY confirmed.",
      message: "IFLY101, Mumbai Tower, roger, continue ILS approach runway 27, report established, emergency services on standby.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 27, will report established, IFLY101",  correct: true  },
        { id: "b", label: "Switching, IFLY101",                                           correct: false },
      ],
    },

    // ⑮ Cleared to land
    {
      id: "atc_cleared_to_land",
      atMs: 540_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      pilotSays: "Mumbai Tower, IFLY101, established ILS runway 27, gear gravity, FLAP 3.",
      message: "IFLY101, runway 27 cleared to land, wind 270 at 6, ARFF in position, long rollout acknowledged.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Cleared to land runway 27, IFLY101",  correct: true  },
        { id: "b", label: "Roger IFLY101",                        correct: false },
        // Wrong — runway mis-readback under stress
        { id: "c", label: "Cleared to land runway 28, IFLY101",  correct: false },
      ],
    },

    // ⑯ After landing — aircraft stopped, NW steering INOP; request tow
    {
      id: "atc_taxi_to_stand",
      atMs: 600_000,
      requiresStep: "request_taxi_to_stand",
      kind: "atc",
      from: "MUMBAI TOWER",
      pilotSays: "Mumbai Tower, IFLY101 — landed and fully stopped on runway 27, parking brake set. No immediate evacuation. Nose-wheel steering inoperative — request tow or follow-me vehicle to clear the runway and proceed to a remote stand.",
      message: "IFLY101, roger, hold position, parking brake on. Tug and follow-me dispatched, ETA two minutes. Contact Mumbai Ground 121.9 when tug connected.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — full readback: position + brake + frequency
        { id: "a", label: "Holding position, parking brake on, will contact Ground 121.9 when tug connected, IFLY101",  correct: true  },
        // Wrong — bare ack drops the tug/frequency instructions
        { id: "b", label: "Roger IFLY101",                                                                               correct: false },
        // Wrong — offers to taxi without a tug (NW steering INOP)
        { id: "c", label: "Vacating runway 27 to the left, IFLY101",                                                    correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT — VABB",
      description: "Divert to VABB RWY 27 (3445 m) — minimum runway for flapless approach. Nearest airport meeting LDA requirement.",
      tone: "primary",
    },
    {
      value: "DIVERT_VAAH",
      label: "DIVERT — VAAH",
      description: "Divert to VAAH (2743 m) — too short for flapless approach. High risk of runway excursion.",
      tone: "secondary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Return VIDP — may be farther than VABB. Acceptable only if genuinely closer.",
      tone: "secondary",
    },
    {
      value: "CONTINUE",
      label: "CONTINUE",
      description: "Press on to destination — unacceptable with dual hydraulic loss and degraded FCTL.",
      tone: "danger",
    },
  ],

  engineDisplay: {
    warningTrigger: "structural_fail",
    controlPanel: [
      { stepId: "ptu_off",           kind: "toggle_sw" as const, label: "PTU",       sub: "OFF"      },
      { stepId: "grn_eng1_pump_off", kind: "toggle_sw" as const, label: "ENG 1",     sub: "PUMP OFF" },
      { stepId: "yel_eng2_pump_off", kind: "toggle_sw" as const, label: "ENG 2",     sub: "PUMP OFF" },
      { stepId: "yel_elec_pump_on",  kind: "toggle_sw" as const, label: "ELEC PMP",  sub: "ON"       },
      { stepId: "flap_check",        kind: "toggle_sw" as const, label: "FLAPS",     sub: "CHK"      },
      { stepId: "gpws_flap_mode",    kind: "toggle_sw" as const, label: "GPWS",      sub: "FLAP OFF" },
      { stepId: "lgr_gravity",       kind: "emer_pb"   as const, label: "L/G",       sub: "GRVTY EXTN"},
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
            { label: "ENG 1 N1", unit: "%", states: [{ value: { v: "84.2",  c: "green" } }] },
            { label: "ENG 2 N1", unit: "%", states: [{ value: { v: "84.2",  c: "green" } }] },
            { label: "STATUS",              states: [{ value: { v: "NORM",   c: "green" } }] },
          ],
        },
      ],
    },
    {
      id: "hyd", label: "HYD",
      alertStates: [{ when: { trigger: "structural_fail" }, value: true }, { value: false }],
      autoSelect: { trigger: "structural_fail" },
      sections: [
        {
          title: "GREEN SYS",
          colorStates: [
            { when: { trigger: "structural_fail" }, value: "red" },
            { value: "green" },
          ],
          rows: [
            {
              label: "PRESSURE", unit: "PSI",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "LO PR", c: "red" } },
                { value: { v: "3000", c: "green" } },
              ],
            },
            {
              label: "ENG 1 PUMP",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "FAULT", c: "red" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "YELLOW SYS",
          colorStates: [
            { when: { trigger: "structural_fail" }, value: "red" },
            { value: "green" },
          ],
          rows: [
            {
              label: "PRESSURE", unit: "PSI",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "LO PR", c: "red" } },
                { value: { v: "3000", c: "green" } },
              ],
            },
            {
              label: "ENG 2 PUMP",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "FAULT", c: "red" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "BLUE SYS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ELEC PUMP", states: [{ value: { v: "AUTO / ON", c: "green" } }] },
            { label: "PRESSURE",  unit: "PSI", states: [{ value: { v: "3000", c: "green" } }] },
            {
              label: "RAT",
              states: [
                { when: { trigger: "rat_deploy" }, value: { v: "DEPLOYED", c: "cyan" } },
                { value: { v: "STOWED", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "HYD PANEL",
        note: "FCOM DSC-29: Both G+Y systems unrecoverable. Blue system on ELEC pump only. RAT deployed on windmill. Do NOT cycle pumps.",
        switches: [
          {
            label: "GRN", sub: "ENG1 PMP",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "YLW", sub: "ENG2 PMP",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BLU", sub: "ELEC PMP", states: [{ value: "auto" as const }] },
          {
            label: "RAT",
            states: [
              { when: { trigger: "rat_deploy" }, value: "armed" as const },
              { value: "norm" as const },
            ],
          },
        ],
      },
    },
    {
      id: "fctl", label: "FCTL",
      alertStates: [{ when: { trigger: "structural_fail" }, value: true }, { value: false }],
      sections: [
        {
          title: "FLIGHT CONTROLS",
          colorStates: [
            { when: { trigger: "structural_fail" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "AILERON CTL",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "ELEC ONLY", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            {
              label: "ELEVATOR CTL",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "BLUE ONLY", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            {
              label: "SPOILERS",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "INOP", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "RUDDER CTL", states: [{ value: { v: "MECH BACKUP", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "FCTL PANEL",
        note: "FCOM DSC-27: All ELAC, SEC and FAC computers lost on G+Y failure. Only blue hydraulic circuit available for ailerons + elevator.",
        switches: [
          {
            label: "ELAC 1",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "ELAC 2",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "SEC 1",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "FAC 1",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
        ],
      },
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
            { label: "AC BUS 1", states: [{ value: { v: "GEN 1",     c: "green" } }] },
            { label: "AC BUS 2", states: [{ value: { v: "GEN 2",     c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ELEC NOTE",
        note: "Blue ELEC pump powered from normal AC bus — both generators operative. No electrical emergency in this scenario.",
        switches: [
          { label: "BLU", sub: "ELEC PMP", states: [{ value: "auto" as const }] },
        ],
      },
    },
  ],
};
