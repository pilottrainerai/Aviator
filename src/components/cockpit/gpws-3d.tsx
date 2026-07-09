"use client";

// ─────────────────────────────────────────────────────────────────────────────
// GpwsPanel3D — web render of blender/gpws/gpws_work.blend (A320 GPWS panel:
// TERR · SYS · GPWS G/S MODE · FLAP MODE · LDG FLAP 3 pushbuttons).
//
// Converted per blender/PROCEDURE_blender_to_web.md (baked GPWS-DECALS face, HDRI
// env, geometry-aligned sheen) reusing the HYD-panel FINAL treatment (the one live
// in the DUAL HYD G+Y scenario). Tune knobs mirror HYD's so it dials the same way.
//
// Material names (01_inspect.py): face = "hydraulic decals" (baked); body = "Blue
// base"; caps = "black button"; button frames/bezels = "Material.001"; legends =
// "emissive". RENDER-FIRST: interactive press / legend-light logic is a later FCOM pass.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { cockpitDpr } from "@/components/cockpit/cockpit-dpr";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/gpws_panel.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
const FACE_TEX_URL = "/models/gpws_face.png"; // baked decal sheet (TERR / SYS / G/S MODE / FLAP MODE / LDG FLAP 3)

const PANEL_BLUE = "#4a8296"; // MASTER REFERENCE = base_hyd_no1 (HYD panel)

// ── GPWS button LIGHT LOGIC (FCOM DSC-34-SURV-40-40 Controls & Indicators) ──
// Buttons left→right on the panel; the 5 emissive legend cells are clustered by world-X
// and assigned in this order. Each has an OFF legend (white) EXCEPT LDG FLAP 3 = ON (blue).
// SYS + TERR additionally have an amber FAULT light. "Light-out" philosophy → dim when normal.
// dim = printed-but-unlit legend, matches HYD's LEGEND_DIM so OFF/box read at full opacity when not lit
const LEG_DIM = "#8b95a3", LEG_WHITE = "#f3f6fa", LEG_AMBER = "#ff9f00", LEG_BLUE = "#3aa0ff";
export const GPWS_BTN_ORDER = ["terr", "sys", "gsMode", "flapMode", "ldgFlap3"] as const;
export type GpwsBtnKey = typeof GPWS_BTN_ORDER[number];
export const GPWS_BTN_LABELS: Record<GpwsBtnKey, string> = { terr: "TERR", sys: "SYS", gsMode: "G/S MODE", flapMode: "FLAP MODE", ldgFlap3: "LDG FLAP 3" };
// the legend text that lights, and its colour (FCOM): OFF=white, LDG FLAP 3 ON=blue
const GPWS_ON_LABEL: Record<GpwsBtnKey, string> = { terr: "OFF", sys: "OFF", gsMode: "OFF", flapMode: "OFF", ldgFlap3: "ON" };
// All pushbutton OFF/ON legends illuminate WHITE (FCOM DSC-34-SURV-40-40: only FAULT is amber;
// LDG FLAP 3 "ON" is white, not blue — user SME confirmed 2026-07-06). Blue kept for reference only.
const GPWS_ON_COLOR: Record<GpwsBtnKey, string> = { terr: LEG_WHITE, sys: LEG_WHITE, gsMode: LEG_WHITE, flapMode: LEG_WHITE, ldgFlap3: LEG_WHITE };
export const GPWS_HAS_FAULT: Partial<Record<GpwsBtnKey, boolean>> = { terr: true, sys: true }; // amber FAULT
export type GpwsLights = Partial<Record<GpwsBtnKey, { on?: boolean; fault?: boolean }>>;
export { GPWS_ON_LABEL };

