# BASE CASE — Blender→GLB engine FIRE panel web treatment (from ENG1)

> **Superseded by the full skill:** `.claude/skills/blender-panels-to-web/SKILL.md`
> is the authoritative, repeatable playbook (intake → export/bake → render →
> interaction code → verify → save base model). This file remains as a quick
> per-section checklist for the FIRE panel specifically.


The proven recipe to make ONE engine section of the fire panel render + behave correctly
on the web. Replicate per section (ENG1 done; APU, ENG2 follow the same steps).

## 0. Source → GLB
- Blender file → export GLB via the project's Blender→GLB skill / `blender/fire_test/export_glb.py`.
- Bake the face markings to a flat albedo PNG (glTF can't carry the Mix-Shader); export FONT+MESH.

## 1. Render fidelity (applies to ALL sections automatically — keyed by MATERIAL name)
- Face (`DECALS` material): MeshBasic UNLIT + baked texture, DoubleSide, NoToneMapping, sRGB.
- Load the SAME HDRI as scene.environment (metals are all reflection).
- Material tweaks: guard/`orange housijng` metalness 0.7; `hinge metal` chrome; `black button`
  caps matte near-black; `Blue base` painted-aluminium physical; FIRE lens = translucent ruby red.

## 2. Per-section part selection (names are unreliable post-GLTFLoader → select by MATERIAL + POSITION)
- FIRE pb: meshes using `fire pb1 LIT`, sorted by world X → [ENG1, APU, ENG2].
- Guard: the large `orange housijng` flip-cover nearest each pb (ENG1 `guard`, APU `Curve.002`, ENG2 `Curve.004`).
- Agents: `black button` caps adjacent to a `legend_box` (Plane) window; ENG1/ENG2 = 2 agents, APU = 1.
- SQUIB/DISCH legends: FONT/`label_white` text meshes; per agent the higher-Z one = SQUIB, lower = DISCH.
- Screws that travel with the pb: small non-guard/non-face meshes within ~0.25 of the pb centre.

## 3. Interaction
- Guard: click lifts it; gate on `!guardOpen` so the open guard's hitbox never swallows the pb click.
- FIRE pb: on push → pop out along the face normal (local +Y); carry its screws within `fireAsmRadius`.
- AGENT: armed once the pb is released; click = momentary press spring + set discharged.

## 4. FCOM legends (DSC-26-20-20)
- SQUIB → WHITE when pb released; DISCH → AMBER (#ff9f00, true Airbus amber) when that agent discharges.
- Render legend WORDS as glowing TEXT: MeshBasic UNLIT (flat hue — a lit material + NoToneMapping
  clips amber→yellow), depthTest off + renderOrder 30 so lit letters sit over the baked-dark text.
  OFF = dim grey #41464d. The CAP never illuminates — only the legend words.

## 5. Texture hygiene
- Paint out baked guard shadows on the panel above each pb (per-row clean-blue lift; preserve cutout/text/screws).
- Keep panel blue uniform across sections: match each section's band to a clean reference section's per-row median.

## 6. Verification toolchain (headless, no deps)
- Headless Chrome WebGL: --headless=new --enable-webgl --ignore-gpu-blocklist --enable-unsafe-swiftshader
  --use-gl=angle --virtual-time-budget=9000 + fresh --user-data-dir.
- Drive real clicks via Node global WebSocket + CDP (Input.dispatchMouseEvent); read state from the
  page's top-left status readout (document.body.innerText). Crop close-ups with Python PIL.
