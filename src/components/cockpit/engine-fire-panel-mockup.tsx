"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Airbus A320 Engine Fire Panel — mockup with realistic FCOM behavior modeled.
// View at /mockups/fire-panel in dev.
//
// CANONICAL DESIGN REFERENCE — DO NOT mutate without explicit user direction.
// This file is the single source of truth for the FIRE panel visual style.
// Scenario integrations (e.g. engine-fire-panel-scenario.tsx) import
// `FireSection` from here and apply scale wrappers; other future panels
// (APU, ENG 2) should likewise reuse the components defined here.
//
// Behaviors modeled (FCOM DSC-26-20-20 + PRO-ABN-ENG):
//   1. FIRE pb release — pushing releases mechanically; pb stays OUT.
//   2. FIRE light independent of pb position — red FIRE legend + corner dots
//      lit whenever fire is detected, regardless of pb position.
//   3. 10-second ECAM countdown ("AGENT 1 AFTER 10 S → DISCH") — after FIRE pb
//      release, AGENT pbs are NOT yet armable.  Their SQUIB cell pulses amber
//      for 10 s while N1 decays.  After 10 s, SQUIB goes solid white (armed)
//      and the AGENT pb becomes clickable.
//   4. Discharge gated on FIRE pb release — AGENT 1/2 only fires after FIRE pb
//      release AND the 10-s arming window has elapsed.
//   5. AGENT DISCH amber — once discharged, DISCH cell solid amber.
//   6. Per-section FIRE TEST pb — clicking the TEST pb illuminates ALL fire
//      indications for that section (FIRE legend, corner dots, SQUIB, DISCH).
//      Real cockpit has separate ENG 1, APU, ENG 2 FIRE TEST pbs.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";

// ── Pulse keyframes (amber arming pulse for 10 s ECAM countdown) ────────────
const PULSE_CSS = `
@keyframes agent-arming-pulse {
  0%, 100% { background-color: rgba(255, 179, 0, 0.12); box-shadow: inset 0 0 2px rgba(255,179,0,0.30); }
  50%      { background-color: rgba(255, 179, 0, 0.55); box-shadow: 0 0 6px rgba(255,179,0,0.65); }
}
@keyframes test-pulse {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}
`;

type EngFire = {
  fireDetected: boolean;
  guardOpen:    boolean;         // pilot lifted the wire guard
  firePbOut:    boolean;
  firePbOutAt:  number | null;   // timestamp ms
  agent1Disch:  boolean;
  agent2Disch:  boolean;
  testActive:   boolean;
};
type ApuFire = {
  fireDetected: boolean;
  guardOpen:    boolean;
  firePbOut:    boolean;
  firePbOutAt:  number | null;
  agentDisch:   boolean;
  testActive:   boolean;
};

const ARM_DELAY_MS = 10_000;  // FCOM "AGENT 1 AFTER 10 S → DISCH"

const initEng = (): EngFire => ({ fireDetected: false, guardOpen: false, firePbOut: false, firePbOutAt: null, agent1Disch: false, agent2Disch: false, testActive: false });
const initApu = (): ApuFire => ({ fireDetected: false, guardOpen: false, firePbOut: false, firePbOutAt: null, agentDisch: false, testActive: false });

