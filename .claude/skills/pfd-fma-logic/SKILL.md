---
name: pfd-fma-logic
description: FCOM-driven LOGIC governor for the Aviator A320 PFD + FMA. Use BEFORE editing buildAircraftState / buildAircraftStateFromPhase or any scenario's PFD/FMA behaviour — what the FMA modes and PFD indications should SHOW given the aircraft/automation/system state, and the physically-consistent dynamic VALUES (speed, rate of climb/descent, altitude, pitch, Mach, VMAX, law) per phase/condition. Enforces FMA self-consistency (modes must correspond to real guidance) and degradation logic across scenarios. Separate from cockpit-ui (visual rendering) and pfd-instruments (locked VS/RA/altitude baseline). Manual-first: every mode, indication, and value traces to FCOM/FCTM — Claude does not invent.
---

# PFD / FMA Logic Skill

You are working on **Aviator** — a precision A320 abnormal-procedure training tool.
This skill governs the **logic** of the PFD and FMA: given the scenario's aircraft,
automation and system state, **what the FMA modes and PFD indications must show**,
and **what the dynamic values must be** (speed, rate of climb/descent, altitude,
pitch, Mach, VMAX, control law) so every snapshot is physically and operationally
coherent — and consistent across all scenarios.

**Claude's own knowledge of "what the FMA shows" is NOT a valid source.
Only what is extracted from FCOM/FCTM in this session counts.**

---

## 0. Hard rules (non-negotiable)

1. **Manual-first.** Every FMA mode, PFD indication, and value rule traces to
   FCOM (DSC-22 / DSC-31 / DSC-27) or FCTM. No values from training data. If a
   value is airmanship/technique not in the manual, tag it `DRAFT (SME review)`.
2. **This skill owns the LOGIC surface** — `buildAircraftState()` and
   `buildAircraftStateFromPhase()` in `pfd-nd.tsx` (state → display + values).
   It does NOT own pixels. See §1 boundary.
3. **`pfd-instruments` is LOCKED.** Never change VS-bar geometry, RA liftoff, or
   the altitude lerp/animation in `pfd-mockup.tsx` without pilot sign-off — read
   that skill first. This skill sets the *values*; `pfd-instruments` renders them.
4. **FMA must be self-consistent.** Modes must correspond to the actual guidance
   and aircraft state — no impossible combinations (§2 consistency rules).
5. **Values must be physically consistent.** Speed within VLS…VMAX; VS sign and
   magnitude must match the target and condition; Mach consistent with TAS+alt;
   the FMA vertical mode must match the VS behaviour (climb/hold/descend).
6. **No code before the trigger phrase (§7).** Produce the assessment/rule plan
   first; wait for "go".
7. **One scenario or condition per task.** Never "fix all PFDs" — name one.
8. **When stuck, stop and discuss.** "FCOM says X for this mode, the scenario
   implies Y — which?"
9. **The altitude-driven TRANSITION GOVERNOR is LOCKED — reuse it for EVERY
   descent/level/speed change, never re-derive per segment (§5c).** VS is a
   function of altitude-to-go to the selected altitude, not a per-step constant:
   full schedule rate when far → ramp to 0 across the ALT* capture zone → truly 0
   while level. Never pin a step's `vs` through a hold (the level-off is faked and
   the next descent reveals it in one frame = a snap). A "level / continue /
   configure" step must MIRROR the previous step's governor target (same `selAlt`
   + `altArmed`), never hard-reset `vs=0` (a hard-reset mid-capture = the blip).
   A band schedule (e.g. 290/−3000→250/−1500 across 10 000) is SCOPED to its own
   segment (gate on `selAlt`), never bleeds into another leg. The **physical**
   PFD state (stopped/descending) is driven by a **physical/live-signal gate**
   (touchdown, live speed→0), NEVER by a comms/consequence card. Speed, VS and
   altitude move IN COORDINATION (§5c G7 — a commanded speed reduction shallows
   the descent, then resumes); the selected speed is floored at VLS (G6, never
   into the amber band); the 250-kt decel completes BY 10 000, not below it.

---

## 1. The boundary — which skill owns what

