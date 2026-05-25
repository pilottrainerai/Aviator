---
name: blender-panels
description: Reference-driven brain for building A320 cockpit panels in Blender. Use BEFORE writing any Blender Python script that creates, modifies, or animates a panel element — FIRE panel, overhead panel, pedestal, glareshield, or any pushbutton, switch, indicator, or label. Enforces a seven-input intake: NAME, GOAL, PICS, FCOM Controls & Indications (4a), FCOM System Description (4b), USER INPUTS, BLENDER CONTEXT — all seven required before any script. §0 hard rules are always in effect — Claude never asks the user to re-state them. FCOM and FCTM are mandatory references. No geometry, material, color, or animation value is invented by Claude.
---

# Blender Panels Skill — Reference-driven 3D panel construction

Same discipline as `cockpit-ui` — applied to Blender Python scripting.
Every geometry dimension, material color, font size, label position, and
animation timing must come from PICS, FCOM, or USER INPUTS.
Claude's own judgment is not a valid source for any value.

---

## 0. Hard rules (non-negotiable)

1. **Seven inputs before anything else.** No script, no geometry, no material
   until all seven inputs from §1 are collected and confirmed. (RULES is not an
   input — §0 hard rules are always in effect and never re-asked.)
2. **No self-generated values.** Claude does not invent dimensions, colors,
   proportions, font sizes, label text, or animation timing from its own
   training data or judgment.
3. **No "approximately".** Every value in the script must trace to a row in the
   plan that traces to PICS, FCOM, or USER INPUTS.
4. **Font and text labels must match reference exactly.** The text on a panel
   (FIRE, PUSH, SQUIB, DISCH, ON, OFF, etc.) must match what is in PICS or
   FCOM — same characters, same case, same relative size. Claude does not
   choose label text or size on its own.
5. **Panel text sizing must match reference.** If PICS show a label at a certain
   size relative to the panel body, Claude measures that ratio and uses it.
   If FCOM describes a label, Claude uses that. If neither provides the size,
   Claude stops and asks.
6. **Do not add anything unprompted.** No extra geometry, labels, materials,
   lights, or decorations not present in PICS or FCOM. If Claude thinks
   something should be added, it asks first.
7. **Touch only the element in scope.** If the task is the FIRE pb, do not
   also modify the guard, the AGENT pb, or the panel background.
8. **No script before "go".** The plan must be approved first.
9. **When in difficulty, stop and discuss.** If Claude is uncertain about any
   value, geometry approach, material node setup, or animation — it stops
   immediately and presents the difficulty.
   Format: "I'm stuck on [X]. Options are [A / B / C]. Which do you want?"
10. **Verified rest positions only.** Never read object transforms from the
    scene to use as base values — scene state may be corrupted by prior
    animations. Hard-code rest positions from diagnostic output or user input.

---

## 1. The seven mandatory inputs

Before any script is written, Claude must have ALL of the following.
If any are missing, Claude asks — one question per missing item.
§0 hard rules are always in effect — they are never inputs and never re-asked.

```
1. NAME / TRIGGER   — What panel element? What needs to be built or changed?
                      Examples: "ENG 1 FIRE pb", "SQUIB indicator cell",
                      "guard hinge animation", "AGENT pb material"

2. THE GOAL         — What should it look like or do when done?
                      Examples: "Match the reference photo — fire pb wider than
                      tall, red face, FIRE / PUSH labels", "SQUIB snaps white
                      when pb released, off when AGENT pressed"

3. PICS             — One or more reference photos from the user.
                      Claude reads the photo for:
                        • Geometry: width, height, depth, proportions
                        • Colors: panel body, labels, indicator states
                        • Layout: position of labels relative to element
                        • Typography: label text, approximate relative size
                        • States: off / lit / armed / pressed appearances
                      Claude does NOT use training-data images — only what
                      the user provides in this session.

4. REFERENCES       — Two specific FCOM sections, both required.

                      4a. CONTROLS AND INDICATIONS
                          Describes exactly how each control, light, and
                          indicator behaves — trigger, color, meaning.
                          This is the primary source for all light states
                          and animation logic.
                          Example: DSC-26-20-20 "CONTROLS AND INDICATIONS"

                      4b. SYSTEM DESCRIPTION
                          Describes how the underlying system works — gives
                          context so indicator logic makes sense.
                          Example: DSC-26-20-10 "DESCRIPTION"

                      Without BOTH extracted and confirmed — work stops.

5. USER INPUTS      — Specific values, corrections, preferences, or element-specific
                      constraints the user states. These override PICS and FCOM.
                      Examples: "the pb should be 108mm wide not 90mm",
                      "guard rotates -140° on X axis", "do not touch the guard
                      animation", "do not use shared materials for animated elements",
                      "clear all animation before re-keying".
                      Can be "none" — user must confirm.
                      §0 hard rules are always in effect and never need re-stating.

6. BLENDER CONTEXT  — Technical constraints for the Blender session.
                      Examples: Blender version (5.1.1), object names confirmed
                      from diagnostic, known API issues.
                      Claude asks: "What are the confirmed object names and
                      Blender version?" if not already known.
```

