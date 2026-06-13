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

// FCOM DSC-26-20-20: the AGENT pb-sw "become active when the flight crew releases
// the ENG FIRE pb" [fcom:4a:L44429] and SQUIB comes on white at that same moment
// [fcom:4a:L44437] — i.e. immediately, no hardware arming delay. The "AGENT 1 AFTER
// 10 S" [fcom:L94620] is a PROCEDURAL wait before discharging, not a lockout, so the
// button is clickable as soon as the FIRE pb is released. 0 = active on release.
const ARM_MS = 0;
const MODEL_URL = "/models/fire_test_panel.glb";
const HDRI_URL = "/hdri/braustuble_alley_2k.hdr";
// COMBINED Cycles bake = Blender's actual shaded face (bright #7b9ec2 steel-blue
// + HDRI sheen + markings). Rendered UNLIT it matches Blender's colour exactly.
// PBR-metallic reflection of the muted HDRI rendered dark grey-green (#414543) —
// that was the "dull" look — so we do NOT light the face.
const FACE_TEX_URL = "/models/fire_test_face_combined_v3.png"; // v3 = baked guard shadow above ENG1 FIRE pb painted out (per-row clean-blue lift)

const C3 = {
  red: new THREE.Color("#ff2218"),
  // Pure, saturated siren-red for the FIRE lamp glow. Almost no green/blue so
  // that even multiplied by a high emissiveIntensity it stays RED instead of
  // blooming toward orange/white (with NoToneMapping, lifting G/B desaturates).
  fireRed: new THREE.Color("#ff0603"),
  amber: new THREE.Color("#ffb300"),
  white: new THREE.Color("#eef6ff"),
  off: new THREE.Color(0, 0, 0),
} as const;

// Object names AS LOADED by GLTFLoader — it converts spaces in Blender object
// names to underscores ("DISH 1" → "DISH_1"). Use the underscore form here or
// the lookups silently miss and the lights/animations never fire.
const ENG1 = {
  firePb: "fire_pb1",
  guard: "guard",
  agent1: "eng1_ag1",
  agent2: "eng1_ag2",
  squib1: "SQUIB",
  squib2: "SQUIB_2",
  disch1: "DISH_1",
  disch2: "DISCH_2",
} as const;

// AGENT pushbutton: a MOMENTARY press — the cap sinks in to fire the agent
// ("spray"), then springs back out to rest. It does NOT latch. Depth is in
// GLB-native units (cap is ~0.012 thick); travel is along the face normal
// (local Y; see animateAgent). PRESS_ATTACK_MS = time to sink fully in,
// PRESS_RELEASE_MS = time to spring back out.
// These AGENT caps are nearly FLUSH with the panel (they protrude only a hair),
// so any real inward travel just sinks the button behind the face plate, which
// then occludes the thin legend. Keep the depth move tiny and carry the visible
// "press" with an in-plane shrink instead (it can't clip behind the panel).
// These AGENT caps are nearly FLUSH — the legend floats <0.004 in front of the
// cap and the panel face is right behind, so ANY inward depth move pushes the
// button behind the face plate and the thin legend gets occluded (it vanishes).
// So we carry the entire "press" with an IN-PLANE shrink (local X/Z only); it
// can't clip behind the panel and the SQUIB/DISCH legend shrinks with the cap.
const PRESS_DEPTH = 0.0; // no inward travel — it would clip the legend behind the panel
const PRESS_SHRINK = 0.1; // modest in-plane shrink (0.2 read as "the button got smaller")
const PRESS_DARKEN = 0.55; // also darken the cap as it presses → reads as receding INTO shadow
const PRESS_ATTACK_MS = 90;
const PRESS_RELEASE_MS = 520; // a touch longer so the spring is watchable

// AGENT cap base colour — dark, but clearly a button against the near-black recess.
// Shared by the cap-lighten pass and the per-frame press-darken so they stay in sync.
const AGENT_CAP_COLOR = new THREE.Color("#222730");

