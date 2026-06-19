"""
01_inspect.py — read-only headless inspection of a cockpit .blend.

RUN:
  /Applications/Blender.app/Contents/MacOS/Blender -b blender/<panel>/<panel>_work.blend -P blender/_TEMPLATE/01_inspect.py

Reads nothing but the scene; never saves. Use the output to plan the conversion:
the GLB export silently DROPS the world HDRI, non-Principled materials, and
non-MESH (FONT/CURVE) objects. This dump tells you which of those you have.
"""
import bpy

scene = bpy.context.scene
print("\n================ SCENE / RENDER ================")
print("engine            :", scene.render.engine)
vs = scene.view_settings
# view_transform Standard -> three NoToneMapping. AgX/Filmic -> needs a matching curve.
print("view_transform    :", vs.view_transform)
print("look              :", vs.look)
print("exposure / gamma  :", vs.exposure, "/", vs.gamma)
print("display_device    :", scene.display_settings.display_device)

print("\n================ OBJECTS (type matters: FONT/CURVE drop on export) ================")
type_counts = {}
for o in bpy.data.objects:
    type_counts[o.type] = type_counts.get(o.type, 0) + 1
print("object types      :", type_counts)
mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
print("mesh object count :", len(mesh_objs))
for o in bpy.data.objects:
    if o.type in {'MESH', 'FONT', 'CURVE'}:
        mats = [s.material.name if s.material else "<none>" for s in o.material_slots]
        nverts = len(o.data.vertices) if o.type == 'MESH' else "-"
        print(f"  - [{o.type:5s}] {o.name:28s} verts={nverts}  dims={tuple(round(d,3) for d in o.dimensions)}  mats={mats}")

print("\n================ LIGHTS / CAMERAS ================")
for o in bpy.data.objects:
    if o.type == 'LIGHT':
        l = o.data
        print(f"  LIGHT {o.name}: type={l.type} energy={l.energy} color={tuple(round(c,3) for c in l.color)}")
    if o.type == 'CAMERA':
        print(f"  CAM   {o.name}: loc={tuple(round(v,3) for v in o.location)} rot={tuple(round(v,3) for v in o.rotation_euler)}")

print("\n================ WORLD HDRI (dropped by GLB — save to /public/hdri) ================")
w = scene.world
if w and w.use_nodes:
    for n in w.node_tree.nodes:
        if n.type == 'TEX_ENVIRONMENT':
            img = n.image
            print(f"  ENV TEX: {img.name if img else '<none>'} size={tuple(img.size) if img else '-'}")
        if n.type == 'BACKGROUND':
            s = n.inputs.get('Strength')
            print(f"  BACKGROUND strength={round(s.default_value,3) if s else '?'}")
else:
    print("  (no node-based world)")

print("\n================ MATERIALS (Mix-Shader/procedural = must BAKE) ================")
for m in bpy.data.materials:
    if not m.use_nodes:
        print(f"\n[{m.name}] NO NODES  diffuse={tuple(round(c,3) for c in m.diffuse_color)}")
        continue
    nt = m.node_tree
    print(f"\n[{m.name}]  nodes={len(nt.nodes)}")
    for n in nt.nodes:
        line = f"    node {n.type:18s} '{n.name}'"
        if n.type == 'BSDF_PRINCIPLED':
            bc = n.inputs.get('Base Color'); mtl = n.inputs.get('Metallic'); rgh = n.inputs.get('Roughness')
            bcv = "LINKED" if (bc and bc.is_linked) else (tuple(round(c,3) for c in bc.default_value) if bc else "?")
            line += f"  baseColor={bcv} metal={round(mtl.default_value,2) if mtl else '?'} rough={round(rgh.default_value,2) if rgh else '?'}"
        if n.type == 'TEX_IMAGE':
            img = n.image
            line += (f"  IMG='{img.name}' size={tuple(img.size)} colorspace={img.colorspace_settings.name}" if img else "  IMG=<none>")
        print(line)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if out and out.inputs['Surface'].is_linked:
        src = out.inputs['Surface'].links[0].from_node
        # A non-Principled driver here (MIX_SHADER, etc.) means this material WILL NOT export — bake it.
        print(f"    -> Surface driven by: {src.type} '{src.name}'  {'<-- WILL NOT EXPORT, BAKE IT' if src.type != 'BSDF_PRINCIPLED' else ''}")

print("\n================ BOUNDING BOX (camera framing) ================")
import mathutils
mn = mathutils.Vector((1e9, 1e9, 1e9)); mx = mathutils.Vector((-1e9, -1e9, -1e9))
for o in mesh_objs:
    for c in o.bound_box:
        wc = o.matrix_world @ mathutils.Vector(c)
        mn = mathutils.Vector(map(min, mn, wc)); mx = mathutils.Vector(map(max, mx, wc))
ext = mx - mn
print("  min:", tuple(round(v,3) for v in mn), " max:", tuple(round(v,3) for v in mx))
print("  extent:", tuple(round(v,3) for v in ext), " -> face normal = the THINNEST axis")

print("\n================ DONE ================")
