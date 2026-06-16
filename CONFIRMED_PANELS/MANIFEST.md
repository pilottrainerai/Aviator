# CONFIRMED PANELS — Aviator cockpit 3D panels

Confirmed, latest-from-Blender 3D cockpit panels. Each folder is a **snapshot of the
live source-of-truth** (component + GLB model + face texture + dev page + preview render)
as confirmed on the date below. These are the "good" versions to restore from.

Snapshot taken from branch `fire-test-panel-wip-2026-06-10` @ `1af8652`.
Confirmed: **2026-06-16**.

| Panel | Folder | Live component | Model | Dev route |
|---|---|---|---|---|
| **ENG FIRE** | `eng_fire/`  | `src/components/cockpit/fire-test-panel-3d.tsx` | `public/models/fire_test_panel.glb` | `/dev/fire-test-panel-3d` |
| **ENG START** | `eng_start/` | `src/components/cockpit/eng-start-panel-3d.tsx` | `public/models/eng_start_panel.glb` | `/dev/eng-start-panel-3d` |
| **EVAC** | `evac/` | `src/components/cockpit/evac-3d.tsx` | `public/models/evac_panel.glb` | `/dev/evac-3d` |

## How to restore a confirmed panel
Copy the files back to their live paths (see each folder's README for the exact map),
then refresh the dev route. The component `.tsx` → `src/components/cockpit/`, the `.glb`
+ face `.png` → `public/models/`, the `page.tsx` → `src/app/dev/<route>/`.

## Not included (yet)
- **HYD** — has `blender/hyd/best_version/` (Blender files only); not added to this
  confirmed collection.

## Recipe
All panels follow the Blender→web procedure in
`blender/PROCEDURE_blender_to_web.md` and the `blender-panels-to-web` skill (§10 full
FINAL treatment: lit metallic face + text mask + part materials + lighting).
