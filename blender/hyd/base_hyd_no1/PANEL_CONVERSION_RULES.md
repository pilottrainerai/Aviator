# Blender to GLB Panel Conversion Rules

## Core Rule

Always refer to this skill before converting any Blender file to GLB.

Do not redraw, recreate, approximate, redesign, or infer Airbus components from memory.

Use the actual Blender model, reference images, dimensions, materials, object hierarchy, naming, and scene structure already provided.

---

## Master Reference Panel

### Primary Reference

The HYDRAULIC PANEL is the master reference for:

- Panel color
- Panel finish
- Surface texture
- Pushbutton color
- Pushbutton border
- Pushbutton neutral position
- Pushbutton movement limits
- Pushbutton light styling
- Fault light styling
- Text styling (for large pushbuttons)

Use the HYDRAULIC PANEL whenever uncertainty exists.

---

## GLB Export Priority

Use the already proven export workflow that successfully brings all Blender objects into the GLB without losing:

- Pushbuttons
- Borders
- Lights
- Text
- Guards
- Switches
- Indicators
- Small meshes
- Hidden functional components
- Separate animated parts

Before export verify:

- All objects are included
- Collections are exported correctly
- Object pivots are preserved
- Materials are preserved
- Text remains readable
- Lights remain functional
- Animatable parts remain separate

---

# PANEL RULES

## Panel Color

Use HYDRAULIC PANEL as the complete material reference.

Match:

- Base panel color
- Roughness
- Metallic value
- Clear coat
- Reflection response
- Surface wear characteristics
- Edge highlights
- Specular response
- Sheen behavior

Replicate the visual appearance of:

- Top surface sheen
- Bottom surface sheen
- Left edge sheen
- Right edge sheen

The goal is visual consistency with the hydraulic panel rather than a flat color approximation.

Do not invent material values.

---

# PUSHBUTTON RULES

## Pushbutton Color

Use HYDRAULIC PANEL pushbutton color.

---

## Pushbutton Border

Use HYDRAULIC PANEL pushbutton border style.

Match:

- Border thickness
- Border color
- Border depth
- Border bevel

---

## Pushbutton Text Rules

### Large Pushbuttons

Use HYDRAULIC PANEL pushbutton text style.

Match:

- Font appearance
- Size
- Alignment
- Positioning
- Airbus styling

### Small Pushbuttons

Use ENG FIRE AGENT pushbutton text style.

Match:

- Font appearance
- Scale
- Positioning
- Airbus styling

---

## Pushbutton Light Rules

Use HYDRAULIC PANEL pushbutton lights as the master reference.

Implement:

### OFF Light

Use hydraulic panel OFF light styling and logic.

Match:

- Text appearance
- Light appearance
- Lens appearance
- Material behavior

### FAULT Light

Use hydraulic panel FAULT light styling and logic.

Match:

- Text appearance
- Illumination style
- Brightness behavior
- Lens material

Do not invent alternative light styles.

---

## Pushbutton Neutral Position

Use HYDRAULIC PANEL pushbutton neutral position.

The button shall:

- Sit in the normal hydraulic-panel resting position
- Maintain Airbus-style depth
- Preserve correct spacing around border

---

## Pushbutton Movement

Use HYDRAULIC PANEL pushbutton travel limits as the primary reference.

Match:

- Rest position
- Pressed position
- Travel distance
- Movement axis
- Depth change

Do not exaggerate travel distance.

Maintain Airbus realism.

---

# DO NOT

- Do not redraw from memory
- Do not rebuild components from scratch
- Do not invent colors
- Do not invent materials
- Do not merge animated objects
- Do not flatten hierarchy
- Do not lose labels
- Do not lose lights
- Do not lose guards
- Do not lose indicators
- Do not lose hidden functional objects
- Do not approximate Airbus appearance

---

# FINAL GLB CHECK

Confirm before export:

✓ Panel base present

✓ Correct hydraulic panel material appearance

✓ Pushbuttons present

✓ Pushbutton borders present

✓ Pushbutton text present

✓ OFF lights present

✓ FAULT lights present

✓ Guards present

✓ Switches present

✓ Indicators present

✓ Animated parts separated

✓ Materials retained

✓ Object pivots preserved

✓ GLB opens correctly

✓ No Blender objects missing

✓ Export contains every required panel component
