---
name: overhead-bom
description: BOM/template catalog for A320 overhead-panel controls — enforces FCOM-first lookup and template deduplication when modeling cockpit panels in Blender / Unreal. Before creating any new 3D pb-sw, guard, rotary, knob, or toggle, (1) consult the FCOM PDF illustration AND text for the panel, (2) find the matching template in `references/OVERHEAD_PANEL_BOM.md`; only add a new template if no existing one fits. Trigger on any task that involves modeling, exporting, or laying out overhead-panel hardware in Blender for the Aviator simulator, especially when the prompt mentions "build a panel," "model HYD / FUEL / ELEC / FIRE / etc.," "Unreal export," or "how many pb-sw types do we have."
---

# Overhead Panel BOM Skill

You are working on **Aviator** — an A320 pilot-training simulator. The 3D
overhead-panel hardware will be modeled once in **Blender** and then
imported into **Unreal Engine**. Without discipline, this becomes 200
nearly-identical pb-sw meshes that all need to be re-tweaked every time
the design changes.

This skill exists to prevent that. It enforces a **template-first,
FCOM-first** workflow: identify the ~12–15 unique 3D control templates
that cover the *entire* overhead panel, build each one in Blender exactly
once, and treat every real-world control as a placement of a template +
a label swap — with every layout decision sourced from FCOM, not memory.

The authoritative catalog is at:
> `references/OVERHEAD_PANEL_BOM.md`

The authoritative FCOM is at:
> `~/Desktop/pilottrainerai/Aviator/414215430-FCOM-A320-Flight-Crew-Operationg-Manual-A320-Iss-20190215-pdf.pdf`
> (3654 pages — use `pdftotext -f START -l END` to navigate)
> Text dump: `~/.claude/manuals/a320/fcom-full.txt`

User-curated reference images live at:
> `/Users/czar/Desktop/PANELS/`
> Organized as one subfolder per panel (e.g. `HYD/`, `OVHD PANEL/`, `ELEC/`).
> Each subfolder holds multiple images: CGI renders, real cockpit photos,
> FCOM screenshots. The user adds to this folder over time. **Always check
> this folder for a matching subfolder before building a panel** — even
> the full-overhead photo in `OVHD PANEL/` is useful for scale anchoring.

---

## 1. MANDATORY pre-build checklist (FCOM-first)

Before placing a single mesh for a new panel:

1. **Check `/Users/czar/Desktop/PANELS/<PANEL>/`** for user-curated
   reference photos. `ls` the folder, `Read` each image. These photos
   are authoritative for: real-world finish/color, layout details
   FCOM omits (bracket art, ON/OFF state appearance, guard colors),
   and proportions/scale anchoring when paired with `OVHD PANEL/`
   wide shots.

2. **Read the FCOM PDF illustration page** for that panel.
   - Find via: `pdftotext -f N -l N+200 PDF | grep "DSC-XX-YY P 1"`
     to locate the page, then `Read` tool with `pages: "N-N+3"`.
   - The illustration is *authoritative* for: pb count, pb order
     left-to-right, cell stacking (which cell is top vs bottom), zone
     groupings (e.g. GREEN/BLUE/YELLOW spans), title placement, and
     any unique markings (vertical AUTO indicator, rack ID, etc.).

3. **Grep the FCOM text dump** for the same panel:
   - `grep -n "DSC-XX-YY" ~/.claude/manuals/a320/fcom-full.txt`
   - Text is authoritative for: control *behavior* (states, fault
     conditions, light meanings) and *light colors* (white / amber /
     blue / green).

4. **Check `references/OVERHEAD_PANEL_BOM.md`** Layer 1 for a
   matching template. If no match, propose adding a new template
   *before* writing geometry code.

5. **Ask the user for a reference photo** ONLY if no photos exist in
   `/Users/czar/Desktop/PANELS/<PANEL>/` and the FCOM illustration is
   unclear or schematic.

5. **Confirm the scale anchor** — the BOM uses one canonical dimension
   (currently `T-PBSW-22-2CELL` cap = 22 × 22 mm) to scale all
   proportional estimates. If the panel suggests a different anchor,
   stop and ask.

**Do not skip steps 1 and 2 even for "obvious" panels.** Last incident:
the HYD panel built without reading DSC-29-20 P 1/8 had RAT in the wrong
position, cells in the wrong order, and missing zone-span brackets. The
PDF illustration would have flagged all three.

## 2. Mandatory 5-layer panel architecture

Every Airbus overhead-panel build MUST contain all five layers, in this
build order:

```
Layer 0  Panel back plate            (teal back plate; cavities cut later)
Layer 1  Painted SCHEMATIC graphics  (green flow lines + ARROWHEADS —
                                      hydraulic/electrical/etc. flow art
                                      printed on the panel face.
                                      ARROWS ARE MANDATORY, NOT OPTIONAL.)
Layer 2  Painted LABEL BOX outlines  (thin white rectangle borders
                                      around every text label, zone or
                                      function — Airbus signature look.
                                      BORDERS ARE MANDATORY.)
Layer 3  Painted TEXT labels         (white text inside the boxes;
                                      uses cockpit font: Futura/Arial Bold)
Layer 4  Pushbutton CAVITIES + bodies (recessed agent-style: cavity cut
                                      through panel + teal ring + WRO +
                                      recessed body)
Layer 5  Lit CELL legends             (illuminated FAULT/OFF/ON cells
                                      inside each pb)
```

