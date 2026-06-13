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

## KNOWN ISSUE still open at this checkpoint
- Baked guard shadow remains on the blue panel above the ENG1 FIRE pb in
  fire_test_face_combined_v2.png — to be painted out next.

## Still TEMP (strip before final): top-left status readout + bottom-right tuning panel (page.tsx).
