---
name: cockpit-ui
description: FCOM-driven brain for the visual rendering of A320 cockpit elements in Aviator. Use BEFORE editing or extending any cockpit visual — PFD, ND, ECAM/EWD/SD, FMA, attitude indicator, speed/altitude/VS tapes, bank scale, sideslip, FIRE pushbuttons, master switches, glareshield lights, AGENT pb, or any other indicator/control. Enforces a six-input intake: NAME, GOAL, PICS, FCOM Controls & Indications (4a), FCOM System Description (4b), USER INPUTS — all six required before any assessment or code. §0 hard rules are always in effect — Claude never asks the user to re-state them. FCOM and FCTM are mandatory references. No improvisation, no values from training data.
---

# Cockpit-UI Skill — FCOM-driven visual brain

Sister skill to `a320-fcom-trainer` (which handles procedure/ECAM logic). This
one handles **visual rendering** — making each cockpit element faithful to FCOM
and the reference photos provided by the user, not to Claude's own approximation.

**The single most important rule: Claude's own brain is NOT a valid source.
Every value — color, size, position, animation — must come from PICS, REFERENCES,
or USER INPUTS. If none of the three provide a value, Claude stops and asks.**

---

## 0. Hard rules (non-negotiable)

1. **Six inputs before anything else.** No assessment, no plan, no code until
   all six inputs from §1 are collected. If any are missing, ask for them.
2. **No self-generated values.** Claude does not invent colors, dimensions,
   font sizes, spacing, animations, or behavior from its own training data or judgment.
3. **No "approximately".** Every literal in the code must trace to a row in
   the plan that traces to PICS, REFERENCES, or USER INPUTS.
4. **Do not redesign anything not in scope.** Touch only the named element.
5. **No silent refactors.** If asked to fix the FMA, don't also rewrite the speed tape.
6. **Photos are measurement sources, FCOM is behaviour source.** If they conflict,
   surface the conflict and ask the user which to follow.
7. **One element at a time.** Push back on "redesign the PFD" — ask which element.
8. **No code before "go".** The plan must be approved first.
9. **Font and text must match reference exactly.** The typeface, size, weight,
   letter-spacing, and color of every label on a panel must come from PICS or
   FCOM. Claude does not choose or substitute fonts on its own.
10. **Panel text sizing must match reference.** If PICS show a label at a certain
    size relative to the panel, Claude measures that ratio from the photo and
    uses it. If FCOM gives a description, Claude uses that. If neither provides
    the size, Claude stops and asks — it does not guess.
11. **Claude does not add anything unprompted.** No extra labels, borders,
    indicators, shadows, decorations, or features that are not in PICS, FCOM,
    or USER INPUTS. If Claude thinks something should be added, it asks first.
12. **When in difficulty, stop and discuss.** If Claude is uncertain about any
    value, behavior, proportion, or approach — it stops immediately and presents
    the difficulty to the user. It does not make a decision and continue.
    Format: "I'm stuck on [X]. Options are [A / B / C]. Which do you want?"

---

## 1. The six mandatory inputs

Before any work begins, Claude must have ALL of the following. If any are missing,
Claude asks for them — one question per missing item, clearly labelled.
§0 hard rules are always in effect — they are never inputs and never re-asked.

```
1. NAME / TRIGGER   — What cockpit element? What invoked this skill?
                      Examples: "FIRE pb", "FMA speed column", "AGENT pb SQUIB cell"

2. THE GOAL         — What should it look like or do when done?
                      Examples: "Match FCOM photo exactly", "SQUIB snaps on white
                      when pb released, off when AGENT pressed"

3. PICS             — One or more reference photos from the user.
                      Claude reads the photo for: geometry, colors, proportions,
                      typography, borders, states (on/off/armed).
                      Claude does NOT use training-data photos — only what the user provides.

4. REFERENCES       — Two specific FCOM sections are ALWAYS required. Both must
                      be read and extracted before any plan is made.

                      4a. CONTROLS AND INDICATIONS
                          The FCOM section that describes exactly how each control,
                          pushbutton, light, and indicator on the element behaves —
                          what triggers it, what color it shows, what it means.
                          This is the primary source for ALL visual states and logic.
                          Example: DSC-26-20-20 "CONTROLS AND INDICATIONS" for fire panel.

                      4b. SYSTEM DESCRIPTION
                          The FCOM section that describes how the underlying system
                          works — gives context so indicator logic makes sense.
                          Example: DSC-26-20-10 "DESCRIPTION" for fire suppression system.

                      If the user does not know the section codes, Claude finds them
                      via the chapter map in §3, greps both, and shows the extracted
                      text to the user for confirmation before treating it as reference.

                      Without BOTH 4a and 4b extracted and confirmed — work stops.

5. USER INPUTS      — Specific values, corrections, preferences, or element-specific
                      constraints the user states. These override PICS and FCOM.
                      Examples: "the red should be #FF0000", "border 2px thicker",
                      "do not touch the guard animation", "SQUIB and DISCH must
                      have separate materials", "do not change anything outside
                      the AGENT pb body".
                      Can be "none" — user must confirm.
                      §0 hard rules are always in effect and never need re-stating.
```

