import type { Scenario } from "@/scenarios/types";
import { ELEC_EMER_CONFIG_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-ELEC p.1  : ELEC EMER CONFIG procedure
// FCOM DSC-24            : Electrical system architecture
// QRH 2.01               : Emergency electrical configuration memory items

export const elecEmerConfig: Scenario = {
  meta: ELEC_EMER_CONFIG_META,
  brief: {
    situation:
      "Cruise FL330. Both generators have failed — AC BUS 1 and AC BUS 2 are UNPOWERED. Emergency electrical configuration. Batteries only. The EMER GEN may not be in line yet.",
    job: "FCOM: try GEN 1+2 reset (OFF then ON). If unsuccessful — EMER ELEC PWR MAN ON. Run ELEC EMER CONFIG procedure. Confirm EMER GEN in line. Plan immediate diversion. FLAP 3 landing, Vapp VREF+10/140 kt minimum.",
  },

  triggers: [
    {
      id: "gen_loss",
      atMs: 4_000,
      description: "Total AC generator failure — ELEC EMER CONFIG",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ELEC EMER CONFIG" },
        {
          type: "ADD_ECAM",
          messages: [
            // Left column — primary procedure
            { id: "ac_bus1",     line: "ELEC AC BUS 1 FAULT",              level: "warning"  },
            { id: "ac_bus2",     line: "ELEC AC BUS 2 FAULT",              level: "warning"  },
            { id: "emer_config", line: "ELEC EMER CONFIG",                  level: "warning"  },
            { id: "bat_only",    line: "BATTERIES ONLY — 30 MIN",           level: "remark"   },
            { id: "rat_arm",     line: "RAT — DEPLOY MAN IF NEEDED",       level: "advisory" },
            { id: "ac_ess_shed", line: "AC ESS BUS SHED",                   level: "caution"  },
            // Right column — LAND ASAP (no SECONDARY FAILURES: inhibited per FCOM DSC-31-15)
            { id: "land_asap",   line: "LAND ASAP",                         level: "warning"  },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── IMMEDIATE ────────────────────────────────────────────────────────────
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARN. Silences CRC. Do NOT delay RAT deployment.",
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
      id: "gen1_reset",
      label: "GEN 1",
      action: "RESET",
      hint: "PM: GEN 1 pb-sw → OFF then ON. Attempt to reset Generator 1.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["cancel_master_warn"],
    },
    {
      id: "gen2_reset",
      label: "GEN 2",
      action: "RESET",
      hint: "PM: GEN 2 pb-sw → OFF then ON. Attempt to reset Generator 2. If both GEN 1+2 reset unsuccessful → EMER ELEC PWR MAN ON.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["gen1_reset"],
    },
    {
      id: "emer_elec_pwr",
      label: "EMER ELEC PWR",
      action: "MAN ON",
      hint: "PM: EMER ELEC PWR pb → MAN ON. FCOM label — this is the RAT manual deployment. Provides AC ESS bus via EMER GEN. Min RAT speed 140 kt (EMER GEN powered from 125 kt). Gravity fuel feed active — avoid negative G.",
      variant: "warning",
      crew: "PM",
      hardware: true,
      ecamRef: "rat_arm",
      requires: ["gen2_reset"],
      afterEffect: {
        delayMs: 3_000,
        triggerId: "emer_gen_online",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "emer_gen_ok", line: "EMER GEN ONLINE — AC ESS BUS RESTORED", level: "advisory" },
            ],
          },
          { type: "CLEAR_ECAM", ids: ["rat_arm", "ac_ess_shed"] },
        ],
      },
    },
    {
      id: "eng_mode_ign",
      label: "ENG MODE SEL",
      action: "IGN",
      hint: "PM: FCOM step — ENG MODE SEL → IGN. Engines fed by gravity only in EMER CONFIG. IGN ensures relight protection during descent.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["emer_elec_pwr"],
    },
    {
      id: "vhf1_use",
      label: "VHF 1 / ATC 1",
      action: "USE",
      hint: "PM: FCOM — only VHF 1, HF 1 and ATC 1 are available in EMER ELEC CONFIG. Confirm crew using these radios only.",
      variant: "switch",
      crew: "PM",
      requires: ["emer_elec_pwr"],
    },
    {
      id: "ac_bus_check",
      label: "EMER CONFIG ACCEPT",
      action: "CONFIRM",
      hint: "PM: AC BUS 1 and 2 remain UNPOWERED — accept. EMER GEN powers AC ESS bus. FAC 1 and ELAC 2 lost → alternate law. Center tank fuel unusable. FMS predictions unreliable.",
      variant: "switch",
      crew: "PM",
      requires: ["eng_mode_ign"],
    },
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM: cancel MASTER CAUTION once ECAM procedure acknowledged.",
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

    // ── CRM / COMMS ───────────────────────────────────────────────────────────
    {
      id: "crew_brief_elec",
      label: "CREW BRIEF",
      action: "CONFIRM",
      hint: "PM: brief crew — electrical emergency, RAT deployed, 30 min bat power, divesting immediately.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["ac_bus_check"],
    },
    {
      id: "atc_mayday_elec",
      label: "ATC MAYDAY",
      action: "DECLARE",
      hint: "PM: 'MAYDAY MAYDAY MAYDAY, IFLY101, total electrical failure, RAT deployed, request immediate vectors nearest airport.'",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_brief_elec"],
    },
    {
      id: "pm_request_info",
      label: "REQUEST WX / RWY / NOTAMs / APPROACH",
      action: "CALL",
      hint: "Pilot-initiated call to ATC.  PM: 'Mumbai Approach, IFLY101 — request latest weather, runway in use, NOTAMs, and expected approach type.'  Needed BEFORE landing performance calc.  ATC will respond — read back fully.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["atc_mayday_elec"],
      notes: [
        "Pilot-initiated — this is YOUR call to ATC, not a response.",
        "This data feeds LDG PERF — make the call BEFORE running performance.",
        "ATC reply appears as an ATC distraction once this step is checked off.",
      ],
    },
    {
      id: "wx_ldg",
      label: "WX / LDG PERF",
      action: "CHECK",
      hint: "PM: using the weather/RWY/approach info from ATC, confirm landing performance for nearest suitable airport. Normal Vapp. ILS may be limited — nav aids on emergency bus only.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["pm_request_info"],
    },
    {
      id: "fordec_elec",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC. Limited nav, reduced FMGC, no autoland.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_ldg"],
      notes: [
        "F — FACTS: Total AC BUS loss. RAT online. ~30 min battery. FMGC degraded. ILS may be inop.",
        "O — OPTIONS: Nearest airport with any runway, even visual approach.",
        "R — RISKS: Limited nav, reduced FMGC, no autoland. Manual ILS approach.",
        "D — DECISION: Divert immediately, any available runway.",
        "E — EXECUTION: Manual ILS approach, RAT power only, basic instruments.",
        "C — CHECK-BACK: PM confirms and commits.",
      ],
    },
    {
      id: "nis_brief_elec",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "PM: SCCM brief — electrical emergency, diverting nearest, approximately 20 min, prepare for normal landing.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec_elec"],
      notes: [
        "N — NATURE: 'Total electrical failure, on emergency power'",
        "I — INTENTIONS: 'Diverting to nearest airport immediately'",
        "T — TIME: 'Approximately 20 minutes to landing'",
        "S — SPECIAL: 'Normal landing expected. Seatbelts fastened. Cabin equipment may be off.'",
      ],
    },
    {
      id: "approach_brief_elec",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF: FCOM STATUS — FOR LDG: USE FLAP 3. APPR SPD: VREF+10/140 kt minimum (RAT min 140 kt). Manual ILS, F-APP+RAW only. No autoland, no AP 1+2, no A/THR. Alternate law — direct law after gear extension. LDG DIST PROC: APPLY.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fordec_elec"],
    },
    {
      id: "approach_prep_elec",
      label: "APPROACH PREP",
      action: "COMPLETE",
      hint: "PM: set ILS manually on RMP 1. BARO minima. ANTI SKID INOP — be aware. Confirm landing lights on ESS bus. Max brake pressure 1000 PSI. Center tank unusable — check fuel.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["approach_brief_elec"],
    },
    {
      id: "approach_cl_elec",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs approach checklist — note limited system availability.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_prep_elec"],
      notes: [
        "BARO ............. QNH SET (manual via RMP 1)",
        "MDA/DH ........... SET",
        "SEAT BELTS ....... ON",
        "AUTOBRAKE ........ INOP (anti-skid INOP)",
        "LANDING LIGHTS ... ON (ESS bus)",
        "NOTE: FOR LDG — FLAP 3, VAPP = VREF+10 minimum 140 kt",
        "NOTE: F-APP + RAW guidance only",
      ],
    },
    {
      id: "landing_cl_elec",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs landing checklist at 1000 ft on final.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_cl_elec"],
      notes: [
        "GEAR ............. DOWN — 3 GREEN",
        "FLAPS ............ CONF 3 (FCOM: USE FLAP 3)",
        "CABIN ............ ADVISED",
        "MANUAL APPROACH — no autoland, direct law after gear down",
        "VAPP: VREF+10 / min 140 kt",
      ],
    },
  ],

  statusItems: [
    // ── Left column: FCOM PRO-ABN-ELEC ELEC EMER CONFIG STATUS ───────────────
    { id: "st_rat_spd",   line: "MIN RAT SPEED . . . 140 KT",      severity: "caution"  },
    { id: "st_max_spd",   line: "MAX SPEED . . . . . 320 KT",      severity: "caution"  },
    { id: "st_max_brk",   line: "MAX BRK PR . . 1 000 PSI",        severity: "caution"  },
    { id: "st_grvty",     line: "FUEL GRVTY FEED",                   severity: "caution"  },
    { id: "st_neg_g",     line: "AVOID NEGATIVE G FACTOR",           severity: "caution"  },
    { id: "st_fctl",      line: "ALTN LAW: PROT LOST",               severity: "caution"  },
    { id: "st_dir_law",   line: "WHEN L/G DN: DIRECT LAW",          severity: "caution"  },
    { id: "st_anti_sk",   line: "ANTI SKID . . . . . . INOP",       severity: "caution"  },
    { id: "st_nw_strg",   line: "N/W STRG . . . . . . INOP",        severity: "caution"  },
    { id: "st_slats",     line: "SLATS/FLAPS SLOW",                  severity: "caution"  },
    { id: "st_ctr_fuel",  line: "CTR TK FUEL UNUSABLE",              severity: "caution"  },
    { id: "st_appr",      line: "FOR LDG . . . . USE FLAP 3",       severity: "advisory" },
    { id: "st_vapp",      line: "APPR SPD . VREF+10/140 KT",        severity: "advisory" },
    { id: "st_ldg",       line: "LDG DIST PROC . . . . APPLY",      severity: "memo"     },
    { id: "st_fuel_incr", line: "FUEL CONSUMPT INCRSD",               severity: "advisory" },
    { id: "st_fms",       line: "FMS PRED UNRELIABLE",                severity: "advisory" },
    // ── Right column: INOP SYS (FCOM ELEC EMER CONFIG SYS REMAINING) ─────────
    { id: "st_inop_fctl",  line: "F/CTL PROT",      severity: "caution",  inopSys: true },
    { id: "st_inop_rev",   line: "REVERSER 1+2",     severity: "caution",  inopSys: true },
    { id: "st_inop_adr",   line: "ADR 2+3",          severity: "caution",  inopSys: true },
    { id: "st_inop_ir",    line: "IR 2",             severity: "caution",  inopSys: true },
    { id: "st_inop_ra",    line: "RA 1+2",           severity: "caution",  inopSys: true },
    { id: "st_inop_splr",  line: "SPLR 1+2+5",      severity: "caution",  inopSys: true },
    { id: "st_inop_elac",  line: "ELAC 2",           severity: "caution",  inopSys: true },
    { id: "st_inop_sec",   line: "SEC 2+3",          severity: "caution",  inopSys: true },
    { id: "st_inop_ap",    line: "AP 1+2",           severity: "caution",  inopSys: true },
    { id: "st_inop_athr",  line: "A/THR",            severity: "caution",  inopSys: true },
    { id: "st_inop_fuel",  line: "FUEL PUMPS",       severity: "caution",  inopSys: true },
    { id: "st_inop_ask",   line: "ANTI SKID",        severity: "caution",  inopSys: true },
    { id: "st_inop_nws",   line: "N/W STRG",         severity: "caution",  inopSys: true },
    { id: "st_inop_cat2",  line: "CAT 2",            severity: "caution",  inopSys: true },
    { id: "st_inop_steep", line: "STEEP APPR",       severity: "caution",  inopSys: true },
  ],

  // ── ATC sequence — mirrors eng1-fire-after-v1 ──────────────────────────────
  // Special constraint here: BATTERIES ONLY = ~30 min endurance.  Time is
  // the constraint — the crew cannot afford long STANDBYs once batteries
  // are the sole AC source.  RAT must be in line (EMER GEN online) before
  // any reasonable workload eases.
  distractions: [
    // ① Routine check-in just before the event
    {
      id: "atc_handoff_checkin",
      atMs: 8_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, Mumbai Control, checking in, maintain FL330.",
      standbyResurfaceMs: 15_000,
      choices: [
        // Correct — nature + heading + descent request + standby; no airport selection in initial MAYDAY
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, total electrical failure, heading 160, RAT deployed, 30 minutes battery only, request immediate descent, standby", correct: true  },
        // Wrong — airport selection in initial MAYDAY (airport only after FORDEC)
        { id: "b", label: "MAYDAY MAYDAY MAYDAY, IFLY101, electrical emergency, request immediate vectors nearest suitable airport, standby",                                  correct: false },
        // Wrong — no emergency declared
        { id: "c", label: "IFLY101, FL330, good day",                                                                                                                          correct: false },
      ],
    },

    // ② ATC acknowledges + initial vectors/altitude + assistance offer
    //   ATC gives the critical instructions (heading/altitude) then offers
    //   the assistance window for when crew workload eases.
    {
      id: "atc_radar_contact",
      atMs: 30_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, roger MAYDAY, radar contact, turn right heading 180 direct Mumbai, descend FL150 at your discretion. Advise any assistance required when ready.",
      standbyResurfaceMs: 20_000,
      choices: [
        // Correct — full readback + defer assistance to when workload eases
        { id: "a", label: "Right heading 180 direct Mumbai, descending FL150, will advise on assistance, IFLY101", correct: true  },
        // Wrong — bare ack drops the heading + assistance offer
        { id: "b", label: "Roger IFLY101",                                                                            correct: false },
        // Wrong — drops the heading (critical for traffic separation)
        { id: "c", label: "Descending FL150, IFLY101",                                                                correct: false },
      ],
    },

    // ③ ATC asks for endurance status — pilot must communicate battery limit
    {
      id: "atc_endurance_query",
      atMs: 65_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, say endurance and any operational restrictions.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — declares the battery-only 30-min limit (mission-critical for ATC)
        { id: "a", label: "IFLY101, batteries only — 30 minutes maximum endurance, no autopilot, no transponder if batteries deplete, request priority handling", correct: true  },
        { id: "b", label: "Standby IFLY101",                                                                                                                        correct: false },
        // Wrong — under-informative for an EMER CONFIG event
        { id: "c", label: "IFLY101, no operational restrictions",                                                                                                    correct: false },
      ],
    },

    // ③b Weather request crew card — PM proactively calls for weather/runway/approach info
    //    Gated on atc_mayday_elec (MAYDAY declared) — tests correct proactive call phraseology.
    //    No hold card here (ELEC EMER CONFIG exception: 30-min battery makes holding unacceptable).
    {
      id: "pm_weather_request",
      atMs: 100_000,
      requiresStep: "atc_mayday_elec",
      kind: "crew",
      from: "PM",
      message: "PM makes the proactive call to Mumbai Approach for weather, runway, and approach info before computing landing performance. Select the correct call.",
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, request latest weather, runway in use, NOTAMs, and expected approach type",  correct: true  },
        // Wrong — requests immediate vectors (routing decision) instead of weather info
        { id: "b", label: "Mumbai Approach, IFLY101, request immediate vectors ILS runway 27",                                   correct: false },
        // Wrong — vague; ATC cannot respond without specific data request
        { id: "c", label: "Mumbai Approach, IFLY101, we have an emergency, advise",                                               correct: false },
      ],
    },

    // ④ ATC delivers requested info — STEP-TRIGGERED on pm_request_info.
    //   The PILOT initiated the call earlier (pm_request_info step) BEFORE
    //   the LDG PERF calculation, since that data feeds performance.  ATC
    //   responds here; pilot reads back fully, then uses it for LDG PERF.
    {
      id: "atc_briefing_info",
      atMs: 60_000,
      requiresStep: "pm_request_info",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, Mumbai Approach, roger your request. Wind 270 at 6, runway 27 in use, NOTAMs nil significant, expect ILS runway 27, QNH 1013.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — full readback of every briefing item
        { id: "a", label: "Wind 270 at 6, runway 27, ILS 27, QNH 1013, no significant NOTAMs, IFLY101", correct: true  },
        // Wrong — minimal acknowledgement loses the data
        { id: "b", label: "Roger IFLY101",                                                                correct: false },
        // Wrong — partial readback, missed approach type
        { id: "c", label: "Wind 270 at 6, runway 27, IFLY101",                                            correct: false },
      ],
    },

    // ⑤b Intentions crew card — PM advises final airport selection after FORDEC
    //    No hold for ELEC EMER CONFIG (battery constraint) — go direct to airport
    {
      id: "pm_intentions",
      atMs: 155_000,
      requiresStep: "fordec_elec",
      kind: "crew",
      from: "PM",
      message: "FORDEC is complete. PM advises ATC of final diversion airport and requests direct routing. Select the correct call.",
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, diverting Mumbai, request direct Mumbai, descend 3000 feet for ILS runway 27", correct: true  },
        // Wrong — selects wrong airport (Ahmedabad is not the established nearest suitable)
        { id: "b", label: "Mumbai Approach, IFLY101, diverting Ahmedabad, request vectors Ahmedabad ILS",                          correct: false },
        // Wrong — continuing on track without a diversion decision
        { id: "c", label: "Mumbai Approach, IFLY101, unable divert, maintaining current track",                                     correct: false },
      ],
    },

    // ⑥ POB / fuel / services
    {
      id: "atc_pob_fuel_services",
      atMs: 165_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, say persons on board and assistance required.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — POB + fuel + endurance + services only; no technical aircraft status
        { id: "a", label: "IFLY101, 186 persons on board, 9 tonnes fuel, 20 minutes endurance, request full emergency services in position", correct: true  },
        { id: "b", label: "Standby IFLY101",                                                                                                   correct: false },
        // Wrong — under-informative
        { id: "c", label: "IFLY101, 186 POB, normal approach",                                                                                  correct: false },
      ],
    },

    // ⑦ Ready for approach
    {
      id: "atc_ready_for_approach",
      atMs: 195_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, advise when ready for approach.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY101 ready, request vectors for ILS runway 27, flap 3 approach, Vapp plus 10 knots, manual ILS only", correct: true  },
        { id: "b", label: "Ready, IFLY101",                                                                                            correct: false },
        { id: "c", label: "Standby IFLY101",                                                                                            correct: false },
      ],
    },

    // ⑧ Approach clearance
    {
      id: "atc_cleared_approach",
      atMs: 220_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, turn left heading 240, descend 3 000 feet, cleared ILS runway 27 approach, contact Mumbai Tower 118.10 when established.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 27, contact Tower 118.10 when established, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                                            correct: false },
        { id: "c", label: "Cleared ILS runway 27, IFLY101",                                                                            correct: false },
      ],
    },

    // ⑨ Tower contact
    {
      id: "atc_tower_contact",
      atMs: 245_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      message: "IFLY101, Mumbai Tower, continue ILS approach runway 27, report established, emergency services standing by.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 27, will report established, IFLY101", correct: true  },
        { id: "b", label: "Switching, IFLY101",                                          correct: false },
      ],
    },

    // ⑩ Cleared to land
    {
      id: "atc_cleared_to_land",
      atMs: 270_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      message: "IFLY101, runway 27 cleared to land, wind 270 at 6, ARFF in position.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Cleared to land runway 27, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                       correct: false },
        { id: "c", label: "Cleared to land runway 28, IFLY101", correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Divert to the nearest airport with any runway — battery time is critical.",
      tone: "primary",
    },
    {
      value: "LAND_IMMEDIATELY",
      label: "LAND IMMEDIATELY",
      description: "Land as soon as possible — ~30 minutes of battery. Every minute counts.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Return to departure — acceptable if genuinely closer.",
      tone: "secondary",
    },
    {
      value: "CONTINUE",
      label: "CONTINUE",
      description: "Continue to destination — battery will not last. Never appropriate.",
      tone: "danger",
    },
  ],

  engineDisplay: {
    warningTrigger: "gen_loss",
    controlPanel: [
      { stepId: "gen1_reset",    kind: "toggle_sw" as const, label: "GEN 1",     sub: "RESET"  },
      { stepId: "gen2_reset",    kind: "toggle_sw" as const, label: "GEN 2",     sub: "RESET"  },
      { stepId: "emer_elec_pwr", kind: "emer_pb"   as const, label: "EMER ELEC", sub: "MAN ON" },
      { stepId: "eng_mode_ign",  kind: "toggle_sw" as const, label: "ENG MODE",  sub: "IGN"    },
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
            { label: "ENG 1 N1", unit: "%", states: [{ value: { v: "84.2", c: "green" } }] },
            { label: "ENG 2 N1", unit: "%", states: [{ value: { v: "84.2", c: "green" } }] },
            { label: "STATUS",              states: [{ value: { v: "NORM",  c: "green" } }] },
          ],
        },
      ],
    },
    {
      id: "elec", label: "ELEC",
      alertStates: [{ when: { trigger: "gen_loss" }, value: true }, { value: false }],
      autoSelect: { trigger: "gen_loss" },
      sections: [
        {
          title: "AC NETWORK",
          colorStates: [
            { when: { trigger: "gen_loss" }, value: "red" },
            { value: "green" },
          ],
          rows: [
            {
              label: "GEN 1",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "FAULT / OFF", c: "red" } },
                { value: { v: "ON", c: "green" } },
              ],
            },
            {
              label: "GEN 2",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "FAULT / OFF", c: "red" } },
                { value: { v: "ON", c: "green" } },
              ],
            },
            {
              label: "AC BUS 1",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "UNPOWERED", c: "red" } },
                { value: { v: "GEN 1", c: "green" } },
              ],
            },
            {
              label: "AC BUS 2",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "UNPOWERED", c: "red" } },
                { value: { v: "GEN 2", c: "green" } },
              ],
            },
            {
              label: "AC ESS BUS",
              states: [
                { when: { step: "rat_deploy" },  value: { v: "RAT (RESTORED)", c: "cyan" } },
                { when: { trigger: "gen_loss" }, value: { v: "BAT ONLY", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "DC NETWORK",
          colorStates: [
            { when: { trigger: "gen_loss" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "BAT 1",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "DISCHARGING", c: "amber" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            {
              label: "BAT 2",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "DISCHARGING", c: "amber" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            {
              label: "ESS TR",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "ALTN", c: "cyan" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "ELEC PANEL",
        note: "FCOM DSC-24: Total generator loss → battery-only. RAT MAN ON deploys RAT → restores AC ESS bus via ESS TR.",
        switches: [
          {
            label: "GEN 1",
            states: [
              { when: { trigger: "gen_loss" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "GEN 2",
            states: [
              { when: { trigger: "gen_loss" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BAT 1", states: [{ value: "auto" as const }] },
          { label: "BAT 2", states: [{ value: "auto" as const }] },
        ],
      },
    },
    {
      id: "hyd", label: "HYD",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "BLUE SYS",
          colorStates: [{ value: "green" }],
          rows: [
            {
              label: "ELEC PUMP",
              states: [
                { when: { step: "rat_deploy" }, value: { v: "ON (RAT)", c: "cyan" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            { label: "GREEN SYS",  states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "YELLOW SYS", states: [{ value: { v: "NORM", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "HYD NOTE",
        note: "Blue ELEC pump powered by RAT AC ESS bus after RAT deployment. Green and Yellow systems normal — both engines running.",
        switches: [
          { label: "BLU", sub: "ELEC PMP", states: [{ value: "auto" as const }] },
        ],
      },
    },
    {
      id: "air", label: "AIR",
      alertStates: [
        { when: { trigger: "gen_loss" }, value: true },
        { value: false },
      ],
      sections: [
        {
          title: "PACKS",
          colorStates: [
            { when: { trigger: "gen_loss" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "PACK 1",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "OFF (AC LOST)", c: "amber" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            {
              label: "PACK 2",
              states: [
                { when: { trigger: "gen_loss" }, value: { v: "OFF (AC LOST)", c: "amber" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            { label: "X BLEED",  states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "CABIN ΔP", states: [{ value: { v: "DRAINING SLOWLY", c: "amber" } }] },
          ],
        },
      ],
      tray: {
        title: "AIR NOTE",
        note: "Packs lost with AC bus failure. Cabin pressurisation draining slowly. Descend as soon as possible.",
        switches: [
          { label: "PACK 1", states: [{ value: "fault" as const }] },
          { label: "PACK 2", states: [{ value: "fault" as const }] },
          { label: "X BLEED", sub: "SEL", states: [{ value: "auto" as const }] },
        ],
      },
    },
  ],
};
