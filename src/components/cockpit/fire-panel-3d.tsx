"use client";

// HUB_TAG: ENG1_FIRE_PANEL_HUB_BASELINE_V1

// ─────────────────────────────────────────────────────────────────────────────
// FirePanel3D — Blender GLB-driven 3D ENG 1 fire panel
//
// Governed by: .github/instructions/a320-pushbutton.instructions.md
// FCOM source:  docs/manuals/fcom-full.txt  DSC-26-20-20  (lines 44390–44456)
//
// FCOM behaviour (verbatim):
//   ENG 1 FIRE pb  — "normal position is in, and guarded. When the flight
//     crew pushes it, the pushbutton is released" (pops OUT +3 mm).
//     "The red lights come on, regardless of the pushbutton position,
//     whenever the fire warning for the corresponding engine is activated."
//   SQUIB  — "comes on white when the flight crew releases the FIRE pb"
//     (immediately on pb release, TEXT cell only, background stays dark)
//   DISCH  — "comes on amber when the corresponding fire extinguisher
//     bottle has lost pressure" (TEXT cell only, background stays dark)
//   AGENT 1 AFTER 10 S — FCOM procedure L2: "10 s delay allows N1 to
//     decrease, reducing nacelle ventilation" (ARM_MS = 10 000 ms)
//
// Light cells (skill §4 state table):
//   ENG1_FIRE_lbl  → WHITE (rest) | RED (fireDetected)
//   ENG1_FirePb    → body: no emissive ever
//   ENG1_A1_SQ     → WHITE immediately when firePbDone
//   ENG1_A2_SQ     → WHITE immediately when firePbDone
//   ENG1_A1_DC     → AMBER when agent1Disch
//   ENG1_A2_DC     → AMBER when agent2Disch
//   *_SQbg *_DCbg  → always dark (cell_dark, intensity 0)
//   ENG1_FireBar   → always WHITE (static label strip)
//
// Coordinate mapping after GLTF Y-up export from Blender Z-up:
//   Blender X → GLTF X   (horizontal)
//   Blender Z → GLTF Y   (press-in / pop-out axis — skill §5d)
//   Blender Y → GLTF -Z  (vertical as seen from camera)
// Camera: perspective fov 18, position [-0.005, 0.004, 0.3]
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// skill §0 rule 7: AGENT 1 AFTER 10 S — "10 s delay allows N1 to decrease"
// FCOM PRO-ABN-ENG ident 00018190.0002001
const ARM_MS = 10_000;

// skill §5c colour constants — RED/AMBER/WHITE per FCOM DSC-31-10 colour convention
const C3 = {
  red:   new THREE.Color("#F10C00"),  // skill §1: RED = immediate action
  amber: new THREE.Color("#FFB300"),  // skill §1: AMBER = awareness / caution
  white: new THREE.Color("#E8ECF4"),  // skill §1: WHITE = label / guidance
  off:   new THREE.Color(0, 0, 0),   // unlit cell
} as const;

const HIT_MAT = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
});

// ── Props — mirror EngineFireScenarioPanelProps ───────────────────────────────
export interface FirePanel3DProps {
  /** True when scenario `fire_warn` trigger has fired. */
  fireDetected:     boolean;
  /** True when `eng1_fire_pb` step is done (pb physically pushed/out). */
  firePbDone:       boolean;
  /** True when `agent1` step is done. */
  agent1Disch:      boolean;
  /** True when `agent2` step is done. */
  agent2Disch:      boolean;
  /** When true AGENT 2 pb is shown as applicable (optional). */
  agent2Available?: boolean;
  onPushFirePb:     () => void;
  onPushAgent1:     () => void;
  onPushAgent2:     () => void;
  /**
   * Optional: called when the guard is tapped while no fire is active.
   * In dev/standalone mode wire this to setFireDetected(true) so the user
   * can step through the full FCOM sequence by clicking the 3D panel only,
   * without needing the HTML "FIRE ON" button.
   * In scenario mode leave undefined — fire detection comes from the scenario.
   */
  onFireDetect?:    () => void;
}

// ── Helper: get first material on a mesh ─────────────────────────────────────
function getMat(mesh: THREE.Mesh): THREE.MeshStandardMaterial {
  return (Array.isArray(mesh.material)
    ? mesh.material[0]
    : mesh.material) as THREE.MeshStandardMaterial;
}

