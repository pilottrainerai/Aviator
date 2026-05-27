---
applyTo: >
  src/components/cockpit/**,
  src/app/**/fire-panel*/**,
  src/app/**/overhead*/**,
  src/app/**/pedestal*/**,
  blender/**/*.py
description: >
  A320 lighted-pushbutton skill — FCOM-sourced rules for every guarded,
  spring-loaded, and alternative-action pushbutton on ANY A320 panel.
  Use BEFORE implementing, modifying, or animating any pushbutton in THREE.js,
  React, or Blender. Covers: FCOM light-colour conventions, universal
  FAULT/ON/OFF cell pattern, pushbutton types, guarded spring-loaded
  pattern (FIRE pb reference implementation), Blender material naming
  convention for every light state, ECAM link rules, and reusable THREE.js
  state-machine template.
  Trigger keywords: pushbutton, pb, pb-sw, guarded, SQUIB, DISCH, FAULT,
  ON light, OFF light, guard lift, pop-out, spring-loaded, lighted pb,
  cockpit button, overhead panel, HYD, ELEC, AIR COND, BLEED, FIRE.
---

# A320 Lighted Pushbutton Skill

> **All values in this skill are extracted verbatim from Airbus FCOM
> (docs/manuals/fcom-full.txt). No value is invented.
> If a value is not in this document, stop and grep fcom-full.txt
> before proceeding.**

---

## HOW THIS SKILL WORKS (read before anything else)

Every A320 overhead panel pushbutton has a **face with text cells**.
The face does NOT glow uniformly — only the **text cell** that corresponds
to the current system state lights up, in the correct FCOM colour.

The three universal rules, in order:

```
1. FAULT cell → AMBER   (system fault, ECAM caution)
2. ON cell    → WHITE   (flight crew switched it on)
3. Everything else → OFF (cell text is there but dark, system is in normal/AUTO mode)
```

Nothing else lights up unless the FCOM explicitly says so.
The button BODY itself never changes colour — only the cell text.

When you receive a new Blender panel to implement:
1. Read the FCOM section for that panel (see §9 for DSC numbers)
2. Map every cell legend to a colour using §1 colour table
3. Map every material to a Blender `lit_*` material using §10 naming
4. Write the THREE.js state machine using the template in §5

---

## 0 · Hard Rules (never break)

1. **FCOM light colours are non-negotiable.** Red = immediate action.
   Amber = awareness / no immediate action. White = procedure guidance /
   normal label. Green = normal operation. Blue = action / limitation.
   Do NOT use red for cautions or amber for warnings.

2. **Guard must be lifted before guarded pb is accessible.** No code path
   may reach the guarded pb action without the guard lifted first.

3. **SQUIB lights WHITE immediately when FIRE pb released.** Not after 10 s.
   The 10 s delay is for the AGENT pb to become pressable, not for SQUIB.

4. **DISCH lights AMBER when bottle has lost pressure** (agent discharged).
   It does NOT light before discharge.

5. **FIRE legend stays RED as long as fire warning is active**, regardless
   of whether the pb has been pushed or not. FCOM: "The red lights come on,
   regardless of the pushbutton position, whenever the fire warning for the
   corresponding engine is activated."

6. **ENG FIRE pb remains on as long as a fire is detected.** FCOM procedure
   line: "ENG FIRE pb remains on, as long as a fire is detected."

7. **AGENT 1 → DISCH delay = 10 s.** FCOM L2 note: "The 10 s delay allows
   N1 to decrease, reducing nacelle ventilation, and thereby increasing the
   effect of the agent." ARM_DELAY_MS = 10_000. Do not change.

