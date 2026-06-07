# Authoring a Crosscheck scenario — full-panel reference

Crosscheck scenarios are **pure data**. Every panel in the runner UI is driven
by a field in the `Scenario` type. No per-scenario React code is ever needed.

This document maps every UI panel to its data source, FCOM/FCTM sourcing
requirements, citation rules, and authoring constraints. It is the definitive
guide for writing new scenarios or extending existing ones.

Read the [a320-fcom-trainer skill](.claude/skills/a320-fcom-trainer/SKILL.md)
before modifying any procedure content. The nine-input intake and sourcing
discipline described there are prerequisites for this guide.

---

## 0. Rule zero: no content without a source

Every item in this document that touches Airbus procedure content requires a
citation. The citation tags are:

| Tag | Source |
|---|---|
| `[fcom:LN]` | FCOM prose, line N |
| `[fctm:LN]` | FCTM, line N |
| `[tasksharing:LN]` | tasksharing.txt |
| `[callouts:LN]` | callouts.txt — verbatim callout |
| `[abnormal-procs:LN]` | abnormal-procs.txt |
| `[user-input]` | Explicitly agreed with developer |
| `[simulation-placeholder]` | No source found — must be flagged |

If a required field has no sourceable content, mark it `simulation-placeholder`
and raise it before authoring. Do not invent procedure steps, callout phrases,
or ECAM lines.

---

## 1. The Scenario shape — all fields at a glance

```ts
type Scenario = {
  meta:         ScenarioMeta;          // registry card
  brief:        ScenarioBrief;         // preflight brief screen
  triggers:     ScenarioTrigger[];     // timed system events → ECAM
  steps:        ScenarioStep[];        // ALL panels (group field routes each step)
  decisions:    ScenarioDecision[];    // decision panel
  statusItems?: StatusItem[];          // STATUS page
  distractions?: ScenarioDistraction[]; // ATC/comms modal interruptions
  systemTabs?:  SysTabDef[];           // System Display tabs (ENG, HYD, ELEC…)
  engineDisplay?: EngineDisplayDef;    // Engine/Fire panel
  phases?:      ScenarioPhase[];       // phase-based PFD/ND + ATC/PF/PM narrative
  airports?:    AirportOption[];       // pre-start airport picker
};
```

---

## 2. Panel map

The `group` field on each `ScenarioStep` determines which React component
renders it. Every step that you do not assign a `group` defaults to the
**Procedure Panel** (ECAM actions).

| `group` | Component | Panel in UI | Source |
|---|---|---|---|
| *(absent)* or `"procedure"` | `CockpitControls` | ECAM action buttons, centre column | FCOM ECAM procedure lines |
| `"flightcheck"` | `FlightCheckPopup` | Timed popup overlay — Aviate/Navigate gates | FCTM Golden Rules; callouts.txt |
| `"glareshield"` | `GlareshieldPanel` | Glareshield MASTER WARN / CAUT buttons | FCOM DSC-31; callouts.txt |
| `"chclm"` | `ChclmChecklist` | Post-ECAM coordination checklist | FCTM post-ECAM sequence; callouts.txt |
| `"comms"` | `CommChecklist` | CRM/comms panel — ATC, cabin, pax, OPS | FCTM comms; abnormal-procs.txt |

`variant` sets the button colour/style:
- `"warning"` — red (MASTER WARN level, memory item, MAYDAY)
- `"caution"` — amber (MASTER CAUT level, AGENT discharge)
- `"advisory"` — cyan (ECAM action, coordination call)
- `"switch"` — neutral (normal action, flap selection, etc.)

---

## 3. Panel-by-panel authoring guide

### 3.1 Preflight brief screen

**Component:** `PreflightBrief`
**Source field:** `brief: { situation, job }`

```ts
brief: {
  situation:
    "One or two sentences. What system has failed, when, at what flight condition. " +
    "Exact aircraft state: speed, altitude, AGL, configuration, AP/ATHR status.",
  job:
    "One sentence. What the trainee must do: FCOM procedure + decision outcome.",
},
```

**Rules:**
- `situation` must state the flight phase (takeoff / climb / cruise / approach) and
  the exact failure mode. Never use vague language ("something went wrong").
