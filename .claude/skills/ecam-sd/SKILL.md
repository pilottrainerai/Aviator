---
name: ecam-sd
description: MASTER skill for the A320 SD (System Display, lower ECAM) in Aviator — how the system synoptic pages LOOK, what they DISPLAY, WHICH page appears WHEN (the failure→page auto call-up + flight-phase logic), and HOW each system reflects a failure and its SECONDARY failures. Owns the SD pages (ENGINE/BLEED/PRESS/ELEC/HYD/FUEL/APU/COND/DOOR/WHEEL/F·CTL + STATUS + CRUISE), their card-driven sequencing, the per-system secondary-failure depiction rules, the shared live permanent strip, and the SVG-build playbook. Use BEFORE touching any *-sd-page.tsx, public/models/sd-*.svg, sd-permanent-strip.tsx, status-panel.tsx, or the runner's SD-slot page-selection logic. Manual-first: every page/colour/trigger traces to FCOM DSC-31 (EIS/ECAM) + the owning system chapter (DSC-21/24/27/28/29/36/70/77). Sibling of pfd / ecam-ewd / eng-params; composed by a320-eng-fire. Vault reference: Aviator/displays/SD.md.
---

# ECAM SD — the A320 System Display governor

What the **lower ECAM** shows: one **system synoptic** at a time, auto-called by the failure/flight-phase,
each reflecting the failure and its knock-on **secondary failures**, over a permanent bottom strip.

Ownership split:
- **THIS skill (`ecam-sd`)** — the SD pages, WHICH page shows WHEN, the failure→page interconnect, per-system
  secondary-failure depiction, the shared permanent strip, and the SVG build/render.
- **`ecam-ewd`** — the UPPER ECAM (E/WD): engine cluster, warning/memo tree. Crosses (XX) live THERE, not here.
- **`eng-params`** — the engine NUMBERS. **`pfd`** — flight instruments. **`a320-fcom-trainer`** — procedure/ECAM
  tree + FCOM fidelity. **`training-card-ui` / scenario data** — the ECAM cards the SD sequences against.

- Code: `src/components/cockpit/{engine,fuel,hyd-eng1,elec,wheel,cruise}-sd-page.tsx` · `hyd-sd-page.tsx`
  (G+Y dual) · `status-panel.tsx` · `sd-permanent-strip.tsx`. Static SVGs: `public/models/sd-*.svg`.
- Page selection: the SD-slot block in `src/app/train/[slug]/runner.tsx` (~L1067).
- Vault reference (per-page FCOM map + failure states + build log): `Aviator/displays/SD.md` + `displays/assets/sd/`.

---

## §0 — Hard rules (non-negotiable; the expensive lessons)

1. **NO CROSSES (XX) ON THE SD MAIN PARAMS.** [user 2026-07-14] Amber "XX" crossing out engine params is an
   **E/WD-only** thing. On the SD, the affected engine keeps showing VALUES. The ONLY legitimate cross is a
   dead pneumatic/param source, e.g. the ENGINE-page **start-air PSI = XX** on the secured side. Never mirror
   the E/WD's whole-column XX onto the SD.
2. **A FIRE IS NOT AN ENGINE FAILURE.** [user 2026-07-14] At the fire the engine still runs → the SD shows it
   NORMAL. The affected values only **come DOWN after THR LEVER → IDLE** (gate the "secured" look on the
   `thr_lever_idle` step, not on the fire). Mirrors `ecam-ewd §0.3` / `eng-params §0.4`.
3. **REFERENCE-FIRST, then MIRROR to the affected side.** Build from the designer SVG (`displays/assets/sd/`)
   or the user's reference image — copy geometry/values, don't invent. The user's failure photos show **ENG 2**
   failed (GEN 2 / ENG 2 bleed / YELLOW pump); our scenarios are **ENG 1** → mirror everything to the **LEFT /
   GREEN** side. [[feedback_adapt_gy_dont_invent]] · [[feedback_verify_against_reference_not_proxy]].
4. **WHICH PAGE, WHEN = FCOM auto call-up (§2), driven by the active CARD (§4).** The SD is never blank in
   flight — it always shows the failure page, or STATUS, or the flight-phase page. Don't leave it blank.
5. **ONE shared LIVE permanent strip (§6).** All pages show the SAME TAT/SAT/UTC/GW; **GW is live and reduces
   with fuel burn**. Never bake divergent per-page strips — that breaks sync. Crop each SVG above its strip line.
