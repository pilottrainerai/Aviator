"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EngStartPanel3D — web render of blender/eng_start/eng_start_panel.blend (A320
// pedestal ENG panel: ENG MASTER 1/2 + ENG MODE selector CRANK/NORM/IGN START).
//
// Reuses the FIRE-panel FINAL treatment recipe (blender-panels-to-web SKILL §10).
// Parts are tunable PER GROUP via the `tune` prop so the look of each element
// (panel / knobs / buttons / centre / decals) can be dialled in the dev editor.
// RENDER-FIRST: interaction (MASTER switches / MODE rotary) wired in a later pass.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { cockpitDpr } from "@/components/cockpit/cockpit-dpr";

// ── ENG MASTER switch: the whole cylinder assembly (Cylinder/.001/.002 + cube
// faces — the ENG-1/ENG-2 square) tilts forward/back about a horizontal hinge at
// its base: ON = tilted forward (toward viewer), OFF = tilted back. (Per Blender.)
// ON = switch points UP toward the ON label (tilts forward/up); OFF = points DOWN
// toward the OFF label. (Verified against the panel decal labels.)
const MASTER_ON_DEG = -24;
const MASTER_OFF_DEG = 24;
// World-space bands of the two master assemblies (from the geometry dump). The
// masters sit in the UPPER band (world Y≈0.33); the FIRE buttons (Y≈-0.03) are
// below and must be excluded.
const MASTER_BANDS = [
  { xmin: 0.2, xmax: 0.6 }, // MASTER 1 (left) — wide enough to include the "ENG 1" text squibs
  { xmin: 0.8, xmax: 1.15 }, // MASTER 2 (right)
];
const MASTER_Y_MIN = 0.15;
// The ENG master moves as ONE unit: the cylinder BODY + the cube face + the
// "ENG 1/2" TEXT (the SQUIB text planes). Blender Cylinder + Cube + text for ENG 1;
// the .003/.004/.006 mirrors for ENG 2.
const MASTER_MOVE_NAMES = new Set([
  "Cylinder", "Cube_1", "Cube_2", "SQUIB003", "SQUIB005",           // ENG 1: body + face + text
  "Cylinder003", "Cube003_1", "Cube003_2", "SQUIB004", "SQUIB006",  // ENG 2
]);
// It pivots about the FIXED base disc (Blender Cylinder.001 / its mirror .015);
// every other part of the assembly stays put.
const MASTER_PIVOT_NAMES = new Set(["Cylinder001", "Cylinder015"]);
// ENG MODE selector spins in the screen plane: 0=CRANK (left), 1=NORM (up), 2=IGN START (right).
const MODE_DEG = [40, 0, -40];
export const MODE_LABELS = ["CRANK", "NORM", "IGN START"];

// ENG FIRE pushbutton: ONLY the "FIRE" legend TEXT (the SQUIB text plane in the
// LOWER band) glows RED while an engine fire is present — same condition as the
// FIRE panel, same idea as the AGENT/DISCH legends. Left = ENG 1, right = ENG 2.
const FIRE_RED = "#ff2412";

const MODEL_URL = "/models/eng_start_panel.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
// Sharpened decal: the panel labels (MASTER/ON/OFF/MODE/CRANK/IGN-START/ENG/1/2)
// were thin & soft → dilated to bold solid white for legibility. (Original kept.)
const FACE_TEX_URL = "/models/eng_start_face_sharp.png";

export interface EngTune {
  panel: { color: string; roughness: number; metalness: number; clearcoat: number; env: number };
  knob: { color: string; roughness: number; metalness: number; env: number };
  buttonBlack: number; // 0 = base grey, 100 = black
  center: { color: string; roughness: number; metalness: number };
  decalColor: string;
}
const PANEL_BLUE = "#456a93"; // darker base so the white labels read clearly (was #7e9fc6)
export const ENG_TUNE_DEFAULT: EngTune = {
  panel: { color: PANEL_BLUE, roughness: 0.5, metalness: 1.5, clearcoat: 1.0, env: 1.0 }, // match live fire panel finish (glossy)
  knob: { color: "#8b939d", roughness: 0.4, metalness: 1.0, env: 0.9 }, // defined chrome (not flushed white)
  buttonBlack: 100,
  center: { color: "#181d25", roughness: 0.5, metalness: 0.3 },
  decalColor: "#ffffff",
};
const CAP_BASE = [70, 80, 92];
const blackHex = (b: number) =>
  "#" + CAP_BASE.map((v) => Math.round(Math.max(0, Math.min(255, v * (1 - b / 100)))).toString(16).padStart(2, "0")).join("");