- `job` must name the FCOM procedure title and the primary training objective.
- Neither field is sourced from FCOM — this is plain-English instructor copy
  (`[user-input]`). But the failure description must be consistent with the
  ECAM lines in `triggers`.

---

### 3.2 Airport picker (pre-start)

**Component:** `PreflightBrief` (phase `"airports"`)
**Source field:** `airports?: AirportOption[]`
**Shared data:** `src/data/india-airports.ts`

When `airports` is present, the brief screen shows a "Select destination →"
button that opens a grid of airport cards before the countdown.

```ts
airports: [
  {
    icao: "VIDP", iata: "DEL",
    name: "Indira Gandhi International",
    city: "New Delhi",
    elevFt: 777,               // MSL, feet — source: AIP India / Jeppesen
    runways: [
      { id: "09/27", lengthM: 4430 }, // TORA — source: AIP India
      { id: "11/29", lengthM: 4430 },
      { id: "10/28", lengthM: 3810 },
    ],
  },
  // ... other airports
],
```

**Rules:**
- Import from `src/data/india-airports.ts` where available, or inline in the
  scenario file using the same `AirportOption` shape.
- Runway lengths are TORA in metres. Source from AIP India or Jeppesen charts.
  Mark estimates as `[simulation-placeholder]` in a comment.
- Only include if the scenario has a diversion/alternate-selection decision.
- The selected airport is threaded through the runner as `selectedAirport`
  for future use in phase-based PFD/ND display.

---

### 3.3 EWD / ECAM display

**Component:** `EwdDisplay`
**Source fields:**
- `triggers[].effects` → `ADD_ECAM` / `CLEAR_ECAM` / `SET_MASTER_WARN` / `SET_MASTER_CAUT` / `SET_ALARM_LABEL`
- `steps[].ecamRef` → the `ECAMMessage.id` that turns green when this step completes
- `steps[].afterEffect.effects` → deferred ECAM mutations on step completion

```ts
// In triggers:
{ type: "ADD_ECAM", messages: [
  { id: "eng1_fire",    line: "ENG 1 FIRE",                   level: "warning"  },
  { id: "ecam_thr",     line: "THR LEVER (ENG 1)......IDLE",  level: "advisory" },
  { id: "ecam_master",  line: "ENG 1 MASTER...........OFF",   level: "advisory" },
  { id: "ecam_fire_pb", line: "ENG 1 FIRE P/B.........PUSH",  level: "advisory" },
  { id: "land_asap",    line: "LAND ASAP",                    level: "warning"  },
] }
```

**Level → display colour (FCOM DSC-31-60):**
| `level` | Colour | When |
|---|---|---|
| `"warning"` | Red | Title, `LAND ASAP` |
| `"caution"` | Amber | Secondary non-critical items |
| `"advisory"` | Cyan | All L1 action lines the crew must action |
| `"remark"` | White | Conditional headers `·IF FIRE WARN AFTER 30 S` |
| `"memo"` | Green | Satisfied / normal indications |

**FCOM sourcing rules:**
- Extract every ECAM line verbatim from `fcom-full.txt`. Grep for the
  procedure title, then copy the EWD/SD display list exactly.
- Use the FCOM dotted-leader format: `ITEM NAME ............. ACTION`
- Do not add lines that do not appear on the real FCOM EWD.
- Timed triggers (`atMs`) should reflect the real scenario timeline:
  - 5–8 s: initial system failure alert fires
  - +10 s: secondary effects (fire warnings after cut)
  - +30 s: conditional branches activate

**Step → ECAM link:**

```ts
{ id: "eng1_master_off", ..., ecamRef: "ecam_master" }
// When the step is marked done, the ECAM line "ecam_master" turns green.
```

**Clearing ECAM after step:**

```ts
afterEffect: {
  delayMs: 1_500,
  triggerId: "atc_notified",
  effects: [{ type: "CLEAR_ECAM", ids: ["ecam_atc"] }],
},
```

---

### 3.4 Glareshield panel — MASTER WARN / CAUT

**Component:** `GlareshieldPanel`
**Source field:** `steps[]` with `group: "glareshield"`

