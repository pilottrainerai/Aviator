"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Throttle3D — web render of blender/throttle/throttle_new.blend (A320 THRUST-LEVER
// quadrant: two thrust levers + reverse triggers on the pedestal, printed IDLE/CL/
// FLX·MCT/TOGA gate + REV/FULL scales + green range bands).
//
// User spec (2026-07-13):
//  • The whole BASE — the plate AND the engraved scale face — is ONE steel-blue panel
//    (our standard §10 treatment): the spine's dark-grey background is recoloured to the
//    base blue with the white/yellow/green engravings kept ON TOP (EVAC face pattern).
//  • The LEVERS are black but GLOSSY-METALLIC (black paint = metalness 0.7 / rough 0.2)
//    so the knuckle where the reverse triggers attach reads chrome — like Blender. It is
//    the SAME material as the arms; the metallic look is the reflection, not a 2nd colour.
//  • The striped ARCHES are crisp black/white (near-unlit + anisotropy — the metallic/HDRI
//    finish was muddying them).
//  • The small pivot pins (metal) are bright chrome; the red pivot accent (Material) kept.
//
// Decals are BAKED (blender/throttle/bake_decals_and_export.py) — glТF can't carry the
// overlay node-graphs, so the composited albedo is baked, then recoloured web-side here.
//
// RENDER-FIRST: faithful static render + camera fit. The detented lever THROW is a later
// FCOM-driven pass, not invented here.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { cockpitDpr } from "@/components/cockpit/cockpit-dpr";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/throttle.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
const PANEL_BLUE = "#4a8296"; // MASTER REFERENCE = base_hyd_no1
// Manual pitch trim wheels (Torus.003 L / Torus.001 R): completed to FULL striped rings, then
// CLIPPED at this world-Y so only the part ABOVE it shows (a fixed window). The full ring spins
// behind the window → the stripes scroll through the visible arc = a real rotating trim wheel,
// with the completed lower half hidden. Ring centre ≈ y 0.205; tune the window with the slider.
// PAUSED 2026-07-13: reverted to ORIGINAL half-arc wheel, stationary. Spin/completion/clip
// machinery kept dormant (trimRate default 0, clip off) to resume later on the regenerated wheel.
const DECK_CLIP_Y_DEFAULT = -1; // off → original arc shows exactly as designed

export interface ThrottleTune {
  panel: { color: string; roughness: number; metalness: number; clearcoat: number; env: number; sheenT: number; sheenB: number; sheenL: number; sheenR: number };
  lever: { color: string; roughness: number; metalness: number; env: number };   // black paint — glossy black, knuckle reads chrome
  trigger: { color: string; roughness: number; metalness: number; env: number };  // black button — reverse triggers / grips
  metal: { color: string; roughness: number; metalness: number; env: number };    // chrome pivot pins (Blender metalness 8 → clamp)
  arch: { env: number; roughness: number };                                        // striped rails — keep crisp (low env)
}
export const THROTTLE_TUNE_DEFAULT: ThrottleTune = {
  panel: { color: PANEL_BLUE, roughness: 0.72, metalness: 1.86, clearcoat: 0.6, env: 0.5, sheenT: 2.5, sheenB: 0.9, sheenL: 2.15, sheenR: 1.05 }, // sheenT/L user-set 2026-07-13
  lever: { color: "#16181d", roughness: 0.2, metalness: 0.7, env: 1.6 },   // glossy dark metal → chrome knuckle, black arms
  trigger: { color: "#0b0d11", roughness: 0.35, metalness: 0.5, env: 1.0 },
  metal: { color: "#b9bdc4", roughness: 0.16, metalness: 0.8, env: 2.6 },   // bright chrome (metalness clamped ≤0.8, skill §0.5)
  arch: { env: 0.06, roughness: 0.4 },                                       // near-unlit → crisp black/white
};

