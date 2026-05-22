# A320 Overhead Panel BOM

Authoritative catalog of overhead-panel controls for the Aviator simulator's
Blender → Unreal pipeline. Three layers:

1. **Template Catalog** — the ~12 unique 3D models we build in Blender.
2. **Panel Inventory** — the overhead sub-panels with FCOM section refs.
3. **Instance Map** — every real-world control mapped to its template.

> **Workflow rule**: never model a new pb-sw / knob / guard from scratch.
> Duplicate the template, rename, relabel. Only add a new template if the
> existing ones genuinely can't represent the shape — and document the
> reason in Layer 1.

## Workflow (mandatory before building any panel)

This procedure was added 2026-05-22 after the HYD-v3 panel needed to be
rebuilt because layout was improvised instead of FCOM-sourced.

```
For each panel:
  1. Find FCOM illustration page:
       pdftotext -f START -l END FCOM.pdf | grep "DSC-XX-YY P 1"
  2. Read the page with the Read tool (pages parameter).
  3. Extract: pb count, L→R order, cell stacking, zone spans,
              title placement, rack ID, unique markings.
  4. Grep fcom-full.txt for behavior + light colors.
  5. Look up templates in Layer 1; reuse not rebuild.
  6. Ask user for a reference photo if illustration unclear.
  7. Tag every dimension: FCOM ✓ / proportional / anchor / photo / assumed.
  8. Add a Sources block to the panel's Layer 2 row + Layer 3 entries.
```

**Scale anchor for the entire BOM**: `T-PBSW-22-2CELL` cap = **22 × 22 mm**.
All other dimensions on every panel are derived from this anchor (either
proportionally from FCOM illustrations, or from explicit FCOM text where it
exists). If a panel suggests the anchor is wrong, stop and ask the user
before rebuilding everything.

## Mandatory 5-Layer Panel Architecture

Every Airbus overhead panel is composed of five stacked layers. A build
missing any of them won't read as "Airbus" — the cockpit's signature
look comes from this layered painting + cavity construction.