```ts
{
  id: "cancel_master_warn",
  label: "MASTER WARN",
  action: "CANCEL",
  hint: "PM cancels MASTER WARN — pushes glareshield light to silence CRC and reset red light.",
  variant: "warning",          // red = MASTER WARN
  crew: "PM",
  group: "glareshield",
  hardware: true,              // hardware = completes on physical press
  requires: [],
  afterEffect: {
    delayMs: 400,
    triggerId: "mw_cancelled",
    effects: [{ type: "SET_MASTER_WARN", active: false }],
  },
},
{
  id: "cancel_master_caut",
  label: "MASTER CAUT",
  action: "CANCEL",
  hint: "PM pushes MASTER CAUTION light — silences single chime, resets amber light.",
  variant: "caution",          // amber = MASTER CAUT
  crew: "PM",
  group: "glareshield",
  hardware: true,
  requires: [],
  afterEffect: {
    delayMs: 300,
    triggerId: "mc_cancelled",
    effects: [{ type: "SET_MASTER_CAUT", active: false }],
  },
},
```

**Rules:**
- MASTER WARN = red glareshield light + CRC (Continuous Repetitive Chime) = L1 WARNING.
- MASTER CAUT = amber glareshield light + single chime = L2 CAUTION.
- `hardware: true` — these are physical pushbutton presses, not soft buttons.
- Always `requires: []` — glareshield lights are pressable at any time.
- Source: FCOM DSC-31-20 (master lights logic). Callout from `callouts.txt`.

---

### 3.5 FlightCheck popup — Aviate / Navigate gates

**Component:** `FlightCheckPopup`
**Source field:** `steps[]` with `group: "flightcheck"`

The FlightCheckPopup surfaces mandatory coordination steps (Aviate / Navigate
gates) as full-screen overlays before the ECAM procedure becomes accessible.

```ts
// Aviate — PF continues rotation after V1 cut
{
  id: "continue_rotation",
  label: "CONTINUE ROTATION",
  action: "V2+10",
  hint: "PF maintains rotation — do NOT reduce thrust. Follow FDs, target V2+10 kt on SRS guidance.",
  variant: "switch",
  crew: "PF",
  group: "flightcheck",
},
// Navigate — PM calls Positive Rate → PF commands Gear Up
{
  id: "positive_rate_gear_up",
  label: "POSITIVE RATE — GEAR UP",
  action: "CALL",
  hint: "PM: 'POSITIVE RATE'. PF: 'GEAR UP'. PM selects gear lever UP.",
  variant: "switch",
  crew: "PM",
  group: "flightcheck",
  requires: ["continue_rotation"],
},
// Gate — 400 ft AGL, ECAM actions ordered
{
  id: "four_hundred_ft_cmd",
  label: "400 FT — AVIATE COMPLETE, ECAM ACTIONS",
  action: "ANNOUNCE",
  hint: "At 400 ft AGL: PM announces 'AVIATE COMPLETE, NAVIGATE SID OR EO PROCEDURE'. PF orders 'ECAM ACTIONS'.",
  variant: "advisory",
  group: "flightcheck",
  crew: "PM",
  requires: ["engage_ap_fma", "cancel_master_warn"],
},
```

**Rules:**
- Source Aviate/Navigate steps from FCTM Golden Rules section.
- Callout verbatim from `callouts.txt` — do not paraphrase.
- The 400 ft AGL gate must `requires` both AP engagement and MASTER WARN cancel.
- Only use `group: "flightcheck"` for PF/PM coordination — not ECAM line actions.
- The `requiresTrigger` field gates a step until the named trigger has fired:
  ```ts
  requiresTrigger: "fire_warn",  // step only appears after fire_warn trigger
  ```

---

### 3.6 Procedure panel — ECAM actions

**Component:** `CockpitControls`
**Source field:** `steps[]` with `group: "procedure"` or no `group`

These are the main ECAM procedure buttons — one per FCOM L1 action line.

