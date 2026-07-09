---
name: a320-fcom-trainer
description: Project-aware brain for the Aviator A320 pilot-training simulator. Use BEFORE editing or extending any cockpit, scenario, ECAM, EWD, engine, hydraulic, electrical, fire, fuel, bleed, APU, or other system module — the skill enforces a manual-first, READ-ONLY workflow with a mandatory nine-input intake for abnormal/emergency procedures. All procedure steps, callouts, PF/PM tasksharing, and ECAM logic must be extracted from source manuals. Claude does not paraphrase, invent, or reorder FCOM procedure steps. When in difficulty, Claude stops and discusses with the developer before proceeding.
---

# A320 FCOM Trainer Skill

You are working on **Aviator** — a precision A320 abnormal-procedure training tool.
Procedure text, callouts, ECAM logic, PF/PM tasksharing, and cockpit behaviour
must match Airbus source documents exactly.

**Claude's own knowledge of "how A320 procedures work" is NOT a valid source.
Only what is extracted from the manuals in this session counts.**

---

## 0. Hard rules (non-negotiable)

1. **Nine inputs before any procedure work.** No scenario step, no ECAM line,
   no callout, no code until all nine inputs from §1 are collected.
2. **No paraphrasing FCOM verbs.** PUSH, DISCH, OFF THEN ON, CHECK, NOTIFY —
   use the exact verb from FCOM. Do not substitute synonyms.
3. **No reordering FCOM steps.** The sequence in FCOM is the sequence in the
   scenario. A later FCOM step cannot appear before an earlier one.
4. **No invented procedure content.** If FCOM, FCTM, QRH, or tasksharing.txt
   do not say it, Claude does not say it. Mark it `simulation-placeholder`
   and ask the user.
5. **Source hierarchy is mandatory.** Claude identifies which document governs
   each step (ECAM → QRH → FCOM → FCTM). Never mix sources without labelling.
6. **PF/PM tasksharing must be sourced.** Every step must state who does it
   (PF or PM) from tasksharing.txt or callouts.txt. Do not assume.
7. **Memory items are treated separately.** They have their own visual style
   and are never rendered as ECAM line actions.
8. **When in difficulty, stop and discuss.** If Claude is uncertain about any
   step, verb, source, or sequence — it stops and says:
   "I'm stuck on [X]. FCOM says [Y], FCTM says [Z]. Which do you want?"
9. **No code before trigger phrase.** Produce assessment only. Wait for §7.
10. **Do not rebuild the app.** Treat the existing Aviator codebase as baseline.
11. **One system per task.** Never accept "fix all procedures" — ask which one.

---

## 1. The nine mandatory inputs (abnormal/emergency procedure)

Before any procedure step, scenario line, ECAM line, or code is produced,
Claude must have ALL of the following. Missing = stop and ask.

```
1. PROCEDURE NAME     — The exact FCOM title of the procedure.
                        Example: "ENG 1(2) FIRE — AFTER V1"
                        Example: "ENG 1(2) FAILURE — AFTER V1"
                        Use the FCOM name verbatim — not a paraphrase.

2. FLIGHT PHASE       — When does this procedure occur?
                        Example: "after V1 on takeoff", "cruise FL350",
                        "approach, gear down", "on ground before TO power"
                        This determines which inhibit phases apply and
                        which FCOM variant of the procedure governs.

3. GOAL               — What should the trainee learn from this scenario?
                        Example: "correct PF/PM split at V1 cut",
                        "ECAM challenge-response sequence for ENG FIRE",
                        "when to declare MAYDAY vs PAN PAN"

4. SOURCE HIERARCHY   — Which document(s) govern this procedure?
                        Claude identifies from the procedure name:
                          • ECAM procedure (crew follows EWD/SD lines)?
                          • QRH (paper backup — used if ECAM unavailable)?
                          • FCOM-only (no ECAM for this case)?
                          • Memory items first?
                        Claude states the hierarchy and confirms with user
                        before extracting any steps.

5. FCOM EXTRACTION    — The procedure steps verbatim from FCOM.
                        Claude greps fcom-full.txt for the procedure title,
                        reads the full section, and extracts every L1 action
                        line and L2 sub-note in order.
                        Format per step:
                          [L1] ITEM NAME ............. ACTION  [FCOM line N]
                          [L2] sub-note text               [FCOM line N]
                        Claude shows the full extraction and waits for user
                        to confirm it is complete and correct before proceeding.

6. FCTM TECHNIQUE     — Any technique nuance from fctm-full.txt that
                        supplements or modifies the FCOM steps.
                        Example: "FCTM says if fire goes out after AGENT 1,
                        do not discharge AGENT 2 — hold it."
                        Can be "none" — user must confirm.
                        Label each item: [FCTM section, line N]

7. PF / PM TASKSHARING — Who does each step: PF or PM?
                        Source: tasksharing.txt and callouts.txt.
                        Claude extracts the relevant tasksharing table for
                        this procedure and phase.
                        Every FCOM step gets a PF/PM assignment.
                        If tasksharing.txt is silent on a step → flag it,
                        do not assume.

8. CALLOUT PHRASEOLOGY — Exact verbatim callouts from callouts.txt for
                        this procedure phase.
                        Example: PF calls "FIRE" — PM responds "CONFIRMED,
                        ENG 1 FIRE" — exact words from callouts.txt.
                        If callouts.txt does not have it → mark
                        simulation-placeholder and ask user.

9. USER INPUTS / RULES — Training simplifications, corrections, or
                        constraints the user states.
                        Examples: "skip the fuel dumping step — not relevant
                        to this training goal", "always show MAYDAY step",
                        "do not simplify the memory items".
                        Also any rules: "do not change the existing ECAM
                        lines — only add missing ones."
                        Can be "none" — user must confirm.
```

