# Fire-test panel — checkpoint 2026-06-10 v2  (~85%, end of day)

Improved snapshot of `/dev/fire-test-panel-3d`. This is the resume point for
tomorrow. Committed to git (branch `fire-test-panel-wip-2026-06-10`) so it
survives a terminal/laptop crash. v1 (earlier, ~75%) is kept alongside.

## What's in this folder
- `src/fire-test-panel-3d.tsx` — the R3F component (live copy)
- `src/page.tsx` — dev page (URL presets: `?fire=1&pb=1&a1=1&a2=1`)
- `assets/fire_test_panel.glb` — model (MESH + FONT labels + legend Planes)
- `assets/fire_test_decals_baked.png` — baked panel-face albedo (steel-blue + markings)
- `assets/braustuble_alley_2k.hdr` — world HDRI for environment lighting
- `assets/fire_test_work.blend` — working copy of source (Downloads original untouched)
- `scripts/01_inspect.py`, `scripts/02_export_glb.py` — inspect + bake/export
- `reference_face_sheen.png`, `reference_disch_amber.png` — how it renders now

## To restore
Copy `src/*` → `src/components/cockpit/` + `src/app/dev/fire-test-panel-3d/`,
`assets/*` → `public/models`, `public/hdri`, `blender/fire_test`.

## DONE since v1 ✅
- **Panel colour** corrected to Blender steel-blue (baked albedo via emissive).
- **Texture sheen** added — emissive albedo + metallic layer reflects the HDRI,
  so it has Blender-like sheen instead of flat (no longer near-black).
- **SQUIB / DISCH white legend boxes** now render (the `Plane*` objects were the
  legend windows; they were being wrongly detached — now kept, `legend_box` mat).
- **Lights work**: DISCH legend illuminates **amber** when discharged (FCOM
  DSC-26-20-20), SQUIB goes off on that agent. Root cause fixed: GLTFLoader
  converts spaces→underscores in names (`DISH 1`→`DISH_1`), so every multi-word
  lookup was silently missing — also re-enabled FIRE-pb pop + agent-press anim.
- Colours FCOM-verified: FIRE pb red, SQUIB white, DISCH amber.

## NEXT (tomorrow) — the remaining ~15%
1. **SQUIB white** is subtle (thin text glow, no box behind it like DISCH). Give
   SQUIB a legend box / stronger glow so it reads as clearly as DISCH amber.
2. **Texture** closer but not 100% pixel-identical to Blender. Fine-tune
   metalness/roughness or get a clean COMBINED bake (failed black headless —
   note: the 17067px decal exceeds Cycles GPU 16384 limit; downscale + CPU).
3. **AGENT 2** has no 30 s FCOM timing gate (currently armed right after AGENT 1).
4. Verify SQUIB-white + AGENT-2 states via the URL presets.

## Key know-how (so tomorrow is fast)
- Full repeatable pipeline: `blender/PROCEDURE_blender_to_web.md`.
- Live dev server runs from the **Codex clone**, not `~/Desktop/...`.
- GLTFLoader name mangling: spaces→`_`, dots dropped → match meshes by **material
  name** where possible; for text labels use the underscore form.
- Headless screenshot: fresh `--user-data-dir` each time; hard-restart dev server
  when HMR goes stale; CPU render + downscaled decal for ground-truth renders.
