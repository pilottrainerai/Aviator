---
applyTo: "src/scenarios/**,src/engine/ecam/**,src/engine/reducer.ts,src/engine/state.ts,src/engine/events.ts"
---

# A320-FCOM-Trainer Skill — procedure logic from manual extracts only

Use this skill before editing scenario data, ECAM flow logic, procedure steps,
PF/PM callouts, timing gates, scoring conditions, or engine-state transitions.

**Your own Airbus knowledge is not a valid source.** Only extracted manual
text supplied by the user or available in the repo may drive procedure content.

## 0. Hard rules (non-negotiable)

1. **Nine inputs before any procedure work.** No scenario step, no ECAM line,
   no callout, no code until all nine inputs from §1 are collected.
2. **No paraphrasing FCOM verbs.** PUSH, DISCH, OFF THEN ON, CHECK, NOTIFY —
   use the exact verb from FCOM. No synonyms.
3. **No reordering FCOM steps.** The sequence in FCOM is the sequence in the
   scenario. A later FCOM step cannot appear before an earlier one.
4. **No invented procedure content.** If FCOM, FCTM, QRH, or tasksharing.txt
   do not say it, do not say it. Mark `simulation-placeholder` and ask.
5. **Source hierarchy is mandatory.** Identify which document governs each
   step (OEB → ECAM → QRH → FCOM → FCTM). Never mix sources without labelling.
6. **PF/PM tasksharing must be sourced.** Every step must state who does it
   (PF or PM) from tasksharing.txt or callouts.txt. Do not assume.
7. **Memory items are treated separately.** Their own visual style; never
   rendered as ECAM line actions. Executed BEFORE opening the ECAM.
8. **When in difficulty, stop and discuss.** Format: "I'm stuck on [X]. FCOM
   says [Y], FCTM says [Z]. Which do you want?"
9. **No code before trigger phrase** — see §7. Produce assessment only.
10. **Do not rebuild the app.** Treat the existing Aviator codebase as baseline.
11. **One system per task.** Never accept "fix all procedures" — ask which one.
12. **Scenario files stay data-first.** Do not add bespoke execution logic to
    `src/scenarios/**`. Engine logic belongs in `src/engine/**`.
13. **`src/engine/*` stays pure TypeScript with no I/O.**
14. **User overrides must be called out** explicitly as non-manual decisions.

## 1. The nine mandatory inputs

Collect ALL nine before planning or coding. Missing = stop and ask only for
the missing inputs.

```
1. PROCEDURE NAME     — Exact FCOM title verbatim.
                        Example: "ENG 1(2) FIRE — AFTER V1"
                        Example: "DUAL HYD LO PR"
                        Use the FCOM name verbatim — not a paraphrase.

2. FLIGHT PHASE       — When does this procedure occur?
                        Example: "after V1 on takeoff", "cruise FL350",
                        "approach, gear down", "on ground before TO power"
                        Determines inhibit phases and which FCOM variant
                        of the procedure governs.

3. GOAL               — What should the trainee learn from this scenario?
                        Example: "correct PF/PM split at V1 cut",
                        "ECAM challenge-response sequence for ENG FIRE",
                        "when to declare MAYDAY vs PAN PAN"

4. SOURCE HIERARCHY   — Which document(s) govern this procedure?
                          • OEB override (check QRH OEB section first)?
                          • ECAM procedure (crew follows EWD/SD lines)?
                          • QRH (paper backup — ECAM unavailable)?
                          • FCOM-only (no ECAM for this case)?
                          • Memory items first?
                        State the hierarchy and confirm before extracting.

5. FCOM EXTRACTION    — Procedure steps verbatim from FCOM.
                        Grep fcom-full.txt for the procedure title, read the
                        full section, extract every L1 action and L2 sub-note
                        in order.
                        Format per step:
                          [L1] ITEM NAME ............. ACTION  [fcom:LN]
                          [L2] sub-note text                   [fcom:LN]
                        Show the full extraction. Wait for confirmation that
                        it is complete and correct before proceeding.

6. FCTM TECHNIQUE     — Technique nuance from fctm-full.txt that supplements
                        or modifies the FCOM steps.
                        Example: "FCTM says if fire goes out after AGENT 1,
                        hold AGENT 2 — do not discharge."
                        Label each item: [fctm:section:LN]
                        Can be "none" — user must confirm.

7. PF / PM TASKSHARING — Who does each step: PF or PM?
                        Source: tasksharing.txt and callouts.txt.
                        Every FCOM step gets a PF/PM assignment.
                        If tasksharing.txt is silent on a step → flag,
                        do not assume.

8. CALLOUT PHRASEOLOGY — Exact verbatim callouts from callouts.txt for this
                         procedure phase.
                         Example: PF "FIRE" → PM "CONFIRMED, ENG 1 FIRE"
                         If callouts.txt is missing it → mark
                         simulation-placeholder and ask the user.

9. USER INPUTS / RULES — Training simplifications, corrections, constraints,
                         or known exceptions. Also: start state, completion
                         condition, scoring rules if user-specified.
                         Can be "none" — user must confirm.
```

