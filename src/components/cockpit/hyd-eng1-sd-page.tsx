"use client";

// A320 HYD SD synoptic — ENG 1 FIRE / FAIL: the GREEN engine-1 pump is lost, but GREEN pressure stays
// NORMAL because the PTU repressurises it from YELLOW. So: all three systems show normal pressure, the
// PTU is running (green), and only the GREEN engine-driven pump reads amber + "LO". Mirrors the user's
// HYD reference image (which showed the same on the YELLOW/ENG 2 side).
//
// Distinct from `hyd-sd-page.tsx` (that one = DUAL HYD G+Y, both systems failed). This is the ENG-1
// single-pump-loss case.
//
// Source: user designer SVG (Downloads/hyd display.svg). Baked inline; cls-N Illustrator names collide
// with svg-pfd / hyd-sd / enginesd, so wrapped in @scope (.hydeng1-scope) to stay local (documented).

const HYD_ENG1_SVG = `<svg xmlns="http://www.w3.org/2000/svg" class="hydeng1-scope" viewBox="0 0 4097 3555" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">
  <defs>
    <style>
      @scope (.hydeng1-scope) {
      .cls-1 { font-size: 102.52px; }
      .cls-1, .cls-2, .cls-3, .cls-4, .cls-5, .cls-6, .cls-7, .cls-8, .cls-9, .cls-10, .cls-11, .cls-12 { font-family: Futura-Medium, Futura, var(--font-b612), sans-serif; font-weight: 500; }
      .cls-1, .cls-2, .cls-11 { fill: #2dc3e8; }
      .cls-13, .cls-14, .cls-31 { letter-spacing: 0em; }
      .cls-15 { stroke: #d67827; }
      .cls-15, .cls-16, .cls-17 { fill: none; stroke-width: 15px; }
      .cls-15, .cls-16, .cls-17, .cls-18 { stroke-miterlimit: 10; }
      .cls-16 { stroke: #fff; }
      .cls-2 { font-size: 46.48px; }
      .cls-3 { font-size: 140.56px; }
      .cls-3, .cls-12 { fill: #5aba47; }
      .cls-4, .cls-5, .cls-6, .cls-7, .cls-8, .cls-9, .cls-10 { fill: #fff; }
      .cls-4, .cls-11 { font-size: 124.7px; }
      .cls-17 { stroke: #5aba47; }
      .cls-5 { font-size: 153.18px; }
      .cls-6 { font-size: 142.43px; }
      .cls-7, .cls-12 { font-size: 157.58px; }
      .cls-8 { font-size: 140.61px; }
      .cls-9 { font-size: 146.11px; }
      .cls-10 { font-size: 168.86px; }
      .cls-19 { letter-spacing: -.08em; }
      .cls-20 { letter-spacing: -.07em; }
      .cls-21, .cls-22 { letter-spacing: -.02em; }
      .cls-23, .cls-24, .cls-25, .cls-26, .cls-27 { letter-spacing: -.04em; }
      .cls-28, .cls-29, .cls-30 { letter-spacing: -.03em; }
      .cls-18 { stroke: #231f20; }
      /* ENG 1 pump LOST — amber pump box + LO. Defined LAST so it beats cls-17 green (source order). */
      .amber-stroke { stroke: #e8a13a; }
      .amber-fill { fill: #e8a13a; }
      .lo { fill: #e8a13a; font-size: 130px; }
      /* PTU RUNNING — supplying GREEN (FCOM DSC-29: green when running). Filled triangles = working. */
      .ptu-run { fill: #5aba47; }
      }
    </style>
  </defs>
  <g id="black_background"><rect class="cls-18" x=".5" y=".5" width="4096" height="4096"/></g>
  <g id="bottom_part">
    <line class="cls-16" x1="28.78" y1="3554.52" x2="4063.71" y2="3568.52"/>
    <line class="cls-16" x1="1367.88" y1="4096.5" x2="1367.88" y2="3568.52"/>
    <line class="cls-16" x1="2718.31" y1="4091.5" x2="2718.31" y2="3568.52"/>
    <text class="cls-8" transform="translate(265.1489 3715.9707) scale(1.0772 1)"><tspan class="cls-27" x="0" y="0">T</tspan><tspan class="cls-25" x="62.07" y="0">A</tspan><tspan class="cls-13" x="160.31" y="0">T</tspan></text>
    <text class="cls-6" transform="translate(2843.5996 3727.71) scale(.6923 1)"><tspan class="cls-21" x="0" y="0">G</tspan><tspan x="117.39" y="0">W</tspan></text>
    <text class="cls-9" transform="translate(259.1558 3884.209) scale(.9744 1)"><tspan class="cls-31" x="0" y="0">S</tspan><tspan class="cls-23" x="84.04" y="0">A</tspan><tspan x="186.13" y="0">T</tspan></text>
    <text class="cls-3" transform="translate(633.1558 3720.0986) scale(1.059 1)"><tspan x="0" y="0">+</tspan><tspan class="cls-19" x="86.75" y="0">3</tspan><tspan x="162.39" y="0">3</tspan></text>
    <text class="cls-3" transform="translate(1775.0193 3885.4861) scale(1.059 1)"><tspan x="0" y="0">04</tspan></text>
    <text class="cls-3" transform="translate(2147.1897 3896.5482) scale(1.059 1)"><tspan class="cls-20" x="0" y="0">3</tspan><tspan x="76.66" y="0">0</tspan></text>
    <text class="cls-3" transform="translate(3229.2307 3724.5985) scale(1.059 1)"><tspan x="0" y="0">6</tspan><tspan class="cls-29" x="86.75" y="0">5</tspan><tspan x="169.46" y="0">000</tspan></text>
    <text class="cls-1" transform="translate(1090.3525 3717.7705)"><tspan x="0" y="0">C</tspan></text>
    <text class="cls-1" transform="translate(2007.6294 3888.9418)"><tspan x="0" y="0">H</tspan></text>
    <text class="cls-1" transform="translate(3812.3599 3712.7726)"><tspan class="cls-26" x="0" y="0">K</tspan><tspan x="63.52" y="0">G</tspan></text>
    <text class="cls-2" transform="translate(1044.2334 3667.5552)"><tspan x="0" y="0">O</tspan></text>
    <text class="cls-2" transform="translate(1044.2334 3832.5113)"><tspan x="0" y="0">O</tspan></text>
    <text class="cls-1" transform="translate(1090.3525 3881.7325)"><tspan x="0" y="0">C</tspan></text>
    <text class="cls-3" transform="translate(633.8282 3886.2061) scale(1.059 1)"><tspan x="0" y="0">+</tspan><tspan class="cls-19" x="86.75" y="0">3</tspan><tspan x="162.39" y="0">0</tspan></text>
  </g>
  <g id="RESERVIOR_QUANTITY">
    <line class="cls-16" x1="3324.65" y1="2761.64" x2="3324.65" y2="3225.09"/>
    <path class="cls-17" d="M3321.9,3414.1h-44.65c-.55,0-1-.45-1-1v-548.63c0-.55.45-1,1-1h44.98c.89,0,1.34-1.08.71-1.71l-51.45-51.45"/>
    <path class="cls-17" d="M3327.63,2893.57h32.43c.55,0,1-.45,1-1v-136.95c0-.55-.45-1-1-1h-42.84"/>
    <rect class="cls-15" x="3323.07" y="3225.09" width="32.83" height="189.01"/>
    <line class="cls-16" x1="2032.88" y1="2747.95" x2="2032.88" y2="3164.91"/>
    <path class="cls-17" d="M2030.13,3408.38h-44.65c-.55,0-1-.41-1-.92v-504.36c0-.51.45-.92,1-.92h44.98c.89,0,1.34-.99.71-1.57l-51.45-47.3"/>
    <path class="cls-17" d="M2035.85,2914.68h32.43c.55,0,1-.51,1-1.15v-157.46c0-.63-.45-1.15-1-1.15h-42.84"/>
    <rect class="cls-15" x="2031.3" y="3170.55" width="32.83" height="241.38"/>
    <line class="cls-16" x1="770.72" y1="2752.74" x2="770.72" y2="3245.85"/>
    <path class="cls-17" d="M767.73,3408.06h-52.6c-.65,0-1.18-.45-1.18-1v-551.02c0-.55.53-1,1.18-1h53c1.05,0,1.58-1.08.83-1.71l-60.61-51.67"/>
    <path class="cls-17" d="M770.77,2864.43h23.35c.4,0,.72-.38.72-.85v-117.03c0-.47-.32-.85-.72-.85h-30.85"/>
    <rect class="cls-15" x="765.35" y="3250.43" width="31.32" height="157.63"/>
  </g>
  <g id="FIRE_VALVE">
    <circle class="cls-17" cx="3329.64" cy="2427.97" r="109.17"/>
    <ellipse class="cls-17" cx="775.7" cy="2417.61" rx="109.17" ry="109.64"/>
  </g>
  <g id="ELEC">
    <line class="cls-17" x1="3334.07" y1="908.36" x2="3328.07" y2="2748.31"/>
    <text class="cls-4" transform="translate(3557.0547 1615.2432) scale(1.1566 1)"><tspan x="0" y="0">ELEC</tspan></text>
  </g>
  <g id="YELLOW_ELEC_PUMP">
    <polygon class="cls-16" points="3521.32 1501.79 3521.32 1631.74 3397.87 1566.76 3521.32 1501.79"/>
  </g>
  <g id="PTU">
    <polygon class="cls-17 ptu-run" points="2838.51 1262.17 2838.51 1132.22 2961.96 1197.19 2838.51 1262.17"/>
    <polygon class="cls-17" points="3334.07 336.34 3276.19 458.75 3398.6 458.75 3334.07 336.34"/>
    <text class="cls-4" transform="translate(2545.5984 1245.1854) scale(1.1566 1)"><tspan x="0" y="0">PTU</tspan></text>
  </g>
  <g id="RAM_AIR_TURBINE">
    <polygon class="cls-16" points="1858.04 1631.83 1858.04 1501.88 1981.49 1566.85 1858.04 1631.83"/>
    <polygon class="cls-17 ptu-run" points="2509.89 1131.82 2509.89 1261.77 2386.44 1196.8 2509.89 1131.82"/>
    <polygon class="cls-17" points="1494.28 1131.82 1494.28 1261.77 1370.82 1196.8 1494.28 1131.82"/>
    <polygon class="cls-17" points="2113.47 459.73 1983.53 459.73 2048.5 336.28 2113.47 459.73"/>
    <polygon class="cls-17" points="831.76 464.24 701.81 464.24 766.78 340.79 831.76 464.24"/>
    <text class="cls-4" transform="translate(2220.8745 2057.7191) scale(1.1566 1)"><tspan x="0" y="0">ELEC</tspan></text>
    <text class="cls-4" transform="translate(1565.5663 1610.7648) scale(1.1566 1)"><tspan x="0" y="0">R</tspan><tspan class="cls-24" x="75.08" y="0">A</tspan><tspan x="162.21" y="0">T</tspan></text>
    <line class="cls-17" x1="2042.29" y1="901.13" x2="2036.29" y2="2758.22"/>
    <rect class="cls-17" x="1939.33" y="2099.13" width="218.33" height="218.33"/>
    <path class="cls-17" d="M2383.33,1196.8h-221.7s-3.48,117.37-113.13,130.41c0,0-102.05-11.95-111.83-130.41h-435.79"/>
  </g>
  <g id="SYSTEM_LABEL">
    <text class="cls-7" transform="translate(3045.6504 631.1724) scale(.9648 1)"><tspan x="0" y="0">YEL</tspan><tspan class="cls-30" x="253.53" y="0">L</tspan><tspan class="cls-28" x="318.54" y="0">O</tspan><tspan class="cls-14" x="454.27" y="0">W</tspan></text>
    <text class="cls-7" transform="translate(1851.3677 631.1724) scale(1.0691 1)"><tspan x="0" y="0">B</tspan><tspan class="cls-22" x="93.18" y="0">L</tspan><tspan x="159.43" y="0">UE</tspan></text>
    <text class="cls-7" transform="translate(515.85 629.14) scale(.92 1)"><tspan x="0" y="0">GREEN</tspan></text>
  </g>
  <g id="HYD">
    <text class="cls-7" transform="translate(1875.0072 196.2826) scale(1.0691 1)"><tspan x="0" y="0">HYD</tspan></text>
    <line class="cls-16" x1="1890.22" y1="215.14" x2="2213.11" y2="215.14"/>
  </g>
  <g id="SYSTEM_PRESSURE">
    <text class="cls-12" transform="translate(3146.3942 851.0899) scale(.9648 1)"><tspan x="0" y="0">2997</tspan></text>
    <text class="cls-12" transform="translate(1860.8276 850.6318) scale(.9648 1)"><tspan x="0" y="0">3000</tspan></text>
    <text class="cls-12" transform="translate(579.11 849.14) scale(.96 1)"><tspan x="0" y="0">2998</tspan></text>
    <text class="cls-11" transform="translate(1292.5559 855.1404) scale(1.1566 1)"><tspan x="0" y="0">PSI</tspan></text>
    <text class="cls-11" transform="translate(2582.0799 859.8417) scale(1.1566 1)"><tspan x="0" y="0">PSI</tspan></text>
  </g>
  <g id="PUMP_LEGEND">
    <text class="cls-5" transform="translate(1051.4141 2167.9619) scale(.987 1)"><tspan x="0" y="0">1</tspan></text>
    <text class="cls-10" transform="translate(2946.1582 2172.0586) scale(.953 1)"><tspan x="0" y="0">2</tspan></text>
  </g>
  <g id="ENGINE_PUMP_CONTROL_AND_PRESSION">
    <rect class="cls-17" x="3220.47" y="1772.86" width="218.33" height="218.33"/>
    <line class="cls-17" x1="780.13" y1="902.44" x2="774.13" y2="2739.36"/>
    <rect class="cls-17 amber-stroke" x="666.54" y="1759.64" width="218.33" height="219.29"/>
    <text class="lo" transform="translate(1010 2360)"><tspan x="0" y="0">LO</tspan></text>
  </g>
</svg>`;

export function HydEng1SdPage() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex" }}
      dangerouslySetInnerHTML={{ __html: HYD_ENG1_SVG }} />
  );
}
