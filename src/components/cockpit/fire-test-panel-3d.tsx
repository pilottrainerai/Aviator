"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FireTestPanel3D — faithful web render of Downloads/fire test.blend.
//
// GENERALISED to all THREE sections (ENG1, APU, ENG2). The ENG1 base-case recipe
// (see blender/fire_test/BASE_CASE_engine_web_treatment.md) is applied uniformly:
//   • baked face rendered UNLIT (MeshBasic) + HDRI environment for the metals
//   • guard lifts on click (gated so it never swallows the pb click)
//   • FIRE pb pops out + its screws travel with it
//   • AGENT discharges on click (momentary spring); SQUIB→white, DISCH→amber
//     rendered as glowing TEXT (unlit, on top), dim grey when off; cap never lights
//
// Parts are selected by MATERIAL + POSITION (GLTFLoader mangles node names), so the
// same code drives every section regardless of Blender naming.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const ARM_MS = 0;
const MODEL_URL = "/models/fire_test_panel.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
const FACE_TEX_URL = "/models/fire_test_face_combined_v5.png";

// Section layout is fixed: 3 FIRE pbs left→right = ENG1, APU, ENG2; agent counts 2/1/2.
const SECTION_KEYS = ["ENG1", "APU", "ENG2"] as const;
const AGENT_COUNTS = [2, 1, 2];

const C3 = {
  fireRed: new THREE.Color("#ff0603"),
  off: new THREE.Color(0, 0, 0),
} as const;

const PRESS_SHRINK = 0.1;
const PRESS_DARKEN = 0.55;
const PRESS_ATTACK_MS = 90;
const PRESS_RELEASE_MS = 520;
const AGENT_CAP_COLOR = new THREE.Color("#222730");
const LEGEND_OFF = "#41464d"; // dim, unlit legend at rest

function pressCurve(elapsed: number): number {
  if (elapsed < 0 || !Number.isFinite(elapsed)) return 0;
  if (elapsed <= PRESS_ATTACK_MS) return elapsed / PRESS_ATTACK_MS;
  const t = (elapsed - PRESS_ATTACK_MS) / PRESS_RELEASE_MS;
  if (t >= 1) return 0;
  return Math.exp(-3.2 * t) * Math.cos(4.6 * t);
}

const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false });

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
function setLegend(mesh: THREE.Mesh | undefined, on: boolean, onHex: string) {
  if (!mesh) return;
  const m = getMat(mesh) as THREE.MeshBasicMaterial;
  if (!m.color) return;
  m.color.set(on ? onHex : LEGEND_OFF);
}
function matNames(o: THREE.Object3D): Set<string> {
  const s = new Set<string>();
  o.traverse((m) => {
    if (m instanceof THREE.Mesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => s.add(mm.name));
  });
  return s;
}

export interface FireTestPanel3DProps {
  /** TEST: lights every FIRE pb red (fire detected). Turning it off resets the drill. */
  fireDetected: boolean;
  /** Bump to force a reset of the whole drill (guards close, pbs unpushed, agents re-armed). */
  resetSignal?: number;
  /** Reports the live per-section drill state up to the page (for the status readout). */
  onState?: (s: { guardOpen: boolean[]; pbDone: boolean[]; disch: boolean[][] }) => void;
  /** DEBUG: reports what each click resolved to, so we can see clicks land in the live browser. */
  onClickDetected?: (info: string) => void;
  // ── live tuning (shared across all sections) ──
  firePopOut?: number;
  fireAsmRadius?: number;
  agentShrink?: number;
  agentCapLight?: number;
  agentAsmLight?: number;
  guardClosedDeg?: number;
  guardOpenDeg?: number;
  squibColor?: string;
  squibLight?: number;
  dischColor?: string;
  dischLight?: number;
  pressOverride?: number;
}

type Agent = {
  cap: THREE.Mesh;
  squib?: THREE.Mesh;
  disch?: THREE.Mesh;
  rig: THREE.Group | null;
  restPosY: number;
};
type Section = {
  key: string;
  firePbMesh: THREE.Mesh | null;
  firePbGroup: THREE.Object3D | null;
  restY: number;
  guard: THREE.Mesh | null;
  guardOpenRot: number;
  screws: { mesh: THREE.Object3D; dist: number; restY: number }[];
  agents: Agent[];
};

