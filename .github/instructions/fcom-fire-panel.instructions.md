---
applyTo: "src/components/cockpit/fire-panel*.tsx,src/components/cockpit/engine-fire*.tsx,src/app/**/fire-panel*/**"
description: >
  FCOM fire panel skill — Use this when implementing, modifying, testing, or
  debugging ANY A320 engine fire panel (DOM or Three.js/GLB).  Covers: FCOM
  procedure DSC-26-20-20, colour palette, guard hinge pivot math, press-in
  axis, arming timing, and all Three.js/GLTF coordinate rules.
  Trigger keywords: fire panel, FIRE PB, guard, SQUIB, DISCH, agent discharge,
  eng1 fire, engine fire panel, fire-panel-3d, blender fire panel.
---

# A320 Engine Fire Panel — FCOM Skill

Hub tag: ENG1_FIRE_PANEL_HUB_BASELINE_V1

## 0 · Hard Rules (never break)

1. `ARM_DELAY_MS = 10_000` — ECAM "AGENT 1 AFTER 10 S → DISCH". Do not change.
2. Guard MUST be lifted (tap 1) before the FIRE PB can be pushed (tap 2).
3. AGENT 1 pb is NOT active until `Date.now() − firePbOutAt >= 10_000`.
4. AGENT 2 is NOT active until AGENT 1 has discharged.
5. Never mutate `engine-fire-panel-mockup.tsx` — it is the canonical DOM reference.
6. Never mutate `runner.tsx` unless the user explicitly directs it.
7. `eng1_left_panel.blend` → `public/models/eng1_left_panel.glb` is the
   canonical Blender GLB. Export script: `blender/eng1_left/export_glb.py`.

---

## 1 · FCOM State Machine (DSC-26-20-20)

| State        | Trigger                              | Abbrev     |
|--------------|--------------------------------------|------------|
| NORMAL       | Default on load                      | `NORMAL`   |
| FIRE_WARN    | `fireDetected = true`                | `WARN`     |
| GUARD_OPEN   | Crew tap 1 on guard mesh/element     | `GUARD`    |
| PB_PUSHED    | Crew tap 2 on FIRE PB (guard open)   | `PBOUT`    |
| ARMING       | 0–10 s after PB pushed               | `ARM`      |
| ARMED_1      | ≥ 10 s after PB pushed               | `RDY1`     |
| AGENT1_DISCH | Crew pushes AGENT 1                  | `DISCH1`   |
| ARMED_2      | Immediately after AGENT1_DISCH       | `RDY2`     |
| AGENT2_DISCH | Crew pushes AGENT 2                  | `DISCH2`   |

State derivation in code:
```ts
const el1     = firePbOutAt ? Date.now() - firePbOutAt : 0;
const arming1 = firePbDone && !agent1Disch && el1 < ARM_MS;   // SQUIB amber pulse
const armed1  = firePbDone && !agent1Disch && el1 >= ARM_MS;  // SQUIB solid white
const armed2  = agent1Disch && !agent2Disch;                  // A2 SQUIB solid white
```

---

## 2 · Colour Palette

| Indicator           | CSS hex   | Three.js constant            |
|---------------------|-----------|------------------------------|
| Fire warning red    | `#FF3333` | `new THREE.Color("#FF3333")` |
| Arming amber        | `#FFB300` | `new THREE.Color("#FFB300")` |
| Armed/lit white     | `#E8ECF4` | `new THREE.Color("#E8ECF4")` |
| Off (unlit cell)    | black     | `new THREE.Color(0, 0, 0)`   |

Pulse formula (1 Hz, range 0–1):
```ts
const pulse = Math.sin(clock.getElapsedTime() * Math.PI * 2) * 0.5 + 0.5;
```

Visual rules per mesh:
- **FIRE PB** (`ENG1_FirePb`): no glow at rest → red pulse during WARN → faint red after PBOUT
- **FireBar** (`ENG1_FireBar`): white 0.90 at rest → red pulse during WARN
- **SQUIB bg** (`ENG1_A1_SQbg`, `ENG1_A2_SQbg`): off → amber pulse during ARM → white solid during RDY
- **DISCH bg** (`ENG1_A1_DCbg`, `ENG1_A2_DCbg`): off → amber solid after DISCH
- **Teal ring** (`ENG1_A1_TR`, `ENG1_A2_TR`): off → faint white pulse when respective agent is RDY