**Checklist before proceeding:**

```
[ ] NAME / TRIGGER received
[ ] GOAL received
[ ] PICS received (at least one photo — check ~/Desktop/PANELS/ first)
[ ] REFERENCES — 4a: Controls and Indications extracted and confirmed
[ ] REFERENCES — 4b: System Description extracted and confirmed
[ ] USER INPUTS received (values, corrections, element-specific constraints; "none" is valid)
→ All six checked: proceed to §2 intake summary
→ Any unchecked: stop and ask. Do not proceed on partial references.
```

---

## 2. Intake summary (show before any plan)

Once all six inputs are collected, Claude produces a one-page intake summary
and waits for the user to confirm it before moving to the plan.

```
┌─ INTAKE SUMMARY ───────────────────────────────────────────────────┐
ELEMENT:        <name>
GOAL:           <goal statement>
PHOTOS:         <count> photo(s) received — key observations listed below
FCOM (4a):      Controls & Indications — <section code> confirmed
FCOM (4b):      System Description — <section code> confirmed
USER INPUTS:    <list of specific values / overrides / "none">
RULES:          <list of constraints / "none">

PHOTO OBSERVATIONS:
  • <observation 1> — source: photo
  • <observation 2> — source: photo
  • ...

CONTROLS & INDICATIONS EXTRACTS (4a):
  • <indicator/control>: <behavior / color / trigger> — FCOM <section>, line <N>
  • ...

SYSTEM DESCRIPTION EXTRACTS (4b):
  • <system context>: <detail> — FCOM <section>, line <N>
  • ...

CONFLICTS (photo vs FCOM):
  • <property>: photo=<X>, FCOM=<Y> → awaiting user direction

GAPS (neither photo nor FCOM provide a value):
  • <property>: no source found → will ask user before using any value

RULES IN EFFECT:
  BUILT-IN (§0 + §6 + §10 — always apply, non-negotiable):
  • No self-generated values — every value from FCOM, PICS, or USER INPUTS only
  • Font, size, placement must match PICS or FCOM exactly — no approximation
  • Colors and light states from FCOM 4a only — photos confirm, not decide
  • Touch only the named element — nothing outside scope
  • No code before "go"
  • Stop and discuss when uncertain — never make a decision silently
  ELEMENT-SPECIFIC (user stated for this task):
  • <rule> — or "none"

Ready to build plan? Say "go" to proceed.
└─────────────────────────────────────────────────────────────────────┘
```

**User says "go" → proceed to §4 plan.**
**User corrects something → update intake summary, show again.**
**CONFLICTS or GAPS exist → do NOT assume. Ask the user to resolve each one.**

### Worked example — ENG 1 FIRE pushbutton

