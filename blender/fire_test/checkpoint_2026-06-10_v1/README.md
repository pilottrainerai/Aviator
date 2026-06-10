# Fire-test panel — checkpoint 2026-06-10 v1  (~75% complete)

Saved working state of the Blender→GLB fire panel at `/dev/fire-test-panel-3d`.
This is the "important step" snapshot — restore from here if later work breaks it.

## What's in this folder
- `src/fire-test-panel-3d.tsx` — the R3F component (copy of the live one)
- `src/page.tsx` — the dev page (with `?fire=1&pb=1&a1=1&a2=1` state presets)
- `assets/fire_test_panel.glb` — exported model (MESH + FONT labels)
- `assets/fire_test_decals_baked.png` — baked panel-face albedo (steel-blue + markings)
- `assets/braustuble_alley_2k.hdr` — world HDRI used for environment lighting
- `assets/fire_test_work.blend` — working copy of the source (Downloads original untouched)
- `scripts/01_inspect.py` — headless inspector
- `scripts/02_export_glb.py` — bake + export (MESH+FONT)
- `reference_current_state.png` — how it renders now

## To restore
Copy `src/*` back to `src/components/cockpit/` + `src/app/dev/fire-test-panel-3d/`,
and `assets/*` back to `public/models`, `public/hdri`, `blender/fire_test`.

## DONE ✅
- Architecture/pipeline proven: Blender → inspect → bake → GLB → R3F, head-on framing.
- World HDRI loaded as environment (metallic reads as metal, not flat).
- Panel face shows the correct **steel-blue + all white markings** (ENG 1 / APU /
  ENG 2 / AGENT / FIRE / TEST), rendered unlit from the baked albedo.
- **SQUIB / DISCH** text labels exported and visible on the agent buttons.
- Red guarded FIRE-PUSH buttons, hinges, screws present.
- Repeatable procedure written: `blender/PROCEDURE_blender_to_web.md`.

## NOT DONE / NEXT (the remaining ~25%)
1. **Texture not pixel-exact to Blender.** We render the *diffuse albedo* unlit,
   so it lacks Blender's metallic sheen/lighting depth. Options to close the gap:
   get a clean **COMBINED** bake working (failed black headless this round), or
   match a PBR material + lighting that doesn't darken the blue.
2. **Indicator lights not visually firing.** Colours in code are FCOM-correct
   (FIRE=red, SQUIB=white, DISCH=amber), and the meshes exist with material, but
   the emissive isn't visibly lighting in the render — needs debugging (likely
   the `label_white` emissive intensity vs the already-light base, or the unlit
   path). Wired logic is in the component; just not showing.
3. **AGENT 2 timing** has no 30 s FCOM gate (currently enabled right after AGENT 1).
4. A couple of stray `Text.*` FONT objects came along with the labels — verify
   none are redundant when orbiting close.

## Known environment quirks (so the next run is faster)
- Live dev server runs from the **Codex clone**, not `~/Desktop/...`.
- Turbopack HMR went stale repeatedly — hard-restart on frozen renders.
- Headless screenshots need a **fresh `--user-data-dir`** each time.
