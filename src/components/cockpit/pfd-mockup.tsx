"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A320 PFD — canvas mockup. Standalone visual recreation, NOT wired to scenario.
// View at /mockups/pfd in dev.
//
// Layout sections (top → bottom):
//   FMA          — flight mode annunciator strip (5 columns)
//   ADI + tapes  — attitude indicator with speed tape (left), altitude tape
//                  (right), VS tape (far right), GS scale (right of ADI), LOC
//                  scale (below ADI)
//   HDG tape     — compass strip with selected heading bug + track diamond
//   ILS info     — bottom-left frequency / dist block
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import type { ScenarioState } from "@/engine/state";
import { buildAircraftState } from "@/components/cockpit/pfd-nd";

type PfdData = {
  pitch: number; roll: number;
  sideslipG?: number;                            // lateral acceleration / sideslip in g
  speed: number; selSpd: number; mgtSpd: number;
  vmin: number;  vmax: number;
  vls?: number;  vfe?: number; vapp?: number;   // FCOM speed bands
  trend?: number;                                // 10-s speed projection (kt)
  mach?: number;                                 // 0..1 e.g. 0.67
  alt: number;   selAlt: number; qnh: number;
  vs: number;
  hdg: number;   selHdg: number; track: number;
  ils: { id: string; freq: string; dist: number };
  gsPos: number; locPos: number;
  ra: number;
};

