# ─────────────────────────────────────────────────────────────────────────────
# A320 ENG 1 FIRE Panel — Blender Python (v14 corrected)
# Scripting > Text Editor > Run Script
#
# Reference layout: DslControlPanel (fire-panel.tsx line 1017)
#   display: flex
#   gap: 12px
#   justifyContent: center
#   alignItems: flex-end          ← all controls bottom-align
#   padding: 6px 10px 8px
#
# Control order (from eng1-fire-after-v1.ts controlPanel array):
#   MASTER (52×68)  →  FIRE PB (96×72, large)  →  AGENT 1 (68×65)  →  AGENT 2 (68×65)
#   THR LEVER excluded per user instruction.
#
# Heights of each outer div (determines bottom-alignment Y offset):
#   MASTER  : label(14) + gap(4) + body(68) + gap(4) + strip(18) + gap(4) + text(12) = 124 px
#   FIRE pb : bezel-border/pad(4) + LED(34) + face(34) + bezel-border/pad(4) = 76 px
#   AGENT   : bezel-border/pad(4) + LED(24) + face(26) + bezel-border/pad(4) = 58 px
#
# Bottom-alignment from panel top margin 24 px:
#   ROW_BOT = 24 + 124 = 148 px (MASTER is tallest)
#   FIRE top = 148 − 76  =  72 px
#   AGENT top = 148 − 58  =  90 px
#
# X-positions (justify-center in 380 px panel, 10 px side padding → 360 px inner):
#   total items = 52 + 96 + 68 + 68 = 284 px
#   gaps = 3 × 12 = 36 px
#   side margin = (360 − 320) / 2 = 20 px
#   MASTER left = 10 + 20 = 30 px
#   FIRE   left = 30 + 52 + 12 = 94 px
#   AGENT1 left = 94 + 96 + 12 = 202 px
#   AGENT2 left = 202 + 68 + 12 = 282 px
#
# Scale: PX = 0.25 mm / CSS pixel
# Coordinate: Panel face in X-Z at Y=0 (+Y toward viewer)
# ─────────────────────────────────────────────────────────────────────────────

import bpy, math

# ── 0. Clear ──────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in (bpy.data.meshes, bpy.data.materials,
          bpy.data.cameras, bpy.data.lights):
    for b in list(d): d.remove(b)

PX = 0.25   # mm per CSS pixel

# ── 1. Materials — hex from fire-panel.tsx C constants ───────────────────────

def mk(name, h, metallic=0.0, rough=0.55, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd, lk = m.node_tree.nodes, m.node_tree.links
    nd.clear()
    b = nd.new('ShaderNodeBsdfPrincipled')
    rv, gv, bv = [int(h[i:i+2],16)/255 for i in (1,3,5)]
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

# C.panel='#080C12' C.bezel='#1E2430' C.btnFace='#0E1118' C.ledOff='#060A0E'
# C.red='#FF3333'   C.white='#E8ECF4' C.amber='#FFB300'   C.green='#00D060'
# C.dim='#6A7488'   C.dimLo='#3A4252'

M_panel  = mk('M_Panel',  '#080C12', metallic=0.08, rough=0.65)
M_bezel  = mk('M_Bezel',  '#1E2430', metallic=0.12, rough=0.55)
M_face   = mk('M_Face',   '#0E1118', metallic=0.05, rough=0.75)
M_off    = mk('M_LedOff', '#060A0E', metallic=0.00, rough=0.80)
M_red    = mk('M_Red',    '#FF3333', metallic=0.00, rough=0.20, emit=1.5)
M_white  = mk('M_White',  '#E8ECF4', metallic=0.00, rough=0.20, emit=0.6)
M_amber  = mk('M_Amber',  '#FFB300', metallic=0.00, rough=0.20, emit=0.6)
M_green  = mk('M_Green',  '#00D060', metallic=0.00, rough=0.25, emit=0.5)
M_dim    = mk('M_Dim',    '#6A7488', metallic=0.15, rough=0.55)
M_dimlo  = mk('M_DimLo',  '#3A4252', metallic=0.08, rough=0.65)
M_guard  = mk('M_Guard',  '#252F3A', metallic=0.40, rough=0.38)
M_hinge  = mk('M_Hinge',  '#5A6272', metallic=0.88, rough=0.18)
M_lever  = mk('M_Lever',  '#2E3A28', metallic=0.08, rough=0.62)

# ── 2. Helpers ────────────────────────────────────────────────────────────────

def asgn(o, m):
    if o.data.materials: o.data.materials[0] = m
    else:                 o.data.materials.append(m)

def box(name, px, py, pw, ph, depth, y0=0.0, mat=None):
    """Slab in CSS-pixel space. px/py = top-left corner. depth/y0 in mm."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name  = name
    o.scale = (pw*PX, depth, ph*PX)
    o.location = ((px+pw/2)*PX, y0+depth/2, -(py+ph/2)*PX)
    bpy.ops.object.transform_apply(scale=True)
    if mat: asgn(o, mat)
    return o

def hrod(name, cx, cy, span, r, y_mm, mat=None):
    """Horizontal cylinder (hinge) along Blender X. All lengths in CSS px or mm as noted."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=r, depth=span*PX, vertices=32,
        location=(cx*PX, y_mm, -cy*PX))
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = (0.0, math.pi/2, 0.0)
    bpy.ops.object.transform_apply(rotation=True)
    if mat: asgn(o, mat)
    return o

