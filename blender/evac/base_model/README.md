# EVAC panel — base model (2026-06-16)

Rollback-safe base for the A320 **EVAC** panel (EVAC COMMAND guarded pb + HORN SHUT OFF
pb + CAPT / CAPT & PURS selector). Built via the `blender-panels-to-web` recipe from
`~/Downloads/evac panel.blend`. Live at **localhost:3004/dev/evac-3d**.

## The 4 files that ARE the panel
| File | Goes to |
|------|---------|
| `evac-3d.tsx` | `src/components/cockpit/evac-3d.tsx` |
| `page.tsx` | `src/app/dev/evac-3d/page.tsx` |
| `evac_panel.glb` | `public/models/evac_panel.glb` |
| `evac_face.png` | `public/models/evac_face.png` |

`export_glb.py` = the Blender bake+export script (source `blender/evac/evac_work.blend`).
Previews: `PREVIEW_resting.png` (guard closed), `PREVIEW_command_active.png` (EVAC red + ON white).

## Look (FIRE FINAL §10 treatment)
- Panel blue `#7e9fc6`, metalness 1.5 / roughness 0.6 / clearcoat 0.4 / env 1.0 (reduced-glare steel-blue).
- Face is a LIT MeshPhysical with a **finish mask** (metalness/clearcoat only on blue, text stays matte)
  AND an **albedo recolour** (baked blue → `#7e9fc6` so face matches body; white text untouched).
- Buttons deep black (`#050608`-ish, env 0); pushbutton **surrounds** a distinct `#3b424c` border so caps read as buttons.
- Canvas uses `dpr={cockpitDpr()}` + anisotropy 16 (crisp-cockpit standing rule). `NoToneMapping`, HDRI `braustuble_alley_2k`.

## Moving parts (name-independent: material + authored rotation/size)
- **COMMAND guard** = largest tilted black-button cover (`Plane.010`); hinged on the **rod** (`Cylinder.004`, "Material"),
  swings about world X. Tune default **42° = CLOSED**; lifts to **−90° = OPEN** when active.
- **COMMAND cap** (`Cube.014/.015`) + **EVAC/ON legends** dip in/out on press (FIRE `pressCurve`, 130/60/400 ms).
- **HORN SHUT OFF** = round black button (`Cylinder.008` cap / `Cylinder.007` surround); momentary dip (no light).
- **CAPT selector** lever (`Cylinder.012`, metal) tilts about its base: **CAPT (down)=19°**, **CAPT & PURS (up)=−40°**.

## Light + pushbutton logic — FCOM DSC-23-40-10 (a320-fcom-trainer)
- **COMMAND pb ON** → `EVAC light flashes red` `[fcom:4a]`. Implemented: EVAC legend flashes red **~1.5 Hz** when active.
- **ON legend** → steady **white** when pushed (user spec, FIRE agent-legend style; FCOM defines only EVAC red).
- **HORN SHUT OFF** → "silences the cockpit horn", no light. Momentary press only.
- **CAPT / CAPT & PURS** → CAPT&PURS: alert from cockpit OR cabin; CAPT: cockpit only. (Positions are the 2 detents.)
- Flash rate (1.5 Hz) + ON-white are `simulation-placeholder` choices (FCOM gives no rate / no ON light).

## Interaction
- Position-based 3D clicks (skill §5): click COMMAND (toggle alert) / HORN (momentary) / CAPT (flip detent).
- Dev sandbox also has bottom buttons (EVAC COMMAND / HORN SHUT OFF) + per-part tuning editor + Copy-tune-JSON.

## NOT done yet
- Real-click verified by code review vs the working ENG-START pattern, not an automated CDP click (rig wouldn't run here).
- Guard two-tap (lift then press) not enforced — one COMMAND click does the whole sequence.
- Not yet wired into a scenario / PilotTrain hub. Audio (horn) out of scope.