**Checklist:**

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
→ Any unchecked: stop and ask only for missing inputs
```

## 2. Intake summary (confirm before plan)

```text
┌─ PROCEDURE INTAKE ─────────────────────────────────────────────────┐
PROCEDURE:      <exact FCOM name>
PHASE:          <flight phase>
GOAL:           <training goal>
SOURCE:         <OEB / ECAM / QRH / FCOM-only / Memory items first>
USER RULES:     <list / "none">

PROCEDURE STEPS (FCOM verbatim, with PF/PM and source):
  Step 1: [L1] <ITEM> ............ <ACTION>   PF/PM: <who>  [fcom:LN]
          [L2] <sub-note>                                    [fcom:LN]
  Step 2: ...

FCTM TECHNIQUE NOTES:
  • <note>  [fctm:section:LN]  / none

CALLOUTS (verbatim from callouts.txt):
  PF:  "<exact words>"   [callouts:LN]
  PM:  "<exact words>"   [callouts:LN]
  ... / simulation-placeholder (flagged)

MISMATCHES IN CURRENT CODE:
  • <behavior>: code=<X>, manual=<Y>  (file:line)

GAPS (no source for a required step or callout):
  • <item>: no source found → will ask before using any content

Ready to build plan? Say "go" to proceed.
└─────────────────────────────────────────────────────────────────────┘
```

GAPS or MISMATCHES present → do NOT assume. Ask the user to resolve each.

## 3. Planning rules

The plan must identify:

- In-scope files and out-of-scope files.
- Each step or transition to add, remove, or correct.
- The exact source line for every callout, condition, and completion rule.
- Whether a change belongs in scenario data (`src/scenarios/**`) or engine
  logic (`src/engine/**`).
- Any manual gap that still blocks implementation.
- Whether the change needs SME pilot review before user-visible release.

## 4. Citation tags (every line of source content)

| Tag | Meaning |
|---|---|
| `[fcom:LN]` | Verbatim from FCOM, line N |
| `[fcom:4a:LN]` | FCOM Controls & Indications section, line N |
| `[fcom:4b:LN]` | FCOM System Description section, line N |
| `[fctm:LN]` | From FCTM, line N |
| `[tasksharing:LN]` | PF/PM assignment from tasksharing.txt, line N |
| `[callouts:LN]` | Verbatim callout from callouts.txt, line N |
| `[user-input]` | Explicitly stated by the user |
| `[simulation-placeholder]` | No source — flagged, user acknowledged |

No tag = not allowed. **`inferred-from-source` is removed.** Do not infer.
No source → ask.

## 5. Code rules (after "go")

1. Preserve existing public types and scenario shapes unless the
   manual-backed change requires a schema update.
2. Keep procedure strings verbatim to the supplied extract unless the user
   explicitly requests normalization.
3. Every new literal or branch must trace to a source line or user input.
4. Do not add scoring logic, helper abstractions, or refactors outside the
   approved scope.
5. After editing, run the narrowest available validation for the touched slice.

## 6. Procedure-specific rules

### Memory items
- Visually distinct from ECAM line actions in the EWD.
- Never rendered as standard L1/L2 lines.
- Source: FCOM memory item section verbatim — no paraphrase.
- Executed BEFORE opening the ECAM.

### ECAM L1 / L2 lines
- **L1** = action line. Item name + dotted leader + right-justified action.
  Read aloud.
- **L2** = sub-note. Italic/muted. Condition, result, explanation.
  Never read aloud.

### PF/PM split
- Source: `tasksharing.txt` for each step.
- If silent: check `callouts.txt` for implicit assignment.
- If still unclear: flag — do not guess.
- PF flies, PM works the ECAM. Never reverse unless FCOM says so.

### Callouts
- Use `callouts.txt` verbatim for all PF/PM spoken text.
- Do not rephrase. "FIRE" is not "Engine fire detected."

### LAND ASAP
- **Red** = nearest airport, MAYDAY.
- **Amber** = nearest suitable, PAN PAN.
- Color must match FCOM STATUS section for this procedure exactly.

### Conditional branches
- "IF UNSUCCESSFUL" or "IF STILL APPLICABLE" → nested group with condition
  as a header.
- Never flatten a conditional branch into a linear step.

### Action verbs (exact — do not paraphrase)

| Verb | Meaning |
|---|---|
| OFF / ON / OFF THEN ON | Switch positions |
| PUSH | Press a guarded latching pb (releases it) |
| PRESS | Press a momentary pb |
| SET | Configure to specified value |
| CHECK | Verify; do not change |
| DISCH | Discharge fire agent |
| CRANK | Mode selector to CRANK position |
| AS RQRD | Configure as appropriate |
| NOTIFY | Inform (typically ATC) |
| MAN | Manual mode |
| MAINTAIN | Hold current value |

## 7. Trigger phrases (the only way to authorize changes)

- **"go"** — approve the intake summary or plan, proceed.
- **"done"** — procedure or module is complete.
- **"Apply this fix"** — surgical change for one specific divergence.
- **"Rebuild this module"** — full rewrite of one named module, restarts intake.
- **"Proceed with implementation"** — execute the most recent assessment's
  recommendation.
- **"Match the FCOM spec"** — apply all fcom-sourced divergences in the
  current assessment.
- **"new spec"** — abandon current work, restart intake from scratch.

Any request to change code WITHOUT one of these → return the intake checklist
and ask which inputs are missing, or the assessment if intake was completed.

## 8. Result format

```text
┌─ THE RESULT ───────────────────────────────────────────────────────┐
FILES CHANGED:    <list>
VALIDATION:       <command / result>

TRACEABILITY:
  • <code path> -> <manual file>, line <N>

SME REVIEW:       required / not required
VERDICT:          DONE / one fix needed / needs more source text
└─────────────────────────────────────────────────────────────────────┘
```

## 9. Anti-patterns

- ❌ Starting any procedure work without all nine inputs.
- ❌ Paraphrasing FCOM action verbs.
- ❌ Reordering FCOM steps for "clarity".
- ❌ Assigning PF/PM from guessing.
- ❌ Inventing callout text.
- ❌ Mixing ECAM and FCOM steps without labelling.
- ❌ Rendering memory items as ECAM L1 lines.
- ❌ Hardcoding LAND ASAP color — derive from FCOM STATUS.
- ❌ Treating L2 lines as actions.
- ❌ Modeling MASTER WARN press as "clearing the warning" — it only silences.
- ❌ Putting MEMO items in the ECAM warning list.
- ❌ Adding bespoke execution logic to `src/scenarios/**`.
- ❌ Asking the user to re-state §0 hard rules — always in effect.
