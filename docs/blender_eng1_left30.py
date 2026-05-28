# ─────────────────────────────────────────────────────────────────────────────
# A320 ENG 1 FIRE Panel — Blender Python (v15)
# Scripting > Text Editor > Run Script
#
# Source: src/components/cockpit/engine-fire-panel-mockup.tsx
# Mockup: http://localhost:3002/mockups/fire-panel  (ENG 1 section only)
#
# ALL measurements taken DIRECTLY from the component source code:
#
#   Panel (ENG 1 section):  440 × 420 px
#   Panel background:       linear-gradient #75B5C5 → #5A98A8
#   Corner screws:          [12,12] and [12,396],  r = 6 px (12 × 12)
#
#   FIRE pushbutton:        width=131  height=97  borderRadius=10
#     position:             left-1/2 top-1/2 translate(-50%, -61%)
#                           → left = 220−65.5 = 154 px
#                           → top  = 210−59   = 151 px
#     rest colour:          gradient #A85A55 → #7A3835  ≈ #914A43
#     fire colour:          gradient #FF2828 → #C80000  ≈ #E81010
#     border (rest):        4px solid #5A2A28
#     border (fire):        4px solid #FF6060
#
#   Guard (GuardCover SVG): width=135  height=122
#     placed at:            top=−2  left=−5  relative to FIRE pb
#                           → section: left=149  top=149
#     fill colour:          rgba(174,56,22,0.92) ≈ #AE3816
#     outer path main rect: x=0.5 → 134.5,  y=0.5 → 98.5  (134 × 98 px)
#     inner window (pane):  x=12,y=17  w=110,h=76   (visible through guard)
#     handle tab:           x=41.5 → 95.5,  y=98.5 → 121.5 (54 × 23 px)
#
#   Guard JOINT (hinge bar):
#     outer rect:   x=40.5,y=0.5  w=54,h=16  fill=#1D1818
#     inner rect:   80% of outer, centred     fill=#A8A7A6
#     absolute in section:
#       outer: left=189.5,top=149.5  w=54,h=16
#       inner: left=194.9,top=151.1  w=43.2,h=12.8
#
#   FIRE bar (vertical strip):  left=44,top=145  w=4,h=80  colour=#FFFFFF
#
#   AGENT 1:  left=84,  top=112  w=56,h=56   (RING_EXT=8 each side)
#   AGENT 2:  right=84, top=112  w=56,h=56   → left = 440−84−56 = 300
#     button: background=#1E2430  border=1.5px #3A4252
#     outline: 2px #FFFFFF  outlineOffset=3px
#     ring:   boxShadow 0 0 0 3px #6E9292
#     SQUIB cell (top half):  colour white #E8ECF4 when armed
#     DISCH cell (bot half):  colour amber #FFB300 when fired
#     cell padding: 3px  gap: 2px
#
#   TEST button:  left=93  bottom=171 → top=420−171−26=223   w=26,h=26 circle
#     centre: cx=106,cy=236  radius=13   background=#000000
#     white dot:  r=3 centred
#
# Scale:  PX = 0.25 mm / CSS pixel    (1 Blender unit = 1 mm)
# Coords: Panel face in X-Z at Y=0,  viewer at +Y
#         Panel X → Blender X,  Panel Y → Blender −Z
# ─────────────────────────────────────────────────────────────────────────────

import bpy, math

# ── 0. Clear ──────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in (bpy.data.meshes, bpy.data.materials,
          bpy.data.cameras, bpy.data.lights):
    for b in list(d): d.remove(b)

PX = 0.25   # mm per CSS pixel

# ── 1. Materials ──────────────────────────────────────────────────────────────

