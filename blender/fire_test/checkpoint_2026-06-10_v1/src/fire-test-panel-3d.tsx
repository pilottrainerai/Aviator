"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FireTestPanel3D — faithful web render of  Downloads/fire test.blend
//
// Earlier versions looked fake / black / white because the GLB export drops the
// two things that give the Blender Cycles view its look:
//
//   1. The WORLD HDRI (braustuble_alley_4k.exr). The panel base is metallic 0.8
//      and the hinges are metallic 1.0 — metals show almost nothing under plain
//      directional/ambient lights; their whole look is the reflection of the
//      environment. We load the SAME HDRI here as scene.environment. Biggest fix.
//
//   2. The panel-face markings (FIRE / ENG 1 / AGENT…) lived in a Mix-Shader
//      that glTF cannot encode. They were BAKED in Blender into a flat albedo
//      texture and re-applied as the face's base colour, so the GLB now carries
//      them. No runtime decal overlay / alphaTest / polygonOffset hacks needed.
//
// Colour management matches Blender's "Standard" view transform:
//   toneMapping = NoToneMapping, output = sRGB. No ACES, no exposure — those are
//   what washed out the earlier attempts.
//
// Source: blender/fire_test/fire_test_work.blend (a copy — Downloads original
// is never modified). Re-export: blender/fire_test/export_glb.py.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARM_MS = 10_000;
const MODEL_URL = "/models/fire_test_panel.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
const FACE_TEX_URL = "/models/fire_test_decals_baked.png";

const C3 = {
  red: new THREE.Color("#ff2218"),
  amber: new THREE.Color("#ffb300"),
  white: new THREE.Color("#eef6ff"),
  off: new THREE.Color(0, 0, 0),
} as const;

// Object names in the GLB (from the Blender file).
const ENG1 = {
  firePb: "fire pb1",
  guard: "guard",
  agent1: "eng1 ag1",
  agent2: "eng1 ag2",
  squib1: "SQUIB",
  squib2: "SQUIB 2",
  disch1: "DISH 1",
  disch2: "DISCH 2",
} as const;

const HIT_MAT = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
});

export interface FireTestPanel3DProps {
  fireDetected: boolean;
  firePbDone: boolean;
  agent1Disch: boolean;
  agent2Disch: boolean;
  agent2Available?: boolean;
  activeStepId?: string;
  onFireDetect?: () => void;
  onPushFirePb: () => void;
  onPushAgent1: () => void;
  onPushAgent2: () => void;
}

function getMat(mesh: THREE.Mesh): THREE.Material {
  return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
}

function setMaterialLight(mesh: THREE.Mesh | undefined, color: THREE.Color, intensity: number) {
  if (!mesh) return;
  const mat = getMat(mesh);
  if ("emissive" in mat && (mat as THREE.MeshStandardMaterial).emissive instanceof THREE.Color) {
    const litMat = mat as THREE.MeshStandardMaterial;
    litMat.emissive.copy(color);
    litMat.emissiveIntensity = intensity;
  }
}

