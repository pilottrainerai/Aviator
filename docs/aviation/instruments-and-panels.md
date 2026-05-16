# A320 Instruments & Panels — Reference Spec

Authoritative reference for the cockpit instruments and panels rendered in the
Aviator trainer. Pulls together FCOM source data, FCOM photo annotations, and
the canvas/SVG code under `src/components/cockpit/`.

> **Source of truth:** Airbus A320 FCOM (DSC-31, DSC-26, DSC-70-90, DSC-22).
> **Where to read it:** `~/.claude/manuals/a320/fcom-full.txt` (extracted text).
> **In-repo skill:** `.claude/skills/a320-fcom-trainer/` (read-only assessment workflow).

---

## 1. PFD — Primary Flight Display

FCOM ref: **DSC-31-40 PILOT INTERFACE — PFD**.

### 1.1 Layout (520 × 640 canvas, top → bottom)

```
┌──────────────────────────────────────┐
│        FMA  (5 cols × 3 rows, 92 px) │  ← Flight Mode Annunciator
├─────┬───────────────────────┬────┬───┤
│     │                       │    │   │
│ SPD │       ADI (R 152)     │ALT │ V │
│tape │      with FD bars     │tape│ S │
│     │      + FMA roll       │    │   │
│     │      + RA bottom      │    │   │
├─────┴───────────────────────┴────┴───┤
│   ILS info     |  HDG tape (TENS)    │
│   (mag freq +  |  + sel HDG bug      │
│    dist)       |  + track diamond    │
└──────────────────────────────────────┘
```

### 1.2 FMA — Flight Mode Annunciator (FCOM 5-column / 3-row)

| Col | Topic | Active mode (Row 1) | Armed mode (Row 2) | Row 3 |
|---|---|---|---|---|
| 1 | A/THR Operation | `MAN TOGA` `MAN MCT` `THR CLB` `THR IDLE` `SPEED` `MACH` | (rare) | A/THR limit / W |
| 2 | AP/FD Longitudinal | `SRS` `CLB` `DES` `OP CLB` `ALT*` `ALT` `V/S` `G/S*` `G/S` `LAND` `FLARE` | `CLB` `ALT` `G/S` `FINAL` | warnings |
| 3 | AP/FD Lateral | `RWY` `RWY TRK` `NAV` `HDG` `LOC*` `LOC` `LAND` `ROLL OUT` `TRACK` | `NAV` `LOC` `APP NAV` | warnings |
| 4 | Approach Capability | `CAT 1` `CAT 2` `CAT 3 SINGLE` `CAT 3 DUAL` `LAND2` `LAND3` | `CAT 1`/`CAT 2`/`CAT 3` | `DH 100` / `MDA 700` |
| 5 | AP/FD/A/THR Engagement | `AP1` / `AP2` / `AP1+2` (white) | `1FD2` (white) | `A/THR` (white) |

#### Colors (FCOM DSC-31-60)
- **GREEN** `#00ff00` — ACTIVE mode (engaged & driving the aircraft)
- **BLUE**  `#00bfff` — ARMED mode (selected, will engage on capture)
- **WHITE** `#ffffff` — engagement status (AP/FD/A/THR), DH/MDA, source labels
- **MAGENTA** `#ff00ff` — special engagement for ILS pointers
- **AMBER** `#ffb000` — warnings, ENG OUT in the status column

#### Mode-set examples
- **Takeoff (V1 → 400 ft):** `MAN TOGA | SRS | RWY` `· · CLB · NAV · · ·`
- **Initial climb (400 ft → ACC ALT):** `MAN TOGA | SRS | NAV` armed `CLB`
- **Climb after ACC ALT:** `THR CLB | CLB | NAV` armed `ALT`
- **Cruise:** `SPEED | ALT | NAV` no armed
- **Approach (ILS captured):** `SPEED | G/S | LOC | CAT 3 DUAL | AP1+2`
  armed: `· | · | · | DH 100 | A/THR`
- **Engine fire/failure after V1:** `MAN TOGA | SRS | RWY TRK` armed `CLB | NAV` + status `ENG OUT` (amber)

### 1.3 Speed scale (FCOM ref ① – ⑥)

| ID | Element | Color | Notes |
|---|---|---|---|
| ① | Airspeed reference + scale | white tape, white digits | Current value in box at vertical center |
| ② | Speed trend | GREEN arrow, length = predicted change in 10 s | up = accel, down = decel |
| ③ | Target airspeed | CYAN triangle (selected) / YELLOW line (managed) | Top of tape shows selected value in cyan |
| ④ | Mach number | white | Below tape; appears > 0.4 M typically |
| ⑤ | Speed protection | RED (Vmax) at top + AMBER (Vmin) at bottom | Red Vmax band, amber Vmin line |
| ⑥ | ECON / managed range | GREEN band on right edge | Recommended speed corridor |

