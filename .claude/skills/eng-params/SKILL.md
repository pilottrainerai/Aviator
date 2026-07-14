---
name: eng-params
description: MASTER skill for A320 ENGINE INDICATIONS in Aviator — the single source for what N1 / EGT / N2 / FF / thrust-rating each engine shows, given the thrust mode (TOGA/FLX/CLB/MCT/IDLE), the FMA/vertical mode, the flight phase, and the engine's health (running / idle / windmilling / secured). Use BEFORE touching any engine gauge value, the E/WD engine cluster, the ENG SD page, phase-engine-values.ts, ewd-gauges.tsx, or a scenario's engineDisplay/systemTabs ENG block. It owns the per-engine model — eng 1 and eng 2 are SEPARATE — and the failed-engine spool-down (symmetric → THR IDLE → MASTER OFF windmill). Manual-first: N1 traces to FCOM thrust tables; EGT/N2/FF are representative CFM56-5B responses tagged DRAFT (SME). Sibling of pfd / ecam-ewd / ecam-sd; composed by a320-eng-fire.
---

# ENG PARAMS — the A320 engine-indication governor

What the engines **show**, and why. The PFD skill owns the flight instruments; this skill
owns the **engine numbers**: the E/WD upper gauge cluster (N1/EGT/N2/FF + thrust rating) and
the ENG SD page. It is the brain the fire/failure scenarios call to answer "what should each
engine read right now?"

- Data constant: `src/components/cockpit/phase-engine-values.ts` (`PHASE_ENGINE_VALUES`).
- Renderer + helpers: `src/components/cockpit/ewd-gauges.tsx` (`eng()`, `phaseEngine()`, `useSpool()`).
- Per-scenario overrides: `scenario.engineDisplay` (E/WD cluster) + `scenario.systemTabs` ENG (SD page).
- Vault reference: `Aviator/wiki/ewd-phase-engine-values.md` (the phase table + FCOM sourcing).

---

## §0 — Hard rules (non-negotiable)

1. **eng 1 and eng 2 are SEPARATE.** Never drive both from one value set. Normal ops = they
   happen to be equal; the moment one fails they diverge, and the model must express each
   independently. In `engineDisplay` this is `eng1.rows` vs `eng2.rows`; each row is `when`-gated.
2. **N1 is FCOM-anchored; EGT/N2/FF are representative.** N1 comes from the FCOM 2021 N1 MODE
   THRUST CONTROL tables (MAX CLIMB / MAX CRUISE) + TOGA/idle. EGT/N2/FF are **not** FCOM-tabulated
   per phase — they are live engine responses, scaled off N1 and tagged **DRAFT (SME review)**.
3. **Thrust RATING ≠ A/THR mode.** The E/WD shows the **rating limit** (TOGA/FLX/MCT/CLB) — with
   levers in the CL detent it reads **CLB** from climb through approach. The **A/THR mode**
   (SPEED / THR IDLE / MACH) lives on the **PFD FMA**, not here. Do not conflate. (See `pfd` §4.)
4. **A fire is not an exceedance.** At an ENG FIRE the running engine's params stay **normal and
   symmetric** — there is no firm indication EGT/N1 rise (depends on fire type). Do NOT paint a
   red exceedance at the fire. The only fire cue on this cluster is the **STATUS = FIRE** flag +
   the red section highlight. Divergence begins only when thrust is pulled. [user 2026-07-11]
5. **NAC (nacelle temp) is a separate engine page** — not on this cluster. Not built yet; defer.
6. **One scenario / one engine event per task.** Never "fix all engine values."
7. **No app code before the trigger** (§8). Producing the value table / assessment is always
   allowed; editing `.ts` waits for "go". (Editing THIS skill or the vault is not app code.)

---

## §1 — The five indications and their drivers

