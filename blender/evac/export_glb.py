"""
export_glb.py — bake the un-exportable face material to a flat PNG, then export the GLB.

RUN:
  /Applications/Blender.app/Contents/MacOS/Blender -b blender/<panel>/<panel>_work.blend -P blender/_TEMPLATE/export_glb.py

Generalized from the proven FIRE-panel script (blender/fire_test/export_glb.py).
Edit the CONFIG block, then run. Does NOT save the .blend.

WHY a bake: glTF only understands Principled BSDF + standard texture hookups. A
Mix-Shader / decal node graph (the painted face) exports as garbage, so we bake its
DIFFUSE albedo to a PNG and rewire the material to a single Principled using that PNG.
Metallic is zeroed during the bake (a metallic surface returns ~no diffuse → bakes BLACK).
"""
import bpy, os

# ─────────────────────────── CONFIG (edit per panel) ───────────────────────────
REPO       = "/Users/czar/Documents/Codex/2026-06-10/pilottrainerai-aviator-https-github-com-pilottrainerai/Aviator"
PANEL      = "evac"                      # public/models/<PANEL>_panel.glb + <PANEL>_face.png
FACE_OBJ   = "Plane.008"                 # the object carrying the painted face/decal sheet
FACE_MAT   = "hydraulic decals"          # its un-exportable MIX_SHADER material (from 01_inspect.py)
BAKE_W, BAKE_H = 4096, 1096              # match the face UV aspect (~3.74:1 from inspect)
FINAL_METAL, FINAL_ROUGH = 0.8, 0.3      # metallic look applied at runtime anyway; this is a sane GLB default
# ────────────────────────────────────────────────────────────────────────────────

FACE_OUT = os.path.join(REPO, f"public/models/{PANEL}_face.png")
GLB_OUT  = os.path.join(REPO, f"public/models/{PANEL}_panel.glb")

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 4

# ── Bake FACE albedo with metallic temporarily zeroed ────────────────────────
obj = bpy.data.objects[FACE_OBJ]
for o in bpy.data.objects:
    o.select_set(False)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

mat = bpy.data.materials[FACE_MAT]
nt = mat.node_tree
saved = []
for n in nt.nodes:
    if n.type == 'BSDF_PRINCIPLED':
        m = n.inputs['Metallic']; saved.append((m, m.default_value)); m.default_value = 0.0

bake_img = bpy.data.images.new(f"{PANEL}_baked", width=BAKE_W, height=BAKE_H, alpha=True)
bnode = nt.nodes.new('ShaderNodeTexImage'); bnode.image = bake_img
nt.nodes.active = bnode; bnode.select = True

scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
scene.render.bake.margin = 16
print("Baking face albedo (metallic zeroed)...")
bpy.ops.object.bake(type='DIFFUSE')

bake_img.file_format = 'PNG'
bake_img.filepath_raw = FACE_OUT
bake_img.save()
print("SAVED baked face ->", os.path.getsize(FACE_OUT))

# Sanity: a black range means the bake failed (headless Cycles is flaky — OPEN the PNG too).
px = list(bake_img.pixels)
print("BAKE R %.3f..%.3f  G %.3f..%.3f  B %.3f..%.3f" % (
    min(px[0::4]), max(px[0::4]), min(px[1::4]), max(px[1::4]), min(px[2::4]), max(px[2::4])))

# ── Rewire FACE material to a single Principled using the baked albedo ────────
for n in list(nt.nodes):
    nt.nodes.remove(n)
out  = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
tex  = nt.nodes.new('ShaderNodeTexImage'); tex.image = bake_img
bake_img.colorspace_settings.name = 'sRGB'
bsdf.inputs['Metallic'].default_value  = FINAL_METAL
bsdf.inputs['Roughness'].default_value = FINAL_ROUGH
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

# ── Export GLB ───────────────────────────────────────────────────────────────
# Select MESH (+ FONT if you have text-label objects — they vanish otherwise).
# NEVER bake rotation on export: export_apply applies modifiers/scale only here;
# a transform_apply(rotation=...) elsewhere would destroy guards that rely on
# authored open-pose node rotation.
for o in bpy.data.objects:
    o.select_set(o.type in {'MESH', 'FONT'})
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT, export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True,
    export_materials='EXPORT', export_image_format='AUTO')
print("SAVED GLB ->", os.path.getsize(GLB_OUT))
print("EXPORT DONE  (did NOT save the .blend — by design)")