### 1.4 Altitude scale

| ID | Element | Color | Notes |
|---|---|---|---|
| ① | Altitude reference | yellow pointer, white box | Current alt; thousands in green, hundreds in white |
| ② | Linear deviation | small white dot beside tape | Vertical deviation from selected (off-flight-path indicator) |
| ③ | Target altitude | CYAN box at top of tape | FCU pre-selected alt |
| ④ | BARO ref | CYAN `STD` box (above 18 000 ft) or `QNH 1013` (below) | Sits below tape |

Ground reference and landing elevation appear during approach; rendered as a
ground-shading pattern on the lower altitude band.

### 1.5 Vertical Speed scale

- Green pointer pivots from **left edge** of the VS strip out to the value on
  the **right side**.
- Climb = above mid (toward top), descent = below mid.
- Marks at 500 / 1000 / 2000 fpm.
- Numeric VS readout (rounded to 100s) appears beside the pointer when |VS| > 50.
- Target VS shown as a small filled box at the target value.

### 1.6 ADI — Attitude Director Indicator

- Sky/ground gradient (FCOM-realistic depth).
- Pitch lines every 2.5° / 5° / 10°.
- Bank scale ticks at 10°, 20°, 30°, 45°, 60°.
- Yellow roll pointer + fixed roll index triangle at top.
- **Flight Director crosshairs** — symmetric green bars (4-px line width):
  - Horizontal pitch bar — moves up/down based on FD pitch command.
  - Vertical roll bar — moves left/right based on FD roll command.
  - On the FD path → both bars cross at the aircraft symbol.
- Yellow aircraft symbol fixed at center.
- Glide-slope dots on the right side; LOC dots below.
- **RA (radio height)** — green numeric value at bottom inside ADI when below 2 500 ft AGL.

### 1.7 Heading scale

Two FCU modes:
- **HDG-V/S SELECTED** — heading reference (yellow lubber), selected heading (yellow bug),
  actual track (magenta diamond).
- **TRK-FPA SELECTED** — actual track (yellow lubber moves), selected track (yellow bug),
  heading reference (magenta).

**Tens-digit labels** (e.g. `28` for 280°, `9` for 90°, `N`/`E`/`S`/`W` at cardinals).

### 1.8 ILS info

Below speed tape, in MAGENTA:
- ILS identifier (e.g. `IDPN`)
- Tuned frequency (e.g. `110.30`)
- DME distance (e.g. `7.4 NM`)

---

## 2. ND — Navigation Display

FCOM ref: **DSC-31-30 NAVIGATION DISPLAYS**. Five modes available: ROSE NAV /
ROSE VOR / ROSE LS / ARC / PLAN. The trainer implements **ARC mode** (most
common cruise/approach mode).

### 2.1 Range options

Selectable via FCU range knob: **5 / 10 / 20 / 40 / 80 / 160 NM**.
In the mockup, click the canvas to cycle through these values.

### 2.2 Layout (520 × 600 canvas)

```
┌──────────────────────────────────────┐
│ GS xxx  TAS xxx                D-OL  │  ← Top-left: speeds + wind
│ 260°/12 ↗                      079°  │     Top-right: TO waypoint
│                                4.2 NM│           identification + track
│                                14:25 │           + distance + ETA
│                                10 NM │           + selected range
│                                       │
│       ┌─── 90° compass arc ──┐       │  ← Compass arc
│       1 8  9  10 11 12              │     Tens digits, rotated tangent
│      / / |  |  | \                  │     Yellow lubber line at top
│     \ ─ ─ ─ ─ ─ /                   │
│      \  ─ ─ ─ /                     │  ← Cyan dashed range arcs
│       \  ─ ─ /                      │     at 1/4, 1/2, 3/4 of range
│        \ DPN                        │
│           ◇                          │  ← Magenta TO waypoint
│           |                          │
│           |  ← magenta route line   │
│         RAJBI ✶                      │  ← White downstream waypoint
│            \                         │
│             \                        │
│              ▼                       │  ← Aircraft symbol (yellow T)
│     ARC                              │  ← Mode label bottom-left
└──────────────────────────────────────┘
```

### 2.3 Element details

