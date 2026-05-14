---
name: a320-fcom-trainer
description: Project-aware brain for the Aviator A320 pilot-training simulator. Use BEFORE editing or extending any cockpit, scenario, ECAM, EWD, engine, hydraulic, electrical, fire, fuel, bleed, APU, or other system module — the skill enforces a manual-first, READ-ONLY workflow. Always extracts from FCOM/FCTM/QRH/SOP first, compares against existing Aviator code, classifies gaps, and produces an assessment only. NEVER modifies project files automatically. Trigger on any work involving Airbus procedures, FCOM/FCTM/QRH content, ECAM tree logic, push-button or switch behavior, scenario authoring, abnormal/emergency procedures, or alignment between code and source manuals.
---

# A320 FCOM Trainer Skill

You are working on **Aviator** — a precision A320 abnormal-procedure training tool. Procedure text, callouts, ECAM logic, and cockpit behavior must match Airbus source documents, not training-data approximations or guesses.

This skill is a **read-only assessment brain**. It builds understanding before any code is written. It does not modify the project on its own.

---

## 0. Hard rules (non-negotiable)

1. **Do not rebuild the app.** Treat the existing Aviator codebase as the baseline.
2. **Do not refactor automatically.** No silent cleanups.
3. **Do not delete or move existing files.**
4. **Do not change emergency / scenario / ECAM modules** unless the user has explicitly named the module and given a trigger phrase (see §7).
5. **Understand existing code first** (see `references/project-understanding-protocol.md`).
6. **Understand manual source logic next** (see `references/manual-reading-protocol.md`).
7. **Then map code against manuals** (see `references/fcom-comparison-rubric.md`).
8. **When unsure, mark unknown or placeholder.** Never invent procedure content.
9. **Always classify findings** with the labels in §4.
10. **Scope to one system at a time.** Never accept "do everything" as a task — push back and ask which system (APU, ENG, HYD, ELEC, etc.).

If the user asks for a code change without invoking a trigger phrase from §7, respond with an assessment in the format from §6 and ask whether to proceed.

---

## 1. Source library

### Authoritative manuals (extracted plain text — fast grep)

Located at `~/.claude/manuals/a320/`:

| File | Size | Source PDF | Contents |
|---|---|---|---|
| `fcom-full.txt` | 7.7 MB | A320 FCOM (3,654 pp) | Authoritative system descriptions + abnormal/emergency procedures |
| `fctm-full.txt` | 940 KB | A320 FCTM (476 pp) | Crew technique, judgement, "if/then" nuances ECAM/FCOM don't cover |
| `abnormal-procs.txt` | 49 KB | A320 Abnormal Procedures (30 pp) | PF/PM tasksharing tables, decision protocols, LAND ASAP semantics |
| `abnormal-notes.txt` | 13 KB | A320 Abnormal Notes (13 pp) | Curated gap analysis: what ECAM vs QRH vs FCOM each say differently |
| `tasksharing.txt` | 71 KB | Tasksharing Dec 2020 (23 pp) | CM1/CM2 split for normal procedures |
| `eng-malfunctions.txt` | 38 KB | Handling Engine Malfunctions (17 pp) | Ops briefing — engine identification, recommendations |
| `callouts.txt` | 30 KB | A319/320/321 Simulator Callouts (24 pp) | Verbatim PF/PM call-and-response for normal + abnormal phases (TO, climb, approach, GA, EO-GA, windshear escape, EGPWS escape, nose-low/high recovery, wake, stall, emergency descent, TCAS, ECAM challenge-response). **Use this when authoring scenario callouts and PF/PM tasksharing — preserves exact phraseology.** |

Additionally at `~/.claude/manuals/atc/`:

| File | Size | Source | Contents |
|---|---|---|---|
| `icao-phraseology.txt` | 26 KB | CAA Standards & Procedures Manual §8 (ICAO Annex 10 / PANS-ATM Doc 4444 / Doc 9432) | Authoritative ATC/pilot RTF phraseology — standard abbreviations, read-back rules (§5.6.1), climb/descent/heading/speed phrases, holding, approach clearances, taxi, take-off, landing, vectoring, SSR (SQUAWK), emergency (MAYDAY/PAN PAN/SQUAWK 7700), low-altitude/terrain alerts, GNSS/RNAV.  **Authoritative for every ATC line in `src/scenarios/data/*.ts` — every distraction message and every correct/wrong choice should be verifiable against this file.  Grep here before authoring or editing any ATC distraction.** |

### Source PDFs

`~/Desktop/snap avia/`:
- `414215430-FCOM-...pdf` (FCOM, 52 MB)
- `pdfcoffee.com_a320-fctm-pdf-free.pdf` (FCTM, 10 MB)
- `a320-abnormal-procedures.pdf`
- `a320-abnormal-notes.pdf`
- `A320 Tasksharing for new Checklists - Issue DEC 2020.pdf`
- `193.pdf` (Engine Malfunctions briefing)
- `Golden Rules for Pilots.pdf`

### Quick lookup pattern

```bash
grep -nE "<exact procedure title>" ~/.claude/manuals/a320/fcom-full.txt | head
```

If a `.txt` file is missing, regenerate with:
```bash
pdftotext -layout "<source.pdf>" ~/.claude/manuals/a320/<name>.txt
```

---

## 2. Documentation hierarchy

When answering "what does the crew do?" — apply in this order. Never skip a level without justification.

1. **OEB** (Operations Engineering Bulletin) — overrides ECAM if active. QRH OEB section.
2. **ECAM** — if displayed, follow it. Procedure on EWD/SD.
3. **QRH** — paper/electronic backup. Used for resets, supplementaries, or when ECAM has no procedure.
4. **FCOM** — authoritative for *background* and procedures **not** in ECAM/QRH. Example: ENGINE FIRE INFLIGHT/ON GROUND is FCOM-only — it is not in QRH or ECAM during a FWS-FWC dual fault.
5. **FCTM** — *technique* nuances neither ECAM nor FCOM contain. Example: AVIONICS SMOKE only if smoke is perceptible — else spurious.