| Layer | Element | Material | Notes |
|---|---|---|---|
| **0** | Panel back plate (teal box) | `panel` (#33607A) | Cavities cut later; bevel applied first |
| **1** | Schematic flow art (green lines + arrowheads) | `bracket_green` (#3FAA60 + emission) | Painted on panel face; shows hydraulic / electrical / etc. flow direction. May be N/A for panels without system art (CB panels, sign panels) |
| **2** | Label box outlines (white rectangle borders) | `wtext` (white, low emission) | Thin painted rectangles around EVERY text label — zone labels AND function labels. Signature Airbus look. |
| **3** | Text labels (white painted text) | `wtext` | Inside the Layer-2 boxes. Cockpit font: Futura.ttc (or Arial Bold fallback). All cockpit text is bold sans-serif. |
| **4** | Pushbutton cavities + bodies | cavity cut on panel, `teal_ring` ring, `wborder` outline, `pb_black` body | Built by `build_pbsw_agent_style()` helper. Body recessed 0.5 mm below panel front. |
| **5** | Lit cell legends | `cell_dark` cell bg + `dim_text` (rest) / `lit_white`/`lit_amber` (lit) | Inside each pb. FCOM-spec colors: OFF/ON/MAN ON white, FAULT amber. |

**Per-panel script must build layers 0 → 5 in order** (panel back first,
then schematic, then label boxes, then text, then cavities, then cells).
This order matches paint application on the real panel.

**Helpers every panel script should expose:**

```python
def label_box(name, cx_px, cy_px, w_px, h_px, text, text_size_mm):
    """Layer-2 + Layer-3 combo: white rectangular outline + centered text."""

def flow_line(name, x1_px, y1_px, x2_px, y2_px, arrow='end'):
    """Layer-1 green segment with optional arrowhead at end/start/both."""

def build_pbsw_agent_style(name, ax_px, ay_px, btn_px, ...):
    """Layers 4 + 5: cavity + ring + body + cells."""
```

If a panel naturally lacks a layer (e.g., no flow art, no rack ID),
document the omission in the panel's Sources block:
> Layer 1 N/A: this panel has no schematic flow art

> **Source vocabulary**: Airbus uses **pb-sw** (push-button switch) as the
> canonical name for every momentary or latching pushbutton on the
> overhead panel. We use the same term throughout. The cap is the visible
> face; the **legend** is the painted text on the cap; **cells** are the
> separate lit zones on the cap (typically top + bottom).

> **Dimensions** are nominal real-world millimeters. They are derived
> from the FIRE pb spec already in
> `src/components/cockpit/PANEL_BLENDER_REFERENCE.md` (PX = 0.25 mm rule),
> from observed proportions in FCOM panel illustrations, and from
> standardized Airbus cockpit dimensions where published. Treat as
> ±10% — the goal is consistency across our scene, not millimeter-perfect
> reproduction of real hardware.

---

## Layer 1 — Template Catalog

### Push-button switches (pb-sw family)

#### `T-PBSW-22-2CELL` — Standard 2-cell pb-sw
> **The workhorse**. Used by ~80% of overhead controls.

| Property | Value |
|---|---|
| Cap W × H × D | **22 × 22 × 10 mm** (1 mm bevel, 1.5 mm corner radius) |
| Bezel border | 0.4 mm, color `pb_black` border slot |
| Cells | 2 stacked, each ~10 × 10 mm, 0.5 mm gap |
| Cell bg material | `cell_dark` (#06080C, near-black, always) |
| Cell letter size | 2.25 mm tall, bold sans-serif |
| Cell letter material | `dim_text` (rest) → swap to lit-state material when active |
| Protrusion from panel | 1 mm flush-style (see [PANEL_BLENDER_REFERENCE.md](../../../src/components/cockpit/PANEL_BLENDER_REFERENCE.md) v3 convention) |
| FCOM ref | DSC-22 / DSC-24 / DSC-28 / DSC-29 / DSC-30 — pb-sw is the universal control |
| Geometry primitives | 1 × box (body) + 2 × thin box (cell faces) + 2 × text |

**Lit-state colors** (per cell, vary by control):
- `off` — dim gray `#3A4252`
- `on` — white `#E8ECF4` with emission 5
- `ON blue` — Airbus blue `#4F8CFF` (e.g. APU MASTER ON)
- `OFF white` — white `#E8ECF4` (Airbus's "function off" convention)
- `FAULT amber` — `#FFB300`
- `WARN red` — `#FF2828`
- `AVAIL green` — `#00C26B`

**Notes**: Many pbs show only ONE legend lit at a time; cells stay
near-black, only the active text color changes.

#### `T-PBSW-22-1CELL` — Single-legend pb-sw
> Parameter-difference from `T-PBSW-22-2CELL`: one cell instead of two.

| Property | Value |
|---|---|
| Cap W × H × D | **22 × 22 × 10 mm** (same as 2-cell) |
| Cells | 1 (full cap face) |
| Otherwise | identical materials, identical bezel |

**Build note**: In Blender, this is the **same `T-PBSW-22-2CELL` template** with
one cell hidden + the remaining cell scaled to full height. Don't make a
separate mesh.

#### `T-PBSW-22-3CELL` — 3-cell pb-sw (rare)
> 3 stacked cells. Used on a handful of electrical pbs (e.g. some legacy
> EXT PWR variants). Same outer cap, different cell partitioning.

| Property | Value |
|---|---|
| Cap W × H × D | **22 × 22 × 10 mm** |
| Cells | 3 stacked, each ~6.5 × 22 mm |

**Build note**: Same template family. Different cell-partition geometry only.

#### `T-PBSW-AGENT` — Small 2-cell pb-sw
> AGENT pb-sw on each engine + APU FIRE panel. Smaller than the standard
> pb-sw because it lives next to the big guarded FIRE pb.

| Property | Value |
|---|---|
| Cap W × H × D | **14 × 14 × 6 mm** (1 mm corner radius) |
| Cells | 2 stacked (SQUIB top, DISCH bottom) |
| Cell letter | 2.25 mm tall, "SQUIB" / "DISCH" |
| Bezel border | 0.4 mm `pb_black` |
| Protrusion | 0.6 mm (flush style) |
| FCOM ref | DSC-26-20-20 |

**Note**: Geometrically a *scaled-down* `T-PBSW-22-2CELL`. We keep it as a
distinct template because the size diff (14 vs 22) is too large to call a
variant — and the cell labels are fixed.

---

### Guarded push-button switches

#### `T-GUARDED-LRG` — Large guarded latching pb (FIRE-style)
> The big red guarded pushbuttons on the ENG FIRE / APU FIRE panel.

| Property | Value |
|---|---|
| Cap W × H × D | **32.75 × 24.25 × 10 mm** (2.5 mm corner radius, 0.3 mm bevel) |
| Mechanism | latching — pushed once, stays out; reset manually |
| Guard | hinged metal/acrylic cover; rotates ~115° back-and-up; closed = covers cap |
| Guard outline | 33.5 × 24.5 mm frame + 13.5 × 6.25 mm thumb-tab below |
| Guard hinge | two 1.25 mm dia knuckles at top corners (see PANEL_BLENDER_REFERENCE.md §4.3) |
| Cap material | `pb_red` (rest dim) → emission red `#FF3030` strength 6 when lit |
| Legend cells | 2 (top "FIRE", bottom engine label + "PUSH") |
| Corner indicator dots (lit state) | 4 × 1.5 mm dia, `#FF4040` emission 5 |
| Amber "OUT" indicator | 2 mm dia top-right corner, `#FFB300` emission 4 (shown post-extinguish) |
| FCOM ref | DSC-26-20-20 (ENG FIRE pb) |

#### `T-GUARDED-SML` — Small guarded toggle/pb
> Used on EVAC, GPWS, EMER ELEC MAN ON, IDG DISC, BUS TIE, and similar
> high-consequence single-action controls.

| Property | Value |
|---|---|
| Cap W × H × D | **22 × 22 × 10 mm** (same as standard pb-sw) |
| Guard | small clear/red plastic flip-up cover, 24 × 24 mm |
| Guard rotation | ~110° back-and-up |
| Mechanism | usually latching pb-sw underneath; guard prevents accidental press |
| FCOM ref | varies — DSC-24-30 (IDG), DSC-25-50 (EVAC), DSC-34-40 (GPWS) |

**Note**: The cap underneath is structurally a `T-PBSW-22-2CELL`. The
guard is the only added geometry. Build the guard as a *reusable child*
that attaches to any standard pb-sw.

#### `T-GUARDED-RAT` — Red-guarded RAT MAN ON pb (new 2026-05-22)
> Specific to the RAT MAN ON pushbutton on the HYD panel. Structurally
> distinct from `T-GUARDED-SML` because the guard is a solid red
> opaque cover (not transparent acrylic) hinged at top, and the cap
> underneath is a single-cell momentary pb.

| Property | Value |
|---|---|
| Underlying cap W × H × D | **22 × 22 × 2 mm** (same as `T-PBSW-22-1CELL`) — single cell, "MAN ON" legend (white when lit) |
| Guard cover W × H × D | **24 × 24 × 4 mm**, solid red plastic, opaque |
| Guard color | bright red `#C82010` (slightly darker / less orange than the FIRE guard's `#E81010`) |
| Guard hinge | small dark bar at top edge, ~13 × 2 × 2 mm |
| Guard rotation | 0° (closed, default) → ~115° back-and-up |
| Rest state | guard closed, hides the cap entirely |
| Photo source | `/Users/czar/Desktop/PANELS/HYD/a320-ovhd-hyd-40vu.webp` and `/Users/czar/Desktop/PANELS/HYD/Hydraulic-Panel.jpg` |
| FCOM ref | DSC-29-20 P 2/8 (5) RAT MAN ON pb |

**Build notes**: Reuses the `T-PBSW-22-1CELL` body underneath. The new
geometry is just the red opaque guard + its hinge. When the user lifts
the guard (in Unreal interaction), the cap is exposed and "MAN ON"
legend can light white.

**Why not merge with `T-GUARDED-SML`**: `T-GUARDED-SML` uses a clear
acrylic guard with a red FRAME (FIRE-pb style); this one is a solid red
cover. Different mesh, different material, different visual silhouette.

#### `T-GUARDED-TOGGLE` — Guarded toggle switch
> Less common — used for some 3-position switches that need a guard
> (e.g. EMER EXIT LT in ARM/OFF/ON, certain MAN V/S CTL).

| Property | Value |
|---|---|
| Toggle stem | 12 × 5 × 5 mm |
| Guard | 20 × 16 mm, flips up; mechanism stops at OFF |
| FCOM ref | DSC-25-50 (EMER EXIT LT), DSC-21-30 (CAB PR MAN) |

---

### Rotary / selector knobs

#### `T-KNOB-ROT-3POS` — 3-position rotary selector
> Used by ADIRS mode selectors (OFF / NAV / ATT), X BLEED (OPEN / AUTO /
> SHUT), and similar 3-state knobs.

| Property | Value |
|---|---|
| Knob OD × height | **18 × 14 mm**, knurled side surface |
| Pointer | flat-side or molded arrow on top |
| Material | `pb_black` (dark gray plastic) |
| Position indicator dots | 3 × 1 mm dots painted on panel around knob |
| FCOM ref | DSC-22-30 (ADIRS), DSC-21-30 (X BLEED) |

#### `T-KNOB-ROT-4POS` — 4-position rotary selector
> Used by AUTO BRK (OFF / LO / MED / MAX), ECAM SD page selector, and
> similar 4-state knobs.

| Property | Value |
|---|---|
| Knob OD × height | **20 × 14 mm**, knurled |
| Position indicators | 4 dots painted around knob |
| Otherwise | identical materials/family to `T-KNOB-ROT-3POS` |

**Build note**: Same template family — vary position-dot count and
labels.

#### `T-KNOB-CONT` — Continuous rotary (rheostat / volume)
> Lighting rheostats (DOME, INTEG, MAIN PNL, PED), audio volume.

| Property | Value |
|---|---|
| Knob OD × height | **16 × 12 mm**, knurled |
| Has detent at OFF? | yes for most lighting rheostats |
| Range | continuous (0–100%) |
| FCOM ref | DSC-25-30 (INT LTS) |

#### `T-KNOB-PUSH-PULL` — Push-pull rotary (specialty)
> Used on a few panels where pulling the knob disengages and pushing
> re-engages — e.g. SEAT SLIDE on some variants, some COMM rotaries.
> Rare on the A320 overhead; mostly pedestal.

> **Defer** — likely not needed for overhead BOM. Document if encountered.

---

### Toggle switches

#### `T-TOGGLE-2POS` — 2-position toggle
> Most exterior lights: WING, RWY TURN OFF, TAXI, LAND L/R, NOSE.

| Property | Value |
|---|---|
| Stem L × D | **14 × 5 mm**, chrome-look |
| Positions | UP (typically ON) / DOWN (typically OFF) |
| Mount plate | 12 × 8 × 1 mm raised collar |
| Material | `screw` (brushed steel) for stem; `panel.frame.dark` for collar |
| FCOM ref | DSC-25-40 (EXT LT) |

#### `T-TOGGLE-3POS` — 3-position toggle
> STROBE (AUTO / OFF / ON), some emergency lighting.

| Property | Value |
|---|---|
| Stem | same as 2-pos |
| Positions | UP / CENTER (stable) / DOWN |
| FCOM ref | DSC-25-40 |

---

### Round push-buttons

#### `T-PB-ROUND-SML` — Small round momentary pb
> TEST pbs on FIRE panel, ANN LT TEST, RCL, EMER CANCEL.

| Property | Value |
|---|---|
| OD × depth | **6.5 × 4 mm**, matte black |
| Center dot | 1.5 mm white painted dot, raised 0.1 mm |
| Mechanism | momentary (spring-return) |
| FCOM ref | DSC-26-20-20 (FIRE TEST), DSC-31-15 (RCL, EMER CANCEL) |

#### `T-PB-ROUND-LRG` — Large round momentary pb (rare on overhead)
> Master Warn / Master Caution lights — but these are on the glareshield,
> not the overhead. Listed for completeness.

> **Defer** — glareshield, not overhead.

---

### Annunciator / indicator-only

#### `T-ANN-RECT` — Rectangular annunciator (no push action)
> Pure indicator lights — e.g. LAND RECOVERY, USE MAN PITCH TRIM
> annunciators when applicable.

| Property | Value |
|---|---|
| Face W × H × D | **22 × 11 × 4 mm** |
| Single legend cell |
| FCOM ref | varies |

---

### Materials shared across templates

Defined once in the Blender script; reused by all templates. See `M = {…}`
in any of our fire-panel scripts.

| Material slot | Hex | Used by |
|---|---|---|
| `panel` | varies per panel color (currently `#33607A`) | Panel back plate |
| `screw` | `#C8CED6` (brushed steel) | Phillips screws, toggle stems |
| `pb_red` | `#C04035` | Guarded FIRE pb cap (rest state) |
| `pb_black` | `#1E2430` | All standard pb-sw bezels |
| `cell_dark` | `#06080C` | Cell backgrounds (always) |
| `dim_text` | `#3A4252` | Rest-state cell letters |
| `wtext` | `#E8ECF4` + emission | Lit white legends, panel titles |
| `guard_red` | `#E81010` | Guarded pb cover frame |
| `j_dark` | `#1D1818` | Guard hinge dark body |
| `j_light` | `#A8A7A6` | Guard hinge bright accents |
| `test_blk` | `#000000` | Round TEST pb body |
| `white` | `#FFFFFF` + emission | TEST pb center dot, white indicators |
| `wborder` | `#FFFFFF` + emission (lower) | AGENT pb-sw white outline ring |
| `teal_ring` | `#6E9292` | Decorative teal frame around AGENT pbs |
| `fire_bar` | `#FFFFFF` + emission | Vertical FIRE bar on ENG sections |

---

## Layer 2 — Panel Inventory

The A320 overhead panel is divided into ~20 sub-panels. Listed roughly
top-to-bottom, forward to aft. Each lists FCOM reference and the
**dominant** template families (full enumeration in Layer 3).

| Panel | FCOM | Position | Dominant templates |
|---|---|---|---|
| **CIRCUIT BREAKER PANELS (CB)** | DSC-24-PLP | Outer rim | n/a — CBs not in scope |
| **LIGHTS / SIGNS** | DSC-25-30 | Fwd OHP, left | `T-PBSW-22-1CELL` × ~5 |
| **ADIRS** | DSC-22-30 | Fwd OHP, center | `T-KNOB-ROT-3POS` × 3 (per ADIRU), `T-KNOB-ROT-4POS` × 1 (DSPL SEL), `T-PBSW-22-1CELL` × few |
| **WIPER / RAIN RPLNT** | DSC-30-40 | Fwd OHP, left | `T-KNOB-ROT-3POS` × 2, `T-PBSW-22-1CELL` × 2 |
| **VOICE RCDR / EMER ELEC PWR** | DSC-23-30, DSC-24-30 | Fwd OHP, center | `T-PBSW-22-2CELL`, `T-GUARDED-SML` × 2 (MAN ON, GEN 1 LINE) |
| **OXY** | DSC-35-10 | Fwd OHP, center | `T-PBSW-22-1CELL` × 1, `T-GUARDED-SML` × 1 (MASK MAN ON some variants) |
| **CALLS** | DSC-23-50 | Fwd OHP, right | `T-PBSW-22-1CELL` × several |
| **EVAC** | DSC-25-50 | Fwd OHP, right | `T-GUARDED-SML` × 1 (COMMAND), `T-PBSW-22-1CELL` × 1 (HORN) |
| **ECAM CTL** | DSC-31-50 | Pedestal-fwd | n/a — pedestal, not overhead |
| **EXT LT** | DSC-25-40 | Fwd OHP, center-right | `T-TOGGLE-2POS` × ~6, `T-TOGGLE-3POS` × 1 (STROBE), `T-PBSW-22-1CELL` × 2 (BCN, NAV) |
| **APU** | DSC-49-20 | Fwd OHP, center-right | `T-PBSW-22-2CELL` × 2 (MASTER, START) |
| **CARGO SMOKE** | DSC-26-30 | Fwd OHP, right | `T-GUARDED-SML` × 2 (DISCH AGT 1/2) |
| **WHEEL** | DSC-32-30 | Fwd OHP, right | `T-PBSW-22-2CELL` (A/SKID, N/W STRG), `T-KNOB-ROT-4POS` (AUTO BRK) |
| **AIR COND** | DSC-21-30 | Aft OHP, center | `T-PBSW-22-2CELL` × ~5 (PACK 1/2, HOT AIR, RAM AIR, X BLEED if pb), `T-KNOB-CONT` × 3 (TEMP), `T-KNOB-ROT-3POS` × 1 (X BLEED) |
| **ANTI ICE** | DSC-30-20 | Aft OHP, center-left | `T-PBSW-22-2CELL` × ~4 (WING, ENG 1/2, PROBE/WINDOW HEAT) |
| **CAB PRESS** | DSC-21-20 | Aft OHP, right | `T-PBSW-22-2CELL` × 1 (MODE SEL), `T-PBSW-22-2CELL` × 1 (DITCHING), `T-KNOB-CONT` × 1 (LDG ELEV), `T-TOGGLE-3POS` × 1 (MAN V/S guarded) |
| **ELEC** | DSC-24-20 | Aft OHP, center | `T-PBSW-22-2CELL` × ~10 (BAT 1/2, GEN 1/2, APU GEN, EXT PWR, AC ESS FEED, BUS TIE, COMMERCIAL, GALY & CAB), `T-GUARDED-SML` × 2 (IDG 1/2) |
| **FUEL** | DSC-28-10 | Aft OHP, center | `T-PBSW-22-2CELL` × 6 (L/CTR/R TK PUMP × 2 each), `T-PBSW-22-2CELL` × 1 (MODE SEL), `T-PBSW-22-2CELL` × 1 (X FEED) |
| **HYD** | DSC-29-20 | Aft OHP, center-left | `T-PBSW-22-2CELL` × 5 (GREEN ENG 1 PUMP, YELLOW ENG 2 PUMP, BLUE ELEC PUMP, YELLOW ELEC PUMP, PTU) |
| **ENG FIRE** | DSC-26-20-20 | Aft OHP, center-right | `T-GUARDED-LRG` × 2 (ENG 1, ENG 2 FIRE pb), `T-PBSW-AGENT` × 4 (AGENT 1, 2 per engine), `T-PB-ROUND-SML` × 2 (TEST) |
| **APU FIRE** | DSC-26-20-30 | Aft OHP, center | `T-GUARDED-LRG` × 1, `T-PBSW-AGENT` × 1, `T-PB-ROUND-SML` × 1 |
| **INT LT** | DSC-25-30 | Aft OHP, aft | `T-KNOB-CONT` × ~5 (DOME, INTEG, MAIN PNL, PED, ANN LT BRT/DIM), `T-PB-ROUND-SML` × 1 (ANN LT TEST) |
| **SIGNS** | DSC-25-30 | Aft OHP, aft-right | `T-PBSW-22-2CELL` × 2 (SEAT BELTS, NO SMOKING), `T-TOGGLE-3POS` × 1 (EMER EXIT LT) |

**Estimated unique-template count across the entire overhead panel: 11.**
**Estimated total individual control instances: ~140–170.**
**Reuse ratio: ~13× per template** — exactly the kind of payoff that
makes the template-first workflow worth enforcing.

---

## Layer 3 — Instance Map

Seeded with the FIRE panels (already modeled in Blender). Other panels
are stubs to fill in incrementally — when the user asks "model the
[panel name]" we expand that panel's section here first, then build.

> **Format**: `Panel | Control name | Template ID | Top cell label /
> Bottom cell label | Lit-state colors (top / bottom) | FCOM ref | Notes`

### ENG 1 FIRE (modeled — `eng1_left_panel/`)

| Control name | Template | Top cell | Bottom cell | Lit colors | FCOM | Notes |
|---|---|---|---|---|---|---|
| ENG 1 FIRE pb | `T-GUARDED-LRG` | FIRE | ENG 1 / PUSH | red / red | DSC-26-20-20 | Guard latched closed at rest |
| AGENT 1 (ENG 1) | `T-PBSW-AGENT` | SQUIB | DISCH | white-armed / amber-discharged | DSC-26-20-20 | White outline ring when FIRE pb is out |
| AGENT 2 (ENG 1) | `T-PBSW-AGENT` | SQUIB | DISCH | white-armed / amber-discharged | DSC-26-20-20 | Same as AGENT 1, separate instance |
| FIRE TEST (ENG 1) | `T-PB-ROUND-SML` | n/a | n/a | n/a | DSC-26-20-20 | Center white dot, label "TEST" painted above |

### ENG 2 FIRE

| Control name | Template | Top cell | Bottom cell | Lit colors | FCOM | Notes |
|---|---|---|---|---|---|---|
| ENG 2 FIRE pb | `T-GUARDED-LRG` | FIRE | ENG 2 / PUSH | red / red | DSC-26-20-20 | Mirror of ENG 1 |
| AGENT 1 (ENG 2) | `T-PBSW-AGENT` | SQUIB | DISCH | white / amber | DSC-26-20-20 | |
| AGENT 2 (ENG 2) | `T-PBSW-AGENT` | SQUIB | DISCH | white / amber | DSC-26-20-20 | |
| FIRE TEST (ENG 2) | `T-PB-ROUND-SML` | — | — | — | DSC-26-20-20 | |

### APU FIRE

| Control name | Template | Top cell | Bottom cell | Lit colors | FCOM | Notes |
|---|---|---|---|---|---|---|
| APU FIRE pb | `T-GUARDED-LRG` | FIRE | APU / PUSH | red / red | DSC-26-20-30 | Same template as ENG FIRE |
| AGENT (APU) | `T-PBSW-AGENT` | SQUIB | DISCH | white / amber | DSC-26-20-30 | Only one AGENT, no AGENT 2 |
| FIRE TEST (APU) | `T-PB-ROUND-SML` | — | — | — | DSC-26-20-30 | |

### HYD (FCOM-sourced 2026-05-22)

**Sources:**
- FCOM illustration: DSC-29-20 P 1/8 (PDF page 1205)
- FCOM text:         `~/.claude/manuals/a320/fcom-full.txt` lines ~50800–51100
- Photos (provided 2026-05-22):
  - `/Users/czar/Desktop/PANELS/HYD/Hydraulic-Panel.jpg` (CGI strip)
  - `/Users/czar/Desktop/PANELS/HYD/a320-ovhd-hyd-40vu.webp` (CGI with FAULT/OFF cells clear)
  - `/Users/czar/Desktop/PANELS/OVHD PANEL/A320-Overhead-Panel-Hydraulic-Panel.webp` (real cockpit, HYD in context — scale anchor source)
- Confidence:        layout high (FCOM illus + 3 photos ✓) / dimensions proportional

**Layout (L → R, single row, FCOM ✓):**
ENG 1 PUMP → RAT MAN ON → BLUE ELEC PUMP → PTU → ENG 2 PUMP → YELLOW ELEC PUMP

**Cell stacking per FCOM illustration: FAULT on TOP, OFF/ON on BOTTOM.**

| Control name | Template | Top cell | Bot cell | Lit colors | FCOM | Notes |
|---|---|---|---|---|---|---|
| ENG 1 PUMP | `T-PBSW-22-2CELL` | FAULT | OFF | FAULT amber / OFF white | DSC-29-20 P 1/8 (1) | GREEN system zone |
| RAT MAN ON | `T-GUARDED-RAT` | MAN ON (under guard) | — | MAN ON white | DSC-29-20 P 1/8 (5) | Solid RED guarded pb — guard hides cap when closed (photo-confirmed). Sits between GREEN and BLUE zones |
| BLUE ELEC PUMP | `T-PBSW-22-2CELL` | FAULT | OFF | FAULT amber / OFF white | DSC-29-20 P 1/8 (2) | FCOM annotates "(guarded)" — guard not yet modeled |
| PTU | `T-PBSW-22-2CELL` | FAULT | OFF | FAULT amber / OFF white | DSC-29-20 P 1/8 (4) | Has vertical "AUTO" indicator letters beside pb (not yet modeled) |
| ENG 2 PUMP | `T-PBSW-22-2CELL` | FAULT | OFF | FAULT amber / OFF white | DSC-29-20 P 1/8 (1) | YELLOW system zone, left |
| YELLOW ELEC PUMP | `T-PBSW-22-2CELL` | FAULT | ON | FAULT amber / ON white | DSC-29-20 P 1/8 (3) | Springloaded-ON variant; YELLOW system zone, right |

**Zone labels (above pbs, white, FCOM ✓):**
- `GREEN`  → spans ENG 1 PUMP
- `BLUE`   → spans BLUE ELEC PUMP
- `PTU`    → spans PTU
- `YELLOW` → spans ENG 2 PUMP + YELLOW ELEC PUMP

**Panel-edge markings (FCOM + photo ✓):**
- `HYD` title — vertical letters stacked on **BOTH left AND right edges** (per photo)
- `40VU` rack ID — top-right corner

**Bracket / line art on panel face (photo-confirmed):**
- **GREEN bracket lines** (thin painted green graphics) connect each
  zone label to its pb(s). Each bracket has a horizontal segment at
  the zone-label row and vertical drops to the pbs it covers. Color
  is the same green as the system pressure indicator on ECAM SD —
  Airbus convention for "circuit / connection" graphics on panels.
- **Vertical "AUTO" indicator** beside PTU (and small one next to BLUE
  ELEC PUMP per close-up photo) — column of A/U/T/O letters stacked,
  shows when the pb is in AUTO position.

**Known gaps (now narrowed):**
- BLUE ELEC PUMP guard geometry not yet modeled (FCOM says "guarded",
  not visibly guarded in the user's photos — likely refers to logic
  guard, not physical cover. Confirm with user before adding.)
- Absolute panel dimensions still proportional. Real overhead photo in
  `OVHD PANEL/` will let us anchor HYD width to overall overhead width.

**Build script:** `blender/hyd/hyd_panel_build.py` (in Aviator repo)

### ELEC (stub)

| Control name | Template | Top cell | Bottom cell | Lit colors | FCOM | Notes |
|---|---|---|---|---|---|---|
| BAT 1 | `T-PBSW-22-2CELL` | OFF | FAULT | OFF white / FAULT amber | DSC-24-20 | |
| BAT 2 | `T-PBSW-22-2CELL` | OFF | FAULT | OFF white / FAULT amber | DSC-24-20 | |
| GEN 1 | `T-PBSW-22-2CELL` | OFF | FAULT | OFF white / FAULT amber | DSC-24-20 | |
| GEN 2 | `T-PBSW-22-2CELL` | OFF | FAULT | OFF white / FAULT amber | DSC-24-20 | |
| APU GEN | `T-PBSW-22-2CELL` | OFF | FAULT | OFF white / FAULT amber | DSC-24-20 | |
| EXT PWR | `T-PBSW-22-3CELL` | AVAIL | ON | AVAIL green / ON blue | DSC-24-20 | Lower fault cell on some variants |
| AC ESS FEED | `T-PBSW-22-2CELL` | ALTN | FAULT | ALTN white / FAULT amber | DSC-24-20 | |
| BUS TIE | `T-PBSW-22-2CELL` | AUTO/OFF | FAULT | OFF white / FAULT amber | DSC-24-20 | |
| IDG 1 | `T-GUARDED-SML` | DISC | FAULT | FAULT amber | DSC-24-30 | Guarded — pulling disconnects, irreversible in flight |
| IDG 2 | `T-GUARDED-SML` | DISC | FAULT | FAULT amber | DSC-24-30 | |
| GALY & CAB | `T-PBSW-22-2CELL` | OFF | FAULT | OFF white / FAULT amber | DSC-24-20 | |
| COMMERCIAL | `T-PBSW-22-2CELL` | OFF | FAULT | OFF white / FAULT amber | DSC-24-20 | |

### Other panels — TODO

Fill in as we model each panel. The expansion process per panel:

1. User asks "model the [panel name]" or "what controls are on [panel name]?"
2. Read the FCOM `DSC-XX-YY` section in `~/.claude/manuals/a320/fcom-full.txt`.
3. Extract the control list — name, mechanism, lit-state colors, FCOM ref.
4. For each control, find or add template in Layer 1.
5. Append rows to Layer 3 here.
6. Then (and only then) build the Blender geometry by template duplication.

Panels pending: FUEL, AIR COND, ANTI ICE, CAB PRESS, ADIRS, LIGHTS/SIGNS,
EXT LT, INT LT, EVAC, CALLS, OXY, WIPER, EMER ELEC PWR, VOICE RCDR,
CARGO SMOKE, WHEEL.
