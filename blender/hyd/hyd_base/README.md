# HYD panel — "hyd base" checkpoint (2026-06-17)

The agreed baseline for the HYD panel: fire-panel **hue** + faked metallic **sheen gradient**.
Restore by copying these files back:
- `hyd-panel-3d.tsx` → `src/components/cockpit/hyd-panel-3d.tsx`
- `page.tsx`         → `src/app/dev/hyd-panel-3d/page.tsx`
- `hyd_panel.glb`, `hyd_face.png` → `public/models/`

## Settings baked into this base
Front panel (FACE + Blue base), matched to the FIRE panel's on-screen tone:
- Colour (panelColor) `#3a5572`
- Roughness `0.6`, Metalness `1.5`, Clearcoat `0.4`, Reflections (envMapIntensity) `0.8`
- Sheen gradient (faked, baked into the recoloured face texture): top ×`1.5` → bottom ×`0.5`

## Why these values
The HYD GLB reflects a brighter HDRI region than the fire GLB, so fire's literal `#7e9fc6`
renders pale here. Measured render-sweeps landed on `#3a5572 @ env 0.8` to reproduce fire's
apparent steel-blue (`#344e68`). HYD's geometry can't reproduce fire's metallic gradient
(measured gloss: fire 34 vs flat HYD 16), so a vertical light→dark gradient is baked into the
field to mimic it (raised HYD gloss to ~22). True parity needs a Blender re-bake of the plate.

localStorage key: `hydTune.v13` (bump on any default change so saved tunes don't shadow new defaults).
