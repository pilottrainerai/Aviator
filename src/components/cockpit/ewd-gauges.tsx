"use client";

// A320 E/WD — engine primary gauge cluster + slat/flap indicator.
// Faithful port of the reference SVG artwork (Futura, FCOM DSC-31-30 / DSC-27-30-20).
// Values resolve live from scenario.engineDisplay via evalSysCase; slat/flap geometry
// was measured from the FCOM E/WD reference photo, mapped into the 4097² artwork space.

import { useEffect, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { Scenario, SysColor, SysRowDef, SysVal, FlapConf } from "@/scenarios/types";
import { evalSysCase } from "./system-display";
import { PHASE_ENGINE_VALUES, type FlightPhase } from "./phase-engine-values";

const SYSCOL: Record<SysColor, string> = {
  green: "#5aba47", amber: "#e8a13a", red: "#ed1e24", cyan: "#2dc3e8", dim: "#6A7488", magenta: "#cf92c1",
};
const WHITE = "#fff";

function rowVal(rows: SysRowDef[] | undefined, label: string, state: ScenarioState, fb: SysVal): SysVal {
  const row = rows?.find((r) => r.label === label);
  return row ? evalSysCase(row.states, state) : fb;
}
function txtVal(cases: undefined | { value: string; when?: unknown }[], state: ScenarioState, fb: string): string {
  // cases is SysCase<string>[]; evalSysCase handles the when-matching
  return cases && cases.length ? (evalSysCase(cases as never, state) as string) : fb;
}
function boolVal(cases: undefined | { value: boolean; when?: unknown }[], state: ScenarioState, fb = false): boolean {
  return cases && cases.length ? (evalSysCase(cases as never, state) as boolean) : fb;
}

// N1 needle — pivots at the arc centre; angle maps N1 to the scale (calibrated on the
// 5 = 50 % and 10 = 100 % marks). Non-numeric N1 ("- -" on failure) → idle position.
const NDLEN = 372.5;
function needleTip(px: number, py: number, n1: string): [number, number] {
  const v = parseFloat(n1);
  const N1 = isFinite(v) ? Math.max(15, Math.min(110, v)) : 25.6;
  const th = (-162.6 + (N1 - 50) * 2.098) * Math.PI / 180;
  return [px + NDLEN * Math.cos(th), py + NDLEN * Math.sin(th)];
}

// ─── slat/flap geometry (measured from the reference; see ewd_slatflap_fcom) ───
const Lc = [2710.97, 2401.54], Rc = [2937.53, 2401.19];
const LREL = [[-66.42, 50.34], [-41.25, -22.37], [63.62, -51.73], [44.04, 23.77]];
const RREL = [[-67.66, -51.38], [-37.10, 29.71], [52.38, 50.69], [52.38, -29.01]];
const uL = [-0.948, 0.317], uR = [0.978, 0.210];
const slatSP = 183, flapSP = 183, BS = 1.0;   // pacing tuned on-screen (slats 183 / flaps 183). green box = exact SVG flank (matches the
                                              // white hat, and sits flush at pos 0 without overlap)
const SLATMAX = 3, FLAPMAX = 4;
const SFCONF: Record<FlapConf, { s: number; f: number }> = {
  "0": { s: 0, f: 0 }, "1": { s: 1, f: 0 }, "1+F": { s: 1, f: 1 },
  "2": { s: 2, f: 2 }, "3": { s: 2, f: 3 }, "FULL": { s: 3, f: 4 },
};
const cen = (b: number[], u: number[], pos: number, sp: number) => [b[0] + pos * sp * u[0], b[1] + pos * sp * u[1]];
const pts = (arr: number[][]) => arr.map((a) => a.join(",")).join(" ");

function SlatFlap({ conf, flapConf, slatFault = false, flapFault = false }: { conf: FlapConf; flapConf?: FlapConf; slatFault?: boolean; flapFault?: boolean }) {
  // Slats follow `conf` (the lever); flaps follow `flapConf` (may lag/jam separately). [user 2026-07-06]
  // Slats/flaps TRANSIT smoothly to the target (RAF lerp), like real surfaces — not a snap. Slats
  // travel a touch faster than flaps. [user 2026-07-12: "flap/slat movement should be smoother, real"]
  const targetS = SFCONF[conf].s, targetF = SFCONF[flapConf ?? conf].f;
  const dispRef = useRef({ s: targetS, f: targetF });
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf = 0, prev = performance.now();
    const RATE_S = 0.6, RATE_F = 0.45;                 // detent positions per second
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      const d = dispRef.current; let moving = false;
      if (Math.abs(d.s - targetS) > 0.002) { d.s += Math.sign(targetS - d.s) * Math.min(Math.abs(targetS - d.s), RATE_S * dt); moving = true; } else d.s = targetS;
      if (Math.abs(d.f - targetF) > 0.002) { d.f += Math.sign(targetF - d.f) * Math.min(Math.abs(targetF - d.f), RATE_F * dt); moving = true; } else d.f = targetF;
      setTick((t) => t + 1);
      if (moving) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [targetS, targetF]);
  const dS = dispRef.current.s, dF = dispRef.current.f;
  // FCOM DSC-27-30-20 (5): the CONF figure is GREEN once the surfaces REACH the selected config, CYAN
  // while in transit (or jammed — never reach it). [user 2026-07-07]
  const confReached = Math.abs(dS - SFCONF[conf].s) < 0.02 && Math.abs(dF - SFCONF[conf].f) < 0.02;
  const confCol = confReached ? SYSCOL.green : SYSCOL.cyan;
  // FCOM DSC-27-30-20: on a slat/flap fault the affected index (S / F letter,
  // its position box + connecting line) turns amber. White reference dots stay.
  const sCol = slatFault ? SYSCOL.amber : SYSCOL.green;
  const fCol = flapFault ? SYSCOL.amber : SYSCOL.green;
  const sLbl = slatFault ? SYSCOL.amber : WHITE;
  const fLbl = flapFault ? SYSCOL.amber : WHITE;
  const boxPoly = (b: number[], u: number[], REL: number[][], pos: number, sp: number) =>
    pts(REL.map((r) => { const c = cen(b, u, pos, sp); return [c[0] + r[0] * BS, c[1] + r[1] * BS]; }));
  const idxPoly = (b: number[], u: number[], REL: number[][], pos: number, sp: number) =>
    pts(REL.map((r) => { const c = cen(b, u, pos, sp); return [c[0] + r[0] * BS * 0.5, c[1] + r[1] * BS * 0.5]; }));
  const cL = cen(Lc, uL, dS, slatSP), cR = cen(Rc, uR, dF, flapSP);
  const nums: Record<FlapConf, string> = { "0": "", "1": "1", "1+F": "1 + F", "2": "2", "3": "3", "FULL": "FULL" };

  return (
    <g>
      {/* white hat (SVG body, verbatim) */}
      <polygon points="2774.59,2349.81 2869.87,2349.81 2900.43,2430.9 2755.01,2425.31" fill="none" stroke={WHITE} strokeWidth={12} />
      {/* index marks (hidden while attached at 0) */}
      {(dS > 0.1 || targetS > 0.1) && Array.from({ length: SLATMAX }, (_, i) => (
        <polygon key={`si${i}`} points={idxPoly(Lc, uL, LREL, i + 1, slatSP)} fill={WHITE} />
      ))}
      {(dF > 0.1 || targetF > 0.1) && Array.from({ length: FLAPMAX }, (_, i) => (
        <polygon key={`fi${i}`} points={idxPoly(Rc, uR, RREL, i + 1, flapSP)} fill={WHITE} />
      ))}
      {/* connecting lines (amber on fault, else green) — travel with the box */}
      {dS > 0.04 && <line x1={2774.59} y1={2349.81} x2={cL[0] - 41.25 * BS} y2={cL[1] - 22.37 * BS} stroke={sCol} strokeWidth={12} strokeLinecap="round" />}
      {dF > 0.04 && <line x1={2869.87} y1={2349.81} x2={cR[0] + 52.38 * BS} y2={cR[1] - 29.01 * BS} stroke={fCol} strokeWidth={12} strokeLinecap="round" />}
      {/* position boxes (empty at 0; amber on fault, else green) — slide to the target */}
      <polygon points={boxPoly(Lc, uL, LREL, dS, slatSP)} fill="none" stroke={sCol} strokeWidth={12} />
      <polygon points={boxPoly(Rc, uR, RREL, dF, flapSP)} fill="none" stroke={fCol} strokeWidth={12} />
      {/* S / F labels (amber on fault) + config legend */}
      <text x={2330} y={2410} fill={sLbl} fontSize={150} textAnchor="middle">S</text>
      <text x={3300} y={2410} fill={fLbl} fontSize={150} textAnchor="middle">F</text>
      {conf !== "0" && <text x={2790} y={2650} fill={confCol} fontSize={140} textAnchor="middle">{nums[conf]}</text>}
    </g>
  );
}