// Reverse-LEVER pivot angle (deg) per lever — the Cube.005/011 flap rotates about its rear hinge:
// −70 = DOWN (normal/stowed, default), +60 = UP (reverse selected). [user 2026-07-14]
export type RevLever = { l1: number; l2: number };
export const REV_LEVER_DOWN: RevLever = { l1: -70, l2: -70 };

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Recolour an engraved-face texture: the dark-grey background → the base panel blue,
// KEEPING the bright (white scale/labels) and coloured (yellow REV/FULL, green band)
// engravings. Also returns a finish MASK (field = finish on, engraving = matte) so the
// metallic/clearcoat lands only on the blue field and the lettering stays a flat decal.
function recolorFace(img: CanvasImageSource, w: number, h: number, panelHex: string): { albedo: THREE.CanvasTexture; mask: THREE.CanvasTexture } | null {
  try {
    const [pr, pg, pb] = hexRgb(panelHex);
    const al = document.createElement("canvas"); al.width = w; al.height = h;
    const mk = document.createElement("canvas"); mk.width = w; mk.height = h;
    const ac = al.getContext("2d"), mc = mk.getContext("2d");
    if (!ac || !mc) return null;
    ac.drawImage(img, 0, 0);
    const data = ac.getImageData(0, 0, w, h); const d = data.data;
    const md = mc.getImageData(0, 0, w, h); const m = md.data;
    for (let p = 0; p < d.length; p += 4) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const lum = (r + g + b) / 3;
      const bright = lum > 115;                                 // white text / scales
      const yellow = r > 120 && g > 85 && b < 95;               // REV / FULL arrows
      const green = g > 95 && g > r + 18 && g > b + 18;          // range band
      const isEngraving = bright || yellow || green;
      if (!isEngraving) { d[p] = pr; d[p + 1] = pg; d[p + 2] = pb; } // background → base blue (keep soft AA text as-is)
      const v = isEngraving ? 0 : 255;                          // mask: field=255 finish-on, engraving=0
      m[p] = v; m[p + 1] = 255; m[p + 2] = v; m[p + 3] = 255;
    }
    ac.putImageData(data, 0, 0); mc.putImageData(md, 0, 0);
    const albedo = new THREE.CanvasTexture(al); albedo.flipY = false; albedo.colorSpace = THREE.SRGBColorSpace; albedo.anisotropy = 16; albedo.needsUpdate = true;
    const mask = new THREE.CanvasTexture(mk); mask.flipY = false; mask.colorSpace = THREE.NoColorSpace; mask.needsUpdate = true;
    return { albedo, mask };
  } catch { return null; }
}

// Thrust-lever throw: rotate about the GATE ARC CENTRE so the lever's bottom rides ALONG
// the curved gate surface (tracking the 0/CL/FLX·MCT/TOGA detent line) instead of swinging
// off at an angle. Circle-fit of the spine's gate arc (Blender): centre (y≈0, z≈−0.031),
// radius 0.564; the lever tip sits ~0.544 from it → on the surface. glТF (x,z,−y) mapping:
// Blender (·, 0.0025, −0.031) → glТF (·, −0.031, −0.0025). +deg = forward/TOGA, −deg = reverse.
const LEVER_PIVOT = new THREE.Vector3(0, -0.031, -0.0025); // glТF; x irrelevant (rotation axis)

