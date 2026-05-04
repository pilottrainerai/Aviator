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
      description: "Structural failure — CABIN ALT HI, rapid decompression",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "CABIN ALT HI" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "cabin_alt",        line: "CABIN ALT HI",                level: "warning" },
            { id: "excess_cab",       line: "EXCESS CABIN ALT",             level: "caution" },
            { id: "pax_masks",        line: "PAX OXY MASKS ON",             level: "advisory" },
            { id: "outflow_open",     line: "OUTFLOW VALVE..OPEN",          level: "caution" },
            { id: "emer_descent_ecam",line: "EMER DESCENT INITIATE",        level: "caution" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── IMMEDIATE — MEMORY ITEMS ──────────────────────────────────────────────
    {
      id: "masks_on",
      label: "OXYGEN MASKS",
      action: "ON / 100%",
      hint: "BOTH CREW: don oxygen masks IMMEDIATELY at 100%. Mic ON interphone. TUC at FL350 = 15–30 s. Do NOT wait — don first, then act.",
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
      id: "pa_pax",
      label: "PA — MASKS ON",
      action: "PUSH",
      hint: "Push PA (on mask boom mic): 'CABIN CREW AND PASSENGERS — OXYGEN MASKS ON NOW, OXYGEN MASKS ON NOW.'",
      variant: "caution",
      crew: "PM",
      hardware: true,
      requires: ["masks_confirm"],
    },
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARN. Proceed with ECAM.",
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
      hint: "PF: MAX SPEED — select OPEN DES or override FCU. Select FL100 (or MEA if higher). Speed: 340 kt / M0.82. Bank 45° if needed to clear traffic. Monitor cabin altitude.",
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
          { type: "CLEAR_ECAM", ids: ["excess_cab", "emer_descent_ecam"] },
        ],
      },
    },
    {
      id: "spd_brakes_ext",
      label: "SPEED BRAKES",
      action: "FULL",
      hint: "PF: SPEED BRAKES → FULL EXTENSION (override detent). Accelerates descent rate significantly.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      requires: ["emer_descent_init"],
    },
    {
      id: "eng_mode_sel",
      label: "ENG MODE SELECTOR",
      action: "IGN / START",
      hint: "PF: ENG MODE selectors → IGN/START. Protects engines during high-altitude cold rapid descent.",
      variant: "switch",
      crew: "PF",
      hardware: true,
      requires: ["emer_descent_init"],
    },

    // ── COMMS ─────────────────────────────────────────────────────────────────
    {
      id: "atc_squawk",
      label: "SQUAWK 7700",
      action: "SET",
      hint: "PM: set 7700. Call ATC: 'MAYDAY MAYDAY MAYDAY, IFLY202, emergency descent from FL350, CABIN DEPRESS, leaving FL350 for FL100.'",
      variant: "caution",
      crew: "PM",
      group: "comms",
      hardware: true,
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
    { id: "st_press",  line: "PRESS SYS DEGRADED",          severity: "caution"  },
    { id: "st_maxfl",  line: "MAX FL 100",                    severity: "memo"     },
    { id: "st_struct", line: "STRUCTURAL CHECK REQUIRED",     severity: "caution"  },
    { id: "st_appr",   line: "APPR NORMAL",                   severity: "advisory" },
    { id: "st_med",    line: "MEDICAL ON STANDBY",            severity: "memo"     },
  ],

  distractions: [
    {
      id: "atc_initial",
      atMs: 8_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, confirm FL350.",
      standbyResurfaceMs: 15_000,
      choices: [
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY202, cabin depress, emergency descent FL350 to FL100, SQUAWK 7700", correct: true  },
        { id: "b", label: "IFLY202 descending, just a precaution",                                                         correct: false },
      ],
    },
    {
      id: "atc_block",
      atMs: 20_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY202, cleared emergency descent, report reaching FL100. Nearest airport Mumbai 45 nm.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY202, request vectors Mumbai VABB, declare FULL EMERGENCY, structural damage suspected", correct: true  },
        { id: "b", label: "IFLY202, thank you, will continue to destination",                                                  correct: false },
      ],
    },
    {
      id: "atc_approach",
      atMs: 120_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY202, cleared ILS RWY 27 Mumbai, wind calm, confirm number of souls.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY202, 186 POB, medical assessment required on landing, possible structural damage", correct: true  },
        { id: "b", label: "IFLY202, 186 POB, normal approach",                                                            correct: false },
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
