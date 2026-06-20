import bpy, os, mathutils
REPO = "/Users/czar/Documents/Codex/2026-06-10/pilottrainerai-aviator-https-github-com-pilottrainerai/Aviator"
GLB_OUT = os.path.join(REPO, "public/models/hyd_panel.glb")
Y_UP = 0.145  # FAULT is the TOP cell: sits clearly above OFF (upper half of the cap). Width is
              # trimmed to 0.82× cell so it still clears the side frame on the guarded ELEC caps.

# 1) Strip the heavy 'hydraulic decals' face material so the 19667px source texture is NOT
#    embedded in the GLB (the web component overrides this material with hyd_face.png anyway).
fm = bpy.data.materials.get("hydraulic decals")
if fm and fm.use_nodes:
    nt = fm.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.12, 0.16, 0.18, 1.0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

coll = bpy.context.scene.collection
# 2) Pair each OFF Text with its OFF Plane (nearest X), add a FAULT cell above it.
texts  = [o for o in bpy.data.objects if o.type=='FONT' and o.data.body=='OFF']
planes = [o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Plane') and any(s.material and s.material.name=='emissive' for s in o.material_slots)]
def world_dim_x(o):
    bpy.context.view_layer.update(); return o.dimensions.x
for i, t in enumerate(sorted(texts, key=lambda o:o.location.x)):
    pl = min(planes, key=lambda p: abs(p.location.x - t.location.x))
    # FAULT must clear the cap's outer frame / centre seam (esp. the guarded ELEC PUMP caps),
    # so target ~82% of the cell width = a clear margin like the FIRE-panel SQUIB/DISCH legends.
    maxW = pl.dimensions.x * 0.82
    # FAULT is the WORD ONLY — no backing box / border. Only the OFF (bottom) cell carries the
    # thin frame (Airbus convention; cockpit-ui §2c). The legend word lights up like the FIRE
    # panel SQUIB/DISCH. (Earlier mistake: duplicating the OFF Plane gave FAULT an unwanted box.)
    # FAULT text (copy of the OFF text → "FAULT", centred over the top cell, same size as OFF then width-fit)
    ft = t.copy(); ft.data = t.data.copy(); ft.name = f"FAULT{i}"
    ft.data.body = "FAULT"; ft.data.align_x = 'CENTER'; ft.data.align_y = 'CENTER'
    ft.location = mathutils.Vector((pl.location.x, pl.location.y + Y_UP, t.location.z))
    coll.objects.link(ft)
    bpy.context.view_layer.update()
    w = ft.dimensions.x
    if w > maxW:  # keep FAULT within its cell width (FCOM: ~same size as OFF, fit the cell)
        ft.data.size *= maxW / w
    bpy.context.view_layer.update()
    # FCOM DSC-29-20: the YELLOW ELEC PUMP (rightmost column) is springloaded — its bottom
    # legend is "ON" (pump running), not "OFF" like the other pumps. Correct the word here and
    # centre it on the cell so it matches the others' placement.
    if i == 4:
        t.data.body = "ON"; t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
        t.location = mathutils.Vector((pl.location.x, pl.location.y, t.location.z))
    print(f"col{i} OFF@({t.location.x:.2f},{t.location.y:.2f}) -> FAULT@({ft.location.x:.2f},{ft.location.y:.2f}) size={ft.data.size:.3f} w={ft.dimensions.x:.3f} bottom={t.data.body!r}")

# 3) Export GLB (same settings as export_glb.py). Do NOT save the .blend.
for o in bpy.data.objects: o.select_set(o.type in {'MESH','FONT'})
bpy.ops.export_scene.gltf(filepath=GLB_OUT, export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True, export_materials='EXPORT', export_image_format='AUTO')
print("SAVED GLB ->", os.path.getsize(GLB_OUT), "bytes  (did NOT save .blend)")
