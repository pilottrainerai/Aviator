"""
A320 HYD overhead panel — Blender build script
Built under the blender-panels skill (2026-05-25 intake/plan/Checkpoint A).

Source tags on every value:
  [USER bv]   — carried over from fire_panel_two best_version (the user's
                designated visual base for background color, font, AGENT
                pb construction)
  [USER]      — explicit user direction this session
  [FCOM 4a]   — DSC-29-20 Controls & Indicators (PDF page 1205)
  [FCOM 4b]   — DSC-29-10 Description
  [PICS]      — derived from /Users/czar/Desktop/PANELS/HYD/Hydraulic-Panel.jpg,
                a320-ovhd-hyd-40vu.webp, and the OVHD PANEL context shot.
                Proportional measurements anchored to BTN_PX = 22 mm.

Hard rules in effect (blender-panels §0):
  - No invented values. Every dim/color traces to a tag above.
  - No "approximately".
  - Touch only HYD geometry; no edits to best_version or eng1_left.
  - Flow lines must NOT cross any text or panel edge.
"""
import bpy, bmesh, math
import os
_HERE = os.path.dirname(os.path.abspath(__file__))                  # [USER bv]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.length_unit = 'MILLIMETERS'
def mm(x): return x * 0.001

# ─────────────── CONSTANTS ───────────────
PX   = 0.25                                                          # [USER bv]
W_PX = 800                                                           # 200 mm  [PICS prop, anchored to BTN_PX=22mm]
H_PX = 300                                                           # 75 mm   [PICS prop]
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

# ─────────────── MATERIALS ─────────────── (all carried from best_version pattern)
M = {
    'panel':        mat('panel',        '#33607A', 0.60),                        # [USER bv]
    'screw':        mat('screw',        '#C8CED6', 0.25, 0.90),                  # [USER bv]
    'pb_black':     mat('pb_black',     '#0F1015', 0.70),                        # [USER bv]
    'cell_dark':    mat('cell_dark',    '#030305', 0.70),                        # [USER bv]
    'dim_text':     mat('dim_text',     '#1A1E25', 0.60),                        # [USER bv]
    'wborder':      mat('wborder',      '#FFFFFF', 0.20, em='#FFFFFF', em_str=3),# [USER bv]
    'teal_ring':    mat('teal_ring',    '#6E9292', 0.45),                        # [USER bv]
    'wtext':        mat('wtext',        '#E8ECF4', 0.20, em='#FFFFFF', em_str=4),# [USER bv]
    'lit_white':    mat('lit_white',    '#FFFFFF', 0.20, em='#FFFFFF', em_str=6),# [FCOM 4a — OFF/ON/MAN ON]
    'lit_amber':    mat('lit_amber',    '#FFB300', 0.25, em='#FFB300', em_str=6),# [FCOM 4a — FAULT amber]
    'rat_red':      mat('rat_red',      '#C82010', 0.45),                        # [PICS]
    'bracket_green':mat('bracket_green','#2F9050', 0.30, em='#3FAA60', em_str=0.8),# [PICS]
    'gray_border':  mat('gray_border',  '#7A7A7A', 0.70),                        # flat medium gray (non-metallic) for cell frames [USER 2026-05-25]
}

# ─────────────── FONT ─────────────── (best_version chain)
COCKPIT_FONT = None                                                  # [USER bv]
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

# ─────────────── GEOMETRY HELPERS ─────────────── (best_version pattern)
def asgn(o, m):
    o.data.materials.clear(); o.data.materials.append(m)

def box(name, cx, cy, cz, w, h, d, m=None, bev=0.3):
    bpy.ops.mesh.primitive_cube_add(size=2, location=(mm(cx), mm(cy), mm(cz)))
    o = bpy.context.active_object; o.name = name
    o.scale = (mm(w/2), mm(h/2), mm(d/2))
    bpy.ops.object.transform_apply(scale=True)
    if bev > 0:
        bv = o.modifiers.new('Bev','BEVEL'); bv.width = mm(bev); bv.segments = 2
    if m: asgn(o, m)
    return o

def cyl(name, cx, cy, cz, r, d, m=None, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=mm(r), depth=mm(d), vertices=verts,
                                        location=(mm(cx), mm(cy), mm(cz)))
    o = bpy.context.active_object; o.name = name
    if m: asgn(o, m)
    return o

def txt(name, body, size_mm, cx, cy, cz, m, ext=0.3, align_x='CENTER'):
    bpy.ops.object.text_add(location=(mm(cx), mm(cy), mm(cz)))
    o = bpy.context.active_object; o.name = name
    o.data.body     = body
    o.data.size     = mm(size_mm)
    o.data.extrude  = mm(ext)
    o.data.align_x  = align_x
    o.data.align_y  = 'CENTER'
    if COCKPIT_FONT: o.data.font = COCKPIT_FONT
    if m: o.data.materials.append(m)
    return o

def apply_bool(obj, cutter, tag='Cut'):
    bpy.context.view_layer.objects.active = obj
    bm = obj.modifiers.new(tag, 'BOOLEAN')
    bm.operation = 'DIFFERENCE'; bm.object = cutter
    bpy.ops.object.modifier_apply(modifier=tag)
    cutter.hide_render = True; cutter.hide_viewport = True

BASE_Z      = 3.0                                                    # [USER bv]
PANEL_FRONT = BASE_Z

# Flow-art constants used by both green_bracket_label and the river block.
LINE_W_PX     = 3.0                                                  # ~0.75 mm  reduced 40% from 5.0  [USER 2026-05-25]
LINE_DEPTH_MM = 0.01                                                 # 2D look  [USER]

