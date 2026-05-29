import type { Scenario } from "@/scenarios/types";
import { ENG1_FIRE_AFTER_V1_META } from "@/scenarios/registry";

// ─── Sources ──────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-ENG P 39–42  : ENG 1(2) FIRE (IN FLIGHT) procedure
// FCOM DSC-29, DSC-21, DSC-24: Secondary system effects of FIRE PB
// FCTM OP-020                : Engine fire after V1 — crew technique
// Airbus Golden Rules         : Fly · Navigate · Communicate

export const eng1FireAfterV1: Scenario = {
  meta: ENG1_FIRE_AFTER_V1_META,
  brief: {
    situation:
      "Departing runway 28 at New Delhi Indira Gandhi (VIDP). Two seconds after passing V1 at 145 kt, a MASTER WARNING fires and the ECAM displays ENG 1 FIRE. You are climbing through approximately 400 ft AGL with gear retracting.",
    job: "PF: Aviate — maintain V2+10, engage AP1, command ECAM ACTIONS. PM: Execute ECAM procedure in order. Both: LAND ASAP decision.",
  },

  // ── Timed system events ─────────────────────────────────────────────────────
  triggers: [
    {
      id: "after_v1",
      atMs: 6_000,
      description: "V1 passed — committed to takeoff, rotation in progress",
      effects: [],
    },
    {
      id: "fire_warn",
      atMs: 8_000,
      description: "ENG 1 FIRE — MASTER WARN, CRC, fire light on FIRE panel",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 FIRE" },
        {
          type: "ADD_ECAM",
          messages: [
            // FCOM PRO-ABN-ENG-70-10 ENG 1 FIRE IN FLIGHT — full ECAM checklist.
            // FCOM DSC-31-60 colour spec:
            //   • Title / LAND ASAP   = warning (red)
            //   • All required ACTION items = advisory (cyan/blue)
            //   • Conditional / remark headers = remark (white)
            { id: "eng1_fire",       line: "ENG 1 FIRE",                            level: "warning"  },
            { id: "ecam_thr",        line: "THR LEVER (ENG 1)......IDLE",           level: "advisory" },
            { id: "ecam_master",     line: "ENG 1 MASTER...........OFF",            level: "advisory" },
            { id: "ecam_fire_pb",    line: "ENG 1 FIRE P/B.........PUSH",           level: "advisory" },
            { id: "ecam_agent1",     line: "AGENT 1 AFTER 10 S....DISCH",           level: "advisory" },
            { id: "ecam_atc",        line: "ATC..................NOTIFY",           level: "advisory" },
            { id: "ecam_if_persist", line: "·IF FIRE WARN AFTER 30 S:",             level: "remark"   },
            { id: "ecam_agent2",     line: "  AGENT 2.............DISCH",           level: "advisory" },
            { id: "land_asap",       line: "LAND ASAP",                             level: "warning"  },
          ],
        },
      ],
    },
    // FCTM OP-020: ECAM actions begin at 400 ft AGL — PM announces, PF commands
    {
      id: "four_hundred_ft",
      atMs: 18_000,
      description: "400 ft AGL — PM announces 'ECAM ACTIONS', procedure begins",
      effects: [
        {
          type: "ADD_ECAM",
          messages: [
            { id: "ecam_400ft", line: "400 FT — ECAM ACTIONS", level: "advisory" },
          ],
        },
      ],
    },
    // Minimum Acceleration Altitude — informational only, no ECAM message
    {
      id: "min_accel_alt",
      atMs: 55_000,
      description: "Minimum Acceleration Altitude ~1500 ft — level off, accelerate, clean",
      effects: [],
    },
  ],

  // ── Procedure steps ──────────────────────────────────────────────────────────
  steps: [
    // ══ AVIATE PHASE ══════════════════════════════════════════════════════════
    // PF keeps flying throughout. These steps run in parallel with glareshield.

    // ── AV1 ── PF continues rotation (flightcheck popup)
    {
      id: "continue_rotation",
      label: "CONTINUE ROTATION",
      action: "V2+10",
      hint: "PF maintains normal takeoff rotation and climb. Do NOT reduce thrust. Follow FD/SRS, hold V2+10, and keep runway track stable.",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
    },

    // ── AV2 ── PM calls Positive Climb → PF commands Gear Up (flightcheck popup)
    {
      id: "positive_rate_gear_up",
      label: "POSITIVE CLIMB — GEAR UP",
      action: "CALL",
      hint: "PM calls 'POSITIVE CLIMB'. PF responds 'GEAR UP'. PM selects gear lever UP. Verify positive climb and GEAR UP indication.",
      variant: "switch",
      crew: "PM",
      group: "flightcheck",
      requires: ["continue_rotation"],
    },

    // ── AV3 ── PF engages AP1 at ~100 ft and reads FMA aloud (flightcheck popup)
    {
      id: "engage_ap_fma",
      label: "AP1 ENGAGE — READ FMA",
      action: "CONFIRM",
      hint: "PF: engage AP1 at ~100 ft once flight path stable. Read FMA aloud and announce A/THR. Engine is still running with fire warning — no special beta/trim/A/THR monitoring (those apply only after engine master shutdown — see abnormal-procs.txt L541-543).",
      variant: "switch",
      crew: "PF",
      group: "flightcheck",
      requires: ["positive_rate_gear_up"],
    },

    // ── G1 ── MASTER WARN cancel — available any time after the CRC fires
    // FCOM: the MASTER WARN pushlight can be pressed at any time to silence the CRC.
    // No prerequisite — the glareshield light is always pressable once it illuminates.
    {
      id: "cancel_master_warn",
      label: "MASTER WARN",
      action: "CANCEL",
      hint: "PM cancels MASTER WARN FIRST — pushes glareshield light to silence CRC and reset the red light. ECAM procedure stays displayed. Aviate continues; no ECAM actions until 400 ft and flight path stabilised.",
      variant: "warning",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: [],
      afterEffect: {
        delayMs: 400,
        triggerId: "mw_cancelled",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
        ],
      },
    },

    // ── 400 FT GATE ── AVIATE complete → NAVIGATE SID/EO → "ECAM ACTIONS"
    // FCTM Golden Rules: 400 ft AGL gates the start of ECAM.  Aviate + flight
    // path stabilised must come first; Master Warning cancelled.  PM then
    // announces "AVIATE COMPLETE, NAVIGATE SID/EO PROCEDURE" and PF orders
    // "ECAM ACTIONS".
    {
      id: "four_hundred_ft_cmd",
      label: "400 FT — AVIATE COMPLETE, ECAM ACTIONS",
      action: "ANNOUNCE",
      hint: "At 400 ft AGL with the flight path stabilised, PM confirms the failure and reads the ECAM title. PF then orders 'ECAM ACTIONS'. Master Warning must be cancelled first.",
      variant: "advisory",
      group: "flightcheck",
      requires: ["engage_ap_fma", "cancel_master_warn"],
      crew: "PM",
    },

    // ── ECAM PROCEDURE ─────────────────────────────────────────────────────────
    // Sequential steps — each requires the previous. PM works through in order.

    // ── 1 ── FCOM: "THR LEVER (AFFECTED) → IDLE"
    {
      id: "thr_lever_idle",
      label: "THR LEVER 1",
      action: "IDLE",
      hint: "PM retards ENG 1 thrust lever to IDLE. Reduces thrust before fuel isolation.",
      variant: "switch",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_thr",
      requires: ["four_hundred_ft_cmd"],
    },

    // ── 2 ── FCOM: "ENG MASTER (AFFECTED) → OFF"
    // Airbus confirm-before-action: PM calls "ENG 1 MASTER, CONFIRM OFF?" → PF: "CONFIRM" → PM sets OFF.
    {
      id: "eng1_master_off",
      label: "ENG 1 MASTER",
      action: "OFF",
      hint: "PM: 'ENG 1 MASTER, CONFIRM OFF?' — PF: 'CONFIRM' — PM sets OFF. Closes LP + HP fuel shut-off valves.",
      variant: "switch",
      requires: ["thr_lever_idle"],
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_master",
      confirmRequired: true,
    },

    // ── 3 ── FCOM: "ENG FIRE P/B (AFFECTED) → PUSH"
    // Airbus confirm-before-action: PM calls "ENG 1 FIRE P/B, CONFIRM PUSH?" → PF: "CONFIRM" → PM pushes.
    // Arms squibs · closes bleed + HYD fire SOV · cuts FADEC · deactivates IDG.
    {
      id: "eng1_fire_pb",
      label: "ENG 1 FIRE P/B",
      action: "PUSH",
      hint: "PM: 'ENG 1 FIRE P/B, CONFIRM PUSH?' — PF: 'CONFIRM' — PM pushes. Arms squibs, closes bleed + HYD SOV, cuts FADEC.",
      variant: "warning",
      requires: ["eng1_master_off"],
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_fire_pb",
      confirmRequired: true,
      afterEffect: {
        // 2 s delay: secondary systems respond to FIRE PB isolation
        // FCOM DSC-31-15: secondary failures appear on E/WD right column with * prefix.
        // Removed the SECONDARY FAILURES header and itemised lines from ECAM at user
        // request; the consequences are still surfaced via tab alerts and STATUS page.
        delayMs: 2_000,
        triggerId: "secondary_failures",
        effects: [
          {
            type: "ADD_ECAM",
            messages: [
              { id: "sec_hyd",       line: "* HYD",               level: "caution"  },
              { id: "sec_elec",      line: "* ELEC",              level: "caution"  },
              { id: "sec_air_bleed", line: "* AIR BLEED",         level: "caution"  },
            ],
          },
          { type: "SET_MASTER_CAUT", active: true },
        ],
      },
    },

    // ── G2 ── MASTER CAUTION cancel — available any time after the SC chime fires
    // FCOM: the MASTER CAUTION pushlight can be pressed at any time to silence the SC chime.
    {
      id: "cancel_master_caut",
      label: "MASTER CAUT",
      action: "CANCEL",
      hint: "PM pushes MASTER CAUTION light — silences single-chime, resets amber light. Secondary cautions remain on ECAM.",
      variant: "caution",
      crew: "PM",
      group: "glareshield",
      hardware: true,
      requires: [],
      afterEffect: {
        delayMs: 300,
        triggerId: "mc_cancelled",
        effects: [
          { type: "SET_MASTER_CAUT", active: false },
        ],
      },
    },

    // ── 4 ── FCOM: "AGENT 1 AFTER 10 S → DISCH"
    // 10 s allows N1 to decay → reduces nacelle ventilation → higher agent concentration.
    {
      id: "agent1",
      label: "AGENT 1",
      action: "DISCH",
      hint: "PM waits ECAM 10 s countdown after FIRE pb — N1 decay maximises agent concentration. Then discharge.",
      variant: "caution",
      requires: ["eng1_fire_pb"],
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_agent1",
      afterEffect: {
        // Base learning path: the fire goes out after the first bottle.
        // A persistent-fire variant can instead schedule `fire_persists_30s`
        // to unlock the AGENT 2 branch.
        delayMs: 5_000,
        triggerId: "fire_extinguished",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
          { type: "SET_ALARM_LABEL", label: null },
          {
            type: "CLEAR_ECAM",
            // Clear the primary fire-warning slice once the fire is out.
            // LAND ASAP and ATC NOTIFY remain until their own training steps
            // are handled, but the conditional AGENT 2 branch disappears.
            ids: ["eng1_fire", "ecam_thr", "ecam_master", "ecam_fire_pb", "ecam_agent1", "ecam_400ft", "ecam_if_persist", "ecam_agent2"],
          },
        ],
      },
    },

    // ── 5 ── Conditional branch: only if fire warning persists 30 s after
    // AGENT 1. Not part of the base success path.
    {
      id: "agent2",
      label: "AGENT 2",
      action: "DISCH",
      hint: "PM: wait 30 s after AGENT 1 — IF FIRE WARN persists, discharge AGENT 2.  Last bottle, no restart possible after.",
      variant: "caution",
      requires: ["agent1"],
      requiresTrigger: "fire_persists_30s",
      crew: "PM",
      hardware: true,
      ecamRef: "ecam_agent2",
      afterEffect: {
        // 5 s: bottle discharges, fire dies out, FIRE pb red light goes off,
        // FIRE light on master panel goes off, ENG ✕ marker clears.
        // Per FCOM, the AGENT 2 + "IF FIRE WARN AFTER 30 S" + LAND ASAP
        // ECAM lines clear once the fire is extinguished.
        delayMs: 5_000,
        triggerId: "fire_extinguished",
        effects: [
          {
            type: "CLEAR_ECAM",
            ids: ["ecam_agent2", "ecam_if_persist", "land_asap"],
          },
        ],
      },
    },

    // ── 5b ── ENGINE SECURED — PM announce per FCTM
    // FCTM line 12852: "An engine is considered as secured when the ECAM
    // actions of the procedures are performed until […] Fire extinguished or
    // 'AGENT 2 DISCH' for an engine fire."  The fire_extinguished trigger
    // fires 5 s after AGENT 2 (fire pb red light + ENG MASTER FIRE light
    // both go off); PM then announces "ENGINE SECURED" and the crew may
    // proceed with the acceleration sequence (level off MAA → S speed →
    // clean).  Per FCTM line 12848 the flight crew must DELAY the
    // acceleration until the engine is secured.
    {
      id: "engine_secured",
      label: "ENGINE SECURED",
      action: "ANNOUNCE",
      hint: "Once the fire light is out and the engine is secured, PM announces 'ENGINE SECURED' and 'PRIMARY ECAM ACTIONS COMPLETE'. PF acknowledges before acceleration.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["agent1"],
      requiresTrigger: "fire_extinguished",
    },

    // ── 5c ── LAND ASAP announce (red on ECAM)
    // Before reading secondary failures, PF acknowledges the LAND ASAP
    // indication shown in red on ECAM — confirms commitment to land at the
    // nearest suitable airport.
    {
      id: "announce_land_asap",
      label: "LAND ASAP",
      action: "ANNOUNCE",
      hint: "PF announces 'LAND ASAP' (red on ECAM) — cue to declare MAYDAY on current frequency. PM cross-checks that MAYDAY is the next call. [fcom:L94604 RED LAND ASAP / abnormal-procs:L229-231]",
      variant: "warning",
      crew: "PF",
      group: "chclm",
      requires: ["engine_secured"],
    },

    // ── 5d ── MAYDAY call to ATC — brief FCTM/SOP format
    // MAYDAY identification + state + STANDBY.  No intentions or runway
    // requests yet — that comes later once workload eases (see CR6
    // approach_brief).  ATC will acknowledge with vectors/altitude and
    // standby for the crew to come back when ready.
    {
      id: "mayday_atc",
      label: "MAYDAY",
      action: "DECLARE",
      hint: "Call on CURRENT frequency (Tower if handoff not yet accepted): 'MAYDAY MAYDAY MAYDAY, IFLY101, engine fire engine 1, maintaining runway track, climbing 3 000 feet, STANDBY.' Brief — declare, state, standby. No intentions yet. ATC will acknowledge and hold for intentions; crew advises 'will advise intentions shortly' once workload eases.",
      variant: "warning",
      crew: "PM",
      group: "comms",
      requires: ["announce_land_asap"],
      // Maps to the FCOM ECAM 'ATC ............ NOTIFY' line — completing
      // the MAYDAY call satisfies the ECAM notify item.
      ecamRef: "ecam_atc",
      afterEffect: {
        // Once ATC is notified the FCOM NOTIFY item is satisfied — clear
        // the ECAM line so the crew sees forward progress.
        delayMs: 1_500,
        triggerId: "atc_notified",
        effects: [
          { type: "CLEAR_ECAM", ids: ["ecam_atc"] },
        ],
      },
      notes: [
        "MAYDAY × 3",
        "Callsign",
        "Nature: engine fire engine 1",
        "Position / heading / altitude",
        "STANDBY — defer intentions and POB/fuel until workload eases",
        "ATC ack sequence (modelled as separate distractions):",
        "  1. `atc_radar_contact_mayday` — 'IFLY101, Delhi Departure, radar contact.'",
        "  2. `atc_vectors_climb` — 'IFLY101, roger MAYDAY, radar contact, continue runway track, climb 4 000 feet.'",
        "  Crew readback expected on the climb clearance.",
      ],
    },

    // ── 6 ── FCTM AOP-30-30: at minimum acceleration altitude (MAA), PF
    // PUSHES the V/S knob to set V/S 0 — levels off the aircraft so the crew
    // can accelerate and clean up the configuration while still single-engine.
    // SRS automatically reverts to CLB / OP CLB when the new altitude is
    // captured, but the level-off command is V/S 0 (not OP CLB).  Acceleration
    // is delayed until the engine is secured (FCTM 12848) — hence requires
    // engine_secured.
    {
      id: "level_off_maa",
      label: "V/S 0 AT MAA",
      action: "SELECT",
      hint: "PF: at minimum acceleration altitude (~2300 ft AMSL given VIDP elev ~777 ft), push V/S knob → FMA col 2 changes from SRS to 'V/S = 0' in green (FCOM DSC-22-30-10: FMA displays 'V/S = 0' when V/S is nulled). A/THR maintains target speed. Thrust stays in TOGA detent. [fctm:L12872-73 'push ALT pb or push the V/S knob to level off']",
      variant: "switch",
      requires: ["engine_secured"],
      crew: "PF",
    },

    // ── 7 ── FCTM: Accelerate through S speed, retract flaps to CLEAN
    // Task-sharing (callouts.txt §SECTION SRS→CLB and §LOSS OF THRUST):
    //   F speed (if T/O at FLAPS 2/3): PF calls "FLAPS 1" → PM checks AS, calls
    //                                  "FLAPS 1" back, selects flap lever to 1.
    //   S speed:                       PF calls "FLAPS UP" → PM checks AS, calls
    //                                  "FLAPS UP" back, selects flap lever to 0.
    //                                  Single-engine: NO After Takeoff CL yet —
    //                                  runs after ECAM complete.
    //   Green dot:                     PF calls "MCT" → PM verifies thrust at MCT.
    {
      id: "accel_clean",
      label: "ACCEL / CLEAN",
      action: "CONFIRM",
      hint: "PF calls 'FLAPS 1' at F speed and 'FLAPS UP' at S speed; PM checks speed, repeats callouts, selects accordingly. Continue acceleration toward green dot — MCT/OPEN CLB transition is handled in the next step. [fctm:L12872-76 ACCELERATION SEGMENT]",
      variant: "switch",
      requires: ["level_off_maa"],
      crew: "PF",
    },

    // ── 7b ── FCTM PR-AEP-ENG FINAL TAKEOFF SEGMENT — at green dot
    // [fctm:L12879-12882]:
    //   "As the speed trend arrow reaches Green Dot speed, pull for OPEN CLIMB,
    //    set THR MCT when the LVR MCT message flashes on the FMA (triggered as
    //    the speed index reaches green dot) and resume climb using MCT. If the
    //    thrust lever are already in the FLX/MCT detent, move lever to CL and
    //    then back to MCT."
    {
      id: "mct_open_clb",
      label: "MCT / OPEN CLB",
      action: "SELECT",
      hint: "At green dot speed: FMA col 1 (thrust) shows 'LVR MCT' flashing white — request to set active lever to MCT (FCOM DSC-22-30-90: 'LVR MCT flashes white in the first column of the FMA'). PF moves live thrust lever to MCT detent (if already at FLX/MCT, recycle CL→MCT). PF pulls ALT knob → col 2 (vertical) changes from 'V/S = 0' to 'OP CLB'; col 1 changes to 'THR MCT'. FMA result: [THR MCT] [OP CLB] [RWY TRK] [AP1] [A/THR]. [fctm:L12879-12882]",
      variant: "switch",
      requires: ["accel_clean"],
      crew: "PF",
    },

    // ── POST-ECAM SEQUENCE — FCTM AOP-30-30 (lines 2759-2810) ────────────────
    // The strict order per FCTM is:
    //   1. (Primary ECAM lines cleared)
    //   2. Secondary failures announced (HYD / ELEC / AIR BLEED)
    //   3. PM announces "STATUS" when STATUS page appears
    //   4. PF orders "STOP ECAM" — ECAM actions stopped
    //   5. After Takeoff CL, OEB, system reset (as applicable)
    //   6. STATUS — READ by PF (includes INOP SYS in red)
    //   7. PM: "REMOVE STATUS?" — PF: "CONFIRM" — PM: STS pb PRESS
    //   8. PM announces "ECAM ACTIONS COMPLETE"
    //
    // We model this as a chain of steps gated on the previous one so the
    // crew goes through them in order.

    // ── 1 ── Announce secondary failures (PM reads from SD, ECAM-line format)
    {
      id: "announce_sec_failures",
      label: "ECAM — SECONDARY FAILURES",
      action: "READ",
      hint: "PM reads secondary system failures from SD after engine secured. PF cross-checks and acknowledges each item.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["mayday_atc"],
      notes: [
        "HYD G ENG1 PUMP...LO PR  — Green sys ENG1 pump SOV closed by FIRE pb. PTU may transfer YELLOW → GREEN.",
        "GEN 1 FAULT.........OFF  — IDG1 deactivated by FIRE pb. BTC auto-closes, AC BUS 1 fed by GEN 2.",
        "ENG 1 BLEED......FAULT   — ENG 1 bleed SOV closed by FIRE pb. XBLEED AUTO opens, PACK 1 monitor.",
      ],
    },

    // ── 2 ── Announce STATUS page
    {
      id: "announce_status",
      label: "STATUS — ANNOUNCE",
      action: "ANNOUNCE",
      hint: "When STATUS page appears: PM announces 'STATUS' to indicate the ECAM has reached the STATUS phase.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["announce_sec_failures"],
    },

    // ── 3 ── STOP ECAM — PF orders, PM stops
    {
      id: "stop_ecam",
      label: "STOP ECAM",
      action: "ORDER",
      hint: "PF: 'STOP ECAM' — PM stops ECAM actions. PF asks for After Takeoff Checklist, any computer resets, and any OEB review before reading STATUS.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["announce_status"],
    },

    // ── 4 ── After Takeoff Checklist (normal CL)
    {
      id: "after_takeoff_cl",
      label: "AFTER TAKEOFF CL",
      action: "COMPLETE",
      hint: "PF: 'Any NORMAL CHECKLIST?' — PM runs After Takeoff checklist. Note items already complete or N/A due to failure.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["stop_ecam"],
      notes: [
        "PACKS ............. CHECK (single pack ops — PACK 2 AUTO)",
        "SEAT BELTS ........ ON",
        "LANDING GEAR ...... UP / 3 OFF",
        "ENGINE MODE SEL ... IGN (already set per ECAM)",
        "FLAPS ............. 0 (clean / as required)",
      ],
    },

    // ── CRM CHECKLIST ────────────────────────────────────────────────────────────
    // These steps appear in the CRM Checklist panel, not CockpitControls.
    // ATC MAYDAY is declared via the ATC distraction calls (not a separate step here).
    // Sequence: Golden Rules → WX + LDG perf → NIS → PAX → OPS → Approach brief → Prep

    // ── 5 ── OEB / Computer Resets check
    {
      id: "oeb_check",
      label: "OEB / COMPUTER RESETS",
      action: "CHECK",
      hint: "PF: 'Any OEB? Any COMPUTER RESETS?' — PM checks for applicable OEB items and required computer resets per QRH reset table. Don't apply resets from memory. If none — 'NO APPLICABLE OEB OR RESET.'",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["after_takeoff_cl"],
    },

    // ── 6 ── READ STATUS — PF calls for STATUS to be read
    {
      id: "read_status",
      label: "READ STATUS",
      action: "CALL",
      hint: "PF: 'READ STATUS' — PM reads the ECAM STATUS page aloud. PF cross-checks each item.",
      variant: "advisory",
      crew: "PF",
      group: "chclm",
      requires: ["oeb_check"],
      notes: [
        "Reference: QRH ABNORMAL — ONE ENG INOPERATIVE supplementary procedure (SE flight management — drift-down, perf, fuel).",
        "Reference: QRH ABNORMAL — ONE ENG INOPERATIVE LANDING procedure (approach planning — Vapp, flap setting, autobrake, EO go-around).",
      ],
    },

    // ── 6b ── STATUS items / INOP SYS — PM reads aloud, PF cross-checks
    {
      id: "status_read_aloud",
      label: "ECAM STATUS — PM READS",
      action: "REVIEW",
      hint: "PM reads STATUS page aloud, item by item. PF: 'CHECKED' after each item. APPR PROC, INOP SYS (red), and any conditional procedure are reviewed for workload.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["read_status"],
      notes: [
        "ENG 1 SHUT DOWN",
        "AGENT 1 DISCH / AGENT 2 DISCH (both bottles used)",
        "ENG 1 FIRE DET ... DEGRADED (single loop remaining)",
        "HYD G ENG1 PUMP LO PR",
        "GEN 1 INOP",
        "ENG 1 BLEED FAULT",
        "PACK 1 ........... MONITOR (single pack ops)",
        "APPR CAT 1 (degraded approach capability)",
        "MAX FL 250 (single-engine ceiling)",
        "TCAS .............. TA only",
      ],
    },

    // ── 7 ── ECAM ACTIONS COMPLETE — final announce by PM
    // FCTM: after STATUS read, PM "REMOVE STATUS?" / PF "CONFIRM" / PM STS pb
    // PRESS, then PM announces "ECAM ACTIONS COMPLETE."
    {
      id: "crew_crosscheck",
      label: "ECAM ACTIONS COMPLETE",
      action: "ANNOUNCE",
      hint: "PM: 'ECAM ACTIONS COMPLETE.' PF acknowledges. Primary ECAM actions, secondary failures, and STATUS review are all complete.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["status_read_aloud"],
    },

    // ── CR1 ── WX / ATIS — requires CHCLM crosscheck complete
    {
      id: "wx_request",
      label: "WX / ATIS",
      action: "REQUEST",
      hint: "PM requests latest weather from Delhi Approach: wind dir/speed, QNH, temp, vis, RVR RWY 28.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["crew_crosscheck"],
    },

    // ── CR2 ── Landing distance — single-engine performance check
    {
      id: "ldg_perf",
      label: "LDG PERF",
      action: "CHECK",
      hint: "SE approach: Vapp +5 kt. RWY 28 VIDP LDA 4430 m / factored SE dist ~2200 m — ADEQUATE. Set Vapp + LW on MCDU.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["wx_request"],
    },

    // ── CR2b ── FORDEC — structured decision after wx + performance confirmed
    // Airbus Threat & Error Management: FORDEC is the standard crew decision framework.
    {
      id: "fordec",
      label: "FORDEC",
      action: "COMPLETE",
      hint: "PF leads FORDEC discussion. PM cross-checks each element. Agree and commit to decision, then advise ATC of the selected operational intention when workload permits.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["ldg_perf"],
      notes: [
        "F — FACTS: ENG 1 fire secured. Single engine. VIDP 15 min. RWY 28 LDA 4430 m. Full CFR on field.",
        "O — OPTIONS: ① Return VIDP RWY 28  ② Divert nearest alternate  ③ Continue (NOT viable)",
        "R — RISKS & BENEFITS: VIDP = known field, full CFR, adequate LDA. Divert = longer flight, unfamiliar.",
        "D — DECISION: LAND ASAP — return VIDP RWY 28 with full emergency declared.",
        "E — EXECUTION: ILS RWY 28, Cat 1, SE approach Vapp+5 kt, full emergency, CFR standing by.",
        "C — CHECK-BACK: PM confirms 'AGREED — LAND VIDP RWY 28, FULL EMERGENCY'",
      ],
    },

    // ── CR2b² ── Crew-initiated INTENTION call to ATC after FORDEC decision
    // [user-input 2026-05-27]: Once FORDEC decision is made, PM informs
    // ATC of operational intention and notes the crew will advise when
    // ready for approach. Distinct from `atc_ready_for_approach` distraction
    // which is later ATC-PROMPTED. ATC may follow up with operational
    // questions (POB, fuel, endurance) if not already asked.
    {
      id: "intention_to_atc",
      label: "INTENTION — ATC",
      action: "ADVISE",
      hint: "PM advises ATC of the FORDEC outcome: 'IFLY101, intentions: returning to VIDP for landing runway 28, will advise when ready for approach.' Expect ATC ack and possible follow-up on POB/fuel/endurance.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
    },

    // ── CR2c ── FMGC Preparation — enter diversion/arrival in MCDU
    {
      id: "fmgc_prep",
      label: "FMGC PREP",
      action: "COMPLETE",
      hint: "PM: enter VIDP in DEST, select RWY 28, insert ILS 110.30 / CRS 282. Set Vapp = Vref+5 kt (SE). Check F-PLN fuel + ALTN. PF confirms on MCDU.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
    },

    // ── CR3 ── NITS briefing — cabin crew via interphone (Nature · Intentions · Time · Special)
    // FCOM: cabin crew briefed AFTER decision is made so intentions and time are confirmed.
    {
      id: "nis_brief",
      label: "NITS BRIEF",
      action: "CONFIRM",
      hint: "Interphone to SCCM — NATURE: engine fire, ENG 1 shut down. INTENTIONS: landing VIDP RWY 28. TIME: approx 15 min. SPECIAL: precautionary or emergency landing per Captain's decision.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fordec"],
      notes: [
        "N — NATURE: 'Engine fire, ENG 1 shut down, aircraft serviceable'",
        "I — INTENTIONS: 'Returning and landing runway 28 Delhi VIDP'",
        "T — TIME: 'Approximately 15 minutes to landing'",
        "S — SPECIAL: 'Crew at stations. Precautionary or emergency landing per Captain's decision.'",
      ],
    },

    // ── CR4 ── Passenger PA — after NIS brief to cabin crew
    {
      id: "pax_pa",
      label: "PASSENGER PA",
      action: "CONFIRM",
      hint: "PA: 'Ladies and gentlemen, this is your Captain. We are returning to Delhi as a precaution. Remain seated, seatbelts fastened.'",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["nis_brief"],
    },

    // ── CR5 ── Company OPS — ACARS / VHF (optional)
    {
      id: "company_notify",
      label: "OPS NOTIFY",
      action: "CONFIRM",
      hint: "ACARS or VHF: 'OPS, IFLY101, MAYDAY declared, ENG 1 FIRE, returning VIDP RWY 28, request CFR + ground support.'",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["pax_pa"],
      optional: true,
    },

    // ── CR5b ── Approach preparation — set up MCDU / radios / autobrake
    // (FCOM SOP: prep BEFORE the briefing, so the briefing can reference
    // the configured PERF / approach data.)
    {
      id: "approach_prep",
      label: "APPROACH PREP",
      action: "COMPLETE",
      hint: "PM: set ILS RWY 28 freq 110.30 / CRS 282. BARO minima 200 ft / QNH set. Autobrake MED. Spoilers ARM. Landing lights ON. Confirm seat belts.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["fmgc_prep"],
    },

    // ── CR5c ── Advise ATC of emergency services required
    {
      id: "atc_emergency_services",
      label: "ATC — EMERG SVCS",
      action: "ADVISE",
      hint: "PM advises ATC: 'IFLY101, request Category 3 emergency services on runway 28. Require CFR vehicles, ambulances, and medical standby.' Expect ATC readback/confirmation of services.",
      variant: "advisory",
      crew: "PM",
      group: "comms",
      requires: ["approach_prep"],
    },

    // ── CR6 ── Approach briefing — normal + non-normal, using STATUS page items.
    // Go-around plan is briefed as PART of this step (see go_around_review below
    // which is a continuation of the briefing flow).
    {
      id: "approach_brief",
      label: "APPROACH BRIEF",
      action: "COMPLETE",
      hint: "PF briefs: ILS RWY 28 VIDP, single-engine CAT 1. DA 200 ft. Vapp +5 kt. Non-normal items from STATUS: APPR CAT 1, HYD GRN LO PR, GEN 1 INOP. Go-around briefed. Reference QRH ONE ENG INOPERATIVE LANDING procedure.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["atc_emergency_services"],
      notes: [
        "Reference: FCTM PR-AEP-ENG ONE ENGINE INOPERATIVE — LANDING [fctm:L13250-13265]",
        "Key items: autoland available with OEI; slip → blue beta target above threshold thrust; do NOT lower gear too early (high power needed); reset rudder trim to zero before thrust reduction.",
      ],
    },

    // ── CR6b ── Go-around review — DURING the approach briefing.
    // FCOM SOP: GA plan + fuel cross-check is briefed as part of approach
    // brief, not as a separate pre-briefing item.
    {
      id: "go_around_review",
      label: "GO-AROUND REVIEW",
      action: "CONFIRM",
      hint: "PF briefs go-around plan and confirms fuel state is adequate for alternate if approach is missed.",
      variant: "advisory",
      crew: "PF",
      group: "comms",
      requires: ["approach_brief"],
      notes: [
        "GO-AROUND: TOGA (ENG 2 only) — SRS engages — positive climb GEAR UP — maintain V2+10",
        "FMA: TOGA → SRS / NAV / AP1 — monitor and call FMA at each transition",
        "FUEL CHECK: confirm total fuel vs [DEST + ALTN + FINAL RESERVE]. If marginal — LAND VIDP.",
        "RUNWAY VACATION: vacate via first available exit (Golf / Foxtrot). Brake to stop if needed.",
        "Emergency services attend runway — do NOT delay evacuation call if required.",
      ],
    },

    // ── APPROACH CHECKLIST ──────────────────────────────────────────────────
    {
      id: "approach_cl",
      label: "APPROACH CL",
      action: "COMPLETE",
      hint: "PM runs approach checklist. Call each item, PF cross-checks and responds. CRITICAL: apply FCTM PR-AEP-ENG ONE ENGINE INOPERATIVE — LANDING technique alongside: autoland is available with OEI; trim to keep slip indication centred (yellow → blue beta target above threshold thrust); do NOT select gear down too early (high power needed to maintain level flight); rudder trim reset to zero in later approach phase before thrust reduction. [fctm:L13250-13265 PR-AEP-ENG-00018104]",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["go_around_review"],
      notes: [
        "BARO ................. QNH SET",
        "MDA/DH ............... 200 ft SET",
        "SEAT BELTS ........... ON",
        "AUTOBRAKE ............ MED",
        "SPOILERS ............. ARM (green)",
        "LANDING LIGHTS ....... ON",
        "APPROACH USING HIGHEST LEVEL OF AUTOMATION",
      ],
    },

    // ── LANDING CHECKLIST ───────────────────────────────────────────────────
    {
      id: "landing_cl",
      label: "LANDING CL",
      action: "COMPLETE",
      hint: "PM runs landing checklist at 1000 ft on final. PF confirms each item. Cross-check standard callouts throughout approach.",
      variant: "advisory",
      crew: "PM",
      group: "chclm",
      requires: ["approach_cl"],
      notes: [
        "GEAR ................. DOWN — 3 GREEN",
        "FLAPS ................ FULL (or as required)",
        "SPOILERS ............. ARM (green)",
        "AUTOBRAKE ............ MED (SET)",
        "CABIN ................ ADVISED",
        "STANDARD CALLOUTS: 1000 ft / 500 ft / 100 ft / 50-40-30-20-10 RETARD",
      ],
    },
  ],

  // ── Status page ─────────────────────────────────────────────────────────────
  // FCOM PRO-ABN-ENG p.39-42: ENG SHUT DOWN STATUS page after ENG FIRE PB pushed.
  statusItems: [
    // ── Left column: limitations & directives ────────────────────────────────
    { id: "st_eng1",       line: "ENG 1 SHUT DOWN",                severity: "caution"  },
    { id: "st_avoid_ice",  line: "AVOID ICING CONDITIONS",          severity: "caution"  },
    { id: "st_appr",       line: "APPR CAT . . . . CAT 1",         severity: "advisory" },
    { id: "st_ldg_dist",   line: "LDG DIST PROC . . . . APPLY",    severity: "caution"  },
    { id: "st_fuel_incr",  line: "FUEL CONSUMPT INCRSD",            severity: "advisory" },
    { id: "st_fms",        line: "FMS PRED UNRELIABLE",              severity: "advisory" },
    // ── Right column: INOP SYS ───────────────────────────────────────────────
    { id: "st_inop_cat3",  line: "CAT 3 DUAL",     severity: "caution",  inopSys: true },
    { id: "st_inop_bleed", line: "ENG 1 BLEED",    severity: "caution",  inopSys: true },
    { id: "st_inop_pack",  line: "PACK 1",          severity: "caution",  inopSys: true },
    { id: "st_inop_galley",line: "MAIN GALLEY",     severity: "caution",  inopSys: true },
    { id: "st_inop_gen",   line: "GEN 1",           severity: "caution",  inopSys: true },
    { id: "st_inop_pump",  line: "G ENG 1 PUMP",    severity: "caution",  inopSys: true },
    { id: "st_inop_ice",   line: "WING A. ICE",     severity: "caution",  inopSys: true },
    { id: "st_inop_steep", line: "STEEP APPR",      severity: "caution",  inopSys: true },
  ],

  // ── Distractions — step-driven ATC sequence ────────────────────────────────
  // Model: pilot action (step) → ATC responds → pilot responds or STANDBY.
  // atMs is a small floor only (prevents instant firing on step completion).
  // The real gate is requiresStep — calls fire as soon as that step is done.
  // STANDBY resurfaces the call after standbyResurfaceMs so the crew must
  // eventually answer correctly; each resurfaced call scores independently.
  //
  // MAYDAY is step-gated on engine_secured (via announce_land_asap → mayday_atc).
  // Declaring MAYDAY before engine secured is scored as fault (choice d below).
  distractions: [
    // ① Tower → Departure handoff — fires mid-ECAM (T+27.5 s floor, STANDBY expected)
    //   Crew says STANDBY during procedure; resurfaces at ~T+52 s (after engine secured).
    {
      id: "atc_handoff_to_departure",
      atMs: 27_500,
      requiresStep: "continue_rotation",
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, contact Delhi Departure 124.85.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Delhi Departure 124.85, IFLY101",                          correct: true  },
        { id: "b", label: "Roger, IFLY101",                                            correct: false },
        { id: "c", label: "Delhi Departure 124.95, IFLY101",                          correct: false },
        // Wrong — MAYDAY before engine secured is a fault
        { id: "d", label: "MAYDAY MAYDAY MAYDAY, IFLY101, engine fire, standby",      correct: false },
      ],
    },

    // ② Departure — "radar contact" → crew makes full MAYDAY call
    //   Step-driven: fires as soon as mayday_atc step is done (5 s floor).
    {
      id: "atc_radar_contact_mayday",
      atMs: 5_000,
      requiresStep: "mayday_atc",
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, Delhi Departure, radar contact.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — declare MAYDAY with nature + track + altitude + STANDBY
        { id: "a", label: "MAYDAY MAYDAY MAYDAY, IFLY101, engine fire engine 1, maintaining runway track, climbing 3 000 feet, standby", correct: true  },
        // Wrong — over-committal, no intentions established yet
        { id: "b", label: "MAYDAY IFLY101, engine fire, returning immediate, request runway 28 ILS, full emergency",                     correct: false },
        // Wrong — no MAYDAY prefix
        { id: "c", label: "Maintaining runway track, climbing 3 000, IFLY101",                                                            correct: false },
      ],
    },

    // ③ Departure — acknowledges MAYDAY, issues track + climb — fires ~15 s after mayday step
    //   Offset from ② gives time for the radar-contact distraction to play out first.
    {
      id: "atc_vectors_climb",
      atMs: 15_000,
      requiresStep: "mayday_atc",
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, roger MAYDAY, radar contact, continue runway track, climb 4 000 feet.",
      standbyResurfaceMs: 25_000,
      choices: [
        // Correct — full readback of the clearance elements
        { id: "a", label: "Continuing runway track, climbing 4 000, will advise intentions shortly, IFLY101", correct: true  },
        // Wrong — premature intentions before workload eased
        { id: "b", label: "IFLY101, returning Delhi, request runway 28, 186 souls, 8.4 t fuel", correct: false },
      ],
    },

    // ④ Departure — "vectors available when ready" — step-driven on announce_sec_failures
    //   Crew response: hold and advise when ready (STANDBY is correct here).
    {
      id: "atc_vectors_when_ready",
      atMs: 5_000,
      requiresStep: "announce_sec_failures",
      kind: "atc",
      from: "DELHI DEPARTURE",
      message: "IFLY101, vectors available when ready, no reported traffic.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing checklist, will advise, IFLY101",                                           correct: true  },
        { id: "b", label: "Unable at this time, request hold, will advise when ready for approach, IFLY101",       correct: true  },
        // Wrong — premature commitment before FORDEC/STATUS complete
        { id: "c", label: "IFLY101 returning Delhi, request runway 28 ILS",                                        correct: false },
      ],
    },

    // ⑤ Approach — acknowledges intention, prompts for approach requirements
    //   Step-driven on intention_to_atc (crew has stated their plan to ATC).
    {
      id: "atc_info_request_prompt",
      atMs: 5_000,
      requiresStep: "intention_to_atc",
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, Delhi Approach, advise any requirements for the approach and any assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — crew requests weather before briefing
        { id: "a", label: "Request latest Delhi weather, runway in use, NOTAMs, and expected approach type, IFLY101", correct: true  },
        // Wrong — standby after workload has eased
        { id: "b", label: "Standby IFLY101",                                                                          correct: false },
        // Wrong — requesting vectors without weather/briefing data
        { id: "c", label: "Request vectors ILS runway 28, IFLY101",                                                    correct: false },
      ],
    },

    // ⑥ Approach — delivers weather + runway info — step-driven on wx_request
    {
      id: "atc_provides_briefing_info",
      atMs: 5_000,
      requiresStep: "wx_request",
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, roger standby. … Delhi wind 280 at 8, runway 28 in use, NOTAMs nil significant, expect ILS runway 28.",
      standbyResurfaceMs: 30_000,
      choices: [
        // Correct — full readback of all items needed to brief the approach
        { id: "a", label: "Wind 280 at 8, runway 28, ILS runway 28, no significant NOTAMs, IFLY101", correct: true  },
        { id: "b", label: "Roger, IFLY101",                                                          correct: false },
        // Wrong — missed approach type
        { id: "c", label: "Wind 280 at 8, runway 28, IFLY101",                                       correct: false },
      ],
    },

    // ⑦ Approach — POB / fuel / assistance — step-driven on ldg_perf
    {
      id: "atc_pob_fuel_services",
      atMs: 5_000,
      requiresStep: "ldg_perf",
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, say persons on board, fuel endurance, and assistance required.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY101, 186 persons on board, 8.4 tonnes fuel, endurance 3 hours, request full emergency services on the runway", correct: true  },
        { id: "b", label: "Standby IFLY101",                                                                                                   correct: false },
        { id: "c", label: "IFLY101, 186 POB, 8.4 tonnes, no emergency services required",                                                      correct: false },
      ],
    },

    // ⑧ Approach — confirms emergency services — step-driven on atc_emergency_services
    {
      id: "atc_emergency_services_ack",
      atMs: 5_000,
      requiresStep: "atc_emergency_services",
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, Roger, emergency services standing by runway 28, full CFR, Category 3 confirmed.",
      standbyResurfaceMs: 25_000,
      choices: [
        { id: "a", label: "Roger emergency services standing by runway 28, Category 3 confirmed, IFLY101", correct: true  },
        { id: "b", label: "Roger, IFLY101",                                                                correct: false },
      ],
    },

    // ⑨ Approach — prompts readiness — step-driven on approach_prep
    {
      id: "atc_ready_for_approach",
      atMs: 5_000,
      requiresStep: "approach_prep",
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, advise when ready for approach.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "IFLY101 ready, request vectors for ILS runway 28",   correct: true  },
        { id: "b", label: "Ready, IFLY101",                                      correct: false },
        { id: "c", label: "Standby IFLY101",                                     correct: false },
      ],
    },

    // ⑩ Approach — ILS clearance — step-driven on approach_brief
    {
      id: "atc_cleared_approach",
      atMs: 5_000,
      requiresStep: "approach_brief",
      kind: "atc",
      from: "DELHI APPROACH",
      message: "IFLY101, turn left heading 240, descend 3 000 feet, cleared ILS runway 28 approach, contact Delhi Tower 118.10 when established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Left heading 240, descend 3 000, cleared ILS runway 28, contact Tower 118.10 when established, IFLY101", correct: true  },
        { id: "b", label: "Roger, IFLY101",                                                                                          correct: false },
        { id: "c", label: "Cleared ILS runway 28, IFLY101",                                                                          correct: false },
      ],
    },

    // ⑪ Tower — continue ILS — step-driven on approach_cl
    {
      id: "atc_tower_contact",
      atMs: 5_000,
      requiresStep: "approach_cl",
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, Delhi Tower, continue ILS approach runway 28, report established.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Continuing ILS runway 28, will report established, IFLY101", correct: true  },
        { id: "b", label: "Switching, IFLY101",                                          correct: false },
      ],
    },

    // ⑫ Tower — cleared to land — step-driven on landing_cl
    {
      id: "atc_cleared_to_land",
      atMs: 5_000,
      requiresStep: "landing_cl",
      kind: "atc",
      from: "DELHI TOWER",
      message: "IFLY101, runway 28 cleared to land, wind 280 at 8, emergency services in position.",
      standbyResurfaceMs: 30_000,
      choices: [
        { id: "a", label: "Cleared to land runway 28, IFLY101",  correct: true  },
        { id: "b", label: "Roger, IFLY101",                       correct: false },
        // Wrong — runway mis-readback under stress
        { id: "c", label: "Cleared to land runway 29, IFLY101",  correct: false },
      ],
    },
  ],

  // ── Strategic decisions ─────────────────────────────────────────────────────
  decisions: [
    {
      value: "LAND_ASAP",
      label: "LAND ASAP",
      description:
        "Land at the nearest suitable aerodrome with full emergency fire services available. FCOM directive for a confirmed engine fire.",
      tone: "primary",
    },
    {
      value: "RETURN_TO_FIELD",
      label: "RETURN TO FIELD",
      description:
        "Return to VIDP — valid if it is the nearest suitable option. Runway 28 LDA 4430 m is more than adequate for single-engine landing.",
      tone: "primary",
    },
    {
      value: "DIVERT",
      label: "DIVERT",
      description:
        "Divert to a planned alternate — only justified if it is genuinely closer than the departure field.",
      tone: "secondary",
    },
    {
      value: "CONTINUE",
      label: "CONTINUE",
      description:
        "Press on to destination. Not appropriate — engine is shut down, single-engine flight to destination cannot be justified.",
      tone: "danger",
    },
  ],

  // ── Engine Display DSL ───────────────────────────────────────────────────────
  engineDisplay: {
    warningTrigger: "fire_warn",
    controlPanel: [
      { stepId: "thr_lever_idle",  kind: "thr_lever", label: "THR LVR",  sub: "IDLE"    },
      { stepId: "eng1_master_off", kind: "master",    label: "MASTER",   sub: "ENG 1"   },
      { stepId: "eng1_fire_pb",    kind: "fire_pb",   label: "ENG 1",    sub: "FIRE PB" },
      { stepId: "agent1",          kind: "agent",     label: "AGENT 1",  sub: "DISCH"   },
      { stepId: "agent2",          kind: "agent",     label: "AGENT 2",  sub: "DISCH"   },
    ],
    eng1: {
      rows: [
        {
          label: "THR LVR", unit: undefined,
          states: [
            { when: { step: "thr_lever_idle" }, value: { v: "IDLE", c: "green" } },
            { when: { trigger: "fire_warn" },   value: { v: "MCT/FLX", c: "amber" } },
            { value: { v: "CLB", c: "green" } },
          ],
        },
        {
          label: "N1", unit: "%",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "0.0", c: "amber" } },
            { when: { trigger: "fire_warn" },    value: { v: "- -", c: "red" } },
            { value: { v: "84.2", c: "green" } },
          ],
        },
        {
          label: "EGT", unit: "°C",
          states: [
            { when: { step: "eng1_fire_pb" },  value: { v: "180", c: "amber" } },
            { when: { trigger: "fire_warn" },  value: { v: "820", c: "red" } },
            { value: { v: "620", c: "green" } },
          ],
        },
        {
          label: "FF", unit: "KG/H",
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "0", c: "amber" } },
            { when: { trigger: "fire_warn" },    value: { v: "0", c: "red" } },
            { value: { v: "2400", c: "green" } },
          ],
        },
        {
          label: "STATUS", unit: undefined,
          states: [
            { when: { step: "eng1_master_off" }, value: { v: "SHUT DOWN", c: "amber" } },
            { when: { trigger: "fire_warn" },    value: { v: "FIRE", c: "red" } },
            { value: { v: "NORMAL", c: "green" } },
          ],
        },
      ],
    },
    eng2: {
      rows: [
        { label: "N1",     unit: "%",    states: [{ value: { v: "84.2", c: "green" } }] },
        { label: "EGT",    unit: "°C",   states: [{ value: { v: "618",  c: "green" } }] },
        { label: "FF",     unit: "KG/H", states: [{ value: { v: "2350", c: "green" } }] },
        { label: "STATUS", unit: undefined, states: [{ value: { v: "NORMAL", c: "green" } }] },
      ],
    },
  },

  // ── System Display DSL (4 tabs: ENG, HYD, ELEC, AIR) ────────────────────────
  systemTabs: [
    // ── ENG tab ───────────────────────────────────────────────────────────────
    {
      id: "eng", label: "ENG",
      alertStates: [{ when: { trigger: "fire_warn" }, value: true }, { value: false }],
      autoSelect: { trigger: "fire_warn" },
      sections: [
        {
          title: "ENG 1",
          colorStates: [
            { when: { trigger: "fire_warn" }, value: "red" },
            { value: "dim" },
          ],
          rows: [
            {
              label: "THR LVR",
              states: [
                { when: { step: "thr_lever_idle" }, value: { v: "IDLE", c: "green" } },
                { when: { trigger: "fire_warn" },   value: { v: "MCT/FLX", c: "amber" } },
                { value: { v: "CLB", c: "green" } },
              ],
            },
            {
              label: "N1", unit: "%",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "0.0", c: "amber" } },
                { when: { trigger: "fire_warn" },    value: { v: "- -", c: "red" } },
                { value: { v: "84.2", c: "green" } },
              ],
            },
            {
              label: "EGT", unit: "°C",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "180", c: "amber" } },
                { when: { trigger: "fire_warn" }, value: { v: "820", c: "red" } },
                { value: { v: "620", c: "green" } },
              ],
            },
            {
              label: "FF", unit: "KG/H",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "0", c: "amber" } },
                { when: { trigger: "fire_warn" },    value: { v: "0", c: "red" } },
                { value: { v: "2400", c: "green" } },
              ],
            },
            {
              label: "STATUS",
              states: [
                { when: { step: "eng1_master_off" }, value: { v: "SHUT DOWN", c: "amber" } },
                { when: { trigger: "fire_warn" },    value: { v: "FIRE", c: "red" } },
                { value: { v: "NORMAL", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "ENG 2",
          colorStates: [{ value: "dim" }],
          rows: [
            { label: "N1",     unit: "%",    states: [{ value: { v: "84.2", c: "green" } }] },
            { label: "EGT",    unit: "°C",   states: [{ value: { v: "618",  c: "green" } }] },
            { label: "FF",     unit: "KG/H", states: [{ value: { v: "2350", c: "green" } }] },
            { label: "STATUS",              states: [{ value: { v: "NORMAL", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ENG + FIRE PANEL",
        note: "Step 2: MASTER OFF (fuel SOV + oil SOV close). Step 3: FIRE PB → HYD/bleed/IDG SOVs + fuel shutoff. Steps 4-5: AGENT 1 → AGENT 2 if fire persists (30 s each)",
        switches: [
          {
            label: "MASTER", sub: "ENG 1",
            states: [
              { when: { step: "eng1_master_off" }, value: "off" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "FIRE PB", sub: "ENG 1",
            states: [
              { when: { step: "eng1_fire_pb" },   value: "off"  as const },
              { when: { trigger: "fire_warn" },    value: "fire" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "AGENT 1", sub: "DISCH",
            states: [
              { when: { step: "agent1" },          value: "off"   as const },
              { when: { step: "eng1_fire_pb" },    value: "armed" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "AGENT 2", sub: "DISCH",
            states: [
              { when: { step: "agent2" },          value: "off"   as const },
              { when: { step: "agent1" },          value: "armed" as const },
              { value: "norm" as const },
            ],
          },
        ],
      },
    },

    // ── HYD tab ───────────────────────────────────────────────────────────────
    {
      id: "hyd", label: "HYD",
      alertStates: [{ when: { step: "eng1_fire_pb" }, value: true }, { value: false }],
      autoSelect: { step: "eng1_fire_pb" },
      sections: [
        {
          title: "GREEN SYS",
          colorStates: [
            { when: { step: "eng1_fire_pb" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "ENG 1 PUMP",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "LO PR", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            {
              label: "PRESSURE", unit: "PSI",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "LO PR", c: "amber" } },
                { value: { v: "3000", c: "green" } },
              ],
            },
            { label: "RESERVOIR", states: [{ value: { v: "NORM", c: "green" } }] },
          ],
        },
        {
          title: "BLUE SYS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ELEC PUMP", states: [{ value: { v: "AUTO / ON", c: "green" } }] },
            { label: "PRESSURE", unit: "PSI", states: [{ value: { v: "3000", c: "green" } }] },
          ],
        },
        {
          title: "YELLOW SYS",
          colorStates: [{ value: "green" }],
          rows: [
            { label: "ENG 2 PUMP", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "PRESSURE", unit: "PSI", states: [{ value: { v: "3000", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "HYD PANEL — AFFECTED",
        note: "FCOM DSC-29-10: FIRE PB closes green HYD fire SOV → GRN ENG 1 pump shows LO PR (FAULT). Blue ELEC pump auto-activates → maintains brakes, NW steering, spoilers. No crew action required.",
        switches: [
          {
            label: "GRN", sub: "ENG1 PMP",
            states: [
              { when: { step: "eng1_fire_pb" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BLU", sub: "ELEC PMP", states: [{ value: "auto" as const }] },
        ],
      },
    },

    // ── ELEC tab ──────────────────────────────────────────────────────────────
    {
      id: "elec", label: "ELEC",
      alertStates: [{ when: { step: "eng1_fire_pb" }, value: true }, { value: false }],
      sections: [
        {
          title: "AC NETWORK",
          colorStates: [
            { when: { step: "eng1_fire_pb" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "GEN 1",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "FAULT / OFF", c: "amber" } },
                { value: { v: "ON", c: "green" } },
              ],
            },
            { label: "GEN 2", states: [{ value: { v: "ON — NORM", c: "green" } }] },
            {
              label: "AC BUS 1",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "← GEN 2 (BTC)", c: "amber" } },
                { value: { v: "GEN 1", c: "green" } },
              ],
            },
            { label: "AC BUS 2", states: [{ value: { v: "GEN 2", c: "green" } }] },
            {
              label: "BUS TIE",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "CLOSED (AUTO)", c: "cyan" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
          ],
        },
        {
          title: "DC NETWORK",
          colorStates: [{ value: "green" }],
          rows: [
            {
              label: "TR 1",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "FAULT", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "TR 2",   states: [{ value: { v: "NORM", c: "green" } }] },
            {
              label: "ESS TR",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "AUTO (ALTN)", c: "cyan" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "BAT 1/2", states: [{ value: { v: "AUTO", c: "green" } }] },
          ],
        },
      ],
      tray: {
        title: "ELEC PANEL — AFFECTED",
        note: "FCOM DSC-24-10: FIRE PB disconnects IDG 1 → GEN 1 FAULT/OFF. Bus Tie Contactor (sw in AUTO) auto-closes → AC BUS 1 now fed by GEN 2. TR 1 may show FAULT; ESS TR switches to ALTN supply. No crew action required.",
        switches: [
          {
            label: "GEN 1", sub: "IDG 1",
            states: [
              { when: { step: "eng1_fire_pb" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "BUS TIE", sub: "CONTCTR", states: [{ value: "auto" as const }] },
        ],
      },
    },

    // ── AIR tab ───────────────────────────────────────────────────────────────
    {
      id: "air", label: "AIR",
      alertStates: [{ when: { step: "eng1_fire_pb" }, value: true }, { value: false }],
      sections: [
        {
          title: "BLEED",
          colorStates: [
            { when: { step: "eng1_fire_pb" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "ENG 1 BLEED",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "FAULT (SOV CL)", c: "amber" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
            { label: "ENG 2 BLEED", states: [{ value: { v: "NORM", c: "green" } }] },
            { label: "X BLEED",     states: [{ value: { v: "AUTO", c: "green" } }] },
            { label: "APU BLEED",   states: [{ value: { v: "OFF",  c: "dim"   } }] },
          ],
        },
        {
          title: "PACKS",
          colorStates: [
            { when: { step: "eng1_fire_pb" }, value: "amber" },
            { value: "green" },
          ],
          rows: [
            {
              label: "PACK 1",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "FAULT / OFF", c: "amber" } },
                { value: { v: "AUTO", c: "green" } },
              ],
            },
            { label: "PACK 2",    states: [{ value: { v: "AUTO — NORM", c: "green" } }] },
            { label: "CABIN ΔP",  states: [{ value: { v: "NORM",        c: "green" } }] },
            {
              label: "DUCT TEMP",
              states: [
                { when: { step: "eng1_fire_pb" }, value: { v: "PACK 2 ONLY", c: "cyan" } },
                { value: { v: "NORM", c: "green" } },
              ],
            },
          ],
        },
      ],
      tray: {
        title: "AIR PANEL — AFFECTED",
        note: "FCOM DSC-21-10: FIRE PB closes bleed SOV → ENG 1 BLEED FAULT. PACK 1 loses bleed supply → FAULT/OFF. X BLEED stays AUTO (closed) — PACK 2 uses ENG 2 bleed only (single pack ops). Cabin ΔP maintained by PACK 2.",
        switches: [
          {
            label: "ENG 1", sub: "BLEED",
            states: [
              { when: { step: "eng1_fire_pb" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          {
            label: "PACK 1", sub: "FLOW",
            states: [
              { when: { step: "eng1_fire_pb" }, value: "fault" as const },
              { value: "norm" as const },
            ],
          },
          { label: "X BLEED", sub: "SEL", states: [{ value: "auto" as const }] },
        ],
      },
    },
  ],

  // ── Phase-based cockpit channel state ─────────────────────────────────────
  // Sources: FCTM OP-020 Engine Fire After V1, FCOM PRO-ABN-ENG-70-10
  // Phases follow the crew's actual task-sharing from V1 through engine secured.
  phases: [

    // ── PHASE 1 — V1 PASSED (T+6s) ──────────────────────────────────────────
    {
      id: "v1_passed",
      label: "V1 PASSED — TAKEOFF COMMITTED",
      atMs: 6_000,
      pfd: {
        speed: 145,
        targetSpeed: "V2",
        altitude: 0,
        targetAltitude: 3_000,
        verticalSpeed: 0,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: false,
        athr: false,
        notes: [
          "SRS armed on FD — captures at rotation",
          "Both engines at TOGA — normal at this point",
          "Delhi QNH set from start; field elevation about 777 ft on altimeter reference",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Runway centreline track 280 shown"],
      },
      pf: {
        task: "Maintain runway centreline. Do NOT reduce thrust. Prepare to rotate at VR.",
        callouts: [
          { role: "PF", speech: "V1 — CONTINUE" },
        ],
      },
      pm: {
        task: "Monitor airspeed, call VR, watch for directional problem.",
        callouts: [
          { role: "PM", speech: "V1" },
        ],
      },
    },

    // FCOM: CRC (Continuous Repetitive Chime) fires simultaneously with MASTER WARN.
    // Fire light on FIRE panel illuminates. ECAM E/WD shows ENG 1 FIRE in red.
    // FCTM: maintain directional control and continue takeoff. Do NOT reduce thrust. No overhead action.
    {
      id: "fire_detected",
      label: "ENG 1 FIRE DETECTED",
      atMs: 8_000,
      pfd: {
        speed: 147,
        targetSpeed: "V2",
        altitude: 0,
        targetAltitude: 3_000,
        verticalSpeed: 0,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: false,
        athr: false,
        flags: ["MASTER WARN (red)", "ENG 1 FIRE — CRC"],
        notes: [
          "MASTER WARN illuminates red — CRC fires continuously",
          "ENG 1 fire loop detected — fire panel FIRE light illuminated",
          "ENG 1 still producing thrust — do NOT reduce TOGA",
          "Maintain runway track and stable takeoff attitude",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        notes: ["Track deviation possible — yaw correction required"],
      },
      pf: {
        task: "Maintain directional control and continue takeoff. Do NOT reduce thrust. Do NOT react to ECAM yet — aviate first.",
        callouts: [
          { role: "PF", speech: "CONTINUE — MAINTAIN DIRECTION" },
        ],
      },
      pm: {
        task: "Identify ECAM. Call 'MASTER WARNING — ENGINE FIRE'. Do NOT cancel MASTER WARN yet. Call VR.",
        callouts: [
          { role: "PM", speech: "MASTER WARNING — ENGINE FIRE" },
          { role: "PM", speech: "ROTATE" },
        ],
      },
      overhead: {
        items: ["FIRE panel — ENG 1 FIRE light illuminated (red)"],
        notes: [
          "FCTM: do not touch any overhead items during direction control phase",
          "Fire PB and agents are NOT actioned until ECAM procedure at 400 ft",
        ],
      },
    },

    // ── PHASE 3 — ROTATION (T+10s) ──────────────────────────────────────────
    {
      id: "rotation",
      label: "ROTATION — NORMAL VR",
      atMs: 10_000,
      pfd: {
        speed: 152,
        targetSpeed: "V2+10",
        altitude: 50,
        targetAltitude: 3_000,
        verticalSpeed: 900,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: false,
        athr: false,
        flags: ["MASTER WARN (red)", "CRC active"],
        notes: [
          "Follow normal FD rotation guidance into initial climb",
          "Maintain coordinated climb and runway-track discipline",
          "Speed trend arrow pointing up — ENG 1 still contributing thrust",
          "CRC still sounding — PM has NOT cancelled MW yet (aviate first)",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        notes: ["Track 280 — right rudder input may cause minor heading drift"],
      },
      pf: {
        task: "Rotate smoothly, follow FD, and target V2+10 while keeping a stable, coordinated climb.",
        callouts: [
          { role: "PF", speech: "ROTATING — V2+10 TARGET" },
        ],
      },
      pm: {
        task: "Call 'POSITIVE CLIMB' once VSI positive. Watch for tyre damage or directional problem. Gear Up on PF command.",
        callouts: [
          { role: "PM", speech: "POSITIVE CLIMB" },
          { role: "PF", speech: "GEAR UP" },
          { role: "PM", speech: "GEAR UP — SELECTING" },
        ],
      },
    },

    // ── PHASE 4 — GEAR UP / AP1 / MASTER WARN CANCEL (T+14s) ───────────────
    // FCTM: AP1 engaged at ~100 ft when V2+10 stable. PF reads FMA.
    // FCOM: MASTER WARN pushlight can be pressed any time to silence CRC once fire
    // is identified — PM cancels it after AP is stable (aviate sequence complete).
    {
      id: "gear_up_ap1",
      label: "GEAR UP — AP1 ENGAGED — MASTER WARN CANCEL",
      atMs: 14_000,
      pfd: {
        speed: 163,
        targetSpeed: "V2+10",
        altitude: 120,
        targetAltitude: 3_000,
        verticalSpeed: 1_900,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        notes: [
          "AP1 engaged at ~100 ft — SRS holds V2+10 on pitch",
          "NAV active (green) — AP following SID path; pilot selects RWY TRK at 400 ft",
          "FMA confirms AP1 engagement and expected mode set",
          "PM now silences CRC — MASTER WARN pushlight pressed",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["NAV active — tracking SID below 400 ft AGL"],
      },
      pf: {
        task: "Engage AP1. Read FMA aloud and confirm expected mode engagement while maintaining stable flight path.",
        callouts: [
          { role: "PF", speech: "AP1 ENGAGE" },
          { role: "PF", speech: "FMA: MAN TOGA — SRS — NAV — AP1. CHECKED." },
        ],
      },
      pm: {
        task: "Confirm gear up / 3 off. Cancel MASTER WARN to silence CRC — ECAM procedure stays displayed.",
        callouts: [
          { role: "PM", speech: "GEAR UP — 3 OFF" },
          { role: "PM", speech: "MASTER WARNING — CANCELLING" },
        ],
      },
      overhead: {
        items: ["FIRE panel — ENG 1 FIRE light still illuminated (red)"],
        notes: ["No overhead procedure action until 400 ft ECAM gate"],
      },
      pfAction: {
        label: "AP1 ENGAGE",
        hint: "Press AP1 on FCU — then read FMA aloud: MAN TOGA — SRS — NAV — AP1",
        coachMs: 6_000,
      },
    },

    // ── PHASE 5 — 400 FT / ECAM ACTIONS START (T+18s) ──────────────────────
    // FCTM Golden Rule: ECAM actions begin at 400 ft AGL with flight path stabilised.
    // PM announces "AVIATE COMPLETE, NAVIGATE SID/EO PROCEDURE". PF orders "ECAM ACTIONS".
    {
      id: "ecam_actions_start",
      label: "400 FT — ECAM ACTIONS",
      atMs: 18_000,
      pfd: {
        speed: 170,
        targetSpeed: "V2+10",
        altitude: 400,
        targetAltitude: 3_000,
        verticalSpeed: 2_000,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: false,
        notes: [
          "400 ft AGL — FCTM gate for ECAM actions",
          "SRS commanding V2+10 — AP holding nicely",
          "CLB armed in FMA — will engage at eng-out accel altitude",
          "LAND ASAP in red on E/WD — crew commits to return after securing engine",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
      },
      pf: {
        task: "Order ECAM ACTIONS. Confirm each PM action. Do not touch controls while PM works ECAM.",
        callouts: [
          { role: "PF", speech: "FOUR HUNDRED FEET — ECAM ACTIONS" },
          { role: "PM", speech: "ECAM ACTIONS" },
        ],
      },
      pm: {
        task: "Announce 'AVIATE COMPLETE, NAVIGATE SID/EO PROCEDURE'. Begin ECAM checklist — read first line.",
        callouts: [
          { role: "PM", speech: "AVIATE COMPLETE — NAVIGATE SID/EO PROCEDURE" },
          { role: "PM", speech: "ECAM — ENG ONE FIRE. READING." },
        ],
      },
    },

    // ── PHASE 6 — ECAM: THR LEVER IDLE + MASTER OFF (T+22s) ────────────────
    // FCOM PRO-ABN-ENG-70-10:
    //   Step 1: THR LEVER (ENG 1) → IDLE   (reduces thrust before fuel isolation)
    //   Step 2: ENG MASTER → OFF            (Airbus confirm-before-action)
    //   FCOM: MASTER OFF closes LP + HP fuel shut-off valves immediately.
    {
      id: "ecam_thr_master_off",
      label: "ECAM — THR LEVER IDLE / MASTER OFF",
      atMs: 22_000,
      pfd: {
        speed: 178,
        targetSpeed: "V2+10",
        altitude: 600,
        targetAltitude: 3_000,
        verticalSpeed: 2_000,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: false,
        notes: [
          "ENG 1 THR lever retarded to IDLE — ENG 2 still at TOGA",
          "ENG 1 N1/N2 decaying after IDLE selection",
          "MASTER OFF closes fuel valves — ENG 1 will spool down",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
      },
      pf: {
        task: "Monitor FD, speed, altitude. Confirm each PM ECAM callout. Do not touch controls.",
        callouts: [
          { role: "PM", speech: "THR LEVER ONE — IDLE" },
          { role: "PF", speech: "CONFIRMED" },
          { role: "PM", speech: "ENG ONE MASTER — OFF — CONFIRM?" },
          { role: "PF", speech: "CONFIRM" },
          { role: "PM", speech: "ENG ONE MASTER — OFF" },
        ],
      },
      pm: {
        task: "Step 1: retard ENG 1 THR lever to IDLE. Step 2: call 'ENG 1 MASTER OFF — CONFIRM?' → PF confirms → set MASTER OFF.",
        callouts: [
          { role: "PM", speech: "THR LEVER ONE — IDLE — SELECTING" },
          { role: "PM", speech: "ENG ONE MASTER — OFF — CONFIRM?" },
        ],
      },
      overhead: {
        items: ["ENG 1 MASTER switch → OFF (fuel SOV + oil SOV close)"],
        notes: ["FIRE panel: ENG 1 FIRE light still illuminated — fire not yet isolated"],
      },
    },

    // ── PHASE 7 — ENG 1 FIRE P/B PUSH (T+26s) ──────────────────────────────
    // FCOM PRO-ABN-ENG-70-10:
    //   Step 3: ENG FIRE P/B → PUSH
    //   Airbus confirm-before-action (irreversible).
    //   Effects: arms squibs, closes HYD fire SOV (GRN ENG1 pump → LO PR),
    //            closes bleed SOV (ENG 1 BLEED FAULT, PACK 1 off), cuts FADEC,
    //            disconnects IDG1 (GEN 1 FAULT).
    //   Secondary failures appear on E/WD ~2 s later: * HYD / * ELEC / * AIR BLEED
    {
      id: "fire_pb_pushed",
      label: "ENG 1 FIRE P/B — PUSHED",
      atMs: 26_000,
      pfd: {
        speed: 185,
        targetSpeed: "V2+10",
        altitude: 750,
        targetAltitude: 3_000,
        verticalSpeed: 1_900,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: false,
        notes: [
          "ENG 1 N1 decaying — FIRE PB armed squibs",
          "Secondary failures now on E/WD: * HYD, * ELEC, * AIR BLEED",
          "MASTER CAUT fires (amber SC chime) for secondary cautions",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
      },
      pf: {
        task: "Confirm FIRE PB push. Monitor secondary failures appearing on ECAM. Do NOT act on them yet.",
        callouts: [
          { role: "PM", speech: "ENG ONE FIRE P/B — CONFIRM PUSH?" },
          { role: "PF", speech: "CONFIRM" },
          { role: "PM", speech: "ENG ONE FIRE P/B — PUSHING" },
        ],
      },
      pm: {
        task: "Step 3: call 'ENG 1 FIRE P/B CONFIRM PUSH?' → PF confirms → push FIRE pb. Note secondary failures on E/WD.",
        callouts: [
          { role: "PM", speech: "AGENT ONE ARMED — WAITING 10 SECONDS FOR N1 DECAY" },
        ],
      },
      overhead: {
        items: [
          "FIRE panel — ENG 1 FIRE P/B pushed (armed, illuminated white)",
          "AGENT 1 squib — ARMED",
          "AGENT 2 squib — ARMED",
        ],
        notes: [
          "HYD fire SOV closed → GRN ENG1 pump shows LO PR",
          "BLEED SOV closed → ENG 1 BLEED FAULT, PACK 1 off",
          "IDG1 disconnected → GEN 1 FAULT, BTC auto-closes",
        ],
      },
    },

    // ── PHASE 8 — AGENT 1 DISCHARGE (T+36s — 10 s after FIRE PB) ───────────
    // FCOM: "AGENT 1 AFTER 10 S → DISCH"
    // 10-second wait allows N1 to decay, reducing nacelle ventilation so the
    // halon agent reaches a higher concentration in the fire zone.
    // PM monitors 10-second count; then discharges Agent 1 bottle.
    {
      id: "agent1_disch",
      label: "AGENT 1 — DISCHARGED",
      atMs: 36_000,
      pfd: {
        speed: 195,
        targetSpeed: "V2+10",
        altitude: 1_050,
        targetAltitude: 3_000,
        verticalSpeed: 1_800,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: false,
        notes: [
          "ENG 1 N1 near zero — nacelle ventilation reduced, agent effective",
          "Halon Agent 1 discharged into ENG 1 nacelle fire zone",
          "30-second monitoring window now starts",
          "FIRE light may or may not extinguish — crews must wait and observe",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
      },
      pf: {
        task: "Monitor aircraft. Confirm Agent 1 discharge. Start 30-second timer mentally (or crew timer). Watch FIRE warning.",
        callouts: [
          { role: "PM", speech: "AGENT ONE — DISCHARGING" },
          { role: "PF", speech: "CONFIRMED — 30 SECONDS" },
        ],
      },
      pm: {
        task: "Discharge AGENT 1 bottle. Announce 'AGENT ONE DISCHARGING'. Start 30-second timer. Monitor ENG 1 FIRE pb — if light extinguishes, fire out.",
        callouts: [
          { role: "PM", speech: "AGENT ONE DISCHARGED. MONITORING FIRE WARNING — 30 SECONDS." },
        ],
      },
      overhead: {
        items: [
          "AGENT 1 button — pressed (DISCH)",
          "AGENT 2 squib — still armed (held in reserve)",
          "ENG 1 FIRE light — may still be illuminated (monitoring)",
        ],
        notes: [
          "FCOM: if FIRE WARN extinguishes before 30 s — fire is out. No AGENT 2 needed.",
          "If FIRE WARN persists after 30 s — discharge AGENT 2.",
        ],
      },
    },

    // ── PHASE 9 — FIRE OUT AFTER AGENT 1 (T+41s) ───────────────────────────
    // Training baseline: Agent 1 extinguishes the fire within the monitoring
    // window, so the conditional Agent 2 branch is not required.
    {
      id: "fire_extinguished_after_agent1",
      label: "FIRE WARN EXTINGUISHED — AGENT 2 NOT REQUIRED",
      atMs: 41_000,
      pfd: {
        speed: 202,
        targetSpeed: "V2+10",
        altitude: 1_250,
        targetAltitude: 3_000,
        verticalSpeed: 1_700,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: false,
        notes: [
          "FIRE pb red light extinguishes after Agent 1 — fire confirmed out",
          "Agent 2 remains armed but is not discharged",
          "LAND ASAP remains on E/WD despite the fire being extinguished",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Tracking SID/EO procedure — AP holding stable climb"],
      },
      pf: {
        task: "Confirm the fire warning has cleared. Do not use Agent 2. Keep the aircraft stabilized and continue monitoring to acceleration altitude.",
        callouts: [
          { role: "PM", speech: "FIRE WARNING OUT" },
          { role: "PF", speech: "FIRE OUT — NO AGENT TWO" },
        ],
      },
      pm: {
        task: "Announce that the fire warning is out. Confirm the conditional AGENT 2 line is no longer required and continue with ECAM follow-on items.",
        callouts: [
          { role: "PM", speech: "ECAM — FIRE WARNING CLEARED. AGENT TWO NOT REQUIRED." },
        ],
      },
      overhead: {
        items: [
          "ENG 1 FIRE P/B — extinguished (dark)",
          "AGENT 1 button — pressed (DISCH)",
          "AGENT 2 button — armed, retained",
        ],
        notes: [
          "Single-bottle success path complete — no second discharge",
          "LAND ASAP still drives the operational decision",
        ],
      },
    },

    // ── PHASE 10 — ENGINE SECURED (T+46s) ──────────────────────────────────
    // FCTM: engine is considered secured once the fire warning is out and the
    // ENG FIRE ECAM actions are complete for the active branch.
    {
      id: "engine_secured",
      label: "ENGINE SECURED — SINGLE BOTTLE SUCCESS",
      atMs: 46_000,
      pfd: {
        speed: 208,
        targetSpeed: "V2+10",
        altitude: 1_450,
        targetAltitude: 3_000,
        verticalSpeed: 1_650,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: false,
        notes: [
          "Fire loop no longer indicating — engine secured after Agent 1",
          "ENG 1 N1 = 0, EGT cooling, secondary failures remain displayed",
          "Agent 2 retained unused; no further extinguishing action needed",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
      },
      pf: {
        task: "Acknowledge ENGINE SECURED. Announce LAND ASAP and prepare for acceleration at minimum acceleration altitude.",
        callouts: [
          { role: "PM", speech: "ENGINE SECURED" },
          { role: "PF", speech: "ENGINE SECURED — ACKNOWLEDGED" },
          { role: "PF", speech: "LAND ASAP — RETURN DELHI" },
        ],
      },
      pm: {
        task: "Announce ENGINE SECURED once the fire warning is extinguished. Read the secondary failures and announce STATUS.",
        callouts: [
          { role: "PM", speech: "ENGINE SECURED. SECONDARY FAILURES ON ECAM — HYD, ELEC, AIR BLEED." },
          { role: "PM", speech: "STATUS APPEARING." },
        ],
      },
      overhead: {
        items: [
          "ENG 1 FIRE P/B — extinguished (dark) — fire out",
          "ENG 1 MASTER — OFF",
          "AGENT 1 — DISCH",
          "AGENT 2 — ARMED, UNUSED",
          "GEN 1 — FAULT/OFF (IDG disconnected by FIRE PB)",
          "ENG 1 BLEED — FAULT (SOV closed by FIRE PB)",
        ],
        notes: ["All required FIRE panel actions for this branch are complete"],
      },
    },

    // ── PHASE 11 — MAA LEVEL-OFF / FLAP RETRACTION (T+58s) ─────────────────
    // FCOM DSC-22-30-80-20: "In OEI conditions, SRS does NOT automatically
    // disengage at EO ACC ALT." Crew must push V/S knob manually to level off.
    // FCOM DSC-22-30-70-80: FMA displays "V/S = 0" in green when V/S nulled.
    // LVR MCT does NOT flash yet — speed is below green dot, flaps still retracting.
    {
      id: "accel_level_off",
      label: "MAA LEVEL-OFF — FLAP RETRACTION",
      atMs: 58_000,
      pfd: {
        speed: 185,
        targetSpeed: "F SPD",
        altitude: 2_300,
        targetAltitude: 4_000,
        verticalSpeed: 0,
        fmaThrust: "MAN TOGA",
        fmaPitch: "V/S = 0",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: false,
        notes: [
          "VIDP MAA ~2300 ft AMSL (~1523 ft AGL at VIDP elev 777 ft) — PF pushes V/S knob",
          "FCOM: 'In OEI conditions, SRS does not automatically disengage at EO ACC ALT' — crew must push V/S manually",
          "FMA: MAN TOGA (white) col 1 | V/S = 0 (green) col 2 | RWY TRK (green) col 3",
          "No LVR MCT yet — aircraft still accelerating through F-speed, flap retraction in progress",
          "Speed increasing: at F-speed → Flap 1; at S-speed → Flap 0 (CONFIG CLEAN)",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Range increased to 20 nm for VIDP return planning"],
      },
      pf: {
        task: "Push V/S knob to level off at MAA. Confirm FMA shows V/S = 0. Call flap retraction at each speed.",
        callouts: [
          { role: "PF", speech: "V/S ZERO — LEVELLING OFF" },
          { role: "PF", speech: "FMA CHECKED — MAN TOGA — V/S ZERO — RWY TRACK" },
          { role: "PF", speech: "FLAPS ONE" },
          { role: "PM", speech: "SPEED CHECKED — FLAPS ONE" },
          { role: "PF", speech: "FLAPS UP" },
          { role: "PM", speech: "SPEED CHECKED — FLAPS UP — CONFIG CLEAN" },
        ],
      },
      pm: {
        task: "Monitor speed, call each flap check speed, confirm CONFIG CLEAN on ECAM when flap lever zero.",
        callouts: [
          { role: "PM", speech: "CONFIG CLEAN — GREEN DOT APPROACHING" },
        ],
      },
      overhead: {
        items: ["No new overhead actions — all ENG FIRE panel items already completed"],
        notes: ["After Takeoff CL follows after MCT / OP CLB phase"],
      },
      pfAction: {
        label: "V/S ZERO",
        hint: "Push V/S knob on FCU to level off — FMA col 2 changes SRS → V/S = 0",
        coachMs: 8_000,
      },
    },

    // ── PHASE 12 — GREEN DOT / LVR MCT FLASH (T+65s) ────────────────────────
    // FCOM DSC-22-20-60-40: "When aircraft is clean and has reached Green Dot,
    // 'LVR MCT' flashes on the FMA." (white, flashing — col 1 third line)
    // FCTM: "Pull for OPEN CLIMB, set THR MCT when LVR MCT flashes on FMA."
    // FMA at this snapshot: MAN TOGA (white) + LVR MCT (flash) | V/S = 0 | RWY TRK
    {
      id: "green_dot_lvr_mct",
      label: "GREEN DOT — CONFIG CLEAN — LVR MCT",
      atMs: 65_000,
      pfd: {
        speed: 210,
        targetSpeed: "GREEN DOT",
        altitude: 2_300,
        targetAltitude: 4_000,
        verticalSpeed: 0,
        fmaThrust: "MAN TOGA",
        fmaThrCue: "LVR MCT",
        fmaPitch: "V/S = 0",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: false,
        notes: [
          "Green dot speed reached — config CLEAN (Flap 0) — FCOM: LVR MCT now flashes white in FMA col 1",
          "FMA: MAN TOGA (white) + LVR MCT (white flash, third line col 1) | V/S = 0 (green) | RWY TRK (green)",
          "Crew must: PULL ALT knob → OP CLB, then SET MCT detent → THR MCT",
          "FCOM DSC-22-30-70-30: OP CLB engages when flight crew pulls ALT knob (FCU alt > aircraft alt)",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Config clean — ready for OP CLB on ALT pull"],
      },
      pf: {
        task: "On LVR MCT flash: pull ALT knob to engage OP CLB, then move live engine lever to MCT detent.",
        callouts: [
          { role: "PM", speech: "GREEN DOT — LVR MCT" },
          { role: "PF", speech: "MCT" },
          { role: "PM", speech: "MCT — THRUST SET" },
        ],
      },
      pm: {
        task: "Call 'GREEN DOT — LVR MCT' when green dot reached, confirm MCT set on live engine.",
        callouts: [
          { role: "PM", speech: "SINGLE ENGINE — MCT SET" },
        ],
      },
      overhead: {
        items: ["All fire panel actions complete"],
        notes: ["Next: PF pulls ALT knob → OP CLB engages → FMA changes to THR MCT / OP CLB"],
      },
      pfAction: {
        label: "LVR MCT → SET",
        hint: "Move live engine lever to MCT detent — then pull ALT knob for OP CLB",
        coachMs: 5_000,
      },
    },

    // ── PHASE 13 — THR MCT / OP CLB — FINAL TAKEOFF SEGMENT (T+70s) ────────
    // FCTM PR-AEP-ENG: Sequence: LVR MCT flash → PF pulls ALT (OP CLB) →
    // PF sets MCT → THR MCT active. A/THR now managed to MCT ceiling.
    // FCOM DSC-22-30-70-30: "OP CLB engages when flight crew pulls ALT knob."
    {
      id: "op_clb_climb",
      label: "THR MCT — OP CLB — FINAL TAKEOFF SEGMENT",
      atMs: 70_000,
      pfd: {
        speed: 215,
        targetSpeed: "GREEN DOT",
        altitude: 2_500,
        targetAltitude: 4_000,
        verticalSpeed: 700,
        fmaThrust: "THR MCT",
        fmaPitch: "OP CLB",
        fmaLateral: "RWY TRK",
        ap1: true,
        athr: true,
        notes: [
          "THR MCT (green) — A/THR active, managing thrust to MCT ceiling (col 1)",
          "OP CLB (green) — FCU alt target climbing, ALT CSTR disregarded (col 2)",
          "RWY TRK (green) — AP tracking runway heading 280 on radar vectors (col 3)",
          "LVR MCT cue cleared — live engine lever now in MCT detent",
          "Config CLEAN, speed above green dot — single engine final takeoff segment",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Radar vectors — AP on RWY TRK, climbing on OP CLB to FCU altitude"],
      },
      pf: {
        task: "Confirm FMA: THR MCT / OP CLB / RWY TRK. Continue ECAM STATUS, then AFTER TAKEOFF CL.",
        callouts: [
          { role: "PF", speech: "CLIMB" },
          { role: "PM", speech: "FMA CHECKED — THR MCT — OP CLB — RWY TRACK" },
          { role: "PF", speech: "CONTINUE ECAM" },
        ],
      },
      pm: {
        task: "Cross-check FMA, confirm A/THR active (managed), continue STATUS and AFTER TAKEOFF CL flow.",
        callouts: [
          { role: "PM", speech: "SINGLE ENGINE — OPEN CLIMB — MCT THRUST" },
        ],
      },
      overhead: {
        items: ["All fire panel actions complete"],
        notes: ["Final takeoff segment — OEI climb at MCT to assigned altitude"],
      },
      pfAction: {
        label: "OP CLB CONFIRM",
        hint: "Pull ALT knob on FCU — FMA col 2: OP CLB (green). A/THR now active.",
        coachMs: 5_000,
      },
    },
  ],
};
