---
name: cockpit-ui
description: FCOM-driven brain for the visual rendering of A320 cockpit elements in Aviator. Use BEFORE editing or extending any cockpit visual — PFD, ND, ECAM/EWD/SD, FMA, attitude indicator, speed/altitude/VS tapes, bank scale, sideslip, FIRE pushbuttons, master switches, glareshield lights, AGENT pb, or any other indicator/control. The skill enforces a manual-first, READ-ONLY workflow: locate the FCOM "controls and indications" section for the element via grep, extract the visual spec (geometry, colors, behaviour, conditions), compare against the current canvas/JSX rendering, classify divergences, and produce an assessment only. Code changes are gated behind explicit trigger phrases. Trigger on any UI/styling/visual ask that touches a cockpit element — colors, fonts, layout positions, animations, blink behaviour, indicator wiring, or "make it look like the FCOM photo".
---

# Cockpit-UI Skill — FCOM-driven visual brain

Sister skill to `a320-fcom-trainer` (which handles procedure/ECAM logic). This
one handles **visual rendering** — making each cockpit element pixel-faithful
to FCOM's own description, not to a photo or my training-data approximation.

This skill is **read-only assessment**. No code is modified until the user
gives a trigger phrase from §6.

---

## 0. Hard rules

1. **Do not redesign anything from scratch.** The Aviator canvas/JSX layout is the baseline.
2. **Do not invent visual properties.** Every color/dimension/animation cited must come from a grep-able FCOM section, an existing project doc, or be tagged `simulation-placeholder`.
3. **Photos are reference, not specification.** Always cross-check a photo against the FCOM text dump. If the two disagree, prefer FCOM text and surface the conflict.
4. **One element at a time.** Push back on "redesign the PFD" — ask which element (FMA, ADI, speed tape, alt tape, VSI, bank scale, sideslip, etc.).
5. **No silent refactors.** If asked to fix the FMA, don't also rewrite the speed tape.

---

## 1. Source library — same as a320-fcom-trainer

Located at `~/.claude/manuals/a320/`:

| File | Why for UI |
|---|---|
| `fcom-full.txt` | DSC-31 (PFD/ND/ECAM rendering), DSC-22 (FMA modes), DSC-26 (fire panel) — visual specs live here |
| `fctm-full.txt` | Technique nuances — when an indicator changes color, what triggers a flash, etc. |
| `eng-malfunctions.txt` | Engine-display behaviours during malfunctions |

PDFs in `~/Desktop/snap avia/` are the source of truth if the text dump is unclear (e.g., a diagram). Re-extract via `pdftotext -layout`.

---

## 2. FCOM chapter map for cockpit elements

Use this to know WHICH section to grep before answering a UI question.

| Element / panel | FCOM chapter | Grep anchor |
|---|---|---|
| PFD — Attitude Data (ADI, pitch ladder, roll/bank scale, sideslip) | DSC-31-40 | `"ATTITUDE DATA"` |
| PFD — Airspeed (tape, VLS/VFE/VAPP markers, Mach, trend) | DSC-31-40 | `"AIRSPEED"` |
| PFD — Altitude (tape, target alt, baro ref, RA, linear deviation) | DSC-31-40 | `"ALTITUDE"` |
| PFD — Vertical Speed (scale, pointer, digital readout) | DSC-31-40 | `"VERTICAL SPEED"` |
| PFD — Heading / Track (tape, lubber, selected hdg/trk, true/mag) | DSC-31-40 | `"HEADING"` |
| PFD — Flight Path Vector / Bird | DSC-31-40 | `"FLIGHT PATH VECTOR"` |
| PFD — Guidance / FD bars / Trajectory deviation | DSC-31-40 | `"GUIDANCE"` |
| PFD — Flight Mode Annunciator (FMA) | DSC-31-40 | `"FLIGHT MODE ANNUNCIATOR"` |
| PFD — Flags & messages | DSC-31-40 | `"FLAGS AND MESSAGES"` |
| ND — All modes (ROSE, ARC, PLAN, ROSE LS/VOR/NAV) | DSC-31-45 | `"ROSE MODE"`, `"ARC MODE"`, `"PLAN MODE"` |
| ND — Weather radar, terrain, traffic | DSC-31-45 | `"WEATHER RADAR"`, `"PWS"` |
| ECAM E/WD (upper screen) | DSC-31-30 | `"ECAM SEQUENCE"`, `"ECAM CONTROLS"` |
| ECAM SD (lower screen) per system page | DSC-31-30 | `"SYSTEM DISPLAY"` |
| Engine display (N1/N2/EGT/FF gauges) | DSC-31-30 + DSC-70 | `"ENGINE PRIMARY"`, `"ENGINE SECONDARY"` |
| FCU / glareshield (AP/ATHR/heading sel/baro knob) | DSC-22 | `"FCU"` |
| Master Warning / Master Caution lights | DSC-31-25 | `"MASTER WARN"` |
| Fire panel (ENG MASTER, FIRE pb, AGENT pb, APU FIRE pb) | DSC-26-20 | `"FIRE PUSH"`, `"AGENT"`, `"ENG FIRE"` |
| OHP (overhead) — ELEC, HYD, BLEED, FUEL, etc. | DSC-24, DSC-29, DSC-36, DSC-28 | `"OVERHEAD PANEL"` plus system |
| Pedestal — thrust levers, eng masters, speed brake, flap lever | DSC-22, DSC-27, DSC-70 | `"THRUST LEVERS"`, `"FLAP LEVER"` |

