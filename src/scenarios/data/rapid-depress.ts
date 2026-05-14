import type { Scenario } from "@/scenarios/types";
import { RAPID_DEPRESS_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-PRESS p.1  : EXCESS CABIN ALT / RAPID DEPRESS procedure
// FCTM ABN-040            : Emergency descent technique
// TUC at FL350            : 15–30 seconds useful consciousness without O2

export const rapidDepress: Scenario = {
  meta: RAPID_DEPRESS_META,
  brief: {
    situation:
      "Cruise FL350. A sudden loud bang — structural failure. CABIN ALT HI warning fires. Cabin altitude is rising above 14,000 ft. Time of useful consciousness at FL350 without oxygen: 15–30 seconds.",
    job: "Crew dons O2 masks IMMEDIATELY. Announce to passengers. Initiate emergency descent to FL100. Squawk 7700. Declare MAYDAY. Plan diversion.",
  },

  triggers: [
    {
      id: "depress",
      atMs: 4_000,
      description: "Structural failure — CAB PR EXCESS CAB ALT warning, rapid decompression",
      effects: [
        // FCOM PRO-ABN-CAB_PR: CAB PR EXCESS CAB ALT = L2 = WARNING (Master Warning + CRC)
        // Triggers when cabin altitude > 9550 ft in cruise
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "CAB PR EXCESS CAB ALT" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "cabin_alt",        line: "CAB PR EXCESS CAB ALT",            level: "warning"  },
            // FCOM procedure above FL160: EMER DESCENT + crew OXY masks + ATC + PA
            { id: "crew_masks",       line: "CREW OXY MASKS..........USE",       level: "advisory" },
            { id: "emer_descent_ecam",line: "EMER DESCENT...........INITIATE",   level: "advisory" },
            { id: "spd_brk_ecam",     line: "SPD BRK....................FULL",  level: "advisory" },
            { id: "eng_ign_ecam",     line: "ENG MODE SEL..............IGN",     level: "advisory" },
            { id: "atc_ecam",         line: "ATC.....................NOTIFY",   level: "advisory" },
            { id: "pa_ecam",          line: "EMER DESCENT(PA)..ANNOUNCE",        level: "advisory" },
            // Conditional sub-block — only required if cabin altitude breaches 14 000 ft.
            { id: "ecam_if_cab14k",   line: "·IF CAB ALT > 14 000 FT:",          level: "remark"   },
            { id: "pax_masks",        line: "  PAX OXY MASKS........MAN ON",     level: "advisory" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── IMMEDIATE — MEMORY ITEMS ──────────────────────────────────────────────
    // FCOM PRO-ABN-CAB_PR: CREW OXY MASKS USE is step 1 (before descent)
    {
      id: "masks_on",
      label: "CREW OXY MASKS",
      action: "USE / 100%",
      hint: "BOTH CREW: don oxygen masks IMMEDIATELY at 100%. Mic ON interphone. TUC at FL350 = 15–30 s. This is the FIRST action per FCOM — don masks BEFORE everything else.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      hardware: true,
    },
    {
      id: "masks_confirm",
      label: "MASKS CONFIRMED",
      action: "BOTH CREW",
      hint: "PM: 'MASKS ON 100%' — PF confirms. Only proceed after BOTH masks confirmed on.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["masks_on"],
    },
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARN. Proceed with ECAM procedure.",
      variant: "warning",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: ["masks_confirm"],
      afterEffect: {
        delayMs: 400,
        triggerId: "mw_cancelled",
        effects: [{ type: "SET_MASTER_WARN", active: false }],
      },
    },
    {
      id: "emer_descent_init",
      label: "EMER DESCENT",
      action: "INITIATE",
      hint: "PF: FCOM — if above FL160: initiate EMER DESCENT. If A/THR not active: THR LEVERS → IDLE. Select OPEN DES, set FL100 or MEA/MORA (whichever higher). Allow speed to increase before extending speedbrakes (prevents AoA protection activation).",
      variant: "warning",
      crew: "PF",
      hardware: true,
      requires: ["masks_confirm"],
      afterEffect: {
        delayMs: 5_000,
        triggerId: "descent_started",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "emer_in_prog", line: "EMER DESCENT IN PROGRESS", level: "advisory" },
            ],
          },
          { type: "CLEAR_ECAM", ids: ["emer_descent_ecam"] },
        ],
      },
    },
    {
      id: "spd_brakes_ext",
      label: "SPD BRK",
      action: "FULL",
      hint: "PF: FCOM — SPD BRK → FULL. Allow speed to increase FIRST before extending speedbrakes to avoid AoA protection triggering AP disconnect and speedbrake auto-retraction.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      ecamRef: "spd_brk_ecam",
      requires: ["emer_descent_init"],
    },
    {
      id: "spd_max",
      label: "SPEED",
      action: "MAX / APPROPRIATE",
      hint: "PF: accelerate to max appropriate speed for descent. If structural damage suspected, fly with care and reduce speed as appropriate. Landing gear may be extended — then limit to VLO/VLE.",
      variant: "switch",
      crew: "PF",
      requires: ["spd_brakes_ext"],
    },
    {
      id: "eng_mode_sel",
      label: "ENG MODE SEL",
      action: "IGN",
      hint: "PF: FCOM — ENG MODE SEL → IGN. Protects engines during high-altitude cold rapid descent.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      ecamRef: "eng_ign_ecam",
      requires: ["emer_descent_init"],
    },
    {
      id: "pax_oxy_man",
      label: "PAX OXY MASKS",
      action: "MAN ON",
      hint: "PM: FCOM — IF CAB ALT > 14,000 FT: PAX OXY MASKS MAN ON. Confirms passenger oxygen masks are released. If auto-deployed already, confirm deployment.",
      variant: "caution",
      crew: "PM",
      hardware: true,
      ecamRef: "pax_masks",
      requires: ["emer_descent_init"],
    },

    // ── COMMS — FCOM: ATC NOTIFY + EMER DESCENT PA are both ECAM actions ────────
    {
      id: "pa_emer_descent",
      label: "EMER DESCENT (PA)",
      action: "ANNOUNCE",
      hint: "PM: PA (on mask mic): 'CABIN CREW AND PASSENGERS — EMERGENCY DESCENT. REMAIN SEATED. FASTEN SEATBELTS.' FCOM step — inform cabin before squawk.",
      variant: "caution",
      crew: "PM",
      hardware: true,
      ecamRef: "pa_ecam",
      requires: ["emer_descent_init"],
    },
    {
      id: "atc_squawk",
      label: "XPDR 7700 / ATC",
      action: "SET / MAYDAY",
      hint: "PM: XPDR → 7700 (FCOM: CONSIDER — unless otherwise specified by ATC). Call ATC: 'MAYDAY MAYDAY MAYDAY, IFLY202, emergency descent from FL350, CABIN DEPRESS, leaving FL350 for FL100.'",
      variant: "caution",
      crew: "PM",
      group: "comms",
      hardware: true,
      ecamRef: "atc_ecam",
      requires: ["emer_descent_init"],
    },
    {
      id: "atc_intentions",
      label: "ATC INTENTIONS",
      action: "ADVISE",
      hint: "PM: advise ATC of route and descent block required. Request traffic separation below.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["atc_squawk"],
    },
    {
      id: "level_off_10k",
      label: "LEVEL OFF FL100",
      action: "CONFIRM",
      hint: "PF: level off at FL100 or MEA, whichever higher. Reduce speed. Confirm cabin altitude returning to normal.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      requires: ["emer_descent_init"],
      afterEffect: {
        delayMs: 8_000,
        triggerId: "below_10000ft",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
          { type: "SET_ALARM_LABEL", label: null },
          {
            type: "CLEAR_ECAM",
            ids: ["cabin_alt", "outflow_open", "pax_masks"],
          },
          {
            type: "ADD_ECAM",
            messages: [
              { id: "cab_norm", line: "CABIN ALT — NORMAL", level: "advisory" },
            ],
          },
        ],
      },
    },
    {
      id: "crew_brief_press",
      label: "CREW BRIEF",
      action: "CONFIRM",
      hint: "PM: brief cabin crew on situation once masks may be removed at FL100.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["level_off_10k"],
    },
    {
      id: "masks_off",
      label: "MASKS OFF",
      action: "WHEN SAFE",
      hint: "PF: when cabin altitude ≤10,000 ft and pressure stable — masks OFF at discretion of PIC.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["level_off_10k"],
    },
    {
      id: "wx_divert",
      label: "WX / DIVERT",
      action: "CHECK",
      hint: "PM: request nearest airport wx and approach info. Low altitude fuel burn is higher — confirm reserves.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_brief_press"],
    },
    {
      id: "fordec_press",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC — do not re-climb after structural decompression.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_divert"],
      notes: [
        "F — FACTS: Structural failure at FL350. Cabin decompressed. Now stable at FL100.",
        "O — OPTIONS: Nearest suitable airport (low-altitude routing, may limit options).",
        "R — RISKS: Structural damage unknown — do NOT re-pressurize, do NOT re-climb.",
        "D — DECISION: Divert nearest airport at FL100.",
        "E — EXECUTION: ILS approach, Vapp normal, debrief medical team on structural event.",
        "C — CHECK-BACK: PM confirms and commits.",
      ],
    },
    {
      id: "nis_brief_press",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "PM: SCCM brief — structural event, oxygen deployed, diverting, approximately X minutes to landing.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec_press"],
      notes: [
        "N — NATURE: 'Structural failure, cabin decompressed — now normal at low altitude'",
        "I — INTENTIONS: 'Diverting to nearest suitable airport'",
        "T — TIME: 'Approximately 20 minutes to landing'",
        "S — SPECIAL: 'Normal approach expected. Medical assessment required on landing.'",
      ],
    },
    {
      id: "approach_brief",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF: ILS approach, normal Vapp, normal landing. Structural check required after landing — do NOT exceed normal Vapp.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fordec_press"],
    },
    {
      id: "approach_cl",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs approach checklist.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_brief"],
      notes: [
        "BARO ............. QNH SET",
        "MDA/DH ........... SET",
        "SEAT BELTS ....... ON",
        "AUTOBRAKE ........ MED",
        "SPOILERS ......... ARM",
        "CABIN ............ ADVISED",
      ],
    },
    {
      id: "landing_cl",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs landing checklist at 1000 ft on final.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_cl"],
      notes: [
        "GEAR ............. DOWN — 3 GREEN",
        "FLAPS ............ FULL",
        "SPOILERS ......... ARM",
        "AUTOBRAKE ........ MED",
        "CABIN ............ ADVISED",
      ],
    },
  ],

  statusItems: [
    // FCOM PRO-ABN-CAB_PR CAB PR EXCESS CAB ALT STATUS page
    { id: "st_maxfl",  line: "MAX FL.........100/MEA-MORA",  severity: "caution"  },
    // Scenario-specific items (structural damage scenario):
    { id: "st_press",  line: "PRESS SYS DEGRADED",          severity: "caution"  },
    { id: "st_struct", line: "STRUCTURAL CHECK REQUIRED",     severity: "caution"  },
    { id: "st_appr",   line: "APPR NORMAL",                   severity: "advisory" },
    { id: "st_med",    line: "MEDICAL ON STANDBY",            severity: "memo"     },
  ],

  // ── ATC sequence — mirrors eng1-fire-after-v1 ──────────────────────────────
  // High-workload phase (donning masks → emergency descent → checklist):
  // crew stays brief, STANDBY is correct discipline.  Workload eases once
  // level at safe altitude — crew advises intentions and accepts the
  // operational interrogation.
  distractions: [
    // ① ATC notices the FL350 readout dropping unexpectedly
    {
      id: "atc_initial_query",
      atMs: 8_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, confirm FL350.",
      standbyResurfaceMs: 15_000,
      choices: [
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY202, cabin depressurisation, emergency descent FL350 to FL100, squawking 7700", correct: true  },
        { id: "b", label: "IFLY202 descending, just a precaution",                                                                    correct: false },
        { id: "c", label: "Standby IFLY202",                                                                                            correct: false },
      ],
    },

    // ② ATC clears emergency descent + reciprocal block — pilot reads back
    {
      id: "atc_emer_desc_clearance",
      atMs: 25_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, roger MAYDAY, cleared emergency descent FL100, turn right heading 270 clear of traffic, report level.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Cleared emergency descent FL100, right heading 270, will report level, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                                                                    correct: false },
        // Wrong — partial readback drops the heading, traffic-separation critical
        { id: "c", label: "Descending FL100, IFLY202",                                                        correct: false },
      ],
    },

    // ③ Level at FL100 — pilot reports + ATC offers nearest airport
    {
      id: "atc_level_off",
      atMs: 80_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, vectors available, nearest suitable Mumbai VABB 45 nm, advise intentions.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — concise discipline phrase while still completing checklists
        { id: "a", label: "Continuing checklist, will advise intentions, IFLY202", correct: true  },
        // Also valid — concrete deferral with the diversion intent declared
        { id: "b", label: "Request vectors Mumbai, level FL100, will confirm requirements shortly, IFLY202", correct: true  },
        // Wrong — over-committal on approach type before brief is done
        { id: "c", label: "IFLY202 request immediate ILS runway 27 Mumbai",       correct: false },
      ],
    },

    // ④ ATC offers vectors when ready — STANDBY while finishing checklists
    {
      id: "atc_vectors_when_ready",
      atMs: 110_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, vectors available when ready, no reported traffic in the descent area.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing checklist, will advise when ready, IFLY202", correct: true  },
        { id: "b", label: "Standby IFLY202",                                       correct: true  },
        // Wrong — gives clearance details before crew has finished checklist
        { id: "c", label: "IFLY202 ready for ILS 27 Mumbai",                       correct: false },
      ],
    },

    // ⑤ Briefing prompt — step-gated on checklist completion
    {
      id: "atc_briefing_prompt",
      atMs: 140_000,
      requiresStep: "atc_intentions",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, Mumbai Approach, advise requirements for the approach and any assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Request latest Mumbai weather, runway in use, NOTAMs, and expected approach, IFLY202", correct: true  },
        { id: "b", label: "Standby IFLY202",                                                                       correct: false },
        // Wrong — premature, no info to brief on yet
        { id: "c", label: "Request vectors ILS 27, IFLY202",                                                       correct: false },
      ],
    },

    // ⑥ ATC delivers briefing info — full readback
    {
      id: "atc_briefing_info",
      atMs: 180_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, wind 270 at 6, runway 27 in use, NOTAMs nil significant, expect ILS runway 27.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Wind 270 at 6, runway 27, ILS runway 27, no significant NOTAMs, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                                                            correct: false },
        // Wrong — partial readback (missed approach type)
        { id: "c", label: "Wind 270 at 6, runway 27, IFLY202",                                       correct: false },
      ],
    },

    // ⑦ POB / fuel / services request
    {
      id: "atc_pob_fuel_services",
      atMs: 210_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY202, 186 persons on board, 11 tonnes fuel, endurance 2 hours, request medical and emergency services standby, possible structural damage", correct: true  },
        // Wrong — standby after explicit ops request
        { id: "b", label: "Standby IFLY202",                                                                                                                                  correct: false },
        // Wrong — under-informative for a depress event (medical assessment likely required)
        { id: "c", label: "IFLY202, 186 POB, normal approach",                                                                                                                  correct: false },
      ],
    },

    // ⑧ Ready for approach
    {
      id: "atc_ready_for_approach",
      atMs: 235_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, advise when ready for approach.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY202 ready, request vectors for ILS runway 27", correct: true  },
        { id: "b", label: "Ready, IFLY202",                                    correct: false },
        { id: "c", label: "Standby IFLY202",                                   correct: false },
      ],
    },

    // ⑨ Clearance — full readback (intercept heading, altitude, approach, tower handoff)
    {
      id: "atc_cleared_approach",
      atMs: 260_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, turn left heading 240, descend 3 000 feet, cleared ILS runway 27 approach, contact Mumbai Tower 118.10 when established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 27, contact Tower 118.10 when established, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                                                                                            correct: false },
        // Wrong — partial readback
        { id: "c", label: "Cleared ILS runway 27, IFLY202",                                                                            correct: false },
      ],
    },

    // ⑩ Tower contact
    {
      id: "atc_tower_contact",
      atMs: 290_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      message: "IFLY202, Mumbai Tower, continue ILS approach runway 27, report established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 27, will report established, IFLY202", correct: true  },
        { id: "b", label: "Switching, IFLY202",                                          correct: false },
      ],
    },

    // ⑪ Cleared to land
    {
      id: "atc_cleared_to_land",
      atMs: 315_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      message: "IFLY202, runway 27 cleared to land, wind 270 at 6, emergency and medical services in position.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Cleared to land runway 27, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                       correct: false },
        // Wrong — runway mis-readback
        { id: "c", label: "Cleared to land runway 28, IFLY202", correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Divert to nearest airport at FL100 — do not re-climb after structural failure.",
      tone: "primary",
    },
    {
      value: "LAND_IMMEDIATELY",
      label: "LAND IMMEDIATELY",
      description: "Land at nearest available field without delay.",
      tone: "primary",
    },
    {
      value: "CONTINUE_LOW",
      label: "CONTINUE LOW",
      description: "Continue at FL100 — only if no nearer field and fuel allows.",
      tone: "secondary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description: "Return to departure if closer — acceptable option.",
      tone: "secondary",
    },
  ],

  engineDisplay: {
    warningTrigger: "depress",
    controlPanel: [
      { stepId: "masks_on",          kind: "o2_mask"  as const, label: "O2 MASK",      sub: "USE"      },
      { stepId: "emer_descent_init", kind: "emer_pb"  as const, label: "EMER DESCENT", sub: "INITIATE" },
      { stepId: "spd_brakes_ext",    kind: "spd_brk"  as const, label: "SPD BRK",      sub: "FULL"     },
      { stepId: "eng_mode_sel",      kind: "toggle_sw" as const, label: "ENG MODE",    sub: "IGN"      },
      { stepId: "pax_oxy_man",       kind: "emer_pb"  as const, label: "PAX OXY",      sub: "MAN ON"   },
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
      id: "press", label: "PRESS",
      alertStates: [{ when: { trigger: "depress" }, value: true }, { value: false }],
      autoSelect: { trigger: "depress" },
      sections: [
        {
          title: "PRESSURIZATION",
          colorStates: [
            { when: { trigger: "depress" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "CAB ALT", unit: "FT",
              states: [
                { when: { trigger: "depress" }, value: { v: ">14000", c: "red" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            {
              label: "DELTA P",
              states: [
                { when: { trigger: "depress" }, value: { v: "DECR", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            {
              label: "OUTFLOW VLV",
              states: [
                { when: { trigger: "depress" }, value: { v: "OPEN", c: "amber" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            {
              label: "MODE",
              states: [
                { when: { trigger: "depress" }, value: { v: "EMER", c: "red" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "OXYGEN",
          colorStates: [
            { when: { trigger: "depress" }, value: "cyan" },
            { value: "green" },
          ],
          rows: [
            {
              label: "PAX MASKS",
              states: [
                { when: { trigger: "depress" }, value: { v: "DEPLOYED", c: "cyan" } },
                { value: { v: "STOWED", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "PRESS PANEL",
        note: "FCOM DSC-21-30: Rapid depress → emergency descent. Max descent rate to FL100 or MEA. Do NOT re-pressurize after structural failure.",
        switches: [
          {
            label: "EMER DSCNT",
            states: [
              { when: { step: "emer_descent_init" }, value: "armed" as const },
              { value: "norm" as const },
            ],
          },
        ],
      },
    },
    {
      id: "air", label: "AIR",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "PACKS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "PACK 1",   states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "PACK 2",   states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "CABIN ΔP", states: [{ value: { v: "NORM", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "AIR NOTE",
        note: "Packs normal — structural decompression, not bleed failure. Packs will not restore cabin pressure with structural hole.",
        switches: [
          { label: "PACK 1", states: [{ value: "auto" as const }] },
          { label: "PACK 2", states: [{ value: "auto" as const }] },
        ],
      },
    },
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
      alertStates: [{ value: false }],
      sections: [
        {
          title: "AC NETWORK",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "GEN 1",    states: [{ value: { v: "ON — NORM", c: "green" } }] },
            { label: "GEN 2",    states: [{ value: { v: "ON — NORM", c: "green" } }] },
            { label: "AC BUS 1", states: [{ value: { v: "NORM",      c: "green" } }] },
            { label: "AC BUS 2", states: [{ value: { v: "NORM",      c: "green" } }] },
          ],
        },
      ],
    },
  ],
};
