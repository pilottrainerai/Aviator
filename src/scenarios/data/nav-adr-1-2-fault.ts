import type { Scenario } from "@/scenarios/types";
import { NAV_ADR_1_2_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-NAV P 16–19/70  : NAV ADR 1+2(1+3)(2+3) FAULT — variant ADR 1+2
//   Ident. PRO-ABN-NAV-B-00018113.0001001 / 13 SEP 16  (annunciations, L2 note)
//   Ident. PRO-ABN-NAV-B-00017147.0003001 / 04 DEC 18  (procedure steps)
//   Ident. PRO-ABN-NAV-B-00017397.0009001 / 12 APR 18  (STATUS page)
// FCTM PR-AEP-NAV  : ADR/IRS FAULT technique  [fctm: PR-AEP-NAV P 1/22 onwards]
// FCTM PR-AEP-NAV  : UNRELIABLE AIRSPEED INDICATIONS — BUSS technique
// callouts.txt L70–71 : Memory item callout "UNRELIABLE SPEED"
// tasksharing.txt    : SILENT on NAV ADR fault — PF/PM per standard ECAM
//                      convention throughout  [simulation-placeholder: tasksharing]
//
// Phase: climb passing FL150 — below FL250 → BUSS path applies per FCTM.
// ADR pb rule: use ADR pb to switch OFF — do NOT use the rotary selector
// (rotary also cuts IR part).  [fctm:PR-AEP-NAV P 1/22]

export const navAdr12Fault: Scenario = {
  meta: NAV_ADR_1_2_META,
  brief: {
    situation:
      "Climb passing FL150, VIDP–VABB. Both ADR 1 and ADR 2 have failed simultaneously — NAV ADR 1+2 FAULT ECAM caution triggers (Level 2, amber, single chime). AP 1+2 and A/THR disconnect. Flight controls revert to ALTERNATE LAW (PROT LOST). CAPT PFD and F/O PFD show conflicting or unreliable speed/altitude data. ADR 3 remains available — set it to the captain's side via AIR DATA SWTG.",
    job: "Fly the aircraft in alternate law (MANEUVER WITH CARE, MAX 320 KT). Follow the ECAM: set AIR DATA SWTG to CAPT 3, then switch off both affected ADR pushbuttons. Crosscheck CAPT PFD, F/O PFD, and STBY ISIS to confirm ADR 3 is reliable. Switch off GPWS TERR and GPWS SYS if their fault lights come on. Review STATUS (AP 1+2, A/THR, ATC/XPDR, F/CTL PROT all INOP). Plan for FLAP 3 landing at VREF+10 KT.",
  },

  triggers: [
    {
      id: "adr_12_fail",
      atMs: 5_000,
      // FCOM PRO-ABN-NAV-B-00018113: "This alert triggers when two ADRs are failed."
      // Level 2 = MASTER CAUTION amber + single chime.
      // ADR 1+2 loss: AP 1+2 disconnect, A/THR disconnect, F/CTL → ALTN LAW.
      // ADR 3 remains on — set AIR DATA SWTG CAPT 3 to route ADR 3 to CAPT side.
      description: "ADR 1 + ADR 2 failure — NAV ADR 1+2 FAULT. Level 2 CAUTION (SC + MASTER CAUT amber). AP 1+2 and A/THR disconnect. F/CTL → ALTERNATE LAW (PROT LOST).",
      effects: [
        { type: "SET_MASTER_CAUT", active: true },
        { type: "SET_ALARM_LABEL", label: "NAV ADR 1+2 FAULT" },
        {
          type: "ADD_ECAM",
          messages: [
            // Primary ECAM caution header
            { id: "adr_12_fault",   line: "NAV ADR 1+2 FAULT",          level: "caution"  },
            // Immediate system consequences displayed on EWD
            { id: "ap_disc",        line: "AP 1+2 DISCONNECTED",         level: "advisory" },
            { id: "athr_disc",      line: "A/THR DISCONNECTED",          level: "advisory" },
            { id: "fctl_altn",      line: "F/CTL ALTN LAW (PROT LOST)", level: "advisory" },
            // ECAM action lines — in FCOM order [fcom:108608–108617]
            { id: "ecam_swtg",      line: "AIR DATA SWTG.......CAPT 3", level: "advisory" },
            { id: "ecam_adr1_off",  line: "ADR 1 P/B...............OFF", level: "advisory" },
            { id: "ecam_adr2_off",  line: "ADR 2 P/B...............OFF", level: "advisory" },
          ],
        },
      ],
    },
  ],

  steps: [
    // ── AVIATE ────────────────────────────────────────────────────────────────
    // FCTM PR-AEP-NAV: dual ADR failure → AP and A/THR lost; F/CTL → ALTN LAW.
    // PF flies — standard ECAM convention.  [simulation-placeholder: tasksharing]
    {
      id: "maintain_control",
      label: "FLY THE AIRCRAFT",
      action: "MAINTAIN CONTROL",
      hint: "PF: AVIATE. AP 1+2 and A/THR have disconnected. F/CTL is now in ALTERNATE LAW — PROT LOST. Smooth sidestick inputs only. Do not chase any speed indication — both CAPT and F/O PFDs may be showing unreliable data. Reference: STBY ISIS for attitude and altitude.",
      variant: "warning",
      crew: "PF",
      group: "flightcheck",
      requiresTrigger: "adr_12_fail",
    },
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM: cancel MASTER CAUTION — silences single chime. NAV ADR 1+2 FAULT is Level 2 AMBER CAUTION. ECAM procedure remains displayed on EWD.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: ["maintain_control"],
      afterEffect: {
        delayMs: 300,
        triggerId: "mc_adr_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
    },

    // ── MEMORY ITEM CALLOUT ───────────────────────────────────────────────────
    // callouts.txt L70–71: memory item callout "UNRELIABLE SPEED" — PF calls.
    // Dual ADR failure causes unreliable speed indications on both PFDs.
    {
      id: "callout_unreliable_speed",
      label: "CALLOUT — UNRELIABLE SPEED",
      action: "CALL",
      hint: "PM calls — [simulation-placeholder: callouts.txt silent on dual ADR step callouts]. Convention: PM announces 'UNRELIABLE SPEED' to alert PF that PFD speed data is unreliable. Per callouts.txt L70–71: memory item callout 'UNRELIABLE SPEED'.",
      variant: "warning",
      crew: "PM",
      group: "flightcheck",
      requires: ["cancel_master_caut"],
    },

    // ── ECAM STEP 1 — AIR DATA SWTG CAPT 3 ──────────────────────────────────
    // FCOM PRO-ABN-NAV-B-00017147, ADR 1+2 FAULT branch:
    // [L1] AIR DATA SWTG ... CAPT 3  [fcom:108608]
    // [L2] Set ADR 3 (if available) to the captain's side.  [fcom:108609–108610]
    {
      id: "air_data_swtg_capt3",
      label: "AIR DATA SWTG",
      action: "CAPT 3",
      hint: "PM: overhead AIR DATA switching panel → set to CAPT 3. Routes ADR 3 (the only surviving ADR) to the captain's PFD. FCOM [L2]: Set ADR 3 (if available) to the captain's side. After switching, CAPT PFD should display valid speed and altitude from ADR 3.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_swtg",
      requires: ["callout_unreliable_speed"],
    },

    // ── ECAM STEP 2 — ADR 1 P/B OFF ─────────────────────────────────────────
    // FCOM [L1] ADR (AFFECTED) P/B ... OFF  [fcom:108611]
    // FCTM: use ADR pb to switch OFF — do NOT use the rotary selector.
    // [fctm: PR-AEP-NAV P 1/22]
    // FCTM AOP-30-20 [fctm:4020–4037]: PF and PM must crosscheck before any
    // action on IR selector — irreversible effect. Protocol: PM indicates
    // control + requests PF confirmation → PF confirms → PM operates.
    {
      id: "adr1_off",
      label: "ADR 1 P/B",
      action: "OFF",
      hint: "PM: 'ADR 1 P/B, CONFIRM OFF?' — PF verifies the control and confirms: 'CONFIRM' — PM switches ADR 1 pb → OFF. FCTM AOP-30-20: crosscheck required before any action on IR selector — irreversible effect. FCTM: use the ADR pb only — do NOT use the rotary selector (rotary also cuts the IR part). [simulation-placeholder: exact callout words not in callouts.txt]",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_adr1_off",
      confirmRequired: true,
      requires: ["air_data_swtg_capt3"],
    },

    // ── ECAM STEP 3 — ADR 2 P/B OFF ─────────────────────────────────────────
    // Same FCTM AOP-30-20 crosscheck applies — second affected ADR.
    {
      id: "adr2_off",
      label: "ADR 2 P/B",
      action: "OFF",
      hint: "PM: 'ADR 2 P/B, CONFIRM OFF?' — PF verifies and confirms: 'CONFIRM' — PM switches ADR 2 pb → OFF. FCTM AOP-30-20: same crosscheck protocol as ADR 1 — irreversible action. After both ADRs switched off, NAV ADR 1+2 FAULT ECAM line extinguishes. CAPT PFD fed by ADR 3 only via CAPT 3 switching. [simulation-placeholder: exact callout words not in callouts.txt]",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_adr2_off",
      confirmRequired: true,
      requires: ["adr1_off"],
      afterEffect: {
        delayMs: 1_500,
        triggerId: "gpws_fault_appears",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              // FCOM [L2]: GPWS TERR FAULT and GPWS SYS FAULT lights come on
              // after ADR 1+2 are switched off — EGPWS enhanced functions
              // inhibited.  [fcom:108612–108617]
              { id: "gpws_terr",  line: "GPWS TERR FAULT",  level: "caution" },
              { id: "gpws_sys",   line: "GPWS SYS FAULT",   level: "caution" },
            ],
          },
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },

    // ── GPWS FAULT LIGHTS — switch off per FCOM L2 note ────────────────────
    // FCOM [L2]: "If this occurs, the flight crew should switch off the GPWS
    // TERR pb-sw and the GPWS SYS pb-sw."  [fcom:108612–108617]
    {
      id: "cancel_gpws_mc",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM: cancel MASTER CAUTION triggered by GPWS TERR FAULT and GPWS SYS FAULT lights. These appear because EGPWS enhanced functions are inhibited after ADR 1+2 are switched off. FCOM [L2]: expected consequence — not an additional fault.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: ["adr2_off"],
      afterEffect: {
        delayMs: 300,
        triggerId: "gpws_mc_cancelled",
        effects: [{ type: "SET_MASTER_CAUT", active: false }],
      },
    },
    {
      id: "gpws_terr_off",
      label: "GPWS TERR pb-sw",
      action: "OFF",
      hint: "PM: overhead → GPWS TERR pb-sw → OFF. FCOM [L2]: switch off because GPWS TERR FAULT light comes on after ADR 1+2 isolated — EGPWS terrain awareness inhibited, not a real terrain fault. [fcom:108612–108617]",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["cancel_gpws_mc"],
    },
    {
      id: "gpws_sys_off",
      label: "GPWS SYS pb-sw",
      action: "OFF",
      hint: "PM: overhead → GPWS SYS pb-sw → OFF. FCOM [L2]: same as GPWS TERR — switch off because GPWS SYS FAULT light comes on after ADR 1+2 isolated. [fcom:108612–108617]",
      variant: "switch",
      crew: "PM",
      hardware: true,
      requires: ["gpws_terr_off"],
    },

    // ── F/CTL ALTN LAW — MAX SPEED discipline ───────────────────────────────
    // FCOM ASSOCIATED PROCEDURES [L1] F/CTL ALTN LAW (PROT LOST)
    // MAX SPEED ... 320 KT  [fcom:108618–108621]
    // [L2] Speed is limited, due to the loss of high-speed protections.
    {
      id: "max_speed_set",
      label: "MAX SPEED",
      action: "320 KT",
      hint: "PF: set and observe MAX SPEED 320 KT. FCOM [L2]: speed is limited due to loss of high-speed protections (F/CTL in ALTERNATE LAW, PROT LOST). Smooth inputs only. Maneuver with care. [fcom:108618–108621]",
      variant: "switch",
      crew: "PF",
      requires: ["gpws_sys_off"],
    },

    // ── CROSSCHECK — identify surviving ADR ──────────────────────────────────
    // FCTM PR-AEP-NAV TROUBLESHOOTING AND ISOLATION:
    // "crosscheck speed and altitude indications on CAPT PFD, F/O PFD and
    // STBY instruments"  [fctm: PR-AEP-NAV]
    // Goal: identify ADR 3 as the reliable source.
    {
      id: "crosscheck_adrs",
      label: "SPEED + ALT CROSSCHECK",
      action: "CROSSCHECK",
      hint: "PM crosschecks CAPT PFD (now fed by ADR 3 via CAPT 3 switching) vs STBY ISIS vs F/O PFD (no ADR — may show flags or degraded data). FCTM: crosscheck speed and altitude on CAPT PFD, F/O PFD, and STBY instruments to confirm ADR 3 is reliable. WARNING (FCTM): do not instinctively reject an outlier — two or all three ADRs can provide identical but erroneous data.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["max_speed_set"],
      notes: [
        "CAPT PFD: fed by ADR 3 (via AIR DATA SWTG CAPT 3). Should show valid speed + altitude.",
        "F/O PFD: ADR 2 is OFF — may show flags or limited data. Do not use as primary reference.",
        "STBY ISIS: independent — battery-powered, no ADR dependency. Use as backup crosscheck.",
        "FCTM WARNING: Do not instinctively reject an outlier ADR. Two or all three ADRs can provide identical but erroneous data.",
        "If ADR 3 also appears unreliable: apply UNRELIABLE SPEED INDICATION procedure (FCOM PRO-ABN-NAV, refer to procedure).",
      ],
    },

    // ── BUSS NOTE — FL150, below FL250 ──────────────────────────────────────
    // FCTM PR-AEP-NAV: "Below FL 250, the reversible BUSS."
    // At FL150 the BUSS is the appropriate backup speed tool if ADR 3 also
    // becomes unreliable or if crew cannot confirm reliable indication.
    {
      id: "buss_awareness",
      label: "BUSS — AWARENESS",
      action: "NOTE",
      hint: "PM notes: BUSS (Backup Speed Scale) is available below FL250 — current FL150 qualifies. FCTM: if speed unreliable and below FL250, use reversible BUSS on CAPT side. Activate at crew discretion. CAUTION (FCTM): do not use speed brakes when BUSS is active — speed brake extension affects AOA relationship, BUSS may show erroneous data.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["crosscheck_adrs"],
      notes: [
        "BUSS activates on Captain side only, F/O side only, or both simultaneously.",
        "FCTM: when BUSS active — onside AP/FD and A/THR must be disconnected (already done by ADR failure).",
        "FCTM: STALL warning remains operative with BUSS active.",
        "FCTM: Do not use HUD when BUSS active.",
        "FCTM CAUTION: Do not use speed brakes when BUSS is active.",
        "Fly the green area of the BUSS speed scale.",
        "Before retracting next flap config: fly upper green band. Before extending: fly lower green band.",
      ],
    },

    // ── STATUS ────────────────────────────────────────────────────────────────
    {
      id: "announce_status",
      label: "ECAM — STATUS",
      action: "ANNOUNCE",
      hint: "PM announces 'STATUS' as SD switches to the STATUS page. PF acknowledges.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["buss_awareness"],
    },
    {
      id: "stop_ecam",
      label: "STOP ECAM",
      action: "CALL",
      hint: "PF: 'STOP ECAM.' ECAM actions complete. PM acknowledges and removes hand from CLR.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["announce_status"],
    },
    {
      id: "oeb_check",
      label: "OEB / COMPUTER RESETS",
      action: "CHECK",
      hint: "PF: 'Any OEB? Any COMPUTER RESETS?' PM checks QRH. Do NOT reset from memory. If none: 'NO APPLICABLE OEB OR RESET.'",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["stop_ecam"],
    },
    {
      id: "read_status",
      label: "READ STATUS",
      action: "CALL",
      hint: "PF: 'READ STATUS' — PM reads STATUS page aloud line by line. PF cross-checks and acknowledges each.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["oeb_check"],
    },
    {
      id: "status_read_aloud",
      label: "STATUS — PM READS",
      action: "REVIEW",
      hint: "PM reads each STATUS line aloud; PF: 'CHECKED' after each.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["read_status"],
      notes: [
        // STATUS page content from FCOM PRO-ABN-NAV P 18–19/70 [fcom:108686–108722]
        "MAX SPEED ..................... 320 KT",
        "APPR PROC: FOR LDG .......... USE FLAP 3",
        "GPWS LDG FLAP 3 ............. ON  (when CONF 3 selected)",
        "APPR SPD ..................... VREF + 10 KT",
        "LDG DIST PROC ................ APPLY",
        "ALTN LAW: PROT LOST",
        "WHEN L/G DN: DIRECT LAW",
        "FLS LIMITED TO F-APP + RAW",
        "INOP SYS: F/CTL PROT / ADR 1+2 / AP 1+2 / A/THR / ATC/XPDR 1 / ATC/XPDR 2 / RUD TRV LIM 1+2 / GPWS / CAT 2 / GLS AUTOLAND / STEEP APPR / ROW/ROP",
      ],
    },

    // ── LAND ASAP — STATUS page does not specify LAND ASAP for ADR 1+2 FAULT.
    // Source: no LAND ASAP annotation found for this procedure in FCOM STATUS.
    // Not rendered. [simulation-placeholder: no LAND ASAP sourced for ADR 1+2]
    //
    // APPROACH CONSTRAINTS FROM STATUS (FCOM PRO-ABN-NAV P 18–19/70):
    //   FOR LDG: USE FLAP 3   — APPR SPD: VREF + 10 KT  — LDG DIST PROC: APPLY
    //   ALTN LAW: PROT LOST   — WHEN L/G DN: DIRECT LAW
    {
      id: "ecam_complete",
      label: "ECAM ACTIONS COMPLETED",
      action: "ANNOUNCE",
      hint: "PM announces: 'ECAM ACTIONS COMPLETED.' [simulation-placeholder: exact callout text not in callouts.txt — standard PM closing call per ECAM tasksharing convention.] PF acknowledges and continues with diversion/approach assessment.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["status_read_aloud"],
    },
  ],

  // ── STRATEGIC DECISION ───────────────────────────────────────────────────────
  // STATUS page: FLAP 3 landing, VREF+10 KT, LDG DIST PROC APPLY.
  // AP 1+2 and A/THR INOP — raw data approach.
  // No LAND ASAP sourced in FCOM PRO-ABN-NAV STATUS for this procedure.
  // [simulation-placeholder: diversion scoring criteria pending SME review]
  decisions: [
    {
      value: "DIVERT_NEAREST",
      label: "DIVERT — NEAREST SUITABLE",
      description: "Divert to nearest suitable airport. AP 1+2 and A/THR INOP, ALTN LAW, FLAP 3 approach at VREF+10 KT. Minimise further exposure — expedite descent and landing.",
      tone: "primary",
    },
    {
      value: "CONTINUE_DESTINATION",
      label: "CONTINUE TO DESTINATION",
      description: "Continue to planned destination. Acceptable only if destination is closer or conditions favour it — assess fuel, runway, weather. AP and A/THR INOP for remainder of flight.",
      tone: "secondary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO DEPARTURE",
      description: "Return to departure aerodrome. Valid if significantly closer and runway requirement met for FLAP 3, LDG DIST PROC.",
      tone: "secondary",
    },
  ],

  // ── ENGINE DISPLAY DSL ────────────────────────────────────────────────────
  // NAV ADR fault — both engines are completely normal.
  // Control panel mirrors the ECAM procedure order (FCOM PRO-ABN-NAV P 16/70):
  //   AIR DATA SWTG → CAPT 3  |  ADR 1 P/B → OFF  |  ADR 2 P/B → OFF
  //   GPWS TERR → OFF  |  GPWS SYS → OFF  |  MAX SPEED 320 KT (monitor)
  engineDisplay: {
    warningTrigger: "adr_12_fail",
    controlPanel: [
      { stepId: "air_data_swtg_capt3", kind: "toggle_sw" as const, label: "AIR DATA SWTG", sub: "CAPT 3" },
      { stepId: "adr1_off",            kind: "toggle_sw" as const, label: "ADR 1 P/B",     sub: "OFF"    },
      { stepId: "adr2_off",            kind: "toggle_sw" as const, label: "ADR 2 P/B",     sub: "OFF"    },
      { stepId: "gpws_terr_off",       kind: "toggle_sw" as const, label: "GPWS TERR",     sub: "OFF"    },
      { stepId: "gpws_sys_off",        kind: "toggle_sw" as const, label: "GPWS SYS",      sub: "OFF"    },
      { stepId: "max_speed_set",       kind: "monitor"   as const, label: "MAX SPEED",     sub: "320 KT" },
    ],
    // ENG 1 — normal cruise at FL150 (ADR fault does not affect engines)
    eng1: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "83.8",  c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "619",   c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "2380",  c: "green" } }] },
        { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
    // ENG 2 — normal cruise at FL150
    eng2: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.1",  c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "617",   c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "2360",  c: "green" } }] },
        { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
  },

  // ── ATC / COMMS ───────────────────────────────────────────────────────────
  // No verbatim Airbus radio script was extracted for this specific fault.
  // Tightened to standard urgency structure using abnormal-procedure guidance:
  //   - Use DISTRESS (MAYDAY) or URGENCY (PAN) as required  [abn-procs:178]
  //   - Request ground assistance as required               [abn-procs:186]
  //   - For landback, check latest weather and approach     [abn-procs:505]
  // Exact ATC phraseology remains SME-reviewable.
  distractions: [
    {
      id: "atc_initial_query",
      atMs: 20_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, confirm passing altitude and advise if able higher.",
      standbyResurfaceMs: 20_000,
      choices: [
        // Correct — PAN PAN × 3 = 6 words; nature + heading + unable RVSM + block request + standby
        { id: "a", label: "PAN PAN PAN PAN PAN PAN, IFLY101, unreliable airspeed, heading 282, NAV ADR 1 plus 2 fault, unable RVSM, request block FL140 to FL160, standby", correct: true },
        { id: "b", label: "IFLY101 passing FL150, able higher", correct: false },
        { id: "c", label: "MAYDAY MAYDAY MAYDAY, IFLY101, engine fire", correct: false },
      ],
    },
    {
      id: "atc_block_altitude",
      atMs: 45_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, roger PAN PAN, block altitude FL140 to FL160 approved, turn left heading 240 and advise intentions.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — readback contains only ATC instructions; no crew-added notes
        { id: "a", label: "Block FL140 to FL160, left heading 240, IFLY101", correct: true },
        { id: "b", label: "Roger IFLY101", correct: false },
        { id: "c", label: "Left heading 240, climbing FL200, IFLY101", correct: false },
      ],
    },
    {
      id: "atc_intentions",
      atMs: 95_000,
      kind: "atc",
      from: "MUMBAI CONTROL",
      message: "IFLY101, say present capability, assistance required, and whether you intend return or diversion.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY101, autopilot and autothrust lost, alternate law, request return or nearest suitable, require weather, runway, and approach available", correct: true },
        { id: "b", label: "IFLY101 normal now, continuing climb", correct: false },
        { id: "c", label: "Standby IFLY101", correct: false },
      ],
    },
    {
      id: "atc_briefing_prompt",
      atMs: 150_000,
      requiresStep: "ecam_complete",
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, advise approach requirements and any operational limitations.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Require longest suitable runway, flap 3 landing, VREF plus 10, no autoland, request latest weather, runway in use, and type of approach, IFLY101", correct: true },
        { id: "b", label: "Vectors ILS, IFLY101", correct: false },
        { id: "c", label: "Standby IFLY101", correct: false },
      ],
    },
    {
      id: "atc_pob_fuel_services",
      atMs: 185_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, say persons on board, fuel endurance, and whether emergency services are required.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "IFLY101, 186 persons on board, fuel endurance 1 hour 45, request emergency services standby as a precaution, IFLY101", correct: true },
        { id: "b", label: "Standby IFLY101", correct: false },
        { id: "c", label: "No services required, IFLY101", correct: false },
      ],
    },

    // ⑥ ATC delivers weather for diversion airport — full readback
    {
      id: "atc_weather_delivery",
      atMs: 215_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, Mumbai weather — wind 270 at 6, runway 27 in use, NOTAMs nil significant, expect ILS runway 27, QNH 1013.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Wind 270 at 6, runway 27, ILS runway 27, QNH 1013, no significant NOTAMs, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                        correct: false },
        // Wrong — partial readback, missed QNH and approach type
        { id: "c", label: "Wind 270 at 6, runway 27, IFLY101",                                                    correct: false },
      ],
    },

    // ⑦ Intentions crew card — PM advises diversion to Mumbai after ECAM complete / STATUS review
    {
      id: "pm_intentions",
      atMs: 235_000,
      requiresStep: "ecam_complete",
      kind: "crew",
      from: "PM",
      message: "ECAM complete and STATUS reviewed. PM advises ATC of final diversion intentions. Select the correct call.",
      choices: [
        // Correct — states airport + flap 3 raw-data approach constraints
        { id: "a", label: "Mumbai Approach, IFLY101, diverting Mumbai, request vectors runway 27, flap 3 approach, no autoland", correct: true  },
        // Wrong — continues toward destination without stating degradation
        { id: "b", label: "Mumbai Approach, IFLY101, continuing to destination, no issues",                                       correct: false },
        // Wrong — returns to departure without stating approach constraints
        { id: "c", label: "Mumbai Approach, IFLY101, returning Delhi, request ILS",                                               correct: false },
      ],
    },

    // ⑧ Hold request crew card — PM requests hold while completing approach brief
    {
      id: "pm_hold_req",
      atMs: 250_000,
      requiresStep: "ecam_complete",
      kind: "crew",
      from: "PM",
      message: "PM requests holding to complete approach brief before accepting vectors. Select the correct call.",
      choices: [
        { id: "a", label: "Mumbai Approach, IFLY101, request holding FL140 while completing approach brief, flap 3 raw-data ILS", correct: true  },
        // Wrong — requests immediate vectors before brief is complete
        { id: "b", label: "Mumbai Approach, IFLY101, request immediate ILS runway 27",                                             correct: false },
        // Wrong — crew card must not offer standby (§0 rule 9)
        { id: "c", label: "Mumbai Approach, IFLY101, request descent to FL60",                                                     correct: false },
      ],
    },

    // ⑨ ATC issues hold clearance — crew reads back
    {
      id: "atc_hold_clr",
      atMs: 265_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, cleared to hold at FONAK FL140, right turns, expect ILS runway 27 in 10 minutes.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Holding FONAK FL140, right turns, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                               correct: false },
        // Wrong — altitude mis-readback
        { id: "c", label: "Holding FONAK FL150, right turns, IFLY101",  correct: false },
      ],
    },

    // ⑩ ATC asks when ready for approach
    {
      id: "atc_ready_for_approach",
      atMs: 295_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, advise when ready for approach.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — states approach constraints so ATC can plan separation
        { id: "a", label: "IFLY101 ready, request vectors for ILS runway 27, flap 3 approach, VREF plus 10, no autoland", correct: true  },
        { id: "b", label: "Ready, IFLY101",                                                                                  correct: false },
        { id: "c", label: "Standby IFLY101",                                                                                  correct: false },
      ],
    },

    // ⑪ Approach clearance — full readback (heading, altitude, ILS, frequency)
    {
      id: "atc_cleared_approach",
      atMs: 325_000,
      kind: "atc",
      from: "MUMBAI APPROACH",
      message: "IFLY101, turn right heading 060, descend 3000 feet, cleared ILS runway 27 approach, contact Mumbai Tower 118.10 when established.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Right heading 060, descend 3000, cleared ILS runway 27, contact Tower 118.10 when established, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                                                                                            correct: false },
        // Wrong — partial readback
        { id: "c", label: "Cleared ILS runway 27, IFLY101",                                                                           correct: false },
      ],
    },

    // ⑫ Tower contact — report established, emergency services acknowledged
    {
      id: "atc_tower_contact",
      atMs: 355_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      message: "IFLY101, Mumbai Tower, continue ILS approach runway 27, report established, emergency services standing by.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 27, will report established, IFLY101", correct: true  },
        { id: "b", label: "Switching, IFLY101",                                          correct: false },
      ],
    },

    // ⑬ Cleared to land
    {
      id: "atc_cleared_to_land",
      atMs: 385_000,
      kind: "atc",
      from: "MUMBAI TOWER",
      message: "IFLY101, runway 27 cleared to land, wind 270 at 6, emergency services in position.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Cleared to land runway 27, IFLY101", correct: true  },
        { id: "b", label: "Roger IFLY101",                       correct: false },
        // Wrong — runway mis-readback
        { id: "c", label: "Cleared to land runway 28, IFLY101", correct: false },
      ],
    },
  ],

  // ── COCKPIT PHASE SNAPSHOTS ──────────────────────────────────────────────
  phases: [
    {
      id: "climb_stable",
      label: "CLIMB STABLE — NORMAL AIR DATA",
      atMs: 0,
      pfd: {
        speed: 286,
        targetSpeed: "290",
        altitude: 15000,
        targetAltitude: 32000,
        verticalSpeed: 1800,
        fmaThrust: "THR CLB",
        fmaPitch: "OP CLB",
        fmaLateral: "NAV",
        ap1: true,
        athr: true,
        notes: [
          "Normal climb passing FL150 before ADR failure.",
          "AP 1 and A/THR engaged in managed climb.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 282,
        activeWpt: "BOFIN",
        notes: ["Managed NAV tracking toward BOFIN."],
      },
      pf: {
        task: "Monitor managed climb and raw-data crosscheck in normal conditions.",
        callouts: [{ role: "PF", speech: "CLIMB CHECKED" }],
      },
      pm: {
        task: "Monitor climb, automation, and route tracking.",
      },
    },
    {
      id: "adr_fault_detected",
      label: "ADR 1+2 FAULT — AUTOMATION LOST",
      atMs: 5_000,
      pfd: {
        speed: 278,
        targetSpeed: "320",
        altitude: 15150,
        targetAltitude: 32000,
        verticalSpeed: 1400,
        fmaThrust: "MAN THR",
        fmaPitch: "ALT LAW",
        fmaLateral: "HDG",
        ap1: false,
        athr: false,
        flags: ["MASTER CAUT (amber)", "NAV ADR 1+2 FAULT"],
        notes: [
          "AP 1+2 disconnected.",
          "A/THR disconnected.",
          "Flight controls degraded to ALTN LAW (PROT LOST).",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 284,
        activeWpt: "BOFIN",
        notes: ["Crew stabilises manually after automation disconnect."],
      },
      pf: {
        task: "Aviate manually, ignore unreliable speed cues, stabilise pitch and power.",
        callouts: [{ role: "PF", speech: "I HAVE CONTROL" }],
      },
      pm: {
        task: "Cancel the caution, identify NAV ADR 1+2 FAULT, and prepare ECAM actions.",
        callouts: [{ role: "PM", speech: "NAV ADR 1 PLUS 2 FAULT" }],
      },
      atc: {
        initiatedBy: "ATC",
        transmissions: [{ role: "ATC", station: "MUMBAI CONTROL", speech: "IFLY101, confirm passing altitude and advise if able higher." }],
      },
      overhead: {
        items: ["MASTER CAUT illuminated", "AIR DATA SWTG pending"],
      },
    },
    {
      id: "adr3_selected",
      label: "AIR DATA SWTG CAPT 3 — RELIABLE CAPT SIDE RESTORED",
      atMs: 20_000,
      pfd: {
        speed: 272,
        targetSpeed: "320",
        altitude: 15550,
        targetAltitude: 32000,
        verticalSpeed: 900,
        fmaThrust: "MAN THR",
        fmaPitch: "V/S",
        fmaLateral: "HDG",
        ap1: false,
        athr: false,
        flags: ["CAPT SIDE ON ADR 3"],
        notes: [
          "Captain side now fed by ADR 3 via AIR DATA SWTG CAPT 3.",
          "Raw-data flying continues with manual thrust and pitch discipline.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 240,
        activeWpt: "VECTOR",
        notes: ["ATC heading vector applied while troubleshooting."],
      },
      pf: {
        task: "Continue manual flight using Captain-side ADR 3 and standby crosscheck.",
      },
      pm: {
        task: "Crosscheck CAPT PFD, F/O PFD, and STBY ISIS after selecting CAPT 3.",
        callouts: [{ role: "PM", speech: "CAPTAIN SIDE ON ADR THREE" }],
      },
      overhead: {
        items: ["AIR DATA SWTG — CAPT 3"],
      },
    },
    {
      id: "affected_adrs_off",
      label: "ADR 1 AND ADR 2 ISOLATED",
      atMs: 35_000,
      pfd: {
        speed: 268,
        targetSpeed: "320",
        altitude: 15900,
        targetAltitude: 16000,
        verticalSpeed: 0,
        fmaThrust: "MAN THR",
        fmaPitch: "ALT",
        fmaLateral: "HDG",
        ap1: false,
        athr: false,
        flags: ["ALTN LAW (PROT LOST)", "AP 1+2 INOP", "A/THR INOP"],
        notes: [
          "Both failed ADRs are now off.",
          "Captain side remains on ADR 3 only.",
          "Crew levels temporarily in assigned block altitude.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 240,
        activeWpt: "VECTOR",
      },
      pf: {
        task: "Hold assigned block altitude and keep speed below the 320 kt limit.",
      },
      pm: {
        task: "Confirm both ADR pushbuttons off and monitor for GPWS consequence cautions.",
      },
      overhead: {
        items: ["ADR 1 P/B — OFF", "ADR 2 P/B — OFF"],
      },
    },
    {
      id: "gpws_inhibited",
      label: "GPWS TERR / SYS OFF — STABILISED RAW-DATA FLIGHT",
      atMs: 55_000,
      pfd: {
        speed: 258,
        targetSpeed: "320",
        altitude: 15980,
        targetAltitude: 16000,
        verticalSpeed: 0,
        fmaThrust: "MAN THR",
        fmaPitch: "ALT",
        fmaLateral: "HDG",
        ap1: false,
        athr: false,
        flags: ["GPWS INHIBITED", "RAW DATA ONLY"],
        notes: [
          "GPWS TERR and GPWS SYS are switched off per the FCOM L2 note.",
          "Max speed 320 kt constraint remains in force.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 240,
        activeWpt: "VECTOR",
      },
      pf: {
        task: "Maintain raw-data flight in ALTN LAW and prepare diversion / return decision.",
      },
      pm: {
        task: "Read operational consequences and prepare STATUS review.",
      },
      atc: {
        initiatedBy: "ATC",
        transmissions: [{ role: "ATC", station: "MUMBAI CONTROL", speech: "IFLY101, say present capability, assistance required, and whether you intend return or diversion." }],
      },
      overhead: {
        items: ["GPWS TERR pb-sw — OFF", "GPWS SYS pb-sw — OFF"],
      },
    },
    {
      id: "status_review",
      label: "STATUS REVIEW — DIVERSION / APPROACH PLANNING",
      atMs: 95_000,
      pfd: {
        speed: 250,
        targetSpeed: "250",
        altitude: 16000,
        targetAltitude: 16000,
        verticalSpeed: 0,
        fmaThrust: "MAN THR",
        fmaPitch: "ALT",
        fmaLateral: "HDG",
        ap1: false,
        athr: false,
        flags: ["FLAP 3 LDG", "VREF +10", "RAW DATA APP"],
        notes: [
          "Crew reviews STATUS constraints for the approach.",
          "Landing planning now assumes FLAP 3 and VREF +10 kt.",
        ],
      },
      nd: {
        mode: "ARC",
        range: 40,
        heading: 240,
        activeWpt: "RETURN",
        notes: ["Vectors / routing selected for recovery airport."],
      },
      pf: {
        task: "Assess runway, weather, and raw-data approach suitability before committing to return or diversion.",
      },
      pm: {
        task: "Read STATUS page aloud and brief flap 3 / VREF plus 10 / direct law on gear down constraints.",
      },
      atc: {
        initiatedBy: "ATC",
        transmissions: [{ role: "ATC", station: "MUMBAI APPROACH", speech: "IFLY101, advise approach requirements and any operational limitations." }],
      },
    },
  ],

  airports: [
    {
      icao: "VIDP", iata: "DEL",
      name: "Indira Gandhi International",
      city: "New Delhi",
      elevFt: 777,
      runways: [
        { id: "09/27", lengthM: 4430 },
        { id: "11/29", lengthM: 4430 },
        { id: "10/28", lengthM: 3810 },
      ],
    },
    {
      icao: "VABB", iata: "BOM",
      name: "Chhatrapati Shivaji Maharaj International",
      city: "Mumbai",
      elevFt: 39,
      runways: [
        { id: "09/27", lengthM: 3445 },
        { id: "14/32", lengthM: 2925 },
      ],
    },
    {
      icao: "VOBL", iata: "BLR",
      name: "Kempegowda International",
      city: "Bengaluru",
      elevFt: 3000,
      runways: [
        { id: "09/27", lengthM: 4000 },
      ],
    },
    {
      icao: "VOMM", iata: "MAA",
      name: "Chennai International",
      city: "Chennai",
      elevFt: 52,
      runways: [
        { id: "07/25", lengthM: 3600 },
        { id: "12/30", lengthM: 2975 },
      ],
    },
    {
      icao: "VAAH", iata: "AMD",
      name: "Sardar Vallabhbhai Patel International",
      city: "Ahmedabad",
      elevFt: 189,
      runways: [
        { id: "05/23", lengthM: 3505 },
      ],
    },
    {
      icao: "VILK", iata: "LKO",
      name: "Chaudhary Charan Singh International",
      city: "Lucknow",
      elevFt: 410,
      runways: [
        { id: "09/27", lengthM: 2744 },
        { id: "14/32", lengthM: 2286 },
      ],
    },
    {
      icao: "VANP", iata: "NAG",
      name: "Dr. Babasaheb Ambedkar International",
      city: "Nagpur",
      elevFt: 1033,
      runways: [
        { id: "14/32", lengthM: 3200 },
      ],
    },
    {
      icao: "VIJP", iata: "JAI",
      name: "Jaipur International",
      city: "Jaipur",
      elevFt: 1263,
      runways: [
        { id: "08/26", lengthM: 2744 },
      ],
    },
  ],
};