```ts
// ── 1 ── FCOM: "THR LEVER (AFFECTED) → IDLE"  [fcom:LN]
{
  id: "thr_lever_idle",
  label: "THR LEVER 1",
  action: "IDLE",
  hint: "PM retards ENG 1 thrust lever to IDLE.",
  variant: "switch",
  crew: "PM",
  hardware: true,
  ecamRef: "ecam_thr",
  requires: ["four_hundred_ft_cmd"],
},
// ── 2 ── FCOM: "ENG MASTER (AFFECTED) → OFF"  [fcom:LN]
{
  id: "eng1_master_off",
  label: "ENG 1 MASTER",
  action: "OFF",
  hint: "PM: 'ENG 1 MASTER, CONFIRM OFF?' — PF: 'CONFIRM' — PM sets OFF.",
  variant: "switch",
  crew: "PM",
  hardware: true,
  ecamRef: "ecam_master",
  confirmRequired: true,       // two-phase: verbal confirm → execute
  requires: ["thr_lever_idle"],
},
```

**Rules:**
- One step per FCOM L1 action line — do not merge multiple actions into one step.
- FCOM step order is the `requires` chain order. Never reorder.
- Use `confirmRequired: true` for irreversible actions (MASTER OFF, FIRE pb).
- `hardware: true` for physical panel items (thrust lever, master switch, FIRE pb).
- `ecamRef` links each step to the ECAM line that turns green on completion.
  The `id` must match exactly a message `id` in the triggering `ADD_ECAM` effects.
- FCOM verbs must be exact: IDLE, OFF, PUSH, DISCH, CHECK — never paraphrased.
- Cite source in a comment: `// FCOM PRO-ABN-ENG [fcom:LN]`

**Conditional branches (FCOM L2 sub-notes):**

```ts
// ·IF FIRE WARN AFTER 30 S:
{
  id: "agent2",
  label: "AGENT 2",
  action: "DISCH",
  hint: "IF FIRE WARN persists 30 s after Agent 1 — discharge Agent 2.",
  variant: "caution",
  requires: ["agent1"],
  crew: "PM",
  ecamRef: "ecam_agent2",
},
```

---

### 3.7 CHCLM checklist panel — post-ECAM coordination

**Component:** `ChclmChecklist`
**Source field:** `steps[]` with `group: "chclm"`

Post-ECAM coordination steps: announcing engine secured, LAND ASAP readout,
STATUS reading, After Takeoff checklist, OEB check, ECAM ACTIONS COMPLETE.

```ts
{
  id: "engine_secured",
  label: "ENGINE SECURED",
  action: "ANNOUNCE",
  hint: "PM announces 'ENGINE SECURED' after AGENT 2 + fire extinguished.",
  variant: "advisory",
  crew: "PM",
  group: "chclm",
  requires: ["agent2"],
},
{
  id: "crew_crosscheck",
  label: "ECAM ACTIONS COMPLETED",
  action: "ANNOUNCE",
  hint: "PM: 'ECAM ACTIONS COMPLETED.' PF acknowledges.",
  variant: "advisory",
  crew: "PM",
  group: "chclm",
  requires: ["status_read_aloud"],
},
```

**Rules:**
- Source post-ECAM sequence from FCTM (lines around the "ECAM actions complete"
  section). The canonical order is:
  1. Announce engine secured (FCTM)
  2. LAND ASAP (ECAM)
  3. Secondary failures announced
  4. STATUS announced
  5. STOP ECAM (PF order)
  6. After Takeoff CL
  7. OEB check
  8. Read STATUS
  9. ECAM ACTIONS COMPLETED
- Callouts from `callouts.txt` verbatim. Cite `[callouts:LN]` on the `hint`.
- `notes[]` on a CHCLM step shows bullet-point content above the button
  (use for STATUS items or checklist line expansions):
  ```ts
  notes: [
    "ENG 1 SHUT DOWN",
    "AGENT 1 + 2 DISCH",
    "GEN 1 INOP",
  ],
  ```

---

### 3.8 Comms / ATC panel

**Component:** `CommChecklist`
**Source field:** `steps[]` with `group: "comms"`

CRM communication steps: MAYDAY declaration, WX/ATIS request, FORDEC, NITS
brief to cabin, PAX PA, OPS ACARS, approach brief, approach prep.

