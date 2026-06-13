# Checkpoint 2026-06-13 — legend behaviour + authentic amber

User-approved state of the ENG1 FIRE drill legends.

## What's good here (verified via headless CDP click-driver + screenshots)
- Guard click no longer shadows the FIRE pb (handleClick gates guard on !guardOpen).
- AGENT cap NEVER illuminates — only the SQUIB/DISCH legend WORDS indicate.
- Legend = glowing TEXT (MeshBasicMaterial, unlit, flat colour, depthTest off,
  renderOrder 30) so hue is exact: OFF = dim grey #41464d, SQUIB on = #ffffff,
  DISCH on = #ff9f00 (true Airbus amber; lit MeshStandard + NoToneMapping clipped
  it to yellow — flat unlit fixes that). Glow halo sprite DISABLED (was spilling).
- Sequence: cold = both dim -> push FIRE pb = SQUIB white -> discharge = DISCH amber.

## Baked guard shadow — FIXED
- Painted the soft guard shadow off the blue panel above the ENG1 FIRE pb.
  New texture: fire_test_face_combined_v3.png (per-row clean-blue lift of the
  darker bluish pixels; cutouts/text/screws preserved). FACE_TEX_URL points to v3.

## Still TEMP (strip before final): top-left status readout + bottom-right tuning panel (page.tsx).