// ponytail: spool engine numbers smoothly to target — first-order ease (~3.5 s time
// constant) so N1/EGT/N2/FF wind down like a real engine going to idle, not a jump.
function useSpool(targets: number[]): number[] {
  const [vals, setVals] = useState(targets);
  const cur = useRef(targets), tgt = useRef(targets);
  tgt.current = targets;
  const key = targets.join(",");
  useEffect(() => {
    let raf = 0, prev = performance.now();
    const tick = (t: number) => {
      const dt = Math.min((t - prev) / 1000, 0.1); prev = t;
      let moving = false;
      const next = cur.current.map((c, i) => {
        const to = tgt.current[i] ?? c;
        if (Math.abs(to - c) > 0.05) { moving = true; return c + (to - c) * Math.min(1, dt / 3.5); }
        return to;
      });
      cur.current = next; setVals(next);
      if (moving) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key]);
  return vals;
}

// Engine indications by FLIGHT PHASE. N1 = FCOM PRO-ABN-NAV unreliable-speed tables (~60t);
// EGT/N2/FF scale representatively off N1 (not FCOM-tabulated per phase). [user 2026-07-05]
// `thr` = the E/WD THRUST RATING LIMIT mode (TOGA/FLX/MCT/CLB) — NOT the A/THR mode (SPEED/THR IDLE,
// which belongs on the PFD FMA). With levers in the CL detent it is CLB throughout climb→approach. [user 2026-07-07]
export type EngineSet = { n1: string; egt: string; n2: string; ff: string; thr: string };
const eng = (n1: number, thr = "CLB"): EngineSet => ({
  n1: n1.toFixed(1), egt: String(Math.round(380 + (n1 - 35) * 4.6)),
  n2: (66 + (n1 - 35) * 0.57).toFixed(1), ff: String(Math.round(250 + (n1 - 35) * 20)), thr,
});
export function phaseEngine(vertMode: string | undefined, liveAlt: number, targetAlt: number): EngineSet {
  const vm = vertMode ?? "";
  if (vm === "SRS" || vm === "CLB" || vm === "OP CLB") return eng(89, "CLB");        // climb
  if (vm === "G/S") return eng(52);                                                  // final approach, CONF 3
  if (vm === "OP DES" && liveAlt - targetAlt > 150) return { n1: "35.0", egt: "380", n2: "68.0", ff: "300", thr: "CLB" }; // idle-thrust descent, but the RATING LIMIT stays CLB
  return eng(Math.max(52, Math.min(84, 52 + liveAlt * 0.0009)));                     // level (ALT / OP DES at target): 84% @ FL350 → ~55% low
}

export function EwdGauges({ state, scenario, phase, live }: { state: ScenarioState; scenario: Scenario; phase?: FlightPhase; live?: EngineSet }) {
  const ed = scenario.engineDisplay;
  const g = (rows: SysRowDef[] | undefined, label: string, fb: SysVal) => rowVal(rows, label, state, fb);
  // When a flight phase is given, the whole cluster shows that phase's reference
  // values (both engines equal); otherwise it resolves live from scenario.engineDisplay.
  const P = phase ? PHASE_ENGINE_VALUES[phase] : null;
  // Priority: live phase-driven set (both engines equal) > preview phase > scenario data.
  const E = live ?? (P ? { n1: P.n1, egt: P.egt, n2: P.n2, ff: P.ff, thr: P.thrustN1 } : null);
  const pv = (v: string): SysVal => ({ v, c: "green" });

  const rn1L = E ? pv(E.n1) : g(ed?.eng1.rows, "N1", { v: "86.7", c: "green" });
  const rn1R = E ? pv(E.n1) : g(ed?.eng2.rows, "N1", { v: "86.7", c: "green" });
  const regtL = E ? pv(E.egt) : g(ed?.eng1.rows, "EGT", { v: "629", c: "green" });
  const regtR = E ? pv(E.egt) : g(ed?.eng2.rows, "EGT", { v: "629", c: "green" });
  const rn2L = E ? pv(E.n2) : g(ed?.eng1.rows, "N2", { v: "96.8", c: "green" });
  const rn2R = E ? pv(E.n2) : g(ed?.eng2.rows, "N2", { v: "97.0", c: "green" });
  const rffL = E ? pv(E.ff) : g(ed?.eng1.rows, "FF", { v: "3320", c: "green" });
  const rffR = E ? pv(E.ff) : g(ed?.eng2.rows, "FF", { v: "3320", c: "green" });
  const fob = P ? P.fob : txtVal(ed?.fob, state, "9520");
  const thrMode = live ? live.thr : P ? P.thrustMode : txtVal(ed?.thrust?.mode, state, "CLB");
  // E/WD thrust-rating VALUE = the CLB N1 rating LIMIT (fixed per rating, FCOM) — NOT the live idle N1.
  // Held through descent (levers in CL detent → CLB limit). The live N1 is on the gauges. [user 2026-07-07]
  const rthr = txtVal(ed?.thrust?.value, state, "86.6");
  // Smoothly spool the gauge numbers to their targets (needle + digits follow).
  const sp = useSpool([+rn1L.v, +rn1R.v, +regtL.v, +regtR.v, +rn2L.v, +rn2R.v, +rffL.v, +rffR.v, +rthr]);
  // Non-numeric gauge value (failed engine shows "- -" on FIRE, FCOM DSC-31-30) → pass through
  // unchanged; spooling it would render "NaN". The needle already treats it as idle. [user 2026-07-09]
  const av = (b: SysVal, n: number, d: number): SysVal =>
    isFinite(+b.v) ? { v: (isFinite(n) ? n : +b.v).toFixed(d), c: b.c } : b;
  const n1L = av(rn1L, sp[0], 1), n1R = av(rn1R, sp[1], 1);
  const egtL = av(regtL, sp[2], 0), egtR = av(regtR, sp[3], 0);
  const n2L = av(rn2L, sp[4], 1), n2R = av(rn2R, sp[5], 1);
  const ffL = av(rffL, sp[6], 0), ffR = av(rffR, sp[7], 0);
  const thrVal = (isFinite(sp[8]) ? sp[8] : +rthr).toFixed(1);
  const flap = (P ? P.flap : txtVal(ed?.flap as never, state, "0")) as FlapConf;
  // Slat/flap FAULT — amber index (phase preview never shows a fault).
  const slatFault = P ? false : boolVal(ed?.slatFlapFault?.slat as never, state);
  const flapFault = P ? false : boolVal(ed?.slatFlapFault?.flap as never, state);
  const ndL = needleTip(1169.14, 511.95, n1L.v);
  const ndR = needleTip(2803.11, 515.71, n1R.v);
  // FADEC unpowered (FIRE pb) → parameter invalid: gauge shows amber "XX", the arc turns AMBER and
  // the needle + red overspeed segment DISAPPEAR (per the V-PREP ENG-fire reference). [user 2026-07-12]
  const n1LX = !isFinite(+n1L.v), n1RX = !isFinite(+n1R.v);
  const egtLX = !isFinite(+egtL.v), egtRX = !isFinite(+egtR.v);

  const V = (x: number, y: number, val: SysVal, size: number) => (
    <text x={x} y={y} fill={SYSCOL[val.c]} fontSize={size} textAnchor="middle">{val.v}</text>
  );

  return (
    <svg viewBox="0 0 4097 2730" preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "100%", fontFamily: "var(--font-cockpit)", fontWeight: 500 }}>
      <rect width={4097} height={2730} fill="#000" />

      {/* N1 gauges */}
      <path d="M935.13,741.65s-169.18-156.08-51.7-397.05c0,0,98.31-170.24,305.71-164.25,0,0,106.7-8.39,211,92.31" fill="none" stroke={n1LX ? SYSCOL.amber : WHITE} strokeWidth={15} />
      {!n1LX && <path d="M1400.15,272.67c28.78,25.08,71.21,100.41,71.21,100.41l-33.21,18.73" fill="none" stroke={SYSCOL.red} strokeWidth={15} />}
      {/* Dial markers (ticks + 5/10 scale) — HIDDEN when the gauge is invalid (FADEC lost on FIRE pb):
          a failed engine shows no dial graduations, just the amber arc + XX. [user 2026-07-14] */}
      {!n1LX && (
      <g stroke={WHITE} strokeWidth={15}>
        <line x1={909.57} y1={363.97} x2={883.44} y2={344.6} /><line x1={980.29} y1={283.15} x2={961.87} y2={257.49} />
        <line x1={1076.26} y1={230.34} x2={1065.41} y2={199.2} /><line x1={1184.64} y1={214.77} x2={1184.64} y2={180.18} />
        <line x1={1289.34} y1={237.69} x2={1304.63} y2={206.46} /><line x1={1378.42} y1={299.22} x2={1400.15} y2={280.4} />
      </g>
      )}
      {!n1LX && <line x1={1169.14} y1={511.95} x2={ndL[0]} y2={ndL[1]} stroke={SYSCOL[n1L.c]} strokeWidth={15} />}
      {!n1LX && <><text x={960} y={446} fill={WHITE} fontSize={104}>5</text><text x={1244} y={395} fill={WHITE} fontSize={87}>10</text></>}
      <rect x={1070.48} y={588.07} width={464.12} height={164.9} fill="none" stroke={WHITE} strokeWidth={10} />
      {V(1300, 729, n1L, 133)}
      <path d="M2569.41,745.54s-169.18-156.08-51.7-397.05c0,0,98.31-170.24,305.71-164.25,0,0,106.7-8.39,211,92.31" fill="none" stroke={n1RX ? SYSCOL.amber : WHITE} strokeWidth={15} />
      {!n1RX && <path d="M3034.43,276.55c28.78,25.08,71.21,100.41,71.21,100.41l-33.21,18.73" fill="none" stroke={SYSCOL.red} strokeWidth={15} />}
      {!n1RX && (
      <g stroke={WHITE} strokeWidth={15}>
        <line x1={2543.85} y1={367.85} x2={2517.72} y2={348.48} /><line x1={2614.57} y1={287.03} x2={2596.15} y2={261.37} />
        <line x1={2710.54} y1={234.23} x2={2699.69} y2={203.08} /><line x1={2818.92} y1={218.65} x2={2818.92} y2={184.07} />
        <line x1={2923.61} y1={241.57} x2={2938.91} y2={210.35} /><line x1={3012.7} y1={303.11} x2={3034.43} y2={284.28} />
      </g>
      )}
      {!n1RX && <line x1={2803.11} y1={515.71} x2={ndR[0]} y2={ndR[1]} stroke={SYSCOL[n1R.c]} strokeWidth={15} />}
      {!n1RX && <><text x={2600} y={446} fill={WHITE} fontSize={104}>5</text><text x={2883} y={395} fill={WHITE} fontSize={87}>10</text></>}
      <rect x={2706.84} y={596.04} width={466.48} height={157.6} fill="none" stroke={WHITE} strokeWidth={10} />
      {V(2940, 734, n1R, 136)}
      <text x={1896} y={627} fill={WHITE} fontSize={150}>N1</text><text x={1955} y={767} fill={SYSCOL.cyan} fontSize={119}>%</text>
      {/* thrust rating */}
      <text x={3451} y={186} fill={SYSCOL.cyan} fontSize={146}>{thrMode}</text>
      <text x={3440} y={342} fill={SYSCOL.green} fontSize={146}>{thrVal}<tspan fill={SYSCOL.cyan}> %</tspan></text>

      {/* EGT */}
      <path d="M1478.66,1067.25c-85.67-208.82-308.72-208.82-308.72-208.82-333.71,25.88-329.35,330.19-329.35,330.19h29.45" fill="none" stroke={egtLX ? SYSCOL.amber : WHITE} strokeWidth={15} />
      {!egtLX && <path d="M1470.48,1188.62h30.76s-5.75-72.03-22.58-121.37" fill="none" stroke={SYSCOL.red} strokeWidth={15} />}
      {!egtLX && <line x1={1092.08} y1={837.43} x2={1119.03} y2={974.9} stroke={SYSCOL.green} strokeWidth={15} />}
      <rect x={982.46} y={1098.73} width={374.95} height={164.9} fill="none" stroke={WHITE} strokeWidth={10} />
      {V(1170, 1236, egtL, 144)}
      <path d="M3111.83,1069.04c-85.67-208.82-308.72-208.82-308.72-208.82-333.71,25.88-329.35,330.19-329.35,330.19h29.45" fill="none" stroke={egtRX ? SYSCOL.amber : WHITE} strokeWidth={15} />
      {!egtRX && <path d="M3103.65,1190.4h30.76s-5.75-72.03-22.58-121.37" fill="none" stroke={SYSCOL.red} strokeWidth={15} />}
      {!egtRX && <line x1={2725.25} y1={839.21} x2={2752.2} y2={976.68} stroke={SYSCOL.green} strokeWidth={15} />}
      <rect x={2619.61} y={1098.31} width={374.95} height={164.9} fill="none" stroke={WHITE} strokeWidth={10} />
      {V(2807, 1236, egtR, 144)}
      <text x={1852} y={1150} fill={WHITE} fontSize={150}>EGT</text>
      <text x={1923} y={1224} fill={SYSCOL.cyan} fontSize={48}>O</text><text x={1959} y={1296} fill={SYSCOL.cyan} fontSize={130}>C</text>

      {/* N2 */}
      <line x1={1603} y1={1629.19} x2={1803.37} y2={1574.93} stroke={WHITE} strokeWidth={15} />
      <line x1={2196.83} y1={1570.38} x2={2391.73} y2={1629.19} stroke={WHITE} strokeWidth={15} />
      {V(1200, 1687, n2L, 144)}{V(2830, 1685, n2R, 144)}
      <text x={1896} y={1598} fill={WHITE} fontSize={150}>N2</text><text x={1935} y={1745} fill={SYSCOL.cyan} fontSize={150}>%</text>

      {/* FF */}
      <line x1={1603} y1={2013.08} x2={1803.37} y2={1963.44} stroke={WHITE} strokeWidth={15} />
      <line x1={2391.73} y1={2013.08} x2={2196.83} y2={1963.44} stroke={WHITE} strokeWidth={15} />
      {V(1300, 2074, ffL, 144)}{V(2930, 2076, ffR, 144)}
      <text x={1920} y={1980} fill={WHITE} fontSize={142}>FF</text><text x={1832} y={2123} fill={SYSCOL.cyan} fontSize={119}>KG/H</text>

      {/* FOB */}
      <text x={65} y={2636} fontSize={138}>
        <tspan fill={WHITE}>FOB   :</tspan><tspan fill={SYSCOL.green} dx={60}>{fob}</tspan><tspan fill={SYSCOL.cyan} dx={40}>KG</tspan>
      </text>

      {/* slat / flap */}
      <SlatFlap conf={flap} flapConf={flapFault ? "0" : flap} slatFault={slatFault} flapFault={flapFault} />
    </svg>
  );
}