```ts
{
  id: "mayday_atc",
  label: "MAYDAY",
  action: "DECLARE",
  hint: "Call ATC: 'MAYDAY MAYDAY MAYDAY, IFLY101, engine fire engine 1, climbing 3 000 feet, STANDBY.'",
  variant: "warning",
  crew: "PM",
  group: "comms",
  requires: ["announce_land_asap"],
  ecamRef: "ecam_atc",          // satisfies ECAM "ATC .......... NOTIFY"
  notes: [
    "MAYDAY × 3",
    "Callsign",
    "Nature: engine fire engine 1",
    "Position / heading / altitude",
    "STANDBY — defer intentions until workload eases",
  ],
},
```

**Rules:**
- MAYDAY format: `[abnormal-procs:LN]`. Three repetitions, callsign, nature, state, STANDBY.
- PAN PAN format: `[abnormal-procs:LN]`. Use when FCOM STATUS says LAND ASAP AMBER.
- ATC callout text from `callouts.txt` or `abnormal-procs.txt` — never invented.
- FORDEC is pilot-initiated CRM technique, not FCOM procedure.
  Source from FCTM or mark `[user-input]`.
- NITS brief format: `[abnormal-procs:LN]` or `[user-input]`.
- `notes[]` shows bullet items inside the comm card — use for FORDEC elements,
  NITS elements, and radio readback structure.
- `optional: true` for OPS ACARS and optional crew briefings.

---

### 3.9 ATC distraction modal — timed interruptions

**Component:** `DistractionModal`
**Source field:** `distractions?: ScenarioDistraction[]`

Timed ATC or cabin calls that interrupt the crew during the procedure. Correct
answers must be selected; wrong answers add workload and re-surface.

```ts
distractions: [
  {
    id: "atc_call_1",
    atMs: 20_000,               // 20 s after session start
    kind: "atc",
    from: "DELHI DEPARTURE",
    message: "IFLY101, confirm intentions.",
    choices: [
      { id: "a", label: "IFLY101, standby.", correct: true },
      { id: "b", label: "IFLY101, continuing departure.", correct: false },
      { id: "c", label: "IFLY101, declaring emergency now.", correct: false },
    ],
    autoDismissMs: 20_000,
    standbyResurfaceMs: 25_000,
    requiresStep: "cancel_master_warn", // fires only after this step is done
    pilotSays: "IFLY101, MAYDAY MAYDAY MAYDAY, engine fire, standby.",
    // ↑ Optional: shows the pilot's call BEFORE ATC's response in the modal
  },
],
```

**Source rules:**
- ATC initiative: source from FCOM `PRO-ABN-ABN-00` or `abnormal-procs.txt`.
- Readback choices: one correct (`correct: true`), two plausible distractors.
- `kind` values: `"atc"` | `"crew"` | `"cabin"` | `"company"` | `"flightcheck"`.
- `requiresStep` prevents the distraction firing before the procedure reaches
  a realistic milestone.
- `pilotSays` renders the full back-and-forth exchange in the modal — use for
  pilot-initiated calls so the trainee sees the complete RT exchange.

---

### 3.10 Decision panel

**Component:** `DecisionPanel`
**Source field:** `decisions: ScenarioDecision[]`

The strategic decision the trainee must make (Land Asap, Divert, Continue):

```ts
decisions: [
  {
    value: "LAND_ASAP",
    label: "LAND ASAP",
    description: "Return to departure field. Full emergency declared. CFR standby.",
    tone: "primary",    // correct
  },
  {
    value: "DIVERT",
    label: "DIVERT",
    description: "Continue to nominated alternate airport.",
    tone: "secondary",  // acceptable but not best
  },
  {
    value: "CONTINUE",
    label: "CONTINUE TO DESTINATION",
    description: "Continue flight with one engine.",
    tone: "danger",     // explicitly wrong
  },
],
```

**Tone meanings:**
- `"primary"` — correct FCOM/FCTM answer (full decision score)
- `"secondary"` — operationally defensible alternate (partial score)
- `"danger"` — explicitly contrary to FCOM LAND ASAP or safety guidance

**Rules:**
- Decision value must align with FCOM LAND ASAP colour:
  - Red (nearest airport) = `tone: "primary"` for the land-now option.
  - Amber (nearest suitable) = `tone: "primary"` for divert, `"secondary"` for return.
