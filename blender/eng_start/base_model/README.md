# ENG START panel — BASE MODEL (2026-06-15)

A320 pedestal ENG panel (ENG MASTER 1/2 + ENG MODE selector CRANK/NORM/IGN START).
Converted from `eng start panel.blend` via the blender-panels-to-web skill, reusing the
FIRE FINAL render recipe. Tag: **`eng-start-panel-base-2026-06-15`**.

## Files
| File | Goes to |
|------|---------|
| `eng-start-panel-3d.tsx` | `src/components/cockpit/` |
| `page.tsx` | `src/app/dev/eng-start-panel-3d/` |
| `eng_start_panel.glb` | `public/models/` |
| `eng_start_face.png` | `public/models/` (white markings, transparent) |

## Materials → parts (tunable in the dev edit panel, persisted to `engStartTune.v1`)
- `Blue base` → metallic panel · `metal` → knobs / MODE selector · `black button` → buttons
- `Material.001/.002` → centre piece · `air con decals` → white markings overlay (unlit, on top)

## Status
RENDER-FIRST + per-part edit panel. Interaction (MASTER switches toggle, MODE rotary
turn CRANK/NORM/IGN-START) NOT wired yet — next pass (pull behaviour from a320-fcom-trainer).
Note: decals read MASTER 1/2; the switch buttons read ENG 1/ENG 2 (modeled text).
