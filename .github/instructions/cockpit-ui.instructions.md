---
applyTo: "src/components/cockpit/**,src/components/pfd/**,src/components/nd/**,src/components/ewd/**,src/components/sd/**"
---

# Cockpit-UI Skill — FCOM-driven visual brain

Use this skill BEFORE editing or extending any cockpit visual — PFD, ND,
ECAM/EWD/SD, FMA, attitude indicator, speed/altitude/VS tapes, bank scale,
sideslip, FIRE pushbuttons, master switches, glareshield lights, AGENT pb,
OHP indicators, or pedestal controls.

**The single most important rule: your own brain is NOT a valid source.
Every value — color, size, position, animation — must come from PICS,
REFERENCES, or USER INPUTS. If none of the three provide a value, stop
and ask.**

## 0. Hard rules (non-negotiable)

1. **Six inputs before anything else.** No assessment, no plan, no code
   until all six inputs from §1 are collected.
2. **No self-generated values.** Don't invent colors, dimensions, font
   sizes, spacing, animations, or behavior from training data or judgment.
3. **No "approximately".** Every literal in the code must trace to a row
   in the plan that traces to PICS, REFERENCES, or USER INPUTS.
4. **Do not redesign anything not in scope.** Touch only the named element.
5. **No silent refactors.** If asked to fix the FMA, don't also rewrite
   the speed tape.
6. **Photos are measurement sources, FCOM is behaviour source.** If they
   conflict, surface the conflict and ask the user which to follow.
7. **One element at a time.** Push back on "redesign the PFD" — ask which
   element.
8. **No code before "go".** The plan must be approved first.
9. **Font and text must match reference exactly.** Don't choose or
   substitute fonts.
10. **Panel text sizing must match reference.** If PICS show a label at
    a certain size relative to the panel, measure that ratio from the
    photo and use it. If neither PICS nor FCOM provides the size, stop
    and ask — don't guess.
11. **Don't add anything unprompted.** No extra labels, borders, indicators,
    shadows, decorations, or features not in PICS, FCOM, or USER INPUTS.
12. **When in difficulty, stop and discuss.** If uncertain about any value,
    behavior, proportion, or approach — stop immediately and present the
    difficulty.
    Format: "I'm stuck on [X]. Options are [A / B / C]. Which do you want?"

## 1. The six mandatory inputs

1. **NAME / TRIGGER** — What cockpit element? What invoked this skill?
   Examples: "FIRE pb", "FMA speed column", "AGENT pb SQUIB cell"

2. **THE GOAL** — What should it look like or do when done?

3. **PICS** — One or more reference photos. Read for: geometry, colors,
   proportions, typography, borders, states (on/off/armed).
   Do NOT use training-data photos — only what the user provides.

4. **REFERENCES** — TWO specific FCOM sections, both required:
   - **4a. CONTROLS AND INDICATIONS** — primary source for visual states
     and logic (e.g. `DSC-26-20-20 "CONTROLS AND INDICATIONS"`).
   - **4b. SYSTEM DESCRIPTION** — context (e.g. `DSC-26-20-10 "DESCRIPTION"`).
   Without BOTH extracted and confirmed — work stops.

5. **USER INPUTS** — Specific values, corrections, preferences, or
   element-specific constraints. Override PICS and FCOM. "none" is valid.

**Checklist:** all six checked → §2 intake. Any unchecked → ask.

## 2. Intake summary (show before any plan)

```
┌─ INTAKE SUMMARY ───────────────────────────────────────────────────┐
ELEMENT:        <name>
GOAL:           <goal statement>
PHOTOS:         <count> photo(s) received
FCOM (4a):      Controls & Indications — <section code> confirmed
FCOM (4b):      System Description — <section code> confirmed
USER INPUTS:    <list / "none">
RULES:          <list / "none">

PHOTO OBSERVATIONS:
  • <observation> — source: photo

CONTROLS & INDICATIONS EXTRACTS (4a):
  • <indicator>: <behavior / color / trigger> — FCOM <section>, line <N>

SYSTEM DESCRIPTION EXTRACTS (4b):
  • <system context> — FCOM <section>, line <N>

CONFLICTS (photo vs FCOM):
  • <property>: photo=<X>, FCOM=<Y> → awaiting user direction

GAPS:
  • <property>: no source → will ask user before using any value

Ready to build plan? Say "go" to proceed.
└─────────────────────────────────────────────────────────────────────┘
```

CONFLICTS or GAPS → do NOT assume. Ask user to resolve.

## 2a. Layout/alignment — source mapping