function matNames(o: THREE.Object3D): Set<string> {
  const s = new Set<string>();
  o.traverse((m) => { if (m instanceof THREE.Mesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => s.add(mm.name)); });
  return s;
}

type Groups = {
  panel: THREE.MeshPhysicalMaterial[]; // Blue base
  knob: THREE.MeshStandardMaterial[];  // metal
  button: THREE.MeshStandardMaterial[];// black button
  center: THREE.MeshStandardMaterial[];// Material.001/.002
  decal: THREE.MeshBasicMaterial[];    // air con decals
};

function EngStartScene({ tune, masters, mode, fires, panX, panY, zoom, onToggleMaster, onCycleMode }: {
  tune: EngTune; masters: boolean[]; mode: number; fires: boolean[];
  panX: number; panY: number; zoom: number;
  onToggleMaster: (i: number) => void; onCycleMode: () => void;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const faceTex = useTexture(FACE_TEX_URL);
  faceTex.flipY = false;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 16;

  const { root, groups, masterPivots, modePivot, fireMats } = useMemo(() => {
    const clone = scene.clone(true);
    const g: Groups = { panel: [], knob: [], button: [], center: [], decal: [] };
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const remap = (m: THREE.Material): THREE.Material => {
        if (m.name === "air con decals") {
          const dec = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, toneMapped: false, depthWrite: false });
          dec.name = "air con decals"; g.decal.push(dec); return dec;
        }
        if (m.name === "Blue base" || m.name === "Blue base.001") {
          const base = new THREE.MeshPhysicalMaterial({ color: PANEL_BLUE, clearcoatRoughness: 0.22 });
          base.name = m.name; g.panel.push(base); return base;
        }
        if (m.name === "black button" || m.name === "black button.001") {
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = m.name; g.button.push(c); return c;
        }
        if (m.name === "metal") {
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = "metal"; g.knob.push(c); return c;
        }
        if (m.name === "Material.001" || m.name === "Material.002") {
          const c = m.clone() as THREE.MeshStandardMaterial; c.name = m.name; g.center.push(c); return c;
        }
        return m.clone();
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(remap) : remap(obj.material);
      if (matNames(obj).has("air con decals")) obj.renderOrder = 20;
    });

    // Bake the panel's display rotation onto the clone so the world frame used below
    // matches the on-screen frame (X = right, Y = down, Z = toward camera).
    clone.rotation.x = Math.PI / 2;
    clone.updateMatrixWorld(true);

    // ── ENG MASTER assemblies: in each X band (UPPER panel), the cylinder body +
    // cube face / "ENG" text move as one unit, pivoting about the FIXED base disc
    // (Cylinder.001 / .015) — tilting forward (ON) / back (OFF). Every other part
    // of the assembly stays put. One pivot per master (left/right).
    const masterPivots: THREE.Group[] = [];
    MASTER_BANDS.forEach((band) => {
      const moving: THREE.Mesh[] = [];
      let basePos: THREE.Vector3 | null = null;
      const fallback = new THREE.Vector3();
      let minZ = Infinity;
      clone.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const p = o.getWorldPosition(new THREE.Vector3());
        if (p.x < band.xmin || p.x > band.xmax || p.y < MASTER_Y_MIN) return;
        if (MASTER_PIVOT_NAMES.has(o.name)) { basePos = p; return; } // fixed base disc = hinge
        if (!MASTER_MOVE_NAMES.has(o.name)) return;                  // all other parts stay fixed
        moving.push(o); fallback.add(p); if (p.z < minZ) minZ = p.z;
      });
      if (!moving.length) return;
      const pivot = new THREE.Group();
      pivot.name = `master_pivot_${moving.length}`;
      clone.add(pivot);
      // pivot about the fixed base disc (fallback: base centre of the moving unit).
      const hinge = basePos ?? fallback.multiplyScalar(1 / moving.length).setZ(minZ);
      pivot.position.copy(clone.worldToLocal(hinge));
      moving.forEach((m) => pivot.attach(m));
      masterPivots.push(pivot);
    });

    // ── ENG MODE selector: the centre knob (Material.001/.002) spins in the screen
    // plane to CRANK / NORM / IGN-START.
    const modeParts: THREE.Mesh[] = [];
    clone.traverse((o) => { if (o instanceof THREE.Mesh) { const mn = matNames(o); if (mn.has("Material.001") || mn.has("Material.002")) modeParts.push(o); } });
    let modePivot: THREE.Group | null = null;
    if (modeParts.length) {
      const c = new THREE.Vector3();
      modeParts.forEach((m) => c.add(m.getWorldPosition(new THREE.Vector3())));
      c.multiplyScalar(1 / modeParts.length);
      modePivot = new THREE.Group(); modePivot.name = "mode_pivot"; clone.add(modePivot);
      modePivot.position.copy(clone.worldToLocal(c.clone()));
      modeParts.forEach((m) => modePivot!.attach(m));
    }

    // ── ENG FIRE "FIRE" legend text: the SQUIB text planes in the LOWER band, split
    // left (ENG 1) / right (ENG 2). Only this TEXT glows red while a fire is present
    // (original colour stored so it restores cleanly when the fire is out).
    const fireMats: { mat: THREE.MeshStandardMaterial; orig: THREE.Color }[][] = [[], []];
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (!/^SQUIB/i.test(o.name)) return; // FIRE legend text only
      const p = o.getWorldPosition(new THREE.Vector3());
      if (p.y >= MASTER_Y_MIN) return; // masters are upper; FIRE buttons are lower
      const eng = p.x < 0.65 ? 0 : 1;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        const sm = m as THREE.MeshStandardMaterial;
        if (sm) fireMats[eng].push({ mat: sm, orig: sm.color ? sm.color.clone() : new THREE.Color("#ffffff") });
      });
    });
    return { root: clone, groups: g, masterPivots, modePivot, fireMats };
  }, [scene, faceTex]);

  // ENG FIRE illumination: while an engine fire is present, glow the matching FIRE
  // pushbutton cap red (kept lit until the fire clears). Mirrors fire-panel-3d.
  useEffect(() => {
    const red = new THREE.Color(FIRE_RED);
    const off = new THREE.Color(0, 0, 0);
    fireMats.forEach((mats, i) => {
      const lit = !!fires[i];
      mats.forEach(({ mat, orig }) => {
        if (mat.color) mat.color.copy(lit ? red : orig);
        if (mat.emissive) { mat.emissive.copy(lit ? red : off); mat.emissiveIntensity = lit ? 1.8 : 0; }
        mat.needsUpdate = true;
      });
    });
  }, [fireMats, fires]);

  // apply the tune to each part group (live)
  useEffect(() => {
    groups.panel.forEach((m) => { if (m.color) m.color.set(tune.panel.color ?? PANEL_BLUE); m.roughness = tune.panel.roughness; m.metalness = tune.panel.metalness; m.clearcoat = tune.panel.clearcoat; m.envMapIntensity = tune.panel.env; m.needsUpdate = true; });
    groups.knob.forEach((m) => { if (m.color) m.color.set(tune.knob.color); m.roughness = tune.knob.roughness; m.metalness = tune.knob.metalness; m.envMapIntensity = tune.knob.env; m.needsUpdate = true; });
    const bhex = blackHex(tune.buttonBlack);
    groups.button.forEach((m) => { if (m.color) m.color.set(bhex); m.roughness = 1.0; m.metalness = 0.0; m.envMapIntensity = 0.25; m.needsUpdate = true; });
    groups.center.forEach((m) => { if (m.color) m.color.set(tune.center.color); m.roughness = tune.center.roughness; m.metalness = tune.center.metalness; m.needsUpdate = true; });
    groups.decal.forEach((m) => { if (m.color) m.color.set(tune.decalColor); m.needsUpdate = true; });
  }, [groups, tune]);

  // Click a MASTER assembly → toggle it; click the MODE knob → cycle the selector.
  // State is owned by the parent (controlled) so the on-screen buttons drive it too.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.point) return;
    let best = -1, bd = Infinity;
    masterPivots.forEach((pv, i) => { const d = pv.getWorldPosition(new THREE.Vector3()).distanceTo(e.point); if (d < bd) { bd = d; best = i; } });
    const modeD = modePivot ? modePivot.getWorldPosition(new THREE.Vector3()).distanceTo(e.point) : Infinity;
    if (modeD < bd && modeD < 0.3) { onCycleMode(); return; }
    if (best >= 0 && bd < 0.45) onToggleMaster(best);
  };

  // bind env map onto panel + knob materials so their envMapIntensity is honoured
  const bound = useRef(false);
  useEffect(() => { bound.current = false; }, [groups]);
  useFrame(({ scene: fs }) => {
    if (!bound.current && fs.environment) {
      groups.panel.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      groups.knob.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      groups.button.forEach((m) => { m.envMap = fs.environment; m.needsUpdate = true; });
      bound.current = true;
    }
    // Snap each master to its ON / OFF tilt — NO easing. The switch is simply in its
    // state's position (ON = forward/up by default), so there is no glide/motion when
    // the panel pops out; it only changes when the pilot actually moves it.
    masterPivots.forEach((pv, i) => {
      pv.rotation.x = ((masters[i] ? MASTER_ON_DEG : MASTER_OFF_DEG) * Math.PI) / 180;
    });
    // MODE knob: snap to its selected position (no glide either).
    if (modePivot) {
      modePivot.rotation.y = ((MODE_DEG[mode] ?? 0) * Math.PI) / 180;
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
    // zoom DOLLIES the camera (true 3D zoom — stays crisp, unlike a CSS scale);
    // pan offsets the look-at point by a fraction of the panel size.
    const z = Math.max(0.2, zoom || 1);
    const dist = (Math.max(w / 2 / Math.tan(hFov / 2), h / 2 / Math.tan(vFov / 2)) * 1.1) / z + dim[normal];
    const viewDir = new THREE.Vector3(normal === "x" ? 1 : 0, normal === "y" ? 1 : 0, normal === "z" ? 1 : 0);
    const heightAxis = dims[1].a;
    const up = new THREE.Vector3(heightAxis === "x" ? 1 : 0, heightAxis === "y" ? 1 : 0, heightAxis === "z" ? 1 : 0);
    cam.up.copy(up);
    const right = new THREE.Vector3().crossVectors(viewDir, up).normalize();
    const lookAt = center.clone()
      .addScaledVector(right, (panX || 0) * (w / 2))
      .addScaledVector(up, -(panY || 0) * (h / 2));
    cam.position.copy(lookAt).addScaledVector(viewDir, dist);
    cam.near = Math.max(0.01, dist * 0.02); cam.far = dist * 6; cam.updateProjectionMatrix();
    cam.lookAt(lookAt);
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit?.target) { orbit.target.copy(lookAt); orbit.update(); }
  }, [camera, size.width, size.height, controls, root, panX, panY, zoom]);

  // rotation is baked onto `root` in useMemo, so render it directly.
  return <primitive object={root} onClick={handleClick} />;
}

export function EngStartPanel3D({ tune, masters, mode, fires, controlled, panX, panY, zoom, onToggleMaster, onCycleMode }: {
  tune?: EngTune; masters?: boolean[]; mode?: number; fires?: boolean[];
  // controlled: camera is driven by panX/panY/zoom (true 3D zoom — stays crisp) and
  // OrbitControls is disabled. Used in the scenario embed. Dev page leaves it off → free orbit.
  controlled?: boolean; panX?: number; panY?: number; zoom?: number;
  onToggleMaster?: (i: number) => void; onCycleMode?: () => void;
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
        <EngStartScene tune={tune ?? ENG_TUNE_DEFAULT} masters={masters ?? [false, false]} mode={mode ?? 1}
          fires={fires ?? [false, false]} panX={panX ?? 0} panY={panY ?? 0} zoom={zoom ?? 1}
          onToggleMaster={onToggleMaster ?? (() => {})} onCycleMode={onCycleMode ?? (() => {})} />
      </Suspense>
      {!controlled && <OrbitControls makeDefault enableDamping dampingFactor={0.08} />}
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