```
┌─ INTAKE SUMMARY — ENG 1 FIRE pb ───────────────────────────────────┐
ELEMENT:        ENG 1 FIRE pushbutton
GOAL:           Face lights red on fire detection; SQUIB white when pb
                released; DISCH amber when agent fires
PHOTOS:         2 photos received
FCOM (4a):      DSC-26-20-20 "CONTROLS AND INDICATIONS" — confirmed
FCOM (4b):      DSC-26-20-10 "DESCRIPTION" — confirmed
USER INPUTS:    none
RULES:          Do not touch guard animation. Colors from FCOM only.

PHOTO OBSERVATIONS:
  • pb body: wider than tall, W:H ≈ 2.0    [photo]
  • FIRE legend: white text, top half of face   [photo]
  • PUSH legend: white text, bottom half of face   [photo]
  • lit state: entire face illuminates red   [photo]
  • guard: covers full pb face, hinges at top   [photo]
  • SQUIB cell: small, upper right of pb face   [photo]
  • DISCH cell: small, lower right of pb face   [photo]

CONTROLS & INDICATIONS EXTRACTS (4a):
  • FIRE pb: "lights up red" when fire is detected   [fcom:4a:L8241]
  • SQUIB: "comes on white when the flight crew releases the FIRE pb"
    [fcom:4a:L8265]
  • DISCH: "comes on amber when the squib of the agent fires"
    [fcom:4a:L8278]

SYSTEM DESCRIPTION EXTRACTS (4b):
  • Two fire detection loops monitor each engine   [fcom:4b:L8190]
  • FIRE pb arms extinguishing agent when pressed   [fcom:4b:L8201]

CONFLICTS:
  • none

GAPS:
  • Exact px dimensions: no FCOM spec → measuring from photo

RULES IN EFFECT:
  BUILT-IN (always apply):
  • No self-generated values — FCOM + PICS + USER INPUTS only
  • Font, size, placement must match PICS/FCOM exactly — no approximation
  • Colors and light states from FCOM 4a only — photos confirm, not decide
  • Touch only the named element — nothing outside scope
  • No code before "go" — stop and discuss when uncertain
  ELEMENT-SPECIFIC:
  • Do not touch the guard animation
  • SQUIB and DISCH cells must have separate materials

Ready to build plan? Say "go" to proceed.
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2a. Layout and alignment — source mapping

Pushbutton size, alignment, and panel layout are tracked properties.
Every aspect maps to a specific input — Claude does not estimate any of them.

| Layout property | Where it comes from | Input category |
|---|---|---|
| Panel grid — how many pbs, rows/columns, overall arrangement | FCOM System Description (4b) — panel layout diagrams and text | REFERENCES 4b |
| Individual pb body dimensions (width × height) | PICS — measure width and height from photo, note W:H ratio | PICS |
| Pb proportions (wider than tall? square?) | FCOM Controls & Indications (4a) often states shape; PICS confirms | PICS + REFERENCES 4a |
| Pb-to-pb spacing and gutters | PICS — measure gap between pb edges relative to pb width | PICS |
| Pb position on panel (x, y offset from panel origin) | PICS — measure from panel edge | PICS |
| Label text inside pb (what words, what case) | FCOM Controls & Indications (4a) names each light and legend | REFERENCES 4a |
| Label position within pb (top legend / bottom legend / centre) | PICS — measure text centre relative to pb centre | PICS |
| Label font size relative to pb body | PICS — measure text height as % of pb height | PICS |
| Label color (lit vs unlit) | FCOM Controls & Indications (4a) — authoritative | REFERENCES 4a |
| Guard size and alignment relative to pb | PICS — guard covers pb exactly; measure overhang | PICS |
| User correction to any of the above | Overrides PICS and FCOM | USER INPUTS |

**Rule: if PICS do not show a layout property clearly enough to measure,
Claude stops and asks for a closer photo or explicit value. It does not estimate.**

---

## 2b. Color and light indications — FCOM is the only source

**Colors and light states come from FCOM Controls & Indications (4a) only.**
Photos may be used to visually confirm a color, but they are NOT the source.
Claude does not pick colors from photos, from training data, or from its own judgment.

| Property | Source | Rule |
|---|---|---|
| Pushbutton lit color (red, amber, white, green, blue) | FCOM 4a — explicit color name | Use FCOM. If photo disagrees, surface conflict, ask user. |
| Pushbutton unlit appearance | FCOM 4a — "off" state description | Use FCOM. |
| Indicator light color (SQUIB white, DISCH amber, FIRE red) | FCOM 4a — explicit per indicator | Use FCOM exactly. |
| Light ON trigger (what event causes it) | FCOM 4a — "comes on when..." | Use FCOM verbatim. |
| Light OFF trigger (what event clears it) | FCOM 4a — "goes off when..." | Use FCOM verbatim. |
| Flashing / steady / pulsing behavior | FCOM 4a — stated explicitly | Use FCOM. If silent, mark simulation-placeholder and ask. |
| Panel body color (aluminum, dark gray, etc.) | PICS — structural color, not a system indication | PICS only. |
| Label text color when unlit | FCOM 4a if stated; PICS as fallback | FCOM first. |

**If FCOM 4a does not state a color or light state explicitly →
Claude marks it `simulation-placeholder`, flags it in the intake summary,
and asks the user before assigning any value.**

---

## 2c. Flow art and pb-cell conventions

**Mirror of the conventions codified in `blender-panels` §2c, applied to
2-D React mockups of cockpit panels. Reference: HYD overhead panel built
2026-05-25 (the second base panel, after fire_panel_two).**

### Green flow art (in React/SVG/CSS)

1. **Flow lines never overlap pb caps or any text label.** When a flow
   line would pass over a callout or pb, break the line into segments
   with a gap. Apply via two separate `<div>`/`<line>` elements rather
   than one continuous line with z-index gymnastics.
2. **Orthogonal lines only** — horizontal + vertical with right-angle
   corners. No SVG `<path>` curves for cross-zone connections.
3. **Function-bracket labels are 3-sided** — top + left + right, OPEN at
   the bottom toward the pb. Render with CSS `border-top`, `border-left`,
   `border-right`; leave `border-bottom: none`.
4. **Callouts on the flow line** (e.g. `RAT MAN ON`, `[PTU]`): plain text
   with partial brackets — and the flow line is BROKEN around the
   bracket span. Use `display: flex` with `gap` to lay out
   `[flow-segment] [callout] [flow-segment]`.
5. **Junction emphasis** = a single SVG semicircle below the line (for
   the BLUE-equivalent zone). All other zone junctions are plain
   T-junctions.

### Two-cell pushbutton cells (FAULT/OFF style)

6. **Cell split is 55% top / 45% bottom** — top cell (FAULT) is taller,
   bottom cell (OFF/ON) shorter. In Tailwind/CSS, use explicit `flex`
   ratios (`flex-[55]` / `flex-[45]` or `h-[55%]` / `h-[45%]`), not
   `flex-1` / `flex-1`.
7. **Thin light-gray inner frame around the BOTTOM cell only** (not the
   top). Render via a CSS `box-shadow: inset 0 0 0 1.5px #7A7A7A;` or an
   absolutely-positioned `<div>` with a 1.5 px border, INSIDE the
   bottom cell. Outer dimensions of the bottom cell are unchanged.
