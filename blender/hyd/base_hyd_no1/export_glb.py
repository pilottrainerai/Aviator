"""export_glb.py — HYD panel. All geometry + clean materials (no painted face to
bake), so this just exports the GLB (MESH + FONT labels). Does NOT save the .blend.
RUN: /Applications/Blender.app/Contents/MacOS/Blender -b blender/hyd/best_version/hyd_panel_BEST.blend -P blender/hyd/export_glb.py"""
import bpy, os
REPO = "/Users/czar/Documents/Codex/2026-06-10/pilottrainerai-aviator-https-github-com-pilottrainerai/Aviator"
GLB_OUT = os.path.join(REPO, "public/models/hyd_panel.glb")
for o in bpy.data.objects:
    o.select_set(o.type in {'MESH', 'FONT'})  # FONT labels vanish if not selected
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT, export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True,
    export_materials='EXPORT', export_image_format='AUTO')
print("SAVED GLB ->", os.path.getsize(GLB_OUT))
print("EXPORT DONE (did NOT save the .blend)")