| Concern | Skill | Surface |
|---|---|---|
| **What the PFD/FMA SHOWS given state + the dynamic values** | **`pfd-fma-logic`** (this) | `buildAircraftState` / `buildAircraftStateFromPhase` |
| How an element LOOKS (geometry, colour, layout, FCOM visual spec) | `cockpit-ui` | `pfd-mockup.tsx` draw fns |
| LOCKED baseline — VS bar / RA liftoff / altitude animation | `pfd-instruments` | `pfd-mockup.tsx` (do not touch) |

A change usually touches one. If it spans (new indication needs both new logic
and new drawing), state both and cross-reference. `pfd-fma-logic` decides the
*value*; `cockpit-ui` decides how it's drawn; `pfd-instruments` must not regress.

---

## 2. The FMA model (FCOM DSC-22-30-100)

The FMA (above the PFDs) shows the status of the **A/THR**, the **AP/FD vertical
and lateral modes**, the **approach capabilities**, and the **AP/FD-A/THR
engagement status** [`fcom:DSC-22_30-100 GENERAL`]. A **white box** is shown for
**10 s** around each new annunciation (15 s in some reversions, with an aural
triple click).

**Five columns:**
| Col | Content | Source |
|---|---|---|
| 1 | **A/THR** (autothrust) | `fcom:DSC-22_30-100-B` |
| 2 | **AP/FD vertical** mode | `fcom:DSC-22_30-100` |
| 3 | **AP/FD lateral** mode | `fcom:DSC-22_30-100` |
| 4 | **Approach capability** (white) + **minimum** (blue) | `fcom:DSC-22_30-100-A-...358` |
| 5 | **AP / FD / A-THR engagement** (white); A/THR **blue** when armed not active | `fcom:DSC-22_30-100-A-...359` |

**Three-line structure (the three left columns)** [`fcom:DSC-22_30-100-A-...357`]:
- **1st line** — engaged modes in **green**.
- **2nd line** — armed modes in **blue** (or **magenta** = armed/engaged due to a
  constraint).
- **3rd line** — special messages, in priority: flight-control messages first —
  **"MAN PITCH TRIM ONLY"** red (flashing 9 s then steady), **"USE MAN PITCH
  TRIM"** amber (pulsing 9 s then steady) — then FMGS messages.

---

## 3. The PFD indication model (FCOM DSC-22-10-40-40 / DSC-31 / DSC-27)

Drive these from the AircraftState the logic builds:
- **Speed tape:** target/managed speed; **VMAX barber pole** (VMO/MMO) — must sit
  ABOVE the actual speed for the phase (a takeoff default of 220 falsely reddens a
  cruise speed); **VLS** floor. [`fcom:DSC-31-40` / `pfd-instruments`]
- **Altitude tape:** baro altitude + **selected/target altitude**.
- **VS indicator:** the **rate** (climb/descent). Rendered by `pfd-instruments`
  (locked) — this skill sets the value only.
- **Attitude + control law** [`fcom:DSC-27-20-20`]: ALTERNATE & DIRECT law →
  **amber Xs replace the green "=" pitch limit bars**; DIRECT law → **"USE MAN
  PITCH TRIM"** amber in the FMA 3rd line [`fcom:DSC-22-30-100` / `DSC-27`].
- **Radio Altimeter:** displayed only **< 2500 ft AGL** (gate; `pfd-instruments`).
- **Mach:** auto-computed from TAS + altitude — set a realistic TAS per phase.

---

## 4. The value logic — physically consistent dynamics

This is the heart of the skill: **each step/phase is a coherent snapshot.** The
state advances step-by-step to a physically accurate set of values. State the
rule per condition; the engine interpolates/animates between snapshots.

**Rule format** (one row per condition/step):
```
<condition / completed-step> → { speed, altitude, vs, pitch, tas, vmax, law,
                                  thrMode, vertMode, latMode, athr(armed/active) }
```

**Consistency checks (apply to every rule):**
- **VS ↔ intent:** climbing → vs > 0 and altitude rising toward selectedAlt;
  descending → vs < 0; level/holding → vs = 0. The **rate** matches the situation
  (e.g. emergency descent ~3000 fpm; normal climb ~1500–2200 fpm single-engine).