- Source LAND ASAP colour from FCOM STATUS section for this specific procedure.
- When `airports` is present, each decision can optionally carry airport
  metadata for card-style rendering (future field — see `types.ts`).

---

### 3.11 STATUS page

**Component:** `StatusPanel`
**Source field:** `statusItems?: StatusItem[]`

```ts
statusItems: [
  { id: "eng1_shut_down", line: "ENG 1 SHUT DOWN",          severity: "caution", inopSys: false },
  { id: "gen1_inop",      line: "GEN 1 INOP",               severity: "caution", inopSys: true  },
  { id: "hyd_g_lo_pr",    line: "HYD G ENG1 PUMP LO PR",   severity: "caution", inopSys: false },
  { id: "appr_cat1",      line: "APPR CAT 1",               severity: "advisory", inopSys: false },
  { id: "max_fl250",      line: "MAX FL 250",               severity: "advisory", inopSys: false },
],
```

**Rules:**
- Source every STATUS line verbatim from FCOM PRO-ABN STATUS page for this
  procedure. Grep `fcom-full.txt` for "STATUS" after the procedure title.
- `severity` → colour: `"caution"` = amber, `"advisory"` = cyan, `"memo"` = green.
- `inopSys: true` places the item in the right-hand INOP SYS column (FCOM STATUS layout).
- Do not add STATUS items that do not appear in FCOM for this procedure.

---

### 3.12 System Display tabs

**Component:** `SystemDisplay`
**Source field:** `systemTabs?: SysTabDef[]`

Declarative SD tabs (ENG, HYD, ELEC, AIR, etc.) with state-driven row values.

```ts
systemTabs: [
  {
    id: "eng",
    label: "ENG",
    alertStates: [
      { when: { trigger: "fire_warn" }, value: true },
      { value: false },
    ],
    autoSelect: { trigger: "fire_warn" },
    sections: [
      {
        title: "ENG 1",
        colorStates: [
          { when: { trigger: "fire_warn" }, value: "red" },
          { value: "green" },
        ],
        rows: [
          {
            label: "N1",
            unit: "%",
            states: [
              { when: { trigger: "fire_warn" }, value: { v: "0.0", c: "dim" } },
              { value: { v: "84.2", c: "green" } },
            ],
          },
        ],
      },
    ],
  },
],
```

**Rules:**
- Source display values from FCOM DSC system description or SD page spec.
- `when.step` resolves after that step ID is complete.
- `when.trigger` resolves after that trigger has fired.
- The first matching `when` wins (resolved top-to-bottom).
- Omit `when` on the last case to use it as the default value.
- Only populate `systemTabs` when the scenario's failure involves a system that
  has meaningful SD indication changes. Do not create empty tabs.

---

### 3.13 Engine / Fire panel

**Component:** `FirePanel`
**Source field:** `engineDisplay?: EngineDisplayDef`

```ts
engineDisplay: {
  warningTrigger: "fire_warn",
  eng1: {
    rows: [
      {
        label: "N1",
        unit: "%",
        states: [
          { when: { trigger: "fire_warn" }, value: { v: "0.0", c: "dim" } },
          { value: { v: "84.2", c: "green" } },
        ],
      },
    ],
    trays: [
      {
        title: "MASTER",
        switches: [
          {
            label: "MASTER 1",
            states: [
              { when: { step: "eng1_master_off" }, value: "off" },
              { value: "norm" },
            ],
          },
        ],
      },
    ],
  },
  eng2: {
    rows: [],
  },
  controlPanel: [
    { stepId: "cancel_master_warn", kind: "cancel_warn", label: "MASTER WARN" },
    { stepId: "thr_lever_idle",     kind: "thr_lever",   label: "THR LEVER 1" },
    { stepId: "eng1_master_off",    kind: "master",      label: "MASTER 1" },
    { stepId: "eng1_fire_pb",       kind: "fire_pb",     label: "ENG 1 FIRE" },
    { stepId: "agent1",             kind: "agent",       label: "AGENT 1" },
    { stepId: "agent2",             kind: "agent",       label: "AGENT 2" },
  ],
},
```