8. **Border color is `#7A7A7A`** (non-metallic mid-gray). The Blender
   `screw` material at `#C8CED6` reads as whitish under render lighting
   — in flat 2-D it's less of an issue, but match the Blender canon to
   keep the two renderings in sync.
9. **The top edge of the bottom-cell inner frame doubles as the
   FAULT/OFF divider.** Do not add a separate horizontal divider line.

### Source of truth
For any new 2-D cockpit panel, FOLLOW the Blender best_version's
construction one-for-one — same x positions (scaled), same cell ratios,
same border colors. The blender-panels script is the canonical layout;
React mirrors it.

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

**Reference photos (PICS source):**

| Folder | Contents |
|---|---|
| `~/Desktop/PANELS/fire panel/` | `a320-ovhd-fire-45vu.webp` — full ENG1/APU/ENG2 fire panel |
| `~/Desktop/PANELS/HYD/` | Hydraulic panel reference |
| `~/Desktop/PANELS/AIR COND/` | Air conditioning + ADIRS panels |
| `~/Desktop/PANELS/FLTCTL COMP/` | Flight control computer panels |
| `~/Desktop/PANELS/EVAC/` | Evacuation panel |
| `~/Desktop/PANELS/OVHD PANEL/` | Full overhead panel |
| `~/Desktop/FirePanel/eng1_left_panel/` | Blender model: `.blend`, `.fbx`, `.png` |

**Grep recipe:**
```bash
grep -nE "<term>" ~/.claude/manuals/a320/fcom-full.txt | head
grep -nE "<term>" ~/.claude/manuals/a320/fctm-full.txt | head
sed -n '<start>,<end>p' ~/.claude/manuals/a320/fcom-full.txt
```

### FCOM chapter map

Use this to locate the right section to grep. When the user does not know
the section, Claude finds the best match here, greps it, and confirms with
the user before treating it as the reference.

Each element needs TWO sections: System Description (4b) + Controls and Indications (4a).