---

## 3 · GLTF / Three.js Coordinate System

The model is built in **Blender XY plane** (Z = depth).  
GLTF Y-up export convention: **Blender Z → GLTF Y**, **Blender Y → GLTF −Z**.

| Blender axis | GLTF local axis | After primitive `rotation={[π/2, 0, 0]}` → world axis |
|--------------|-----------------|--------------------------------------------------------|
| X (horiz)    | local X         | World X (unchanged)                                    |
| Z (depth)    | local Y         | World **+Z** (toward camera)                           |
| Y (vert↑)    | local **−Z**    | World **−Y** (downward)                                |

> **PRESS-IN AXIS = local Y** (GLTF).  Panel depth (Blender Z) becomes GLTF Y.
> `mesh.position.y -= 0.0015` moves the button INTO the panel (world −Z).
> **Do NOT use `position.z` for press-in** — that is the vertical axis after rotation.

---

## 4 · Guard Hinge Pivot Math

### Why it matters
`ENG1_Guard` origin in Blender is at the **centre** of the guard (local Y=0).  
The real hinge is at the **top edge** at Blender local Y = +15.2 mm.  
After GLTF export the hinge offset in GLTF local space is **Z = −0.0152 m**.

### Pivot offset trick (no scene-graph reparenting needed)

Store the mesh's rest position at mount time:
```ts
const restPositions = useMemo(() => {
  const map: Record<string, THREE.Vector3> = {};
  root.traverse(obj => {
    if (obj instanceof THREE.Mesh) map[obj.name] = obj.position.clone();
  });
  return map;
}, [root]);
```

In `useFrame`, apply pivot-corrected position whenever you update rotation:
```ts
const HINGE_DIST = 0.0152; // 15.2 mm, guard-centre → top-edge hinge
const TARGET_OPEN  = -(Math.PI * 2) / 3; // −120° — matches DOM rotateX(−120deg)
const TARGET_CLOSE = 0;

const guardMesh = meshes["ENG1_Guard"];
if (guardMesh) {
  const lifted  = guardOpen || firePbDone;
  const targetX = lifted ? TARGET_OPEN : TARGET_CLOSE;
  guardMesh.rotation.x = THREE.MathUtils.lerp(guardMesh.rotation.x, targetX, 0.08);
  const θ  = guardMesh.rotation.x;
  const rp = restPositions["ENG1_Guard"];
  if (rp) {
    guardMesh.position.y = rp.y - HINGE_DIST * Math.sin(θ);
    guardMesh.position.z = rp.z + HINGE_DIST * (Math.cos(θ) - 1);
  }
}
```

Math proof (pivot-offset rotation):
- Pivot world pos = restPos + (0, 0, −HINGE_DIST)  
- After rotation θ around X through pivot: centre_new = pivot + R_x(θ)·(0, 0, +HINGE_DIST)  
- Δy = −HINGE_DIST · sin(θ),  Δz = HINGE_DIST · (cos(θ) − 1)

