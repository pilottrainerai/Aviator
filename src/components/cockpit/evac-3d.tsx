"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EvacPanel3D — web render of blender/evac/evac_work.blend (A320 EVAC panel:
// EVAC COMMAND guarded pushbutton + HORN SHUT OFF pushbutton + CAPT / CAPT & PURS
// selector).
//
// Reuses the FIRE-panel FINAL treatment recipe (blender-panels-to-web SKILL §10)
// via the leaner ENG-START base. Parts are tunable PER GROUP via the `tune` prop
// so each element (panel / buttons / metal / shaft / indicator / decals) can be
// dialled in the dev editor.
//
// RENDER-FIRST: faithful static render + camera fit. Interactive COMMAND / HORN /
// CAPT logic is a later pass and must come from FCOM (a320-fcom-trainer), not be
// invented here.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { cockpitDpr } from "@/components/cockpit/cockpit-dpr";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/evac_panel.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
const FACE_TEX_URL = "/models/evac_face.png"; // baked decal sheet (COMMAND/EVAC/HORN SHUT OFF/CAPT…)

export interface EvacTune {
  panel: { color: string; roughness: number; metalness: number; clearcoat: number; env: number; sheenT: number; sheenB: number; sheenL: number; sheenR: number };
  metal: { color: string; roughness: number; metalness: number; env: number };
  buttonBlack: number; // 0 = base grey, 100 = black
  shaft: { color: string; roughness: number; metalness: number }; // "Material" = the guard hinge rod (static)
  guard: { angle: number }; // COMMAND guard tilt in DEGREES: 0 = flat/closed, negative = lifted open
  capt: { angle: number };  // CAPT selector lever tilt in DEGREES (down = CAPT, up = CAPT & PURS)
  // COMMAND + HORN pushbutton press model (HYD-style): ABSOLUTE cap offsets along the
  // panel normal (added to each cap's baseline). Border (surround) stays fixed.
  btn: { capColor: string; borderColor: string; neutralY: number; inY: number; staysY: number };
  emissive: { color: string; intensity: number };
  decalColor: string;
}
export type EvacBtnPos = "auto" | "neutral" | "in" | "stays"; // "auto" = driven by COMMAND/HORN state
// Decided panel blue = the FIRE-panel FINAL "reduced-glare" steel-blue (skill §10b /
// committed base fire-test-panel-3d.tsx). Lighter & more metallic than ENG START's
// #456a93 — the white labels stay legible because they're rendered UNLIT on top and
// the finish is masked off the lettering (see faceMask).
// MASTER REFERENCE = base_hyd_no1 (HYD panel). Colour/finish/sheen matched to it 2026-06-17.
const PANEL_BLUE = "#4a8296";
export const EVAC_TUNE_DEFAULT: EvacTune = {
  panel: { color: PANEL_BLUE, roughness: 0.72, metalness: 1.86, clearcoat: 0.6, env: 0.5, sheenT: 0.95, sheenB: 0.9, sheenL: 1.25, sheenR: 1.35 }, // GEOMETRY-aligned sheen (shader, world bbox) → lands on real edges on any shape/size. Left lifted 0.95→1.25 (vs HYD) to counter EVAC's darker left-edge metallic reflection so the dark-blue corner is gone — same APPEARANCE as HYD; the magnitude is this panel's one-slider dial.
  metal: { color: "#8b939d", roughness: 0.66, metalness: 1.0, env: 2.2 }, // user-tuned bezels
  buttonBlack: 100,
  shaft: { color: "#202632", roughness: 0.5, metalness: 1.0 },
  guard: { angle: 42 },  // CLOSED at rest (user-set); −90 = fully OPEN
  capt: { angle: 19 },   // CAPT (down) rest = 19 (user-set); CAPT & PURS (up) = −40
  btn: { capColor: "#05070a", borderColor: "#15171e", neutralY: 0.008, inY: -0.041, staysY: -0.009 }, // matched to base_hyd_no1
  emissive: { color: "#1f242c", intensity: 0 }, // OFF by default (indicator lit later via FCOM)
  decalColor: "#ffffff",
};
const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const CAP_BASE = [70, 80, 92];
const blackHex = (b: number) =>
  "#" + CAP_BASE.map((v) => Math.round(Math.max(0, Math.min(255, v * (1 - b / 100)))).toString(16).padStart(2, "0")).join("");

