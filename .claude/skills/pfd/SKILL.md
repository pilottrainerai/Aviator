---
name: pfd
description: MASTER skill for the Aviator A320 PFD (svg-pfd.tsx) — the single source for every PFD element, whether it is static or MOVING, what drives it, its locked geometry/behaviour, and the FCOM logic behind it. Use BEFORE touching ANY PFD element or its behaviour — attitude/ADI, pitch ladder, sky/ground, white boundary lines, bank, sideslip β-target, speed tape, V_LS/α-Prot/α-Max, VMAX, managed/selected speed bug, F/S/green-dot, speed-trend, altitude tape+drum, selected alt, VS needle+pivot+digital box, radio altimeter, heading, ILS G/S+LOC, and the FMA (5 cols × 3 rows). Consolidates and SUPERSEDES pfd-svg (render geometry), pfd-fma-logic (state→values + FMA), and pfd-instruments (old canvas baseline) — those three remain as FALLBACK only. Manual-first: every element, mode, colour, and value traces to FCOM/FCTM or the reference SVG — never invented. Sibling of nd / ecam-ewd / ecam-sd (built to the same pattern).
---

# PFD MASTER — the A320 PFD: every element, what moves, what drives it

The Aviator PFD is rendered by **`src/components/cockpit/svg-pfd.tsx`** (SVG, viewBox
`0 0 4111.21 4096`) with its state/values built by **`buildAircraftState()` /
`buildAircraftStateFromPhase()`** in `pfd-nd.tsx`. This skill is the single entry
point. The three older skills (`pfd-svg`, `pfd-fma-logic`, `pfd-instruments`) are
**fallback** — richer in places, but where they disagree with this file, **this file wins**.

---

## §0 — Hard rules (non-negotiable)

1. **Current component = `svg-pfd.tsx` (SVG).** `pfd-mockup.tsx` (Canvas) is the OLD
   renderer — **fallback only.** `pfd-instruments` describes that old canvas; its
   geometry does NOT apply to the SVG PFD (only its RA/lerp *concepts* carry over).
2. **Read the reference SVG first** for any geometry: `.claude/skills/pfd-svg/PFD-LATEST-reference.svg`
   (= `~/Downloads/PFD LATEST WITH TEXT.svg`). Find the element, copy its exact
   `class="cls-N"` + coordinates. NEVER rebuild geometry from `drawVLS`/memory. If the
   current design has moved past the SVG (VS pivot, box-at-end), the **interactive
   locked reference** `scratchpad/PFD-VS-PIVOT-LOCKED.html` wins and the SVG is the backup.
3. **Manual-first.** Every mode, colour, indication, and value rule traces to FCOM
   (DSC-22 / DSC-31 / DSC-27) / FCTM or the reference SVG. No values from training data;
   airmanship/technique not in the manual → tag `DRAFT (SME review)`.
4. **One element / one scenario per task.** Never "fix all PFDs."
5. **FMA + values must be self-consistent** (§4): modes correspond to real guidance;
   speed within VLS…VMAX; VS sign/magnitude matches intent; law ↔ indications.