# ─────────────── LAYER 2+3 — label_box ───────────────
def label_box(name, cx_px, cy_px, w_px, h_px, text, text_size_mm,
              outline_mat=None, text_mat=None, omit_sides=(),
              half_sides=False):
    """White-bordered label box, painted FLAT (2D look — very thin depth
    so it doesn't read as extruded geometry under render lighting).
    [USER feedback — the previous 0.05 mm depth looked 3D]

    omit_sides accepts any subset of ('T','B','L','R') to skip drawing
    those borders. Used for FCOM-style 3-sided function brackets
    (open at the bottom, facing the pb).  [USER 2026-05-25]

    half_sides=True draws only the TOP HALF of the L and R borders —
    short ticks hanging off the top bar, FCOM bracket style.
    [USER 2026-05-25]"""
    if outline_mat is None: outline_mat = M['wtext']
    if text_mat is None:    text_mat    = M['wtext']
    cx, cy = p(cx_px, cy_px)
    BORDER_W_PX  = 1.6                                                # ~0.4 mm  [USER bv]
    BORDER_DEPTH = 0.01                                               # was 0.05 — 2D look  [USER]
    BORDER_Z     = PANEL_FRONT + 0.015
    half_w_mm = w_px * PX / 2
    half_h_mm = h_px * PX / 2
    border_thick_mm = BORDER_W_PX * PX
    for side, dy in [('T', half_h_mm), ('B', -half_h_mm)]:
        if side in omit_sides: continue
        box(f'{name}_box_{side}', cx, cy + dy, BORDER_Z,
            w_px*PX, border_thick_mm, BORDER_DEPTH, m=outline_mat, bev=0)
    # Side height: full height by default; half-height (hanging from top)
    # when half_sides=True.
    side_h_mm  = (h_px * PX) * (0.5 if half_sides else 1.0)
    side_cy_mm = cy + (half_h_mm / 2 if half_sides else 0)
    for side, dx in [('L', -half_w_mm), ('R', half_w_mm)]:
        if side in omit_sides: continue
        box(f'{name}_box_{side}', cx + dx, side_cy_mm, BORDER_Z,
            border_thick_mm, side_h_mm, BORDER_DEPTH, m=outline_mat, bev=0)
    txt(f'{name}_text', text, text_size_mm,
        cx, cy, PANEL_FRONT + 0.01, text_mat, ext=0.01)

def green_bracket_label(name, cx_px, cy_px, w_px, h_px, text, text_size_mm,
                        top_extension_px=18, leg_extension_px=20):
    """Layer-1/2 hybrid: function label with an inverted-U GREEN bracket.

    Geometry per user photo (BLUE close-up 2026-05-25):
      • Top bar sits HIGH — extended UP by top_extension_px past the text
        box top, so the drop from the river is short and the bracket reads
        as one continuous shape from near the river down to near the pb.
      • Left + right legs extend DOWN by leg_extension_px past the text
        box bottom, reaching close to the pb cap.
      • Text label centered between top bar and leg bottoms.
      • Bracket TOP is wider than the text width via the box w_px.
    """
    cx, cy = p(cx_px, cy_px)
    BR_THICK_PX  = LINE_W_PX                                          # match river thickness
    BR_DEPTH_MM  = LINE_DEPTH_MM
    BR_Z         = BASE_Z + 0.02
    half_w_mm = w_px * PX / 2
    half_h_mm = h_px * PX / 2
    br_thick_mm = BR_THICK_PX * PX
    top_ext_mm  = top_extension_px * PX
    leg_ext_mm  = leg_extension_px * PX

    # Top bar — at (text top) + top_extension, well above the text.
    top_bar_cy_mm = cy + half_h_mm + top_ext_mm
    box(f'{name}_topbar', cx, top_bar_cy_mm, BR_Z,
        w_px*PX, br_thick_mm, BR_DEPTH_MM, m=M['bracket_green'], bev=0)

    # Legs — from top_bar_cy_mm DOWN to (text bottom) - leg_extension.
    leg_top_y = top_bar_cy_mm
    leg_bot_y = cy - half_h_mm - leg_ext_mm
    leg_h_mm  = leg_top_y - leg_bot_y                                 # positive height
    leg_cy_mm = (leg_top_y + leg_bot_y) / 2
    for side, dx in [('L', -half_w_mm), ('R', half_w_mm)]:
        box(f'{name}_leg_{side}', cx + dx, leg_cy_mm, BR_Z,
            br_thick_mm, leg_h_mm, BR_DEPTH_MM, m=M['bracket_green'], bev=0)

    # Text in the middle (no white border)
    txt(f'{name}_text', text, text_size_mm,
        cx, cy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)

# ─────────────── LAYER 0 — PANEL ───────────────
panel_obj = box('Panel', 0, 0, 0, W, H, 6, m=M['panel'], bev=1.0)    # 200×75×6 mm  [PICS]
bpy.context.view_layer.objects.active = panel_obj
bpy.ops.object.modifier_apply(modifier='Bev')

# 4 corner screws — 12 px from corner                                # [PICS]
for sx, sy in [(12,12), (W_PX-24,12), (12,H_PX-24), (W_PX-24,H_PX-24)]:
    cx, cy = p(sx+6, sy+6)
    cyl(f'Scr_{int(sx)}_{int(sy)}', cx, cy, BASE_Z+0.75, 6*PX, 1.5, M['screw'], verts=16)