export default function EngineFirePanel() {
  const [eng1, setEng1] = useState<EngFire>(initEng());
  const [eng2, setEng2] = useState<EngFire>(initEng());
  const [apu,  setApu]  = useState<ApuFire>(initApu());
  // Tick to re-render during the 10-s arming windows so derived state is fresh.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const anyArming =
      (eng1.firePbOutAt && !eng1.agent1Disch && !eng1.agent2Disch) ||
      (eng2.firePbOutAt && !eng2.agent1Disch && !eng2.agent2Disch) ||
      (apu.firePbOutAt  && !apu.agentDisch);
    if (!anyArming) return;
    const t = setInterval(() => forceTick(n => n + 1), 100);
    return () => clearInterval(t);
  }, [eng1.firePbOutAt, eng1.agent1Disch, eng1.agent2Disch, eng2.firePbOutAt, eng2.agent1Disch, eng2.agent2Disch, apu.firePbOutAt, apu.agentDisch]);

  // ── Behaviors ─────────────────────────────────────────────────────────────
  // FCOM two-step: guard is lifted first, THEN the FIRE pb can be pushed.
  const openEngGuard = (n: 1 | 2) => {
    const setter = n === 1 ? setEng1 : setEng2;
    setter(s => s.guardOpen ? s : { ...s, guardOpen: true });
  };
  const openApuGuard = () => setApu(s => s.guardOpen ? s : { ...s, guardOpen: true });

  const pushEngFirePb = (n: 1 | 2) => {
    const setter = n === 1 ? setEng1 : setEng2;
    setter(s => (s.firePbOut || !s.guardOpen) ? s : { ...s, firePbOut: true, firePbOutAt: Date.now() });
  };
  const pushApuFirePb = () => setApu(s => (s.firePbOut || !s.guardOpen) ? s : { ...s, firePbOut: true, firePbOutAt: Date.now() });

  const pushAgent = (engN: 1 | 2, agentN: 1 | 2) => {
    const eng = engN === 1 ? eng1 : eng2;
    const setter = engN === 1 ? setEng1 : setEng2;
    if (!isAgentArmed(eng.firePbOutAt, agentN === 1 ? eng.agent1Disch : eng.agent2Disch)) return;
    setter(s => agentN === 1
      ? (s.agent1Disch ? s : { ...s, agent1Disch: true })
      : (s.agent2Disch ? s : { ...s, agent2Disch: true })
    );
  };
  const pushApuAgent = () => {
    if (!isAgentArmed(apu.firePbOutAt, apu.agentDisch)) return;
    setApu(s => s.agentDisch ? s : { ...s, agentDisch: true });
  };

  const toggleEngTest = (n: 1 | 2) => {
    const setter = n === 1 ? setEng1 : setEng2;
    setter(s => ({ ...s, testActive: !s.testActive }));
  };
  const toggleApuTest = () => setApu(s => ({ ...s, testActive: !s.testActive }));

  const resetAll = () => { setEng1(initEng()); setEng2(initEng()); setApu(initApu()); };

  // ── Demo simulation triggers (drive fireDetected without pushing pb) ─────
  const simFire = (which: "eng1" | "eng2" | "apu") => {
    if (which === "eng1") setEng1(s => ({ ...s, fireDetected: !s.fireDetected }));
    if (which === "eng2") setEng2(s => ({ ...s, fireDetected: !s.fireDetected }));
    if (which === "apu")  setApu (s => ({ ...s, fireDetected: !s.fireDetected }));
  };

  return (
    <div className="w-full min-h-screen bg-[#3f4751] flex flex-col items-center justify-center p-6 gap-4">
      <style>{PULSE_CSS}</style>

      {/* ── DEMO BAR ────────────────────────────────────────────────────── */}
      <DemoBar
        eng1Fire={eng1.fireDetected} eng2Fire={eng2.fireDetected} apuFire={apu.fireDetected}
        onSim={simFire} onReset={resetAll}
      />

      {/* ── FIRE PANEL — ENG 1 | APU | ENG 2 (canonical 3-section layout) ──
          All three sections share the same `FireSection` component, so any
          downstream tweak (SQUIB-visible-after-discharge, guard rotation,
          countdown badge, etc.) propagates to every section automatically.
          Base colour #75B5C5 (lighter desaturated cyan-teal). */}
      <div
        className="relative rounded-xl border shadow-2xl flex"
        style={{
          width:  "1200px",
          height: "420px",
          background: "linear-gradient(to bottom, #75B5C5 0%, #5A98A8 100%)",
          border: "1px solid #1D1818",
          boxShadow: "inset 0 0 25px rgba(0,0,0,0.45), 0 0 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Four corner panel screws */}
        {[[12, 12], [1176, 12], [12, 396], [1176, 396]].map(([x, y], i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              left: x, top: y, width: 12, height: 12,
              background: "radial-gradient(circle at 30% 30%, #c8ced6 0%, #6a7280 60%, #2a303a 100%)",
              boxShadow: "0 1px 1px rgba(0,0,0,0.55)",
              border: "1px solid #2a303a",
            }}
          />
        ))}

        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-gray-200 font-bold"
             style={{ letterSpacing: "6px", fontSize: "20px", fontFamily: "monospace" }}>
          FIRE
        </div>

        {/* ENG 1 — TEST pb sits under AGENT 1 (left) */}
        <FireSection
          title="ENG 1"
          testSide="left"
          fireDetected={eng1.fireDetected}
          guardOpen={eng1.guardOpen}
          firePbOut={eng1.firePbOut}
          firePbOutAt={eng1.firePbOutAt}
          agent1Disch={eng1.agent1Disch}
          agent2Disch={eng1.agent2Disch}
          testActive={eng1.testActive}
          onOpenGuard={() => openEngGuard(1)}
          onPushFirePb={() => pushEngFirePb(1)}
          onPushAgent1={() => pushAgent(1, 1)}
          onPushAgent2={() => pushAgent(1, 2)}
          onPushTest={() => toggleEngTest(1)}
        />

        {/* APU — single AGENT, TEST pb centred under it */}
        <FireSection
          title="APU"
          isAPU
          testSide="center"
          fireDetected={apu.fireDetected}
          guardOpen={apu.guardOpen}
          firePbOut={apu.firePbOut}
          firePbOutAt={apu.firePbOutAt}
          agent1Disch={apu.agentDisch}
          agent2Disch={false}
          testActive={apu.testActive}
          onOpenGuard={openApuGuard}
          onPushFirePb={pushApuFirePb}
          onPushAgent1={pushApuAgent}
          onPushAgent2={() => { /* APU has only one bottle */ }}
          onPushTest={toggleApuTest}
        />

        {/* ENG 2 — TEST pb sits under AGENT 2 (right) */}
        <FireSection
          title="ENG 2"
          testSide="right"
          fireDetected={eng2.fireDetected}
          guardOpen={eng2.guardOpen}
          firePbOut={eng2.firePbOut}
          firePbOutAt={eng2.firePbOutAt}
          agent1Disch={eng2.agent1Disch}
          agent2Disch={eng2.agent2Disch}
          testActive={eng2.testActive}
          onOpenGuard={() => openEngGuard(2)}
          onPushFirePb={() => pushEngFirePb(2)}
          onPushAgent1={() => pushAgent(2, 1)}
          onPushAgent2={() => pushAgent(2, 2)}
          onPushTest={() => toggleEngTest(2)}
        />
      </div>
    </div>
  );
}