8. **AGENT 2 only after AGENT 1 discharged.** Then: if fire persists 30 s
   after AGENT 1, discharge AGENT 2. (FCOM: "IF FIRE AFTER 30 S: AGENT 2
   → DISCH")

9. **No self-generated colours or timings.** Every emissive value, lerp
   speed, intensity, and delay must trace to a row in this skill or a row
   in fcom-full.txt. If no source exists, stop and ask.

10. **Never mutate canonical references.** `engine-fire-panel-mockup.tsx`
    and `runner.tsx` are protected. Read but do not edit without explicit
    user direction.

---

## 1 · FCOM Light Colour Convention (DSC-31-10)

Extracted verbatim from FCOM DSC-31-10-00001202, 13 SEP 16:

| Colour   | Meaning (FCOM verbatim)                                                              |
|----------|--------------------------------------------------------------------------------------|
| **RED**    | The configuration or failure requires **immediate action**.                        |
| **AMBER**  | The flight crew should be **aware** of the configuration or failure, but need not take immediate action. |
| **GREEN**  | The item is **operating normally**.                                                |
| **WHITE**  | These titles and remarks **guide the flight crew** as they execute various procedures. |
| **BLUE**   | These are **actions to be carried out**, or limitations.                           |
| **MAGENTA**| These are particular messages that apply to particular pieces of equipment or situations (inhibition messages, for example). |

### Warning / Caution classification (DSC-31-10-00001203)

| Level   | Colour | Aural              | Visual                    |
|---------|--------|--------------------|---------------------------|
| Level 3 | RED    | Continuous repetitive chime (CRC) | MASTER WARN flash |
| Level 2 | AMBER  | Single chime       | MASTER CAUT flash         |
| Level 1 | AMBER  | None               | ECAM message only         |

---

## 1b · Universal Cell Legend Colour Map

This table applies to **every pushbutton on every panel**.
Source: FCOM DSC-26-20-20, DSC-29-20, DSC-24-20, DSC-36-10, DSC-21-20
and the general indicator colour rule (DSC-31-10).

| Cell text on button face | Colour  | When lit                                    | FCOM verbatim (extract)                                          |
|--------------------------|---------|---------------------------------------------|------------------------------------------------------------------|
| **FAULT**                | AMBER   | System fault detected                       | "This amber light comes on, and the ECAM caution appears, if…"  |
| **ON**                   | WHITE   | Crew has switched system ON                 | "The ON light comes on white." (DSC-21-20)                      |
| **OFF**                  | WHITE   | Crew has selected OFF position              | "OFF: The pump is depressurized." (DSC-29-20)                   |
| **AUTO**                 | DARK    | Normal/auto mode (no light needed)          | AUTO is the normal state — no cell illumination                 |
| **LO PR**                | AMBER   | Low hydraulic / fuel pressure               | "FAULT lt: …pump pressure is low" (DSC-29-20)                   |
| **OVRD**                 | WHITE   | Override selected by crew                   | "OVRD: …override mode selected"                                 |
| **MAN**                  | WHITE   | Manual mode selected                        | "MAN: This legend appears in white" (DSC-21-20 pack)            |
| **ELEC**                 | WHITE   | Electrical mode selected / backup active    | "ELEC: normally white" (DSC-29-20 ECAM)                         |
| **OPEN**                 | WHITE   | Valve/door open (non-fault)                 |                                                                  |
| **CLOSED**               | AMBER   | Valve closed in abnormal context            |                                                                  |
| **FIRE** (legend strip)  | RED     | Fire warning active — regardless of pb pos  | "The red lights come on, regardless of the pushbutton position" |
| **SQUIB**                | WHITE   | FIRE pb released, squibs armed              | "'SQUIB' comes on white when the flight crew releases the …FIRE pb" |
| **DISCH**                | AMBER   | Extinguisher bottle lost pressure           | "'DISCH' comes on amber when the corresponding fire extinguisher bottle has lost pressure." |
| **SMOKE**                | AMBER   | Smoke detected in compartment               | "The amber light comes on when smoke is detected" (DSC-26-xx)   |

Key rules from the table:
- **Only ONE cell is lit at a time per pushbutton** in normal operation.
  Exception: FIRE pbs where FIRE (red) stays lit AND SQUIB (white) is also lit.
- **FAULT always takes priority** — if FAULT is on, ON/OFF/AUTO cells are dark.
- **Button body** = no emissive change, ever. Only the cell text mesh changes.
- **Background behind cell text** = stays dark (`cell_dark` material, emissiveIntensity=0).

---

## 1c · The Complete Button Press Sequence (any alternative-action pb)

```
NORMAL STATE
  • Button face: dark (AUTO, no cell lit)
  • ECAM: normal green system indication

FAULT OCCURS (system detects fault automatically)
  • FAULT cell → AMBER (lit)
  • ECAM: amber caution appears
  • Crew action required

CREW PRESSES BUTTON (switches from AUTO to ON or OFF)
  • Button presses IN (alternative-action, stays in)
  • Active legend (ON / OFF / MAN / OVRD) → WHITE (lit)
  • FAULT cell → DARK (goes out, FCOM: "light goes out when crew selects OFF")
  • ECAM: status changes to reflect crew selection

RESET
  • Crew presses again to return to AUTO
  • All cells → dark again
```

---

## 2 · A320 Pushbutton Types

### 2a · Guarded Spring-Loaded Pushbutton (FIRE pb pattern)

**FCOM DSC-26-20-20:** "The pushbutton normal position is **in**, and
**guarded**. When the flight crew pushes it, the pushbutton is **released**
and sends an electrical signal..."

Characteristics:
- **Normal position**: pressed IN (flush with panel, covered by guard)
- **Guard**: must be lifted before pb is accessible (two-step: lift guard → push pb)
- **Action**: when pushed, the pb **pops/springs OUT** and stays out
- **Red legend**: illuminates whenever the associated warning is active —
  independent of pb position
- Applies to: ENG FIRE pb, APU FIRE pb

Physical animation in THREE.js (GLTF Y-up, after rotation `[π/2, 0, 0]`):
```ts
// Pop OUT = positive GLTF local Y (toward camera)
const POP_OUT_M = 0.003;   // 3 mm outward
mesh.position.y = lerp(mesh.position.y,
  firePbDone ? restY + POP_OUT_M : restY, 0.12);
// ALWAYS move label mesh with body mesh — same delta, same lerp speed
labelMesh.position.y = lerp(labelMesh.position.y,
  firePbDone ? restLblY + POP_OUT_M : restLblY, 0.12);
```

### 2b · Alternative-Action Pushbutton (toggle, e.g. FADEC FAULT reset)

- Pushes IN to one state, pushes again to return
- Legend changes on each press (ON / OFF)
- **ON legend: WHITE** — "The ON light comes on white" (FCOM)
- **FAULT legend: AMBER** — "The FAULT light comes on amber" (FCOM)

### 2c · Spring-Loaded Pushbutton (momentary, e.g. TEST pbs)

- Pushes IN, springs back to OUT immediately on release
- Activates a one-shot function (test, reset, transfer)
- No persistent state change in position

### 2d · Rotary Switch / pb-sw (e.g. AGENT pb-sw)

- Brief push activates function (discharges agent)
- SQUIB cell and DISCH cell on face — see §3

---

## 3 · Fire Panel Pushbutton Behaviour (Reference Implementation)

Source: **FCOM DSC-26-20-20**, ident 00021415–00021420, 01 AUG 17 / 12 APR 18.

### 3a · ENG 1(2) FIRE pb — verbatim FCOM

> "The pushbutton normal position is in, and guarded. When the flight crew
> pushes it, the pushbutton is released and sends an electrical signal that
> performs the following for the corresponding engine:
> – Silences the aural fire warning
> – Arms the fire extinguisher squibs
> – Closes the low-pressure fuel valve
> – Closes the hydraulic fire shut off valve
> – Closes the engine bleed valve
> – Closes the pack flow control valve
> – Cuts off the FADEC power supply
> – Deactivates the IDG.
> The red lights come on, regardless of the pushbutton position, whenever
> the fire warning for the corresponding engine is activated."

### 3b · AGENT 1(2) pb-sw — verbatim FCOM

> "Both AGENT pushbutton-switches of an affected engine become active when
> the flight crew releases the ENG 1(2) FIRE pb.
> A brief push on the pushbutton-switch discharges the corresponding fire agent.
> – 'SQUIB' comes on white when the flight crew releases the ENG 1(2) FIRE
>    pb to help the flight crew identify the AGENT pb-sw to be activated.
> – 'DISCH' comes on amber when the corresponding fire extinguisher bottle
>    has lost pressure."

### 3c · ECAM ENG 1(2) FIRE procedure (IN FLIGHT) — verbatim FCOM

Source: PRO-ABN-ENG, ident 00018190.0002001, 13 SEP 16.

```
L1  THR LEVER (AFFECTED)  ............................  IDLE
    ENG MASTER (AFFECTED)  ...........................  OFF
L2  LP and HP valves close.

L1  ENG FIRE P/B (AFFECTED)  ........................  PUSH
L2  Aural warning stops.
    ENG FIRE pb remains on, as long as a fire is detected.
    FADEC is no longer supplied.

L1  AGENT 1 AFTER 10 S  .............................  DISCH
L2  The 10 s delay allows N1 to decrease, reducing nacelle ventilation,
    and thereby increasing the effect of the agent.
    Automatic countdown on the ECAM.

L1  ATC  .............................................  NOTIFY
L2  Notify ATC of the nature of the emergency, and state intentions.

    IF FIRE AFTER 30 S:
L1    AGENT 2  .......................................  DISCH
L2    Discharge the second agent, if the fire warning remains 30 s after
      the discharge of the first agent.
```

---

## 4 · Light State Table — Fire Panel

| Mesh              | NORMAL | FIRE_WARN | PB_PUSHED | AGENT1_DISCH | AGENT2_DISCH |
|-------------------|--------|-----------|-----------|--------------|--------------|
| FIRE legend lbl   | WHITE  | **RED**   | RED       | RED          | RED          |
| FIRE pb body      | off    | off       | off       | off          | off          |
| SQUIB A1 text     | off    | off       | **WHITE** | **off**      | off          |
| SQUIB A2 text     | off    | off       | **WHITE** | WHITE        | **off**      |
| DISCH A1 text     | off    | off       | off       | **AMBER**    | AMBER        |
| DISCH A2 text     | off    | off       | off       | off          | **AMBER**    |
| SQUIB bg (A1/A2)  | off    | off       | off       | off          | off          |
| DISCH bg (A1/A2)  | off    | off       | off       | off          | off          |
| FIRE bar strip    | WHITE  | WHITE     | WHITE     | WHITE        | WHITE        |
| Guard             | closed | closed    | open      | open         | open         |

Rules:
- **FIRE legend** = red whenever `fireDetected === true`, regardless of pb position.
- **SQUIB text** = white immediately when `firePbDone === true` (not after 10 s).
- **DISCH text** = amber immediately when `agentNDisch === true`.
- **Backgrounds (SQbg, DCbg)** = always off — only the TEXT mesh lights up.
- **FIRE bar** = always white (it is a static label strip, not a warning lamp).
- **pb body** = no emissive change — its natural material colour is always shown.

## Baseline Example (Lights + Pushbuttons)

Use the ENG 1 3D fire panel as the canonical baseline for guarded pushbutton
behaviour, SQUIB/DISCH timing, and cell-level light logic:

- `src/components/cockpit/fire-panel-3d.tsx` (runtime state machine + lighting)
- `src/app/dev/fire-panel-3d/page.tsx` (interactive validation route)
- `public/models/eng1_left_panel.glb` (Blender-exported panel model)

When implementing lights on any other panel, mirror this baseline's pattern:
guard sequence, per-cell emissive updates, and strict FCOM colour mapping.

---

## 5 · THREE.js / R3F Implementation Pattern

### 5a · Emissive intensity scale (cockpit lamp reference)

| Material role          | Intensity | Source                        |
|------------------------|-----------|-------------------------------|
| Static label (wtext)   | 4.0       | Blender KHR_emissive_strength |
| White border (wborder) | 3.0       | Blender KHR_emissive_strength |
| WHITE legend active    | 3.0–4.0   | Match wtext scale             |
| RED legend active      | 4.5–5.0   | Brighter than white to "pop"  |
| AMBER legend active    | 2.5       | Below red, above off          |
| Hint glow (teal ring)  | 0.3–0.7   | Subtle click affordance       |
| Off / unlit            | 0.0       | No emission                   |

### 5b · Reusable `em()` helper

```ts
const em = (name: string, col: THREE.Color, intensity: number) => {
  const mesh = meshes[name];
  if (!mesh) return;
  const mat = getMat(mesh) as THREE.MeshStandardMaterial;
  mat.emissive.copy(col);
  mat.emissiveIntensity = intensity;
};
```

### 5c · Colour constants

```ts
const C3 = {
  red:   new THREE.Color("#FF3333"),   // FCOM RED   — immediate action
  amber: new THREE.Color("#FFB300"),   // FCOM AMBER — awareness
  white: new THREE.Color("#E8ECF4"),   // FCOM WHITE — label / normal
  off:   new THREE.Color(0, 0, 0),    // unlit
} as const;
```

### 5d · Guard + FIRE pb state machine (canonical template)

```ts
// ── State derivation ──────────────────────────────────────────────────────
const el1    = firePbOutAt ? Date.now() - firePbOutAt : 0;
const armed1 = firePbDone && !agent1Disch && el1 >= ARM_MS; // AGENT 1 clickable
const armed2 = agent1Disch && !agent2Disch;                  // AGENT 2 clickable

// ── FIRE legend (ENG1_FIRE_lbl) — text mesh only, never the body ─────────
// RED whenever fire warning active; WHITE at rest (static label)
if (fireLblMesh) {
  const m = getMat(fireLblMesh);
  m.emissive.copy(fireDetected ? C3.red : C3.white);
  m.emissiveIntensity = fireDetected ? 5.0 : 4.0;
}

// ── FIRE pb body (ENG1_FirePb) — position only, NO emissive override ─────
// Pop OUT when pushed; return to rest on reset.
const POP_OUT_M = 0.003;
if (firePbMesh) {
  firePbMesh.position.y = lerp(firePbMesh.position.y,
    firePbDone ? restPbY + POP_OUT_M : restPbY, 0.12);
}
if (fireLblMesh) {
  fireLblMesh.position.y = lerp(fireLblMesh.position.y,
    firePbDone ? restLblY + POP_OUT_M : restLblY, 0.12);
}

// ── SQUIB text — WHITE immediately on FIRE pb release ────────────────────
em("ENG1_A1_SQ", firePbDone ? C3.white : C3.off, firePbDone ? 3.0 : 0);
em("ENG1_A2_SQ", firePbDone ? C3.white : C3.off, firePbDone ? 3.0 : 0);
em("ENG1_A1_SQbg", C3.off, 0); // background stays dark
em("ENG1_A2_SQbg", C3.off, 0);

// ── DISCH text — AMBER when agent discharged (bottle lost pressure) ───────
em("ENG1_A1_DC", agent1Disch ? C3.amber : C3.off, agent1Disch ? 2.5 : 0);
em("ENG1_A2_DC", agent2Disch ? C3.amber : C3.off, agent2Disch ? 2.5 : 0);
em("ENG1_A1_DCbg", C3.off, 0); // background stays dark
em("ENG1_A2_DCbg", C3.off, 0);

// ── Guard hinge pivot (see §6 for math) ──────────────────────────────────
// ── Teal ring hint glow — usability affordance when agent clickable ───────
em("ENG1_A1_TR", armed1 ? C3.white : C3.off, armed1 ? 0.4 + pulse * 0.3 : 0);
em("ENG1_A2_TR", armed2 ? C3.white : C3.off, armed2 ? 0.4 + pulse * 0.3 : 0);
```

### 5e · Guard hinge pivot math (canonical)

The guard mesh origin is at its **centre**. The real hinge is at the **top
edge**, 15.2 mm above centre in Blender local Y → GLTF local Z = −0.0152 m.

```ts
const HINGE_DIST  = 0.0152;            // 15.2 mm centre → hinge
const TARGET_OPEN = -(Math.PI * 2) / 3; // −120° matches DOM rotateX(−120deg)

guardMesh.rotation.x = lerp(guardMesh.rotation.x,
  (guardOpen || firePbDone) ? TARGET_OPEN : 0, 0.08);

const θ  = guardMesh.rotation.x;
const rp = restPositions["ENG1_Guard"];
if (rp) {
  guardMesh.position.y = rp.y - HINGE_DIST * Math.sin(θ);
  guardMesh.position.z = rp.z + HINGE_DIST * (Math.cos(θ) - 1);
}
```

### 5f · Boolean cutter objects — always hide

Objects used as Blender boolean modifiers have no material and render grey.
Hide them immediately after cloning the GLTF scene:

```ts
clone.traverse(obj => {
  if (obj instanceof THREE.Mesh) {
    if (/cut$/i.test(obj.name) || obj.name.endsWith("WRC")) {
      obj.visible = false;
    }
  }
});
```

### 5g · Canvas sharpness (Retina displays)

Always add `dpr={[1, 2]}` to the `<Canvas>` element. Without it, the
renderer uses 1× pixel density and looks blurry on Retina screens.

```tsx
<Canvas dpr={[1, 2]} camera={{ fov: 18, near: 0.01, far: 2, position: [...] }}>
```

---

## 9 · Per-Panel FCOM Reference Index

When building a new panel, open fcom-full.txt at the DSC section for that
panel. Grep: `grep -n "DSC-XX-20\|Controls and Indicators" fcom-full.txt`

| Panel          | FCOM Section  | Line approx. | Key lights to find            |
|----------------|---------------|--------------|-------------------------------|
| FIRE           | DSC-26-20-20  | 44390        | FIRE (red), SQUIB (wh), DISCH (amb) |
| HYDRAULIC      | DSC-29-20     | 50791        | FAULT (amb), LO PR (amb), ON (wh) |
| ELECTRICAL     | DSC-24-20     | ~42400       | FAULT (amb), ON (wh), SMOKE (amb) |
| AIR COND/BLEED | DSC-21-20     | ~8700        | FAULT (amb), ON (wh), MAN (wh) |
| FUEL           | DSC-28-20     | ~49500       | FAULT (amb), ON (wh), LO PR (amb) |
| ANTI-ICE       | DSC-30-20     | ~50100       | FAULT (amb), ON (wh)           |
| PRESS          | DSC-21-50     | ~9400        | FAULT (amb), MAN (wh)          |
| OXYGEN         | DSC-35-20     | ~66400       | ON (wh)                        |
| APU            | DSC-49-20     | ~70800       | FAULT (amb), AVAIL (green)     |
| ENG MASTER     | DSC-70-20     | ~50500       | FAULT (amb), ON (wh)           |

---

## 10 · Blender Material Naming Convention

When building any panel in Blender, name materials using this exact convention
so that THREE.js emissive overrides can target them consistently.

| Material name   | Base colour | Emissive | em_str | Purpose                                     |
|-----------------|-------------|----------|--------|---------------------------------------------|
| `panel`         | #33607A     | none     | 0      | Panel background body                       |
| `pb_black`      | #0F1015     | none     | 0      | Pushbutton body cap (never changes)         |
| `cell_dark`     | #030305     | none     | 0      | Cell background behind text (always dark)   |
| `dim_text`      | #1A1E25     | none     | 0      | Unlit cell text (FAULT/ON/OFF when off)     |
| `wtext`         | #E8ECF4     | #FFFFFF  | 4      | Static white panel label (always on)        |
| `wborder`       | #FFFFFF     | #FFFFFF  | 3      | White border around pushbutton face         |
| `lit_white`     | #FFFFFF     | #FFFFFF  | 6      | Cell text when lit WHITE (ON, SQUIB, OFF)   |
| `lit_amber`     | #FFB300     | #FFB300  | 6      | Cell text when lit AMBER (FAULT, DISCH, LO PR) |
| `lit_red`       | #FF2010     | #FF2010  | 6      | Cell text when lit RED (FIRE warning only)  |
| `lit_green`     | #3FAA60     | #3FAA60  | 4      | Cell text when lit GREEN (normal/AVAIL)     |
| `teal_ring`     | #6E9292     | none     | 0      | Subtle click affordance ring                |
| `screw`         | #C8CED6     | none     | 0      | Screw heads                                 |

**Critical Blender rule**: Each cell that can light up needs **two meshes**:
1. `{PB_NAME}_{CELL}_bg` — background quad, material `cell_dark` (always dark)
2. `{PB_NAME}_{CELL}` — text mesh, material `dim_text` at rest

In THREE.js the text mesh emissive is overridden at runtime. The background
mesh is never changed. Do not combine bg and text into one mesh.

**Naming pattern for cell meshes** (must be consistent across all panels):
```
{SYS}_{PB}_{CELL}      e.g.  HYD_ENG1_FAULT,  HYD_PTU_FAULT
{SYS}_{PB}_{CELL}bg    e.g.  HYD_ENG1_FAULTbg, HYD_PTU_FAULTbg
```

---

The same pattern applies to every guarded spring-loaded pb on the A320.

| Panel          | Guarded pb   | Guard lifts for         | Legend colour | SQUIB/DISCH analogue       |
|----------------|--------------|-------------------------|---------------|----------------------------|
| FIRE panel     | ENG FIRE pb  | FIRE pb push            | RED           | SQUIB white / DISCH amber  |
| FIRE panel     | APU FIRE pb  | APU FIRE pb push        | RED           | SQUIB white / DISCH amber  |
| ELEC panel     | EMER GEN TEST| test function           | WHITE (ON)    | n/a                        |
| FUELG panel    | FUEL DUMP    | dump function           | AMBER (FAULT) | n/a                        |
| AIR COND panel | DITCHING     | ditching mode           | WHITE (ON)    | n/a                        |

**Template for any guarded spring-loaded pb:**
1. Guard tap 1 → lift guard, optionally trigger associated warning/event
2. Guard lifted + condition met → pb becomes pressable
3. pb push → pb pops OUT, legend illuminates (colour per FCOM table above)
4. Associated indicator cells light up (SQUIB/FAULT/ON — colour per FCOM)
5. Next action (AGENT/DISCH/RESET) activates after pb released
6. RESET → lerp all meshes back to restY, clear all emissive states

---

## 7 · ECAM Link Rules

Each FIRE pb push maps directly to an ECAM L1 action line:

| Physical action          | ECAM L1 line (verbatim FCOM)          | Timing          |
|--------------------------|---------------------------------------|-----------------|
| ENG FIRE P/B push        | `ENG FIRE P/B (AFFECTED) ... PUSH`    | Immediate       |
| AGENT 1 discharge        | `AGENT 1 AFTER 10 S ... DISCH`        | After 10 s      |
| AGENT 2 discharge        | `AGENT 2 ... DISCH`                   | If fire after 30 s |

When implementing scenario steps, the `stepId` of the pb action must match
the ECAM L1 verb exactly. Accepted verbs: PUSH, DISCH, OFF, ON, CHECK,
NOTIFY. Do not substitute synonyms.

---

## 8 · Known Gotchas

1. **Label mesh ≠ body mesh.** `ENG1_FIRE_lbl` (text, `wtext` mat) and
   `ENG1_FirePb` (body, `pb_red` mat) are separate objects. Setting emissive
   on the body washes out the text. Always target the label mesh for emissive.
   Move BOTH meshes together on pop-out.

2. **Press axis is GLTF local Y, not Z.** After `rotation={[π/2, 0, 0]}`,
   GLTF Y = Blender Z = panel depth. Pop-out = `position.y += delta`.
   GLTF Z = Blender −Y = vertical axis. Do NOT use `position.z` for depth.

3. **Backgrounds (SQbg, DCbg) stay dark.** Only the text mesh (SQ, DC) lights.

4. **Cutter objects cause grey blobs.** Hide any mesh whose name ends with
   `cut` (case-insensitive) or `WRC` at scene-clone time (see §5f).

5. **Emissive must be cloned per instance.** Clone materials after cloning
   the scene; otherwise all instances share the same material and emissive
   mutations bleed across them.

6. **KHR_emissive_strength baked values.** `wtext`=4, `fire_bar`=4,
   `wborder`=3, `white`=5. Do NOT override these with values below their
   baked value in states where they should be at normal brightness.

7. **Guard local state must reset on RESET.** The guard `guardOpen` useState
   and the `firePbWallMs` timer must both be cleared when the parent resets
   `fireDetected` and `firePbDone` to false.
   ```ts
   useEffect(() => {
     if (!fireDetected && !firePbDone) {
       setGuardOpen(false);
       setFirePbWallMs(null);
     }
   }, [fireDetected, firePbDone]);
   ```

---

## 6 · Working Reference Implementation — ENG 1 Fire Panel

> **Status: DECENT BASELINE — lights + logic correct per FCOM, visual polish ongoing.**
> Use as a starting point. Upgrade before production use.

**File:** `src/components/cockpit/fire-panel-3d.tsx`
**GLB:** `public/models/eng1_left_panel.glb`
**Dev page:** `src/app/dev/fire-panel-3d/page.tsx` → `http://localhost:3000/dev/fire-panel-3d`

### Verified FCOM behaviours (working)

| State | Panel shows | FCOM ref |
|-------|-------------|----------|
| Rest (no fire) | FIRE body dark, PUSH label visible, guard down | DSC-26-20-20 |
| Fire warning | FIRE body + label glow `#F10C00`, guard still down | DSC-26-20-20: "red lights come on regardless of pushbutton position" |
| FIRE pb pushed | Button pops OUT 8 mm, guard lifts −120°, SQUIB white on A1+A2 | DSC-26-20-20: "SQUIB comes on white when the flight crew releases the FIRE pb" |
| AGENT 1 DISCH | A1 SQUIB goes **off** (squib fired), A1 DISCH lights **amber** | DSC-26-20-20: "DISCH comes on amber when the bottle has lost pressure" |
| AGENT 2 DISCH | A2 SQUIB goes **off**, A2 DISCH lights **amber** | same |
| RESET | Guard returns, button snaps in, all lights off | local state cleared via useEffect |

### Key implementation decisions recorded here

- **`NoToneMapping`** on Canvas `gl` prop — ensures `#F10C00` renders as exact hex, no ACES orange shift
- **Light intensities tuned for `NoToneMapping`**: ambient 0.55, key dir 2.4, fill dir 0.7
- **`bodyMat.color.set(0,0,0)` when fire active** — zeroes diffuse so white directional light cannot contaminate the pure red emissive (the "white stone on red" fix)
- **`dpr={2}` hardcoded** — guarantees Retina sharpness on all Macs; not `dpr={[1,2]}`
- **`fov: 22` at `Z: 0.18`** — 70 mm visible height, shows full panel including ENG I title bar
- **8 mm pop-out** — visible at Z=0.18 camera distance; 3 mm was imperceptible
- **`originalColors` useMemo** — saves cloned material diffuse colours so they can be restored on RESET

### What still needs upgrading before production

- [ ] Pop-out animation needs a subtle shadow/rim to emphasise depth in flat lighting
- [ ] FIRE bar label (`ENG1_FireBar`) should pulse or flash during active warning per real ECAM behaviour
- [ ] 10-second arming countdown has no visible UI feedback on the 3D panel itself
- [ ] Scenario integration: props wired to scenario engine steps, not HTML test buttons
- [ ] ECAM link: FIRE pb push must suppress the ECAM fire page (§7 ECAM link rules)
- [ ] Camera should be driven by the scenario page layout, not hardcoded in the component
