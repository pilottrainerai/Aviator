# Cockpit Control Mapping

Conventions for push-buttons, switches, lights, and color semantics in the
A320 cockpit. Use this when designing or reviewing any control surface in
`src/components/cockpit/*`.

## Push-button taxonomy

### Guarded latching pb (e.g. ENG FIRE, APU FIRE, AGENT)
- Normal position: **in, guarded** (a clear flip-up cover).
- Action: lift guard, push pb.
- Result: pb releases (pops out), stays out until manually reset.
- States: `guarded-in` (normal) | `released-out` (after push).

### Latching pb (e.g. ENG MASTER, APU MASTER, FUEL PUMP)
- Pushed and released by the crew; stays in the selected state.
- Often has a legend (text on face) that lights when the function is **OFF**
  — counter-intuitive Airbus convention. Example: `OFF` light on FUEL PUMP
  comes on when the pump is OFF; the pb itself has no `ON` light.
- Some pbs have **two legends** (e.g. APU MASTER: `ON` blue when on; no
  light when off; `FAULT` amber if fault).

### Momentary pb (e.g. RCL — Recall, EMER CANCEL, MASTER WARN/CAUT)
- Spring-returns to neutral after release.
- Press triggers an event; no persistent state on the pb itself.

### OFF-light pushbutton convention
**Critical rule**: many Airbus pbs light their `OFF` legend when the
function is off, NOT when on. Don't invert this. Examples that follow this:
PACK 1/2, BLEED 1/2, ANTI-ICE WING/ENG, PROBE/WINDOW HEAT, GEN 1/2,
APU GEN, EXT PWR.

### "Auto" position (knobs and rotaries)
- Most rotary controls have an `AUTO` position as the normal default
  (e.g. CAB PR MODE SEL, ANTI-ICE).
- `MAN` requires deliberate selection.

## Light states on critical pbs

### ENG 1(2) FIRE pb
- `FIRE` legend (red) — fire detected; comes on with master warn + CRC aural.
- `SQUIB` legend (white) — agent armed and ready to discharge.
- `DISCH` legend (amber) — agent has been discharged.

### APU FIRE pb
- Same pattern as ENG FIRE pb (`FIRE` red / `SQUIB` white / `DISCH` amber).

### AGENT 1, AGENT 2 pbs (engine)
- `SQUIB` (white) when armed.
- `DISCH` (amber) once fired.

### MASTER WARN (red, glareshield)
- Comes on red with any level-3 warning (red ECAM line + CRC).
- Pressing extinguishes the visual and silences the aural — but does NOT
  clear the underlying ECAM warning.

### MASTER CAUT (amber, glareshield)
- Comes on amber with any level-2 caution (amber ECAM + single chime).
- Pressing silences and extinguishes; ECAM still shows the caution.

## Color semantics (lights AND displays)

| Color | Meaning |
|---|---|
| Red | WARNING — action immediately required |
| Amber | CAUTION — awareness, may need action |
| Green | NORMAL / function ON / target met |
| Blue | INFORMATION / actions to do (also: managed mode targets on PFD/ND) |
| White | LABEL / status / scale (no abnormality) |
| Magenta | MANAGED mode targets (FCU) |
| Cyan | DATA values (some readouts) |

These colors are **semantic**. Don't pick a hex value just because it
"looks like" red — match the FCOM-defined semantic by *what it means*,
not by visual aesthetics.

## Switch types

| Type | Behavior | Example |
|---|---|---|
| Toggle (2-pos) | Flip up/down | XPDR ALT/STBY |
| Three-position toggle | Up/center/down | NOSE WHL STRG GND/AUTO/T.O. |
| Rotary selector | Discrete positions | CAB PR MODE SEL (AUTO/MAN) |
| Continuous rotary | Variable | OUTFLOW VLV manual control |
| Pull-rotary | Pull then turn | DITCH (oxygen) |

## Display surfaces

| Display | Role |
|---|---|
| **PFD** (Primary Flight Display) | Attitude, speed, altitude, FMA |
| **ND** (Navigation Display) | Track, weather, terrain, traffic |
| **EWD** (Engine/Warning Display) | Engine params (top), ECAM warnings/cautions/MEMO (bottom) |
| **SD** (System Display) | System pages: APU, ENG, BLEED, ELEC, HYD, F/CTL, FUEL, WHEEL, COND, DOOR, CRZ, STATUS |
| **MCDU** (×2) | Multi-purpose Control & Display Unit — FMS, RADNAV, PERF |
| **STBY** | Standby instruments (ISIS) |
| **OHP** | Overhead panel — system pbs |

## Mapping rules for code

When designing or reviewing components:

1. **Each pb is its own component** with a known state model:
   `props.state ∈ {…} → render`. Do not hardcode visuals to a scenario.
2. **Light state derives from system state**, not crew action history.
   Example: `SQUIB` lit if `firePb.released && agent.armed`. The crew
   action that *caused* `released` shouldn't be asked again.
3. **Names mirror FCOM.** Component named `EngFirePb` not `RedButton`.
4. **No magic numbers in colors** — use the project's design tokens
   (the `--color-amber`, `--color-red`, etc. defined in styles tokens).
5. **Guard state is part of the pb model**, not a wrapper. A real ENG FIRE
   pb has the guard physically attached.

## Anti-patterns

- ❌ A button labeled "Fire 1" that's just a generic red button — must be
  the FCOM-named ENG 1 FIRE pb with the `FIRE`/`SQUIB`/`DISCH` legend
  states.
- ❌ Inverted OFF-light convention (lighting an `ON` indicator when on)
  — that's Boeing-style, not Airbus.
- ❌ Hardcoding `FIRE` legend text in JSX. Drive from
  `engineState.fireDetected`.
- ❌ Skipping the guard. A user click on the guarded pb should require
  two interactions (lift guard, then push) — or at minimum a visual
  affordance reflecting the guard.
- ❌ Mixing color semantics (e.g. amber for "off" — that's white/no-light
  on Airbus).