// Helper — is an AGENT pb armed (10 s elapsed since FIRE pb release & not yet fired)
function isAgentArmed(firePbOutAt: number | null, agentDisch: boolean): boolean {
  if (!firePbOutAt || agentDisch) return false;
  return Date.now() - firePbOutAt >= ARM_DELAY_MS;
}
function isAgentArming(firePbOutAt: number | null, agentDisch: boolean): boolean {
  if (!firePbOutAt || agentDisch) return false;
  return Date.now() - firePbOutAt < ARM_DELAY_MS;
}
function armingCountdownSec(firePbOutAt: number | null): number {
  if (!firePbOutAt) return 0;
  return Math.max(0, Math.ceil((ARM_DELAY_MS - (Date.now() - firePbOutAt)) / 1000));
}

// ─── DEMO control bar ────────────────────────────────────────────────────────
function DemoBar({
  eng1Fire, eng2Fire, apuFire, onSim, onReset,
}: {
  eng1Fire: boolean; eng2Fire: boolean; apuFire: boolean;
  onSim: (w: "eng1" | "eng2" | "apu") => void;
  onReset: () => void;
}) {
  const btn = (label: string, on: boolean, click: () => void, accent: string) => (
    <button onClick={click}
      style={{
        padding: "6px 12px",
        backgroundColor: on ? accent : "transparent",
        border: `1px solid ${on ? accent : "#5a6470"}`,
        color: on ? "#0a0e16" : "#c8ced6",
        fontSize: "11px", fontFamily: "monospace", fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase",
        borderRadius: "3px", cursor: "pointer", transition: "all 0.15s",
      }}>
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded"
         style={{ backgroundColor: "#2a303a", border: "1px solid #4a5260" }}>
      <span style={{ color: "#9aa1ac", fontSize: "10px", fontFamily: "monospace", letterSpacing: "0.2em", marginRight: "8px" }}>
        DEMO ▸
      </span>
      {btn("Sim ENG 1 Fire", eng1Fire, () => onSim("eng1"), "#FF3333")}
      {btn("Sim APU Fire",   apuFire,  () => onSim("apu"),  "#FF3333")}
      {btn("Sim ENG 2 Fire", eng2Fire, () => onSim("eng2"), "#FF3333")}
      <div style={{ width: "1px", height: "24px", backgroundColor: "#4a5260", margin: "0 4px" }} />
      {btn("RESET", false, onReset, "#9aa1ac")}
      <span style={{ color: "#5a6470", fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.1em" }}>
        — TEST pbs are on each section
      </span>
    </div>
  );
}

// ─── FIRE section (one engine or APU) ────────────────────────────────────────
export function FireSection({
  title, isAPU = false, testSide = "center",
  fireDetected, guardOpen, firePbOut, firePbOutAt,
  agent1Disch, agent2Disch, testActive,
  onOpenGuard, onPushFirePb, onPushAgent1, onPushAgent2, onPushTest,
}: {
  title: string; isAPU?: boolean;
  testSide?: "left" | "center" | "right";
  fireDetected: boolean;
  guardOpen:    boolean;
  firePbOut: boolean;
  firePbOutAt: number | null;
  agent1Disch: boolean;
  agent2Disch: boolean;
  testActive: boolean;
  onOpenGuard:  () => void;
  onPushFirePb: () => void;
  onPushAgent1: () => void;
  onPushAgent2: () => void;
  onPushTest:   () => void;
}) {
  const fireLightLit = fireDetected || testActive;

  // AGENT 1 / 2 derived state
  const a1Arming = isAgentArming(firePbOutAt, agent1Disch);
  const a1Armed  = isAgentArmed (firePbOutAt, agent1Disch);
  const a2Arming = isAgentArming(firePbOutAt, agent2Disch);
  const a2Armed  = isAgentArmed (firePbOutAt, agent2Disch);
  const countdown = a1Arming || a2Arming ? armingCountdownSec(firePbOutAt) : 0;

  return (
    <div className="relative h-full" style={{ flex: isAPU ? "0 0 320px" : "1 1 0", minWidth: 0 }}>
      <div className="absolute left-1/2 -translate-x-1/2 text-gray-100"
           style={{
             // Dropped down so the "ENG 1" title sits just below the top
             // of the AGENT pbs (~10 % below their starting y = 100).
             // Font 50 % larger per user request: 16 → 24 px.
             top: 105,
             letterSpacing: "3px", fontSize: "24px",
             fontFamily: "monospace", fontWeight: 700,
           }}>
        {title}
      </div>

      {/* FCOM DSC-26-20-20:
          – TEST illuminates SQUIB (white) + DISCH (amber) on every
            AGENT pb of the section.  Both stay visible during TEST.
          – Normal operation: FIRE pb released → SQUIB white on both
            AGENTs; press an AGENT → that AGENT's SQUIB DISAPPEARS,
            its DISCH lights amber.
          `actuallyDisch` carries the real discharge state (no TEST
          overlay) so the SquibCell can hide its letters only after a
          real AGENT press, not during TEST. */}
      {!isAPU && (
        <>
          <AgentPanel side="left"  agentNum={1}
            arming={a1Arming}
            armed={firePbOut || testActive}
            discharged={agent1Disch || testActive}
            actuallyDisch={agent1Disch}
            clickable={a1Armed} onPush={onPushAgent1} />
          <AgentPanel side="right" agentNum={2}
            arming={a2Arming}
            armed={firePbOut || testActive}
            discharged={agent2Disch || testActive}
            actuallyDisch={agent2Disch}
            clickable={a2Armed} onPush={onPushAgent2} />
        </>
      )}
      {isAPU && (
        <AgentPanel side="left" agentNum={1} apuStyle
          arming={a1Arming}
          armed={firePbOut || testActive}
          discharged={agent1Disch || testActive}
          actuallyDisch={agent1Disch}
          clickable={a1Armed} onPush={onPushAgent1} />
      )}

      <FirePushbutton
        fireLightLit={fireLightLit}
        firePbOut={firePbOut}
        guardOpen={guardOpen}
        onOpenGuard={onOpenGuard}
        onPush={onPushFirePb}
      />

      {/* TEST pb — positioned under AGENT 1 (left) / AGENT 2 (right) /
          center (APU) per testSide.  Clickable, illuminates all fire
          indications for the section. */}
      {(() => {
        // AGENT pbs are 50 px wide and now sit at left:84 / right:84;
        // their centres land at 84 + 25 = 109 px from the section edge.
        // TEST is 32 px wide → left/right edge sits at 109 − 16 = 93 px
        // so it stays centred under the AGENT pb above it.
        const horizontalStyle: React.CSSProperties =
          testSide === "left"  ? { left: 93 } :
          testSide === "right" ? { right: 93 } :
                                 { left: "50%", transform: "translateX(-50%)" };
        const labelHorizontalStyle: React.CSSProperties =
          testSide === "left"  ? { left: 93 + 16, transform: "translateX(-50%)" } :
          testSide === "right" ? { right: 93 + 16, transform: "translateX(50%)" } :
                                 { left: "50%", transform: "translateX(-50%)" };
        return (
          <>
            {/* TEST label sits ABOVE the button now (per user order:
                "TEST written, then below that, the test push button"). */}
            <div className="absolute text-gray-300"
                 style={{
                   ...labelHorizontalStyle,
                   bottom: 196, fontSize: "11px", letterSpacing: "0.14em",
                   fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: 700,
                 }}>
              TEST
            </div>
            <button
              onClick={onPushTest}
              className="absolute rounded-full"
              style={{
                ...horizontalStyle,
                // TEST button shrunk 20 % (32 → 26).  Black with a small
                // white centre dot; never illuminates.  Sits ~5 px below
                // the "TEST" label and ends ~3 px before the FIRE pb's
                // bottom edge (≈ y 253).
                bottom: 171, width: 26, height: 26,
                padding: 0,
                background: "#000000",
                border: "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="FIRE TEST — illuminate all fire indications"
            >
              <div style={{
                width: 6, height: 6,
                background: "#FFFFFF",
                borderRadius: "50%",
                pointerEvents: "none",
              }} />
            </button>
          </>
        );
      })()}

      {/* Countdown badge — visible during the 10-s ECAM arming window */}
      {countdown > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2"
             style={{
               bottom: 60,
               padding: "3px 8px",
               backgroundColor: "rgba(255,179,0,0.15)",
               border: "1px solid rgba(255,179,0,0.55)",
               borderRadius: "2px",
               fontSize: "9px", fontFamily: "monospace", fontWeight: 800,
               color: "#FFB300", letterSpacing: "0.1em",
               animation: "test-pulse 1s ease-in-out infinite",
             }}>
          AGENT IN {countdown}S
        </div>
      )}

      {!isAPU && (
        <>
          {/* White vertical bar — height kept at 80 (previous value). */}
          <div className="absolute select-none"
               style={{
                 left: 44,
                 top: 145,
                 width: 4,
                 height: 80,
                 background: "#FFFFFF",
               }} />
          {/* "FIRE" — fontSize 16 keeps the actual rendered glyph stack
              (≈ 4 × 16 × 1.15 ≈ 74 px with monospace ascent/descent)
              comfortably WITHIN the bar's 80-px span.  Centred so F top
              and E bottom both sit inside the bar. */}
          <div className="absolute select-none"
               style={{
                 left: 47,
                 top: 148,
                 color: "#FFFFFF",
                 writingMode: "vertical-lr",
                 textOrientation: "upright",
                 letterSpacing: "0px", fontSize: "16px",
                 lineHeight: 1,
                 fontFamily: "monospace", fontWeight: 700,
               }}>
            FIRE
          </div>
        </>
      )}
    </div>
  );
}

// ─── GuardCover ──────────────────────────────────────────────────────────────
// Transparent acrylic guard cover that sits ABOVE the FIRE pb.  NOT the FIRE
// pb itself — the button must stay visible underneath.  Hinged at the top
// edge; lifts -105° when `lifted` is true (open/close animation).
//
// Layer hierarchy (per Figma spec):
//   GuardCover
//   ├── OUTER_GUARD       (symmetric trapezoid + thumb-grip tab)
//   ├── INNER_GUARD       (110 × 55 acrylic pane border)
//   ├── OVAL_GAP          (small slot in the lower tab area)
//   ├── GLASS_HIGHLIGHT   (top reflection line)
//   └── SHADOW            (n/a yet — kept here for future use)
//
// OVAL_GAP is a separate <ellipse> sibling so it rotates with the rest of
// the guard during the lift animation; it is NOT merged into the path.
// NEW OUTER — Figma trace with two small softenings:
//   – Top corners: 2.5 px Q curves
//   – Bottom tab tip: H62 → Q68.75 113.5 62 111.5 — gentle downward arc
//     across the flat tab base so the very bottom reads as curvy
const GUARD_OUTER_PATH =
  "M0.5 88.5V3Q0.5 0.5 3 0.5H131Q133.5 0.5 134 3L134.5 88.5H95.5L75.5 111.5Q68.75 113.5 62 111.5L59.5 109L50 98.5L41.5 88.5H0.5Z";

// OVEAL GAP — traced ellipse, 14 × 7 (rx 7, ry 3.5).  Centred on the
// tab's horizontal midline (x = 67.5) and vertically halfway between the
// main-rect bottom at y = 88.5 and the tab tip at y = 111.5.
const OVAL_GAP_CX = 67.5;
const OVAL_GAP_CY = 100;
const OVAL_GAP_RX = 7;
const OVAL_GAP_RY = 3.5;

// JOINT — hinge bar at the top of the guard.  Reduced 20 % from the
// original 67 × 17.5 trace per user request.
//   width  67   → 54         (20 % smaller)
//   height 17.5 → 14         (20 % smaller)
//   x range:  40.5 → 94.5    (centred on x = 67.5)
//   y range:  0.5  → 14.5
//   pivot:    (67.5, 7.5)    — centre of the smaller JOINT bar
const JOINT_X = 40.5;
const JOINT_Y = 0.5;
const JOINT_W = 54;
const JOINT_H = 14;
const JOINT_STROKE = "#1D1818";
const PIVOT_X_PX = 67.5;          // half the guard width — equals JOINT_X + JOINT_W/2
// Pivot at the TOP edge of the JOINT (= top of the guard) so the whole
// guard swings UP cleanly — none of it rotates downward beneath the
// pivot, which is what was happening when the pivot was at the JOINT's
// centre (y 7.5).
const PIVOT_Y_PX = JOINT_Y;       // 0.5 — top edge of JOINT

function GuardCover({ lifted }: { lifted: boolean }) {
  // Wrapper sits over the FIRE pb.  Inside:
  //   1. a ROTATING sub-container holding OUTER / INNER / OVAL / HIGHLIGHT
  //      that pivots around the JOINT centreline when `lifted` is true
  //   2. a STATIC JOINT overlay that never moves — it's the hinge mechanism
  //      bolted to the panel, so the guard rotates around it.
  return (
    <div
      style={{
        position: "absolute",
        top: -2,
        left: -5,
        width: 135,
        height: 112,
        // Strong perspective so the lift reads as a real hinged door
        // opening (angular swing, not a translate-up slide).
        perspective: "300px",
        pointerEvents: "none",
      }}
    >
      {/* Rotating sub-container — pivots around the JOINT top edge like
          a hinged door.  0° = closed, -120° = open (per user spec).
          `backfaceVisibility: visible` so the guard does NOT disappear
          past -90° (the back of the panel becomes the visible side). */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 135,
          height: 112,
          transformOrigin: `${PIVOT_X_PX}px ${PIVOT_Y_PX}px`,
          transform: lifted
            ? "rotateX(-120deg) translateZ(0)"
            : "rotateX(0deg) translateZ(0)",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          backfaceVisibility: "visible",
        }}
      >
      <svg
        width="135"
        height="112"
        viewBox="0 0 135 112"
        fill="none"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Guard frame fill — outer ⊖ inner ⊖ oval (evenodd).  The oval
            is added as a third sub-path so it cuts a real hole through
            the guard fill — the panel background shows through it. */}
        <path
          d={`${GUARD_OUTER_PATH} M12 17 H122 V83 H12 Z M60.5 100 a 7 3.5 0 1 0 14 0 a 7 3.5 0 1 0 -14 0`}
          fillRule="evenodd"
          fill="rgba(174, 56, 22, 0.92)"
        />
        {/* Outer guard frame — #AE3816 stroke (per user spec). */}
        <path
          d={GUARD_OUTER_PATH}
          fill="none"
          stroke="#AE3816"
          strokeWidth="1.5"
        />
        {/* Inner acrylic-pane border — dark-red stroke, thinner.
            Height bumped 55 → 66 (+20 %) per user spec. */}
        <rect
          x="12" y="17"
          width="110" height="66"
          fill="none"
          stroke="rgba(92, 10, 10, 0.95)"
          strokeWidth="0.75"
        />
        {/* OVEAL GAP — fill is cut from the guard frame (above) so the
            panel background shows through.  We keep just a thin outline
            here to silhouette the cutout. */}
        <ellipse
          cx={OVAL_GAP_CX}
          cy={OVAL_GAP_CY}
          rx={OVAL_GAP_RX}
          ry={OVAL_GAP_RY}
          fill="none"
          stroke={JOINT_STROKE}
          strokeWidth="1"
        />
        {/* Top reflection highlight — soft red-tinted highlight for the
            "transparent dark-red acrylic" look */}
        <line
          x1="10" y1="8" x2="124" y2="8"
          stroke="rgba(255,160,160,0.28)"
          strokeWidth="1"
        />
      </svg>
      </div>

      {/* JOINT — STATIC hinge bar, separate from the rotating sub-container.
          Does NOT rotate; the guard above rotates around its centreline. */}
      <svg
        width="135"
        height="112"
        viewBox="0 0 135 112"
        fill="none"
        style={{
          position: "absolute",
          top: 0, left: 0,
          display: "block",
          overflow: "visible",
        }}
      >
        {/* Outer JOINT — dark frame (#1D1818) */}
        <rect
          x={JOINT_X}
          y={JOINT_Y}
          width={JOINT_W}
          height={JOINT_H}
          fill={JOINT_STROKE}
          stroke={JOINT_STROKE}
          strokeWidth="1"
        />
        {/* Inner JOINT mechanism — 80 % size of outer JOINT, light-gray
            fill (#A8A7A6) per user spec.  Represents the visible metal
            hinge mechanism inside the dark frame. */}
        <rect
          x={JOINT_X + JOINT_W * 0.1}
          y={JOINT_Y + JOINT_H * 0.1}
          width={JOINT_W * 0.8}
          height={JOINT_H * 0.8}
          fill="#A8A7A6"
        />
      </svg>
    </div>
  );
}

// ─── ENG 1(2) FIRE pushbutton ────────────────────────────────────────────────
function FirePushbutton({
  fireLightLit, firePbOut, guardOpen, onOpenGuard, onPush,
}: {
  fireLightLit: boolean;
  firePbOut:    boolean;
  guardOpen:    boolean;
  onOpenGuard:  () => void;
  onPush:       () => void;
}) {
  // PLAN v3 mirrored from fire-panel.tsx + new-spec deltas:
  //   – LANDSCAPE shape 144 × 108 (was portrait 130 × 168)
  //   – TWO distinct body colours per FCOM convention: orange-red at rest,
  //     BRIGHT PURE RED when the FIRE warning is active.
  //   – Wire guard now ANIMATES — rotates -105° when the pilot has opened
  //     the guard (guardOpen), or once the pb has been pushed (firePbOut).
  //   – `perspective` on the button so the rotateX lift renders in 3-D.
  const guardLifted = guardOpen || firePbOut;
  return (
    <button
      // Two-step FCOM action: tap the guard to lift it first, then tap
      // the pb face to release.  Once the pb is OUT, clicks are ignored.
      onClick={() => {
        if (firePbOut) return;
        if (!guardOpen) {
          onOpenGuard();
        } else {
          onPush();
        }
      }}
      className="absolute left-1/2 top-1/2"
      style={{
        transform: `translate(-50%, calc(-61% + ${firePbOut ? "-4px" : "0px"}))`,
        // Per Figma trace: FIRE pb is 131 × 87 (sits inside the 135 × 112
        // outer guard with 2 px margin around it).  Slightly rounder
        // corners (6 → 10) for a softer minimalistic look.
        width: 131, height: 87, borderRadius: 10, padding: 0,
        // FCOM-faithful: pb face lights bright red when fire warning is
        // active (fireDetected) or TEST is pressed.  Dusky burgundy at
        // rest.  Halo glow + white text on activation.
        background: fireLightLit
          ? "linear-gradient(180deg, #FF2828 0%, #E81010 50%, #C80000 100%)"
          : "linear-gradient(180deg, #A85A55 0%, #9A4E49 50%, #7A3835 100%)",
        border: fireLightLit ? "4px solid #FF6060" : "4px solid #5A2A28",
        boxShadow: fireLightLit
          ? "0 0 36px rgba(255,30,30,0.95), inset 0 0 18px rgba(255,80,80,0.45), inset 0 -8px 16px rgba(0,0,0,0.65)"
          : firePbOut
            ? "inset 0 1px 0 rgba(255,220,210,0.35), inset 0 -3px 6px rgba(0,0,0,0.25), 0 6px 10px rgba(0,0,0,0.7)"
            : "inset 0 1px 0 rgba(255,220,210,0.35), inset 0 -3px 6px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.55)",
        cursor: firePbOut ? "default" : "pointer",
        transition: "all 0.25s ease",
        position: "absolute",
        perspective: "320px",        // gives the rotateX guard lift real 3-D depth
      }}
      disabled={firePbOut}
    >
      {/* Guard cover — separate component, exact Figma-traced geometry.
          See GuardCover above for path data + layer order. */}
      <GuardCover lifted={guardLifted} />

      {/* Hinge-knuckle dots removed per user request — guard pivots around
          the JOINT bar inside the GuardCover, no separate knuckle dots
          needed at the pb corners. */}

      {/* Amber "OUT" indicator dot — when pb has been pushed AND no fire
          warning is active (mechanically out, ready for next event). */}
      {firePbOut && !fireLightLit && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          width: 8, height: 8, borderRadius: "50%",
          background: "#FFB300",
          boxShadow: "0 0 6px rgba(255,179,0,0.85)",
        }} />
      )}

      {/* "FIRE" / "PUSH" — dark red at rest, pure white + red glow when
          fire warning is active (fireDetected) or TEST is pressed. */}
      <div style={{
        position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)",
        fontSize: 22, fontFamily: '"Helvetica Neue", Arial, sans-serif',
        fontWeight: 800, letterSpacing: "0.06em",
        color: fireLightLit ? "#ffffff" : "#5A0808",
        textShadow: fireLightLit ? "0 0 14px rgba(255,80,80,0.9), 0 0 4px #fff" : "none",
        transition: "color 0.2s, text-shadow 0.2s",
      }}>FIRE</div>

      <div style={{
        position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
        fontSize: 11, fontFamily: '"Helvetica Neue", Arial, sans-serif',
        fontWeight: 700, letterSpacing: "0.14em",
        color: fireLightLit ? "#ffffff" : "#5A0808",
        textShadow: fireLightLit ? "0 0 10px rgba(255,80,80,0.9)" : "none",
        transition: "color 0.2s",
      }}>PUSH</div>

      {/* Four corner red FIRE indicator dots — visible when the pb
          face is lit (fire warning or TEST). */}
      {fireLightLit && (
        <>
          {[
            { top: 6, left: 6 },
            { top: 6, right: 6 },
            { bottom: 6, left: 6 },
            { bottom: 6, right: 6 },
          ].map((pos, i) => (
            <div key={i} style={{
              position: "absolute", ...pos,
              width: 6, height: 6, borderRadius: "50%",
              background: "#ff4040",
              boxShadow: "0 0 8px rgba(255,80,80,0.95)",
            }} />
          ))}
        </>
      )}
    </button>
  );
}