**Rules:**
- Source fire panel indications from FCOM DSC-26 (fire detection), DSC-70 (engine).
- `warningTrigger` names the trigger whose fire fires the visual FIRE alert on the panel.
- Each `EngControlDef` in `controlPanel` binds a `stepId` to a hardware control kind.
- Omit `engineDisplay` if the scenario does not involve the ENG page or FIRE panel.

---

### 3.14 Phase-based PFD / ND + crew narrative

**Component:** `PfdMockup`, `NdCanvas` (via `pfd-nd.tsx`)
**Source field:** `phases?: ScenarioPhase[]`

Each phase captures a snapshot of the cockpit at a key scenario moment.
The active phase is determined by wall-clock elapsed time.

```ts
phases: [
  {
    id: "takeoff_roll",
    label: "TAKEOFF ROLL",
    atMs: 0,
    pfd: {
      speed: 145, targetSpeed: "V2",
      altitude: 0, targetAltitude: 3000,
      verticalSpeed: 0,
      fmaThrust: "MAN TOGA", fmaPitch: "SRS", fmaLateral: "NAV",
      ap1: false, ap2: false, athr: true,
    },
    nd: {
      mode: "ARC", range: 20,
      heading: 280, activeWpt: "VIDP",
    },
    pf: { task: "Hold V2+10 — do not reduce thrust after V1 cut." },
    pm: { task: "POSITIVE RATE — GEAR UP after liftoff." },
  },
  {
    id: "fire_detected",
    label: "ENG 1 FIRE DETECTED",
    atMs: 8_000,
    pfd: {
      speed: 155, targetSpeed: "V2+10",
      altitude: 400, targetAltitude: 3000,
      verticalSpeed: 1800,
      fmaThrust: "MAN TOGA", fmaPitch: "SRS", fmaLateral: "NAV",
      ap1: false, ap2: false, athr: true,
      flags: ["ENG 1 FIRE"],
    },
    pf: {
      task: "Aviate — maintain V2+10, flight path stable, AP1 at 100 ft.",
      callouts: [
        { role: "PM", speech: "POSITIVE RATE" },
        { role: "PF", speech: "GEAR UP" },
      ],
    },
    atc: {
      initiatedBy: "ATC",
      transmissions: [
        { role: "ATC", station: "DELHI DEP", speech: "IFLY101, climb FL100, direct KANPO." },
      ],
    },
  },
],
```

**Rules:**
- `atMs` must be consistent with the `triggers[]` timeline.
- `pfd` speed / altitude values must reflect the FCTM/FCOM flight condition for
  this scenario phase. Do not use arbitrary numbers.
- `pf.callouts` and `pm.callouts` verbatim from `callouts.txt`. Cite `[callouts:LN]`.
- `atc.transmissions` from `abnormal-procs.txt` or ICAO phraseology file.
- `fmaThrust / fmaPitch / fmaLateral` must match the real FMA state for this
  flight condition (FCOM DSC-22 FG).
- All three are optional — only populate the channels that change at this phase.

---

## 4. Sourcing checklist before authoring

Complete this before writing any step, ECAM line, or callout:

```
[ ] PROCEDURE NAME — exact FCOM title, confirmed
[ ] FLIGHT PHASE — climb / cruise / approach / on-ground
[ ] GOAL — what the trainee must learn from this scenario
[ ] SOURCE HIERARCHY — ECAM? QRH? FCOM-only? Memory items first?
[ ] FCOM EXTRACTION — every L1 action + L2 sub-note, verbatim
[ ] FCTM TECHNIQUE — nuances that supplement FCOM steps (or "none")
[ ] PF/PM TASKSHARING — every step assigned, source tasksharing.txt
[ ] CALLOUT PHRASEOLOGY — verbatim from callouts.txt, or simulation-placeholder
[ ] USER RULES — training simplifications agreed with developer
→ All nine checked → proceed to authoring
→ Any missing → ask first
```

---

## 5. Scenario file structure

Every new scenario file follows this skeleton (header comment → triggers →
steps in five groups → decisions → statusItems → distractions → systemTabs
→ engineDisplay → phases → airports):