6. **Verify the render IN-APP (`<img>` / inline), not by opening the raw SVG URL** — Chrome's direct-SVG viewer
   ignores the viewBox crop and shows the full doc, which lies about what the app renders.
7. **Manual-first + one change per task.** Procedure/failure content needs FCOM + SME. Editing this skill / the
   vault is always fine; app code is gated (§9).

---

## §1 — The SD family (FCOM DSC-31-20)

12 system pages + STATUS + CRUISE. Built state for Aviator (ENG 1 FIRE):

| Page | FCOM | Built? | Component |
|---|---|---|---|
| **WHEEL** | DSC-32 | ✅ | `wheel-sd-page.tsx` (`sd-wheel.svg`) — opening page |
| **ENGINE** | DSC-70/77 | ✅ | `engine-sd-page.tsx` (inline, `secured` prop) |
| **FUEL** | DSC-28 | ✅ | `fuel-sd-page.tsx` (`sd-fuel.svg`) |
| **HYD** | DSC-29 | ✅ | `hyd-eng1-sd-page.tsx` (inline). Also `hyd-sd-page.tsx` = G+Y dual |
| **ELEC** | DSC-24/36 | ✅ | `elec-sd-page.tsx` (`sd-elec.svg`) |
| **CRUISE** | DSC-31 | ✅ | `cruise-sd-page.tsx` (`sd-cruise.svg`) — after ECAM |
| **STATUS** | DSC-31 | ✅ | `status-panel.tsx` |
| **BLEED** | DSC-36 | ⏳ | needs SVG — pops @`clear_air_bleed` |
| PRESS/APU/COND/DOOR-OXY/F·CTL | DSC-21/27/49 | 🗂 SVGs captured (`assets/sd/`), not built |

Common geometry: bottom **permanent strip** (TAT/SAT · UTC · GW), title = underlined white caps top-left, units
**cyan**, live values **green** (amber/red on fault), fixed labels **white**, Futura font, ~4096² grid.

---

## §2 — WHICH page, WHEN: automatic call-up (FCOM DSC-31-20)

The SD picks a page three ways, in priority:

1. **Failure-related (top):** the affected-system page appears **AS SOON AS** the fault triggers its
   caution/warning — **simultaneous with the E/WD alert**, and it **overrides** a manually-selected page.
2. **Advisory:** the page appears when a parameter **drifts out of range**; the green value **pulses**.
3. **Flight-phase / mode** (if nothing above): the SD shows the **phase page**:
   - **DOOR/OXY** = Phase 1 (elec power on, **before 1st engine start** — at the gate).
   - **WHEEL** = Phases 2–5 (engine start → taxi → **takeoff roll → liftoff**) and 9–10 (approach/landing).
   - **CRUISE** = cruise phase (leveled off) — compact ENG + AIR summary.
   - **ENGINE** auto at start-sequence/CRANK, gone 10 s after start when ENG MODE → NORM.
- **STATUS** appears when ECAM actions are done (recallable any time via STS pb). Full logic → `displays/SD.md §2d`.

**Fuel-leak exception:** a fuel leak has NO auto-ECAM (QRH FUEL LEAK) → the crew **manually selects** the FUEL
page. The FUEL page only *auto*-appears for a real fuel fault (pump / X-FEED / LO LVL).

---

## §3 — Failure → page SEQUENCE (interconnect logic). Worked example: ENG 1 FIRE

A failure "spreads" to the secondary systems as the drill secures the engine; the SD auto-calls each in turn:

```
WHEEL (takeoff, on ground, before fire)                       ← flight-phase (§2.3)
  → fire triggers → ENGINE (secured engine; comes down after THR IDLE)   ← failure page (§2.1)
  → IMBALANCE MONITOR card → FUEL   (ENG 1 tank higher, PTU? no — fuel imbalance)
  → CLEAR HYD card         → HYD    (GREEN eng-1 pump LO, PTU repressurises → pressures NORMAL)
  → CLEAR ELEC card        → ELEC   (GEN 1 offline, bus tie feeds AC 1, GALLEY SHED)
  → CLEAR AIR BLEED card   → BLEED  (ENG 1 bleed lost)                    [⏳ page TBD]
  → ECAM actions done      → STATUS (INOP SYS / limitations)
  → ECAM COMPLETE          → CRUISE (single-engine hold to burn below MLW)
```
The **secondary failures of an ENG 1 shutdown** (from STATUS INOP): `G ENG 1 PUMP` (HYD) · `GEN 1` (ELEC) ·
`ENG 1 BLEED` (BLEED) · `PACK 1` · `WING A.ICE`. Each drives the corresponding page's depiction (§5). For a
different failure, derive its own sequence from the ECAM procedure's CLEAR list + STATUS INOP.

