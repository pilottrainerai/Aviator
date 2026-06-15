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
import { useGLTF, useTexture, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/eng_start_panel.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
const FACE_TEX_URL = "/models/eng_start_face.png";

export interface EngTune {
  panel: { roughness: number; metalness: number; clearcoat: number; env: number };
  knob: { color: string; roughness: number; metalness: number; env: number };
  buttonBlack: number; // 0 = base grey, 100 = black
  center: { color: string; roughness: number; metalness: number };
  decalColor: string;
}
export const ENG_TUNE_DEFAULT: EngTune = {
  panel: { roughness: 0.6, metalness: 1.5, clearcoat: 0.4, env: 1.0 },
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

function EngStartScene({ tune }: { tune: EngTune }) {
  const { scene } = useGLTF(MODEL_URL);
  const faceTex = useTexture(FACE_TEX_URL);
  faceTex.flipY = false;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;

  const { root, groups } = useMemo(() => {
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
          const base = new THREE.MeshPhysicalMaterial({ color: "#7e9fc6", clearcoatRoughness: 0.22 });
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
    return { root: clone, groups: g };
  }, [scene, faceTex]);

  // apply the tune to each part group (live)
  useEffect(() => {
    groups.panel.forEach((m) => { m.roughness = tune.panel.roughness; m.metalness = tune.panel.metalness; m.clearcoat = tune.panel.clearcoat; m.envMapIntensity = tune.panel.env; m.needsUpdate = true; });
    groups.knob.forEach((m) => { if (m.color) m.color.set(tune.knob.color); m.roughness = tune.knob.roughness; m.metalness = tune.knob.metalness; m.envMapIntensity = tune.knob.env; m.needsUpdate = true; });
    const bhex = blackHex(tune.buttonBlack);
    groups.button.forEach((m) => { if (m.color) m.color.set(bhex); m.roughness = 1.0; m.metalness = 0.0; m.envMapIntensity = 0.25; m.needsUpdate = true; });
    groups.center.forEach((m) => { if (m.color) m.color.set(tune.center.color); m.roughness = tune.center.roughness; m.metalness = tune.center.metalness; m.needsUpdate = true; });
    groups.decal.forEach((m) => { if (m.color) m.color.set(tune.decalColor); m.needsUpdate = true; });
  }, [groups, tune]);

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

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <primitive object={root} />
    </group>
  );
}

export function EngStartPanel3D({ tune }: { tune?: EngTune }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: "100%", height: "100%", background: "#070a0e" }} />;
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 28, near: 0.01, far: 100, position: [0, 0, 4] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      style={{ width: "100%", height: "100%", background: "#05070a" }}
    >
      <ambientLight intensity={0.18} color="#9fb0c4" />
      <directionalLight position={[2.6, 3.2, 4.5]} intensity={2.8} color="#ffffff" />
      <directionalLight position={[-2.4, 1.0, 3.0]} intensity={1.1} color="#cfe0ff" />
      <Suspense fallback={null}>
        <Environment files={HDRI_URL} environmentIntensity={1.5} />
        <EngStartScene tune={tune ?? ENG_TUNE_DEFAULT} />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
