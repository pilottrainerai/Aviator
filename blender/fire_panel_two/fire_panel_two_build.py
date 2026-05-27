"""
A320 Engine Fire Panel — fire_panel_two (v15 base, flushed labels)
Direct 1:1 translation of engine-fire-panel-mockup.tsx
PX = 0.25  (1 CSS pixel = 0.25 mm)

Differences vs v15:
  • All labels re-anchored Z so the text mesh sits flush on its parent
    surface (no air gap, nothing hanging in space).
  • EXCEPTION: TEST pb label is kept at the original Z (per request).
  • AGENT 1 / AGENT 2 / AGENT labels get +10% character spacing.
"""
import bpy, bmesh, math
import os
_HERE = os.path.dirname(os.path.abspath(__file__))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.length_unit = 'MILLIMETERS'
def mm(x): return x * 0.001

PX   = 0.25
W_PX = 1200
H_PX = 420
W    = W_PX * PX
H    = H_PX * PX

def p(ax, ay):
    return (ax * PX - W/2,  H/2 - ay * PX)

def hex_rgba(h):
    h = h.lstrip('#')
    return (int(h[0:2],16)/255, int(h[2:4],16)/255, int(h[4:6],16)/255, 1.0)

def mat(name, base, rough=0.5, metal=0.0, em=None, em_str=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes; n.clear()
    bsdf = n.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = hex_rgba(base)
    bsdf.inputs['Roughness'].default_value  = rough
    bsdf.inputs['Metallic'].default_value   = metal
    if em:
        try: bsdf.inputs['Emission Strength'].default_value = em_str
        except: pass
        try: bsdf.inputs['Emission Color'].default_value = hex_rgba(em)
        except: pass
    out = n.new('ShaderNodeOutputMaterial')
    m.node_tree.links.new(bsdf.outputs[0], out.inputs[0])
    return m

M = {
    'panel':     mat('panel',    '#33607A', 0.60),
    'screw':     mat('screw',    '#C8CED6', 0.25, 0.90),
    'pb_red':    mat('pb_red',   '#C04035', 0.40),
    'pb_black':  mat('pb_black', '#1e2430', 0.50),
    'cell_dark': mat('cell_dark','#06080C', 0.60),
    'dim_text':  mat('dim_text', '#3A4252', 0.50),
    'white':     mat('white',    '#FFFFFF', 0.20, em='#FFFFFF', em_str=5),
    'wborder':   mat('wborder',  '#FFFFFF', 0.20, em='#FFFFFF', em_str=3),
    'teal_ring': mat('teal_ring','#6E9292', 0.45),
    'guard_red': mat('guard_red','#E81010', 0.50),
    'j_dark':    mat('j_dark',   '#1D1818', 0.60, 0.20),
    'j_light':   mat('j_light',  '#A8A7A6', 0.25, 0.70),
    'test_blk':  mat('test_blk', '#000000', 0.60),
    'fire_bar':  mat('fire_bar', '#FFFFFF', 0.20, em='#FFFFFF', em_str=4),
    'wtext':     mat('wtext',    '#E8ECF4', 0.20, em='#FFFFFF', em_str=4),
}

# ─────────────── FONT ─────────────── (blender-panels §2d)
COCKPIT_FONT = None
for label, path in [
    ("Futura.ttc", "/System/Library/Fonts/Supplemental/Futura.ttc"),
    ("Arial Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]:
    try:
        COCKPIT_FONT = bpy.data.fonts.load(path)
        COCKPIT_FONT.pack()  # MANDATORY — blender-panels §6 rule 11
        print(f"Loaded cockpit font: {label}")
        break
    except Exception as e:
        print(f"  could not load {label}: {e}")
if COCKPIT_FONT is None:
    print("All custom fonts failed; using Blender default Bfont")

def asgn(o, m):
    o.data.materials.clear(); o.data.materials.append(m)

def box(name, cx, cy, cz, w, h, d, m=None, bev=0.3):
    bpy.ops.mesh.primitive_cube_add(size=2,
        location=(mm(cx), mm(cy), mm(cz)))
    o = bpy.context.active_object; o.name = name
    o.scale = (mm(w/2), mm(h/2), mm(d/2))
    bpy.ops.object.transform_apply(scale=True)
    if bev > 0:
        bv = o.modifiers.new('Bev','BEVEL')
        bv.width = mm(bev); bv.segments = 2
    if m: asgn(o, m)
    return o

def cyl(name, cx, cy, cz, r, d, m=None, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=mm(r), depth=mm(d), vertices=verts,
        location=(mm(cx), mm(cy), mm(cz)))
    o = bpy.context.active_object; o.name = name
    if m: asgn(o, m)
    return o

def txt(name, body, size_mm, cx, cy, cz, m, ext=0.3):
    bpy.ops.object.text_add(location=(mm(cx), mm(cy), mm(cz)))
    o = bpy.context.active_object; o.name = name
    o.data.body     = body
    if COCKPIT_FONT: o.data.font = COCKPIT_FONT
    o.data.size     = mm(size_mm)
    o.data.extrude  = mm(ext)
    o.data.align_x  = 'CENTER'
    o.data.align_y  = 'CENTER'
    if m: o.data.materials.append(m)
    return o

def apply_bool(obj, cutter, tag='Cut'):
    bpy.context.view_layer.objects.active = obj
    bm = obj.modifiers.new(tag, 'BOOLEAN')
    bm.operation = 'DIFFERENCE'; bm.object = cutter
    bpy.ops.object.modifier_apply(modifier=tag)
    cutter.hide_render = True; cutter.hide_viewport = True

BASE_Z = 3.0
# Front-face Z of common surfaces (used to flush-mount text)
PANEL_FRONT = BASE_Z              # 3.0 — panel front face (box cz=0, d=6)
FIREBAR_FRONT = BASE_Z + 0.03     # bar is now a flat painted decal, top barely above panel

panel_obj = box('Panel', 0, 0, 0, W, H, 6, m=M['panel'], bev=1.0)
# Apply the bevel now so subsequent boolean cuts (agent cavities) operate on
# the already-beveled mesh and don't get double-beveled.
bpy.context.view_layer.objects.active = panel_obj
bpy.ops.object.modifier_apply(modifier='Bev')

for sx, sy in [(12,12),(1176,12),(12,396),(1176,396)]:
    cx, cy = p(sx+6, sy+6)
    cyl(f'Scr_{sx}_{sy}', cx, cy, BASE_Z+0.75, 6*PX, 1.5, M['screw'], verts=16)

cx, cy = p(600, 12)
# PAINTED: flat decal-style text on panel front (no embossing)
txt('FIRE_title', 'FIRE', 5, cx, cy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)

def section(sl, sw, pfx):
    is_apu = (sw == 320)
    sr = sl + sw

    title = {'ENG1':'ENG 1','APU':'APU','ENG2':'ENG 2'}[pfx]
    cx, cy = p(sl + sw/2, 105)
    # PAINTED: section title is flat decal-style (no embossing)
    txt(f'{pfx}_title', title, 6, cx, cy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)

    FW = 131*PX;  FH = 97*PX
    f_top  = H_PX/2 - 0.61*97
    f_left = sl + (sw - 131) / 2
    fcx, fcy = p(f_left + 131/2, f_top + 97/2)
    # FLUSH: FIRE pb top sits 1 mm above the panel (was 10 mm — tower-like).
    # The full 10 mm depth is preserved; the body extends back behind the panel.
    FZ_FRONT = BASE_Z + 1.0
    box(f'{pfx}_FirePb', fcx, fcy, FZ_FRONT-5, FW, FH, 10, m=M['pb_red'], bev=1.0)
    # PAINTED: FIRE / PUSH are flat decal-style on the pb face (no embossing)
    txt(f'{pfx}_FIRE_lbl', 'FIRE', 22*PX,
        fcx, fcy + FH*0.22, FZ_FRONT + 0.01, M['wtext'], ext=0.01)
    txt(f'{pfx}_PUSH_lbl', 'PUSH', 11*PX,
        fcx, fcy - FH*0.36, FZ_FRONT + 0.01, M['wtext'], ext=0.01)

    gl = f_left - 5
    gt = f_top  - 2

    guard_path_local = [
        ( 0.5, 98.5), ( 0.5,  3.0), ( 3.0,  0.5),
        (131.0, 0.5), (134.0, 0.5), (134.5,98.5),
        ( 95.5,98.5), ( 75.5,121.5),( 62.0,121.5),
        ( 59.5,119.0),( 50.0,108.5),( 41.5, 98.5),
    ]
    verts_3d = []
    for lx, ly in guard_path_local:
        gx, gy = p(gl + lx, gt + ly)
        verts_3d.append((mm(gx), mm(gy), 0.0))

    # Guard sits ON the FIRE pb front face with a 0.05 mm air gap so the
    # back of the guard never z-fights with the pb top.
    GT = 0.8
    GZ = FZ_FRONT + 0.05 + GT / 2

    g_mesh = bpy.data.meshes.new(f'{pfx}_Gm')
    g_mesh.materials.append(M['guard_red'])
    g_obj  = bpy.data.objects.new(f'{pfx}_Guard', g_mesh)
    bpy.context.scene.collection.objects.link(g_obj)
    bm_g = bmesh.new()
    vs = [bm_g.verts.new(v) for v in verts_3d]
    bm_g.verts.ensure_lookup_table()
    bm_g.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm_g, faces=list(bm_g.faces))
    bm_g.to_mesh(g_mesh); bm_g.free()
    g_obj.location.z = mm(GZ)

    sol = g_obj.modifiers.new('Sol','SOLIDIFY')
    sol.thickness = mm(GT); sol.offset = 0.0
    bpy.context.view_layer.objects.active = g_obj
    bpy.ops.object.modifier_apply(modifier='Sol')

    gcx, gcy = p(gl+12+55, gt+17+38)
    glass_cut = box(f'{pfx}_GlsCut', gcx, gcy, GZ, 110*PX, 76*PX, GT+1, bev=0)
    apply_bool(g_obj, glass_cut, 'CutGlass')

    ocx, ocy = p(gl+67.5, gt+110)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=mm(7*PX), depth=mm(GT+1), vertices=32,
        location=(mm(ocx), mm(ocy), mm(GZ)))
    oval_cut = bpy.context.active_object; oval_cut.name = f'{pfx}_OvCut'
    oval_cut.scale.y = 3.5/7.0
    bpy.ops.object.transform_apply(scale=True)
    apply_bool(g_obj, oval_cut, 'CutOval')

    asgn(g_obj, M['guard_red'])
    for poly in g_obj.data.polygons: poly.material_index = 0

    jcx, jcy = p(gl+40.5+27, gt+0.5+8)
    box(f'{pfx}_JOut', jcx, jcy, GZ+0.75, 54*PX, 16*PX, 1.5, m=M['j_dark'], bev=0.2)
    box(f'{pfx}_JIn',  jcx, jcy, GZ+1.3,  54*0.8*PX, 16*0.8*PX, 0.6, m=M['j_light'], bev=0.1)

    if not is_apu:
        # PAINTED bar: was a 1.5 mm extruded box; now a 0.02 mm decal sitting
        # just above the panel front. Shifted 5 px right with the text.
        bar_x_px = sl + 44 + 2 + 5
        # Bar shortened: -2% from top (1.6 px), -5% from bottom (4 px).
        # New height 74.4 px, top at pixel y=146.6, center at 183.8.
        bar_h_px  = 80 * (1 - 0.02 - 0.05)        # 74.4
        bar_cy_px = 145 + 80*0.02 + bar_h_px/2    # 183.8
        bcx, bcy = p(bar_x_px, bar_cy_px)
        box(f'{pfx}_FireBar', bcx, bcy, BASE_Z + 0.02, 4*PX, bar_h_px*PX, 0.02,
            m=M['fire_bar'], bev=0)
        # Text: +10% bigger characters, +10% vertical char spacing (prevents
        # overlap when chars are bigger), +10% distance from the bar
        # (original gap 9.6 px → 10.56), and shifted right with the bar.
        text_x_px = bar_x_px + 10.56
        for i, ch in enumerate('FIRE'):
            char_cx, char_cy = p(text_x_px, 148 + i*16*1.1 + 8)
            # PAINTED: vertical FIRE letters are flat decal-style (no embossing)
            txt(f'{pfx}_Vch_{i}', ch, 16*PX*1.1,
                char_cx, char_cy, FIREBAR_FRONT + 0.01, M['fire_bar'], ext=0.01)

    BTN = 56
    agents = [(sl+84,'A1','1'),(sl+300,'A2','2')] if not is_apu else \
             [(sl+(sw-BTN)//2,'A1','')]

    # ENG1 only: shift both AGENT pbs (and everything keyed off acy — cavity,
    # body, TR ring, WRO, cells, label) 20% of BTN down. ENG2 / APU unchanged.
    ag_y_off_px = 11.2 if pfx == 'ENG1' else 0

    for ag_left, ag_id, ag_num in agents:
        acx, acy = p(ag_left + BTN/2, 112 + BTN/2 + ag_y_off_px)

        # CAVITY: cut a hole in the panel slightly larger than the body, then
        # sink the agent body so it sits 0.5 mm below the panel front. The
        # panel hole walls visually frame the recessed pb.
        CAV_GAP_PX = 0.5
        cavity_cut = box(f'{pfx}_{ag_id}_CavCut', acx, acy, 0,
                         (BTN + CAV_GAP_PX*2)*PX, (BTN + CAV_GAP_PX*2)*PX, 8,
                         m=None, bev=0)
        panel = bpy.data.objects['Panel']
        apply_bool(panel, cavity_cut, f'{pfx}_{ag_id}_CavBool')
        for poly in panel.data.polygons: poly.material_index = 0

        # Body top now 0.5 mm BELOW the panel front (recessed in the cavity).
        AZ_FRONT = BASE_Z - 0.5
        CELL_FRONT = AZ_FRONT + 0.5  # cell bg top face (cz=AZ_FRONT+0.25, d=0.5)

        # Teal ring: cut the same cavity hole through TR so the recessed
        # black body is visible inside (TR was previously a solid pad
        # covering the cavity opening, making the agent read as panel-teal).
        TEX = 3*PX
        tr_obj = box(f'{pfx}_{ag_id}_TR', acx, acy, BASE_Z+0.05,
            BTN*PX+TEX*2, BTN*PX+TEX*2, 0.1, m=M['teal_ring'], bev=0.05)
        tr_cut = box(f'{pfx}_{ag_id}_TRcut', acx, acy, BASE_Z+0.05,
            (BTN + CAV_GAP_PX*2)*PX, (BTN + CAV_GAP_PX*2)*PX, 1.0, m=None, bev=0)
        apply_bool(tr_obj, tr_cut, f'{pfx}_{ag_id}_TRBool')
        asgn(tr_obj, M['teal_ring'])
        for poly in tr_obj.data.polygons: poly.material_index = 0

        OE = 5*PX; OI = 3*PX
        wo = box(f'{pfx}_{ag_id}_WRO', acx, acy, BASE_Z+0.10,
                 BTN*PX+OE*2, BTN*PX+OE*2, 0.1, m=M['wborder'], bev=0.02)
        wc = box(f'{pfx}_{ag_id}_WRC', acx, acy, BASE_Z+0.10,
                 BTN*PX+OI*2, BTN*PX+OI*2, 0.3, m=None, bev=0)
        apply_bool(wo, wc, f'{pfx}_{ag_id}_RCut')
        asgn(wo, M['wborder'])
        for poly in wo.data.polygons: poly.material_index = 0

        box(f'{pfx}_{ag_id}_Body', acx, acy, AZ_FRONT-3,
            BTN*PX, BTN*PX, 6, m=M['pb_black'], bev=1.0)

        PAD = 3*PX; GAP = 2*PX
        CW  = BTN*PX - PAD*2
        CH  = (BTN*PX - PAD*2 - GAP) / 2
        sq_cy = acy + CH/2 + GAP/2 + PAD/2 - 0.5*PX
        dc_cy = acy - CH/2 - GAP/2 - PAD/2 + 0.5*PX
        for cell_cy, cn, label in [(sq_cy,'SQ','SQUIB'),(dc_cy,'DC','DISCH')]:
            box(f'{pfx}_{ag_id}_{cn}bg', acx, cell_cy, AZ_FRONT+0.25,
                CW, CH, 0.5, m=M['cell_dark'], bev=0.05)
            # FLUSH: SQUIB / DISCH letter BACK face on the cell front
            # (was AZ_FRONT+0.8, ~0.3 mm hanging above)
            txt(f'{pfx}_{ag_id}_{cn}', label, 9*PX,
                acx, cell_cy, CELL_FRONT + 0.15, M['dim_text'], ext=0.15)

        lbl = f'AGENT {ag_num}' if ag_num else 'AGENT'
        # PAINTED: AGENT label is flat decal-style (no embossing).
        # +10% UP (cumulative): offset multiplier 1.2 → 1.32.
        agent_lbl = txt(f'{pfx}_{ag_id}_lbl', lbl, 11*PX,
            acx, acy + (BTN*PX/2 + 3*PX) * 1.32, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)
        # +10% character spacing on AGENT labels
        agent_lbl.data.space_character = 1.1

    # TEST pb — +30% size (cyl radius, dot radius, text size all × 1.3) and
    # shifted up 20 px (5 mm) so the whole assembly sits closer to AGENT 1.
    # Text offset from cyl center also scales by 1.3 so the proportional gap
    # between the (now-bigger) cyl top and (now-bigger) text stays the same.
    if not is_apu:
        tx, ty = p(sl+93+13, 224) if pfx=='ENG1' else p(sr-93-13, 224)
    else:
        tx, ty = p(sl+sw/2, 224)
    cyl(f'{pfx}_TEST',    tx, ty, BASE_Z+2,   13*PX*1.3, 4.0,  M['test_blk'])
    cyl(f'{pfx}_TESTdot', tx, ty, BASE_Z+4.1,  3*PX*1.3, 0.5,  M['white'], verts=16)
    txt(f'{pfx}_TESTlbl', 'TEST', 11*PX*1.3,
        tx, ty + (13*PX + 3*PX) * 1.2 * 1.3, BASE_Z+0.5, M['wtext'], ext=0.15)

section(  0, 440, 'ENG1')
section(440, 320, 'APU')
section(760, 440, 'ENG2')

bpy.ops.object.camera_add(
    location=(0, mm(-230), mm(160)),
    rotation=(math.radians(48), 0, 0))
cam = bpy.context.active_object; cam.name = 'Camera'
bpy.context.scene.camera = cam
cam.data.clip_start = mm(1)
cam.data.clip_end   = mm(3000)
cam.data.lens       = 85

def area_light(loc, energy, size, rot):
    bpy.ops.object.light_add(type='AREA', location=loc, rotation=rot)
    l = bpy.context.active_object
    l.data.energy = energy; l.data.size = mm(size)

area_light((0,        mm(-180), mm(200)), 5.0, 300, (math.radians(40),0,0))
area_light((mm(-200), mm(-100), mm(100)), 2.5, 200, (math.radians(50),math.radians(-30),0))
area_light((mm( 200), mm(-100), mm(100)), 2.5, 200, (math.radians(50),math.radians( 30),0))
area_light((0,        mm(-260), mm(20)),  1.0, 400, (math.radians(10),0,0))

bpy.context.scene.world.use_nodes = True
bg = bpy.context.scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value    = (0.15, 0.18, 0.20, 1.0)
bg.inputs['Strength'].default_value = 0.4

sc = bpy.context.scene
sc.render.engine                = 'CYCLES'
sc.cycles.samples               = 128
sc.render.resolution_x          = 2400
sc.render.resolution_y          = 900
sc.render.resolution_percentage = 100
sc.render.filepath              = os.path.join(_HERE, 'fire_panel_two.png')
sc.render.image_settings.file_format = 'PNG'
sc.cycles.device = 'CPU'
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look           = 'None'
sc.view_settings.exposure       = 0.0
sc.view_settings.gamma          = 1.0

try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
    print("Metal GPU")
except Exception as e:
    print(f"CPU: {e}")

# Render disabled in build-only variant — press F12 in Blender when you want
# a still. Save the .blend so it can be reopened directly.
BLEND_PATH = os.path.join(_HERE, 'fire_panel_two.blend')
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
print(f"DONE: scene built and saved to {BLEND_PATH}")
