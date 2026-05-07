"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Airbus A320 Engine Fire Panel — mockup with realistic FCOM behavior modeled.
// View at /mockups/fire-panel in dev.
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
  firePbOut:    boolean;
  firePbOutAt:  number | null;   // timestamp ms
  agent1Disch:  boolean;
  agent2Disch:  boolean;
  testActive:   boolean;
};
type ApuFire = {
  fireDetected: boolean;
  firePbOut:    boolean;
  firePbOutAt:  number | null;
  agentDisch:   boolean;
  testActive:   boolean;
};

const ARM_DELAY_MS = 10_000;  // FCOM "AGENT 1 AFTER 10 S → DISCH"

const initEng = (): EngFire => ({ fireDetected: false, firePbOut: false, firePbOutAt: null, agent1Disch: false, agent2Disch: false, testActive: false });
const initApu = (): ApuFire => ({ fireDetected: false, firePbOut: false, firePbOutAt: null, agentDisch: false, testActive: false });

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
  const pushEngFirePb = (n: 1 | 2) => {
    const setter = n === 1 ? setEng1 : setEng2;
    setter(s => s.firePbOut ? s : { ...s, firePbOut: true, firePbOutAt: Date.now() });
  };
  const pushApuFirePb = () => setApu(s => s.firePbOut ? s : { ...s, firePbOut: true, firePbOutAt: Date.now() });

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

      {/* ── FIRE PANEL ──────────────────────────────────────────────────── */}
      <div
        className="relative rounded-xl border border-gray-500 shadow-2xl flex"
        style={{
          width: "1400px",
          height: "420px",
          background: "linear-gradient(to bottom, #5d6672 0%, #434b55 100%)",
          boxShadow: "inset 0 0 25px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.5)",
        }}
      >
        {[[12, 12], [1376, 12], [12, 396], [1376, 396]].map(([x, y], i) => (
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

        <FireSection
          title="ENG 1"
          fireDetected={eng1.fireDetected}
          firePbOut={eng1.firePbOut}
          firePbOutAt={eng1.firePbOutAt}
          agent1Disch={eng1.agent1Disch}
          agent2Disch={eng1.agent2Disch}
          testActive={eng1.testActive}
          onPushFirePb={() => pushEngFirePb(1)}
          onPushAgent1={() => pushAgent(1, 1)}
          onPushAgent2={() => pushAgent(1, 2)}
          onPushTest={() => toggleEngTest(1)}
        />
        <FireSection
          title="APU"
          isAPU
          fireDetected={apu.fireDetected}
          firePbOut={apu.firePbOut}
          firePbOutAt={apu.firePbOutAt}
          agent1Disch={apu.agentDisch}
          agent2Disch={false}
          testActive={apu.testActive}
          onPushFirePb={pushApuFirePb}
          onPushAgent1={pushApuAgent}
          onPushAgent2={() => {}}
          onPushTest={toggleApuTest}
        />
        <FireSection
          title="ENG 2"
          fireDetected={eng2.fireDetected}
          firePbOut={eng2.firePbOut}
          firePbOutAt={eng2.firePbOutAt}
          agent1Disch={eng2.agent1Disch}
          agent2Disch={eng2.agent2Disch}
          testActive={eng2.testActive}
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
function FireSection({
  title, isAPU = false,
  fireDetected, firePbOut, firePbOutAt,
  agent1Disch, agent2Disch, testActive,
  onPushFirePb, onPushAgent1, onPushAgent2, onPushTest,
}: {
  title: string; isAPU?: boolean;
  fireDetected: boolean;
  firePbOut: boolean;
  firePbOutAt: number | null;
  agent1Disch: boolean;
  agent2Disch: boolean;
  testActive: boolean;
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
      <div className="absolute top-10 left-1/2 -translate-x-1/2 text-gray-100"
           style={{ letterSpacing: "3px", fontSize: "16px", fontFamily: "monospace", fontWeight: 700 }}>
        {title}
      </div>

      {!isAPU && (
        <>
          <AgentPanel side="left"  agentNum={1}
            arming={a1Arming} armed={a1Armed || testActive} discharged={agent1Disch || testActive}
            clickable={a1Armed} onPush={onPushAgent1} />
          <AgentPanel side="right" agentNum={2}
            arming={a2Arming} armed={a2Armed || testActive} discharged={agent2Disch || testActive}
            clickable={a2Armed} onPush={onPushAgent2} />
        </>
      )}
      {isAPU && (
        <AgentPanel side="left" agentNum={1} apuStyle
          arming={a1Arming} armed={a1Armed || testActive} discharged={agent1Disch || testActive}
          clickable={a1Armed} onPush={onPushAgent1} />
      )}

      <FirePushbutton fireLightLit={fireLightLit} firePbOut={firePbOut} onPush={onPushFirePb} />

      {/* TEST pb — clickable, illuminates all fire indications for this section */}
      <button
        onClick={onPushTest}
        className="absolute left-1/2 -translate-x-1/2 rounded-full border border-gray-400"
        style={{
          bottom: 110, width: 44, height: 44,
          padding: 0,
          background: testActive
            ? "radial-gradient(circle at 30% 30%, #ffd980 0%, #cc7a00 50%, #663d00 100%)"
            : "radial-gradient(circle at 30% 30%, #9aa4af 0%, #4a525c 50%, #20262e 100%)",
          boxShadow: testActive
            ? "0 0 16px rgba(255,179,0,0.7), inset 0 0 8px rgba(255,255,255,0.25)"
            : "inset 0 0 8px rgba(255,255,255,0.15), inset 0 -5px 10px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.5)",
          cursor: "pointer", transition: "all 0.2s",
        }}
        title="FIRE TEST — illuminate all fire indications"
      />
      <div className="absolute left-1/2 -translate-x-1/2 text-gray-300"
           style={{ bottom: 88, fontSize: "11px", letterSpacing: "2px", fontFamily: "monospace", fontWeight: 700 }}>
        TEST
      </div>

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
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 select-none"
               style={{
                 transform: "translateY(-50%) rotate(-90deg)",
                 transformOrigin: "left center",
                 letterSpacing: "8px", fontSize: "16px", fontFamily: "monospace", fontWeight: 700,
               }}>
            FIRE
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 select-none"
               style={{
                 transform: "translateY(-50%) rotate(90deg)",
                 transformOrigin: "right center",
                 letterSpacing: "8px", fontSize: "16px", fontFamily: "monospace", fontWeight: 700,
               }}>
            FIRE
          </div>
        </>
      )}
    </div>
  );
}

// ─── ENG 1(2) FIRE pushbutton ────────────────────────────────────────────────
function FirePushbutton({
  fireLightLit, firePbOut, onPush,
}: {
  fireLightLit: boolean; firePbOut: boolean; onPush: () => void;
}) {
  return (
    <button
      onClick={onPush}
      className="absolute left-1/2 top-1/2"
      style={{
        transform: `translate(-50%, calc(-50% + ${firePbOut ? "-4px" : "0px"}))`,
        width: 130, height: 168, borderRadius: 6, padding: 0,
        background: fireLightLit
          ? "linear-gradient(to bottom, #ff4040 0%, #b80000 50%, #6a0000 100%)"
          : "linear-gradient(to bottom, #6b737d 0%, #424952 50%, #20262e 100%)",
        border: fireLightLit ? "3px solid #ff8080" : "3px solid #232932",
        boxShadow: fireLightLit
          ? "0 0 36px rgba(255,40,40,0.85), inset 0 0 18px rgba(255,255,255,0.25), inset 0 -8px 14px rgba(0,0,0,0.55)"
          : firePbOut
            ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -10px 18px rgba(0,0,0,0.65), 0 6px 10px rgba(0,0,0,0.7)"
            : "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -10px 18px rgba(0,0,0,0.65), 0 2px 6px rgba(0,0,0,0.55)",
        cursor: firePbOut ? "default" : "pointer",
        transition: "all 0.25s ease",
        position: "absolute",
      }}
      disabled={firePbOut}
    >
      {/* Wireframe metal guard at top */}
      <div style={{
        position: "absolute", top: -10, left: 8, right: 8, height: 20,
        border: "1.5px solid #6a7488",
        borderRadius: 3,
        background: "rgba(40,46,56,0.20)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.30), 0 2px 3px rgba(0,0,0,0.5)",
        pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0, height: 1.4,
          transform: "rotate(20deg)", transformOrigin: "50% 50%",
          background: "linear-gradient(90deg, #4a5260, #b0b8c0, #4a5260)",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0, height: 1.4,
          transform: "rotate(-20deg)", transformOrigin: "50% 50%",
          background: "linear-gradient(90deg, #4a5260, #b0b8c0, #4a5260)",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 4, height: 4,
          background: "radial-gradient(circle at 30% 30%, #c8d0d8, #5a6470)",
          borderRadius: "50%",
        }} />
      </div>

      {firePbOut && !fireLightLit && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          width: 8, height: 8, borderRadius: "50%",
          background: "#FFB300",
          boxShadow: "0 0 6px rgba(255,179,0,0.85)",
        }} />
      )}

      <div style={{
        position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
        fontSize: 24, fontFamily: "monospace", fontWeight: 800, letterSpacing: "3px",
        color: fireLightLit ? "#fff5f5" : "#a4abb6",
        textShadow: fireLightLit ? "0 0 14px rgba(255,80,80,0.9), 0 0 4px #fff" : "0 0 4px rgba(0,0,0,0.4)",
        transition: "color 0.2s, text-shadow 0.2s",
      }}>FIRE</div>

      <div style={{
        position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
        fontSize: 13, fontFamily: "monospace", fontWeight: 700, letterSpacing: "2.5px",
        color: fireLightLit ? "#ffd0d0" : "#9aa1ac",
        transition: "color 0.2s",
      }}>PUSH</div>

      {fireLightLit && (
        <>
          {[
            { top: 6, left: 6 },
            { top: 6, right: 6 },
            { bottom: 6, left: 6 },
            { bottom: 6, right: 6 },
          ].map((pos, i) => (
            <div key={i}
              style={{
                position: "absolute", ...pos,
                width: 6, height: 6, borderRadius: "50%",
                background: "#ff4040",
                boxShadow: "0 0 8px rgba(255,80,80,0.95)",
              }}
            />
          ))}
        </>
      )}
    </button>
  );
}