**Checklist before proceeding:**

```
[ ] NAME / TRIGGER received
[ ] GOAL received
[ ] PICS received (at least one photo)
[ ] REFERENCES 4a: Controls & Indications extracted and confirmed
[ ] REFERENCES 4b: System Description extracted and confirmed
[ ] USER INPUTS received (values, corrections, element-specific constraints; "none" is valid)
[ ] BLENDER CONTEXT received (version + object names)
→ All seven checked: proceed to §2 intake summary
→ Any unchecked: stop and ask
```

---

## 2. Intake summary (confirm before plan)

```
┌─ INTAKE SUMMARY ───────────────────────────────────────────────────┐
ELEMENT:        <name>
GOAL:           <goal statement>
PHOTOS:         <count> photo(s) — key observations below
FCOM (4a):      Controls & Indications — <section> confirmed
FCOM (4b):      System Description — <section> confirmed
USER INPUTS:    <list / "none">
RULES:          <list / "none">
BLENDER:        v<X.X.X> — objects: <confirmed name list>

PHOTO OBSERVATIONS:
  • Geometry:   <width × height × depth, proportions>  [photo]
  • Colors:     panel=<hex>, label=<hex>, lit=<hex>     [photo]
  • Labels:     "<text>" at <position>, approx <size>   [photo]
  • States:     off=<appearance>, lit=<appearance>       [photo]

CONTROLS & INDICATIONS (4a):
  • <indicator>: <trigger> → <color/state>  [FCOM line N]
  • ...

SYSTEM DESCRIPTION (4b):
  • <context detail>  [FCOM line N]
  • ...

CONFLICTS (photo vs FCOM):
  • <property>: photo=<X>, FCOM=<Y> → awaiting user direction

GAPS (no source for a required value):
  • <property>: no source → will ask before using any value

RULES IN EFFECT:
  • <rule 1>
  • ...

Ready to build plan? Say "go" to proceed.
└─────────────────────────────────────────────────────────────────────┘
```

**CONFLICTS or GAPS present → do NOT assume. Ask the user to resolve each.**

---

## 2a. Layout and alignment — source mapping

Pushbutton size, alignment, and panel layout are tracked properties.
Every aspect maps to a specific input — Claude does not estimate any of them.

| Layout property | Where it comes from | Input category |
|---|---|---|
| Panel grid — rows/columns, overall arrangement of pbs | FCOM System Description (4b) — panel layout text | REFERENCES 4b |
| Individual pb body dimensions (W × H × D in metres) | PICS — measure W:H:D ratio from photo, scale to real-world size | PICS |
| Pb proportions (wider than tall? square?) | FCOM 4a often states shape; PICS confirms | PICS + REFERENCES 4a |
| Pb-to-pb spacing (gap between pb edges) | PICS — measure gap relative to pb width | PICS |
| Pb position on panel (X, Y, Z offset from panel origin) | PICS — measure from panel edge | PICS |
| Label text on pb face (words, case, number of lines) | FCOM Controls & Indications (4a) names each legend | REFERENCES 4a |
| Label position on pb face (top / bottom / centre) | PICS — measure text centre relative to pb face centre | PICS |
| Label font size relative to pb body | PICS — measure text height as % of pb face height | PICS |
| Label color: unlit / lit state | FCOM 4a specifies color semantics (white, amber, red) | REFERENCES 4a |
| Guard dimensions and alignment over pb | PICS — guard covers pb; measure overhang on each side | PICS |
| Guard hinge position and rotation axis | PICS + user confirmation | PICS + USER INPUTS |
| Indicator cell (SQUIB/DISCH) size and position | PICS — measure cell relative to pb body | PICS |
| User correction to any of the above | Overrides PICS and FCOM | USER INPUTS |