**Checklist before proceeding:**

```
[ ] PROCEDURE NAME received and confirmed
[ ] FLIGHT PHASE received
[ ] GOAL received
[ ] SOURCE HIERARCHY identified and confirmed
[ ] FCOM EXTRACTION complete — user confirmed all steps
[ ] FCTM TECHNIQUE extracted — or user confirmed "none"
[ ] PF/PM TASKSHARING extracted for every step
[ ] CALLOUT PHRASEOLOGY extracted — or simulation-placeholder flagged
[ ] USER INPUTS / RULES received — or user confirmed "none"
→ All nine checked: proceed to §2 intake summary
→ Any unchecked: stop and ask
```

---

## 2. Intake summary (confirm before plan)

```
┌─ PROCEDURE INTAKE ─────────────────────────────────────────────────┐
PROCEDURE:      <exact FCOM name>
PHASE:          <flight phase>
GOAL:           <training goal>
SOURCE:         <ECAM / QRH / FCOM-only / Memory items first>
USER RULES:     <list / "none">

PROCEDURE STEPS (FCOM verbatim, with PF/PM and source):
  Step 1: [L1] <ITEM> ............ <ACTION>   PF/PM: <who>  [FCOM line N]
          [L2] <sub-note>                                    [FCOM line N]
  Step 2: ...

FCTM TECHNIQUE NOTES:
  • <note>  [FCTM section, line N]
  • ... / none

CALLOUTS (verbatim from callouts.txt):
  PF:  "<exact words>"   [callouts.txt line N]
  PM:  "<exact words>"   [callouts.txt line N]
  ... / simulation-placeholder (flagged)

GAPS (no source for a required step or callout):
  • <item>: no source found → will ask before using any content

Ready to build plan? Say "go" to proceed.
└─────────────────────────────────────────────────────────────────────┘
```

**GAPS present → do NOT assume. Ask the user to resolve each one.**

---

## 3. Source library

All at `~/.claude/manuals/a320/`:

| File | When to use |
|---|---|
| `fcom-full.txt` | Primary — all system descriptions, normal and abnormal procedures, controls & indications |
| `fctm-full.txt` | Technique nuances — when/why, crew coordination philosophy, normal and abnormal technique |
| `tasksharing.txt` | CM1/CM2 split for all procedures — who does each step |
| `callouts.txt` | **Verbatim PF/PM callouts** for abnormal/emergency procedures — use for all callout text |
| `abnormal-procs.txt` | Abnormal procedure tasksharing tables, LAND ASAP semantics |
| `abnormal-notes.txt` | Gap analysis — what ECAM vs QRH vs FCOM each say differently |
| `eng-malfunctions.txt` | Engine identification, indications, recommendations |

**ATC phraseology:** No separate ATC file. Grep `fcom-full.txt` for MAYDAY, PAN PAN, and radio calls. Relevant section: `PRO-ABN-ABN-00` and `PRO-NOR-SOP`.