// ─── AGENT 1(2) pb-sw ────────────────────────────────────────────────────────
function AgentPanel({
  side, agentNum, arming, armed, discharged, clickable, onPush, apuStyle = false,
}: {
  side: "left" | "right";
  agentNum: 1 | 2;
  arming:     boolean;   // FIRE pb pushed but 10-s window not elapsed
  armed:      boolean;   // SQUIB armed (or testActive)
  discharged: boolean;   // DISCH amber
  clickable:  boolean;
  onPush:     () => void;
  apuStyle?:  boolean;
}) {
  const sideStyle: React.CSSProperties = {
    top: 100,
    [side === "left" ? "left" : "right"]: apuStyle ? "50%" : 26,
    ...(apuStyle ? { transform: "translateX(-50%)" } : {}),
  };

  return (
    <div className="absolute" style={sideStyle}>
      <div className="text-gray-200 mb-2"
           style={{ fontSize: 11, letterSpacing: 2, fontFamily: "monospace", fontWeight: 700, textAlign: "center" }}>
        AGENT {apuStyle ? "" : agentNum}
      </div>

      <button
        onClick={clickable ? onPush : undefined}
        disabled={!clickable}
        style={{
          width: 64, height: 64, padding: 3,
          background: "#1e2430",
          border: `1.5px solid ${discharged ? "#ffb300" : armed ? "#e8ecf4" : arming ? "#FFB30070" : "#3a4252"}`,
          borderRadius: 3,
          boxShadow:
            discharged ? "0 0 8px rgba(255,179,0,0.55)" :
            armed      ? "0 0 8px rgba(232,236,244,0.45)" :
            arming     ? "0 0 4px rgba(255,179,0,0.35)" :
                         "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", gap: 2,
          cursor: clickable ? "pointer" : "default",
          transition: "all 0.2s",
        }}
      >
        {/* SQUIB cell — pulses amber during arming, solid white when armed */}
        <SquibCell arming={arming && !armed && !discharged} armed={armed && !discharged} />
        {/* DISCH cell — solid amber when discharged */}
        <Indicator label="DISCH" lit={discharged} color="amber" />
      </button>
    </div>
  );
}

function SquibCell({ arming, armed }: { arming: boolean; armed: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        background: arming ? undefined : armed ? "rgba(232,236,244,0.30)" : "#06080c",
        animation: arming ? "agent-arming-pulse 1s ease-in-out infinite" : undefined,
        borderRadius: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontFamily: "monospace", fontWeight: 800,
        letterSpacing: "0.08em",
        color: armed ? "#e8ecf4" : arming ? "#FFB300" : "#3a4252",
        textShadow: armed ? "0 0 4px #e8ecf4" : arming ? "0 0 3px rgba(255,179,0,0.7)" : "none",
        transition: "color 0.2s",
      }}
    >
      SQUIB
    </div>
  );
}

function Indicator({ label, lit, color }: { label: string; lit: boolean; color: "white" | "amber" }) {
  const litBg = color === "white" ? "rgba(232,236,244,0.30)" : "rgba(255,179,0,0.30)";
  const litFg = color === "white" ? "#e8ecf4"               : "#ffb300";
  return (
    <div
      style={{
        flex: 1,
        background: lit ? litBg : "#06080c",
        borderRadius: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontFamily: "monospace", fontWeight: 800,
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
