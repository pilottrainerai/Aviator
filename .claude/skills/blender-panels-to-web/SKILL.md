---
name: blender-panels-to-web
description: The repeatable bridge that turns a Blender cockpit panel into a working, interactive React-Three-Fiber panel on localhost. Use whenever the user hands over a Blender/GLB cockpit panel (FIRE, overhead, pedestal, glareshield, any pushbutton/switch/guard/indicator) and wants it rendered faithfully AND clickable on the web app, with lights/guards/buttons behaving per FCOM/FO logic. Sibling of `blender-panels` (which authors the panel IN Blender) and `cockpit-ui` (FCOM visual spec). This skill owns the GLB→localhost→interaction conversion. It encodes the lessons that cost weeks on the FIRE panel so the next panel takes hours. Proven base case: the FIRE panel (ENG1+APU+ENG2) at /dev/fire-test-panel-3d.
---

# Blender Panels → Web — the conversion & interaction playbook

**Goal:** user gives a Blender file (or GLB) → you produce a faithful, interactive
panel at `localhost:3004/dev/<panel>-3d`, lights/guards/buttons working to FCOM/FO
logic, then save it as that panel's base model. The FIRE panel is the proven base
case — copy `src/components/cockpit/fire-test-panel-3d.tsx` and adapt.

> **Two sibling skills, one job each.** `blender-panels` builds the geometry IN
> Blender from references. `cockpit-ui` / `a320-fcom-trainer` give the FCOM visual
> + behaviour spec. THIS skill converts the resulting GLB into a live web panel.
> For the "lights working per FO logic" step, pull the spec from
> `a320-fcom-trainer` (procedure/ECAM/light logic) — never invent behaviour.

---

## 0. Hard rules (the expensive lessons — never relearn them)

1. **Never break working state.** A committed base model must exist before you
   touch anything (see [[feedback_do_not_break_working_state]]). Change only what's
   asked. Prefer surgical edits over rewrites — broad "remakes" reintroduce bugs.
2. **Select parts by MATERIAL + WORLD POSITION, never by node name.** `GLTFLoader`
   sanitizes names (spaces/dots → `_`) and turns multi-primitive nodes into Groups.
   Names that lined up for one section won't for the next. Material name + position
   is stable across every section.
3. **Click resolution is POSITION-BASED (`e.point`), not hitbox/name-based.**
   Hitbox + name approaches passed headless tests but failed in the real browser
   for some sections. Acting on the control nearest the clicked 3D world point is
   the only approach that worked for ALL sections. (§5)
4. **Colors come from UNLIT MeshBasicMaterial.** A lit material + `NoToneMapping`
   clips amber→yellow. Face and legend words must be `MeshBasicMaterial`
   (`toneMapped:false`). Renderer uses `NoToneMapping`. (§3, §6)
5. **A guard's "open" pose is a FIXED DELTA from its closed rest — not its authored
   rotation.** Only the first guard may be authored open; the rest are authored
   closed (0,0,0). Rotating each by `GUARD_OPEN_DELTA` (≈ −2.443 rad ≈ −140°)
   lifts them all identically. (§5)
6. **The onState/report effect MUST have a dependency array.** A no-deps
   `useEffect` that reports drill state loops forever and FREEZES the live browser.
   It passes headless tests only because of inter-click sleeps. Use
   `}, [drillVer, onState]);`. (§5)
7. **Prefer a clean Blender RE-BAKE over pixel-patching the texture.** Patching the
   baked PNG creates seams / double borders / color drift that compound. If the
   face is wrong (shadows, marks, mismatched blue), fix it in Blender and re-bake
   COMBINED with shadow-casters hidden. (§7)
8. **Keep the Blender source pristine.** Re-bake via a *script* that hides meshes,
   bakes, saves the PNG, and exits WITHOUT saving the .blend. Default answer to
   "save the .blend?" is DON'T SAVE.