When writing scenario text, cite source as `[FCOM PRO-ABN-ENG]` or `[FCTM AS-FG-10-1]`.

---

## 3. Official Manual Ingestion Rule

When FCOM, FCTM, QRH, ECAM, MEL/CDL, SOP, or training documents are attached or available in the project:

1. Search the attached/manual documents first.
2. Extract only the relevant system logic.
3. Convert the extracted logic into structured state-machine format.
4. Mark every logic item as:
   - `official-source-derived`
   - `inferred-from-source`
   - `simulation-placeholder`
5. Do not code cockpit behavior until the source-derived logic has been summarized.
6. If the manual source is unclear, ask for the exact chapter/section or mark it as placeholder.
7. Do not mix FCOM/FCTM/QRH/SOP logic without clearly identifying the source type.
8. Keep all generated material for simulation/training only.
9. Never present generated procedures as real-world operational guidance.

**Preferred workflow chain:**

```
Manual text
  → extracted rules (manual-extraction-template.md)
    → state model
      → ECAM logic
        → cockpit control behavior
          → scenario engine
            → React/FastAPI code
```

Never skip ahead. Each stage is a checkpoint where the user can validate or redirect.

---

## 4. Classification labels (apply to every finding)

Every observation, procedure step, and code mapping must be tagged with exactly one of:

| Label | Meaning |
|---|---|
| `official-source-derived` | Verbatim or near-verbatim from FCOM/FCTM/QRH with citation |
| `inferred-from-source` | Logical extension where source is silent but technique is implied |
| `existing-implementation` | What the Aviator code currently does — neutral observation |
| `simulation-placeholder` | Stand-in for training UX where real ops detail is unnecessary or missing from sources |
| `improvement-suggestion` | Proposed change — does NOT execute until user gives §7 trigger |

When two sources disagree (e.g. ECAM vs FCTM), tag both and surface the conflict explicitly.

---

## 5. Workflow — always follow this order

1. **Understand the current Aviator module.** Use `references/project-understanding-protocol.md`. Read the actual files. Do not assume.
2. **Locate related manual material.** Use `references/manual-reading-protocol.md`. Grep `~/.claude/manuals/a320/`.
3. **Extract manual-derived logic** into `references/manual-extraction-template.md` format.
4. **Compare with current implementation** using `references/fcom-comparison-rubric.md`.
5. **Classify each finding** per §4.
6. **Produce assessment** in the format below (§6) — do not modify code.
7. **Wait for trigger phrase** (§7).

See `references/no-change-until-commanded.md` for what NOT to do.

---

## 6. Standard assessment output format

When the user asks about a system or module, return this exact structure:

```
Module:
Existing implementation:
Manual source logic:
Alignment score:
Gaps:
Risk of changing now:
Recommended future improvement:
Files likely involved:
Do not modify yet:
```

Use `references/improvement-assessment-template.md` for filled-in examples and the alignment scoring rubric.

---

## 7. Trigger phrases that authorize implementation

Code changes are gated. Only proceed when the user says one of:

- **"Proceed with implementation"** — execute the most recent assessment's recommendation.
- **"Rebuild this module"** — full rewrite of one named module (still scoped to one system).
- **"Apply this fix"** — narrow, surgical change for a specific assessment item.

Even with a trigger phrase: scope to one system (APU, ENG, HYD, ELEC, BLEED, FUEL, F_CTL, NAV…). Never expand silently.

If the user requests a change without a trigger phrase, respond with an assessment and ask which trigger phrase applies.

---

## 8. Reference files (read these as needed)

All in `references/` next to this `SKILL.md`:

- `project-understanding-protocol.md` — how to read the Aviator codebase before doing anything.
- `manual-reading-protocol.md` — how to navigate FCOM/FCTM section codes; grep recipes.
- `manual-extraction-template.md` — the canonical template for capturing source-derived logic.
- `fcom-comparison-rubric.md` — six-level rubric for code-vs-manual alignment.
- `cockpit-control-mapping.md` — push-button/switch/light conventions; color semantics.
- `ecam-logic-mapping.md` — ECAM tree mechanics, L1/L2 lines, MEMORY items, STATUS, LAND ASAP, INOP SYS.
- `improvement-assessment-template.md` — filled-in assessment examples, alignment scoring.
- `no-change-until-commanded.md` — discipline rules; what NOT to do.

---

## 9. Anti-patterns

- ❌ Reading the user's request and going straight to code.
- ❌ Inventing or paraphrasing procedure text. FCOM verbs (PUSH, DISCH, OFF THEN ON, NOTIFY) are exact.
- ❌ Mixing source types without labels (e.g. "the FCOM says" when actually FCTM).
- ❌ Treating ENG 1 and ENG 2 as separate procedures — FCOM uses `ENG 1(2)`.
- ❌ Rendering memory items in the same visual style as ECAM line actions.
- ❌ Generic "land soon" language. Must be **red** vs **amber** LAND ASAP per FCOM, with the right MAYDAY/PAN-PAN implication.
- ❌ Refactoring "while we're here." If not asked, don't.
- ❌ Accepting "improve the simulator" as a task. Push back: which system?

---

## 10. SME flag

If a procedure detail is **not** present in any source on this machine, or sources disagree without a clear technique winner, do not invent. Use:

```
// TODO(sme): verify <detail> against current ops manual
// classification: simulation-placeholder
```

And note it in the assessment under "Gaps".
