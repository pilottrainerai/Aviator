"""HYD real model (Downloads/hydraulic.blend1) → GLB. Bakes the 'hydraulic decals'
face (19667px texture) down to a web-sane PNG, rewires to Principled, exports GLB.
Does NOT save the .blend."""
import bpy, os
REPO = "/Users/czar/Documents/Codex/2026-06-10/pilottrainerai-aviator-https-github-com-pilottrainerai/Aviator"
FACE_OBJ, FACE_MAT = "Plane.005", "hydraulic decals"
BAKE_W, BAKE_H = 8192, 1736   # ~4.72:1 (matches 19667x4167 source aspect)
FACE_OUT = os.path.join(REPO, "public/models/hyd_face.png")
GLB_OUT  = os.path.join(REPO, "public/models/hyd_panel.glb")
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 4
obj = bpy.data.objects[FACE_OBJ]
for o in bpy.data.objects: o.select_set(False)
obj.select_set(True); bpy.context.view_layer.objects.active = obj
mat = bpy.data.materials[FACE_MAT]; nt = mat.node_tree
for n in nt.nodes:
    if n.type == 'BSDF_PRINCIPLED':
        n.inputs['Metallic'].default_value = 0.0
img = bpy.data.images.new("hyd_baked", width=BAKE_W, height=BAKE_H, alpha=True)
bn = nt.nodes.new('ShaderNodeTexImage'); bn.image = img; nt.nodes.active = bn; bn.select = True
sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False
sc.render.bake.use_pass_color = True; sc.render.bake.margin = 16
print("Baking face…"); bpy.ops.object.bake(type='DIFFUSE')
img.file_format = 'PNG'; img.filepath_raw = FACE_OUT; img.save()
px = list(img.pixels); print("BAKE R %.2f..%.2f"%(min(px[0::4]),max(px[0::4])), "size", os.path.getsize(FACE_OUT))
# rewire face material to a single Principled using the baked albedo
for n in list(nt.nodes): nt.nodes.remove(n)
out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; img.colorspace_settings.name='sRGB'
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
for o in bpy.data.objects: o.select_set(o.type in {'MESH','FONT'})
bpy.ops.export_scene.gltf(filepath=GLB_OUT, export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True, export_materials='EXPORT', export_image_format='AUTO')
print("SAVED GLB ->", os.path.getsize(GLB_OUT)); print("DONE")