// ─── AGENT 1(2) pb-sw ────────────────────────────────────────────────────────
function AgentPanel({
  side, agentNum, arming, armed, discharged, actuallyDisch, clickable, onPush, apuStyle = false,
}: {
  side: "left" | "right";
  agentNum: 1 | 2;
  arming:     boolean;   // FIRE pb pushed but 10-s window not elapsed
  armed:      boolean;   // SQUIB armed (firePbOut OR testActive)
  discharged: boolean;   // DISCH amber (agentDisch OR testActive)
  actuallyDisch: boolean;// TRUE only when the AGENT pb has actually been pressed
                         // (NOT when discharged comes from TEST overlay).
                         // Used to hide SQUIB letters per FCOM sequence.
  clickable:  boolean;
  onPush:     () => void;
  apuStyle?:  boolean;
}) {
  const sideStyle: React.CSSProperties = {
    // AGENT block pushed down 20 % more (100 → 120) per user request.
    top: 112,
    // Inset 84 px from each section edge (~40 % closer to FIRE pb).
    [side === "left" ? "left" : "right"]: apuStyle ? "50%" : 84,
    ...(apuStyle ? { transform: "translateX(-50%)" } : {}),
  };

  return (
    <div className="absolute" style={sideStyle}>
      <div className="text-gray-200"
           style={{ fontSize: 11, letterSpacing: "0.08em",
                    fontFamily: '"Helvetica Neue", Arial, sans-serif',
                    fontWeight: 700, textAlign: "center",
                    marginBottom: 2 }}>
        AGENT {apuStyle ? "" : agentNum}
      </div>

      <button
        onClick={clickable ? onPush : undefined}
        disabled={!clickable}
        style={{
          // PLAN v3 mirror: rounded ~4 px (was 3), inset recess shadow on all
          // states so the cells look INSIDE the bezel.
          // Shrunk so the FIRE pb dominates proportionally per the photo.
          // FIRE pb is 131 wide; AGENT pbs are now ~38 % of that.
          width: 50, height: 56, padding: 3,
          background: "#1e2430",
          // Black AGENT pb body; only the SQUIB / DISCH letters inside
          // light up.  Outer halo: dark "shadow ring" between the pb
          // body and the white outline so the gap reads as inset, not
          // panel-coloured.  Outline 2 px (was 1.5, +20 %).
          border: "1.5px solid #3a4252",
          borderRadius: 4,
          outline: "2px solid #FFFFFF",
          outlineOffset: "3px",
          boxShadow:
            "inset 0 0 4px rgba(0,0,0,0.55), " +     // recess (interior)
            "0 0 0 3px #6E9292, " +                   // darker shade of the panel cyan (a touch darker than #82A6A6) — fills the gap
            "0 2px 4px rgba(0,0,0,0.40)",             // soft drop shadow
          display: "flex", flexDirection: "column", gap: 2,
          cursor: clickable ? "pointer" : "default",
          transition: "all 0.2s",
        }}
      >
        {/* SQUIB cell — pulses amber during arming, solid white when armed */}
        <SquibCell
          arming={arming && !armed && !actuallyDisch}
          armed={armed && !actuallyDisch}
          discharged={actuallyDisch}
        />
        {/* DISCH cell — solid amber when discharged */}
        <Indicator label="DISCH" lit={discharged} color="amber" />
      </button>
    </div>
  );
}