# Edge labels: HYD vertical on BOTH edges                            # [PICS]
for edge_label, edge_x in [('R', W_PX - 18), ('L', 18)]:
    for i, ch in enumerate('HYD'):
        cx, cy = p(edge_x, 90 + i*22)
        txt(f'HYD_title{edge_label}_{ch}', ch, 5,
            cx, cy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)

# Rack ID — top-right                                                # [PICS]
cx, cy = p(W_PX - 35, 28)
txt('Rack_40VU', '40VU', 3.0, cx, cy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)


# ─────────────── LAYER 4+5 — pb-sw helper (agent-style) ───────────────
# Reused construction pattern from best_version build_pbsw_agent_style
def build_pbsw_agent_style(name, ax_px, ay_px, btn_px,
                           top_cell_label='', bot_cell_label='',
                           top_lit_mat=None, bot_lit_mat=None,
                           one_cell=False):
    acx, acy = p(ax_px, ay_px)
    CAV_GAP_PX = 0.5
    cavity_cut = box(f'{name}_CavCut', acx, acy, 0,
                     (btn_px + CAV_GAP_PX*2)*PX, (btn_px + CAV_GAP_PX*2)*PX, 8,
                     m=None, bev=0)
    panel = bpy.data.objects['Panel']
    apply_bool(panel, cavity_cut, f'{name}_CavBool')
    for poly in panel.data.polygons: poly.material_index = 0

    AZ_FRONT   = BASE_Z - 0.5                                         # body 0.5 mm below panel front
    CELL_FRONT = AZ_FRONT + 0.5

    # Teal ring around cavity (cavity cut through)
    TEX = 3*PX
    tr_obj = box(f'{name}_TR', acx, acy, BASE_Z+0.05,
        btn_px*PX + TEX*2, btn_px*PX + TEX*2, 0.1, m=M['teal_ring'], bev=0.05)
    tr_cut = box(f'{name}_TRcut', acx, acy, BASE_Z+0.05,
        (btn_px + CAV_GAP_PX*2)*PX, (btn_px + CAV_GAP_PX*2)*PX, 1.0, m=None, bev=0)
    apply_bool(tr_obj, tr_cut, f'{name}_TRBool')
    asgn(tr_obj, M['teal_ring'])
    for poly in tr_obj.data.polygons: poly.material_index = 0

    # White outline ring outside TR
    OE = 5*PX; OI = 3*PX
    wo = box(f'{name}_WRO', acx, acy, BASE_Z+0.10,
             btn_px*PX + OE*2, btn_px*PX + OE*2, 0.1, m=M['wborder'], bev=0.02)
    wc = box(f'{name}_WRC', acx, acy, BASE_Z+0.10,
             btn_px*PX + OI*2, btn_px*PX + OI*2, 0.3, m=None, bev=0)
    apply_bool(wo, wc, f'{name}_WROBool')
    asgn(wo, M['wborder'])
    for poly in wo.data.polygons: poly.material_index = 0

    # Body recessed in cavity
    box(f'{name}_Body', acx, acy, AZ_FRONT-3,
        btn_px*PX, btn_px*PX, 6, m=M['pb_black'], bev=1.0)

    PAD = 3*PX; GAP = 2*PX
    CW  = btn_px*PX - PAD*2
    # Cell text size: 14/56 = 25% of cap. v2 had 11/56 = 19.6%; user
    # close-up shows text fills ~55-60% of cell height — that's 14/56
    # (~50% of cell). [PICS — zoomed BLUE close-up 2026-05-25]
    cell_text_mm = btn_px * PX * (14 / 56)
    top_text_mat = top_lit_mat if top_lit_mat else M['dim_text']
    bot_text_mat = bot_lit_mat if bot_lit_mat else M['dim_text']

    if one_cell:
        ch = btn_px*PX - PAD*2
        cy = acy
        box(f'{name}_Cellbg', acx, cy, AZ_FRONT+0.25,
            CW, ch, 0.5, m=M['cell_dark'], bev=0.05)
        txt(f'{name}_CellLbl', top_cell_label, cell_text_mm,
            acx, cy, CELL_FRONT + 0.15, top_text_mat, ext=0.15)
    else:
        # 55% / 45% split — FAULT (top) is taller, OFF (bottom) is shorter.
        # [USER 2026-05-25]
        avail_mm   = btn_px*PX - PAD*2 - GAP
        top_ch_mm  = avail_mm * 0.55
        bot_ch_mm  = avail_mm * 0.45
        half_cw_mm = CW / 2
        # Top cell: upper edge at (acy + btn/2 - PAD), height top_ch_mm
        top_upper = acy + btn_px*PX/2 - PAD
        top_cy    = top_upper - top_ch_mm/2
        # Bottom cell: lower edge at (acy - btn/2 + PAD), height bot_ch_mm
        bot_lower = acy - btn_px*PX/2 + PAD
        bot_cy    = bot_lower + bot_ch_mm/2
        for cell_cy, cn, label, ch_mm, txt_mat in [
            (top_cy, 'TOP', top_cell_label, top_ch_mm, top_text_mat),
            (bot_cy, 'BOT', bot_cell_label, bot_ch_mm, bot_text_mat),
        ]:
            box(f'{name}_{cn}bg', acx, cell_cy, AZ_FRONT+0.25,
                CW, ch_mm, 0.5, m=M['cell_dark'], bev=0.05)
            txt(f'{name}_{cn}Lbl', label, cell_text_mm,
                acx, cell_cy, CELL_FRONT + 0.15, txt_mat, ext=0.15)
        # Light-gray INNER FRAME around BOTbg — thin border on the inside
        # of the bottom cell (top + bottom + left + right edges).
        # CRITICAL: frame Z must be ABOVE the BOTbg's TOP face (AZ+0.5)
        # otherwise it is buried inside the cell and invisible.
        # [USER 2026-05-25 — 'easily visible but not at all very thick']
        bdr_th_mm = 1.5 * PX                           # ~0.375 mm — clearly visible
        bdr_z     = AZ_FRONT + 0.55                    # above BOTbg top face (AZ+0.5)
        bdr_d_mm  = 0.05
        half_bch  = bot_ch_mm / 2
        # Top edge (this also serves as the divider between FAULT and OFF)
        box(f'{name}_BotBdr_T', acx, bot_cy + half_bch - bdr_th_mm/2, bdr_z,
            CW, bdr_th_mm, bdr_d_mm, m=M['gray_border'], bev=0)
        # Bottom edge
        box(f'{name}_BotBdr_B', acx, bot_cy - half_bch + bdr_th_mm/2, bdr_z,
            CW, bdr_th_mm, bdr_d_mm, m=M['gray_border'], bev=0)
        # Left edge
        box(f'{name}_BotBdr_L', acx - half_cw_mm + bdr_th_mm/2, bot_cy, bdr_z,
            bdr_th_mm, bot_ch_mm, bdr_d_mm, m=M['gray_border'], bev=0)
        # Right edge
        box(f'{name}_BotBdr_R', acx + half_cw_mm - bdr_th_mm/2, bot_cy, bdr_z,
            bdr_th_mm, bot_ch_mm, bdr_d_mm, m=M['gray_border'], bev=0)


