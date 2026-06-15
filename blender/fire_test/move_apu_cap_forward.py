import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
GLB="/Users/czar/Documents/Codex/2026-06-10/pilottrainerai-aviator-https-github-com-pilottrainerai/Aviator/public/models/fire_test_panel.glb.bak-2026-06-15"
bpy.ops.import_scene.gltf(filepath=GLB)
cap=bpy.data.objects.get("Cube.016")
if cap is None:
    # name may be mangled; find black-button mesh nearest APU agent (x~-0.57, y~1.02) that is the thin cap
    cands=[o for o in bpy.data.objects if o.type=='MESH' and o.data.materials and any((m and m.name=='black button') for m in o.data.materials)]
    cap=min(cands, key=lambda o:(abs(o.matrix_world.translation.x+0.572)+abs(o.matrix_world.translation.y-1.023)) if o.dimensions.z<0.013 else 9)
print("CAP:", cap.name, "before z=", round(cap.matrix_world.translation.z,4))
cap.location.z += 0.052   # pull toward viewer so it sits in front of its surround
bpy.context.view_layer.update()
print("CAP after z=", round(cap.matrix_world.translation.z,4))
bpy.ops.export_scene.gltf(filepath="/tmp/fire_test_panel_capfwd.glb", export_format='GLB')
print("EXPORTED")