**Grep recipe:**
```bash
grep -nE "ENG 1.2. FIRE|ENG FIRE" ~/.claude/manuals/a320/fcom-full.txt | head
sed -n '<start>,<end>p' ~/.claude/manuals/a320/fcom-full.txt
grep -nE "<term>" ~/.claude/manuals/a320/fctm-full.txt | head
grep -nE "<term>" ~/.claude/manuals/a320/tasksharing.txt | head
grep -nE "<term>" ~/.claude/manuals/a320/callouts.txt | head
```

---

## 4. Documentation hierarchy

Apply in this order. Never skip a level without stating why.

1. **OEB** — overrides ECAM if active. Check QRH OEB section first.
2. **ECAM** — if displayed, follow it. Crew reads EWD/SD lines.
3. **QRH** — paper backup. Used for resets, supplementaries, or ECAM-unavailable.
4. **FCOM** — authoritative background; procedures not in ECAM/QRH.
5. **FCTM** — technique nuances neither ECAM nor FCOM contain.

When writing scenario steps, cite source: `[FCOM PRO-ABN-ENG]` or `[FCTM AS-FG-10-1]`.

---

## 5. Citation tags and classification labels

### Step citation tags (every procedure step, callout, and technique note)

Every step must carry a citation tag — no tag = not allowed. If Claude
cannot find a source, it stops and asks.

| Tag | Meaning |
|---|---|
| `[fcom:LN]` | Verbatim from FCOM, line N |
| `[fcom:4a:LN]` | From FCOM Controls & Indications section, line N |
| `[fcom:4b:LN]` | From FCOM System Description section, line N |
| `[fctm:LN]` | From FCTM, line N |
| `[tasksharing:LN]` | PF/PM assignment from tasksharing.txt, line N |
| `[callouts:LN]` | Verbatim callout text from callouts.txt, line N |
| `[user-input]` | Explicitly stated by the user |
| `[simulation-placeholder]` | No source — flagged, user acknowledged |

### Assessment classification labels (code divergence reports only)

| Label | Meaning |
|---|---|
| `existing-implementation` | What the Aviator code currently does — neutral observation |
| `simulation-placeholder` | Stand-in where source is missing — always flagged |
| `improvement-suggestion` | Proposed change — does NOT execute until §7 trigger |

**`inferred-from-source` is removed.** Claude does not infer. If there is no
source, it asks — no exceptions.

---

## 6. Workflow — every procedure task

1. **Collect all nine inputs** (§1). Do not skip any.
2. **Show intake summary** (§2). Wait for user confirmation.
3. **Understand existing Aviator module.** Read `references/project-understanding-protocol.md`. Read the actual scenario file.
4. **Compare FCOM extraction vs current implementation.** Use `references/fcom-comparison-rubric.md`. Note every divergence.
5. **Classify each divergence** per §5.
6. **Produce assessment** in §6a format. Do not modify code.
7. **Wait for trigger phrase** (§7).

---

## 6a. Standard assessment format

```
Procedure:
FCOM source / lines:
Existing implementation (file:line):
Alignment score:
Divergences:
  | # | Step / property | FCOM says | Code does | Label | Severity |
PF/PM split accuracy:
Callout accuracy:
FCTM technique gaps:
Risk of changing now:
Recommended fix:
Files to edit:
Do not modify yet:
```

**Severity:** `critical` (wrong procedure action) → `high` (wrong verb/color) → `medium` (wrong sequence/timing) → `low` (cosmetic/wording).

---

## 7. Trigger phrases

- **"go"** — approve the intake summary or plan, proceed to next stage.
- **"done"** — procedure or module is complete.
- **"Apply this fix"** — surgical change for one specific divergence.
- **"Rebuild this module"** — full rewrite of one named module, restarts from intake.
- **"Proceed with implementation"** — execute the most recent assessment's recommendation.
- **"new spec"** — abandon current work, restart intake from scratch.

Any request to change code WITHOUT one of these → return an assessment, list the triggers, ask which applies.

---

## 8. Procedure-specific rules

### Memory items
- Must be visually distinct from ECAM line actions in the EWD.
- Never rendered as standard L1/L2 lines.
- Source: FCOM memory item section verbatim — no paraphrase.
- Must be executed BEFORE opening the ECAM.