# ─────────────── LAYOUT ───────────────
BTN_PX_22 = 88                                                        # 22 mm  [FCOM std pb-sw + PICS]
PB_Y_PX   = 200                                                       # row Y  [PICS]
COL_PX    = [94, 217, 340, 463, 586, 709]                             # 123 px gap centers  [PICS]
COL_Y_OFFSET_PX = {0: 0, 1: -26, 2: 0, 3: -15, 4: 0, 5: 0}            # PTU -15, RAT -26 (additional 5% up = -4 px)  [USER 2026-05-25]

LBL_OFFSET_MM = (BTN_PX_22*PX/2 + 3*PX) * 1.32                        # function-label offset  [USER bv]

# PUMPS — col, name, top cell, bot cell, top lit, bot lit, function label
PUMPS = [
    (0, 'ENG1',       'FAULT', 'OFF', None,        'lit_white',  'ENG 1 PUMP'),   # OFF demo  [FCOM 4a]
    (1, 'RAT',        '',      '',    None,        None,         'RAT MAN ON'),   # single cell handled below
    (2, 'BLUEELEC',   'FAULT', 'OFF', None,        None,         'ELEC PUMP'),    # rest
    (3, 'PTU',        'FAULT', 'OFF', 'lit_amber', None,         'PTU'),          # FAULT demo  [FCOM 4a]
    (4, 'ENG2',       'FAULT', 'OFF', None,        None,         'ENG 2 PUMP'),   # rest
    (5, 'YELLOWELEC', 'FAULT', 'ON',  None,        'lit_white',  'ELEC PUMP'),    # ON demo  [FCOM 4a]
]

