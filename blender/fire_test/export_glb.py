import bpy, os

REPO = "/Users/czar/Desktop/pilottrainerai/Aviator"
DECAL_OUT = os.path.join(REPO, "public/models/fire_test_decals_baked.png")
GLB_OUT   = os.path.join(REPO, "public/models/fire_test_panel.glb")

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 4

# ── Bake DECALS albedo (markings + base) with metallic temporarily zeroed ────
obj = bpy.data.objects['Curve.001']
for o in bpy.data.objects:
    o.select_set(False)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

mat = bpy.data.materials['DECALS']
nt = mat.node_tree

# remember + zero metallic on every principled in this material so the
# DIFFUSE color pass returns the true albedo (metals have ~no diffuse term)
saved = []
for n in nt.nodes:
    if n.type == 'BSDF_PRINCIPLED':
        m = n.inputs['Metallic']
        saved.append((m, m.default_value))
        m.default_value = 0.0

bake_img = bpy.data.images.new("decals_baked", width=4096, height=860, alpha=True)
bnode = nt.nodes.new('ShaderNodeTexImage')
bnode.image = bake_img
nt.nodes.active = bnode; bnode.select = True

scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
scene.render.bake.margin = 16
print("Baking DECALS albedo (metallic zeroed)...")
bpy.ops.object.bake(type='DIFFUSE')

bake_img.file_format = 'PNG'
bake_img.filepath_raw = DECAL_OUT
bake_img.save()
print("SAVED baked decal ->", os.path.getsize(DECAL_OUT))

# report albedo range so we know the bake captured something
px = list(bake_img.pixels)
rs = px[0::4]; gs = px[1::4]; bs = px[2::4]
print("BAKE R range %.3f..%.3f  G %.3f..%.3f  B %.3f..%.3f" % (
    min(rs),max(rs), min(gs),max(gs), min(bs),max(bs)))

# ── Rewire DECALS to single Principled BSDF using baked albedo ───────────────
for n in list(nt.nodes):
    nt.nodes.remove(n)
out  = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
tex  = nt.nodes.new('ShaderNodeTexImage')
tex.image = bake_img
bake_img.colorspace_settings.name = 'sRGB'
bsdf.inputs['Metallic'].default_value  = 0.8
bsdf.inputs['Roughness'].default_value = 0.3
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

# ── Export GLB ───────────────────────────────────────────────────────────────
for o in bpy.data.objects:
    o.select_set(o.type == 'MESH')
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT, export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True, export_materials='EXPORT',
    export_image_format='AUTO')
print("SAVED GLB ->", os.path.getsize(GLB_OUT))
print("EXPORT DONE")
