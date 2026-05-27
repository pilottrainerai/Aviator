"""
Headless GLB export for fire_panel_two.blend → fire_panel.glb

Run via:
  /Applications/Blender.app/Contents/MacOS/Blender \
    --background /Users/czar/Desktop/_archive/blender/fire_panel_two_loose/fire_panel_two.blend \
    --python /Users/czar/Desktop/_archive/blender/fire_panel_two_loose/export_glb.py

The GLB is written to:
  /Users/czar/Desktop/pilottrainerai/Aviator/public/models/fire_panel.glb

Key object names (used by FirePanel3D.tsx for material-swap lighting):
  ENG1_FirePb  — ENG 1 FIRE push-button face
  ENG2_FirePb  — ENG 2 FIRE push-button face
  APU_FirePb   — APU FIRE push-button face
  Agent1_SQUIB — AGENT 1 SQUIB indicator cell
  Agent1_DISCH — AGENT 1 DISCH indicator cell
  Agent2_SQUIB — AGENT 2 SQUIB indicator cell
  Agent2_DISCH — AGENT 2 DISCH indicator cell
  (plus all geometry already in the scene)
"""
import bpy, os, sys

OUT_PATH = "/Users/czar/Desktop/pilottrainerai/Aviator/public/models/fire_panel.glb"
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

# Deselect all, then select everything to export
bpy.ops.object.select_all(action='SELECT')

bpy.ops.export_scene.gltf(
    filepath=OUT_PATH,
    export_format='GLB',
    export_apply=True,           # apply modifiers (boolean cuts, bevels)
    export_materials='EXPORT',
    export_normals=True,
    export_animations=False,
    use_selection=False,
    export_cameras=False,
    export_lights=False,         # we supply our own lights in R3F
)

print(f"[export_glb] Written → {OUT_PATH}")
print(f"[export_glb] Size: {os.path.getsize(OUT_PATH) / 1024:.1f} KB")
