"use client";

import { useEffect, useRef } from "react";
import type { ScenarioState } from "@/engine/state";

const C = {
  bg:      "#000000",
  green:   "#00D060",
  cyan:    "#00CFFF",
  amber:   "#FFB300",
  red:     "#FF3333",
  magenta: "#FF00FF",
  white:   "#E6E8EC",
  dim:     "#3A4050",
  sky:     "#1A4F7A",
  ground:  "#5C3A1E",
} as const;

// Keeps the draw function in a ref so the rAF loop always uses the latest
// version without restarting the loop on every render.
function useCanvas(draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef   = useRef(draw);
  useEffect(() => { drawRef.current = draw; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    let frame: number;
    const render = () => {
      ctx.lineWidth  = 1;
      ctx.lineCap    = "butt";
      ctx.lineJoin   = "miter";
      ctx.textAlign  = "left";
      ctx.textBaseline = "alphabetic";
      drawRef.current(ctx);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, []);

  return canvasRef;
}

/* ══════════════════════════════════════════════════════════════════
   PFD — Primary Flight Display
══════════════════════════════════════════════════════════════════ */

function PfdCanvas({ apEngaged, fireActive }: { apEngaged: boolean; fireActive: boolean }) {
  const W = 480, H = 220;

  const ref = useCanvas((ctx) => {
    // ── Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const cx    = W / 2;
    const horizY = Math.round(H / 2) + 8;
    const tapeL  = 52;   // left edge of sky/ground / speed tape width
    const tapeR  = 52;   // right strip width
    const hdgH   = 26;   // heading bar height at bottom
    const fmaH   = 26;   // FMA strip height at top

    // ── Sky
    ctx.fillStyle = C.sky;
    ctx.fillRect(tapeL, fmaH, W - tapeL - tapeR, horizY - fmaH);
    // ── Ground
    ctx.fillStyle = C.ground;
    ctx.fillRect(tapeL, horizY, W - tapeL - tapeR, H - horizY - hdgH);

    // ── Horizon line
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(tapeL, horizY);
    ctx.lineTo(W - tapeR, horizY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Pitch ladder
    ctx.font = "9px monospace";
    for (const deg of [10, 5, -5, -10]) {
      const py = horizY - deg * 3;
      const hw = deg % 10 === 0 ? 56 : 36;
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - hw, py);
      ctx.lineTo(cx + hw, py);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(String(Math.abs(deg)), cx - hw - 16, py + 3);
    }

    // ── FD bars (magenta cross)
    ctx.strokeStyle = C.magenta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 48, horizY);
    ctx.lineTo(cx + 48, horizY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, horizY - 38);
    ctx.lineTo(cx, horizY + 38);
    ctx.stroke();

    // ── Aircraft symbol (amber)
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 28, horizY);
    ctx.lineTo(cx - 6,  horizY);
    ctx.lineTo(cx,      horizY - 4);
    ctx.lineTo(cx + 6,  horizY);
    ctx.lineTo(cx + 28, horizY);
    ctx.stroke();
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.arc(cx, horizY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // ── Speed tape (left)
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, fmaH, tapeL, H - fmaH - hdgH);
    ctx.strokeStyle = "#2A2F38";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, fmaH, tapeL, H - fmaH - hdgH);

    ctx.font = "8px monospace";
    ctx.fillStyle = C.dim;
    ctx.fillText("SPD", 12, fmaH + 12);

    // Speed ticks
    ctx.font = "8px monospace";
    for (let spd = 130; spd <= 210; spd += 10) {
      const sy = horizY + ((165 - spd) / 10) * 20;
      if (sy > fmaH + 4 && sy < H - hdgH - 4) {
        ctx.strokeStyle = "#3A4050";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(38, sy);
        ctx.lineTo(tapeL, sy);
        ctx.stroke();
        ctx.fillStyle = "#8A9AB0";
        ctx.fillText(String(spd), 2, sy + 3);
      }
    }
    // V2 bug
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(42, horizY - 26);
    ctx.lineTo(tapeL, horizY - 26);
    ctx.stroke();
    ctx.font = "7px monospace";
    ctx.fillStyle = C.cyan;
    ctx.fillText("V2", 30, horizY - 22);
    // Speed readout box
    ctx.fillStyle = C.bg;
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 1;
    ctx.strokeRect(1, horizY - 10, tapeL - 3, 20);
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = C.white;
    ctx.fillText("165", 5, horizY + 5);

    // ── Altitude tape (right)
    const rx = W - tapeR;
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(rx, fmaH, tapeR, H - fmaH - hdgH);
    ctx.strokeStyle = "#2A2F38";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, fmaH, tapeR, H - fmaH - hdgH);

    ctx.font = "8px monospace";
    ctx.fillStyle = C.dim;
    ctx.fillText("ALT", rx + 10, fmaH + 12);

    // Target alt
    ctx.font = "7px monospace";
    ctx.fillStyle = C.cyan;
    ctx.fillText("3000", rx + 4, horizY - 26);

    // Alt ticks
    for (let alt = 500; alt <= 3500; alt += 500) {
      const ay = horizY + ((1500 - alt) / 500) * 22;
      if (ay > fmaH + 4 && ay < H - hdgH - 4) {
        ctx.strokeStyle = "#3A4050";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, ay);
        ctx.lineTo(rx + 10, ay);
        ctx.stroke();
        ctx.font = "7px monospace";
        ctx.fillStyle = "#8A9AB0";
        ctx.fillText(String(alt), rx + 4, ay + 3);
      }
    }
    // Alt readout box
    ctx.fillStyle = C.bg;
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 1, horizY - 10, tapeR - 2, 20);
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = C.cyan;
    ctx.fillText("1500", rx + 3, horizY + 5);

    // ── V/S strip (between alt tape and attitude area)
    const vsX = rx - 7;
    ctx.strokeStyle = "#2A2F38";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vsX, fmaH + 4);
    ctx.lineTo(vsX, H - hdgH - 4);
    ctx.stroke();
    // V/S pointer (positive climb)
    const vsY = horizY - 22;
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.moveTo(vsX,     vsY);
    ctx.lineTo(vsX - 4, vsY + 7);
    ctx.lineTo(vsX + 4, vsY + 7);
    ctx.fill();

    // ── Heading bar (bottom)
    ctx.fillStyle = C.bg;
    ctx.fillRect(tapeL, H - hdgH, W - tapeL - tapeR, hdgH);
    ctx.strokeStyle = "#2A2F38";
    ctx.lineWidth = 1;
    ctx.strokeRect(tapeL, H - hdgH, W - tapeL - tapeR, hdgH);

    const hdg = 280;
    ctx.font = "8px monospace";
    for (let d = -5; d <= 5; d++) {
      const tx = cx + d * 26;
      if (tx < tapeL + 6 || tx > W - tapeR - 6) continue;
      ctx.strokeStyle = "#3A4050";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, H - hdgH);
      ctx.lineTo(tx, H - hdgH + 5);
      ctx.stroke();
      if (d % 2 === 0) {
        const label = String(((hdg + d * 10) + 360) % 360).padStart(3, "0");
        ctx.fillStyle = "#5A626F";
        ctx.textAlign = "center";
        ctx.fillText(label, tx, H - 4);
      }
    }
    ctx.textAlign = "left";
    // HDG readout box
    ctx.fillStyle = C.bg;
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 20, H - hdgH + 1, 40, hdgH - 2);
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = C.white;
    ctx.textAlign = "center";
    ctx.fillText("280", cx, H - 5);
    ctx.textAlign = "left";

    // ── FMA strip (top)
    ctx.fillStyle = "rgba(0,0,0,0.92)";
    ctx.fillRect(0, 0, W, fmaH);
    ctx.strokeStyle = "#1C2130";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, fmaH);
    ctx.lineTo(W, fmaH);
    ctx.stroke();

    const fmaItems: Array<{ text: string; color: string }> = [
      { text: fireActive ? "THR IDLE" : "THR CLB", color: fireActive ? C.amber : C.white },
      { text: fireActive ? "OP CLB"  : "CLB",      color: C.green },
      { text: "NAV",                                color: C.green },
      { text: apEngaged ? "A/P 1"   : "1FD2",      color: C.cyan  },
      { text: "A/THR",                              color: C.cyan  },
    ];
    const cw = W / fmaItems.length;
    ctx.font = "bold 10px monospace";
    fmaItems.forEach(({ text, color }, i) => {
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(text, i * cw + cw / 2, fmaH - 6);
      if (i < fmaItems.length - 1) {
        ctx.strokeStyle = "#1C2130";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo((i + 1) * cw, 2);
        ctx.lineTo((i + 1) * cw, fmaH - 2);
        ctx.stroke();
      }
    });
    ctx.textAlign = "left";
  });

  return <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%", display: "block" }} />;
}