// Momentary press profile. 0 → 1 (sink in) over the attack, then an UNDERDAMPED
// spring on release: it overshoots slightly past rest (p < 0 = cap springs proud)
// and settles — that little bounce is what reads as a real spring, not a shrink.
function pressCurve(elapsed: number): number {
  if (elapsed < 0 || !Number.isFinite(elapsed)) return 0;
  if (elapsed <= PRESS_ATTACK_MS) return elapsed / PRESS_ATTACK_MS;
  const t = (elapsed - PRESS_ATTACK_MS) / PRESS_RELEASE_MS;
  if (t >= 1) return 0;
  return Math.exp(-3.2 * t) * Math.cos(4.6 * t); // 1 → dips to ≈ -0.11 → settles to 0
}

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
  /** DEBUG: when set (0..1) freezes both AGENT caps at this press depth. */
  pressOverride?: number;
  /** DEBUG (?free=1): click either AGENT cap to replay the spring instantly,
   * with no guard/FIRE/arm gating — purely for judging the press animation. */
  freePlay?: boolean;
  /** DEBUG: incrementing counter from an on-screen TEST button — each bump
   * replays AGENT 1's press/spring so the motion is easy to watch. */
  playSignal?: number;
  /** DEBUG: live guard CLOSED / OPEN angles in degrees (from on-screen sliders). */
  guardClosedDeg?: number;
  guardOpenDeg?: number;
  /** DEBUG: when set, pin the guard DIRECTLY at this angle (deg) regardless of
   * open/closed state — the single live-tuning slider. null = normal behavior. */
  guardManualDeg?: number | null;
  /** DEBUG live tuning: FIRE pb pop-out distance (scene Z), AGENT press shrink
   * fraction, and AGENT cap lightness 0–100. */
  firePopOut?: number;
  agentShrink?: number;
  agentCapLight?: number;
  /** DEBUG: AGENT housing/assembly lightness 0–100 (lighter than the cap = contrast). */
  agentAsmLight?: number;
  /** DEBUG live tuning: how far around the FIRE pb centre the pop-out reaches
   * (world units). 0 = button only; raise it to sweep the nearby screw cylinders
   * into the SAME travel so they pop out WITH the button. */
  fireAsmRadius?: number;
  /** DEBUG live tuning: hex colour for the FIRE pb square casing — the
   * `orange housijng` bezel on the ENG1 button only (guard/others untouched). */
  fireCasingColor?: string;
  /** DEBUG live tuning: when true, the FIRE pb pops out by `firePopOut` as soon
   * as the guard is OPEN (no drill / firePbDone needed) so the slider moves the
   * button live. Off in real use — there the pop is gated on firePbDone. */
  firePopLive?: boolean;
  /** DEBUG live tuning: SQUIB indication colour + glow intensity. FCOM: SQUIB
   * comes on WHITE when the FIRE pb is released. Default #ffffff / 6.0. */
  squibColor?: string;
  squibLight?: number;
  /** DEBUG live tuning: DISCH indication colour + glow intensity. FCOM: DISCH
   * comes on AMBER when the agent discharges. Default #ffb300 / 5.0. */
  dischColor?: string;
  dischLight?: number;
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
    pressOverride,
    freePlay,
    playSignal,
    guardClosedDeg,
    guardOpenDeg,
    guardManualDeg,
    firePopOut,
    agentShrink,
    agentCapLight,
    agentAsmLight,
    fireAsmRadius,
    fireCasingColor,
    firePopLive,
    squibColor,
    squibLight,
    dischColor,
    dischLight,
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
  // Tracks whether each agent's discharge has already triggered its spray press,
  // so the momentary animation fires once per discharge (reset on RESET).
  const dischSeenRef = useRef<{ A1: boolean; A2: boolean }>({ A1: false, A2: false });
  // FCOM DSC-26-20-20: the ENG FIRE pb normal position is "in, and guarded"
  // [fcom:4a:L44403] — so the guard starts CLOSED, matching ENG 2 / APU. The pilot
  // lifts it (handleClick) to reach the pb. On reset, it returns to closed.
  const [guardOpen, setGuardOpen] = useState(false);
  const [firePbWallMs, setFirePbWallMs] = useState<number | null>(null);

  useEffect(() => {
    if (!fireDetected && !firePbDone) {
      setGuardOpen(false); // reset → guard back to its closed/guarded rest position
      setFirePbWallMs(null);
    }
  }, [fireDetected, firePbDone]);

  useEffect(() => {
    if (firePbDone && firePbWallMs === null) setFirePbWallMs(Date.now());
  }, [firePbDone, firePbWallMs]);

  // TEST button (page overlay) bumps playSignal → replay AGENT 1's spring on
  // demand, regardless of drill state, so the motion is easy to watch. TEMP.
  useEffect(() => {
    if (playSignal) pressRef.current.A1 = Date.now();
  }, [playSignal]);

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
    // Detach only boolean-cutter helper geometry. NOTE: the `Plane*` meshes are
    // NOT backdrop — they are the white SQUIB/DISCH legend boxes on the agent
    // buttons (material `legend_box`), so they must be KEPT.
    const drop: THREE.Object3D[] = [];
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (/cut$/i.test(obj.name)) {
        drop.push(obj);
        return;
      }
      const remap = (m: THREE.Material) => {
        if (m.name === "DECALS") {
          // Face = COMBINED Cycles bake rendered UNLIT, so it shows Blender's
          // exact bright blue + sheen (lighting it as PBR turned it dull green).
          const basic = new THREE.MeshBasicMaterial({
            map: faceTex,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
          basic.name = "DECALS"; // keep name so the camera-fit can find the face
          return basic;
        }
        // ── FIRE pushbutton lens: a REAL translucent red-plastic lens. The
        // "FIRE/PUSH" legend is embossed into this same mesh (no separate text
        // mesh / texture exists), so the old flat opaque red hid the molded
        // letters. A physical lens — light transmission for depth + a glossy
        // clearcoat top layer — makes the embossed legend catch highlights and
        // read clearly, and gives the authentic moulded-acrylic look. The
        // per-frame code still drives ENG1's color/emissive when fire is active.
        if (m.name === "fire pb1 LIT" || m.name === "red fire push") {
          // Light is OFF: a SOLID strong-plastic red lens (not glass) — only a
          // faint translucency, with a glossy clearcoat for the classy sheen.
          // emissive stays at 0 so it reads clearly UNLIT; the per-frame code
          // blooms ENG1 bright (a visibly different, lit material) on fire.
          const lens = new THREE.MeshPhysicalMaterial({
            // OFF: a deep RUBY-red translucent plastic — no bulb behind it, but
            // the pigment is still clearly red in ambient light (not black, not
            // orange). Pure red hue (G==B, both tiny) so it never reads orange.
            color: "#841010",
            metalness: 0.0,
            roughness: 0.2, // sharper body specular so the embossed FIRE/PUSH
            // letters catch a crisp highlight on their raised edges and read.
            transmission: 0.58, // more transparent — light passes through more
            // freely (see-through red plastic), still short of clear glass.
            thickness: 0.7, // depth for the red attenuation inside the body
            ior: 1.5, // polycarbonate, not glass
            // Tint transmitted light red; a longer attenuation distance absorbs
            // less, so it reads more transparent while the molded FIRE/PUSH
            // letters still show as a subtle red depth gradient.
            attenuationColor: new THREE.Color("#7a0d0d"),
            attenuationDistance: 0.85,
            clearcoat: 1.0, // glossy moulded top coat = the "classy" sheen
            clearcoatRoughness: 0.08,
            emissive: "#ff0505", // pure red glow; only lifted by per-frame code
            emissiveIntensity: 0, // OFF — the lamp is not lit
            envMapIntensity: 1.7,
          });
          lens.name = "fire pb1 LIT"; // keep name so ENG1 lookup + per-frame still match
          return lens;
        }
        const c = m.clone() as THREE.MeshStandardMaterial;
        // ── Wire guard: should read as METAL, not flat plastic. Blender has it
        // non-metallic, but with the HDRI it needs metalness to catch reflections.
        if (m.name === "orange housijng") {
          if ("metalness" in c) c.metalness = 0.7;
          if ("roughness" in c) c.roughness = 0.32;
        }
        // ── Hinges: brighter polished chrome.
        if (m.name === "hinge metal") {
          if ("metalness" in c) c.metalness = 1.0;
          if ("roughness" in c) c.roughness = 0.18;
        }
        // ── Agent (black) buttons: keep them a rich matte black so they don't
        // wash out to grey under the key light (richness of colour).
        if (m.name === "black button") {
          if ("color" in c) c.color.set("#050608");
          if ("roughness" in c) c.roughness = 0.7;
          if ("metalness" in c) c.metalness = 0.0;
        }
        // ── Blue base = back panel + the edge SCREWS. Matches the bright baked
        // face blue, but as a PHYSICAL material with a thin clearcoat so it reads
        // as real painted aluminium (subtle wet sheen + micro-reflection) rather
        // than flat plastic — the "material realism" the face's flat bake lacks.
        if (m.name === "Blue base") {
          const base = new THREE.MeshPhysicalMaterial({
            color: "#7e9fc6", // = baked face blue, so back panel matches the face
            metalness: 0.5,
            roughness: 0.34, // satin brushed-metal feel
            clearcoat: 0.6, // thin lacquer coat = painted-panel realism
            clearcoatRoughness: 0.22,
            envMapIntensity: 1.35,
          });
          base.name = "Blue base";
          return base;
        }
        return c;
      };
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(remap);
      } else {
        obj.material = remap(obj.material);
      }
    });
    for (const o of drop) o.parent?.remove(o);

    // ── AGENT cap body LIGHTEN. Lift the agent pushbutton caps from near-black to
    // a charcoal so the button silhouette and its edges separate from both the
    // blue panel and the white SQUIB/DISCH legend. The 5 caps are found by
    // PROXIMITY to the white legend_box windows (one per cap) — NOT by the shared
    // "black button" material, which also covers screws elsewhere (that mismatch
    // is why an earlier material-keyed attempt marked the wrong parts).
    clone.updateWorldMatrix(true, true);
    const legendPos: THREE.Vector3[] = [];
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m.name === "legend_box")) legendPos.push(o.getWorldPosition(new THREE.Vector3()));
    });
    // Keep the cap DARK and MATTE (no silver HDRI sheen) — its visibility against
    // the light-blue panel is what lets the press-shrink read as motion: a dark
    // cap edge receding against the static bright panel is far easier to see than
    // a glossy grey cap. Flat dark, high roughness, zero metalness = no reflection.
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.some((m) => m.name === "black button")) return;
      const p = o.getWorldPosition(new THREE.Vector3());
      if (legendPos.some((lp) => lp.distanceTo(p) < 0.08)) {
        mats.forEach((m) => {
          const sm = m as THREE.MeshStandardMaterial;
          if ("color" in sm) sm.color.copy(AGENT_CAP_COLOR);
          if ("roughness" in sm) sm.roughness = 0.9; // matte — kill the env sheen
          if ("metalness" in sm) sm.metalness = 0.0;
          if ("envMapIntensity" in sm) sm.envMapIntensity = 0.25; // barely any reflection
        });
      }
    });

    const attachHitBox = (targetName: string, hitName: string, size: [number, number, number]) => {
      const target = clone.getObjectByName(targetName);
      if (!target || target.getObjectByName(hitName)) return;
      const hit = new THREE.Mesh(new THREE.BoxGeometry(...size), HIT_MAT.clone());
      hit.name = hitName;
      target.add(hit);
    };
    attachHitBox(ENG1.guard, "HIT_ENG1_GUARD", [0.26, 0.22, 0.12]);
    attachHitBox(ENG1.firePb, "HIT_ENG1_FIRE_PB", [0.28, 0.16, 0.16]);
    // Generous AGENT hit-targets: the visible legend (SQUIB/DISCH) is the natural
    // place to click, but those are SEPARATE meshes from the cap node — so make
    // the cap's invisible hit box big enough to sit in front of the whole legend
    // window, ensuring a click anywhere on the button face registers a discharge.
    attachHitBox(ENG1.agent1, "HIT_ENG1_A1", [0.28, 0.26, 0.2]);
    attachHitBox(ENG1.agent2, "HIT_ENG1_A2", [0.28, 0.26, 0.2]);

    // ── Legend WORDS (SQUIB / DISCH) must read as GLOWING LETTERS, not a colour
    // blob behind dark text. The baked face has these words printed dark; the
    // separate FONT meshes sit right over them. Force those letter meshes to draw
    // ON TOP (depthTest off + high renderOrder) and unlit-bright (toneMapped off)
    // so when we drive their emissive the LETTERS themselves light up white/amber
    // and cover the baked-dark version underneath.
    const legendTextNames = new Set<string>([ENG1.squib1, ENG1.squib2, ENG1.disch1, ENG1.disch2]);
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !legendTextNames.has(o.name)) return;
      o.renderOrder = 30;
      // Render legends as FLAT UNLIT colour. A lit MeshStandard under the bright
      // directional key + NoToneMapping pushes amber past the R/G clip point →
      // both max out → YELLOW, regardless of the base colour. MeshBasic shows the
      // hue verbatim, so #ff9f00 reads as true amber and #ffffff as clean white.
      // depthTest off so the lit letters sit on top of the baked-dark legend.
      const basic = new THREE.MeshBasicMaterial({
        color: 0x41464d, // dim, unlit grey at rest
        toneMapped: false,
        depthTest: false,
      });
      basic.name = "legend_text";
      o.material = basic;
    });
    return clone;
  }, [scene, faceTex]);

  const meshes = useMemo(() => {
    const map: Record<string, THREE.Mesh> = {};
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) map[obj.name] = obj;
    });
    return map;
  }, [root]);

  // The white DISCH legend boxes (material `legend_box`) sit in front of the
  // thin DISCH text, so the text's amber glow is occluded. In the real panel
  // the whole legend WINDOW illuminates amber — so light the box itself.
  // Sort by world-X → left-to-right: [ENG1 A1, ENG1 A2, APU, ENG2 A1, ENG2 A2].
  const legendBoxes = useMemo(() => {
    root.updateWorldMatrix(true, true);
    const arr: { mesh: THREE.Mesh; x: number }[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m.name === "legend_box")) {
        arr.push({ mesh: o, x: o.getWorldPosition(new THREE.Vector3()).x });
      }
    });
    arr.sort((a, b) => a.x - b.x);
    return arr.map((e) => e.mesh);
  }, [root]);

  // AGENT housing/assembly meshes: each cap location has TWO co-located black-button
  // cubes — the CAP (nearest the legend window) and the HOUSING it sits in. We want
  // the housing lighter and the cap darker for contrast, so collect the housings =
  // every near-legend black-button cube EXCEPT the nearest one (which is the cap).
  const agentHousings = useMemo(() => {
    root.updateWorldMatrix(true, true);
    const lp = legendBoxes.map((b) => b.getWorldPosition(new THREE.Vector3()));
    const cubes: { m: THREE.Mesh; p: THREE.Vector3 }[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m.name === "black button")) cubes.push({ m: o, p: o.getWorldPosition(new THREE.Vector3()) });
    });
    const out = new Set<THREE.Mesh>();
    for (const L of lp) {
      const near = cubes.filter((c) => c.p.distanceTo(L) < 0.1).sort((a, b) => a.p.distanceTo(L) - b.p.distanceTo(L));
      near.slice(1).forEach((c) => out.add(c.m)); // skip [0] = the cap
    }
    return Array.from(out);
  }, [root, legendBoxes]);

  // ENG1 FIRE button red-face mesh. The `fire pb1` node has 2 materials, so
  // GLTFLoader splits it into a Group of meshes — meshes["fire_pb1"] is
  // undefined. Find the leftmost mesh using the `fire pb1 LIT` material (ENG1 is
  // the left section) and animate it + its parent group directly.
  const eng1Fire = useMemo(() => {
    root.updateWorldMatrix(true, true);
    const faces: { mesh: THREE.Mesh; x: number }[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m.name === "fire pb1 LIT")) {
        faces.push({ mesh: o, x: o.getWorldPosition(new THREE.Vector3()).x });
      }
    });
    faces.sort((a, b) => a.x - b.x);
    const mesh = faces[0]?.mesh ?? null;
    const group = mesh?.parent ?? null;
    // The panel is stood upright with a +90°-X rotation, so local +Y is the panel
    // FACE NORMAL → world +Z (out toward the viewer). The FIRE pb pops along +Y;
    // moving it along Z (as before) sent it world −Y = straight DOWN.
    return { mesh, group, restY: group ? group.position.y : 0 };
  }, [root]);

  // FIRE pb "assembly": the screws / small parts ringing the button that should
  // travel WITH it when it pops. They're SEPARATE top-level meshes (the button's
  // own square casing is inside eng1Fire.group and already moves). Reparenting
  // them fights the loader's groups, so instead we record each candidate's rest
  // Y + distance from the button centre and, per-frame, translate only those
  // within the live `fireAsmRadius` by the same pop amount. Pop axis is root-local
  // Y (the same axis the button group uses), so a plain position.y offset keeps
  // every part aligned. Excluded: the panel face/back-plate (huge bbox), and the
  // flip-up guard + its hinges (those stay put when the button pops).
  const fireAssembly = useMemo(() => {
    root.updateWorldMatrix(true, true);
    const group = eng1Fire.group;
    type Part = { mesh: THREE.Object3D; dist: number; restY: number };
    if (!group) return [] as Part[];
    const center = group.getWorldPosition(new THREE.Vector3());
    const matNames = (o: THREE.Object3D) => {
      const s = new Set<string>();
      o.traverse((m) => {
        if (m instanceof THREE.Mesh) {
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => s.add(mm.name));
        }
      });
      return s;
    };
    const out: Part[] = [];
    for (const o of root.children) {
      if (o === group) continue;
      if (o.name.startsWith("guard")) continue; // flip-up cover stays put
      const names = matNames(o);
      if (names.has("DECALS")) continue; // panel face plate
      if (names.has("hinge black") || names.has("hinge metal")) continue; // guard hinge
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3());
      if (Math.max(size.x, size.y, size.z) > 0.45) continue; // skip panel-spanning meshes
      const dist = box.getCenter(new THREE.Vector3()).distanceTo(center);
      if (dist > 0.34) continue; // only the immediate ring around the button
      out.push({ mesh: o, dist, restY: o.position.y });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }, [root, eng1Fire]);

  // The ENG1 button's square-casing material (the `orange housijng` bezel). The
  // root-clone remap already gave every `orange housijng` usage its OWN cloned
  // material instance, so recolouring this one tints ONLY the ENG1 button — the
  // guard and the other engines' buttons keep their colour.
  const fireCasingMat = useMemo(() => {
    const group = eng1Fire.group;
    const found: THREE.MeshStandardMaterial[] = [];
    if (!group) return null;
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (m.name === "orange housijng") found.push(m as THREE.MeshStandardMaterial);
      });
    });
    return found[0] ?? null;
  }, [eng1Fire]);

  // Each ENG1 AGENT button is a black cap with its SQUIB/DISCH legend + white
  // window floating just in front — all SEPARATE meshes, in different local
  // frames. Animating them individually (earlier attempt) sent the legend
  // behind the cap and it vanished. Instead, reparent each button's parts under
  // ONE rig group pivoted at the button's centre, then animate that single
  // group — parts stay aligned, and a uniform group scale reads as the press.
  const agentRigs = useMemo(() => {
    root.updateWorldMatrix(true, true);
    const build = (capName: string, legendNames: string[], box: THREE.Mesh | undefined) => {
      const cap = meshes[capName];
      if (!cap || !cap.parent) return null;
      const rigName = `${capName}_rig`;
      const existing = root.getObjectByName(rigName) as THREE.Group | undefined;
      if (existing) {
        return { group: existing, cap, restPos: (existing.userData.restPos as THREE.Vector3).clone() };
      }
      const parts = [cap, ...legendNames.map((n) => meshes[n]), box].filter(Boolean) as THREE.Object3D[];
      const center = new THREE.Vector3();
      parts.forEach((m) => center.add(m.getWorldPosition(new THREE.Vector3())));
      center.multiplyScalar(1 / parts.length);
      const parent = cap.parent;
      const group = new THREE.Group();
      group.name = rigName;
      parent.add(group);
      group.position.copy(parent.worldToLocal(center.clone())); // pivot at button centre
      parts.forEach((m) => group.attach(m)); // attach() preserves each part's world pose
      group.userData.restPos = group.position.clone();
      return { group, cap, restPos: group.position.clone() };
    };
    return {
      A1: build(ENG1.agent1, [ENG1.squib1, ENG1.disch1], legendBoxes[0]),
      A2: build(ENG1.agent2, [ENG1.squib2, ENG1.disch2], legendBoxes[1]),
    };
  }, [root, meshes, legendBoxes]);

  // Live SQUIB / DISCH indication colours (emissive copies the same colour).
  // FCOM baseline: SQUIB white, DISCH amber — overridable via the tuning panel.
  const squibCol = useMemo(() => new THREE.Color(squibColor ?? "#ffffff"), [squibColor]);
  const dischCol = useMemo(() => new THREE.Color(dischColor ?? "#ff9f00"), [dischColor]);

  // Soft radial-gradient texture for the annunciator GLOW. With NoToneMapping and
  // no bloom pass, raising emissive only clips the text to flat white — no halo.
  // So we overlay an ADDITIVE glow sprite on each legend window; its colour +
  // opacity are driven live from the SQUIB/DISCH state so the legend reads as a
  // real illuminated annunciator (white when armed, amber when discharged).
  const glowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(255,255,255,0.65)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  // One glow sprite PER legend (SQUIB top / DISCH bottom), anchored to that text
  // mesh so SQUIB and DISCH light independently — white on the SQUIB line, amber
  // on the DISCH line. Parented to root, nudged a hair OUT along the face normal
  // (root-local +Y) so it floats just in front of the legend.
  const glowSprites = useMemo(() => {
    root.updateWorldMatrix(true, true);
    const make = (meshName: string, name: string): THREE.Sprite | null => {
      const tgt = meshes[meshName];
      if (!tgt) return null;
      const existing = root.getObjectByName(name) as THREE.Sprite | undefined;
      if (existing) return existing;
      const mat = new THREE.SpriteMaterial({
        map: glowTex, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.name = name;
      const bb = new THREE.Box3().setFromObject(tgt);
      const sz = bb.getSize(new THREE.Vector3());
      // Glow must HUG the word itself — the indication is the GLOWING TEXT, not a
      // lit box. Keep the halo barely larger than the legend so it reads as the
      // SQUIB/DISCH text softly lit, never a white plate over the whole button.
      sp.scale.set(Math.max(sz.x, sz.z) * 1.08, Math.max(sz.y, sz.z) * 1.0, 1);
      sp.position.copy(root.worldToLocal(bb.getCenter(new THREE.Vector3())));
      sp.position.y += 0.03; // float just proud of the face so it isn't occluded
      root.add(sp);
      return sp;
    };
    return {
      squib1: make(ENG1.squib1, "ENG1_squib1_glow"),
      squib2: make(ENG1.squib2, "ENG1_squib2_glow"),
      disch1: make(ENG1.disch1, "ENG1_disch1_glow"),
      disch2: make(ENG1.disch2, "ENG1_disch2_glow"),
    };
  }, [root, meshes, glowTex]);

  const guardOpenRotation = useMemo(() => {
    const guard = root.getObjectByName(ENG1.guard);
    return guard ? guard.rotation.x : -2.4435;
  }, [root]);

  // ENG 1 guard CLOSED / OPEN angles, driven LIVE by the on-screen sliders (degrees).
  // Defaults: closed +50°, open = the .blend open rotation (≈ −140°).
  const guardClosedRotation = useMemo(
    () => ((guardClosedDeg ?? 0) * Math.PI) / 180,
    [guardClosedDeg],
  );
  const guardOpenTarget = useMemo(
    () => (guardOpenDeg != null ? (guardOpenDeg * Math.PI) / 180 : guardOpenRotation),
    [guardOpenDeg, guardOpenRotation],
  );

  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.getElapsedTime() * Math.PI * 2) * 0.5 + 0.5;
    const guard = meshes[ENG1.guard];

    if (guard) {
      if (guardManualDeg != null) {
        guard.rotation.x = (guardManualDeg * Math.PI) / 180; // live tuning override
      } else {
        guard.rotation.x = THREE.MathUtils.lerp(
          guard.rotation.x, guardOpen ? guardOpenTarget : guardClosedRotation, 0.08);
      }
    }

    if (eng1Fire.mesh) {
      // FCOM DSC-26-20-20: pushing the FIRE pb RELEASES it [fcom:4a:L44403] — it
      // pops out and STAYS out (latched) until reset. Clear, lasting travel.
      // The button stays FLUSH (0) until it is actually pushed (firePbDone) — it
      // must NOT pop just because the guard is open. When pushed it travels out
      // by `firePopOut`. (firePopLive only relaxes the click gate below so you can
      // push it in the dev page without running the full drill.)
      const popY = firePbDone ? (firePopOut ?? 0.15) : 0;
      if (eng1Fire.group) {
        eng1Fire.group.position.y = THREE.MathUtils.lerp(
          eng1Fire.group.position.y, eng1Fire.restY + popY, 0.14);
      }
      // Carry the ringed screws OUT with the button — only those inside the live
      // radius; the rest ease back to rest. Same root-local Y axis as the group.
      const r = fireAsmRadius ?? 0;
      for (const pt of fireAssembly) {
        const target = pt.restY + (pt.dist <= r ? popY : 0);
        pt.mesh.position.y = THREE.MathUtils.lerp(pt.mesh.position.y, target, 0.14);
      }
      // IDLE = deep ruby red plastic, clearly UNLIT (only the pigment in ambient
      // light) — identical to the ENG 2 / APU FIRE pbs. FIRE = self-lit STEADY red
      // (FCOM: "red lights come on whenever the fire warning is activated" and
      // "remains on as long as a fire is detected" [fcom:4a:L44413 / L94618]) — no
      // pulse. A pure-red emissive at moderate intensity keeps the hue deep.
      const fpMat = getMat(eng1Fire.mesh) as THREE.MeshStandardMaterial;
      if (fpMat.color) fpMat.color.set(fireDetected ? "#b40909" : "#841010");
      setMaterialLight(eng1Fire.mesh, C3.fireRed, fireDetected ? 2.0 : 0);
    }

    // Live FIRE pb square-casing colour (ENG1 bezel only).
    if (fireCasingMat && fireCasingColor && fireCasingMat.color) {
      fireCasingMat.color.set(fireCasingColor);
    }

    const squib1On = firePbDone && !agent1Disch;
    const squib2On = firePbDone && agent2Available && !agent2Disch;
    // Diagnosis (forced-magenta test) showed the `legend_box` Plane meshes are NOT
    // the visible DISCH windows (those are baked into the face texture) — lighting
    // them did nothing. But the SQUIB / DISCH TEXT meshes DO render on top and ARE
    // tintable. So drive the indication on the text itself: engraved-dark when OFF,
    // bright WHITE (SQUIB armed) / AMBER (DISCH discharged) when ON. Tinting the
    // base colour makes it read regardless of emissive bloom; emissive adds glow
    // on a real GPU.
    // Legends stay VISIBLE (their original white) when off — identical to ENG2/APU.
    // Only CHANGE on activation: SQUIB→white(+glow) when armed, DISCH→amber when
    // discharged. The original colour is captured once and restored when off, so
    // the off state is byte-for-byte the same as the other engines (no disappearing).
    const setLegend = (mesh: THREE.Mesh | undefined, on: boolean, onHex: string) => {
      if (!mesh) return;
      const m = getMat(mesh) as THREE.MeshStandardMaterial;
      if (!m.color) return;
      if (m.userData.__orig == null) m.userData.__orig = m.color.getHex();
      // ON  = bright legend colour (white / amber) + emissive glow (set below).
      // OFF = a DIM, unlit grey — NOT the baked-bright colour. This is what makes
      // the indication read: SQUIB snaps dark→white on push, DISCH dark→amber on
      // discharge, and each returns to dark when its state clears. (The letters
      // render on top of the baked text, so this dim grey is what you see at rest.)
      if (on) m.color.set(onHex);
      else m.color.set("#41464d");
    };
    const squibHex = squibColor ?? "#ffffff";
    const dischHex = dischColor ?? "#ff9f00";
    const squibInt = squibLight ?? 6.0;
    const dischInt = dischLight ?? 5.0;
    setLegend(meshes[ENG1.squib1], squib1On, squibHex);
    setLegend(meshes[ENG1.squib2], squib2On, squibHex);
    setLegend(meshes[ENG1.disch1], agent1Disch, dischHex);
    setLegend(meshes[ENG1.disch2], agent2Disch, dischHex);
    setMaterialLight(meshes[ENG1.squib1], squibCol, squib1On ? squibInt : 0);
    setMaterialLight(meshes[ENG1.squib2], squibCol, squib2On ? squibInt : 0);
    setMaterialLight(meshes[ENG1.disch1], dischCol, agent1Disch ? dischInt : 0);
    setMaterialLight(meshes[ENG1.disch2], dischCol, agent2Disch ? dischInt : 0);

    // Additive glow per legend. The emissive text below is the bright source; the
    // sprite adds the surrounding halo (opacity ≈ intensity/12, eased) so the
    // legend reads as glowing while the text stays legible. SQUIB = white when
    // armed, DISCH = amber when discharged — driven independently.
    const driveGlow = (sp: THREE.Sprite | null, on: boolean, col: THREE.Color, intensity: number) => {
      if (!sp) return;
      const m = sp.material as THREE.SpriteMaterial;
      if (on) m.color.copy(col);
      // Halo DISABLED. The glowing TEXT meshes are the whole indication now; any
      // additive sprite here spilled light both around AND through the letters
      // (it sits over the word), which read as a smudge. Keep it at zero.
      void intensity;
      m.opacity = THREE.MathUtils.lerp(m.opacity, 0, 0.25);
    };
    driveGlow(glowSprites.squib1, squib1On, squibCol, squibInt);
    driveGlow(glowSprites.squib2, squib2On, squibCol, squibInt);
    driveGlow(glowSprites.disch1, agent1Disch, dischCol, dischInt);
    driveGlow(glowSprites.disch2, agent2Disch, dischCol, dischInt);

    // AGENT housing/assembly lightness (live) — lighter than the cap for contrast.
    if (agentAsmLight != null) {
      const asm = new THREE.Color().setHSL(0.58, 0.1, Math.max(0, Math.min(1, agentAsmLight / 100)));
      agentHousings.forEach((h) => {
        const m = getMat(h) as THREE.MeshStandardMaterial;
        if (m.color) m.color.copy(asm);
      });
    }

    const a1Armed = firePbDone && !agent1Disch && !!firePbWallMs && Date.now() - firePbWallMs >= ARM_MS;
    const a2Armed = agent2Available && agent1Disch && !agent2Disch;

    // Fire the spray when the agent discharges — whether from a real 3D click
    // (handleClick stamps pressRef on touch) or from the scenario/dev buttons
    // (which only flip the disch flag). Stamp the press time once on the
    // false→true transition, unless a click already stamped it a moment ago.
    const triggerOnDisch = (key: "A1" | "A2", disch: boolean) => {
      if (disch && !dischSeenRef.current[key]) {
        dischSeenRef.current[key] = true;
        const last = pressRef.current[key];
        if (!last || Date.now() - last > 500) pressRef.current[key] = Date.now();
      } else if (!disch) {
        dischSeenRef.current[key] = false; // reset on RESET / re-arm
      }
    };
    triggerOnDisch("A1", agent1Disch);
    triggerOnDisch("A2", agent2Disch);

    // MOMENTARY spray press on the whole button rig: sink in along the face
    // normal (rig's parent-local Y → the scene's into-screen Z) AND shrink
    // uniformly about the button centre, then spring back to rest. Head-on the
    // inward travel is foreshortened to nearly nothing, so the uniform shrink is
    // what actually makes the recede-and-return visible; because the cap and its
    // SQUIB/DISCH legend are one rig, they stay aligned (no vanishing legend).
    const animateRig = (rig: typeof agentRigs.A1, key: "A1" | "A2", armed: boolean, stepId: string) => {
      if (!rig) return;
      const elapsed = pressRef.current[key] ? Date.now() - pressRef.current[key] : Infinity;
      const p = pressOverride ?? pressCurve(elapsed); // 0 = rest, 1 = fully pressed in
      // Shrink ONLY in the panel plane (local X/Z); keep depth (local Y) at 1.
      // The white legend floats a hair (~0.0002) in front of the black cap, so a
      // uniform shrink would pull it back into the cap and z-fight it away. An
      // in-plane shrink keeps that gap exactly and still reads as a recede.
      const f = 1 - (agentShrink ?? PRESS_SHRINK) * p;
      rig.group.scale.set(f, 1, f);
      rig.group.position.y = rig.restPos.y - PRESS_DEPTH * p;
      // Press-darken: as the cap sinks in (p>0) it recedes into shadow → darker;
      // at rest (p=0) it is the full cap colour; the overshoot (p<0) leaves it at
      // rest colour. Cap base colour is live-tunable (agentCapLight 0–100) so the
      // button can be made more obvious against the recess. Legend is separate.
      const capBase = agentCapLight != null
        ? new THREE.Color().setHSL(0.58, 0.12, Math.max(0, Math.min(1, agentCapLight / 100)))
        : AGENT_CAP_COLOR;
      const capMat = getMat(rig.cap) as THREE.MeshStandardMaterial;
      if (capMat.color) capMat.color.copy(capBase).multiplyScalar(1 - PRESS_DARKEN * Math.max(p, 0));
      // The CAP body must NEVER illuminate. Only the SQUIB/DISCH legend WINDOWS
      // indicate state (white = armed, amber = discharged). The old "active"
      // white pulse lit the whole cap → read as "the entire button is flashing
      // white", which is wrong. Keep the cap dark at all times.
      void armed; void stepId; void pulse;
      setMaterialLight(rig.cap, C3.off, 0);
    };

    animateRig(agentRigs.A1, "A1", a1Armed, "agent1");
    animateRig(agentRigs.A2, "A2", a2Armed, "agent2");
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

    // Guard: ONLY a closed guard intercepts the click to lift open. Once it's
    // open, its (large, invisible) hitbox swings WITH it and still overlaps the
    // FIRE pb head-on — so checking the guard first would swallow every FIRE pb
    // click (re-opening the already-open guard and returning), and the drill
    // could never advance past the guard. Gate on !guardOpen so an open-guard
    // click falls through to the FIRE pb branch beneath it.
    if (!guardOpen && (has("HIT_ENG1_GUARD") || has(ENG1.guard))) {
      setGuardOpen(true); // lift the guard; the fire itself is triggered by TEST
      return;
    }
    if ((has("HIT_ENG1_FIRE_PB") || has(ENG1.firePb)) && guardOpen && (fireDetected || firePopLive) && !firePbDone) {
      onPushFirePb(); // pops the button out to `firePopOut` (dev: no fire-detect needed)
      return;
    }
    // FREE-PLAY (?free=1): click either AGENT cap to replay the spring instantly,
    // bypassing the guard → FIRE → ~1.5s arm gating. TEMP — judging the animation.
    if (freePlay) {
      if (has("HIT_ENG1_A1") || has(ENG1.agent1)) {
        pressRef.current.A1 = Date.now();
        onPushAgent1?.();
        return;
      }
      if (has("HIT_ENG1_A2") || has(ENG1.agent2)) {
        pressRef.current.A2 = Date.now();
        onPushAgent2?.();
        return;
      }
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
      {/* Studio-style lighting so the panel reads bright + dimensional (the
          flat HDRI-only look was dull). Key from front-upper-right (Blender's
          point-light side), cool fill from the left, ambient lifts shadows. */}
      <ambientLight intensity={0.18} color="#9fb0c4" />
      <directionalLight position={[2.6, 3.2, 4.5]} intensity={2.8} color="#ffffff" />
      <directionalLight position={[-2.4, 1.0, 3.0]} intensity={1.1} color="#cfe0ff" />
      <Suspense fallback={null}>
        {/* The SAME HDRI Blender lights the scene with — gives the metal its
            reflections; the directional lights above add brightness + form. */}
        <Environment files={HDRI_URL} environmentIntensity={1.5} />
        <FireTestPanelScene {...props} />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
