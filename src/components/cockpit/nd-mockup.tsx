"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A320 Navigation Display (ND) — canvas mockup, ARC mode.
// View at /mockups/nd in dev. With `state` prop wires to scenario via
// `buildAircraftState`.
//
// FCOM source: DSC-31 / DSC-31-30 (NAVIGATION DISPLAYS — ARC mode).
// Range options: 5 / 10 / 20 / 40 NM (per user spec for low-altitude / approach).
// Click anywhere on the ND to cycle through ranges.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import { buildAircraftState } from "@/components/cockpit/pfd-nd";

type Waypoint = {
  name:    string;
  brgDeg:  number;
  distNm:  number;
  type?:   "wpt" | "vor" | "ndb" | "apt";
  isTo?:   boolean;
};

const RANGE_OPTIONS = [5, 10, 20, 40] as const;

export default function NdMockup({ state }: { state?: ScenarioState } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [rangeIdx, setRangeIdx] = useState(1); // default 10 NM
  const rangeNm = RANGE_OPTIONS[rangeIdx];
  const rangeRef = useRef(rangeNm);
  useEffect(() => { rangeRef.current = rangeNm; }, [rangeNm]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const W = 520, H = 600;
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
    cv.width  = W * dpr;
    cv.height = H * dpr;
    if (!cv.style.width)  cv.style.width  = W + "px";
    if (!cv.style.height) cv.style.height = H + "px";
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const FONT_STACK = '"JetBrains Mono","Roboto Mono","SF Mono","Menlo","Consolas","Courier New",monospace';
    const FONT_FEATURES = '"tnum" 1';

    const ACX = W / 2;
    const ACY = H - 70;
    const ARC_R_INNER = 366;
    const ARC_HALF_DEG = 45;
    const MAP_R_MAX = ARC_R_INNER - 14;

    type NdData = {
      hdg:     number; track:   number; selHdg: number;
      gs:      number; tas:     number;
      windDir: number; windSpd: number;
      rangeNm: number;
      waypoints: Waypoint[];
    };

    const d: NdData = {
      hdg: 280, track: 281, selHdg: 280, gs: 162, tas: 166,
      windDir: 260, windSpd: 12, rangeNm: rangeRef.current,
      waypoints: [
        { name: "DPN",    brgDeg: 280, distNm: 4.2,  type: "vor", isTo: true },
        { name: "RAJBI",  brgDeg: 278, distNm: 7.5,  type: "wpt" },
        { name: "RAVKO",  brgDeg: 281, distNm: 12.0, type: "wpt" },
        { name: "ALOXO",  brgDeg: 282, distNm: 24.0, type: "wpt" },
        { name: "IBSEN",  brgDeg: 283, distNm: 35.0, type: "wpt" },
      ],
    };

    const txt = (
      s: string | number, x: number, y: number, sz: number, col: string,
      al: CanvasTextAlign = "left", b = false, glow = 0,
    ) => {
      ctx.font = (b ? "bold " : "") + sz + "px " + FONT_STACK;
      (ctx as unknown as { fontFeatureSettings?: string }).fontFeatureSettings = FONT_FEATURES;
      ctx.fillStyle = col;
      ctx.textAlign = al;
      ctx.textBaseline = "middle";
      if (glow > 0) { ctx.shadowColor = col; ctx.shadowBlur = glow; }
      ctx.fillText(String(s), x, y);
      if (glow > 0) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; }
    };

    const toXY = (offDeg: number, distNm: number) => {
      const px = (distNm / d.rangeNm) * MAP_R_MAX;
      const ang = (offDeg - 90) * Math.PI / 180;
      return { x: ACX + Math.cos(ang) * px, y: ACY + Math.sin(ang) * px };
    };
    const offFromNose = (brgDeg: number) => ((brgDeg - d.hdg + 540) % 360) - 180;

    const drawTopLeft = () => {
      txt("GS",  10, 14, 11, "#9aa1ac", "left", true);
      txt(Math.round(d.gs),  35, 14, 14, "#ffffff", "left", true, 4);
      txt("TAS", 78, 14, 11, "#9aa1ac", "left", true);
      txt(Math.round(d.tas), 110, 14, 14, "#ffffff", "left", true, 4);

      const windLabel = `${String(Math.round(d.windDir)).padStart(3, "0")}°/${Math.round(d.windSpd)}`;
      txt(windLabel, 10, 36, 13, "#00ff00", "left", true, 4);

      const ax = 90, ay = 36;
      const arad = (d.windDir - d.hdg + 180 - 90) * Math.PI / 180;
      const ex = ax + Math.cos(arad) * 14;
      const ey = ay + Math.sin(arad) * 14;
      ctx.strokeStyle = "#00ff00"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#00ff00";
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(arad - 0.45) * 5, ey - Math.sin(arad - 0.45) * 5);
      ctx.lineTo(ex - Math.cos(arad + 0.45) * 5, ey - Math.sin(arad + 0.45) * 5);
      ctx.closePath(); ctx.fill();
    };

    const drawTopRight = () => {
      const to = d.waypoints.find(w => w.isTo);
      if (to) {
        const trk = ((Math.round(to.brgDeg) % 360) + 360) % 360;
        const trkLabel = String(trk).padStart(3, "0") + "°";
        const distLabel = to.distNm.toFixed(1) + " NM";
        const minToGo = (to.distNm / Math.max(50, d.gs)) * 60;
        const eta = new Date(Date.now() + minToGo * 60 * 1000);
        const hh = String(eta.getUTCHours()).padStart(2, "0");
        const mm = String(eta.getUTCMinutes()).padStart(2, "0");
        const etaLabel = `${hh}:${mm}`;
        txt(to.name, W - 110, 14, 14, "#ff00ff", "left", true, 4);
        txt(trkLabel, W - 12, 14, 13, "#ffffff", "right", true);
        txt(distLabel, W - 12, 34, 13, "#ffffff", "right", true);
        txt(etaLabel, W - 12, 54, 13, "#ffffff", "right", true);
      }
      txt(d.rangeNm + " NM", W - 12, 78, 12, "#00cfff", "right", true, 4);
    };

    const drawCompass = () => {
      const cx = ACX, cy = ACY;
      ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.arc(cx, cy, ARC_R_INNER + 13, (-90 - ARC_HALF_DEG) * Math.PI / 180, (-90 + ARC_HALF_DEG) * Math.PI / 180);
      ctx.stroke();

      for (let off = -ARC_HALF_DEG; off <= ARC_HALF_DEG; off += 5) {
        const compassDeg = ((d.hdg + off) % 360 + 360) % 360;
        const isMajor    = compassDeg % 10 === 0;
        const ang = (off - 90) * Math.PI / 180;
        const r1 = isMajor ? ARC_R_INNER - 8 : ARC_R_INNER - 4;
        const r2 = ARC_R_INNER;
        ctx.strokeStyle = "#dddddd"; ctx.lineWidth = isMajor ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
        ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
        ctx.stroke();

        if (isMajor) {
          const lr = r1 - 14;
          const lx = cx + Math.cos(ang) * lr;
          const ly = cy + Math.sin(ang) * lr;
          let label: string;
          if      (compassDeg === 0)   label = "N";
          else if (compassDeg === 90)  label = "E";
          else if (compassDeg === 180) label = "S";
          else if (compassDeg === 270) label = "W";
          else label = String(Math.round(compassDeg / 10));

          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(off * Math.PI / 180);
          ctx.font = "bold 13px " + FONT_STACK;
          ctx.fillStyle = "#eeeeee";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }

      ctx.fillStyle = "#ffff00";
      const lubX = cx, lubY = cy - ARC_R_INNER;
      ctx.beginPath();
      ctx.moveTo(lubX, lubY + 2);
      ctx.lineTo(lubX - 7, lubY - 8);
      ctx.lineTo(lubX + 7, lubY - 8);
      ctx.closePath(); ctx.fill();

      const bugOff = ((d.selHdg - d.hdg + 540) % 360) - 180;
      if (bugOff >= -ARC_HALF_DEG && bugOff <= ARC_HALF_DEG) {
        const ang = (bugOff - 90) * Math.PI / 180;
        const bx = cx + Math.cos(ang) * (ARC_R_INNER + 5);
        const by = cy + Math.sin(ang) * (ARC_R_INNER + 5);
        ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 2;
        ctx.beginPath();
        const baseAng = ang + Math.PI / 2;
        ctx.moveTo(bx + Math.cos(ang) * 8, by + Math.sin(ang) * 8);
        ctx.lineTo(bx + Math.cos(baseAng) * 6, by + Math.sin(baseAng) * 6);
        ctx.lineTo(bx - Math.cos(baseAng) * 6, by - Math.sin(baseAng) * 6);
        ctx.closePath(); ctx.stroke();
      }

      const trkOff = ((d.track - d.hdg + 540) % 360) - 180;
      if (trkOff >= -ARC_HALF_DEG && trkOff <= ARC_HALF_DEG) {
        const ang = (trkOff - 90) * Math.PI / 180;
        const tx = cx + Math.cos(ang) * (ARC_R_INNER - 22);
        const ty = cy + Math.sin(ang) * (ARC_R_INNER - 22);
        ctx.fillStyle = "#ff00ff";
        ctx.beginPath();
        ctx.moveTo(tx, ty - 6);
        ctx.lineTo(tx + 5, ty);
        ctx.lineTo(tx, ty + 6);
        ctx.lineTo(tx - 5, ty);
        ctx.closePath(); ctx.fill();
      }

      const hd = ((Math.round(d.hdg) % 360) + 360) % 360;
      ctx.fillStyle = "#000000";
      ctx.fillRect(cx - 28, cy - ARC_R_INNER - 32, 56, 24);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 28, cy - ARC_R_INNER - 32, 56, 24);
      txt(String(hd).padStart(3, "0") + "°", cx, cy - ARC_R_INNER - 20, 14, "#ffffff", "center", true);
    };

    const drawRangeArcs = () => {
      const cx = ACX, cy = ACY;
      const fracs = [0.25, 0.5, 0.75];
      ctx.strokeStyle = "#00cfff"; ctx.lineWidth = 1.2;
      fracs.forEach((f) => {
        const r = MAP_R_MAX * f;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, (-90 - ARC_HALF_DEG) * Math.PI / 180, (-90 + ARC_HALF_DEG) * Math.PI / 180);
        ctx.stroke();
        ctx.setLineDash([]);
        const ang = (-30 - 90) * Math.PI / 180;
        const lx = cx + Math.cos(ang) * r;
        const ly = cy + Math.sin(ang) * r;
        const nm = (d.rangeNm * f).toFixed(0);
        txt(nm, lx + 5, ly, 9, "#00cfff", "left");
      });
    };

    const drawRoute = () => {
      const visible = d.waypoints
        .map((wp) => ({ wp, off: offFromNose(wp.brgDeg) }))
        .filter(({ wp, off }) => Math.abs(off) <= ARC_HALF_DEG && wp.distNm <= d.rangeNm);

      if (visible.length === 0) return;

      const first = visible[0];
      const p0 = { x: ACX, y: ACY };
      const p1 = toXY(first.off, first.wp.distNm);
      ctx.strokeStyle = "#ff00ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();

      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.6;
      let prev = p1;
      for (let i = 1; i < visible.length; i++) {
        const next = toXY(visible[i].off, visible[i].wp.distNm);
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(next.x, next.y); ctx.stroke();
        prev = next;
      }

      visible.forEach(({ wp, off }) => {
        const { x, y } = toXY(off, wp.distNm);
        const isTo  = !!wp.isTo;
        const color = isTo ? "#ff00ff" : "#ffffff";
        if (wp.type === "vor") {
          ctx.strokeStyle = color; ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = k * Math.PI / 3 - Math.PI / 6;
            const px = x + Math.cos(a) * 7;
            const py = y + Math.sin(a) * 7;
            if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.stroke();
        } else if (wp.type === "apt") {
          ctx.strokeStyle = color; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
        } else {
          ctx.strokeStyle = color; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x + 4, y - 4); ctx.stroke();
        }
        txt(wp.name, x + 9, y, 11, color, "left", true);
      });
    };

    const drawTrackLine = () => {
      const trkOff = ((d.track - d.hdg + 540) % 360) - 180;
      const ang = (trkOff - 90) * Math.PI / 180;
      const len = MAP_R_MAX;
      const ex = ACX + Math.cos(ang) * len;
      const ey = ACY + Math.sin(ang) * len;
      ctx.strokeStyle = "#00ff00"; ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(ACX, ACY); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawAircraft = () => {
      ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ACX, ACY - 16); ctx.lineTo(ACX, ACY + 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ACX - 16, ACY - 4); ctx.lineTo(ACX + 16, ACY - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ACX - 7, ACY + 10); ctx.lineTo(ACX + 7, ACY + 10); ctx.stroke();
    };

    const drawModeLabel = () => {
      txt("ARC", 12, H - 18, 11, "#9aa1ac", "left", true);
    };

    const drawFrame = () => {
      ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);
    };

    let t = 0;
    let rafId = 0;
    const animate = () => {
      t += 0.004;
      d.rangeNm = rangeRef.current;
      const live = stateRef.current ? buildAircraftState(stateRef.current) : null;
      if (live) {
        d.hdg     = live.heading + Math.sin(t)       * 0.15;
        d.track   = live.track   + Math.sin(t * 0.7) * 0.18;
        d.selHdg  = live.selectedHdg;
        d.gs      = live.gs;
        d.tas     = live.tas;
        d.windDir = live.windDir;
        d.windSpd = live.windSpd;
      } else {
        d.hdg   = 280 + Math.sin(t)       * 0.4;
        d.track = 281 + Math.sin(t * 0.8) * 0.5;
        d.gs    = 162 + Math.sin(t * 0.3) * 0.6;
      }

      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      drawTopLeft();
      drawTopRight();
      drawCompass();
      drawRangeArcs();
      drawRoute();
      drawTrackLine();
      drawAircraft();
      drawModeLabel();
      drawFrame();

      rafId = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(rafId);
  }, []);

  const cycleRange = () => setRangeIdx((i) => (i + 1) % RANGE_OPTIONS.length);

  if (state) {
    return (
      <canvas
        ref={canvasRef}
        onClick={cycleRange}
        style={{ display: "block", width: "100%", height: "100%", cursor: "pointer" }}
      />
    );
  }
  return (
    <div style={{ background: "#000", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <canvas
        ref={canvasRef}
        onClick={cycleRange}
        style={{ display: "block", width: "520px", height: "600px", cursor: "pointer" }}
      />
    </div>
  );
}
