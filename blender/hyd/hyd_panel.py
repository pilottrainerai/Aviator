"""
A320 HYDRAULIC Panel — standalone Blender scene (overhead-bom skill)
FCOM DSC-29-20. PX = 0.25 (1 CSS px = 0.25 mm).

PB CONSTRUCTION: identical "agent-style" logic from the fire panel —
  cavity in panel + teal ring + white outline + recessed body + cells.
  Size is the standard 22 mm pb-sw (NOT the 14 mm AGENT size).

6 controls, all reuse BOM templates:
  • ENG 1 PUMP        (T-PBSW-22-2CELL)  OFF / FAULT,    GREEN system
  • BLUE ELEC PUMP    (T-PBSW-22-2CELL)  AUTO / FAULT,   BLUE system
  • PTU               (T-PBSW-22-2CELL)  AUTO / FAULT,   GREEN+YELLOW
  • YELLOW ELEC PUMP  (T-PBSW-22-2CELL)  ON / FAULT,     YELLOW system
  • ENG 2 PUMP        (T-PBSW-22-2CELL)  OFF / FAULT,    YELLOW system
  • RAT MAN ON        (T-PBSW-22-1CELL)  MAN ON,         single cell

Panel material color: #33607A (the "best version" Airbus teal the user liked).
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
# Layout reverse-engineered from FCOM DSC-29-20 P 1/8 illustration:
# horizontal panel with 6 pbs in a SINGLE row, RAT MAN ON between ENG 1 and
# BLUE ELEC. Zone labels (GREEN, BLUE, PTU, YELLOW) with brackets pointing
# down to their pbs. HYD title vertical on right edge, 40VU rack ID top-right.
W_PX = 800       # 200 mm — six pbs need wider real estate
H_PX = 300       # 75 mm — landscape, single row of pbs
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

# Same material slot names as the fire panel best_version, plus the
# FCOM-equivalent lit-state cell legend materials:
#   lit_white  — used for OFF, ON, AVAIL-white (function selected/active)
#   lit_amber  — used for FAULT (Airbus standard amber caution color)
#   lit_blue   — Airbus blue ON legend (e.g. APU MASTER ON; not used on HYD)
#   lit_green  — green AVAIL/operating legend
M = {
    'panel':        mat('panel',        '#33607A', 0.60),
    'screw':        mat('screw',        '#C8CED6', 0.25, 0.90),
    # Real A320 pb bodies are charcoal, near-black, matte plastic (NOT
    # gray-blue). Cells are essentially pure black when unlit so legends
    # are almost invisible in rest — lit legends jump out by contrast.
    'pb_black':     mat('pb_black',     '#0F1015', 0.70),     # was #1e2430, 0.50
    'cell_dark':    mat('cell_dark',    '#030305', 0.70),     # was #06080C, 0.60
    'dim_text':     mat('dim_text',     '#1A1E25', 0.60),     # was #3A4252 — now nearly invisible at rest
    'wborder':      mat('wborder',      '#FFFFFF', 0.20, em='#FFFFFF', em_str=3),
    'teal_ring':    mat('teal_ring',    '#6E9292', 0.45),
    'wtext':        mat('wtext',        '#E8ECF4', 0.20, em='#FFFFFF', em_str=4),
    # FCOM cell-legend lit-state materials (cap LIGHTS UP behavior).
    # Verified against FCOM:
    #   OFF      → white  ("The OFF legend is white" / "OFF button comes on white")
    #   ON       → white  ("ON : The ON light comes on white.")
    #   MAN / MAN ON → white  ("MAN : This legend appears in white")
    #   FAULT    → amber  ("This amber light comes on")
    #   blue legend used on a few pbs (e.g. APU MASTER ON) — kept for reuse
    #   green legend used on a few avail/green pbs — kept for reuse
    # Lit-state emission tuned for crisp legends WITHOUT bloom smearing.
    # 15 caused the amber FAULT text to bleed colored halos into neighboring
    # geometry (the "dotted circle" artifact). 6 is bright enough to clearly
    # read as "lit" but tight enough that text edges stay sharp.
    'lit_white':    mat('lit_white',    '#FFFFFF', 0.20, em='#FFFFFF', em_str=6),
    'lit_amber':    mat('lit_amber',    '#FFB300', 0.25, em='#FFB300', em_str=6),
    'lit_blue':     mat('lit_blue',     '#4F8CFF', 0.25, em='#7FB0FF', em_str=5),
    'lit_green':    mat('lit_green',    '#00C26B', 0.25, em='#00FF7F', em_str=5),
    # T-GUARDED-RAT guard cover — solid red opaque plastic, photo-matched
    'rat_red':      mat('rat_red',      '#C82010', 0.45),
    # Green flow-line + arrowhead material (Layer 1). Lower emission than
    # v7 (was strength 3, arrows looked washed-out white). Now relies on
    # base color for visibility, with just enough emission to feel painted.
    'bracket_green': mat('bracket_green', '#2F9050', 0.30, em='#3FAA60', em_str=0.8),
}

# Cockpit font — try Futura Bold first (closer to real Airbus panel
# typeface per user photos), fall back to Arial Bold (project spec
# fallback for Helvetica Neue), then Blender's default Bfont.
COCKPIT_FONT = None
for label, path in [
    ("Futura.ttc",    "/System/Library/Fonts/Supplemental/Futura.ttc"),
    ("Arial Bold",    "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]:
    try:
        COCKPIT_FONT = bpy.data.fonts.load(path)
        print(f"Loaded cockpit font: {label}")
        break
    except Exception as e:
        print(f"  could not load {label}: {e}")
if COCKPIT_FONT is None:
    print("All custom fonts failed; using Blender default Bfont")

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
    if COCKPIT_FONT:
        o.data.font = COCKPIT_FONT
    if m: o.data.materials.append(m)
    return o

def apply_bool(obj, cutter, tag='Cut'):
    bpy.context.view_layer.objects.active = obj
    bm = obj.modifiers.new(tag, 'BOOLEAN')
    bm.operation = 'DIFFERENCE'; bm.object = cutter
    bpy.ops.object.modifier_apply(modifier=tag)
    cutter.hide_render = True; cutter.hide_viewport = True

BASE_Z      = 3.0
PANEL_FRONT = BASE_Z

# ---------------------------------------------------------------- LAYER 2 HELPER
def label_box(name, cx_px, cy_px, w_px, h_px, text, text_size_mm,
              outline_mat=None, text_mat=None):
    """Layer-2 white rectangular outline + Layer-3 centered text inside.
    Per the Airbus signature look — every label on the panel face is
    framed by a thin white rectangle border.

    Builds the outline as 4 thin extruded boxes (top/bot/left/right
    edges), and a centered text object inside.
    """
    if outline_mat is None: outline_mat = M['wtext']
    if text_mat is None:    text_mat    = M['wtext']
    cx, cy = p(cx_px, cy_px)
    BORDER_W_PX  = 1.6   # ~0.4 mm — thicker than v6 (0.8) for clear visibility
    BORDER_DEPTH = 0.05
    BORDER_Z     = PANEL_FRONT + 0.02
    # 4 edges of the rectangle
    half_w_mm = w_px * PX / 2
    half_h_mm = h_px * PX / 2
    border_thick_mm = BORDER_W_PX * PX
    # Top + bottom
    for side, dy in [('T', half_h_mm), ('B', -half_h_mm)]:
        box(f'{name}_box_{side}', cx, cy + dy, BORDER_Z,
            w_px*PX, border_thick_mm, BORDER_DEPTH,
            m=outline_mat, bev=0)
    # Left + right
    for side, dx in [('L', -half_w_mm), ('R', half_w_mm)]:
        box(f'{name}_box_{side}', cx + dx, cy, BORDER_Z,
            border_thick_mm, h_px*PX, BORDER_DEPTH,
            m=outline_mat, bev=0)
    # Text centered in the box
    txt(f'{name}_text', text, text_size_mm,
        cx, cy, PANEL_FRONT + 0.01,
        text_mat, ext=0.01)

# ---------------------------------------------------------------- PANEL
panel_obj = box('Panel', 0, 0, 0, W, H, 6, m=M['panel'], bev=1.0)
bpy.context.view_layer.objects.active = panel_obj
bpy.ops.object.modifier_apply(modifier='Bev')

# 4 corner screws
for sx, sy in [(12,12), (W_PX-24,12), (12,H_PX-24), (W_PX-24,H_PX-24)]:
    cx, cy = p(sx+6, sy+6)
    cyl(f'Scr_{int(sx)}_{int(sy)}', cx, cy, BASE_Z+0.75, 6*PX, 1.5, M['screw'], verts=16)

# Per FCOM illustration + user photos: HYD title is vertically stacked
# on BOTH the left AND right edges. 40VU is the rack-position identifier
# in the top-right corner.
for edge_label, edge_x in [('R', W_PX - 18), ('L', 18)]:
    for i, ch in enumerate('HYD'):
        cx, cy = p(edge_x, 90 + i*22)
        txt(f'HYD_title{edge_label}_{ch}', ch, 5,
            cx, cy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)

# 40VU rack ID, top-right corner
cx, cy = p(W_PX - 35, 28)
txt('Rack_40VU', '40VU', 3.0, cx, cy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)


# ---------------------------------------------------------------- HELPER
def build_pbsw_agent_style(name, ax_px, ay_px, btn_px,
                           top_cell_label='', bot_cell_label='',
                           top_lit_mat=None, bot_lit_mat=None,
                           one_cell=False):
    """T-PBSW-AGENT-STYLE construction for a pb-sw of any size.

    Mirrors the AGENT pb logic from eng1_left_panel best_version:
      1. Cut a cavity hole in the panel slightly larger than the body
      2. Thin teal ring (TR) around the cavity opening, with cavity cut through
      3. Thin white outline ring (WRO) outside TR
      4. Body recessed 0.5 mm BELOW the panel front (sunk in cavity)
      5. Cell(s) sit on body top, just below panel front
      6. Cell legend text: dim_text by default (rest); pass a lit material
         (e.g. M['lit_white'], M['lit_amber']) to render that cell in its
         FCOM-equivalent LIT state — text becomes bright and emits light.

    btn_px is the cap size in pixels (88 = 22 mm; the agent uses 56 = 14 mm).
    Ring dimensions (TEX, OE, OI) and recess depth stay constant — they're
    absolute distances around any size pb.
    """
    acx, acy = p(ax_px, ay_px)

    # --- 1. CAVITY in panel
    CAV_GAP_PX = 0.5
    cavity_cut = box(f'{name}_CavCut', acx, acy, 0,
                     (btn_px + CAV_GAP_PX*2)*PX, (btn_px + CAV_GAP_PX*2)*PX, 8,
                     m=None, bev=0)
    panel = bpy.data.objects['Panel']
    apply_bool(panel, cavity_cut, f'{name}_CavBool')
    for poly in panel.data.polygons: poly.material_index = 0

    AZ_FRONT   = BASE_Z - 0.5     # body top 0.5 mm BELOW panel front (recessed)
    CELL_FRONT = AZ_FRONT + 0.5

    # --- 2. TR (teal ring around cavity, with cavity cut through it)
    TEX = 3*PX
    tr_obj = box(f'{name}_TR', acx, acy, BASE_Z+0.05,
        btn_px*PX + TEX*2, btn_px*PX + TEX*2, 0.1, m=M['teal_ring'], bev=0.05)
    tr_cut = box(f'{name}_TRcut', acx, acy, BASE_Z+0.05,
        (btn_px + CAV_GAP_PX*2)*PX, (btn_px + CAV_GAP_PX*2)*PX, 1.0, m=None, bev=0)
    apply_bool(tr_obj, tr_cut, f'{name}_TRBool')
    asgn(tr_obj, M['teal_ring'])
    for poly in tr_obj.data.polygons: poly.material_index = 0

    # --- 3. WRO (white outline ring outside TR)
    OE = 5*PX; OI = 3*PX
    wo = box(f'{name}_WRO', acx, acy, BASE_Z+0.10,
             btn_px*PX + OE*2, btn_px*PX + OE*2, 0.1, m=M['wborder'], bev=0.02)
    wc = box(f'{name}_WRC', acx, acy, BASE_Z+0.10,
             btn_px*PX + OI*2, btn_px*PX + OI*2, 0.3, m=None, bev=0)
    apply_bool(wo, wc, f'{name}_WROBool')
    asgn(wo, M['wborder'])
    for poly in wo.data.polygons: poly.material_index = 0

    # --- 4. BODY (recessed in cavity)
    box(f'{name}_Body', acx, acy, AZ_FRONT-3,
        btn_px*PX, btn_px*PX, 6, m=M['pb_black'], bev=1.0)

    # --- 5. CELLS + 6. LEGEND TEXT
    PAD = 3*PX; GAP = 2*PX
    CW  = btn_px*PX - PAD*2
    # Cell text size scales proportionally with pb size (agent: 9 px @ 56 = 0.161)
    cell_text_mm = btn_px * PX * (9 / 56)   # ≈ 0.161 × cap_mm
    # Choose cell-text materials based on lit/rest state.
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
        ch = (btn_px*PX - PAD*2 - GAP) / 2
        top_cy = acy + ch/2 + GAP/2 + PAD/2 - 0.5*PX
        bot_cy = acy - ch/2 - GAP/2 - PAD/2 + 0.5*PX
        for cell_cy, cn, label, txt_mat in [
            (top_cy, 'TOP', top_cell_label, top_text_mat),
            (bot_cy, 'BOT', bot_cell_label, bot_text_mat),
        ]:
            box(f'{name}_{cn}bg', acx, cell_cy, AZ_FRONT+0.25,
                CW, ch, 0.5, m=M['cell_dark'], bev=0.05)
            txt(f'{name}_{cn}Lbl', label, cell_text_mm,
                acx, cell_cy, CELL_FRONT + 0.15, txt_mat, ext=0.15)


# ---------------------------------------------------------------- LAYOUT

BTN_PX_22 = 88            # 22 mm — standard pb-sw cap size
PB_Y_PX   = 200           # single row of 6 pbs, vertical center (pixel Y)
# Per FCOM DSC-29-20 P 1/8: 6 pbs in a single row, L → R order:
#   (1) ENG 1 PUMP  (5) RAT MAN ON  (2) BLUE ELEC PUMP  (4) PTU  (1) ENG 2 PUMP  (3) YELLOW ELEC PUMP
COL_PX    = [94, 217, 340, 463, 586, 709]  # 123 px center-to-center (35 px gap)
# Per-column vertical offset (pixel Y). After rechecking FCOM DSC-29-20 P 1/8:
# all 6 pbs are at the SAME Y level. The "PTU appears slightly up" effect
# from the photos is the function-label box sitting closer to the zone
# label (less vertical gap), NOT the pb itself being higher.
# v8 incorrectly offset PTU pb by -10; reverted in v9.
COL_Y_OFFSET_PX = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

# Label offset above/below pb (same formula as the AGENT label in fire panel,
# with the +20% cumulative shift already applied)
LBL_OFFSET_MM = (BTN_PX_22*PX/2 + 3*PX) * 1.32   # ≈ 15.5 mm

# Cap labels match real A320 engraving (Airbus convention):
#  - All standard pumps have OFF top / FAULT bottom; OFF lights when crew
#    selects OFF (i.e. NOT in AUTO/ON). AUTO is the default no-light state.
#  - YELLOW ELEC PUMP is the special springloaded-ON variant: top cell
#    legend is ON (lights when manually ON), bottom FAULT.
#
# Demo lit-state (showing FCOM behavior visibly):
#   • ENG 1 PUMP: OFF lit white  — crew has deselected GREEN pump
#   • PTU:        FAULT lit amber — PTU fault active
#   • YELLOW EL:  ON lit white   — manually ON (cargo door op)
#   • All other cells stay in dim rest state (normal operations)
#
# To return any cell to rest, pass top_lit_mat=None / bot_lit_mat=None.
# Per Airbus convention all overhead-panel face labels are WHITE painted
# text. The system color (green / blue / yellow hydraulic) only colors the
# ECAM SD synoptic display, NOT the physical panel labels. So the sys_label
# text uses `wtext` (white), same material as the function label below.
# Cell order PER FCOM ILLUSTRATION: FAULT on TOP, OFF/ON on BOTTOM.
# (Earlier draft had this inverted; corrected after reading DSC-29-20 P 1/8.)
#
# Demo lit-state set — proves the lit-material plumbing works visually:
#   ENG 1 PUMP: OFF lit white   (crew has deselected the GREEN pump)
#   PTU:        FAULT lit amber (PTU fault active)
#   YELLOW EL:  ON  lit white   (manually pressed ON for cargo-door op)
PUMPS = [
    # (col, name,       top_cell, bot_cell, top_lit_key, bot_lit_key,  function_label)
    (0, 'ENG1',         'FAULT',  'OFF',    None,        'lit_white',  'ENG 1 PUMP'),
    (1, 'RAT',          '',       '',       None,        None,         'RAT MAN ON'),   # single-cell
    (2, 'BLUEELEC',     'FAULT',  'OFF',    None,        None,         'ELEC PUMP'),
    (3, 'PTU',          'FAULT',  'OFF',    'lit_amber', None,         'PTU'),
    (4, 'ENG2',         'FAULT',  'OFF',    None,        None,         'ENG 2 PUMP'),
    (5, 'YELLOWELEC',   'FAULT',  'ON',     None,        'lit_white',  'ELEC PUMP'),
]

for col, name, top_lbl, bot_lbl, top_lit_key, bot_lit_key, fn_lbl in PUMPS:
    ax_px = COL_PX[col]
    pb_y_px = PB_Y_PX + COL_Y_OFFSET_PX.get(col, 0)   # PTU sits 10 px higher
    acx, acy = p(ax_px, pb_y_px)

    if name == 'RAT':
        # T-GUARDED-RAT: pb-sw underneath + opaque red guard cover on top.
        # Photo-confirmed: the RAT MAN ON has a solid red flip-up guard,
        # NOT a transparent acrylic cover like the FIRE pb guard.
        build_pbsw_agent_style(f'HYD_{name}', ax_px, pb_y_px, BTN_PX_22,
                               top_cell_label='MAN ON', one_cell=True,
                               top_lit_mat=None)
        # Red opaque guard sitting on top of the cap — slightly larger than
        # the cap, hinged at the top edge. In rest state, guard is CLOSED
        # so the cap underneath is hidden.
        GUARD_W = BTN_PX_22*PX + 2.0       # ~24 mm wide (2 mm overhang)
        GUARD_H = BTN_PX_22*PX + 2.0       # ~24 mm tall
        GUARD_D = 3.5                      # 3.5 mm thick guard
        GUARD_Z = PANEL_FRONT + 0.5 + GUARD_D/2   # sits above panel front
        box(f'HYD_{name}_RedGuard', acx, acy, GUARD_Z,
            GUARD_W, GUARD_H, GUARD_D, m=M['rat_red'], bev=0.4)
        # Small dark hinge bar at top edge of the guard
        hinge_cx, hinge_cy = p(ax_px, pb_y_px - BTN_PX_22/2 - 4)
        box(f'HYD_{name}_GuardHinge', hinge_cx, hinge_cy,
            GUARD_Z + GUARD_D/2 + 0.5,
            GUARD_W*0.55, 1.5, 1.0, m=M['pb_black'], bev=0.1)
    else:
        build_pbsw_agent_style(f'HYD_{name}', ax_px, pb_y_px, BTN_PX_22,
                               top_cell_label=top_lbl, bot_cell_label=bot_lbl,
                               top_lit_mat=(M[top_lit_key] if top_lit_key else None),
                               bot_lit_mat=(M[bot_lit_key] if bot_lit_key else None))

    # Function name in a white-outlined LABEL BOX ABOVE each pb (Layer 2+3).
    # Per photos: zone labels at top → green flow art → function label
    # boxes → pb caps below. Box width scales with label length and
    # follows the pb's per-column Y offset (PTU sits higher with its pb).
    fn_w_px = max(60, len(fn_lbl) * 7 + 18)
    fn_cy_px = pb_y_px - (LBL_OFFSET_MM / PX)   # ABOVE pb, per pb_y_px offset
    label_box(f'HYD_{name}_FnLbl', ax_px, fn_cy_px,
              w_px=fn_w_px, h_px=14,
              text=fn_lbl, text_size_mm=2.75)


# Zone labels ABOVE the pbs — per FCOM, brackets/spans group the pbs into
# system zones. Labels are large (5 mm) so they read across the cockpit.
#   GREEN  → spans ENG 1 PUMP (col 0)
#   BLUE   → spans BLUE ELEC PUMP (col 2)
#   PTU    → spans PTU (col 3)
#   YELLOW → spans ENG 2 PUMP + YELLOW ELEC PUMP (cols 4+5)
ZONE_Y_PX = 75

def zone_label(name, text, span_cols):
    """Layer 2 + 3: zone label inside a white-outlined box, positioned
    above the pb column(s) it covers. Box width scales with text length
    so GREEN (5 chars) and YELLOW (6 chars) don't overflow the same
    box that fits PTU (3 chars)."""
    x_avg = sum(COL_PX[c] for c in span_cols) / len(span_cols)
    # ~6 px per character + 14 px side padding (text size 4.5 mm = 18 px tall)
    w_px = max(28, len(text) * 6 + 14)
    label_box(f'HYD_zone_{name}', x_avg, ZONE_Y_PX,
              w_px=w_px, h_px=20,
              text=text, text_size_mm=4.5)

zone_label('GREEN',  'GREEN',  [0])
zone_label('BLUE',   'BLUE',   [2])
zone_label('PTU',    'PTU',    [3])
zone_label('YELLOW', 'YELLOW', [4, 5])


# Green bracket / line art on the panel face (Airbus convention — visible
# in the user-supplied photos). Each bracket arrows down from its zone
# label to the pb(s) it covers. Thin painted green lines, very low Z so
# they sit just above the panel front like silk-screen graphics.
LINE_W_PX     = 2.5       # ≈ 0.6 mm line thickness (thicker than v6 for visibility)
LINE_DEPTH_MM = 0.05
LINE_TOP_Y_PX = ZONE_Y_PX + 14         # horizontal connector row, just below zone labels
# Drop endpoint = TOP of the function-label box (not pb cap). The function
# label is at PB_Y_PX - LBL_OFFSET_MM/PX with half-height 7 px.
FN_TOP_Y_PX   = (PB_Y_PX - LBL_OFFSET_MM / PX) - 7

def line(name, x1_px, y1_px, x2_px, y2_px):
    """Thin painted line on panel face between two pixel-space points."""
    cx_px = (x1_px + x2_px) / 2
    cy_px = (y1_px + y2_px) / 2
    w_px  = max(abs(x2_px - x1_px), LINE_W_PX)
    h_px  = max(abs(y2_px - y1_px), LINE_W_PX)
    cx, cy = p(cx_px, cy_px)
    box(name, cx, cy, BASE_Z + 0.02,
        w_px*PX, h_px*PX, LINE_DEPTH_MM,
        m=M['bracket_green'], bev=0)

def arrow_tip(name, tip_x_px, tip_y_px, direction='down', size_px=5.0):
    """Layer-1 triangular arrowhead, tip at (tip_x_px, tip_y_px), pointing
    in direction. MANDATORY on every drop and inter-zone connector per
    the 5-layer architecture — flow lines without arrows don't match
    real Airbus."""
    if direction == 'down':
        offsets = [(0, 0), (-size_px*0.8, -size_px*1.3), ( size_px*0.8, -size_px*1.3)]
    elif direction == 'up':
        offsets = [(0, 0), (-size_px*0.8,  size_px*1.3), ( size_px*0.8,  size_px*1.3)]
    elif direction == 'right':
        offsets = [(0, 0), (-size_px*1.3, -size_px*0.8), (-size_px*1.3,  size_px*0.8)]
    elif direction == 'left':
        offsets = [(0, 0), ( size_px*1.3, -size_px*0.8), ( size_px*1.3,  size_px*0.8)]
    else:
        raise ValueError(f"arrow_tip: unknown direction {direction!r}")
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

def col_fn_top_y_px(col):
    """Per-column function-label box top Y (accounts for PTU's -10 offset
    so the bracket drop lands on the right place when PTU sits higher)."""
    pb_y = PB_Y_PX + COL_Y_OFFSET_PX.get(col, 0)
    return (pb_y - LBL_OFFSET_MM / PX) - 7

# Layer 1 — green flow schematic per FCOM DSC-29-20 P 1/8:
# ONE continuous horizontal "river" at LINE_TOP_Y_PX (well below zone-
# label boxes so they don't overlap). Drops UP from the river to each
# zone label baseline, drops DOWN from the river to each function-label
# box top. Arrows on the river show pressure flow direction between
# systems.
ZONE_LABEL_COLS = {'GREEN': 0, 'BLUE': 2, 'PTU': 3, 'YELLOW': (4, 5)}

def _zone_label_x(col_or_pair):
    if isinstance(col_or_pair, tuple):
        return sum(COL_PX[c] for c in col_or_pair) / len(col_or_pair)
    return COL_PX[col_or_pair]

# 1. The single horizontal river — from leftmost zone label to rightmost,
#    sitting at LINE_TOP_Y_PX which is well below all zone label boxes.
river_xs = sorted(_zone_label_x(c) for c in ZONE_LABEL_COLS.values())
river_x_left  = river_xs[0]
river_x_right = river_xs[-1]
line('br_river', river_x_left, LINE_TOP_Y_PX, river_x_right, LINE_TOP_Y_PX)

# 2. Drops UP from the river to each zone label.
for label_name, col_or_pair in ZONE_LABEL_COLS.items():
    label_x = _zone_label_x(col_or_pair)
    line(f'br_zoneUp_{label_name}', label_x, ZONE_Y_PX + 10, label_x, LINE_TOP_Y_PX)

# 3. Drops DOWN from the river to each function-label box.
#    Each drop ends with an ARROW pointing down at the function label.
for col in range(6):
    px = COL_PX[col]
    fn_top_y = col_fn_top_y_px(col)
    line(f'br_fnDrop_v{col}', px, LINE_TOP_Y_PX, px, fn_top_y - 2)
    arrow_tip(f'br_fnDrop_v{col}_arrow', px, fn_top_y - 1, direction='down')

# 4. Flow-direction arrows on the river itself. Per FCOM:
#    - GREEN system feeds rightward toward PTU  →
#    - YELLOW system feeds leftward toward PTU  ←
#    - PTU mediates bidirectional GREEN↔YELLOW transfer
PTU_X = _zone_label_x(ZONE_LABEL_COLS['PTU'])
arrow_tip('br_river_arr_GtoP', PTU_X - 50, LINE_TOP_Y_PX, direction='right')
arrow_tip('br_river_arr_YtoP', PTU_X + 50, LINE_TOP_Y_PX, direction='left')

# 5. Side-arrows on zone label boxes per FCOM (small arrows on the
#    sides of each zone label box showing system flow direction).
def zone_side_arrow(name, col_or_pair, side, direction):
    """Small arrow tip just outside the side of a zone label box."""
    x_center = _zone_label_x(col_or_pair)
    # Zone label boxes have w_px from len(text)*6+14 ≈ 38-50 px wide. Use
    # 30 px offset from box center to place arrow just outside the border.
    if side == 'right':
        x_tip = x_center + 30
    elif side == 'left':
        x_tip = x_center - 30
    else:
        raise ValueError(side)
    arrow_tip(name, x_tip, ZONE_Y_PX, direction=direction)

zone_side_arrow('br_GREEN_R',  0,           'right', 'right')   # → out of GREEN
zone_side_arrow('br_PTU_L',    3,           'left',  'left')    # ← into PTU
zone_side_arrow('br_PTU_R',    3,           'right', 'right')   # → out of PTU
zone_side_arrow('br_YELLOW_L', (4, 5),      'left',  'left')    # ← into YELLOW


# PTU vertical AUTO indicator — column of A/U/T/O letters stacked beside
# the PTU pb (photo-confirmed; also visible in FCOM illustration). Small
# white letters indicating the pb is in AUTO position.
PTU_AUTO_X_PX = COL_PX[3] + BTN_PX_22/2 + 8       # just right of PTU cap
PTU_PB_Y_PX   = PB_Y_PX + COL_Y_OFFSET_PX.get(3, 0)  # follows PTU's offset
for i, ch in enumerate('AUTO'):
    ax_px = PTU_AUTO_X_PX
    ay_px = PTU_PB_Y_PX - 18 + i*12   # vertical stack, ~3 mm spacing, follows PTU
    acx, acy = p(ax_px, ay_px)
    txt(f'HYD_PTU_AUTO_{ch}', ch, 2.5,
        acx, acy, PANEL_FRONT + 0.01, M['wtext'], ext=0.01)


# ---------------------------------------------------------------- SCENE
bpy.ops.object.camera_add(location=(0, mm(-150), mm(110)),
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

area_light((0,        mm(-120), mm(150)), 5.0, 200, (math.radians(40),0,0))
area_light((mm(-120), mm(-80),  mm(70)),  2.5, 150, (math.radians(50),math.radians(-30),0))
area_light((mm( 120), mm(-80),  mm(70)),  2.5, 150, (math.radians(50),math.radians( 30),0))

bpy.context.scene.world.use_nodes = True
bg = bpy.context.scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value    = (0.15, 0.18, 0.20, 1.0)
bg.inputs['Strength'].default_value = 0.4

sc = bpy.context.scene
sc.render.engine                = 'CYCLES'
sc.cycles.samples               = 256       # was 128 — sharper text edges
sc.render.resolution_x          = 2000
sc.render.resolution_y          = 900
sc.render.resolution_percentage = 100
sc.render.filepath              = os.path.join(_HERE, 'hyd_panel.png')
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

bpy.ops.render.render(write_still=True)
print("DONE: hyd_panel.png")
