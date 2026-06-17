"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HydPanel3D — web render of Downloads/hydraulic.blend1 (REAL A320 HYDRAULIC panel).
// Fire-panel FINAL treatment (blender-panels-to-web SKILL §10): LIT metallic face +
// text mask + matte buttons + isolated reflections + §10h lighting + cockpitDpr.
//
// Buttons are the SAME type as the FIRE AGENT pbs. They move along the panel normal
// between THREE tunable positions — NEUTRAL (default) / IN (pushed) / OUT (popped) —
// dialled via the dev edit bar (`tune`). Legends (FAULT/OFF) visible-dim → glow lit.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { cockpitDpr } from "@/components/cockpit/cockpit-dpr";

const MODEL_URL = "/models/hyd_panel.glb";
const FACE_TEX_URL = "/models/hyd_face.png";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";

// Target = the FIRE panel's ON-SCREEN tone (#344e68). Compensated for HYD's brighter reflections:
// #3a5572 @ reflections 0.8 with fire's metal 1.5 / rough 0.6 / clear 0.4 finish.
const PANEL_BASE = "#3a5572";
const LEGEND_DIM = "#8b95a3";
const LEGEND_AMBER = "#ff9f00";
const LEGEND_WHITE = "#f3f6fa";

export type HydLit = Record<string, "amber" | "white" | null>;
export type HydPos = "neutral" | "in" | "out";
export interface HydTune {
  capColor: string;    // button CAP (inner plate) — live fire-panel = #070a0e
  borderColor: string; // SURROUND/border (outer plate, incl. ELEC PUMP frame) — live fire = #222730
  ratColor: string;    // RAT MAN ON switch plates (under the orange guard)
  // ABSOLUTE cap offsets along the press axis (added to the imported baseY):
  neutralY: number;    // default resting position
  inY: number;         // deepest point while pushed IN
  outY: number;        // settled/actuated position (where it stays after the press)
  // FRONT-PANEL (FACE + Blue base) material — the SAME four knobs eng-start exposes, so
  // HYD's front panel can be matched to it live. §12: env = colour, clearcoat = sheen.
  panelColor: string;  // Blue base tint (face field is recoloured to #456a93 in the bake pass)
  panelRough: number;  // roughness
  panelMetal: number;  // metalness (1.5 = near-mirror)
  panelClear: number;  // clearcoat (gloss layer — restores "life" without brightening the field)
  panelEnv: number;    // envMapIntensity (Reflections — drives the rendered blue)
  sheenTop: number;    // faked metallic sheen: top-of-panel brightness × (mimics fire's gradient)
  sheenBot: number;    // faked metallic sheen: bottom-of-panel brightness ×
}
// capColor = canvas backdrop (unlit, DO NOT TOUCH). border frame + RAT switch lifted for
// contrast (all plates unlit so the hex shows exactly): border #333949, RAT #222734.
// panel* defaults mirror eng-start's Blue base (rough 0.6 / metal 1.5 / clearcoat 0.4 / env 1.0)
// so HYD starts parameter-identical to it; tune live to match the rendered look.
export const HYD_TUNE_DEFAULT: HydTune = { capColor: "#05070a", borderColor: "#333949", ratColor: "#222734", neutralY: 0.008, inY: -0.03, outY: -0.014, panelColor: "#3a5572", panelRough: 0.6, panelMetal: 1.5, panelClear: 0.4, panelEnv: 0.8, sheenTop: 1.7, sheenBot: 0.35 };

function matNames(o: THREE.Object3D): Set<string> {
  const s = new Set<string>();
  o.traverse((m) => { if (m instanceof THREE.Mesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm && s.add(mm.name)); });
  return s;
}