```ts
import type { Scenario } from "@/scenarios/types";
import { MY_SCENARIO_META } from "@/scenarios/registry";

// ─── Sources ─────────────────────────────────────────────────────────────────
// FCOM PRO-ABN-<SYSTEM> P XX–XX  : <Procedure title>  [fcom:LN]
// FCTM <section>                 : <Technique note>    [fctm:LN]
// tasksharing.txt                : PF/PM assignments   [tasksharing:LN]
// callouts.txt                   : Verbatim callouts   [callouts:LN]

export const myScenario: Scenario = {
  meta: MY_SCENARIO_META,
  brief: { situation: "...", job: "..." },

  triggers: [
    // System failure events → ECAM + master lights
  ],

  steps: [
    // 1. group: "flightcheck"  —  Aviate / Navigate gates
    // 2. group: "glareshield"  —  MASTER WARN / CAUT cancel
    // 3. group: "procedure"    —  ECAM action steps (or no group)
    // 4. group: "chclm"        —  Post-ECAM coordination
    // 5. group: "comms"        —  ATC, cabin, company communications
  ],

  decisions: [ /* LAND ASAP / DIVERT / CONTINUE */ ],

  statusItems: [ /* FCOM STATUS page lines */ ],

  distractions: [ /* Timed ATC/cabin interruptions */ ],

  systemTabs: [ /* SD page tabs — if system has SD indications */ ],

  engineDisplay: { /* ENG/FIRE panel — if applicable */ },

  phases: [ /* Phase-based PFD/ND + ATC/PF/PM narrative */ ],

  airports: [ /* Pre-start airport picker — diversion scenarios only */ ],
};
```

---

## 6. Registration

### registry.ts

```ts
export const MY_SCENARIO_META: ScenarioMeta = {
  slug: "my-scenario",
  title: "MY SCENARIO TITLE",
  system: "engines",       // engines | fire | hydraulics | electrical |
                           // pressurization | flight-controls | smoke-fumes | nav | other
  phase: "cruise",         // takeoff | climb | cruise | approach | any
  status: "available",     // available | coming-soon | beta
  difficulty: 3,           // 1–5
  estimatedMinutes: 8,
  summary: "One-paragraph description shown on the scenario library card.",
  runHref: runHref("my-scenario"),
};

export const SCENARIOS: ScenarioMeta[] = [
  // ...existing
  MY_SCENARIO_META,
];
```

### index.ts

```ts
import { myScenario } from "./data/my-scenario";

export const ALL_SCENARIOS: Scenario[] = [
  // ...existing
  myScenario,
];
```

---

## 7. Validation

```bash
npx tsc --noEmit          # must pass with zero errors
npm run dev               # visit /scenarios — your card should appear
# visit /train/my-scenario — run through the full panel set
```

Panels to manually verify in the browser:
- [ ] Preflight brief screen — situation + job correct
- [ ] Airport picker (if `airports` present) — all cards render
- [ ] Countdown → scenario starts
- [ ] ECAM fires at correct time (`atMs`)
- [ ] MASTER WARN / CAUT buttons appear on glareshield
- [ ] FlightCheck popup surfaces Aviate/Navigate steps
- [ ] Procedure steps appear in correct order in ECAM action panel
- [ ] Completing a step turns its ECAM line green
- [ ] CHCLM panel shows post-ECAM coordination steps
- [ ] Comms panel shows CRM steps with `notes[]` bullets
- [ ] ATC distraction modal fires at correct time
- [ ] Decision panel shows all three options
- [ ] STATUS panel shows correct items after procedure complete
- [ ] Debrief loads without errors

---

## 8. SME review requirement

Procedure content (ECAM lines, step verbs, callouts, decision tones, STATUS
items) **must be reviewed by the named pilot SME** before the scenario is set
to `status: "available"`. Set `status: "beta"` until review is confirmed.

Items the SME checks:
- ECAM message text and ordering against FCOM
- L1 action verb accuracy (IDLE, OFF, PUSH, DISCH — no synonyms)
- FCOM L2 sub-note conditions (IF FIRE WARN AFTER 30 S)
- PF/PM tasksharing accuracy
- Callout phraseology accuracy
- LAND ASAP colour (red / amber) decision tone mapping
- STATUS page line accuracy and severity classification
- `brief.situation` flight condition accuracy