// ── Inner R3F scene ───────────────────────────────────────────────────────────
function FirePanelScene(props: FirePanel3DProps) {
  const {
    fireDetected, firePbDone, agent1Disch, agent2Disch,
    onPushFirePb, onPushAgent1, onPushAgent2, onFireDetect,
  } = props;

  const { scene } = useGLTF("/models/eng1_left_panel.glb");

  // Deep-clone scene + all materials so material mutations don't bleed
  // between multiple mounted instances of this component.
  const root = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      // ── Hide Blender boolean-cutter geometry ─────────────────────────────
      // These objects (WRC, TRcut, CavCut, GlsCut, OvCut) were used as
      // negative boolean cutters in Blender.  They have no material and
      // export to GLTF as solid grey meshes that cover the real elements.
      if (/cut$/i.test(obj.name) || obj.name.endsWith('WRC')) {
        obj.visible = false;
        return;
      }
      // Clone materials so per-instance emissive mutations stay isolated
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m: THREE.Material) => m.clone());
      } else {
        obj.material = (obj.material as THREE.Material).clone();
      }
    });

    const attachHitSphere = (targetName: string, hitName: string, radius: number) => {
      const target = clone.getObjectByName(targetName);
      if (!target) return;
      if (target.getObjectByName(hitName)) return;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), HIT_MAT.clone());
      hit.name = hitName;
      target.add(hit);
    };

    // Oversized invisible hit zones so panel controls remain clickable in dense layouts.
    attachHitSphere("ENG1_Guard",   "HIT_GUARD",   0.012);
    attachHitSphere("ENG1_FirePb",  "HIT_FIRE_PB", 0.015);
    attachHitSphere("ENG1_A1_Body", "HIT_A1",      0.012);
    attachHitSphere("ENG1_A2_Body", "HIT_A2",      0.012);

    return clone;
  }, [scene]);

  // Index all meshes by name once after clone
  const meshes = useMemo(() => {
    const map: Record<string, THREE.Mesh> = {};
    root.traverse(obj => {
      if (obj instanceof THREE.Mesh) map[obj.name] = obj;
    });
    return map;
  }, [root]);

  // Rest positions captured once from the clone — used as base for press-in lerp.
  // FCOM skill §5: press-in axis is GLTF local Y (= panel depth / Blender Z).
  const restPositions = useMemo(() => {
    const map: Record<string, THREE.Vector3> = {};
    root.traverse(obj => {
      if (obj instanceof THREE.Mesh) map[obj.name] = obj.position.clone();
    });
    return map;
  }, [root]);

  // Original base (diffuse) colours from the cloned materials.
  // Needed to restore the body colour after fire-active state clears it to black.
  const originalColors = useMemo(() => {
    const map: Record<string, THREE.Color> = {};
    root.traverse(obj => {
      if (obj instanceof THREE.Mesh) map[obj.name] = getMat(obj).color.clone();
    });
    return map;
  }, [root]);

  // ── FCOM two-tap guard state (UI-local, not a scenario step) ─────────────
  // tap 1 → guard lifts open; tap 2 → FIRE pb push
  const [guardOpen, setGuardOpen] = useState(false);

  // ── Reset local state when external RESET clears all props ───────────────
  useEffect(() => {
    if (!fireDetected && !firePbDone) {
      setGuardOpen(false);
      setFirePbWallMs(null);
    }
  }, [fireDetected, firePbDone]);

  // ── 10-s arming wall-clock timestamp ─────────────────────────────────────
  const [firePbWallMs, setFirePbWallMs] = useState<number | null>(null);
  useEffect(() => {
    if (firePbDone && firePbWallMs === null) setFirePbWallMs(Date.now());
  }, [firePbDone, firePbWallMs]);

  // Re-render 10× per second while the arming window is live so the pulse
  // and countdown-based arm state are picked up inside useFrame.
  const [, tickState] = useState(0);
  useEffect(() => {
    if (!firePbWallMs || agent1Disch) return;
    const elapsed = Date.now() - firePbWallMs;
    if (elapsed >= ARM_MS) return;
    const id = setInterval(() => tickState(n => n + 1), 100);
    return () => clearInterval(id);
  }, [firePbWallMs, agent1Disch]);

  // ── Per-frame animation ───────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const t      = clock.getElapsedTime();
    const pulse  = Math.sin(t * Math.PI * 2) * 0.5 + 0.5; // 1 Hz, range 0..1

    // Derived arming state (computed inside useFrame using live wall-clock)
    const el1   = firePbWallMs ? Date.now() - firePbWallMs : 0;
    const armed1 = firePbDone && !agent1Disch && el1 >= ARM_MS; // agent 1 clickable after 10 s
    const armed2 = agent1Disch && !agent2Disch;                  // agent 2 clickable after A1 done

    // Helper: set emissive colour + strength on named mesh
    const em = (name: string, col: THREE.Color, intensity: number) => {
      const mesh = meshes[name];
      if (!mesh) return;
      const mat = getMat(mesh);
      mat.emissive.copy(col);
      mat.emissiveIntensity = intensity;
    };

    // ── ENG1 FIRE pb — skill §5d canonical template ──────────────────────
    // skill §8 gotcha 1: target LABEL mesh (ENG1_FIRE_lbl) for emissive,
    // NOT the body — body emissive floods the face and washes out text.
    // skill §2a + §4: pb POPS OUT +3 mm when pushed (guarded spring-loaded).
    // skill §4 state table: FIRE_lbl → WHITE(rest) | RED(fireDetected).
    // FCOM verbatim: "red lights come on regardless of pushbutton position"
    const firePbMesh  = meshes["ENG1_FirePb"];
    const fireLblMesh = meshes["ENG1_FIRE_lbl"];
    if (firePbMesh) {
      const restY    = restPositions["ENG1_FirePb"]?.y  ?? firePbMesh.position.y;
      const restLblY = restPositions["ENG1_FIRE_lbl"]?.y ?? (fireLblMesh?.position.y ?? restY);
      const POP_OUT_M = 0.008; // 8 mm — visible at camera distance, realistic for guarded pb

      // skill §8 gotcha 1: body emissive drives the red glow.
      // KEY: also zero out the base diffuse colour when fire active so the
      // white directional light (intensity 1.6) cannot reflect off the surface
      // and contaminate the red with white.  Pure black base + pure red emissive
      // = pure saturated red on screen — no "whitestone" wash.
      // When fire clears, original diffuse colour is restored from originalColors.
      const bodyMat = getMat(firePbMesh);
      if (fireDetected) {
        bodyMat.color.set(0, 0, 0);   // no diffuse — all light becomes pure emissive
        bodyMat.emissive.copy(C3.red);
        bodyMat.emissiveIntensity = 3.0;
      } else {
        const orig = originalColors["ENG1_FirePb"];
        if (orig) bodyMat.color.copy(orig);
        bodyMat.emissive.copy(C3.off);
        bodyMat.emissiveIntensity = 0;
      }
      firePbMesh.position.y = THREE.MathUtils.lerp(
        firePbMesh.position.y, restY + (firePbDone ? POP_OUT_M : 0), 0.12);

      // skill §5c: label — RED 7.0 when fire (vivid text above the body glow),
      // WHITE 4.0 at rest (matches wtext bake)
      if (fireLblMesh) {
        const lblMat = getMat(fireLblMesh);
        lblMat.emissive.copy(fireDetected ? C3.red : C3.white);
        lblMat.emissiveIntensity = fireDetected ? 7.0 : 4.0;
        // skill §5d: label mesh travels with body — same delta, same lerp
        fireLblMesh.position.y = THREE.MathUtils.lerp(
          fireLblMesh.position.y, restLblY + (firePbDone ? POP_OUT_M : 0), 0.12);
      }

      // FIX: ENG1_PUSH_lbl is a separate mesh on the button face.
      // It must travel with the button body — otherwise it stays 8 mm behind
      // the popped-out face and disappears inside the button body.
      const pushLblMesh = meshes["ENG1_PUSH_lbl"];
      if (pushLblMesh) {
        const restPushY = restPositions["ENG1_PUSH_lbl"]?.y ?? pushLblMesh.position.y;
        pushLblMesh.position.y = THREE.MathUtils.lerp(
          pushLblMesh.position.y, restPushY + (firePbDone ? POP_OUT_M : 0), 0.12);
      }
    }

    // ── ENG1 FIRE bar — skill §4: always WHITE (static label strip) ────────
    // FCOM: fire bar is not a warning lamp — it is a fixed white label strip.
    // Intensity 4.0 matches the Blender KHR_emissive_strength baked value.
    em("ENG1_FireBar", C3.white, 4.0);

    // ── ENG1 wire guard — skill §5e hinge pivot math ──────────────────────
    // skill §2a: guard MUST be lifted before FIRE pb is accessible.
    // Hinge is at TOP EDGE, 15.2 mm above mesh origin in Blender local Y
    // → GLTF local Z offset = −0.0152 m. Pivot math: Δy = −HINGE·sin(θ),
    // Δz = HINGE·(cos(θ)−1). Target −120° = DOM panel rotateX(−120deg).
    const guardMesh = meshes["ENG1_Guard"];
    if (guardMesh) {
      const HINGE_DIST  = 0.0152; // 15.2 mm centre→hinge in GLTF Z
      const TARGET_OPEN = -(Math.PI * 2) / 3; // −120°
      const lifted  = guardOpen || firePbDone;
      const targetX = lifted ? TARGET_OPEN : 0.0;
      guardMesh.rotation.x = THREE.MathUtils.lerp(guardMesh.rotation.x, targetX, 0.08);
      const θ  = guardMesh.rotation.x;
      const rp = restPositions["ENG1_Guard"];
      if (rp) {
        // Pivot correction: Δy = −HINGE_DIST·sin(θ), Δz = HINGE_DIST·(cos(θ)−1)
        guardMesh.position.y = rp.y - HINGE_DIST * Math.sin(θ);
        guardMesh.position.z = rp.z + HINGE_DIST * (Math.cos(θ) - 1);
      }
    }

    // ── AGENT 1 + 2 SQUIB cells — skill §4 + FCOM verbatim ──────────────
    // FCOM: "SQUIB comes on white when the flight crew releases the FIRE pb"
    // skill §0 rule 3: WHITE *immediately* on pb release — not after 10 s.
    // skill §1b + §8 gotcha 3: TEXT mesh only — background (SQbg) stays dark.
    // FIX: SQUIB = squib is intact/armed. Once agent discharged the squib
    // has physically fired — SQUIB goes OFF, DISCH comes ON in its place.
    // Correct: SQUIB white only while (firePbDone AND agent not yet discharged).
    const sq1On = firePbDone && !agent1Disch;
    const sq2On = firePbDone && !agent2Disch;
    em("ENG1_A1_SQbg", C3.off, 0);
    em("ENG1_A1_SQ",   sq1On ? C3.white : C3.off, sq1On ? 3.0 : 0);
    em("ENG1_A2_SQbg", C3.off, 0);
    em("ENG1_A2_SQ",   sq2On ? C3.white : C3.off, sq2On ? 3.0 : 0);

    // ── AGENT 1 + 2 DISCH cells — skill §4 + FCOM verbatim ───────────────
    // FCOM: "DISCH comes on amber when the corresponding fire extinguisher
    // bottle has lost pressure."  TEXT mesh only — background (DCbg) stays dark.
    em("ENG1_A1_DCbg", C3.off, 0);
    em("ENG1_A1_DC",   agent1Disch ? C3.amber : C3.off, agent1Disch ? 2.5 : 0);
    em("ENG1_A2_DCbg", C3.off, 0);
    em("ENG1_A2_DC",   agent2Disch ? C3.amber : C3.off, agent2Disch ? 2.5 : 0);

    // ── Teal rings — click affordance (not an FCOM indicator) ────────────
    // Subtle pulse shows which AGENT pb is currently pressable.
    em("ENG1_A1_TR", armed1 ? C3.white : C3.off, armed1 ? 0.40 + pulse * 0.30 : 0);
    em("ENG1_A2_TR", armed2 ? C3.white : C3.off, armed2 ? 0.40 + pulse * 0.30 : 0);

    // ── AGENT pb bodies — skill §5d press-in axis = GLTF local Y ─────────
    // skill §8 gotcha 2: press axis is GLTF local Y (Blender Z = depth).
    // AGENT pbs press IN (−1 mm) when discharged (spring-loaded pb-sw).
    const a1body = meshes["ENG1_A1_Body"];
    if (a1body) {
      const restA1Y = restPositions["ENG1_A1_Body"]?.y ?? a1body.position.y;
      a1body.position.y = THREE.MathUtils.lerp(a1body.position.y,
        agent1Disch ? restA1Y - 0.001 : restA1Y, 0.12);
    }
    const a2body = meshes["ENG1_A2_Body"];
    if (a2body) {
      const restA2Y = restPositions["ENG1_A2_Body"]?.y ?? a2body.position.y;
      a2body.position.y = THREE.MathUtils.lerp(a2body.position.y,
        agent2Disch ? restA2Y - 0.001 : restA2Y, 0.12);
    }
  });

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const hitNames = new Set<string>();
    const collectNames = (start: THREE.Object3D | null | undefined) => {
      let obj: THREE.Object3D | null | undefined = start;
      for (let i = 0; i < 8 && obj; i += 1) {
        if (obj.name) hitNames.add(obj.name);
        obj = obj.parent;
      }
    };

    collectNames(e.object);
    for (const hit of e.intersections) collectNames(hit.object);

    const hasHit = (matcher: (name: string) => boolean) => Array.from(hitNames).some(matcher);
    const isGuardHit = hasHit((n) => n === "HIT_GUARD" || n === "ENG1_Guard" || /^ENG1_Guard/.test(n) || /Guard/i.test(n));
    const isFirePbHit = hasHit((n) =>
      n === "HIT_FIRE_PB" ||
      n === "ENG1_FirePb" ||
      n === "ENG1_FIRE_lbl" ||
      n === "ENG1_PUSH_lbl" ||
      /^ENG1_FirePb/.test(n)
    );
    const isA1Hit = hasHit((n) => n === "HIT_A1" || /^ENG1_A1_/.test(n) || n === "ENG1_A1");
    const isA2Hit = hasHit((n) => n === "HIT_A2" || /^ENG1_A2_/.test(n) || n === "ENG1_A2");

    // skill §2a: guard tap 1 — lift guard (two-step: lift → push).
    // skill §0 rule 2: no code path reaches pb without guard lifted.
    // onFireDetect: dev-mode only — lets guard tap trigger the fire warning
    // so the full FCOM sequence works from the 3D panel alone.
    if (isGuardHit && !guardOpen && !firePbDone) {
      setGuardOpen(true);
      if (!fireDetected) onFireDetect?.();
      return;
    }

    // skill §2a: FIRE pb tap 2 — only when guard lifted + fire active.
    // FCOM: pb releases (pops out), silences aural, arms squibs.
    if (isFirePbHit && (guardOpen || firePbDone) && fireDetected && !firePbDone) {
      onPushFirePb();
      return;
    }

    // skill §0 rule 7: AGENT 1 only after 10-s arming window (ARM_MS).
    // FCOM: "AGENT 1 AFTER 10 S → DISCH"
    const el1 = firePbWallMs ? Date.now() - firePbWallMs : 0;
    const isArmed1 = firePbDone && !agent1Disch && el1 >= ARM_MS;
    if (isA1Hit && isArmed1) {
      onPushAgent1();
      return;
    }

    // skill §0 rule 8: AGENT 2 only after AGENT 1 discharged.
    // FCOM: "IF FIRE AFTER 30 S: AGENT 2 → DISCH"
    const isArmed2 = agent1Disch && !agent2Disch;
    if (isA2Hit && isArmed2) {
      onPushAgent2();
    }
  };

  // The eng1_left_panel.blend was built with the panel lying flat (Blender XY
  // plane, depth in Z). After GLTF Y-up export the panel is edge-on to the
  // default Three.js camera (+Z → -Z). Rotating +90° around X brings the face
  // into the XY plane so it's fully visible from the camera at [x,y,+0.3].
  // Downscale significantly so the panel sits inside the existing action area
  // without overpowering neighboring instruments.
  return <primitive object={root} onClick={handleClick} scale={0.68} rotation={[Math.PI / 2, 0, 0]} />;
}

// ── Exported component ────────────────────────────────────────────────────────
export function FirePanel3D(props: FirePanel3DProps) {
  // Mount-guard: prevents Three.js Canvas from rendering during SSR
  // (Next.js App Router renders "use client" components on the server too)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div style={{ width: "100%", height: "100%", background: "#080C12" }} />;
  }

  return (
    <Canvas
      dpr={2}
      camera={{
        fov:      20,
        near:     0.01,
        far:      2,
        position: [0, 0.006, 0.17],
      }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping, logarithmicDepthBuffer: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      {/*
        Lighting: soft cockpit dome + front key + lower-right fill.
        logarithmicDepthBuffer eliminates z-fighting on thin text geometry.
      */}
      <ambientLight     intensity={0.85} color="#8899BB" />
      <directionalLight position={[-0.05,  0.35, 0.45]} intensity={3.2} color="#FFFFFF" />
      <directionalLight position={[ 0.40, -0.10, 0.20]} intensity={0.9} color="#607080" />

      <Suspense fallback={null}>
        <FirePanelScene {...props} />
      </Suspense>
    </Canvas>
  );
}

// Preload GLB on module import (before component mounts)
useGLTF.preload("/models/eng1_left_panel.glb");
