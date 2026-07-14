---
name: ecam-ewd
description: MASTER skill for the A320 E/WD (Engine/Warning Display, upper ECAM) in Aviator — how the engine cluster and warning/memo area PERFORM, LOOK, what they DISPLAY and HOW. Owns the DISPLAY (gauges, arcs, red lines, colour logic green/amber/red/XX, ADV pulse, digital boxes, slat/flap, warning tree, memo, engine controls & indications DSC-70/DSC-77). Use BEFORE touching ewd-gauges.tsx / ewd-display.tsx layout, geometry, colours, red lines, gauge behaviour, the warning/memo tree, or a scenario's engineDisplay presentation. It does NOT own the NUMBERS (that's `eng-params`) or the flight instruments (`pfd`). Manual-first: every element traces to FCOM DSC-77 (Engine Indicating) / DSC-70 (Power Plant controls). Sibling of pfd / eng-params / ecam-sd; composed by a320-eng-fire. Vault reference: Aviator/displays/EWD.md.
---

# ECAM E/WD — the A320 Engine/Warning Display governor

What the upper ECAM **shows and how it behaves**. Split of ownership:
- **`eng-params`** owns the NUMBERS — what N1/EGT/N2/FF/thrust-rating each engine reads. Call it for values.
- **THIS skill (`ecam-ewd`)** owns the DISPLAY — gauges vs digital, arcs, red lines, the colour/state logic
  (green→amber→red, XX, ADV pulse, fluctuation), the slat/flap indicator, and the warning/memo tree.
- **`cockpit-ui`** owns pixel geometry copied from the reference artwork. **`pfd`** owns the flight instruments.

- Code: `src/components/cockpit/ewd-gauges.tsx` (engine cluster + slat/flap), `ewd-display.tsx` (warning/memo tree).
- Values in: `eng-params` → `phase-engine-values.ts` + `scenario.engineDisplay` / `systemTabs` ENG.
- Vault reference (faults + backlog + FCOM map): `Aviator/displays/EWD.md` + `EWD-faults-and-changes.html`.

---

## §0 — Hard rules (non-negotiable)
1. **Values come from `eng-params`; THIS skill only decides how to DRAW them.** Never invent N1/EGT numbers
   here — read them from the engine model, then apply the display logic (gauge position, colour, red line).
2. **Colour = the parameter vs ITS OWN limit**, not the phase. green = normal · **amber** = advisory/caution
   band or FADEC-degraded · **red** = past the red line · **XX** (amber) = FADEC data lost (arc amber, needle
   + segment gone). One param can be red while the others are green. (FCOM DSC-77 colour philosophy.)
3. **A FIRE is not an exceedance** (mirrors `eng-params` §0.4): at the fire the running engine's params stay
   **normal + symmetric** — no red paint on the cluster. Divergence begins only when thrust is pulled → then
   MASTER OFF → **XX** on all four + arcs amber. [user 2026-07-11]
4. **EGT is the only redline that may be exceeded briefly** (FCOM/eng-malfunctions): draw its red line but a
   short overshoot is amber-pulse + ADV, not an instant hard fault. **N1/N2 past the red line = always a
   malfunction** → red immediately.
5. **Reference-first geometry** — arcs/needles/boxes come from the E/WD reference artwork (cockpit-ui), copy
   exact coords; don't invent. [[feedback_verify_against_reference_not_proxy]].
6. **One display change per task; no app code before the trigger** (§9). Editing this skill / the vault is fine.

---

## §1 — Layout (two zones, FCOM DSC-31-15 / DSC-77)
- **Top ~58 % = ENGINE CLUSTER + slat/flap** (`ewd-gauges.tsx`): N1 · EGT · N2 · FF gauges/boxes, thrust
  rating + FOB, and the slat/flap indicator on the right.
- **Bottom ~42 % = WARNING / MEMO** (`ewd-display.tsx`): the ECAM warning tree on a failure (primary title +
  action lines + secondaries), else the state-driven MEMO. Two columns per FCOM (left = primary+actions/memo).

## §2 — The engine cluster elements (how each DISPLAYS)
| Element | How it's drawn | Colour states | Status |
|---|---|---|---|
| **N1** | analog **arc + needle** + digital box; red line at the limit; (blue command bug — to add) | green · amber band · **red** past line · **XX** (arc amber, needle+segment gone) | ✅ built |
| **EGT** | **digital only today → must become an analog arc+needle+red line** (biggest gap) | green · amber (advisory) · **red** past line (pulses, briefly OK) · **XX** | ⚠️ upgrade |
| **N2** | digital box | green · **XX** on FADEC loss · red past line | ✅ built |
| **FF** | digital box (kg/h); **0 at MASTER OFF** (fuel cut) | green · **XX** | ✅ built |
| **Thrust rating** (TOGA/FLX/MCT/CLB) + **FOB** | digital | white/green | ✅ built |
| **OIL** (QTY qt · PRESS PSI · TEMP °C) | to add | PSI amber/red when low + ADV | ❌ add |
| **VIB** (N1 / N2) | to add | amber over threshold + ADV | ❌ add |
| **Slat/Flap** | S/F index + boxes + CONF figure; **smooth RAF transit** (not a snap) | green reached · **cyan** in transit · amber on fault | ✅ built |