| Indication | Unit | Driver | FCOM basis |
|---|---|---|---|
| **N1** | % | Thrust **rating** (TOGA/FLX/CLB/MCT) or A/THR demand; falls to idle→windmill on shutdown | N1 MODE THRUST CONTROL tables |
| **EGT** | °C | Follows N1 (combustion temp); red only on real exceedance/start | limit = CFM56-5B; scaled off N1 |
| **N2** | % | Core speed, tracks N1 (higher, flatter) | scaled off N1 |
| **FF** | kg/h | Fuel flow, tracks N1; **0 at MASTER OFF** (fuel cut) | scaled off N1 |
| **Thrust rating** | — | The active limit mode (TOGA/FLX/MCT/CLB), NOT the A/THR mode | levers/detent |

Scaling in code (`eng(n1)`): `EGT = 380 + (n1−35)·4.6`, `N2 = 66 + (n1−35)·0.57`,
`FF = 250 + (n1−35)·20`. Good enough for the mid-range; **EGT under-reads at high N1**
(gives ~626 at N1 88.5 vs the ~673 seen on real frames) — tune per SME.

---

## §2 — N1 by thrust rating / phase (the baseline, both engines equal)

From `PHASE_ENGINE_VALUES` (vault-sourced). Both engines equal in normal ops:

| Phase | Rating | N1 % | EGT °C | N2 % | FF kg/h |
|---|---|---|---|---|---|
| Takeoff (MTOW) | TOGA | 95 | 750 | 98 | 2500 |
| Climb | CLB | 88 | 700 | 96 | 2100 |
| Cruise (FL350) | CLB | 84 | 600 | 94 | 1150 |
| Descent | IDLE | 35 | 380 | 68 | 300 |
| Landing (MLW) | IDLE | 35 | 400 | 70 | 350 |

**Reference-frame anchors** (real ENG 1 FIRE frames, ~60 t, low level — use these for the fire scenario):
- Climb / CL 88.5% rating: **N1 77.5 · EGT 603 · N2 90.0**
- Live engine at **MCT** after the failure: **N1 88.5 · EGT 673 · N2 94.0**

---

## §3 — Thrust rating / FMA vertical mode → N1 (what the user asked)

`phaseEngine(vertMode, liveAlt, targetAlt)` maps the PFD's vertical mode to a live N1:

| FMA vertical mode | Engine state | N1 |
|---|---|---|
| SRS / CLB / OP CLB | climbing at CLB rating | ~89 |
| ALT / level (at target) | cruise thrust, altitude-scaled | 84 % @ FL350 → ~55 % low |
| OP DES (>150 ft above target) | idle-thrust descent | 35 (rating still CLB) |
| G/S (final, CONF 3) | approach thrust | ~52 |

Rule: **the vertical mode tells you whether the engine is spooled up (climb), coasting
(level/descent), or at idle.** The rating **limit** shown stays CLB with levers in CL; only
the live N1 moves. On the PFD side this must stay consistent with the FMA (`pfd` §4) — if the
FMA says OP CLB, the engines must read climb N1, not idle.

---

## §4 — Per-engine divergence: the failed-engine spool-down (the core case)

An ENG FIRE / FAILURE is where the two engines split. The sequence, gated by scenario step:

| Point | Failed engine (eng 1) | Live engine (eng 2) | β / handling |
|---|---|---|---|
| Fire warning | **normal, = eng 2** (N1 77.5 · EGT 603 · N2 90 · FF nom) | normal, CLB | none — symmetric |
| **THR LEVER 1 → IDLE** | spools to **flight idle** (N1 ~30 · N2 ~58 · FF ~600 · EGT cooling) | unchanged | ⭐ asymmetry starts → **β appears** |
| **ENG MASTER 1 → OFF** | fuel cut → **windmilling** (N1 ~22 · N2 ~18 · **FF 0** · EGT → TAT) · STATUS SHUT DOWN | advanced toward **MCT** | engine secured; single-engine |
| Live engine to MCT | windmilling | **MCT: N1 88.5 · EGT 673 · N2 94** | EO climb; green-dot EO speed |

**FCOM basis (perf EFB-IFT-30-00022572/573):** EO ceiling is held with *"the operating engine
at Maximum Continuous Thrust and the failed engine in windmilling"*; standard EO holding speed
in CONF CLEAN = **green dot**. So: failed = windmill (not "0.0", not "XX" *while data is valid*),
live = MCT. The smooth transition is free — `useSpool()` eases each number to its target (~3.5 s
time-constant), so setting the discrete `when`-target makes the gauge wind down like a real engine.

