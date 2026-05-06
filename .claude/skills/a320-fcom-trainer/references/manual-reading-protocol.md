# Manual Reading Protocol

How to navigate Airbus source documents efficiently and cite them correctly.

## The library

All extracted text lives at `~/.claude/manuals/a320/`:

| File | Use when |
|---|---|
| `fcom-full.txt` | Authoritative system descriptions, abnormal/emergency procedures |
| `fctm-full.txt` | Crew technique, judgement, "if/then" nuances |
| `abnormal-procs.txt` | PF/PM tasksharing tables, decision protocols, LAND ASAP semantics |
| `abnormal-notes.txt` | Cross-source gap analysis (ECAM vs QRH vs FCOM differences) |
| `tasksharing.txt` | CM1/CM2 split for normal procedures |
| `eng-malfunctions.txt` | Engine identification + handling techniques |

## FCOM identifier system

The FCOM uses prefixed identifiers like `DSC-49-10-00021423`. Decode:

| Prefix | Meaning | Example |
|---|---|---|
| `LIM-` | Limitations | `LIM-21-10` (AIR limits) |
| `DSC-` | Description (system) | `DSC-26-20-20` (ENG fire panel) |
| `PRO-NOR-` | Normal procedures | `PRO-NOR-SOP-*` |
| `PRO-NOR-SUP-` | Supplementary normal | `PRO-NOR-SUP-ENG` (manual start) |
| `PRO-ABN-` | Abnormal & emergency | `PRO-ABN-ENG` |
| `PRO-ABN-ABN-MEM` | Memory items | red-bordered, pre-ECAM |
| `PRO-ABN-ABN-QRH` | QRH-only procedures | |
| `PRO-ABN-ABN-RESET` | System resets | |

**ATA-style mid-digits** (the number after the first prefix) map to system:

- 21 = AIR / pneumatic
- 22 = AUTO FLT
- 23 = COM
- 24 = ELEC
- 25 = EQUIPMENT
- 26 = FIRE PROTECTION
- 27 = FLIGHT CONTROLS
- 28 = FUEL
- 29 = HYDRAULIC
- 30 = ICE & RAIN
- 31 = INDICATION/RECORDING
- 32 = LANDING GEAR
- 33 = LIGHTS
- 34 = NAVIGATION
- 35 = OXYGEN
- 36 = PNEUMATIC
- 38 = WATER/WASTE
- 49 = APU
- 70/71/72 = ENGINE
- 73 = ENGINE FUEL & CONTROL
- 79 = ENGINE OIL

So `DSC-49-10` = APU description. `DSC-29` = HYD description. `PRO-ABN-ENG`
= engine abnormals (often without the ATA digit because it's the per-system
folder name).

## Per-system PRO-ABN folders (FCOM)

A-ICE · AIR · APU · APUF (APU FIRE) · AUTO_FLT · AVNCS (avionics smoke) ·
BLEED · BRAKES · NWS · CAB_PR · COND · CONFIG · ELEC · **ENG** · F_CTL ·
FUEL · MISC · NAV · SMOKE · SURV

## FCTM section system

FCTM uses different prefixes:

| Prefix | Meaning |
|---|---|
| `AO-` | Aircraft Operation |
| `AS-` | Abnormal Situations |
| `AS-FG-*` | Flight Guidance |
| `AS-FM-*` | Flight Management |
| `AS-RUD` | Rudder |
| `AS-TCAS` | TCAS |
| `AS-WXR` | Weather Radar |
| `AS-BIRD` | Bird strike |
| `AS-ROWROP` | Runway Overrun Warning / Protection |
| `NO-` | Normal Operations |
| `NP-` | Normal Procedures |

Topic-specific entries live by name, e.g. *Engine Tailpipe Fire*, *ENG 1
SHUTDOWN technique*.

## Grep recipes

### Find a procedure by name
```bash
grep -nE "ENG 1\(2\) FIRE" ~/.claude/manuals/a320/fcom-full.txt | head
```
Note: FCOM uses `ENG 1(2) FIRE` (parentheses denote engine 1 *or* 2 — same
procedure for either).

### Find the surrounding context (50 lines after a hit)
```bash
grep -nA 50 "ENG 1(2) FIRE" ~/.claude/manuals/a320/fcom-full.txt | head -60
```

### Find all DSC-49 (APU description) entries
```bash
grep -nE "DSC-49[-_]" ~/.claude/manuals/a320/fcom-full.txt | head -30
```

### Find FCTM technique paragraphs for a topic
```bash
grep -niE "engine.{0,20}fire|tailpipe" ~/.claude/manuals/a320/fctm-full.txt | head
```

### Compare ECAM vs FCOM vs FCTM on the same topic
```bash
for f in ~/.claude/manuals/a320/fcom-full.txt ~/.claude/manuals/a320/fctm-full.txt ~/.claude/manuals/a320/abnormal-notes.txt; do
  echo "=== $f ==="
  grep -niE "<topic>" "$f" | head -10
done
```

## Citation format

Always cite manual + section, like this:

- `[FCOM PRO-ABN-ENG / ENG 1(2) FIRE]`
- `[FCOM DSC-49-10 / APU description]`
- `[FCTM AS-FG-10-1 / Auto Flight technique]`
- `[Abnormal Procedures handbook / ENGINE FAILURE AFTER V1]`
- `[Tasksharing Dec 2020 / Preliminary Cockpit Preparation]`

If you can't pinpoint a section, use page or line:

- `[FCOM line 94660 of fcom-full.txt — ENG 1(2) FIRE on ground]`

## Reading discipline

1. **Before quoting**, read the surrounding context (at least 30 lines
   above and below). Procedures have preconditions and notes that change
   meaning.
2. **L1 lines = actions; L2 lines = notes/explanations.** Don't read L2
   text as if it were an action.
3. **`Note:`, `CAUTION`, `WARNING`** prefixes change behavior — capture
   them.
4. **Conditional branches** (`■ IF UNSUCCESSFUL:`, `● If FLAPS jammed > 0:`)
   are state-machine guards, not flat lists.
5. **FCOM and FCTM may both apply** to the same situation. Quote both
   with separate labels (`official-source-derived: FCOM`, etc.) and surface
   any conflict.

## When the manual is silent

If the source doesn't cover a detail you need:

1. Check sibling manuals (`fctm-full.txt`, `abnormal-notes.txt`).
2. Check QRH structure references in `abnormal-procs.txt`.
3. If still nothing, mark `simulation-placeholder` and ask the user
   whether to pin a value or leave a TODO.

Never invent.