| Element / panel | System Description (4b) | Controls & Indications (4a) |
|---|---|---|
| PFD — Attitude Data (ADI, pitch, roll, sideslip) | DSC-31-40 `"GENERAL"` | DSC-31-40 `"ATTITUDE DATA"` |
| PFD — Airspeed tape | DSC-31-40 `"GENERAL"` | DSC-31-40 `"AIRSPEED"` |
| PFD — Altitude tape | DSC-31-40 `"GENERAL"` | DSC-31-40 `"ALTITUDE"` |
| PFD — Vertical Speed | DSC-31-40 `"GENERAL"` | DSC-31-40 `"VERTICAL SPEED"` |
| PFD — Heading / Track | DSC-31-40 `"GENERAL"` | DSC-31-40 `"HEADING"` |
| PFD — Flight Path Vector | DSC-31-40 `"GENERAL"` | DSC-31-40 `"FLIGHT PATH VECTOR"` |
| PFD — FD bars / Guidance | DSC-22-30 `"DESCRIPTION"` | DSC-31-40 `"GUIDANCE"` |
| PFD — Flight Mode Annunciator | DSC-22-30 `"DESCRIPTION"` | DSC-31-40 `"FLIGHT MODE ANNUNCIATOR"` |
| ND — All modes | DSC-31-45 `"GENERAL"` | DSC-31-45 `"ROSE MODE"` / `"ARC MODE"` / `"PLAN MODE"` |
| ECAM E/WD | DSC-31-30 `"GENERAL"` | DSC-31-30 `"ECAM CONTROLS"` |
| ECAM SD pages | DSC-31-30 `"GENERAL"` | DSC-31-30 `"SYSTEM DISPLAY"` |
| Engine display gauges | DSC-70 `"DESCRIPTION"` | DSC-31-30 `"ENGINE PRIMARY"` |
| FCU / glareshield | DSC-22-10 `"DESCRIPTION"` | DSC-22-10 `"CONTROLS AND INDICATIONS"` |
| Master Warning / Caution | DSC-31-25 `"DESCRIPTION"` | DSC-31-25 `"MASTER WARN"` |
| Fire panel — FIRE pb, AGENT pb, ENG MASTER | DSC-26-20-10 `"DESCRIPTION"` | DSC-26-20-20 `"CONTROLS AND INDICATIONS"` |
| OHP — ELEC panel | DSC-24 `"DESCRIPTION"` | DSC-24 `"CONTROLS AND INDICATIONS"` |
| OHP — HYD panel | DSC-29 `"DESCRIPTION"` | DSC-29 `"CONTROLS AND INDICATIONS"` |
| OHP — BLEED panel | DSC-36 `"DESCRIPTION"` | DSC-36 `"CONTROLS AND INDICATIONS"` |
| OHP — FUEL panel | DSC-28 `"DESCRIPTION"` | DSC-28 `"CONTROLS AND INDICATIONS"` |
| Pedestal — thrust levers, ENG MASTER | DSC-70 `"DESCRIPTION"` | DSC-22-30 `"CONTROLS AND INDICATIONS"` |

**Grep recipe:**
```bash
grep -nE "ATTITUDE DATA|ADI" ~/.claude/manuals/a320/fcom-full.txt | head
sed -n '<line-100>,<line+200>p' ~/.claude/manuals/a320/fcom-full.txt
```

---

## 4. The plan (Checkpoint A)

Only produced after intake summary is approved. Every row must trace to a source.

```
┌─ THE PLAN ─────────────────────────────────────────────────────────┐
ELEMENT:        <name>
SCOPE:          In scope: <X>.  Out of scope: <Y>.
FCOM:           <DSC-XX-YY> — <one-line summary>
RULES IN EFFECT: <list from intake / "none">

MEASUREMENTS (source for every value in brackets):
  Container:        <W>px × <H>px  [photo]
  Sub-elements:
    • <name>:       <W>×<H>px at <x,y>  [photo]
    • <color>:      #XXXXXX  [photo / FCOM line N / user input]
  Typography:       <font> <size>px <weight>  [photo / user input]
  Borders:          <details>  [photo]
  States:
    off:   <color>  [FCOM line N]
    lit:   <color>  [FCOM line N]
    armed: <color>  [FCOM line N / user input]

BEHAVIOUR:
  • <trigger>: <visual change>  [FCOM line N]
  • ...

OPEN QUESTIONS (values with no source — must resolve before "go"):
  • <property>: no source — please specify

File:           src/components/cockpit/<file>.tsx
Render mode:    <SVG | canvas | div+CSS>
└─────────────────────────────────────────────────────────────────────┘
```