| Element | FCOM ref | Color |
|---|---|---|
| Compass arc + tens digits | white | tens-digit label, rotated tangent to arc |
| Lubber line (heading reference) | yellow filled triangle | top center |
| Selected heading bug | yellow open triangle | outside arc |
| Track diamond | magenta | inside arc |
| Range arcs | cyan dashed | at 1/4, 1/2, 3/4 of selected range; NM labels on right side |
| Active flight plan (TO leg) | MAGENTA solid | aircraft → next TO waypoint |
| Downstream legs | WHITE solid | after the TO waypoint |
| TO waypoint symbol | matches type, magenta if active | hexagon (VOR), circle+cross (apt), 4-asterisk (wpt) |
| TO waypoint label | magenta | identification |
| Track line | green dashed | aircraft → infinity along current ground track |
| Aircraft symbol | yellow "T" | fixed at bottom center |
| GS / TAS | white digits, gray labels | top-left |
| WIND | green digits + green arrow | top-left below GS/TAS |
| TO INFO box | name (magenta) + track/dist/ETA (white) | top-right |
| Range label | cyan | top-right below TO box |
| Mode label (`ARC`) | gray | bottom-left |

---

## 3. FIRE Panel

FCOM ref: **DSC-26-20-20 FIRE PANEL**. Located on the overhead, between the
ENG MASTER pedestal panel and the APU section. Used during engine/APU fire
detection and discharge.

### 3.1 Element list

| Element | Type | Notes |
|---|---|---|
| ENG 1(2) FIRE pb | guarded rectangular pushbutton | wireframe metal guard hinged at top; rectangular (taller than wide); **FIRE** legend (red) + **PUSH** (white) on face; pops out when pushed and stays out |
| AGENT 1(2) pb-sw | square (52 × 52 px in mockup) | NOT guarded; two stacked indicator cells: SQUIB (white when armed) + DISCH (amber when fired) |
| ENG 1(2) FIRE TEST pb | small round | bottom of section; pressing illuminates ALL fire indications for the system |
| APU FIRE pb | guarded rectangular | identical mechanic to engine FIRE pb |
| APU FIRE TEST pb | small round | bottom of APU section |

### 3.2 ENG FIRE pb behavior (FCOM verbatim, DSC-26-20-20)

> The pushbutton normal position is in, and guarded. When the flight crew
> pushes it, the pushbutton is released and sends an electrical signal that
> performs the following for the corresponding engine:
> - Silences the aural fire warning
> - Arms the fire extinguisher squibs
> - Closes the low-pressure fuel valve
> - Closes the hydraulic fire shut off valve
> - Closes the engine bleed valve
> - Closes the pack flow control valve
> - Cuts off the FADEC power supply
> - Deactivates the IDG
>
> The red lights come on, regardless of the pushbutton position, whenever the
> fire warning for the corresponding engine is activated.

### 3.3 Indicator legend states

| Legend | Color | Trigger | Notes |
|---|---|---|---|
| `FIRE` | RED | engine fire-detect loop active | **independent of pb position** |
| `SQUIB` | WHITE | FIRE pb pushed AND agent not yet fired | on AGENT pb |
| `DISCH` | AMBER | agent has discharged | on AGENT pb |

### 3.4 ECAM 10-second arming

After FIRE pb push, AGENT pbs enter a **10-second arming window** (FCOM
"AGENT 1 AFTER 10 S → DISCH"). During this window:
- AGENT SQUIB cell pulses amber (CSS keyframes).
- AGENT pb is `disabled` (cursor stays default).
- Countdown badge shows `IN 10S → 9S → ... → 1S` below the label.

After 10 s:
- SQUIB snaps to solid white (armed).
- AGENT pb becomes clickable.
- Click → DISCH solid amber, agent fired.

### 3.5 Color tokens

```ts
const FIRE_TOKENS = {
  legend: {
    fireRed:    "#FF3333",
    squibWhite: "#E8ECF4",
    dischAmber: "#FFB300",
  },
  body: {
    bezel:     "#1E2430",
    face:      "#0E1118",
    legendOff: "#060A0E",
  },
  guard: {
    frame:   "#6A7488",
    wires:   "linear-gradient(90deg, #4A5260, #B0B8C0, #4A5260)",
    knuckle: "radial-gradient(circle at 30% 30%, #B0B8C0, #5A6470, #1A1E28)",
  },
  panelFrame: "linear-gradient(135deg, #5A6470, #2E3440, #1A1E28)",
};
```

---

## 4. ENG MASTER Panel

FCOM ref: **DSC-26-20-20 ENG MASTER PANEL** + **DSC-70-90-20**.

### 4.1 Layout (per FCOM photo)

