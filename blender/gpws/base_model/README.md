# GPWS panel — base_model checkpoint (2026-07-06)

A320 GPWS pedestal panel: **TERR · SYS · GPWS G/S MODE · FLAP MODE · LDG FLAP 3**.
Converted from `~/Downloads/Gpws (1).blend` per `blender/PROCEDURE_blender_to_web.md`
(reused the EVAC/HYD bake+export script and the HYD master material treatment — the
same one live in the DUAL HYD G+Y scenario).

## Files (rollback set)
- `gpws-3d.tsx`   → `src/components/cockpit/gpws-3d.tsx`
- `page.tsx`      → `src/app/dev/gpws-3d/page.tsx`   (route: `/dev/gpws-3d`)
- `gpws_panel.glb`→ `public/models/gpws_panel.glb`
- `gpws_face.png` → `public/models/gpws_face.png`    (baked GPWS-DECALS face)
- `REFERENCE_RENDER.png` — the verified headless render

## Recipe notes specific to this panel
- Blend: CYCLES, **view_transform = AgX**; component uses `NoToneMapping` (panel is
  re-lit in three with our HDRI + physical materials, as HYD/EVAC do — matches them).
- Face material = the MIX_SHADER `hydraulic decals` (misnamed; it's `GPWS DECALS.png`,
  27992×8909) → **BAKED** to `gpws_face.png` (4096×1304). Would export as garbage otherwise.
- Bezels/surrounds = **`Material.001`** (metal 1.0) → the HYD "metal" group.
- Body = `Blue base`; caps = `black button`; legends = `emissive`.
- Treatment values MATCHED to `HYD_TUNE_DEFAULT` / base_hyd_no1 (panel #4a8296,
  rough 0.72, metal 1.86, clearcoat 0.6, env 0.5, sheen L0.95/R1.35/T0.95/B0.9).

## LEFT (later FCOM pass — do NOT invent)
- Interactive press feel + legend lights (TERR/SYS/G/S MODE/FLAP MODE "OFF" or
  "FAULT" illumination) per FCOM (a320-fcom-trainer). Render-first only for now.
- Wire into a live scenario (as the HYD panel is), when a GPWS procedure needs it.

## GPWS TEST state (2026-07-06)
cap = canvas black (unlit) · frame + housing = ORIGINAL metallic Material.001 (grey #8b939d) · press N 0.008 / I -0.038 / S -0.009. Reference: REFERENCE_GPWS_TEST.png