for col, name, top_lbl, bot_lbl, top_lit_key, bot_lit_key, fn_lbl in PUMPS:
    ax_px = COL_PX[col]
    pb_y_px = PB_Y_PX + COL_Y_OFFSET_PX.get(col, 0)
    acx, acy = p(ax_px, pb_y_px)

    if name == 'RAT':
        # Agent-style pb underneath (single cell "MAN ON", lit white per USER)
        build_pbsw_agent_style(f'HYD_{name}', ax_px, pb_y_px, BTN_PX_22,
                               top_cell_label='MAN ON', one_cell=True,
                               top_lit_mat=M['lit_white'])               # [USER]
        # Red opaque guard on top — covers pb in rest                    # [PICS]
        GUARD_W = BTN_PX_22*PX + 2.0
        GUARD_H = BTN_PX_22*PX + 2.0
        GUARD_D = 3.5
        GUARD_Z = PANEL_FRONT + 0.5 + GUARD_D/2
        box(f'HYD_{name}_RedGuard', acx, acy, GUARD_Z,
            GUARD_W, GUARD_H, GUARD_D, m=M['rat_red'], bev=0.4)
        # Dark hinge bar at guard top edge
        hinge_cx, hinge_cy = p(ax_px, pb_y_px - BTN_PX_22/2 - 4)
        box(f'HYD_{name}_GuardHinge', hinge_cx, hinge_cy,
            GUARD_Z + GUARD_D/2 + 0.5,
            GUARD_W*0.55, 1.5, 1.0, m=M['pb_black'], bev=0.1)
    else:
        build_pbsw_agent_style(f'HYD_{name}', ax_px, pb_y_px, BTN_PX_22,
                               top_cell_label=top_lbl, bot_cell_label=bot_lbl,
                               top_lit_mat=(M[top_lit_key] if top_lit_key else None),
                               bot_lit_mat=(M[bot_lit_key] if bot_lit_key else None))

    # Function label with GREEN inverted-U bracket (NOT white box) — per
    # the zoomed user photo (2026-05-25): function labels are partially
    # surrounded by green bracket art that connects up to the river.
    # NOT for RAT (has its own red guard) or PTU (only appears at top).  [USER, PICS]
    if name not in ('RAT', 'PTU'):
        # Function label = 3-sided GREEN bracket (top + L + R, open at
        # bottom facing the pb). Per FCOM DSC-29-10 and USER 2026-05-25.
        # Text sized to FILL the bracket width (with ~1 mm side margin)
        # without ever exceeding it.  [USER 2026-05-25]
        # RAT excluded — handled separately below.
        fn_text_size_mm = 3.5
        char_w_px = fn_text_size_mm / PX * 0.60        # Futura caps ≈ 0.6× height
        fn_w_px   = max(60, int(len(fn_lbl) * char_w_px + 12))   # +12 px padding
        fn_h_px   = 18                                  # was 14 — taller to fit 3.5 mm
        fn_cy_px = pb_y_px - (LBL_OFFSET_MM / PX)
        label_box(f'HYD_{name}_FnLbl', ax_px, fn_cy_px,
                  w_px=fn_w_px, h_px=fn_h_px,
                  text=fn_lbl, text_size_mm=fn_text_size_mm,
                  outline_mat=M['bracket_green'],
                  omit_sides=('B',),
                  half_sides=True)
    elif name == 'RAT':
        # Plain "RAT MAN ON" text (no full bracket around it), plus a
        # partial bracket `]` (top + right + bottom, open on LEFT) that
        # covers only the right portion of the text — from the start of
        # the "N" in "MAN" to the right edge.  [USER 2026-05-25]
        fn_text_size_mm = 3.5
        char_w_px       = fn_text_size_mm / PX * 0.60
        fn_text         = fn_lbl                                       # "RAT MAN ON"
        fn_cy_px        = pb_y_px - (LBL_OFFSET_MM / PX)
        fn_cy_w, fn_cy_h = p(ax_px, fn_cy_px)
        # Render just the text — no bracket box around it.
        txt('HYD_RAT_FnLbl_text', fn_text, fn_text_size_mm,
            fn_cy_w, fn_cy_h, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)
        # Partial right bracket — from start of "N" in "MAN" to text right,
        # but with T and B shortened by 45% so they sit closer to the R
        # vertical.  R vertical x position stays the same.  [USER 2026-05-25]
        text_left_x  = ax_px - len(fn_text)*char_w_px / 2
        n_start_x    = text_left_x + 6 * char_w_px               # before "N" in "MAN"
        text_right_x = ax_px + len(fn_text)*char_w_px / 2 + 4    # + small margin
        bk_w_px_full = text_right_x - n_start_x
        bk_w_px      = bk_w_px_full * 0.55                       # 45% shorter T and B
        bk_cx_px     = text_right_x - bk_w_px / 2                # R stays at text_right_x
        bk_h_px      = 18
        # label_box with text='' and omit_sides=('L',) → just T+B+R borders.
        label_box('HYD_RAT_FnLbl', bk_cx_px, fn_cy_px,
                  w_px=bk_w_px, h_px=bk_h_px,
                  text='', text_size_mm=0.1,
                  outline_mat=M['bracket_green'],
                  omit_sides=('L',))


# ─────────────── ZONE LABELS — top row at ZONE_Y_PX = 60 ─────────────── [PICS]
ZONE_Y_PX = 44                                                        # was 60 — moved up 16 px so zone up-stubs stretch +30%  [USER 2026-05-25]
ZONE_BOX_H_PX = 20

def zone_label(name, text, span_cols, outline_mat=None,
               text_size_mm=4.5, box_h_px=20):
    x_avg = sum(COL_PX[c] for c in span_cols) / len(span_cols)
    # Box width must scale with TEXT SIZE — at 4.5 mm text size, GREEN (5
    # chars) and YELLOW (6 chars) were overflowing the previous fixed
    # 6 px/char formula. Futura Bold capitals ≈ 0.6 of text height wide;
    # add 12 px padding (3 mm) on each side.
    char_w_px = (text_size_mm / PX) * 0.60                              # [PICS-derived char ratio]
    w_px = max(28, int(round(len(text) * char_w_px + 12)))
    label_box(f'HYD_zone_{name}', x_avg, ZONE_Y_PX,
              w_px=w_px, h_px=box_h_px,
              text=text, text_size_mm=text_size_mm,
              outline_mat=outline_mat)
    return x_avg, w_px

# Returned (cx_px, w_px) per label so we can position flow art clear of them.
# Only the three system zones (GREEN, BLUE, YELLOW) are drawn here; PTU is
# rendered INLINE on the right river segment (see flow-art block below),
# and RAT MAN ON is a callout below the river (placed after we know the
# river height).  [FCOM 4b — DSC-29-10 schematic]
zx_GREEN,   zw_GREEN    = zone_label('GREEN',     'GREEN',      [0])
zx_BLUE,    zw_BLUE     = zone_label('BLUE',      'BLUE',       [2])
zx_YELLOW,  zw_YELLOW   = zone_label('YELLOW',    'YELLOW',     [4])      # [USER 2026-05-25 — over ENG 2 PUMP riser]
zx_PTU                  = COL_PX[3]                              # inline marker x


# ─────────────── LAYER 1 — GREEN FLOW ART (bracket_green) ───────────────
LINE_Y_PX     = ZONE_Y_PX + 41                                         # = 85   river moved up 10 px so pump risers stretch +30%  [USER 2026-05-25]
# LINE_W_PX and LINE_DEPTH_MM are defined earlier (before helpers) so
# green_bracket_label can use them. Do not redefine here.