```
┌────────────────────────────────────┐
│  MASTER 1   ENG MODE   MASTER 2    │
│  ┌────┐    ┌──────┐   ┌────┐       │
│  │ENG │ON  │ NORM │ON │ENG │ON     │  ← Lever knobs (square, ENG 1/2)
│  │ 1  │OFF │CRANK │OFF│ 2  │OFF    │     ON / OFF labels to the right
│  └────┘    │IGN/ST│   └────┘       │
│  ┌────┐    └──────┘   ┌────┐       │
│  │FIRE│               │FIRE│        │  ← FIRE/FAULT box
│  │FAULT               │FAULT       │     INLINE below each lever
│  └────┘               └────┘        │
└────────────────────────────────────┘
```

### 4.2 ENG MASTER lever (DSC-70-90-20)

- Physically a small square lever (a.k.a. "ENG MASTER sw") on the pedestal.
- Two positions: **ON** (top) / **OFF** (bottom).
- Action: pull the knob UP to release detent, then PULL BACK toward pilot for OFF.
- ON: FADEC initiates auto/manual start sequence.
- OFF: FADEC shuts down engine OR aborts start.
- Indicator lights on lever face (or in the inline box below):
  - `FIRE` (red) — same loop as FIRE pb (fire detected)
  - `FAULT` (amber) — HP fuel valve abnormal / start abort / thrust ctl fault

### 4.3 ENG MODE selector (rotary, between the two MASTER levers)

Positions: **CRANK / NORM / IGN START**.
- CRANK — dry crank for engine cooling.
- NORM — normal operation (cruise, taxi).
- IGN START — engages igniters during start sequence.

---

## 5. THR LEVERS

FCOM ref: **DSC-22_10-40-30** + **DSC-70-90-20-40**.

### 5.1 Detent positions (top → bottom of throw)

| Detent | Use | Color in mockup |
|---|---|---|
| **TOGA** | Takeoff / Go-Around | white |
| **FLX/MCT** | Flex takeoff / Max Continuous Thrust (engine-out) | white |
| **CL** | Climb (autothrust active range) | green |
| **IDLE** | Disconnects autothrust; minimum thrust | amber |

### 5.2 Behavior

- Levers are mechanical with physical gates — **snap into each detent**, no
  smooth between-detent state.
- TOGA / FLX detent arms autothrust at takeoff and engages takeoff/go-around
  modes.
- IDLE detent disconnects autothrust.
- Engine-out: live engine to MCT detent (FCOM ENG FAILURE procedure).

### 5.3 Pedestal layout

Two levers side-by-side (ENG 1 left, ENG 2 right), with a **shared detent
placard** between them showing the four labels (TOGA, FLX/MCT, CL, IDLE).
The active detent label illuminates in the lever's semantic color.

---

## 6. Color Conventions (FCOM DSC-31-60 ECAM/PFD/ND)

| Color | Hex | Meaning |
|---|---|---|
| RED | `#FF3333` | WARNING — immediate action required |
| AMBER | `#FFB300` | CAUTION — awareness, may need action |
| GREEN | `#00FF00` | NORMAL / FUNCTION ON / target met / ACTIVE FMA |
| BLUE (cyan-blue) | `#00BFFF` | ARMED FMA modes |
| CYAN | `#00CFFF` | SELECTED values (target speed, target alt), data |
| WHITE | `#FFFFFF` | LABEL / status / scale (no abnormality) / engagement |
| MAGENTA | `#FF00FF` | MANAGED mode targets, ILS pointers, FROM/TO waypoint |

> **Critical**: pick colors by *meaning*, not visual aesthetics. Don't choose
> red because it "looks important" — red specifically means WARNING per FCOM.

---

## 7. Data flow — scenario → instruments

```
ScenarioState  (state.completedSteps + triggersFired + masterWarn/Caut)
       │
       ▼
buildAircraftState()      ← in src/components/cockpit/pfd-nd.tsx (exported)
       │
       ▼
AircraftState  { pitch, speed, altitude, vs, heading, track, gs, tas,
                 selectedSpeed/Alt/Hdg, thrMode, vertMode, latMode,
                 apEngaged, athrActive, eng1/2Failed, windDir/Spd, ... }
       │
       ▼
PFD / ND canvas mockups (rAF loop reads from `stateRef.current` each frame)
       │
       ▼
buildAircraftState returns FCTM OP-020 phase-derived snapshots:
  Pre-fire (just past V1) — speed 157, alt 200, vs 1600, pitch 10
  Fire warn (400 ft)      — speed 165, alt 400, vs 2200, pitch 9
  AP1 engaged (~600 ft)   — speed 166, alt 600, vs 2100, pitch 8
  THR LVR IDLE (~800 ft)  — speed 168, alt 800, vs 2000, pitch 8
  ECAM done (Agent 1)     — speed 172, alt 1100, vs 1800, pitch 7
  Level off MAA           — speed 185, alt 1500, vs 100, pitch 2
  Accel/clean             — speed 210, alt 2200, vs 1200, pitch 5
```

