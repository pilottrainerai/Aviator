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
// `coverColor` recolours the flip-up guard lid itself (RAT = red housing, ELEC = black cover).
export interface HydGuard {
  open: boolean;
  angleDeg: number;   // OPEN pose — rotation (deg) about the rod when the guard is open
  closedDeg: number;  // CLOSED/seated pose — rotation (deg) when the guard is shut (rest is rarely 0)
  posXOff: number; posYOff: number; posZOff: number;  // move the LID only (rod compensated out)
  pivotYOff: number; pivotZOff: number;               // move the ROD/hinge only (lid compensated out)
  coverColor: string;
}
export type HydRatGuard = HydGuard; // back-compat alias
// coverColor #b1422b ≈ the GLB's linear #720d05 red housing → RAT lid keeps its original look.
// RAT lid placement + angles dialled live (2026-06-21): closedDeg = the seated/closed pose, angleDeg =
// the open pose; pos* move the lid, pivot* move the hinge rod (independently). ELEC stays at 0 (its
// working state). Tune live in the LEFT "GUARD LID EDITOR" panel, then bake the values you settle on.
export const HYD_RAT_GUARD_DEFAULT: HydGuard = { open: false, angleDeg: -59, closedDeg: 37, posXOff: 0, posYOff: 0.008, posZOff: -0.006, pivotYOff: 0.032, pivotZOff: 0.068, coverColor: "#b1422b" };
export const HYD_ELEC_GUARD_DEFAULT: HydGuard = { open: false, angleDeg: -115, closedDeg: 0, posXOff: 0, posYOff: 0, posZOff: 0, pivotYOff: 0, pivotZOff: 0, coverColor: "#171717" };
// A guarded pushbutton under a cover (RAT MAN ON, BLUE ELEC PUMP): cap colour + press offset
// (absolute Y offset added to the cap's imported position; negative = pressed IN).
// `color` = the raised CIRCULAR pushbutton; `plateColor` (RAT only) = the recessed flat
// backing plate around it — the two RAT parts colour independently. `env`/`plateEnv` =
// envMapIntensity (reflectivity) of those LIT RAT parts: lower → the black reads truly black
// instead of picking up the bright HDRI. 1.0 = original look. (ELEC parts render unlit, so
// env has no effect there — exposed for the RAT control only.)
export interface HydBtn { color: string; inOut: number; plateColor?: string; env?: number; plateEnv?: number }
// color/plateColor = pure-black round button + flat plate; env/plateEnv = darkness (user-dialled 2026-06-21).
export const HYD_RAT_BTN_DEFAULT: HydBtn = { color: "#000000", inOut: 0, plateColor: "#0a0000", env: 0.15, plateEnv: 0.32 };
export const HYD_ELEC_BTN_DEFAULT: HydBtn = { color: "#000000", inOut: 0 };
export interface HydTune {
  capColor: string;    // button CAP (front plate) — live fire-panel = #070a0e
  wellColor: string;   // RECESS/well the cap sits into (backing plate behind the cap) — defaults to capColor
  borderColor: string; // SURROUND/border OUTER rim (outer plate, incl. ELEC PUMP frame) — live fire = #222730
  borderInnerColor: string; // border frame INNER rim (the bevel facing the cap) — defaults to borderColor
  borderMetal: number; // border rims metalness (GPWS-style bevel) — default 1.0
  borderRough: number; // border rims roughness (lower = crisper edges) — default 0.4
  borderEnv: number;   // border rims envMapIntensity (reflection brightness) — default 2.0
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
// capColor = canvas backdrop (unlit, DO NOT TOUCH). border frame + RAT switch are pure black
// #000000 (user-dialled 2026-06-21; all plates unlit so the hex shows exactly).
// panel* defaults mirror eng-start's Blue base (rough 0.6 / metal 1.5 / clearcoat 0.4 / env 1.0)
// so HYD starts parameter-identical to it; tune live to match the rendered look.
// LOCKED 2026-07-06 [user] — final HYD look. Border two-tone: OUTER rim pure black #000000 (metal 1.0
// → no reflection = true black), INNER rim #14161b (dark metallic bevel catching the HDRI). Cap+well
// canvas black. Do not retune without a new user pass.
export const HYD_TUNE_DEFAULT: HydTune = { capColor: "#05070a", wellColor: "#05070a", borderColor: "#000000", borderInnerColor: "#14161b", borderMetal: 1.0, borderRough: 0.4, borderEnv: 2.0, ratColor: "#000000", neutralY: 0.008, inY: -0.041, outY: -0.009, panelColor: "#4a8296", panelRough: 0.72, panelMetal: 1.86, panelClear: 0.6, panelEnv: 0.5, sheenT: 0.95, sheenB: 0.9, sheenL: 0.95, sheenR: 1.35 };

function matNames(o: THREE.Object3D): Set<string> {
  const s = new Set<string>();
  o.traverse((m) => { if (m instanceof THREE.Mesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm && s.add(mm.name)); });
  return s;
}

// A bright unlit bar drawn AT the pivot, aligned to the hinge axis (glTF X), so the otherwise
// invisible rotation centre — the "hinge rod" — is visible while it's being placed. Toggled by showPivot.
function makeRodMarker(lengthX: number): THREE.Mesh {
  const g = new THREE.CylinderGeometry(0.018, 0.018, Math.max(0.1, lengthX), 16);
  g.rotateZ(Math.PI / 2); // cylinder's long axis is Y → align it to X (the hinge axis)
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false, depthTest: false }));
  mesh.name = "pivot_rod"; mesh.renderOrder = 999; mesh.visible = false;
  return mesh;
}