### ECAM L1 / L2 lines
- **L1** = action line. Item name + dotted leader + right-justified action. Read aloud.
- **L2** = sub-note. Italic/muted. Condition, result, explanation. Never read aloud.
- See `references/ecam-logic-mapping.md` for full rendering rules.

### PF/PM split
- Source: `tasksharing.txt` for each step.
- If tasksharing.txt is silent: check `callouts.txt` for implicit assignment.
- If still unclear: flag it — do not guess.
- PF flies, PM works the ECAM. Never reverse unless FCOM/tasksharing says so.

### Callouts
- Use `callouts.txt` verbatim for all PF/PM spoken text.
- Do not rephrase. "FIRE" is not "Engine fire detected."
- If callouts.txt does not have it → `simulation-placeholder`, ask user.
- **Standard ECAM read → clear callout** (vault `library/a320-ecam-philosophy.md`; also
  `a320-sop.md`, `raw/aviation-fcom/A320-Tasksharing-2020.pdf`): MASTER WARN/CAUT RESET →
  PM **ANNOUNCE "TITLE OF FAILURE"** (read the alert + its limitation lines) → ECAM ACTIONS →
  then CLEAR top-down: PM **REQUEST "CLEAR <name of SYS>?"** → PF **"CLEAR"** → PM presses CLR.
  The clear names the **SYSTEM PREFIX ONLY** (the underlined system on the E/WD: AUTO FLT / HYD /
  F/CTL / ENG …), NOT the full alert title and NOT the limitations. The announce reads the full
  title + limitations; the clear is terse. Examples (DUAL HYD G+Y):
  · `AUTO FLT AP OFF` → announce full, clear **"CLEAR AUTO FLT?"**
  · `HYD G+Y SYS LO PR` → announce full, clear **"CLEAR HYD?"** (same for `HYD PTU FAULT` → "CLEAR HYD?")
  · `F/CTL ALTN LAW (PROT LOST) · MANEUVER WITH CARE` → announce full, clear **"CLEAR F/CTL?"**
  Each clear is 3-part: PM "CLEAR ‹SYS›?" → PF "CLEAR" → PM presses CLR; the alert then transfers to
  STATUS. NEVER "CLEAR HYD G+Y SYS LO PR?" or re-read limitations in the clear. [user 2026-07-07, vault-sourced]

### LAND ASAP
- **Red** = nearest airport, MAYDAY.
- **Amber** = nearest suitable, PAN PAN.
- Color must match FCOM STATUS section for this procedure exactly.

### ATC phraseology
- Source: `icao-phraseology.txt` for all crew radio calls and ATC responses.
- MAYDAY format, PAN PAN format, read-back rules — all from ICAO doc.
- Do not invent ATC dialogue.

### Conditional branches
- If FCOM has an "IF UNSUCCESSFUL" or "IF STILL APPLICABLE" branch:
  render it as a nested group with the condition as a header.
- Never flatten a conditional branch into a linear step.

---

## 8a. Scenario-engine authoring (steps, triggers, gating)

Scenarios are **data** (`src/scenarios/data/<slug>.ts`), not code. The engine runs
them off three coupled things — understand the coupling before changing any sequence:

- **`triggers`** — fire effects (ECAM lines, MASTER WARN, secondary failures) at a
  time or after a step. A step's `afterEffect` can fire a trigger (e.g. Y ELEC PUMP
  ON → +3 s → secondary failures appear on the SD/EWD).
- **`steps[].requires: [id…]`** — a step unlocks only when ALL listed ids are in
  `completedSteps`. This is the procedure spine — *what comes after what*.
- **ATC cards (`distractions[]`)** gate on a step via `requiresStep`, and can
  complete a step via `completesStep`. This is how comms couple to the spine — see
  `atc-comms` §0b (comms is a phase-gated *fallout* of the procedure milestone
  before it). The engine records a step in `completedSteps` ONLY via a real step
  action or a card's `completesStep` — ATC card ids are not auto-recorded. To hold
  a step until a whole ATC chain finishes, add a hidden `optional` gate step that
  the LAST ATC card completes, then `requires` it (e.g. `ldg_clearance_done`).

**Authoring rules (confirmed [user-input 2026-06-23], DUAL HYD G+Y):**
1. **Preserve gating ids.** Some ids are referenced OUTSIDE the scenario — e.g. the
   PFD `buildAircraftState()` gates its "On ILS" state on `approach_brief_hyd`.
   `grep -rn "<id>" src/` BEFORE renaming; rename only with every ref updated.
