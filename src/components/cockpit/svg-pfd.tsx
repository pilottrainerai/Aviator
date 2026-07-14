"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A320 PFD — the DESIGNER SVG PFD, driven by the scenario (buildAircraftState).
// Faithful port of ~/Desktop/dual_hyd_gy_svg_pfd.html (the LOCKED standard PFD).
// Drop-in replacement for <PfdMockup> — used for the DUAL HYD G+Y scenario only.
// Vector (viewBox 4111×4096, fills its square box 1:1). Attitude is kept LEVEL
// (as the approved standalone); tapes / VS / FMA / law / RA all lerp-driven so
// motion matches the canvas. FCOM map: pfd-fma-logic skill §9 [2026-07-02].
// pfd-mockup.tsx / pfd-instruments stay untouched.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { Jost } from "next/font/google";
import type { ScenarioState } from "@/engine/state";
import type { Scenario } from "@/scenarios/types";
import { buildAircraftState } from "@/components/cockpit/pfd-nd";
import type { AircraftState } from "@/avionics/core/aircraftState";

// Self-hosted (offline) geometric sans — closest free match to the designer's Futura.
// next/font bundles the files at build time, so no runtime CDN dependency.
const jost = Jost({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jost", display: "swap" });

const NS = "http://www.w3.org/2000/svg";
// tape scaling (px per unit) + centres — from the standalone
const SPD = { cy: 2082, pxK: 25.6 }, ALT = { cy: 2085, pxF: 1.9 }, HDG = { cx: 1772, pxD: 38.6 };
// LOCKED calibration (VS / pitch cross / MAN PITCH TRIM / radio altimeter)
const VSC = { pivotX: 4077.89, pivotY: 2084.24, tipX: 3941.17, boxOffX: -38.3, boxGap: 8, boxW: 104, boxH: 80, boxFont: 92 };
const PXC = { cx: 1772, loY: 2686.23, loSep: 160.64, arm: 27 };
const MPT = { x: 1746.7, y: 545, font: 125, ls: 26 };
const RA  = { x: 1781.18, y: 3072.21, font: 150 };

// non-linear VS px map (FCOM DSC-31-40: 0-1000 expanded, 2000-6000 compressed)
function vsPx(f: number) {
  f = Math.abs(f);
  const P = [[0, 0], [500, 345], [1000, 696], [2000, 950], [6000, 1205]];
  for (let i = 1; i < P.length; i++) {
    if (f <= P[i][0]) { const a = P[i - 1], b = P[i]; return a[1] + (f - a[0]) / (b[0] - a[0]) * (b[1] - a[1]); }
  }
  return 1205;
}

// VS needle MOVING PIVOT — the needle's tail rides a path P0→P400→P700 by V/S magnitude
// (mirrored about P0 for descent), RAF-eased. Ported from PFD-CURRENT.html / pfd_work.html with
// the pilot-calibrated coords baked (displays/PFD.md). Supersedes the old fixed VSC pivot. [user 2026-07-11]
const VPIV = { P0: { x: 4077.89, y: 2084.24 }, P400: { x: 4078, y: 1797 }, P700: { x: 4071, y: 1578 } };
const VGMAP: [number, number][] = [[0, 0], [500, 200], [700, 400], [1000, 600], [1500, 700]];
function vGNum(vs: number) { vs = Math.abs(vs); for (let i = 1; i < VGMAP.length; i++) { if (vs <= VGMAP[i][0]) { const a = VGMAP[i - 1], b = VGMAP[i]; return a[1] + (vs - a[0]) / (b[0] - a[0]) * (b[1] - a[1]); } } return VGMAP[VGMAP.length - 1][1]; }
function vLerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
function vMir(p: { x: number; y: number }) { return { x: 2 * VPIV.P0.x - p.x, y: 2 * VPIV.P0.y - p.y }; }
function vPivAt(n: number) { if (n <= 400) return vLerp(VPIV.P0, VPIV.P400, n / 400); if (n >= 700) return VPIV.P700; return vLerp(VPIV.P400, VPIV.P700, (n - 400) / 300); }
function vGoalPivot(vs: number) { const g = vPivAt(vGNum(vs)); return vs < 0 ? vMir(g) : g; }

// Static designer artwork + dynamic-element ids (verbatim from the standalone,
// minus the edit-mode FMA-grid overlay). The <style> classes drive the look.
const STATIC_SVG = `
<defs><style>
/* @scope keeps these Illustrator-default cls-N names local to THIS svg — they are
   identical to hyd-sd-page.tsx's classes and were cross-contaminating (PFD .cls-4 is a
   red stroke → leaked onto the HYD page's PTU/RAT/ELEC text). [user 2026-07-05] */
@scope (.svgpfd-scope) {
.cls-1{stroke-width:58px}.cls-1,.cls-2,.cls-3,.cls-4,.cls-5,.cls-6,.cls-7,.cls-8,.cls-9,.cls-10,.cls-11,.cls-12,.cls-13,.cls-14,.cls-15,.cls-16,.cls-17,.cls-18,.cls-19,.cls-20,.cls-21,.cls-22,.cls-23,.cls-24,.cls-25,.cls-26,.cls-27,.cls-28,.cls-29,.cls-30,.cls-31,.cls-32{stroke-miterlimit:10}
.cls-1,.cls-2,.cls-3,.cls-4,.cls-5,.cls-6,.cls-7,.cls-8,.cls-9,.cls-10,.cls-11,.cls-12,.cls-13,.cls-14,.cls-15,.cls-16,.cls-17,.cls-18,.cls-19,.cls-20,.cls-21,.cls-22,.cls-24,.cls-25,.cls-26,.cls-27,.cls-28,.cls-29,.cls-31,.cls-32{fill:none}
.cls-1,.cls-3,.cls-4,.cls-16{stroke:#ed1e24}.cls-2,.cls-5,.cls-6{stroke:#ee8f2e}.cls-2,.cls-16{stroke-width:5px}.cls-3{stroke-width:12px}.cls-4,.cls-10{stroke-width:22px}
.cls-33,.cls-23,.cls-30{fill:#5c5f6a}.cls-5,.cls-9,.cls-19,.cls-24,.cls-32{stroke-width:13px}.cls-6,.cls-12,.cls-27{stroke-width:35px}
.fnt{font-family:var(--font-jost),"Futura-Medium","Futura","Century Gothic",Roboto,sans-serif;font-weight:500}
.grn{fill:#3ad63a}.wht{fill:#fff}.blu{fill:#27aae1}.mag{fill:#cf92c1}.cyn{fill:#2dc3e8}.amb{fill:#f0a92a}
.cls-7{stroke-width:10px}.cls-7,.cls-8,.cls-9,.cls-10,.cls-11,.cls-12,.cls-13,.cls-14,.cls-15{stroke:#fff}.cls-8{stroke-width:17px}.cls-11{stroke-width:34px}.cls-13,.cls-20,.cls-26,.cls-29{stroke-width:15px}
.cls-14{stroke-width:40px}.cls-47{fill:#885823}.cls-15{stroke-width:45px}.cls-17,.cls-18{stroke:#cf92c1}.cls-17,.cls-28{stroke-width:18px}.cls-18{stroke-width:20px}
.cls-56{fill:#2b7fb3}.cls-19{stroke:#2dc3e8}.cls-20,.cls-21,.cls-22,.cls-24{stroke:#e7e519}.cls-21{stroke-width:39px}.cls-22{stroke-width:21px}
.cls-23{stroke-width:30px}.cls-23,.cls-30{stroke:#5c5f6a}.cls-25{stroke-width:25px}.cls-25,.cls-26,.cls-27{stroke:#3ad63a}.cls-28,.cls-29,.cls-32{stroke:#ece825}.cls-31{stroke:#000;stroke-width:48px}.cls-46{fill:#ece825}
}
</style><clipPath id="altTapeClip"><rect x="3020" y="997.81" width="360" height="2180"/></clipPath><clipPath id="altDrumClip"><rect x="3402" y="1940" width="182" height="336"/></clipPath><linearGradient id="altFadeGrad" x1="0" y1="1940" x2="0" y2="2276" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000"/><stop offset="0.08" stop-color="#333"/><stop offset="0.17" stop-color="#ccc"/><stop offset="0.27" stop-color="#fff"/><stop offset="0.73" stop-color="#fff"/><stop offset="0.83" stop-color="#ccc"/><stop offset="0.92" stop-color="#333"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="altDrumFade" maskUnits="userSpaceOnUse" x="3402" y="1940" width="182" height="336"><rect x="3402" y="1940" width="182" height="336" fill="url(#altFadeGrad)"/></mask><clipPath id="adiDisk"><path d="M818.56,2091.97v-529.83s322.29-561.26,953.58-556.55c0,0,664.83-19.14,953.58,577.5v507.64l-1907.16,1.22Z"/><path d="M2718.73,2114.03l6.99,491.34s-334.16,569.05-964.06,564.35c0,0-632.85-14.39-943.1-557.37v-510.41l1900.17,12.09Z"/></clipPath><clipPath id="ladWin"><rect x="818.56" y="1278.11" width="1907.15" height="1611.0"/></clipPath><clipPath id="vlsClip"><rect x="350" y="1010" width="320" height="2160"/></clipPath></defs>
<g id="black_background"><rect x="0" y="0" width="4096" height="4096"/></g>
<g id="attitude">
<g clip-path="url(#adiDisk)">
<rect x="400" y="-1000" width="3000" height="2278.1" fill="#2b7fb3"/>
<rect x="400" y="2889.09" width="3000" height="2200" fill="#885823"/>
<g clip-path="url(#ladWin)"><g class="attMove">
<rect x="400" y="-1200" width="3000" height="3301.9" fill="#2b7fb3"/>
<rect x="400" y="2101.95" width="3000" height="2600" fill="#885823"/>
<line class="cls-10" x1="818.56" y1="2101.95" x2="2725.71" y2="2101.95"/>
<line class="cls-13" x1="1523.7" y1="4281.9" x2="2017.7" y2="4281.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="4326.9">50</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="4326.9">50</text>
<line class="cls-13" x1="1704.7" y1="4172.9" x2="1836.7" y2="4172.9"/><line class="cls-13" x1="1653.7" y1="4063.9" x2="1887.7" y2="4063.9"/><line class="cls-13" x1="1704.7" y1="3954.9" x2="1836.7" y2="3954.9"/>
<line class="cls-13" x1="1523.7" y1="3845.9" x2="2017.7" y2="3845.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="3890.9">40</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="3890.9">40</text>
<line class="cls-13" x1="1704.7" y1="3736.9" x2="1836.7" y2="3736.9"/><line class="cls-13" x1="1653.7" y1="3627.9" x2="1887.7" y2="3627.9"/><line class="cls-13" x1="1704.7" y1="3518.9" x2="1836.7" y2="3518.9"/>
<line class="cls-13" x1="1523.7" y1="3409.9" x2="2017.7" y2="3409.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="3454.9">30</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="3454.9">30</text>
<line class="cls-13" x1="1704.7" y1="3300.9" x2="1836.7" y2="3300.9"/><line class="cls-13" x1="1653.7" y1="3191.9" x2="1887.7" y2="3191.9"/><line class="cls-13" x1="1704.7" y1="3082.9" x2="1836.7" y2="3082.9"/>
<line class="cls-13" x1="1523.7" y1="2973.9" x2="2017.7" y2="2973.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="3018.9">20</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="3018.9">20</text>
<line class="cls-13" x1="1704.7" y1="2864.9" x2="1836.7" y2="2864.9"/><line class="cls-13" x1="1653.7" y1="2755.9" x2="1887.7" y2="2755.9"/><line class="cls-13" x1="1704.7" y1="2646.9" x2="1836.7" y2="2646.9"/>
<line class="cls-13" x1="1523.7" y1="2537.9" x2="2017.7" y2="2537.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="2582.9">10</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="2582.9">10</text>
<line class="cls-13" x1="1704.7" y1="2428.9" x2="1836.7" y2="2428.9"/><line class="cls-13" x1="1653.7" y1="2319.9" x2="1887.7" y2="2319.9"/><line class="cls-13" x1="1704.7" y1="2210.9" x2="1836.7" y2="2210.9"/>
<line class="cls-13" x1="1704.7" y1="1992.9" x2="1836.7" y2="1992.9"/><line class="cls-13" x1="1653.7" y1="1883.9" x2="1887.7" y2="1883.9"/><line class="cls-13" x1="1704.7" y1="1774.9" x2="1836.7" y2="1774.9"/>
<line class="cls-13" x1="1523.7" y1="1665.9" x2="2017.7" y2="1665.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="1710.9">10</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="1710.9">10</text>
<line class="cls-13" x1="1704.7" y1="1556.9" x2="1836.7" y2="1556.9"/><line class="cls-13" x1="1653.7" y1="1447.9" x2="1887.7" y2="1447.9"/><line class="cls-13" x1="1704.7" y1="1338.9" x2="1836.7" y2="1338.9"/>
<line class="cls-13" x1="1523.7" y1="1229.9" x2="2017.7" y2="1229.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="1274.9">20</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="1274.9">20</text>
<line class="cls-13" x1="1704.7" y1="1120.9" x2="1836.7" y2="1120.9"/><line class="cls-13" x1="1653.7" y1="1011.9" x2="1887.7" y2="1011.9"/><line class="cls-13" x1="1704.7" y1="902.9" x2="1836.7" y2="902.9"/>
<line class="cls-13" x1="1523.7" y1="793.9" x2="2017.7" y2="793.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="838.9">30</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="838.9">30</text>
<line class="cls-13" x1="1704.7" y1="684.9" x2="1836.7" y2="684.9"/><line class="cls-13" x1="1653.7" y1="575.9" x2="1887.7" y2="575.9"/><line class="cls-13" x1="1704.7" y1="466.9" x2="1836.7" y2="466.9"/>
<line class="cls-13" x1="1523.7" y1="357.9" x2="2017.7" y2="357.9"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="402.9">40</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="402.9">40</text>
<line class="cls-13" x1="1704.7" y1="248.9" x2="1836.7" y2="248.9"/><line class="cls-13" x1="1653.7" y1="139.9" x2="1887.7" y2="139.9"/><line class="cls-13" x1="1704.7" y1="30.9" x2="1836.7" y2="30.9"/>
<line class="cls-13" x1="1523.7" y1="-78.1" x2="2017.7" y2="-78.1"/><text class="fnt wht" font-size="133" text-anchor="end" x="1483.7" y="-33.1">50</text><text class="fnt wht" font-size="133" text-anchor="start" x="2057.7" y="-33.1">50</text>
<polygon points="1680.72,505.9 1770.72,615.9 1860.72,505.9 1810.72,505.9 1770.72,565.9 1730.72,505.9" fill="none" stroke="#ed1e24" stroke-width="22"/>
<polygon points="1680.72,178.9 1770.72,288.9 1860.72,178.9 1810.72,178.9 1770.72,238.9 1730.72,178.9" fill="none" stroke="#ed1e24" stroke-width="22"/>
<polygon points="1680.72,-148.1 1770.72,-38.1 1860.72,-148.1 1810.72,-148.1 1770.72,-88.1 1730.72,-148.1" fill="none" stroke="#ed1e24" stroke-width="22"/>
</g></g>
</g>
<g id="fixedBounds"><line class="cls-13" x1="1053.48" y1="1278.11" x2="2485.85" y2="1278.11"/><line class="cls-13" x1="1053.48" y1="2889.09" x2="2480.53" y2="2889.09"/></g>
<polygon class="cls-32" points="871.49 2053.06 1259.69 2053.06 1259.69 2221.84 1198.05 2221.84 1198.05 2119.11 871.49 2119.11 871.49 2053.06"/><polyline class="cls-31" points="1228.77 2214.27 1228.77 2088.6 878.68 2088.6"/>
<polygon class="cls-32" points="2279.77 2053.55 2667.02 2053.55 2667.02 2119.16 2344.39 2119.16 2344.39 2221.07 2277.78 2221.07 2279.77 2053.55"/><polyline class="cls-31" points="2310.8 2212.47 2310.8 2086.81 2660.89 2086.81"/>
<g id="greenEq"><line class="cls-26" x1="772.36" y1="1593.35" x2="719.21" y2="1565.75"/><line class="cls-26" x1="772.36" y1="1631.16" x2="719.21" y2="1606.63"/><line class="cls-26" x1="2773.15" y1="1591.09" x2="2819.28" y2="1567.03"/><line class="cls-26" x1="2773.15" y1="1629.1" x2="2819.28" y2="1605.04"/></g>
<line class="cls-13" x1="1005.56" y1="1333.98" x2="919.42" y2="1249.17"/><line class="cls-13" x1="2542.3" y1="1322.57" x2="2614.38" y2="1251.57"/>
<rect class="cls-13" x="1174.9" y="1064.5" width="52.15" height="87.18" transform="translate(-407.36 819.2) rotate(-32.51)"/><rect class="cls-13" x="1360.49" y="1009.98" width="49.38" height="68.66" transform="translate(-236.57 428.49) rotate(-16.22)"/>
<rect class="cls-13" x="1549.08" y="959.63" width="49.38" height="68.66" transform="translate(-88.21 155.79) rotate(-5.51)"/><rect class="cls-13" x="1940.15" y="959.44" width="49.38" height="68.66" transform="translate(164.01 -273.19) rotate(8.3)"/>
<rect class="cls-13" x="2131.64" y="1008.73" width="49.38" height="68.66" transform="translate(410.58 -597.09) rotate(17.4)"/><rect class="cls-13" x="2310.03" y="1065.61" width="49.38" height="97.63" transform="translate(870.0068 -1018.0556) rotate(30)"/>
<rect class="cls-29" x="1732.59" y="2048" width="76.27" height="76.27" style="fill:#000"/>
<polygon class="cls-28" points="1706.55 917.95 1772.14 1005.6 1835.82 917.95 1706.55 917.95"/><polygon class="cls-28" points="1699.15 1144.94 1771.91 1039.29 1844.43 1144.94 1699.15 1144.94"/><polygon id="slipTrap" class="cls-28" points="1639.72 1225.84 1676.86 1169.05 1866.72 1169.05 1903.86 1225.84 1639.72 1225.84"/>
<path class="cls-13" d="M1200.98,1169.05s535.99-352.14,1129.96,0"/>
<g id="amberX" style="display:none"><g stroke="#f0a92a" stroke-width="16" stroke-linecap="round"><line x1="718" y1="1565" x2="772" y2="1631"/><line x1="772" y1="1565" x2="718" y2="1631"/><line x1="2772" y1="1565" x2="2826" y2="1631"/><line x1="2826" y1="1565" x2="2772" y2="1631"/></g></g>
<g id="pitchMarks"></g>
<text id="raVal" class="fnt grn" font-size="150" x="1781.18" y="3072.21" text-anchor="middle" style="display:none">0</text>
<g id="fdBars"><line class="cls-25" x1="1265.75" y1="2086.13" x2="2277.78" y2="2086.13"/><line class="cls-25" x1="1770.72" y1="1583.36" x2="1770.72" y2="2585.97"/></g>
</g>
<g id="airspeed">
<rect class="cls-33" x="35.54" y="988.79" width="448.4" height="2180.96"/><line class="cls-9" x1="483.94" y1="988.79" x2="483.94" y2="3169.76"/>
<line class="cls-13" x1="35.54" y1="988.79" x2="607.17" y2="988.79"/><line class="cls-13" x1="28.6" y1="3175.92" x2="605.05" y2="3175.92"/>
<g id="spdScale"></g>
<line class="cls-16" x1="554.86" y1="995.72" x2="554.86" y2="1268.82"/><line class="cls-1" x1="490.28" y1="1245.97" x2="560.12" y2="1245.97"/><line class="cls-1" x1="490.28" y1="1113.96" x2="560.12" y2="1113.96"/><line class="cls-4" x1="490.28" y1="1006.41" x2="560.12" y2="1006.41"/>
<line class="cls-32" x1="350.78" y1="2082.27" x2="533.38" y2="2082.27"/><line class="cls-32" x1="0" y1="2085.27" x2="44.53" y2="2085.27"/>
<polygon id="spdTarget" class="cls-46" points="515.79 2084.46 596.14 2124.18 596.14 2044.75 515.79 2084.46"/><polyline id="spdTrendArrow" style="display:none" fill="none" stroke="#e7e519" stroke-width="16" stroke-linecap="round"/><polygon id="spdSelBug" class="cls-19" style="stroke-linejoin:round" points="483.94 2082 618.5 2004 618.5 2160"/>
<g id="vlsStrip" clip-path="url(#vlsClip)"></g>
<g id="vmaxStrip" clip-path="url(#vlsClip)"></g>
<g id="charSpd"></g><text id="spdFlagTxt" x="260" y="2150" font-size="200" text-anchor="middle" style="display:none;font-weight:700">SPD</text>
</g>
<g id="heading">
<rect class="cls-33" x="811.49" y="3734.5" width="1907.16" height="264.35"/><polyline class="cls-19" points="1744.38 3727.84 1693.79 3582.44 1850.48 3582.44 1801.13 3727.84"/>
<polyline class="cls-9" points="804.41 4005.51 804.41 3727.84 2725.71 3727.84 2725.71 4005.51"/>
<g id="hdgScale"></g>
<line class="cls-28" x1="1772.14" y1="3582.44" x2="1772.14" y2="3781.46"/>
<g id="hdgBugG"><line id="hdgBug1" class="cls-18" x1="1774.01" y1="3883.32" x2="1581.75" y2="3883.32"/><line id="hdgBug2" class="cls-18" x1="1681.77" y1="3734.5" x2="1681.77" y2="3998.14"/></g>
</g>
<g id="ilsdev">
<circle class="cls-8" cx="2825" cy="1315.12" r="28.22"/><circle class="cls-8" cx="2825" cy="1701.96" r="28.22"/><circle class="cls-8" cx="2825" cy="2467.4" r="28.22"/><circle class="cls-8" cx="2825" cy="2858.27" r="28.22"/>
<circle class="cls-8" cx="2550.77" cy="3353.38" r="28.22"/><circle class="cls-8" cx="2159.77" cy="3353.38" r="28.22"/><circle class="cls-8" cx="1376.83" cy="3353.38" r="28.22"/><circle class="cls-8" cx="987.65" cy="3353.38" r="28.22"/>
<polygon id="gsDiamond" class="cls-17" points="2763.47 2086.81 2825.88 1991.67 2884.39 2080.83 2827.55 2191.15 2763.47 2086.81"/><polygon id="locDiamond" class="cls-17" points="1773.01 3417.12 1677.88 3354.71 1767.03 3296.21 1877.36 3353.04 1773.01 3417.12"/>
<line class="cls-11" x1="2747.47" y1="2083.71" x2="2974.83" y2="2083.71"/><line class="cls-28" x1="1769.01" y1="3249.79" x2="1769.01" y2="3453.08"/>
</g>
<g id="altitude">
<rect class="cls-33" x="3028.45" y="992.44" width="344.22" height="976.94"/><line class="cls-13" x1="3028.45" y1="997.81" x2="3498.43" y2="997.81"/><line class="cls-9" x1="3372.67" y1="1004.55" x2="3372.67" y2="1898.59"/>
<line class="cls-22" x1="3030.81" y1="1969.69" x2="3372.67" y2="1969.69"/><line class="cls-20" x1="3378.25" y1="1905.65" x2="3607.48" y2="1905.65"/>
<polyline class="cls-9" points="2978.35 1528.92 3016.84 1560.54 2978.35 1592.16"/><rect class="cls-30" x="3028.45" y="2205.87" width="344.22" height="963.86"/><line class="cls-24" x1="3601.08" y1="1898.59" x2="3601.08" y2="2270.15"/>
<line class="cls-22" x1="3030.81" y1="2200.37" x2="3372.67" y2="2200.37"/><line class="cls-20" x1="3378.25" y1="2270.15" x2="3607.48" y2="2270.15"/>
<polyline class="cls-9" points="2978.35 2484.47 3016.84 2516.09 2978.35 2547.71"/><line class="cls-13" x1="3028.45" y1="3177.73" x2="3498.43" y2="3177.73"/><line class="cls-9" x1="3372.67" y1="2281.13" x2="3372.67" y2="3169.76"/><line class="cls-24" x1="3372.67" y1="2189.77" x2="3372.67" y2="2281.13"/><line class="cls-24" x1="3372.67" y1="1897.43" x2="3372.67" y2="1979.69"/>
<g id="altScale" clip-path="url(#altTapeClip)"></g>
<text id="altBig" class="fnt grn" font-size="170" x="3405" y="2151" text-anchor="end"></text>
<g id="altDrum" clip-path="url(#altDrumClip)" mask="url(#altDrumFade)"><text id="altD0" class="fnt grn" font-size="120" x="3416" y="2148"></text><text id="altD1" class="fnt grn" font-size="120" x="3416" y="2148"></text><text id="altD2" class="fnt grn" font-size="120" x="3416" y="2148"></text><text id="altD3" class="fnt grn" font-size="120" x="3416" y="2148"></text><text id="altD4" class="fnt grn" font-size="120" x="3416" y="2148"></text></g>
<text id="selAlt" class="fnt blu" font-size="133" x="3193" y="974"></text>
</g>
<g id="baro"><text id="qnh" class="fnt" font-size="133" x="3066" y="3524"><tspan class="wht">QNH </tspan><tspan class="cyn">1013</tspan></text></g>
<g id="ilsinfo" style="display:none"><text class="fnt mag" font-size="133" x="96" y="3632">IPLM</text><text class="fnt mag" font-size="133" x="96" y="3792">110.30</text><text class="fnt mag" font-size="133" x="96" y="3952"><tspan id="ilsDme">10.0</tspan> <tspan class="cyn" font-size="90">NM</tspan></text></g>
<g id="vsi">
<polygon class="cls-30" points="3779.87 798.82 3901.66 798.82 4010.24 1176.99 4022.82 2630.47 4014.64 2982.99 3913.4 3380.51 3779.87 3380.51 3779.87 798.82"/>
<line class="cls-21" x1="3754.14" y1="2084.37" x2="3910.8" y2="2084.37"/>
<line class="cls-13" x1="3913.18" y1="2431.36" x2="3858.58" y2="2431.36"/><line class="cls-13" x1="3913.18" y1="2908.67" x2="3858.58" y2="2908.67"/><line class="cls-13" x1="3913.18" y1="3162.79" x2="3858.58" y2="3162.79"/><line class="cls-15" x1="3913.18" y1="2779.63" x2="3858.58" y2="2779.63"/>
<line class="cls-15" x1="3913.18" y1="1387.75" x2="3858.58" y2="1387.75"/><line class="cls-14" x1="3913.18" y1="1135.07" x2="3858.58" y2="1135.07"/><line class="cls-12" x1="3913.18" y1="879.14" x2="3858.58" y2="879.14"/><line class="cls-15" x1="3913.18" y1="3035.73" x2="3858.58" y2="3035.73"/>
<line class="cls-12" x1="3913.18" y1="3289.85" x2="3858.58" y2="3289.85"/><line class="cls-13" x1="3913.18" y1="1739.01" x2="3858.58" y2="1739.01"/><line class="cls-13" x1="3913.18" y1="1261.41" x2="3858.58" y2="1261.41"/><line class="cls-13" x1="3913.18" y1="1005.57" x2="3858.58" y2="1005.57"/>
<line id="vsNeedle" class="cls-27" x1="3910.8" y1="2084.37" x2="3790" y2="2084.37"/>
<text class="fnt wht" font-size="100" transform="translate(3798.97 908.49)">6</text><text class="fnt wht" font-size="100" transform="translate(3795.67 1164.42)">2</text><text class="fnt wht" font-size="100" transform="translate(3794.84 1417.10)">1</text><text class="fnt wht" font-size="100" transform="translate(3806.82 2808.98)">1</text><text class="fnt wht" font-size="100" transform="translate(3791.09 3065.08)">2</text><text class="fnt wht" font-size="100" transform="translate(3790.72 3319.20)">6</text>
<g id="vsBox" style="display:none"><rect id="vsBoxR" x="3790" y="2045" width="104" height="80" fill="#000" stroke="#3ad63a" stroke-width="5"/><text id="vsVal" class="fnt grn" font-size="92" x="3842" y="2117" text-anchor="middle">8</text></g>
</g>
<g id="fma">
<line id="fmaDiv1" class="cls-23" style="stroke:#fff" x1="849.39" y1="19.5" x2="849.39" y2="573.72"/><line id="fmaDiv2" class="cls-23" style="stroke:#fff" x1="1698.06" y1="19.5" x2="1698.06" y2="573.72"/><line id="fmaDiv3" class="cls-23" style="stroke:#fff" x1="2644.06" y1="19.5" x2="2644.06" y2="573.72"/><line id="fmaDiv4" class="cls-23" style="stroke:#fff" x1="3448.33" y1="19.5" x2="3448.33" y2="573.72"/>
<text id="f11" class="fnt grn" font-size="125" x="430" y="225" text-anchor="middle"></text><text id="f13" class="fnt wht" font-size="125" x="430" y="530" text-anchor="middle"></text>
<text id="f21" class="fnt grn" font-size="125" x="1270" y="225" text-anchor="middle"></text><text id="f22" class="fnt blu" font-size="125" x="1270" y="400" text-anchor="middle"></text>
<text id="f31" class="fnt grn" font-size="125" x="2170" y="225" text-anchor="middle"></text><text id="f32" class="fnt blu" font-size="125" x="2170" y="400" text-anchor="middle"></text>
<text id="f41" class="fnt wht" font-size="125" x="3045" y="225" text-anchor="middle"></text><text id="f42" class="fnt wht" font-size="125" x="3045" y="400" text-anchor="middle"></text>
<text id="baroMin" class="fnt" font-size="125" x="2710" y="530" text-anchor="start" style="display:none"><tspan class="wht">BARO</tspan><tspan class="blu" dx="26">460</tspan></text>
<text id="f51" class="fnt wht" font-size="125" x="3770" y="225" text-anchor="middle"></text><text id="f52" class="fnt wht" font-size="125" x="3770" y="400" text-anchor="middle"></text><text id="f53" class="fnt wht" font-size="125" x="3770" y="530" text-anchor="middle"></text>
<text id="ftrim" class="fnt amb" font-size="125" x="1322" y="530" text-anchor="middle"></text>
<rect id="fmaBox1" style="display:none;fill:none;stroke:#fff;stroke-width:9"/><rect id="fmaBox2" style="display:none;fill:none;stroke:#fff;stroke-width:9"/><rect id="fmaBox3" style="display:none;fill:none;stroke:#fff;stroke-width:9"/><rect id="fmaBox5" style="display:none;fill:none;stroke:#fff;stroke-width:9"/>
</g>
<text id="spdSel" class="fnt" font-size="133" text-anchor="end" x="593" y="974" style="display:none"></text>
`;

type Props = {
  state?: ScenarioState;
  scenario?: Scenario;
  elapsedMs?: number;
  paused?: boolean;
  onAltitude?: (ft: number) => void;
  onSpeed?: (kt: number) => void;
  /** Drive the attitude sphere from state.pitch/bank. OFF by default so G+Y stays frozen level. */
  liveAttitude?: boolean;
};

export default function SvgPfd({ state, scenario, elapsedMs, paused, onAltitude, onSpeed, liveAttitude }: Props = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Live refs (kept current every render). The RAF loop recomputes
  // buildAircraftState from these EACH FRAME — identical to the canvas PfdMockup,
  // so the altitude/VS/speed animation, rate of descent and level-off are the same.
  const stateRef = useRef(state); stateRef.current = state;
  const scenarioRef = useRef(scenario); scenarioRef.current = scenario;
  const elapsedMsRef = useRef(elapsedMs); elapsedMsRef.current = elapsedMs;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const onAltRef = useRef(onAltitude); onAltRef.current = onAltitude;
  const onSpdRef = useRef(onSpeed); onSpdRef.current = onSpeed;
  const liveAttRef = useRef(liveAttitude); liveAttRef.current = liveAttitude;

  useEffect(() => {
    // Query the LIVE DOM from the stable div ref each call (survives StrictMode
    // remounts / innerHTML swaps — capturing the <svg> once can go stale).
    const $ = (id: string) => rootRef.current?.querySelector<SVGElement>("#" + id) ?? null;
    const TRANS_ALT = 10000;  // baro STD↔QNH + selected-alt FL↔feet transition altitude
    const mk = (tag: string, a: Record<string, string | number>, txt?: string) => {
      const n = document.createElementNS(NS, tag);
      for (const k in a) n.setAttribute(k, String(a[k]));
      if (txt != null) n.textContent = txt;
      return n;
    };
    const setT = (id: string, t: string, cls?: string) => {
      const e = $(id); if (!e) return;
      e.textContent = t ?? "";
      (e as unknown as SVGElement & { style: CSSStyleDeclaration }).style.display = (t == null || t === "") ? "none" : "";
      if (cls) e.setAttribute("class", cls);
    };

    // ── scrolling tapes ──────────────────────────────────────────────────────
    function spdScale(cur: number) {
      const h = $("spdScale"); if (!h) return; h.innerHTML = "";
      for (let s = Math.round((cur - 70) / 10) * 10; s <= cur + 70; s += 10) {
        if (s < 0) continue;
        const y = SPD.cy - (s - cur) * SPD.pxK;
        if (y < 1010 || y > 3160) continue;
        h.appendChild(mk("line", { x1: 483.94, y1: y, x2: 402.35, y2: y, class: "cls-7" }));  // ref: every tick 483.94→402.35, uniform length (no short minor ticks)
        if (s % 20 === 0) h.appendChild(mk("text", { x: 360, y: y + 45, "font-size": 133, "text-anchor": "end", class: "fnt wht" }, String(s)));
      }
    }
    // VLS amber "hamburger" strip — drawn DYNAMICALLY at the real VLS speed (was static
    // artwork pinned ~20 kt below the index, which made the selected-speed bug look like it
    // dropped below VLS during a decel). Amber barber-pole from VLS DOWN to the tape bottom.
    // The selected bug is floored at VLS by G6, so it always stays at/above this. [user 2026-07-04]
    // Three CONNECTED bands, each driven by its OWN speed so the gaps flex with config [user 2026-07-11]:
    //   V_LS    = amber inverted-L [cls-5], hook at vls, vertical DOWN to V α-Prot
    //   V α-Prot = amber/black barber [cls-2 edge + cls-6 rungs], from α-Prot DOWN to V α-Max
    //   V α-Max  = red [cls-3], at α-Max (the barber's bottom). Each end meets the next (no gap/detach).
    // Clipped to the tape (#vlsClip); moves with the tape.
    function drawVLS(cur: number, vls?: number, alphaProt?: number, alphaMax?: number) {
      const h = $("vlsStrip"); if (!h) return; h.innerHTML = "";
      if (vls == null) return;
      const yFor = (s: number) => SPD.cy - (s - cur) * SPD.pxK;
      const aP = alphaProt ?? vls - 14;      // V α-Prot speed (own value; falls back ~14 kt below VLS)
      const aM = alphaMax ?? aP - 8;         // V α-Max speed (own value; falls back ~8 kt below α-Prot)
      const yV = yFor(vls), yP = yFor(aP), yM = yFor(aM);
      h.appendChild(mk("polyline", { points: `470.32,${yV.toFixed(1)} 534.81,${yV.toFixed(1)} 534.81,${yP.toFixed(1)}`, class: "cls-5" }));  // V_LS
      if (yM > yP) {                                                                                                        // V α-Prot = amber/BLACK barber (the black is what distinguishes it from the amber V_LS)
        h.appendChild(mk("rect", { x: "483.94", y: yP.toFixed(1), width: "71.87", height: (yM - yP).toFixed(1), fill: "#000" }));   // black backing
        h.appendChild(mk("line", { x1: 555.81, y1: yP.toFixed(1), x2: 555.81, y2: yM.toFixed(1), class: "cls-2" }));                // amber edge
        // α-Prot amber/black barber — EXACT reference geometry (PFD LATEST WITH TEXT.svg, lines 354-364):
        // cls-6 rungs 35 px thick, spacing 73 → black gap ~38 (amber ≈ black, as the reference). FIRST rung
        // TOP aligned to yP (centre yP+17.5) so the VLS hook — which ends at yP — CONNECTS to the AMBER first
        // rung, not a black gap (ref: VLS bottom 2967.44 sits inside the first rung 2963-2998). [user 2026-07-12]
        for (let y = yP + 17.5; y < yM - 4; y += 73) h.appendChild(mk("line", { x1: 555.81, y1: y.toFixed(1), x2: 483.94, y2: y.toFixed(1), class: "cls-6" }));
      }
      // V α-Max = RED STRIP from α-Max DOWN to the bottom of the scale (FCOM DSC-22-10-50-40: "top of a red strip"),
      // not a single line — so the low-speed region stays filled red as the band scrolls with speed. [user 2026-07-11]
      const yScaleBot = 3169.76;   // bottom of the visible speed scale
      if (yM < yScaleBot) h.appendChild(mk("rect", { x: "483.94", y: yM.toFixed(1), width: "84.81", height: (yScaleBot - yM).toFixed(1), fill: "#ed1e24" }));
      h.appendChild(mk("line", { x1: 568.75, y1: yM.toFixed(1), x2: 483.94, y2: yM.toFixed(1), class: "cls-3" }));          // α-Max top edge
    }
    // V_MAX red/black barber — the OVERSPEED strip from the current V_MAX (VMO clean / VFE per flap
    // config) UP to the top of the scale (FCOM DSC-22-10-50-40). The high-speed MIRROR of the low-speed
    // α-Prot barber, in RED. Dynamic — driven by s.vmax, clipped to the tape (#vlsClip) so it scrolls
    // with speed; only rendered when V_MAX is on-tape (else the barber sits off the top). [user 2026-07-14]
    function drawVMAX(cur: number, vmax?: number) {
      const h = $("vmaxStrip"); if (!h) return; h.innerHTML = "";
      if (vmax == null) return;
      const yV = SPD.cy - (vmax - cur) * SPD.pxK;            // tape-y of V_MAX (barber bottom)
      if (yV <= 1010) return;                                // V_MAX at/above the visible tape top → off-scale
      const yTop = 940;                                      // above the clip top (1010); #vlsClip trims it clean
      h.appendChild(mk("rect", { x: "483.94", y: String(yTop), width: "71.87", height: (yV - yTop).toFixed(1), fill: "#000" }));                    // black backing
      h.appendChild(mk("line", { x1: 555.81, y1: String(yTop), x2: 555.81, y2: yV.toFixed(1), stroke: "#ed1e24", "stroke-width": 13 }));            // red outer edge
      for (let y = yV - 17.5; y > yTop; y -= 73) h.appendChild(mk("line", { x1: 555.81, y1: y.toFixed(1), x2: 483.94, y2: y.toFixed(1), stroke: "#ed1e24", "stroke-width": 35 }));   // red rungs
      h.appendChild(mk("line", { x1: 568.75, y1: yV.toFixed(1), x2: 483.94, y2: yV.toFixed(1), stroke: "#ed1e24", "stroke-width": 12 }));           // V_MAX bottom edge
    }
    // Characteristic-speed markers (FCOM DSC-31-40). Geometry approved by user 2026-07-05:
    // GREEN DOT = open green circle on the edge · S/F = green bar SYMMETRIC across the edge
    // (432 inside ↔ 536 outside) + green letter outside · VFE NEXT = amber "=" INSIDE, tick-length.
    // Each drawn only when its value is set (config-gated in buildAircraftState) and on-tape.
    function drawCharSpeeds(cur: number, s?: AircraftState) {
      const h = $("charSpd"); if (!h) return; h.innerHTML = "";
      const yFor = (spd: number) => SPD.cy - (spd - cur) * SPD.pxK;
      const on = (y: number) => y >= 1010 && y <= 3160;
      const letter = (x: number, y: number, t: string) =>
        h!.appendChild(mk("text", { x, y: y + 52, "font-size": 150, "text-anchor": "start", class: "fnt grn" }, t));
      if (s?.greenDot != null) { const y = yFor(s.greenDot); if (on(y)) h.appendChild(mk("circle", { cx: 483.94, cy: y, r: 30, fill: "none", stroke: "#3ad63a", "stroke-width": 14 })); }
      if (s?.sSpeed != null)  { const y = yFor(s.sSpeed);  if (on(y)) { h.appendChild(mk("line", { x1: 432, y1: y, x2: 536, y2: y, stroke: "#3ad63a", "stroke-width": 14 })); letter(556, y, "S"); } }
      if (s?.fSpeed != null)  { const y = yFor(s.fSpeed);  if (on(y)) { h.appendChild(mk("line", { x1: 432, y1: y, x2: 536, y2: y, stroke: "#3ad63a", "stroke-width": 14 })); letter(556, y, "F"); } }
      // Takeoff speeds (cyan; shown during the roll, gone at liftoff — the branch clears v1/vr once airborne).
      if (s?.v1 != null) { const y = yFor(s.v1); if (on(y)) { h.appendChild(mk("line", { x1: 432, y1: y, x2: 536, y2: y, stroke: "#2dc3e8", "stroke-width": 14 })); h.appendChild(mk("text", { x: 556, y: y + 52, "font-size": 150, "text-anchor": "start", class: "fnt", fill: "#2dc3e8" }, "1")); } }  // V1 = cyan tick + "1" (like F/S)
      if (s?.vr != null) { const y = yFor(s.vr); if (on(y)) h.appendChild(mk("circle", { cx: 483.94, cy: y, r: 30, fill: "none", stroke: "#2dc3e8", "stroke-width": 14 })); }  // VR = cyan circle (like the green dot)
      if (s?.vfeNext != null) { const y = yFor(s.vfeNext); if (on(y)) { h.appendChild(mk("line", { x1: 483.94, y1: y - 16, x2: 402.35, y2: y - 16, stroke: "#ee8f2e", "stroke-width": 14 })); h.appendChild(mk("line", { x1: 483.94, y1: y + 16, x2: 402.35, y2: y + 16, stroke: "#ee8f2e", "stroke-width": 14 })); } }  // "=" length = speed-tick length (402.35); brighter amber
    }
    function hdgScale(cur: number) {
      const h = $("hdgScale"); if (!h) return; h.innerHTML = "";
      for (let d = Math.round((cur - 40) / 5) * 5; d <= cur + 40; d += 5) {
        const dd = ((d % 360) + 360) % 360;
        const x = HDG.cx + (d - cur) * HDG.pxD;
        if (x < 835 || x > 2700) continue;
        h.appendChild(mk("line", { x1: x, y1: 3727.84, x2: x, y2: dd % 10 ? 3772.49 : 3829.38, class: "cls-9" }));
        if (dd % 10 === 0) h.appendChild(mk("text", { x, y: 3919, "font-size": 107, "text-anchor": "middle", class: "fnt wht" }, String(dd / 10).padStart(2, "0")));
      }
    }
    function altScale(cur: number) {
      const h = $("altScale"); if (!h) return; h.innerHTML = "";
      for (let a = Math.round((cur - 1700) / 100) * 100; a <= cur + 1700; a += 100) {
        if (a < 0) continue;
        const y = ALT.cy - (a - cur) * ALT.pxF;
        if (y < 1010 || y > 3162) continue;
        if (y > 1955 && y < 2250) continue;
        const lbl = a % 500 === 0;
        // uniform 100-ft graduation bars (same length), label every 500 ft
        h.appendChild(mk("line", { x1: 3370.31, y1: y, x2: 3322, y2: y, class: "cls-9" }));
        if (lbl) h.appendChild(mk("text", { x: 3300, y: y + 45, "font-size": 133, "text-anchor": "end", class: "fnt wht" }, String(Math.round(a / 100)).padStart(3, "0")));
      }
    }

    // ── vertical speed (FCOM DSC-31-40: pointer always shown; digital hides <200)
    function drawVS(vs: number, pivX: number, pivY: number) {
      const tipY = VSC.pivotY - Math.sign(vs) * vsPx(vs);   // tip SCALE-LOCKED (fixed zero); only the pivot/tail moves
      const nd = $("vsNeedle");
      if (nd) { nd.setAttribute("x1", String(pivX)); nd.setAttribute("y1", String(pivY)); nd.setAttribute("x2", String(VSC.tipX)); nd.setAttribute("y2", String(tipY)); (nd as SVGElement & { style: CSSStyleDeclaration }).style.display = ""; }
      const box = $("vsBox") as (SVGElement & { style: CSSStyleDeclaration }) | null; if (!box) return;
      if (Math.abs(vs) >= 200) {
        box.style.display = "";
        // box always caps the END of the green needle: climb → above the tip, descent → below the tip
        const bw = VSC.boxW, bh = VSC.boxH, bx = VSC.tipX + VSC.boxOffX;
        const by = Math.max(850, Math.min(3220, vs >= 0 ? tipY - bh - VSC.boxGap : tipY + VSC.boxGap));
        const r = $("vsBoxR"); if (r) { r.setAttribute("x", String(bx)); r.setAttribute("y", String(by)); r.setAttribute("width", String(bw)); r.setAttribute("height", String(bh)); }
        const t = $("vsVal"); if (t) { t.setAttribute("x", String(bx + bw / 2)); t.setAttribute("y", String(by + bh / 2 + VSC.boxFont * 0.34)); t.setAttribute("font-size", String(VSC.boxFont)); t.textContent = String(Math.round(Math.abs(vs) / 100)); }
      } else box.style.display = "none";
    }

    // ── flight-control law → pitch protection marks + MAN PITCH TRIM ─────────
    function drawPitchMarks(law: string) {
      const g = $("pitchMarks"); if (!g) return; g.innerHTML = "";
      const alt = law === "ALTN" || law === "DIRECT";
      const ax = PXC.arm, ay = PXC.arm * 33 / 27;
      [-1, 1].forEach(s => {
        const c = PXC.cx + s * PXC.loSep, y = PXC.loY;
        if (alt) {
          g.appendChild(mk("line", { x1: c - ax, y1: y - ay, x2: c + ax, y2: y + ay, stroke: "#f0a92a", "stroke-width": 16, "stroke-linecap": "round" }));
          g.appendChild(mk("line", { x1: c + ax, y1: y - ay, x2: c - ax, y2: y + ay, stroke: "#f0a92a", "stroke-width": 16, "stroke-linecap": "round" }));
        } else {
          g.appendChild(mk("line", { x1: c - ax, y1: y - ay * 0.5, x2: c + ax, y2: y - ay * 0.5, class: "cls-26" }));
          g.appendChild(mk("line", { x1: c - ax, y1: y + ay * 0.5, x2: c + ax, y2: y + ay * 0.5, class: "cls-26" }));
        }
      });
    }
    function drawLaw(law: string) {
      const alt = law === "ALTN" || law === "DIRECT";
      const aX = $("amberX") as (SVGElement & { style: CSSStyleDeclaration }) | null;
      const gE = $("greenEq") as (SVGElement & { style: CSSStyleDeclaration }) | null;
      if (aX) aX.style.display = alt ? "" : "none";
      if (gE) gE.style.display = alt ? "none" : "";
      drawPitchMarks(law);
      setT("ftrim", law === "DIRECT" ? "USE MAN PITCH TRIM" : "", "fnt amb");
      const ft = $("ftrim"); if (ft) { ft.setAttribute("x", String(MPT.x)); ft.setAttribute("y", String(MPT.y)); ft.setAttribute("font-size", String(MPT.font)); ft.setAttribute("letter-spacing", String(MPT.ls)); }
      // FMA dividers: all full-length white (uniform); shorten ONLY the middle one
      // (col2|col3, inside the USE MAN PITCH TRIM span) when it's shown in DIRECT law.
      const direct = law === "DIRECT";
      const d2 = $("fmaDiv2"); if (d2) d2.setAttribute("y2", direct ? "425" : "573.72");
    }

    // ── radio altimeter (shown < 2500 ft AGL) ────────────────────────────────
    function drawRA(agl: number) {
      setT("raVal", agl < 2500 ? String(Math.max(0, Math.round(agl))) : "", "fnt grn");
      const r = $("raVal"); if (r) { r.setAttribute("x", String(RA.x)); r.setAttribute("y", String(RA.y)); r.setAttribute("font-size", String(RA.font)); }
    }

    // ── speed-trend arrow (FCOM: 10-s speed projection). Shaft from the speed
    // index up (accel) / down (decel) to speed+trend, with a V arrowhead. ──────
    let trendShown = false;   // FCOM DSC-31-40 hysteresis: appears > 2 kt, disappears < 1 kt
    function drawTrend(trend: number) {
      const e = $("spdTrendArrow") as (SVGElement & { style: CSSStyleDeclaration }) | null; if (!e) return;
      const mag = Math.abs(trend);
      if (mag > 2) trendShown = true; else if (mag < 1) trendShown = false;   // hysteresis band
      if (!trendShown) { e.style.display = "none"; return; }
      e.style.display = "";
      const x = 381.9, tipY = SPD.cy - trend * SPD.pxK, dir = trend > 0 ? 1 : -1, aw = 30, ah = 55;  // trend base-X = SME-set 381.9 (2026-07-11)
      e.setAttribute("points", `${x},${SPD.cy} ${x},${tipY} ${x - aw},${tipY + dir * ah} ${x},${tipY} ${x + aw},${tipY + dir * ah}`);
    }

    // ── selected-speed bug — the DESIGNER's cyan hollow bracket (cls-19), driven
    // vertically to the FCU-selected speed (its shape/style is unchanged). ──────
    function drawSpeedBug(speed: number, selSpd?: number, managed?: boolean) {
      // FCOM DSC-31-40: the selected/managed target speed is a TRIANGLE BUG on the tape; when the
      // target is OUTSIDE the displayed tape it can't be drawn, so the target VALUE shows as a NUMBER
      // at the top (above) or bottom (below) edge — magenta #e526d7 MANAGED / cyan #2dc3e8 SELECTED.
      // The number appears ONLY off-scale; on-scale the bug carries it. [verified in pfd_work.html]
      const e = $("spdSelBug") as (SVGElement & { style: CSSStyleDeclaration }) | null;
      const num = $("spdSel") as (SVGElement & { style: CSSStyleDeclaration }) | null;
      if (selSpd == null) { if (e) e.style.display = "none"; if (num) num.style.display = "none"; return; }
      const selY = SPD.cy - (selSpd - speed) * SPD.pxK;
      if (selY < 1010 || selY > 3160) {                   // OFF-SCALE → number at the top/bottom edge, no bug
        if (e) e.style.display = "none";
        if (num) {
          num.style.display = "";
          num.style.fill = managed ? "#e526d7" : "#2dc3e8";
          num.setAttribute("y", selY < 1010 ? "974" : "3250");   // top edge (mirrors selAlt) / bottom edge
          num.textContent = String(Math.round(selSpd));
        }
        return;
      }
      if (num) num.style.display = "none";                // ON-SCALE → triangle bug, no number
      if (!e) return;
      e.style.display = "";
      e.style.stroke = managed ? "#e526d7" : "";   // MANAGED target = magenta; SELECTED = cyan (cls-19)
      e.setAttribute("transform", `translate(0 ${selY - 2082})`);  // triangle tip at the speed index (cy = 2082)
    }

    // ── altitude readout + selected alt ──────────────────────────────────────
    // Selected (FCU target) shows as a FLIGHT LEVEL when STD is set (above the
    // transition alt) and in FEET once QNH is set below it — FCOM. So the crew's
    // cleared altitudes read FL350 → FL200 → 10000 → 7000 as they descend.
    function drawReadout(alt: number, selAlt?: number) {
      setT("altBig", String(Math.floor(alt / 100)), "fnt grn");
      // last-2-digit rolling drum — big digits that FILL the readout window, showing
      // THREE values (real-PFD 20/00/80): current centred with +20 above / −20 below.
      // 5 marks are driven but the outer two sit OUTSIDE the clip (so the roll wraps
      // smoothly off-screen); only three ever show. `cur` = nearest 20-mark → the
      // centre is always a clean value at ~centre (never dropped).
      const cont = ((Math.round(alt) % 100) + 100) % 100;
      const cyD = 2150, lh = 112, cur = Math.round(cont / 20) * 20;
      // Smooth rolling drum: the whole tens counter rolls continuously with the
      // altitude (like a mechanical drum), digits transiting the window edges.
      const off = ((cont - cur) / 20) * lh;
      for (let i = 0; i < 5; i++) {
        const v = cur + (i - 2) * 20;
        const e = $("altD" + i);
        if (e) { e.textContent = String(((v % 100) + 100) % 100).padStart(2, "0"); e.setAttribute("y", String(cyD - (i - 2) * lh + off)); }
      }
      const std = alt > TRANS_ALT;
      const selTxt = selAlt == null ? "" : (std ? "FL" + Math.round(selAlt / 100) : String(selAlt));
      setT("selAlt", selTxt, "fnt blu");
    }

    // ── Baro reference (FCOM DSC-31-40): STD above the transition altitude,
    // QNH below it. Cruise FL350 = STD; QNH set on descent, in use by 7000 ft.
    function drawBaro(alt: number) {
      const q = $("qnh"); if (!q) return;
      q.innerHTML = alt > TRANS_ALT
        ? `<tspan class="cyn">STD</tspan>`
        : `<tspan class="wht">QNH </tspan><tspan class="cyn">1013</tspan>`;
    }

    // ── FMA (same mapping as the canvas drawFMA, in the SVG's 5×3 layout) ─────
    // NB: modes come from buildAircraftState — richer approach text (G/S, CAT
    // capability) depends on the scenario FMA logic (pfd-fma-logic skill).
    // FMA mode-change box (FCOM DSC-22_30-100-A): a white box frames each NEW annunciation
    // for 10 s, then clears — steady for a normal mode change (flashing 15 s only for reversions,
    // not modelled yet). Boxed per column when that column's active mode changes. [user 2026-07-04]
    const FMA_BOX_MS = 10_000;
    // ALT-capture latch — the ALT*/ALT annunciation must NOT flicker: `cz = max(150,|vs|/6)` shrinks
    // as the governor ramps the VS, so a raw threshold makes the mode cross back and forth. Latch it:
    // once ALT* engages it holds until ALT; ALT holds until a NEW capture (target change / re-descent).
    let captureLatch = 0, captureTgt: number | null = null;   // 0 = mode/armed · 1 = ALT* · 2 = ALT [user 2026-07-06]
    function drawFMA(s: ReturnType<typeof buildAircraftState>, dispAlt: number, ts: number) {
      const onGround = (s.altitude ?? 0) === 0;
      const thrMode = s.thrMode ?? "MAN TOGA", vertMode = s.vertMode ?? "SRS", latMode = s.latMode ?? "NAV";
      let vertEngaged = vertMode, showAltArmed = false;
      if (s.altArmed && s.selectedAlt != null) {
        const ad = Math.abs(dispAlt - s.selectedAlt), cz = Math.max(150, Math.abs(s.vs ?? 0) / 6);
        if (s.selectedAlt !== captureTgt || ad > cz + 200) { captureLatch = 0; captureTgt = s.selectedAlt; }
        if (ad <= 20) captureLatch = 2;                                   // ALT — level (latched)
        else if (ad <= cz || captureLatch >= 1) captureLatch = Math.max(captureLatch, 1);   // ALT* — capture (latched, no revert)
        vertEngaged = captureLatch === 2 ? "ALT" : captureLatch === 1 ? "ALT*" : vertMode;
        // ALT can never be ARMED (blue) while ALT is the ENGAGED mode (green) — guards any phase
        // that leaves vertMode "ALT" while still altArmed, which showed ALT green + ALT blue. [user 2026-07-06]
        showAltArmed = captureLatch === 0 && vertMode !== "ALT";
      } else { captureLatch = 0; captureTgt = null; }
      // FCOM DSC-22-30: A/THR annunciates THR IDLE / THR CLB only in the OPEN modes (OP DES / OP CLB /
      // SRS); in a level or path mode (ALT, ALT*, V/S, DES, G/S) the A/THR reverts to SPEED. So on every
      // level-off (ALT* capture) or in V/S, THR IDLE → SPEED. MACH (cruise) and MAN TOGA are unchanged. [user 2026-07-07]
      const pathMode = ["ALT", "ALT*", "V/S", "DES", "G/S"].includes(vertEngaged);
      const thrDisp = (pathMode && (thrMode === "THR IDLE" || thrMode === "THR CLB")) ? "SPEED" : thrMode;
      setT("f11", thrDisp, thrDisp.startsWith("MAN") ? "fnt wht" : "fnt grn");
      // Col-1 row-3 thrust CUE (FCOM DSC-22-30-100): "LVR CLB"/"LVR MCT" flashes WHITE ~1 Hz once the
      // vertical mode is selected, until the crew moves the lever to the detent. [user 2026-07-11]
      { const f13 = $("f13") as (SVGElement & { style: CSSStyleDeclaration }) | null;
        if (f13) { const cue = s.thrCue ?? ""; f13.textContent = cue; f13.style.opacity = (cue && Math.floor(ts / 500) % 2 === 0) ? "0.1" : "1"; } }
      // FMA V/S — the mode "V/S" is GREEN, the selected VALUE ("0", "−1000"…) is CYAN (blue), shown with a
      // gap, no "=". Two colours → rendered as tspans. [user cockpit photo 2026-07-12: "V/S green, 0 blue"]
      const vsVal = Math.round((s.vs ?? 0) / 50) * 50;
      const f21 = $("f21");
      if (f21) {
        if (onGround) { f21.textContent = ""; (f21 as unknown as SVGElement & { style: CSSStyleDeclaration }).style.display = "none"; }
        else {
          (f21 as unknown as SVGElement & { style: CSSStyleDeclaration }).style.display = "";
          if (vertEngaged === "V/S") {
            const val = `${vsVal < 0 ? "−" : ""}${Math.abs(vsVal)}`;
            f21.setAttribute("class", "fnt");
            // GAP between "V/S" (green) and the value (cyan) via dx — trailing spaces collapse in SVG, so
            // use an explicit offset (same pattern as baroMin). [user 2026-07-13: "space between V/S and 0"]
            f21.innerHTML = `<tspan class="grn">V/S</tspan><tspan class="blu" dx="70">${val}</tspan>`;
          } else { f21.setAttribute("class", "fnt grn"); f21.textContent = vertEngaged; }
        }
      }
      setT("f22", onGround ? "SRS" : (vertMode === "SRS" ? "CLB" : (showAltArmed ? "ALT" : "")), "fnt blu");
      setT("f31", onGround ? "" : latMode, "fnt grn");
      setT("f32", onGround && latMode === "NAV" ? "NAV" : "", "fnt blu");
      // col-4 approach capability (CAT) — intentionally EMPTY per FCOM/user (no CAT shown).
      setT("f41", "", "fnt wht");
      setT("f42", "", "fnt wht");
      // col-5 AP / FD / A-THR engagement. AP driven by state (lost after the failure).
      setT("f51", s.apEngaged ? (s.apDual ? "AP1+2" : "AP1") : "", "fnt wht");  // single AP by default (AP1); AP1+2 only when apDual set [user: "autopilot only one"]
      setT("f52", s.fdOff ? "" : "1 FD 2", "fnt wht");
      setT("f53", s.athrActive ? "A/THR" : (s.athrArmed ? "A/THR" : ""), s.athrActive ? "fnt grn" : "fnt blu");

      // ── 10-s mode-change box (FCOM: box "around each new annunciation"). FIXED, IDENTICAL
      // size for every column — the box does NOT resize to the text length; the annunciation
      // sits CENTRED inside it. Centred on the column's text x + row-1, one row (armed row
      // below NOT enclosed). col5 (engagement) uses a taller block box. [user 2026-07-04]
      const CW = 700, CH = 150, CY1 = 180;   // col 1-3 fixed box W/H + row-1 centre y (vertical pad < horizontal) [user 2026-07-05]
      const boxCfg: { id: string; sig: string; cx: number; cy: number; w: number; h: number }[] = [
        { id: "fmaBox1", sig: onGround ? "" : thrDisp,     cx: 430,  cy: CY1, w: CW, h: CH }, // box the DISPLAYED thrust (SPEED↔THR IDLE), not raw thrMode [user 2026-07-07]
        { id: "fmaBox2", sig: onGround ? "" : vertEngaged, cx: 1270, cy: CY1, w: CW, h: CH },
        { id: "fmaBox3", sig: onGround ? "" : latMode,     cx: 2170, cy: CY1, w: CW, h: CH },
        // col-5 engagement NOT boxed — loss of AP (FCOM) is not a new annunciation [user 2026-07-05]
      ];
      for (let i = 0; i < boxCfg.length; i++) {
        const c = boxCfg[i];
        // After touchdown the FMA blanks — the mode→"" transition must NOT flash a mode-change box.
        // Keep fmaPrev in sync and hide the box while on ground. [user 2026-07-06]
        if (onGround) { fmaPrev[i] = c.sig; const g = $(c.id); if (g) (g as SVGElement & { style: CSSStyleDeclaration }).style.display = "none"; continue; }
        if (fmaPrev[i] === null) fmaPrev[i] = c.sig;             // first frame: seed, no box
        else if (c.sig !== fmaPrev[i]) { fmaPrev[i] = c.sig; fmaBoxT[i] = ts; }
        const b = $(c.id); if (!b) continue;
        const el = b as SVGElement & { style: CSSStyleDeclaration };
        if (ts - fmaBoxT[i] >= FMA_BOX_MS) { el.style.display = "none"; continue; }
        b.setAttribute("x", (c.cx - c.w / 2).toFixed(0)); b.setAttribute("y", (c.cy - c.h / 2).toFixed(0));
        b.setAttribute("width", c.w.toFixed(0)); b.setAttribute("height", c.h.toFixed(0));
        el.style.display = "";
      }
    }

    // ── ILS (Delhi VIDP RWY 28 · IPLM 110.30) — GS/LOC scales + ident/freq/DME appear AT/below
    // 10 000 ft (tuned for the approach), not at cruise. DME from height on the
    // 3° glideslope: dist ≈ AGL / (tan3° × 6076) ≈ AGL / 318 NM. ────────────────
    // GS/LOC dot spacing (px per dot) measured from the scale markings in STATIC_SVG.
    const GSDOT = 383, LOCDOT = 391;
    function drawILS(dme: number, gsDev: number, locDev: number) {
      // DME comes from buildAircraftState (option-a geometry: 30 NM @ 7 000, 20 NM @ 5 000, closing
      // 20→15.60 as configured, then true 3° below 5 000) so the readout + diamonds match gsDev. [user 2026-07-06]
      // Two-stage appearance: ident/freq/DME from ≤ 30 NM; the GS/LOC scales + diamonds from ≤ 25.5 NM.
      const infoOn = dme <= 30, devOn = dme <= 25.5;
      const inf = $("ilsinfo") as (SVGElement & { style: CSSStyleDeclaration }) | null; if (inf) inf.style.display = infoOn ? "" : "none";
      const dev = $("ilsdev")  as (SVGElement & { style: CSSStyleDeclaration }) | null; if (dev) dev.style.display = devOn ? "" : "none";
      if (infoOn) { const d = $("ilsDme"); if (d) d.textContent = dme.toFixed(1); }
      if (devOn) {
        // Position the diamonds by deviation: GS +dev = fly-up (smaller y), LOC +dev = right.
        const gd = $("gsDiamond"); if (gd) gd.setAttribute("transform", `translate(0 ${(-gsDev * GSDOT).toFixed(1)})`);
        const ld = $("locDiamond"); if (ld) ld.setAttribute("transform", `translate(${(locDev * LOCDOT).toFixed(1)} 0)`);
      }
    }

    // ── animation loop ────────────────────────────────────────────────────────
    // Altitude moves at the animated VS rate (capped 2000 ft/min for gaps >200).
    // Speed & VS are RATE-LIMITED (not proportional) so they establish over a few
    // seconds — every level-off / push-over is a smooth ramp. Speed trend = the
    // FCOM 10-s projection from the live rate of speed change. buildAircraftState
    // recomputed every frame. ALT* level-off ramp + flare ramp toward 0.
    let lerpAlt = -1, lerpSpd = -1, lerpVs = 0, prevSpd = 0, trendEma = 0, prevTs = performance.now(), raf = 0;
    let lerpGsDev = 0, lerpLocDev = 0, lerpDme = -1;   // ILS diamonds + DME readout ease toward target (no step jump)
    let lerpTrend = 0;   // speed-trend tip eased continuously → smooth retract like the real tape
    let lerpPitch = 0, lerpBank = 0;   // attitude sphere, eased (liveAttitude only)
    let lerpHdg = -1;                  // animated heading — coordinated turn toward selectedHdg (init on 1st frame)
    let lerpPivX = VPIV.P0.x, lerpPivY = VPIV.P0.y;   // VS needle moving pivot, eased toward vGoalPivot [user 2026-07-11]
    const fmaPrev: (string | null)[] = [null, null, null, null];   // last signature per boxed FMA column
    const fmaBoxT = [-1e9, -1e9, -1e9, -1e9];                       // ts when each column last changed (10-s box)
    const animate = (ts: number) => {
      const deltaMs = Math.min(ts - prevTs, 100); prevTs = ts;
      // Altitude-gated descent schedule now lives in buildAircraftState (shared with
      // the canvas PFD); pass the live displayed altitude so it applies here too.
      // pass the live displayed altitude AND speed — the latter drives the approach flap-lever
      // config progression (green dot → S → F) as the aircraft decelerates. [user 2026-07-05]
      const live = buildAircraftState(stateRef.current, scenarioRef.current, elapsedMsRef.current, lerpAlt >= 0 ? lerpAlt : undefined, lerpSpd >= 0 ? lerpSpd : undefined);
      const tgtAlt = live.altitude;
      const tgtSpd = live.speed, tgtVs = live.vs;
      if (lerpAlt < 0) {
        lerpAlt = tgtAlt < 900 ? 777 : tgtAlt; lerpSpd = tgtSpd; lerpVs = tgtAlt < 900 ? 0 : tgtVs; prevSpd = lerpSpd;
      } else if (!pausedRef.current) {
        const dt = deltaMs / 1000;
        const altDiff = tgtAlt - lerpAlt, atTarget = Math.abs(altDiff) < 20;
        // rate-limited: speed ≤ ~2.5 kt/s, VS establishes at ≤ ~450 fpm/s → gentle,
        // realistic ramps in and out of every level (no snap).
        // Rollout braking: on the ground (target alt at field elev) and decelerating, the
        // stop is FAST — hard braking on limited accumulator pressure (≈9 kt/s), not the
        // gentle in-flight rate (2.5 kt/s). [user 2026-07-04]
        const onGround = ((live.altitude ?? 9999) - (live.fieldElev ?? 39)) <= 100;   // AGL, so any field (VIDP 777, VABB 39) rolls out fast
        const decelRate = onGround && tgtSpd < lerpSpd ? 9 : 2.5;
        lerpSpd += Math.sign(tgtSpd - lerpSpd) * Math.min(Math.abs(tgtSpd - lerpSpd), decelRate * dt);
        // G7 (§5c) decel ↔ VS coupling — realistic idle descent: while SLOWING in a
        // descent, shallow the descent in proportion to the speed still to lose (up to
        // −50% at ≥20 kt to lose), then restore the schedule VS as speed converges. So
        // ANY commanded speed reduction (250 kt limit, hold 210, approach decels) eases
        // the VS down IN COORDINATION with the speed, never a step. Composes with the
        // level-off capture (tgtVs already ramps to 0 there). [user 2026-07-04]
        let effVs = tgtVs;
        if (tgtVs < 0) {
          const spdErr = lerpSpd - tgtSpd;                    // >0 while decelerating
          if (spdErr > 0.5) effVs = tgtVs * (1 - Math.min(spdErr / 20, 1) * 0.5);
        }
        lerpVs  += Math.sign(effVs - lerpVs)  * Math.min(Math.abs(effVs - lerpVs),  450 * dt);
        // Altitude tracks the ACTUAL (ramping) VS — needle, digital VS and the
        // altitude drum stay consistent [user 2026-07-04]. 60 fpm floor + the 20-ft
        // snap close the last feet into the level cleanly (VS ramps → 0 at capture
        // in buildAircraftState, so this decelerates smoothly into every level-off).
        const rateMs = Math.max(Math.abs(lerpVs), 60) / 60000;
        const altStep = Math.sign(altDiff) * Math.min(Math.abs(altDiff), rateMs * deltaMs);
        lerpAlt = atTarget ? tgtAlt : lerpAlt + altStep;
        // FCOM speed-trend = 10-s projection from the LIVE rate of speed change (smoothed).
        const spdRate = (lerpSpd - prevSpd) / Math.max(0.001, dt);
        trendEma += (spdRate - trendEma) * 0.05;   // softer target (tuner-dialled) → gentle, realistic [user 2026-07-06]
        prevSpd = lerpSpd;
        // ILS diamonds ease toward their deviation target (dots) — smooth intercept → capture.
        const tgtGs = live.gsDev ?? 0, tgtLoc = live.locDev ?? 0, tgtDme = live.dme ?? 100;
        lerpGsDev  += (tgtGs  - lerpGsDev)  * Math.min(1, 1.5 * dt);
        lerpLocDev += (tgtLoc - lerpLocDev) * Math.min(1, 1.5 * dt);
        // DME eases toward the target too, so the config steps (22→21→20→18→16.5→15.6) read as a
        // smooth count-down, not an instant jump on each flap/gear card. [user 2026-07-06]
        lerpDme = lerpDme < 0 ? tgtDme : lerpDme + (tgtDme - lerpDme) * Math.min(1, 1.5 * dt);
      }
      const dSpeed = Math.round(lerpSpd);
      // Speed-trend tip driven from a CONTINUOUSLY-eased value (not integer knots) so the
      // pointer glides like the real tape. ASYMMETRIC + gentle both ways: eases IN over
      // ~2 s (grow τ≈0.7 s) and retracts even slower over ~7 s (shrink τ≈2.2 s) — no aggressive
      // snap on activation OR disappearance. Values dialled in the tuner. [user 2026-07-06]
      const tgtTrend = Math.max(-30, Math.min(30, trendEma * 10));
      const trendK = Math.abs(tgtTrend) >= Math.abs(lerpTrend) ? 1.4 : 0.45;
      lerpTrend += (tgtTrend - lerpTrend) * Math.min(1, trendK * (deltaMs / 1000));
      const dAlt = Math.round(lerpAlt);
      // VS ramps to 0 at capture in buildAircraftState (the shared governor), so the
      // displayed VS simply follows the ramped lerpVs — no extra display scaling.
      let dVs = Math.round(lerpVs / 10) * 10;
      const fe = live.fieldElev ?? 39;
      const feAgl = lerpAlt - fe;
      if (dVs < 0 && feAgl <= 60) dVs = Math.round((dVs * Math.max(0, feAgl / 60)) / 10) * 10;
      onAltRef.current?.(lerpAlt);
      onSpdRef.current?.(dSpeed);

      // ── attitude sphere — pitch/bank driven, gated so G+Y stays frozen level ──
      // K = px per pitch degree, from the ladder geometry (10° line 2101.95→2537.62).
      if (liveAttRef.current) {
        const K = 43.6, dt = deltaMs / 1000;
        // gentle easing (τ≈0.9 s) so the rotation looks smooth, not snappy [user 2026-07-09]
        lerpPitch += ((live.pitch ?? 0) - lerpPitch) * Math.min(1, 1.1 * dt);
        // ── COORDINATED TURN (FCTM 11920/9733) ──────────────────────────────────────────────────
        // The heading turns toward the FCU-selected heading; BANK is DERIVED from the heading error
        // (roll in → hold → roll out to wings-level ON the target). Turn rate ω = 1091·tan(bank)/TAS
        // (bank works AGAINST ground speed). Nominal 25° bank, FG cap 30°. When selectedHdg = heading
        // → err 0 → wings level. This owns the bank (the scenario's `bank` is ignored here). [user 2026-07-13]
        if (lerpHdg < 0) lerpHdg = live.heading ?? 0;
        const tgtHdg  = live.selectedHdg ?? live.heading ?? 0;
        const hdgErr  = ((tgtHdg - lerpHdg + 540) % 360) - 180;           // shortest arc −180..180
        const V       = Math.max(100, live.tas ?? 200);                   // TAS kt
        const cmdBank = Math.max(-25, Math.min(25, hdgErr * 3));          // hold ~25° then roll out over the last ~8°
        lerpBank += Math.sign(cmdBank - lerpBank) * Math.min(Math.abs(cmdBank - lerpBank), 15 * dt);   // roll rate 15°/s
        const omega = 1091 * Math.tan(lerpBank * Math.PI / 180) / V;      // heading rate °/s
        lerpHdg = Math.abs(hdgErr) < 0.4 ? tgtHdg : ((lerpHdg + omega * dt) % 360 + 360) % 360;   // snap the last fraction
        const t = `translate(0 ${(lerpPitch * K).toFixed(1)}) rotate(${(-lerpBank).toFixed(2)} 1770.72 2101.95)`;
        rootRef.current?.querySelectorAll<SVGElement>(".attMove").forEach((g) => g.setAttribute("transform", t));
      } else {
        lerpHdg = live.heading ?? 0;   // non-liveAttitude scenarios: raw heading, no coordinated turn
      }
      const spdLost = !!live.spdFlag;   // ADR source lost → red SPD flag, blank the tape (FCOM DSC-31-40 item 6)
      if (spdLost) {
        for (const id of ["spdScale", "vlsStrip", "vmaxStrip", "charSpd"]) { const g = $(id); if (g) g.innerHTML = ""; }
        for (const id of ["spdSelBug", "spdTrendArrow", "spdTarget"]) { const g = $(id) as (SVGElement & { style: CSSStyleDeclaration }) | null; if (g) g.style.display = "none"; }
        { const sp = $("spdSel") as (SVGElement & { style: CSSStyleDeclaration }) | null; if (sp) sp.style.display = "none"; }   // ADR lost → blank the tape, so blank the selected-speed readout too
      } else {
        spdScale(dSpeed); drawVLS(dSpeed, live.vls, live.alphaProt, live.alphaMax); drawVMAX(dSpeed, live.vmax); drawCharSpeeds(dSpeed, live);
        for (const id of ["spdSelBug", "spdTarget"]) { const g = $(id) as (SVGElement & { style: CSSStyleDeclaration }) | null; if (g) g.style.display = ""; }
        drawTrend(lerpTrend); drawSpeedBug(dSpeed, live.selectedSpeed, live.speedManaged);
      }
      hdgScale(lerpHdg); altScale(dAlt);
      // Magenta selected-heading bug: home vertical line is at x=1681.77; move it to the lubber (1772.14)
      // when selectedHdg = heading, then offset by (selectedHdg − heading)·px° so it scrolls with the tape.
      { const bug = $("hdgBugG"); if (bug) {
          const err = ((((live.selectedHdg ?? lerpHdg) - lerpHdg) + 540) % 360) - 180;   // shortest arc
          const off = (1772.14 - 1681.77) + err * HDG.pxD;                                // base + heading offset
          bug.setAttribute("transform", `translate(${off.toFixed(1)} 0)`); } }
      // SPD flag (red = source lost) / unreliable (amber caption = present-but-wrong value)
      { const sf = $("spdFlagTxt") as (SVGElement & { style: CSSStyleDeclaration }) | null;
        if (sf) { if (spdLost) { sf.style.display = ""; sf.style.fill = "#ed1e24"; sf.setAttribute("font-size", "200"); sf.setAttribute("y", "2150"); }
                  else if (live.spdUnreliable) { sf.style.display = ""; sf.style.fill = "#d67827"; sf.setAttribute("font-size", "120"); sf.setAttribute("y", "1120"); }
                  else sf.style.display = "none"; } }
      { const gp = vGoalPivot(dVs); const e = Math.min(1, 5 * (deltaMs / 1000)); lerpPivX += (gp.x - lerpPivX) * e; lerpPivY += (gp.y - lerpPivY) * e; }
      drawVS(dVs, lerpPivX, lerpPivY); drawReadout(dAlt, live.selectedAlt); drawBaro(dAlt);
      drawLaw(live.law ?? "NORMAL");
      // BARO minimum (MDA) appears only after approach preparation is complete [user 2026-07-05]
      { const bm = $("baroMin") as (SVGElement & { style: CSSStyleDeclaration }) | null; if (bm) bm.style.display = live.showBaroMin ? "" : "none"; }
      // BETA TARGET: engine-out slip index goes CYAN (blue β) when live.beta; else default (yellow). [user 2026-07-10]
      { const st = $("slipTrap") as (SVGElement & { style: CSSStyleDeclaration }) | null; if (st) st.style.stroke = live.beta ? "#2dc3e8" : ""; }
      { const fb = $("fdBars") as (SVGElement & { style: CSSStyleDeclaration }) | null; if (fb) fb.style.display = live.fdOff ? "none" : ""; }  // both FDs off → blank the FD bars
      drawFMA(live, dAlt, ts); drawILS(lerpDme < 0 ? (live.dme ?? 100) : lerpDme, lerpGsDev, lerpLocDev); drawRA(live.raInop ? 1e9 : feAgl);  // raInop → force AGL huge so RA hides
      raf = requestAnimationFrame(animate);
    };
    animate(performance.now());
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={rootRef}
      className={jost.variable}
      style={{ width: "100%", height: "100%" }}
      dangerouslySetInnerHTML={{
        __html: `<svg class="svgpfd-scope" viewBox="0 0 4111.21 4096" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" style="width:100%;height:100%;display:block;background:#000;-webkit-font-smoothing:antialiased">${STATIC_SVG}</svg>`,
      }}
    />
  );
}
