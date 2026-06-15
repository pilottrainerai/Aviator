# FIRE panel — FINAL BASE (2026-06-15)

The shipped look. This replaces the panel in the Pilot Trainer app. Tag: **`fire-panel-FINAL-2026-06-15`**.

`REFERENCE_RENDER.png` is the target look (metallic panel, black agents, all 3 sections, guards closed).

## The 5 files that ARE this panel
| File | Goes to |
|------|---------|
| `fire-test-panel-3d.tsx` | `src/components/cockpit/` |
| `page.tsx` | `src/app/dev/fire-test-panel-3d/` |
| `fire_test_panel.glb` | `public/models/` (geometry — APU cap fixed) |
| `fire_test_face_rebake.png` | `public/models/` (baked blue+text face, 4096-wide) |
| `REFERENCE_RENDER.png` | reference only |

## What's in this final (full recipe in `.claude/skills/blender-panels-to-web/SKILL.md` §10)
- **Metallic finish** baked on the blue panel: roughness 0.6 · metalness 1.5 · clearcoat 0.4 · reflections(envMapIntensity) 1.0 (glare reduced 2026-06-15).
- **Text protected** by a mask derived from the face texture (metalness/clearcoat hit only the blue, never the lettering).
- **Reflections isolated** to the panel (env map bound per-material; FIRE pbs/agents keep constant reflection).
- **Agents:** size-based cap/surround detection; independent black-amount for ENGINE vs APU; caps go true-black at 100.
  - ENG cap 100 / around 80 · APU cap 100 / around 85 (baked defaults).
- **FIRE pb:** translucent ruby lens, lights red on fire, pops out + carries screws.
- **Guards:** authored-open delta (−2.443 rad); lift on click. (Never bake rotation on GLB export — breaks these.)
- **Legends:** SQUIB white / DISCH amber, unlit, on top; readable grey at rest.
- **Lighting:** ambient 0.18 + 2 directionals + HDRI braustuble_alley_2k (fixed env intensity 1.5).

## The APU fix (done in Blender, headless)
APU agent cap was authored ~0.05 behind its surround → moved forward `+0.052` in Blender and re-exported.
Repro: `../move_apu_cap_forward.py`. Pre-fix GLB: `../fire_test_panel.glb.prefix-bak-2026-06-15`.

## Restore
`git checkout fire-panel-FINAL-2026-06-15 -- src/components/cockpit/fire-test-panel-3d.tsx src/app/dev/fire-test-panel-3d/page.tsx public/models/fire_test_panel.glb`
