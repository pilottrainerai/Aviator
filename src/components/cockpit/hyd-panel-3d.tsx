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

// USER-DIALLED settings (2026-06-17): teal-blue #4a8296, dialled live in the editor and confirmed
// on the real screen. Metalness 1.86 (three.js clamps to 1.0 = full mirror) + reflections 0.5.
const PANEL_BASE = "#4a8296";
const LEGEND_DIM = "#8b95a3";
const LEGEND_AMBER = "#ff9f00";
const LEGEND_WHITE = "#f3f6fa";

export type HydPos = "neutral" | "in" | "out";
// FCOM DSC-29-20 "Controls and Indicators" — the five light-carrying HYD pumps, in panel
// order L→R. RAT MAN ON has no FAULT/OFF light, so it is NOT in this list. The 3D model's
// emissive legend cells are clustered by world-X and assigned to these keys in order.
export type HydPumpKey = "eng1" | "blueElec" | "ptu" | "eng2" | "yellowElec";
export const HYD_PUMP_ORDER: HydPumpKey[] = ["eng1", "blueElec", "ptu", "eng2", "yellowElec"];
export const HYD_PUMP_LABELS: Record<HydPumpKey, string> = {
  eng1: "ENG 1 PUMP", blueElec: "BLUE ELEC PUMP", ptu: "PTU", eng2: "ENG 2 PUMP", yellowElec: "YELLOW ELEC PUMP",
};
export interface HydPumpLights {
  off?: boolean;      // pump selected OFF → OFF legend lights WHITE (inverted Airbus convention)  [fcom:DSC-29-20]
  on?: boolean;       // YELLOW ELEC PUMP only (springloaded) → ON legend lights WHITE when running  [fcom:DSC-29-20]
  fault?: boolean;    // a fault condition exists → FAULT legend AMBER  [fcom:DSC-29-20]
  overheat?: boolean; // the fault is an overheat → FAULT stays lit even when OFF is selected  [fcom:DSC-29-20]
}
export type HydPumpState = Partial<Record<HydPumpKey, HydPumpLights>>;
// RAT MAN ON guarded switch — the red guard (material "orange housijng") flips open about its
// top hinge like the EVAC COMMAND guard. Editable angle so the open pose can be dialled live.
export interface HydGuard { open: boolean; angleDeg: number; hingeYOff: number; hingeZOff: number }
export type HydRatGuard = HydGuard; // back-compat alias
export const HYD_RAT_GUARD_DEFAULT: HydGuard = { open: false, angleDeg: -115, hingeYOff: 0, hingeZOff: 0 };
export const HYD_ELEC_GUARD_DEFAULT: HydGuard = { open: false, angleDeg: -115, hingeYOff: 0, hingeZOff: 0 };
// A guarded pushbutton under a cover (RAT MAN ON, BLUE ELEC PUMP): cap colour + press offset
// (absolute Y offset added to the cap's imported position; negative = pressed IN).
// `color` = the raised CIRCULAR pushbutton; `plateColor` (RAT only) = the recessed flat
// backing plate around it — the two RAT parts colour independently.
export interface HydBtn { color: string; inOut: number; plateColor?: string }
export const HYD_RAT_BTN_DEFAULT: HydBtn = { color: "#15171e", inOut: 0, plateColor: "#05070a" };
export const HYD_ELEC_BTN_DEFAULT: HydBtn = { color: "#0b0d12", inOut: 0 };
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
  sheenT: number;      // faked metallic sheen: brightness × at the TOP edge    (1.0 = neutral)
  sheenB: number;      // faked metallic sheen: brightness × at the BOTTOM edge (1.0 = neutral)
  sheenL: number;      // faked metallic sheen: brightness × at the LEFT edge   (1.0 = neutral)
  sheenR: number;      // faked metallic sheen: brightness × at the RIGHT edge  (1.0 = neutral)
}
// capColor = canvas backdrop (unlit, DO NOT TOUCH). border frame + RAT switch lifted for
// contrast (all plates unlit so the hex shows exactly): border #333949, RAT #222734.
// panel* defaults mirror eng-start's Blue base (rough 0.6 / metal 1.5 / clearcoat 0.4 / env 1.0)
// so HYD starts parameter-identical to it; tune live to match the rendered look.
export const HYD_TUNE_DEFAULT: HydTune = { capColor: "#05070a", borderColor: "#15171e", ratColor: "#222734", neutralY: 0.008, inY: -0.041, outY: -0.009, panelColor: "#4a8296", panelRough: 0.72, panelMetal: 1.86, panelClear: 0.6, panelEnv: 0.5, sheenT: 0.95, sheenB: 0.9, sheenL: 0.95, sheenR: 1.35 };

