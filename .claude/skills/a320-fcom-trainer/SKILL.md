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

---

## 11. Examples log (self-improving reference)

Every completed procedure intake is recorded here. Claude uses these to
calibrate future runs — FCOM line citations, tasksharing, callouts, and
FCTM technique notes from real work. Add a new entry each time intake is confirmed.

### [2026-05-24] ENG 1(2) FIRE — AFTER V1
- Phase: after V1 on takeoff
- Goal: PF/PM split at V1 cut; ECAM fire challenge-response; when to declare MAYDAY
- Source hierarchy: Memory items first → ECAM → FCOM PRO-ABN-ENG → FCTM
- Memory items (PF): FIRE pb — PUSH; AGENT 1 or 2 — DISCH  `[fcom:LN]`
- LAND ASAP: RED — nearest airport, MAYDAY  `[fcom:LN]`
- Key callouts: PF "FIRE" → PM "CONFIRMED, ENG 1 FIRE"  `[callouts:LN]`
- FCTM: if fire goes out after AGENT 1, hold AGENT 2 — do not discharge  `[fctm:LN]`
- File: `src/scenarios/eng1-fire-after-v1.ts`