function FireTestPanelScene(props: FireTestPanel3DProps) {
  const {
    fireDetected,
    firePbDone,
    agent1Disch,
    agent2Disch,
    agent2Available = true,
    activeStepId,
    onFireDetect,
    onPushFirePb,
    onPushAgent1,
    onPushAgent2,
  } = props;

  const { scene } = useGLTF(MODEL_URL);
  // Baked panel-face texture (Blender steel-blue + white markings) loaded
  // separately — the GLB's own embedded bake is unreliable, this PNG is the
  // verified-good one. flipY=false to match the glTF mesh UV convention.
  const faceTex = useTexture(FACE_TEX_URL);
  faceTex.flipY = false;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;
  const pressRef = useRef<Record<string, number>>({});
  // Guard sits in its opened pose in the .blend; that is the working start pose.
  const [guardOpen, setGuardOpen] = useState(true);
  const [firePbWallMs, setFirePbWallMs] = useState<number | null>(null);

  useEffect(() => {
    if (!fireDetected && !firePbDone) {
      setGuardOpen(true);
      setFirePbWallMs(null);
    }
  }, [fireDetected, firePbDone]);

  useEffect(() => {
    if (firePbDone && firePbWallMs === null) setFirePbWallMs(Date.now());
  }, [firePbDone, firePbWallMs]);

  const [, tickState] = useState(0);
  useEffect(() => {
    if (!firePbWallMs || agent1Disch) return;
    if (Date.now() - firePbWallMs >= ARM_MS) return;
    const id = setInterval(() => tickState((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [firePbWallMs, agent1Disch]);

  // Clone scene + materials so per-instance emissive mutations stay isolated.
  // KEEP the GLB's own PBR materials — they are faithful to Blender and react to
  // the HDRI environment. We only hide non-panel helper geometry (lamp planes /
  // boolean cutters that export with no real material).
  const root = useMemo(() => {
    const clone = scene.clone(true);
    // Detach Blender lamp/backdrop planes + boolean cutters entirely (not just
    // hide them) — invisible geometry still skews <Bounds> auto-framing.
    const drop: THREE.Object3D[] = [];
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (/^Plane/i.test(obj.name) || /cut$/i.test(obj.name)) {
        drop.push(obj);
        return;
      }
      const remap = (m: THREE.Material) => {
        if (m.name === "DECALS") {
          // The baked face texture IS the correct Blender steel-blue + white
          // markings. Render it UNLIT so three's lighting can't darken it
          // (PBR + env-only made it near-black). Carries the real baked detail,
          // not a flat solid colour.
          const basic = new THREE.MeshBasicMaterial({
            map: faceTex,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
          basic.name = "DECALS"; // keep name so the camera-fit can find the face
          return basic;
        }
        return m.clone();
      };
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(remap);
      } else {
        obj.material = remap(obj.material);
      }
    });
    for (const o of drop) o.parent?.remove(o);

    const attachHitBox = (targetName: string, hitName: string, size: [number, number, number]) => {
      const target = clone.getObjectByName(targetName);
      if (!target || target.getObjectByName(hitName)) return;
      const hit = new THREE.Mesh(new THREE.BoxGeometry(...size), HIT_MAT.clone());
      hit.name = hitName;
      target.add(hit);
    };
    attachHitBox(ENG1.guard, "HIT_ENG1_GUARD", [0.26, 0.22, 0.12]);
    attachHitBox(ENG1.firePb, "HIT_ENG1_FIRE_PB", [0.28, 0.16, 0.16]);
    attachHitBox(ENG1.agent1, "HIT_ENG1_A1", [0.2, 0.14, 0.12]);
    attachHitBox(ENG1.agent2, "HIT_ENG1_A2", [0.2, 0.14, 0.12]);
    return clone;
  }, [scene, faceTex]);

  const meshes = useMemo(() => {
    const map: Record<string, THREE.Mesh> = {};
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) map[obj.name] = obj;
    });
    return map;
  }, [root]);

  const restPositions = useMemo(() => {
    const map: Record<string, THREE.Vector3> = {};
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) map[obj.name] = obj.position.clone();
    });
    return map;
  }, [root]);

  const guardOpenRotation = useMemo(() => {
    const guard = root.getObjectByName(ENG1.guard);
    return guard ? guard.rotation.x : -2.4435;
  }, [root]);

  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.getElapsedTime() * Math.PI * 2) * 0.5 + 0.5;
    const firePb = meshes[ENG1.firePb];
    const guard = meshes[ENG1.guard];
    const agent1 = meshes[ENG1.agent1];
    const agent2 = meshes[ENG1.agent2];

    if (guard) {
      guard.rotation.x = THREE.MathUtils.lerp(guard.rotation.x, guardOpen ? guardOpenRotation : 0, 0.08);
    }

    if (firePb) {
      const rest = restPositions[ENG1.firePb]?.z ?? firePb.position.z;
      firePb.position.z = THREE.MathUtils.lerp(firePb.position.z, rest + (firePbDone ? 0.035 : 0), 0.14);
      setMaterialLight(firePb, C3.red, fireDetected ? 1.5 + pulse * 0.6 : 0);
    }

    const squib1On = firePbDone && !agent1Disch;
    const squib2On = firePbDone && agent2Available && !agent2Disch;
    setMaterialLight(meshes[ENG1.squib1], C3.white, squib1On ? 2.8 : 0);
    setMaterialLight(meshes[ENG1.squib2], C3.white, squib2On ? 2.8 : 0);
    setMaterialLight(meshes[ENG1.disch1], C3.amber, agent1Disch ? 3.0 : 0);
    setMaterialLight(meshes[ENG1.disch2], C3.amber, agent2Disch ? 3.0 : 0);

    const a1Armed = firePbDone && !agent1Disch && !!firePbWallMs && Date.now() - firePbWallMs >= ARM_MS;
    const a2Armed = agent2Available && agent1Disch && !agent2Disch;

    const animateAgent = (mesh: THREE.Mesh | undefined, key: "A1" | "A2", done: boolean, armed: boolean, stepId: string) => {
      if (!mesh) return;
      const rest = restPositions[mesh.name]?.z ?? mesh.position.z;
      const elapsed = pressRef.current[key] ? Date.now() - pressRef.current[key] : 9999;
      const touch = Math.max(0, 1 - elapsed / 150);
      const pressOffset = done ? -0.012 : -0.026 * touch;
      mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, rest + pressOffset, 0.18);
      const active = armed && activeStepId === stepId;
      setMaterialLight(mesh, active ? C3.white : C3.off, active ? 0.25 + pulse * 0.45 : 0);
    };

    animateAgent(agent1, "A1", agent1Disch, a1Armed, "agent1");
    animateAgent(agent2, "A2", agent2Disch, a2Armed, "agent2");
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const names = new Set<string>();
    const collect = (obj: THREE.Object3D | null | undefined) => {
      let cur = obj;
      for (let i = 0; i < 8 && cur; i += 1) {
        if (cur.name) names.add(cur.name);
        cur = cur.parent;
      }
    };
    collect(e.object);
    for (const hit of e.intersections) collect(hit.object);
    const has = (target: string) => Array.from(names).some((name) => name === target || name.startsWith(target));

    if (has("HIT_ENG1_GUARD") || has(ENG1.guard)) {
      setGuardOpen(true);
      if (!fireDetected) onFireDetect?.();
      return;
    }
    if ((has("HIT_ENG1_FIRE_PB") || has(ENG1.firePb)) && guardOpen && fireDetected && !firePbDone) {
      onPushFirePb();
      return;
    }
    const agent1Armed = firePbDone && !agent1Disch && !!firePbWallMs && Date.now() - firePbWallMs >= ARM_MS;
    if ((has("HIT_ENG1_A1") || has(ENG1.agent1)) && agent1Armed) {
      pressRef.current.A1 = Date.now();
      onPushAgent1();
      return;
    }
    const agent2Armed = agent2Available && agent1Disch && !agent2Disch;
    if ((has("HIT_ENG1_A2") || has(ENG1.agent2)) && agent2Armed) {
      pressRef.current.A2 = Date.now();
      onPushAgent2();
    }
  };

  // Blender Z-up → glTF Y-up leaves the panel lying face-up; stand it upright.
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size, controls } = useThree();

  // Deterministic one-time framing: measure the standing panel's world bbox and
  // place the perspective camera head-on so the whole panel fits with margin.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    // World matrices are not yet computed this early — force them before any
    // Box3.setFromObject, or the measured bbox is in a stale frame and the
    // camera ends up aimed at empty space (black canvas).
    group.updateWorldMatrix(true, true);
    // Frame on the flat panel FACE plate (the mesh using the DECALS material),
    // not the whole group — swung-open guards / pop-out buttons otherwise
    // inflate the bbox. (Node names like "Curve.001" are mangled by GLTFLoader's
    // sanitizer; material names survive, so we match on the DECALS material.)
    let faceMesh: THREE.Mesh | null = null;
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m.name === "DECALS")) faceMesh = o;
    });
    const target: THREE.Object3D = faceMesh ?? group;
    const box = new THREE.Box3().setFromObject(target);
    const center = box.getCenter(new THREE.Vector3());
    const dim = box.getSize(new THREE.Vector3());

    // After the Z-up→Y-up export + our group rotation the panel lies flat (its
    // thinnest extent is the face normal). View straight down that thin axis so
    // the panel is seen head-on. The two larger extents are width/height.
    const dims = [
      { axis: "x" as const, v: dim.x },
      { axis: "y" as const, v: dim.y },
      { axis: "z" as const, v: dim.z },
    ].sort((a, b) => a.v - b.v);
    const normalAxis = dims[0].axis; // thinnest = face normal
    const w = dims[2].v; // largest = width
    const h = dims[1].v; // middle = height

    const cam = camera as THREE.PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(1, size.height);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = Math.max(w / 2 / Math.tan(hFov / 2), h / 2 / Math.tan(vFov / 2)) * 1.12 + dim[normalAxis];

    const viewDir = new THREE.Vector3(
      normalAxis === "x" ? 1 : 0,
      normalAxis === "y" ? 1 : 0,
      normalAxis === "z" ? 1 : 0,
    );
    // Up axis = the height axis (the larger in-plane extent that isn't width).
    const heightAxis = dims[1].axis;
    cam.up.set(heightAxis === "x" ? 1 : 0, heightAxis === "y" ? 1 : 0, heightAxis === "z" ? 1 : 0);
    cam.position.copy(center).addScaledVector(viewDir, dist);
    cam.near = Math.max(0.01, dist * 0.02);
    cam.far = dist * 6;
    cam.updateProjectionMatrix();
    cam.lookAt(center);
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit?.target) {
      orbit.target.copy(center);
      orbit.update();
    }
  }, [camera, size.width, size.height, controls, root]);

  return (
    <group ref={groupRef}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={root} onClick={handleClick} />
      </group>
    </group>
  );
}

export function FireTestPanel3D(props: FireTestPanel3DProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div style={{ width: "100%", height: "100%", background: "#070a0e" }} />;
  }

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 28, near: 0.01, far: 100, position: [0, 0, 4] }}
      gl={{
        antialias: true,
        alpha: true,
        // Match Blender "Standard" view transform — no ACES, no exposure tweak.
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ width: "100%", height: "100%", background: "#05070a" }}
    >
      <Suspense fallback={null}>
        {/* The SAME HDRI Blender lights the scene with — makes the metallic blue
            base + hinges read as real metal instead of dead flat colour. */}
        <Environment files={HDRI_URL} environmentIntensity={1.0} />
        <FireTestPanelScene {...props} />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