- **Speed bounds:** VLS ≤ speed ≤ VMAX for the configuration; VMAX above speed.
- **Vertical FMA ↔ VS:** OP CLB/CLB ↔ climb, V/S ↔ commanded vertical rate,
  OP DES/DES ↔ descent, ALT/ALT* ↔ capture/hold.
- **Law ↔ indications:** ALTN/DIRECT → amber X; DIRECT → USE MAN PITCH TRIM.
- **Engagement ↔ availability:** never show AP1/AP2 engaged when AP is INOP for
  the failure; A/THR blue when armed-not-active, green when active.

---

## 5. Baseline models codified (the seeds — proven, already live)

### 5a. Single-engine — ENG 1(2) FIRE / FAILURE after V1
File: `buildAircraftStateFromPhase` + the FIRE branch in `pfd-nd.tsx`.
Step-driven phase ladder (each step = a physically accurate snapshot):

| Phase / step | speed | alt | vs | pitch | FMA (thr · vert · athr) |
|---|---|---|---|---|---|
| V1 ground roll | 145 | 777 | 0 | 6 | MAN TOGA · SRS(cyan) · — |
| fire @ ~50 ft RA (`fire_warn`) | 152 | 827 | 1500 | 13 | MAN TOGA · SRS · A/THR armed |
| gear up / +climb (`positive_rate_gear_up`) | 158 | 877 | 2000 | 12 | MAN TOGA · SRS · armed |
| 400 ft gate + AP (`four_hundred_ft`) | 163 | 1177 | 2100 | 10 | MAN TOGA · SRS · armed |
| ECAM climb (`four_hundred_ft_cmd`) | 165 | 2300 | 2200 | 9 | MAN TOGA · SRS · armed |
| MAA reached | 175 | 2300 | 400 | 2 | MAN TOGA · SRS · armed |
| V/S 0 level-off (`level_off_maa`) | 185 | 2300 | 0 | 0 | MAN TOGA · V/S · armed |
| green dot / accel clean | 210 | 2300 | 0 | 0 | MAN TOGA · V/S · armed |
| ALT pulled → OP CLB (`pull_alt_op_clb`) | 212 | 2400 | 600 | 3 | MAN TOGA · OP CLB · LVR MCT cue |
| THR MCT + OP CLB (`mct_open_clb`) | 220 | 3500 | 1400 | 5 | THR MCT · OP CLB · A/THR active |

Notes: A/THR **armed (cyan)** from fire warning until MCT engaged, then **active
(green)**. **LVR MCT** flashing white cue (col 1 line 3) after OP CLB selected,
before the live lever reaches MCT. SRS green once fire warning fires.

### 5b. DUAL HYD G+Y SYS LO PR — cruise hydraulic failure
File: the `scenario.meta.slug === "dual-hyd-g-y"` branch in `buildAircraftState`.
Step-gated; FIRE logic untouched. Adds **`vmax`** and **`law`** AircraftState fields.

| Phase / step | speed | alt | vs | tas | vmax | law |
|---|---|---|---|---|---|---|
| cruise (pre-failure) | 265 | 35000 | 0 | 450 | 330 | NORMAL |
| failure (`structural_fail`) | 265 | 35000 | 0 | 450 | 330 | ALTN |
| descent (`start_descent`) FL200 @ 3000 fpm | 290 | 20000 | -3000 | 360 | 330 | ALTN |
| cleared 10000 | 290 | 10000 | -3000 | 320 | 330 | ALTN |
| approach (ALTN) | 180 | 3000 | -700 | 189 | 230 | ALTN |
| L/G DN gravity (`lgr_gravity`) | 160 | 1500 | -700 | 165 | 230 | **DIRECT** |