2. **Phase-split overloaded cards.** One giant brief → phase cards mirroring the
   FCTM/QRH structure (THE APPROACH / THE LANDING / THE GO-AROUND), chained via
   `requires`. One card = one phase.
3. **Fold review onto the page-check.** A card that only re-reads what the SD already
   shows belongs ON the SD page-check, not as a standalone "READ" card (FLIGHT
   CONTROL PAGE CHECK carries `*F/CTL`; WHEEL PAGE CHECK carries `*WHEEL`).
4. **Flag non-FCOM airmanship inline.** Technique not verbatim in FCOM gets a
   `DRAFT (SME review): …` note; the scenario stays `status: DRAFT`.
5. **Sequence IS the procedure.** Re-wire `requires` when inserting/removing a card
   so the chain stays unbroken; after editing run `npx tsc --noEmit` and grep the
   removed id to confirm no dangling `requires`.
6. **Card presentation → `training-card-ui` skill.** A step that does NOT require a
   physical left-panel (action-panel) input — every ECAM read / clear / announce /
   callout / CONFIRM card (i.e. NOT `hardware: true`) — is rendered by
   `flight-check-popup.tsx` and MUST carry the card-design metadata: **`category`**
   (ECAM / QRH / PROCEDURE / CHECKLIST / AVIATE / COMMS / CRM), **`reference`**
   (FCOM / FCTM / QRH / TECHNIQUE, manual-first — solid = manual, TECHNIQUE = airmanship),
   and **`crew` = the DOER** (rendered green; the monitor is derived grey). The `CONFIRM`
   verb is auto-hidden on the directive (the confirm button carries it). **Hardware steps
   (`hardware: true`)** stay on the left-panel action card and need no design metadata.
   So: when connecting ECAM logic to the cards, tag every non-hardware card per the
   `training-card-ui` skill — same colours/roles/references across every scenario & type.

**Sync discipline (after any localhost `.ts` change):** localhost `.ts` FIRST →
regenerate the data-driven workbook arrays (`steps`, `atcCalls`) from the `.ts` and
`node --check` → mirror the canonical vault `scenarios/<slug>/*.md` §5 +
`change-log.md`. Restart the run (steps load at run start) or the dev server (stale
HMR) to see step changes.

---

## 8b. Procedure conduct logic — the abnormal "spine" (FCTM-sourced)

Every abnormal/emergency is conducted on the same FCTM spine. Author a scenario's
STEP ORDER to follow it; do not invent a different order.

### Golden Rules order (AOP-40)
**FLY → NAVIGATE → COMMUNICATE**, in this order, with tasksharing [`fctm:AOP-40 §1`].
- **FLY** (PF) — recover/maintain a steady flight path; PM monitors + calls deviations.
- **NAVIGATE** (PF) — "know where you are / should be / should go / where the weather,
  terrain and obstacles are" [`fctm:AOP-40 P2`]; set divert routing.
- **COMMUNICATE** — "the PF must recover a steady flight path, and the flight crew must
  identify the flight situation. The PF must then inform ATC and the cabin crew of the
  flight situation and the flight crew's intentions" [`fctm:AOP-40 P2`].