### Guard mesh reference data (eng1_left_panel.blend)
| Property | Value |
|---|---|
| Blender world origin | (0, 0, 4.45 mm) |
| Local bbox X | [−17.5, +16.0] mm |
| Local bbox Y | [−15.1, +15.2] mm — hinge at +15.2 |
| Local bbox Z | [−0.4, +0.4] mm — nearly flat |
| Material | `guard_red` (#E80F0F, no emissive) |
| GLTF rest position | approx (0, 0.00445, 0) |

---

## 5 · Press-In Animation (all pushbuttons)

Store rest Y per mesh, then lerp against it:
```ts
const restY = restPositions["ENG1_FirePb"]?.y ?? 0;

// Pressed-in (PBOUT state):
firePbMesh.position.y = THREE.MathUtils.lerp(
  firePbMesh.position.y, restY - 0.0015, 0.12);

// At rest:
firePbMesh.position.y = THREE.MathUtils.lerp(
  firePbMesh.position.y, restY, 0.15);
```

Same pattern for `ENG1_A1_Body` and `ENG1_A2_Body` with `− 0.001` offset.

---

## 6 · Three.js Component Checklist

- [ ] Deep-clone `scene` on mount; clone all materials so instances don't share state
- [ ] Build `restPositions` map from the clone (not from `scene`)
- [ ] Lighting: `ambientLight 0.25 + directionalLight 1.6 + fill 0.4` (matches Blender setup)
- [ ] Camera: `orthographic`, framed to `left:−0.060, right:0.050, top:0.033, bottom:−0.025`
- [ ] Never change `mat.color` — only `mat.emissive` + `mat.emissiveIntensity`
- [ ] `useGLTF.preload("/models/eng1_left_panel.glb")` at module scope
- [ ] Wrap in `<Suspense fallback={null}>` inside `Canvas`
- [ ] Mount-guard (`const [mounted] = useState(false)`) to skip SSR Canvas

---

## 7 · Blender Model Mesh Inventory

| Mesh name       | Role                        | Material     |
|-----------------|-----------------------------|--------------|
| `ENG1_FirePb`   | Fire pushbutton face        | `pb_red`     |
| `ENG1_FireBar`  | Left vertical fire-warn bar | `fire_bar`   |
| `ENG1_Guard`    | Wire guard cage             | `guard_red`  |
| `ENG1_A1_SQbg`  | Agent 1 SQUIB cell bg       | `cell_dark`  |
| `ENG1_A1_DCbg`  | Agent 1 DISCH cell bg       | `cell_dark`  |
| `ENG1_A1_TR`    | Agent 1 teal ring border    | `teal_ring`  |
| `ENG1_A1_Body`  | Agent 1 pushbutton body     | `pb_black`   |
| `ENG1_A2_SQbg`  | Agent 2 SQUIB cell bg       | `cell_dark`  |
| `ENG1_A2_DCbg`  | Agent 2 DISCH cell bg       | `cell_dark`  |
| `ENG1_A2_TR`    | Agent 2 teal ring border    | `teal_ring`  |
| `ENG1_A2_Body`  | Agent 2 pushbutton body     | `pb_black`   |
| `ENG1_TEST`     | TEST pushbutton             | `test_blk`   |
| `ENG1_TESTdot`  | TEST indicator dot          | `white`      |
| Panel           | Panel background plate      | `panel`      |
| `Scr_*`         | Corner screws               | `screw`      |

Additional (not animated yet): `ENG1_JIn`, `ENG1_JOut`, `ENG1_OvCut`,
`ENG1_GlsCut`, `ENG1_WRC`, `ENG1_WRO`, `ENG1_CavCut`

---

## 8 · Known Gotchas

1. **`THREE.Clock` is deprecated** — use R3F's `clock.getElapsedTime()` from `useFrame`.
2. **Mesh name `ENG1_A1_SQ` does not exist** in the blend — only `ENG1_A1_SQbg`. Don't call `em("ENG1_A1_SQ", ...)`.
3. **Blender layout quirk**: A1 is LEFT of FirePb, A2 is RIGHT (not standard A320 layout).
4. **Materials already baked**: `wborder`, `wtext`, `fire_bar`, `white` have emissive strength > 0 from Blender. Text labels and fire bar will glow at all times without code intervention.
5. **Guard animation**: After global `rotation={[π/2, 0, 0]}` on primitive, guard's local X-axis rotation is correct for the hinge sweep — but MUST apply position offset (§4 above) or the guard rotates around its centre instead of hinge.

---

## 9 · Baseline Implementation (Use This First)

Treat this as the canonical baseline for fire-panel lights, timing, and click logic:

- `src/components/cockpit/fire-panel-3d.tsx`
- `src/app/dev/fire-panel-3d/page.tsx`
- `public/models/eng1_left_panel.glb`

If a new fire panel diverges from this baseline, document the reason and map it
back to a specific FCOM line before merging.
