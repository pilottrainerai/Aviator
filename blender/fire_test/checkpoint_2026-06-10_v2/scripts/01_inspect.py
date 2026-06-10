import bpy

scene = bpy.context.scene
print("\n================ SCENE / RENDER ================")
print("engine            :", scene.render.engine)
vs = scene.view_settings
print("view_transform    :", vs.view_transform)
print("look              :", vs.look)
print("exposure / gamma  :", vs.exposure, "/", vs.gamma)
print("display_device    :", scene.display_settings.display_device)

print("\n================ OBJECTS ================")
mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
print("mesh object count :", len(mesh_objs))
for o in mesh_objs:
    mats = [s.material.name if s.material else "<none>" for s in o.material_slots]
    print(f"  - {o.name:28s} verts={len(o.data.vertices):5d}  mats={mats}")

print("\n================ LIGHTS / CAMERAS ================")
for o in bpy.data.objects:
    if o.type == 'LIGHT':
        l = o.data
        print(f"  LIGHT {o.name}: type={l.type} energy={l.energy} color={tuple(round(c,3) for c in l.color)}")
    if o.type == 'CAMERA':
        print(f"  CAM   {o.name}: loc={tuple(round(v,3) for v in o.location)} rot={tuple(round(v,3) for v in o.rotation_euler)} type={o.data.type}")

print("\n================ MATERIALS ================")
for m in bpy.data.materials:
    if not m.use_nodes:
        print(f"\n[{m.name}] NO NODES  diffuse={tuple(round(c,3) for c in m.diffuse_color)}")
        continue
    print(f"\n[{m.name}]  nodes={len(m.node_tree.nodes)}")
    nt = m.node_tree
    for n in nt.nodes:
        line = f"    node {n.type:18s} '{n.name}'"
        if n.type == 'BSDF_PRINCIPLED':
            bc = n.inputs.get('Base Color')
            mtl = n.inputs.get('Metallic')
            rgh = n.inputs.get('Roughness')
            emi = n.inputs.get('Emission Color')
            ems = n.inputs.get('Emission Strength')
            bc_links = bc.is_linked if bc else False
            bcv = tuple(round(c,3) for c in bc.default_value) if bc and not bc.is_linked else "LINKED"
            line += f"  baseColor={bcv} metal={round(mtl.default_value,2) if mtl else '?'} rough={round(rgh.default_value,2) if rgh else '?'}"
            if emi:
                line += f" emiss={'LINKED' if emi.is_linked else tuple(round(c,2) for c in emi.default_value)} emStr={round(ems.default_value,2) if ems else '?'}"
        if n.type == 'TEX_IMAGE':
            img = n.image
            if img:
                line += f"  IMG='{img.name}' size={tuple(img.size)} packed={img.packed_file is not None} colorspace={img.colorspace_settings.name} src={img.source}"
            else:
                line += "  IMG=<none>"
        print(line)
    # print links into the surface output
    out = next((n for n in nt.nodes if n.type=='OUTPUT_MATERIAL'), None)
    if out and out.inputs['Surface'].is_linked:
        src = out.inputs['Surface'].links[0].from_node
        print(f"    -> Surface driven by: {src.type} '{src.name}'")

print("\n================ IMAGES ================")
for img in bpy.data.images:
    if img.name == 'Render Result' or img.name == 'Viewer Node':
        continue
    print(f"  IMG '{img.name}' size={tuple(img.size)} packed={img.packed_file is not None} colorspace={img.colorspace_settings.name} filepath='{img.filepath}'")

print("\n================ DONE ================")
