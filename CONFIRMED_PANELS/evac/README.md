# EVAC panel — CONFIRMED

EVAC panel — COMMAND guarded pushbutton (latches, ON light) + HORN SHUT OFF
(momentary) + CAPT / CAPT & PURS selector.

**Confirmed:** 2026-06-16 · includes the HORN SHUT OFF fix (HORN ignores the "stays"
preview and always springs back to NEUTRAL after its dip; only COMMAND latches at stays).

## Files in this snapshot → live path
| Snapshot file | Restore to |
|---|---|
| `evac-3d.tsx` | `src/components/cockpit/evac-3d.tsx` |
| `evac_panel.glb` | `public/models/evac_panel.glb` |
| `evac_face.png` | `public/models/evac_face.png` |
| `page.tsx` | `src/app/dev/evac-3d/page.tsx` |
| `PREVIEW_resting.png`, `PREVIEW_command_active.png` | reference renders only |

Dev route: `/dev/evac-3d`
