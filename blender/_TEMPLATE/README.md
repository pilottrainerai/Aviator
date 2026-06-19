# Blender → GLB — reusable template (start every new panel here)

Generalized from the proven FIRE panel (`blender/fire_test/`). Copy these scripts,
edit the CONFIG block at the top of each, run in order. Fuller prose lives in
`blender/PROCEDURE_blender_to_web.md` and the `blender-panels-to-web` skill (§2–§3, §10).

## Golden rule — GLB export silently DROPS three things from a Cycles scene
Every conversion failure traces to one of these. Plan for them up front:
1. **World HDRI** — GLB carries no world. Metals look dead without it → re-load in the component.
2. **Non-Principled materials** (Mix-Shader / procedural / decal graph) → export as garbage → **bake** to a flat PNG.
3. **Non-MESH objects** (FONT text labels, CURVE) → dropped unless explicitly selected on export.

## Run order
| # | Step | Script | Output |
|---|------|--------|--------|
| 0 | Copy source out of Downloads, work on the copy | — | `blender/<panel>/<panel>_work.blend` |
| 1 | Inspect headless (read-only) | `01_inspect.py` | engine/view-transform, materials, HDRI, object types, bbox |
| 2 | Save world HDRI → `/public/hdri/<hdri>_2k.hdr` | (snippet below) | env map for the component |
| 3 | Bake face + export GLB | `export_glb.py` | `public/models/<panel>_panel.glb` + `<panel>_face.png` |
| 3b| Face texture wrong? re-bake (don't pixel-patch) | `rebake_face_no_shadows.py` | `/tmp/rebake_combined.png` |
| 4 | Build the R3F component (copy FINAL FIRE component) | — | `src/components/cockpit/<panel>-3d.tsx` |
| 5 | Verify headless (fresh Chrome profile each time) | (snippet below) | screenshot + no JS errors |

### Step 2 — save the world HDRI (run inside Blender)
```python
env = bpy.data.images['<hdri>.exr']; env.file_format='HDR'
env.filepath_raw='<REPO>/public/hdri/<hdri>_2k.hdr'; env.scale(2048,1024); env.save()
```
Component: `<Environment files="/hdri/<hdri>_2k.hdr" environmentIntensity={1.5} />`

### Step 5 — headless verify (use a FRESH --user-data-dir or you get a stale cached frame)
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --use-gl=angle --use-angle=metal --user-data-dir=/tmp/cpFRESH --no-first-run \
  --window-size=1500,950 --virtual-time-budget=15000 \
  --screenshot=/tmp/shot.png "http://localhost:3004/dev/<panel>-3d"
```
HMR goes stale across many edits — hard-restart: `kill; rm -rf .next; PORT=3004 npm run dev`.

## Component-side gotchas (so the GLB renders faithfully)
- **Match Blender's view transform.** Standard → `gl={{ toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}`. No ACES/exposure (washes out).
- **Find meshes by MATERIAL NAME + world position, never node name** — `GLTFLoader` sanitizes names (`Curve.001` → unmatchable) and splits multi-primitive nodes into Groups.
- **Black canvas / camera aimed at nothing** → call `group.updateWorldMatrix(true,true)` BEFORE any `Box3.setFromObject`.
- **Framing**: measure the face plate, view along its thinnest axis, fit the two larger extents; detach Blender lamp/backdrop `Plane` meshes first.
- **Face** = lit `MeshPhysicalMaterial` (metallic finish); **legend words** stay unlit `MeshBasicMaterial` (`toneMapped:false`, `depthTest:false`, high `renderOrder`). See skill §10 for the metallic finish + text-protect mask.
- **NEVER bake rotation on export** — destroys guards relying on authored open-pose node rotation. Object MOVE or `transform_apply(scale=True)` is safe; rotation/location bakes are risky.

## Definition of done
GLB + face PNG in `public/models/`, component renders faithfully and is clickable per FCOM/FO logic,
headless verify passes with no JS errors → copy the 4 files (page, component, GLB, face PNG) into
`blender/<panel>/base_model/` with a README + cold preview, then commit as the rollback checkpoint.