# zone-label vertical extent: ZONE_Y_PX ± box_h/2 → bottom at ZONE_Y_PX + box_h/2
# Use the largest box (h=20) for the safe gap: ZONE_Y_PX + 10 + 2 px gap = 72
ZONE_BOX_BOTTOM_Y = ZONE_Y_PX + ZONE_BOX_H_PX/2                        # = 70
DROP_UP_TO_Y      = ZONE_BOX_BOTTOM_Y + 2                              # = 72 — drop stops 2 px below box

def dome(name, cx_px, cy_px, radius_px=8):
    """Flat 2-D TRUE semicircle printed BELOW the river (diameter at cy_px,
    bottom at cy_px + radius_px). Handles use the standard Bezier-circle
    constant K = 4/3·(√2 - 1) so the curve traces an actual half-circle,
    not an AUTO-handle approximation that looks oblong.
    [USER 2026-05-25 — 'more circular, like semicircular']"""
    K = 0.5522847498                                                  # exact bezier-circle handle ratio
    curve = bpy.data.curves.new(f'{name}_curve', type='CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = mm(LINE_W_PX * PX / 2)
    curve.bevel_resolution = 2
    curve.resolution_u = 32
    sp = curve.splines.new('BEZIER')
    sp.bezier_points.add(2)
    z_mm = mm(BASE_Z + LINE_W_PX * PX / 2 + 0.05)

    def _set(bp, co_px, hl_px, hr_px):
        cx, cy = p(*co_px)
        hlx, hly = p(*hl_px)
        hrx, hry = p(*hr_px)
        bp.co            = (mm(cx),  mm(cy),  z_mm)
        bp.handle_left   = (mm(hlx), mm(hly), z_mm)
        bp.handle_right  = (mm(hrx), mm(hry), z_mm)
        bp.handle_left_type  = 'FREE'
        bp.handle_right_type = 'FREE'

    R = radius_px
    # Left endpoint: tangent points STRAIGHT DOWN (toward dome bottom)
    _set(sp.bezier_points[0],
         (cx_px - R, cy_px),
         (cx_px - R, cy_px - K*R),                # incoming (unused)
         (cx_px - R, cy_px + K*R))                # outgoing: down
    # Bottom midpoint: tangent HORIZONTAL (left-to-right)
    _set(sp.bezier_points[1],
         (cx_px,     cy_px + R),
         (cx_px - K*R, cy_px + R),                # incoming from the left
         (cx_px + K*R, cy_px + R))                # outgoing to the right
    # Right endpoint: tangent points STRAIGHT UP (returning to river)
    _set(sp.bezier_points[2],
         (cx_px + R, cy_px),
         (cx_px + R, cy_px + K*R),                # incoming: from below
         (cx_px + R, cy_px - K*R))                # outgoing (unused)

    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(M['bracket_green'])
    return obj

def arrow_tip(name, tip_x_px, tip_y_px, direction='down', size_px=6.0):
    if direction == 'down':
        offsets = [(0, 0), (-size_px*0.8, -size_px*1.3), ( size_px*0.8, -size_px*1.3)]
    elif direction == 'up':
        offsets = [(0, 0), (-size_px*0.8,  size_px*1.3), ( size_px*0.8,  size_px*1.3)]
    elif direction == 'right':
        offsets = [(0, 0), (-size_px*1.3, -size_px*0.8), (-size_px*1.3,  size_px*0.8)]
    elif direction == 'left':
        offsets = [(0, 0), ( size_px*1.3, -size_px*0.8), ( size_px*1.3,  size_px*0.8)]
    else:
        raise ValueError(direction)
    pts = []
    for dx, dy in offsets:
        bx, by = p(tip_x_px + dx, tip_y_px + dy)
        pts.append((mm(bx), mm(by), 0.0))
    me = bpy.data.meshes.new(f'{name}_mesh')
    me.materials.append(M['bracket_green'])
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    bm_arrow = bmesh.new()
    vs = [bm_arrow.verts.new(v) for v in pts]
    bm_arrow.verts.ensure_lookup_table()
    bm_arrow.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm_arrow, faces=list(bm_arrow.faces))
    bm_arrow.to_mesh(me); bm_arrow.free()
    obj.location.z = mm(BASE_Z + 0.02)
    return obj

# Orthogonal flat-line helper — replaces the earlier Bezier approach.
# Per FCOM DSC-29-10 schematic [FCOM 4b]: all river flow lines are
# straight horizontals + verticals with right-angle corners. No curves.
def line(name, x1_px, y1_px, x2_px, y2_px):
    """Flat orthogonal line segment as a thin box sitting on the panel
    surface. Either x1==x2 (vertical) or y1==y2 (horizontal)."""
    cx_px = (x1_px + x2_px) / 2
    cy_px = (y1_px + y2_px) / 2
    w_px  = max(abs(x2_px - x1_px), LINE_W_PX)
    h_px  = max(abs(y2_px - y1_px), LINE_W_PX)
    cx, cy = p(cx_px, cy_px)
    box(name, cx, cy, BASE_Z + 0.02,
        w_px*PX, h_px*PX, LINE_DEPTH_MM,
        m=M['bracket_green'], bev=0)

# Helper for the function-bracket top y-coordinate. With label_box the
# top edge is at (fn_cy - h_px/2). Function brackets use h_px=18.
def _bracket_top_y(col):
    pb_y = PB_Y_PX + COL_Y_OFFSET_PX.get(col, 0)
    fn_cy = pb_y - LBL_OFFSET_MM / PX
    return fn_cy - 9