| Layout property | Source |
|---|---|
| Panel grid (rows/cols) | FCOM 4b panel layout |
| Pb body dimensions (W × H) | PICS — measure W:H ratio |
| Pb proportions (wider/square/taller) | FCOM 4a + PICS |
| Pb-to-pb spacing | PICS |
| Pb position on panel | PICS |
| Label text on pb | FCOM 4a names each legend |
| Label position within pb | PICS |
| Label font size relative to pb | PICS (% of pb height) |
| Label color (lit vs unlit) | FCOM 4a authoritative |
| Guard size and alignment | PICS |
| User correction | Overrides PICS and FCOM |

If PICS don't show clearly enough to measure → stop and ask for a closer
photo or explicit value. No estimating.

## 2b. Colors and light indications — FCOM only

| Property | Source |
|---|---|
| Pb lit color (red/amber/white/green/blue) | FCOM 4a explicit color name |
| Pb unlit appearance | FCOM 4a "off" state |
| Indicator light color (SQUIB white, DISCH amber, FIRE red) | FCOM 4a |
| Light ON trigger | FCOM 4a "comes on when..." verbatim |
| Light OFF trigger | FCOM 4a "goes off when..." verbatim |
| Flashing/steady/pulsing | FCOM 4a explicit. If silent → simulation-placeholder, ask. |
| Panel body color | PICS (structural, not a system indication) |
| Unlit label color | FCOM 4a if stated; PICS as fallback |

If FCOM 4a does not state a color or trigger explicitly →
`simulation-placeholder`, flag in intake, ask before using.

## 3. Source library and FCOM chapter map

Manuals at `~/.claude/manuals/a320/`:
- `fcom-full.txt` — system descriptions, procedures, controls & indications
- `fctm-full.txt` — technique nuances
- `tasksharing.txt` — CM1/CM2 split
- `callouts.txt` — verbatim PF/PM callouts
- `abnormal-procs.txt`, `abnormal-notes.txt`, `eng-malfunctions.txt`

Reference photos:
- `~/Desktop/PANELS/fire panel/a320-ovhd-fire-45vu.webp` — fire panel
- `~/Desktop/PANELS/HYD/`, `AIR COND/`, `FLTCTL COMP/`, `EVAC/`, `OVHD PANEL/`
- `~/Desktop/FirePanel/eng1_left_panel/` — Blender model

### FCOM chapter map (each element needs BOTH 4a + 4b)

| Element | System Description (4b) | Controls & Indications (4a) |
|---|---|---|
| PFD — Attitude (ADI, pitch, roll, sideslip) | DSC-31-40 GENERAL | DSC-31-40 ATTITUDE DATA |
| PFD — Airspeed tape | DSC-31-40 GENERAL | DSC-31-40 AIRSPEED |
| PFD — Altitude tape | DSC-31-40 GENERAL | DSC-31-40 ALTITUDE |
| PFD — Vertical Speed | DSC-31-40 GENERAL | DSC-31-40 VERTICAL SPEED |
| PFD — Heading / Track | DSC-31-40 GENERAL | DSC-31-40 HEADING |
| PFD — Flight Path Vector | DSC-31-40 GENERAL | DSC-31-40 FLIGHT PATH VECTOR |
| PFD — FD bars / Guidance | DSC-22-30 DESCRIPTION | DSC-31-40 GUIDANCE |
| PFD — FMA | DSC-22-30 DESCRIPTION | DSC-31-40 FLIGHT MODE ANNUNCIATOR |
| ND — All modes | DSC-31-45 GENERAL | DSC-31-45 ROSE/ARC/PLAN MODE |
| ECAM E/WD | DSC-31-30 GENERAL | DSC-31-30 ECAM CONTROLS |
| ECAM SD pages | DSC-31-30 GENERAL | DSC-31-30 SYSTEM DISPLAY |
| Engine display gauges | DSC-70 DESCRIPTION | DSC-31-30 ENGINE PRIMARY |
| FCU / glareshield | DSC-22-10 DESCRIPTION | DSC-22-10 CONTROLS AND INDICATIONS |
| Master Warning / Caution | DSC-31-25 DESCRIPTION | DSC-31-25 MASTER WARN |
| Fire panel — FIRE pb, AGENT pb, ENG MASTER | DSC-26-20-10 DESCRIPTION | DSC-26-20-20 CONTROLS AND INDICATIONS |
| OHP — ELEC | DSC-24 DESCRIPTION | DSC-24 CONTROLS AND INDICATIONS |
| OHP — HYD | DSC-29 DESCRIPTION | DSC-29 CONTROLS AND INDICATIONS |
| OHP — BLEED | DSC-36 DESCRIPTION | DSC-36 CONTROLS AND INDICATIONS |
| OHP — FUEL | DSC-28 DESCRIPTION | DSC-28 CONTROLS AND INDICATIONS |
| Pedestal — thrust levers, ENG MASTER | DSC-70 DESCRIPTION | DSC-22-30 CONTROLS AND INDICATIONS |