---

## 8. File index

| File | Role |
|---|---|
| `src/components/cockpit/pfd-mockup.tsx` | PFD canvas mockup (this doc's primary subject) |
| `src/components/cockpit/nd-mockup.tsx` | ND canvas mockup, ARC mode |
| `src/components/cockpit/engine-fire-panel-mockup.tsx` | Standalone FIRE panel mockup |
| `src/components/cockpit/fire-panel.tsx` | Live FirePanel (DSL-driven) used in scenario runner |
| `src/components/cockpit/pfd-nd.tsx` | Existing live PFD/ND (Pixi-based); `buildAircraftState` exported here |
| `src/avionics/core/aircraftState.ts` | `AircraftState` interface + defaults |
| `src/avionics/pfd/PFDRenderer.ts` | Existing Pixi PFD renderer |
| `src/app/mockups/pfd/page.tsx` | Route — `/mockups/pfd` |
| `src/app/mockups/nd/page.tsx` | Route — `/mockups/nd` |
| `src/app/mockups/fire-panel/page.tsx` | Route — `/mockups/fire-panel` |
| `src/app/train/[slug]/runner.tsx` | Scenario runner (PFD + ND wired here) |
| `src/scenarios/data/eng1-fire-after-v1.ts` | ENG 1 FIRE scenario |
| `~/.claude/manuals/a320/fcom-full.txt` | Full FCOM extracted text (grep for procedure details) |
| `.claude/skills/a320-fcom-trainer/` | Skill — read-only assessment workflow |

---

## 9. FCOM page-range index (for deep dives)

| Topic | FCOM section | grep keyword |
|---|---|---|
| PFD layout | DSC-31-40 | `PRIMARY FLIGHT DISPLAYS` |
| FMA columns | DSC-31-40 / DSC-22_30 | `FMA` |
| ND layout | DSC-31-30 | `NAVIGATION DISPLAYS` |
| ND modes | DSC-31-30 | `ROSE NAV`, `ROSE VOR`, `ARC`, `PLAN` |
| ECAM colors | DSC-31-60 | `ECAM display` |
| FIRE pb | DSC-26-20-20 | `ENG 1(2) FIRE PB` |
| ENG MASTER lever | DSC-70-90-20 | `ENG MASTER lever` |
| THR LEVERS detents | DSC-22_10-40-30, DSC-70-90-20-40 | `THRUST LEVERS`, `TLA` |
| ENG 1(2) FIRE procedure (in flight) | PRO-ABN-ENG p.40 | `ENG 1(2) FIRE` |
| ENG 1(2) FIRE procedure (on ground) | PRO-ABN-ENG p.42 | `ENG 1(2) FIRE` + `ON GROUND` |

Use the extracted text:
```bash
grep -nA20 "ENG 1(2) FIRE" ~/.claude/manuals/a320/fcom-full.txt | head -40
```

---

## 10. Trainer notes — what's modeled vs. simplified

### Faithfully modeled
- FMA active/armed mode taxonomy and color split (green/blue/white/amber).
- FIRE pb effects (silences aural, arms squibs, closes valves, cuts FADEC, deactivates IDG).
- 10-s ECAM arming countdown for AGENT pbs.
- FIRE light independent of pb position.
- ND ARC mode 90° compass with tens-digit labels rotated tangent.
- Magenta TO leg vs. white downstream legs.
- Range options 5 / 10 / 20 / 40 / 80 / 160 NM.
- THR detent snap behavior.
- ENG MASTER lever with vertical travel + back-tilt at OFF.

### Simplified for sim
- Engine spool curves are stepwise (per phase) rather than continuous physics.
- Wind is a single dir/speed rather than layered atmospheric data.
- ILS is a static identifier — no real navaid database.
- TO WAYPOINT info box uses approximate ETA (`now + dist/GS`).
- ECAM `SECONDARY FAILURES` rendered without the FCOM "(*)" prefix detail.

### Future / queued
- ROSE NAV / ROSE VOR / ROSE LS / PLAN ND modes.
- TCAS overlays.
- Weather radar overlay.
- TERR overlay.
- Linear vertical deviation dot on alt scale.
- Mach number readout below speed tape (>0.4 M).
- BARO `STD` cyan box at altitudes ≥ TRANS ALT.
- HDG-V/S vs TRK-FPA mode switch on the heading scale.