**A panel without all five layers is INCOMPLETE.** Specifically:

- **Layer 1 must include arrowheads** at the ends of vertical drops
  (pointing down at the function label) and at the ends of horizontal
  inter-zone connectors (showing flow direction between systems).
  A panel without arrows does not match real Airbus.
- **Layer 2 must surround every text label** — zone labels AND function
  labels — with a thin white rectangular border. Plain floating text
  on the panel face is wrong.

Past incident (2026-05-22): HYD v5 had Layer 2 missing entirely;
v6 added Layer 2 but Layer 1 had no arrows. Both got called out by the
user comparing to the photos. Don't repeat this — when building any
panel, **explicitly verify all 5 layers are present** before reporting
the panel as done.

Build a shared helper for each layer in every panel script:
- `label_box(name, cx, cy, w, h, text, text_size)` — draws Layer-2 white
  outline + Layer-3 text inside in one call
- `flow_line(name, x1, y1, x2, y2, arrow_at='end'|'start'|'both'|None)` —
  draws a Layer-1 green segment **with** an arrowhead (use the
  `arrow_tip(name, x, y, direction)` helper for the triangular tip)
- `arrow_tip(name, x_px, y_px, direction='down'|'up'|'left'|'right')` —
  Layer-1 triangular arrowhead, painted green like the lines
- `build_pbsw_agent_style(...)` — builds Layers 4 + 5 in one call (exists)

When a panel lacks any of these layers naturally (e.g. CB panels have no
schematic art), document it explicitly in the panel's BOM Sources block:
> Layer 1 N/A: this panel has no schematic flow art

## 3. Confidence-tagging every dimension

When writing the build script (or BOM rows), tag each non-trivial size or
position with one of:

| Tag | Meaning |
|---|---|
| `# FCOM ✓` | Read directly from FCOM (text or illustration); cite the page |
| `# proportional` | Derived from FCOM illustration proportions but absolute mm estimated |
| `# anchor` | Comes from the BOM scale anchor (e.g. 22 mm pb cap) |
| `# photo` | Derived from a user-supplied photo |
| `# assumed` | Educated guess based on Airbus convention but no source |

Build scripts must include one comment per significant block citing what
source the values came from. This makes future audits possible.

## 4. When adding new geometry to the catalog (BOM Layer 1 = template catalog, NOT panel Layer 1 = flow art)

Every new template entry MUST include:

- **Template ID** in the form `T-<KIND>-<SIZE-OR-VARIANT>`
- Dimensions (mm) — width × height × depth, with bevel/corner-radius
- Geometry primitive(s) — `box`, `cyl`, `extruded curve`, etc.
- Materials needed (referencing the existing material slot names where
  possible: `pb_black`, `pb_red`, `cell_dark`, `wtext`, etc.)
- States / lit cells / variations
- FCOM ref (`DSC-XX-YY P n/total` — include the page number)
- A note on which existing template, if any, it is a near-duplicate of —
  and why a merge wasn't possible

## 4. When adding instances to Layer 3

Per instance:

- Panel (one of the panels in Layer 2)
- Real-world control name (matches FCOM exactly, e.g. `GREEN ENG 1 PUMP`)
- Template ID it maps to
- Cap labels — **top cell / bottom cell** in FCOM-illustration order
- Lit-state colors per cell, using FCOM-confirmed colors only
- FCOM ref with the page number
- Source flag (FCOM ✓ / photo / assumed)

## 5. When adding a panel to Layer 2

Per panel, add a **Sources** block:

```
Sources:
  FCOM illustration : DSC-29-20 P 1/8 (PDF page 1205)
  FCOM text         : ~/.claude/manuals/a320/fcom-full.txt lines 50800–51100
  Reference photo   : <filename or "none provided">
  Confidence        : layout high (FCOM illus) / dimensions medium (proportional)
```

This makes it auditable later when sizes turn out wrong.

## 6. Read-only by default

This skill is **read-only** unless the user explicitly says one of:

- "update the BOM"
- "add a template"
- "add the instances for <panel>"
- "model the <panel> panel"

For any other request, *consult* the BOM and propose. Do not edit it.

## 7. What to do when FCOM is silent

FCOM does not publish absolute physical dimensions for panels in mm. When
a size is not in FCOM:

1. Use the BOM scale anchor (currently 22 mm pb cap) to set proportions.
2. Ask the user for a reference photo if proportions can't be inferred.
3. If still ambiguous, **stop and ask** rather than improvise. State
   what's known, what's missing, and what assumption you'd make.

## 8. Sibling skills

- **`a320-fcom-trainer`** — procedure/ECAM logic brain. If the task asks
  about *what the control does* (state transitions, ECAM messages),
  defer to that skill for behavior. This one owns *what the control
  looks like* and *how often it appears.*
- **`cockpit-ui`** — owns 2D rendering in `src/components/cockpit/*.tsx`.
  If the task is about React/Canvas/SVG rendering, defer to that skill.
  This one is strictly the 3D / Blender / Unreal layer.

When in doubt, run all relevant skills in parallel; they don't conflict.
