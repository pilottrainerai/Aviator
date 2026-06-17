# BASE HYD No.1 — MASTER REFERENCE PANEL (2026-06-17)

This is the **clean, definitive HYD panel** and the **master reference** for every other
cockpit panel (per `PANEL_CONVERSION_RULES.md` in this folder). When any other panel is
uncertain about colour / finish / sheen / pushbutton / text / light styling — copy from here.

Git tag: `base-hyd-no1`. Restore by copying these files back:
- `hyd-panel-3d.tsx` → `src/components/cockpit/hyd-panel-3d.tsx`
- `page.tsx`         → `src/app/dev/hyd-panel-3d/page.tsx`
- `hyd_panel.glb`, `hyd_face.png` → `public/models/`

## Locked settings (HYD_TUNE_DEFAULT) — user-confirmed on real screen
Panel front face:
- Colour (panelColor) **`#4a8c96`** (teal-blue)
- Roughness **0.72**
- Metalness **1.86** (three.js clamps to 1.0 = full mirror). If it ever renders BLACK, drop to ≤0.8.
- Clearcoat **0.6**
- Reflections (envMapIntensity) **0.5**

Sheen — faked metallic gradient baked into the recoloured face field, per-edge brightness ×
(brightness = horizontal lerp(L,R) × vertical lerp(T,B); 1.0 = neutral):
- Top **0.95** · Bottom **0.9** · Left **0.95** · Right **1.35**

Pushbuttons / cap positions:
- Cap `#05070a` · Border/frame **`#15171e`** (rgb 21,23,30) · RAT switch `#222734`
- Neutral `0.008` · In `-0.041` · Stays `-0.009`

## Notes
- localStorage key `hydTune.v22` (bump on any default change so saved tunes don't shadow new defaults).
- The HYD editor exposes everything live: Colour, Roughness, Metalness, Clearcoat, Reflections, and
  the four Sheen edge sliders (top/bottom/left/right).
- "We don't need the rest of HYD for now" — this is the agreed clean reference snapshot.
