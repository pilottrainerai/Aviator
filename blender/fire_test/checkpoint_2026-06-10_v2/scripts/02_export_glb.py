import bpy, os

LIVE = "/Users/czar/Documents/Codex/2026-06-10/pilottrainerai-aviator-https-github-com-pilottrainerai/Aviator"
GLB_OUT = os.path.join(LIVE, "public/models/fire_test_panel.glb")

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
for n in nt.nodes:
    if n.type == 'BSDF_PRINCIPLED':
        n.inputs['Metallic'].default_value = 0.0

bake_img = bpy.data.images.new("decals_baked", width=4096, height=860, alpha=True)
bnode = nt.nodes.new('ShaderNodeTexImage')
bnode.image = bake_img
nt.nodes.active = bnode; bnode.select = True
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
scene.render.bake.margin = 16
print("Baking DECALS albedo...")
bpy.ops.object.bake(type='DIFFUSE')

# rewire DECALS to single Principled BSDF using baked albedo
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = bake_img
bake_img.colorspace_settings.name = 'sRGB'
bsdf.inputs['Metallic'].default_value = 0.8
bsdf.inputs['Roughness'].default_value = 0.3
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

# ── Give the FONT labels (SQUIB/DISCH/Text) a white material so they export
# visible — they have no material in the .blend. ───────────────────────────
label_mat = bpy.data.materials.new("label_white")
label_mat.use_nodes = True
lb = label_mat.node_tree.nodes.get('Principled BSDF')
if lb:
    lb.inputs['Base Color'].default_value = (0.85, 0.88, 0.93, 1.0)
    lb.inputs['Roughness'].default_value = 0.6
    lb.inputs['Metallic'].default_value = 0.0
for o in bpy.data.objects:
    if o.type == 'FONT' and not o.material_slots:
        o.data.materials.append(label_mat)

# Legend-box backing Planes (SQUIB/DISCH white windows) have no material in the
# .blend → would export invisible. Give them a named legend material.
legend_mat = bpy.data.materials.new("legend_box")
legend_mat.use_nodes = True
lg = legend_mat.node_tree.nodes.get('Principled BSDF')
if lg:
    lg.inputs['Base Color'].default_value = (0.88, 0.90, 0.94, 1.0)
    lg.inputs['Roughness'].default_value = 0.55
    lg.inputs['Metallic'].default_value = 0.0
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('Plane') and not o.material_slots:
        o.data.materials.append(legend_mat)

# ── Export GLB: MESH + FONT (FONT = SQUIB/DISCH/Text labels, previously dropped)
for o in bpy.data.objects:
    o.select_set(o.type in {'MESH', 'FONT'})
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT, export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True, export_materials='EXPORT',
    export_image_format='AUTO')
print("SAVED GLB ->", os.path.getsize(GLB_OUT))
print("EXPORT DONE")
