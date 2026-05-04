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
      "Cruise FL350, VIDP–VABB. A turbine blade release has damaged both GREEN and YELLOW hydraulic return lines simultaneously. GREEN LO PR and YELLOW LO PR warnings illuminate. RAT deploys automatically. Blue system on ELEC pump. FCTL severely degraded.",
    job: "Run DUAL HYD G+Y ECAM, manage degraded flight controls, plan flapless gravity-gear approach, brief crew and ATC, divert to nearest long runway.",
  },

  triggers: [
    {
      id: "structural_fail",
      atMs: 4_000,
      description: "HYD G+Y LO PR — dual hydraulic loss",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "HYD G+Y LO PR" },
        {
          type: "ADD_ECAM",
          messages: [
            { id: "hyd_g_lo",       line: "HYD G LO PR",                level: "warning"  },
            { id: "hyd_y_lo",       line: "HYD Y LO PR",                level: "warning"  },
            { id: "fctl_elac",      line: "FCTL ELAC 1+2 FAULT",        level: "caution"  },
            { id: "fctl_sec",       line: "FCTL SEC 1+2+3 FAULT",       level: "caution"  },
            { id: "fctl_fac",       line: "FCTL FAC 1+2 FAULT",         level: "caution"  },
            { id: "gear_grvty",     line: "L/G GRVTY EXTN ONLY",        level: "caution"  },
            { id: "no_autobrake",   line: "BRAKES ACCU ONLY",           level: "caution"  },
            { id: "sys_single_pack",line: "AIR SINGLE PACK OPER",       level: "advisory" },
          ],
        },
      ],
    },
    {
      id: "rat_deploy",
      atMs: 6_000,
      description: "RAT deployed — Blue system on windmill",
      effects: [
        {
          type: "ADD_ECAM",
          messages: [
            { id: "rat_msg", line: "RAT DEPLOYED", level: "advisory" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── IMMEDIATE ────────────────────────────────────────────────────────────
    {
      id: "rjt_call",
      label: "DECLARE EMERGENCY",
      action: "MAYDAY",
      hint: "PF: 'MAYDAY MAYDAY MAYDAY — IFLY101, DUAL HYDRAULIC FAILURE, declaring emergency.' — aviate first, then communicate.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
    },
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM: cancel MASTER WARN. Silences CRC. ECAM procedure remains.",
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
      id: "hyd_check_cb",
      label: "HYD ECAM",
      action: "RUN",
      hint: "PM: run DUAL HYD G+Y ECAM — do NOT cycle pumps. No action can restore G or Y flow. Accept. Note: RAT deploys automatically.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["cancel_master_warn"],
      afterEffect: {
        delayMs: 3_000,
        triggerId: "secondary_hyd",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "steering_inop", line: "ROLL OUT: NO NW STG/ANTI SKID", level: "caution" },
            ],
          },
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },
    {
      id: "fctl_check",
      label: "FCTL PAGE CHECK",
      action: "CONFIRM",
      hint: "PM: verify FCTL page — only blue aileron and THS serviceable. Confirm manual pitch with THS. All ELAC, SEC and FAC computers lost.",
      variant: "switch",
      crew: "PM",
      requires: ["hyd_check_cb"],
    },
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM: cancel MASTER CAUTION once secondary cautions confirmed.",
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
    {
      id: "rat_confirm",
      label: "RAT CONFIRM",
      action: "CHECK",
      hint: "PM: confirm RAT STOWED light OUT — RAT is deployed, Blue system pressurised by windmill action.",
      variant: "switch",
      crew: "PM",
      requires: ["fctl_check"],
    },
    {
      id: "gear_grvty_brief",
      label: "GRAVITY GEAR BRIEF",
      action: "CONFIRM",
      hint: "PM: LGCIU gravity extension briefed — one lever at a time, 30 s each. No retraction. Will land gear extended.",
      variant: "switch",
      crew: "PM",
      requires: ["fctl_check"],
    },
    {
      id: "flap_retract",
      label: "FLAPS",
      action: "CONF 0",
      hint: "PM: retract FLAPS to CONF 0 immediately — blue SFCC 1 only. NO FLAPS for landing (flapless approach required).",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["rat_confirm"],
    },
    {
      id: "speed_set",
      label: "SPEED INCREASE",
      action: "VFE+20",
      hint: "PF: increase speed to maintain control authority. Use sidestick carefully — ailerons on blue hydraulics only. Reduced effectiveness.",
      variant: "switch",
      crew: "PF",
      requires: ["flap_retract"],
    },

    // ── CRM / COMMS ───────────────────────────────────────────────────────────
    {
      id: "crew_brief_hyd",
      label: "CREW BRIEF",
      action: "CONFIRM",
      hint: "PM: brief SCCM — MAYDAY, dual hydraulic loss, diverting immediately, flapless landing, possible no-steer rollout.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fctl_check"],
    },
    {
      id: "atc_mayday",
      label: "ATC MAYDAY",
      action: "DECLARE",
      hint: "PM: 'MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, request immediate vectors nearest airport with minimum 3000 m runway.'",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_brief_hyd"],
    },
    {
      id: "wx_ldg_perf",
      label: "WX / LDG PERF",
      action: "CHECK",
      hint: "PM: get WX, confirm runway LDA ≥3000 m dry. Flapless Vapp ≈ green dot +10. ACCU brakes only.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["atc_mayday"],
    },
    {
      id: "fordec_hyd",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC. Flapless approach, gravity gear, manual full brakes, no anti-skid.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_ldg_perf"],
      notes: [
        "F — FACTS: Dual G+Y HYD loss. FCTL severely degraded. Gear gravity only. No flaps. No anti-skid. Blue OK.",
        "O — OPTIONS: Nearest long runway — VABB RWY 27 (3445 m). VAAH too short (2743 m) for flapless.",
        "R — RISKS: Flapless Vapp ~170 kt. Min LDA 3000 m clean. No anti-skid. No NW steering.",
        "D — DECISION: Divert VABB RWY 27.",
        "E — EXECUTION: Flapless ILS, gravity gear, autobrake INOP — manual full brakes, max reverse, long rollout.",
        "C — CHECK-BACK: PM confirms and commits.",
      ],
    },
    {
      id: "nis_brief_hyd",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "PM: SCCM interphone brief — Nature: dual HYD loss. Intentions: VABB. Time: ~25 min. Special: brace for flapless, prepare for no-steer rollout.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec_hyd"],
      notes: [
        "N — NATURE: 'Dual hydraulic failure, no flaps, no anti-skid, no nose-wheel steering'",
        "I — INTENTIONS: 'Diverting to Mumbai VABB, runway 27'",
        "T — TIME: 'Approximately 25 minutes to landing'",
        "S — SPECIAL: 'Long high-speed rollout expected. Brace on command. Possible runway excursion.'",
      ],
    },
    {
      id: "approach_brief_hyd",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF: Vapp green dot+10 (~170 kt). No autobrake. Manual full brakes at touchdown. Max reverse. NW steer inop. Long rollout.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["fordec_hyd"],
    },
    {
      id: "lgr_gravity",
      label: "GEAR — GRAVITY EXTN",
      action: "DEPLOY",
      hint: "PM: deploy gear by gravity — pull GEAR lever, then GRAVITY EXTN lever. Wait 30 s per gear. Check 3 greens.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["approach_brief_hyd"],
    },
    {
      id: "atc_emergency_svcs",
      label: "ATC — EMERG SVCS",
      action: "ADVISE",
      hint: "PM: advise ATC of flapless approach, no anti-skid, Category 3 full emergency, foam runway if available.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["approach_brief_hyd"],
    },
    {
      id: "approach_cl_hyd",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs approach checklist — non-normal items highlighted.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_brief_hyd"],
      notes: [
        "GEAR: DOWN 3 GREEN (gravity extension)",
        "FLAPS: 0 (flapless — no other option)",
        "SPOILERS: INOP (G+Y lost)",
        "AUTOBRAKE: INOP — MANUAL FULL BRAKES",
        "CABIN: BRACE BRIEF — long high-speed rollout",
      ],
    },
    {
      id: "landing_cl_hyd",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs landing checklist at 1000 ft on final.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_cl_hyd"],
      notes: [
        "GEAR: DOWN — 3 GREEN (gravity confirmed)",
        "FLAPS: 0",
        "CABIN: BRACE POSITION",
        "EXPECT: long rollout, full reverse, manual full brakes",
      ],
    },
  ],

  statusItems: [
    { id: "st_hyd_g",   line: "HYD G SYSTEM............INOP",    severity: "caution"  },
    { id: "st_hyd_y",   line: "HYD Y SYSTEM............INOP",    severity: "caution"  },
    { id: "st_fctl",    line: "FCTL SEVERELY DEGRADED",           severity: "caution"  },
    { id: "st_gear",    line: "L/G GRVTY EXTN ONLY",             severity: "caution"  },
    { id: "st_brakes",  line: "BRAKES ACCU ONLY",                 severity: "caution"  },
    { id: "st_noskid",  line: "NO ANTI SKID",                     severity: "caution"  },
    { id: "st_nosteer", line: "NO NW STEERING",                   severity: "caution"  },
    { id: "st_flap0",   line: "FLAP LOCK CONF 0",                 severity: "caution"  },
    { id: "st_vapp",    line: "APPR SPEED +30 KT",                severity: "memo"     },
    { id: "st_rwy",     line: "MIN RWY LDA 3000 M",               severity: "memo"     },
  ],

  distractions: [
    {
      id: "atc_initial",
      atMs: 10_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, checking in, maintain FL350.",
      standbyResurfaceMs: 20_000,
      choices: [
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, diverting nearest suitable airport", correct: true  },
        { id: "b", label: "IFLY101, FL350, good day",                                                                   correct: false },
      ],
    },
    {
      id: "atc_nearest",
      atMs: 25_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, nearest airport 80 nm VAAH Ahmedabad RWY 23 length 2743 m, alternate VABB Mumbai 140 nm RWY 27 length 3445 m.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, request VABB RWY 27 — minimum 3000 m required, full emergency services", correct: true  },
        { id: "b", label: "IFLY101 accepting VAAH — closest airport",                                                correct: false },
      ],
    },
    {
      id: "atc_approach",
      atMs: 120_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, cleared ILS RWY 27 VABB, wind calm, QNH 1013. Confirm emergency category.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "MAYDAY IFLY101, Category 3 full emergency, flapless approach, no anti-skid, expect long rollout", correct: true  },
        { id: "b", label: "IFLY101, standard Cat 1 approach",                                                                 correct: false },
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