**If OPEN QUESTIONS exist → do NOT proceed. Ask the user to resolve them.**
**User says "go" with no open questions → write code.**
**User corrects something → update plan, show again, wait for "go".**

### Worked example — ENG 1 FIRE pb plan

```
┌─ THE PLAN — ENG 1 FIRE pb ─────────────────────────────────────────┐
ELEMENT:        ENG 1 FIRE pushbutton face + SQUIB + DISCH cells
SCOPE:          In scope: pb face, SQUIB state, DISCH state.
                Out of scope: guard, AGENT pb, panel background.
FCOM (4a):      DSC-26-20-20 "CONTROLS AND INDICATIONS"
FCOM (4b):      DSC-26-20-10 "DESCRIPTION"
RULES IN EFFECT:
  • Do not touch guard animation
  • Colors from FCOM only

MEASUREMENTS:
  pb body:          80px × 40px  [photo — W:H ratio 2.0]
  FIRE legend:      top 50% of face, centred  [photo]
  PUSH legend:      bottom 50% of face, centred  [photo]
  Typography:       monospace 8px white all-caps  [photo]
  SQUIB cell:       10px × 6px, upper-right of face  [photo]
  DISCH cell:       10px × 6px, lower-right of face  [photo]

STATES:
  pb off:           background #1a1a1a, labels white   [photo]
  pb lit (fire):    background #CC0000 (red)   [fcom:4a:L8241]
  SQUIB off:        #1a1a1a   [photo]
  SQUIB on:         white #FFFFFF   [fcom:4a:L8265 "comes on white"]
  DISCH off:        #1a1a1a   [photo]
  DISCH on:         amber #FFA500   [fcom:4a:L8278 "comes on amber"]

BEHAVIOUR:
  • ENG 1 fire detected → pb face goes red   [fcom:4a:L8241]
  • FIRE pb released → SQUIB goes white   [fcom:4a:L8265]
  • AGENT pb pressed → DISCH goes amber + SQUIB goes off   [fcom:4a:L8278]

OPEN QUESTIONS:
  • none

File:           src/components/cockpit/fire-panel.tsx
Render mode:    SVG
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Visual classification labels

Every value in the plan gets exactly one source tag:

| Tag | Meaning |
|---|---|
| `[photo]` | Read directly from a user-provided photo |
| `[fcom:4a:LN]` | From Controls & Indications section, line N |
| `[fcom:4b:LN]` | From System Description section, line N |
| `[fcom:LN]` | From another FCOM section, line N |
| `[fctm:LN]` | From FCTM, line N |
| `[tasksharing:LN]` | From tasksharing.txt, line N |
| `[callouts:LN]` | From callouts.txt, line N |
| `[user-input]` | Explicitly stated by the user in this session |
| `[simulation-placeholder]` | No source — flagged and user acknowledged |

No tag = not allowed. If Claude cannot find a source, it stops and asks.
**`inferred-from-source` is retired.** Claude does not infer. If there is no
source, the value goes into OPEN QUESTIONS and the user is asked.

---

## 6. Code rules

Once "go" is given:

1. Every literal (px, hex color, font-size, padding, timing) must appear in the plan with a source tag.
2. If a value is needed that is NOT in the plan → stop, ask, update plan, wait for "go" again.
3. Touch only the element in scope — no surrounding code changes.
4. TypeScript must pass (`npx tsc --noEmit`) before showing Checkpoint B.
5. No comments that explain what the code does — only comments that cite the FCOM source for a non-obvious value.

---

## 7. Checkpoint B — The result

After code is written and typecheck passes:

```
┌─ THE RESULT ───────────────────────────────────────────────────────┐
FILES CHANGED:    <list>
TYPECHECK:        pass

RENDER DIFF (plan vs implementation):
  | Property     | Plan value  | Code value  | Source tag         | OK? |
  | <prop>       | <value>     | <value>     | [photo/fcom/user]  | ✓/✗ |

