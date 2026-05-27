"""
List all object/mesh names from the exported GLB to map them for material switching.
"""
import bpy

for obj in bpy.context.scene.objects:
    if obj.type in ('MESH', 'CURVE'):
        mats = [m.name for m in obj.data.materials if m] if obj.data.materials else []
        print(f"{obj.type:5} | {obj.name:40} | mats: {mats}")