function FireTestPanelScene(props: FireTestPanel3DProps) {
  const {
    fireDetected, resetSignal, onState, onClickDetected,
    firePopOut, fireAsmRadius, agentShrink, agentCapLight, agentAsmLight,
    guardClosedDeg, guardOpenDeg, squibColor, squibLight, dischColor, dischLight, pressOverride,
  } = props;

  const { scene } = useGLTF(MODEL_URL);
  const faceTex = useTexture(FACE_TEX_URL);
  faceTex.flipY = false;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;

  const pressRef = useRef<Record<string, number>>({});
  const dischSeenRef = useRef<Set<string>>(new Set());
  const pbWallRef = useRef<(number | null)[]>([null, null, null]);

  // Per-section drill state held in a REF (source of truth) so a click reads the
  // CURRENT state synchronously — a rapid guard→pb→agent sequence in the same tick
  // would otherwise see stale React state. A version counter triggers re-render +
  // the onState report. (ENG1=2 agents, APU=1, ENG2=2.)
  const fresh = () => ({ guardOpen: [false, false, false], pbDone: [false, false, false], disch: [[false, false], [false], [false, false]] as boolean[][] });
  const drillRef = useRef(fresh());
  const [drillVer, setDrillVer] = useState(0);
  const bump = () => setDrillVer((v) => v + 1);

  const resetDrill = () => {
    pbWallRef.current = [null, null, null];
    dischSeenRef.current.clear();
    drillRef.current = fresh();
    bump();
  };

  useEffect(() => { if (!fireDetected) resetDrill(); }, [fireDetected]);
  useEffect(() => { if (resetSignal) resetDrill(); }, [resetSignal]);
  useEffect(() => {
    const d = drillRef.current;
    onState?.({ guardOpen: [...d.guardOpen], pbDone: [...d.pbDone], disch: d.disch.map((r) => [...r]) });
  }, [drillVer, onState]); // ONLY when the drill changes — a no-deps effect here looped forever

  // ── Clone + apply the base-case material treatment (keyed by material name, so it
  // covers ALL sections at once), then convert legend WORDS to flat unlit text. ──
  const root = useMemo(() => {
    const clone = scene.clone(true);
    const drop: THREE.Object3D[] = [];
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (/cut$/i.test(obj.name)) { drop.push(obj); return; }
      const remap = (m: THREE.Material) => {
        if (m.name === "DECALS") {
          const basic = new THREE.MeshBasicMaterial({ map: faceTex, side: THREE.DoubleSide, toneMapped: false });
          basic.name = "DECALS";
          return basic;
        }
        if (m.name === "fire pb1 LIT" || m.name === "red fire push") {
          const lens = new THREE.MeshPhysicalMaterial({
            color: "#841010", metalness: 0.0, roughness: 0.2, transmission: 0.58, thickness: 0.7, ior: 1.5,
            attenuationColor: new THREE.Color("#7a0d0d"), attenuationDistance: 0.85,
            clearcoat: 1.0, clearcoatRoughness: 0.08, emissive: "#ff0505", emissiveIntensity: 0, envMapIntensity: 1.7,
          });
          lens.name = "fire pb1 LIT";
          return lens;
        }
        const c = m.clone() as THREE.MeshStandardMaterial;
        if (m.name === "orange housijng") { if ("metalness" in c) c.metalness = 0.7; if ("roughness" in c) c.roughness = 0.32; }
        if (m.name === "hinge metal") { if ("metalness" in c) c.metalness = 1.0; if ("roughness" in c) c.roughness = 0.18; }
        if (m.name === "black button") { if ("color" in c) c.color.set("#050608"); if ("roughness" in c) c.roughness = 0.7; if ("metalness" in c) c.metalness = 0.0; }
        if (m.name === "Blue base") {
          const base = new THREE.MeshPhysicalMaterial({ color: "#7e9fc6", metalness: 0.5, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 1.35 });
          base.name = "Blue base";
          return base;
        }
        return c;
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(remap) : remap(obj.material);
    });
    for (const o of drop) o.parent?.remove(o);

    clone.updateWorldMatrix(true, true);
    // Legend windows (legend_box) positions → used to find + darken the agent caps.
    const legendPos: THREE.Vector3[] = [];
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh && matNames(o).has("legend_box")) legendPos.push(o.getWorldPosition(new THREE.Vector3()));
    });
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !matNames(o).has("black button")) return;
      const p = o.getWorldPosition(new THREE.Vector3());
      if (legendPos.some((lp) => lp.distanceTo(p) < 0.08)) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          const sm = m as THREE.MeshStandardMaterial;
          if ("color" in sm) sm.color.copy(AGENT_CAP_COLOR);
          if ("roughness" in sm) sm.roughness = 0.9;
          if ("metalness" in sm) sm.metalness = 0.0;
          if ("envMapIntensity" in sm) sm.envMapIntensity = 0.25;
        });
      }
    });

    // ── Legend WORDS (all SQUIB/DISCH FONT meshes use `label_white`) → flat UNLIT
    // MeshBasic so the hue is exact (a lit material + NoToneMapping clips amber→
    // yellow), depthTest off + high renderOrder so the lit letters sit on top of
    // the baked-dark legend. Dim grey at rest; per-frame code sets white/amber. ──
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !matNames(o).has("label_white")) return;
      o.renderOrder = 30;
      const basic = new THREE.MeshBasicMaterial({ color: LEGEND_OFF, toneMapped: false, depthTest: false });
      basic.name = "legend_text";
      o.material = basic;
    });
    return clone;
  }, [scene, faceTex]);

  // ── Build the 3 sections by MATERIAL + POSITION. ──
  const sections = useMemo<Section[]>(() => {
    root.updateWorldMatrix(true, true);
    const byMat = (name: string) => {
      const out: THREE.Mesh[] = [];
      root.traverse((o) => { if (o instanceof THREE.Mesh && matNames(o).has(name)) out.push(o); });
      return out;
    };
    const wx = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).x;
    const wpos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

    const faces = byMat("fire pb1 LIT").sort((a, b) => wx(a) - wx(b)); // [ENG1, APU, ENG2]
    const boxes = byMat("legend_box");
    const caps = byMat("black button");
    const texts = byMat("legend_text"); // label_white meshes were renamed legend_text in the root pass
    // Guards = LARGE orange-housijng meshes (the flip covers), not the small pb bezels.
    const guards = byMat("orange housijng").filter((o) => {
      const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      return Math.max(s.x, s.y, s.z) > 0.4;
    }).sort((a, b) => wx(a) - wx(b));

    // Partition legend boxes into sections by world-X (matches the measured layout).
    const boxBands: [number, number][] = [[-99, -0.7], [-0.7, -0.2], [-0.2, 99]];

    const attachHit = (target: THREE.Object3D | null, name: string, size: [number, number, number]) => {
      if (!target || target.getObjectByName(name)) return;
      const hit = new THREE.Mesh(new THREE.BoxGeometry(...size), HIT_MAT.clone());
      hit.name = name;
      // The fire-pb / guard groups carry a LARGE world scale, which would inflate
      // the hitbox (e.g. 0.16 → 20 deep) so much the camera sits INSIDE it and a
      // front-side raycast misses entirely. Counter-scale by the target's world
      // scale so the hitbox is exactly `size` in WORLD units and stays clickable.
      const ws = target.getWorldScale(new THREE.Vector3());
      hit.scale.set(1 / (ws.x || 1), 1 / (ws.y || 1), 1 / (ws.z || 1));
      target.add(hit);
    };

    const out: Section[] = [];
    for (let i = 0; i < 3; i++) {
      const key = SECTION_KEYS[i];
      const firePbMesh = faces[i] ?? null;
      const firePbGroup = firePbMesh?.parent ?? null;
      const center = firePbGroup ? wpos(firePbGroup) : new THREE.Vector3();
      // guard nearest this pb
      const guard = guards.slice().sort((a, b) => wpos(a).distanceTo(center) - wpos(b).distanceTo(center))[0] ?? null;
      const guardOpenRot = guard ? guard.rotation.x : -2.4435;

      // screws: small non-guard/non-face/non-hinge meshes ringing the pb
      const screws: Section["screws"] = [];
      if (firePbGroup) {
        for (const o of root.children) {
          if (o === firePbGroup) continue;
          const nm = matNames(o);
          if (nm.has("DECALS") || nm.has("hinge black") || nm.has("hinge metal")) continue;
          if (o === guard) continue;
          const bb = new THREE.Box3().setFromObject(o); const sz = bb.getSize(new THREE.Vector3());
          if (Math.max(sz.x, sz.y, sz.z) > 0.45) continue;
          const dist = bb.getCenter(new THREE.Vector3()).distanceTo(center);
          if (dist > 0.34) continue;
          screws.push({ mesh: o, dist, restY: o.position.y });
        }
      }

      // agents for this section
      const myBoxes = boxes.filter((b) => { const x = wx(b); return x >= boxBands[i][0] && x < boxBands[i][1]; })
        .sort((a, b) => wx(a) - wx(b));
      const agents: Agent[] = [];
      myBoxes.forEach((box, j) => {
        const bp = wpos(box);
        const cap = caps.slice().sort((a, b) => wpos(a).distanceTo(bp) - wpos(b).distanceTo(bp))[0];
        // two nearest legend texts; higher (more negative z) = SQUIB, lower = DISCH
        const near = texts.map((t) => ({ t, p: wpos(t) })).filter((e) => e.p.distanceTo(bp) < 0.18)
          .sort((a, b) => a.p.z - b.p.z);
        const squib = near[0]?.t;
        const disch = near[1]?.t;
        // rig: reparent cap + legends under one pivot group so the press stays aligned
        let rig: THREE.Group | null = null;
        let restPosY = 0;
        if (cap && cap.parent) {
          const rigName = `${key}_A${j}_rig`;
          const existing = root.getObjectByName(rigName) as THREE.Group | undefined;
          if (existing) { rig = existing; restPosY = (existing.userData.restPosY as number) ?? existing.position.y; }
          else {
            const parts = [cap, squib, disch, box].filter(Boolean) as THREE.Object3D[];
            const c = new THREE.Vector3();
            parts.forEach((m) => c.add(wpos(m)));
            c.multiplyScalar(1 / parts.length);
            const parent = cap.parent;
            const g = new THREE.Group(); g.name = rigName; parent.add(g);
            g.position.copy(parent.worldToLocal(c.clone()));
            parts.forEach((m) => g.attach(m));
            g.userData.restPosY = g.position.y;
            rig = g; restPosY = g.position.y;
          }
        }
        attachHit(cap, `HIT_${key}_A${j}`, [0.28, 0.26, 0.2]);
        agents.push({ cap, squib, disch, rig, restPosY });
      });

      attachHit(guard, `HIT_${key}_GUARD`, [0.26, 0.22, 0.12]);
      attachHit(firePbGroup, `HIT_${key}_PB`, [0.28, 0.16, 0.16]);

      out.push({ key, firePbMesh, firePbGroup, restY: firePbGroup ? firePbGroup.position.y : 0, guard, guardOpenRot, screws, agents });
    }
    return out;
  }, [root]);

  // Agent housing meshes (the non-cap black-button cube co-located at each legend) —
  // lifted lighter than the cap for contrast, live via agentAsmLight.
  const agentHousings = useMemo(() => {
    root.updateWorldMatrix(true, true);
    const boxes: THREE.Vector3[] = [];
    root.traverse((o) => { if (o instanceof THREE.Mesh && matNames(o).has("legend_box")) boxes.push(o.getWorldPosition(new THREE.Vector3())); });
    const cubes: { m: THREE.Mesh; p: THREE.Vector3 }[] = [];
    root.traverse((o) => { if (o instanceof THREE.Mesh && matNames(o).has("black button")) cubes.push({ m: o, p: o.getWorldPosition(new THREE.Vector3()) }); });
    const set = new Set<THREE.Mesh>();
    for (const L of boxes) {
      const near = cubes.filter((c) => c.p.distanceTo(L) < 0.1).sort((a, b) => a.p.distanceTo(L) - b.p.distanceTo(L));
      near.slice(1).forEach((c) => set.add(c.m));
    }
    return Array.from(set);
  }, [root]);

  const guardClosedRot = useMemo(() => ((guardClosedDeg ?? 0) * Math.PI) / 180, [guardClosedDeg]);
  const guardOpenOverride = useMemo(() => (guardOpenDeg != null ? (guardOpenDeg * Math.PI) / 180 : null), [guardOpenDeg]);

  useFrame(() => {
    const squibHex = squibColor ?? "#ffffff";
    const dischHex = dischColor ?? "#ff9f00";
    const squibInt = squibLight ?? 6.0;
    const dischInt = dischLight ?? 5.0;
    const squibCol = new THREE.Color(squibHex);
    const dischCol = new THREE.Color(dischHex);
    const popY = firePopOut ?? 0.15;
    const asmR = fireAsmRadius ?? 0.25;
    const d = drillRef.current;

    sections.forEach((s, i) => {
      // guard
      if (s.guard) {
        const target = d.guardOpen[i] ? (guardOpenOverride ?? s.guardOpenRot) : guardClosedRot;
        s.guard.rotation.x = THREE.MathUtils.lerp(s.guard.rotation.x, target, 0.08);
      }
      // FIRE pb: light red on fire; pop out when pushed; carry screws
      if (s.firePbMesh) {
        const fp = getMat(s.firePbMesh) as THREE.MeshStandardMaterial;
        if (fp.color) fp.color.set(fireDetected ? "#b40909" : "#841010");
        setMaterialLight(s.firePbMesh, C3.fireRed, fireDetected ? 2.0 : 0);
      }
      const pop = d.pbDone[i] ? popY : 0;
      if (s.firePbGroup) s.firePbGroup.position.y = THREE.MathUtils.lerp(s.firePbGroup.position.y, s.restY + pop, 0.14);
      for (const sc of s.screws) {
        const t = sc.restY + (sc.dist <= asmR ? pop : 0);
        sc.mesh.position.y = THREE.MathUtils.lerp(sc.mesh.position.y, t, 0.14);
      }

      // agents: SQUIB white while armed (pb pushed, not yet discharged); DISCH amber once discharged
      s.agents.forEach((a, j) => {
        const dischd = d.disch[i][j];
        const prevDone = j === 0 ? true : d.disch[i][j - 1]; // AGENT 2 arms after AGENT 1
        const squibOn = d.pbDone[i] && prevDone && !dischd;
        setLegend(a.squib, squibOn, squibHex);
        setLegend(a.disch, dischd, dischHex);
        setMaterialLight(a.squib, squibCol, squibOn ? squibInt : 0);
        setMaterialLight(a.disch, dischCol, dischd ? dischInt : 0);

        // momentary spray press on discharge
        const key = `${i}-${j}`;
        if (dischd && !dischSeenRef.current.has(key)) { dischSeenRef.current.add(key); if (!pressRef.current[key]) pressRef.current[key] = Date.now(); }
        if (!dischd) dischSeenRef.current.delete(key);
        if (a.rig) {
          const elapsed = pressRef.current[key] ? Date.now() - pressRef.current[key] : Infinity;
          const p = pressOverride ?? pressCurve(elapsed);
          const f = 1 - (agentShrink ?? PRESS_SHRINK) * p;
          a.rig.scale.set(f, 1, f);
          const capBase = agentCapLight != null
            ? new THREE.Color().setHSL(0.58, 0.12, Math.max(0, Math.min(1, agentCapLight / 100)))
            : AGENT_CAP_COLOR;
          const capMat = getMat(a.cap) as THREE.MeshStandardMaterial;
          if (capMat.color) capMat.color.copy(capBase).multiplyScalar(1 - PRESS_DARKEN * Math.max(p, 0));
          setMaterialLight(a.cap, C3.off, 0); // cap never illuminates
        }
      });
    });

    if (agentAsmLight != null) {
      const asm = new THREE.Color().setHSL(0.58, 0.1, Math.max(0, Math.min(1, agentAsmLight / 100)));
      agentHousings.forEach((h) => { const m = getMat(h) as THREE.MeshStandardMaterial; if (m.color) m.color.copy(asm); });
    }
  });

  // POSITION-BASED click resolution — no dependence on hitbox placement or mangled
  // node names (those lined up for ENG1 but not APU/ENG2). e.point is the exact 3D
  // world point clicked; we act on whichever control (a section's guard/pb centre,
  // or one of its agents) is nearest. Same behaviour for every section.
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.point) return;
    const p = e.point;
    const d = drillRef.current;
    let best: { kind: "guardpb" | "agent"; i: number; j: number; dist: number } | null = null;
    const consider = (wp: THREE.Vector3, kind: "guardpb" | "agent", i: number, j: number) => {
      const dist = wp.distanceTo(p);
      if (!best || dist < best.dist) best = { kind, i, j, dist };
    };
    sections.forEach((s, i) => {
      if (s.firePbGroup) consider(s.firePbGroup.getWorldPosition(new THREE.Vector3()), "guardpb", i, -1);
      s.agents.forEach((a, j) => { if (a.cap) consider(a.cap.getWorldPosition(new THREE.Vector3()), "agent", i, j); });
    });
    if (!best) { onClickDetected?.("click but no control found"); return; }
    const { kind, i, j, dist } = best;
    onClickDetected?.(`${SECTION_KEYS[i]} ${kind}${kind === "agent" ? j : ""} d=${dist.toFixed(2)}`);
    if (dist > 0.45) return; // clicked away from every control
    if (kind === "guardpb") {
      if (!d.guardOpen[i]) { d.guardOpen[i] = true; bump(); return; }
      if (fireDetected && !d.pbDone[i]) {
        d.pbDone[i] = true;
        if (pbWallRef.current[i] == null) pbWallRef.current[i] = Date.now();
        bump();
      }
      return;
    }
    // agent
    const prevDone = j === 0 ? true : d.disch[i][j - 1];
    const armed = d.pbDone[i] && prevDone && !d.disch[i][j]
      && !!pbWallRef.current[i] && Date.now() - (pbWallRef.current[i] as number) >= ARM_MS;
    if (!armed) return;
    pressRef.current[`${i}-${j}`] = Date.now();
    d.disch[i][j] = true; bump();
  };

  const groupRef = useRef<THREE.Group>(null);
  const { camera, size, controls } = useThree();
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    let faceMesh: THREE.Mesh | null = null;
    group.traverse((o) => { if (o instanceof THREE.Mesh && matNames(o).has("DECALS")) faceMesh = o; });
    const target: THREE.Object3D = faceMesh ?? group;
    const box = new THREE.Box3().setFromObject(target);
    const center = box.getCenter(new THREE.Vector3());
    const dim = box.getSize(new THREE.Vector3());
    const dims = [{ axis: "x" as const, v: dim.x }, { axis: "y" as const, v: dim.y }, { axis: "z" as const, v: dim.z }].sort((a, b) => a.v - b.v);
    const normalAxis = dims[0].axis, w = dims[2].v, h = dims[1].v;
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(1, size.height);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = Math.max(w / 2 / Math.tan(hFov / 2), h / 2 / Math.tan(vFov / 2)) * 1.12 + dim[normalAxis];
    const viewDir = new THREE.Vector3(normalAxis === "x" ? 1 : 0, normalAxis === "y" ? 1 : 0, normalAxis === "z" ? 1 : 0);
    const heightAxis = dims[1].axis;
    cam.up.set(heightAxis === "x" ? 1 : 0, heightAxis === "y" ? 1 : 0, heightAxis === "z" ? 1 : 0);
    cam.position.copy(center).addScaledVector(viewDir, dist);
    cam.near = Math.max(0.01, dist * 0.02);
    cam.far = dist * 6;
    cam.updateProjectionMatrix();
    cam.lookAt(center);
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit?.target) { orbit.target.copy(center); orbit.update(); }
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
        <FireTestPanelScene {...props} />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
