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
            // FCOM PRO-ABN-HYD lists these two as procedure lines directly
            // after MANEUVER WITH CARE — they belong on the EWD during the
            // drill, not only in STATUS.
            { id: "ecam_fuel",     line: "FUEL CONSUMPT INCRSD",     level: "remark"   },
            { id: "ecam_fms",      line: "FMS PRED UNRELIABLE",      level: "remark"   },
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
    // ── ① CANCEL the ECAM warning FIRST (off the HYD G+Y SYS LO PR red warning),
    //    then ② AVIATE → ③ NAVIGATE → ④ COMMUNICATE → ⑤ ECAM ACTIONS. ──
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARNING — silences CRC. HYD G+Y SYS LO PR is Level 3 RED WARNING.",
      variant: "warning",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requiresTrigger: "structural_fail",
      afterEffect: {
        delayMs: 400,
        triggerId: "mw_hyd_cancelled",
        effects: [{ type: "SET_MASTER_WARN", active: false }],
      },
    },
    {
      id: "maintain_control",
      label: "FLY THE AIRCRAFT",
      action: "MAINTAIN CONTROL",
      hint: "PF: AVIATE.  F/CTL has reverted to ALTERNATE LAW — PROT LOST.  Keep wings level, smooth inputs.  Aircraft retains ailerons + roll spoilers from BLUE system but stabilizer, flaps, yaw damper, AP all INOP.  Do NOT make abrupt or full-deflection control inputs.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      flashSurface: "pfd",
      flashMsg: "AVIATE",
      requires: ["cancel_master_warn"],
    },
    // ── NAVIGATE → COMMUNICATE → ECAM ACTIONS (FCTM airmanship order, before pumps).
    //    Content FCOM/FCTM-sourced — FLAGGED FOR SME REVIEW. ──
    {
      id: "request_routing",
      label: "NAVIGATE",
      action: "DIVERT / ROUTING",
      hint: "PM: NAVIGATE — plan to track 2 NM right of the airway in coordination with ATC, and prepare to divert to the nearest suitable airport with adequate runway.",
      variant: "advisory",
      crew: "PM",
      group: "flightcheck",
      flashSurface: "nd",
      flashMsg: "NAVIGATE",
      requires: ["maintain_control"],
    },
    {
      id: "declare_mayday",
      label: "COMMUNICATE",
      action: "MAYDAY",
      hint: "PM: COMMUNICATE — declare MAYDAY to ATC (callsign, DUAL HYD failure). State intentions: descent, 2 NM right offset from the airway, and descend to FL200.",
      variant: "warning",
      crew: "PM",
      group: "comms",
      flashSurface: "comms",
      requires: ["request_routing"],
    },
    {
      // Internal gate (optional → never shown as a next action): completed when the crew
      // reads back the ATC MAYDAY acknowledgement (atc_mayday_ack). Unlocks the DESCENT card,
      // so the descent only begins AFTER the declaration → ATC ack → read-back exchange.
      id: "mayday_ack",
      label: "MAYDAY ACK",
      action: "READBACK",
      hint: "ATC acknowledged the MAYDAY and cleared the 2 NM right offset + descent to FL200; crew reads it back.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      optional: true,
      requires: ["declare_mayday"],
    },
    {
      id: "start_descent",
      label: "DESCENT",
      action: "FL200 · 2 NM R OFFSET",
      hint: "PF: ATC cleared — begin descent to FL200 @ 3000 fpm on the 2 NM right offset. Monitor PFD + ND.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      flashSurface: "pfd",
      flashMsg: "DESCENT",
      requires: ["mayday_ack"],
    },
    {
      // Hidden gate — completed by the ATC "descend 10000" call (atc_descend_10000)
      // when passing FL220.  Once set, the PFD continues the descent to 10 000 ft
      // (FCU selected alt → 10 000) and the PFD flashes the new clearance.
      id: "cleared_10000",
      label: "CLEARED 10 000 FT",
      action: "CONTINUE DESCENT",
      hint: "ATC cleared continued descent to 10 000 ft (passing FL220). PF continues the descent; FMA OPEN DES · NAV.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      flashSurface: "pfd",
      flashMsg: "DESCENT 10 000",
      optional: true,
      requires: ["start_descent"],
    },
    {
      id: "ecam_actions",
      label: "ECAM ACTIONS",
      action: "COMMAND",
      hint: "PF: aircraft under control, navigated, MAYDAY declared → command ECAM ACTIONS by pressing the ECAM.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      flashSurface: "firepanel",
      hardware: true,   // completed by pressing the ECAM (no procedure CONFIRM card)
      requires: ["start_descent"],
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
      requires: ["ecam_actions"],
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
    // ── MANEUVER WITH CARE — part of the MAIN ECAM, reviewed BEFORE the
    //    secondary failures (design note: it belongs to the ECAM drill).
    {
      id: "speed_set",
      label: "MANEUVER WITH CARE",
      action: "MAX 320/0.77",
      hint: "PF: announces 'MANEUVER WITH CARE.' Apply MAX SPEED 320 KT / 0.77. F/CTL in ALTERNATE LAW (PROT LOST) — smooth, modest sidestick inputs only. Ailerons + elevator available on BLUE; spoilers limited to 1/wing. Slats slow. Loss of high-speed protection is the reason for the speed limit.",
      variant: "switch",
      crew: "PF",
      requires: ["yel_elec_pump_on"],
    },
    // ── SECONDARY FAILURES — reviewed ON the SD PAGE-CHECK cards (the secondary
    //    failure is read off the SD page during the check).  LAND ASAP (red
    //    directive) → FLIGHT CONTROL PAGE CHECK (carries * F/CTL) → WHEEL PAGE
    //    CHECK (carries * WHEEL).  FCOM PRO-ABN-HYD lists * F/CTL and * WHEEL as
    //    secondary failures.  FLAGGED FOR SME REVIEW.
    {
      id: "land_asap_card",
      label: "LAND ASAP",
      action: "ACKNOWLEDGE",
      hint: "PM/PF: LAND ASAP (red) — land at the nearest airport where a safe landing can be made. MAYDAY has already been declared.",
      variant: "warning",
      crew: "PM",
      group: "chclm",
      requires: ["speed_set"],
    },
    {
      id: "fctl_check",
      label: "FLIGHT CONTROL PAGE CHECK",
      action: "CONFIRM",
      hint: "PM: review the F/CTL page on the SD — this is where the * F/CTL secondary failure is read.  Ailerons + elevator available (Blue); STABILIZER + YAW DAMPER + FLAPS INOP; spoilers 1/wing.  F/CTL ALTN LAW (PROT LOST); DIRECT LAW after L/G DN.  MAN PITCH TRIM NOT used in G+Y SYS LO PR (stabilizer inop).  PF cross-checks.",
      variant: "switch",
      crew: "PM",
      requires: ["land_asap_card"],
      notes: [
        "* F/CTL (secondary) — Flight controls degraded.  ALTN LAW (PROT LOST): only load factor limitation + hi/lo speed stability remain.  STABILIZER, YAW DAMPER, AP 1+2 all INOP.  Ailerons + Elevator AVAIL (Blue).  Spoilers: 1 per wing only.  Slats slow only; FLAPS INOP.  DIRECT LAW when L/G DN.  MAX SPEED 320 KT / 0.77.  MANEUVER WITH CARE.",
      ],
    },
    {
      id: "wheel_check",
      label: "WHEEL PAGE CHECK",
      action: "CONFIRM",
      hint: "PM: review the WHEEL page on the SD — this is where the * WHEEL secondary failure is read.  Braking & steering degraded.  PF cross-checks.",
      variant: "switch",
      crew: "PM",
      requires: ["fctl_check"],
      notes: [
        "* WHEEL (secondary) — Braking & steering degraded.  NORMAL brakes INOP, ANTI SKID INOP, NW STEERING INOP, AUTO BRAKE INOP, L/G RETRACTION INOP.  Gear extension by GRAVITY only.  Yellow accumulator brakes: ~7 full applications available, MAX BRK PR 1 000 PSI.",
      ],
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
      requires: ["wheel_check"],
      afterEffect: {
        delayMs: 300,
        triggerId: "mc_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
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
      requires: ["cancel_master_caut"],
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
    },
    {
      id: "status_read_aloud",
      label: "STATUS — PM READS",
      action: "REVIEW",
      hint: "PM reads each STATUS limitation/memo line aloud; PF: 'CHECKED' after each. (INOP SYS list is on its own card next.)",
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
        "FUEL CONSUMPT INCRSD",
        "FMS PRED UNRELIABLE",
        "SLATS SLOW",
      ],
    },
    // INOP SYS — its own card, separate from the STATUS limitations read.
    {
      id: "inop_sys_card",
      label: "STATUS — INOP SYS",
      action: "REVIEW",
      hint: "PM reads the INOP SYS list from the STATUS page; PF cross-checks.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["status_read_aloud"],
      notes: [
        "G+Y HYD · F/CTL PROT · STABILIZER · REVERSER 1+2 · SPLR 1+2+4+5 · FLAPS · LAF · YAW DAMPER · AP 1+2 · ANTI SKID · N/W STRG · NORM BRK · AUTO BRK · L/G RETRACT · CARGO DOOR (if Y RSVR LO LVL) · CAT 2 · GLS AUTOLAND · STEEP APPR",
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
      requires: ["inop_sys_card"],
    },

    // ── QRH SUMMARY — first thing after ECAM ACTIONS COMPLETE ─────────────────
    // A320 QRH HYD G+Y SYS LO PR SUMMARY (Rev 25 MAY 22, p.29.03A), read verbatim
    // before performance/decision.  FLAGGED FOR SME REVIEW.
    {
      id: "qrh_summary_gy",
      label: "QRH SUMMARY — CRUISE",
      action: "READ",
      hint: "PM reads the CRUISE part of the QRH HYD G+Y SYS LO PR summary aloud; PF cross-checks.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["crew_crosscheck"],
      notes: [
        "SPD BRK: DO NOT USE.  MAX SPD 320 / 0.77.  MANEUVER WITH CARE.  NO STABILIZER.  ALTN LAW: PROT LOST.  FUEL: increased consumption.  Landing performance: use the EFB LDG PERF application.",
      ],
    },

    // Hidden gate — completed by the ATC weather delivery card (completesStep).
    // Keeps the procedure paused (no card) through the whole weather exchange:
    // QRH cruise summary → request wx → ATC wx → readback → THEN landing perf.
    {
      id: "weather_obtained",
      label: "WEATHER OBTAINED",
      action: "CONFIRM",
      hint: "Weather, runway in use and approach type obtained and read back to ATC.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      optional: true,
      requires: ["qrh_summary_gy"],
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
      requires: ["weather_obtained"],
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
      hint: "Pilot-initiated call to ATC, made AFTER the landing distance is computed (ldg_perf). PM: 'Mumbai Control, IFLY101 — request immediate vectors VABB runway 27.' States the diversion intention only — weather / runway in use / approach type were already obtained in the earlier weather exchange that follows the QRH summary read.",
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
    // ── FMC PREP — 3 cards: (1) FMC  (2) QRH review  (3) action-panel flaps+GPWS ──
    {
      id: "fmgc_prep",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: F-PLN — insert DEST VABB.  Select RWY 27, insert ILS frequency + course.  Set VAPP = VREF +25 kt (FLAP 3).  Check fuel vs DEST + FINAL RESERVE 30 min — declare on frequency if not adequate.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["inform_atc_intentions"],
    },
    {
      id: "qrh_review",
      label: "QRH REVIEW — APPR / LDG / GO-AROUND",
      action: "REVIEW",
      hint: "PM/PF REVIEW (not read aloud) the APPROACH / LANDING / GO-AROUND parts of the QRH HYD G+Y SYS LO PR summary during FMC prep. (CRUISE part was read earlier.)",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["fmgc_prep"],
      notes: [
        "APPROACH — CAT 2 INOP.  SLATS SLOW / FLAPS JAMMED.  FOR LDG: USE FLAP 3.  GPWS FLAP MODE: OFF.  Flaps ext SPD SEL: VFE NEXT − 5 kt.  CONF 3: decelerate to calculated VAPP.  CONF 3 + VAPP: stabilize at VAPP before L/G down (trim reference).",
        "L/G GRAVITY EXTN — handcrank PULL AND TURN (rotate clockwise 3 turns to mechanical stop).  L/G LEVER: DOWN.  GEAR DOWN: CHECK.  Disregard 'USE MAN PITCH TRIM' (MAN TRIM unusable).",
        "LANDING — pitch authority reduced (no stabilizer).  Only 1 spoiler per wing (Direct law).  NO REVERSER.  BRK Y ACCU PR ONLY (7 applications), MAX BRK PR 1 000 PSI.  NO NOSEWHEEL STEERING.",
        "GO-AROUND — NO GEAR RETRACTION.  FUEL: increased consumption.  Circuit: maintain slats/flaps, speed close to VAPP.  Diversion (flaps jammed 0): clean config, maintain ≥ higher of VAPP or VLS.",
      ],
    },
    {
      id: "flap_check",
      label: "FLAPS",
      action: "CHECK — FAULT",
      hint: "Action panel: check the FLAPS pb — FAULT (flaps jammed / slow for G+Y).  The HYD action panel pops out again for this selection.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["qrh_review"],
    },
    {
      id: "gpws_flap_mode",
      label: "GPWS FLAP MODE",
      action: "OFF",
      hint: "Action panel: GPWS FLAP MODE pb → OFF — prevents a spurious GPWS 'TOO LOW FLAP' warning during the FLAP 3 landing.  Panel retracts 2 s after this selection.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["flap_check"],
    },
    {
      id: "nis_brief_hyd",
      label: "NITS BRIEF (SCCM)",
      action: "CONFIRM",
      hint: "Captain conducts the NITS brief on the interphone with the Senior Cabin Crew Member (SCCM).  If aircraft state allows and the FO can fly comfortably for a few minutes (aircraft trimmed, stable), Captain temporarily transfers control — 'YOU HAVE CONTROL' — does the brief, then 'I HAVE CONTROL' back.  Otherwise the brief is delegated to the FO.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["gpws_flap_mode"],
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
      id: "atc_emergency_svcs",
      label: "ATC — EMERGENCY SERVICES",
      action: "ADVISE",
      hint: "PM reads this, then makes the radio call (next ATC card): request FULL EMERGENCY SERVICES for runway 27, and advise the aircraft will be UNABLE TO VACATE the runway (nose-wheel steering INOP). SQUAWK MAYDAY 7700 if not already. Keep it concise — ATC does not need the full technical aircraft status.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["inform_company"],
    },

    // ── APPROACH PHASE ── (PREP before BRIEF) ─────────────────────────────────
    {
      id: "approach_prep_hyd",
      label: "APPROACH PREPARATION",
      action: "COMPLETE",
      hint: "PM: set ILS 27 manually on RMP 1 (auto-tune may not match selected RWY in FMGC).  Set BARO QNH.  Set MDA/DH per chart.  Verify auto-brake selector → OFF (auto-brake INOP).  Spoilers ARM (still arms, but G+Y lost — only 1 SPLR/wing).  Landing lights ON.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["atc_emergency_svcs"],
    },
    // APPROACH BRIEFING — split into 3 cards (THE APPROACH / THE LANDING / THE GO-AROUND),
    // mirroring the FCTM/QRH phase structure (vault §5.3/5.4/5.5).
    // NOTE: id "approach_brief_hyd" is preserved — the PFD buildAircraftState() gates its
    // "On ILS" state (SPEED·G/S·LOC, VMAX 230, RA shown) on this exact id. Do not rename.
    {
      id: "approach_brief_hyd",
      label: "APPROACH BRIEFING · THE APPROACH (1/3)",
      action: "COMPLETE",
      hint: "PF leads the approach briefing — PART 1: how the approach will be flown.  ILS RWY 27, MDA/DH, VAPP = VREF+25 kt, hand-flown (AP 1+2 INOP; FD + A/THR available, A/THR stays ON).  Request a LONG FINAL to give time to stabilize at VAPP before the late gravity-gear extension.  Plan to be stabilized by a platform ~2500 ft AAL so the trim reference is set before gear.  GPWS FLAP MODE OFF (already done).",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["approach_prep_hyd"],
      notes: [
        "Approach type: ILS RWY 27 — hand-flown (AP 1+2 INOP; FD + A/THR available).",
        "Speed: VAPP = VREF + 25 kt (increased — flaps INOP; FLAP 3 is the final config).",
        "A/THR: keep ON (for G+Y it is NOT set to OFF, unlike the G+B case). Helps hold VAPP for the trim-reference-before-gear technique.",
        "Trim reference: stabilize at VAPP FIRST, THEN gravity gear (DIRECT LAW activates at L/G DN).",
        "DRAFT (SME review): request a LONG FINAL / extended track miles — gives time to fully stabilize at VAPP before the late gravity-gear extension.",
        "DRAFT (SME review): plan a PLATFORM / level segment ~2500 ft AAL, stabilized at VAPP / CONF 3 before gear — airmanship to guarantee the trim reference is set.",
      ],
    },
    {
      id: "approach_brief_landing",
      label: "APPROACH BRIEFING · THE LANDING (2/3)",
      action: "COMPLETE",
      hint: "PF leads the approach briefing — PART 2: how the landing will be flown.  FLAP 3 final config (flaps INOP).  Gravity gear ONLY after stabilized at VAPP, CONF 3 — DIRECT LAW activates at L/G DN; disregard 'USE MAN PITCH TRIM'.  Yellow accumulator brakes only (~7 applications, MAX BRK PR 1000 PSI); no reverse, no anti-skid, no autobrake, no N/W steering.  Plan a long straight rollout; unable to vacate.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["approach_brief_hyd"],
      notes: [
        "Configuration: FLAP 3 (not FULL — flaps INOP for G+Y).",
        "Gear: gravity extension only, AFTER stabilized at VAPP / CONF 3 (preserves the trim reference).",
        "Control law: DIRECT LAW at L/G DN — DISREGARD the 'USE MAN PITCH TRIM' PFD message (FCTM: stabilizer lost, ref already memorized at VAPP).",
        "Braking: Yellow accumulator only (~7 applications, MAX BRK PR 1000 PSI); ANTI SKID + AUTO BRK + N/W STRG INOP.",
        "Reverse: INOP (REVERSER 1+2 INOP) — plan a long straight rollout; unable to vacate (request tow).",
        "DRAFT (SME review): TAIL-STRIKE / HIGH-NOSE awareness — a FLAP 3 landing flares at a higher pitch attitude; guard against over-rotation / tail strike.",
      ],
    },
    {
      id: "approach_brief_ga",
      label: "APPROACH BRIEFING · THE GO-AROUND (3/3)",
      action: "CONFIRM",
      hint: "PF leads the approach briefing — PART 3: the go-around plan.  Call 'GO AROUND, MAX REVERSE N/A, FOLLOW SRS'.  TOGA + SRS (both engines healthy).  LIMIT PITCH (no Alpha Floor); manage the pitch/power couple manually (no stabilizer / auto-trim).  Gear STAYS DOWN (retraction INOP) — extra drag, trim for positive climb.  Maintain VAPP, build to green dot only after positive climb.  Minimum bank ≤15°.  Stays in DIRECT LAW.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["approach_brief_landing"],
      notes: [
        "Call: 'GO AROUND, MAX REVERSE N/A, FOLLOW SRS' — 'GO AROUND FLAPS' is non-standard (already at max lift).",
        "TOGA: both engines healthy → TOGA + SRS gives positive climb. LIMIT PITCH — no Alpha Floor.",
        "DRAFT (SME review): PITCH/POWER COUPLE — with the stabilizer lost (no auto-trim), anticipate and manually counter the nose-up pitching moment from thrust application; trim continuously through the maneuver.",
        "Gear: STAYS DOWN (L/G RETRACTION INOP) — expect extra drag; trim for positive climb.",
        "Speed / turn: maintain VAPP → green dot only after positive climb; minimum bank ≤15° (degraded law).",
      ],
    },
    {
      id: "approach_cl_hyd",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs the approach checklist — note items affected by dual-hyd config.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_brief_ga"],
      notes: [
        "BARO .............. QNH SET",
        "MDA / DH .......... SET",
        "ECAM STATUS ....... REVIEWED  (DUAL HYD LO PR APPR PROC reviewed)",
        "MIN FUEL .......... CHECKED",
        "SEAT BELTS ........ ON",
        "AUTOBRAKE ......... OFF  (INOP — accumulator brakes only)",
        "SPOILERS .......... ARM  (1 SPLR/wing, but arm anyway)",
        "GPWS FLAP MODE .... OFF  (done at FMC prep)",
        "LANDING LIGHTS .... ON",
        "CABIN ............. ADVISED — BRACE BRIEF complete",
      ],
    },
    // CONFIGURE FOR APPROACH + GEAR GRAVITY — both AFTER ATC clears the ILS.
    {
      id: "configure_for_approach",
      label: "CONFIGURE FOR APPROACH",
      action: "FLAP 3 · VAPP",
      hint: "After ATC clears the ILS approach: PF configures — FLAP 3, decelerate to VAPP (VREF+25). Stabilize at VAPP BEFORE the gravity gear extension (sets the trim reference before DIRECT LAW).  Once established on the ILS the FMA reads SPEED · LOC · G/S (FD + A/THR).",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      requires: ["approach_cl_hyd"],
      notes: [
        "Established on ILS RWY 27 — FMA: SPEED · LOC · G/S, with FD + A/THR (AP INOP, hand-flown).",
        "Check VABB field elevation (≈ 39 ft AMSL) and the G/S intercept altitude for RWY 27.",
        "DRAFT (SME review): be fully stabilized at VAPP / CONF 3 by a platform ~2500 ft AAL before calling for the gravity gear (sets the trim reference before DIRECT LAW).",
      ],
    },
    {
      id: "lgr_gravity",
      label: "GEAR — GRAVITY EXTN",
      action: "DEPLOY AT VAPP",
      hint: "PM: ONLY after PF confirms STABILIZED AT VAPP, CONF 3.  GRVTY GEAR EXTN handcrank — PULL AND TURN: rotate the handle clockwise 3 turns until the mechanical stop.  L/G LEVER — DOWN.  GEAR DOWN — CHECK 3 GREENS.  At L/G DN the F/CTL reverts to DIRECT LAW — the mean elevator position at that moment becomes the centered-stick reference, so being trimmed at VAPP before gear ensures the correct reference.  Disregard 'USE MAN PITCH TRIM' (MAN TRIM unusable).",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["configure_for_approach"],
    },
    {
      id: "landing_cl_hyd",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs the landing checklist once STABILISED and GEAR DOWN (gravity-extended).",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["lgr_gravity"],
      notes: [
        "GEAR: GRAVITY EXTN — DOWN, 3 GREENS",
        "FLAPS: CONF 3 (VREF+25 kt)",
        "EXPECT: direct law after gear down, accumulator brakes, long rollout, max reverse N/A",
        "USE MAN PITCH TRIM warning after L/G DN — DISREGARD",
      ],
    },

    // Hidden gate — completed by the ATC "cleared to land" card (completesStep).
    // Holds REQUEST TAXI TO STAND until ALL after-landing ATC calls (established
    // report → tower contact → cleared to land) are complete, so the taxi
    // request is genuinely the LAST action in the scenario.
    {
      id: "ldg_clearance_done",
      label: "LANDING CLEARANCE",
      action: "CONFIRM",
      hint: "Landing clearance received from Tower and read back — all approach/landing ATC calls complete.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      optional: true,
      requires: ["landing_cl_hyd"],
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
      requires: ["ldg_clearance_done"],
      notes: [
        "Call: 'Mumbai Tower, IFLY101 — landed and stopped on runway 27. Confirm parking brake set, no immediate evacuation. Nose-wheel steering inoperative — request tow or follow-me to clear runway and proceed to remote stand.'",
        "PARK BRK may be INOP (FCOM note — yellow accumulator low pressure after a Y failure). If park brake does not hold, keep pedal brakes applied (accumulator pressure, limited applications) and chock as soon as ground crew arrives.",
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
    { id: "st_inop_cargo",line: "CARGO DOOR",          severity: "caution",  inopSys: true },
    { id: "st_inop_cat2", line: "CAT 2",               severity: "caution",  inopSys: true },
    { id: "st_inop_gls",  line: "GLS AUTOLAND",        severity: "caution",  inopSys: true },
    { id: "st_inop_steep",line: "STEEP APPR",          severity: "caution",  inopSys: true },
  ],

  // ── QRH SUMMARY (Context Display "QRH" tab) ──────────────────────────────────
  // A320 QRH "HYD G + Y SYS LO PR SUMMARY" — transcribed from the handbook page
  // (CRUISE / APPROACH / LANDING / GO-AROUND). Severity = warning (Level 3, LAND
  // ASAP) → red title end-caps. DRAFT — FLAGGED FOR SME REVIEW.
  // NOTE: "SPD BRK: DO NOT USE" is deliberately NOT included here — the G+Y
  // summary does not list it (it is a G+B item). The legacy step note still
  // carries it pending the user's SME call.
  qrhSummary: {
    title: "HYD G + Y SYS LO PR SUMMARY",
    severity: "warning",
    sections: [
      {
        title: "CRUISE",
        lines: [
          { row: { label: "MAX SPD", value: "320 / 0.77" } },
          { para: [{ text: "MANEUVER WITH CARE" }] },
          { para: [{ text: "NO STABILIZER" }] },
          { para: [{ text: "ALTN LAW :   PROT LOST" }] },
          { para: [
            { text: "FUEL:", b: true },
            { text: "  Increased fuel consumption " },
            { text: "(Refer to QRH PER-B)", i: true },
          ] },
          { para: [
            { text: "For " },
            { text: "Landing Performance", b: true },
            { text: " assessment, " },
            { text: "Refer to QRH PER-C", i: true },
            { text: ", or use the LDG PERF application of FlySmart with Airbus." },
          ] },
        ],
      },
      {
        title: "APPROACH",
        lines: [
          { para: [{ text: "CAT 2 INOP" }] },
          { para: [{ text: "SLATS SLOW / FLAPS JAMMED" }] },
          { row: { label: "FOR LANDING", value: "USE FLAP 3" } },
          { row: { label: "GPWS FLAP MODE", value: "OFF" } },
          { head: "For Flaps extension:" },
          { row: { label: "SPD SEL", value: "VFE NEXT − 5 kt" }, indent: 1 },
          { head: "When in CONF 3:" },
          { para: [{ text: "DECELERATE TO CALCULATED VAPP" }], indent: 1 },
          { head: "When in CONF 3 and VAPP:" },
          { para: [{ text: "Stabilize at VAPP before L/G down, to be trimmed for approach" }], indent: 1 },
          { head: "L/G gravity extension:" },
          { row: { label: "GRVTY GEAR EXTN handcrank", value: "PULL AND TURN" }, indent: 1 },
          { para: [{ text: "(Rotate the handle clockwise 3 turns until mechanical stop)", i: true }], indent: 1 },
          { row: { label: "L/G LEVER", value: "DOWN" }, indent: 1 },
          { row: { label: "GEAR DOWN", value: "CHECK" }, indent: 1 },
          { para: [{ text: "Disregard “USE MANUAL PITCH TRIM”. MAN TRIM Unusable." }], indent: 1 },
        ],
      },
      {
        title: "LANDING",
        lines: [
          { para: [
            { text: "FLARE:", b: true },
            { text: " PITCH AUTHORITY REDUCED (No stabilizer). MAN TRIM Unusable." },
          ] },
          { para: [{ text: "When Flaps jammed close to zero, consider tailstrike clearance." }] },
          { para: [{ text: "Only 1 spoiler per wing – Direct law" }] },
          { row: { label: "SPOILERS", value: "Only 1 per wing" } },
          { para: [{ text: "NO REVERSER" }] },
          { row: { label: "BRAKING", value: "BRK Y ACCU PR ONLY (7 appl)" } },
          { row: { label: "MAX BRK PR", value: "1 000 PSI" } },
          { para: [{ text: "NO NOSEWHEEL STEERING" }] },
        ],
      },
      {
        title: "GO-AROUND",
        lines: [
          { para: [{ text: "NO GEAR RETRACTION" }] },
          { para: [
            { text: "FUEL:", b: true },
            { text: " Increased fuel consumption " },
            { text: "(Refer to QRH PER-B)", i: true },
          ] },
          { head: "For circuit:" },
          { para: [{ text: "MAINTAIN SLATS/FLAPS CONFIGURATION" }], indent: 1 },
          { para: [{ text: "Maintain speed close to VAPP (due to pitch trim unusable)" }], indent: 1 },
          { head: "For diversion:" },
          { para: [{ text: "If Flaps jammed at zero:", b: true }], indent: 1 },
          { para: [{ text: "SELECT CLEAN CONFIGURATION" }], indent: 2 },
          { para: [{ text: "Maintain at least the higher of VAPP or VLS (due to pitch trim unusable)" }], indent: 2 },
          { para: [{ text: "If Flaps jammed above zero:", b: true }], indent: 1 },
          { para: [{ text: "MAINTAIN SLATS/FLAPS CONFIGURATION" }], indent: 2 },
          { para: [{ text: "Maintain speed close to VAPP (due to pitch trim unusable)" }], indent: 2 },
        ],
      },
    ],
  },

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
      // CRUISE start — the PILOT initiates the emergency with the MAYDAY call (no ATC
      // check-in / handoff first). kind:"crew" → crew-initiated; NO standby option (atc-comms §0.9).
      id: "pm_mayday_declare",
      atMs: 0,
      gapAfterMs: 5_000,
      requiresStep: "request_routing",
      completesStep: "declare_mayday",
      kind: "crew",
      from: "PM → MUMBAI CONTROL",
      message: "Aircraft under control — PM initiates the emergency call to ATC.",
      choices: [
        // Correct — nature + heading + offset request + unable RVSM + descent request + standby
        // Heading states current navigation; offset gives lateral separation; descent exits RVSM block
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, heading 200, unable RVSM, request 2 miles right offset and descent flight level two zero zero, standby",  correct: true  },
        // Wrong — missing heading and offset; ATC cannot plan separation without navigation info
        { id: "b", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, unable RVSM, request descent flight level two zero zero, standby",                                          correct: false },
        // Wrong — airports and vectors in initial MAYDAY; intentions come after FORDEC
        { id: "d", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, maintaining FL350, request immediate vectors nearest suitable airport with 3 000 m runway, standby",        correct: false },
      ],
    },

    // ② ATC acknowledges MAYDAY — crew reads back BOTH offset and descent level
    {
      id: "atc_mayday_ack",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "declare_mayday",
      completesStep: "mayday_ack",
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, roger MAYDAY, radar contact. Maintain 2 miles right offset, descend flight level two zero zero.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — both items read back (offset is a safety separation instruction)
        { id: "a", label: "2 miles right offset, descending flight level two zero zero, IFLY101",  correct: true  },
        // Wrong — offset dropped (protects against conflicting traffic in RVSM block)
        { id: "b", label: "Descending flight level two zero zero, IFLY101",                         correct: false },
        // Wrong — bare acknowledgement
        { id: "c", label: "Roger IFLY101",                                                          correct: false },
      ],
    },

    // Passing FL220 on the descent (altitude-gated) — ATC extends the clearance
    // from FL200 down to 10 000 ft.  Fires when the live altitude descends ≤ 22 000.
    {
      id: "atc_descend_10000",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "start_descent",
      atAltitudeBelowFt: 22_000,
      completesStep: "cleared_10000",
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, descend and maintain 10000 feet, QNH 1013.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Descend and maintain 10000 feet, QNH 1013, IFLY101",  correct: true  },
        { id: "b", label: "Descending 10000 feet, IFLY101",                       correct: false },
        { id: "c", label: "Roger IFLY101",                                        correct: false },
      ],
    },

    // ③ After the HYD panel COLLAPSES (pumps done → speed_set) — ATC asks if
    //    assistance is required.  Crew is still busy → STANDBY.
    {
      id: "atc_assistance_req",
      atMs: 1_000,
      gapAfterMs: 45_000,
      requiresStep: "speed_set",
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, assistance required?",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Standby IFLY101",                                               correct: true  },
        { id: "b", label: "Request vectors nearest suitable airport, IFLY101",             correct: false },
        { id: "c", label: "Negative IFLY101",                                              correct: false },
      ],
    },

    // ④ ATC offers vectors — crew defers while still working the drill/status.
    {
      id: "atc_vectors_when_ready",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "speed_set",
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, vectors available when ready, descend at your discretion.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing checklist, will advise when ready, IFLY101", correct: true  },
        { id: "b", label: "Standby IFLY101",                                        correct: true  },
        { id: "c", label: "IFLY101, turn left direct Mumbai, descend FL100",        correct: false },
      ],
    },

    // ⑤ ECAM complete + QRH cruise summary read — crew requests Mumbai weather
    // Kind:"crew" — deliberate crew-initiated call; no standby option.
    {
      id: "atc_weather_request",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "qrh_summary_gy",
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
      atMs: 1_000,
      requiresStep: "qrh_summary_gy",
      completesStep: "weather_obtained",
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

    // ⑦ Advise intentions — FORDEC complete; commit to VABB (training test: VAAH too short)
    // Kind:"crew" — deliberate crew-initiated call. gapAfterMs 30 s → HOLD request next.
    {
      id: "atc_intentions_advise",
      atMs: 1_000,
      gapAfterMs: 30_000,
      requiresStep: "fordec_hyd",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "FORDEC complete. Advise intentions to ATC.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — VABB RWY 27 (3 445 m): adequate for flapless + accumulator-brake landing
        { id: "a", label: "Mumbai Approach, IFLY101, diverting Mumbai, request vectors ILS runway 27",  correct: true  },
        // Wrong — VAAH RWY 23 (2 743 m): insufficient for flapless with accumulator brakes only
        { id: "b", label: "Mumbai Approach, IFLY101, diverting Ahmedabad, request vectors runway 23",                   correct: false },
        // Wrong — no clear divert decision communicated to ATC
        { id: "c", label: "Mumbai Approach, IFLY101, requesting descent 3 000 feet",                                    correct: false },
      ],
    },

    // ⑧ Request hold — ~30 s after intentions; crew needs time for prep.
    {
      id: "atc_hold_req",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "inform_atc_intentions",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Request holding from Mumbai Approach.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, request holding, two-minute legs, require time for crew coordination and approach preparation",  correct: true  },
        { id: "b", label: "Mumbai Approach, IFLY101, request descent 3 000 feet, vectors ILS runway 27",                            correct: false },
        { id: "c", label: "Mumbai Approach, IFLY101, not ready, continuing on track",                                                correct: false },
      ],
    },

    // ⑨ ATC issues hold clearance — full readback. gapAfterMs 30 s → POB next.
    {
      id: "atc_hold_clr",
      atMs: 1_000,
      gapAfterMs: 30_000,
      requiresStep: "inform_atc_intentions",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, hold SAPAV, maintain 7 000 feet, left-hand pattern, two-minute legs, expect further clearance time 25.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Hold SAPAV, 7 000 feet, left-hand, two-minute legs, IFLY101",  correct: true  },
        { id: "b", label: "Hold SAPAV, left-hand, IFLY101",               correct: false },
        { id: "c", label: "Roger IFLY101",                                 correct: false },
      ],
    },

    // ⑩ ATC asks POB + endurance — ~30 s after hold clearance; facts only.
    {
      id: "atc_pob_fuel_services",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "inform_atc_intentions",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — POB + fuel + endurance; no technical aircraft status (ATC does not need it)
        { id: "a", label: "186 persons on board, 12 tonnes fuel, endurance 2 hours 30, IFLY101",                                                                                              correct: true  },
        { id: "b", label: "Standby IFLY101",                                                                                                                                                  correct: false },
        { id: "c", label: "IFLY101, 186 POB, standard approach",                                                                                                                              correct: false },
      ],
    },

    // ⑪ Emergency services — fires off the ATC-EMERGENCY-SERVICES procedure card.
    //    Crew requests full emergency services AND advises they will be unable to
    //    vacate the runway (nose-wheel steering INOP).
    {
      id: "atc_emg_services_req",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "atc_emergency_svcs",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Request emergency services for runway 27, and advise the runway-vacate situation.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — full emergency services + the operationally-relevant fact that
        // the runway cannot be vacated (no nose-wheel steering).
        { id: "a", label: "Mumbai Approach, IFLY101, request full emergency services runway 27, and advise we will be unable to vacate the runway — nose-wheel steering inoperative",  correct: true  },
        // Wrong — omits the unable-to-vacate advice ATC needs to plan the runway closure
        { id: "b", label: "Mumbai Approach, IFLY101, request full emergency services runway 27",                                                                                       correct: false },
        // Wrong — piecemeal; "fire trucks only" is not "full emergency services"
        { id: "c", label: "Mumbai Approach, IFLY101, request fire trucks and foam runway 27",                                                                                          correct: false },
      ],
    },

    // ⑫ Ready for approach — only AFTER the approach checklist is complete.
    {
      id: "atc_ready_for_approach",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "approach_cl_hyd",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, advise when ready for approach.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY101 ready, request vectors ILS runway 27, and request a long final",  correct: true  },
        { id: "b", label: "Ready, IFLY101",                                                                       correct: false },
        { id: "c", label: "Standby IFLY101",                                                                      correct: false },
      ],
    },

    // ⑬ ILS clearance + "advise when stabilised" — full readback.
    {
      id: "atc_cleared_approach",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "approach_cl_hyd",
      kind: "atc",
      from: "MUMBAI APPROACH",
      pilotSays: "Mumbai Approach, IFLY101, ready for the approach, request vectors for ILS runway 27.",
      message: "IFLY101, roger, turn left heading 240, descend 3 000 feet, cleared ILS runway 27 approach, advise when stabilised, contact Mumbai Tower 118.10 when established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 27, will advise when stabilised, contact Tower 118.10, IFLY101",  correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                                                          correct: false },
        { id: "c", label: "Cleared ILS runway 27, IFLY101",                                                                                        correct: false },
      ],
    },

    // ⑭ Crew reports STABILISED ON ILS — after GEAR GRAVITY EXTENSION. Crew-initiated.
    {
      id: "atc_stabilised_report",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "lgr_gravity",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Stabilised on the ILS — advise ATC.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, stabilised on the ILS runway 27",  correct: true  },
        { id: "b", label: "Stabilised, IFLY101",                                                           correct: false },
        { id: "c", label: "Continuing approach, IFLY101",                                                  correct: false },
      ],
    },

    // ⑮ Crew reports ESTABLISHED ON ILS — after the LANDING CHECKLIST. Crew-initiated.
    {
      id: "atc_established_report",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "landing_cl_hyd",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Landing checklist complete — report established on the ILS.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, established on the ILS runway 27, landing checklist complete",  correct: true  },
        { id: "b", label: "Established, IFLY101",                                                                      correct: false },
        { id: "c", label: "Roger IFLY101",                                                                            correct: false },
      ],
    },

    // ⑯ Tower changeover — after ESTABLISHED report. Tower takes over.
    {
      id: "atc_tower_contact",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "landing_cl_hyd",
      kind: "atc",
      from: "MUMBAI TOWER",
      pilotSays: "Mumbai Tower, IFLY101, established and stabilised ILS runway 27.",
      message: "IFLY101, Mumbai Tower, roger, continue ILS approach runway 27, report established, emergency services on standby.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 27, will report established, IFLY101",  correct: true  },
        { id: "b", label: "Switching, IFLY101",                                           correct: false },
      ],
    },

    // ⑯ Cleared to land — Tower, after the changeover.
    {
      id: "atc_cleared_to_land",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "landing_cl_hyd",
      completesStep: "ldg_clearance_done",
      kind: "atc",
      from: "MUMBAI TOWER",
      pilotSays: "Mumbai Tower, IFLY101, stabilised, runway 27.",
      message: "IFLY101, runway 27 cleared to land, wind 270 at 6, ARFF in position, long rollout acknowledged.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Cleared to land runway 27, IFLY101",  correct: true  },
        { id: "b", label: "Roger IFLY101",                        correct: false },
        // Wrong — runway mis-readback under stress
        { id: "c", label: "Cleared to land runway 28, IFLY101",  correct: false },
      ],
    },

    // ⑰ After full stop — HOLD ON RUNWAY for ARFF to check tyres/brakes for fire.
    // (No taxi to stand yet — only after the emergency-services inspection.)
    {
      id: "atc_taxi_to_stand",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "request_taxi_to_stand",
      kind: "crew",
      from: "PM → MUMBAI TOWER",
      message: "After full stop, all actions/procedures complete — advise ATC, hold position for ARFF inspection.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — hold on runway, request ARFF to check tyres/brakes for fire BEFORE any taxi
        { id: "a", label: "Mumbai Tower, IFLY101, holding position runway 27, request emergency services inspect tyres and brakes for fire before we taxi",  correct: true  },
        // Wrong — requesting taxi before the ARFF fire check
        { id: "b", label: "Mumbai Tower, IFLY101, request taxi to stand",                                                                                       correct: false },
        // Wrong — moving with no NW steering and no ARFF check
        { id: "c", label: "Vacating runway 27 to the left, IFLY101",                                                                                            correct: false },
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
    // Render the real HYD overhead 3D panel as the Action Panel (mirrors the ENG-FIRE
    // panel logic), pumps wired to the PRO-ABN-HYD G+Y procedure steps.
    panel3d: "hyd",
    hydMap: {
      ptu:        "ptu_off",
      eng1:       "grn_eng1_pump_off",
      eng2:       "yel_eng2_pump_off",
      yellowElec: "yel_elec_pump_on",
    },
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
          title: "ENG 1",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "N1",     unit: "%",    states: [{ value: { v: "84.2",   c: "green" } }] },
            { label: "EGT",    unit: "°C",   states: [{ value: { v: "620",    c: "green" } }] },
            { label: "FF",     unit: "KG/H", states: [{ value: { v: "2400",   c: "green" } }] },
            { label: "STATUS",               states: [{ value: { v: "NORMAL", c: "green" } }] },
          ],
        },
        {
          title: "ENG 2",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "N1",     unit: "%",    states: [{ value: { v: "84.2",   c: "green" } }] },
            { label: "EGT",    unit: "°C",   states: [{ value: { v: "618",    c: "green" } }] },
            { label: "FF",     unit: "KG/H", states: [{ value: { v: "2350",   c: "green" } }] },
            { label: "STATUS",               states: [{ value: { v: "NORMAL", c: "green" } }] },
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
      // ECAM ACTION PANEL — mirrors the FIRE scenario's "FIRE PANEL" tray: the
      // HYD overhead pushbuttons the crew presses during the ECAM drill, each
      // flipping as its step is completed. (Blue system + RAT status is shown in
      // the BLUE SYS section above.) FCOM PRO-ABN-HYD: RAT does NOT deploy for a
      // pure G+Y loss — blue stays on its ELEC pump.
      tray: {
        title: "HYD PANEL — ECAM ACTIONS",
        note: "FCOM PRO-ABN-HYD: PTU OFF → G ENG 1 PUMP OFF → Y ENG 2 PUMP OFF → Y ELEC PUMP ON (Y lost by ENG 2 PUMP LO PR — ELEC pump charges the accumulator, ~7 full brake applications).",
        switches: [
          {
            label: "PTU", sub: "OFF",
            states: [
              { when: { step: "ptu_off" }, value: "off" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "ENG 1", sub: "PUMP OFF",
            states: [
              { when: { step: "grn_eng1_pump_off" }, value: "off" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "ENG 2", sub: "PUMP OFF",
            states: [
              { when: { step: "yel_eng2_pump_off" }, value: "off" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "Y ELEC", sub: "PUMP ON",
            states: [
              { when: { step: "yel_elec_pump_on" }, value: "auto" as const },
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