**Rule: if PICS do not show a layout property clearly enough to measure,
Claude stops and asks for a closer photo or an explicit value.
It does not estimate, it does not use its own judgment.**

---

## 2b. Color and light indications — FCOM is the only source

**Colors and light states come from FCOM Controls & Indications (4a) only.**
Photos may confirm a color visually but are NOT the authoritative source.
Claude does not pick emission colors, base colors, or light states from
photos, training data, or its own judgment.

| Property | Source | Rule |
|---|---|---|
| Pb lit color (red, amber, white, green, blue) | FCOM 4a — explicit color name | Use FCOM. Photo disagreement → surface conflict, ask user. |
| Pb unlit appearance (dark, dim gray) | FCOM 4a — "off" state description | Use FCOM. |
| SQUIB indicator color | FCOM 4a — "comes on WHITE" | Use FCOM exactly. |
| DISCH indicator color | FCOM 4a — "comes on AMBER" | Use FCOM exactly. |
| FIRE pb color | FCOM 4a — "lights up RED" | Use FCOM exactly. |
| Light ON trigger | FCOM 4a — "comes on when..." | Use FCOM verbatim — drives animation keyframe logic. |
| Light OFF trigger | FCOM 4a — "goes off when..." | Use FCOM verbatim — drives animation keyframe logic. |
| Emission strength value (e.g. 2.0, 3.0) | USER INPUTS or simulation-placeholder | FCOM does not specify Blender emission strength — ask user. |
| Panel body / bezel color | PICS — structural, not a system indication | PICS only. |
| Unlit label color | FCOM 4a if stated; PICS as fallback | FCOM first. |

**If FCOM 4a does not explicitly state a color or trigger →
Claude marks it `simulation-placeholder`, flags it in the intake summary,
and asks the user before writing any material or keyframe value.**

---

## 2c. Flow art and pb-cell conventions

**Codified from the HYD panel (base panel two, 2026-05-25) — these are
HARD RULES for any future overhead panel that has cross-zone flow lines or
two-cell push buttons. Reference implementation:
`blender/hyd/best_version/hyd_panel_BEST.py`.**

### Green flow art (river segments, callouts, arrows, junctions)

1. **No green line ever enters a pb cap or crosses any text.** Break the
   river into segments around any callout/bracket. Function-bracket legs
   must terminate ≥ 4 px above the pb cap edge. (Violation surfaced by the
   user 2026-05-25: legs extending into pb area, drops cutting through
   FAULT/OFF cells.)
2. **River = orthogonal horizontals + verticals only.** No bezier curves
   for the river itself. Right-angle T-junctions by default at zone↔river
   meet points. (Earlier curved "intestine" version was wrong.)
3. **Function brackets are 3-sided** (top bar + half-height L/R ticks,
   OPEN at the bottom toward the pb). Implemented via
   `label_box(..., omit_sides=('B',), half_sides=True)`.
4. **Inline callouts on the river** (e.g. `RAT MAN ON`, `[PTU]`): plain
   text + partial brackets next to the text. The river BREAKS where the
   callout's brackets are — leave a gap covering the bracket span so the
   river never overlaps the callout.
5. **Bracket sides go toward what they enclose, never away.** A `]` (right
   bracket): T + R + B, omit L. A `[` (left bracket): T + L + B, omit R.
6. **Junction emphasis = semicircular dome below the river** (not above).
   Use a TRUE Bezier semicircle with handle ratio `K = 0.5523` (= 4/3·(√2−1));
   AUTO handles look oblong. Reserve domes for ONE marked junction
   (typical: BLUE in HYD). All other zone junctions are plain T-junctions.
7. **Arrow placement: never inside a river gap.** Recompute arrow x to
   sit on a live river segment after any break is introduced.
8. **Flow direction comes from FCOM Description (4b), not from
   guesswork.** Pump → its system zone (vertical riser + up-arrow into
   the zone bracket). Cross-zone transfer (e.g. PTU) → bidirectional
   indicators.

### Two-cell push button cells (FAULT/OFF style)