### When does ATC come — before or after ECAM? (the decision)
- **Immediate / memory actions FIRST.** "in some time critical situations… apply by
  memory, items referred to as MEMORY ITEMS or OEB immediate actions" [`fctm:AOP-30-30,
  L2660`]. If the failure has memory items or an immediate securing action (e.g. ENG
  FIRE → secure the engine), do those first.
- **Then communicate.** ECAM actions run "once the aircraft trajectory is stabilized and
  the PF announced 'ECAM actions'" [`fctm:AOP-30-30-A, L2699`]. With no memory items and
  the aircraft under control (e.g. DUAL HYD G+Y), the crew identifies + COMMUNICATES
  (declare to ATC + intentions) once stabilized, then orders ECAM ACTIONS.
- **Net spine:** AVIATE → NAVIGATE → (memory items, if any) → COMMUNICATE (declare) →
  ECAM ACTIONS → STATUS → (at the appropriate phase) approach prep → briefing.

### ECAM handling sequence (AOP-30-30)
1. First pilot notices → **MASTER WARN/CAUT RESET** [`fctm:L2729`].
2. PM: **"<title of failure>" ANNOUNCE** → **ECAM CONFIRM** (check OHP/SD before any
   action) [`fctm:L2731`].
3. PF: **OEB CONSIDER** → **"ECAM ACTIONS" ORDER** [`fctm:L2731`].
4. PM: **ECAM/OEB ACTIONS PERFORM** → **"CLEAR (system)?" REQUEST**; PF **CHECK** +
   **CONFIRM**; PM presses **CLR** only after all actions checked [`fctm:L2747`].
5. PF **ANALYZE** each SD page → CLEAR [`fctm:L2756`].
6. STATUS appears → PM **"STATUS" ANNOUNCE** → PF **"STOP ECAM" ORDER** [`fctm:L2761`].
7. PF considers normal C/L, resets, additional procedures → **"CONTINUE ECAM"** → PM
   **STATUS READ**; STATUS-associated procedures are "performed at the appropriate flight
   phase" [`fctm:L2768`] — i.e. approach prep + briefing.

### Worked map — DUAL HYD G+Y onto the spine
| FCTM spine | G+Y step id |
|---|---|
| MASTER WARN RESET | `cancel_master_warn` |
| FLY | `maintain_control` |
| NAVIGATE | `request_routing` |
| COMMUNICATE (no memory items → declare now) | `declare_mayday` |
| "ECAM ACTIONS" ORDER | `ecam_actions` |
| PM performs ECAM | `ptu_off → grn_eng1_pump_off → yel_eng2_pump_off → yel_elec_pump_on` |
| SD analyse (secondary) | `fctl_check / wheel_check` |
| STATUS announce / STOP ECAM | `announce_status / stop_ecam` |
| STATUS read | `read_status / status_read_aloud / inop_sys_card` |
| ECAM ACTIONS COMPLETED | `crew_crosscheck` |
| at appropriate phase: approach prep + briefing | `approach_prep_hyd / approach_brief_hyd (+landing +ga)` |

**Authoring rule:** lay every new abnormal's step order on this spine first; cite FCTM;
flag any deviation. The comms fallout from each milestone is governed by `atc-comms §0b`;
the PFD/FMA indications by `pfd-fma-logic`.

---

## 9. Reference files

All in `references/` next to this `SKILL.md`:

| File | Use when |
|---|---|
| `project-understanding-protocol.md` | Before touching any Aviator module |
| `manual-reading-protocol.md` | Navigating FCOM section codes; grep recipes |
| `manual-extraction-template.md` | Capturing source-derived logic in structured form |
| `fcom-comparison-rubric.md` | Scoring code-vs-manual alignment |
| `cockpit-control-mapping.md` | Push-button types, light states, color semantics |
| `ecam-logic-mapping.md` | ECAM tree mechanics, L1/L2, STATUS, LAND ASAP, INOP SYS |
| `improvement-assessment-template.md` | Filled-in assessment examples |
| `no-change-until-commanded.md` | Discipline rules — what NOT to do |

---

## 10. Anti-patterns

- ❌ Starting any procedure work without all nine inputs.
- ❌ Paraphrasing FCOM action verbs — use PUSH, DISCH, OFF THEN ON exactly.
- ❌ Reordering FCOM steps for "clarity" — order is procedurally critical.
- ❌ Assigning PF/PM from guessing — always source from tasksharing.txt.
- ❌ Inventing callout text — always source from callouts.txt.
- ❌ Mixing ECAM and FCOM steps without labelling which is which.
- ❌ Rendering memory items as ECAM L1 lines.
- ❌ Hardcoding LAND ASAP color — derive from FCOM STATUS for this procedure.
- ❌ Inventing ATC dialogue — source from fcom-full.txt section PRO-ABN-ABN-00.
- ❌ Treating "inferred-from-source" as a valid standalone tag — always flag and confirm.
- ❌ Accepting "fix all procedures" — ask which one, do one at a time.
- ❌ Making a decision when stuck — always stop and discuss with the developer.
- ❌ Asking the user to re-state §0 hard rules — they are always in effect.
- ❌ Renaming a step id without `grep -rn`-ing `src/` for external refs (PFD/runner gating).
- ❌ Time-gating an ATC call that depends on a crew action — gate on the step (§8a).
- ❌ Leaving a standalone "READ" card for what the SD page-check already shows (§8a rule 3).
- ❌ Editing the live `.ts` without mirroring the workbook arrays + vault §5 (§8a sync).

---

## 11. Examples log (self-improving reference)

Every completed procedure intake is recorded here. Claude uses these to
calibrate future runs — FCOM line citations, tasksharing, callouts, and
FCTM technique notes from real work. Add a new entry each time intake is confirmed.

### [2026-05-24] ENG 1(2) FIRE — AFTER V1  (REVISED 2026-05-27)
- Phase: after V1 on takeoff
- Goal: PF/PM split at V1 cut; ECAM fire challenge-response; when to declare MAYDAY
- Source hierarchy: ECAM (Box 1) → FCOM PRO-ABN-ENG p.39-40 → FCTM
  - NOT "Memory items first" — ENG 1(2) FIRE has NO memory items. Memory
    items in A320 are reserved for cabin-altitude / smoke / stall warning.
    ENG FIRE starts directly with ECAM actions.  `[callouts §QRH MEMORY ITEMS]`
- ECAM actions (verbatim from PRO-ABN-ENG p.40):
  1. THR LEVER (AFFECTED) … IDLE     `[fcom:L94614]`
  2. ENG MASTER (AFFECTED) … OFF     `[fcom:L94615]`
  3. ENG FIRE P/B (AFFECTED) … PUSH  `[fcom:L94619]`
  4. AGENT 1 AFTER 10 S … DISCH      `[fcom:L94625]`
  5. ATC … NOTIFY                    `[fcom:L94632]`
  6. IF FIRE AFTER 30 S: AGENT 2 … DISCH  `[fcom:L94640]`
- LAND ASAP: RED — nearest airport, MAYDAY  `[fcom:L94604 / abnormal-procs:L229]`
- Key callouts:
  - PM identifies fire: `"Engine Fire"` — DO NOT identify which engine
    yet `[callouts:L617-618 "For engine problem: do NOT identify which
    engine yet"]`. Engine number is added only after ECAM confirmation.
  - Confirm items (PF verbal confirmation required for PM action): THR
    LEVER, ENG MASTER, ENG FIRE PB, AGENT  `[callouts:L688-708]`
- FCTM: if fire is extinguished after AGENT 1, ENG 1(2) FIRE warning
  disappears and procedure no longer applies — hold AGENT 2  `[fctm:L2823-24]`
- Parallel-procedure rule: after THR IDLE + MASTER OFF, engine is also
  inoperative — engine failure technique runs in parallel with fire ECAM
  `[abnormal-procs:L541-543]`. 12.5° rotation pitch / rudder trim / beta
  target are engine-FAILURE techniques and apply only AFTER master OFF,
  not during initial rotation with fire warning only.
- FMA final takeoff segment: at green dot speed, LVR MCT flashes amber
  on FMA; PF moves thrust levers to MCT detent (recycle CL→MCT if already
  at FLX/MCT); PF pulls ALT knob → OPEN CLB engages. FMA: THR MCT / OP CLB.
  `[fctm:L12879-12882]`
- File: `src/scenarios/data/eng1-fire-after-v1.ts`
- 2026-05-27 REVISION: prior entry had PM callout as `"CONFIRMED, ENG 1
  FIRE"` — that contradicts callouts.txt L617-618. Pilot review flagged
  the error; corrected in this revision. Also fleshed out FMA cycle,
  parallel-procedure rule, and the memory-items vs ECAM-first distinction.

### [2026-06-07] ATC comms colour rule — ENG 1 FIRE after V1 (VIDP departure)

**HARD RULE — applies to every ATC distraction in the scenario:**
- `kind: "crew"` → **blue** — PM or PF initiates the call
- `kind: "atc"`  → **green** — ATC (Tower / Departure / Approach) calls the crew

**Full MAYDAY comms sequence after ENGINE SECURED (Tower 118.10 → DEP 124.85):**

| # | Who initiates | kind | Colour | Content |
|---|---|---|---|---|
| ①b | PM → Tower 118.10 | `"crew"` | blue | `MAYDAY MAYDAY MAYDAY, IFLY101, engine fire engine one, heading 280, climbing [ALT] feet, STANDBY` |
| ② | Tower → PM | `"atc"` | green | `IFLY101, MAYDAY acknowledged. Contact Delhi Departure 124.85. Emergency services alerted.` |
| PM readback | PM → Tower | `"crew"` | blue | `MAYDAY acknowledged, Departure 124.85, IFLY101` → then selects 124.85 |
| ③ | PM → Departure 124.85 | `"crew"` | blue | `IFLY101, heading 280, climbing [ALT], STANDBY` — position report ONLY, no second MAYDAY |
| ④ | Departure → PM | `"atc"` | green | `IFLY101, MAYDAY acknowledged, radar contact, continue runway track, climb 4 000 feet, QNH 1013.` |

**Key rules:**
- Freq change (Tower → Departure) happens ONLY after Tower tells PM to change (`kind: "atc"`, green).
- PM's first call on Departure is heading + climbing alt + STANDBY only — no second MAYDAY.
- MAYDAY × 3 is called on Tower (current freq); NOT repeated on Departure.
- Scenario IDs: `mayday_tower_declare` (crew, blue) → `atc_tower_mayday_ack` (atc, green) → `pm_dep_initial_call` (crew, blue) → `atc_vectors_climb` (atc, green).
- If a distraction is initiated by PM/PF it is ALWAYS `kind: "crew"`. Never mark a PM-initiated call as `kind: "atc"`.
- File: `src/scenarios/data/eng1-fire-after-v1.ts` · distractions block.

### [2026-06-23] DUAL HYD G+Y SYS LO PR — scenario-engine authoring (live-tuned)
First worked application of §8a. Procedure refined card-by-card on localhost, then
mirrored to workbook + vault.
- **Phase-split brief.** One APPROACH BRIEF → three cards (1/3 THE APPROACH · 2/3 THE
  LANDING · 3/3 THE GO-AROUND), chained via `requires`, mirroring the FCTM/QRH phases.
  Kept the id `approach_brief_hyd` on card 1/3 because the **PFD gates "On ILS" on it**.
- **Fold review onto page-checks.** Removed standalone `fctl_card` / `wheel_card`
  ("SECONDARY — READ") → `*F/CTL` now lives on **FLIGHT CONTROL PAGE CHECK**, `*WHEEL`
  on a new **WHEEL PAGE CHECK**; re-wired `cancel_master_caut.requires`.
- **Last-call gate.** REQUEST TAXI made the final step via hidden `optional`
  `ldg_clearance_done` (`completesStep` on the cleared-to-land ATC card).
- **DRAFT/SME items added inline:** long final, platform ~2500 ft AAL, tail-strike /
  high-nose, pitch/power couple — all `DRAFT (SME review)`, scenario `status: DRAFT`.
- **Removed** the standalone early GO-AROUND REVIEW (go-around now briefed in 3/3);
  re-wired `atc_emergency_svcs.requires` → `inform_company`. LANDING CL no longer
  fixes "1000 ft".
- **Verify done:** `npx tsc --noEmit` clean; grep confirmed no dangling `requires`;
  workbook `node --check` clean; vault §5 + change-log synced.
- File: `src/scenarios/data/dual-hyd-g-y.ts`

### [2026-06-24] Procedure conduct logic — §8b added [user-input]
Captured the FCTM "spine" for how every abnormal is conducted (skill §8b; no scenario
change). Sourced, not invented:
- **Golden Rules AOP-40** [`fctm:AOP-40`]: FLY → NAVIGATE → COMMUNICATE in order; the
  PF recovers a steady path, the crew identifies the situation, then the PF informs ATC +
  cabin of situation + intentions.
- **ATC-timing decision** [`fctm:AOP-30-30 L2660 / AOP-30-30-A L2699`]: memory items / OEB
  immediate actions FIRST (e.g. ENG FIRE secures the engine); with none and the aircraft
  under control (DUAL HYD G+Y) the crew declares THEN orders ECAM ACTIONS.
- **ECAM handling AOP-30-30** [`fctm:L2729–2768`]: MASTER WARN RESET → "title" ANNOUNCE +
  ECAM CONFIRM → "ECAM ACTIONS" ORDER → PERFORM/CLEAR → SD ANALYZE → "STATUS"/"STOP ECAM"
  → STATUS READ (associated procedures done at the appropriate flight phase = approach
  prep + briefing).
- Mapped onto the live G+Y step ids (cancel_master_warn … crew_crosscheck … approach
  briefs). Authoring rule: lay every new abnormal's step order on this spine first.
- File: `.claude/skills/a320-fcom-trainer/SKILL.md` §8b.