---

## §4 — Card → page WIRING (runner SD-slot pattern)

The runner selects the page from scenario state — trigger fired, active step, status-ready. Canonical
`eng1-fire-after-v1` mapping (`runner.tsx` ~L1067):

| Condition | Page |
|---|---|
| `completedSteps["crew_crosscheck"]` (ECAM COMPLETE) | `CruiseSdPage` |
| `!triggersFired["fire_warn"]` (before fire) | `WheelSdPage` |
| `primaryNextStep.id === "sd_imbalance"` | `FuelSdPage` |
| `primaryNextStep.id === "clear_hyd"` | `HydEng1SdPage` |
| `primaryNextStep.id === "clear_elec"` | `ElecSdPage` |
| `isStatusReady(...)` | `StatusPanel` |
| else (fire active) | `EngineSdPage secured={!!completedSteps["thr_lever_idle"]}` |

Rules: gate the failure page on the trigger (fires simultaneously, §2.1); gate consequential pages on the
matching **CLEAR** card (`primaryNextStep.id`); STATUS on `isStatusReady`; CRUISE on ECAM-complete. Always wrap
the selection in a flex column with `<SdPermanentStrip …/>` below (§6).

---

## §5 — Per-system SECONDARY-FAILURE depiction rules

How each page shows a lost/degraded system. Mirror the reference to the AFFECTED side (§0.3).

### ENGINE (DSC-70/77) — the secured engine
- **Two states via `secured` prop** (gated on `thr_lever_idle`). Running: BOTH engines normal (OIL PSI 38,
  VIB 0.5/0.6, start-air 45 green, no XX). Secured: ENG 1 comes DOWN.
- **OIL PSI:** value 38→**15 amber**; the green analog **pointer swings to the LOW/red end + turns amber**
  (don't leave it at the high position — the gauge must visibly come down with the value).
- **VIB** 0.5→0.1; **F.USED**: ENG 1 freezes → reads LOWER than ENG 2 (which keeps burning, e.g. 3111 vs 3210).
- **start-air PSI = amber XX + amber valve** (the ONLY cross, §0.1). Main params stay VALUES.

### FUEL (DSC-28)
- **Pumps = GREEN in-line when running** (an ENG fire doesn't stop the fuel system). FCOM pump symbol:
  **in-line green** = on + normal · **amber cross-line** = pb OFF · **amber "LO"** = pb on but low pressure.
- **Imbalance monitoring:** the shut-down engine's wing tank stays **HIGHER** (its engine isn't drawing) — e.g.
  ENG 1 off → LEFT inner tank higher (3315) vs RIGHT (2945). FOB/F.FLOW = in-flight values.

### HYD (DSC-29)
- Engine-driven pump of the failed engine = **amber box + "LO"** (pb on, no pressure). But the **system pressure
  stays NORMAL** because the **PTU** repressurises it from the other system.
- **PTU running = the two ◁PTU▷ triangles FILLED green** (FCOM DSC-29: green when supplying; the HYD PTU E/WD
  memo is green when running). Outline-only = not shown working.
- RAT triangle stays **white** (not deployed) unless an actual RAT-out condition.

### ELEC (DSC-24/36)
- Failed engine's GEN = **amber box, 0 %/0 V/0 HZ**; its **GEN→AC feed arrow → amber** (not supplying); its
  **IDG temp drops** (engine stopped, ~46 °C).
- **AC BUS of the dead side is fed via the BUS TIE** — BTC closes when a GEN is off (FCOM 36578): draw the green
  bus-tie line so the bus reads powered from the live GEN. The live **GEN load rises** (~55 %, carrying both buses).
- **GALLEY SHED** appears (single-generator auto load shed). **EXT PWR = blank in flight** (ground power not connected).

### BLEED (DSC-36) [⏳ build from its SVG]
- Failed engine's bleed = **PSI 0 amber, HP valve amber** (bleed lost / fire pb closed the bleed valve).

---

## §6 — The PERMANENT STRIP (shared, live, synced)

- **ONE component** `SdPermanentStrip` (props `tat/sat/clock/gw`), rendered by the runner UNDER every SD page
  (flex column: page area `flex:1` + strip). NOT baked per page.
- **Every SD SVG is viewBox-CROPPED above its strip line** so its baked strip doesn't render (engine 3545 · hyd
  3555 · fuel 3510 · elec 3475 *(keeps GALLEY SHED @3430)* · wheel 3590 · cruise 3579). `StatusPanel`'s baked
  strip is removed.