# ── 3. Panel backplate ────────────────────────────────────────────────────────
PW, PH = 380, 200   # px  →  95 × 50 mm
PD     = 5.0        # mm thick

box('Panel_Base', 0, 0, PW, PH, PD, y0=-PD, mat=M_panel)

# ── Layout constants (derived from DslControlPanel CSS analysis above) ─────────
BPAD    = 4   # px  bezel border(2) + padding(2) per side — adds 4px each dim
ROW_BOT = 148 # px  row bottom from panel top (MASTER 124 px + 24 px top margin)

# ─────────────────────────────────────────────────────────────────────────────
#  MASTER SWITCH — DslMasterSwCtrl  (52 × 68 px body)
#  CSS: width:52 height:68 — lever knob 28×18 — ON cell green — FIRE strip below
# ─────────────────────────────────────────────────────────────────────────────
MSL  = 30          # left  (from justify-center analysis)
MST  = ROW_BOT - 68 - 8 - 18 - 8 - 14   # top of outer div = 148−116 = 32 px
       # (body 68 + bezel 8 + strip 18 + gap 8 + text 14 = 116 from top of outer)
MSW, MSH = 52, 68
MST = 24           # simplified: top margin 24px, MASTER starts here as tallest element

# Switch bezel shell (3 px extra each side of 52×68 body)
box('Master_Bezel', MSL-3, MST-3, MSW+6, MSH+6, depth=3.0, y0=0.0, mat=M_bezel)

# Switch body background
box('Master_Body',  MSL, MST, MSW, MSH, depth=1.2, y0=3.0, mat=M_face)

# ON indicator cell — green (#00D060), near top of body
box('Master_ON_Cell', MSL+6, MST+4, MSW-12, 10, depth=0.5, y0=4.2, mat=M_green)