9. **TEXT MUST BE CRISP — supersample every cockpit Canvas.** This is a standing
   product requirement (user: "they have to look crisp like this... I don't have to
   tell you again"). Thin decal labels (ON/OFF/MASTER/CRANK…) and small geometry
   text (FIRE/FAULT, SQUIB/DISCH) blur at the native pixel ratio while only big text
   stays sharp. Fix: `dpr={cockpitDpr()}` (`src/components/cockpit/cockpit-dpr.ts`),
   which supersamples to ~1.6× the device ratio (capped 3). NEVER use a `dpr={[1,2]}`
   RANGE — R3F clamps the range to the display's own ratio, so it never supersamples.
   Also set `faceTex.anisotropy = 16`. Applies to EVERY cockpit panel (fire + ENG
   START + all future ones). CAVEAT: a CSS `scale()` zoom re-softens the canvas — use
   true camera zoom or frame-resize, not CSS scale, when crispness must survive zoom.
10. **APPLY THE FULL §10 FINAL TREATMENT ON THE FIRST PASS — never a "basic" material
   pass.** Standing requirement (user: "whenever you input we need to apply the same
   logic same skills... I do have to tell you every time"). The MOMENT a panel is
   brought to web it must load in the FINAL/shipped format — right texture, right
   colour, right metallic finish — nothing missed. That means §10 in full, every time:
   §10a LIT metallic face (MeshPhysical, legends stay unlit on top), §10b finish values
   (roughness 0.6 / metalness 1.5 / clearcoat / envMapIntensity), §10c the text-
   protection MASK (metalnessMap+clearcoatMap so finish lands only on the panel field,
   text/lines stay matte), §10d reflections isolated (env-bind the PANEL materials
   only), §10e part materials by name (matte-black buttons #0b0d10 rough 1 metal 0
   env 0; guard housing metal 0.7 rough 0.32; legends visible-dim → glow), §10h lighting
   rig + camera + `cockpitDpr()`. `evac-3d.tsx` is the canonical leaner example (shares
   the same material names: hydraulic decals / Blue base / black button / Material /
   emissive). Do NOT ship a quick MeshBasic/clone first pass and "polish later".
11. **EVERY pushbutton gets the full PB treatment — colours (cap + border) AND the
    NEUTRAL/IN/STAYS press logic — checked on EVERY new Blender panel.** Standing
    requirement (user, HYD panel 2026-06-16: "for any push button check its border and
    cap color as well neutral in and stays logic as rule and skill when we bring new
    blender"). For each pushbutton-type control (see §11 below):
    - **Cap = the CANVAS backdrop colour, rendered UNLIT** (`MeshBasicMaterial`,
      `toneMapped:false`). A LIT matte material always reflects ~4% dielectric specular
      → washes a dark cap to grey and never matches the canvas at the same hex. Unlit =
      the cap shows its exact tone. HYD base: cap `#05070a` (canvas).
    - **Border/bezel frame + any guarded-switch plates = lifted tones for CONTRAST**,
      also UNLIT so the hex shows exactly (a lit plate never matches an unlit cap).
      HYD base: border/frame `#333949`, RAT switch `#222734`. The cap–border gap is the
      contrast that makes the button read; same tone everywhere = a flat black field.
    - **Plates move NEUTRAL→IN→STAYS** along the panel normal (absolute offsets added to
      baseY, NOT deltas): only the CAP + its legends move; the BORDER and any guarded
      switch (e.g. RAT) stay at their imported Blender position. HYD base: neutral 0.008,
      in −0.03, stays −0.014. Expose all of it in the dev edit bar (3 colour pickers +
      3 position sliders + a readout; bump the `localStorage` key whenever you change a
      baked default, or the user's stale saved value keeps overriding it).
    - **Three gotchas that silently break this:** (a) classify parts from material names
      *before* the §10 remap (remap renames `emissive→legend`, `decals→face`) or legends
      get dropped from the moving set and the text won't travel with the cap; (b) the
      press is along the panel NORMAL = the face-on camera's view axis, so it's invisible
      face-on — verify from an OBLIQUE orbit; (c) a slider only moves the cap while its
      own position is being previewed — auto-switch the preview to the slider's position.
12. **Match the STANDARD panel blue `#456a93` on the FACE, not just the geometry.** The
    baked face carries Blender's own blue (HYD was `#33607a`) which differs from every
    other cockpit panel. Fixing only the `Blue base` geometry leaves the FACE wrong.
    Recolour the field web-side in the same mask pass (§10c): where `isPanel`, overwrite
    the pixel to `#456a93`; keep white/green lettering. Use the standard finish the other
    panels use (`clearcoat 0.4`). **But the same hex does NOT guarantee the same look:**
    metalness 1.5 makes the panel a near-mirror, so the rendered blue is mostly the HDRI
    REFLECTION and depends on the camera angle vs the HDRI. VERIFY by sampling the rendered
    blue (CDP/headless screenshot → PIL patch average) against a reference panel (eng-start
    renders ≈`#2e5880`) and tune `envMapIntensity` until they match — a flatter/face-on dev
    camera catches a brighter region, so HYD needed **0.62** vs the nominal 1.0 to match.
    Don't trust "the hex is right" — sample both and match the rendered pixels.
    **DECOUPLE COLOUR FROM SHEEN — `envMapIntensity` controls BOTH, so it is the wrong knob
    for "life".** (HYD lesson, 2026-06-17.) If the env value that matches the colour leaves
    the panel looking flat/dead, do NOT raise `envMapIntensity` to bring back the gloss — that
    re-brightens the whole field and breaks the colour match (HYD at env 1.0 jumped to a washed
    `#4574ad`, the brightest outlier of all panels). Instead keep env at the colour-matched
    value and restore the gloss with the **clearcoat layer**, which adds a specular highlight
    streak WITHOUT shifting the base colour: raise `clearcoat` (≈0.4 → **0.9**) and drop
    `clearcoatRoughness` (≈0.22 → **0.1**). Proven: HYD env `0.62` + clearcoat `0.9` /
    ccRough `0.1` samples `#426693` (≈ the `#456a93` target, in-family) AND has the glossy
    gradient back (dark `#3e5f89` → bright `#476e9e`). Rule of thumb: **env = colour, clearcoat
    = sheen.** Sample blue-field pixels with `B≥G and B−R≥14` — the standard blue has G>R, so
    a naïve "exclude G>R green-line" filter wrongly drops the paint itself.

---

## 0.5 MASTER REFERENCE PANEL — BASE HYD No.1

The **HYDRAULIC panel** (`base_hyd_no1`, git tag `base-hyd-no1`, snapshot in
`Aviator/blender/hyd/base_hyd_no1/`) is the **master reference** for every other panel.
Whenever uncertainty exists about a panel's look, **copy from HYD** — do not invent values or
infer Airbus components from memory. Full rules: `blender/hyd/base_hyd_no1/PANEL_CONVERSION_RULES.md`.

Match from HYD: base panel colour, roughness, metalness, clearcoat, reflection response, edge
highlights, specular, and the **four-edge sheen** (top/bottom/left/right); pushbutton colour,
border (thickness/colour/depth/bevel), neutral position, travel limits; OFF + FAULT light styling;
and **large-pushbutton text** styling. **Small-pushbutton text** instead follows the ENG FIRE
AGENT pb. Goal = visual consistency with HYD, not a flat-colour approximation.

Locked HYD values (user-confirmed): colour `#4a8296`, roughness 0.72, metalness 1.86, clearcoat 0.6,
reflections(env) 0.5; sheen T0.95/B0.9/L0.95/R1.35 (brightness = horiz lerp(L,R) × vert lerp(T,B),
baked into the recoloured face field); cap `#05070a`, border/frame `#15171e`, RAT `#222734`.
**Gotcha:** metalness >1.0 = full mirror → renders BLACK on the real GPU though headless tests show
colour; if a panel blacks out, drop metalness to ≤0.8.

---

## 1. Intake — collect before starting

- **The Blender file** (`.blend`) or an already-exported GLB. Confirm the canonical
  copy (NOT a stale `~/Downloads` original — work from `blender/<panel>/`).
- **Panel name + section list** (e.g. FIRE = ENG1, APU, ENG2). How many of each
  repeated control per section (e.g. agents: 2/1/2).
- **Reference pics** of the real panel (for the face + legend colors/text).
- **FCOM section** for the behaviour (e.g. DSC-26-20-20 for ENG FIRE) — pull the
  light/guard/discharge logic from `a320-fcom-trainer`.
- **Which controls are interactive** and their **FO logic** (trigger → guard lift →
  pb push → agent discharge; which legend lights when, what color).

---

## 2. Pipeline overview (Blender → live panel)

```
.blend ──(export_glb.py)──▶ <panel>.glb            → public/models/
.blend ──(rebake script)──▶ <panel>_face.png        → public/models/   (COMBINED bake, shadow-casters hidden)
                              │
        component loads GLB (geometry) + face PNG (applied over the face mesh)
                              │
        part selection by material+position → interaction logic → camera fit
                              │
        page: <panel>-3d/page.tsx (trigger + reset)  → localhost:3004/dev/<panel>-3d
                              │
        headless CDP verify every control → commit base model
```

---

## 3. Export & bake (Blender side)

- **GLB:** export geometry + materials with `blender/<panel>/export_glb.py` (adapt
  from `blender/fire_test/export_glb.py`). glTF can't carry Blender's Mix-Shader
  node graph, so the painted face must be **baked** to a flat albedo PNG separately.
- **Face bake:** Cycles **COMBINED** bake of the face mesh to a PNG. Hide ALL other
  meshes (shadow casters) first so no shadows/marks bake in. Template:
  `blender/fire_test/rebake_face_no_shadows.py` (hides everything except the face
  curve, bakes, saves PNG, exits without saving the .blend).
- Drop both into `public/models/`. The component references the PNG via a single
  constant: `const FACE_TEX_URL = "/models/<panel>_face.png";`

---

## 4. Render fidelity (keyed by material — applies to all sections at once)

```ts
const { scene } = useGLTF(MODEL_URL);
const faceTex = useTexture(FACE_TEX_URL);
faceTex.flipY = false;                       // glTF UVs
faceTex.colorSpace = THREE.SRGBColorSpace;
faceTex.anisotropy = 16;                     // max — keeps fine labels crisp (rule 9)
```
- **Face** (material e.g. `DECALS`): replace with `new THREE.MeshBasicMaterial({
  map: faceTex, side: THREE.DoubleSide, toneMapped: false })`.
- **Renderer:** `NoToneMapping` (lit materials + tone mapping clip amber→yellow).
- **HDRI environment** (`<Environment files="/hdri/....hdr" />`) — metals read as
  reflection; without it they look dead.
- **Metals by material name:** guard housing metalness ~0.7; hinge chrome; button
  caps matte near-black; painted-aluminium base; FIRE lens = translucent ruby red.
- **`updateWorldMatrix(true,true)` before any `Box3.setFromObject`** (camera fit /
  bbox), or measurements are stale.

---

## 5. Interaction logic (the core — copy from the base case)

**Part selection** (in a `useMemo` over the loaded root): per section, find the
pb by its lit material sorted by world X; the guard = the large housing mesh
nearest that pb; agents = the cap meshes adjacent to each legend window; SQUIB =
higher-Z legend text, DISCH = lower-Z; screws = small meshes within ~0.25 of the
pb center (they travel with the pb).

**Guard open = fixed delta:**
```ts
const GUARD_OPEN_DELTA = -2.443; // ≈ −140°, applied to EVERY guard's closed rest
const target = d.guardOpen[i] ? (guardClosedRot + GUARD_OPEN_DELTA) : guardClosedRot;
s.guard.rotation.x = THREE.MathUtils.lerp(s.guard.rotation.x, target, 0.08);
```

**Position-based click resolution** (works for every section):
```ts
const handleClick = (e: ThreeEvent<MouseEvent>) => {
  e.stopPropagation();
  if (!e.point) return;
  const p = e.point; const d = drillRef.current;
  let best = null;
  const consider = (wp, kind, i, j) => {
    const dist = wp.distanceTo(p);
    if (!best || dist < best.dist) best = { kind, i, j, dist };
  };
  sections.forEach((s, i) => {
    if (s.firePbGroup) consider(s.firePbGroup.getWorldPosition(new THREE.Vector3()), "guardpb", i, -1);
    s.agents.forEach((a, j) => consider(a.cap.getWorldPosition(new THREE.Vector3()), "agent", i, j));
  });
  if (!best || best.dist > 0.45) return;          // clicked away from every control
  const { kind, i, j } = best;
  if (kind === "guardpb") {
    if (!d.guardOpen[i]) { d.guardOpen[i] = true; bump(); return; }   // 1st click lifts guard
    if (fireDetected && !d.pbDone[i]) { d.pbDone[i] = true; bump(); } // 2nd click pushes pb
    return;
  }
  // agent: armed only after the pb is pushed + ARM delay + previous agent done
  const prevDone = j === 0 ? true : d.disch[i][j - 1];
  if (!(d.pbDone[i] && prevDone && !d.disch[i][j])) return;
  pressRef.current[`${i}-${j}`] = Date.now();
  d.disch[i][j] = true; bump();
};
```
- **Gate the guard branch on `!guardOpen`** so the open guard's hitbox can't
  swallow the pb click.
- **State lives in a `useRef` (`drillRef`); bump a `useState` version to re-render.**
  Report out via an effect WITH deps: `useEffect(() => { onState?.(...) }, [drillVer, onState]);`

**Legend lights (FCOM colors, unlit, on top):**
```ts
// SQUIB white once pb pushed & not yet discharged; DISCH amber once discharged
const squibHex = "#ffffff", dischHex = "#ff9f00"; // true Airbus amber
setLegend(a.squib, d.pbDone[i] && !dischd, squibHex);
setLegend(a.disch, dischd, dischHex);
```
Legend words render as **MeshBasicMaterial (unlit), `depthTest:false`,
`renderOrder` high (≈30)** so the lit letters sit over the baked-dark text. OFF =
dim grey `#41464d`. The cap itself NEVER illuminates — only the legend words.

**Press FEEL (timing separate from depth)** — a real mechanical button, not a snap:
```ts
const PRESS_SHRINK = 0.1;       // DEPTH (how far it goes in) — independent of timing
const PRESS_ATTACK_MS = 130, PRESS_HOLD_MS = 60, PRESS_RELEASE_MS = 400; // approved feel
function pressCurve(elapsed) {
  if (elapsed < 0 || !Number.isFinite(elapsed)) return 0;
  const smooth = t => t*t*(3-2*t);                       // smoothstep, no toy bounce
  if (elapsed <= PRESS_ATTACK_MS) return smooth(elapsed/PRESS_ATTACK_MS);     // in
  if (elapsed <= PRESS_ATTACK_MS+PRESS_HOLD_MS) return 1;                     // hold
  const t = (elapsed-PRESS_ATTACK_MS-PRESS_HOLD_MS)/PRESS_RELEASE_MS;
  return t >= 1 ? 0 : 1 - smooth(t);                                          // out
}
```

---

## 6. Page wiring (dev page = trigger + reset only, no debug for final)

The final page passes only `fireDetected` + `resetSignal` to the component, plus a
TEST trigger and an `R`-key reset. ALL debug overlays (status readout, tuning
drawer) are stripped for the saved base model. During bring-up you MAY add a
temporary status readout to drive headless verification — strip it before saving.

---

## 7. Texture is wrong? RE-BAKE, don't patch

Shadows under buttons, stray marks, double borders, or mismatched panel-blue across
sections = re-bake in Blender (§3), don't pixel-edit the PNG. Pixel patches create
seams and compounding artifacts. Known acceptable residual: a COMBINED (lit) bake
can leave one section's blue slightly darker — only chase it if the user asks.

---

## 8. Verification (headless Chrome + CDP, no deps — Node 25 has global WebSocket)

Launch headless Chrome with WebGL, drive real clicks, confirm each control fires
and there are **no JS errors**:
```
--headless=new --enable-webgl --ignore-gpu-blocklist --enable-unsafe-swiftshader
--use-gl=angle --window-size=1400,900 --remote-debugging-port=PORT --user-data-dir=/tmp/...
```
- Connect over the page's `webSocketDebuggerUrl`; `Runtime.enable` + `Page.enable`.
- Click with `Input.dispatchMouseEvent` (mousePressed+mouseReleased).
- Read state from a temporary status readout (`document.body.innerText`) OR probe
  internal state; capture frames with `Page.captureScreenshot`.
- Verify the FULL drill on EVERY section (guard → pb → each agent), and assert
  `window.__err` is empty after listening for `error` events.
- Working scripts to copy/adapt: `/tmp/cdp_manual_flow.mjs`, `/tmp/cdp_verify_clean.mjs`.

---

## 9. Save the base model (definition of done)

1. Strip debug overlays. 2. Re-run headless verification — all controls, no errors.
2. Copy the 4 files that ARE the panel into `blender/<panel>/base_model/` with a
   README + cold preview PNG: the page, the component, the GLB, the face PNG.
3. Commit (`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`).
4. Record a memory pointer so it survives sessions (see
   [[project_aviator_fire_test_base_model]]). This is the rollback state.

This base model then pushes into the PilotTrain hub and gets wired to live FCOM/FO
scenario logic.

---

## 10. FINAL panel treatment — the look we ship (FIRE panel, 2026-06-15)

The base case was finished to a **metallic, light-correct, fully-tunable** standard.
Tag `fire-panel-FINAL-2026-06-15`; snapshot `blender/fire_test/final_base_2026-06-15/`
(component + page + GLB + face PNG + reference render). Reproduce this for EVERY new
panel — these are the exact treatments + values.

### 10a. Face is LIT now (supersedes the old "face = unlit MeshBasic" rule for the FACE only)
The painted blue face (`DECALS`) is a **`MeshPhysicalMaterial`** so it takes a real
metallic finish + reflections. **Only the LEGEND WORDS stay unlit `MeshBasicMaterial`**
(rule §4 still holds for SQUIB/DISCH text + legend boxes, `toneMapped:false`,
`depthTest:false`, `renderOrder` 29–30). Renderer still `NoToneMapping` by default
(a live tone-map toggle None/AgX/ACES exists for tuning).

### 10b. Baked material finish (the metallic look)
```ts
// DECALS (front face) and "Blue base" (body) — baked tuned values:
roughness 0.6, metalness 1.5, clearcoat 1.0, envMapIntensity 1.8
// metalness >1 deliberately over-drives the metallic reflection (looks like brushed metal).
```
### 10c. Protect the text from the finish (MASK)
The face PNG carries blue panel + white lettering on ONE mesh, so metalness/clearcoat
would turn the text into a tinted mirror. Build a **mask CanvasTexture from the face
texture** (blue texels → panel, white/dark → text) and feed it as BOTH `metalnessMap`
and `clearcoatMap` on the DECALS material. Finish then lands ONLY on the blue; the
lettering stays a flat matte decal. (G channel =255 = roughness no-op; R/B =255 on
panel, 0 on text.)

### 10d. Reflections isolated to the panel (don't light the buttons)
Per-material `envMapIntensity` is IGNORED when a material has no own `envMap` (it
falls back to `scene.environmentIntensity`). So **bind the scene env map onto the
panel materials** (`m.envMap = scene.environment` in a ref-guarded `useFrame`), keep
`<Environment environmentIntensity={1.5}>` FIXED, and drive the "Reflections" slider
via the panel materials' `envMapIntensity` only. FIRE pbs / hinges / agents keep
`envMap=null` → constant reflection. Reflections range 0–6.

### 10e. Push-button + part colours/materials (by material name)
- **FIRE lens** (`fire pb1 LIT`/`red fire push`): translucent ruby — `MeshPhysicalMaterial`
  `{ color:#841010, transmission:0.58, thickness:0.7, ior:1.5, attenuationColor:#7a0d0d,
  clearcoat:1, clearcoatRoughness:0.08, emissive:#ff0505 (emissiveIntensity 0 off / 2 lit),
  envMapIntensity:1.7 }`. Lights red on fire (`fireDetected`), pops out `+0.15` Y when pushed.
- **Agent cap + surround** (`black button`): matte black. `roughness 1.0, metalness 0,
  envMapIntensity 0` so the "black amount" slider reads as a TRUE deep black at 100.
- **Guard housing** (`orange housijng`) metalness 0.7 / rough 0.32; **hinge metal** 1.0/0.18;
  **legend_box** unlit `#dfe6f0`.

### 10f. Agents — size-based parts + independent darkness (the APU lesson)
- **Identify cap vs surround by SIZE, not proximity** (cap = the SMALLER cube;
  surround = larger). Proximity-to-legend detection is fragile and flips when a part
  is repositioned — size is stable. The surround sits just behind the cap and peeks
  out as the border.
- The dev editor exposes **independent black-amount** for ENGINE agents vs the APU
  agent (each: Button-cap + Around-it), with **number-entry boxes** beside sliders.
  IMPORTANT: define slider rows as **inline function calls** (`{row(...)}`), NOT as
  components used via `<Row/>` — inline-defined components remount on every change and
  make the slider jump/stick.

### 10g. THE APU FIX — when one repeated control is misplaced in the model
Symptom: APU agent's cap rendered ~0.05 BEHIND its surround (authored that way), so
only the surround showed and "around it" painted the whole face. Fix done **headlessly
in Blender** (`/Applications/Blender.app/.../Blender --background --python script.py`):
import the GLB, **move the offending object forward** (`obj.location.z += 0.052`),
re-export GLB. Then make detection size-based (10f). Repro:
`blender/fire_test/move_apu_cap_forward.py`.
- **NEVER bake ROTATION on export** — it destroys the guards (they rely on the authored
  open-pose node rotation; see §0.5). `transform_apply(scale=True)` or a pure object
  MOVE is safe; rotation/location bakes are not.
- Round-trip preserves legends/text/materials **only if material names are unchanged**.
- three.js and Blender resolved that node's depth ~0.05 differently — **moving the
  object is reliable; transform-baking is not needed and is risky.**

### 10h. Lighting rig (the "not plastic" look)
`ambientLight 0.18 #9fb0c4` + `directionalLight [2.6,3.2,4.5] 2.8 #fff` +
`directionalLight [-2.4,1.0,3.0] 1.1 #cfe0ff` + HDRI `braustuble_alley_2k.hdr`
(`environmentIntensity 1.5`, fixed). Camera `fov 28`, framing fits the bbox of the
FACE mesh; **`dpr={cockpitDpr()}`** (supersample — rule 9; NEVER `[1,2]`), `antialias`, `outputColorSpace sRGB`.

### 10i. Colours are RUNTIME, not baked in the GLB
All tunable colours/finish are applied by the component at runtime (baked as code
defaults + a dev editor persisting to localStorage `fireAgentBlack.v1` /
`firePanelByTone.v1`). So re-importing a fixed GLB keeps every colour — provided the
material names survive. When the user gives final slider values, bake them into the
material construction + the dev-page defaults (don't leave them browser-only).

> **Bringing a NEW panel to "final like this":** copy the FINAL component, keep §10a–10h
> treatments, swap the GLB + face PNG + material-name map + section/agent counts, then
> tune in the dev editor and bake. The recipe is panel-agnostic.
