"use client";

// A320 ENGINE SD (secondary engine page, lower ECAM) — ENG 1 FIRE.
// Shown while the fire failure is active, BEFORE the STATUS page (mirrors HydSdPage).
//
// ⚠️ A FIRE IS NOT AN ENGINE FAILURE. [user 2026-07-14] At the fire the engine is STILL RUNNING, so
// BOTH engines read normal — no failed indication. The affected engine's values only come DOWN AFTER
// the crew brings THR LEVER 1 to IDLE (step `thr_lever_idle`). So this page has two states via `secured`:
//   • secured=false (fire, pre-idle): both engines normal running values, start-air valves green, no XX.
//   • secured=true  (post THR IDLE):  ENG 1 (LEFT) comes down — OIL PSI drops (amber), VIB drops, and the
//     start-air PSI reads amber XX + amber valve (pneumatic source off on the secured side).
// NO crosses on the MAIN params (F.USED/OIL/VIB) in either state — only the start-air. DRAFT come-down
// values — SME to confirm the exact numbers.
//
// Static markup → inlined SVG string. cls-N Illustrator names COLLIDE with svg-pfd / hyd-sd, so the
// sheet is wrapped in @scope (.enginesd-scope) (documented gotcha).

function buildEngineSvg(secured: boolean): string {
  // ENG 1 (LEFT) values — normal running vs. secured/coming-down.
  const psi1 = secured
    ? `<text class="cls-5 xx-amber" transform="translate(1180.7446 1996.6255) scale(.9892 1)"><tspan x="0" y="0">15</tspan></text>`
    : `<text class="cls-5" transform="translate(1180.7446 1996.6255) scale(.9892 1)"><tspan x="0" y="0">38</tspan></text>`;
  const vib1n1 = secured
    ? `<text class="cls-5" transform="translate(1101.54 2529.9092) scale(1.2714 1)"><tspan x="0" y="0">0</tspan><tspan class="cls-19" x="95.03" y="0">.</tspan><tspan x="130.22" y="0">1</tspan></text>`
    : `<text class="cls-5" transform="translate(1101.54 2529.9092) scale(1.2714 1)"><tspan x="0" y="0">0</tspan><tspan class="cls-19" x="95.03" y="0">.</tspan><tspan x="130.22" y="0">5</tspan></text>`;
  const vib1n2 = secured
    ? `<text class="cls-5" transform="translate(1101.54 2737.3453) scale(1.2714 1)"><tspan x="0" y="0">0</tspan><tspan class="cls-19" x="95.03" y="0">.</tspan><tspan x="130.22" y="0">1</tspan></text>`
    : `<text class="cls-5" transform="translate(1101.54 2737.3453) scale(1.2714 1)"><tspan x="0" y="0">0</tspan><tspan class="cls-19" x="95.03" y="0">.</tspan><tspan x="130.22" y="0">4</tspan></text>`;
  const start1 = secured
    ? `<text class="cls-5 xx-amber" transform="translate(1142.3846 3400.4484) scale(1.1706 1)"><tspan x="0" y="0">XX</tspan></text>`
    : `<text class="cls-5" transform="translate(1142.3846 3400.4484) scale(1.1706 1)"><tspan x="0" y="0">45</tspan></text>`;
  const valveCls = secured ? "cls-16 amber-stroke" : "cls-16"; // ENG 1 start valve: amber once secured
  // ENG 1 OIL-PSI pointer: normal = green, pointing to the high (right) end. Secured = amber, swung to
  // the LOW end (toward the red low-limit mark) so the gauge visibly comes down with the value.
  const psiPtr1 = secured
    ? `<line class="cls-16 amber-stroke" x1="965" y1="1847.22" x2="1267.65" y2="1847.22"/>`
    : `<line class="cls-16" x1="1267.65" y1="1847.22" x2="1619.8" y2="1847.22"/>`;
  // F.USED — ENG 1 (left) freezes at shutdown; ENG 2 (right) keeps burning, so it reads HIGHER once
  // ENG 1 is secured (the failed engine has used LESS). DRAFT gap — SME/user to confirm exact figures.
  const fused2 = secured
    ? `<text class="cls-12" transform="translate(2610.7783 608.8579) scale(.96 1)"><tspan x="0" y="0">3210</tspan></text>`
    : `<text class="cls-12" transform="translate(2610.7783 608.8579) scale(.96 1)"><tspan x="0" y="0">3098</tspan></text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" class="enginesd-scope" viewBox="0 0 4126.58 3545" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">
  <defs>
    <style>
      @scope (.enginesd-scope) {
      .cls-1 { letter-spacing: 0em; }
      .cls-2 { font-size: 115.04px; }
      .cls-2, .cls-3, .cls-4, .cls-5, .cls-6, .cls-7, .cls-8, .cls-9, .cls-10, .cls-11, .cls-12, .cls-13 { font-family: Futura-Medium, Futura, var(--font-b612), sans-serif; font-weight: 500; }
      .cls-2, .cls-3, .cls-7, .cls-10, .cls-11 { fill: #2dc3e8; }
      .cls-3 { font-size: 105.3px; }
      .cls-14 { stroke: #ed1e24; }
      .cls-14, .cls-15, .cls-16 { fill: none; stroke-miterlimit: 10; stroke-width: 15px; }
      .cls-15 { stroke: #fff; }
      .cls-4 { font-size: 100.07px; }
      .cls-4, .cls-8, .cls-9, .cls-13 { fill: #fff; }
      .cls-5 { font-size: 153.97px; }
      .cls-5, .cls-6, .cls-12 { fill: #5aba47; }
      .cls-6, .cls-8 { font-size: 133.31px; }
      .cls-7 { font-size: 41.56px; }
      .cls-16 { stroke: #5aba47; }
      .cls-9 { font-size: 137.21px; }
      .cls-10 { font-size: 127.09px; }
      .cls-11 { font-size: 131.31px; }
      .cls-19, .cls-20 { letter-spacing: -.08em; }
      .cls-21 { letter-spacing: -.07em; }
      .cls-22 { letter-spacing: -.06em; }
      .cls-23, .cls-24, .cls-25, .cls-26, .cls-27, .cls-28 { letter-spacing: -.04em; }
      .cls-29, .cls-30 { letter-spacing: -.03em; }
      .cls-12 { font-size: 157.83px; }
      .cls-13 { font-size: 188.35px; }
      .cls-17, .cls-18, .cls-31, .cls-32 { letter-spacing: 0em; }
      /* secured ENG 1 — amber where it comes down. Defined LAST so it wins fill/stroke (source order). */
      .xx-amber { fill: #e8a13a; }
      .amber-stroke { stroke: #e8a13a; }
      }
    </style>
  </defs>
  <g id="BLACK_BCKRND" data-name="BLACK BCKRND">
    <rect width="4126.58" height="4096"/>
  </g>
  <g id="BOTTOM_PART" data-name="BOTTOM PART">
    <line class="cls-15" x1="39.55" y1="3545.48" x2="4061.11" y2="3545.48"/>
    <line class="cls-15" x1="1377.32" y1="4089.29" x2="1377.32" y2="3545.48"/>
    <line class="cls-15" x1="2724.07" y1="4096" x2="2724.07" y2="3545.48"/>
    <text class="cls-8" transform="translate(278.4243 3696.8242) scale(1.1365 1)"><tspan class="cls-28" x="0" y="0">T</tspan><tspan class="cls-25" x="58.85" y="0">A</tspan><tspan x="152" y="0">T</tspan></text>
    <text class="cls-6" transform="translate(639.1014 3702.5303) scale(1.1365 1)"><tspan x="0" y="0">+</tspan><tspan class="cls-20" x="82.28" y="0">3</tspan><tspan class="cls-1" x="154.01" y="0">3</tspan></text>
    <text class="cls-3" transform="translate(1101.8633 3705.5107) scale(.845 1)"><tspan x="0" y="0">C</tspan></text>
    <text class="cls-3" transform="translate(2018.0024 3872.5) scale(.9298 1)"><tspan x="0" y="0">H</tspan></text>
    <text class="cls-3" transform="translate(3816.0391 3701.8457) scale(.9723 1)"><tspan class="cls-27" x="0" y="0">K</tspan><tspan x="65.24" y="0">G</tspan></text>
    <text class="cls-7" transform="translate(1058.8169 3650.3896) scale(.902 1)"><tspan x="0" y="0">O</tspan></text>
    <text class="cls-7" transform="translate(1058.8169 3814.3841) scale(.902 1)"><tspan x="0" y="0">O</tspan></text>
    <text class="cls-3" transform="translate(1101.8633 3870.8014) scale(.845 1)"><tspan x="0" y="0">C</tspan></text>
    <text class="cls-6" transform="translate(641.8866 3869.0117) scale(1.1365 1)"><tspan x="0" y="0">+</tspan><tspan class="cls-20" x="82.28" y="0">3</tspan><tspan class="cls-1" x="154.01" y="0">0</tspan></text>
    <text class="cls-6" transform="translate(1790.2542 3867.4901) scale(1.1365 1)"><tspan x="0" y="0">04</tspan></text>
    <text class="cls-6" transform="translate(2156.2651 3876.527) scale(1.1365 1)"><tspan class="cls-20" x="0" y="0">3</tspan><tspan x="71.73" y="0">0</tspan></text>
    <text class="cls-6" transform="translate(3229.7849 3707.4039) scale(1.1365 1)"><tspan x="0" y="0">6</tspan><tspan class="cls-30" x="82.28" y="0">5</tspan><tspan x="160.72" y="0">000</tspan></text>
    <text class="cls-8" transform="translate(2846.9395 3707.4043) scale(.761 1)"><tspan class="cls-23" x="0" y="0">G</tspan><tspan class="cls-18" x="109.88" y="0">W</tspan></text>
    <text class="cls-9" transform="translate(263.7886 3869.0117) scale(1.1042 1)"><tspan class="cls-31" x="0" y="0">S</tspan><tspan class="cls-24" x="78.93" y="0">A</tspan><tspan x="174.8" y="0">T</tspan></text>
  </g>
  <g id="Fuel_used_indication" data-name="Fuel used indication">
    <text class="cls-8" transform="translate(1819.5786 530.1581)"><tspan x="0" y="0">F .USED</tspan></text>
    ${fused2}
    <text class="cls-12" transform="translate(1196.2361 608.8579) scale(.96 1)"><tspan x="0" y="0">3111</tspan></text>
    <text class="cls-11" transform="translate(1971.71 678.9873) scale(.8942 1)"><tspan class="cls-26" x="0" y="0">K</tspan><tspan x="81.37" y="0">G</tspan></text>
    <line class="cls-15" x1="1516.42" y1="530.16" x2="1713.19" y2="513.6"/>
    <line class="cls-15" x1="2400.92" y1="513.6" x2="2593.46" y2="530.16"/>
  </g>
  <g id="OIL_QUANTITY_INDICATION" data-name="OIL QUANTITY INDICATION">
    <text class="cls-8" transform="translate(1948.622 974.495) scale(.9136 1)"><tspan x="0" y="0">OIL</tspan></text>
    <text class="cls-12" transform="translate(1135.8867 1312.9357) scale(.96 1)"><tspan x="0" y="0">15.1</tspan></text>
    <text class="cls-4" transform="translate(1408.4779 1191.9421) scale(.96 1)"><tspan x="0" y="0">25</tspan></text>
    <text class="cls-4" transform="translate(1029.6613 1191.9421) scale(.96 1)"><tspan x="0" y="0">0</tspan></text>
    <text class="cls-4" transform="translate(2978.0911 1194.0656) scale(.96 1)"><tspan x="0" y="0">25</tspan></text>
    <text class="cls-4" transform="translate(2599.2745 1194.0656) scale(.96 1)"><tspan x="0" y="0">0</tspan></text>
    <text class="cls-12" transform="translate(2708.7047 1318.279) scale(.96 1)"><tspan x="0" y="0">15.1</tspan></text>
    <text class="cls-11" transform="translate(1967.2163 1178.5204) scale(.8942 1)"><tspan x="0" y="0">QT</tspan></text>
    <path class="cls-15" d="M967.01,1162.34h-29.95s15.35-338.05,328.07-338.05c39.64,0,286.36-1.54,333.11,330.34"/>
    <line class="cls-15" x1="1265.17" y1="862.04" x2="1265.17" y2="824.29"/>
    <line class="cls-16" x1="1267.65" y1="1159.68" x2="1619.8" y2="1159.68"/>
    <path class="cls-15" d="M2539.76,1162.34h-29.95s15.35-338.05,328.07-338.05c39.64,0,286.36-1.54,333.11,330.34"/>
    <line class="cls-15" x1="2840.4" y1="862.04" x2="2840.4" y2="824.29"/>
    <line class="cls-16" x1="2850.22" y1="1159.68" x2="3202.36" y2="1159.68"/>
  </g>
  <g id="OIL_PRESSURE" data-name="OIL PRESSURE">
    ${psi1}
    <text class="cls-5" transform="translate(2746.2321 1998.5029) scale(.9892 1)"><tspan x="0" y="0">38</tspan></text>
    <text class="cls-11" transform="translate(1933.2617 1861.1758) scale(1.2199 1)"><tspan x="0" y="0">PSI</tspan></text>
    <path class="cls-15" d="M963.86,1718.5s66.37-197.36,301.27-206.67c39.61-1.57,286.36-1.54,333.11,330.34"/>
    <line class="cls-15" x1="1265.17" y1="1549.58" x2="1265.17" y2="1511.83"/>
    ${psiPtr1}
    <path class="cls-14" d="M936.92,1844.61s19.09-118.01,28.47-130.23"/>
    <path class="cls-15" d="M2533.61,1715.98s66.37-197.36,301.27-206.67c39.61-1.57,286.36-1.54,333.11,330.34"/>
    <line class="cls-15" x1="2834.92" y1="1547.06" x2="2834.92" y2="1509.3"/>
    <line class="cls-16" x1="2837.39" y1="1844.69" x2="3189.54" y2="1844.69"/>
    <path class="cls-14" d="M2506.66,1842.09s19.09-118.01,28.47-130.23"/>
  </g>
  <g id="OIL_TEMP" data-name="OIL TEMP">
    <text class="cls-2" transform="translate(2052.5996 2162.9326) scale(.9438 1)"><tspan x="0" y="0">C</tspan></text>
    <text class="cls-7" transform="translate(2004.9538 2098.498) scale(.902 1)"><tspan x="0" y="0">O</tspan></text>
    <line class="cls-15" x1="1509.48" y1="2147.18" x2="1706.26" y2="2130.62"/>
    <line class="cls-15" x1="2393.99" y1="2130.62" x2="2586.52" y2="2147.18"/>
    <text class="cls-5" transform="translate(1154.1845 2241.3016) scale(.9892 1)"><tspan class="cls-21" x="0" y="0">8</tspan><tspan x="83.75" y="0">5</tspan></text>
    <text class="cls-5" transform="translate(2726.1562 2248.6543) scale(1.0953 1)"><tspan class="cls-22" x="0" y="0">8</tspan><tspan class="cls-29" x="85.78" y="0">4</tspan></text>
  </g>
  <g id="N1_AND_N2_VIBRATIONS" data-name="N1 AND N2 VIBRATIONS">
    <text class="cls-10" transform="translate(1811.3101 2509.0889) scale(1.2562 1)"><tspan x="0" y="0">VIB</tspan></text>
    <text class="cls-10" transform="translate(2129.9774 2510.324) scale(.8792 1)"><tspan x="0" y="0">N1</tspan></text>
    <text class="cls-10" transform="translate(2129.9774 2717.3377) scale(.8792 1)"><tspan x="0" y="0">N2</tspan></text>
    <line class="cls-15" x1="1505.57" y1="2472.7" x2="1702.34" y2="2456.14"/>
    <line class="cls-15" x1="1505.57" y1="2678.62" x2="1702.34" y2="2662.06"/>
    <line class="cls-15" x1="2390.07" y1="2456.14" x2="2582.61" y2="2472.7"/>
    <line class="cls-15" x1="2390.07" y1="2662.06" x2="2582.61" y2="2678.62"/>
    ${vib1n1}
    ${vib1n2}
    <text class="cls-5" transform="translate(2724.0663 2529.9092) scale(1.2714 1)"><tspan x="0" y="0">0</tspan><tspan class="cls-19" x="95.03" y="0">.</tspan><tspan x="130.22" y="0">6</tspan></text>
    <text class="cls-5" transform="translate(2724.0663 2737.3453) scale(1.2714 1)"><tspan x="0" y="0">0</tspan><tspan class="cls-19" x="95.03" y="0">.</tspan><tspan x="130.22" y="0">4</tspan></text>
  </g>
  <g id="PSI">
    <circle class="${valveCls}" cx="1245.6" cy="3111.72" r="82.93"/>
    <circle class="cls-16" cx="2863.16" cy="3116.06" r="82.93"/>
    <text class="cls-10" transform="translate(1929.3279 3393.8891) scale(1.2335 1)"><tspan x="0" y="0">PSI</tspan></text>
    <line class="cls-15" x1="1525.37" y1="3348.89" x2="1722.15" y2="3332.33"/>
    <line class="cls-15" x1="2409.88" y1="3332.33" x2="2602.41" y2="3348.89"/>
    ${start1}
    <text class="cls-5" transform="translate(2757.0795 3404.0009) scale(1.1632 1)"><tspan x="0" y="0">45</tspan></text>
    <line class="${valveCls}" x1="1167.2" y1="3111.72" x2="1328.53" y2="3111.72"/>
    <line class="${valveCls}" x1="1245.6" y1="3197.69" x2="1245.6" y2="3249.02"/>
    <line class="cls-16" x1="2783.62" y1="3118.68" x2="2943.09" y2="3118.68"/>
    <polyline class="cls-16" points="2863.16 3198.99 2863.16 3198.99 2863.16 3248.85"/>
  </g>
  <g id="ENGINE">
    <text class="cls-13" transform="translate(100.61 236.78) scale(.89 1)"><tspan x="0" y="0">E</tspan><tspan class="cls-32" x="106.5" y="0">N</tspan><tspan x="266.99" y="0">GINE</tspan></text>
    <line class="cls-15" x1="110.12" y1="250.86" x2="763.51" y2="250.86"/>
  </g>
</svg>`;
}

export function EngineSdPage({ secured = false }: { secured?: boolean }) {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex" }}
      dangerouslySetInnerHTML={{ __html: buildEngineSvg(secured) }} />
  );
}
