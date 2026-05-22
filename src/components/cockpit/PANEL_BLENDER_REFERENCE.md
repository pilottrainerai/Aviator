# A320 FIRE Panel — Blender 3D Reference

Companion to [PANEL_DESIGN_BASELINE.md](./PANEL_DESIGN_BASELINE.md).
The baseline doc has px values for the 2D render; this doc converts them
into real-world units suitable for 3D modeling in Blender.

> **Scale rule:** `1 px in the code = 0.25 mm in real life`
> The panel container at 470 × 420 px → 117.5 × 105 mm. That matches the
> approximate real-world size of one overhead panel section on the A320.

If you prefer different units, just multiply consistently — the
proportions are what matter.

---

## 1. Scene setup

| Setting | Value |
|---|---|
| Units | **Metric, millimeters** (Scene Properties → Units → Length: Millimeters) |
| Scale | 1.000 |
| Grid | Enable, 1 mm minor / 10 mm major |
| Camera FOV | 35–50 mm focal length (close to a human eye view at ~600 mm) |
| Lighting | Studio HDRI + 2 area lights (key from upper-front, fill from below-right) |

---

## 2. Panel container (the back plate)

The flat plastic plate everything is mounted on.

| Property | Real-world value | Notes |
|---|---|---|
| Width × Height × Depth | **117.5 mm × 105 mm × 6 mm** | Single section |
| Edge bevel | 0.4 mm, 1 segment | Slight chamfer on outer edges |
| Surface | Matte plastic | Roughness 0.65, no metallic |
| Color (base) | Top-half **#75B5C5** → bottom-half **#5A98A8** | Subtle vertical gradient (use a gradient texture) |
| Corner screws | 4× Phillips screws, each **3 mm dia × 1 mm protrusion**, at corners 3 mm inward | See §7 |

### Material (Principled BSDF)
- Base Color: gradient texture from `#75B5C5` (top) to `#5A98A8` (bottom)
- Roughness: 0.65
- Specular: 0.5
- Metallic: 0.0
- Clearcoat: 0.05 (very subtle plastic sheen)

### Side label
- White-painted **"FIRE"** text running vertically along the left edge.
- Letters stacked top-down, 4 mm tall, 0.5 mm letter-spacing.
- Position: 11 mm inward from left edge, starting 36 mm down from top.
- A 1 mm × 16 mm vertical white stripe runs flush to the left edge of the letters.

---

## 3. ENG 1 FIRE pushbutton (the big guarded one)

### 3.1 Dimensions

| Property | Real-world value |
|---|---|
| Body width × height × depth | **32.75 mm × 24.25 mm × 10 mm** |
| Position from panel front face | protrudes **8 mm** outward |
| Corner radius | 2.5 mm |
| Body bevel | 0.3 mm, 2 segments |
| "Out" travel | when pushed, body moves **−1 mm into the panel** (it depresses, then latches **+1 mm proud** when "out" / pressed) |

### 3.2 Materials — two states

**REST STATE** (no fire, dim baseline)
- Base Color: gradient **#A85A55 → #9A4E49 → #7A3835** (dusky burgundy, top→bottom)
- Roughness: 0.4
- Specular: 0.6
- Emission: 0
- This is what the pb looks like all the time when there's no fire warning.