/* ══════════════════════════════════════════════════════════════════
   ND — Navigation Display (ARC mode)
══════════════════════════════════════════════════════════════════ */

function NdCanvas({ fireActive }: { fireActive: boolean }) {
  const W = 480, H = 220;

  const ref = useCanvas((ctx) => {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Data strip (top)
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, W, 20);
    ctx.font = "9px monospace";
    ctx.fillStyle = C.white;
    ctx.fillText("GS", 6, 14);
    ctx.fillStyle = C.cyan;
    ctx.fillText("420", 22, 14);
    ctx.fillStyle = C.white;
    ctx.fillText("  TAS", 44, 14);
    ctx.fillStyle = C.cyan;
    ctx.fillText("450", 66, 14);
    ctx.fillStyle = C.white;
    ctx.fillText("  WIND", 88, 14);
    ctx.fillStyle = C.green;
    ctx.fillText("270/35", 124, 14);
    ctx.fillStyle = C.white;
    ctx.textAlign = "right";
    ctx.fillText("TRK 272", W - 6, 14);
    ctx.textAlign = "left";

    // ── ARC compass
    const ox = W / 2, oy = H + 10;
    const R  = H - 14;
    const R2 = R * 0.6;

    // Outer arc
    ctx.strokeStyle = "#3A3F48";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, R, Math.PI, 0);
    ctx.stroke();

    // Inner dashed ring
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(ox, oy, R2, Math.PI, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Heading ticks
    const hdg = 280;
    ctx.font = "8px monospace";
    for (let d = -5; d <= 5; d++) {
      const ang  = (d * 10 * Math.PI) / 180;
      const cosA = Math.cos(Math.PI / 2 - ang);
      const sinA = Math.sin(Math.PI / 2 - ang);
      const x1   = ox - R * cosA, y1 = oy - R * sinA;
      const tk   = d % 5 === 0 ? 10 : 5;
      const x2   = ox - (R - tk) * cosA, y2 = oy - (R - tk) * sinA;
      ctx.strokeStyle = "#5A626F";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (d % 5 === 0) {
        const lx = ox - (R - 20) * cosA;
        const ly = oy - (R - 20) * sinA;
        ctx.fillStyle = "#9AA0A8";
        ctx.textAlign = "center";
        ctx.fillText(String(((hdg + d * 10) + 360) % 360).padStart(3, "0"), lx, ly + 3);
      }
    }
    ctx.textAlign = "left";

    // Track line
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox, 22);
    ctx.stroke();

    // Route (magenta)
    const acY = oy - R * 0.28;
    ctx.strokeStyle = C.magenta;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox,       acY);
    ctx.lineTo(ox,       oy - R * 0.65);
    ctx.lineTo(ox + 60,  oy - R * 0.88);
    ctx.stroke();

    // Waypoints
    const wp1 = { x: ox,      y: oy - R * 0.65 };
    const wp2 = { x: ox + 60, y: oy - R * 0.88 };

    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(wp1.x, wp1.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "8px monospace";
    ctx.fillText("UKASI", wp1.x + 5, wp1.y - 3);

    ctx.beginPath();
    ctx.arc(wp2.x, wp2.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("VIDP", wp2.x + 5, wp2.y + 3);

    // Aircraft symbol
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.moveTo(ox,     acY - 10);
    ctx.lineTo(ox - 7, acY + 4);
    ctx.lineTo(ox,     acY);
    ctx.lineTo(ox + 7, acY + 4);
    ctx.fill();

    // Weather returns
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.ellipse(ox + 72, oy - R * 0.42, 14, 9, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.ellipse(ox + 100, oy - R * 0.58, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fire alert box
    if (fireActive) {
      const bx = ox + 65, by = oy - R * 0.62;
      ctx.fillStyle   = "rgba(0,0,0,0.88)";
      ctx.strokeStyle = C.amber;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.rect(bx, by, 96, 34);
      ctx.fill();
      ctx.stroke();
      ctx.font      = "bold 9px monospace";
      ctx.fillStyle = C.amber;
      ctx.fillText("ENG 1 FIRE", bx + 8, by + 14);
      ctx.font      = "8px monospace";
      ctx.fillText("RTB VIDP",   bx + 8, by + 26);
    }

    // Range / mode labels
    ctx.font = "8px monospace";
    ctx.fillStyle = C.green;
    ctx.fillText("NAV ARC", 6, H - 4);
    ctx.fillStyle = C.cyan;
    ctx.textAlign = "right";
    ctx.fillText("40 NM", W - 6, H - 4);
    ctx.textAlign = "left";
  });

  return <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%", display: "block" }} />;
}

/* ══════════════════════════════════════════════════════════════════
   Export
══════════════════════════════════════════════════════════════════ */

export function PfdNd({ state }: { state?: ScenarioState }) {
  const fireActive = !!(
    state?.triggersFired?.["fire_warn"] ||
    state?.masterWarnActive ||
    state?.completedSteps?.["cancel_master_warn"]
  );
  const apEngaged = !!(state?.completedSteps?.["engage_ap_fma"]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="border border-[var(--color-border)] bg-black overflow-hidden" style={{ height: "220px" }}>
        <PfdCanvas apEngaged={apEngaged} fireActive={fireActive} />
      </div>
      <div className="border border-[var(--color-border)] bg-black overflow-hidden" style={{ height: "220px" }}>
        <NdCanvas fireActive={fireActive} />
      </div>
    </div>
  );
}