// Flat tune, mirrors HydTune so the edit panel is the same. Frame = the button
// bezels ("Material.001"); default matches the HYD button BORDER (dark, not silver).
export interface GpwsTune {
  capColor: string;     // button CAP (black button) — UNLIT canvas black
  frameColor: string;   // button FRAME (inner bezel, "Material.001" @ 0.329) — metallic base tint (darker = blacker edges)
  housingColor: string; // button HOUSING (outer surround, "Material.001" @ 0.351) — metallic base tint
  // shared metallic knobs for BOTH frame + housing — these drive the crisp bevel-edge "effect":
  frameMetal: number;   // metalness (1 = full mirror)
  frameRough: number;   // roughness — LOWER = crisper/sharper edges, higher = softer
  frameEnv: number;     // reflections (envMapIntensity) — edge-glint brightness + how much warm HDRI shows
  panelColor: string;   // Blue base + face field tint
  panelRough: number;
  panelMetal: number;
  panelClear: number;
  panelEnv: number;
  sheenT: number; sheenB: number; sheenL: number; sheenR: number; // faked metallic sheen per edge
  legendColor: string; // emissive legends (OFF/dark until FCOM-driven)
  // ABSOLUTE cap offsets along the press axis (added to each cap's baseline) — copied from HYD.
  neutralY: number;    // default resting position
  inY: number;         // deepest point while pushed IN
  staysY: number;      // settled/actuated position (where it stays after the press)
}
export type GpwsPos = "neutral" | "in" | "stays"; // cap-position preview (like HYD's neutral/in/out)
export const GPWS_TUNE_DEFAULT: GpwsTune = {
  capColor: "#05070a", frameColor: "#14161b", housingColor: "#14161b", frameMetal: 1.0, frameRough: 0.4, frameEnv: 2.0, // GPWS TEST: cap = canvas black; frame + housing = DARK metal → blackish crisp bevel edges [user 2026-07-06]
  panelColor: PANEL_BLUE, panelRough: 0.72, panelMetal: 1.86, panelClear: 0.6, panelEnv: 0.5,
  sheenT: 0.95, sheenB: 0.9, sheenL: 0.95, sheenR: 1.35, // HYD_TUNE_DEFAULT
  legendColor: "#8b95a3", // printed-dim, matches HYD LEGEND_DIM [user 2026-07-06]
  neutralY: 0.008, inY: -0.038, staysY: -0.009, // user-dialled via COPY SETTINGS JSON [user 2026-07-06]
};

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function matNames(o: THREE.Object3D): Set<string> {
  const s = new Set<string>();
  o.traverse((m) => { if (m instanceof THREE.Mesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm && s.add(mm.name)); });
  return s;
}

type Groups = {
  panel: THREE.MeshPhysicalMaterial[]; // Blue base (body / border)
  face: THREE.MeshPhysicalMaterial[];  // hydraulic decals — LIT front plate (metallic, masked)
  frame: THREE.MeshStandardMaterial[];   // Material.001 @ 0.329 (inner bezel) — ORIGINAL metallic [GPWS test]
  housing: THREE.MeshStandardMaterial[]; // Material.001 @ 0.351 (outer surround) — ORIGINAL metallic [GPWS test]
  cap: THREE.MeshBasicMaterial[];        // black button (caps) — UNLIT canvas black (like HYD, no glare)
  legend: THREE.MeshBasicMaterial[];   // emissive legends — UNLIT (off/dark until FCOM-driven)
};

