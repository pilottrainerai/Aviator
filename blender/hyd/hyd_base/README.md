# HYD panel — FINAL (2026-06-17)

Final agreed HYD panel: teal-blue, stable metalness, 4-way per-edge sheen.
Restore by copying these files back:
- `hyd-panel-3d.tsx` → `src/components/cockpit/hyd-panel-3d.tsx`
- `page.tsx`         → `src/app/dev/hyd-panel-3d/page.tsx`
- `hyd_panel.glb`, `hyd_face.png` → `public/models/`

## FINAL settings (HYD_TUNE_DEFAULT) — user-confirmed on real screen 2026-06-17
Panel front face:
- Colour (panelColor) **`#4a8c96`** (teal-blue)
- Roughness **0.72**
- Metalness **1.86** (three.js clamps to 1.0 = full mirror) — user's choice; renders teal on the
  real screen with these gentle sheen values. If it ever goes black, drop Metalness to ≤0.8.
- Clearcoat **0.6**
- Reflections (envMapIntensity) **0.5**

Sheen (faked metallic gradient, baked into the recoloured face field) — per-edge brightness ×, 1.0 = neutral:
- Sheen top **0.95**
- Sheen bot **0.9**
- Sheen left **0.95**
- Sheen right **1.35**
- (brightness = horizontal lerp(L,R) × vertical lerp(T,B))

Buttons / cap positions (unchanged):
- Cap `#05070a` · Border/frame `#333949` · RAT switch `#222734`
- Neutral `0.008` · In `-0.041` · Stays `-0.009`

## Notes
- localStorage key `hydTune.v20` (bump on any default change so saved tunes don't shadow new defaults).
- Metalness 0.8 (Blender source) keeps ~20% of the panel's own diffuse colour, so it renders the
  same on every GPU and never goes black. Earlier metalness 1.5–1.86 looked fine in headless tests
  but rendered BLACK on the real screen.
- Editor exposes everything live: Colour, Roughness, Metalness, Clearcoat, Reflections, and the four
  Sheen edge sliders (top/bottom/left/right).