export function ThrottleScene({ tune, lever1Deg, lever2Deg, trimRate, clipY, showTrimWheels, panX, panY, zoom, viewDir, embedded, revLever, textBold = 1, textGlow = 0.9, tiltX = 0, tiltY = 0, onThrLever }: { tune: ThrottleTune; lever1Deg: number; lever2Deg: number; trimRate: number; clipY: number; showTrimWheels: boolean; panX: number; panY: number; zoom: number; viewDir?: [number, number, number]; embedded?: boolean; revLever?: RevLever; textBold?: number; textGlow?: number; tiltX?: number; tiltY?: number; onThrLever?: () => void }) {
  const { scene } = useGLTF(MODEL_URL);
  // Clip plane at the deck: keep y > clipY (top of ring), hide the lower ring. Local clipping.
  const clipPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -clipY)).current;
  useEffect(() => { clipPlane.constant = -clipY; }, [clipY, clipPlane]);

  // Geometry-aligned SHEEN (skill §0.5): world-position gradient → real L/R/T/B edges.
  const sheenU = useRef({
    uSL: { value: 1 }, uSR: { value: 1 }, uST: { value: 1 }, uSB: { value: 1 },
    uBMin: { value: new THREE.Vector3() }, uBMax: { value: new THREE.Vector3() },
  }).current;
  const applySheen = (mat: THREE.MeshPhysicalMaterial) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSL = sheenU.uSL; shader.uniforms.uSR = sheenU.uSR;
      shader.uniforms.uST = sheenU.uST; shader.uniforms.uSB = sheenU.uSB;
      shader.uniforms.uBMin = sheenU.uBMin; shader.uniforms.uBMax = sheenU.uBMax;
      shader.vertexShader = "varying vec3 vSheenW;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vSheenW = (modelMatrix * vec4(transformed, 1.0)).xyz;"
      );
      shader.fragmentShader = "varying vec3 vSheenW;\nuniform float uSL,uSR,uST,uSB;\nuniform vec3 uBMin,uBMax;\n" + shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#include <map_fragment>\n  float sfx = clamp((vSheenW.x-uBMin.x)/max(1e-4,uBMax.x-uBMin.x),0.0,1.0);\n  float sfy = clamp((vSheenW.y-uBMin.y)/max(1e-4,uBMax.y-uBMin.y),0.0,1.0);\n  diffuseColor.rgb *= (uSL + (uSR-uSL)*sfx) * (uSB + (uST-uSB)*sfy);"
      );
    };
    mat.needsUpdate = true;
  };

  const { root, groups, leverPivots, wheelPivots, revLeverPivots } = useMemo(() => {
    const clone = scene.clone(true);
    const g = { panel: [] as THREE.MeshPhysicalMaterial[], face: [] as THREE.MeshPhysicalMaterial[], lever: [] as THREE.MeshStandardMaterial[], trigger: [] as THREE.MeshStandardMaterial[], metal: [] as THREE.MeshStandardMaterial[], arch: [] as THREE.MeshStandardMaterial[], accent: [] as THREE.MeshStandardMaterial[], wheel: [] as THREE.MeshStandardMaterial[] };
    const wheelNodes: THREE.Object3D[] = []; // the two trim-wheel meshes (GLTFLoader sanitizes "Torus.001"→"Torus001", so collect by startsWith, not exact name)

    const mkPanel = (name: string) => {
      const base = new THREE.MeshPhysicalMaterial({ color: PANEL_BLUE, metalness: 1.86, roughness: 0.72, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.5 });
      base.name = name; applySheen(base); g.panel.push(base); return base;
    };

    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const isWheel = obj.name.startsWith("Torus"); // pitch trim wheel (now a full ring) → its own group
      const remap = (m: THREE.Material): THREE.Material => {
        if (!m) return m;
        const n = m.name;
        if (isWheel) {
          // The real half-arc completed to a full ring (blender: dup + 180° about true centre).
          // Keeps the REAL baked stripe texture ('black decal') + hub faces ('black paint').
          // Unique clones so the wheel spins/colours independently of the levers.
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = n;
          if (c.map) { c.map.anisotropy = 16; c.color.set("#ffffff"); c.metalness = 0; c.roughness = 0.42; c.envMapIntensity = 0.12; } // striped ring
          else { c.color.set("#101216"); c.metalness = 0.3; c.roughness = 0.5; c.envMapIntensity = 0.2; } // hub / caps
          g.wheel.push(c); return c;
        }
        if (n === "Blue base" || n === "Blue base.001") return mkPanel(n);
        if (n === "air con decals" || n === "Material.004" || n === "Material.005") {
          // Engraved base-panel FACE: recolour its background to the base blue, keep the
          // engravings, apply the SAME metallic finish as the plate → it reads as one panel.
          const sm = m as THREE.MeshStandardMaterial;
          const im = sm.map?.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined);
          const w = (im as { width?: number })?.width ?? 0, h = (im as { height?: number })?.height ?? 0;
          const rc = im && w && h ? recolorFace(im as CanvasImageSource, w, h, PANEL_BLUE) : null;
          if (!rc) return mkPanel(n); // no usable engraving map → solid blue panel
          const face = new THREE.MeshPhysicalMaterial({ map: rc.albedo, side: THREE.DoubleSide, roughness: 0.72, metalness: 1.86, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.5, metalnessMap: rc.mask, clearcoatMap: rc.mask });
          face.name = n; applySheen(face); g.face.push(face); return face;
        }
        if (n === "black paint") { const c = m.clone() as THREE.MeshStandardMaterial; c.name = n; g.lever.push(c); return c; }
        if (n === "black button" || n === "black button.001") { const c = m.clone() as THREE.MeshStandardMaterial; c.name = n; g.trigger.push(c); return c; }
        if (n === "metal") { const c = m.clone() as THREE.MeshStandardMaterial; c.name = n; g.metal.push(c); return c; }
        if (n === "Material") { const c = m.clone() as THREE.MeshStandardMaterial; c.name = n; c.transparent = true; c.opacity = 0; c.depthWrite = false; c.visible = false; g.accent.push(c); return c; } // inside red buttons — HIDDEN per user
        return m.clone();
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(remap) : remap(obj.material);
      if (isWheel) wheelNodes.push(obj);
    });

    // ── Thrust-lever pivots: the two lever roots are the only nodes with many children
    // (15 each: arm, grip, reverse triggers, pins). Re-parent each under a pivot Group at
    // its base hinge so a rotation about X throws it fore-aft (grip arcs, base stays put).
    clone.updateWorldMatrix(true, true);
    const leverNodes: THREE.Object3D[] = [];
    clone.traverse((o) => { if (o !== clone && o.children.length >= 10) leverNodes.push(o); });
    // Sort by world X so the pivots are IDENTIFIED: [0] = TLV1 (ENG 1, left/lower X, Cylinder.013),
    // [1] = TLV2 (ENG 2, right/higher X, Cylinder.030). They move INDEPENDENTLY (lever1Deg/lever2Deg).
    leverNodes.sort((a, b) => a.getWorldPosition(new THREE.Vector3()).x - b.getWorldPosition(new THREE.Vector3()).x);
    const leverPivots = leverNodes.map((node, i) => {
      const wx = node.getWorldPosition(new THREE.Vector3()).x;
      const pivot = new THREE.Group(); pivot.name = i === 0 ? "TLV1_pivot" : "TLV2_pivot";
      pivot.position.set(wx, LEVER_PIVOT.y, LEVER_PIVOT.z);
      clone.add(pivot); pivot.attach(node);
      // Pre-set to the current target so a fresh mount / pop-out shows the lever already thrown
      // (no animate-up-from-0). useFrame then lerps only when the target actually changes.
      pivot.rotation.x = THREE.MathUtils.degToRad(-(i === 0 ? lever1Deg : lever2Deg));
      return pivot;
    });

    // ── Manual pitch trim wheels: wrap each full-torus wheel in a pivot at its axle
    // (bbox centre = ring centre now they're full) so a rotation about X spins it about the
    // lateral trim-wheel axis. Nodes collected by material (startsWith "Torus"), not by name.
    clone.updateWorldMatrix(true, true);
    const wheelPivots = wheelNodes.map((node) => {
      const c = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
      const pivot = new THREE.Group(); pivot.name = "wheel_pivot";
      pivot.position.copy(c); clone.add(pivot); pivot.attach(node);
      return pivot;
    });

    // Reverse LEVERS (Cube.005 L / Cube.011 R) — the flat black-paint flap on each grip that pivots
    // about its REAR hinge (axis X): NEGATIVE deg = DOWN (normal), POSITIVE = UP (reverse). Found by
    // bbox size (~0.10 x 0.06 x 0.169 in glТF) within each lever — distinctive thin plate. [user 2026-07-14]
    const revLeverPivots: (THREE.Group | null)[] = [];
    leverPivots.forEach((lp) => {
      let best: THREE.Mesh | null = null; let bestErr = 0.07; const sz = new THREE.Vector3();
      lp.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        if (!mm.some((x) => (x as THREE.Material | undefined)?.name === "black paint")) return;
        new THREE.Box3().setFromObject(o).getSize(sz);
        const err = Math.abs(sz.x - 0.10) + Math.abs(sz.y - 0.06) + Math.abs(sz.z - 0.169);
        if (err < bestErr) { bestErr = err; best = o; }
      });
      if (!best) { revLeverPivots.push(null); return; }
      const box = new THREE.Box3().setFromObject(best);
      const hinge = new THREE.Vector3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.max.z); // rear (grip-side) edge
      const pivot = new THREE.Group(); pivot.name = "revlever_pivot";
      lp.add(pivot); lp.updateWorldMatrix(true, false);
      pivot.position.copy(lp.worldToLocal(hinge.clone()));
      pivot.attach(best);
      revLeverPivots.push(pivot);
    });

    clone.updateWorldMatrix(true, true);
    const pbox = new THREE.Box3().setFromObject(clone);
    sheenU.uBMin.value.copy(pbox.min); sheenU.uBMax.value.copy(pbox.max);
    return { root: clone, groups: g, leverPivots, wheelPivots, revLeverPivots };
  }, [scene, textBold]);

  useEffect(() => {
    sheenU.uSL.value = tune.panel.sheenL; sheenU.uSR.value = tune.panel.sheenR;
    sheenU.uST.value = tune.panel.sheenT; sheenU.uSB.value = tune.panel.sheenB;
  }, [tune.panel.sheenL, tune.panel.sheenR, tune.panel.sheenT, tune.panel.sheenB, sheenU]);

  useEffect(() => {
    const applyPanel = (m: THREE.MeshPhysicalMaterial) => { m.roughness = tune.panel.roughness; m.metalness = tune.panel.metalness; m.clearcoat = tune.panel.clearcoat; m.envMapIntensity = tune.panel.env; m.needsUpdate = true; };
    groups.panel.forEach((m) => { m.color.set(tune.panel.color); applyPanel(m); });
    groups.face.forEach(applyPanel); // face colour comes from the recoloured map (already base blue)
    groups.lever.forEach((m) => { m.color.set(tune.lever.color); m.roughness = tune.lever.roughness; m.metalness = tune.lever.metalness; m.envMapIntensity = tune.lever.env; m.needsUpdate = true; });
    groups.trigger.forEach((m) => { m.color.set(tune.trigger.color); m.roughness = tune.trigger.roughness; m.metalness = tune.trigger.metalness; m.envMapIntensity = tune.trigger.env; m.needsUpdate = true; });
    groups.metal.forEach((m) => { m.color.set(tune.metal.color); m.roughness = tune.metal.roughness; m.metalness = tune.metal.metalness; m.envMapIntensity = tune.metal.env; m.needsUpdate = true; });
    groups.wheel.forEach((m) => { if (m.map) { m.color.set("#ffffff"); m.metalness = 0; m.roughness = tune.arch.roughness; m.envMapIntensity = tune.arch.env; } m.needsUpdate = true; }); // striped wheel: map's B/W shows true (hub keeps its remap tone)
  }, [groups, tune]);

  // Pitch trim wheels HIDDEN by default (paused 2026-07-13; geometry kept in the GLB for reference).
  useEffect(() => { wheelPivots.forEach((p) => { p.visible = showTrimWheels; }); }, [wheelPivots, showTrimWheels]);

  // Label GLOW — self-lit engravings so TOGA/CL/etc. read at any angle regardless of glare.

  // Reverse LEVERS pivot about their rear hinge: NEGATIVE = down (normal), POSITIVE = up (reverse).
  useEffect(() => {
    const rl = revLever ?? REV_LEVER_DOWN;
    if (revLeverPivots[0]) revLeverPivots[0].rotation.x = THREE.MathUtils.degToRad(rl.l1);
    if (revLeverPivots[1]) revLeverPivots[1].rotation.x = THREE.MathUtils.degToRad(rl.l2);
  }, [revLeverPivots, revLever]);

  // bind env so per-material envMapIntensity is honoured (skill §10d)
  const bound = useRef(false);
  useEffect(() => { bound.current = false; }, [groups]);
  useFrame(({ scene: fs }, delta) => {
    if (!bound.current && fs.environment) {
      [...groups.panel, ...groups.face, ...groups.lever, ...groups.trigger, ...groups.metal, ...groups.arch, ...groups.accent, ...groups.wheel]
        .forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      bound.current = true;
    }
    // Thrust-lever throw — TLV1 and TLV2 move INDEPENDENTLY. Sign negated so +deg = FORWARD/TOGA
    // (lever leans away from the pilot); −deg = reverse (grip comes back toward the pilot). Pivots are
    // pre-set to the start target in useMemo, so a pop-out / re-mount shows them already at position.
    const t1 = THREE.MathUtils.degToRad(-lever1Deg), t2 = THREE.MathUtils.degToRad(-lever2Deg);
    if (leverPivots[0]) leverPivots[0].rotation.x = THREE.MathUtils.lerp(leverPivots[0].rotation.x, t1, 0.18); // TLV1 (ENG1)
    if (leverPivots[1]) leverPivots[1].rotation.x = THREE.MathUtils.lerp(leverPivots[1].rotation.x, t2, 0.18); // TLV2 (ENG2)
    // Manual pitch trim wheels spin at trimRate (deg/s) — both linked, same direction.
    if (trimRate) { const d = THREE.MathUtils.degToRad(trimRate) * delta; wheelPivots.forEach((p) => { p.rotation.x += d; }); }
  });

  // Camera fit — explicit 3/4 front-above view. glТF is Y-up: X=right, Y=up (levers +Y),
  // Z=toward pilot. The generic thinnest-axis fit would pick a side view (quadrant ~cubic).
  const { camera, size, controls, gl } = useThree();
  // Local clipping: hide the wheel geometry below the deck; only the top ring shows.
  useEffect(() => {
    gl.localClippingEnabled = true;
    groups.wheel.forEach((m) => { m.clippingPlanes = [clipPlane]; m.needsUpdate = true; });
  }, [gl, groups, clipPlane]);
  // Pedestal TILT — pitch the model on its X axis (and optional Y) so the gate face (IDLE/CL/
  // FLX·MCT/TOGA) turns toward the camera → text is less foreshortened → readable when small.
  useEffect(() => {
    root.rotation.x = THREE.MathUtils.degToRad(tiltX);
    root.rotation.y = THREE.MathUtils.degToRad(tiltY);
    root.updateWorldMatrix(true, true);
  }, [root, tiltX, tiltY]);
  useEffect(() => {
    if (embedded) return;   // merged pedestal (PedestalOne) owns the camera via OrbitControls — skip per-panel framing
    root.updateWorldMatrix(true, true);
    // Frame only VISIBLE meshes — the hidden trim wheels would otherwise inflate/off-centre the fit.
    const box = new THREE.Box3();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return;
      box.expandByObject(o);
    });
    if (box.isEmpty()) box.setFromObject(root);
    box.min.y = Math.max(box.min.y, clipY); // frame only the visible (above-deck) part
    const center = box.getCenter(new THREE.Vector3());
    const dim = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(dim.x, dim.y, dim.z);
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const z = Math.max(0.2, zoom || 1);                 // zoom DOLLIES the camera (stays crisp)
    // Fit BOTH width and height so the wide quadrant isn't cropped in a portrait/narrow slot
    // (the embedded scenario slot is tall) — take the larger of the vertical / horizontal fit.
    const aspect = size.width / Math.max(1, size.height);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = Math.max(maxDim / 2 / Math.tan(vFov / 2), maxDim / 2 / Math.tan(hFov / 2)) * 1.25 / z;
    const dir = new THREE.Vector3(...(viewDir ?? [0.32, 0.82, 1.5])).normalize();
    cam.up.set(0, 1, 0);
    // screen-space pan: offset both camera and look-at along the camera's right/up
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
    const pan = right.multiplyScalar((panX || 0) * maxDim * 0.5).add(camUp.multiplyScalar(-(panY || 0) * maxDim * 0.5));
    const target = center.clone().add(pan);
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.near = Math.max(0.01, dist * 0.02); cam.far = dist * 6; cam.updateProjectionMatrix();
    cam.lookAt(target);
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit?.target) { orbit.target.copy(target); orbit.update(); }
  }, [camera, size.width, size.height, controls, root, clipY, panX, panY, zoom, viewDir?.[0], viewDir?.[1], viewDir?.[2], embedded, tiltX, tiltY]);

  // Click either thrust lever → perform the THR LVR step (used when embedded in the scenario pedestal).
  const onClick = onThrLever ? (e: ThreeEvent<MouseEvent>) => {
    let o: THREE.Object3D | null = e.object;
    while (o) { if (o.name === "TLV1_pivot" || o.name === "TLV2_pivot") { e.stopPropagation(); onThrLever(); return; } o = o.parent; }
  } : undefined;
  return <primitive object={root} onClick={onClick} />;
}