## §3 — State/behaviour logic (the "how they perform")
- **XX on FADEC loss** (after FIRE pb / master off): each param → amber **XX**, the arc goes amber, needle +
  red segment DISAPPEAR (matched to the ENG-fail reference frames). Owned here; values say "- -".
- **ECAM ADVISORY (pulse)** — a pulsing **green box** around a param that crosses its advisory threshold
  (EGT / VIB / OIL). Generic mechanism; **to build** (HIGH). FCOM/eng-malfunctions §II–IV.
- **Fluctuation** — STALL/SURGE ⇒ rapidly fluctuating N1/N2/EGT (not steady). Model as jitter; **to build**.
- **Red line + amber band** — draw the limit mark on N1/EGT/N2; colour the value/needle vs it. **to build**.
- **Command bug** — blue commanded-N1 bug/donut on the N1 arc (A/THR demand vs delivered). **to build**.

## §4 — Engine fault → display (the survey — full table in the vault [[displays/EWD]])
FIRE (params normal→XX after secure, title→amber ENG SHUT DOWN) · FAIL/FLAMEOUT (N1/EGT/FF drop) ·
STALL/SURGE (fluctuating N1/N2, EGT→red) · EGT OVERLIMIT (EGT red pulse + ADV) · N1/N2 OVERSPEED (param red) ·
OIL LO PR (needs OIL block) · HIGH VIB (ADV + needs VIB block) · START FAULT (start-EGT limit, IGN A/B) ·
REVERSER (needs REV legend) · ENG SHUT DOWN (all XX, arcs amber, secondaries below). **FCOM cues:** low
N1/EGT = flameout · fluctuating N1/N2 = stall · EGT the only occasionally-exceedable redline.

## §5 — Warning / MEMO tree (`ewd-display.tsx`)
- **Primary failure title** = coloured + **UNDERLINED, NOT boxed** (ENG 1 FIRE red+underlined). [user 2026-07-09]
- **ENG n SHUT DOWN** = **AMBER, WHOLE title BOXED** (Bond ref, user 2026-07-12).
- **Special lines** (LAND ASAP, AUTO FLT AP OFF) = coloured text, NOT boxed; system prefix underlined.
  LAND ASAP **downgrades red→amber at `fire_extinguished`**; acknowledged after all action lines.
- **Action lines** auto-clear as done; overflow past the fold = green **↓** arrow. When clean → state MEMO.
- Clear order for secondaries = E/WD display order (**HYD→ELEC→AIR BLEED**); CLEAR ENG 1 SHUTDOWN first.

## §6 — Engine CONTROLS & INDICATIONS (DSC-70) — the operating context
The cluster reflects these controls (mostly on the pedestal/overhead; some are 3D panels):
- **ENG MASTER 1/2** (ON/OFF) — OFF cuts fuel → FF 0, spool-down/windmill; drives the SHUT DOWN state.
- **ENG MODE selector** (CRANK / NORM / IGN-START) — start/relight; IGN → start EGT limit + IGN A/B.
- **ENG FIRE pb** — arms agents, closes the LP fuel/hyd/bleed valves → the secondary failures (HYD/ELEC/BLEED).
- **Thrust levers** (IDLE/CL/FLX/MCT/TOGA detents) — set the RATING shown; reverser on the ground.
- Indications proper (DSC-77): the four params + FOB + rating; advisory; oil/vib (to add).

## §7 — Backlog (build order — from [[displays/EWD]])
HIGH: **EGT analog gauge + red line** · **ADV pulse** · red-lines/amber-bands on N1/EGT/N2.
MED: OIL block · VIB block · N1 command bug · fluctuation model.
LOW: reverser REV legend · start indications (IGN/start-EGT) · nacelle temp.

## §8 — Code map
| Concern | Where |
|---|---|
| Engine cluster + slat/flap render | `ewd-gauges.tsx` (`SlatFlap`, `eng()`, `phaseEngine`, `useSpool`) |
| Warning/memo tree | `ewd-display.tsx` |
| Values (numbers) | `eng-params` → `phase-engine-values.ts` + `scenario.engineDisplay` |
| Colours | `SYSCOL` in `ewd-gauges.tsx` (green #5aba47 · amber #e8a13a · red #ed1e24 · cyan #2dc3e8) |

## §9 — When to use / triggers
Read this skill before: changing an E/WD gauge's LOOK/behaviour, adding a param (EGT gauge, OIL, VIB), red
lines, ADV pulse, the warning-tree presentation, or how a fault DISPLAYS. For the NUMBERS use `eng-params`;
for geometry copied from art use `cockpit-ui`. Producing a spec/table is always allowed; **`.ts` edits wait
for "go"**. Update this skill + [[displays/EWD]] whenever a display rule is confirmed.
