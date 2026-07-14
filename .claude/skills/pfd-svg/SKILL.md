---
name: pfd-svg
description: The LOCKED per-element spec + reference SVG for the Aviator A320 PFD (svg-pfd.tsx). Use BEFORE editing ANY PFD element — attitude/ADI, pitch ladder, sky/ground, white boundary lines, speed tape, V_LS / V α-Prot / V α-Max, V_MAX, managed-V2 bug, F speed, green dot, speed trend, radio altimeter, FMA, VS, heading, ILS. Enforces reading the real reference SVG and copying its exact cls-*/coordinates instead of reconstructing. Sibling of pfd-fma-logic (state→values) and pfd-instruments (locked VS/RA/alt lerp).
---

> ⚠️ **FALLBACK — superseded by the `pfd` master skill.** Load **`pfd`** first (it has the
> moving-elements catalog + today's locked VS/β/pivot work). This file is deep geometry
> reference/backup only. NOTE: **§3 β-target below is STALE** — the correct rule is CONF 1/2/3 ·
> N1>80% (or lever>MCT) · ΔN1>35% (appears DURING takeoff at the failure); see `pfd` §3.

# PFD SVG — element spec (LOCKED)

You are working on **Aviator**'s PFD, rendered by `src/components/cockpit/svg-pfd.tsx`.

## §0 — HARD RULE: read the reference SVG first
The reference PFD is **`.claude/skills/pfd-svg/PFD-LATEST-reference.svg`** (aka
`~/Downloads/PFD LATEST WITH TEXT.svg`). For any element, **open that SVG, find the element, copy its exact
`class="cls-N"` + coordinates.** Do NOT rebuild geometry from `drawVLS`/`buildAircraftState`/memory. The
class scheme in the reference == `svg-pfd.tsx` (cls-2/5/6 amber `#d67827`, cls-1/3/4/16 red `#ed1e24`,
cls-46 yellow `#ece825`, cls-19 cyan `#2dc3e8`). If you catch yourself computing coordinates or inventing
a shape, STOP and read the reference instead. Every prior detour came from not doing this.

Full locked design + rationale: vault `01-KNOWLEDGE-BASES/Aviator/reference/PFD-TAKEOFF-LOCKED.md`.

## §1 — Attitude (ADI): fixed backboard + windowed pitch
- Sky/ground + the **two wide white boundary lines** (top **y1278.11**, bottom **y2889.09**) are **FIXED**.
- Moving content (sky/ground/horizon/pitch-ladder) is **clipped to the window between those lines**
  (`ladWin` y1278→2889 ∩ `adiDisk`) and translates `translate(0, pitch×43.6)` (43.6 px/°, linear, DSC-31-40).
  Above top line = fixed sky; below bottom line = fixed ground.
- Nose up → ground clips off the bottom & disappears, blue fills; higher ladder marks scroll in
  (10/20/30/40/50 + red chevrons >30°); RA sits **below y2889** in the brown, shown < 2500 ft AGL.
- FIXED on top: aircraft symbol (wings+centre), FD crossbars, roll index, bank scale, green "=" marks.

## §2 — Speed tape V-speeds (copy verbatim from the reference)
- **V_LS** = the inverted-L with a **LONG vertical**: `cls-5` `470.32 2598.47  534.81 2598.47  534.81 2967.44`.
  (The app's old `drawVLS` drew this hook SHORT — the reference draws it LONG, ending where α-Prot begins.)
- **V α-Prot** = amber/black barber below it: `cls-2` edge `x555.81 y2962.81→3162.62` + `cls-6` rungs
  `y2980.6 / 3053.83 / 3130.13`.
- **V α-Max** = red at the bottom: `cls-3` `y3162.62`.
- **V_MAX** = static red/black barber at the top (y995–1268).
- **Managed V2** = **magenta** (`#e526d7`) triangle (managed target ≈V2) — recolour of the cyan `spdSelBug`.
- **F / green dot** = green `#3ad63a` via `drawCharSpeeds`. **Reference bug** = yellow `spdTarget`.
- Geometry: index cy 2082, **25.6 px/kt**.

## §3 — β-target timing
No β-target during takeoff. It appears only **after THR LEVER 1 → IDLE** (thrust asymmetry) in the
eng-fire securing flow; then the sideslip trapezoid turns blue and the profile becomes engine-out.

## §4 — Boundaries (which skill owns what)
- **pfd-svg** (this): the SVG elements — geometry, exact shapes, colours, clip/transform structure.
- **pfd-fma-logic**: state → values (pitch/speed/vs/FMA modes) in `buildAircraftState`.
- **pfd-instruments**: LOCKED VS bar / RA liftoff / altitude lerp — do not regress.
- Siblings to build next (same "read the reference SVG first" pattern): **nd-svg · ecam-ewd · ecam-sd**.

## §5 — Status
Locked look proven in `scratchpad/pfd_interactive.html`. **Not yet ported** into `svg-pfd.tsx` — the port
(drawVLS long-hook + attitude window-clip + magenta-V2 + F) is the next task, gated to eng-fire takeoff so
G+Y stays untouched.
