import bpy
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
try:
    scene.cycles.samples = 24
    scene.cycles.device = 'CPU'
except Exception as e: print("cycles cfg:", e)

face = bpy.data.objects["Curve.001"]
# Hide every other mesh so nothing casts a shadow onto the face (keep world HDRI + light).
hidden = []
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name != "Curve.001":
        o.hide_render = True; hidden.append(o.name)
print("hidden", len(hidden), "meshes")

# bake target
img = bpy.data.images.new("rebake", 4096, 860, alpha=False)
img.generated_color = (0,0,0,1)
mat = face.data.materials[0]
nt = mat.node_tree
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
img.filepath_raw = "/tmp/rebake_combined.png"; img.file_format='PNG'; img.save()
print("BAKE DONE -> /tmp/rebake_combined.png")