Notes: **vmax** 330 cruise (above the 265-kt cruise so it isn't falsely red) →
230 approach. **law** NORMAL→ALTN at the failure→DIRECT at L/G DN; DIRECT draws
the amber Xs + **USE MAN PITCH TRIM**. RA shown only < 2500.
Open items to systematise (from the G+Y PFD work): FMA **col-4 CAT capability**
(CAT 2/GLS AUTOLAND INOP → **CAT 1** max + DH/MDA minimum), **armed LOC/G·S blue
2nd line** on approach.

### 5c. The altitude-driven TRANSITION GOVERNOR (LOCKED — the reusable buildup for ALL scenarios)
The single governor that makes speed / altitude / VS behave identically at EVERY
descent, level-off and re-descent. Lives in `buildAircraftState` (driven by the
live displayed altitude `liveAlt`, 4th param); the display loop (`svg-pfd.tsx`)
only rate-limits + renders. **Reuse this verbatim for G+B, EMER ELEC, every new
descent scenario — do not re-invent per segment.** [locked 2026-07-04, verified by sim]

**G1 — VS from altitude-to-go, not a per-step constant.** Each descent step sets a
`selAlt` (target) + `altArmed` + a *schedule* `vs`. The governor then:
```
if (liveAlt != null && vs < 0) {
  // (a) SEGMENT band — ONLY its own leg (gate on selAlt); never bleeds into another
  if (a > 8000 && selAlt >= 10000) { …290/−3000 above 11k → 250/−1500 across 9–11k… }
  // (b) REAL level-off (ALT* → ALT): ramp VS → 0 as it captures the target
  if (altArmed && selAlt != null) {
    const toGo = a - selAlt, cz = Math.max(200, Math.abs(vs)/6);
    if (toGo <= cz) vs = Math.round(vs * Math.max(0, toGo/cz));   // genuine 0 at the level
  }
}
```
So VS **holds a true 0 while level** and **ramps 0 → schedule on the next descent** —
no snap. `cz = max(200, |vs|/6)` is the capture zone.

**G2 — Seamless handoff.** A "continue / configure / hold" step at the same platform
MUST reuse the previous step's `selAlt`+`altArmed`+schedule `vs`, so the governor
output is byte-identical across the handoff (no discontinuity), regardless of when
the crew advances the card. Never hard-set `vs=0` mid-capture (that's the blip). Ex:
`onIls` (configure at 3 700) mirrors `descend3700` (`vs=-1000, selAlt=3700, altArmed`).

**G3 — Band scoping.** A speed/VS band tied to a crossing (the 250-kt/10 000 decel)
applies ONLY to steps whose target is at/above that crossing (`selAlt ≥ 10 000`).
Lower legs (10 000→7 000, 7 000→3 700) use their own gentle step `vs` + the G1
capture — never re-enter the band (that forced −2250 leaving 10 000 = a jump).

**G4 — Display lerp (loop, not logic).** speed ≤ **2.5 kt/s**, VS ≤ **450 fpm/s**
(rate-limited, not proportional); **altitude tracks the actual lerped VS** (60 fpm
floor + 20-ft snap to close a level). Digital VS = lerpVs → tracks the scale for
free. This is the ONLY smoothing layer — the governor sets targets, the loop eases.

**G5 — Physical state ≠ comms.** The stopped/descending PHYSICAL state is driven by a
**physical or live-signal gate** (touchdown at ≤50 ft; full-stop when live speed ≤5 kt
after touchdown) — a comms/consequence card is **gated on** that state, NEVER drives
it. (Coordinate the gate wiring with `scenario-alt-logic`; this skill owns the values.)

**G6 — VLS floor (hard).** The selected/target speed is NEVER commanded below the amber
VLS band: `if (vls != null) speed = Math.max(speed, vls)` (end of the branch). A speed
reduction floors at VLS — never select into the amber. Applies to every scenario.

**G7 — decel ↔ VS coupling (realistic idle descent).** Speed, VS and altitude move IN
COORDINATION: whenever a lower speed is commanded during a descent, the aircraft *shallows
the descent to slow down*, then resumes the schedule once at speed. In the display loop:
```
let effVs = tgtVs;
if (tgtVs < 0) {
  const spdErr = lerpSpd - tgtSpd;                       // >0 while decelerating
  if (spdErr > 0.5) effVs = tgtVs * (1 - Math.min(spdErr/20, 1) * 0.5);  // up to −50% at ≥20 kt
}
lerpVs += sign(effVs - lerpVs) * min(|effVs - lerpVs|, 450/s);            // ramp toward effVs
```
Moderate (−50% max) = realistic idle-descent feel. Naturally: a **gradual band decel**
(lerpSpd keeps up → spdErr≈0 → no cut) is unaffected; a **discrete speed selection**
(lerpSpd lags → large spdErr) gets the coupling. Composes with the G1 capture (tgtVs
already →0 near the level). Altitude tracks the coupled VS, so all three stay coordinated.
Also: the **10 000 decel completes BY 10 000** (band window 10 000–11 500, not 9 000) so
250 kt is set as it passes the limit, VS −3000→−1500 easing across the same window.

---

## 6. Source library

FCOM dump at `~/.claude/manuals/a320/fcom-full.txt`; FCTM at `fctm-full.txt`.

| FCOM section | Owns |
|---|---|
| `DSC-22_30-100` | FMA — 5 columns, 3 lines, colours, special messages |
| `DSC-22_10-40-40` | Primary Flight Display layout |
| `DSC-31-40` | EFIS indicating — PFD/FMA rendering |
| `DSC-22` (FMGS) | AP / FD / A-THR engagement + mode logic |
| `DSC-27-20-20` | Flight control law → PFD (amber X, MAN PITCH TRIM) |

```bash
grep -n "FLIGHT MODE ANNUNCIATOR" ~/.claude/manuals/a320/fcom-full.txt | head
sed -n '37587,37700p' ~/.claude/manuals/a320/fcom-full.txt   # FMA structure
```

---

## 7. Trigger phrases & the reusable-rule mechanism

- **"go"** — approve the rule plan / assessment, proceed.
- **"Apply this PFD rule"** — add ONE value/mode rule for a named condition.
- **"Add condition <x>"** — add a step/phase snapshot to a scenario's model.
- **"New scenario PFD"** — build a fresh `buildAircraftState` branch for a scenario.
- **"new spec"** — restart from intake.

**Apply-everywhere:** when the developer states a behaviour ("in condition X
descend at N fpm", "speed should logically be S here"), capture it as ONE rule in
the relevant model (§5) and apply it through the single `buildAircraftState`
governor — so the same logic is reused across scenarios, never re-invented per
scenario (the same way `atc-comms §0b` applies to every scenario's comms).

Any PFD/FMA change WITHOUT a trigger → return the rule plan, list triggers, ask.

---

## 8. Anti-patterns

- ❌ Inventing FMA modes or values from training data — source FCOM/FCTM.
- ❌ Editing `pfd-mockup.tsx` VS/RA/altitude geometry (that's `pfd-instruments`, LOCKED).
- ❌ Showing AP engaged when AP is INOP for the failure.
- ❌ VMAX barber pole below the phase speed (falsely reddens the tape).
- ❌ FMA vertical mode that contradicts the VS (OP CLB with vs ≤ 0).
- ❌ Amber X / USE MAN PITCH TRIM missing in ALTN/DIRECT law.
- ❌ RA shown ≥ 2500 ft.
- ❌ Touching the FIRE model when changing dual-hyd (keep branches isolated).
- ❌ "Fix all scenarios' PFDs" — one scenario/condition per task.
- ❌ Pinning a step's `vs` through a level-off (§5c G1) — the re-descent snaps.
- ❌ Hard-resetting `vs=0` on a continue/configure step (§5c G2) — the VS blips.
- ❌ Letting a segment band apply to another leg (§5c G3) — wrong/steep rate.
- ❌ A comms card driving the physical PFD state (§5c G5) — it collapses early.

---

## 9. Examples log (self-improving reference)

### [2026-06-24] Skill created — seeded from the two live models
- Codified §5a (single-engine ENG 1 FIRE phase ladder) and §5b (DUAL HYD G+Y
  branch) from the existing `buildAircraftState` / `buildAircraftStateFromPhase`
  in `pfd-nd.tsx` — proven logic, not a rewrite.
- FMA structure from `fcom:DSC-22_30-100` (5 columns / 3 lines / special messages).
- Law indications from `fcom:DSC-27-20-20` (amber X + USE MAN PITCH TRIM).
- Boundary fixed vs `cockpit-ui` (visual) and `pfd-instruments` (LOCKED baseline).
- OPEN to systematise next: G+Y FMA col-4 CAT-capability + DH/MDA minimum, armed
  LOC/G·S blue 2nd line; a descent-start scenario's value ladder.
- File: `.claude/skills/pfd-fma-logic/SKILL.md` (this).

### [2026-07-04] Transition governor LOCKED (§5c) — the reusable speed/alt/VS buildup
Codified from a run of live G+Y fixes (all sim-verified). The class of bug was
always the same: a per-step VS constant that lied about level-offs.
- **FL200 re-descent snapped** — `start_descent` pinned `vs=−3000` through the FL200
  hold (level-off faked by display-scaling; internal lerpVs stayed −3000) → re-descent
  revealed it in one frame. Fix G1: VS from altitude-to-go, real ALT* capture to 0.
- **10 000→7 000 jumped to −2250** — the high-descent band re-applied on a low leg.
  Fix G3: band gated to `selAlt ≥ 10 000`.
- **Configure card VS blip** — `onIls` hard-set `vs=0` mid-capture (gate opens at
  3 800, still descending). Fix G2: `onIls` mirrors `descend3700` → identical governor
  output across the handoff, no discontinuity.
- **Full-stop collapsed early** — `stopped = touched_down || request_taxi_to_stand`
  let a prematurely-available comms card force speed→0 while airborne. Fix G5:
  `stopped = touched_down`; new live-speed `full_stop` gate; taxi call gated on it.
- Display layer (G4): altitude now tracks the actual lerped VS (removed the 2000-fpm
  cap); rate limits speed 2.5 kt/s, VS 450 fpm/s. Removed the redundant loop-level
  ALT* display scaling (governor ramps VS at the logic layer now).
- Boundary: G5 gate WIRING lives in `scenario-alt-logic` (mech 10); this skill owns
  the VS/speed VALUES and the capture math. Rendering (drum roll + fade, tape clip)
  is the SVG-PFD component (cockpit-ui-class), not here.
- **[same day, +coupling] G6 + G7 added.** User: "speed, VS, altitude must work in
  coordination like a realistic idle descent; never select below the amber band."
  G6 = VLS floor on the target speed. G7 = decel↔VS coupling — a commanded speed
  reduction during a descent shallows the VS (−50% max, moderate) then resumes; sim-
  verified (250→210 mid-descent: VS −1500→−750 while slowing → back to −1500 at 210).
  Band decel now completes 290→250 BY 10 000 (window 10 000–11 500). The gradual band
  decel doesn't double-count (lerpSpd keeps up → no G7 cut); discrete selections do.

### [2026-07-02] Standalone SVG PFD — element/layer map ↔ FCOM (standard PFD reference)
A separate presentation artifact — `~/Desktop/dual_hyd_gy_svg_pfd.html` (designer Illustrator
SVG, viewBox `0 0 4111.21 4096`, driven by the G+Y ladder) — is now the **STANDARD A320 PFD**
reused across scenarios. NOT the repo `pfd-mockup.tsx`. Full detail + LOCKED VSC/PXC/MPT/RA
values in memory `reference_aviator_svg_pfd_standard`. Element → FCOM map for future work:

| SVG layer/`#id` | element | FCOM |
|---|---|---|
| `attitude` | sphere, horizon, pitch ladder, roll/bank scale, aircraft-ref wings + `cls-29` **black centre square**, **`cls-25` green FD bars (drawn LAST → on top, centred on the square)** | DSC-31-40 |
| `attitude` `#greenEq`/`#amberX` (bank, static) + `#pitchMarks` (pitch, JS from `PXC`) | protection "=" green (NORMAL) → amber **X** (ALTN/DIRECT); `#ftrim` = USE MAN PITCH TRIM (DIRECT) | DSC-27-20-20 / DSC-31 (5) |
| `airspeed` | `#spdScale`, VMAX barber, VLS, `#spdTarget`, `#spdTrend` | DSC-31-40 |
| `altitude` | `#altScale`, `#altBig` (**right-anchored** so FL350 clears drum), `#altRoll`, `#selAlt` | DSC-31-40 |
| `heading` `#hdgScale` · `ilsdev` `#gsDiamond`/`#locDiamond` · `baro` `#qnh` · `ilsinfo` | tapes/deviation/baro | DSC-31-40 |
| `vsi` | `#vsNeedle` (analog pointer, **ALWAYS shown**, horizontal at datum when 0) · `#vsBox`/`#vsVal` (digital, hundreds fpm, **hidden < 200**) | DSC-31-40 (1)(2) |
| `fma` | `#f11..#f53` (**5 cols × 3 rows, ONE uniform size** — rows differ by COLOUR), white dividers, `#ftrim` | DSC-22-30-100 |

Rules locked here: FMA rows differ by colour not size (uniform 125). USE MAN PITCH TRIM = row 3,
cols 2-3, bounded by the two FULL white dividers; the middle divider stops at row-3 start so text
runs across. VS analog pointer always drawn; digital hides < 200 fpm (DSC-31-40). Green brightened
to **#3ad63a**. **GOTCHA: SVG CSS rules override presentation attributes** — recolour via inline
`style="..."` not `fill=`/`stroke=` (black square + white dividers both hit this). Has a built-in
drag Edit mode (handles P/T/B/L/M/R + Save→JSON) for re-calibration; OFF by default.

### [2026-06-27] Altitude-acquire sequence — OP DES → ALT* → ALT (reusable rule)
FCOM `DSC-22_30-70-65`: **ALT\*** = altitude capture — "guides the aircraft to acquire
the FCU selected altitude… engages when the aircraft reaches the **altitude capture
zone, defined by the aircraft vertical speed**"; once reached, **ALT** (hold) engages.
So descending/climbing toward the FCU selected altitude the FMA goes:
**OP DES (green) + ALT armed (blue) → ALT\* (green, capture) → ALT (green, hold).**
- **Driver = altitude proximity, NOT a step.** Capture depends on the *displayed*
  (lerped) altitude, so it's computed in `drawFMA` (pfd-mockup) reading `d.alt`
  read-only (pfd-instruments stays LOCKED): `altDiff=|d.alt − selectedAlt|`;
  `captureZone = max(150, |VS|/6)` ft [DRAFT — FCOM gives no exact figure]; `altDiff≤20
  → ALT`, `≤captureZone → ALT*`, else `OP DES + ALT armed`.
- **Logic gate = new `altArmed` AircraftState flag** (aircraftState.ts) set by
  `buildAircraftState` only when "descending toward a different FCU alt". Apply-everywhere:
  any future climb/descent to a selected alt just sets `altArmed` + `selectedAlt` and gets
  the full OP DES/OP CLB → ALT* → ALT sequence for free.
- First use: DUAL HYD G+Y **hold** — `holdCleared` (descend to 7 000, OP DES, altArmed,
  vs −1000) → ALT* in the capture zone → `inHold` (ALT, level 7 000). Spans pfd-fma-logic
  (the mode rule + altArmed) + cockpit-ui (drawFMA renders it). VS reads the state −1000
  until the level step — minor, refine later. Files: `pfd-nd.tsx`, `pfd-mockup.tsx`,
  `aircraftState.ts`. tsc clean; LOCAL/uncommitted.

### [2026-07-06] DUAL HYD G+Y approach — reusable PFD rules (marks · SPD-SEL · V/S value · config-driven G/S)
All LOCAL/uncommitted; tsc clean. **Apply-everywhere for G+B and future abnormal approaches.**
- **Characteristic-speed markers follow the FLAP LEVER, not decel speed** (FCOM DSC-22-10-50-20 /
  DSC-31: "appears when the flap SELECTOR is in position"). In `buildAircraftState`: clean → green
  dot (`2×GW+85 = 213`, VFE-next 230) · `flap_1` → **S** (VFE-next 200) · `flap_2/3`+ → **F**
  (VFE-next 185/177). ONE marker at a time; rendered by `drawCharSpeeds` (group **`#charSpd`**) —
  green ○ / green **S,F** = green bar + letter on the BLACK (index) side / amber "=" VFE-next.
  Fields `greenDot/sSpeed/fSpeed/vfeNext` on `AircraftState`.
- **SPD-SEL bug (cyan `selectedSpeed`) = VFE-next − 5** while configuring (195/180/165), NOT the
  actual speed → `selectedSpeed: selSpd ?? speed`. The bug leads; the yellow index decelerates to it.
- **FMA annunciates the V/S VALUE** (FCOM DSC-22-30-70-80: "the FMA displays 'V/S = …'"): `drawFMA`
  shows **"V/S −xxx"** green (+ ALT armed blue) when V/S mode is engaged.
- **Config-driven G/S geometry ("horizontal DME"):** a pure alt→DME map CANNOT close range on a
  LEVEL segment. Compute DME in `pfd-nd` (it knows the flap/gear steps) → new **`dme`** `AircraftState`
  field → `svg-pfd drawILS` uses it (readout + diamond agree). Descent: `DME=f(alt)` (30@7000, 22@5000).
  **Level at the platform: DME closes with the ACTION progression** — flaps close the DECEL miles,
  THEN the GEAR closes its own miles (allocate separately; the gravity gear needs time before the
  glide). Below platform: true 3° `(alt-39)/318`. `gsDev=(39+DME·318 − alt)/(DME·37)`, fly-up only →
  the diamond CREEPS from ~dots-up to captured AS you configure. Files: `pfd-nd.tsx`, `svg-pfd.tsx`.

### [2026-07-06] DUAL HYD G+Y — FMA capture, double-ALT, and the speed-trend vector
All LOCAL/uncommitted; tsc clean; harness-verified. Apply-everywhere for G+B and future approaches.
- **ALT\* capture zone is V/S-SIZED (FCOM DSC-22-30-70 / DSC-31-40):** "the mode engages when the
  aircraft reaches the altitude capture zone, defined by the aircraft vertical speed." Implement as
  `cz = max(150, |vs|/6)`; annunciate **ALT\*** on entering `cz` below the FCU target, **ALT** at
  `ad ≤ 20 ft`. A capture LATCH holds ALT\* → ALT and does NOT revert until a genuinely new target
  (selectedAlt change or `ad > cz + 200`) — this kills the ALT\*/ALT flicker at EVERY level-off
  (FL200 / 10 000 / 7 000 / 5 000). Inhibits: not below 400 ft in TO/GA; 3 s after an FCU alt change.
- **NEVER show ALT green + ALT armed-blue together (double-ALT).** Root cause seen at 7 000: the
  `atHold7000` phase set `vertMode = "ALT"` while `altArmed` true, but its gate fires at 7 600 so the
  aircraft is STILL DESCENDING when entered → the un-captured latch shows `vertMode`("ALT", green) AND
  the armed "ALT" (blue). FIX = a phase entered while still descending must carry the DESCENDING mode
  (**OP DES / V/S**), not "ALT"; the latch then does OP DES → ALT\* → ALT. + GUARD in `drawFMA`:
  `showAltArmed = captureLatch === 0 && vertMode !== "ALT"`.
- **SPEED-TREND VECTOR (FCOM DSC-31-40 item 2 — yellow):** "starts at the speed symbol; the tip is the
  speed reached in 10 s at constant acceleration. **Appears when > 2 kt, disappears when < 1 kt**"
  (a HYSTERESIS band — not one threshold — plus it disappears if the FACs fail). Implement with a
  `trendShown` latch (`>2 → show`, `<1 → hide`). Draw the tip from a CONTINUOUSLY-eased value (not
  `round(trend)` — integer knots snap in ~25 px steps). Asymmetric ease for feel: grow fast, retract
  slow (user-dialled grow k≈1.4, retract k≈0.45, EMA factor 0.05 → gentle both ways). Arrowhead points
  UP accelerating / DOWN decelerating (`dir = trend > 0 ? 1 : -1`). Slider tuner: scratchpad `trend_tuner.html`.