9. **Cell split is 55% top / 45% bottom** (not equal halves). Top cell
   (typically FAULT, amber-lit) is taller; bottom cell (typically OFF or
   ON, white-lit) is shorter. Implemented by setting `top_ch_mm =
   avail*0.55` and `bot_ch_mm = avail*0.45` rather than the legacy 50/50.
10. **Thin light-gray inner frame around BOTbg only** (not TOPbg). Frame
    sits on a layer ABOVE the cell background — frame Z must clear the
    BOTbg top face (`AZ_FRONT + 0.5`); else it is buried inside the cell
    and invisible. Frame thickness ≈ 0.4 mm (1.5 px) — visible without
    being heavy.
11. **Cell-frame material is non-metallic mid-gray (`#7A7A7A`,
    roughness 0.70).** The legacy `screw` material at `#C8CED6` with
    metallic=0.90 reflects light and reads as whitish — DO NOT use for
    flat borders. Add a dedicated `gray_border` material if missing.
12. **The top edge of the BOTbg inner frame doubles as the FAULT/OFF
    divider.** Do not add a separate divider line.

### Lighting trade-offs (applies to all panels, surfaced via HYD)

13. **Lighting scales with panel area.** Reusing fire-panel-best lights
    (5/2.5/2.5/1.0 energy) on a panel ~¼ the area BLOWS OUT the panel
    color. Halve the energies when panel area is ≤ ½ of fire panel.