function GpwsScene({ tune, pos, lights, onPush, disabled }: { tune: GpwsTune; pos: GpwsPos; lights: GpwsLights; onPush?: (key: GpwsBtnKey) => void; disabled?: boolean }) {
  const { scene } = useGLTF(MODEL_URL);
  const faceTex = useTexture(FACE_TEX_URL);
  faceTex.flipY = false;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 16;

  // ── Front-face FINISH MASK (skill §10c): blue-dominant texel = PANEL (finish on),
  // else = TEXT (finish off) → metalnessMap + clearcoatMap so the finish lands only on
  // the blue field, never turning the white lettering into a tinted mirror.
  const faceMask = useMemo(() => {
    const img = faceTex.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap) | undefined;
    const w = (img as { width?: number })?.width ?? 0, h = (img as { height?: number })?.height ?? 0;
    if (!img || !w || !h) return null;
    try {
      const cnv = document.createElement("canvas"); cnv.width = w; cnv.height = h;
      const ctx = cnv.getContext("2d"); if (!ctx) return null;
      ctx.drawImage(img as CanvasImageSource, 0, 0);
      const data = ctx.getImageData(0, 0, w, h); const d = data.data;
      for (let p = 0; p < d.length; p += 4) {
        const v = (d[p + 2] - d[p] > 12 && d[p + 2] > 60) ? 255 : 0; // blue-dominant = panel
        d[p] = v; d[p + 1] = 255; d[p + 2] = v; d[p + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(cnv); tex.flipY = false; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
      return tex;
    } catch { return null; }
  }, [faceTex]);

  // ── Front-face ALBEDO recolour: repaint the baked (darker) blue field to the base
  // panel colour so the plate reads the SAME steel-blue as the body; text stays white.
  const faceAlbedo = useMemo(() => {
    const img = faceTex.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap) | undefined;
    const w = (img as { width?: number })?.width ?? 0, h = (img as { height?: number })?.height ?? 0;
    if (!img || !w || !h) return null;
    try {
      const [pr, pg, pb] = hexRgb(tune.panelColor ?? PANEL_BLUE);
      const cnv = document.createElement("canvas"); cnv.width = w; cnv.height = h;
      const ctx = cnv.getContext("2d"); if (!ctx) return null;
      ctx.drawImage(img as CanvasImageSource, 0, 0);
      const data = ctx.getImageData(0, 0, w, h); const d = data.data;
      for (let p = 0; p < d.length; p += 4) {
        if (d[p + 2] - d[p] > 12 && d[p + 2] > 60) { d[p] = pr; d[p + 1] = pg; d[p + 2] = pb; }
      }
      ctx.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(cnv); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.needsUpdate = true;
      return tex;
    } catch { return null; }
  }, [faceTex, tune.panelColor]);

  // Geometry-aligned SHEEN (world-position gradient within the panel bbox → real L/R/T/B edges).
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

  const { root, groups, movable, worldNormal, legendsByKey, btnColX } = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true); // so per-mesh Box3 sizes are valid for the frame/housing split
    const g: Groups = { panel: [], face: [], frame: [], housing: [], cap: [], legend: [] };
    const legendEntries: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = []; // for per-button X-clustering
    // Caps + their legends travel along the press axis; the frames (Material.001) stay fixed.
    const movableMeshes: THREE.Mesh[] = [];
    const _sz = new THREE.Vector3();
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      // Material.001 covers BOTH the inner frame (0.329) and the outer housing (0.351); split by footprint.
      const isHousing = (new THREE.Box3().setFromObject(obj).getSize(_sz), Math.max(_sz.x, _sz.y, _sz.z) > 0.34);
      const remap = (m: THREE.Material): THREE.Material => {
        if (!m) return m;
        if (m.name === "hydraulic decals") {
          const face = new THREE.MeshPhysicalMaterial({
            map: faceTex, side: THREE.DoubleSide,
            roughness: 0.72, metalness: 1.86, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.5, // HYD master
            metalnessMap: faceMask ?? undefined, clearcoatMap: faceMask ?? undefined,
          });
          face.name = "hydraulic decals"; applySheen(face); g.face.push(face); return face;
        }
        if (m.name === "Blue base") {
          const base = new THREE.MeshPhysicalMaterial({ color: PANEL_BLUE, metalness: 1.86, roughness: 0.72, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.5 });
          base.name = m.name; applySheen(base); g.panel.push(base); return base;
        }
        if (m.name === "Material.001") {          // button FRAME (0.329) / HOUSING (0.351) — ORIGINAL metallic Material.001, split by size [GPWS test]
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = "Material.001"; (isHousing ? g.housing : g.frame).push(c); return c;
        }
        if (m.name === "black button") {           // caps — UNLIT flat "canvas black" (HYD treatment,
          const c = new THREE.MeshBasicMaterial({ color: "#05070a", toneMapped: false }); // immune to scene lighting → no glare
          c.name = m.name; g.cap.push(c); return c;
        }
        if (m.name === "emissive") {                // TERR/SYS/… OFF/ON legends + FONT labels — driven by the GPWS light state
          // depthTest false + high renderOrder → the lit legend always draws ON TOP of the cap (HYD does the same); otherwise the opaque cap occludes it.
          const leg = new THREE.MeshBasicMaterial({ color: LEG_DIM, toneMapped: false, transparent: true, depthTest: false, depthWrite: false });
          leg.name = "legend"; g.legend.push(leg); legendEntries.push({ mesh: obj, mat: leg }); return leg;
        }
        return m.clone();
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(remap) : remap(obj.material);
      const names = matNames(obj);
      if (names.has("hydraulic decals")) obj.renderOrder = 20;
      if (names.has("emissive")) obj.renderOrder = 31;
      // press-movable = the black-button caps + the emissive legends that sit on them.
      if (names.has("black button") || names.has("emissive")) movableMeshes.push(obj);
    });

    clone.rotation.x = Math.PI / 2; // Blender Z-up → screen frame (matches the other panels)
    clone.updateMatrixWorld(true);
    clone.updateWorldMatrix(true, true);
    const pbox = new THREE.Box3().setFromObject(clone);
    sheenU.uBMin.value.copy(pbox.min); sheenU.uBMax.value.copy(pbox.max);
    // Press axis = the panel-normal = the THINNEST WORLD axis (robust regardless of each cap's
    // local frame — they nest under the Empty, so local Z was mapping to screen-vertical). We move
    // the caps in WORLD space along this normal so they travel IN/OUT of the face, not up/down.
    const sz = pbox.getSize(new THREE.Vector3());
    const worldNormal = (sz.x <= sz.y && sz.x <= sz.z) ? new THREE.Vector3(1, 0, 0)
      : (sz.y <= sz.z) ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const movable = movableMeshes.map((mesh) => ({ mesh, baseWorld: mesh.getWorldPosition(new THREE.Vector3()) }));
    // Cluster the emissive legend cells by world-X into the 5 button columns (L→R = GPWS_BTN_ORDER),
    // exactly as HYD clusters its pump legends. Each column's materials get driven by that button's light.
    // Each cell splits into FAULT (name "FAULT…", TERR/SYS only) vs OFF/ON (the OFF text + box, or
    // the ON legend) — so FAULT lights amber independently of the OFF/ON legend, exactly like HYD.
    type LM = { mat: THREE.MeshBasicMaterial; x: number; fault: boolean };
    const legWithX: LM[] = legendEntries.map((e) => ({ mat: e.mat, x: e.mesh.getWorldPosition(new THREE.Vector3()).x, fault: e.mesh.name.startsWith("FAULT") })).sort((a, b) => a.x - b.x);
    const cols: LM[][] = []; let cur: LM[] = []; let lx = Infinity;
    legWithX.forEach((e) => { if (cur.length && Math.abs(e.x - lx) > 0.3) { cols.push(cur); cur = []; } if (!cur.length) lx = e.x; cur.push(e); });
    if (cur.length) cols.push(cur);
    const legendsByKey = {} as Record<GpwsBtnKey, { fault: THREE.MeshBasicMaterial[]; off: THREE.MeshBasicMaterial[] }>;
    const btnColX = {} as Partial<Record<GpwsBtnKey, number>>; // world-X centre of each button column → click resolves to the nearest
    cols.forEach((col, i) => {
      const key = GPWS_BTN_ORDER[i]; if (!key) return;
      legendsByKey[key] = { fault: col.filter((e) => e.fault).map((e) => e.mat), off: col.filter((e) => !e.fault).map((e) => e.mat) };
      btnColX[key] = col.reduce((s, e) => s + e.x, 0) / col.length;
    });
    return { root: clone, groups: g, movable, worldNormal, legendsByKey, btnColX };
  }, [scene, faceTex, faceMask]);

  // sheen uniforms follow the sliders live
  useEffect(() => {
    sheenU.uSL.value = tune.sheenL; sheenU.uSR.value = tune.sheenR;
    sheenU.uST.value = tune.sheenT; sheenU.uSB.value = tune.sheenB;
  }, [tune.sheenL, tune.sheenR, tune.sheenT, tune.sheenB, sheenU]);

  // apply the tune to each part group (live)
  useEffect(() => {
    groups.panel.forEach((m) => { if (m.color) m.color.set(tune.panelColor ?? PANEL_BLUE); m.roughness = tune.panelRough; m.metalness = tune.panelMetal; m.clearcoat = tune.panelClear; m.envMapIntensity = tune.panelEnv; m.needsUpdate = true; });
    groups.face.forEach((m) => { if (m.color) m.color.set("#ffffff"); m.map = faceAlbedo ?? faceTex; m.roughness = tune.panelRough; m.metalness = tune.panelMetal; m.clearcoat = tune.panelClear; m.envMapIntensity = tune.panelEnv; m.needsUpdate = true; });
    groups.frame.forEach((m) => { if (m.color) m.color.set(tune.frameColor); m.metalness = tune.frameMetal; m.roughness = tune.frameRough; m.envMapIntensity = tune.frameEnv; m.needsUpdate = true; });
    groups.housing.forEach((m) => { if (m.color) m.color.set(tune.housingColor); m.metalness = tune.frameMetal; m.roughness = tune.frameRough; m.envMapIntensity = tune.frameEnv; m.needsUpdate = true; });
    groups.cap.forEach((m) => { if (m.color) m.color.set(tune.capColor); m.needsUpdate = true; }); // UNLIT canvas black — no lighting/env, so no glare
  }, [groups, tune, faceAlbedo, faceTex]);

  // ── GPWS legend LIGHTS (FCOM DSC-34-SURV-40-40) — each button's OFF/ON legend, + amber FAULT
  // on SYS & TERR. "Light-out" when normal (dim = tune.legendColor). Mirrors HYD's pump-legend drive.
  useEffect(() => {
    GPWS_BTN_ORDER.forEach((key) => {
      const st = lights[key] ?? {};
      const cell = legendsByKey[key]; if (!cell) return;
      const faultLit = !!st.fault && !!GPWS_HAS_FAULT[key];
      const onLit = !!st.on; // the OFF (white) / ON (blue for LDG FLAP 3) legend
      // FAULT amber independent of OFF/ON. Unlit = printed-dim (tune.legendColor). Full opacity (HYD-style).
      cell.fault.forEach((m) => { m.color.set(faultLit ? LEG_AMBER : tune.legendColor); m.opacity = 1; m.needsUpdate = true; });
      cell.off.forEach((m) => { m.color.set(onLit ? GPWS_ON_COLOR[key] : tune.legendColor); m.opacity = 1; m.needsUpdate = true; });
    });
  }, [lights, legendsByKey, tune.legendColor]);

  // bind env map so envMapIntensity is honoured on all lit groups
  const bound = useRef(false);
  useEffect(() => { bound.current = false; }, [groups]);
  useFrame(({ scene: fs }) => {
    if (!bound.current && fs.environment) {
      groups.panel.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      groups.face.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      groups.frame.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });   // metallic → needs env
      groups.housing.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; }); // metallic → needs env
      // caps are UNLIT (MeshBasicMaterial) — no envMap binding needed
      bound.current = true;
    }
    // Cap press positions — HYD's model: neutralY / inY / staysY are ABSOLUTE offsets, but applied
    // along the WORLD panel-normal (converted back to each cap's parent-local frame), so the caps
    // travel IN/OUT of the face regardless of how they're nested. Lerped for the press feel.
    const off = pos === "in" ? tune.inY : pos === "stays" ? tune.staysY : tune.neutralY;
    movable.forEach(({ mesh, baseWorld }) => {
      const t = baseWorld.clone().addScaledVector(worldNormal, off);
      mesh.parent?.worldToLocal(t);
      mesh.position.lerp(t, 0.2);
    });
  });

  // camera fit — view along the thinnest axis, fit the two larger extents
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

  // Click → resolve the intersection's world-X to the nearest button column → onPush(key).
  // Display-only when no onPush (dev page unaffected). Mirrors HydPanel3D. [user 2026-07-06]
  const handleClick = onPush
    ? (e: { stopPropagation: () => void; point: THREE.Vector3 }) => {
        e.stopPropagation();
        if (disabled) return;
        let best: GpwsBtnKey | null = null, bd = Infinity;
        for (const k of GPWS_BTN_ORDER) {
          const cx = btnColX[k];
          if (cx == null) continue;
          const d = Math.abs(e.point.x - cx);
          if (d < bd) { bd = d; best = k; }
        }
        if (best && bd < 0.5) onPush(best);
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

export function GpwsPanel3D({ tune, pos = "neutral", lights = {}, onPush, disabled, controlled }: { tune?: GpwsTune; pos?: GpwsPos; lights?: GpwsLights; onPush?: (key: GpwsBtnKey) => void; disabled?: boolean; controlled?: boolean }) {
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
        <GpwsScene tune={tune ?? GPWS_TUNE_DEFAULT} pos={pos} lights={lights} onPush={onPush} disabled={disabled} />
      </Suspense>
      {!controlled && <OrbitControls makeDefault enableDamping dampingFactor={0.08} />}
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
