import type { Scenario } from "@/scenarios/types";
import { DUAL_HYD_G_B_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-HYD p.37-39 : HYD G+B SYS LO PR
// FCOM ABN summary         : DUAL HYDRAULIC (G+B) FAILURE
// FCTM PR-AEP-HYD          : DUAL HYDRAULIC FAILURES / Remaining systems
// Fleet variant            : P4576, SA table (ANTI SKID and N/W STRG available)

export const dualHydGB: Scenario = {
  meta: DUAL_HYD_G_B_META,
  brief: {
    situation:
      "Cruise FL350, VIDP-VABB. A combined hydraulic fault has led to GREEN system low pressure and BLUE system loss following BLUE ELEC PUMP low pressure. HYD G+B SYS LO PR warning fires (Level 3, red, CRC). YELLOW hydraulic pressure remains available, but the aircraft reverts to ALTN LAW (PROT LOST), then DIRECT LAW when the gear is extended. Ailerons are lost, only the right elevator remains, slats are lost, and the approach must be planned as a manual FLAP 3 landing. This trainer variant uses the FCTM P4576/SA remaining-systems table: anti-skid and nose-wheel steering remain available on landing.",
    job: "Aviate first and keep hydraulic demand low. Run the HYD G+B SYS LO PR ECAM in FCOM order: RAT MAN ON if BLUE lost by ELEC PUMP LO PR, affected pumps OFF, then plan the LAND ASAP diversion. Use selected speed, A/THR OFF if hydraulics are not recovered, no speedbrake, gravity gear extension at 200 kt, FLAP 3 for landing, VAPP = VREF + 25 kt, and brief the direct-law landing and go-around limits.",
  },

  triggers: [
    {
      id: "structural_fail",
      atMs: 4_000,
      description:
        "HYD G+B SYS LO PR - green and blue pressure <= 1 450 PSI. Level 3 WARNING (CRC + MASTER WARN), LAND ASAP red.",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "HYD G+B SYS LO PR" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "hyd_gb_lo", line: "HYD G+B SYS LO PR", level: "warning" },
            { id: "hyd_g_lo", line: "HYD G SYS LO PR", level: "caution" },
            { id: "hyd_b_lo", line: "HYD B SYS LO PR", level: "caution" },
            { id: "ecam_rat", line: "RAT.........MAN ON", level: "advisory" },
            { id: "ecam_g_pump", line: "G ENG 1 PUMP...OFF", level: "advisory" },
            { id: "ecam_b_pump", line: "B ELEC PUMP....OFF", level: "advisory" },
            { id: "ecam_manuv", line: "MANEUVER WITH CARE", level: "remark" },
            { id: "land_asap", line: "LAND ASAP", level: "warning" },
          ],
        },
      ],
    },
  ],

  steps: [
    {
      id: "maintain_control",
      label: "FLY THE AIRCRAFT",
      action: "MAINTAIN CONTROL",
      hint: "PF: AVIATE. F/CTL has reverted to ALTN LAW (PROT LOST). Use smooth inputs and avoid high hydraulic demand on the remaining YELLOW system. Expect no ailerons, right elevator only, slats lost, and no AP.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      requiresTrigger: "structural_fail",
    },
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARNING to silence the CRC. HYD G+B SYS LO PR remains displayed on ECAM.",
      variant: "warning",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: ["maintain_control"],
      afterEffect: {
        delayMs: 400,
        triggerId: "mw_hyd_gb_cancelled",
        effects: [{ type: "SET_MASTER_WARN", active: false }],
      },
    },
    {
      id: "rat_man_on",
      label: "RAT",
      action: "MAN ON",
      hint: "PM: if the BLUE system is lost by ELEC PUMP LO PR, press RAT MAN ON. FCOM also requires MIN RAT SPD 140 KT when the RAT is out.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_rat",
      requires: ["cancel_master_warn"],
    },
    {
      id: "grn_eng1_pump_off",
      label: "ENG 1 PUMP",
      action: "OFF",
      hint: "PM: GREEN ENG 1 PUMP pushbutton OFF. FCOM: affected pumps OFF for the failed hydraulic systems.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_g_pump",
      requires: ["rat_man_on"],
    },
    {
      id: "blu_elec_pump_off",
      label: "BLUE ELEC PUMP",
      action: "OFF",
      hint: "PM: BLUE ELEC PUMP pushbutton OFF. Continue with the unrecovered G+B configuration: selected speed, no speedbrake, FLAP 3 landing, and direct law after gear extension.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_b_pump",
      requires: ["grn_eng1_pump_off"],
      afterEffect: {
        delayMs: 500,
        triggerId: "hyd_gb_secondary",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "gb_no_spdbrk", line: "SPD BRK.....DO NOT USE", level: "caution" },
              { id: "gb_max_speed", line: "MAX SPEED...320/.77", level: "caution" },
              { id: "gb_appr_proc", line: "APPR PROC", level: "advisory" },
            ],
          },
        ],
      },
    },
    {
      id: "status_review",
      label: "STATUS",
      action: "REVIEW",
      hint: "PM reads the STATUS page slowly. Key items: SPD BRK DO NOT USE, FOR GA MAX PITCH 15 DEG, A/THR OFF, FOR LDG USE FLAP 3, GPWS LDG FLAP 3 ON, APPR SPD VREF +25 KT, LDG DIST PROC APPLY, and WHEN L/G DN: DIRECT LAW.",
      variant: "advisory",
      crew: "PM",
      requires: ["blu_elec_pump_off"],
      notes: [
        "FCOM abnormal summary: AVIGATE selected speed at actual speed.",
        "NAVIGATE: Land ASAP.",
        "COMMUNICATE: MAYDAY.",
        "After STATUS, go to the Dual Hydraulic QRH summary.",
      ],
    },
    {
      id: "landing_distance",
      label: "LDG DIST PROC",
      action: "APPLY",
      hint: "PM computes landing distance with QRH / EFB inputs for FLAP 3, VAPP = VREF +25 kt, ALTN BRK only, anti-skid available, no autobrake, REV 2 only, and direct-law handling.",
      variant: "advisory",
      crew: "PM",
      requires: ["status_review"],
    },
    {
      id: "fordec_hyd",
      label: "DECIDE",
      action: "DIVERT",
      hint: "Crew decision: immediate diversion to the nearest suitable long runway. Use the QRH summary and remaining-systems table to brief the landing configuration and the no-automation handling constraints.",
      variant: "advisory",
      crew: "PF",
      group: "flightcheck",
      requires: ["landing_distance"],
      notes: [
        "F - FACTS: dual G+B hydraulic loss, ALTN LAW then DIRECT LAW with gear down, no ailerons, right elevator only, slats lost, FLAP 3 landing.",
        "O - OPTIONS: long runway with emergency services and ILS preferred.",
        "R - RISKS: direct-law hand-flown approach, no speedbrake, limited roll control, long landing distance, max pitch 15 deg if go-around.",
        "D - DECISION: divert VABB runway 27.",
      ],
    },

    {
      id: "inform_atc_intentions",
      label: "INFORM ATC - INTENTIONS + BRIEFING",
      action: "CALL",
      hint: "Pilot-initiated call to ATC. PM: 'Mumbai Control, IFLY101 - dual hydraulic failure GREEN and BLUE, MAYDAY emergency confirmed, request immediate vectors VABB runway 27 ILS. Request latest weather, runway in use, NOTAMs, expected approach type. 186 souls on board.' Combines intentions and briefing request in one call.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec_hyd"],
      notes: [
        "Pilot-initiated. This is YOUR call to ATC, not a response.",
        "Format: 3x MAYDAY + station + callsign + nature + intentions + position/level + souls + briefing request.",
        "ATC reply with weather, runway, NOTAMs, and approach type appears as a distraction after this step and must be fully read back.",
      ],
    },
    {
      id: "fmgc_prep",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: F-PLN insert DEST VABB. Select runway 27, insert ILS frequency and course, and compute VAPP = VREF +25 kt with FLAP 3 final configuration. Check fuel against destination plus final reserve.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["inform_atc_intentions"],
    },
    {
      id: "nis_brief_hyd",
      label: "NITS BRIEF (SCCM)",
      action: "CONFIRM",
      hint: "Captain conducts the NITS brief on the interphone with the SCCM. If the aircraft is trimmed and stable, control can be temporarily transferred to complete the brief, then taken back.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fmgc_prep"],
      notes: [
        "N - NATURE: 'We have a major hydraulic system failure. The aircraft remains controllable.'",
        "I - INTENTIONS: 'We are diverting to Mumbai and will land runway 27. Full emergency services will meet the aircraft as a precaution.'",
        "T - TIME: 'Approximately 25 minutes to landing.'",
        "S - SPECIAL: 'Prepare the cabin for an abnormal landing in the normal way and report when secure.'",
      ],
    },
    {
      id: "pax_pa",
      label: "PASSENGER PA",
      action: "ANNOUNCE",
      hint: "Captain PA in a calm tone. Brief technical issue, diversion as a precaution, reassurance that the aircraft is under control, and instructions to follow cabin crew directions.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["nis_brief_hyd"],
      notes: [
        "'Ladies and gentlemen, this is your Captain speaking.'",
        "'We have a technical issue with one of our hydraulic systems, and as a precaution we are diverting to Mumbai.'",
        "'The aircraft remains under control and we expect to land in approximately 25 minutes.'",
        "'Please remain seated with your seat belts fastened and follow all cabin crew instructions.'",
      ],
    },
    {
      id: "inform_company",
      label: "INFORM COMPANY",
      action: "CALL",
      hint: "PM contacts Company Ops on ACARS, SATCOM, or company frequency. Inform: situation, diversion field, ETA, full emergency declared, passenger and fuel state, and support required at destination.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["pax_pa"],
      notes: [
        "Format: 'Company, IFLY101 - dual hydraulic failure GREEN and BLUE.'",
        "'Diverting to VABB, runway 27, ETA approximately 25 minutes.'",
        "'Full emergency declared. 186 souls on board, 12 tonnes fuel remaining.'",
        "'Request engineering meet aircraft and ground handling for abnormal arrival.'",
      ],
    },
    {
      id: "go_around_review",
      label: "GO-AROUND REVIEW",
      action: "CONFIRM",
      hint: "PF briefs the go-around plan for the G+B configuration: hand flown, direct law after gear extension, gear retraction inoperative, and max pitch 15 deg.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["inform_company"],
      notes: [
        "GO-AROUND CALL: 'GO AROUND, FOLLOW SRS'.",
        "TOGA gives positive climb, but pitch must be limited to 15 deg.",
        "GEAR remains down - retraction is inoperative.",
        "Keep bank conservative because roll control is reduced with no ailerons.",
      ],
    },
    {
      id: "atc_emergency_svcs",
      label: "ATC - EMERGENCY SERVICES",
      action: "ADVISE",
      hint: "PM: 'Mumbai Approach, IFLY101 - confirm full emergency services on runway 27. FLAP 3 approach, VAPP plus 25, direct-law landing after gravity gear, alternate brakes only, reverse 2 only, long rollout expected.' Request CFR vehicles in position.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["go_around_review"],
    },

    {
      id: "approach_brief_hyd",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF leads the approach brief. Cover: ILS runway 27, selected speed, A/THR OFF, FLAP 3, VAPP = VREF +25 kt, no speedbrake, gravity gear at 200 kt, direct law after gear down, alternate brakes only, anti-skid available, nose-wheel steering available on this fleet variant, reverse 2 only, and max pitch 15 deg for go-around.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["atc_emergency_svcs"],
      notes: [
        "Use selected speed on the FCU.",
        "FLAP 3 is the landing configuration.",
        "Gravity gear extension at 200 kt to revert sooner to direct law, per FCOM note.",
        "Tail-strike awareness and stabilized approach discipline are mandatory.",
        "For this trainer fleet variant, anti-skid and nose-wheel steering remain available on landing.",
      ],
    },
    {
      id: "approach_prep_hyd",
      label: "APPROACH PREP",
      action: "COMPLETE",
      hint: "PM sets ILS, QNH, minima, selected speed, and checks autobrake OFF. Confirm runway length, braking plan, reverse 2 availability, anti-skid availability, and nose-wheel steering availability on this fleet variant.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["approach_brief_hyd"],
    },
    {
      id: "athr_off",
      label: "A/THR",
      action: "OFF",
      hint: "PM: if hydraulics are not recovered, A/THR OFF per FCOM STATUS. Use selected speed because the aircraft may not satisfactorily maintain speed automatically with the lost slats and control surfaces.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["approach_prep_hyd"],
    },
    {
      id: "gpws_flap3_on",
      label: "GPWS LDG FLAP 3",
      action: "ON",
      hint: "PM: GPWS LDG FLAP 3 ON as required by the STATUS page for the FLAP 3 landing.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["athr_off"],
    },
    {
      id: "approach_cl_hyd",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs the approach checklist with the dual-hydraulic landing items highlighted.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["gpws_flap3_on"],
      notes: [
        "MDA / DH set.",
        "ECAM STATUS reviewed.",
        "AUTOBRAKE OFF.",
        "GPWS LDG FLAP 3 ON.",
        "Landing lights ON.",
      ],
    },
    {
      id: "lgr_gravity",
      label: "L/G",
      action: "GRVTY EXTN",
      hint: "PM: when speed is 200 kt, perform landing gear gravity extension in accordance with the QRH. This intentionally reverts the aircraft sooner to direct law, which gives better pitch control below 200 kt in the G+B configuration.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["approach_cl_hyd"],
    },
    {
      id: "landing_cl_hyd",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs the landing checklist: gear down by gravity, FLAP 3, selected speed at VAPP, direct law, alternate brakes only, anti-skid available, reverse 2 only, no speedbrake.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["lgr_gravity"],
      notes: [
        "FLAP 3.",
        "VAPP = VREF +25 kt.",
        "Direct law after gear down.",
        "Anti-skid and nose-wheel steering available on this fleet variant.",
        "Go-around max pitch 15 deg.",
      ],
    },
  ],

  statusItems: [
    { id: "st_min_rat", line: "MIN RAT SPD (IF RAT OUT) 140 KT", severity: "caution" },
    { id: "st_max_spd", line: "MAX SPEED . . . . . . 320/0.77", severity: "caution" },
    { id: "st_manv", line: "MANEUVER WITH CARE", severity: "caution" },
    { id: "st_spdbrk", line: "SPD BRK . . . . . DO NOT USE", severity: "caution" },
    { id: "st_ga_pitch", line: "FOR GA . . MAX PITCH 15 DEG", severity: "caution" },
    { id: "st_fuel", line: "FUEL CONSUMPT INCRSD", severity: "advisory" },
    { id: "st_appr_proc", line: "APPR PROC", severity: "advisory" },
    { id: "st_dual_hyd", line: "DUAL HYD LO PR", severity: "advisory" },
    { id: "st_athr", line: "A/THR . . . . . . . . OFF", severity: "caution" },
    { id: "st_ldg3", line: "FOR LDG . . . . USE FLAP 3", severity: "memo" },
    { id: "st_gpws", line: "GPWS LDG FLAP 3 . . . . ON", severity: "advisory" },
    { id: "st_vapp", line: "APPR SPD . . . . VREF+25 KT", severity: "memo" },
    { id: "st_ldg_dist", line: "LDG DIST PROC . . . . APPLY", severity: "memo" },
    { id: "st_altn", line: "ALTN LAW . . . . PROT LOST", severity: "caution" },
    { id: "st_direct", line: "WHEN L/G DN . . DIRECT LAW", severity: "caution" },
    { id: "st_inop_hyd", line: "G+B HYD", severity: "caution", inopSys: true },
    { id: "st_inop_fctl", line: "F/CTL PROT", severity: "caution", inopSys: true },
    { id: "st_inop_lelev", line: "L ELEV", severity: "caution", inopSys: true },
    { id: "st_inop_ail", line: "L+R AIL", severity: "caution", inopSys: true },
    { id: "st_inop_splr", line: "SPLR 1+3+5", severity: "caution", inopSys: true },
    { id: "st_inop_slats", line: "SLATS", severity: "caution", inopSys: true },
    { id: "st_inop_ap", line: "AP 1+2", severity: "caution", inopSys: true },
    { id: "st_inop_abrk", line: "AUTO BRK", severity: "caution", inopSys: true },
    { id: "st_inop_nbrk", line: "NORM BRK", severity: "caution", inopSys: true },
    { id: "st_inop_lgr", line: "L/G RETRACT", severity: "caution", inopSys: true },
    { id: "st_inop_rev", line: "REVERSER 1", severity: "caution", inopSys: true },
    { id: "st_inop_gpump", line: "G ENG 1 PUMP", severity: "caution", inopSys: true },
    { id: "st_inop_bpump", line: "B ELEC PUMP", severity: "caution", inopSys: true },
    { id: "st_inop_yd", line: "YAW DAMPER 1", severity: "caution", inopSys: true },
    { id: "st_inop_cat2", line: "CAT 2", severity: "caution", inopSys: true },
    { id: "st_inop_gls", line: "GLS AUTOLAND", severity: "caution", inopSys: true },
    { id: "st_inop_steep", line: "STEEP APPR", severity: "caution", inopSys: true },
  ],

  distractions: [
    {
      id: "atc_handoff_checkin",
      atMs: 10_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, Mumbai Control, checking in, maintain FL350.",
      standbyResurfaceMs: 20_000,
      choices: [
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure G and B, maintaining FL350, request immediate vectors nearest suitable long runway, standby", correct: true },
        { id: "b", label: "IFLY101, FL350, good day", correct: false },
        { id: "c", label: "Standby IFLY101", correct: false },
      ],
    },
    {
      id: "atc_vectors_when_ready",
      atMs: 60_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, vectors available when ready, descend at your discretion.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing checklist, will advise when ready, IFLY101", correct: true },
        { id: "b", label: "Standby IFLY101", correct: true },
        { id: "c", label: "IFLY101 turn left direct Mumbai, descend FL100", correct: false },
      ],
    },
    {
      id: "atc_nearest_options",
      atMs: 35_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      pilotSays:
        "MAYDAY MAYDAY MAYDAY, Mumbai Control, IFLY101, dual hydraulic failure GREEN and BLUE, flight controls degraded, maintaining FL350, request immediate vectors to nearest suitable airport with at least 3 000 m runway, 186 souls on board.",
      message:
        "IFLY101, Mumbai Control, roger MAYDAY. Nearest: VAAH Ahmedabad 80 miles, runway 23, 2 743 m. Alternate: VABB Mumbai 140 miles, runway 27, 3 445 m. Advise.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Request vectors VABB runway 27, long runway required for the degraded direct-law landing, IFLY101", correct: true },
        { id: "b", label: "Accepting VAAH Ahmedabad runway 23, IFLY101", correct: false },
        { id: "c", label: "Continuing to destination, IFLY101", correct: false },
      ],
    },
    {
      id: "atc_briefing_info",
      atMs: 165_000,
      requiresStep: "inform_atc_intentions",
      kind: "atc",
      from: "MUMBAI APPROACH",
      pilotSays:
        "Mumbai Approach, IFLY101, request latest weather, runway in use, NOTAMs, and expected approach type for the emergency arrival.",
      message:
        "IFLY101, Mumbai Approach, wind 270 at 6, runway 27 in use, no significant NOTAMs, expect ILS runway 27, QNH 1013.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Wind 270 at 6, runway 27, ILS runway 27, QNH 1013, no significant NOTAMs, IFLY101", correct: true },
        { id: "b", label: "Roger IFLY101", correct: false },
      ],
    },
    {
      id: "atc_pob_fuel_services",
      atMs: 195_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY101, 186 persons on board, 12 tonnes fuel, endurance 2 hours 30, request full emergency services, FLAP 3 landing, alternate brakes only, reverse 2 only, long rollout expected", correct: true },
        { id: "b", label: "Standby IFLY101", correct: false },
        { id: "c", label: "IFLY101, 186 persons on board, standard approach", correct: false },
      ],
    },
    {
      id: "atc_ready_for_approach",
      atMs: 225_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, advise when ready for approach.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY101 ready, request vectors for ILS runway 27, FLAP 3 approach, VAPP plus 25 knots", correct: true },
        { id: "b", label: "Ready, IFLY101", correct: false },
      ],
    },
    {
      id: "atc_cleared_approach",
      atMs: 255_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      pilotSays:
        "Mumbai Approach, IFLY101, ready for the approach, request vectors for ILS runway 27.",
      message:
        "IFLY101, turn left heading 240, descend 3 000 feet, cleared ILS runway 27 approach, contact Mumbai Tower 118.10 when established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 27, Tower 118.10 when established, IFLY101", correct: true },
        { id: "b", label: "Roger IFLY101", correct: false },
      ],
    },
    {
      id: "atc_tower_contact",
      atMs: 285_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      pilotSays: "Mumbai Tower, IFLY101, established ILS runway 27, MAYDAY confirmed.",
      message: "IFLY101, Mumbai Tower, roger, continue ILS runway 27, emergency services standing by.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 27, IFLY101", correct: true },
        { id: "b", label: "Switching, IFLY101", correct: false },
      ],
    },
    {
      id: "atc_cleared_to_land",
      atMs: 310_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      pilotSays:
        "Mumbai Tower, IFLY101, established ILS runway 27, gear gravity, FLAP 3, MAYDAY confirmed.",
      message:
        "IFLY101, runway 27 cleared to land, wind 270 at 6, ARFF in position, long rollout acknowledged.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Cleared to land runway 27, IFLY101", correct: true },
        { id: "b", label: "Roger IFLY101", correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "DIVERT_VABB",
      label: "DIVERT - VABB",
      description: "Divert to Mumbai runway 27 for the longer landing distance margin and full emergency support.",
      tone: "primary",
    },
    {
      value: "DIVERT_VAAH",
      label: "DIVERT - VAAH",
      description: "Ahmedabad is closer but offers less landing margin for the degraded direct-law FLAP 3 arrival.",
      tone: "secondary",
    },
    {
      value: "CONTINUE",
      label: "CONTINUE",
      description: "Continuing to destination is not acceptable with LAND ASAP and dual hydraulic degradation.",
      tone: "danger",
    },
  ],

  engineDisplay: {
    warningTrigger: "structural_fail",
    controlPanel: [
      { stepId: "rat_man_on", kind: "emer_pb" as const, label: "RAT", sub: "MAN ON" },
      { stepId: "grn_eng1_pump_off", kind: "toggle_sw" as const, label: "ENG 1", sub: "PUMP OFF" },
      { stepId: "blu_elec_pump_off", kind: "toggle_sw" as const, label: "BLU PMP", sub: "OFF" },
      { stepId: "athr_off", kind: "toggle_sw" as const, label: "A/THR", sub: "OFF" },
      { stepId: "gpws_flap3_on", kind: "toggle_sw" as const, label: "GPWS", sub: "LDG FLAP 3" },
      { stepId: "lgr_gravity", kind: "emer_pb" as const, label: "L/G", sub: "GRVTY EXTN" },
    ],
    eng1: {
      rows: [
        { label: "N1", unit: "%", states: [{ value: { v: "84.2", c: "green" } }] },
        { label: "EGT", unit: "°C", states: [{ value: { v: "620", c: "green" } }] },
        { label: "FF", unit: "KG/H", states: [{ value: { v: "2400", c: "green" } }] },
        { label: "STATUS", states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
    eng2: {
      rows: [
        { label: "N1", unit: "%", states: [{ value: { v: "84.2", c: "green" } }] },
        { label: "EGT", unit: "°C", states: [{ value: { v: "618", c: "green" } }] },
        { label: "FF", unit: "KG/H", states: [{ value: { v: "2350", c: "green" } }] },
        { label: "STATUS", states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
  },

  systemTabs: [
    {
      id: "eng",
      label: "ENG",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "BOTH ENGINES",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ENG 1 N1", unit: "%", states: [{ value: { v: "84.2", c: "green" } }] },
            { label: "ENG 2 N1", unit: "%", states: [{ value: { v: "84.2", c: "green" } }] },
            { label: "STATUS", states: [{ value: { v: "NORM", c: "green" } }] },
          ],
        },
      ],
    },
    {
      id: "hyd",
      label: "HYD",
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
              label: "PRESSURE",
              unit: "PSI",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "LO PR", c: "red" } },
                { value: { v: "3000", c: "green" } },
              ],
            },
            {
              label: "ENG 1 PUMP",
              states: [
                { when: { step: "grn_eng1_pump_off" }, value: { v: "OFF", c: "amber" } },
                { when: { trigger: "structural_fail" }, value: { v: "FAULT", c: "red" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "BLUE SYS",
          colorStates: [
            { when: { trigger: "structural_fail" }, value: "red" },
            { value: "green" },
          ],
          rows: [
            {
              label: "PRESSURE",
              unit: "PSI",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "LO PR", c: "red" } },
                { value: { v: "3000", c: "green" } },
              ],
            },
            {
              label: "ELEC PUMP",
              states: [
                { when: { step: "blu_elec_pump_off" }, value: { v: "OFF", c: "amber" } },
                { when: { trigger: "structural_fail" }, value: { v: "FAULT", c: "red" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            {
              label: "RAT",
              states: [
                { when: { step: "rat_man_on" }, value: { v: "DEPLOYED", c: "cyan" } },
                { value: { v: "STOWED", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "YELLOW SYS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "PRESSURE", unit: "PSI", states: [{ value: { v: "3000", c: "green" } }] },
            { label: "STATUS", states: [{ value: { v: "REMAINING SYS", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "HYD PANEL",
        note: "FCOM HYD G+B SYS LO PR: RAT MAN ON if BLUE lost by ELEC PUMP LO PR, affected pumps OFF, no speedbrake, A/THR OFF if not recovered, FLAP 3 landing.",
        switches: [
          {
            label: "GRN",
            sub: "ENG1 PMP",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "BLU",
            sub: "ELEC PMP",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "auto" as const },
            ],
          },
          { label: "YLW", sub: "SYS", states: [{ value: "norm" as const }] },
          {
            label: "RAT",
            states: [
              { when: { step: "rat_man_on" }, value: "armed" as const },
              { value: "norm" as const },
            ],
          },
        ],
      },
    },
    {
      id: "fctl",
      label: "FCTL",
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
              label: "CONTROL LAW",
              states: [
                { when: { step: "lgr_gravity" }, value: { v: "DIRECT LAW", c: "amber" } },
                { when: { trigger: "structural_fail" }, value: { v: "ALTN LAW", c: "amber" } },
                { value: { v: "NORM LAW", c: "green" } },
              ],
            },
            {
              label: "STABILIZER",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "AVAIL", c: "green" } },
                { value: { v: "AVAIL", c: "green" } },
              ],
            },
            {
              label: "ELEVATOR",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "R ELEV ONLY", c: "amber" } },
                { value: { v: "AVAIL", c: "green" } },
              ],
            },
            {
              label: "AILERON",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "INOP", c: "red" } },
                { value: { v: "AVAIL", c: "green" } },
              ],
            },
            {
              label: "SPOILERS",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "2 SPLR/WING", c: "amber" } },
                { value: { v: "FULL", c: "green" } },
              ],
            },
            {
              label: "SLATS / FLAPS",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "SLATS LOST / FLAPS SLOW", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "FCTL NOTE",
        note: "FCTM remaining systems for HYD G+B SYS LO PR: ALTN LAW then DIRECT LAW with gear down, stabilizer available, right elevator only, no ailerons, slats lost, flaps slow only.",
        switches: [
          {
            label: "AP",
            sub: "1+2",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "SPD BRK",
            states: [
              { when: { trigger: "structural_fail" }, value: "off" as const },
              { value: "norm" as const },
            ],
          },
        ],
      },
    },
    {
      id: "wheel",
      label: "WHEEL",
      alertStates: [{ when: { trigger: "structural_fail" }, value: true }, { value: false }],
      sections: [
        {
          title: "LANDING / BRAKING",
          colorStates: [
            { when: { trigger: "structural_fail" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "L/G EXTENSION",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "GRAVITY ONLY", c: "amber" } },
                { value: { v: "NORMAL", c: "green" } },
              ],
            },
            {
              label: "BRAKING",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "ALTN BRK ONLY", c: "amber" } },
                { value: { v: "NORMAL", c: "green" } },
              ],
            },
            {
              label: "ANTI SKID",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "AVAIL", c: "green" } },
                { value: { v: "AVAIL", c: "green" } },
              ],
            },
            {
              label: "N/W STRG",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "AVAIL", c: "green" } },
                { value: { v: "AVAIL", c: "green" } },
              ],
            },
            {
              label: "REVERSE",
              states: [
                { when: { trigger: "structural_fail" }, value: { v: "REV 2 ONLY", c: "amber" } },
                { value: { v: "BOTH", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "APPROACH NOTE",
        note: "Trainer fleet variant uses the FCTM P4576/SA remaining-systems table: anti-skid and nose-wheel steering remain available with G+B loss; alternate brakes only and reverse 2 only still apply.",
        switches: [
          {
            label: "AUTO BRK",
            states: [
              { when: { trigger: "structural_fail" }, value: "off" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "REV 1",
            states: [
              { when: { trigger: "structural_fail" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "REV 2",
            states: [
              { when: { trigger: "structural_fail" }, value: "norm" as const },
              { value: "norm" as const },
            ],
          },
          { label: "N/W STRG", states: [{ value: "norm" as const }] },
        ],
      },
    },
  ],

  phases: [
    {
      id: "cruise_stable",
      label: "CRUISE - NORMAL",
      atMs: 0,
      pfd: {
        speed: 280,
        targetSpeed: "M 0.78",
        altitude: 35_000,
        targetAltitude: 35_000,
        verticalSpeed: 0,
        fmaThrust: "SPEED",
        fmaPitch: "ALT CRZ",
        fmaLateral: "NAV",
        ap1: true,
        athr: true,
        notes: [
          "Normal cruise before the hydraulic event.",
          "Managed cruise profile established with AP1 and A/THR engaged.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 80,
        heading: 220,
        notes: ["Cruise navigation established toward destination."],
      },
      pf: {
        task: "Monitor cruise, systems, and route. No abnormal handling before the hydraulic failure.",
      },
      pm: {
        task: "Normal cruise monitoring and radios.",
      },
    },
    {
      id: "hyd_warning",
      label: "HYD G+B WARNING - AP LOST",
      atMs: 4_000,
      pfd: {
        speed: 280,
        targetSpeed: "M 0.78",
        altitude: 35_000,
        targetAltitude: 35_000,
        verticalSpeed: 0,
        fmaThrust: "SPEED",
        fmaPitch: "ALT CRZ",
        fmaLateral: "NAV",
        ap1: false,
        athr: true,
        flags: ["MASTER WARN (red)", "HYD G+B SYS LO PR", "AP OFF"],
        notes: [
          "Dual hydraulic failure disconnects the autopilot.",
          "Aircraft is now hand flown in ALTN LAW with no ailerons and right elevator only.",
          "FD and A/THR remain available at this stage.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 80,
        heading: 220,
        notes: ["Route remains displayed, but PF must immediately hand fly."],
      },
      pf: {
        task: "Aviate first. Keep pitch and bank small, maintain altitude, and avoid high hydraulic demand.",
      },
      pm: {
        task: "Identify HYD G+B SYS LO PR, cancel the warning when PF is stable, and prepare to run ECAM in sequence.",
      },
      overhead: {
        items: ["MASTER WARN - CANCEL"],
        notes: ["No pump or RAT action until the aircraft is stabilized."],
      },
    },
    {
      id: "ecam_actions",
      label: "ECAM ACTIONS - RAT / PUMPS",
      atMs: 20_000,
      pfd: {
        speed: 280,
        targetSpeed: "280 SELECTED",
        altitude: 35_000,
        targetAltitude: 35_000,
        verticalSpeed: 0,
        fmaThrust: "SPEED",
        fmaPitch: "ALT",
        fmaLateral: "NAV",
        ap1: false,
        athr: true,
        notes: [
          "Selected speed is used at the current speed per the abnormal summary.",
          "Manual flight continues in ALTN LAW while PM actions RAT and hydraulic pumps.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 80,
        heading: 220,
        notes: ["No route change yet; crew remains in cruise while ECAM is completed."],
      },
      pf: {
        task: "Maintain altitude and trim with care while PM completes RAT MAN ON and affected pump actions.",
      },
      pm: {
        task: "Run the ECAM in FCOM order: RAT MAN ON, GREEN ENG 1 PUMP OFF, BLUE ELEC PUMP OFF, then STATUS review.",
      },
      overhead: {
        items: ["RAT - MAN ON", "GREEN ENG 1 PUMP - OFF", "BLUE ELEC PUMP - OFF"],
        notes: ["ECAM actions are complete before the diversion plan is built."],
      },
    },
    {
      id: "status_and_diversion",
      label: "STATUS / QRH - LAND ASAP",
      atMs: 90_000,
      pfd: {
        speed: 275,
        targetSpeed: "275 SELECTED",
        altitude: 35_000,
        targetAltitude: 35_000,
        verticalSpeed: 0,
        fmaThrust: "SPEED",
        fmaPitch: "ALT",
        fmaLateral: "NAV",
        ap1: false,
        athr: true,
        notes: [
          "Crew is now in the STATUS and QRH summary phase.",
          "LAND ASAP, FLAP 3 landing, no speedbrake, and max go-around pitch 15 deg are identified.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 160,
        heading: 220,
        notes: ["Diversion options are being assessed for runway length and services."],
      },
      pf: {
        task: "Review the landing profile and decide on the nearest suitable long runway with emergency services.",
      },
      pm: {
        task: "Read the STATUS page, confirm landing-distance inputs, and declare MAYDAY to ATC.",
      },
      atc: {
        initiatedBy: "PM",
        transmissions: [
          {
            role: "PM",
            speech:
              "MAYDAY MAYDAY MAYDAY, Mumbai Control, IFLY101, dual hydraulic failure GREEN and BLUE, flight controls degraded, maintaining FL350, request immediate vectors VABB runway 27, 186 souls on board.",
          },
          {
            role: "ATC",
            station: "MUMBAI CONTROL",
            speech:
              "IFLY101, roger MAYDAY, radar contact, vectors available when ready, advise assistance required.",
          },
        ],
      },
    },
    {
      id: "descent_and_approach_prep",
      label: "DESCENT - SELECTED SPEED / APPROACH PREP",
      atMs: 180_000,
      pfd: {
        speed: 240,
        targetSpeed: "240 SELECTED",
        altitude: 12_000,
        targetAltitude: 3_000,
        verticalSpeed: -1_500,
        fmaThrust: "MAN THR",
        fmaPitch: "OP DES",
        fmaLateral: "HDG",
        ap1: false,
        athr: false,
        notes: [
          "A/THR is OFF for the unrecovered G+B configuration.",
          "Descent is flown with selected speed and manual thrust only.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 40,
        heading: 235,
        notes: ["Vectors received toward the ILS for runway 27."],
      },
      pf: {
        task: "Hand fly the descent on vectors, keeping control inputs smooth and speed strictly selected on the FCU.",
      },
      pm: {
        task: "Set up the ILS, minima, GPWS LDG FLAP 3 ON, and brief the FLAP 3 direct-law arrival.",
      },
      atc: {
        initiatedBy: "ATC",
        transmissions: [
          {
            role: "ATC",
            station: "MUMBAI APPROACH",
            speech:
              "IFLY101, turn left heading 240, descend 3 000 feet, cleared ILS runway 27 approach.",
          },
          {
            role: "PM",
            speech:
              "Left heading 240, descend 3 000, cleared ILS runway 27, IFLY101.",
          },
        ],
      },
      overhead: {
        items: ["GPWS LDG FLAP 3 - ON", "A/THR - OFF"],
      },
    },
    {
      id: "gear_gravity_direct_law",
      label: "200 KT - GRAVITY GEAR / DIRECT LAW",
      atMs: 260_000,
      pfd: {
        speed: 200,
        targetSpeed: "200",
        altitude: 3_000,
        targetAltitude: 3_000,
        verticalSpeed: -700,
        fmaThrust: "MAN THR",
        fmaPitch: "G/S*",
        fmaLateral: "LOC*",
        ap1: false,
        athr: false,
        flags: ["DIRECT LAW"],
        notes: [
          "At 200 kt the gear is gravity extended per FCOM.",
          "Control reverts to DIRECT LAW in pitch and roll after gear extension.",
        ],
      },
      nd: {
        mode: "ROSE ILS",
        range: 20,
        heading: 270,
        notes: ["Localizer interception in progress with gravity gear extension complete."],
      },
      pf: {
        task: "Maintain the intercept manually, anticipate the handling change into DIRECT LAW, and keep the aircraft stabilized.",
      },
      pm: {
        task: "Execute gravity gear extension at 200 kt, confirm gear down, and continue the landing checklist.",
      },
      overhead: {
        items: ["L/G GRVTY EXTN - USED"],
        notes: ["Direct-law handling begins after the gear is down."],
      },
    },
    {
      id: "final_stabilized",
      label: "FINAL - FLAP 3 / VAPP +25",
      atMs: 310_000,
      pfd: {
        speed: 165,
        targetSpeed: "VAPP +25",
        altitude: 1_000,
        targetAltitude: 0,
        verticalSpeed: -700,
        fmaThrust: "MAN THR",
        fmaPitch: "G/S",
        fmaLateral: "LOC",
        ap1: false,
        athr: false,
        notes: [
          "Aircraft stabilized in DIRECT LAW for a FLAP 3 landing.",
          "Anti-skid and nose-wheel steering remain available on this trainer fleet variant.",
          "Reverse 2 only and alternate braking remain part of the landing plan.",
        ],
      },
      nd: {
        mode: "ROSE ILS",
        range: 10,
        heading: 270,
        notes: ["Localizer and glideslope established on final."],
      },
      pf: {
        task: "Fly a fully stabilized ILS in DIRECT LAW with manual thrust, respecting the 15 deg go-around pitch limit if a go-around becomes necessary.",
      },
      pm: {
        task: "Monitor deviations, confirm FLAP 3 / VAPP +25 / gear down, and call deviations early because there is no autopilot margin.",
      },
      atc: {
        initiatedBy: "PM",
        transmissions: [
          {
            role: "PM",
            speech: "Mumbai Tower, IFLY101, established ILS runway 27, gear gravity, FLAP 3, MAYDAY confirmed.",
          },
          {
            role: "ATC",
            station: "MUMBAI TOWER",
            speech: "IFLY101, runway 27 cleared to land, wind 270 at 6, emergency services in position.",
          },
        ],
      },
    },
    {
      id: "landing_rollout",
      label: "LANDING - REV 2 ONLY",
      atMs: 340_000,
      pfd: {
        speed: 140,
        altitude: 0,
        verticalSpeed: 0,
        fmaThrust: "IDLE",
        fmaPitch: "FLARE",
        fmaLateral: "RWY",
        ap1: false,
        athr: false,
        notes: [
          "Touchdown in DIRECT LAW.",
          "Reverse 2 only, alternate braking, and available anti-skid / nose-wheel steering govern the rollout.",
        ],
      },
      nd: {
        mode: "ROSE ILS",
        range: 10,
        heading: 270,
        notes: ["Runway centerline guidance remains available for the rollout."],
      },
      pf: {
        task: "Hold directional control through touchdown and rollout, using only the planned braking and reverse capability.",
      },
      pm: {
        task: "Monitor deceleration, call any braking or directional issue, and coordinate emergency services after landing.",
      },
      overhead: {
        items: ["REV 2 - USED"],
      },
    },
  ],
};