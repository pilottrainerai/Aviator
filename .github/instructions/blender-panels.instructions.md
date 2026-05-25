---
applyTo: "blender/**/*.py,docs/blender*.py"
---

# Blender-Panels Skill — reference-driven Blender scripting only

Use this skill before editing Blender Python scripts that generate, position,
label, or light cockpit panels and controls.

**Do not invent cockpit geometry or panel details from memory.** Blender code
must follow the supplied references, measurements, and user constraints.

## 0. Hard rules

1. No code before intake is complete.
2. No guessed dimensions, offsets, fonts, panel text, or light colors.
3. Change only the named panel or element.
4. Keep scripts repeatable. Prefer parameterized construction over manual
   one-off scene edits when staying inside scope.
5. If the reference image and manual disagree, surface the conflict and ask.
6. No code without an explicit trigger phrase: `go`, `Apply this fix`,
   `Rebuild this element`, or `Match the FCOM spec`.

## 1. Required intake

Collect these six inputs first:

1. **NAME / TRIGGER** — Which panel or part is in scope?
2. **GOAL** — What should the Blender script produce?
3. **PICS / REFERENCES** — Photos, screenshots, or drawings to match.
4. **DIMENSIONS** — Real measurements, ratios, or `unknown`.
5. **OUTPUT TARGET** — New mesh, update existing mesh, labels, materials,
   indicator lights, export prep, or another explicit target.
6. **USER INPUTS** — Tolerances, simplifications, naming rules, axis rules,
   or other constraints.

If any input is missing, ask only for the missing fields.

## 2. Intake summary

```text
┌─ INTAKE SUMMARY ───────────────────────────────────────────────────┐
ELEMENT:        <name>
GOAL:           <goal statement>
REFERENCES:     <count and type>
DIMENSIONS:     <known / unknown>
OUTPUT TARGET:  <target>
USER INPUTS:    <list / none>

REFERENCE OBSERVATIONS:
  • <shape / proportion / material / label>

KNOWN MEASUREMENTS:
  • <value> — <source>

GAPS:
  • <missing dimension / unclear alignment / unknown material>

Ready to build plan? Say "go" to proceed.
└─────────────────────────────────────────────────────────────────────┘
```

## 3. Planning rules

The plan must include:

- Objects to create or update.
- Coordinate system assumptions.
- Dimensions and ratios with sources.
- Material and emission behavior with sources.
- Text labels and naming conventions.
- What will not be changed.

If critical dimensions are missing, stop and ask rather than estimating.

## 4. Code rules after approval

1. Keep Blender operations deterministic and grouped by element.
2. Reuse existing helpers if present; otherwise add only the minimum new
   helpers needed for the scoped element.
3. Every numeric literal must trace to the plan or a user instruction.
4. Do not rework unrelated scene structure, materials, or exports.
5. Validate with the narrowest available syntax or script check after editing.

## 5. Result format

```text
┌─ THE RESULT ───────────────────────────────────────────────────────┐
FILES CHANGED:    <list>
VALIDATION:       <command / result>

TRACEABILITY:
  • <object or value> -> <reference / user input>

VERDICT:          DONE / one fix needed / needs more measurements
└─────────────────────────────────────────────────────────────────────┘
```