**LIT STATE** (fire detected OR test pressed)
- Base Color: gradient **#FF2828 → #E81010 → #C80000** (vivid red)
- Emission Color: `#FF3030`, Emission Strength: **6**
- Roughness: 0.25
- Surrounding glow halo: add a 0.5 mm thick emission ring around the body (#FF6060, strength 3)

### 3.3 Legend text — engraved or decal

Two pieces of text on the front face:
- **"FIRE"** — 5.5 mm tall, centered horizontally, 5.5 mm down from top edge
- **"PUSH"** — 2.75 mm tall, centered horizontally, 3.5 mm up from bottom edge

Render as raised text mesh (0.2 mm extrude) or as a decal texture.

| State | Text color | Glow |
|---|---|---|
| Rest | **#5A0808** (very dark red) | none |
| Lit | **#FFFFFF** (white) | Emission `#FFFFFF` strength 4, slight bloom |

Font: bold sans-serif. In Blender, use a Helvetica-like font (Arial, Helvetica Neue, or the included Bfont set to weight Bold).

### 3.4 Four corner red dots (lit state only)

Tiny red emission spots, one at each of the four inner corners of the pb face:
- Diameter: **1.5 mm**
- Distance from corner: 1.5 mm in
- Color: **#FF4040**
- Emission strength: 5 (visible glow even in bright scene)

Hide these in rest state.

### 3.5 Amber "OUT" indicator dot

A small amber dot in the top-right corner indicating mechanical state:
- Diameter: **2 mm**
- Position: 1.5 mm in from top-right corner
- Color: **#FFB300** (amber)
- Emission strength: 4
- **Visible only when:** pb is mechanically out AND no fire warning (i.e., post-extinguish status)

---

## 4. Wire-frame guard cover

The hinged metal cage that flips up to expose the FIRE pb. **Don't model as a true wire frame** — in the actual aircraft it's a clear acrylic cover with a red frame, but the existing 2D design represents it as a wireframe outline. For Blender, model it as a thin curved acrylic plate with a red frame.

### 4.1 Dimensions

| Property | Real-world value |
|---|---|
| Total guard width × height | **24 mm × 4.5 mm** (thin metal strip across the top of the FIRE pb) |
| Outer frame rect | **23.25 mm × 3.75 mm** (stroked rectangle, 0.125 mm inset on all sides) |
| Frame corner radius | 0.375 mm |
| Wire stroke (frame) | **0.45 mm** thick |
| Wire stroke (X diagonals) | **0.375 mm** thick |
| Central pivot dot | **0.8 mm dia** (light gray, where the X diagonals cross) |
| Position | Centered along the top edge of the FIRE pb body |

### 4.2 Materials

**Outer frame (the red cage)**
- Base Color: **#AE3816**
- Roughness: 0.55
- Metallic: 0.05
- Slight emission #5A1A0A strength 0.5 (just enough to read as plastic-coated metal, not bare steel)

**Inner acrylic plate**
- Base Color: clear glass / acrylic — `Glass BSDF` with IOR 1.49
- Transmission: 0.95
- Roughness: 0.15 (slightly textured surface)
- Tint: very faint pink — multiply with `#FFCCCC` at 0.1 alpha

**Highlight reflection line** (optional)
- A thin angled white-pink streak across the top — fake spec highlight.
- Color: `rgba(255, 160, 160, 0.28)` → emissive plane angled 8° from horizontal.

### 4.3 Hinge knuckles

Two small metal pivot spheres at the top-left and top-right corners of the
FIRE pb body — the guard rotates around the axis through them. (No central
hinge bar.)

- Diameter: **1.25 mm** each
- Position: at the top corners of the FIRE pb body, 0.25 mm in from each side
- Outer body: **#1D1818** (very dark gray)

### 4.4 Animation pivot

The guard rotates around the axis connecting the two hinge knuckles:

| Animation | Closed angle | Open angle |
|---|---|---|
| Closed (covers top edge of pb) | 0° | |
| Lifted (pb actionable) | | **−115° around X-axis** (back-and-up) |

Pivot axis: horizontal line through both hinge knuckles, just above the top
edge of the FIRE pb body. Transition: 0.45 s cubic-bezier(0.4, 0, 0.2, 1).
Use an empty as parent.

---

## 5. AGENT 1 & AGENT 2 pushbuttons (the smaller two-cell ones)

Two identical pbs sit BELOW the FIRE pb, side by side. Each is a rectangular pb with two stacked cells (SQUIB on top, DISCH on bottom).

### 5.1 Dimensions

| Property | Real-world value |
|---|---|
| Body width × height × depth | **12.5 mm × 14 mm × 6 mm** |
| Cell gap (between SQUIB and DISCH) | 0.5 mm |
| Cell padding (from body edge) | 0.75 mm |
| Corner radius | 1 mm |
| Protrusion from panel | 4 mm outward |

### 5.2 Materials

**Bezel (the pb body)**
- Base Color: **#1E2430** (very dark blue-gray)
- Roughness: 0.45
- Metallic: 0.0
- Border outline: **#3A4252**, 0.4 mm wide ring around the cells

**SQUIB cell** (top half)
- Background: **#06080C** (near-black, always — even when lit)
- Letters: 2.25 mm tall, weight bold, "SQUIB"
- 3 states:
  | State | Letter color | Emission |
  |---|---|---|
  | Rest (no fire) | **#3A4252** (dim gray) | 0 |
  | Armed (fire pb out, < 10 s) | **#FFB300** (amber, pulsing — see §8) | strength 4 |
  | Active (fire pb out, ≥ 10 s) | **#E8ECF4** (white) | strength 5 |
  | Discharged (this agent pressed) | hidden (transparent) | 0 |

**DISCH cell** (bottom half)
- Background: **#06080C** (near-black, always)
- Letters: 2.25 mm tall, weight bold, "DISCH"
- 2 states:
  | State | Letter color | Emission |
  |---|---|---|
  | Rest (or armed only) | **#3A4252** (dim) | 0 |
  | Discharged | **#FFB300** (amber) | strength 5 |

### 5.3 White outline halo (when pb is mechanically out)

When the FIRE pb is mechanically out, the AGENT pbs get a white outline ring (signifies they're ready to be pressed):
- Outline: 0.5 mm × 0.5 mm offset, color **#FFFFFF**
- Inner dark ring (in the 0.5 mm gap between body and outline): **rgba(20,28,38,0.95)** — reads as a recessed shadow

In Blender: use a thin emission ring mesh around the body, plus a slightly inset dark ring.

### 5.4 Label below pb

"AGENT 1" or "AGENT 2" printed white text below each pb:
- Font: sans-serif bold
- Size: 2.75 mm tall
- Position: 0.5 mm below the pb body
- Color: **#E5E7EB** (very light gray)

---

## 6. TEST pushbutton (the small round one)

A small circular pb at the bottom-center of the section, used for fire-detection tests.

| Property | Real-world value |
|---|---|
| Diameter × depth | **6.5 mm × 4 mm** |
| Body color | **#000000** matte black |
| Roughness | 0.6 |
| Centre dot | 1.5 mm dia, **#FFFFFF** painted dot, raised 0.1 mm |
| Position | Below the AGENT pbs, on the center axis of the section |
| Label above | "TEST", 2.75 mm tall, **#D1D5DB**, 1 mm above the pb |

---

## 7. Phillips-head corner screws

Realistic flush screws at the 4 corners of the panel section.

| Property | Real-world value |
|---|---|
| Head diameter × depth | **3 mm × 1 mm protrusion** |
| Head material | Brushed steel — `Principled BSDF`, Metallic 1.0, Roughness 0.3, Base `#C8CCD4` |
| Phillips cross | 0.5 mm deep, ~30° angle off horizontal |
| Position | 1.5 mm in from outer edge, all 4 corners |

The 30° rotation of the cross slot is intentional — matches real installed screws (someone tightened them down once and stopped where they stopped).

---

## 8. Animations / keyframes for 3D

Same logic as the 2D version. For each, use an empty parent + driver:

### 8.1 Wire guard lift
- Closed → Open: rotate guard parent **−120° around X-axis** (in 0.5 s, ease-out cubic)
- Closed when `guardOpen == false`; Open when `guardOpen || firePbOut`.

### 8.2 FIRE pb depress + pop
- Idle: pb mesh at base position
- Pressed-down (held): pb mesh shifts **−1 mm along panel-normal**
- Latched out: pb mesh shifts **+1 mm along panel-normal**

### 8.3 SQUIB arming pulse (10 s after FIRE pb out)

Animate SQUIB cell letter emission strength:
```
0.0s  emission = 1.0
0.5s  emission = 5.0
1.0s  emission = 1.0
```
Loop until 10 s elapsed, then steady at 5.0 (armed) or visibility off (discharged).

### 8.4 FIRE light steady flash (when lit)

Subtle pulse on the FIRE pb body emission:
```
0.0s  strength 6
1.0s  strength 5.5
2.0s  strength 6
```
Slow breathing — not a hard blink.

---

## 9. State summary — visible elements per state

| Scenario | FIRE body | FIRE letters | Guard | AGENT outline | SQUIB | DISCH | OUT dot |
|---|---|---|---|---|---|---|---|
| Normal flight | Rest red (dim) | Dark red | Closed | none | Dim | Dim | hidden |
| TEST pressed | Bright red | White | Closed | white | Armed (amber pulse) | Armed (amber) | hidden |
| Fire detected | Bright red | White | Closed | none | Dim | Dim | hidden |
| Guard lifted (post fire) | Bright red | White | **Open 120°** | none | Dim | Dim | hidden |
| FIRE pb pressed (out) | Bright red | White | Open | **white** | Arming pulse → Armed (10 s) | Dim | hidden |
| AGENT 1 pressed | Bright red | White | Open | white | A1 hidden | **A1 amber lit** | hidden |
| Fire extinguished | Rest red (dim) | Dark red | Open | white | Hidden / Dim | A1 amber (still discharged) | **amber dot lit** |

---

## 10. Reference photos to study

Photos in `~/Desktop/snap avia/`:
- `419474405-A320-cockpit.pdf` — A320 cockpit familiarization (has overhead panel shots)

Online searches:
- "A320 overhead panel ENG 1 FIRE button"
- "A320 fire panel AGENT pb-sw"

When in doubt, match the **proportions** in the photos and use the colors from §3–§7.

---

## 11. Suggested Blender build order

1. **Panel back plate** (§2) — flat box, set up materials first
2. **Add corner screws** (§7) — Array modifier might help if you want them parametric
3. **FIRE pb body** (§3) — basic cube with bevel, set up rest + lit materials as a slot, drive emission with a custom property
4. **Legend text on FIRE pb** (§3.3) — text objects or decal
5. **Corner red dots** (§3.4) — small UV spheres or planes with emission
6. **Wire guard frame + acrylic** (§4) — extrude curve for frame, separate plate for acrylic
7. **Hinge** (§4.3) — short cylinder + bar
8. **Parent guard + hinge to empty for rotation** (§4.4)
9. **AGENT pb bodies** (§5) — duplicate × 2, position side-by-side
10. **SQUIB / DISCH cells** (§5.2) — separate emission planes per cell
11. **AGENT labels** (§5.4) — text objects
12. **TEST pb** (§6) — small cylinder + dot

Save each completed asset as a Blender collection so you can re-use it on other overhead panels (HYD, ELEC, BLEED).

---

## 12. Material library — Principled BSDF presets

Save these as material slots you can re-apply across components.

| Name | Base Color | Roughness | Metallic | Emission | Notes |
|---|---|---|---|---|---|
| `panel.plastic.teal` | gradient #75B5C5 → #5A98A8 | 0.65 | 0 | — | Back plate |
| `panel.frame.dark` | #1D1818 | 0.6 | 0 | — | Edge frame, hinge |
| `panel.metal.steel` | #C8CCD4 | 0.3 | 1.0 | — | Screws |
| `pb.body.dim_red` | gradient #A85A55 → #7A3835 | 0.4 | 0 | — | FIRE pb rest |
| `pb.body.lit_red` | gradient #FF2828 → #C80000 | 0.25 | 0 | #FF3030 strength 6 | FIRE pb fire |
| `pb.body.dark` | #1E2430 | 0.45 | 0 | — | AGENT bezel |
| `pb.cell.dark` | #06080C | 0.55 | 0 | — | SQUIB/DISCH backgrounds (always) |
| `pb.letter.dim` | #3A4252 | 0.5 | 0 | — | Cell letters rest |
| `pb.letter.amber` | #FFB300 | 0.4 | 0 | #FFB300 strength 5 | DISCH lit / SQUIB arming |
| `pb.letter.white` | #E8ECF4 | 0.3 | 0 | #FFFFFF strength 5 | SQUIB armed (after 10 s) |
| `guard.frame.red` | #AE3816 | 0.55 | 0.05 | #5A1A0A strength 0.5 | Guard outer frame |
| `guard.glass` | Glass BSDF, IOR 1.49, tint #FFCCCC 10% | 0.15 | — | — | Guard acrylic pane |
| `pb.test.black` | #000000 | 0.6 | 0 | — | TEST pb body |

---

## 13. FCOM source for the geometry

Authoritative — match these references when in doubt:
- **DSC-26-20-20** — fire panel layout + element behavior (ENG 1 FIRE pb, AGENT pb-sw, FIRE TEST pb)
- **DSC-26-20-20 P 1/6 to P 2/6** — pb function descriptions
- **DSC-31-15** — ECAM display behavior (for the matching lit-state colors)

Greppable in `~/.claude/manuals/a320/fcom-full.txt`.

---

## 14. Notes for the artist

- **Don't make it shiny.** Real cockpit overhead panels are matte. Roughness 0.4–0.7 everywhere except the screw heads.
- **The "lit" colors are emission, not just base color.** Use Principled BSDF's Emission slot. Strength values in this doc assume a moderately-lit scene (HDRI strength ~0.5–1.0).
- **Wire guard acrylic should refract slightly.** Bump up the Glass BSDF IOR if it looks too flat.
- **Letter spacing matters.** Look at the photos — the letters are airy, not crammed. Letter-spacing values in the baseline doc (0.06 em, 0.14 em, etc.) translate to Blender as `Text → Spacing → Characters: 1.10–1.18`.
- **Animation timing should be subtle.** The breathing pulse on the lit FIRE pb is barely perceptible; just enough to suggest electronics, not a strobe.

When you have a draft scene, share the render and I'll cross-check it against this spec.
