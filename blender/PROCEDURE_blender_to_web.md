# Blender → Web (GLB) panel conversion — repeatable procedure

This is the playbook for turning a cockpit `.blend` into a faithful interactive
panel on the web (Next.js + React-Three-Fiber). Worked out the hard way on the
ENG fire panel (2026-06-10). Follow it and the next panel should take minutes,
not an hour.

> **Golden rule:** the GLB export drops three things from a Blender/Cycles scene
> — the **world HDRI**, **non-Principled materials** (Mix-Shader / procedural),
> and **non-MESH objects** (FONT/text). Every failure we hit traces back to one
> of those three. Plan for them up front.

---

## 0. Never edit the original
Copy the source out of Downloads into the repo first; work on the copy only.
```
cp "~/Downloads/<name>.blend" blender/<name>/<name>_work.blend
```

## 1. Inspect the .blend headless (read-only) — do this FIRST
Run Blender headless and dump everything you need to plan the conversion:
```
/Applications/Blender.app/Contents/MacOS/Blender -b <name>_work.blend -P scripts/01_inspect.py
```
Capture and write down:
- **Render engine + colour management** → view transform (Standard? AgX? Filmic?).
  Standard → three `NoToneMapping`. AgX/Filmic → needs a matching tone curve.
- **Materials**: which are plain **Principled BSDF** (export fine) vs **Mix-Shader
  / procedural** (will NOT export — must bake). List texture names + sizes.
- **World HDRI** name (e.g. `braustuble_alley_4k.exr`) + background strength.
- **Lights** (point/sun/area) — position + energy.
- **Object types**: MESH vs **FONT** vs CURVE. FONT = text labels (SQUIB, DISCH,
  ENG 1 …). These are dropped unless explicitly exported.
- **Bounding box** + which axis the panel face points along.

## 2. World HDRI → environment
GLB carries no world. Save the env texture out at 2K and load it in three:
```python
env = bpy.data.images['<hdri>.exr']; env.file_format='HDR'
env.filepath_raw='<repo>/public/hdri/<hdri>_2k.hdr'; env.scale(2048,1024); env.save()
```
In the component: `<Environment files="/hdri/<hdri>_2k.hdr" />`.
This is what makes **metallic** surfaces look real instead of dead/flat.

## 3. Un-exportable materials → bake to a flat texture
glTF only understands Principled BSDF + standard texture hookups. A Mix-Shader
(e.g. a decal/markings sheet driving a mix) exports as garbage.
- **Bake DIFFUSE colour** of that material to a PNG (zero metallic first, or a
  metallic surface bakes BLACK).
- ⚠️ **Cycles bake is flaky headless** — OPEN the baked PNG and confirm it isn't
  black before trusting it. Keep the good PNG; re-baking can silently regress.

## 4. Export the GLB
```python
for o in bpy.data.objects:
    o.select_set(o.type in {'MESH','FONT'})   # FONT or your text labels vanish
# give material-less FONT objects a material so they're visible
bpy.ops.export_scene.gltf(filepath=..., export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True, export_materials='EXPORT', export_image_format='AUTO')
```

## 5. The React / R3F component — the gotchas that cost hours
- **Colour management**: match Blender's view transform. Standard → three
  `gl={{ toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}`.
  Do NOT add ACES / exposure — it washes everything out.
- **Baked face texture** (markings plate): render it **UNLIT**
  (`MeshBasicMaterial({ map })`) so scene lighting can't darken the baked colour.
  Give the basic material a `.name` if other code finds the mesh by material name.
- **Finding meshes by name fails**: `GLTFLoader` sanitizes node names
  (`Curve.001` → unmatchable). Find meshes by **material name** instead.
- **Black canvas / camera aimed at nothing**: `Box3.setFromObject` inside
  `useLayoutEffect` reads **stale world matrices**. Call
  `group.updateWorldMatrix(true, true)` BEFORE measuring, or the camera frames
  empty space.
- **Framing**: measure the panel-face plate, view along its thinnest axis (the
  face normal), fit the two larger extents. Detach Blender lamp/backdrop `Plane`
  meshes first — invisible geometry still skews `<Bounds>`/bbox.

## 6. Verify (headless screenshots)
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --use-gl=angle --use-angle=metal --user-data-dir=/tmp/cpFRESH --no-first-run \
  --window-size=1500,950 --virtual-time-budget=15000 \
  --screenshot=/tmp/shot.png "http://localhost:<port>/<route>"
```
- Use a **FRESH `--user-data-dir` every time** — a reused profile serves a stale
  cached frame (identical bytes across different code = this trap).
- **Turbopack HMR goes stale** across many edits — hard-restart the dev server
  (`kill; rm -rf .next; PORT=<p> npm run dev`) when a render looks frozen.
- Add `console.log` of measured dims/camera and read it from
  `--enable-logging=stderr --v=0` output when geometry looks wrong.

## 7. FCOM colours (for indicator lights, A320)
Source: `~/.claude/manuals/a320/fcom-full.txt` (DSC-26-20-20). Verbatim:
- ENG FIRE pb light → **RED**.   SQUIB → **WHITE** (on FIRE-pb release).
- DISCH → **AMBER** (bottle lost pressure). AGENT 1 after **10 s**, AGENT 2 if
  fire after **30 s**. Use the `a320-fcom-trainer` skill before touching these.

---
*First derived on the ENG fire panel, 2026-06-10. See
`fire_test/checkpoint_2026-06-10_v1/` for the worked example + saved state.*