6. **No app code before the trigger** (§9). Produce the rule/assessment first; wait for "go".
   (Writing/So updating THIS skill or vault docs is not app code — that's allowed.)
7. **SVG gotcha:** CSS rules override presentation attributes — recolour via inline
   `style="fill:…"/"stroke:…"`, not `fill=`/`stroke=` (β trapezoid, black centre square,
   white dividers all hit this).

---

## §1 — THE MOVING-ELEMENTS CATALOG (the core)

Every PFD element, what moves it, and where it lives. **D** = dynamic, **S** = static/fixed.
Geometry constants are SVG-viewBox units. Owner = the draw fn / group in `svg-pfd.tsx`.

### Attitude (ADI) — `#attitude`
| Element | D/S | Driver | Behaviour / geometry | FCOM |
|---|---|---|---|---|
| Sky/ground backboard + **two white boundary lines** | **S** | — | top **y1278.11**, bottom **y2889.09** FIXED; above=fixed sky, below=fixed ground | DSC-31-40 |
| Horizon + pitch ladder (10/20/30/40/50 + red chevrons >30°) | **D** | pitch | clipped to window `ladWin`(y1278→2889) ∩ `adiDisk`; `translate(0, pitch×43.6)` — **43.6 px/°**, linear | DSC-31-40 |
| Sphere roll (bank) | **D** | bank | `rotate(−bank, 1770.72, 2101.95)` about ADI centre | DSC-31-40 |
| Aircraft symbol (wings + `cls-29` black centre square), FD bars (`cls-25` green, drawn LAST/on top), roll index, bank scale | **S** | — (FD position from guidance) | fixed on top of the moving sphere | DSC-31-40 |
| Pitch-limit protection marks | **D (colour)** | control **law** | NORMAL = green "=" (`#greenEq`); ALTN/DIRECT = **amber X** (`#amberX`); DIRECT also `#ftrim` USE MAN PITCH TRIM | DSC-27-20-20 |
| **Sideslip / β-target trapezoid** (`cls-28`, below roll index) | **D (colour)** | β condition (§5.β) | **hollow outline** (fill:none). Normal = yellow `#ece825`; **β target = recolour STROKE → cyan `#2dc3e8`** (nothing inside) | DSC-31-40 / DSC-27-20-10-50 |
| Radio altimeter | **D** | `alt − fieldElev` | green digits **below y2889** in the brown; shown **< 2500 ft AGL** only | DSC-31-40 |

### Speed tape — `#airspeed` (index cy **2082**, **25.6 px/kt**)
| Element | D/S | Driver | Behaviour | FCOM |
|---|---|---|---|---|
| Speed scale | **D** | speed | scrolls | DSC-31-40 |
| **V_LS** | **D** | `vls` | amber inverted-L `cls-5`; hook at vls, vertical down to α-Prot. Part of the connected 3-band (§3) | DSC-31-40 / DSC-22-10-50 |
| **V α-Prot** | **D** | `alphaProt` | amber/black barber `cls-2` edge + `cls-6` rungs; α-Prot→α-Max. Each band on its OWN speed (§3) | DSC-31-40 |
| **V α-Max** | **D** | `alphaMax` | red `cls-3` at the barber bottom; drawn INSIDE `#vlsStrip` (moves with the band, not static) | DSC-31-40 |
| **VMAX** (VMO/MMO) | **D** | `vmax` | red/black barber at top; must sit ABOVE actual speed for the phase | DSC-31-40 |
| **Speed bug** | **D + colour** | `selectedSpeed`, `speedManaged` | triangle — **magenta `#e526d7` when MANAGED**, **cyan `#2dc3e8` when SELECTED** | DSC-31-40 |
| Char speeds **green dot / S / F** | **D** | **FLAP LEVER** (not decel) | ONE at a time (`drawCharSpeeds`, `#charSpd`): clean→green dot, CONF1→S, CONF2/3→F; green bar+letter on black side; amber "=" VFE-next | DSC-22-10-50-20 |
| **Speed-trend vector** | **D** | 10 s accel | yellow; **appears >2 kt / disappears <1 kt** (hysteresis latch); tip from continuously-eased value; arrow up=accel/down=decel | DSC-31-40 (2) |

### Altitude tape — `#altitude` · VS — `#vsi` · rest
| Element | D/S | Driver | Behaviour | FCOM |
|---|---|---|---|---|
| Altitude scale + rolling drum | **D** | `altitude` (AMSL) | `#altBig` right-anchored (FL350 clears drum); `#altRoll` drum + fade mask | DSC-31-40 |
| Selected altitude | **D** | `selectedAlt` | cyan (managed magenta) | DSC-31-40 |
| **VS needle** `#vsNeedle` | **D** | `vs` | **ALWAYS shown**; horizontal at datum when 0. **TIP scale-locked** (§5.VS); **TAIL pivot rides the GMAP curve** (§5.VS) | DSC-31-40 (1) |
| **VS digital box** `#vsBox`/`#vsVal` | **D** | `vs` | hidden **< 200 fpm**; value = `round(|vs|/100)`; sits at the **needle's END** (§5.VS) | DSC-31-40 (2) |
| Heading tape `#heading` | **D** | `heading` | scrolls | DSC-31-40 |
| ILS G/S `#gsDiamond` + LOC `#locDiamond` | **D** | `gsDev`/`locDev`/`dme` | config-driven "horizontal DME" (§ pfd-fma-logic 5 / drawILS) | DSC-31-40 |
| Baro `#qnh` / ILS info | **D** | QNH/STD, freq/ident | — | DSC-31-40 |
| **FMA** `#f11..#f53` | **D** | `buildAircraftState` modes | 5 cols × 3 rows, ONE uniform size (rows differ by **colour**), white dividers, 10 s white box | DSC-22-30-100 |

---

## §2 — Rendering spec (geometry; from pfd-svg, kept current)
Reference-SVG-first (§0.2). Class scheme == `svg-pfd.tsx`: **cls-2/5/6 amber `#d67827`**,
**cls-1/3/4/16 red `#ed1e24`**, **cls-46 yellow `#ece825`**, **cls-19/cyan `#2dc3e8`**,
**cls-27 VS-needle / cls-25 FD green `#3ad63a`**, **cls-28 roll/slip yellow `#ece825`** (stroke-only, fill:none).
Full per-element geometry: fallback `pfd-svg` §1–2 + vault `reference/PFD-TAKEOFF-LOCKED.md`.
Standard-PFD layer↔FCOM map: fallback `pfd-fma-logic §9 [2026-07-02]` + memory
`reference_aviator_svg_pfd_standard`.

---

## §3 — LOCKED behaviours (today's work — 2026-07-10; these SUPERSEDE older notes)

**VS needle + digital box** (`drawVS` in `svg-pfd.tsx`; interactive ref `PFD-VS-PIVOT-LOCKED.html`):
- **Digital box at the needle's END:** `by = vs>=0 ? tipY − boxH − 8 : tipY + 8` (climb→above tip,
  descent→below tip). NOT the old fixed `tipY+10.5`. `VSC.boxGap=8`. The reference SVG has **no box** —
  just green digits `cls-36` at (3913.18,2735.22); the black box is our own element.