export default function PfdMockup({ state }: { state?: ScenarioState } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef(state);
  // Keep latest scenario state available to the rAF loop without re-running
  // the whole effect on every state change.
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    // ── HiDPI / Retina scaling ────────────────────────────────────────────
    // Without this, canvas pixels map 1:1 to CSS pixels; on retina (2x) and
    // ProMotion (3x) displays the result is fuzzy text and aliased lines.
    // We scale the backing buffer by devicePixelRatio and pre-scale the 2D
    // context so all drawing code keeps using "logical" CSS pixel coordinates.
    const W = 520, H = 640;
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
    cv.width  = W * dpr;
    cv.height = H * dpr;
    // Default CSS box only used when the component isn't put inside a sized
    // container (e.g. /mockups/pfd standalone).  When `state` is wired in via
    // the runner, the parent slot's width/height drives display size.
    if (!cv.style.width)  cv.style.width  = W + "px";
    if (!cv.style.height) cv.style.height = H + "px";
    ctx.scale(dpr, dpr);
    // Make canvas-rendered text honor sub-pixel positioning + tabular numbers
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Cockpit-friendly monospace font stack (avoids the chunky Courier feel
    // while staying readable.  Real Airbus uses proprietary Honeywell/DIN
    // fonts that aren't redistributable — these open stacks are the next best.)
    const FONT_STACK =
      '"JetBrains Mono","Roboto Mono","SF Mono","Menlo","Consolas","Courier New",monospace';
    // tnum = tabular numerals so digits don't shift width as values change
    const FONT_FEATURES = '"tnum" 1, "ss01" 1';

    const d: PfdData = {
      pitch: 2, roll: 0, sideslipG: 0,
      speed: 145, selSpd: 147, mgtSpd: 148,
      vmin: 130, vmax: 185,
      vls: 138, vfe: 200, vapp: 142,
      trend: 6,
      mach: 0.42,
      alt: 3740, selAlt: 5000, qnh: 1013,
      vs: -500,                                   // demo: descent → pointer slants top-left to bottom-right
      hdg: 258, selHdg: 260, track: 258,
      ils: { id: "IMNW", freq: "108.70", dist: 7.4 },
      gsPos: 0.25, locPos: 0.1,
      ra: 2310,
    };

    // Layout constants
    const ATX = 260, ATY = 315, ATR = 152;
    const SX = 28,  SW = 62, ST = 125, SH = 345;
    const AX = 392, AW = 72, AT = 125, AH = 345;
    const VX = 468, VW = 30, VT = 125, VH = 345;
    const HX = 125, HW = 265, HY = 510, HH = 58;
    const FH = 92;

    // ── Helpers ─────────────────────────────────────────────────────────────
    const txt = (
      s: string | number, x: number, y: number, sz: number, col: string,
      al: CanvasTextAlign = "left", b = false, glow: number = 0,
    ) => {
      ctx.font = (b ? "bold " : "") + sz + "px " + FONT_STACK;
      // Note: fontFeatureSettings is supported on modern Canvas (Chromium 86+,
      // Safari 15+).  Cast to keep TS happy on older lib types.
      (ctx as unknown as { fontFeatureSettings?: string }).fontFeatureSettings = FONT_FEATURES;
      ctx.fillStyle = col;
      ctx.textAlign = al;
      ctx.textBaseline = "middle";
      if (glow > 0) {
        ctx.shadowColor = col;
        ctx.shadowBlur = glow;
      }
      ctx.fillText(String(s), x, y);
      if (glow > 0) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    };
    const line = (x1: number, y1: number, x2: number, y2: number, col: string, lw = 1.5) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
    };
    const diamond = (cx: number, cy: number, rx: number, ry: number, col: string, fill = true) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry); ctx.lineTo(cx + rx, cy);
      ctx.lineTo(cx, cy + ry); ctx.lineTo(cx - rx, cy);
      ctx.closePath();
      if (fill) { ctx.fillStyle = col; ctx.fill(); }
      else      { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
    };

    // ── FMA ────────────────────────────────────────────────────────────────
    const drawFMA = () => {
      const live = stateRef.current ? buildAircraftState(stateRef.current) : null;
      const thrMode  = live?.thrMode  ?? "MAN TOGA";
      const vertMode = live?.vertMode ?? "SRS";
      const latMode  = live?.latMode  ?? "RWY TRK";

      const C_ACTIVE = "#00ff00";
      const C_ARMED  = "#00bfff";  // FCOM blue for armed modes
      const C_WHITE  = "#ffffff";

      // Solid black background, uniform across rows — no gradient on active row,
      // no horizontal divider between active and armed rows.
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, FH);

      // Vertical column dividers only (FCOM-correct).
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
      [105, 210, 312, 418].forEach(x => line(x, 2, x, FH - 2, "#555", 1));

      // Row 1 — ACTIVE modes (GREEN)
      txt(thrMode,  52,  16, 14, C_ACTIVE, "center", true, 5);
      txt(vertMode, 156, 16, 14, C_ACTIVE, "center", true, 5);
      txt(latMode,  260, 16, 14, C_ACTIVE, "center", true, 5);

      // Engagement column — AP / FD / A/THR always visible (full column).
      txt("AP1",    466, 13, 11, C_WHITE, "center", true);
      txt("1 FD 2", 466, 30, 11, C_WHITE, "center", true);
      txt("A/THR",  466, 47, 11, C_WHITE, "center", true);

      // Row 2 — ARMED modes (BLUE).  Per FCOM: a mode that has already engaged
      // is no longer shown as armed.  No ENG OUT badge on the FMA.
      if (vertMode !== "CLB") txt("CLB", 156, 44, 12, C_ARMED, "center", true, 3);
      if (latMode  !== "NAV") txt("NAV", 260, 44, 12, C_ARMED, "center", true, 3);
    };

    // ── ADI ────────────────────────────────────────────────────────────────
    const drawADI = () => {
      const cx = ATX, cy = ATY, r = ATR;
      const PPD = 9.5;

      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(-d.roll * Math.PI / 180);
      ctx.translate(0, d.pitch * PPD);

      // Sky gradient — deep blue at top → lighter near horizon
      const skyGrad = ctx.createLinearGradient(0, -r * 3.5, 0, 0);
      skyGrad.addColorStop(0,   "#0d3a6f");
      skyGrad.addColorStop(0.7, "#1e6dbf");
      skyGrad.addColorStop(1,   "#3b89d6");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-r * 2.5, -r * 3.5, r * 5, r * 3.5);

      // Ground gradient — warm brown near horizon → darker at bottom
      const grdGrad = ctx.createLinearGradient(0, 0, 0, r * 3.5);
      grdGrad.addColorStop(0,   "#9a5018");
      grdGrad.addColorStop(0.5, "#7b3f10");
      grdGrad.addColorStop(1,   "#4a2608");
      ctx.fillStyle = grdGrad;
      ctx.fillRect(-r * 2.5, 0, r * 5, r * 3.5);

      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-r * 2, 0); ctx.lineTo(r * 2, 0); ctx.stroke();

      for (let deg = -30; deg <= 30; deg += 2.5) {
        if (deg === 0) continue;
        const py = -deg * PPD;
        const isDec  = Number.isInteger(deg / 10);
        const isFive = Number.isInteger(deg / 5) && !isDec;
        const len = isDec ? 80 : isFive ? 48 : 24;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = isDec ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(-len / 2, py); ctx.lineTo(len / 2, py); ctx.stroke();
        if (isDec) {
          ctx.font = '13px "Courier New"'; ctx.fillStyle = "#fff";
          ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(String(Math.abs(deg)), -len / 2 - 5, py);
          ctx.textAlign = "left";
          ctx.fillText(String(Math.abs(deg)),  len / 2 + 5, py);
        }
        if (Math.abs(deg) === 20) {
          const dir = deg > 0 ? 1 : -1;
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-len / 2, py); ctx.lineTo(-len / 2, py + dir * 10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo( len / 2, py); ctx.lineTo( len / 2, py + dir * 10); ctx.stroke();
        }
      }
      ctx.restore();

      // Bank arc ticks
      ctx.save(); ctx.translate(cx, cy);
      [10, 20, 30, 45, 60].forEach(a => {
        [-a, a].forEach(ang => {
          const rad = (ang - 90) * Math.PI / 180;
          ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(rad) * (r - 14), Math.sin(rad) * (r - 14));
          ctx.lineTo(Math.cos(rad) * (r - 2),  Math.sin(rad) * (r - 2));
          ctx.stroke();
        });
      });
      ctx.restore();

      // Roll index triangle (fixed top)
      ctx.save(); ctx.translate(cx, cy - r + 6);
      ctx.strokeStyle = "#ff0"; ctx.lineWidth = 2; ctx.fillStyle = "transparent";
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-9, 3); ctx.lineTo(9, 3); ctx.closePath(); ctx.stroke();
      ctx.restore();

      // Roll pointer + sideslip index (yellow trapezoid beneath roll pointer).
      // Sideslip displaces the trapezoid laterally: ~1 cm = 0.2 g, hard stop at
      // 0.3 g.  Both rotate with bank so they stay tangent to the bank scale.
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-d.roll * Math.PI / 180);
      ctx.fillStyle = "#ff0";
      ctx.beginPath(); ctx.moveTo(0, -r + 10); ctx.lineTo(-7, -r + 24); ctx.lineTo(7, -r + 24); ctx.closePath(); ctx.fill();
      // Sideslip trapezoid — narrow top, wider bottom, just below the roll triangle
      const slipG = Math.max(-0.3, Math.min(0.3, d.sideslipG ?? 0));
      const slipDx = (slipG / 0.2) * 18;             // ~18 px per 0.2 g (≈ "one centimeter")
      const sy = -r + 26;
      ctx.beginPath();
      ctx.moveTo(slipDx - 5, sy);
      ctx.lineTo(slipDx + 5, sy);
      ctx.lineTo(slipDx + 7, sy + 5);
      ctx.lineTo(slipDx - 7, sy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Fixed aircraft symbol
      ctx.save(); ctx.translate(cx, cy);
      ctx.strokeStyle = "#ff0"; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(-65, 0); ctx.lineTo(-20, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-65, 0); ctx.lineTo(-65, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( 20, 0); ctx.lineTo( 65, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( 65, 0); ctx.lineTo( 65, 12); ctx.stroke();
      ctx.strokeStyle = "#ff0"; ctx.lineWidth = 2.5;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -35); ctx.stroke();
      ctx.restore();

      // Flight Director — symmetric crossed bars, equal length horizontally
      // and vertically, centred on aircraft.
      const fdPitchOffset = -12;   // climb command (above center)
      const fdRollOffset  = 0;     // wings level (centred)
      const FD_HALF = 45;          // half-length, same for both bars
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = "#00dd00";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "#00dd00"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-FD_HALF, fdPitchOffset); ctx.lineTo(FD_HALF, fdPitchOffset); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fdRollOffset, -FD_HALF); ctx.lineTo(fdRollOffset, FD_HALF); ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.restore();

      // Circle border
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 4; ctx.stroke();

      // GS scale (right of ADI)
      const gsx = cx + r + 20;
      [2, 1, -1, -2].forEach(i => {
        const sy = cy + i * 38;
        ctx.beginPath(); ctx.arc(gsx, sy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5; ctx.stroke();
      });
      const gsY = cy + d.gsPos * 38 * 2;
      diamond(gsx, gsY, 8, 8, "#ff00ff");

      // LOC scale (below ADI)
      const locy = cy + r + 30;
      [2, 1, -1, -2].forEach(i => {
        const sx2 = cx + i * 48;
        ctx.beginPath(); ctx.arc(sx2, locy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5; ctx.stroke();
      });
      const locX = cx + d.locPos * 48;
      diamond(locX, locy, 8, 8, "#ff00ff");

      // RA — green numeric value with subtle glow
      txt(d.ra, cx, cy + r - 28, 20, "#00ff00", "center", true, 5);
    };

    // ── SPEED TAPE ─────────────────────────────────────────────────────────
    const drawSpeedTape = () => {
      const x = SX, w = SW, top = ST, h = SH, cx2 = x + w / 2;
      const spd = d.speed, PPK = 3.6;

      ctx.fillStyle = "#252525"; ctx.fillRect(x, top, w, h);
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(x, top, w, h);

      ctx.save(); ctx.beginPath(); ctx.rect(x, top, w, h); ctx.clip();

      const mid = top + h / 2;
      const yFor = (v: number) => mid - (v - spd) * PPK;

      // VMAX (red/black checker strip at the top)
      const vmaxY = yFor(d.vmax);
      if (vmaxY > top) {
        ctx.fillStyle = "#880000";
        ctx.fillRect(x, top, w - 2, Math.max(0, vmaxY - top));
        // Red+black hatching to match FCOM strip
        ctx.fillStyle = "#000000";
        for (let yy = top; yy < vmaxY - 3; yy += 8) {
          ctx.fillRect(x + w - 6, yy, 4, 4);
        }
      }

      // VLS (lowest selectable speed) — amber line + amber strip below
      const vlsRef = d.vls ?? d.vmin;
      const vlsY   = yFor(vlsRef);
      if (vlsY < top + h) {
        ctx.fillStyle = "#7a4a00";
        ctx.fillRect(x, vlsY, w - 2, Math.max(0, top + h - vlsY));
      }
      line(x, vlsY, x + w - 2, vlsY, "#ffa500", 2);

      // VFE (max flap extended) — yellow "=" stack on the OUTER edge of the
      // tape (FCOM photo: VFE/F marker sits opposite the speed labels).
      if (d.vfe !== undefined) {
        const vfeY = yFor(d.vfe);
        if (vfeY > top && vfeY < top + h) {
          ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 1.0;
          ctx.beginPath(); ctx.moveTo(x + 2, vfeY - 3); ctx.lineTo(x + 12, vfeY - 3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + 2, vfeY + 3); ctx.lineTo(x + 12, vfeY + 3); ctx.stroke();
          txt("F", x + 16, vfeY, 11, "#ffff00", "left", true);
        }
      }

      // Tape ticks
      for (let v = Math.floor((spd - 60) / 10) * 10; v <= spd + 60; v += 10) {
        const y = yFor(v);
        if (y < top || y > top + h) continue;
        ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + w - 14, y); ctx.lineTo(x + w - 2, y); ctx.stroke();
        if (v % 20 === 0) txt(v, x + w - 16, y, 13, "#eee", "right");
        const y5 = yFor(v + 5);
        if (y5 >= top && y5 <= top + h) {
          ctx.beginPath(); ctx.moveTo(x + w - 8, y5); ctx.lineTo(x + w - 2, y5); ctx.stroke();
        }
      }
      ctx.restore();

      // Speed trend arrow (yellow) — projects current speed forward by `trend` kt
      if (d.trend !== undefined && Math.abs(d.trend) >= 1) {
        const trendY = yFor(spd + d.trend);
        const trendX = x + w - 18;
        ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(trendX, mid); ctx.lineTo(trendX, trendY); ctx.stroke();
        // arrowhead
        const dir = d.trend >= 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(trendX, trendY);
        ctx.lineTo(trendX - 4, trendY + dir * 7);
        ctx.lineTo(trendX + 4, trendY + dir * 7);
        ctx.closePath(); ctx.fillStyle = "#ffff00"; ctx.fill();
      }

      // VAPP magenta target triangle on the right edge of the tape
      if (d.vapp !== undefined) {
        const vappY = yFor(d.vapp);
        if (vappY > top && vappY < top + h) {
          ctx.fillStyle = "#ff00ff";
          ctx.beginPath();
          ctx.moveTo(x + w + 2, vappY);
          ctx.lineTo(x + w + 12, vappY - 7);
          ctx.lineTo(x + w + 12, vappY + 7);
          ctx.closePath(); ctx.fill();
        }
      }

      // Selected speed bug (cyan arrow at left)
      const selY = yFor(d.selSpd);
      ctx.fillStyle = "#00cfff";
      ctx.beginPath();
      ctx.moveTo(x + 2, selY); ctx.lineTo(x + 18, selY - 9); ctx.lineTo(x + 18, selY + 9);
      ctx.closePath(); ctx.fill();

      // Managed speed line
      const mgtY = yFor(d.mgtSpd);
      line(x, mgtY, x + w, mgtY, "#ffff00", 2);

      // Current speed box
      ctx.fillStyle = "#000";
      ctx.fillRect(x - 3, mid - 17, w + 6, 34);
      ctx.strokeStyle = "#ccc"; ctx.lineWidth = 2;
      ctx.strokeRect(x - 3, mid - 17, w + 6, 34);
      txt(Math.round(spd), cx2, mid, 20, "#fff", "center", true);

      // Selected speed at top
      txt(Math.round(d.selSpd), cx2, top - 16, 15, "#00cfff", "center", true);

      // Mach readout below the tape (FCOM: shown when M ≥ 0.50, else hidden)
      if (d.mach !== undefined && d.mach >= 0.50) {
        const machStr = "." + Math.round(d.mach * 1000).toString().padStart(3, "0");
        txt(machStr, cx2, top + h + 18, 14, "#00ff00", "center", true);
      }
    };

    // ── ALT TAPE ───────────────────────────────────────────────────────────
    const drawAltTape = () => {
      const x = AX, w = AW, top = AT, h = AH, cx2 = x + w / 2;
      const alt = d.alt, PPF = h / 900;

      ctx.fillStyle = "#252525"; ctx.fillRect(x, top, w, h);
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(x, top, w, h);

      ctx.save(); ctx.beginPath(); ctx.rect(x, top, w, h); ctx.clip();

      const mid = top + h / 2;
      for (let v = Math.floor((alt - 500) / 100) * 100; v <= alt + 500; v += 100) {
        const y = mid - (v - alt) * PPF;
        if (y < top || y > top + h) continue;
        ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 16, y); ctx.stroke();
        const lbl = v >= 0 ? ">" + String(Math.abs(v)).padStart(3, "0") : String(v);
        txt(lbl, x + 18, y, 12, "#ccc", "left");
        const y50 = mid - (v + 50 - alt) * PPF;
        if (y50 >= top && y50 <= top + h) {
          ctx.beginPath(); ctx.moveTo(x + 2, y50); ctx.lineTo(x + 10, y50); ctx.stroke();
        }
      }
      ctx.restore();

      // Selected altitude bug right
      const saY = mid - (d.selAlt - alt) * PPF;
      if (saY >= top && saY <= top + h) {
        ctx.fillStyle = "#00cfff";
        ctx.beginPath();
        ctx.moveTo(x + w + 2, saY); ctx.lineTo(x + w + 16, saY - 9); ctx.lineTo(x + w + 16, saY + 9);
        ctx.closePath(); ctx.fill();
      }

      // Altitude readout box
      ctx.fillStyle = "#000";
      ctx.fillRect(x - 3, mid - 19, w + 6, 38);
      ctx.strokeStyle = "#ccc"; ctx.lineWidth = 2;
      ctx.strokeRect(x - 3, mid - 19, w + 6, 38);

      const thou = Math.floor(alt / 100);
      const hund = Math.abs(alt % 100);
      const tStr = String(thou);
      ctx.font = 'bold 19px "Courier New"';
      ctx.fillStyle = "#00ff00";
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(tStr, x + w - 14, mid);
      ctx.font = 'bold 14px "Courier New"';
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(String(hund).padStart(2, "0"), x + w - 13, mid);

      txt(d.selAlt, cx2, top - 16, 15, "#00cfff", "center", true);

      // QNH
      txt("QNH", AX - 6, top + h + 26, 12, "#ccc", "left");
      txt(d.qnh, AX + 36, top + h + 26, 15, "#00cfff", "center");
    };

    // ── VS TAPE ────────────────────────────────────────────────────────────
    // FCOM "banana" shape: scale's right edge bulges outward at zero VS and
    // pulls inward at the ±2000 fpm ends, making the strip look like a `)`.
    const drawVS = () => {
      const x = VX, w = VW, top = VT, h = VH;
      ctx.fillStyle = "#1e1e1e"; ctx.fillRect(x, top, w, h);

      const mid = top + h / 2;
      const halfH = h / 2 - 22;
      const BULGE = 14;                                  // px the ends pull inward

      // yFrac in [-1..+1], -1 at top of scale (climb), +1 at bottom (descent)
      const xForYFrac = (yFrac: number) => (x + w - 2) - BULGE * yFrac * yFrac;
      const yForVs    = (vs: number) => mid - (vs / 2000) * halfH;

      // Curved right edge of the scale
      ctx.strokeStyle = "#666"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const yFrac = -1 + (2 * i) / 30;
        const yy = mid + yFrac * halfH;
        const xx = xForYFrac(yFrac);
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Tick marks (1, 2, 6 above and below mid)
      const marks: [number, string][] = [[2000, "6"], [1000, "2"], [500, "1"]];
      marks.forEach(([r, lbl]) => {
        [-1, 1].forEach(s => {
          const yFrac = -s * (r / 2000);              // climb (s=+1) → yFrac negative (above)
          const yy = mid + yFrac * halfH;
          const xx = xForYFrac(yFrac);
          ctx.strokeStyle = "#999"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(xx - 8, yy); ctx.lineTo(xx, yy); ctx.stroke();
          txt(lbl, xx - 10, yy, 11, "#999", "right");
        });
      });

      // Pointer — pivots at left edge mid, tip on the curved right edge at
      // the current VS value.  For descent (vs < 0) it slants top-left to bottom-right.
      const vc      = Math.max(-2000, Math.min(2000, d.vs));
      const yFracTip = -(vc / 2000);
      const xTip    = xForYFrac(yFracTip);
      const yTip    = yForVs(vc);
      ctx.strokeStyle = "#00cc00"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 2, mid);
      ctx.lineTo(xTip - 18, yTip);                     // stop short of the digit box
      ctx.stroke();

      // Boxed digit at the pointer tip — tens of fpm (e.g. "5" = 500 fpm)
      if (Math.abs(d.vs) > 50) {
        const vsHundreds = Math.round(Math.abs(d.vs) / 100);
        const digit = String(vsHundreds <= 9 ? vsHundreds : Math.floor(vsHundreds / 10));
        const boxW = 18, boxH = 16;
        const boxX = xTip - boxW;
        const boxY = yTip - boxH / 2;
        ctx.fillStyle = "#000000";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = "#00cc00"; ctx.lineWidth = 1.2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        txt(digit, boxX + boxW / 2, boxY + boxH / 2, 12, "#00cc00", "center", true);
      }
    };

    // ── HDG TAPE ───────────────────────────────────────────────────────────
    const drawHdgTape = () => {
      const x = HX, w = HW, y = HY, h = HH, cx2 = x + w / 2;
      const hdg = d.hdg, PPD = w / 30;

      ctx.fillStyle = "#252525"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);

      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      for (let v = Math.floor((hdg - 18) / 5) * 5; v <= hdg + 18; v += 5) {
        const dx = cx2 + (v - hdg) * PPD;
        if (dx < x || dx > x + w) continue;
        ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(dx, y + 2); ctx.lineTo(dx, y + 14); ctx.stroke();
        if (v % 10 === 0) {
          const lbl = ((v % 360) + 360) % 360;
          txt(lbl, dx, y + 28, 13, "#eee", "center");
        }
      }
      ctx.restore();

      // Selected heading bug
      const sdx = cx2 + (d.selHdg - hdg) * PPD;
      if (sdx >= x && sdx <= x + w) {
        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.moveTo(sdx, y + 2); ctx.lineTo(sdx - 8, y + 16); ctx.lineTo(sdx + 8, y + 16); ctx.closePath(); ctx.fill();
        line(sdx, y + 16, sdx, y + h - 2, "#ffff00", 2);
      }

      // Track diamond
      const tdx = cx2 + (d.track - hdg) * PPD;
      diamond(tdx, y + h - 10, 7, 7, "#ff00ff");

      // Centre marker
      ctx.fillStyle = "#ff0";
      ctx.beginPath(); ctx.moveTo(cx2, y); ctx.lineTo(cx2 - 7, y + 12); ctx.lineTo(cx2 + 7, y + 12); ctx.closePath(); ctx.fill();

      // HDG box
      ctx.fillStyle = "#000"; ctx.fillRect(cx2 - 24, y + h - 26, 48, 24);
      ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5; ctx.strokeRect(cx2 - 24, y + h - 26, 48, 24);
      const hd2 = ((Math.round(hdg) % 360) + 360) % 360;
      txt(String(hd2).padStart(3, "0"), cx2, y + h - 14, 15, "#fff", "center", true);
    };

    // ── ILS info ───────────────────────────────────────────────────────────
    const drawILS = () => {
      const bx = SX - 10, by = ST + SH + 16;
      txt(d.ils.id,        bx, by,      14, "#ff00ff", "left", true);
      txt(d.ils.freq,      bx, by + 20, 16, "#ff00ff", "left", true);
      txt(d.ils.dist + " NM", bx, by + 40, 14, "#ff00ff", "left", true);
    };

    // ── Main animation loop ────────────────────────────────────────────────
    let t = 0;
    let rafId = 0;
    const animate = () => {
      t += 0.004;
      const live = stateRef.current ? buildAircraftState(stateRef.current) : null;
      if (live) {
        // Wired to scenario — use derived AircraftState directly.  Pitch and
        // roll get a tiny live shimmer so the attitude indicator feels alive;
        // digital readouts (alt, vs, speed) stay quantised to avoid digit jitter.
        d.pitch  = live.pitch  + Math.sin(t)       * 0.15;
        d.roll   = live.bank;
        d.speed  = Math.round(live.speed);
        d.selSpd = live.selectedSpeed;
        d.mgtSpd = live.selectedSpeed;
        d.alt    = Math.round(live.altitude);
        d.selAlt = live.selectedAlt;
        d.vs     = Math.round(live.vs / 10) * 10;     // round to 10 fpm — no jitter
        d.hdg    = live.heading;
        d.selHdg = live.selectedHdg;
        d.track  = live.track;
        // RA roughly tracks altitude until 2500 ft AGL
        d.ra = Math.max(0, Math.round(Math.min(2500, live.altitude)));
      } else {
        // Demo / standalone mode — only the attitude indicator shimmers.
        // Digital readouts (alt, vs, speed) stay frozen to keep digits stable.
        d.pitch = 2    + Math.sin(t) * 0.4;
        d.speed = 145;
        d.alt   = 3740;
        d.vs    = -500;                               // demo descent for VS pointer slant
      }

      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      drawFMA();
      drawADI();
      drawSpeedTape();
      drawAltTape();
      drawVS();
      drawHdgTape();
      drawILS();

      ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      rafId = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(rafId);
  }, []);

  // Two display modes:
  //   • Standalone (no `state` prop) — full-screen demo at /mockups/pfd
  //   • Wired (with `state`) — fills its parent container slot in the runner
  if (state) {
    return (
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    );
  }
  return (
    <div style={{ background: "#000", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "520px", height: "640px" }} />
    </div>
  );
}