function matNames(o: THREE.Object3D): Set<string> {
  const s = new Set<string>();
  o.traverse((m) => { if (m instanceof THREE.Mesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm && s.add(mm.name)); });
  return s;
}

function HydScene({ pumps, tune, pos, ratGuard, elecGuard, ratBtn, elecBtn }: { pumps: HydPumpState; tune: HydTune; pos: HydPos; ratGuard: HydGuard; elecGuard: HydGuard; ratBtn: HydBtn; elecBtn: HydBtn }) {
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
      // SHEEN FAKE (option 2): bake a 2D brightness field into the recoloured field so the flat HYD
      // plate mimics the fire panel's metallic gradient — HYD's geometry can't produce that gloss on
      // its own. Four independent edge sliders (top/bottom/left/right): brightness = horizontal lerp
      // (L→R) × vertical lerp (T→B). All 1.0 = flat. Live, so the editor matches the render.
      const ST = tune.sheenT, SB = tune.sheenB, SL = tune.sheenL, SR = tune.sheenR;
      for (let p = 0; p < m.length; p += 4) {
        const r = m[p], g = m[p + 1], b = m[p + 2]; const lum = (r + g + b) / 3;
        const isPanel = lum < 110 && !(g > r + 24 && g > b + 24);
        m[p] = isPanel ? 255 : 0; m[p + 1] = 255; m[p + 2] = isPanel ? 255 : 0; m[p + 3] = 255;
        if (isPanel) { const idx = p >> 2; const fx = (idx % w) / w, fy = ((idx / w) | 0) / h; const grad = (SL + (SR - SL) * fx) * (ST + (SB - ST) * fy); c[p] = Math.min(255, pr * grad); c[p + 1] = Math.min(255, pg * grad); c[p + 2] = Math.min(255, pb * grad); } // recolour field + 2D sheen (L→R × T→B edge sliders)
        if (isPanel) dmk[p + 3] = 0; // markings overlay: drop the field, keep only lettering
      }
      mctx.putImageData(md, 0, 0); cctx.putImageData(cd, 0, 0); dctx.putImageData(dd, 0, 0);
      const mask = new THREE.CanvasTexture(mk); mask.flipY = false; mask.colorSpace = THREE.NoColorSpace; mask.needsUpdate = true;
      const colored = new THREE.CanvasTexture(cl); colored.flipY = false; colored.colorSpace = THREE.SRGBColorSpace; colored.anisotropy = 16; colored.needsUpdate = true;
      const marks = new THREE.CanvasTexture(dk); marks.flipY = false; marks.colorSpace = THREE.SRGBColorSpace; marks.anisotropy = 16; marks.needsUpdate = true;
      return { faceMask: mask, faceColored: colored, faceMarks: marks };
    } catch { return NUL; }
  }, [faceTex, tune.panelColor, tune.sheenT, tune.sheenB, tune.sheenL, tune.sheenR]);

  const { root, pumpLegends, panelMats, btnClass, movable, ratParts, elecParts, guardPivot, guardMesh, guardBaseHinge, guardBaseLocal, elecPivot, elecCover, elecBaseHinge, elecBaseLocal } = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateWorldMatrix(true, true);
    // legend meshes captured WITH their mesh ref so they can be clustered by world-X into
    // per-pump columns (skill rule #2 — select by material+position, never by GLTF node name,
    // which the loader sanitizes: "Text.001" → "Text001", silently breaking name-keyed lookups).
    const legendEntries: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
    const panelMats: THREE.MeshPhysicalMaterial[] = [];
    const blackMeshes: THREE.Mesh[] = [];
    const emissiveMeshes: THREE.Mesh[] = [];
    const guardMeshes: THREE.Mesh[] = [];     // RAT orange cover
    const materialMeshes: THREE.Mesh[] = [];  // "Material" = guard hinge rods (ELEC guard rod)
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
          const face = new THREE.MeshPhysicalMaterial({ map: faceColored ?? faceTex, side: THREE.DoubleSide, roughness: 0.72, metalness: 1.86, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.5, metalnessMap: faceMask ?? undefined, clearcoatMap: faceMask ?? undefined });
          face.name = "face"; panelMats.push(face); return face;
        }
        if (mn === "Blue base") {
          const base = new THREE.MeshPhysicalMaterial({ color: PANEL_BASE, metalness: 1.86, roughness: 0.72, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.5 });
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
          leg.name = "legend"; leg.depthTest = false; legendEntries.push({ mesh: obj, mat: leg }); return leg;
        }
        return m.clone();
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(remap) : remap(obj.material);
      if (names.has("hydraulic decals")) { obj.renderOrder = 18; faceMesh = obj; }
      if (names.has("emissive")) { obj.renderOrder = 31; emissiveMeshes.push(obj); }
      if (names.has("black button")) blackMeshes.push(obj);
      if (names.has("orange housijng")) guardMeshes.push(obj);
      if (names.has("Material")) materialMeshes.push(obj);
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

    // ── Guarded controls: RAT (orange cover) + BLUE ELEC PUMP (raised black cover on a "Material"
    // rod). The ELEC cover is the most FORWARD black mesh (max world Y = the press/normal axis);
    // its rod is the nearest "Material" mesh. Pull both covers out of the button pool. ──
    const wp = (m: THREE.Mesh) => m.getWorldPosition(new THREE.Vector3());
    const orangeXs = guardMeshes.map((m) => wp(m).x);
    const isRat = (mesh: THREE.Mesh) => orangeXs.some((gx) => Math.abs(wp(mesh).x - gx) < 0.35);
    // ELEC guard cover = the most FORWARD (max world Y = press/normal axis) black mesh that is NOT
    // a RAT part (the RAT round-button cylinders also stick out, so they must be excluded first).
    const elecCover = blackMeshes.filter((m) => !isRat(m)).reduce<THREE.Mesh | null>((best, m) => (!best || wp(m).y > wp(best).y ? m : best), null);
    const elecX = elecCover ? wp(elecCover).x : Infinity;
    const elecRod = elecCover && materialMeshes.length
      ? materialMeshes.reduce<THREE.Mesh | null>((best, m) => (!best || Math.abs(wp(m).x - elecX) < Math.abs(wp(best).x - elecX) ? m : best), null)
      : null;
    const isElec = (mesh: THREE.Mesh) => mesh !== elecCover && Math.abs(wp(mesh).x - elecX) < 0.35;

    // The ELEC pump legend sits UNDER the flip-up guard. Plain pump legends render with
    // depthTest:false so the lit words always sit over the baked face — but that also makes
    // them bleed THROUGH the closed guard. For the ELEC legend ONLY, re-enable depthTest so the
    // opaque guard cover (depthWrite on, ~0.02 in front when shut) occludes it. The legend sits
    // ~0.025 forward of the face, so depth alone is enough — NO polygon offset (a forward offset
    // would shove the legend back through the thin cover gap and reintroduce the bleed-through).
    legendEntries.forEach(({ mesh, mat }) => {
      if (!isElec(mesh)) return;
      mat.depthTest = true;
      mat.needsUpdate = true;
    });

    const guardCovers = new Set<THREE.Mesh>([...guardMeshes, ...(elecCover ? [elecCover] : [])]);
    const plates = blackMeshes.filter((m) => !guardCovers.has(m));

    // Per X cluster the LARGEST-footprint plate is the fixed border — but ONLY for the plain pumps.
    // RAT + ELEC are single guarded pushbuttons, so their whole face moves (no fixed border).
    type BI = { mesh: THREE.Mesh; x: number; foot: number };
    const items: BI[] = plates.map((mesh) => {
      const c = wp(mesh); const s = new THREE.Vector3(); new THREE.Box3().setFromObject(mesh).getSize(s);
      return { mesh, x: c.x, foot: s.x * s.z };
    }).sort((a, b) => a.x - b.x);
    const clusters: BI[][] = []; let cur: BI[] = [];
    items.forEach((it) => { if (cur.length && Math.abs(it.x - cur[0].x) > 0.4) { clusters.push(cur); cur = []; } cur.push(it); });
    if (cur.length) clusters.push(cur);
    const borderSet = new Set<THREE.Mesh>();
    clusters.forEach((cl) => { if (cl.some((b) => isRat(b.mesh) || isElec(b.mesh))) return; borderSet.add(cl.reduce((a, b) => (b.foot > a.foot ? b : a)).mesh); });
    // Split the RAT control into its two black parts: the RAISED round button vs the recessed
    // flat backing PLATE. Size is the stable discriminator (skill §10f) — the plate has the
    // largest XZ footprint; everything else in the RAT cluster is the circular button. Only
    // tag a plate when >1 RAT part exists (a lone part is the button).
    const ratFoot = (m: THREE.Mesh) => { const s = new THREE.Vector3(); new THREE.Box3().setFromObject(m).getSize(s); return s.x * s.z; };
    const ratPlates = plates.filter((m) => isRat(m));
    const ratPlateMesh = ratPlates.length > 1 ? ratPlates.reduce((a, b) => (ratFoot(b) > ratFoot(a) ? b : a)) : null;
    const btnClass = plates.map((mesh) => ({ mesh, isBorder: borderSet.has(mesh), isRat: isRat(mesh), isRatPlate: mesh === ratPlateMesh, isElec: isElec(mesh) }));

    // Flat pump caps render UNLIT (MeshBasic) so they show their exact tune colour. BUT the RAT
    // MAN ON button is a RAISED round pushbutton — an unlit material flattens it (no shading on the
    // cylinder), so render the RAT parts LIT (matte-plastic black) so the 3D geometry reads.
    plates.forEach((mesh) => {
      if (isRat(mesh)) { const lit = new THREE.MeshStandardMaterial({ color: 0x15171e, roughness: 0.5, metalness: 0.15 }); lit.name = "rat_btn"; mesh.material = lit; return; }
      const flat = new THREE.MeshBasicMaterial({ color: 0x05070a, toneMapped: false }); flat.name = "plate"; mesh.material = flat;
    });

    // Movement groups: pump caps follow the global PRESS; RAT + ELEC buttons follow their own
    // offsets (with their legends). Pump borders + guard covers stay put.
    const movable: { mesh: THREE.Mesh; baseY: number }[] = [];
    const ratParts: { mesh: THREE.Mesh; baseY: number }[] = [];
    const elecParts: { mesh: THREE.Mesh; baseY: number }[] = [];
    plates.forEach((mesh) => {
      if (isRat(mesh)) ratParts.push({ mesh, baseY: mesh.position.y });
      else if (isElec(mesh)) elecParts.push({ mesh, baseY: mesh.position.y });
      else if (!borderSet.has(mesh)) movable.push({ mesh, baseY: mesh.position.y });
    });
    emissiveMeshes.forEach((mesh) => {
      if (isRat(mesh)) ratParts.push({ mesh, baseY: mesh.position.y });
      else if (isElec(mesh)) elecParts.push({ mesh, baseY: mesh.position.y });
      else movable.push({ mesh, baseY: mesh.position.y });
    });

    // Cluster legend cells by world-X into columns, sort L→R, assign to pumps in HYD_PUMP_ORDER.
    // Each pump has TWO cells: FAULT (top, nodes named "FAULT*") + OFF (bottom, "Text"/"Plane").
    // Split per column by the FAULT name-prefix (added in Blender; underscore-free so it survives
    // GLTF sanitization) so the two cells can light independently — amber FAULT vs white OFF.
    type LE = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; x: number };
    const legWithX: LE[] = legendEntries
      .map((e) => ({ mesh: e.mesh, mat: e.mat, x: e.mesh.getWorldPosition(new THREE.Vector3()).x }))
      .sort((a, b) => a.x - b.x);
    const legCols: LE[][] = []; let lc: LE[] = []; let lx = Infinity;
    legWithX.forEach((e) => { if (lc.length && Math.abs(e.x - lx) > 0.4) { legCols.push(lc); lc = []; } if (!lc.length) lx = e.x; lc.push(e); });
    if (lc.length) legCols.push(lc);
    const pumpLegends = {} as Record<HydPumpKey, { fault: THREE.MeshBasicMaterial[]; off: THREE.MeshBasicMaterial[] }>;
    legCols.forEach((col, i) => {
      const key = HYD_PUMP_ORDER[i]; if (!key) return;
      pumpLegends[key] = {
        fault: col.filter((e) => e.mesh.name.startsWith("FAULT")).map((e) => e.mat),
        off: col.filter((e) => !e.mesh.name.startsWith("FAULT")).map((e) => e.mat),
      };
    });

    // RAT MAN ON guard — flip-open hinge (like EVAC). The red cover is the "orange housijng"
    // mesh; it hinges at its TOP edge (vertical axis = glTF Z, up = min z; normal = glTF Y).
    // Build a pivot at that edge and attach the cover so a rotation about X lifts it open.
    let guardPivot: THREE.Group | null = null;
    const oranges: THREE.Mesh[] = [];
    clone.traverse((o) => { if (o instanceof THREE.Mesh && matNames(o).has("orange housijng")) oranges.push(o); });
    const guardMesh: THREE.Mesh | null = oranges[0] ?? null;
    let guardBaseHinge: THREE.Vector3 | null = null, guardBaseLocal: THREE.Vector3 | null = null;
    if (guardMesh) {
      clone.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(guardMesh);
      const c = box.getCenter(new THREE.Vector3());
      const hinge = new THREE.Vector3(c.x, box.min.y, box.min.z); // top-rear edge of the cover
      guardPivot = new THREE.Group(); guardPivot.name = "rat_guard_pivot"; clone.add(guardPivot);
      guardPivot.position.copy(clone.worldToLocal(hinge.clone()));
      guardPivot.attach(guardMesh);
      guardBaseHinge = guardPivot.position.clone();
      guardBaseLocal = (guardMesh as THREE.Mesh).position.clone();
    }

    // BLUE ELEC PUMP guard — same flip-open, but hinged on its "Material" ROD (like EVAC), so the
    // cover swings about the rod line through the cover's x. Falls back to the cover's top edge.
    let elecPivot: THREE.Group | null = null;
    let elecBaseHinge: THREE.Vector3 | null = null, elecBaseLocal: THREE.Vector3 | null = null;
    if (elecCover) {
      clone.updateWorldMatrix(true, true);
      const cwp = wp(elecCover);
      let hinge: THREE.Vector3;
      if (elecRod) { const rwp = wp(elecRod); hinge = new THREE.Vector3(cwp.x, rwp.y, rwp.z); }
      else { const box = new THREE.Box3().setFromObject(elecCover); const c = box.getCenter(new THREE.Vector3()); hinge = new THREE.Vector3(c.x, box.min.y, box.min.z); }
      elecPivot = new THREE.Group(); elecPivot.name = "elec_guard_pivot"; clone.add(elecPivot);
      elecPivot.position.copy(clone.worldToLocal(hinge.clone()));
      elecPivot.attach(elecCover);
      elecBaseHinge = elecPivot.position.clone();
      elecBaseLocal = elecCover.position.clone();
    }

    return { root: clone, pumpLegends, panelMats, btnClass, movable, ratParts, elecParts, guardPivot, guardMesh, guardBaseHinge, guardBaseLocal, elecPivot, elecCover, elecBaseHinge, elecBaseLocal };
  }, [scene, faceTex, faceMask, faceColored, faceMarks]);

  // Colour the plates: RAT button (ratBtn.color) / ELEC button (elecBtn.color) / bezel border
  // (borderColor) / pump cap (capColor).
  useEffect(() => {
    btnClass.forEach(({ mesh, isBorder, isRat: rat, isRatPlate: ratPlate, isElec: elec }) => {
      const mm = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const sm = mm as THREE.MeshStandardMaterial;
      if (sm && sm.color) {
        sm.color.set(
          ratPlate ? (ratBtn.plateColor ?? ratBtn.color) // RAT recessed flat plate
          : rat ? ratBtn.color                            // RAT raised round button
          : elec ? elecBtn.color
          : isBorder ? tune.borderColor : tune.capColor,
        );
        sm.needsUpdate = true;
      }
    });
  }, [btnClass, tune.capColor, tune.borderColor, ratBtn.color, ratBtn.plateColor, elecBtn.color]);
  // ── HYD pump legend lights — FCOM DSC-29-20 "Controls and Indicators" ──────────────────
  // OFF legend lights WHITE when the pump is selected OFF (inverted Airbus convention,
  // cockpit-control-mapping). FAULT legend lights AMBER when a fault condition exists and
  // "goes out when the crew selects OFF, except during an overheat" — faultLit = fault &&
  // (!off || overheat). FAULT cells were added in Blender (FAULT* nodes) above each OFF cell.
  useEffect(() => {
    HYD_PUMP_ORDER.forEach((key) => {
      const cell = pumpLegends[key];
      if (!cell) return;
      const st = pumps[key];
      // Bottom legend: "OFF" white when selected OFF, except YELLOW ELEC PUMP whose bottom legend
      // is "ON" white when the springloaded pump is running. "OFF selected" (which clears FAULT,
      // unless overheat) is the inverse for the yellow pump (not running = off-selected).
      const isYellow = key === "yellowElec";
      const bottomLit = isYellow ? !!st?.on : !!st?.off;
      const offSelected = isYellow ? !st?.on : !!st?.off;
      const faultLit = !!st?.fault && (!offSelected || !!st?.overheat);
      cell.off.forEach((m) => { m.color.set(bottomLit ? LEGEND_WHITE : LEGEND_DIM); m.needsUpdate = true; });
      cell.fault.forEach((m) => { m.color.set(faultLit ? LEGEND_AMBER : LEGEND_DIM); m.needsUpdate = true; });
    });
  }, [pumpLegends, pumps]);
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
    // RAT + ELEC guarded pushbuttons move independently (their own IN/OUT offset).
    ratParts.forEach(({ mesh, baseY }) => { mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, baseY + ratBtn.inOut, 0.2); });
    elecParts.forEach(({ mesh, baseY }) => { mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, baseY + elecBtn.inOut, 0.2); });
  });

  // RAT MAN ON guard flip. Live hinge tuning: nudging the pivot is compensated on the cover so it
  // stays put at angle 0 — only the rotation centre moves. Rotation lerps for a real flip feel.
  useFrame(() => {
    if (!guardPivot || !guardBaseHinge || !guardMesh || !guardBaseLocal) return;
    guardPivot.position.y = guardBaseHinge.y + ratGuard.hingeYOff;
    guardPivot.position.z = guardBaseHinge.z + ratGuard.hingeZOff;
    guardMesh.position.y = guardBaseLocal.y - ratGuard.hingeYOff;
    guardMesh.position.z = guardBaseLocal.z - ratGuard.hingeZOff;
    const target = ratGuard.open ? THREE.MathUtils.degToRad(ratGuard.angleDeg) : 0;
    guardPivot.rotation.x = THREE.MathUtils.lerp(guardPivot.rotation.x, target, 0.15);
  });

  // BLUE ELEC PUMP guard flip — same model, hinged on its rod.
  useFrame(() => {
    if (!elecPivot || !elecBaseHinge || !elecCover || !elecBaseLocal) return;
    elecPivot.position.y = elecBaseHinge.y + elecGuard.hingeYOff;
    elecPivot.position.z = elecBaseHinge.z + elecGuard.hingeZOff;
    elecCover.position.y = elecBaseLocal.y - elecGuard.hingeYOff;
    elecCover.position.z = elecBaseLocal.z - elecGuard.hingeZOff;
    const target = elecGuard.open ? THREE.MathUtils.degToRad(elecGuard.angleDeg) : 0;
    elecPivot.rotation.x = THREE.MathUtils.lerp(elecPivot.rotation.x, target, 0.15);
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

export function HydPanel3D({ pumps, tune, pos, ratGuard, elecGuard, ratBtn, elecBtn, controlled }: { pumps?: HydPumpState; tune?: HydTune; pos?: HydPos; ratGuard?: HydGuard; elecGuard?: HydGuard; ratBtn?: HydBtn; elecBtn?: HydBtn; controlled?: boolean }) {
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
        <HydScene pumps={pumps ?? {}} tune={tune ?? HYD_TUNE_DEFAULT} pos={pos ?? "neutral"} ratGuard={ratGuard ?? HYD_RAT_GUARD_DEFAULT} elecGuard={elecGuard ?? HYD_ELEC_GUARD_DEFAULT} ratBtn={ratBtn ?? HYD_RAT_BTN_DEFAULT} elecBtn={elecBtn ?? HYD_ELEC_BTN_DEFAULT} />
      </Suspense>
      {!controlled && <OrbitControls makeDefault enableDamping dampingFactor={0.08} />}
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