- **Tip + box are SCALE-LOCKED:** `tipY = 2084.24 − sign(vs)·vsPx(vs)` — from the FIXED scale zero, NOT
  the moving pivot. `vsPx` anchors match the ticks exactly (500→y1739, 1000→y1388, 2000→y1135, 6000→y879)
  so "20" sits on the "2" mark, "60" on "6". `vsPx=[[0,0],[500,345],[1000,696],[2000,950],[6000,1205]]`.
- **Pivot (tail) shift** = the ONLY moving part of the needle. Rides a 2D path **P0→P400→P700** (SME-marked
  points) driven by a **saturating V/S→piv# curve `GMAP`** (seed `[[0,0],[500,200],[700,400],[1000,600],[1500,700]]`,
  capped). Symmetric: V/S down walks pivot back to 0; **negative V/S = mirror across P0**. RAF-eased.

**VLS low-speed band — THREE CONNECTED bands, each on its OWN speed** (`drawVLS` in `svg-pfd.tsx`; user 2026-07-11):
- **V_LS** = amber inverted-L (`cls-5`): hook at `vls`, vertical DOWN to the α-Prot position.
- **V α-Prot** = amber/black barber (`cls-2` edge + `cls-6` rungs every 73 px): from `alphaProt` DOWN to `alphaMax`.
- **V α-Max** = red (`cls-3`): at `alphaMax` (the barber's bottom).
- **Each of the three is positioned from its OWN speed** — `vls` / `alphaProt` / `alphaMax` (AircraftState fields;
  `alphaProt` falls back ~14 kt below `vls`, `alphaMax` ~8 kt below `alphaProt`). So the GAPS flex with
  configuration, yet each end meets the next → the band stays **CONNECTED** (no gap, no detach).
- **α-Max is drawn INSIDE `#vlsStrip`** so it moves with the band (the old STATIC `cls-3` line — detached while
  the band moved — was removed). The whole strip is **clipped to the tape** via `#vlsClip` and moves with it.
- ❌ Do NOT: make α-Max a static line outside the strip · anchor the barber bottom to a fixed y (it stretched) ·
  lock the three to fixed offsets (they must each track their own speed). Colours are standard — no extra black.

**Attitude** = fixed backboard + windowed pitch (§1) + bank rotation about (1770.72, 2101.95).

**β-target (CORRECTS pfd-svg §3 — the old "only after THR IDLE" is WRONG):**
FCOM **DSC-27-20-10-50 + DSC-31-40**. The sideslip trapezoid turns **yellow → blue/cyan** when ALL:
1. **CONF 1, 2, or 3** selected, **and**
2. **any ENG N1 > 80%** *or* one **thrust lever > MCT** (≥ FLX if FLX/DERATED TO), **and**
3. **N1 split between engines > 35%.**
= "engine failure at takeoff or go-around." **Appears at the failure (DURING takeoff)**, not only after
securing — pulling the dead lever to idle only widens the split. Reverts to yellow when clean (CONF 0) or
the split closes. Recolour the EXISTING `cls-28` trapezoid **stroke** (hollow); never add a new shape.

**Abnormal-instrument flags (2026-07-11 — scenario audit; `AircraftState` + svg-pfd draw paths):**
- **`raInop`** — both radio altimeters INOP (EMER ELEC) → **hide the RA** entirely (svg-pfd forces AGL huge). 
- **`spdFlag`** — airspeed source LOST (ADR off/failed) → **red "SPD" flag** replaces the scale; the whole speed
  tape blanks (scale / VLS / char / bug / trend). `#spdFlagTxt`. FCOM DSC-31-40 item 6.
- **`spdUnreliable`** — airspeed erroneous but PRESENT (ADR still on) → **amber "SPD" caption**, scale kept
  (present-but-wrong; distinct from the red flag). Used by nav-adr / unreliable-speed.
- **`fdOff`** — both FDs off → **blank the FD bars** (`#fdBars`) and the FMA `1 FD 2` (`f52`).
These are set per-phase by the scenario branches (§4). Law → amber-X / USE MAN PITCH TRIM is already handled
by `drawLaw` from `law:'ALTN'/'DIRECT'`.

---

## §4 — The value/logic governor (from pfd-fma-logic — CURRENT, use in full)

`buildAircraftState()` owns state→values. The deep content lives in **`pfd-fma-logic`** (use it directly);
the load-bearing parts:

- **FMA model (DSC-22-30-100):** 5 columns — 1 A/THR · 2 vertical · 3 lateral · 4 approach capability +
  minimum · 5 AP/FD/A-THR engagement. Three lines in cols 1-3: **line 1 green = engaged**, **line 2
  blue = armed** (magenta = armed-by-constraint), **line 3 = special messages** (MAN PITCH TRIM ONLY red /
  USE MAN PITCH TRIM amber, then FMGS). 10 s white box on each new annunciation.
- **Managed vs Selected:** managed → FMGS target, **magenta** bug + managed modes (CLB/DES, NAV);
  selected → FCU, **cyan** bug, **SPEED/MACH** in col 1, selected modes (OP CLB/OP DES/V/S, HDG/TRACK).
- **Consistency:** VLS ≤ speed ≤ VMAX; VMAX above phase speed; vertical FMA ↔ VS sign; law ↔ amber X /
  MAN PITCH TRIM; never AP engaged when INOP; A/THR blue armed / green active.
- **Altitude-acquire:** OP DES/OP CLB + ALT armed(blue) → **ALT★** (capture, zone `cz=max(150,|vs|/6)`) →
  **ALT** (hold), with a capture LATCH to kill ALT★/ALT flicker; never show ALT-green + ALT-armed-blue together.
- **TRANSITION GOVERNOR (LOCKED, pfd-fma-logic §5c G1–G7):** VS = f(altitude-to-go), not a per-step
  constant; real ALT★ ramp to 0; band scoping; seamless handoff; VLS floor; decel↔VS coupling. **Reuse
  verbatim for every descent/level scenario** — never re-derive per segment.
- **Seed models:** §5a single-engine ENG1 FIRE phase ladder · §5b DUAL HYD G+Y ladder (adds vmax/law).

---

## §5 — Boundaries & handoff (so EWD/ECAM/ND plug in cleanly)
| Concern | Owner |
|---|---|
| PFD element geometry / colour / clip-transform / draw fns | **this skill** (§1-3) — deep fallback `pfd-svg` |
| PFD state → values + FMA modes | **this skill §4** — deep detail `pfd-fma-logic` (buildAircraftState) |
| OLD canvas VS/RA/alt baseline | `pfd-instruments` (**fallback**, `pfd-mockup.tsx`) |
| E/WD (upper ECAM) | **`ecam-ewd`** (sibling, to build) |
| SD (system pages) | **`ecam-sd`** (sibling; HYD SD already live `hyd-sd-page.tsx`) |
| Navigation Display | **`nd`** (sibling, to build) |
| Broad cockpit visuals / FCOM intake | `cockpit-ui` |
The PFD shares `buildAircraftState` — EWD/ECAM read the SAME state (eng, config, warnings) so indications
stay coherent across displays. That shared state is the plug.

---

## §6 — Fallback / backup index
| Source | Role |
|---|---|
| `PFD-LATEST-reference.svg` (this skill's dir) / `~/Downloads/PFD LATEST WITH TEXT.svg` | reference geometry — backup once the live design moves past it |
| `scratchpad/PFD-VS-PIVOT-LOCKED.html` + vault `reference/pfd-svg/` | interactive locked ref (VS pivot, β, attitude) — CURRENT for those behaviours |
| skill `pfd-svg` | full per-element geometry — fallback |
| skill `pfd-fma-logic` | full logic/governor/FMA — **use in full for values** |
| skill `pfd-instruments` | old canvas baseline — fallback |
| vault `reference/PFD-TAKEOFF-LOCKED.md`, `wiki/pfd-svg-catalog.md`, `wiki/svg-pfd-logic.md`, `library/a320-pfd-nd.md` | vault docs |
| memory `project_aviator_pfd_svg_locked`, `reference_aviator_svg_pfd_standard` | design log |

---

## §7 — Source library
FCOM dump `~/.claude/manuals/a320/fcom-full.txt` · FCTM `fctm-full.txt`.
| FCOM | Owns |
|---|---|
| `DSC-22_30-100` | FMA — 5 cols, 3 lines, colours, special messages |
| `DSC-22_10-40-40` | PFD layout |
| `DSC-31-40` | EFIS indicating — PFD/FMA rendering |
| `DSC-22` | AP/FD/A-THR engagement + mode logic (managed/selected, ALT★) |
| `DSC-27-20-20` | control law → PFD (amber X, MAN PITCH TRIM) |
| `DSC-27-20-10-50` | **Sideslip target (β)** condition |
| `DSC-22-10-50-20` | characteristic speeds (green dot/S/F/VFE-next) |

---

## §8 — Trigger phrases
- **"go"** — approve a rule/assessment, proceed to app code.
- **"Apply this PFD rule"** — add ONE value/mode rule for a named condition (§4).
- **"Add condition <x>" / "New scenario PFD"** — extend/build a `buildAircraftState` branch.
- **"new spec"** — restart intake for an element.
Any PFD/FMA app-code change WITHOUT a trigger → return the rule plan, list triggers, ask.

---

## §9 — Change log
### [2026-07-10] Master skill created — consolidates pfd-svg + pfd-fma-logic + pfd-instruments
- New: the **moving-elements catalog** (§1) — every element, static/dynamic, driver, geometry, owner.
- Made **`svg-pfd.tsx` the current component**; `pfd-mockup.tsx`/`pfd-instruments` = fallback (they
  described the old canvas — pfd-fma-logic still pointed VS/RA rendering there; corrected).
- Locked **today's VS work** (§3): digital box at the needle END, tip+box scale-locked to 2084.24,
  pivot tail on the saturating GMAP curve (P0→P400→P700, mirrored), VLS rigid three-band.
- **Corrected β-target** (§3): CONF 1/2/3 · N1>80% (or lever>MCT) · ΔN1>35% — appears DURING takeoff at
  the failure. Supersedes pfd-svg §3 ("only after THR IDLE" = wrong). Recolour existing `cls-28` stroke.
- Kept `pfd-fma-logic` as the full logic/governor reference (§4) — not duplicated here, used in full.
