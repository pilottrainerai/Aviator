"""
rebake_face_no_shadows.py — re-bake the face texture cleanly when it's wrong.

RUN:
  /Applications/Blender.app/Contents/MacOS/Blender -b blender/<panel>/<panel>_work.blend -P blender/_TEMPLATE/rebake_face_no_shadows.py

Use this when the face PNG has shadows under buttons, stray marks, double borders,
or mismatched panel-blue across sections. RE-BAKE — never pixel-patch the PNG
(patches create seams + compounding drift). Hides every other mesh so no shadow
casters bake onto the face, keeps the world HDRI + lights. Does NOT save the .blend.

COMBINED bake (lit) keeps the painted look; for a pure flat albedo use export_glb.py's
DIFFUSE bake instead.
"""
import bpy

# ─────────────────────────── CONFIG (edit per panel) ───────────────────────────
FACE_OBJ = "Curve.001"                       # object carrying the face
OUT_PNG  = "/tmp/rebake_combined.png"        # inspect, then copy into public/models/<panel>_face.png
BAKE_W, BAKE_H = 4096, 860
SAMPLES  = 24
# ────────────────────────────────────────────────────────────────────────────────

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
try:
    scene.cycles.samples = SAMPLES
    scene.cycles.device = 'CPU'
except Exception as e:
    print("cycles cfg:", e)

face = bpy.data.objects[FACE_OBJ]
hidden = []
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name != FACE_OBJ:
        o.hide_render = True; hidden.append(o.name)
print("hidden", len(hidden), "shadow-caster meshes")

img = bpy.data.images.new("rebake", BAKE_W, BAKE_H, alpha=False)
img.generated_color = (0, 0, 0, 1)
nt = face.data.materials[0].node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
nt.nodes.active = tex

bpy.ops.object.select_all(action='DESELECT')
face.select_set(True); bpy.context.view_layer.objects.active = face
scene.render.bake.margin = 16
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = True
print("baking COMBINED ...")
bpy.ops.object.bake(type='COMBINED')
img.filepath_raw = OUT_PNG; img.file_format = 'PNG'; img.save()
print("BAKE DONE ->", OUT_PNG, "  (OPEN it — confirm it isn't black before trusting it)")