function SquibCell({ arming, armed, discharged }: { arming: boolean; armed: boolean; discharged: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#06080c",
        animation: arming ? "agent-arming-pulse 1s ease-in-out infinite" : undefined,
        borderRadius: 3,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: 800,
        letterSpacing: "0.06em",
        // After the AGENT pb is pressed (discharged), SQUIB stays visible
        // but dimmed — readable without competing with the lit DISCH amber.
        // Per user spec (not the original FCOM "hidden" behaviour).
        color: discharged ? "#3a4252" : armed ? "#e8ecf4" : arming ? "#FFB300" : "#3a4252",
        textShadow: !discharged && armed
          ? "0 0 4px #e8ecf4"
          : !discharged && arming
            ? "0 0 3px rgba(255,179,0,0.7)"
            : "none",
        transition: "color 0.2s",
      }}
    >
      SQUIB
    </div>
  );
}

function Indicator({ label, lit, color }: { label: string; lit: boolean; color: "white" | "amber" }) {
  const litFg = color === "white" ? "#e8ecf4"               : "#ffb300";
  return (
    <div
      style={{
        flex: 1,
        // Background stays dark in all states — per user spec, only the
        // DISCH text lights up (amber), not the surrounding cell.
        background: "#06080c",
        borderRadius: 3,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: 800,
        letterSpacing: "0.08em",
        color: lit ? litFg : "#3a4252",
        textShadow: lit ? `0 0 4px ${litFg}` : "none",
        transition: "all 0.2s",
      }}
    >
      {label}
    </div>
  );
}
