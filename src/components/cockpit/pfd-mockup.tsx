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

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioState } from "@/engine/state";
import type { Scenario, ScenarioPhase } from "@/scenarios/types";
import { buildAircraftState, getActivePfActionPhase, PfActionOverlay } from "@/components/cockpit/pfd-nd";

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
  law?: 'NORMAL' | 'ALTN' | 'DIRECT';   // F/CTL law — amber Xs + MAN PITCH TRIM
};

export default function PfdMockup({ state, scenario, elapsedMs, onPfAction, paused }: { state?: ScenarioState; scenario?: Scenario; elapsedMs?: number; onPfAction?: (phaseId: string) => void; paused?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef(state);
  const scenarioRef = useRef(scenario);
  const elapsedMsRef = useRef(elapsedMs);
  const pausedRef = useRef(paused);
  const pendingPhaseRef = useRef<ScenarioPhase | null>(null);

  // PF action overlay — pulsing green ring on PFD at key phases.
  // Ring persists until the PF clicks it (completing the step), even if later
  // phases become active. This lets the AP1 ENGAGE ring stay visible through
  // the 400 ft gate rather than disappearing when the next phase starts.
  const [confirmedPhases, setConfirmedPhases] = useState<Set<string>>(new Set());

  // When dev mode seeks backward and un-completes a pfAction step, remove it from
  // confirmedPhases so the ring re-appears for that phase.
  useEffect(() => {
    if (!scenario?.phases) return;
    setConfirmedPhases(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const phaseId of prev) {
        const phase = scenario.phases?.find(p => p.id === phaseId);
        const stepId = phase?.pfAction?.stepId;
        if (stepId && !state?.completedSteps?.[stepId]) {
          next.delete(phaseId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [state?.completedSteps, scenario?.phases]);

  // Step-driven ring: appears when prereqStep is done, disappears when stepId is done.
  // No timing dependency — prevents altitude jumps from early ring clicks.
  const pendingPhase = (() => {
    if (!scenario || !state) return null;
    const phase = getActivePfActionPhase(scenario, state);
    if (!phase || confirmedPhases.has(phase.id)) return null;
    return phase;
  })();

  // Keep ref in sync so the rAF loop can read pending ring state without a re-render.
  pendingPhaseRef.current = pendingPhase ?? null;

  const pfAction     = pendingPhase?.pfAction;
  const needsConfirm = !!(pfAction && pendingPhase);
  const handleConfirm = useCallback(() => {
    if (!pendingPhase || !pfAction) return;
    setConfirmedPhases(prev => new Set(prev).add(pendingPhase.id));
    onPfAction?.(pendingPhase.id);
  }, [pendingPhase, pfAction, onPfAction]);
  // Keep latest scenario state available to the rAF loop without re-running
  // the whole effect on every state change.
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { elapsedMsRef.current = elapsedMs; }, [elapsedMs]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

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
      // 165 kt accelerating — VLS / VFE / VAPP all sit inside the visible tape range
      speed: 165, selSpd: 175, mgtSpd: 175,
      vmin: 130, vmax: 220,
      vls: 142, vfe: 200, vapp: 148,
      trend: 12,                                  // +12 kt over 10 s — clearly visible arrow
      mach: 0.42,
      alt: 3740, selAlt: 5000, qnh: 1013,
      vs: 500,                                    // demo climb 500 fpm → pivot at right-mid, tip rotates clockwise UP-LEFT, digit "5" at upper-left
      hdg: 258, selHdg: 260, track: 258,
      ils: { id: "IMNW", freq: "108.70", dist: 7.4 },
      gsPos: 0.25, locPos: 0.1,
      ra: 2310,
    };

    // Layout constants
    // ADI horizontally centred between the right edge of the speed tape (90)
    // and the left edge of the altitude tape (392) — midpoint ≈ 241.  Width
    // bumped 20 % (r 100 → 120) so the ADI fills more of the available
    // horizontal space.  HDG tape recentred to line up with the ADI.
    const ATX = 241, ATY = 297, ATR = 120;
    const SX = 28,  SW = 62, ST = 125, SH = 345;
    const AX = 392, AW = 72, AT = 125, AH = 345;
    // VS taller than ALT (slightly bigger): start 10 px higher, end 10 px lower.
    const VX = 468, VW = 30, VT = 115, VH = 365;
    // HDG tape pushed lower to free a band between the ADI bottom and the
    // compass strip for the LOC scale + diamond.
    const HX = 108, HW = 265, HY = 568, HH = 58;
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
    // FCOM DSC-22-30-100: first line = engaged (green), second line = armed (blue),
    // third line = special cues (LVR CLB / LVR MCT — white, flashing).
    // MAN TOGA is white per FCOM (manual mode, not A/THR managed).
    const drawFMA = () => {
      const live = stateRef.current
        ? buildAircraftState(stateRef.current, scenarioRef.current, elapsedMsRef.current)
        : null;
      const thrMode  = live?.thrMode  ?? "MAN TOGA";
      const thrCue   = live?.thrCue;
      const vertMode = live?.vertMode ?? "SRS";
      const latMode  = live?.latMode  ?? "NAV";
      const altitude = live?.altitude ?? 1500;
      const onGround = altitude === 0;

      const C_ACTIVE = "#00ff00";  // engaged modes — green
      const C_ARMED  = "#00bfff";  // armed modes — blue
      const C_WHITE  = "#ffffff";  // manual modes + special cues — white

      // MAN modes (MAN TOGA, MAN MCT, MAN GA SOFT) are white per FCOM.
      // Managed modes (THR CLB, THR MCT, THR IDLE) are green.
      const thrColor = thrMode.startsWith("MAN") ? C_WHITE : C_ACTIVE;

      // Solid black background.
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, FH);

      // Vertical column dividers only (FCOM-correct).
      [105, 210, 312, 418].forEach(x => line(x, 2, x, FH - 2, "#555", 1));

      // Row 1 — ENGAGED modes (first line).
      // Vertical and lateral modes only shown when airborne (altitude > 0).
      // On ground they are ARMED (second line, blue) not yet engaged.
      txt(thrMode, 52,  16, 14, thrColor, "center", true, 5);
      if (!onGround) {
        // FCOM DSC-22_30-100-C [fcom:L37741]: engaged row-1 modes are always GREEN.
        // "SRS — Green — Takeoff or go-around mode is engaged." No cyan on row 1.
        // FCOM DSC-22_30-70-80 [fcom:L11987-11988]: V/S nulled → FMA shows "V/S = 0" in green.
        const vsVal = live?.vs ?? 0;
        const vertLabel = (vertMode === "V/S" && vsVal === 0) ? "V/S = 0" : vertMode;
        const vertFontSz = vertLabel === "V/S = 0" ? 11 : 14;
        txt(vertLabel, 156, 16, vertFontSz, C_ACTIVE, "center", true, 5);
        txt(latMode,   260, 16, 14, C_ACTIVE, "center", true, 5);
      }

      // Engagement column — AP / FD / A/THR.
      // AP1 only shown when autopilot is engaged (after PF presses AP1 on FCU).
      if (live?.apEngaged) txt("AP1", 466, 13, 11, C_WHITE, "center", true);
      txt("1 FD 2", 466, 30, 11, C_WHITE, "center", true);
      // A/THR: GREEN when actively managing thrust (levers at managed detent),
      //        CYAN when armed (pb pressed, levers at TOGA = MAN TOGA on col 1),
      //        not shown when A/THR off.
      if (live?.athrActive)     txt("A/THR", 466, 47, 11, C_ACTIVE, "center", true);
      else if (live?.athrArmed) txt("A/THR", 466, 47, 11, C_ARMED,  "center", true);

      // Row 2 — ARMED modes (second line, blue) and thrust cues (third line, white flashing).
      if (onGround) {
        // Before liftoff: SRS and NAV are armed (blue).
        txt("SRS", 156, 44, 12, C_ARMED, "center", true, 3);
        if (latMode === "NAV") txt("NAV", 260, 44, 12, C_ARMED, "center", true, 3);
      } else {
        // Airborne: CLB is armed during SRS climb (altitude capture target is armed).
        if (vertMode === "SRS") txt("CLB", 156, 44, 12, C_ARMED, "center", true, 3);
        // LVR CLB or LVR MCT cue in thrust column — white, flashing at ~1 Hz.
        if (thrCue) {
          const flashOn = Math.floor(Date.now() / 500) % 2 === 0;
          if (flashOn) txt(thrCue, 52, 44, 12, C_WHITE, "center", true, 3);
        }
      }

      // FMA 3rd line, top priority (FCOM DSC-22_30-100): "USE MAN PITCH TRIM"
      // in amber when F/CTL are in DIRECT LAW (e.g. after L/G DN on DUAL HYD G+Y).
      if (live?.law === "DIRECT") {
        txt("USE MAN PITCH TRIM", 156, 46, 11, "#ffbf00", "center", true, 1);
      }
    };

    // ── ADI ────────────────────────────────────────────────────────────────
    // FCOM DSC-31-40 ATTITUDE DATA — outer shape is a STADIUM: top arc + bottom
    // arc + straight vertical sides in the middle (NOT a circle).  The bank
    // (roll) scale lies on the top arc; the roll index ▽ rotates around the
    // top-arc centre so its apex always tracks the bank-angle position.
    const drawADI = () => {
      const cx = ATX, cy = ATY, r = ATR;       // r = arc radius (also bank arc)
      // Stadium tuned to MATCH the speed / altitude tape height (345 px).
      // Smaller top + bottom arcs + LONGER straight middle, per the FCOM
      // photo proportions.  W = 200, H = 346, ratio 29 % / 42 % / 29 %.
      const VEXT = 73;                          // half-height of straight middle
      const PPD = 9.5;
      const topArcCY = cy - VEXT;               // centre of the top arc
      const botArcCY = cy + VEXT;               // centre of the bottom arc

      ctx.save();
      // Stadium clip path: top semicircle → right straight → bottom semicircle → left straight
      ctx.beginPath();
      ctx.arc(cx, topArcCY, r, Math.PI, 2 * Math.PI);
      ctx.lineTo(cx + r, botArcCY);
      ctx.arc(cx, botArcCY, r, 0, Math.PI);
      ctx.lineTo(cx - r, topArcCY);
      ctx.closePath();
      ctx.clip();
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
        // Wider, more-visible pitch ticks (was 80 / 48 / 24).
        const len = isDec ? 100 : isFive ? 60 : 32;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = isDec ? 2.4 : 1.2;
        ctx.beginPath(); ctx.moveTo(-len / 2, py); ctx.lineTo(len / 2, py); ctx.stroke();
        if (isDec) {
          ctx.font = 'bold 14px "Courier New"'; ctx.fillStyle = "#fff";
          ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(String(Math.abs(deg)), -len / 2 - 6, py);
          ctx.textAlign = "left";
          ctx.fillText(String(Math.abs(deg)),  len / 2 + 6, py);
        }
        if (Math.abs(deg) === 20) {
          const dir = deg > 0 ? 1 : -1;
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(-len / 2, py); ctx.lineTo(-len / 2, py + dir * 12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo( len / 2, py); ctx.lineTo( len / 2, py + dir * 12); ctx.stroke();
        }
      }

      // ── F/CTL law indication (FCOM DSC-27-20-20 + DSC-22-30) ─────────────────
      // In ALTERNATE or DIRECT law there is no pitch attitude protection, so amber
      // Xs replace the green "=" symbols. FCOM DSC-27 places these ON THE PITCH
      // SCALE at the pitch-attitude-protection limits: +30° nose-up and -15°
      // nose-down. Drawn here INSIDE the pitch-ladder transform (centred on the
      // scale, x=0) so they ride the scale and move with pitch/roll.
      if (d.law && d.law !== "NORMAL") {
        ctx.strokeStyle = "#ffbf00"; ctx.lineWidth = 3; ctx.lineCap = "round";
        const S = 9;
        const amberXAt = (py2: number) => {
          ctx.beginPath();
          ctx.moveTo(-S, py2 - S); ctx.lineTo(S, py2 + S);
          ctx.moveTo(S, py2 - S); ctx.lineTo(-S, py2 + S);
          ctx.stroke();
        };
        amberXAt(-30 * PPD);   // +30° nose-up protection limit
        amberXAt( 15 * PPD);   // -15° nose-down protection limit
        ctx.lineCap = "butt";
      }
      ctx.restore();

      // Bank arc ticks per FCOM DSC-31-40: white roll scale with markers at
      // 0°, 10°, 20°, 30°, and 45°.  0° is the white lubber line at top centre
      // (drawn separately).  No digits.  ±45° gets a yellow inverted triangle
      // accent.  (Bank > 45° declutters the PFD per FCOM — modelled in trainer
      // logic, not in this visual layer.)
      ctx.save(); ctx.translate(cx, topArcCY);
      const bankTicks: { angle: number; len: number; color: string; tri?: boolean }[] = [
        { angle: 10, len:  6, color: "#ffffff" },
        { angle: 20, len:  6, color: "#ffffff" },
        { angle: 30, len: 12, color: "#ffffff" },
        { angle: 45, len: 14, color: "#ffff00", tri: true },
      ];
      // Bank scale lives OUTSIDE the attitude indicator (above the top arc).
      // r1 (inner end of tick) sits just outside the top-arc edge; r2 (outer)
      // is further out.  The 45° accent triangle points INWARD with its tip
      // at the top-arc edge.
      bankTicks.forEach(({ angle, len, color, tri }) => {
        [-angle, angle].forEach(ang => {
          const rad = (ang - 90) * Math.PI / 180;
          const r1  = r + 4, r2 = r + 4 + len;
          ctx.strokeStyle = color; ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(rad) * r1, Math.sin(rad) * r1);
          ctx.lineTo(Math.cos(rad) * r2, Math.sin(rad) * r2);
          ctx.stroke();
          if (tri) {
            // Small filled triangle pointing INWARD (toward the ADI), tip at
            // the top-arc edge.
            const tipR = r;
            const baseR = r1;
            const px = Math.cos(rad), py = Math.sin(rad);
            const perpX = -py,  perpY = px;
            const tip   = { x: px * tipR,  y: py * tipR  };
            const baseL = { x: px * baseR + perpX * 4, y: py * baseR + perpY * 4 };
            const baseR2= { x: px * baseR - perpX * 4, y: py * baseR - perpY * 4 };
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(baseL.x, baseL.y);
            ctx.lineTo(baseR2.x, baseR2.y);
            ctx.closePath(); ctx.fill();
          }
        });
      });
      ctx.restore();

      // Roll index ▽ + sideslip index (FCOM DSC-31-40).  The roll INDEX is a
      // single yellow OUTLINE triangle pointing DOWN, sitting OUTSIDE the
      // top arc (between the bank ticks and the ADI), tracking bank angle
      // as it rotates around the top-arc centre.  The sideslip trapezoid
      // sits just inside the top arc.
      ctx.save(); ctx.translate(cx, topArcCY); ctx.rotate(-d.roll * Math.PI / 180);
      // Down-pointing triangle: apex CLOSER to ADI top arc (smaller magnitude),
      // base further out (larger magnitude).
      ctx.strokeStyle = "#ff0"; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(0, -(r + 2));                       // apex (bottom — points down at ADI)
      ctx.lineTo(-8, -(r + 18));                     // top-left
      ctx.lineTo(8, -(r + 18));                      // top-right
      ctx.closePath();
      ctx.stroke();
      // Sideslip trapezoid — INSIDE the top arc, just below the roll index
      // tip.  1 cm = 0.2 g, hard stop at 0.3 g.
      const slipG  = Math.max(-0.3, Math.min(0.3, d.sideslipG ?? 0));
      const slipDx = (slipG / 0.2) * 18;
      const sy = -r + 6;
      ctx.fillStyle = "#ff0";
      ctx.beginPath();
      ctx.moveTo(slipDx - 4, sy);                    // narrow top (8 wide)
      ctx.lineTo(slipDx + 4, sy);
      ctx.lineTo(slipDx + 8, sy + 6);                // wider bottom (16 wide)
      ctx.lineTo(slipDx - 8, sy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.lineJoin = "miter";
      ctx.restore();

      // Fixed aircraft symbol — FCOM DSC-31-40: "in black, and outlined in
      // yellow."  Implemented as a thick yellow underlay (the outline) with
      // a thinner black overlay on top for each line segment, plus a black-
      // filled, yellow-bordered centre square.
      ctx.save(); ctx.translate(cx, cy);

      const drawWingL = (outerX: number, innerX: number, dropY: number) => {
        ctx.lineCap  = "round";
        ctx.lineJoin = "miter";        // sharp inner corner
        // Yellow outline (thicker)
        ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(outerX, 0);
        ctx.lineTo(innerX, 0);
        ctx.lineTo(innerX, dropY);
        ctx.stroke();
        // Black core (thinner) — bends WITH the path, so the inner corner
        // reads BLACK (yellow only as a thin border) instead of yellow.
        ctx.strokeStyle = "#000000"; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(outerX, 0);
        ctx.lineTo(innerX, 0);
        ctx.lineTo(innerX, dropY);
        ctx.stroke();
      };

      // Wings — scaled +30 % (was ±85/±62 outer/inner, drop 12; now
      // ±110/±80, drop 16).  Horizontal sits OUTSIDE the FD bars (FD reaches
      // ±58, wings start at ±80).  Vertical hooks drop DOWN from the inner
      // corner, which renders black because the L-path's black core wraps
      // the join.
      drawWingL(-110, -80, 16);
      drawWingL( 110,  80, 16);

      // Centre square — smaller per user feedback (was 18×18, now 12×12).
      // Black fill, yellow border.
      ctx.fillStyle = "#000000";
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 2;
      ctx.strokeRect(-6, -6, 12, 12);

      ctx.lineCap = "butt";
      ctx.restore();

      // Flight Director — green crossed bars, centred ON the aircraft symbol
      // (DSC-22_30-20: pitch + roll guidance commands).  When aircraft is on
      // commanded path, bars cross at the aircraft symbol centre.
      const fdPitchOffset = 0;     // centred on aircraft (no climb offset in demo)
      const fdRollOffset  = 0;     // wings level
      const FD_HALF = 58;          // half-length — bigger crosshair per user feedback
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = "#00dd00";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "#00dd00"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-FD_HALF, fdPitchOffset); ctx.lineTo(FD_HALF, fdPitchOffset); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fdRollOffset, -FD_HALF); ctx.lineTo(fdRollOffset, FD_HALF); ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.restore();

      // Stadium border — matches the clip path (no more circle around ADI).
      ctx.beginPath();
      ctx.arc(cx, topArcCY, r, Math.PI, 2 * Math.PI);
      ctx.lineTo(cx + r, botArcCY);
      ctx.arc(cx, botArcCY, r, 0, Math.PI);
      ctx.lineTo(cx - r, topArcCY);
      ctx.closePath();
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

      // LOC scale (below ADI) — sits OUTSIDE the stadium bottom (cy + VEXT + r),
      // in the band between the ADI and the HDG tape.
      const locy = cy + VEXT + r + 22;
      [2, 1, -1, -2].forEach(i => {
        const sx2 = cx + i * 48;
        ctx.beginPath(); ctx.arc(sx2, locy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5; ctx.stroke();
      });
      const locX = cx + d.locPos * 48;
      diamond(locX, locy, 8, 8, "#ff00ff");

      // RA — green numeric value with subtle glow
      // Radio altimeter shows only below 2500 ft AGL (FCOM / baseline §4) — above
      // that it is blank, not the capped "2500". (Formula at d.ra unchanged.)
      if (d.ra < 2500) txt(d.ra, cx, cy + r - 28, 20, "#00ff00", "center", true, 5);
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

      // Speed trend arrow (yellow) — projects current speed forward by `trend`
      // kt over 10 s.  Arrow points TOWARD where the speed is heading: up for
      // acceleration, down for deceleration.
      if (d.trend !== undefined && Math.abs(d.trend) >= 1) {
        const trendY  = yFor(spd + d.trend);
        const trendX  = x + w + 1;                       // just outside the tape
        const startY  = d.trend > 0 ? mid - 18 : mid + 18; // edge of speed box
        ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(trendX, startY); ctx.lineTo(trendX, trendY); ctx.stroke();
        // Arrowhead (open V) — wings on the trailing side of the tip so the
        // arrow points in the direction of motion.  For accel (trend>0) the
        // tip is HIGHER on canvas (smaller y), so wings extend DOWN (+y).
        // For decel (trend<0) the tip is LOWER, so wings extend UP (-y).
        const dir = d.trend >= 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(trendX, trendY);
        ctx.lineTo(trendX - 5, trendY + dir * 8);
        ctx.moveTo(trendX, trendY);
        ctx.lineTo(trendX + 5, trendY + dir * 8);
        ctx.stroke();
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
    // Layout: vertical green bar on the left of the strip (the level indicator)
    // + horizontal pointer extending right to the banana-curve scale edge.
    // Scale labels: "1" = 1000 fpm, "2" = 2000 fpm (above and below centre).
    const drawVS = () => {
      const x = VX, w = VW, top = VT, h = VH;
      const MAX_VS = 6000;
      ctx.fillStyle = "#1e1e1e"; ctx.fillRect(x, top, w, h);

      const mid   = top + h / 2;
      const halfH = h / 2 - 22;   // ±160 px full scale range
      // Right-side banana curve — prominent decorative right boundary (BULGE=14)
      const BULGE  = 14;
      const xCurve = (yFrac: number) => (x + w - 1) - BULGE * yFrac * yFrac;
      ctx.strokeStyle = "#666"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const yf = -1 + 2 * i / 40;
        if (i === 0) ctx.moveTo(xCurve(yf), mid + yf * halfH);
        else         ctx.lineTo(xCurve(yf), mid + yf * halfH);
      }
      ctx.stroke();

      // Y for any fpm — linear, full strip height
      const yFor = (fpm: number) => mid - (fpm / MAX_VS) * halfH;

      // Scale marks: digit at LEFT edge, tick immediately to its right
      // Layout per mark: [digit 6px][tick 5px] — all inside the strip
      const TX = x + 1;   // bar tip x / left edge reference (469)
      const marks: [number, string | null][] = [
        [6000, "6"], [4000, null], [2000, "2"], [1000, "1"], [500, null],
      ];
      marks.forEach(([fpm, lbl]) => {
        [1, -1].forEach(sign => {
          const yy    = yFor(sign * fpm);
          const tickX = TX + (lbl ? 7 : 2);   // tick starts after digit (labeled) or at edge (unlabeled)
          const tL    = lbl ? 5 : 3;
          ctx.strokeStyle = "#aaa"; ctx.lineWidth = lbl ? 1.5 : 1;
          ctx.beginPath(); ctx.moveTo(tickX, yy); ctx.lineTo(tickX + tL, yy); ctx.stroke();
          if (lbl) txt(lbl, tickX - 1, yy, 10, "#ddd", "right", true);   // bold, right-aligned just before tick
        });
      });

      // Zero tick — full width; bar lies flat on this line at VS=0
      ctx.strokeStyle = "#666"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, mid); ctx.lineTo(x + w, mid); ctx.stroke();

      // ── VS bar ─────────────────────────────────────────────────────────────
      // Right end fixed at datum (x+w−1, mid). Left end: fixed TX, y = yFor(vc).
      // At VS=0 bar is horizontal on the zero tick. Length grows as VS increases.
      const PX = x + w - 1;   // datum (497)
      const vc = Math.max(-MAX_VS, Math.min(MAX_VS, d.vs));
      if (Math.abs(vc) > 30) {
        const tipY = yFor(vc);

        ctx.save();
        ctx.beginPath(); ctx.rect(x, top, w, h); ctx.clip();
        ctx.lineCap = "round";
        ctx.strokeStyle = "#00cc00"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(PX, mid); ctx.lineTo(TX, tipY); ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();

        // Readout at the tip — inside strip, at the left end of the bar
        const vsHundreds = Math.round(Math.abs(vc) / 100);
        const boxW = 18, boxH = 12;
        const boxX = TX + 1;   // 470
        const boxY = Math.max(top + 2, Math.min(top + h - boxH - 2, tipY - boxH / 2));
        ctx.fillStyle = "#000"; ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = "#00cc00"; ctx.lineWidth = 1; ctx.strokeRect(boxX, boxY, boxW, boxH);
        txt(String(vsHundreds), boxX + boxW / 2, boxY + boxH / 2, 10, "#00cc00", "center", true);
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
    // Altitude rate follows lerpVs (the animated VS) so the 0–50 ft RA segment
    // climbs gradually as VS builds from zero. For large gaps (>200 ft) a 2000
    // ft/min cap prevents very slow catch-ups mid-scenario.
    // Freeze rule: all tapes hold while a PF-action ring is visible AND
    // lerpAlt has already reached the ring's target altitude.
    let lerpAlt = -1, lerpSpd = -1, lerpVs = 0;
    let prevTimestamp = performance.now();
    let t = 0;
    let rafId = 0;
    const animate = (timestamp: number) => {
      const deltaMs = Math.min(timestamp - prevTimestamp, 100);
      prevTimestamp = timestamp;
      if (!pausedRef.current) t += 0.004;           // freeze shimmer when paused
      const live = stateRef.current
        ? buildAircraftState(stateRef.current, scenarioRef.current, elapsedMsRef.current)
        : null;
      if (live) {
        const tgtAlt = live.altitude;
        const tgtSpd = live.speed;
        const tgtVs  = live.vs;
        const nowHasRing = !!pendingPhaseRef.current;
        if (lerpAlt < 0) {
          // First frame: start altitude from ground when near ground so RA climbs
          // smoothly 0→50→100 ft. Snap to target only when resuming mid-scenario.
          lerpAlt = tgtAlt < 900 ? 777 : tgtAlt;
          lerpSpd = tgtSpd;
          lerpVs  = tgtAlt < 900 ? 0 : tgtVs;
        } else {
          const altDiff = tgtAlt - lerpAlt;
          const atTarget = Math.abs(altDiff) < 1;
          const frozen = nowHasRing && atTarget;
          if (!frozen) {
            // VS updates first so the altitude uses the freshly-animated VS rate.
            lerpSpd += (tgtSpd - lerpSpd) * 0.05;
            lerpVs  += (tgtVs  - lerpVs)  * 0.06;
            // For large gaps use capped 2000 ft/min; near the target use lerpVs
            // so the RA climbs gradually from 0 (vs ramps from 0 on first flight).
            const vsMs   = Math.abs(lerpVs) / 60000;
            const rateMs = Math.abs(altDiff) > 200
              ? 2000 / 60000
              : Math.max(vsMs, 50 / 60000);
            const altStep = Math.sign(altDiff) * Math.min(Math.abs(altDiff), rateMs * deltaMs);
            lerpAlt = atTarget ? tgtAlt : lerpAlt + altStep;
          } else {
            // Ring visible and at target — freeze all tapes. Snap to exact target
            // so RA always reads a clean value (100, 400) rather than 99, 399.
            lerpAlt = tgtAlt;
          }
        }
        d.pitch  = live.pitch  + Math.sin(t) * 0.15;
        d.roll   = live.bank;
        d.speed  = Math.round(lerpSpd);
        d.vmax   = live.vmax ?? d.vmax;   // scenario VMO/MMO barber-pole (cruise raises it)
        d.law    = live.law ?? 'NORMAL';  // F/CTL law for amber-X / MAN PITCH TRIM
        d.selSpd = live.selectedSpeed;
        d.mgtSpd = live.selectedSpeed;
        d.alt    = Math.round(lerpAlt);
        d.selAlt = live.selectedAlt;
        d.vs     = Math.round(lerpVs / 10) * 10;
        d.hdg    = live.heading;
        d.selHdg = live.selectedHdg;
        d.track  = live.track;
        // RA = baro alt minus VIDP field elevation (777 ft AMSL)
        d.ra = Math.max(0, Math.round(Math.min(2500, lerpAlt - 777)));
      } else {
        // Demo / standalone mode — only the attitude indicator shimmers.
        d.pitch = 2    + Math.sin(t) * 0.4;
        d.speed = 145;
        d.alt   = 3740;
        d.vs    = 500;
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
    animate(performance.now());

    return () => cancelAnimationFrame(rafId);
  }, []);

  // Two display modes:
  //   • Standalone (no `state` prop) — full-screen demo at /mockups/pfd
  //   • Wired (with `state`) — fills its parent container slot in the runner
  if (state) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
        {needsConfirm && pfAction && (
          <PfActionOverlay
            label={pfAction.label}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    );
  }
  return (
    <div style={{ background: "#000", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "520px", height: "640px" }} />
    </div>
  );
}