**FIRE pb → amber XX (data invalid).** The ENG FIRE pb **cuts off the FADEC power supply** (FCOM
DSC — "Cuts off the FADEC power supply"; L44410). The FADEC computes N1/N2/EGT/FF, so once its
power is gone there is NO valid data → each parameter shows **amber "XX"**. Timeline: THR IDLE →
decaying (valid), MASTER OFF → windmill (valid, FADEC still powered), **FIRE PB → "XX" (FADEC
cut)**. Set the affected engine's N1/N2/EGT/FF `states` first entry to
`{ when:{step:"eng1_fire_pb"}, value:{v:"XX", c:"amber"} }`. STATUS stays "SHUT DOWN" (not a FADEC
param). **Correct display** (verified vs the V-PREP ENG-fire reference, `eng-1-fail/snaps/fail-10`):
the round gauge (N1, EGT) shows **amber "XX"**, the **arc turns AMBER**, and the **needle + red
overspeed segment DISAPPEAR** — not a needle parked at idle. `ewd-gauges.tsx` gates this on
`!isFinite(+val.v)` per gauge (`n1LX`/`egtLX` …). N2/FF are digital → amber XX text only. [user 2026-07-12]

Windmill/idle numbers are **DRAFT (SME)** — the shape (which drops, when, to roughly what) is
FCOM-correct; the exact figures need sign-off. Colour: keep the failed engine's valid readouts
plain (they are not exceedances); use amber only where the sim convention flags the dead engine.

---

## §5 — Code map (where each rule lives)

- **Baseline phase values** → `phase-engine-values.ts` `PHASE_ENGINE_VALUES` (edit here for a
  whole-phase change; mirror to vault `wiki/ewd-phase-engine-values.md`).
- **Live vertMode→N1** → `ewd-gauges.tsx` `phaseEngine()` (dual-hyd path; symmetric).
- **Scaling** → `ewd-gauges.tsx` `eng(n1)`.
- **Smooth spool** → `ewd-gauges.tsx` `useSpool()` — already eases; just set the target.
- **Per-engine scenario values** → `scenario.engineDisplay.eng1.rows` / `eng2.rows`
  (E/WD cluster) + `scenario.systemTabs` ENG section rows (SD page). Each row = `states[]`,
  first matching `when: {step|trigger}` wins, last bare `value` = default. **Keep the two blocks
  in sync** — the same param appears in both.
- Fire scenario: `src/scenarios/data/eng1-fire-after-v1.ts`.

---

## §6 — Consistency checks (run before declaring done)

1. **Symmetric at the fire?** eng 1 == eng 2 for N1/EGT/N2/FF until `thr_lever_idle`. No red
   exceedance on any param (STATUS FIRE is the only cue).
2. **Divergence gated at THR IDLE, deepened at MASTER OFF?** Not before.
3. **FF = 0 only at MASTER OFF** (fuel cut), not at the fire.
4. **Live engine reaches MCT** after the good lever is advanced (`mct_open_clb`).
5. **E/WD cluster and ENG SD page agree** for the same param.
6. **Thrust rating shown = limit mode** (CLB with levers in CL), not the A/THR mode.
7. **PFD FMA ↔ engine N1 consistent** (climb mode ⇒ climb N1).

---

## §7 — When to use / trigger phrases

Use for anything about **what the engines read**: "engine parameters", "N1/EGT/N2/FF",
"E/WD gauges", "ENG page/SD", "thrust rating", "spool-down", "windmill", "failed engine
values", "eng 1 vs eng 2 asymmetry", "engine values by phase / FMA / V/S".

Composed by **`a320-eng-fire`** (the fire brain hands the engine-number layer here). Siblings:
**`pfd`** (flight instruments + FMA + β), **`cockpit-ui`** (rendering geometry), **`ecam-ewd`/
`ecam-sd`** (the E/WD/SD layout & memo). This skill owns the *values*; those own the *layout*.

**No app code before "go"** — but scaffolding this skill + the value table is always allowed.
