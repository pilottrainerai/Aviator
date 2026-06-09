import type { Scenario } from "@/scenarios/types";
import { SMOKE_CABIN_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-ELT/AIR p.1  : SMOKE / FUMES / AVIONICS SMOKE procedure
// FCTM ABN-060              : Smoke and fumes technique

export const smokeCabin: Scenario = {
  meta: SMOKE_CABIN_META,
  brief: {
    situation:
      "Cruise FL320. SCCM calls the flight deck: thick smoke in the mid-cabin, source unknown. MASTER CAUTION with single chime. Smoke can be fatal within minutes if recirculated. This scenario uses the QRH SMOKE/FUMES procedure.",
    job: "Don O2 masks immediately. Stop smoke recirculation (RECIRC FANS OFF). Identify source methodically. Assess: if source NOT 100% isolated — land immediately. No compromise.",
  },

  triggers: [
    {
      id: "smoke_detect",
      atMs: 4_000,
      description: "SMOKE/FUMES — cabin smoke reported, source unknown",
      effects: [
        // Per FCOM: cabin/galley/lavatory smoke → QRH procedure (no specific ECAM for non-avionics smoke).
        // AVIONICS SMOKE is L2 WARNING. Cabin fumes/smoke without avionics detection = CAUTION level.
        // Scenario uses a simplified ECAM to represent crew workflow. Alert = CAUTION (amber).
        { type: "SET_MASTER_CAUT", active: true },
        { type: "SET_ALARM_LABEL", label: "SMOKE / FUMES CABIN" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "smoke_warn",   line: "SMOKE / FUMES",              level: "caution"  },
            { id: "smoke_src",    line: "SOURCE — INVESTIGATE",        level: "advisory" },
            { id: "recirc_off",   line: "RECIRC FANS..........OFF",    level: "advisory" },
            { id: "pack_isol",    line: "PACK ISOLATION — CHECK",      level: "advisory" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── IMMEDIATE ────────────────────────────────────────────────────────────
    {
      id: "masks_on",
      label: "OXYGEN MASKS",
      action: "ON / 100%",
      hint: "Both crew: don O2 masks immediately at 100%. Do NOT wait to identify source. Mic ON interphone.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      hardware: true,
    },
    {
      id: "masks_confirm",
      label: "MASKS CONFIRMED",
      action: "BOTH CREW",
      hint: "PM: 'MASKS ON 100%' — PF confirms. Only proceed after BOTH masks confirmed.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["masks_on"],
    },
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM: cancel MASTER CAUTION — silences SC chime. Cabin/galley smoke = CAUTION level (no CRC). Proceed with QRH SMOKE/FUMES procedure.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: ["masks_confirm"],
      afterEffect: {
        delayMs: 400,
        triggerId: "mc_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
    },
    {
      id: "crew_comm",
      label: "CREW COMMUNICATION",
      action: "ESTABLISH",
      hint: "PM: interphone to SCCM — confirm smoke location, color, smell. Ask: galley? IFE? Avionics? Toilets?",
      variant: "switch",
      crew: "PM",
      requires: ["masks_confirm"],
    },
    {
      id: "recirc_fans_off",
      label: "RECIRC FANS",
      action: "OFF",
      hint: "PM: RECIRC FANS → OFF (both). Stops smoke recirculation throughout cabin. FCOM step 1.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "recirc_off",
      requires: ["crew_comm"],
    },
    {
      id: "pack_mode_check",
      label: "PACK MODE CHECK",
      action: "CHECK",
      hint: "PM: check pack flow modes. If bleed contamination suspected — consider pack isolation (FCOM step 2).",
      variant: "switch",
      crew: "PM",
      requires: ["crew_comm"],
    },
    {
      id: "elec_isolation",
      label: "ELECTRICAL ISOLATION",
      action: "ISOLATE",
      hint: "PM: methodically isolate electrical buses. Electrical smell → check galley, IFE, avionics bay. Pull CBs or isolate bus.",
      variant: "switch",
      crew: "PM",
      requires: ["recirc_fans_off"],
      afterEffect: {
        delayMs: 4_000,
        triggerId: "source_elec",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "smoke_reducing", line: "SMOKE REDUCING", level: "advisory" },
            ],
          },
          { type: "CLEAR_ECAM", ids: ["smoke_src"] },
        ],
      },
    },
    {
      id: "signs_on",
      label: "SEATBELTS",
      action: "ON",
      hint: "PM: SEATBELTS ON. Prepare cabin for immediate landing.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["crew_comm"],
    },

    // ── CRM / COMMS ───────────────────────────────────────────────────────────
    {
      id: "cabin_brief",
      label: "CABIN BRIEF",
      action: "CONFIRM",
      hint: "PM: interphone — brief SCCM on procedure. Request source ID. No evacuation yet. Report every 2 min.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_comm"],
    },
    {
      id: "atc_notify",
      label: "ATC NOTIFY",
      action: "PAN PAN",
      hint: "PM: 'PAN PAN PAN, IFLY202, smoke cabin, investigating source, may require immediate landing.' Upgrade to MAYDAY if source not isolated.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["elec_isolation"],
    },
    {
      id: "smoke_assessment",
      label: "SMOKE ASSESSMENT",
      action: "CONFIRM",
      hint: "PM: is smoke REDUCING? Source ISOLATED? If YES — plan landing. If ANY DOUBT — LAND IMMEDIATELY.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["elec_isolation"],
    },
    {
      id: "wx_ldg_smk",
      label: "WX / LDG PERF",
      action: "CHECK",
      hint: "PM: nearest airport wx and approach info. Normal Vapp unless structural issue detected.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["smoke_assessment"],
    },
    {
      id: "fordec_smk",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC — smoke = land immediately if any doubt.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_ldg_smk"],
      notes: [
        "F — FACTS: Cabin smoke. Source [electrical/unknown]. Smoke reducing/continuing.",
        "O — OPTIONS: Continue IF source 100% isolated. Divert if any doubt.",
        "R — RISKS: Smoke incapacitates crew and PAX. Never press on with active unidentified smoke.",
        "D — DECISION: LAND IMMEDIATELY — source not positively isolated.",
        "E — EXECUTION: Nearest available airport, full emergency.",
        "C — CHECK-BACK: PM confirms.",
      ],
    },
    {
      id: "nis_brief_smoke",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "PM: SCCM brief — Nature: cabin smoke. Intentions: immediate landing. Time: X min. Special: prepare cabin for emergency landing.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec_smk"],
      notes: [
        "N — NATURE: 'Cabin smoke, source under investigation, precautionary landing'",
        "I — INTENTIONS: 'Immediate landing nearest suitable airport'",
        "T — TIME: 'Approximately X minutes to landing'",
        "S — SPECIAL: 'On BRACE command — BRACE BRACE BRACE. Fire extinguishers accessible.'",
      ],
    },
    {
      id: "pax_pa",
      label: "PASSENGER PA",
      action: "CONFIRM",
      hint: "PF: PA — 'Ladies and gentlemen, as a precaution we are making an immediate landing. Seatbelts fastened, remain seated.'",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["nis_brief_smoke"],
    },
    {
      id: "approach_brief",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF: ILS nearest airport. Normal Vapp. Full emergency. CFR and medical required.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fordec_smk"],
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
        "FIRE EXTINGUISHERS ... CHECKED",
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
    // Per FCOM/QRH SMOKE/FUMES procedure: smoke not isolated = LAND ASAP (amber)
    { id: "st_smoke",   line: "SMOKE / FUMES",                     severity: "caution"  },
    { id: "st_recirc",  line: "RECIRC FANS........OFF",             severity: "memo"     },
    { id: "st_src",     line: "SOURCE [ELECTRICAL/UNKNOWN]",        severity: "caution"  },
    { id: "st_land",    line: "LAND ASAP (AMBER)",                  severity: "caution"  },
    { id: "st_appr",    line: "APPR NORMAL",                        severity: "advisory" },
  ],

  // ── ATC sequence — mirrors eng1-fire-after-v1 ──────────────────────────────
  // Smoke is special: starts as PAN PAN (urgent — investigating source).
  // Upgrades to MAYDAY if source not isolated within a few minutes.  Crew
  // should be brief during the QRH SMOKE/FUMES checklist, then escalate
  // once the assessment is clear.
  distractions: [
    // ① ATC notices something — pilot declares PAN PAN initially
    {
      id: "atc_initial_query",
      atMs: 10_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, everything OK?",
      standbyResurfaceMs: 20_000,
      choices: [
        // Correct — PAN PAN × 3 = 6 words; nature + navigation (heading) + standby
        { id: "a", label: "PAN PAN PAN PAN PAN PAN, IFLY202, smoke in cabin, investigating source, heading 090, standby", correct: true  },
        { id: "b", label: "IFLY202, all OK, continuing",                                                  correct: false },
        // Wrong — premature MAYDAY before assessment of source
        { id: "c", label: "MAYDAY MAYDAY MAYDAY, IFLY202, smoke, descending immediately", correct: false },
      ],
    },

    // ② ATC acknowledges + offers vectors when needed
    {
      id: "atc_offer_vectors",
      atMs: 30_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, roger PAN PAN, radar contact, vectors available when ready, advise intentions when able.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Continuing investigation, will advise when ready, IFLY202", correct: true  },
        { id: "b", label: "Standby IFLY202",                                            correct: true  },
        // Wrong — premature divert before isolation attempt
        { id: "c", label: "Request immediate vectors nearest airport, IFLY202",         correct: false },
      ],
    },

    // ③ ATC prompts for status — pilot upgrades to MAYDAY if source not isolated
    {
      id: "atc_status_check",
      atMs: 75_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, say status and intentions.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — MAYDAY + navigation (turning right) + standby; no airport in initial MAYDAY
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY202, smoke source not isolated, turning right heading 090, standby", correct: true  },
        // Wrong — downplays severity; no MAYDAY declared
        { id: "b", label: "IFLY202 continuing to destination, smoke is minor",                                              correct: false },
        // Wrong — includes airport selection in MAYDAY (airport only after FORDEC)
        { id: "c", label: "MAYDAY MAYDAY MAYDAY, IFLY202, smoke source not isolated, request immediate vectors nearest suitable airport", correct: false },
      ],
    },

    // ④ ATC acknowledges MAYDAY + vectors
    {
      id: "atc_vectors",
      atMs: 105_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, roger MAYDAY, descend FL150, turn right heading 180 direct Mumbai, contact Mumbai Approach 119.10.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Descend FL150, right heading 180 direct Mumbai, Approach 119.10, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                                                              correct: false },
        // Wrong — partial readback (drops heading + frequency)
        { id: "c", label: "Descending FL150, IFLY202",                                                  correct: false },
      ],
    },

    // ⑤ Hold request — PM requests holding while completing approach brief and FORDEC
    {
      id: "pm_hold_req",
      atMs: 115_000,
      requiresStep: "fordec_smk",
      kind: "crew",
      from: "PM",
      message: "FORDEC complete. PM requests holding to finish approach brief before accepting vectors. Select the correct call.",
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY202, request holding FL150, completing approach brief", correct: true  },
        // Wrong — selects approach before brief complete
        { id: "b", label: "Mumbai Approach, IFLY202, request immediate ILS runway 27",                   correct: false },
        // Wrong — no intention stated
        { id: "c", label: "Mumbai Approach, IFLY202, still on the frequency",                            correct: false },
      ],
    },

    // ⑥ ATC grants hold — crew reads back
    {
      id: "atc_hold_clr",
      atMs: 128_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, cleared to hold at IGAMA FL150, right turns, expect approach in 10 minutes.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Holding IGAMA FL150, right turns, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                               correct: false },
        // Wrong — altitude mis-readback
        { id: "c", label: "Holding IGAMA FL160, right turns, IFLY202",  correct: false },
      ],
    },

    // ⑦ Approach briefing prompt
    {
      id: "atc_briefing_prompt",
      atMs: 140_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, Mumbai Approach, advise approach requirements and assistance.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Request latest Mumbai weather, runway in use, NOTAMs, expected approach, IFLY202", correct: true  },
        { id: "b", label: "Standby IFLY202",                                                                   correct: false },
        { id: "c", label: "Request immediate vectors ILS 27, IFLY202",                                          correct: false },
      ],
    },

    // ⑥ Briefing info
    {
      id: "atc_briefing_info",
      atMs: 175_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, wind 270 at 6, runway 27 in use, NOTAMs nil significant, expect ILS runway 27.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Wind 270 at 6, runway 27, ILS runway 27, no significant NOTAMs, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                                                            correct: false },
        { id: "c", label: "Wind 270 at 6, runway 27, IFLY202",                                       correct: false },
      ],
    },

    // ⑦ POB / fuel / services — smoke event needs ARFF + medical
    {
      id: "atc_pob_fuel_services",
      atMs: 205_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY202, 186 persons on board, 10 tonnes fuel, request full emergency services and medical, smoke on board, possible evacuation on landing", correct: true  },
        { id: "b", label: "Standby IFLY202",                                                                                                                              correct: false },
        // Wrong — omits evacuation likelihood (ARFF positioning critical)
        { id: "c", label: "IFLY202, 186 POB, normal approach",                                                                                                              correct: false },
      ],
    },

    // ⑧ Ready for approach
    {
      id: "atc_ready_for_approach",
      atMs: 230_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, advise when ready for approach.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY202 ready, request vectors for ILS runway 27", correct: true  },
        { id: "b", label: "Ready, IFLY202",                                    correct: false },
        { id: "c", label: "Standby IFLY202",                                   correct: false },
      ],
    },

    // ⑨ Approach clearance
    {
      id: "atc_cleared_approach",
      atMs: 255_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, turn left heading 240, descend 3 000 feet, cleared ILS runway 27, contact Mumbai Tower 118.10 when established.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 27, contact Tower 118.10 when established, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                                                                                            correct: false },
        { id: "c", label: "Cleared ILS runway 27, IFLY202",                                                                            correct: false },
      ],
    },

    // ⑩ Tower contact
    {
      id: "atc_tower_contact",
      atMs: 285_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      message: "IFLY202, Mumbai Tower, continue ILS approach runway 27, report established, full emergency services in position.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 27, will report established, IFLY202", correct: true  },
        { id: "b", label: "Switching, IFLY202",                                          correct: false },
      ],
    },

    // ⑪ Cleared to land
    {
      id: "atc_cleared_to_land",
      atMs: 310_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      message: "IFLY202, runway 27 cleared to land, wind 270 at 6, ARFF and medical in position, evacuation on landing as required.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Cleared to land runway 27, IFLY202", correct: true  },
        { id: "b", label: "Roger IFLY202",                       correct: false },
        { id: "c", label: "Cleared to land runway 28, IFLY202", correct: false },
      ],
    },
  ],

  decisions: [
    {
      value: "LAND_IMMEDIATELY",
      label: "LAND IMMEDIATELY",
      description: "Smoke source not isolated — land at the nearest field, no delay. Any doubt = land.",
      tone: "primary",
    },
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT NEAREST",
      description: "Divert to nearest suitable airport with emergency services.",
      tone: "primary",
    },
    {
      value: "CONTINUE_BRIEFLY",
      label: "CONTINUE BRIEFLY",
      description: "Continue ONLY if source is 100% positively identified and isolated, and smoke has stopped.",
      tone: "secondary",
    },
    {
      value: "PRESS_ON",
      label: "PRESS ON",
      description: "Continue with unidentified active smoke — never appropriate.",
      tone: "danger",
    },
  ],

  engineDisplay: {
    warningTrigger: "smoke_detect",
    controlPanel: [
      { stepId: "masks_on",        kind: "o2_mask"   as const, label: "O2 MASK",  sub: "100%"  },
      { stepId: "recirc_fans_off", kind: "toggle_sw" as const, label: "RECIRC",   sub: "OFF"   },
      { stepId: "signs_on",        kind: "toggle_sw" as const, label: "SEATBELT", sub: "ON"    },
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
      id: "air", label: "AIR",
      alertStates: [{ when: { trigger: "smoke_detect" }, value: true }, { value: false }],
      autoSelect: { trigger: "smoke_detect" },
      sections: [
        {
          title: "PACKS",
          colorStates: [
            { when: { trigger: "smoke_detect" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "CAB SUPPLY",
              states: [
                { when: { step: "recirc_fans_off" }, value: { v: "RECIRC OFF", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            {
              label: "PACK 1 ISOL",
              states: [
                { when: { trigger: "smoke_detect" }, value: { v: "CHECK", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "PACK 1", states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "PACK 2", states: [{ value: { v: "AUTO", c: "green" } }] },
          ],
        },
        {
          title: "BLEED",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ENG 1 BLEED", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "ENG 2 BLEED", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "X BLEED",     states: [{ value: { v: "AUTO", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "AIR PANEL",
        note: "FCOM DSC-21: Recirculation fans off prevents cabin/cockpit smoke transfer. Monitor bleed as alternate source.",
        switches: [
          {
            label: "RECIRC 1", sub: "FAN",
            states: [
              { when: { step: "recirc_fans_off" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "RECIRC 2", sub: "FAN",
            states: [
              { when: { step: "recirc_fans_off" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "PACK 1", states: [{ value: "auto" as const }] },
          { label: "PACK 2", states: [{ value: "auto" as const }] },
        ],
      },
    },
    {
      id: "elec", label: "ELEC",
      alertStates: [{ when: { step: "elec_isolation" }, value: true }, { value: false }],
      sections: [
        {
          title: "AC NETWORK",
          colorStates: [
            { when: { step: "elec_isolation" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            { label: "GEN 1",    states: [{ value: { v: "ON — NORM", c: "green" } }] },
            { label: "GEN 2",    states: [{ value: { v: "ON — NORM", c: "green" } }] },
            { label: "AC BUS 1", states: [{ value: { v: "NORM",      c: "green" } }] },
            { label: "AC BUS 2", states: [{ value: { v: "NORM",      c: "green" } }] },
          ],
        },
        {
          title: "GALLEY / IFE",
          colorStates: [
            { when: { step: "elec_isolation" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "GALLEY",
              states: [
                { when: { step: "elec_isolation" }, value: { v: "ISOLATED", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            {
              label: "IFE",
              states: [
                { when: { step: "elec_isolation" }, value: { v: "ISOLATED", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "ELEC PANEL",
        note: "FCOM DSC-24: Isolate galley/IFE buses first if electrical smoke. Avionics bay ventilation must remain operative.",
        switches: [
          {
            label: "GALLEY",
            states: [
              { when: { step: "elec_isolation" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "IFE",
            states: [
              { when: { step: "elec_isolation" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "AVION BAY", sub: "FAN", states: [{ value: "norm" as const }] },
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
      id: "press", label: "PRESS",
      alertStates: [{ value: false }],
      sections: [
        {
          title: "PRESSURIZATION",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "CAB ALT",    unit: "FT", states: [{ value: { v: "6500", c: "green" } }] },
            { label: "OUTFLOW VLV",            states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "MODE",                   states: [{ value: { v: "AUTO", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "PRESS NOTE",
        note: "No pressurization issue — smoke is not from structural decompression.",
        switches: [
          { label: "OUTFLOW", sub: "VALVE", states: [{ value: "auto" as const }] },
        ],
      },
    },
  ],
};