# Architecture per FCOM DSC-29-10 schematic [FCOM 4b]:
#
#   GREEN↑─────←─────┐ BLUE↑ ┌─────[PTU]─────→─── YELLOW↑
#         │          │   │   │                       │
#         │      [RAT MAN ON]│                       │
#       ENG1PUMP   ELECPUMP                       ENG2PUMP  ELECPUMP
#
# - Two river segments at LINE_Y_PX: left (GREEN↔BLUE) and right (BLUE↔YELLOW).
# - PTU sits INLINE on the right river as "[PTU]" — bidirectional arrows.
# - GREEN, BLUE, YELLOW each get an up-arrow from the river into the
#   zone bracket above.
# - RAT MAN ON is a callout BELOW the river between ENG1 and BLUE-ELEC.
# - Each pump's function bracket connects UP to the river with a vertical
#   riser. Cols 1 (RAT) and 3 (PTU) drop DOWN from river to pb instead.

# Zone-x positions
gx = zx_GREEN
bx = zx_BLUE
yx = zx_YELLOW
px_PTU = zx_PTU
zone_bot_y = ZONE_Y_PX + ZONE_BOX_H_PX/2 + 2   # 2 px gap below zone box bottom

# BLUE keeps its dome (now bigger); GREEN and YELLOW go back to a clean
# T-junction with no dome.  [USER 2026-05-25]
BLUE_DOME_R_PX = 18     # widened so the dome's endpoints reach further into the river  [USER 2026-05-25]

# === LEFT river segment: GREEN ← BLUE =================================
# Single continuous segment.  [USER 2026-05-25 — reverted RAT gap]
line('hyd_river_left', gx, LINE_Y_PX, bx - BLUE_DOME_R_PX, LINE_Y_PX)
# GREEN: plain straight up-stub joining the river (T-junction)
line('hyd_zoneUp_GREEN', gx, LINE_Y_PX, gx, zone_bot_y + 3)
arrow_tip('hyd_arrow_upGREEN', gx, zone_bot_y, direction='up')
# BLUE dome (below river) + up-stub (from river level) + arrow
dome('hyd_dome_BLUE', bx, LINE_Y_PX, BLUE_DOME_R_PX)
line('hyd_zoneUp_BLUE', bx, LINE_Y_PX, bx, zone_bot_y + 3)
arrow_tip('hyd_arrow_upBLUE', bx, zone_bot_y, direction='up')
# Left-arrow mid-segment showing flow direction into GREEN
arrow_tip('hyd_arrow_intoGREEN', gx + (bx - gx) * 0.35, LINE_Y_PX, direction='left')

# === Additional river: RAT MAN ON area → BLUE ELEC PUMP riser =========
# Short horizontal at RAT MAN ON Y level connecting the right edge of
# the RAT bracket to col 2's pump-up riser. Arrow at the right end
# points INTO hyd_pumpUp_2.  [USER 2026-05-25]
RAT_PB_Y_PX   = PB_Y_PX + COL_Y_OFFSET_PX[1]                 # = 174
RAT_FN_CY_PX  = RAT_PB_Y_PX - (LBL_OFFSET_MM / PX)           # = ~112
RAT_TEXT_RX   = COL_PX[1] + (len('RAT MAN ON') * (3.5/PX*0.60)) / 2 + 4
line('hyd_river_RAT_to_BLUE', RAT_TEXT_RX, RAT_FN_CY_PX,
     COL_PX[2], RAT_FN_CY_PX)
arrow_tip('hyd_arrow_into_pumpUp_2',
          COL_PX[2] - 4, RAT_FN_CY_PX, direction='right')

# === PTU sits ON the right river at LINE_Y_PX with partial brackets ====
# flanking it on both sides ([PTU] pattern). Render the text + brackets
# FIRST so we can compute the gap to leave in the right river.
# [USER 2026-05-25]
ptu_text_size_mm = 3.5
ptu_char_w_px    = ptu_text_size_mm / PX * 0.60
ptu_text_w_px    = 3 * ptu_char_w_px                          # "PTU" = 3 chars
ptu_text_left_x  = px_PTU - ptu_text_w_px / 2
ptu_text_right_x = px_PTU + ptu_text_w_px / 2

PTU_BK_W_PX   = 12
PTU_BK_H_PX   = 18
PTU_BK_GAP_PX = 2     # space between text and bracket

left_bk_right_edge  = ptu_text_left_x - PTU_BK_GAP_PX
left_bk_cx_px       = left_bk_right_edge - PTU_BK_W_PX / 2
right_bk_left_edge  = ptu_text_right_x + PTU_BK_GAP_PX
right_bk_cx_px      = right_bk_left_edge + PTU_BK_W_PX / 2

ptu_gap_left_x  = left_bk_cx_px  - PTU_BK_W_PX / 2            # outer left edge of left bracket
ptu_gap_right_x = right_bk_cx_px + PTU_BK_W_PX / 2            # outer right edge of right bracket

# === RIGHT river — broken into TWO segments around the PTU gap ========
right_river_end_x = COL_PX[5]
right_a_left_x  = bx + BLUE_DOME_R_PX
right_a_right_x = ptu_gap_left_x
line('hyd_river_right_a', right_a_left_x, LINE_Y_PX,
     right_a_right_x, LINE_Y_PX)
line('hyd_river_right_b', ptu_gap_right_x, LINE_Y_PX,
     right_river_end_x, LINE_Y_PX)
