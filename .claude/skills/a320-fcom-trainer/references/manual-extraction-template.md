# Manual Extraction Template

For every FCOM/FCTM/QRH/SOP section, extract:

## Source
- Manual:
- Chapter/Section:
- Topic:
- Confidence:

## System Logic
- Normal condition:
- Trigger condition:
- Aircraft response:
- Crew interface:
- ECAM indication:
- Required action:
- Completion condition:

## State Machine Conversion
- State variables:
- Events:
- Transitions:
- Guards/conditions:
- Outputs/indications:

## Coding Impact
- Frontend components:
- Backend transition logic:
- Scenario data:
- Scoring/debrief checks:

## Source Classification
- official-source-derived:
- inferred-from-source:
- simulation-placeholder:

---

## Usage notes

- One file per system per scope. If you're extracting APU start logic, put it in
  a working note named `apu-start.extraction.md` (do not save this template
  itself with content — copy it).
- The **Confidence** field is one of: `high` (single unambiguous source),
  `medium` (source clear but ECAM/FCOM/FCTM differ in emphasis), `low`
  (technique-only or implied), `placeholder` (no source).
- **Crew interface** describes the physical/UI surface (button location,
  switch type, guard, display). Cite FCOM `DSC-` section if available.
- **State variables** are simulator-relevant booleans/enums (e.g.
  `apu.master`, `apu.start`, `apu.bleed`, `apu.gen`, `apu.flap`, `apu.n_pct`,
  `apu.egt_c`, `apu.fault`).
- **Events** are what changes state — crew action (`apu.master:OFF→ON`),
  time tick, condition (`n_pct >= 95 for 2s`), or external (fire warning).
- **Transitions** are tuples: `(current_state, event) → next_state`.
- **Guards/conditions** are preconditions (e.g. `bat_volts >= 25`,
  `fire_pb_not_pushed`).
- **Outputs/indications** are what the cockpit shows: light states, ECAM
  lines, audio, MEMO entries.

## Filled-in mini-example

```
## Source
- Manual: FCOM
- Chapter/Section: DSC-49 / Auxiliary Power Unit, Description
- Topic: APU Master Switch — startup sequence
- Confidence: high

## System Logic
- Normal condition: APU off, MASTER OFF, no flap, no bleed
- Trigger condition: Crew sets MASTER pb to ON
- Aircraft response: APU electronic control unit (ECB) powers up; APU flap opens; "FLAP OPEN" memo appears on ECAM
- Crew interface: APU MASTER pushbutton (overhead panel, AC compartment); push toggles between OFF (released) and ON (latched, blue legend ON lit)
- ECAM indication: APU page becomes accessible on SD; FLAP OPEN memo on EWD
- Required action: After flap is open, press START pb
- Completion condition: APU flap fully open (~6 seconds)

## State Machine Conversion
- State variables:
  - apu.master: 'OFF' | 'ON'
  - apu.flap: 'CLOSED' | 'OPENING' | 'OPEN'
  - apu.start_armed: boolean
- Events:
  - crew_press_apu_master_on
  - flap_fully_open  (after ~6s timer)
- Transitions:
  - (master:OFF, flap:CLOSED) + crew_press_apu_master_on → (master:ON, flap:OPENING, start_armed:false)
  - (flap:OPENING) + flap_fully_open → (flap:OPEN, start_armed:true)
- Guards/conditions: dc_bat_bus_powered
- Outputs/indications:
  - master pb 'ON' legend lit (blue) when master:ON
  - EWD MEMO line "APU FLAP OPEN" while flap != CLOSED
  - SD APU page accessible when master:ON

## Coding Impact
- Frontend components: src/components/cockpit/overhead/ApuPanel.tsx, src/components/ewd/Memo.tsx
- Backend transition logic: src/engine/systems/apu.ts (reducer for apu events)
- Scenario data: scenarios that begin with APU off → on can rely on this
- Scoring/debrief checks: did crew open APU master before pressing START?

## Source Classification
- official-source-derived: master pb behavior, flap open timing, FLAP OPEN memo
- inferred-from-source: 6-second flap-open timer (FCOM says "approximately"; pin to a value for sim)
- simulation-placeholder: blue legend exact RGB (use Aviator existing tokens)
```