14. **View transform Standard + matched lighting** preserves the actual
    hex panel color (#33607A). Filmic compresses highlights and is
    acceptable but darker materials read paler — verify against PICS
    before committing.

### When to add this section
Add a §2c equivalent any time a future panel needs cross-zone flow art
or two-cell pbs. If a single-pb panel, only §2a/§2b apply.

---

## 3. Source library and FCOM chapter map

### Manual files

All at `~/.claude/manuals/a320/`:

| File | When to use |
|---|---|
| `fcom-full.txt` | Primary — all system descriptions, normal/abnormal procedures, controls & indications |
| `fctm-full.txt` | Technique nuances — when/why, crew coordination philosophy, normal and abnormal |
| `tasksharing.txt` | CM1/CM2 split — who does each step for every procedure |
| `callouts.txt` | Verbatim PF/PM callouts (extracted from FCOM PRO-ABN-ABN-00) |
| `abnormal-procs.txt` | Abnormal procedure tasksharing tables |
| `abnormal-notes.txt` | Gap analysis — ECAM vs QRH vs FCOM differences |
| `eng-malfunctions.txt` | Engine identification, indications, recommendations |

**Grep recipe:**
```bash
grep -nE "<term>" ~/.claude/manuals/a320/fcom-full.txt | head
grep -nE "<term>" ~/.claude/manuals/a320/fctm-full.txt | head
sed -n '<start>,<end>p' ~/.claude/manuals/a320/fcom-full.txt
```

### FCOM chapter map for panel elements

| Element | System Description (4b) | Controls & Indications (4a) |
|---|---|---|
| Fire panel — FIRE pb, AGENT pb, ENG MASTER | DSC-26-20-10 `"DESCRIPTION"` | DSC-26-20-20 `"CONTROLS AND INDICATIONS"` |
| APU FIRE pb | DSC-26-30-10 `"DESCRIPTION"` | DSC-26-30-20 `"CONTROLS AND INDICATIONS"` |
| Engine Master lever | DSC-70 `"DESCRIPTION"` | DSC-26-20-20 `"CONTROLS AND INDICATIONS"` |
| OHP — ELEC panel | DSC-24 `"DESCRIPTION"` | DSC-24 `"CONTROLS AND INDICATIONS"` |
| OHP — HYD panel | DSC-29 `"DESCRIPTION"` | DSC-29 `"CONTROLS AND INDICATIONS"` |
| OHP — BLEED panel | DSC-36 `"DESCRIPTION"` | DSC-36 `"CONTROLS AND INDICATIONS"` |
| OHP — FUEL panel | DSC-28 `"DESCRIPTION"` | DSC-28 `"CONTROLS AND INDICATIONS"` |
| OHP — ANTI-ICE panel | DSC-30 `"DESCRIPTION"` | DSC-30 `"CONTROLS AND INDICATIONS"` |
| Glareshield — Master Warn/Caut | DSC-31-25 `"DESCRIPTION"` | DSC-31-25 `"MASTER WARN"` |
| Pedestal — thrust levers | DSC-70 `"DESCRIPTION"` | DSC-22-30 `"CONTROLS AND INDICATIONS"` |

---

## 4. The plan (Checkpoint A)

Only produced after intake summary is confirmed. Every value must have a source tag.

```
┌─ THE PLAN ─────────────────────────────────────────────────────────┐
ELEMENT:         <name>
SCOPE:           In scope: <X>.  Out of scope: <Y>.
FCOM (4a):       <section> — <summary>
FCOM (4b):       <section> — <summary>
RULES IN EFFECT: <list / "none">
BLENDER:         v<X.X.X>

GEOMETRY (every value sourced):
  Panel body:      <W>m × <H>m × <D>m  [photo ratio W:H = X.X]  [source]
  Pb dimensions:   <W>m × <H>m  [photo — W:H ratio = X.X]  [source]
  Pb proportions:  wider-than-tall / square / taller-than-wide  [fcom:4a / photo]
  Pb spacing:      <X>m gap between pbs  [photo]
  Pb grid:         <N> rows × <N> cols, arrangement  [fcom:4b / photo]

LABELS (every value sourced):
  Text:          "<exact text>" — case as in FCOM / photo  [fcom:4a:LN]
  Position:      top legend / bottom legend / centre  [photo]
  Size:          <X>% of pb face height  [photo]
  Color (unlit): <hex>  [photo / fcom:4a:LN]
  Color (lit):   <hex>  [fcom:4a:LN]

INDICATOR CELLS:
  Size:          <W>m × <H>m  [photo]
  Position:      <offset from pb body>  [photo]
  Text:          "<exact text>"  [fcom:4a:LN]

MATERIALS:
  Panel body:    Base Color <hex>, Roughness <X>  [photo]
  Label (unlit): Emission Strength 0, Base Color <hex>  [fcom:4a:LN]
  Label (lit):   Emission Strength <X>, Base Color <hex>  [fcom:4a:LN / photo]
  NOTE: Each animated indicator gets its OWN unique material — no sharing.

ANIMATION (if applicable):
  Frame <N>: <object> → <property> = <value>  [fcom:4a:LN / user-input]
  ...
  Interpolation: CONSTANT for all light transitions  [user-input / rule]

OBJECT NAMES (confirmed):
  <role>: '<blender_name>'

OPEN QUESTIONS (must resolve before "go"):
  • <property>: no source — please specify

Script file: /private/tmp/<name>.py
└─────────────────────────────────────────────────────────────────────┘
```

**OPEN QUESTIONS present → do not write script. Ask user to resolve first.**

---

## 5. Source tags

Every value in the plan carries one tag:

| Tag | Meaning |
|---|---|
| `[photo]` | Measured or read from a user-provided photo |
| `[fcom:4a:LN]` | From Controls & Indications section, line N |
| `[fcom:4b:LN]` | From System Description section, line N |
| `[fcom:LN]` | From another FCOM section, line N |
| `[fctm:LN]` | From FCTM, line N |
| `[tasksharing:LN]` | From tasksharing.txt, line N |
| `[callouts:LN]` | From callouts.txt, line N |
| `[user-input]` | Explicitly stated by the user |
| `[diagnostic]` | From a Blender diagnostic script output |
| `[simulation-placeholder]` | No source — flagged, user acknowledged |

No tag = not allowed. Claude asks for the source before adding any untagged value.

---

## 5a. Animation logic — FCOM procedure is the only source

**The sequence, timing, and trigger of every animation event must come from
FCOM Controls & Indications (4a). Claude does not invent the order of events,
the conditions that cause a light to change, or the relationship between one
action and the next.**

### How FCOM logic maps to Blender keyframes

Every keyframe in the script must have a FCOM justification. Format used in
the plan and in code comments:

```python
# FCOM DSC-26-20-20: "SQUIB comes on white when the flight crew releases the FIRE pb"
emit_key(sq1_bsdf, frame=125, strength=3.0, color=WHITE)
```

No keyframe is written without this citation.

### Procedure sequence → frame map

Before writing any animation, Claude extracts the full FCOM procedure sequence
and maps each step to a frame range. This sequence must appear in the plan
and be approved before "go".

```
FCOM PROCEDURE SEQUENCE (extracted from 4a, in order):
  Step 1: <FCOM text verbatim>  → Frame <N>  [FCOM 4a line N]
  Step 2: <FCOM text verbatim>  → Frame <N>  [FCOM 4a line N]
  Step 3: <FCOM text verbatim>  → Frame <N>  [FCOM 4a line N]
  ...
```

**Rule: the order of frames must match the order of steps in FCOM.
A later FCOM step cannot have an earlier frame number than a prior step.**

### What FCOM determines for each animation event

| Animation property | FCOM source | Rule |
|---|---|---|
| WHAT triggers a light to come on | FCOM 4a: "comes on when..." | Use FCOM verbatim. Keyframe fires at that trigger frame. |
| WHAT triggers a light to go off | FCOM 4a: "goes off when..." | Use FCOM verbatim. |
| WHAT triggers a pb to move (press in / pop out) | FCOM 4a: pb action description | Use FCOM verbatim. |
| WHAT triggers guard to open | FCOM 4a: guard action | Use FCOM verbatim. |
| ORDER of events (which happens before which) | FCOM 4a: procedure sequence | Steps must follow FCOM order exactly. |
| CONDITION linking two events | FCOM 4a: "after X, Y comes on" | Keyframe Y must be at or after keyframe X. |
| Frame NUMBER (the actual Blender frame) | USER INPUTS or simulation-placeholder | FCOM gives order, not frame numbers. Frame numbers are set by user or agreed in plan. |
| Hold duration between events | USER INPUTS or simulation-placeholder | FCOM does not specify timing in seconds. |

### What Claude does when FCOM is ambiguous

If FCOM 4a describes a trigger but the exact condition is unclear:
1. Claude quotes the FCOM text verbatim in the plan.
2. Claude flags it: "FCOM says X — I interpret this as Y. Is that correct?"
3. Claude does not proceed until the user confirms the interpretation.

**Never assume. Never paraphrase FCOM procedure logic into animation without
the user confirming the interpretation.**

---

## 6. Script rules

Once "go" is given:

1. Every literal (dimensions, hex colors, frame numbers, emission strength, rotation angles) must appear in the plan with a source tag.
2. If a value is needed that is NOT in the plan → stop, ask, update plan, get "go" again.
3. **Every animation event (keyframe) must have an inline FCOM citation comment.**
   Format: `# FCOM DSC-XX-XX-XX: "<verbatim FCOM text that justifies this event>"`
   No keyframe is written without this comment.
4. **FCOM procedure order must be preserved in frame order.**
   Earlier FCOM steps = lower frame numbers. Never reverse the sequence.
5. Script must clear all existing animation before re-keying (never build on corrupted state).
6. Object names used in script must match the confirmed names from BLENDER CONTEXT.
7. Use CONSTANT interpolation for all emission light transitions.
8. Never read `ob.location` or `ob.rotation_euler` from the scene as a base value — use hard-coded values from diagnostic or user input.
9. Unique material per animated indicator — no shared materials between elements that animate independently.
10. Test with `python3 -m py_compile <script>` before giving to user.

---

## 7. Checkpoint B — The result

After the user runs the script in Blender:

```
┌─ THE RESULT ───────────────────────────────────────────────────────┐
SCRIPT:          /private/tmp/<name>.py
SYNTAX CHECK:    pass

RENDER DIFF (plan vs reported result):
  | Property        | Plan          | Result        | Source tag  | OK? |
  | <prop>          | <value>       | <value>       | [photo/fcom]| ✓/✗ |

VERDICT:   DONE  /  one fix needed  /  needs new spec
└─────────────────────────────────────────────────────────────────────┘
```

**User says "done"** → complete.
**User gives one correction** → one focused fix only, then DONE or "needs new spec".
**After one Checkpoint-B iteration → stop.** If still wrong, restart from intake.

---

## 8. Trigger phrases

- **"go"** — approve intake summary or plan, proceed to next stage.
- **"done"** — element is complete.
- **"Apply this fix"** — surgical change for one named property.
- **"Rebuild this element"** — full rewrite, restarts from intake.
- **"new spec"** — abandon current work, restart intake from scratch.

Any request to write a script WITHOUT one of these phrases → Claude shows the
intake checklist and asks which inputs are missing.

---

## 9. Known Blender 5.1.1 API notes

These are confirmed constraints — not guesses:

- `mat.node_tree.animation_data_clear()` — correct way to clear material animation.
  Do NOT use `node.animation_data_clear()` — nodes don't have animation data.
- `socket.keyframe_insert('default_value', frame=N)` — correct for keying BSDF inputs.
- `action.fcurves` iteration works for setting interpolation per keyframe point.
- `'Action' has no attribute 'fcurves'` error = you called a method that doesn't exist;
  iterate `action.fcurves` as a collection, don't call methods on it directly.
- `scene.frame_set(N)` before `ob.keyframe_insert(...)` is required for location keys.

---

## 10. Anti-patterns

- ❌ Writing a script without running through the seven-input intake.
- ❌ Guessing object names — always confirm from diagnostic output.
- ❌ Using `ob.location.z` as a rest-position base — scene may be corrupted.
- ❌ Sharing one material between two independently animated indicators.
- ❌ Adding labels, geometry, or features not in PICS or FCOM.
- ❌ Choosing font sizes or label text without a source.
- ❌ Making a decision when stuck — always ask instead.
- ❌ Iterating more than once after Checkpoint B — restart instead.
- ❌ Running partial fix scripts after the main script — they corrupt state.
- ❌ Writing a keyframe without an inline FCOM citation comment.
- ❌ Inventing an animation trigger that is not described in FCOM 4a.
- ❌ Changing the order of animation events to differ from the FCOM procedure order.
- ❌ Paraphrasing FCOM logic into animation without user confirmation.
- ❌ Using training-data knowledge of "how A320 fire procedure works" —
     only what FCOM 4a says in this session counts.
- ❌ Asking the user to re-state §0 hard rules — they are always in effect.

---

## 11. Examples log (self-improving reference)

Every completed script is recorded here. Claude uses these to calibrate
future runs — object names, frame sequences, materials, and FCOM citations
from real work. Add a new entry each time a Checkpoint B passes.

### [2026-05-23] ENG 1 FIRE panel full animation — eng1_fire_complete.py
- Blender: v5.1.1
- PICS: `~/Desktop/PANELS/fire panel/a320-ovhd-fire-45vu.webp`
- FCOM 4a: DSC-26-20-20 — DSC-26-20-20-10 "AGENT 1(2) PB-SW"
- Confirmed objects: fire_pb_body, guard_obj, sq1_text, sq2_text, dc1_text, dc2_text
- Frame sequence: 1=rest, 60=FIRE red, 125=guard open+pb pop+SQUIB1+SQUIB2 white, 200=DISCH1 amber, 240=DISCH2 amber
- Key lessons: CONSTANT interpolation on all emission curves; hold keyframe N-1 before each event; unique material per animated indicator; never read `ob.location` from scene — hard-code rest positions
- Script: `/private/tmp/eng1_fire_complete.py`

### [2026-05-25] HYD overhead panel — hyd_panel.py (base panel two)
- Blender: v5.1.1
- PICS: `~/Desktop/PANELS/HYD/Hydraulic-Panel.jpg`, `a320-ovhd-hyd-40vu.webp`, `FCOM SHOT.png`
- FCOM 4a: DSC-29-20 (HYD Controls & Indicators); FCOM 4b: DSC-29-10 (HYD Description)
- Panel: 200×75 mm, PX = 0.25, BTN_PX_22 = 88 px (22 mm caps)
- 6 controls L→R: ENG 1 PUMP, RAT (red guard), BLUE ELEC PUMP, PTU, ENG 2 PUMP, right ELEC PUMP
- 3 zone labels: GREEN (col 0), BLUE (col 2), YELLOW (col 4 only — not averaged across col 4+5)
- Inline callouts on the river: `RAT MAN ON` (partial right bracket only) and `[PTU]` (bracket pair)
- Key lessons (all codified in §2c above):
  - Two-cell pbs use 55/45 split with light-gray inner frame around BOTbg only
  - Function brackets are 3-sided (open at bottom, half-height L/R ticks)
  - River segments BREAK around callouts; never overlap text or pbs
  - BLUE junction uses a true Bezier semicircular dome (K=0.5523); GREEN and YELLOW are plain T-junctions
  - `gray_border` material #7A7A7A non-metallic for flat borders; metallic gray (`screw` #C8CED6) reads whitish under lights
  - Halved area-light energies (vs fire-panel-best) since HYD is ~¼ the area
  - Standard view transform preserves #33607A panel color
- best_version snapshot: `blender/hyd/best_version/hyd_panel_BEST.py` and `hyd_panel_build_BEST.py`
- Script: `blender/hyd/hyd_panel.py`