def mk(name, h, metallic=0.0, rough=0.55, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd, lk = m.node_tree.nodes, m.node_tree.links
    nd.clear()
    b = nd.new('ShaderNodeBsdfPrincipled')
    rv, gv, bv = [int(h[i:i+2], 16)/255 for i in (1, 3, 5)]
    b.inputs['Base Color'].default_value = (rv, gv, bv, 1.0)
    b.inputs['Metallic'].default_value   = metallic
    b.inputs['Roughness'].default_value  = rough
    if emit > 0:
        try:
            b.inputs['Emission Color'].default_value    = (rv, gv, bv, 1.0)
            b.inputs['Emission Strength'].default_value = emit
        except KeyError:
            b.inputs['Emission'].default_value = (rv*emit, gv*emit, bv*emit, 1.0)
    out = nd.new('ShaderNodeOutputMaterial')
    lk.new(b.outputs[0], out.inputs[0])
    return m

# Exact colours from engine-fire-panel-mockup.tsx
M_panel     = mk('M_Panel',    '#6AAAB9', metallic=0.10, rough=0.45)   # avg of #75B5C5 + #5A98A8
M_screw     = mk('M_Screw',    '#8A939E', metallic=0.80, rough=0.30)   # avg of radial-gradient
M_fire_bar  = mk('M_FireBar',  '#FFFFFF', metallic=0.00, rough=0.20)   # white
M_fire_rest = mk('M_FireRest', '#914A43', metallic=0.05, rough=0.40)   # avg #A85A55→#7A3835 (rest)
M_fire_lit  = mk('M_FireLit',  '#E81010', metallic=0.00, rough=0.20, emit=2.0)  # active FIRE
M_guard     = mk('M_Guard',    '#AE3816', metallic=0.12, rough=0.45)   # rgba(174,56,22) fill
M_guard_win = mk('M_GuardWin', '#1A0505', metallic=0.00, rough=0.30)   # dark inner pane
M_joint_out = mk('M_JointOut', '#1D1818', metallic=0.30, rough=0.55)   # JOINT outer (#1D1818)
M_joint_in  = mk('M_JointIn',  '#A8A7A6', metallic=0.50, rough=0.35)   # JOINT inner (#A8A7A6)
M_agent_bg  = mk('M_AgentBg',  '#1E2430', metallic=0.05, rough=0.70)   # agent body
M_agent_rng = mk('M_AgentRng', '#6E9292', metallic=0.15, rough=0.50)   # ring #6E9292
M_agent_out = mk('M_AgentOut', '#FFFFFF', metallic=0.00, rough=0.30)   # white outline
M_squib     = mk('M_Squib',    '#E8ECF4', metallic=0.00, rough=0.20, emit=0.8)  # SQUIB white
M_disch     = mk('M_Disch',    '#FFB300', metallic=0.00, rough=0.20, emit=0.8)  # DISCH amber
M_cell_off  = mk('M_CellOff',  '#06080C', metallic=0.00, rough=0.80)   # cell unlit
M_test_btn  = mk('M_TestBtn',  '#000000', metallic=0.00, rough=0.80)   # TEST circle
M_test_dot  = mk('M_TestDot',  '#FFFFFF', metallic=0.00, rough=0.20)   # white centre dot

# ── 2. Helpers ────────────────────────────────────────────────────────────────

def asgn(o, m):
    if o.data.materials: o.data.materials[0] = m
    else:                 o.data.materials.append(m)

def box(name, px, py, pw, ph, depth, y0=0.0, mat=None):
    """Rectangular slab.  px/py/pw/ph in CSS px.  depth/y0 in mm.
    CSS Y increases downward; we map it to +Blender-Z so the camera
    (up=-Z, rotation=-π/2 around X) displays top-of-panel at top of render."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name  = name
    o.scale = (pw*PX, depth, ph*PX)
    o.location = ((px + pw/2)*PX,  y0 + depth/2,  (py + ph/2)*PX)
    bpy.ops.object.transform_apply(scale=True)
    if mat: asgn(o, mat)
    return o

def cyl(name, cx, cy, r_px, depth, y0=0.0, mat=None, verts=32):
    """Vertical cylinder (screws, TEST btn).  cx/cy/r in CSS px.  depth/y0 mm."""
    r_mm = r_px * PX
    bpy.ops.mesh.primitive_cylinder_add(
        radius=r_mm, depth=depth, vertices=verts,
        location=(cx*PX, y0 + depth/2, cy*PX))
    o = bpy.context.active_object
    o.name = name
    if mat: asgn(o, mat)
    return o

# ── 3. ENG 1 section — 440 × 420 px ─────────────────────────────────────────
PW, PH = 440, 420   # px  →  110 × 105 mm
PD     = 5.0        # mm backplate thickness

box('Panel_Base', 0, 0, PW, PH, PD, y0=-PD, mat=M_panel)

# ── 3.1 Corner screws (left side of ENG 1 section) ───────────────────────────
# CSS: [12,12] and [12,396],  size 12×12 (r=6)
cyl('Screw_TL', cx=12, cy=12,  r_px=6, depth=1.5, y0=0.0, mat=M_screw)
cyl('Screw_BL', cx=12, cy=396, r_px=6, depth=1.5, y0=0.0, mat=M_screw)

# ── 3.2 Vertical FIRE bar ─────────────────────────────────────────────────────
# CSS: left=44,top=145,width=4,height=80  colour=#FFFFFF
box('Fire_Bar', px=44, py=145, pw=4, ph=80, depth=1.5, y0=0.0, mat=M_fire_bar)

# ── 3.3 FIRE Pushbutton — 131 × 97 px ────────────────────────────────────────
# CSS: width:131  height:97  borderRadius:10
# Position in ENG1 section:
#   left-1/2 top-1/2 translate(-50%,-61%)
#   left = 220 − 65.5 = 154 px
#   top  = 210 − 59   = 151 px
FL, FT = 154, 151
FW, FH = 131, 97

# Pushbutton body (rest = dark red)
box('Fire_PB', FL, FT, FW, FH, depth=4.5, y0=0.0, mat=M_fire_rest)

# "FIRE" legend (top portion, lit red when fire warning — we model the LIT state)
# In the component: top=22, fontSize=22. Represent as an emissive strip.
box('Fire_Legend', FL+10, FT+15, FW-20, 28, depth=0.4, y0=4.5, mat=M_fire_lit)

# ── 3.4 Guard (GuardCover) ────────────────────────────────────────────────────
# SVG: width=135 height=122, placed at top=−2 left=−5 rel. to FIRE pb
# → section: left=149, top=149
GL, GT = FL - 5, FT - 2   # 149, 149

# Main guard rectangle (SVG path main rect: x=0.5..134.5, y=0.5..98.5)
# Outer shell: 135 × 98 px
# We model as 4 walls surrounding the window, plus a solid outer border
GUARD_W_SVG = 135
GUARD_H_MAIN = 98   # main rect height before handle tab

# Left wall: SVG x=0..12 (border width 12px)
box('Guard_WallL',  GL,          GT,    12,   GUARD_H_MAIN, depth=6.0, y0=0.0, mat=M_guard)
# Right wall: SVG x=122..135
box('Guard_WallR',  GL+123,      GT,    12,   GUARD_H_MAIN, depth=6.0, y0=0.0, mat=M_guard)
# Top wall: SVG y=0..17 (above window)
box('Guard_WallT',  GL+12,       GT,    110,  17,           depth=6.0, y0=0.0, mat=M_guard)
# Bottom wall: SVG y=93..98 (below window, above tab)
box('Guard_WallB',  GL+12,       GT+93, 110,  5,            depth=6.0, y0=0.0, mat=M_guard)

# Inner acrylic pane window: SVG x=12,y=17,w=110,h=76
# Dark panel shows through — we put a slightly raised dark surface here
box('Guard_Window', GL+12, GT+17, 110, 76, depth=0.8, y0=0.0, mat=M_guard_win)

# Handle tab: x=41.5..95.5, y=98.5..121.5 (54 × 23 px)
box('Guard_Tab', GL+42, GT+98, 54, 23, depth=6.0, y0=0.0, mat=M_guard)

# Oval gap in tab (cutout shown as dark recessed oval) — approximate with cyl
# SVG: cx=67.5, cy=110, rx=7, ry=3.5  (section: cx=GL+67.5=216.5, cy=GT+110=259)
cyl('Guard_OvalGap', cx=GL+67.5, cy=GT+110, r_px=7, depth=2.0, y0=4.5, mat=M_guard_win, verts=24)

# ── 3.5 Guard JOINT (hinge bar) ───────────────────────────────────────────────
# Outer: SVG x=40.5,y=0.5,w=54,h=16  fill=#1D1818
# → section: left=GL+40.5=189.5, top=GT+0.5=149.5
box('Joint_Outer', GL+40.5, GT+0.5, 54, 16, depth=3.5, y0=6.0, mat=M_joint_out)
# Inner: 80% of outer, centred. SVG inner: x=45.9,y=2.1,w=43.2,h=12.8  fill=#A8A7A6
box('Joint_Inner', GL+45.9, GT+2.1, 43.2, 12.8, depth=2.5, y0=9.5, mat=M_joint_in)

# ── 3.6 AGENT pushbuttons (×2) ────────────────────────────────────────────────
# CSS: width=56,height=56  top=112  left=84 (AGENT1) / right=84→left=300 (AGENT2)
# Ring layers:
#   RING_EXT = OUTLINE_OFF(3) + OUTLINE_W(2) + RING_FILL(3) = 8 px each side
#   CyanRing: button−8 px each side  →  72×72  colour=#6E9292
#   WhiteRing: button−5 px each side →  66×66  colour=#FFFFFF
#   Body: 56×56  colour=#1E2430  depth=3mm

RING_EXT = 8   # px
OUTLINE   = 5  # px (outlineOffset 3 + outlineWidth 2)
AG_W, AG_H = 56, 56
AG_BODY_D  = 3.0
AG_CELL_Y  = 1.5 + AG_BODY_D   # cell front face
AG_PAD     = 3
AG_GAP     = 2
CELL_W = AG_W - AG_PAD*2              # 50 px
CELL_H = (AG_H - AG_PAD*2 - AG_GAP) / 2  # ~24 px

def agent(pfx, al, at):
    """One AGENT button at section coords (al, at)."""
    # Cyan ring (fills gap + beyond outline)
    box(f'{pfx}_CyanRing',
        al-RING_EXT, at-RING_EXT,
        AG_W+RING_EXT*2, AG_H+RING_EXT*2,
        depth=1.0, y0=0.0, mat=M_agent_rng)
    # White outline ring
    box(f'{pfx}_WhiteRing',
        al-OUTLINE, at-OUTLINE,
        AG_W+OUTLINE*2, AG_H+OUTLINE*2,
        depth=0.5, y0=1.0, mat=M_agent_out)
    # Button body
    box(f'{pfx}_Body',
        al, at, AG_W, AG_H,
        depth=AG_BODY_D, y0=1.5, mat=M_agent_bg)
    # SQUIB cell (top) — white when armed per FCOM DSC-26-20-20
    box(f'{pfx}_SQUIB',
        al+AG_PAD, at+AG_PAD,
        CELL_W, CELL_H,
        depth=0.5, y0=AG_CELL_Y, mat=M_squib)
    # DISCH cell (bottom) — amber when bottle fired
    box(f'{pfx}_DISCH',
        al+AG_PAD, at+AG_PAD+CELL_H+AG_GAP,
        CELL_W, CELL_H,
        depth=0.5, y0=AG_CELL_Y, mat=M_disch)

agent('Agent1', al=84,  at=112)   # left=84
agent('Agent2', al=300, at=112)   # right=84 → left=440−84−56=300

# ── 3.7 TEST pushbutton (circular) ───────────────────────────────────────────
# CSS: bottom=171 → top=420−171−26=223   left=93   width=26,height=26 (circle)
# centre: cx=93+13=106,  cy=223+13=236   radius=13
cyl('TEST_Btn', cx=106, cy=236, r_px=13, depth=2.5, y0=0.0, mat=M_test_btn)
# White centre dot: r=3
cyl('TEST_Dot', cx=106, cy=236, r_px=3,  depth=0.5, y0=2.5, mat=M_test_dot)

# ── 4. Camera — front orthographic ───────────────────────────────────────────
CX = PW * PX / 2    # 55.0 mm  (panel center in X)
CZ = PH * PX / 2    # +52.5 mm (panel center in Z with positive CSS-Y mapping)
CY = 140.0

bpy.ops.object.camera_add(
    location=(CX, CY, CZ),
    rotation=(-math.pi/2, 0.0, 0.0))
cam = bpy.context.active_object
cam.name = 'Cam_Front'
cam.data.type = 'ORTHO'
cam.data.ortho_scale = max(PW, PH) * PX * 1.15
bpy.context.scene.camera = cam

# Set render engine
scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except:
    scene.render.engine = 'BLENDER_EEVEE'

# ── 5. Lighting ───────────────────────────────────────────────────────────────
# World ambient — fills shadow areas with a dim teal-grey tint
world = bpy.context.scene.world
world.use_nodes = True
wnd = world.node_tree.nodes
wbg = wnd.get('Background') or wnd.new('ShaderNodeBackground')
wbg.inputs[0].default_value = (0.04, 0.06, 0.08, 1.0)   # dark blue-grey
wbg.inputs[1].default_value = 0.4                          # strength

# Key light — large front area, slightly above camera plane
bpy.ops.object.light_add(type='AREA',
    location=(CX-30, 120, CZ+25),
    rotation=(-math.pi/2 + math.radians(15), 0, math.radians(-18)))
k = bpy.context.active_object
k.name = 'Light_Key'; k.data.energy = 3000; k.data.size = 120

# Fill light — softer, from right
bpy.ops.object.light_add(type='AREA',
    location=(CX+50, 100, CZ-15),
    rotation=(-math.pi/2 + math.radians(8), 0, math.radians(30)))
f = bpy.context.active_object
f.name = 'Light_Fill'; f.data.energy = 1200; f.data.size = 100

# Top-down rim
bpy.ops.object.light_add(type='AREA',
    location=(CX, 60, CZ+60),
    rotation=(-math.pi/2 + math.radians(60), 0, 0))
r = bpy.context.active_object
r.name = 'Light_Rim'; r.data.energy = 600; r.data.size = 80

# ── Done ──────────────────────────────────────────────────────────────────────
print("=" * 64)
print("  A320 ENG 1 FIRE panel  —  v15")
print("  Source: engine-fire-panel-mockup.tsx")
print("=" * 64)
print(f"  Panel      {PW}×{PH} px = {PW*PX:.0f}×{PH*PX:.0f} mm")
print(f"  FIRE pb    {FW}×{FH} px = {FW*PX:.1f}×{FH*PX:.1f} mm  at ({FL},{FT})")
print(f"  Guard      135×98 px  at ({GL},{GT})  tab 54×23")
print(f"  JOINT      54×16 px outer  43×13 inner  at ({GL+40},{GT})")
print(f"  AGENT ×2   {AG_W}×{AG_H} px = {AG_W*PX:.1f}×{AG_H*PX:.1f} mm  ring ext {RING_EXT}px")
print(f"  TEST       r=13px = {13*PX:.2f}mm  at cx=106,cy=236")
print(f"  PX = {PX} mm/px")
print("=" * 64)
