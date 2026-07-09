import type { Scenario } from "@/scenarios/types";
import { DUAL_HYD_G_Y_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-HYD p.21  : DUAL HYD G+Y LO PR — in-flight procedure
// FCOM DSC-29            : Hydraulic system architecture
// FCTM ABN-020           : Hydraulic failure technique

export const dualHydGY: Scenario = {
  meta: DUAL_HYD_G_Y_META,
  additionalInfo: [
    {
      title: "How an abnormal is conducted (the FCTM spine)",
      body:
        "FLY → NAVIGATE → COMMUNICATE, in order, with tasksharing (Golden Rules). " +
        "The PF recovers a steady flight path; the crew identifies the situation; the PF then informs ATC + cabin of the situation and intentions.\n\n" +
        "ATC timing: memory items / immediate securing actions come FIRST (e.g. ENG FIRE secures the engine). " +
        "G+Y has none and the aircraft is controllable — so the crew DECLARES MAYDAY once under control, THEN orders ECAM ACTIONS.\n\n" +
        "ECAM handling: MASTER WARN RESET → announce title + confirm → \"ECAM ACTIONS\" → perform/clear → analyse SD → STATUS → STOP ECAM → read STATUS. " +
        "Approach prep + briefing are done at the appropriate flight phase.",
      source: { type: "fctm", ref: "FCTM AOP-40 (Golden Rules) + AOP-30-30 (ECAM handling)" },
      verified: true,
    },
    {
      title: "Why gear goes down LATE (trim reference before DIRECT law)",
      body:
        "Stabilizer is lost (G+Y), so at L/G DN the control law reverts to DIRECT and the mean elevator position at that moment becomes the centred-stick reference. " +
        "Therefore stabilise at VAPP / CONF 3 FIRST (ideally by a platform ~2500 ft AAL), THEN extend the gear by gravity — so the trim reference is correct. " +
        "Disregard the 'USE MAN PITCH TRIM' message (MAN TRIM unusable). A long final / extended track gives time to stabilise.",
      source: { type: "fctm", ref: "FCTM Dual Hydraulic (G+Y) Failure technique" },
      verified: false,
      smeReview: true,
    },
  ],
  brief: {
    situation:
      "Cruise FL350, VIDP–VABB. A turbine blade release has damaged both GREEN and YELLOW hydraulic return lines simultaneously — system pressure on both circuits drops below 1 450 PSI. HYD G+Y SYS LO PR warning fires (Level 3, red, CRC). Both engines and AC buses remain normal — BLUE system continues on its ELEC pump (RAT NOT deployed for pure G+Y loss). F/CTL reverts to ALTERNATE LAW (PROT LOST); STABILIZER, SPOILERS 1/2/4/5, FLAPS, YAW DAMPER, ANTI SKID and NW STEERING all INOP.",
    job: "Fly the aircraft first — alternate law, MANEUVER WITH CARE, MAX 320 KT / M.77. Run the HYD G+Y SYS LO PR ECAM PTU OFF → AFFECTED PUMPS OFF (GREEN ENG 1 + YELLOW ENG 2). PM declares MAYDAY to ATC once aircraft under control. Land FLAP 3 at VREF+25 kt; gravity gear extension AFTER stabilised at VAPP (so trim reference is set before direct law). Divert to nearest suitable airport with adequate runway.",
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
            // ── LEFT column — the exact E/WD tree we designed in
            //    ~/Desktop/01_Aviation/ewd_gy_model.html (the reference model).
            //    Order & wording verbatim; only the first 7 show (E/WD limit),
            //    MANEUVER WITH CARE + MAX SPEED overflow below the fold (↓ arrow).
            { id: "auto_flt_ap_off", line: "AUTO FLT AP OFF",           level: "warning"  }, // special red, underlined prefix, NOT boxed
            { id: "hyd_gy_lo",       line: "HYD G+Y SYS LO PR",          level: "warning"  }, // HYD prefix underlined + boxed failure name
            { id: "ecam_ptu_off",    line: "PTU..........OFF",           level: "advisory" }, // → step ptu_off
            { id: "ecam_g_pump",     line: "GREEN ENG 1 PUMP...OFF",     level: "advisory" }, // → step grn_eng1_pump_off
            { id: "ecam_y_pump",     line: "YELLOW ENG 2 PUMP..OFF",     level: "advisory" }, // → step yel_eng2_pump_off
            { id: "hyd_ptu_fault",   line: "HYD PTU FAULT",              level: "caution"  }, // amber, HYD underlined
            { id: "fctl_altn_law",   line: "F/CTL ALTN LAW (PROT LOST)", level: "caution"  }, // amber, F/CTL underlined
            { id: "ecam_manuv",      line: "MANEUVER WITH CARE",         level: "remark"   }, // white (overflow)
            { id: "ecam_max_speed",  line: "MAX SPEED..........320/.77", level: "advisory" }, // cyan limitation (overflow)
            // ── RIGHT column — LAND ASAP now; * WHEEL / * F/CTL secondaries
            //    appear after the main actions (afterEffect on yel_eng2_pump_off).
            { id: "land_asap",       line: "LAND ASAP",                  level: "warning"  },
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
      id: "maintain_control", category: "AVIATE", reference: "FCTM",
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
      id: "request_routing", category: "NAVIGATE", reference: "FCTM · TECHNIQUE",
      label: "NAVIGATE",
      action: "DIVERT / ROUTING",
      hint: "Plan to track 2 NM right of the airway in coordination with ATC, and prepare to divert to the nearest suitable airport with adequate runway.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      flashSurface: "nd",
      flashMsg: "NAVIGATE",
      requires: ["maintain_control"],
    },
    {
      id: "declare_mayday", category: "COMMS", reference: "TECHNIQUE",
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
      id: "mayday_ack", category: "COMMS", reference: "TECHNIQUE",
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
      id: "start_descent", category: "AVIATE", reference: "FCTM",
      label: "DESCENT",
      action: "FL200 · 2 NM R OFFSET",
      hint: "PF: ATC cleared — begin descent to FL200 on the 2 NM right offset. Monitor PFD + ND.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      flashSurface: "pfd",
      flashMsg: "DESCENT",
      requires: ["mayday_ack"],
    },
    {
      // Hidden gate — completed by the PM's descend-10 000 REQUEST (atc_descend_10000,
      // passing 22 000). Gates the ATC clearance card so the clearance follows the request.
      id: "descent_10k_requested", category: "COMMS", reference: "TECHNIQUE",
      label: "DESCENT 10 000 REQUESTED",
      action: "CONFIRM", hint: "PM requested descent to 10 000 ft (passing 22 000).",
      variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["start_descent"],
    },
    {
      // Hidden gate — completed by the ATC CLEARANCE read-back (atc_descend_10000_clr).
      id: "descent_10k_cleared", category: "COMMS", reference: "TECHNIQUE",
      label: "DESCENT 10 000 CLEARED",
      action: "CONFIRM", hint: "ATC cleared descent to 10 000 ft — read back complete.",
      variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["descent_10k_requested"],
    },
    {
      // VISIBLE PFD-SELECTION card (no CONFIRM) — AFTER the ATC clearance is read back, the PF
      // sets the FCU to 10 000; the FMA ALT window changes and (once the ECAM panel retracts)
      // the descent toward 10 000 begins [user 2026-06-30].
      id: "cleared_10000", category: "AVIATE", reference: "FCOM",
      label: "FCU — SELECT 10 000",
      action: "",
      hint: "ATC cleared 10 000 ft — PF sets the FCU altitude to 10 000.  FMA ALT window → 10 000; OPEN DES once the ECAM panel retracts.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      flashSurface: "pfd",
      flashMsg: "SELECT 10 000",
      requires: ["descent_10k_cleared"],
    },
    // ── ECAM analysis: announce the failure TITLE + verify the CAUSE on the SD before actions.
    //    HYD G+Y SYS LO PR here = reservoir LOW LEVEL (fluid lost), not a pump/PTU fault. Analyse-the-SD
    //    is FCTM (a320-ecam-philosophy §3 "SYSTEM PAGE DISPLAYED…ANALYSE"); the specific low-level cause
    //    read is technique. [user 2026-07-07]
    {
      id: "verify_hyd_cause", category: "ECAM", reference: "FCTM",
      label: "HYD G+Y SYS LO PR",
      action: "ANALYSE",
      hint: "HYD SD......ANALYSE. CAUSE......RSVR LO LVL.",
      variant: "warning",
      crew: "PM",
      requires: ["clear_auto_flt"],
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
      hint: "PM: HYD overhead — PTU pushbutton → OFF. PTU is the first ECAM action for G+Y loss; deactivate to prevent dry cycling.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_ptu_off",
      requires: ["verify_hyd_cause"],
    },
    {
      id: "grn_eng1_pump_off",
      label: "ENG 1 PUMP",
      action: "OFF",
      hint: "PM: HYD overhead — GREEN ENG 1 PUMP pushbutton → OFF. AFFECTED PUMPS OFF — GREEN system pressure unrecoverable; switch off to stop dry running.",
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
      hint: "PM: HYD overhead — YELLOW ENG 2 PUMP pushbutton → OFF. AFFECTED PUMPS OFF — YELLOW system pressure unrecoverable; switch off.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_y_pump",
      requires: ["grn_eng1_pump_off"],
      // Secondary failures fire after the LAST pump action. (This afterEffect
      // was on the removed YELLOW ELEC PUMP step — that pump is approach-only,
      // used when yellow is lost by ENG 2 PUMP LO PR / reservoir overheat; it's
      // deferred to the approach procedure — see a320-handling-dual-hyd §1337–1395.)
      afterEffect: {
        delayMs: 3_000,
        triggerId: "secondary_hyd",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              // Secondary failures appear AFTER main ECAM actions complete, in the
              // RIGHT column under LAND ASAP — order & wording per the reference
              // model (ewd_gy_model.html): LAND ASAP → * WHEEL → * F/CTL. The "*"
              // is the secondary-failure indicator (no "SECONDARY FAILURES" header).
              { id: "sec_wheel",     line: "* WHEEL",                    level: "caution"  },
              { id: "sec_fctl",      line: "* F/CTL",                    level: "caution"  },
            ],
          },
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },
    // ── MANEUVER WITH CARE — part of the MAIN ECAM, reviewed BEFORE the
    //    secondary failures (design note: it belongs to the ECAM drill).
    {
      id: "speed_set", category: "ECAM", reference: "FCOM",
      label: "MANEUVER WITH CARE",
      action: "MAX 320/0.77",
      hint: "PM READS the F/CTL alert: 'F/CTL ALTERNATE LAW, PROTECTION LOST — MANEUVER WITH CARE.' Apply MAX SPEED 320 KT / 0.77. Smooth, modest sidestick inputs only. Ailerons + elevator available on BLUE; spoilers limited to 1/wing. Slats slow. ALT LAW RETAINS only load-factor limitation + high/low-speed STABILITY — all other protections (bank/pitch/alpha/high-speed) are LOST; that lost high-speed protection is the reason for the speed limit.",
      variant: "caution",
      crew: "PM",
      requires: ["clear_hyd_ptu"],
      notes: [
        "ALTERNATE LAW keeps ONLY load-factor limitation + high-speed & low-speed STABILITY (not protection). Bank-angle, pitch, alpha-floor/prot and high-speed protection are LOST. [handling-dual-hyd]",
      ],
    },
    // ── ECAM CLR — clear the residual E/WD alerts, top-down, one card per alert
    //    (CLR clears the highest underlined procedure once its actions are
    //    done; the alert transfers to STATUS). These come BEFORE the LAND ASAP
    //    card. The F/CTL limitations (ALTN LAW / MANEUVER WITH CARE / MAX SPEED)
    //    already live on the STATUS page, so clearing them off the E/WD isn't lossy.
    {
      id: "clear_auto_flt", category: "ECAM", reference: "FCOM",
      label: "AUTO FLT AP OFF",
      action: "CONFIRM",
      hint: "PM: 'AUTO FLT AP OFF'. PM: 'CLEAR AUTO FLT?'. PF: 'CLEAR'. PM presses CLR.",
      variant: "warning",
      crew: "PM",
      // CLR is an ACTION (press CLR on the ECAM) → confirm card for now; a dedicated ECAM CLR panel replaces it later. [user 2026-07-06]
      requires: ["ecam_actions"],
      afterEffect: { delayMs: 200, triggerId: "cleared_auto_flt", effects: [{ type: "CLEAR_ECAM", ids: ["auto_flt_ap_off"] }] },
    },
    {
      id: "clear_hyd_gy", category: "ECAM", reference: "FCOM",
      label: "HYD G+Y SYS LO PR",
      action: "CONFIRM",
      hint: "PM: 'HYD G+Y SYS LO PR'. PM: 'CLEAR HYD?'. PF: 'CLEAR'. PM presses CLR.",
      variant: "warning",
      crew: "PM",
      requires: ["yel_eng2_pump_off"],
      afterEffect: { delayMs: 200, triggerId: "cleared_hyd_gy", effects: [{ type: "CLEAR_ECAM", ids: ["hyd_gy_lo"] }] },
    },
    {
      id: "clear_hyd_ptu", category: "ECAM", reference: "FCOM",
      label: "HYD PTU FAULT",
      action: "CONFIRM",
      hint: "PM: 'HYD PTU FAULT'. PM: 'CLEAR HYD?'. PF: 'CLEAR'. PM presses CLR.",
      variant: "caution",
      crew: "PM",
      requires: ["clear_hyd_gy"],
      afterEffect: { delayMs: 200, triggerId: "cleared_hyd_ptu", effects: [{ type: "CLEAR_ECAM", ids: ["hyd_ptu_fault"] }] },
    },
    {
      id: "clear_fctl", category: "ECAM", reference: "FCOM",
      label: "F/CTL ALTN LAW",
      action: "CONFIRM",
      hint: "PM: 'F/CTL ALTN LAW, PROT LOST — MANEUVER WITH CARE, MAX SPEED 320/0.77'. PM: 'CLEAR F/CTL?'. PF: 'CLEAR'. PM presses CLR.",
      variant: "caution",
      crew: "PM",
      requires: ["speed_set"],
      afterEffect: { delayMs: 200, triggerId: "cleared_fctl", effects: [{ type: "CLEAR_ECAM", ids: ["fctl_altn_law", "ecam_manuv", "ecam_max_speed"] }] },
    },
    // ── SECONDARY FAILURES — reviewed ON the SD PAGE-CHECK cards (the secondary
    //    failure is read off the SD page during the check).  ORDER = the ECAM SD
    //    page sequence (…DOOR → WHEEL → F/CTL): LAND ASAP (red directive) → WHEEL
    //    PAGE CHECK (carries * WHEEL) → FLIGHT CONTROL PAGE CHECK (carries * F/CTL).
    //    Matches the E/WD secondary-failure display (* WHEEL above * F/CTL) and the
    //    ewd_gy_model reference. [user 2026-07-05 — FCOM SD-page order]  SME REVIEW.
    {
      id: "land_asap_card", category: "ECAM", reference: "FCOM",
      label: "LAND ASAP",
      action: "ACKNOWLEDGE",
      hint: "PM/PF: LAND ASAP (red) — land at the nearest airport where a safe landing can be made. MAYDAY has already been declared.",
      variant: "warning",
      crew: "PM",
      group: "chclm",
      requires: ["clear_fctl"],
    },
    {
      id: "wheel_check", category: "ECAM", reference: "FCOM",
      label: "WHEEL PAGE",
      action: "CONFIRM",
      hint: "PM: review the WHEEL page on the SD — this is where the * WHEEL secondary failure is read.  Braking & steering degraded.  PF cross-checks.",
      variant: "switch",
      crew: "PM",
      requires: ["land_asap_card"],
      // [user 2026-07-05] SD-page order: WHEEL reviewed FIRST → clears the * WHEEL secondary
      // line from the E/WD (one page at a time; F/CTL follows).
      afterEffect: { delayMs: 200, triggerId: "checked_wheel", effects: [{ type: "CLEAR_ECAM", ids: ["sec_wheel"] }] },
      notes: [
        "* WHEEL (secondary) — Braking & steering degraded.  NORMAL brakes INOP, ANTI SKID INOP, NW STEERING INOP, AUTO BRAKE INOP, L/G RETRACTION INOP.  Gear extension by GRAVITY only.  Yellow accumulator brakes: ~7 full applications available, MAX BRK PR 1 000 PSI.",
      ],
    },
    {
      id: "fctl_check", category: "ECAM", reference: "FCOM",
      label: "FLIGHT CONTROL PAGE",
      action: "CONFIRM",
      hint: "PM: review the F/CTL page on the SD — this is where the * F/CTL secondary failure is read.  Ailerons + elevator available (Blue); STABILIZER + YAW DAMPER + FLAPS INOP; spoilers 1/wing.  F/CTL ALTN LAW (PROT LOST); DIRECT LAW after L/G DN.  MAN PITCH TRIM NOT used in G+Y SYS LO PR (stabilizer inop).  PF cross-checks.",
      variant: "switch",
      crew: "PM",
      requires: ["wheel_check"],
      // [user 2026-07-05] F/CTL reviewed SECOND → clears the * F/CTL secondary line from the E/WD.
      afterEffect: { delayMs: 200, triggerId: "checked_fctl", effects: [{ type: "CLEAR_ECAM", ids: ["sec_fctl"] }] },
      notes: [
        "* F/CTL (secondary) — Flight controls degraded.  ALTN LAW (PROT LOST): only load factor limitation + hi/lo speed stability remain.  STABILIZER, YAW DAMPER, AP 1+2 all INOP.  Ailerons + Elevator AVAIL (Blue).  Spoilers: 1 per wing only.  Slats slow only; FLAPS INOP.  DIRECT LAW when L/G DN.  MAX SPEED 320 KT / 0.77.  MANEUVER WITH CARE.",
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
      requires: ["fctl_check"],   // gate on the LAST page-check (WHEEL → F/CTL order) [user 2026-07-05]
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
      id: "announce_status", category: "ECAM", reference: "FCOM",
      label: "ECAM — STATUS",
      action: "ANNOUNCE",
      hint: "PM announces 'STATUS' as the SD switches to the STATUS page. PF acknowledges.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["cancel_master_caut"],
    },
    {
      id: "stop_ecam", category: "ECAM", reference: "FCOM",
      label: "STOP ECAM",
      action: "CALL",
      hint: "PF: 'STOP ECAM.' ECAM actions are stopped before reviewing STATUS and conducting the approach prep. PM acknowledges and removes hand from CLR.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["announce_status"],
    },
    {
      id: "oeb_check", category: "PROCEDURE", reference: "FCTM",
      label: "OEB / COMPUTER RESETS",
      action: "CHECK",
      hint: "PF: 'Any OEB? Any COMPUTER RESETS?' PM checks for applicable OEB items + required computer resets per QRH reset table. Do NOT reset from memory. If none — 'NO APPLICABLE OEB OR RESET.'",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["stop_ecam"],
    },
    {
      id: "read_status", category: "ECAM", reference: "FCOM",
      label: "READ STATUS",
      action: "CALL",
      hint: "PF: 'READ STATUS' — PM reads the STATUS page aloud line by line. PF cross-checks and acknowledges.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["oeb_check"],
    },
    {
      id: "status_read_aloud", category: "ECAM", reference: "FCOM",
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
      id: "inop_sys_card", category: "ECAM", reference: "FCOM",
      label: "STATUS — INOP SYS",
      action: "REVIEW",
      hint: "PM reads the INOP SYS list from the STATUS page; PF cross-checks.  ↓ The INOP SYS list OVERFLOWS the page (green ↓ arrow shown).  CLR to view the next INOP systems.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["status_read_aloud"],
      notes: [
        "G+Y HYD · F/CTL PROT · STABILIZER · REVERSER 1+2 · SPLR 1+2+4+5 · FLAPS · LAF · YAW DAMPER · AP 1+2 · ANTI SKID · N/W STRG · NORM BRK · AUTO BRK · L/G RETRACT · CARGO DOOR (if Y RSVR LO LVL) · CAT 2 · GLS AUTOLAND · STEEP APPR",
      ],
    },
    // INOP SYS overflows the STATUS page (17 systems > one screen) → green ↓ arrow.
    // FCOM DSC-31-20(8): "The flight crew can press the CLR pb, in order to scroll the
    // display to view the overflow." This card is that CLR press — on CONFIRM, StatusPanel
    // replaces page 1 with the REMAINING (overflowed) INOP systems; the ↓ arrow disappears. [user 2026-07-06]
    {
      id: "clear_status_overflow", category: "ECAM", reference: "FCOM",
      label: "STATUS — REMAINING INOP SYS",
      action: "REVIEW",
      hint: "PM reads the REMAINING INOP systems — now shown on the STATUS page after CLR; PF cross-checks.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["inop_sys_card"],
      notes: [
        "AUTO BRK · L/G RETRACT · CARGO DOOR (if Y RSVR LO LVL) · CAT 2 · GLS AUTOLAND · STEEP APPR",
      ],
    },
    {
      id: "crew_crosscheck", category: "ECAM", reference: "FCOM",
      label: "ECAM ACTIONS COMPLETED",
      action: "ANNOUNCE",
      hint: "PM: 'ECAM ACTIONS COMPLETED.' PF acknowledges. Primary ECAM cleared, secondary failures reviewed, STATUS read aloud.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["clear_status_overflow"],
    },

    // ── QRH SUMMARY — first thing after ECAM ACTIONS COMPLETE ─────────────────
    // A320 QRH HYD G+Y SYS LO PR SUMMARY (Rev 25 MAY 22, p.29.03A), read verbatim
    // before performance/decision.  FLAGGED FOR SME REVIEW.
    {
      id: "qrh_summary_gy", category: "QRH", reference: "QRH",
      label: "QRH SUMMARY — CRUISE",
      action: "READ",
      hint: "PM reads the CRUISE part of the QRH HYD G+Y SYS LO PR summary aloud; PF cross-checks.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      opensContextTab: "qrh",
      qrhHighlightSections: ["CRUISE"],
      requires: ["crew_crosscheck"],
      notes: [
        "SPD BRK: DO NOT USE.  MAX SPD 320 / 0.77.  MANEUVER WITH CARE.  NO STABILIZER.  ALTN LAW: PROT LOST.  FUEL: increased consumption.  Landing performance: use the EFB LDG PERF application.",
        "ONE-SYSTEM RECOVERY BEFORE GEAR — if a system is recoverable (YELLOW ELEC pump or RAT restores GREEN/YELLOW pressure), RECOVER it and MODIFY the MCDU for the single-hyd case FIRST; only commit to the dual-hyd gravity-gear flow if it stays unrecoverable. (The YELLOW ELEC PUMP ON recovery action is deferred to the approach procedure — not in this drill.) [combined-abnormal-procedures]",
      ],
    },

    // Hidden gate — completed by the ATC weather delivery card (completesStep).
    // Keeps the procedure paused (no card) through the whole weather exchange:
    // QRH cruise summary → request wx → ATC wx → readback → THEN landing perf.
    {
      id: "weather_obtained", category: "COMMS", reference: "TECHNIQUE",
      label: "WEATHER OBTAINED",
      action: "CONFIRM",
      hint: "Weather, runway in use and approach type obtained and read back to ATC.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      optional: true,
      requires: ["qrh_summary_gy"],
    },
    // Hidden gate — completed by the crew check-in on Approach (`atc_approach_checkin`).
    // The APPROACH BRIEFING requires it, so if the crew runs the drills fast and the
    // tape has not yet passed 15 000, the briefing waits until the changeover happens.
    {
      id: "approach_freq_switched", category: "COMMS", reference: "TECHNIQUE",
      label: "APPROACH FREQ",
      action: "CONFIRM",
      hint: "Changeover to Mumbai Approach complete (checked in passing altitude).",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      optional: true,
      requires: ["crew_crosscheck"],
    },
    // ── PERFORMANCE & DECISION ───────────────────────────────────────────────
    {
      id: "ldg_perf", category: "PROCEDURE", reference: "QRH",
      label: "LANDING PERFORMANCE",
      action: "COMPUTE",
      hint: "PM: use QRH / EFB to compute landing distance per LDG DIST PROC. Inputs: FLAP 3, VAPP = VREF+25 kt (~160 kt), Y accumulator brakes only, ANTI SKID INOP, no auto-brake, REVERSERS INOP. Apply factored landing distance. Confirm divert runway LDA exceeds required.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["weather_obtained"],
      notes: [
        "LANDING-DISTANCE PENALTY: dual HYD G+Y ≈ +10% over the normal factored distance — apply the QRH LDG-DIST-PROC penalty tables / FlySmart (do NOT eyeball it). [qrh / qrh-alt]",
        "FUEL PENALTY: DISREGARD the FMS fuel predictions (unreliable) — use the QRH FUEL PENALTY FACTOR tables. Consumption is increased (spoilers partially extended / degraded config), so cross-check endurance vs the diversion. [qrh / qrh-alt]",
      ],
    },
    {
      id: "fordec_hyd", category: "PROCEDURE", reference: "TECHNIQUE",
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
      id: "inform_atc_intentions", category: "COMMS", reference: "TECHNIQUE",
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
    // Hidden gate — completed by the ATC diversion ACK (atc_intentions_ack, gives the routing
    // direct BIDUR). The crew then EXECUTES it (FMGC PREP) — so P21 follows A13 [user 2026-06-30].
    {
      id: "intentions_acked", category: "COMMS", reference: "TECHNIQUE",
      label: "ROUTING RECEIVED",
      action: "CONFIRM", hint: "ATC acknowledged the diversion and gave routing (direct BIDUR).",
      variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["inform_atc_intentions"],
    },
    // ── FMC PREP — 3 cards: (1) FMC  (2) QRH review  (3) action-panel flaps+GPWS ──
    {
      id: "fmgc_prep", category: "PROCEDURE", reference: "FCOM",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: F-PLN — insert DEST VABB.  Select RWY 27, insert ILS frequency + course.  Check fuel vs DEST + FINAL RESERVE 30 min — declare on frequency if not adequate.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["intentions_acked"],
    },
    {
      id: "qrh_review", category: "QRH", reference: "QRH",
      label: "QRH REVIEW — APPR / LDG / GO-AROUND",
      action: "REVIEW",
      hint: "PM/PF REVIEW (not read aloud) the APPROACH / LANDING / GO-AROUND parts of the QRH HYD G+Y SYS LO PR summary during FMC prep. (CRUISE part was read earlier.)",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      opensContextTab: "qrh",
      qrhHighlightSections: ["APPROACH", "LANDING", "GO-AROUND"],
      requires: ["fmgc_prep"],
      notes: [
        "APPROACH — CAT 2 INOP.  SLATS SLOW / FLAPS JAMMED.  FOR LDG: USE FLAP 3.  GPWS FLAP MODE: OFF.  Flaps ext SPD SEL: VFE NEXT − 5 kt.  CONF 3: decelerate to calculated VAPP.  CONF 3 + VAPP: stabilize at VAPP before L/G down (trim reference).",
        "L/G GRAVITY EXTN — handcrank PULL AND TURN (rotate clockwise 3 turns to mechanical stop).  L/G LEVER: DOWN.  GEAR DOWN: CHECK.  Disregard 'USE MAN PITCH TRIM' (MAN TRIM unusable).",
        "LANDING — pitch authority reduced (no stabilizer).  Only 1 spoiler per wing (Direct law).  NO REVERSER.  BRK Y ACCU PR ONLY (7 applications), MAX BRK PR 1 000 PSI.  NO NOSEWHEEL STEERING.",
        "GO-AROUND — NO GEAR RETRACTION.  FUEL: increased consumption.  Circuit: maintain slats/flaps, speed close to VAPP.  Diversion (flaps jammed 0): clean config, maintain ≥ higher of VAPP or VLS.",
      ],
    },
    {
      id: "nis_brief_hyd", category: "CRM · COMMS", reference: "TECHNIQUE",
      label: "NITS BRIEF (SCCM)",
      action: "CONFIRM",
      hint: "Captain conducts the NITS brief on the interphone with the Senior Cabin Crew Member (SCCM).  If aircraft state allows and the FO can fly comfortably for a few minutes (aircraft trimmed, stable), Captain temporarily transfers control — 'YOU HAVE CONTROL' — does the brief, then 'I HAVE CONTROL' back.  Otherwise the brief is delegated to the FO.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["qrh_review"],
      notes: [
        "N — NATURE: 'We have a technical issue with the hydraulic system. The aircraft is fully controllable.'",
        "I — INTENTIONS: 'We are diverting to Mumbai and will be landing on runway 27. Full emergency services will meet the aircraft as a precaution.'",
        "T — TIME: 'Approximately 25 minutes to landing.'",
        "S — SPECIAL: 'Prepare the cabin for landing in the normal way. I will give you a further update before descent. Any questions?'",
      ],
    },
    {
      id: "pax_pa", category: "CRM · COMMS", reference: "TECHNIQUE",
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
      id: "inform_company", category: "CRM · COMMS", reference: "TECHNIQUE",
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
      id: "atc_emergency_svcs", category: "CRM · COMMS", reference: "TECHNIQUE",
      label: "ATC — EMERGENCY SERVICES",
      action: "ADVISE",
      hint: "PM reads this, then makes the radio call (next ATC card): request FULL EMERGENCY SERVICES for runway 27, and advise the aircraft will be UNABLE TO VACATE the runway (nose-wheel steering INOP). SQUAWK MAYDAY 7700 if not already. Keep it concise — ATC does not need the full technical aircraft status.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["inform_company"],
    },

    // ── APPROACH PHASE ── A19 emg-svcs call → APPR PREP 1/2 (FMC) → FLAPS/GPWS config (GPWS panel POPS)
    // → APPR PREP 2/2 (config confirm, panel collapses) → BRIEF. [user 2026-07-06]
    // Both prep cards surface the STATUS page (1/2) / QRH summary (2/2) via opensContextTab; trainee can
    // tap the other tab. GPWS 3D panel pops for the CONFIG phase: apprActionsStarted = approach_prep_hyd
    // (FMC done), apprActionsDone = approach_prep_config (config confirm). FLAP MODE OFF + LDG FLAP 3 ON
    // are SELECTED on the GPWS panel (gpwsMap in engineDisplay). id "approach_prep_hyd" is KEPT — pfd-nd
    // showBaroMin + descent-profile phase index gate on it. Do not rename.
    { id: "emg_services_sent", label: "EMERGENCY SERVICES REQUESTED", action: "CONFIRM", hint: "A19 emergency-services call addressed.", variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["atc_emergency_svcs"] },
    {
      // CARD 1/2 — FMC prep (minimums / landing data). Surfaces the STATUS page. Sets MDA/DH → PFD BARO min.
      id: "approach_prep_hyd", category: "PROCEDURE", reference: "FCOM",
      label: "APPROACH PREPARATION 1/2 · FMC",
      action: "COMPLETE",
      hint: "PM — FMC prep (ref STATUS page + QRH summary):  ILS 27 set manually on RMP 1 (auto-tune may not match selected RWY).  BARO QNH.  Set MDA/DH per chart.  VAPP = VREF + 25 kt (~160 kt, FLAP 3 landing config).  Auto-brake selector OFF (INOP).",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      opensContextTab: "system",
      requires: ["emg_services_sent"],
    },
    {
      // CARD 2/2 config — PROCEDURE card 1: GPWS LDG FLAP 3 → ON (QRH sequence: FLAP 3 landing FIRST).
      id: "gpws_ldg_flap3",
      label: "GPWS LDG FLAP 3",
      action: "ON",
      hint: "GPWS action panel: LDG FLAP 3 pb → ON — QRH selection for a FLAP 3 (CONF 3) landing; flap mode is referenced to CONF 3 and the LDG MEMO displays 'FLAPS 3'.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["approach_prep_hyd"],
    },
    {
      // CARD 2/2 config — PROCEDURE card 2: GPWS FLAP MODE → OFF (after LDG FLAP 3, per the QRH).
      id: "gpws_flap_mode",
      label: "GPWS FLAP MODE",
      action: "OFF",
      hint: "GPWS action panel: FLAP MODE pb → OFF — inhibits the 'TOO LOW FLAP' (Mode 4) nuisance warning for the reduced-flap landing.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["gpws_ldg_flap3"],
    },
    {
      // CARD 2/2 — config confirm. Collapses the GPWS action panel. Surfaces the QRH summary.
      id: "approach_prep_config", category: "PROCEDURE", reference: "FCOM",
      label: "APPROACH PREPARATION 2/2 · CONFIG",
      action: "COMPLETE",
      hint: "Config complete (ref STATUS page + QRH summary):  GPWS LDG FLAP 3 ON,  then GPWS FLAP MODE OFF (FLAP 3 landing).  Spoilers ARM (only 1 SPLR/wing — G+Y lost).  Pressing this COLLAPSES the GPWS action panel.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      opensContextTab: "qrh",
      requires: ["gpws_flap_mode"],
    },
    // APPROACH BRIEFING — split into 4 cards (NORMAL ILS / THE APPROACH / THE LANDING /
    // THE GO-AROUND), mirroring the FCTM/QRH phase structure (vault §5.3/5.4/5.5).
    // NOTE: id "approach_brief_hyd" is preserved — the PFD buildAircraftState() gates its
    // "On ILS" state (SPEED·G/S·LOC, VMAX 230, RA shown) on this exact id. Do not rename.
    {
      // [user 2026-06-30] NEW first briefing card — set the mental model that the approach
      // itself is a STANDARD CAT 1 ILS; only config / gear / law are abnormal.
      id: "approach_brief_normal_ils", category: "CRM", reference: "FCTM",
      label: "APPROACH BRIEFING · NORMAL ILS RWY 27 (1/4)",
      action: "COMPLETE",
      hint: "PF leads the approach briefing — the approach itself is a STANDARD CAT 1 ILS RWY 27.  Despite the hydraulic failure the ILS is flown normally: LOC then G/S capture, FD ON + A/THR ON, raw-data cross-checked.  The ONLY abnormals are the CONFIG (FLAP 3), the late GRAVITY GEAR, and DIRECT LAW at gear-down.  Brief it as a normal ILS, manage those three exceptions.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["approach_prep_config"],
      notes: [
        "Approach: STANDARD CAT 1 ILS RWY 27 — no change to the ILS procedure itself.",
        "Guidance: FD ON, A/THR ON, LOC then G/S — flown by hand (AP 1+2 INOP), raw data cross-checked.",
        "the failure changes CONFIG (FLAP 3) + GEAR (gravity) + LAW (DIRECT at gear-down), NOT the ILS itself — brief a normal ILS with these three exceptions.",
      ],
    },
    {
      id: "approach_brief_hyd", category: "CRM", reference: "FCTM",
      label: "APPROACH BRIEFING · THE APPROACH (2/4)",
      action: "COMPLETE",
      hint: "PF leads the approach briefing — PART 1: how the approach will be flown.  ILS RWY 27, MDA/DH, VAPP = VREF+25 kt, hand-flown (AP 1+2 INOP; FD + A/THR available, A/THR stays ON).  Request a LONG FINAL to give time to stabilize at VAPP before the late gravity-gear extension.  Plan to be stabilized by a platform ~2500 ft AAL so the trim reference is set before gear.  GPWS FLAP MODE OFF (already done in approach prep).",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["approach_brief_normal_ils"],
      notes: [
        "Approach type: ILS RWY 27 — hand-flown (AP 1+2 INOP; FD + A/THR available).",
        "Speed: VAPP = VREF + 25 kt (increased — flaps INOP; FLAP 3 is the final config).",
        "A/THR: keep ON (for G+Y it is NOT set to OFF, unlike the G+B case). Helps hold VAPP for the trim-reference-before-gear technique.",
        "Trim reference: stabilize at VAPP FIRST, THEN gravity gear (DIRECT LAW activates at L/G DN).",
        "request a LONG FINAL / extended track miles — gives time to fully stabilize at VAPP before the late gravity-gear extension.",
        "plan a PLATFORM / level segment ~2500 ft AAL, stabilized at VAPP / CONF 3 before gear — airmanship to guarantee the trim reference is set.",
        "★ APPROACH SPEED SCHEDULE [capt-vhram-personal-notes]: within 25 NM of the IAF → 225 kt · 3 NM before the IAF → FLAP 1 / 195 kt (Vfe−5) · procedure turn → FLAP 2 / 180 kt · established on LOC → FLAP 3 / SPD MANAGED · GEAR (gravity) on the glide.",
        "Automation: only the AUTOPILOT is lost — FD + A/THR REMAIN AVAILABLE (A/THR stays ON). Fly raw-data-backed with the FD. [capt-vhram-personal-notes]",
        "CONFIGURE EARLY — slats are slow and flaps jammed near 0, so it takes time to decelerate; anticipate. Plan a ~20 NM long final. Spoilers may gradually extend (~10%), adding drag/fuel burn. [combined-abnormal-procedures]",
      ],
    },
    {
      id: "approach_brief_landing", category: "CRM", reference: "FCTM",
      label: "APPROACH BRIEFING · THE LANDING (3/4)",
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
        "TAIL-STRIKE / HIGH-NOSE awareness — a FLAP 3 landing flares at a higher pitch attitude & rate; PF BRIEFS the high pitch, PM CALLS if the pitch limit is approached/exceeded. [all three sources]",
        "Parking brake: may be INOP (YELLOW accumulator low pressure) — plan chocks / stay on the runway; don't rely on the park brake after the stop. [combined-abnormal-procedures]",
        "AUTO-TRIM MECHANISM — until L/G DOWN the THS is frozen, but pitch auto-trims via the ELEVATORS (mean elevator position memorised = the centred-stick reference). That memorised reference is WHY the gear is left late: stabilise at VAPP first so the trim ref is set before DIRECT LAW activates at gear-down. [handling-dual-hyd / capt-vhram-personal-notes]",
      ],
    },
    {
      id: "approach_brief_ga", category: "CRM", reference: "FCTM",
      label: "APPROACH BRIEFING · THE GO-AROUND (4/4)",
      action: "CONFIRM",
      hint: "PF leads the approach briefing — PART 3: the go-around plan.  Call 'GO AROUND, MAX REVERSE N/A, FOLLOW SRS'.  TOGA + SRS (both engines healthy).  LIMIT PITCH (no Alpha Floor); manage the pitch/power couple manually (no stabilizer / auto-trim).  Gear STAYS DOWN (retraction INOP) — extra drag, trim for positive climb.  Maintain VAPP, build to green dot only after positive climb.  Minimum bank ≤15°.  Stays in DIRECT LAW.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["approach_brief_landing"],
      notes: [
        "Call: 'GO AROUND, MAX REVERSE N/A, FOLLOW SRS' — 'GO AROUND FLAPS' is non-standard (already at max lift).",
        "TOGA: both engines healthy → TOGA + SRS gives positive climb. LIMIT PITCH — no Alpha Floor.",
        "PITCH/POWER COUPLE — with the stabilizer lost (no auto-trim), anticipate and manually counter the nose-up pitching moment from thrust application; trim continuously through the maneuver.",
        "Gear: STAYS DOWN (L/G RETRACTION INOP) — expect extra drag; trim for positive climb.",
        "Speed / turn: maintain VAPP → green dot only after positive climb; minimum bank ≤15° (degraded law).",
      ],
    },
    // Hidden gate — completed by the crew HOLD REQUEST (`atc_hold_req`, fires after the
    // briefing, passing 12 000 ft). The ATC hold CLEARANCE (`atc_hold_clr`) requires it,
    // so the clearance can never precede the request. Placed AFTER the briefing in the
    // array so a dev-seek to FMC PREP / briefing can't mark it done early.
    {
      // Branch decision — set by the runner at ~10 500 ft (silent). prep_ready = the APPROACH
      // CHECKLIST (approach_cl_hyd) was done by then → LONG VECTORS path (no hold needed);
      // prep_late = not done → HOLD path (level 10 000, request a hold to finish at 7 000).
      id: "prep_ready", category: "COMMS", reference: "TECHNIQUE",
      label: "PREP READY @10.5",
      action: "CONFIRM", hint: "Approach prep complete by 10 500 ft → long-vectors path.",
      variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["approach_brief_ga"],
    },
    {
      id: "prep_late", category: "COMMS", reference: "TECHNIQUE",
      label: "PREP LATE @10.5",
      action: "CONFIRM", hint: "Approach prep NOT complete by 10 500 ft → hold path (level 10 000).",
      variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["crew_crosscheck"],
    },
    // Path-specific request milestones (so each ATC clearance follows only its own request).
    {
      id: "vectors_requested", category: "COMMS", reference: "TECHNIQUE",
      label: "VECTORS REQUESTED",
      action: "CONFIRM", hint: "Crew requested descent + long vectors (prep complete).",
      variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["prep_ready"],
    },
    {
      id: "holdpattern_requested", category: "COMMS", reference: "TECHNIQUE",
      label: "HOLD REQUESTED",
      action: "CONFIRM", hint: "Crew requested a hold (prep not yet complete).",
      variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["prep_late"],
    },
    // Hidden gate — completed by EITHER ATC clearance READ-BACK (vectors A15 or hold A17). [user 2026-07-01]
    {
      id: "descent_7k_cleared", category: "COMMS", reference: "TECHNIQUE",
      label: "DESCENT 7 000 CLEARED",
      action: "CONFIRM", hint: "ATC cleared descent to 7 000 ft (vectors or hold) — read back complete.",
      variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["approach_brief_ga"],
    },
    // VISIBLE PFD-SELECTION card (no CONFIRM) — AFTER the crew READS BACK the clearance, the PF sets the
    // FCU to 7 000; only THEN does the FMA ALT window change and the descent toward 7 000 begin. Mirrors
    // the FCU — SELECT 10 000 card. id "hold_cleared" KEPT so the PFD gate (holdCleared) is unchanged. [user 2026-07-01]
    {
      id: "hold_cleared", category: "AVIATE", reference: "FCOM",
      label: "FCU — SELECT 7 000",
      action: "",
      hint: "ATC cleared 7 000 ft (vectors or hold) — PF sets the FCU altitude to 7 000.  FMA ALT window → 7 000, OPEN DES.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      flashSurface: "pfd",
      flashMsg: "SELECT 7 000",
      requires: ["descent_7k_cleared"],
    },
    // Hidden gate — completed by the runner when the aircraft reaches the 7 000 ft hold
    // (altitude effect in runner.tsx). The approach checklist (and everything after it,
    // procedure AND ATC) requires it, so nothing past the briefing happens above 7 000.
    {
      id: "at_hold_7000", category: "COMMS", reference: "TECHNIQUE",
      label: "LEVEL 7 000 · ON VECTORS",
      action: "CONFIRM",
      hint: "Aircraft level 7 000 ft on vectors for ILS 27 — approach checklist may now be run.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      optional: true,
      requires: ["approach_brief_ga"],
    },
    // Hidden gate — the changeover LOOP is complete (check-in → radar ack). The vectors/hold
    // decision (runner) waits for this so a lower-altitude request never supersedes it. [user 2026-07-01]
    { id: "cont_descent_acked", label: "CONT DESCENT ACKED", action: "CONFIRM", hint: "Changeover loop complete — radar acknowledged the check-in and cleared continue descent.", variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["approach_freq_switched"] },
    // Hidden gate — completed by the runner when the live tape reaches 13 000 ft AND the briefing is done,
    // so the APPROACH CHECKLIST becomes available AT 13 000 (a window before the 12 500 decision). [user 2026-07-01]
    { id: "at_13000", label: "AT 13 000", action: "CONFIRM", hint: "Passing 13 000 ft — the approach checklist may be run.", variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["approach_brief_ga"] },
    {
      id: "approach_cl_hyd", category: "CHECKLIST", reference: "FCOM",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs the approach checklist — note items affected by dual-hyd config. Available at 13 000 ft (once the briefing is done) — finish it before the 12 500 vectors/hold decision to earn the vectors path.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["at_13000"],
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
    // Hidden gates for the A20 → A21 → P33 sequence at the 7 000 platform [user 2026-06-30].
    // A20 (atc_ready_for_approach) completes ready_app_reported → A21 (atc_cleared_approach)
    // completes approach_cleared → P33 (descend_3700) requires it. So the 3 700 descent is
    // SEPARATE and fires only AFTER the 7 000 level-off + the ILS clearance, never at 12 500.
    { id: "ready_app_reported", label: "READY FOR APPROACH", action: "CONFIRM", hint: "Crew reported ready for the ILS approach (A20).", variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["approach_cl_hyd"] },
    { id: "approach_cleared", label: "CLEARED APPROACH", action: "CONFIRM", hint: "ATC cleared the ILS approach + descend 5 000 (A21).", variant: "advisory", crew: "PM", group: "comms", optional: true, requires: ["ready_app_reported"] },
    // [P33] APPROACH SEQUENCE — descend to 5 000 → level off → configure → GS/LOC intercept → gear → landing CL. [user 2026-07-05]
    {
      id: "descend_3700", category: "AVIATE", reference: "TECHNIQUE",
      label: "DESCEND 5 000",
      action: "V/S −1000 · LEVEL 5000",
      hint: "After ATC clears the ILS approach (A21: descend 5 000): PF descends 7 000 → 5 000 in V/S (~−1000 fpm) on a heading. V/S is the technique for small, controlled altitude changes (small thrust changes only) — the idle descent bleeds 250 → green dot (213), so you arrive 5 000 @ green dot @ ~22 NM, ~2.5 dots below the G/S with room to configure before capture.  FMA: SPEED · V/S (→ ALT) · HDG.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      requires: ["approach_cleared"],
    },
    // Hidden gate — completed by the runner once the live tape LEVELS at 5 000 (≤ 5 100 ft, ALT)
    // after P33. So P35 CONFIGURE happens AT 5 000, not while still descending. [user 2026-07-05]
    // (id kept as at_level_3700 — the runner gate references this exact id.)
    { id: "at_level_3700", label: "LEVEL 5 000", action: "CONFIRM", hint: "Aircraft level 5 000 ft (ALT) — configure for the approach.", variant: "advisory", crew: "PF", group: "flightcheck", optional: true, requires: ["descend_3700"] },
    // [user 2026-07-05] CONFIGURATION at 5 000 ft — QRH abnormal-approach technique: SPD SEL =
    // VFE NEXT − 5, step the FLAP lever down 1 → 2 → 3, then confirm the landing config, then gear.
    {
      id: "flap_1", category: "AVIATE", reference: "QRH · TECHNIQUE",
      label: "FLAP 1",
      action: "VFE-NEXT−5 · FLAP 1",
      hint: "At 5 000 ft (level, ALT): SPD SEL = VFE NEXT − 5 (≈225 kt).  Decelerate; below VFE NEXT select FLAP 1 — S speed comes up on the tape.  Slats run slow on Blue (G+Y lost).",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["at_level_3700"],
    },
    {
      id: "flap_2", category: "AVIATE", reference: "QRH · TECHNIQUE",
      label: "FLAP 2",
      action: "VFE-NEXT−5 · FLAP 2",
      hint: "SPD SEL = VFE NEXT − 5 (≈195 kt).  Decelerate; below VFE NEXT select FLAP 2 — F speed comes up on the tape.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["flap_1"],
    },
    {
      id: "flap_3", category: "AVIATE", reference: "QRH · TECHNIQUE",
      label: "FLAP 3",
      action: "VFE-NEXT−5 · FLAP 3",
      hint: "SPD SEL = VFE NEXT − 5 (≈180 kt).  Decelerate; below VFE NEXT select FLAP 3 — the landing config (flapless landing = FLAP 3 for G+Y).  Continue decelerating toward VAPP = VREF + 25.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["flap_2"],
    },
    {
      id: "configure_for_approach", category: "AVIATE", reference: "QRH",
      label: "CONFIGURE FOR APPROACH",
      action: "FLAP 3 · VAPP",
      hint: "At 5 000 feet (LEVEL OFF in ALT): PF configures — FLAP 3, decelerate to VAPP (VREF+25). Stabilize at VAPP BEFORE the gravity gear (sets the trim reference before DIRECT LAW).  Open descent on a heading; localizer/glideslope not yet intercepted.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      opensContextTab: "qrh",                  // re-open the QRH — PF reads the APPROACH part of the summary while configuring
      qrhHighlightSections: ["APPROACH"],
      requires: ["flap_3"],   // config-complete confirm AFTER the 3 flap-selection cards [user 2026-07-05]
      notes: [
        "Established on ILS RWY 27 — FMA: SPEED · LOC · G/S, with FD + A/THR (AP INOP, hand-flown).",
        "Check VABB field elevation (≈ 39 ft AMSL) and the G/S intercept altitude for RWY 27.",
        "be fully stabilized at VAPP / CONF 3 by a platform ~2500 ft AAL before calling for the gravity gear (sets the trim reference before DIRECT LAW).",
      ],
    },
    {
      // GEAR DOWN comes BEFORE the GS/LOC capture (user 2026-06-30) — extended at 5 000
      // while level on vectors, so the trim reference is set in DIRECT law first.
      // [Stage B will move this to VAPP after G/S intercept per the new QRH sequence.]
      id: "lgr_gravity", category: "PROCEDURE", reference: "QRH · TECHNIQUE",
      label: "GEAR — GRAVITY EXTN",
      action: "DEPLOY AT 5000",
      hint: "PM: at 5 000 ft, STABILIZED AT VAPP / CONF 3 and BEFORE glideslope capture.  GRVTY GEAR EXTN handcrank — PULL AND TURN: rotate the handle clockwise 3 turns until the mechanical stop.  L/G LEVER — DOWN.  GEAR DOWN — CHECK 3 GREENS.  At L/G DN the F/CTL reverts to DIRECT LAW — the mean elevator position becomes the centered-stick reference.  Disregard 'USE MAN PITCH TRIM'.",
      variant: "advisory",
      crew: "PM",
      group: "comms", // checklist card — removed from the HYD action panel [user 2026-07-06]
      requires: ["configure_for_approach"],
    },
    {
      id: "gs_intercept", category: "AVIATE", reference: "FCTM",
      label: "GS / LOC INTERCEPT",
      action: "ESTABLISHED",
      hint: "AFTER the gravity gear is down: glideslope + localizer CAPTURED at 5 000 — established on the ILS RWY 27.  FMA: SPEED · G/S · LOC, descending the slope from 5 000.  Call ESTABLISHED.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      requires: ["lgr_gravity"],
    },
    {
      id: "landing_cl_hyd", category: "CHECKLIST", reference: "FCOM",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs the landing checklist once GEAR DOWN and ESTABLISHED on the ILS (G/S · LOC), descending from 5 000.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["gs_intercept"],
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
      id: "ldg_clearance_done", category: "COMMS", reference: "TECHNIQUE",
      label: "LANDING CLEARANCE",
      action: "CONFIRM",
      hint: "Landing clearance received from Tower and read back — all approach/landing ATC calls complete.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      optional: true,
      requires: ["landing_cl_hyd"],
    },

    // Hidden gate — completed by the runner when the live tape reaches the runway (≤ 50 ft) after the
    // landing checklist. Switches the PFD to touchdown/rollout: FD ILS modes DROP, speed decelerates to 0. [user 2026-07-01]
    { id: "touched_down", label: "TOUCHDOWN", action: "CONFIRM", hint: "Main-gear touchdown on RWY 27 — rollout, decelerating to stop.", variant: "advisory", crew: "PM", group: "flightcheck", optional: true, requires: ["landing_cl_hyd"] },

    // Hidden gate — completed by the runner ONLY once the rollout has decelerated to a full stop
    // (live speed ≈ 0 kt after touchdown). Gates the REQUEST TAXI / Mumbai-Tower call so it can never
    // fire while still rolling (or airborne). [user 2026-07-04]
    { id: "full_stop", label: "FULL STOP", action: "CONFIRM", hint: "Aircraft decelerated to a FULL STOP on RWY 27 (0 kt).", variant: "advisory", crew: "PM", group: "flightcheck", optional: true, requires: ["touched_down"] },

    // ── AFTER LANDING — request taxi to stand ─────────────────────────────────
    // Aircraft is stopped on or near the runway with no nose-wheel steering
    // and limited braking.  Cannot taxi normally.  Crew requests assistance
    // (tow, or follow-me + tug) to clear the runway / proceed to a stand.
    {
      id: "request_taxi_to_stand", category: "COMMS", reference: "TECHNIQUE",
      label: "REQUEST TAXI TO STAND",
      action: "CALL",
      hint: "After aircraft fully stopped: PM calls Tower / Ground to advise stopped on the runway with no NW steering. Request a tow or follow-me vehicle to clear the runway and proceed to a remote stand.  Confirm services available, brakes still set, doors closed unless evacuation ordered.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      // Gated on BOTH the landing-clearance ATC chain (ldg_clearance_done) AND the physical FULL STOP —
      // so the "landed and stopped" call is genuinely the last action, never while still rolling. [user 2026-07-04]
      requires: ["ldg_clearance_done", "full_stop"],
      notes: [
        "Call: 'Mumbai Tower, IFLY101 — landed and stopped on runway 27. Confirm parking brake set, no immediate evacuation. Nose-wheel steering inoperative — request tow or follow-me to clear runway and proceed to remote stand.'",
        "PARK BRK may be INOP (yellow accumulator low pressure after a Y failure). If park brake does not hold, keep pedal brakes applied (accumulator pressure, limited applications) and chock as soon as ground crew arrives.",
        "Wait for ATC instructions before any manoeuvre.",
        "If conditions deteriorate (fire / smoke / fuel leak detected by ARFF), be prepared for evacuation order.",
      ],
    },
  ],

  statusItems: [
    // ── LEFT column — recreated to match the real G+Y SYS LO PR STATUS page
    //    (reference photo). LIMITATIONS + APPROACH CORRECTIONS = cyan (advisory);
    //    INFORMATION = green (memo). Blank { line: "" } items are group separators.
    //    NOTE: reference shows APPR SPD VREF+30 (scenario elsewhere used +25 — flagged).
    { id: "st_max_spd",   line: "MAX SPEED........320/.77",   severity: "advisory" },
    { id: "st_max_brk",   line: "MAX BRK PR.......1000 PSI",  severity: "advisory" },
    { id: "st_manv",      line: "MANEUVER WITH CARE",          severity: "advisory" },
    { id: "st_sp1",       line: "",                            severity: "advisory" },
    { id: "st_ldg3",      line: "-FOR LDG.....USE FLAP 3",     severity: "advisory" },
    { id: "st_gpws",      line: "-GPWS FLAP MODE.....OFF",     severity: "advisory" },
    { id: "st_conf3",     line: ".WHEN CONF 3 AND VAPP:",      severity: "advisory" },
    { id: "st_gear",      line: "-L/G.........GRVTY EXTN",     severity: "advisory" },
    { id: "st_vapp",      line: "APPR SPD : VREF + 30 KT",     severity: "advisory" },
    { id: "st_ldg_dist",  line: "LDG DIST PROC......APPLY",    severity: "advisory" },
    { id: "st_sp2",       line: "",                            severity: "advisory" },
    { id: "st_altn",      line: "ALTN LAW : PROT LOST",        severity: "memo" },
    { id: "st_dir_law",   line: "WHEN L/G DN : DIRECT LAW",    severity: "memo" },
    { id: "st_brk_accu",  line: "BRK Y ACCU PR ONLY",          severity: "memo" },
    { id: "st_slats",     line: "SLATS SLOW",                  severity: "memo" },
    // ── RIGHT column — INOP SYS (amber). Order per the reference photo; overflows
    //    the screen → green ↓ overflow arrow (StatusPanel renders it automatically).
    { id: "st_inop_hyd",  line: "G+Y HYD",       severity: "caution", inopSys: true },
    { id: "st_inop_fctl", line: "F/CTL PROT",    severity: "caution", inopSys: true },
    { id: "st_inop_stab", line: "STABILIZER",    severity: "caution", inopSys: true },
    { id: "st_inop_rev",  line: "REVERSER 1+2",  severity: "caution", inopSys: true },
    { id: "st_inop_splr", line: "SPLR 1+2+4+5",  severity: "caution", inopSys: true },
    { id: "st_inop_flap", line: "FLAPS",         severity: "caution", inopSys: true },
    { id: "st_inop_yaw",  line: "YAW DAMPER",    severity: "caution", inopSys: true },
    { id: "st_inop_ap",   line: "AP 1+2",        severity: "caution", inopSys: true },
    { id: "st_inop_cat2", line: "CAT 2",         severity: "caution", inopSys: true },
    { id: "st_inop_gls",  line: "GLS AUTOLAND",  severity: "caution", inopSys: true },
    { id: "st_inop_ask",  line: "ANTI SKID",     severity: "caution", inopSys: true },
    { id: "st_inop_nws",  line: "N/W STRG",      severity: "caution", inopSys: true },
    { id: "st_inop_nbrk", line: "NORM BRK",      severity: "caution", inopSys: true },
    { id: "st_inop_abrk", line: "AUTO BRK",      severity: "caution", inopSys: true },
    { id: "st_inop_lgr",  line: "L/G RETRACT",   severity: "caution", inopSys: true },
    { id: "st_inop_cargo",line: "CARGO DOOR",    severity: "caution", inopSys: true },
    { id: "st_inop_gpump",line: "G ENG 1 PUMP",  severity: "caution", inopSys: true },
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
    // Correct MAYDAY: nature + unable RVSM + request descent. [user 2026-06-30: no "standby"]
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
        // Correct — nature + heading + offset request + unable RVSM + descent request
        // Heading states current navigation; offset gives lateral separation; descent exits RVSM block
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, heading 200, unable RVSM, request 2 miles right offset and descent flight level two zero zero",  correct: true  },
        // Wrong — missing heading and offset; ATC cannot plan separation without navigation info
        { id: "b", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, unable RVSM, request descent flight level two zero zero",                                          correct: false },
        // Wrong — airports and vectors in initial MAYDAY; intentions come after FORDEC
        { id: "d", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, maintaining FL350, request immediate vectors nearest suitable airport with 3 000 m runway",        correct: false },
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
      completesStep: "descent_10k_requested",   // request only — the FMU/FMA changes on the ATC CLEARANCE (A4), not the request
      kind: "crew",   // [Trainer ALT #1] PM-initiated request, passing 22 000 ft
      from: "PM → MUMBAI CONTROL",
      message: "Passing 22,000 ft — PM requests further descent.",
      standbyResurfaceMs: 15_000,
      choices: [
        { id: "a", label: "Mumbai Control, IFLY101, request descent 10000 feet",  correct: true  },
        { id: "b", label: "Mumbai Control, IFLY101, descending 10000 feet",        correct: false },
        { id: "c", label: "Mumbai Control, IFLY101, request descent 3000 feet",    correct: false },
      ],
    },
    // ATC CLEARS the descent → crew reads back → THEN cleared_10000 (FMU selects 10 000,
    // FMA ALT window changes, descent toward 10 000 once the ECAM panel retracts) [user 2026-06-30].
    {
      id: "atc_descend_10000_clr",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "descent_10k_requested",
      completesStep: "descent_10k_cleared",   // read-back done → the PF then SETS the FCU (cleared_10000 card)
      kind: "atc",
      from: "MUMBAI CONTROL",
      pilotSays: "Mumbai Control, IFLY101, request descent 10000 feet.",
      message: "IFLY101, descend and maintain 10000 feet, QNH 1013.",
      standbyResurfaceMs: 15_000,
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
      gapAfterMs: 5_000,
      requiresStep: "cancel_master_caut",
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
      requiresStep: "cancel_master_caut",
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

    // Control → Approach frequency handoff (ATC-initiated 2-part set): fires once
    // ECAM is complete (crew_crosscheck), just before the crew's first call to
    // Approach (the weather request). Crew reads back the new frequency.
    {
      id: "atc_control_to_approach",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "crew_crosscheck",   // ECAM complete
      atAltitudeBelowFt: 15_000,   // changeover fires passing 15 000 ft on the continuous descent
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, contact Mumbai Approach 127.9.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Mumbai Approach 127.9, IFLY101", correct: true  },
        { id: "b", label: "Roger, IFLY101",                 correct: false },
        { id: "c", label: "Switching, IFLY101",             correct: false },
      ],
    },
    // ⑥b Check-in on Mumbai Approach — crew-initiated call on the NEW frequency,
    // reporting the live passing altitude ([ALT] = live PFD altitude). A frequency
    // changeover IS a check-in (atc-comms §0b). Gated same as the handoff, ordered next.
    {
      id: "atc_approach_checkin",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "crew_crosscheck",
      atAltitudeBelowFt: 15_000,
      completesStep: "approach_freq_switched",   // sequences the post-changeover ATC comms only (continue-descent, hold req/clr). Does NOT gate any procedure step.
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Check in with Mumbai Approach — report passing altitude.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, MAYDAY, passing [ALT] feet", correct: true  },
        { id: "b", label: "Mumbai Approach, IFLY101",                              correct: false },
        { id: "c", label: "Roger, IFLY101",                                       correct: false },
      ],
    },
    // ⑥c Approach radar acknowledges the check-in and clears the CONTINUOUS DESCENT
    // to 10 000 on the new frequency (ATC-initiated 2-part set → crew reads back).
    // Same gate as the changeover, ordered next.  DRAFT phraseology · SME review.
    {
      id: "atc_approach_cont_descent",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "approach_freq_switched",
      completesStep: "cont_descent_acked",   // [user 2026-07-01] end of the changeover LOOP — the vectors/hold decision waits for this so a lower-alt request never supersedes the check-in/ack
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, Mumbai Approach, radar contact, continue descent 10000 feet, report reaching.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Continue descent 10000 feet, wilco report reaching, IFLY101", correct: true  },
        { id: "b", label: "Descending, IFLY101",                                          correct: false },
        { id: "c", label: "Roger, IFLY101",                                               correct: false },
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
      from: "PM → [STATION_CAPS]",
      message: "ECAM complete. Select the correct weather request.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — weather request only; airport decision comes after landing performance + FORDEC
        { id: "a", label: "[STATION], IFLY101, request latest weather Mumbai, runway in use, QNH",   correct: true  },
        // Wrong — airport/runway stated before FORDEC and landing performance are done
        { id: "b", label: "[STATION], IFLY101, diverting Mumbai, request weather runway 27",          correct: false },
        // Wrong — skips weather entirely; requests vectors prematurely
        { id: "c", label: "[STATION], IFLY101, request immediate vectors ILS runway 27",              correct: false },
      ],
    },

    // ⑥ ATC delivers weather — full readback required (QNH critical for landing distance)
    {
      id: "atc_weather_delivery",
      atMs: 1_000,
      requiresStep: "qrh_summary_gy",
      completesStep: "weather_obtained",
      kind: "atc",
      from: "[STATION_CAPS]",
      pilotSays: "[STATION], IFLY101, request latest weather Mumbai, runway in use, QNH.",
      message: "IFLY101, [STATION], wind 270 at 6, runway 27 in use, QNH 1013, expect ILS runway 27.",
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

    // ⑦ Advise intentions — commit to VABB (training test: VAAH too short).
    // Gated on `inform_atc_intentions` (P19) so the crew's INFORM-ATC procedure card
    // (P19) comes BEFORE this ATC exchange (A9). Kind:"crew" — crew-initiated call.
    // gapAfterMs 30 s → HOLD request next.
    {
      id: "atc_intentions_advise",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "inform_atc_intentions",
      kind: "crew",
      from: "PM → [STATION_CAPS]",
      message: "FORDEC complete. Advise intentions to ATC.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — VABB RWY 27 (3 445 m): adequate for flapless + accumulator-brake landing
        { id: "a", label: "[STATION], IFLY101, diverting Mumbai, request vectors ILS runway 27",  correct: true  },
        // Wrong — VAAH RWY 23 (2 743 m): insufficient for flapless with accumulator brakes only
        { id: "b", label: "[STATION], IFLY101, diverting Ahmedabad, request vectors runway 23",                   correct: false },
        // Wrong — no clear divert decision communicated to ATC
        { id: "c", label: "[STATION], IFLY101, requesting descent 3 000 feet",                                    correct: false },
      ],
    },
    // ATC acknowledges the diversion + gives a specific routing/transition point to proceed
    // towards Mumbai [user 2026-06-30]. DRAFT routing (BIDUR) · SME review.
    {
      id: "atc_intentions_ack",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "inform_atc_intentions",
      completesStep: "intentions_acked",   // ATC routing received → the crew then executes it (FMGC PREP)
      kind: "atc",
      from: "[STATION_CAPS]",
      pilotSays: "[STATION], IFLY101, diverting Mumbai, request vectors ILS runway 27.",
      message: "IFLY101, roger, divert Mumbai approved — cleared direct BIDUR, expect ILS runway 27.",
      standbyResurfaceMs: 15_000,
      choices: [
        { id: "a", label: "Direct BIDUR, expect ILS runway 27, IFLY101",  correct: true  },
        { id: "b", label: "Roger, IFLY101",                                correct: false },
        { id: "c", label: "Direct Mumbai, IFLY101",                        correct: false },
      ],
    },

    // ⑧ Request hold — ~30 s after intentions; crew needs time for prep.
    // ═══ DESCENT-TO-7000 REQUEST — conditional branch decided at ~10 500 ft ═══════════
    // VECTORS path (prep_ready: briefing done by 10 500). Crew requests descent + long
    // vectors — the wording does NOT announce "approach preparation complete" to ATC.
    {
      id: "atc_hold_req",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "prep_ready",
      completesStep: "vectors_requested",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Request descent and long vectors for the approach.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, request descent 7000 feet and long vectors for ILS runway 27",  correct: true  },
        // Wrong — requests a hold (prep is complete; a hold just wastes track miles)
        { id: "b", label: "Mumbai Approach, IFLY101, request holding, two-minute legs",  correct: false },
        // Wrong — requests an immediate approach with no track miles left for the approach checklist
        { id: "c", label: "Mumbai Approach, IFLY101, request immediate ILS approach runway 27",  correct: false },
      ],
    },
    {
      id: "atc_hold_clr",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "vectors_requested",
      completesStep: "descent_7k_cleared",   // read-back only -> then the FCU-SELECT 7000 card drives the PFD [user 2026-07-01]
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, descend 7000 feet, vectors for ILS runway 27, advise when ready for approach.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Descend 7000 feet, vectors ILS runway 27, IFLY101",  correct: true  },
        { id: "b", label: "Descending, IFLY101",                                 correct: false },
        { id: "c", label: "Roger IFLY101",                                       correct: false },
      ],
    },
    // HOLD path (prep_late: briefing NOT done by 10 500 → level 10 000, request a hold).
    {
      id: "atc_holdpattern_req",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "prep_late",
      completesStep: "holdpattern_requested",
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Not yet ready — request a hold to complete approach preparation.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, request holding, two-minute legs, to complete approach preparation",  correct: true  },
        // Wrong — requests vectors/descent before the approach is prepared
        { id: "b", label: "Mumbai Approach, IFLY101, request descent 7000 feet and long vectors for ILS runway 27",  correct: false },
        { id: "c", label: "Mumbai Approach, IFLY101, ready for approach",  correct: false },
      ],
    },
    {
      id: "atc_holdpattern_clr",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "holdpattern_requested",
      completesStep: "descent_7k_cleared",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, hold present position, two-minute legs, descend 7000 feet, advise when ready for approach.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Hold present position, two-minute legs, descend 7000 feet, IFLY101",  correct: true  },
        { id: "b", label: "Holding, IFLY101",                                                     correct: false },
        { id: "c", label: "Roger IFLY101",                                                        correct: false },
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
      completesStep: "emg_services_sent",   // [user 2026-07-01] the FLAP/GPWS panel pops only AFTER this A19 call is addressed
      kind: "crew",
      from: "PM → [STATION_CAPS]",
      message: "Request emergency services for runway 27, and advise the runway-vacate situation.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — full emergency services + the operationally-relevant fact that
        // the runway cannot be vacated (no nose-wheel steering).
        { id: "a", label: "[STATION], IFLY101, request full emergency services runway 27, and advise we will be unable to vacate the runway — nose-wheel steering inoperative",  correct: true  },
        // Wrong — omits the unable-to-vacate advice ATC needs to plan the runway closure
        { id: "b", label: "[STATION], IFLY101, request full emergency services runway 27",                                                                                       correct: false },
        // Wrong — piecemeal; "fire trucks only" is not "full emergency services"
        { id: "c", label: "[STATION], IFLY101, request fire trucks and foam runway 27",                                                                                          correct: false },
      ],
    },

    // ⑫ Ready for approach — only AFTER the approach checklist is complete.
    {
      // PILOT-initiated — the crew reports ready and requests the approach (not ATC asking)
      // [user 2026-06-30]. ATC then clears the approach (next card).
      id: "atc_ready_for_approach",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "approach_cl_hyd",
      // [user 2026-06-30] Held until ~7 000 ft: vectors path completes the checklist by 12 500,
      // but READY-FOR-APPROACH + the 5 000 clearance happen once level at the 7 000 platform.
      atAltitudeBelowFt: 7_500,
      completesStep: "ready_app_reported",   // A20 → A21 → P33 sequence
      kind: "crew",
      from: "PM → MUMBAI APPROACH",
      message: "Approach checklist complete — report ready and request the approach.",
      standbyResurfaceMs: 15_000,
      choices: [
        // Correct — report ready + request the approach (vectors/long final already requested earlier)
        { id: "a", label: "Mumbai Approach, IFLY101, ready, request the ILS approach runway 27",  correct: true  },
        // Wrong — re-requests vectors/long final that were already requested at the descent request
        { id: "b", label: "Mumbai Approach, IFLY101, ready, request vectors and a long final",  correct: false },
        { id: "c", label: "Mumbai Approach, IFLY101, continuing on vectors",  correct: false },
      ],
    },

    // ⑬ ILS clearance + "advise when stabilised" — full readback.
    {
      id: "atc_cleared_approach",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "ready_app_reported",   // [user 2026-06-30] fires only AFTER A20 (ready-for-approach)
      atAltitudeBelowFt: 7_500,   // the 5 000 + ILS clearance fires at the 7 000 platform
      completesStep: "approach_cleared",   // → gates P33 (descend_3700)
      kind: "atc",
      from: "MUMBAI APPROACH",
      pilotSays: "Mumbai Approach, IFLY101, ready for the approach, request vectors for ILS runway 27.",
      message: "IFLY101, roger, turn right heading 240, descend 5 000 feet, cleared ILS runway 27 approach, advise when stabilised.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Right heading 240, descend 5 000, cleared ILS runway 27, will advise when stabilised, IFLY101",  correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                                                          correct: false },
        { id: "c", label: "Cleared ILS runway 27, IFLY101",                                                                                        correct: false },
      ],
    },

    // ⑭ Crew reports STABILISED ON ILS — after GEAR GRAVITY EXTENSION. Crew-initiated.
    {
      id: "atc_stabilised_report",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "gs_intercept",
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

    // A19 — crew reports ESTABLISHED on the ILS → MUMBAI APPROACH (radar) hands the crew
    // to TOWER (changeover). [user 2026-06-29: A19 = ATC changeover to Tower]
    {
      id: "atc_tower_contact",
      atMs: 1_000,
      gapAfterMs: 5_000,
      requiresStep: "landing_cl_hyd",
      kind: "atc",
      from: "MUMBAI APPROACH",
      pilotSays: "Mumbai Approach, IFLY101, established on the ILS runway 27.",
      message: "IFLY101, contact Mumbai Tower 118.10.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Contact Tower 118.10, IFLY101",  correct: true  },
        { id: "b", label: "Switching, IFLY101",             correct: false },
        { id: "c", label: "Roger, IFLY101",                 correct: false },
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
      message: "IFLY101, runway 27 cleared to land, wind 270 at 6, ARFF in position.",
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
      // yellowElec removed — YELLOW ELEC PUMP is approach-only (deferred).
    },
    // GPWS 3D panel (window-2, approach CONFIG phase) — pushbutton → step. [user 2026-07-06]
    gpwsMap: {
      ldgFlap3: "gpws_ldg_flap3",   // LDG FLAP 3 → ON  (QRH: first)
      flapMode: "gpws_flap_mode",   // FLAP MODE → OFF  (second)
    },
    controlPanel: [
      { stepId: "ptu_off",           kind: "toggle_sw" as const, label: "PTU",       sub: "OFF"      },
      { stepId: "grn_eng1_pump_off", kind: "toggle_sw" as const, label: "ENG 1",     sub: "PUMP OFF" },
      { stepId: "yel_eng2_pump_off", kind: "toggle_sw" as const, label: "ENG 2",     sub: "PUMP OFF" },
      // Side controls removed [user 2026-07-06]: GPWS LDG FLAP 3 ON + FLAP MODE OFF → GPWS 3D panel (gpwsMap,
      // window-2); L/G GRVTY EXTN → checklist card (gravity gear at 5 000). HYD panel fills the whole space.
    ],
    // Cruise (FL350, clean) engine indications — HYD failure does not affect the engines.
    // Engine values are driven LIVE by flight phase (idle/level/cruise/climb/approach) in the
    // runner via phaseEngine() — these static rows are only the fallback. [user 2026-07-05]
    eng1: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.0",  c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "600",   c: "green" } }] },
        { label: "N2",     unit: "%",    states: [{ value: { v: "94.0",  c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "1150",  c: "green" } }] },
        { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
    eng2: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.0",  c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "601",   c: "green" } }] },
        { label: "N2",     unit: "%",    states: [{ value: { v: "94.2",  c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "1150",  c: "green" } }] },
        { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
    // Cruise E/WD extras — DRAFT, need SME review.
    fob:    [{ value: "5000" }],
    thrust: { mode: [{ value: "CLB" }], value: [{ value: "84.0" }] },
    // Slat/flap CONF follows the flap-selection cards (slats extend; flaps stay jammed via slatFlapFault). [user 2026-07-06]
    flap:   [
      { when: { step: "flap_3" }, value: "3" },
      { when: { step: "flap_2" }, value: "2" },
      { when: { step: "flap_1" }, value: "1" },
      { value: "0" },
    ],
    // Slat/flap FAULT — once G+Y fails, FLAPS are JAMMED (F amber) per QRH 29.03A
    // APPROACH "SLATS SLOW / FLAPS JAMMED". Flap index turns amber. 
    slatFlapFault: {
      flap: [{ when: { trigger: "structural_fail" }, value: true }, { value: false }],
    },
    // Non-ECAM MEMO (cruise) — state-driven per FCOM (SEAT BELTS / LDG LT), NOT the T.O memo.
    memo: [
      { line: "SEAT BELTS", color: "green" },
      { line: "LDG LT",     color: "green", right: true },
    ],
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
      // the BLUE SYS section above.) RAT does NOT deploy for a
      // pure G+Y loss — blue stays on its ELEC pump.
      tray: {
        title: "HYD PANEL — ECAM ACTIONS",
        note: "PTU OFF → G ENG 1 PUMP OFF → Y ENG 2 PUMP OFF. (Y ELEC PUMP ON is approach-only — used if Y lost by ENG 2 PUMP LO PR to charge the accumulator, ~7 full brake applications — deferred to the approach procedure.)",
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
            // YELLOW ELEC PUMP stays normal — not commanded in this scenario
            // (approach-only action, deferred). Row kept so the synoptic is complete.
            label: "Y ELEC", sub: "PUMP ON",
            states: [
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
        note: "All ELAC, SEC and FAC computers lost on G+Y failure. Only blue hydraulic circuit available for ailerons + elevator.",
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