function HydScene({ lit, tune, pos }: { lit: HydLit; tune: HydTune; pos: HydPos }) {
  const { scene } = useGLTF(MODEL_URL);
  const faceTex = useTexture(FACE_TEX_URL);
  faceTex.flipY = false; faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 16;

  // One pixel scan over the baked face builds THREE textures:
  //  • mask    — §10c text-protection mask (finish only on the panel field, not text)
  //  • colored — face RECOLOURED so the panel field = standard panel blue (#456a93)
  //  • marks   — markings ONLY (field transparent) → drawn as an UNLIT overlay so the
  //    white/green lettering stays neutral instead of picking up green env light (the
  //    way every other panel keeps its decals neutral; eng-start uses a MeshBasic decal).
  const { faceMask, faceColored, faceMarks } = useMemo(() => {
    const NUL = { faceMask: null, faceColored: null, faceMarks: null };
    const img = faceTex.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap) | undefined;
    const w = (img as { width?: number })?.width ?? 0, h = (img as { height?: number })?.height ?? 0;
    if (!img || !w || !h) return NUL;
    try {
      const mk = document.createElement("canvas"); mk.width = w; mk.height = h;
      const cl = document.createElement("canvas"); cl.width = w; cl.height = h;
      const dk = document.createElement("canvas"); dk.width = w; dk.height = h;
      const mctx = mk.getContext("2d"), cctx = cl.getContext("2d"), dctx = dk.getContext("2d");
      if (!mctx || !cctx || !dctx) return NUL;
      mctx.drawImage(img as CanvasImageSource, 0, 0); cctx.drawImage(img as CanvasImageSource, 0, 0); dctx.drawImage(img as CanvasImageSource, 0, 0);
      const md = mctx.getImageData(0, 0, w, h), cd = cctx.getImageData(0, 0, w, h), dd = dctx.getImageData(0, 0, w, h);
      const m = md.data, c = cd.data, dmk = dd.data;
      const FIELD = tune.panelColor || PANEL_BASE; // live: Colour slider drives the FRONT face field too (not just the Blue base behind)
      const pr = parseInt(FIELD.slice(1, 3), 16), pg = parseInt(FIELD.slice(3, 5), 16), pb = parseInt(FIELD.slice(5, 7), 16);
      // SHEEN FAKE (option 2): bake a vertical light→dark gradient into the recoloured field so the
      // flat HYD plate mimics the fire panel's metallic top-bright/bottom-dark gradient — HYD's
      // geometry can't produce that gloss on its own (measured: fire gloss 34 vs HYD 16). Live via
      // the Sheen top/bottom sliders so the editor matches what's rendered.
      const GRAD_TOP = tune.sheenTop, GRAD_BOT = tune.sheenBot;
      for (let p = 0; p < m.length; p += 4) {
        const r = m[p], g = m[p + 1], b = m[p + 2]; const lum = (r + g + b) / 3;
        const isPanel = lum < 110 && !(g > r + 24 && g > b + 24);
        m[p] = isPanel ? 255 : 0; m[p + 1] = 255; m[p + 2] = isPanel ? 255 : 0; m[p + 3] = 255;
        if (isPanel) { const t = Math.floor((p >> 2) / w) / h; const grad = GRAD_TOP + (GRAD_BOT - GRAD_TOP) * t; c[p] = Math.min(255, pr * grad); c[p + 1] = Math.min(255, pg * grad); c[p + 2] = Math.min(255, pb * grad); } // recolour field + sheen gradient
        if (isPanel) dmk[p + 3] = 0; // markings overlay: drop the field, keep only lettering
      }
      mctx.putImageData(md, 0, 0); cctx.putImageData(cd, 0, 0); dctx.putImageData(dd, 0, 0);
      const mask = new THREE.CanvasTexture(mk); mask.flipY = false; mask.colorSpace = THREE.NoColorSpace; mask.needsUpdate = true;
      const colored = new THREE.CanvasTexture(cl); colored.flipY = false; colored.colorSpace = THREE.SRGBColorSpace; colored.anisotropy = 16; colored.needsUpdate = true;
      const marks = new THREE.CanvasTexture(dk); marks.flipY = false; marks.colorSpace = THREE.SRGBColorSpace; marks.anisotropy = 16; marks.needsUpdate = true;
      return { faceMask: mask, faceColored: colored, faceMarks: marks };
    } catch { return NUL; }
  }, [faceTex, tune.panelColor, tune.sheenTop, tune.sheenBot]);

  const { root, legendMats, panelMats, btnClass, movable } = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateWorldMatrix(true, true);
    const legendMats: { name: string; mat: THREE.MeshBasicMaterial }[] = [];
    const panelMats: THREE.MeshPhysicalMaterial[] = [];
    const blackMeshes: THREE.Mesh[] = [];
    const emissiveMeshes: THREE.Mesh[] = [];
    const guardMeshes: THREE.Mesh[] = [];
    let faceMesh: THREE.Mesh | null = null;
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      // Capture ORIGINAL material names BEFORE remap (remap renames emissive→legend,
      // hydraulic decals→face, so classifying after remap silently misses them).
      const names = matNames(obj);
      const remap = (m: THREE.Material): THREE.Material => {
        if (!m) return m;
        const mn = m.name;
        if (mn === "hydraulic decals") {
          const face = new THREE.MeshPhysicalMaterial({ map: faceColored ?? faceTex, side: THREE.DoubleSide, roughness: 0.6, metalness: 1.5, clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 1.0, metalnessMap: faceMask ?? undefined, clearcoatMap: faceMask ?? undefined });
          face.name = "face"; panelMats.push(face); return face;
        }
        if (mn === "Blue base") {
          const base = new THREE.MeshPhysicalMaterial({ color: PANEL_BASE, metalness: 1.5, roughness: 0.6, clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 1.0 });
          base.name = "Blue base"; panelMats.push(base); return base;
        }
        if (mn === "black button") {
          const c = m.clone() as THREE.MeshStandardMaterial; // colour assigned below
          c.name = "black button"; c.roughness = 1.0; c.metalness = 0.0; c.envMapIntensity = 0; return c;
        }
        if (mn === "orange housijng") {
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = "orange housijng"; c.metalness = 0.7; c.roughness = 0.32; return c;
        }
        if (mn === "emissive") {
          const leg = new THREE.MeshBasicMaterial({ color: LEGEND_DIM, toneMapped: false, transparent: true, depthWrite: false });
          leg.name = "legend"; leg.depthTest = false; legendMats.push({ name: obj.name, mat: leg }); return leg;
        }
        return m.clone();
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(remap) : remap(obj.material);
      if (names.has("hydraulic decals")) { obj.renderOrder = 18; faceMesh = obj; }
      if (names.has("emissive")) { obj.renderOrder = 31; emissiveMeshes.push(obj); }
      if (names.has("black button")) blackMeshes.push(obj);
      if (names.has("orange housijng")) guardMeshes.push(obj);
    });

    // Markings overlay: redraw the face geometry UNLIT with the markings-only texture,
    // pulled slightly forward, so the white/green lettering stays neutral (matches the
    // way eng-start/fire keep decals neutral) instead of greening under the alley HDRI.
    const fm = faceMesh as THREE.Mesh | null;
    if (fm && faceMarks) {
      const overlay = fm.clone();
      overlay.material = new THREE.MeshBasicMaterial({ map: faceMarks, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      overlay.renderOrder = 19;
      (fm.parent ?? clone).add(overlay);
    }

    // RAT MAN ON is a GUARDED SWITCH, not a pushbutton — its plates must keep their
    // imported Blender position. Exclude anything near the orange guard from movable.
    const guardXs = guardMeshes.map((m) => m.getWorldPosition(new THREE.Vector3()).x);
    const isRat = (mesh: THREE.Mesh) => {
      const x = mesh.getWorldPosition(new THREE.Vector3()).x;
      return guardXs.some((gx) => Math.abs(x - gx) < 0.35);
    };

    // Classify each button's plates: per X cluster the LARGEST footprint plate is the
    // SURROUND/border (fixed); the rest are the CAP (moves).
    type BI = { mesh: THREE.Mesh; x: number; foot: number };
    const items: BI[] = blackMeshes.map((mesh) => {
      const c = mesh.getWorldPosition(new THREE.Vector3());
      const s = new THREE.Vector3(); new THREE.Box3().setFromObject(mesh).getSize(s);
      return { mesh, x: c.x, foot: s.x * s.z };
    }).sort((a, b) => a.x - b.x);
    const clusters: BI[][] = []; let cur: BI[] = [];
    items.forEach((it) => { if (cur.length && Math.abs(it.x - cur[0].x) > 0.4) { clusters.push(cur); cur = []; } cur.push(it); });
    if (cur.length) clusters.push(cur);
    const borderSet = new Set<THREE.Mesh>();
    clusters.forEach((cl) => borderSet.add(cl.reduce((a, b) => (b.foot > a.foot ? b : a)).mesh));
    const btnClass = blackMeshes.map((mesh) => ({ mesh, isBorder: borderSet.has(mesh), isRat: isRat(mesh) }));

    // ALL plates (cap + border frame + RAT switch) render UNLIT (MeshBasic) so each
    // shows its exact tune colour — no specular sheen. At the same hex they look
    // IDENTICAL to the cap; user lifts border/RAT blackness via pickers for contrast.
    blackMeshes.forEach((mesh) => {
      const flat = new THREE.MeshBasicMaterial({ color: 0x05070a, toneMapped: false });
      flat.name = "plate"; mesh.material = flat;
    });

    // movable = CAP plates (NOT the border, NOT the RAT switch) + the legends. The
    // border/bezel and the RAT guarded switch stay at their imported position.
    const movable: { mesh: THREE.Mesh; baseY: number }[] = [];
    blackMeshes.forEach((mesh) => { if (!borderSet.has(mesh) && !isRat(mesh)) movable.push({ mesh, baseY: mesh.position.y }); });
    emissiveMeshes.forEach((mesh) => { if (!isRat(mesh)) movable.push({ mesh, baseY: mesh.position.y }); });
    return { root: clone, legendMats, panelMats, btnClass, movable };
  }, [scene, faceTex, faceMask, faceColored, faceMarks]);

  // Colour the plates: RAT switch (ratColor) / bezel border (borderColor) / cap (capColor).
  useEffect(() => {
    btnClass.forEach(({ mesh, isBorder, isRat: rat }) => {
      const mm = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const sm = mm as THREE.MeshStandardMaterial;
      if (sm && sm.color) { sm.color.set(rat ? tune.ratColor : isBorder ? tune.borderColor : tune.capColor); sm.needsUpdate = true; }
    });
  }, [btnClass, tune.capColor, tune.borderColor, tune.ratColor]);
  useEffect(() => {
    legendMats.forEach(({ name, mat }) => { const v = lit[name]; mat.color.set(v === "amber" ? LEGEND_AMBER : v === "white" ? LEGEND_WHITE : LEGEND_DIM); mat.needsUpdate = true; });
  }, [legendMats, lit]);
  // FRONT-PANEL material — apply the four knobs (rough/metal/clearcoat/env) to BOTH the face
  // and the Blue base live. Colour (panelColor) now drives BOTH layers: the Blue base tint here,
  // and the front face field via the faceColored recolour memo (keyed on tune.panelColor).
  useEffect(() => {
    panelMats.forEach((m) => {
      m.roughness = tune.panelRough; m.metalness = tune.panelMetal;
      m.clearcoat = tune.panelClear; m.envMapIntensity = tune.panelEnv;
      if (m.name === "Blue base" && m.color) m.color.set(tune.panelColor);
      m.needsUpdate = true;
    });
  }, [panelMats, tune.panelColor, tune.panelRough, tune.panelMetal, tune.panelClear, tune.panelEnv]);

  // Press positions: move the button caps + legends along the panel normal (Y) to the
  // selected of the THREE tunable positions. Lerped → real mechanical press feel.
  useFrame(() => {
    // neutralY / inY / outY are ABSOLUTE cap offsets (added to baseY) — not deltas.
    const off = pos === "in" ? tune.inY : pos === "out" ? tune.outY : tune.neutralY;
    movable.forEach(({ mesh, baseY }) => { mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, baseY + off, 0.2); });
  });

  const bound = useRef(false);
  useEffect(() => { bound.current = false; }, [panelMats]);
  useFrame(({ scene: fs }) => {
    if (!bound.current && fs.environment) { panelMats.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; }); bound.current = true; }
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
    const dist = Math.max(w / 2 / Math.tan(hFov / 2), h / 2 / Math.tan(vFov / 2)) * 1.08 + dim[normal];
    const viewDir = new THREE.Vector3(normal === "x" ? 1 : 0, normal === "y" ? 1 : 0, normal === "z" ? 1 : 0);
    const heightAxis = dims[1].a;
    cam.up.set(heightAxis === "x" ? -1 : 0, heightAxis === "y" ? -1 : 0, heightAxis === "z" ? -1 : 0);
    cam.position.copy(center).addScaledVector(viewDir, dist);
    cam.near = Math.max(0.001, dist * 0.02); cam.far = dist * 6; cam.updateProjectionMatrix();
    cam.lookAt(center);
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit?.target) { orbit.target.copy(center); orbit.update(); }
  }, [camera, size.width, size.height, controls, root]);

  return <primitive object={root} />;
}

export function HydPanel3D({ lit, tune, pos, controlled }: { lit?: HydLit; tune?: HydTune; pos?: HydPos; controlled?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: "100%", height: "100%", background: "#070a0e" }} />;
  return (
    <Canvas
      dpr={cockpitDpr()}
      camera={{ fov: 22, near: 0.001, far: 100, position: [0, 0, 1] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      style={{ width: "100%", height: "100%", background: "#05070a" }}
    >
      <ambientLight intensity={0.18} color="#9fb0c4" />
      <directionalLight position={[2.6, 3.2, 4.5]} intensity={2.8} color="#ffffff" />
      <directionalLight position={[-2.4, 1.0, 3.0]} intensity={1.1} color="#cfe0ff" />
      <Suspense fallback={null}>
        <Environment files={HDRI_URL} environmentIntensity={1.5} />
        <HydScene lit={lit ?? {}} tune={tune ?? HYD_TUNE_DEFAULT} pos={pos ?? "neutral"} />
      </Suspense>
      {!controlled && <OrbitControls makeDefault enableDamping dampingFactor={0.08} />}
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