function matNames(o: THREE.Object3D): Set<string> {
  const s = new Set<string>();
  o.traverse((m) => { if (m instanceof THREE.Mesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm && s.add(mm.name)); });
  return s;
}

type Groups = {
  panel: THREE.MeshPhysicalMaterial[]; // Blue base (body / border)
  face: THREE.MeshPhysicalMaterial[];  // hydraulic decals — the LIT front plate (metallic, masked)
  metal: THREE.MeshStandardMaterial[]; // metal (bezels / rings)
  button: THREE.MeshStandardMaterial[];// black button (caps)
  shaft: THREE.MeshStandardMaterial[]; // Material (toggle shaft)
  evacLight: THREE.MeshBasicMaterial[]; // "EVAC" legend — flashes RED when alert active [fcom:4a DSC-23-40-10]
  onLight: THREE.MeshBasicMaterial[];   // "ON" legend (+ lens) — steady WHITE when COMMAND pushed
};

function EvacScene({ tune, active, hornSignal, btnPos, onCommand, onHorn, onCapt }: {
  tune: EvacTune; active: boolean; hornSignal: number; btnPos: EvacBtnPos;
  onCommand?: () => void; onHorn?: () => void; onCapt?: () => void;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const faceTex = useTexture(FACE_TEX_URL);
  faceTex.flipY = false;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 16;

  // ── Front-face FINISH MASK (skill §10c) ────────────────────────────────────
  // The baked face PNG carries the blue panel AND the white lettering on ONE mesh.
  // A metallic/clearcoat finish would otherwise turn the TEXT into a tinted mirror,
  // so we classify each texel: blue-dominant = PANEL (finish on), else = TEXT (off),
  // and feed it as metalnessMap + clearcoatMap. Finish lands only on the blue.
  const faceMask = useMemo(() => {
    const img = faceTex.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap) | undefined;
    const w = (img as { width?: number })?.width ?? 0;
    const h = (img as { height?: number })?.height ?? 0;
    if (!img || !w || !h) return null;
    try {
      const cnv = document.createElement("canvas");
      cnv.width = w; cnv.height = h;
      const ctx = cnv.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img as CanvasImageSource, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      const d = data.data;
      for (let p = 0; p < d.length; p += 4) {
        const r = d[p], b = d[p + 2];
        const isPanel = b - r > 12 && b > 60; // blue-dominant field = panel
        const v = isPanel ? 255 : 0;
        d[p] = v;        // R → clearcoatMap (clearcoat only on panel)
        d[p + 1] = 255;  // G → roughnessMap (multiplier 1 = leave roughness to scalar)
        d[p + 2] = v;    // B → metalnessMap (metalness only on panel)
        d[p + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(cnv);
      tex.flipY = false;
      tex.colorSpace = THREE.NoColorSpace; // data map, not colour
      tex.needsUpdate = true;
      return tex;
    } catch { return null; }
  }, [faceTex]);

  // ── Front-face ALBEDO recolour ─────────────────────────────────────────────
  // The baked PNG's blue is DARKER than our base panel blue, so the face plate
  // doesn't match the body. Repaint every blue-dominant texel to the base panel
  // colour (same classification as the mask) while leaving the white lettering and
  // dark markings untouched → the front plate now reads the SAME steel-blue as the
  // body (and the FIRE / ENG-START panels), text still crisp white.
  const faceAlbedo = useMemo(() => {
    const img = faceTex.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap) | undefined;
    const w = (img as { width?: number })?.width ?? 0;
    const h = (img as { height?: number })?.height ?? 0;
    if (!img || !w || !h) return null;
    try {
      const [pr, pg, pb] = hexRgb(tune.panel.color ?? PANEL_BLUE);
      // Recolour the blue field to the base panel colour ONLY (flat). The metallic SHEEN gradient is
      // applied GEOMETRY-ALIGNED in the material shader (see applySheen) instead of baked here in UV
      // space — so it lands on the panel's REAL edges regardless of this panel's UV / shape / size.
      const cnv = document.createElement("canvas");
      cnv.width = w; cnv.height = h;
      const ctx = cnv.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img as CanvasImageSource, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      const d = data.data;
      for (let p = 0; p < d.length; p += 4) {
        const r = d[p], b = d[p + 2];
        if (b - r > 12 && b > 60) { d[p] = pr; d[p + 1] = pg; d[p + 2] = pb; } // blue field → flat base colour
      }
      ctx.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(cnv);
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace; // this IS the colour map
      tex.anisotropy = 16;
      tex.needsUpdate = true;
      return tex;
    } catch { return null; }
  }, [faceTex, tune.panel.color]);

  // Geometry-aligned SHEEN (universal across panel shapes/sizes): the gradient is driven by each
  // fragment's WORLD position within the panel's bounding box — so Left/Right/Top/Bottom always map
  // to the panel's REAL edges, independent of UV layout. Uniforms are live-updated from the sliders.
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

  const { root, groups, guardPivot, captPivot, pressParts, surroundMat, hornParts, hornSurroundMat, commandAnchor, hornAnchor, captAnchor, capMats, hornCapMats } = useMemo(() => {
    const clone = scene.clone(true);
    const g: Groups = { panel: [], face: [], metal: [], button: [], shaft: [], evacLight: [], onLight: [] };
    const emissiveMeshes: THREE.Mesh[] = []; // collected, then split EVAC (upper) vs ON (lower) by height
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const remap = (m: THREE.Material): THREE.Material => {
        if (!m) return m;
        if (m.name === "hydraulic decals") {
          // FRONT plate — LIT MeshPhysical so the metallic finish + HDRI reflections
          // read like the FIRE panel; the mask keeps the finish off the lettering.
          // Colour left WHITE (map shows true baked colours; text stays crisp white).
          const face = new THREE.MeshPhysicalMaterial({
            map: faceTex, side: THREE.DoubleSide,
            roughness: 0.6, metalness: 1.5, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 1.0,
            metalnessMap: faceMask ?? undefined,
            clearcoatMap: faceMask ?? undefined,
          });
          face.name = "hydraulic decals"; applySheen(face); g.face.push(face); return face;
        }
        if (m.name === "Blue base" || m.name === "Blue base.001") {
          // body / border — FIRE FINAL reduced-glare steel-blue finish
          const base = new THREE.MeshPhysicalMaterial({ color: PANEL_BLUE, metalness: 1.86, roughness: 0.72, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.5 });
          base.name = m.name; applySheen(base); g.panel.push(base); return base;
        }
        if (m.name === "black button" || m.name === "black button.001") {
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = m.name; g.button.push(c); return c;
        }
        if (m.name === "metal") {
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = "metal"; g.metal.push(c); return c;
        }
        if (m.name === "Material") {
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = "Material"; g.shaft.push(c); return c;
        }
        if (m.name === "emissive") {
          // EVAC / ON legends — render UNLIT, colour driven per-frame by the alert state
          // (OFF = dark embossed text). depthTest STAYS ON so the surround/bezel ring
          // properly occludes the text when the cap recesses (no bleeding over the ring);
          // depthWrite off so the legends don't fight the cap face they sit on.
          const lit = new THREE.MeshBasicMaterial({ color: "#2a2f37", toneMapped: false, transparent: true, depthTest: true, depthWrite: false });
          lit.name = "emissive"; return lit;
        }
        return m.clone();
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(remap) : remap(obj.material);
      if (matNames(obj).has("hydraulic decals")) obj.renderOrder = 20;
      if (matNames(obj).has("emissive")) { obj.renderOrder = 31; emissiveMeshes.push(obj); }
    });

    // Bake the panel's display rotation onto the clone (Blender Z-up → screen frame:
    // X = right, Y = down, Z = toward camera), matching the ENG-START base.
    clone.rotation.x = Math.PI / 2;
    clone.updateMatrixWorld(true);

    // Split the emissive legends by HEIGHT (world Y): the upper one is "EVAC" (red flash),
    // the lower ones are "ON" + its lens (white). Position-based, name-independent.
    emissiveMeshes.forEach((mesh) => {
      const upper = mesh.getWorldPosition(new THREE.Vector3()).y > -0.08; // EVAC sits above ON
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mm) => { const bm = mm as THREE.MeshBasicMaterial; (upper ? g.evacLight : g.onLight).push(bm); });
    });

    // ── Moving parts ───────────────────────────────────────────────────────────
    // Identified by MATERIAL + authored X-rotation (name-independent, per skill §0.2):
    //  • guard = the LARGE "black button" cover authored tilted open (≈ −44° about X)
    //  • lever = the "metal" toggle authored tilted (≈ +13° about X)
    //  • rod   = the "Material" hinge bar the guard must pivot on (runs left↔right = X)
    let guardMesh: THREE.Mesh | null = null;
    let captMesh: THREE.Mesh | null = null;
    let rodMesh: THREE.Mesh | null = null;
    let guardBest = 0, captBest = 0;
    const sz = new THREE.Vector3();
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const names = matNames(o);
      const rx = o.rotation.x;
      if (names.has("Material")) rodMesh = o;
      if (names.has("black button") && rx < -0.3 && rx > -1.2) {
        new THREE.Box3().setFromObject(o).getSize(sz);
        const vol = sz.x * sz.y * sz.z;
        if (vol > guardBest) { guardBest = vol; guardMesh = o; } // largest tilted cover = the guard
      }
      if (names.has("metal") && Math.abs(rx) > 0.05 && Math.abs(rx) < 0.6) {
        if (Math.abs(rx) > captBest) { captBest = Math.abs(rx); captMesh = o; }
      }
    });

    // GUARD: keep its authored pose (it is modelled ATTACHED to the rod) and simply
    // re-parent it under a pivot placed ON the rod's axis (world X). Rotating that pivot
    // swings the guard about the rod, staying attached. Angle is a delta from authored;
    // the resting CLOSED angle is baked into the tune default below.
    let guardPivot: THREE.Group | null = null;
    if (guardMesh && rodMesh) {
      const gw = (guardMesh as THREE.Mesh).getWorldPosition(new THREE.Vector3());
      const rw = (rodMesh as THREE.Mesh).getWorldPosition(new THREE.Vector3());
      const hinge = new THREE.Vector3(gw.x, rw.y, rw.z); // hinge LINE through the rod, at the guard's x
      guardPivot = new THREE.Group(); guardPivot.name = "guard_pivot"; clone.add(guardPivot);
      guardPivot.position.copy(clone.worldToLocal(hinge.clone()));
      guardPivot.attach(guardMesh);
    }

    // CAPT selector: a TOGGLE that tilts up/down — base stays fixed in the knob, the tip
    // swings. The lever protrudes along the panel NORMAL (world Z), so its base is the
    // panel-side end (min world Z). Pivot there and TILT about world X so the tip rises
    // and falls (down = CAPT, up = CAPT & PURS) — not a round-and-round sweep.
    let captPivot: THREE.Group | null = null;
    if (captMesh) {
      const box = new THREE.Box3().setFromObject(captMesh);
      const c = box.getCenter(new THREE.Vector3());
      const base = new THREE.Vector3(c.x, c.y, box.min.z); // knob/panel-side end = the fixed base
      captPivot = new THREE.Group(); captPivot.name = "capt_pivot"; clone.add(captPivot);
      captPivot.position.copy(clone.worldToLocal(base.clone()));
      captPivot.attach(captMesh);
    }

    // ── COMMAND pushbutton — agent-pb treatment (skill §5 press feel + §10f cap/surround) ──
    // In the COMMAND x-band, among the non-rotated "black button" cubes (exclude the guard
    // + the tiny rod caps): the LARGEST cube is the SURROUND (gets a distinct border tone),
    // the rest are the CAP. The cap + the EVAC/ON legends dip IN (−Z, panel normal) and
    // spring back OUT on each press, exactly like the FIRE AGENT pbs.
    const cmdCubes: { mesh: THREE.Mesh; vol: number }[] = [];
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o === guardMesh) return;
      if (!matNames(o).has("black button")) return;
      const wp = o.getWorldPosition(new THREE.Vector3());
      if (wp.x > 1.0 || Math.abs(o.rotation.x) > 0.1) return; // COMMAND area, upright only
      const s = new THREE.Vector3(); new THREE.Box3().setFromObject(o).getSize(s);
      const vol = s.x * s.y * s.z;
      if (vol < 0.0005) return; // skip tiny rod caps
      cmdCubes.push({ mesh: o, vol });
    });
    let surroundMat: THREE.MeshStandardMaterial | null = null;
    let commandAnchor: THREE.Vector3 | null = null; // click target (world)
    const pressParts: { mesh: THREE.Mesh; baseZ: number }[] = [];
    const capMats: THREE.MeshStandardMaterial[] = []; // COMMAND cap material(s) → cap colour
    if (cmdCubes.length) {
      cmdCubes.sort((a, b) => b.vol - a.vol);
      const surround = cmdCubes[0].mesh; // largest = bezel/surround
      commandAnchor = surround.getWorldPosition(new THREE.Vector3());
      surroundMat = (Array.isArray(surround.material) ? surround.material[0] : surround.material) as THREE.MeshStandardMaterial;
      // cap = the smaller cubes; they + the legends travel together on press. The clone is
      // rotated PI/2 about X, so the panel-normal (press) axis in mesh-LOCAL space is Y.
      cmdCubes.slice(1).forEach(({ mesh }) => {
        pressParts.push({ mesh, baseZ: mesh.position.y });
        capMats.push((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial);
      });
      emissiveMeshes.forEach((mesh) => pressParts.push({ mesh, baseZ: mesh.position.y }));
    }

    // ── HORN SHUT OFF pushbutton — same AGENT-pb treatment, MOMENTARY (no legend light) ──
    // Round "black button" cylinders in the HORN x-band (≈1.1–1.6): largest = surround
    // (distinct tone), smallest = the cap that dips in/out on a (momentary) press.
    const hornCyls: { mesh: THREE.Mesh; vol: number }[] = [];
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o === captMesh) return;
      if (!matNames(o).has("black button")) return;
      const wp = o.getWorldPosition(new THREE.Vector3());
      if (wp.x < 1.1 || wp.x > 1.6) return; // HORN SHUT OFF area only
      const s = new THREE.Vector3(); new THREE.Box3().setFromObject(o).getSize(s);
      hornCyls.push({ mesh: o, vol: s.x * s.y * s.z });
    });
    let hornSurroundMat: THREE.MeshStandardMaterial | null = null;
    let hornAnchor: THREE.Vector3 | null = null;
    const hornParts: { mesh: THREE.Mesh; baseZ: number }[] = [];
    const hornCapMats: THREE.MeshStandardMaterial[] = [];
    if (hornCyls.length) {
      hornCyls.sort((a, b) => b.vol - a.vol);
      const hs = hornCyls[0].mesh; // largest = surround
      hornAnchor = hs.getWorldPosition(new THREE.Vector3());
      hornSurroundMat = (Array.isArray(hs.material) ? hs.material[0] : hs.material) as THREE.MeshStandardMaterial;
      hornCyls.slice(1).forEach(({ mesh }) => {
        hornParts.push({ mesh, baseZ: mesh.position.y });
        hornCapMats.push((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial);
      });
    }
    const captAnchor = captMesh ? (captMesh as THREE.Mesh).getWorldPosition(new THREE.Vector3()) : null;
    // world-space bounds of the whole panel → drives the geometry-aligned sheen (real L/R/T/B edges)
    clone.updateWorldMatrix(true, true);
    const pbox = new THREE.Box3().setFromObject(clone);
    sheenU.uBMin.value.copy(pbox.min); sheenU.uBMax.value.copy(pbox.max);
    return { root: clone, groups: g, guardPivot, captPivot, pressParts, surroundMat, hornParts, hornSurroundMat, commandAnchor, hornAnchor, captAnchor, capMats, hornCapMats };
  }, [scene, faceTex, faceMask]);

  // sheen uniforms follow the sliders live (uniform-value changes need no recompile)
  useEffect(() => {
    sheenU.uSL.value = tune.panel.sheenL; sheenU.uSR.value = tune.panel.sheenR;
    sheenU.uST.value = tune.panel.sheenT; sheenU.uSB.value = tune.panel.sheenB;
  }, [tune.panel.sheenL, tune.panel.sheenR, tune.panel.sheenT, tune.panel.sheenB, sheenU]);

  // apply the tune to each part group (live)
  useEffect(() => {
    groups.panel.forEach((m) => { if (m.color) m.color.set(tune.panel.color ?? PANEL_BLUE); m.roughness = tune.panel.roughness; m.metalness = tune.panel.metalness; m.clearcoat = tune.panel.clearcoat; m.envMapIntensity = tune.panel.env; m.needsUpdate = true; });
    // front plate: SAME finish as the body so they read as one metal. Albedo is the
    // RECOLOURED face map (blue→base colour, text kept white); material colour stays
    // white so the map shows true (decalColor can tint markings if ever needed).
    groups.face.forEach((m) => { if (m.color) m.color.set(tune.decalColor); m.map = faceAlbedo ?? faceTex; m.roughness = tune.panel.roughness; m.metalness = tune.panel.metalness; m.clearcoat = tune.panel.clearcoat; m.envMapIntensity = tune.panel.env; m.needsUpdate = true; });
    groups.metal.forEach((m) => { if (m.color) m.color.set(tune.metal.color); m.roughness = tune.metal.roughness; m.metalness = tune.metal.metalness; m.envMapIntensity = tune.metal.env; m.needsUpdate = true; });
    const bhex = blackHex(tune.buttonBlack);
    groups.button.forEach((m) => { if (m.color) m.color.set(bhex); m.roughness = 1.0; m.metalness = 0.0; m.envMapIntensity = 0.0; m.needsUpdate = true; }); // env 0 → true deep black (skill §10e)
    groups.shaft.forEach((m) => { if (m.color) m.color.set(tune.shaft.color); m.roughness = tune.shaft.roughness; m.metalness = tune.shaft.metalness; m.needsUpdate = true; });
    // EVAC / ON legends are driven per-frame from `active` (see useFrame) — not the tune.
  }, [groups, tune, faceAlbedo, faceTex]);

  // bind env map onto panel + face + metal + button materials so envMapIntensity is honoured
  const bound = useRef(false);
  useEffect(() => { bound.current = false; }, [groups]);
  // press-feel state: record the clock time of each COMMAND press (active toggle) and
  // each HORN SHUT OFF press (momentary — signal increments per press).
  const prevActive = useRef(active);
  const pressAt = useRef(-999);
  const prevHorn = useRef(hornSignal);
  const hornAt = useRef(-999);
  useFrame(({ scene: fs, clock }) => {
    if (!bound.current && fs.environment) {
      groups.panel.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      groups.face.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      groups.metal.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      groups.button.forEach((m) => { m.envMap = fs.environment; m.envMapIntensity = 0; m.needsUpdate = true; });
      bound.current = true;
    }
    // detect a COMMAND press (active toggled either way) → start the mechanical dip
    if (active !== prevActive.current) { pressAt.current = clock.elapsedTime; prevActive.current = active; }

    // Pushbutton press model (HYD-style absolute offsets, lerped). Each press dips the cap
    // to IN first; then:
    //   • COMMAND ("EVAC") pb → SETTLES at its STAYS position (latched) while active.
    //   • HORN SHUT OFF       → momentary: RETURNS to its original NEUTRAL position.
    if (hornSignal !== prevHorn.current) { hornAt.current = clock.elapsedTime; prevHorn.current = hornSignal; }
    const offFor = (p: "neutral" | "in" | "stays") => (p === "in" ? tune.btn.inY : p === "stays" ? tune.btn.staysY : tune.btn.neutralY);
    const PRESS_DUR = 0.2; // s — dip duration before the cap settles / springs back
    const cmdElapsed = clock.elapsedTime - pressAt.current;
    const hornElapsed = clock.elapsedTime - hornAt.current;
    const cmdOff = btnPos !== "auto" ? offFor(btnPos)
      : (active ? (cmdElapsed < PRESS_DUR ? tune.btn.inY : tune.btn.staysY) : tune.btn.neutralY); // dip → STAYS while active
    // HORN never latches: it only rests at NEUTRAL or dips to IN. So the "stays" preview maps
    // to neutral for it, and in live mode it always springs back to NEUTRAL after the dip.
    const hornOff = btnPos === "in" ? tune.btn.inY
      : btnPos === "neutral" || btnPos === "stays" ? tune.btn.neutralY
      : (hornAt.current > 0 && hornElapsed < PRESS_DUR ? tune.btn.inY : tune.btn.neutralY); // dip → back to NEUTRAL
    pressParts.forEach(({ mesh, baseZ }) => { mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, baseZ + cmdOff, 0.25); });
    hornParts.forEach(({ mesh, baseZ }) => { mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, baseZ + hornOff, 0.25); });

    // EVAC alert lights [fcom:4a DSC-23-40-10]: EVAC legend FLASHES RED (~1.5 Hz) while
    // active; the white ON legend comes on only AFTER the push dip completes (once COMMAND
    // has reached its STAYS position) and then stays lit.
    const flashOn = Math.floor(clock.elapsedTime * 3) % 2 === 0; // 1.5 Hz full cycle
    const evacLit = active && flashOn;
    const onLit = active && cmdElapsed > PRESS_DUR; // ON appears after the press, then stays
    groups.evacLight.forEach((m) => { m.color.set(evacLit ? "#ff2412" : "#241015"); m.opacity = evacLit ? 1 : 0.35; });
    groups.onLight.forEach((m) => { m.color.set(onLit ? "#eef2f7" : "#2a2f37"); m.opacity = onLit ? 1 : 0.6; });

    // Cap colour + DISTINCT border tone (HYD button-edit), live per-frame from the tune.
    [...capMats, ...hornCapMats].forEach((m) => { if (m?.color) { m.color.set(tune.btn.capColor); m.metalness = 0.0; m.roughness = 0.9; m.envMapIntensity = 0.0; } });
    [surroundMat, hornSurroundMat].forEach((sm) => { if (sm?.color) { sm.color.set(tune.btn.borderColor); sm.metalness = 0.5; sm.roughness = 0.5; sm.envMapIntensity = 0.4; } });

    // COMMAND guard: when active it lifts OPEN to expose the pb; otherwise rests at the tuned angle.
    if (guardPivot) guardPivot.rotation.x = ((active ? -90 : (tune.guard.angle ?? 0)) * Math.PI) / 180;
    // CAPT selector: TILT the lever up/down about its base (world X). down=CAPT / up=CAPT&PURS.
    if (captPivot) captPivot.rotation.x = ((tune.capt.angle ?? 0) * Math.PI) / 180;
  });

  const { camera, size, controls } = useThree();
  useEffect(() => {
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const dim = box.getSize(new THREE.Vector3());
    const dims = [{ a: "x" as const, v: dim.x }, { a: "y" as const, v: dim.y }, { a: "z" as const, v: dim.z }].sort((p, q) => p.v - q.v);
    const normal = dims[0].a, w = dims[2].v, h = dims[1].v;
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(1, size.height);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = Math.max(w / 2 / Math.tan(hFov / 2), h / 2 / Math.tan(vFov / 2)) * 1.1 + dim[normal];
    const viewDir = new THREE.Vector3(normal === "x" ? 1 : 0, normal === "y" ? 1 : 0, normal === "z" ? 1 : 0);
    const heightAxis = dims[1].a;
    cam.up.set(heightAxis === "x" ? 1 : 0, heightAxis === "y" ? 1 : 0, heightAxis === "z" ? 1 : 0);
    cam.position.copy(center).addScaledVector(viewDir, dist);
    cam.near = Math.max(0.01, dist * 0.02); cam.far = dist * 6; cam.updateProjectionMatrix();
    cam.lookAt(center);
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit?.target) { orbit.target.copy(center); orbit.update(); }
  }, [camera, size.width, size.height, controls, root]);

  // Position-based click resolution (skill §5): act on the control nearest the 3D point.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.point) return;
    const p = e.point;
    const targets: { a: THREE.Vector3 | null; fn?: () => void }[] = [
      { a: commandAnchor, fn: onCommand },
      { a: hornAnchor, fn: onHorn },
      { a: captAnchor, fn: onCapt },
    ];
    let bestD = Infinity;
    let bestFn: (() => void) | undefined;
    targets.forEach((t) => { if (!t.a) return; const d = t.a.distanceTo(p); if (d < bestD) { bestD = d; bestFn = t.fn; } });
    if (bestD < 0.28) bestFn?.(); // clicked on a control
  };

  return <primitive object={root} onClick={handleClick} />;
}

export function EvacPanel3D({ tune, active = false, hornSignal = 0, btnPos = "auto", onCommand, onHorn, onCapt }: {
  tune?: EvacTune; active?: boolean; hornSignal?: number; btnPos?: EvacBtnPos;
  onCommand?: () => void; onHorn?: () => void; onCapt?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: "100%", height: "100%", background: "#070a0e" }} />;
  return (
    <Canvas
      dpr={cockpitDpr()}
      camera={{ fov: 28, near: 0.01, far: 100, position: [0, 0, 4] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      style={{ width: "100%", height: "100%", background: "#05070a" }}
    >
      <ambientLight intensity={0.18} color="#9fb0c4" />
      <directionalLight position={[2.6, 3.2, 4.5]} intensity={2.8} color="#ffffff" />
      <directionalLight position={[-2.4, 1.0, 3.0]} intensity={1.1} color="#cfe0ff" />
      <Suspense fallback={null}>
        <Environment files={HDRI_URL} environmentIntensity={1.5} />
        <EvacScene tune={tune ?? EVAC_TUNE_DEFAULT} active={active} hornSignal={hornSignal} btnPos={btnPos}
          onCommand={onCommand} onHorn={onHorn} onCapt={onCapt} />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