## 4. The plan (Checkpoint A — after intake approved)

```
┌─ THE PLAN ─────────────────────────────────────────────────────────┐
ELEMENT:        <name>
SCOPE:          In scope: <X>.  Out of scope: <Y>.
FCOM:           <DSC-XX-YY> — <one-line summary>

MEASUREMENTS (source for every value):
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

OPEN QUESTIONS (no source — must resolve before "go"):
  • <property>: no source — please specify

File:           src/components/cockpit/<file>.tsx
Render mode:    <SVG | canvas | div+CSS>
└─────────────────────────────────────────────────────────────────────┘
```

OPEN QUESTIONS → do NOT proceed. Ask user to resolve.

## 5. Source tags

| Tag | Meaning |
|---|---|
| `[photo]` | Read from user-provided photo |
| `[fcom:4a:LN]` | Controls & Indications, line N |
| `[fcom:4b:LN]` | System Description, line N |
| `[fcom:LN]` | Another FCOM section, line N |
| `[fctm:LN]` | FCTM, line N |
| `[tasksharing:LN]` | tasksharing.txt, line N |
| `[callouts:LN]` | callouts.txt, line N |
| `[user-input]` | Explicitly stated by the user |
| `[simulation-placeholder]` | No source — flagged, user acknowledged |

No tag = not allowed. If no source, stop and ask.
**`inferred-from-source` is retired.** Don't infer — ask.

## 6. Code rules (once "go" is given)

1. Every literal (px, hex, font-size, padding, timing) must appear in the
   plan with a source tag.
2. Value needed but NOT in plan → stop, ask, update plan, get "go" again.
3. Touch only the element in scope.
4. TypeScript must pass (`npx tsc --noEmit`) before Checkpoint B.
5. No comments that explain what the code does — only comments that cite
   the FCOM source for a non-obvious value.

## 7. Checkpoint B — The result

```
┌─ THE RESULT ───────────────────────────────────────────────────────┐
FILES CHANGED:    <list>
TYPECHECK:        pass

RENDER DIFF (plan vs implementation):
  | Property | Plan value | Code value | Source tag | OK? |

VERDICT:   DONE  /  one fix needed  /  needs new spec
└─────────────────────────────────────────────────────────────────────┘
```

After one Checkpoint-B iteration → stop. If still wrong, restart intake.

## 8. Trigger phrases

- **"go"** — approve intake summary or plan, proceed.
- **"done"** — element is complete.
- **"Apply this fix"** — surgical change for one named property.
- **"Rebuild this element"** — full rewrite, restarts intake.
- **"Match the FCOM spec"** — apply all fcom-sourced divergences.
- **"new spec"** — restart intake from scratch.

Any request to change code WITHOUT one of these → produce intake checklist
and ask which inputs are missing.

## 9. Cross-skill coordination

- For procedure/ECAM logic ("when does SQUIB come on") → that's the
  procedures skill, not this one.
- This skill handles only the visual: color, geometry, animation, states.

## 10. Anti-patterns

- ❌ Skipping intake because "we already know what element it is."
- ❌ Using training-data knowledge for any color, size, or position.
- ❌ Treating inferred-from-source as a valid tag.
- ❌ Writing code while OPEN QUESTIONS exist in the plan.
- ❌ Touching code outside the named element's scope.
- ❌ Iterating more than once after Checkpoint B (restart instead).
- ❌ Designing a "more readable" version that diverges from PICS or FCOM.
- ❌ Proceeding without a photo when the element is visual.
- ❌ Asking the user to re-state §0 hard rules — always in effect.

## 11. Examples log

### [2026-05-23] ENG 1 FIRE pb — fire-panel.tsx
- PICS: ~/Desktop/PANELS/fire panel/a320-ovhd-fire-45vu.webp
- FCOM 4a: DSC-26-20-20 — FCOM 4b: DSC-26-20-10
- Values: pb W:H ≈ 2.0 [photo] — FIRE face RED [fcom:4a:L8241] — SQUIB
  WHITE [fcom:4a:L8265] — DISCH AMBER [fcom:4a:L8278]
- USER INPUTS: separate materials for SQUIB and DISCH cells

### [2026-05-24] ENG 1 AGENT pb — fire-panel.tsx
- PICS: ~/Desktop/PANELS/fire panel/a320-ovhd-fire-45vu.webp
- FCOM 4a: DSC-26-20-20-10 "AGENT 1(2) PB-SW" — FCOM 4b: DSC-26-20-10
- Values: pb roughly square [photo] — SQUIB WHITE when FIRE pb released
  [fcom:4a:L44434] — DISCH AMBER when bottle loses pressure
  [fcom:4a:L44436] — pb active only after FIRE pb released [fcom:4a:L44429]
