"""
ENG1 Guard Pivot Cavity
-----------------------
Builds a thin hollow cylinder (annular hinge knuckle) at the ENG1_JOut/JIn
position. Pivot axis runs along X (guard flips upward around this axis).

Border zones on each flat face:
  outer 20 % ring  → 0.05 grey  (near-full black, "20 % black")
  inner 80 % disc  → 0.20 grey  (dark grey,       "80 % black")

Run in Blender > Scripting, or via --background --python.
"""

import bpy, bmesh, math
from mathutils import Vector

# ── 1. Resolve joints from actual mesh bounds ─────────────────────────────────
def mesh_centre(name):
    obj = bpy.data.objects.get(name)
    if not obj:
        raise RuntimeError(f"Object '{name}' not found. Scene: {[o.name for o in bpy.data.objects]}")
    verts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return Vector((
        sum(v.x for v in verts) / len(verts),
        sum(v.y for v in verts) / len(verts),
        sum(v.z for v in verts) / len(verts),
    ))

c_out = mesh_centre("ENG1_JOut")   # (-0.0008, 0.0132, 0.0052)
c_in  = mesh_centre("ENG1_JIn")    # (-0.0008, 0.0132, 0.0058)

# (joint midpoint kept for metadata only)
mid_z = (c_out.z + c_in.z) / 2

# ── 2. Upper-frame measurements from ENG1_Guard ──────────────────────────────
guard_obj = bpy.data.objects.get("ENG1_Guard")
if not guard_obj:
    raise RuntimeError("ENG1_Guard not found")

gv = [guard_obj.matrix_world @ v.co for v in guard_obj.data.vertices]
gy = [v.y for v in gv]
gx = [v.x for v in gv]

guard_y_max = max(gy)                        # top outer edge  ≈  0.01517
# inner bottom of the top rail: highest Y cluster below the outer lip
inner_y_candidates = sorted(set(round(v, 5) for v in gy), reverse=True)
# the second distinct Y band is the inner-frame bottom edge
frame_inner_y = next(y for y in inner_y_candidates if y < guard_y_max - 0.001)  # ≈ 0.01104

frame_y_depth  = guard_y_max - frame_inner_y          # ≈ 0.00413 m
frame_y_centre = (guard_y_max + frame_inner_y) / 2    # ≈ 0.01311 m

# X width at the top outer edge
top_verts_x = [v.x for v in gv if v.y >= guard_y_max - 0.001]
frame_x_min  = min(top_verts_x)    # ≈ -0.01688
frame_x_max  = max(top_verts_x)    # ≈  0.01588
frame_x_width = frame_x_max - frame_x_min  # ≈ 0.03276 m
frame_x_centre = (frame_x_min + frame_x_max) / 2

# Cylinder geometry
OUTER_RADIUS = frame_y_depth / 2                  # radius = half of frame Y depth ≈ 2.07 mm
INNER_RADIUS = OUTER_RADIUS * 0.80               # thin wall = 20 % of outer radius
depth        = frame_x_width * 0.50              # 50 % of upper frame X width ≈ 16.38 mm
SEGMENTS     = 64

# ── 3. Build annular mesh via bmesh ──────────────────────────────────────────
mesh = bpy.data.meshes.new("ENG1_GUARD_PIVOT_CAVITY_mesh")
obj  = bpy.data.objects.new("ENG1_GUARD_PIVOT_CAVITY", mesh)
bpy.context.scene.collection.objects.link(obj)

bm = bmesh.new()
half = depth / 2

def ring(bm, r, x_off):
    return [bm.verts.new((x_off,
                          r * math.cos(2*math.pi*i/SEGMENTS),
                          r * math.sin(2*math.pi*i/SEGMENTS)))
            for i in range(SEGMENTS)]

# 4 rings: outer/inner × left/right face
OL = ring(bm, OUTER_RADIUS, -half)   # outer left
OR = ring(bm, OUTER_RADIUS, +half)   # outer right
IL = ring(bm, INNER_RADIUS, -half)   # inner left
IR = ring(bm, INNER_RADIUS, +half)   # inner right

bm.verts.ensure_lookup_table()

def quad_ring(bm, a, b):
    n = len(a)
    faces = []
    for i in range(n):
        f = bm.faces.new([a[i], a[(i+1)%n], b[(i+1)%n], b[i]])
        faces.append(f)
    return faces

outer_wall_faces = quad_ring(bm, OL, OR)   # outer cylinder wall
inner_wall_faces = quad_ring(bm, IR, IL)   # inner wall (reversed)
left_cap_faces   = quad_ring(bm, IL, OL)   # left annular cap
right_cap_faces  = quad_ring(bm, OR, IR)   # right annular cap

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
mesh.update()

# ── 4. Position & orient (pivot axis = X) ────────────────────────────────────
# Override centre: use measured upper-frame Y centre and guard Z centre
gz = [v.z for v in gv]
guard_z_centre = (max(gz) + min(gz)) / 2
obj.location = Vector((frame_x_centre, frame_y_centre, guard_z_centre))

# ── 5. Materials ──────────────────────────────────────────────────────────────
def make_mat(name, grey):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF") or nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (grey, grey, grey, 1.0)
    bsdf.inputs["Roughness"].default_value  = 0.55
    bsdf.inputs["Metallic"].default_value   = 0.25
    return mat

# outer 20 % border → near-full black (0.05)
# inner 80 % disc   → dark grey (0.20)
mat_border = make_mat("ENG1_PivotCavity_Border_20", 0.05)
mat_inner  = make_mat("ENG1_PivotCavity_Inner_80",  0.20)

obj.data.materials.append(mat_border)  # slot 0  (outer wall + border zone)
obj.data.materials.append(mat_inner)   # slot 1  (inner wall + inner disc)

# Assign by centroid radius:
#   centroid r ≥ threshold → outer wall → border (slot 0)
#   centroid r <  threshold → inner wall → inner  (slot 1)
threshold = (OUTER_RADIUS + INNER_RADIUS) / 2

for poly in mesh.polygons:
    cy = sum(mesh.vertices[v].co.y for v in poly.vertices) / len(poly.vertices)
    cz = sum(mesh.vertices[v].co.z for v in poly.vertices) / len(poly.vertices)
    r  = math.sqrt(cy**2 + cz**2)
    poly.material_index = 0 if r >= threshold else 1

# ── 6. Metadata ───────────────────────────────────────────────────────────────
obj["pivot_for"]   = "ENG1_GUARD"
obj["pivot_axis"]  = "X"
obj["knuckle_z"]   = round(mid_z, 5)

# ── 7. Save ───────────────────────────────────────────────────────────────────
bpy.ops.wm.save_mainfile(check_existing=False)

print(f"\n✓  ENG1_GUARD_PIVOT_CAVITY written & saved")
print(f"   centre     : ({frame_x_centre:.5f}, {frame_y_centre:.5f}, {guard_z_centre:.5f})")
print(f"   depth (X)  : {depth:.4f} m")
print(f"   outer R    : {OUTER_RADIUS:.4f} m   inner R : {INNER_RADIUS:.4f} m")
print(f"   mat[0] border (r≥{threshold:.4f}) : grey=0.05  (20 % black)")
print(f"   mat[1] inner  (r< {threshold:.4f}) : grey=0.20  (80 % black)")