export type CamInfo = { az: number; polar: number; dist: number; target: number[]; pos: number[] };
// Reports the live orbit-camera pose so the dev page can read off the angle/zoom to reproduce it.
function CamReporter({ onCamera }: { onCamera: (i: CamInfo) => void }) {
  const { camera, controls } = useThree();
  const last = useRef("");
  useFrame(() => {
    const c = controls as unknown as { getAzimuthalAngle?: () => number; getPolarAngle?: () => number; getDistance?: () => number; target?: THREE.Vector3 };
    if (!c?.getAzimuthalAngle || !c.target) return;
    const info: CamInfo = {
      az: +THREE.MathUtils.radToDeg(c.getAzimuthalAngle()).toFixed(1),
      polar: +THREE.MathUtils.radToDeg(c.getPolarAngle!()).toFixed(1),
      dist: +c.getDistance!().toFixed(3),
      target: c.target.toArray().map((n) => +n.toFixed(3)),
      pos: camera.position.toArray().map((n) => +n.toFixed(3)),
    };
    const key = JSON.stringify(info);
    if (key !== last.current) { last.current = key; onCamera(info); }
  });
  return null;
}

// lever1Deg = TLV1 (ENG1), lever2Deg = TLV2 (ENG2) — independent. `leverDeg` is a convenience
// fallback that drives BOTH when the per-lever props aren't given. showTrimWheels default false
// (pitch trim wheels hidden/paused). Detent angles: FULL REV −21 / IDLE 0 / CL +20 / FLX·MCT +28 / TOGA +36.
// controlled: fixed camera driven by panX/panY/zoom, OrbitControls OFF (for scenario embeds —
// the dev page leaves it off → free orbit). Mirrors EngStartPanel3D.
export function Throttle3D({ tune, leverDeg = 0, lever1Deg, lever2Deg, trimRate = 0, clipY = DECK_CLIP_Y_DEFAULT, showTrimWheels = false, controlled, panX = 0, panY = 0, zoom = 1, viewDir, onCamera, revLever, textBold = 1, textGlow = 0.9, tiltX = 0, tiltY = 0, onThrLever, bg = "#05070a" }: { tune?: ThrottleTune; leverDeg?: number; lever1Deg?: number; lever2Deg?: number; trimRate?: number; clipY?: number; showTrimWheels?: boolean; controlled?: boolean; panX?: number; panY?: number; zoom?: number; viewDir?: [number, number, number]; onCamera?: (i: CamInfo) => void; revLever?: RevLever; textBold?: number; textGlow?: number; tiltX?: number; tiltY?: number; onThrLever?: () => void; bg?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: "100%", height: "100%", background: bg === "transparent" ? "transparent" : "#070a0e" }} />;
  return (
    <Canvas
      dpr={cockpitDpr()}
      camera={{ fov: 30, near: 0.01, far: 100, position: [0, 1, 4] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace, localClippingEnabled: true }}
      style={{ width: "100%", height: "100%", background: bg }}
    >
      <ambientLight intensity={0.18} color="#9fb0c4" />
      <directionalLight position={[2.6, 3.2, 4.5]} intensity={2.8} color="#ffffff" />
      <directionalLight position={[-2.4, 1.0, 3.0]} intensity={1.1} color="#cfe0ff" />
      <Suspense fallback={null}>
        <Environment files={HDRI_URL} environmentIntensity={1.5} />
        <ThrottleScene tune={tune ?? THROTTLE_TUNE_DEFAULT} lever1Deg={lever1Deg ?? leverDeg} lever2Deg={lever2Deg ?? leverDeg} trimRate={trimRate} clipY={clipY} showTrimWheels={showTrimWheels} panX={panX} panY={panY} zoom={zoom} viewDir={viewDir} revLever={revLever} textBold={textBold} textGlow={textGlow} tiltX={tiltX} tiltY={tiltY} onThrLever={onThrLever} />
      </Suspense>
      {!controlled && <OrbitControls makeDefault enableDamping dampingFactor={0.08} />}
      {onCamera && !controlled && <CamReporter onCamera={onCamera} />}
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