VERDICT:   DONE  /  one fix needed  /  needs new spec
└─────────────────────────────────────────────────────────────────────┘
```

**User says "done"** → complete.
**User gives one correction** → one focused fix, then DONE or "needs new spec".
**After one Checkpoint-B iteration → stop.** If still wrong, restart from intake.

---

## 8. Trigger phrases

- **"go"** — approve the intake summary or plan, proceed to next stage.
- **"done"** — element is complete.
- **"Apply this fix"** — surgical change for one named property.
- **"Rebuild this element"** — full rewrite of one named element (restarts from intake).
- **"Match the FCOM spec"** — apply all fcom-sourced divergences in the current assessment.
- **"new spec"** — abandon current work, restart intake from scratch.

Any request to change code WITHOUT one of these phrases → Claude produces an
intake checklist instead and asks which inputs are missing.

---

## 9. Cross-skill coordination

- For procedure/ECAM logic (e.g. "when does SQUIB light come on") → invoke `a320-fcom-trainer`.
- This skill handles only the visual: color, geometry, animation, states.
- If both are needed, `a320-fcom-trainer` produces the logic assessment and this skill produces the visual spec. Both merge into one plan before "go".

---

## 10. Anti-patterns

- ❌ Skipping intake because "we already know what element it is."
- ❌ Using training-data knowledge for any color, size, or position value.
- ❌ Treating `inferred-from-source` as a valid tag (it is removed — ask instead).
- ❌ Writing code while OPEN QUESTIONS exist in the plan.
- ❌ Touching code outside the named element's scope.
- ❌ Iterating more than once after Checkpoint B (restart instead).
- ❌ Designing a "more readable" version that diverges from PICS or FCOM.
- ❌ Proceeding without a photo when the element is visual. Always ask for PICS.
- ❌ Asking the user to re-state §0 hard rules — they are always in effect.

---

## 11. Examples log (self-improving reference)

Every completed element is recorded here. Claude uses these to calibrate
future runs — measurements, FCOM citations, and outcomes from real work.
Add a new entry each time a Checkpoint B passes.

### [2026-05-23] ENG 1 FIRE pb — fire-panel.tsx
- PICS: `~/Desktop/PANELS/fire panel/a320-ovhd-fire-45vu.webp`
- FCOM 4a: DSC-26-20-20 "CONTROLS AND INDICATIONS"
- FCOM 4b: DSC-26-20-10 "DESCRIPTION"
- Key values: pb W:H ≈ 2.0 `[photo]` — FIRE face RED `[fcom:4a:L8241]` — SQUIB WHITE `[fcom:4a:L8265]` — DISCH AMBER `[fcom:4a:L8278]`
- USER INPUTS: separate materials for SQUIB and DISCH cells
- File: `src/components/cockpit/fire-panel.tsx`

### [2026-05-24] ENG 1 AGENT pb — fire-panel.tsx
- PICS: `~/Desktop/PANELS/fire panel/a320-ovhd-fire-45vu.webp`
- FCOM 4a: DSC-26-20-20-10 "AGENT 1(2) PB-SW"
- FCOM 4b: DSC-26-20-10 "DESCRIPTION"
- Key values: pb roughly square `[photo]` — SQUIB WHITE when FIRE pb released `[fcom:4a:L44434]` — DISCH AMBER when bottle loses pressure `[fcom:4a:L44436]` — pb becomes active only after FIRE pb released `[fcom:4a:L44429]`
- File: `src/components/cockpit/fire-panel.tsx`

### [2026-05-25] HYD overhead panel — hyd-panel.tsx (base panel two)
- PICS: `~/Desktop/PANELS/HYD/Hydraulic-Panel.jpg`, `a320-ovhd-hyd-40vu.webp`, `FCOM SHOT.png`
- FCOM 4a: DSC-29-20 (HYD Controls & Indicators)
- FCOM 4b: DSC-29-10 (HYD Description)
- Canonical layout source: `blender/hyd/best_version/hyd_panel_BEST.py` (3-D best version) — React mockup mirrors it
- Six pbs L→R: ENG 1 PUMP, RAT (red guard), BLUE ELEC PUMP, PTU, ENG 2 PUMP, right ELEC PUMP
- Two-cell pbs use 55/45 split with light-gray (`#7A7A7A`) inner frame around BOTTOM cell only (the new §2c rule)
- Function brackets are 3-sided green (open at bottom toward pb)
- Flow art: two horizontal green segments connecting zones, broken around RAT MAN ON and PTU callouts; semicircular dome at BLUE junction only
- File: `src/components/cockpit/hyd-panel.tsx` (work in progress — to be aligned with the Blender best version)
