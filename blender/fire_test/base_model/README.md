# FIRE panel — BASE MODEL

This is the canonical, clean, working FIRE panel. **Start all future work from here.**

- **Live at:** http://localhost:3004/dev/fire-test-panel-3d
- **Sections:** ENG1 + APU + ENG2, all interactive (guard lift → FIRE pb push → AGENT discharge).
- **State:** debug overlays stripped; only the TEST/RESET trigger remains.

## The 4 files that ARE the panel
| File here | Lives in the app at | Role |
|---|---|---|
| `page.tsx` | `src/app/dev/fire-test-panel-3d/page.tsx` | dev page (TEST trigger + R reset) |
| `fire-test-panel-3d.tsx` | `src/components/cockpit/fire-test-panel-3d.tsx` | the R3F scene + all interaction logic |
| `fire_test_panel.glb` | `public/models/fire_test_panel.glb` | geometry (buttons / guards / agents) |
| `fire_test_face_rebake.png` | `public/models/fire_test_face_rebake.png` | clean Cycles re-bake = the panel face |

The panel = **GLB geometry + the re-baked face PNG** applied by the component
(`FACE_TEX_URL = "/models/fire_test_face_rebake.png"`). That two-file pairing is
the deliverable — it's already wired into localhost:3004 and works.

## To restore this base model
Copy the four files above back to their app paths and reload localhost:3004.

`PREVIEW_cold.png` shows the expected cold look. `.commit` records the git commit.