function HydScene({ pumps, tune, pos, ratGuard, elecGuard, ratBtn, elecBtn, showPivot, onPush, disabled }: { pumps: HydPumpState; tune: HydTune; pos: HydPos; ratGuard: HydGuard; elecGuard: HydGuard; ratBtn: HydBtn; elecBtn: HydBtn; showPivot: boolean; onPush?: (key: HydPumpKey) => void; disabled?: boolean }) {
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

  const { root, pumpLegends, pumpColX, panelMats, btnClass, movable, ratParts, elecParts, guardPivot, guardMesh, guardBaseHinge, guardBaseLocal, guardRod, elecPivot, elecCover, elecBaseHinge, elecBaseLocal, elecRod } = useMemo(() => {
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
    // ELEC guard lid → UNLIT (MeshBasic) so coverColor maps 1:1 and a black setting reaches the
    // canvas black, instead of catching the directional-light sheen the lit cover always shows.
    if (elecCover) { const u = new THREE.MeshBasicMaterial({ color: 0x15171e, toneMapped: false }); u.name = "elec_cover_unlit"; elecCover.material = u; }
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
    // WELL/recess: each plain pump has 3 stacked plates — border (largest foot) + a proud front CAP
    // (max world-Y) + a backing plate the cap recesses into. That backing plate = the well; give it
    // its own colour so the cap↔recess edge reads. Defaults to capColor, so no visible change until dialled.
    const wellSet = new Set<THREE.Mesh>();
    clusters.forEach((cl) => {
      if (cl.some((b) => isRat(b.mesh) || isElec(b.mesh))) return; // plain pumps only
      const nonBorder = cl.filter((b) => !borderSet.has(b.mesh));
      if (nonBorder.length < 2) return; // single cap plate → no separate well
      const front = nonBorder.reduce((a, b) => (wp(b.mesh).y > wp(a.mesh).y ? b : a));
      nonBorder.forEach((b) => { if (b.mesh !== front.mesh) wellSet.add(b.mesh); });
    });
    // Split the RAT control into its two black parts: the RAISED round button vs the recessed
    // flat backing PLATE. Size is the stable discriminator (skill §10f) — the plate has the
    // largest XZ footprint; everything else in the RAT cluster is the circular button. Only
    // tag a plate when >1 RAT part exists (a lone part is the button).
    const ratFoot = (m: THREE.Mesh) => { const s = new THREE.Vector3(); new THREE.Box3().setFromObject(m).getSize(s); return s.x * s.z; };
    const ratPlates = plates.filter((m) => isRat(m));
    const ratPlateMesh = ratPlates.length > 1 ? ratPlates.reduce((a, b) => (ratFoot(b) > ratFoot(a) ? b : a)) : null;
    // The RAT round nests TWO parts: a larger EXTERIOR ring (static bezel) and a smaller CENTRE
    // round that is the actual momentary pushbutton. Among the round (x≈z) RAT parts minus the
    // plate, sort by footprint: [0] = ring, [1] = centre. Only the centre travels on press (user
    // req); thinner detail pins fall to [2]+ and are ignored.
    const ratRound = (m: THREE.Mesh) => { const s = new THREE.Vector3(); new THREE.Box3().setFromObject(m).getSize(s); return Math.abs(s.x - s.z) < Math.max(s.x, s.z) * 0.3; };
    const ratRoundParts = ratPlates.filter((m) => m !== ratPlateMesh && ratRound(m)).sort((a, b) => ratFoot(b) - ratFoot(a));
    const ratCenterMesh = ratRoundParts[1] ?? ratRoundParts[0] ?? null;
    const btnClass = plates.map((mesh) => ({ mesh, isBorder: borderSet.has(mesh), isWell: wellSet.has(mesh), isRat: isRat(mesh), isRatPlate: mesh === ratPlateMesh, isElec: isElec(mesh) }));

    // Flat pump caps render UNLIT (MeshBasic) so they show their exact tune colour. BUT the RAT
    // MAN ON button is a RAISED round pushbutton — an unlit material flattens it (no shading on the
    // cylinder), so render the RAT parts LIT (matte-plastic black) so the 3D geometry reads.
    plates.forEach((mesh) => {
      if (isRat(mesh)) {
        // RAT parts cache BOTH a lit (3D shading) and an unlit (exact-colour, canvas-black) material.
        // The darkness knob fades the LIT one continuously toward black (albedo + specular + reflection
        // all scale with the slider) and only snaps to the unlit material at the very bottom — so the
        // approach to pure black is seamless instead of jumping. MeshPhysical → specularIntensity knob.
        const lit = new THREE.MeshPhysicalMaterial({ color: 0x15171e, roughness: 0.5, metalness: 0.15 }); lit.name = "rat_btn";
        const unlit = new THREE.MeshBasicMaterial({ color: 0x05070a, toneMapped: false }); unlit.name = "rat_btn_unlit";
        mesh.userData.ratLit = lit; mesh.userData.ratUnlit = unlit; mesh.material = lit; return;
      }
      if (borderSet.has(mesh)) {
        // Border frame two-tone: split the bevel ring into OUTER rim + INNER rim (facing the cap) by
        // radial distance, so each can take its own colour. Geometry is CLONED first (isolated +
        // revertible); default inner = outer, so it's a no-op until dialled. [user 2026-07-06]
        const geo = (mesh.geometry = mesh.geometry.clone());
        const pos = geo.attributes.position;
        geo.computeBoundingBox();
        const bb = geo.boundingBox!; const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        const rOf = (i: number) => Math.hypot(pos.getX(i) - cx, pos.getZ(i) - cz);
        let rmin = Infinity, rmax = -Infinity;
        for (let i = 0; i < pos.count; i++) { const r = rOf(i); if (r < rmin) rmin = r; if (r > rmax) rmax = r; }
        const mid = (rmin + rmax) / 2;
        const idx = geo.index; const triN = idx ? idx.count / 3 : pos.count / 3;
        const vi = (t: number, k: number) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
        const outer: number[] = [], inner: number[] = [];
        for (let t = 0; t < triN; t++) {
          const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
          ((rOf(a) + rOf(b) + rOf(c)) / 3 > mid ? outer : inner).push(a, b, c);
        }
        geo.setIndex([...outer, ...inner]);
        geo.clearGroups(); geo.addGroup(0, outer.length, 0); geo.addGroup(outer.length, inner.length, 1);
        // GPWS-style dark-metallic bevel: MeshStandard so it reflects the tinted HDRI (env bound in
        // the useFrame below). MeshBasic would stay flat/unlit — no metallic effect.
        const mkBorder = (n: string) => { const m = new THREE.MeshStandardMaterial({ color: 0x14161b, metalness: 1.0, roughness: 0.4, envMapIntensity: 2.0 }); m.name = n; return m; };
        mesh.material = [mkBorder("border-outer"), mkBorder("border-inner")];
        return;
      }
      const flat = new THREE.MeshBasicMaterial({ color: 0x05070a, toneMapped: false }); flat.name = "plate"; mesh.material = flat;
    });

    // Movement groups: pump caps follow the global PRESS; RAT + ELEC buttons follow their own
    // offsets (with their legends). Pump borders + guard covers stay put.
    const movable: { mesh: THREE.Mesh; baseY: number }[] = [];
    const ratParts: { mesh: THREE.Mesh; baseY: number }[] = [];
    const elecParts: { mesh: THREE.Mesh; baseY: number }[] = [];
    plates.forEach((mesh) => {
      if (isRat(mesh)) { if (mesh === ratCenterMesh) ratParts.push({ mesh, baseY: mesh.position.y }); } // ONLY the centre round presses; exterior ring + plate stay fixed
      else if (isElec(mesh)) elecParts.push({ mesh, baseY: mesh.position.y });
      else if (!borderSet.has(mesh)) movable.push({ mesh, baseY: mesh.position.y });
    });
    emissiveMeshes.forEach((mesh) => {
      if (isRat(mesh)) { /* RAT has no moving legend — leave any in place */ }
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
    // World-X centre of each pump column — used to resolve a click to its pump key.
    const pumpColX = {} as Partial<Record<HydPumpKey, number>>;
    legCols.forEach((col, i) => {
      const key = HYD_PUMP_ORDER[i]; if (!key) return;
      pumpLegends[key] = {
        fault: col.filter((e) => e.mesh.name.startsWith("FAULT")).map((e) => e.mat),
        off: col.filter((e) => !e.mesh.name.startsWith("FAULT")).map((e) => e.mat),
      };
      pumpColX[key] = col.reduce((s, e) => s + e.x, 0) / col.length;
    });

    // RAT MAN ON guard — flip-open hinge (like EVAC). The red cover is the "orange housijng"
    // mesh; it hinges at its TOP edge (vertical axis = glTF Z, up = min z; normal = glTF Y).
    // Build a pivot at that edge and attach the cover so a rotation about X lifts it open.
    let guardPivot: THREE.Group | null = null;
    let guardRod: THREE.Mesh | null = null;
    const oranges: THREE.Mesh[] = [];
    clone.traverse((o) => { if (o instanceof THREE.Mesh && matNames(o).has("orange housijng")) oranges.push(o); });
    const guardMesh: THREE.Mesh | null = oranges[0] ?? null;
    let guardBaseHinge: THREE.Vector3 | null = null, guardBaseLocal: THREE.Vector3 | null = null;
    if (guardMesh) {
      clone.updateWorldMatrix(true, true);
      // Hinge = the guard lid's TOP edge, dropped onto the flat plate's FRONT surface, so the lid
      // pivots about a line physically on the plate (user req) and flips up like a real cover —
      // not a slide. cover bbox gives the top edge (min z) + x-centre; the plate bbox gives the
      // surface height (max y). Geometry (GLB): cover z -1.48‥-0.98, plate front y ≈ 0.14.
      const cbox = new THREE.Box3().setFromObject(guardMesh);
      const pbox = new THREE.Box3().setFromObject((ratPlateMesh as THREE.Mesh | null) ?? guardMesh);
      const hinge = new THREE.Vector3(cbox.getCenter(new THREE.Vector3()).x, pbox.max.y, cbox.min.z);
      guardPivot = new THREE.Group(); guardPivot.name = "rat_guard_pivot"; clone.add(guardPivot);
      guardPivot.position.copy(clone.worldToLocal(hinge.clone()));
      guardPivot.attach(guardMesh);
      const rl = new THREE.Vector3(); new THREE.Box3().setFromObject(guardMesh).getSize(rl);
      guardRod = makeRodMarker(rl.x * 1.25); guardPivot.add(guardRod); // child at pivot origin = sits on the rod line, rotates with it
      guardBaseHinge = guardPivot.position.clone();
      guardBaseLocal = (guardMesh as THREE.Mesh).position.clone();
    }

    // BLUE ELEC PUMP guard — same flip-open, but hinged on its "Material" ROD (like EVAC), so the
    // cover swings about the rod line through the cover's x. Falls back to the cover's top edge.
    let elecPivot: THREE.Group | null = null;
    let elecRodMarker: THREE.Mesh | null = null;
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
      const erl = new THREE.Vector3(); new THREE.Box3().setFromObject(elecCover).getSize(erl);
      elecRodMarker = makeRodMarker(erl.x * 1.25); elecPivot.add(elecRodMarker);
      elecBaseHinge = elecPivot.position.clone();
      elecBaseLocal = elecCover.position.clone();
    }

    return { root: clone, pumpLegends, pumpColX, panelMats, btnClass, movable, ratParts, elecParts, guardPivot, guardMesh, guardBaseHinge, guardBaseLocal, guardRod, elecPivot, elecCover, elecBaseHinge, elecBaseLocal, elecRod: elecRodMarker };
  }, [scene, faceTex, faceMask, faceColored, faceMarks]);

  // Colour the plates: RAT button (ratBtn.color) / ELEC button (elecBtn.color) / bezel border
  // (borderColor) / pump cap (capColor).
  useEffect(() => {
    btnClass.forEach(({ mesh, isBorder, isWell, isRat: rat, isRatPlate: ratPlate, isElec: elec }) => {
      // RAT round button + flat plate: the darkness knob fades the LIT material CONTINUOUSLY to
      // near-black (albedo × slider kills the lit diffuse floor; specularIntensity × slider kills the
      // dielectric sheen that otherwise stays grey-black; reflection scales too). Only at the very
      // bottom (≤0.001) does it snap to the UNLIT material for the EXACT canvas black of the caps —
      // and because the lit floor is already ~black, that snap is invisible (no 0.20→0 jump).
      if (rat) {
        const e = ratPlate ? (ratBtn.plateEnv ?? 1) : (ratBtn.env ?? 1);
        const col = ratPlate ? (ratBtn.plateColor ?? ratBtn.color) : ratBtn.color;
        const lit = mesh.userData.ratLit as THREE.MeshPhysicalMaterial | undefined;
        const unlit = mesh.userData.ratUnlit as THREE.MeshBasicMaterial | undefined;
        if (e <= 0.001 && unlit) { unlit.color.set(col); unlit.needsUpdate = true; mesh.material = unlit; }
        else if (lit) {
          const t = Math.min(1, e);              // 0 → fully dark, 1 → original lit look
          lit.color.set(col).multiplyScalar(t);  // fade albedo to black (removes the lit diffuse floor)
          lit.specularIntensity = t;             // fade the dielectric sheen that kept it grey-black
          lit.envMapIntensity = e;               // HDRI reflection still scales past 1.0
          lit.roughness = THREE.MathUtils.lerp(1.0, 0.5, t);
          lit.metalness = THREE.MathUtils.lerp(0.0, 0.15, t);
          lit.needsUpdate = true; mesh.material = lit;
        }
        return;
      }
      // Border frame is a 2-material array [outer, inner] (radial split); colour each rim separately.
      if (isBorder && Array.isArray(mesh.material)) {
        const [outer, inner] = mesh.material as THREE.MeshBasicMaterial[];
        if (outer?.color) { outer.color.set(tune.borderColor); outer.needsUpdate = true; }
        if (inner?.color) { inner.color.set(tune.borderInnerColor); inner.needsUpdate = true; }
        return;
      }
      const mm = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const sm = mm as THREE.MeshStandardMaterial;
      if (sm && sm.color) {
        sm.color.set(elec ? elecBtn.color : isBorder ? tune.borderColor : isWell ? tune.wellColor : tune.capColor);
        sm.needsUpdate = true;
      }
    });
  }, [btnClass, tune.capColor, tune.wellColor, tune.borderColor, tune.borderInnerColor, ratBtn.color, ratBtn.plateColor, ratBtn.env, ratBtn.plateEnv, elecBtn.color]);

  // Border rims GPWS-style metallic knobs (live). envMap is bound in the useFrame; these own the look.
  useEffect(() => {
    btnClass.forEach(({ mesh, isBorder }) => {
      if (!isBorder || !Array.isArray(mesh.material)) return;
      (mesh.material as THREE.MeshStandardMaterial[]).forEach((bm) => {
        if (bm && "metalness" in bm) { bm.metalness = tune.borderMetal; bm.roughness = tune.borderRough; bm.envMapIntensity = tune.borderEnv; bm.needsUpdate = true; }
      });
    });
  }, [btnClass, tune.borderMetal, tune.borderRough, tune.borderEnv]);

  // Guard LID colour — recolour the flip-up cover meshes themselves: RAT = red "orange housijng",
  // ELEC = the black cover mesh (which shipped pure-black, so it now gets a real, pickable colour).
  useEffect(() => {
    const setCover = (mesh: THREE.Mesh | null, hex?: string) => {
      if (!mesh || !hex) return;
      const mm = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const sm = mm as THREE.MeshStandardMaterial;
      if (sm?.color) { sm.color.set(hex); sm.needsUpdate = true; }
    };
    setCover(guardMesh, ratGuard.coverColor);
    setCover(elecCover, elecGuard.coverColor);
  }, [guardMesh, elecCover, ratGuard.coverColor, elecGuard.coverColor]);
  // Hinge-rod markers (dev aid): show the otherwise-invisible pivot line so it can be placed.
  useEffect(() => {
    if (guardRod) guardRod.visible = showPivot;
    if (elecRod) elecRod.visible = showPivot;
  }, [showPivot, guardRod, elecRod]);
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

  // RAT MAN ON guard flip. LID (pos*) and ROD (pivot*) move INDEPENDENTLY: the ROD follows only the
  // rod offset; the LID follows only the lid offset, with the rod offset compensated out — so moving
  // the rod leaves the lid where it is, and moving the lid leaves the rod where it is.
  useFrame(() => {
    if (!guardPivot || !guardBaseHinge || !guardMesh || !guardBaseLocal) return;
    guardPivot.position.set(
      guardBaseHinge.x,
      guardBaseHinge.y + ratGuard.pivotYOff,
      guardBaseHinge.z + ratGuard.pivotZOff,
    );
    guardMesh.position.set(
      guardBaseLocal.x + ratGuard.posXOff,
      guardBaseLocal.y + ratGuard.posYOff - ratGuard.pivotYOff,
      guardBaseLocal.z + ratGuard.posZOff - ratGuard.pivotZOff,
    );
    const target = THREE.MathUtils.degToRad(ratGuard.open ? ratGuard.angleDeg : ratGuard.closedDeg);
    guardPivot.rotation.x = THREE.MathUtils.lerp(guardPivot.rotation.x, target, 0.15);
  });

  // BLUE ELEC PUMP guard flip — same pos/pivot model, hinged on its rod.
  useFrame(() => {
    if (!elecPivot || !elecBaseHinge || !elecCover || !elecBaseLocal) return;
    elecPivot.position.set(
      elecBaseHinge.x,
      elecBaseHinge.y + elecGuard.pivotYOff,
      elecBaseHinge.z + elecGuard.pivotZOff,
    );
    elecCover.position.set(
      elecBaseLocal.x + elecGuard.posXOff,
      elecBaseLocal.y + elecGuard.posYOff - elecGuard.pivotYOff,
      elecBaseLocal.z + elecGuard.posZOff - elecGuard.pivotZOff,
    );
    const target = THREE.MathUtils.degToRad(elecGuard.open ? elecGuard.angleDeg : elecGuard.closedDeg);
    elecPivot.rotation.x = THREE.MathUtils.lerp(elecPivot.rotation.x, target, 0.15);
  });

  const bound = useRef(false);
  useEffect(() => { bound.current = false; }, [panelMats]);
  useFrame(({ scene: fs }) => {
    if (!bound.current && fs.environment) {
      panelMats.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      // GPWS-style dark-metallic crisp bevel edges on the pump-button BORDERS/surrounds only.
      // Cap, RAT/ELEC buttons, guards, legends untouched. Effect shows once borderColor is lifted
      // off pure black (metal reflects the tinted HDRI). [user 2026-07-06 — revertible, backed up]
      btnClass.forEach(({ mesh, isBorder }) => {
        if (!isBorder) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; // border = [outer, inner]
        mats.forEach((mm) => {
          const bm = mm as THREE.MeshStandardMaterial;
          if (bm && "metalness" in bm) { bm.envMap = fs.environment; bm.needsUpdate = true; } // metal/rough/env owned by the slider effect
        });
      });
      bound.current = true;
    }
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
    // Tighter fit so the wide HYD panel FILLS the frame (was *1.08 + full depth term → rendered as a
    // small thin strip in the action panel, reading as "blurry"). Small depth margin avoids clipping. [user 2026-07-06]
    const dist = Math.max(w / 2 / Math.tan(hFov / 2), h / 2 / Math.tan(vFov / 2)) * 1.02 + dim[normal] * 0.25;
    const viewDir = new THREE.Vector3(normal === "x" ? 1 : 0, normal === "y" ? 1 : 0, normal === "z" ? 1 : 0);
    const heightAxis = dims[1].a;
    cam.up.set(heightAxis === "x" ? -1 : 0, heightAxis === "y" ? -1 : 0, heightAxis === "z" ? -1 : 0);
    cam.position.copy(center).addScaledVector(viewDir, dist);
    cam.near = Math.max(0.001, dist * 0.02); cam.far = dist * 6; cam.updateProjectionMatrix();
    cam.lookAt(center);
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit?.target) { orbit.target.copy(center); orbit.update(); }
  }, [camera, size.width, size.height, controls, root]);

  // Click → resolve the intersection's world-X to the nearest pump column → onPush(key).
  // Display-only when no onPush (dev page is unaffected).
  const handleClick = onPush
    ? (e: { stopPropagation: () => void; point: THREE.Vector3 }) => {
        e.stopPropagation();
        if (disabled) return;
        let best: HydPumpKey | null = null, bd = Infinity;
        for (const k of HYD_PUMP_ORDER) {
          const cx = pumpColX[k];
          if (cx == null) continue;
          const d = Math.abs(e.point.x - cx);
          if (d < bd) { bd = d; best = k; }
        }
        if (best && bd < 0.6) onPush(best);
      }
    : undefined;
  const setCursor = (c: string) => { if (onPush && !disabled && typeof document !== "undefined") document.body.style.cursor = c; };

  return (
    <primitive
      object={root}
      onClick={handleClick}
      onPointerOver={onPush ? () => setCursor("pointer") : undefined}
      onPointerOut={onPush ? () => setCursor("auto") : undefined}
    />
  );
}

export function HydPanel3D({ pumps, tune, pos, ratGuard, elecGuard, ratBtn, elecBtn, controlled, showPivot, onPush, disabled }: { pumps?: HydPumpState; tune?: HydTune; pos?: HydPos; ratGuard?: HydGuard; elecGuard?: HydGuard; ratBtn?: HydBtn; elecBtn?: HydBtn; controlled?: boolean; showPivot?: boolean; onPush?: (key: HydPumpKey) => void; disabled?: boolean }) {
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
        <HydScene pumps={pumps ?? {}} tune={tune ?? HYD_TUNE_DEFAULT} pos={pos ?? "neutral"} ratGuard={ratGuard ?? HYD_RAT_GUARD_DEFAULT} elecGuard={elecGuard ?? HYD_ELEC_GUARD_DEFAULT} ratBtn={ratBtn ?? HYD_RAT_BTN_DEFAULT} elecBtn={elecBtn ?? HYD_ELEC_BTN_DEFAULT} showPivot={showPivot ?? false} onPush={onPush} disabled={disabled} />
      </Suspense>
      {!controlled && <OrbitControls makeDefault enableDamping dampingFactor={0.08} />}
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