**Don't memorize this table — refer back when a new element comes up.** When a cockpit element doesn't fit any row, grep liberally and surface the FCOM section back in the assessment.

### Grep recipe

```bash
# Find the section
grep -nE "FLIGHT MODE ANNUNCIATOR|FMA" ~/.claude/manuals/a320/fcom-full.txt | head

# Read a window around a hit
sed -n '<line-200>,<line+200>p' ~/.claude/manuals/a320/fcom-full.txt
```

If the FCOM dump has the section but content is fragmented (PDF→text artefacts), open the PDF directly via `Read` with a page range.

---

## 3. Visual classification labels

Every observation about a UI element gets exactly one tag:

| Label | Meaning |
|---|---|
| `fcom-spec-derived` | Geometry/color/behaviour explicitly stated in an FCOM section, with citation |
| `fctm-technique-derived` | Visual rule from FCTM (e.g., when something flashes, when amber vs red) |
| `inferred-from-source` | Reasonable extension where FCOM is silent (e.g., exact px sizes — FCOM gives proportions, not pixels) |
| `existing-implementation` | What the Aviator code currently does — neutral observation |
| `simulation-placeholder` | Stand-in we know is non-spec (e.g., we use a JetBrains font where FCOM doesn't specify a font face) |
| `improvement-suggestion` | Proposed visual change — does NOT execute until §6 trigger |

---

## 4. Workflow — every UI ask

1. **Identify the element.** If unclear ("the green thing on the right"), ask. Map it to a row in §2.
2. **Grep the FCOM dump** for the matching section. Read enough context to capture: geometry (proportions/positions), colors, dynamic behaviour (when it shows/hides/changes), and conditions.
3. **Read the existing Aviator implementation.** Find the canvas-draw function or React component (`src/components/cockpit/...`).
4. **Extract a spec table** comparing FCOM-derived rules vs current implementation. Use the format in §5.
5. **Classify each row** per §3.
6. **Produce an assessment** (§5 format). Do not modify code.
7. **Wait for a trigger phrase** (§6).

---

## 5. Standard assessment output

```
Element:
FCOM section / lines:
Visual spec (FCOM-derived):
  - color:
  - geometry:
  - dynamic behaviour:
  - conditions:
Existing implementation (file:line):
Divergences:
  | # | Property | FCOM says | Code does | Classification | Severity |
Risk of changing now:
Recommended fix (if any):
Files to edit:
Do not modify yet:
```

**Severity scale:**
- `critical` — wrong information presented to crew (e.g., armed mode shown as active)
- `high` — wrong color semantics (e.g., caution shown red instead of amber)
- `medium` — wrong proportions / position / animation (e.g., FD bars unequal length)
- `low` — cosmetic noise (e.g., font weight slightly off)

---

## 6. Trigger phrases that authorize implementation

- **"Apply this fix"** — surgical change for a specific divergence in the assessment.
- **"Rebuild this element"** — full canvas-draw rewrite of one named element.
- **"Match the FCOM spec"** — apply ALL `fcom-spec-derived` divergences in the assessment.

If the user asks for a change without a trigger phrase, return an assessment and ask which trigger applies.

---

## 7. Anti-patterns

- ❌ Reading a screenshot and going straight to code without grepping FCOM.
- ❌ Inferring colors / geometry from a low-resolution photo when FCOM explicitly states them.
- ❌ Mixing `fcom-spec-derived` and `inferred-from-source` items without labels.
- ❌ Designing a "more readable" version that diverges from FCOM (this is a TRAINER — fidelity > prettiness).
- ❌ Re-rendering an entire panel because one tick mark is wrong.
- ❌ Treating PFD captain side and PFD F/O side as separate cases — FCOM uses `PFD` to mean both.
- ❌ Ignoring the FCTM. FCOM says *what*, FCTM says *when/why*. Both inform visual behaviour.

---

## 8. Cross-skill coordination

- If a UI ask touches procedure semantics (e.g., "the FIRE pb light should go off after AGENT 2 + ENG MASTER off"), invoke `a320-fcom-trainer` for the logic and use this skill for the visual. Both assessments merge into one report.
- If a procedure ask touches visual rendering (e.g., "ENG OUT badge on FMA"), `a320-fcom-trainer` produces the procedure assessment and references this skill for visual specification.

---

## 9. SME flag

If FCOM is silent on a visual property and FCTM doesn't fill the gap:

```ts
// TODO(sme-ui): verify <property> against current ops manual
// classification: simulation-placeholder
```

And note in the assessment under `Divergences` with severity `low` and classification `simulation-placeholder`.