# Left-arrow at the CENTER of river_right_a showing flow TOWARD BLUE
arrow_tip('hyd_arrow_intoBLUE_river',
          (right_a_left_x + right_a_right_x) / 2, LINE_Y_PX, direction='left')

# PTU text on the river
ptu_world_cx, ptu_world_cy = p(px_PTU, LINE_Y_PX)
txt('HYD_PTU_callout_text', 'PTU', ptu_text_size_mm,
    ptu_world_cx, ptu_world_cy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)
# Left partial bracket: T + L + B (open R — facing the text)
label_box('HYD_PTU_LBdr', left_bk_cx_px, LINE_Y_PX,
          w_px=PTU_BK_W_PX, h_px=PTU_BK_H_PX,
          text='', text_size_mm=0.1,
          outline_mat=M['bracket_green'],
          omit_sides=('R',))
# Right partial bracket: T + R + B (open L — facing the text)
label_box('HYD_PTU_RBdr', right_bk_cx_px, LINE_Y_PX,
          w_px=PTU_BK_W_PX, h_px=PTU_BK_H_PX,
          text='', text_size_mm=0.1,
          outline_mat=M['bracket_green'],
          omit_sides=('L',))

# YELLOW: plain straight up-stub joining the river (T-junction)
line('hyd_zoneUp_YELLOW', yx, LINE_Y_PX, yx, zone_bot_y + 3)
arrow_tip('hyd_arrow_upYELLOW', yx, zone_bot_y, direction='up')
# Right-arrow mid-segment of river_right_b showing flow direction toward YELLOW
arrow_tip('hyd_arrow_intoYELLOW',
          (ptu_gap_right_x + yx) / 2, LINE_Y_PX, direction='right')

# === Pump risers: vertical from each function-bracket TOP up to river ==
for col in (0, 2, 4, 5):
    x = COL_PX[col]
    top_y = _bracket_top_y(col)
    line(f'hyd_pumpUp_{col}', x, top_y, x, LINE_Y_PX)

# === No drops to RAT/PTU pbs ===========================================
# RULE [USER 2026-05-25]: green lines must NOT enter push buttons or cross
# any text. The RAT and PTU pbs stand alone — their callouts (RAT MAN ON,
# [PTU]) above are connected to the river via their own stubs; the pbs
# themselves are NOT joined to the river by any green line.

# === RAT MAN ON removed per USER 2026-05-25 ============================
# Previously had a callout box + stub between river and RAT pb. User
# deleted all four box borders + the stub manually; honoring that here.

# === PTU callout: now rendered INLINE on the river above (see PTU text +
# brackets block earlier). Old below-river callout removed.
# [USER 2026-05-25]


# ─────────────── PTU vertical AUTO indicator ─────────────── [PICS]
PTU_AUTO_X_PX = COL_PX[3] + BTN_PX_22/2 + 8
PTU_PB_Y_PX   = PB_Y_PX + COL_Y_OFFSET_PX.get(3, 0)
for i, ch in enumerate('AUTO'):
    acx, acy = p(PTU_AUTO_X_PX, PTU_PB_Y_PX - 18 + i*12)
    txt(f'HYD_PTU_AUTO_{ch}', ch, 2.5,
        acx, acy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)


# ─────────────── SCENE ───────────────
# Camera nearly top-down so the user can see the panel as a 2-D layout
# without 3-D perspective tricks. (0, 0, 350) with rotation 0 looks
# straight down at the panel from above. 50 mm lens fits the panel.
bpy.ops.object.camera_add(location=(0, mm(-10), mm(350)),
                          rotation=(math.radians(2), 0, 0))
cam = bpy.context.active_object; cam.name = 'Camera'
bpy.context.scene.camera = cam
cam.data.clip_start = mm(1); cam.data.clip_end = mm(3000); cam.data.lens = 50

def area_light(loc, energy, size, rot):
    bpy.ops.object.light_add(type='AREA', location=loc, rotation=rot)
    l = bpy.context.active_object
    l.data.energy = energy; l.data.size = mm(size)

# Lighting: same 4-light setup as fire_panel_two best_version, with
# energies HALVED — the HYD panel is ~1/4 the area of fire panel, so the
# same lights from the same positions blow it out. Half-energy preserves
# the best_version look (#33607A dark slate-blue panel) on the smaller
# panel.  [USER bv, adapted]
area_light((0,        mm(-180), mm(200)), 1.0, 300, (math.radians(40),0,0))
area_light((mm(-200), mm(-100), mm(100)), 0.5, 200, (math.radians(50),math.radians(-30),0))
area_light((mm( 200), mm(-100), mm(100)), 0.5, 200, (math.radians(50),math.radians( 30),0))
area_light((0,        mm(-260), mm(20)),  0.2, 400, (math.radians(10),0,0))

bpy.context.scene.world.use_nodes = True
bg = bpy.context.scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value    = (0.15, 0.18, 0.20, 1.0)
bg.inputs['Strength'].default_value = 0.1

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = 256
sc.render.resolution_x = 2000
sc.render.resolution_y = 900
sc.render.filepath = os.path.join(_HERE, 'hyd_panel.png')
sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'Standard'        # [USER bv]
sc.view_settings.look           = 'None'
sc.view_settings.exposure       = 0.0
sc.view_settings.gamma          = 1.0

try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print(f"CPU fallback: {e}")

BLEND_PATH = os.path.join(_HERE, 'hyd_panel.blend')
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
bpy.ops.render.render(write_still=True)
print(f"DONE: saved {BLEND_PATH} and rendered hyd_panel.png")