# Lever knob — ON position (raised, translateY(-6px) → near top)
LW, LH = 28, 18
box('Master_Lever', MSL+(MSW-LW)//2, MST+10, LW, LH, depth=2.8, y0=4.2, mat=M_lever)

# OFF indicator cell — dim, near bottom of body
box('Master_OFF_Cell', MSL+6, MST+MSH-14, MSW-12, 10, depth=0.5, y0=4.2, mat=M_dimlo)

# FIRE / FAULT indicator strip below switch body  (height 18 px)
# CSS: width:52 height:18 — left half FIRE (red), right half FAULT (dim)
ST = MST + MSH + 6
box('Master_Strip',      MSL,          ST,   MSW,      18, depth=1.5, y0=0.0, mat=M_bezel)
box('Master_FIRE_Cell',  MSL+2,        ST+3, MSW//2-3, 12, depth=0.5, y0=1.5, mat=M_red)
box('Master_FAULT_Cell', MSL+MSW//2+1, ST+3, MSW//2-3, 12, depth=0.5, y0=1.5, mat=M_dimlo)

# ─────────────────────────────────────────────────────────────────────────────
#  FIRE PUSHBUTTON — AirbusPB large (96 × 72 px)
#  Bezel: border 2px + padding 2px each side → BPAD=4 px per side
#  LED window : top 34 px  — red (#FF3333) emissive when FIRE active
#  Button face: bottom 38 px — dark (#0E1118)  label "ENG 1" + "FIRE P/B"
# ─────────────────────────────────────────────────────────────────────────────
FW, FH   = 96, 72
LED_H    = 34
FACE_H   = FH - LED_H     # 38 px
FL       = 94             # from justify-center analysis
FT       = ROW_BOT - FH - BPAD*2   # bottom-align: 148−72−8 = 68 px
FT       = 68

# Bezel
box('Fire_Bezel', FL-BPAD, FT-BPAD, FW+BPAD*2, FH+BPAD*2, depth=3.2, y0=0.0, mat=M_bezel)

# LED window — red, emissive (FIRE active state)
box('Fire_LED',   FL, FT,          FW, LED_H,  depth=0.8, y0=3.2, mat=M_red)

# Button face — dark navy
box('Fire_Face',  FL, FT+LED_H,   FW, FACE_H,  depth=0.8, y0=3.2, mat=M_face)

# ─────────────────────────────────────────────────────────────────────────────
#  FIRE GUARD — protective flip-up frame around FIRE pushbutton
#  Clearance gap from bezel outer: GGAP=6 px
#  Wall thickness: GWALL=5 px
#  Wall height above panel face: GDEP=9 mm
#  Top crossbar: two side pieces with 60 % centre notch (label stays visible)
# ─────────────────────────────────────────────────────────────────────────────
GGAP  = 6
GWALL = 5
GDEP  = 9.0   # mm

GL = FL - BPAD - GGAP - GWALL     #  94−4−6−5 = 79  ← left of guard
GT = FT - BPAD - GGAP - GWALL     #  68−4−6−5 = 53  ← top of guard
GW = FW + (BPAD+GGAP+GWALL)*2     #  96+30   = 126 px
GH = FH + (BPAD+GGAP+GWALL)*2     #  72+30   = 102 px

box('Guard_Left',   GL,             GT,          GWALL,        GH,    GDEP, y0=0, mat=M_guard)
box('Guard_Right',  GL+GW-GWALL,    GT,          GWALL,        GH,    GDEP, y0=0, mat=M_guard)
box('Guard_Bottom', GL+GWALL,       GT+GH-GWALL, GW-GWALL*2,  GWALL, GDEP, y0=0, mat=M_guard)

INNER = GW - GWALL*2          # 116 px
NOTCH = int(INNER * 0.60)     # 69 px  centre notch
SIDE  = (INNER - NOTCH) // 2  # 23 px  each side piece

box('Guard_TopL', GL+GWALL,              GT, SIDE, GWALL, GDEP, y0=0, mat=M_guard)
box('Guard_TopR', GL+GWALL+SIDE+NOTCH,   GT, SIDE, GWALL, GDEP, y0=0, mat=M_guard)

# ─────────────────────────────────────────────────────────────────────────────
#  GUARD HINGE — cylindrical rod spanning full guard width at the top
#  Rests on top face of guard walls: centre Y = GDEP + r (in mm)
# ─────────────────────────────────────────────────────────────────────────────
HR   = 3.5                     # mm radius
HCX  = GL + GW / 2             # centre X in panel px
HCY  = GT + GWALL / 2          # centre Y within top crossbar (px)
HY   = GDEP + HR               # mm above panel face → 12.5 mm

hrod('Guard_Hinge', cx=HCX, cy=HCY, span=GW, r=HR, y_mm=HY, mat=M_hinge)

# ─────────────────────────────────────────────────────────────────────────────
#  AGENT PUSHBUTTONS  ×2 — AgentPb → AirbusPB default (68 × 65 px)
#  Outline ring: CSS box-shadow 0 0 0 3px + outline 2px outlineOffset 3px
#                → 8 px extension each side (visual only, outside flow)
#  LED cells inside button (3 px pad, 2 px gap between cells):
#    SQUIB — top cell  — white  (#E8ECF4) emissive — armed state
#    DISCH — bot cell  — amber  (#FFB300) emissive — bottle fired
# ─────────────────────────────────────────────────────────────────────────────
AW, AH   = 68, 65
RING_EXT = 8    # px  ring visual extension each side
APAD     = 3    # px  inner cell padding
AGAP     = 2    # px  gap between SQUIB and DISCH
CELL_W   = AW - APAD*2                          # 62 px
CELL_H   = (AH - APAD*2 - AGAP) / 2             # 28.5 px
ABOD     = 3.0  # mm  button body depth
ACF      = 1.5 + ABOD                           # cell front-face Y (mm)

AG1L = 202       # from justify-center analysis
AG2L = 282
AGT  = ROW_BOT - AH - BPAD*2   # bottom-align: 148−65−8 = 75 px
AGT  = 75


def agent(pfx, al, at):
    # Outer dim ring — panel dark (#3A4252)
    box(f'{pfx}_DimRing',   al-RING_EXT, at-RING_EXT,
        AW+RING_EXT*2, AH+RING_EXT*2,   depth=1.0, y0=0.0, mat=M_dimlo)
    # White outline ring — 3 px inside dim ring
    OE = RING_EXT - 3   # = 5 px from button edge
    box(f'{pfx}_WhiteRing', al-OE, at-OE,
        AW+OE*2, AH+OE*2,               depth=0.5, y0=1.0, mat=M_dim)
    # Button body — bezel dark (#1E2430)
    box(f'{pfx}_Body',      al, at, AW, AH, depth=ABOD, y0=1.5, mat=M_bezel)
    # SQUIB cell — top, white emissive (FCOM DSC-26-20-20: white when armed)
    box(f'{pfx}_SQUIB',     al+APAD, at+APAD,
        CELL_W, CELL_H,                 depth=0.5, y0=ACF, mat=M_white)
    # DISCH cell — bottom, amber emissive (fired)
    box(f'{pfx}_DISCH',     al+APAD, at+APAD+CELL_H+AGAP,
        CELL_W, CELL_H,                 depth=0.5, y0=ACF, mat=M_amber)

agent('Agent1', AG1L, AGT)
agent('Agent2', AG2L, AGT)

# ── 4. Camera — front orthographic ───────────────────────────────────────────
CX = PW * PX / 2    # 47.5 mm
CZ = -PH * PX / 2   # -25.0 mm
CY = 120.0           # mm in front

bpy.ops.object.camera_add(location=(CX, CY, CZ),
                           rotation=(math.pi/2, 0.0, 0.0))
cam = bpy.context.active_object
cam.name = 'Cam_Front'
cam.data.type = 'ORTHO'
cam.data.ortho_scale = max(PW, PH) * PX * 1.20
bpy.context.scene.camera = cam

# ── 5. Three-point lighting ───────────────────────────────────────────────────
# Key — warm, upper-left
bpy.ops.object.light_add(type='AREA', location=(CX-25, 85, CZ+18),
                          rotation=(math.radians(50), 0, math.radians(-25)))
k = bpy.context.active_object; k.name='Light_Key';  k.data.energy=600; k.data.size=55

# Fill — cool, lower-right
bpy.ops.object.light_add(type='AREA', location=(CX+30, 65, CZ-20))
f = bpy.context.active_object; f.name='Light_Fill'; f.data.energy=220; f.data.size=65

# Rim — thin backlight to separate panel from background
bpy.ops.object.light_add(type='AREA', location=(CX, -18, CZ),
                          rotation=(math.radians(-90), 0, 0))
r = bpy.context.active_object; r.name='Light_Rim';  r.data.energy=80;  r.data.size=90

# ── Done ──────────────────────────────────────────────────────────────────────
print("=" * 64)
print("  A320 ENG 1 FIRE panel — v14 corrected")
print("=" * 64)
print(f"  Panel       {PW}×{PH} px = {PW*PX:.0f}×{PH*PX:.0f} mm")
print(f"  MASTER      {MSW}×{MSH} px = {MSW*PX:.0f}×{MSH*PX:.0f} mm  left={MSL} top={MST}")
print(f"  FIRE pb     {FW}×{FH} px = {FW*PX:.0f}×{FH*PX:.0f} mm  left={FL}  top={FT}")
print(f"  Guard       {GW}×{GH} px = {GW*PX:.0f}×{GH*PX:.0f} mm  walls={GWALL}px h={GDEP:.0f}mm")
print(f"  Hinge       r={HR}mm span={GW*PX:.0f}mm Y={HY:.1f}mm")
print(f"  AGENT ×2    {AW}×{AH} px = {AW*PX:.0f}×{AH*PX:.0f} mm  left1={AG1L} left2={AG2L} top={AGT}")
print(f"  PX={PX} mm/px — 1 Blender unit = 1 mm — panel face at Y=0")
print("=" * 64)