- **GW is LIVE and reduces with fuel burn:** `Math.round((65000 - elapsedMs/1000 * 0.55)/100)*100` — starts
  65000 (MLW 64500 + 500, overweight-for-landing), ~33 kg/min, to nearest 100 kg. All pages show the SAME GW at
  any instant → "in sync like the real aircraft" (holding burns it down toward MLW).
- Fixed: **SAT +30** (Delhi OAT ~30 °C) · **TAT +33** (ram rise) · **UTC 04 H 30**.
- **SYNC values across pages:** the ENGINE and CRUISE pages must show the SAME F.USED / OIL / VIB for the same
  engine state. Don't let two pages disagree.

---

## §7 — SVG build/render playbook

- **Source → component:** two patterns.
  - **Inline scoped string** (ENGINE, HYD): bake the SVG in the `.tsx`; the cls-N Illustrator names COLLIDE with
    `svg-pfd` / other SD pages, so wrap the whole `<style>` in **`@scope (.<name>-scope)`** and add
    `class="<name>-scope"` to `<svg>`. Use when values are dynamic (need JS interpolation).
  - **Static `<img src="/models/sd-*.svg">`** (FUEL, ELEC, WHEEL, CRUISE): serve from `public/models/`. `<img>`
    ISOLATES the classes (separate document — no `@scope` needed). Use for raster-heavy pages (FUEL embeds a
    ~1 MB PNG) and mostly-static pages; edit values by scripting the file (too big to Read).
- **Colours:** green `#5aba47` (or lime), cyan `#2dc3e8`, amber `#e8a13a`, white `#fff`, red `#ed1e24`. Match the
  page's own greens when recolouring pumps/arrows.
- **Background MUST be `#000`** — designer SVGs sometimes ship a tinted bg rect (FUEL was `#090a0f`). Check & fix
  on every import, or that page looks different from the others.
- **Illustrator export gotchas (check every import):** stray **control chars** (a 0x02 broke ELEC parsing — strip
  chars `< 32` except `\t\n\r`); **`Â°C` mojibake** → `°C`; a script edit that drops the tspan's **colour class**
  renders the value black/invisible (keep `class="cls-NN"`).
- **CSS beats the presentation attribute for `fill`/`stroke`** — to override a class colour, use an **inline
  `style="fill:…"`** or a class defined **LAST** in the sheet (source order wins at equal specificity).
- **Verify IN-APP** (§0.6), sample pixels / read the render — never trust the raw SVG URL.

---

## §8 — The build LOOP (run every new page / failure state)

1. **CONTEXT** — read this skill, `displays/SD.md`, the FCOM chapter (DSC-31 + the system's chapter), and the
   reference (designer SVG in `assets/sd/` or the user's image).
2. **PLAN** — which page, which card triggers it (§4), what the failure does to it (§5), mirror side (§0.3).
3. **BUILD** — reference-first geometry; apply the failure depiction; crop the strip (§6); scope/isolate classes (§7).
4. **VERIFY** — render headless IN-APP, sample pixels, check colours + no cut content + strip alignment + SYNC
   with sibling pages. Catch your own misses before the user.
5. **WIRE** — add the card→page branch in the runner; confirm it pops at the right step in-scenario.
6. **EVOLVE** — write the lesson back here + `displays/SD.md` + memory the same session.

---

## §9 — Trigger / gating

Pure vault/skill/reference edits: always fine. Touching `*-sd-page.tsx`, `sd-*.svg`, `sd-permanent-strip.tsx`,
`status-panel.tsx`, or the runner SD-slot logic → first satisfy §8 steps 1–2 (context + plan) and the manual-first
rule (FCOM trace + SME flag for values). One page/state per task; keep the working pages intact
([[feedback_do_not_break_working_state]]).
