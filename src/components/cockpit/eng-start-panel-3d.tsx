"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EngStartPanel3D — web render of blender/eng_start/eng_start_panel.blend (A320
// pedestal ENG panel: ENG MASTER 1/2 + ENG MODE selector CRANK/NORM/IGN START).
//
// Reuses the FIRE-panel FINAL treatment recipe (see blender-panels-to-web SKILL §10):
//   • Blue base = metallic blue (reduced glare), env map bound per-material
//   • face "air con decals" = white markings overlay (transparent, unlit, on top)
//   • "black button" = matte near-black; "metal" = chrome knobs
// Parts selected by MATERIAL NAME (GLTFLoader mangles node names).
// RENDER-FIRST: interaction (MASTER switches / MODE rotary) wired in a later pass.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/eng_start_panel.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
const FACE_TEX_URL = "/models/eng_start_face.png";

function matNames(o: THREE.Object3D): Set<string> {
  const s = new Set<string>();
  o.traverse((m) => { if (m instanceof THREE.Mesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => s.add(mm.name)); });
  return s;
}

function EngStartScene() {
  const { scene } = useGLTF(MODEL_URL);
  const faceTex = useTexture(FACE_TEX_URL);
  faceTex.flipY = false;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;

  const root = useMemo(() => {
    const clone = scene.clone(true);
    const panelMats: THREE.MeshStandardMaterial[] = [];
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const remap = (m: THREE.Material): THREE.Material => {
        // FACE decals — white markings on transparent, unlit, drawn on top of the blue.
        if (m.name === "air con decals") {
          const dec = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, toneMapped: false, depthWrite: false });
          dec.name = "air con decals";
          return dec;
        }
        // Panel body — metallic blue (FINAL reduced-glare recipe).
        if (m.name === "Blue base" || m.name === "Blue base.001") {
          const base = new THREE.MeshPhysicalMaterial({ color: "#7e9fc6", metalness: 1.5, roughness: 0.6, clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 1.0 });
          base.name = m.name; panelMats.push(base); return base;
        }
        // Push-button caps / surrounds — matte near-black.
        if (m.name === "black button" || m.name === "black button.001") {
          const c = m.clone() as THREE.MeshStandardMaterial;
          if ("color" in c) c.color.set("#070a0e");
          if ("roughness" in c) c.roughness = 1.0;
          if ("metalness" in c) c.metalness = 0.0;
          if ("envMapIntensity" in c) c.envMapIntensity = 0.25;
          return c;
        }
        // Rotary knobs — brushed chrome.
        if (m.name === "metal") {
          const c = m.clone() as THREE.MeshStandardMaterial;
          if ("color" in c) c.color.set("#c7ccd2");
          if ("metalness" in c) c.metalness = 1.0;
          if ("roughness" in c) c.roughness = 0.3;
          if ("envMapIntensity" in c) c.envMapIntensity = 1.3;
          return c;
        }
        return m.clone();
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(remap) : remap(obj.material);
      if (matNames(obj).has("air con decals")) obj.renderOrder = 20;
    });
    (clone.userData as { panelMats?: THREE.MeshStandardMaterial[] }).panelMats = panelMats;
    return clone;
  }, [scene, faceTex]);

  const { camera, size, controls } = useThree();
  const boundRef = useState({ done: false })[0];

  // bind env map onto the panel (Blue base) materials so envMapIntensity is honoured
  useFrame(({ scene: fs }) => {
    if (!boundRef.done && fs.environment) {
      const pm = (root.userData as { panelMats?: THREE.MeshStandardMaterial[] }).panelMats ?? [];
      pm.forEach((m) => { m.envMap = fs.environment; m.envMapIntensity = 1.0; m.needsUpdate = true; });
      boundRef.done = true;
    }
  });

  // camera fit on the whole panel, head-on
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
    const dist = Math.max(w / 2 / Math.tan(hFov / 2), h / 2 / Math.tan(vFov / 2)) * 1.12 + dim[normal];
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

export function EngStartPanel3D() {
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
        <EngStartScene />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
