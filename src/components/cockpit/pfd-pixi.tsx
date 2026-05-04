"use client";

import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";

// ─── Aircraft state ────────────────────────────────────────────────────────────

export interface AircraftState {
  speed: number;
  altitude: number;
  selectedAltitude: number;
  heading: number;
  selectedHeading: number;
  pitch: number;        // degrees nose-up positive
  bank: number;         // degrees right-bank positive
  verticalSpeed: number; // fpm
  flaps: number;
  eng2Failed: boolean;
}

const DEFAULT_STATE: AircraftState = {
  speed: 250,
  altitude: 12000,
  selectedAltitude: 15000,
  heading: 270,
  selectedHeading: 300,
  pitch: 2,
  bank: -5,
  verticalSpeed: -1200,
  flaps: 1,
  eng2Failed: true,
};

// ─── 1024×1024 internal coordinate system ─────────────────────────────────────

const W = 1024;
const H = 1024;

// Vertical bands
const T_TOP = 82;   // tape/horizon top
const T_BOT = 872;  // tape/horizon bottom
const T_H   = T_BOT - T_TOP; // 790

// Speed tape (left)
const SPD_X = 8;
const SPD_W = 148;
const SPD_R = SPD_X + SPD_W; // 156

// Horizon (centre)
const HRZ_X  = 163;
const HRZ_R  = 858;
const HRZ_W  = HRZ_R - HRZ_X;  // 695
const HRZ_CX = HRZ_X + HRZ_W / 2; // ~510
const HRZ_CY = T_TOP + T_H / 2;   // 477

// Altitude tape (right)
const ALT_X = 865;
const ALT_W = 118;
const ALT_R = ALT_X + ALT_W; // 983

// VSI (far right)
const VSI_X = 988;
const VSI_W = 30;

// Heading tape (bottom strip)
const HDG_Y = 882;
const HDG_H = 90;

// FMA
const FMA_H = 72;

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  black:   0x000000,
  white:   0xFFFFFF,
  sky:     0x1758A4,
  ground:  0x6B3A1F,
  green:   0x00C26B,
  cyan:    0x00D8E8,
  amber:   0xFFB000,
  red:     0xFF2C2C,
  yellow:  0xFFE200,
  magenta: 0xFF00CC,
  grey:    0x2A2F38,
  greyMid: 0x4A5060,
  tapeBg:  0x030508,
} as const;

const S = {
  white:   "#FFFFFF",
  green:   "#00C26B",
  cyan:    "#00D8E8",
  amber:   "#FFB000",
  red:     "#FF2C2C",
  yellow:  "#FFE200",
  magenta: "#FF00CC",
  grey:    "#4A5060",
} as const;

const FONT = '"Courier New","Lucida Console",monospace';

// ─── Helper: create Text object ────────────────────────────────────────────────

function mkTxt(
  label: string,
  size: number,
  color: string = S.white,
  bold  = false
): Text {
  return new Text({
    text: label,
    style: {
      fontFamily:  FONT,
      fontSize:    size,
      fill:        color,
      fontWeight:  bold ? "bold" : "normal",
      lineHeight:  size,
    },
  });
}

// ─── drawFMA ──────────────────────────────────────────────────────────────────

export function drawFMA(stage: Container, state: AircraftState): void {
  const g = new Graphics();

  // Black background strip
  g.rect(0, 0, W, FMA_H);
  g.fill(C.black);

  // Bottom separator
  g.moveTo(0, FMA_H);
  g.lineTo(W, FMA_H);
  g.stroke({ color: C.greyMid, width: 1 });

  // 5-column vertical dividers
  const colW = W / 5;
  for (let i = 1; i < 5; i++) {
    g.moveTo(colW * i, 4);
    g.lineTo(colW * i, FMA_H - 4);
    g.stroke({ color: C.greyMid, width: 1 });
  }

  stage.addChild(g);

  const cols = [
    { top: "THR IDLE", bot: "",   color: S.green },
    { top: "OP DES",   bot: "",   color: S.green },
    { top: "NAV",      bot: "",   color: S.green },
    { top: "AP 1",     bot: "FD", color: S.white },
    { top: "A/THR",    bot: "",   color: S.green },
  ];

  cols.forEach((col, i) => {
    const cx = colW * i + colW / 2;

    const top = mkTxt(col.top, 24, col.color, true);
    top.anchor.set(0.5, 0.5);
    top.x = cx;
    top.y = col.bot ? 22 : FMA_H / 2;
    stage.addChild(top);

    if (col.bot) {
      const bot = mkTxt(col.bot, 19, S.white);
      bot.anchor.set(0.5, 0.5);
      bot.x = cx;
      bot.y = 50;
      stage.addChild(bot);
    }
  });

  // ENG 2 FAIL amber box (upper-right, just below FMA)
  if (state.eng2Failed) {
    const bx = new Graphics();
    bx.rect(HRZ_R - 5, FMA_H + 6, 172, 36);
    bx.fill(C.black);
    bx.rect(HRZ_R - 5, FMA_H + 6, 172, 36);
    bx.stroke({ color: C.amber, width: 2 });
    stage.addChild(bx);

    const ft = mkTxt("ENG 2 FAIL", 24, S.amber, true);
    ft.anchor.set(0.5, 0.5);
    ft.x = HRZ_R - 5 + 86;
    ft.y = FMA_H + 24;
    stage.addChild(ft);
  }
}

// ─── drawHorizon ──────────────────────────────────────────────────────────────

export function drawHorizon(stage: Container, state: AircraftState): void {
  const { pitch, bank } = state;
  const PPD = 15; // pixels per degree pitch
  const pitchOff = pitch * PPD; // positive pitch → horizon drops (more sky)

  // Clipping mask — rectangular horizon window
  const clipMask = new Graphics();
  clipMask.rect(HRZ_X, T_TOP, HRZ_W, T_H);
  clipMask.fill(C.white);

  const hrzClip = new Container();
  hrzClip.mask = clipMask;
  stage.addChild(clipMask);
  stage.addChild(hrzClip);

  // Rotating group — bank rotates around horizon centre
  const bgGroup = new Container();
  bgGroup.pivot.set(HRZ_CX, HRZ_CY);
  bgGroup.position.set(HRZ_CX, HRZ_CY);
  bgGroup.rotation = (bank * Math.PI) / 180;

  const BIG = HRZ_W * 3;

  // Sky
  const bg = new Graphics();
  bg.rect(HRZ_CX - BIG / 2, HRZ_CY - BIG + pitchOff, BIG, BIG);
  bg.fill(C.sky);

  // Ground
  bg.rect(HRZ_CX - BIG / 2, HRZ_CY + pitchOff, BIG, BIG);
  bg.fill(C.ground);

  // Horizon line
  bg.moveTo(HRZ_CX - BIG / 2, HRZ_CY + pitchOff);
  bg.lineTo(HRZ_CX + BIG / 2, HRZ_CY + pitchOff);
  bg.stroke({ color: C.white, width: 2.5 });

  bgGroup.addChild(bg);

  // Pitch ladder (child of bgGroup → rotates with bank)
  const ladder = drawPitchLadder(state, pitchOff, PPD);
  bgGroup.addChild(ladder);

  hrzClip.addChild(bgGroup);

  // Thin border around horizon area (above mask layer)
  const border = new Graphics();
  border.rect(HRZ_X, T_TOP, HRZ_W, T_H);
  border.stroke({ color: C.greyMid, width: 1.5 });
  stage.addChild(border);
}

// ─── drawPitchLadder ──────────────────────────────────────────────────────────

export function drawPitchLadder(
  state: AircraftState,
  pitchOff: number,
  PPD: number
): Container {
  const group = new Container();
  const g     = new Graphics();

  const RUNGS = [-20, -15, -10, -5, 5, 10, 15, 20];

  RUNGS.forEach((deg) => {
    const y     = HRZ_CY + pitchOff - deg * PPD;
    const major = Math.abs(deg) % 10 === 0;
    const half  = major ? 108 : 54;
    const lw    = major ? 2 : 1;

    // Main horizontal rung
    g.moveTo(HRZ_CX - half, y);
    g.lineTo(HRZ_CX + half, y);
    g.stroke({ color: C.white, width: lw });

    // End down-ticks (point toward horizon)
    const tickDir = deg > 0 ? 14 : -14;
    g.moveTo(HRZ_CX - half, y);
    g.lineTo(HRZ_CX - half, y + tickDir);
    g.stroke({ color: C.white, width: lw });
    g.moveTo(HRZ_CX + half, y);
    g.lineTo(HRZ_CX + half, y + tickDir);
    g.stroke({ color: C.white, width: lw });

    // Numbers at major rungs
    if (major) {
      const label = String(Math.abs(deg));

      const lNum = mkTxt(label, 22, S.white);
      lNum.anchor.set(1, 0.5);
      lNum.x = HRZ_CX - half - 8;
      lNum.y = y;
      group.addChild(lNum);

      const rNum = mkTxt(label, 22, S.white);
      rNum.anchor.set(0, 0.5);
      rNum.x = HRZ_CX + half + 8;
      rNum.y = y;
      group.addChild(rNum);
    }
  });

  group.addChild(g);
  return group;
}

// ─── drawBankScale ────────────────────────────────────────────────────────────

export function drawBankScale(stage: Container, state: AircraftState): void {
  const { bank } = state;
  const R   = HRZ_W / 2 - 18;
  const ACX = HRZ_CX;
  const ACY = T_TOP + 26;

  const g = new Graphics();

  [0, 10, 20, 30, 45, 60].forEach((deg) => {
    const signs = deg === 0 ? [0] : [-deg, deg];
    signs.forEach((a) => {
      const rad    = ((a - 90) * Math.PI) / 180;
      const major  = deg % 30 === 0 || deg === 0;
      const tl     = major ? 20 : 12;
      const x1 = ACX + R * Math.cos(rad);
      const y1 = ACY + R * Math.sin(rad);
      const x2 = ACX + (R - tl) * Math.cos(rad);
      const y2 = ACY + (R - tl) * Math.sin(rad);
      g.moveTo(x1, y1).lineTo(x2, y2);
      g.stroke({ color: C.white, width: major ? 2 : 1 });
    });
  });

  stage.addChild(g);

  // Rotating bank pointer (white triangle, points inward from arc)
  const pRad = ((bank - 90) * Math.PI) / 180;
  const pd   = R - 24;
  const px   = ACX + pd * Math.cos(pRad);
  const py   = ACY + pd * Math.sin(pRad);

  const ptr = new Graphics();
  ptr.poly([0, -13, -8, 5, 8, 5]);
  ptr.fill(C.white);
  ptr.x = px;
  ptr.y = py;
  ptr.rotation = pRad + Math.PI / 2;
  stage.addChild(ptr);

  // Slip/skid rectangle (offset by ball displacement)
  const ssX = ACX + bank * 2.8;
  const ssY = ACY + R + 14;
  const ss  = new Graphics();
  ss.rect(ssX - 12, ssY, 24, 9);
  ss.fill(C.white);
  stage.addChild(ss);
}

// ─── drawAircraftSymbol ───────────────────────────────────────────────────────

export function drawAircraftSymbol(stage: Container): void {
  const g  = new Graphics();
  const cx = HRZ_CX;
  const cy = HRZ_CY;

  // Wings
  g.moveTo(cx - 88, cy).lineTo(cx - 18, cy);
  g.stroke({ color: C.yellow, width: 5 });
  g.moveTo(cx + 18, cy).lineTo(cx + 88, cy);
  g.stroke({ color: C.yellow, width: 5 });

  // Centre fuselage bar
  g.moveTo(cx - 18, cy).lineTo(cx + 18, cy);
  g.stroke({ color: C.yellow, width: 5 });

  // Centre dot
  g.circle(cx, cy, 5);
  g.fill(C.yellow);

  // Tail
  g.moveTo(cx, cy).lineTo(cx, cy - 22);
  g.stroke({ color: C.yellow, width: 3 });

  // Fixed reference bars (outer horizon lines)
  g.moveTo(cx + 100, cy).lineTo(cx + 130, cy);
  g.stroke({ color: C.yellow, width: 2.5 });
  g.moveTo(cx - 100, cy).lineTo(cx - 130, cy);
  g.stroke({ color: C.yellow, width: 2.5 });

  stage.addChild(g);
}

// ─── drawFlightDirector ───────────────────────────────────────────────────────

export function drawFlightDirector(stage: Container): void {
  const g  = new Graphics();
  const cx = HRZ_CX;
  const cy = HRZ_CY;

  // Horizontal command bar (slightly above wing line = climb command)
  const fdY = cy - 20;
  g.moveTo(cx - 68, fdY).lineTo(cx + 68, fdY);
  g.stroke({ color: C.magenta, width: 5 });

  // Vertical command bar (slightly right = right turn command)
  const fdX = cx - 10;
  g.moveTo(fdX, cy - 52).lineTo(fdX, cy + 8);
  g.stroke({ color: C.magenta, width: 5 });

  stage.addChild(g);
}

// ─── drawSpeedTape ────────────────────────────────────────────────────────────

export function drawSpeedTape(stage: Container, state: AircraftState): void {
  const { speed } = state;
  const PPK = 4.8; // pixels per knot
  const CY  = HRZ_CY;

  // Background
  const bg = new Graphics();
  bg.rect(SPD_X, T_TOP, SPD_W, T_H);
  bg.fill(C.tapeBg);
  bg.rect(SPD_X, T_TOP, SPD_W, T_H);
  bg.stroke({ color: C.grey, width: 1 });
  stage.addChild(bg);

  // Clipped tape
  const clipMask = new Graphics();
  clipMask.rect(SPD_X, T_TOP, SPD_W, T_H);
  clipMask.fill(C.white);

  const tape = new Container();
  tape.mask = clipMask;
  stage.addChild(clipMask);
  stage.addChild(tape);

  const tg = new Graphics();

  for (let spd = 0; spd <= 420; spd += 5) {
    const y = CY + (speed - spd) * PPK;
    if (y < T_TOP - 30 || y > T_BOT + 30) continue;

    const major = spd % 20 === 0;
    const tl    = major ? 24 : 12;

    tg.moveTo(SPD_R, y).lineTo(SPD_R - tl, y);
    tg.stroke({ color: C.white, width: major ? 2 : 1 });

    if (major && spd > 0) {
      const t = mkTxt(String(spd), 24, S.white);
      t.anchor.set(1, 0.5);
      t.x = SPD_R - 30;
      t.y = y;
      tape.addChild(t);
    }
  }

  tape.addChild(tg);

  // VLS lower-protection mark (green)
  const vlsY = CY + (speed - 185) * PPK;
  if (vlsY > T_TOP && vlsY < T_BOT) {
    const vg = new Graphics();
    vg.rect(SPD_X + 2, vlsY, 10, Math.max(1, T_BOT - vlsY));
    vg.fill(C.green);
    stage.addChild(vg);
  }

  // Speed trend arrow (green, right edge of tape)
  const trendPx = 15 * PPK * Math.sign(state.verticalSpeed === 0 ? -1 : state.verticalSpeed);
  const tg2 = new Graphics();
  tg2.moveTo(SPD_R - 5, CY).lineTo(SPD_R - 5, CY + trendPx);
  tg2.stroke({ color: C.green, width: 3 });
  if (Math.abs(trendPx) > 4) {
    const dir = trendPx < 0 ? -1 : 1;
    tg2.poly([
      SPD_R - 5, CY + trendPx,
      SPD_R - 10, CY + trendPx - dir * 12,
      SPD_R,     CY + trendPx - dir * 12,
    ]);
    tg2.fill(C.green);
  }
  stage.addChild(tg2);

  // Current speed box
  const bxH = 56;
  const sBox = new Graphics();
  sBox.rect(SPD_X, CY - bxH / 2, SPD_W, bxH);
  sBox.fill(C.black);
  sBox.rect(SPD_X, CY - bxH / 2, SPD_W, bxH);
  sBox.stroke({ color: C.white, width: 2.5 });
  stage.addChild(sBox);

  const spdT = mkTxt(String(Math.round(speed)), 44, S.white, true);
  spdT.anchor.set(0.5, 0.5);
  spdT.x = SPD_X + SPD_W / 2;
  spdT.y = CY;
  stage.addChild(spdT);

  // Bottom label
  const lbl = mkTxt(`${speed}`, 19, S.white);
  lbl.anchor.set(0.5, 0);
  lbl.x = SPD_X + SPD_W / 2;
  lbl.y = T_BOT + 6;
  stage.addChild(lbl);
}

// ─── drawAltitudeTape ─────────────────────────────────────────────────────────

export function drawAltitudeTape(stage: Container, state: AircraftState): void {
  const { altitude, selectedAltitude } = state;
  const PPF = 0.052; // pixels per foot
  const CY  = HRZ_CY;

  // Background
  const bg = new Graphics();
  bg.rect(ALT_X, T_TOP, ALT_W, T_H);
  bg.fill(C.tapeBg);
  bg.rect(ALT_X, T_TOP, ALT_W, T_H);
  bg.stroke({ color: C.grey, width: 1 });
  stage.addChild(bg);

  // Clipped tape
  const clipMask = new Graphics();
  clipMask.rect(ALT_X, T_TOP, ALT_W, T_H);
  clipMask.fill(C.white);

  const tape = new Container();
  tape.mask = clipMask;
  stage.addChild(clipMask);
  stage.addChild(tape);

  const tg = new Graphics();

  for (let alt = 0; alt <= 50000; alt += 100) {
    const y = CY + (altitude - alt) * PPF;
    if (y < T_TOP - 30 || y > T_BOT + 30) continue;

    const major = alt % 500 === 0;
    const tl    = major ? 22 : 11;

    tg.moveTo(ALT_X, y).lineTo(ALT_X + tl, y);
    tg.stroke({ color: C.white, width: major ? 2 : 1 });

    if (major) {
      const t = mkTxt(String(alt), 22, S.white);
      t.anchor.set(0, 0.5);
      t.x = ALT_X + 28;
      t.y = y;
      tape.addChild(t);
    }
  }

  tape.addChild(tg);

  // Selected altitude bug (cyan chevron on left edge of tape)
  const selY = CY + (altitude - selectedAltitude) * PPF;
  if (selY > T_TOP && selY < T_BOT) {
    const bg2 = new Graphics();
    bg2.moveTo(ALT_X, selY - 16).lineTo(ALT_X + 24, selY).lineTo(ALT_X, selY + 16);
    bg2.stroke({ color: C.cyan, width: 2.5 });
    stage.addChild(bg2);
  }

  // Selected altitude display (cyan box above tape)
  const selBox = new Graphics();
  selBox.rect(ALT_X, T_TOP - 50, ALT_W, 44);
  selBox.fill(C.black);
  selBox.rect(ALT_X, T_TOP - 50, ALT_W, 44);
  selBox.stroke({ color: C.cyan, width: 2 });
  stage.addChild(selBox);

  const selT = mkTxt(String(selectedAltitude), 30, S.cyan, true);
  selT.anchor.set(0.5, 0.5);
  selT.x = ALT_X + ALT_W / 2;
  selT.y = T_TOP - 28;
  stage.addChild(selT);

  // Current altitude box
  const bxH = 56;
  const aBox = new Graphics();
  aBox.rect(ALT_X, CY - bxH / 2, ALT_W, bxH);
  aBox.fill(C.black);
  aBox.rect(ALT_X, CY - bxH / 2, ALT_W, bxH);
  aBox.stroke({ color: C.white, width: 2.5 });
  stage.addChild(aBox);

  const altT = mkTxt(String(Math.round(altitude)), 38, S.white, true);
  altT.anchor.set(0.5, 0.5);
  altT.x = ALT_X + ALT_W / 2;
  altT.y = CY;
  stage.addChild(altT);

  // FLAPS indication (lower right)
  const flpT = mkTxt(`FLAPS ${state.flaps}`, 20, S.green);
  flpT.anchor.set(0, 0);
  flpT.x = ALT_X + 4;
  flpT.y = T_BOT + 6;
  stage.addChild(flpT);

  // GEAR indication
  const gearT = mkTxt("GEAR DN", 20, S.green);
  gearT.anchor.set(0, 0);
  gearT.x = ALT_X + 4;
  gearT.y = T_BOT + 28;
  stage.addChild(gearT);
}

// ─── drawVSI ──────────────────────────────────────────────────────────────────

export function drawVSI(stage: Container, state: AircraftState): void {
  const { verticalSpeed } = state;
  const CY      = HRZ_CY;
  const MAX_FPM = 2000;
  const PPF     = (T_H / 2) / MAX_FPM;

  const bg = new Graphics();
  bg.rect(VSI_X, T_TOP, VSI_W, T_H);
  bg.fill(C.tapeBg);
  bg.rect(VSI_X, T_TOP, VSI_W, T_H);
  bg.stroke({ color: C.grey, width: 1 });
  stage.addChild(bg);

  const g = new Graphics();

  // Scale ticks
  [2000, 1000, 500, 0, -500, -1000, -2000].forEach((fpm) => {
    const y     = CY - fpm * PPF;
    const major = Math.abs(fpm) % 1000 === 0;
    g.moveTo(VSI_X, y).lineTo(VSI_X + (major ? 14 : 7), y);
    g.stroke({ color: C.white, width: major ? 2 : 1 });
  });

  // VS pointer line
  const clamp = Math.max(-MAX_FPM, Math.min(MAX_FPM, verticalSpeed));
  const vsY   = CY - clamp * PPF;

  g.moveTo(VSI_X + 5, CY).lineTo(VSI_X + 5, vsY);
  g.stroke({ color: C.green, width: 3 });

  if (verticalSpeed !== 0) {
    const d = verticalSpeed > 0 ? -1 : 1;
    g.poly([
      VSI_X + 5, vsY,
      VSI_X,     vsY + d * 12,
      VSI_X + 10, vsY + d * 12,
    ]);
    g.fill(C.green);
  }

  stage.addChild(g);

  // VS readout (to right of tape — printed vertically, approximate)
  const sign  = verticalSpeed >= 0 ? "+" : "";
  const vsLbl = mkTxt(`${sign}${Math.round(verticalSpeed)}`, 17, S.green);
  vsLbl.anchor.set(0.5, 0);
  vsLbl.x = VSI_X + VSI_W / 2;
  vsLbl.y = T_BOT - 70;
  vsLbl.rotation = -Math.PI / 2;
  stage.addChild(vsLbl);

  // "-1200 FPM" label below tape
  const fpmLbl = mkTxt(`${Math.round(verticalSpeed)}`, 18, S.green);
  fpmLbl.anchor.set(0.5, 0);
  fpmLbl.x = VSI_X + VSI_W / 2;
  fpmLbl.y = T_BOT + 6;
  stage.addChild(fpmLbl);
}

// ─── drawHeadingTape ──────────────────────────────────────────────────────────

export function drawHeadingTape(stage: Container, state: AircraftState): void {
  const { heading, selectedHeading } = state;
  const PPD = 5.6; // pixels per degree
  const CX  = HRZ_CX;

  const bg = new Graphics();
  bg.rect(HRZ_X, HDG_Y, HRZ_W, HDG_H);
  bg.fill(C.tapeBg);
  bg.rect(HRZ_X, HDG_Y, HRZ_W, HDG_H);
  bg.stroke({ color: C.grey, width: 1 });
  stage.addChild(bg);

  const clipMask = new Graphics();
  clipMask.rect(HRZ_X, HDG_Y, HRZ_W, HDG_H);
  clipMask.fill(C.white);

  const tape = new Container();
  tape.mask = clipMask;
  stage.addChild(clipMask);
  stage.addChild(tape);

  const tg = new Graphics();

  // Draw heading marks spanning ±180° from current heading
  for (let step = -36; step <= 36; step++) {
    const rawHdg = Math.round(heading / 5) * 5 + step * 5;
    const hdg    = ((rawHdg % 360) + 360) % 360;
    const offset = (((rawHdg - heading) % 360) + 540) % 360 - 180;
    const x      = CX + offset * PPD;

    if (x < HRZ_X - 40 || x > HRZ_R + 40) continue;

    const major = hdg % 10 === 0;
    const tl    = major ? 18 : 9;

    tg.moveTo(x, HDG_Y).lineTo(x, HDG_Y + tl);
    tg.stroke({ color: C.white, width: major ? 2 : 1 });

    if (major) {
      const dispHdg = hdg === 0 ? 360 : hdg;
      // A320 shows two-digit shorthand: 27 for 270, 36 for 360
      const lbl = String(Math.round(dispHdg / 10)).padStart(2, "0");
      const t   = mkTxt(lbl, 22, S.white);
      t.anchor.set(0.5, 0);
      t.x = x;
      t.y = HDG_Y + 20;
      tape.addChild(t);
    }
  }

  tape.addChild(tg);

  // Selected heading bug (cyan)
  const selOff = (((selectedHeading - heading) % 360) + 540) % 360 - 180;
  const selX   = CX + selOff * PPD;
  if (selX > HRZ_X + 5 && selX < HRZ_R - 5) {
    const bug = new Graphics();
    bug.moveTo(selX - 10, HDG_Y).lineTo(selX, HDG_Y + 16).lineTo(selX + 10, HDG_Y);
    bug.stroke({ color: C.cyan, width: 2.5 });
    stage.addChild(bug);
  }

  // Current heading box (centred)
  const bxW = 84;
  const hBox = new Graphics();
  hBox.rect(CX - bxW / 2, HDG_Y, bxW, HDG_H);
  hBox.fill(C.black);
  hBox.rect(CX - bxW / 2, HDG_Y, bxW, HDG_H);
  hBox.stroke({ color: C.white, width: 2.5 });
  stage.addChild(hBox);

  // Triangle pointer at top of box
  const tri = new Graphics();
  tri.poly([CX - 10, HDG_Y + 4, CX + 10, HDG_Y + 4, CX, HDG_Y + 16]);
  tri.fill(C.white);
  stage.addChild(tri);

  const hdgNum = String(((Math.round(heading) % 360) + 360) % 360 || 360).padStart(3, "0");
  const hdgT   = mkTxt(hdgNum, 36, S.white, true);
  hdgT.anchor.set(0.5, 0.5);
  hdgT.x = CX;
  hdgT.y = HDG_Y + HDG_H / 2 + 8;
  stage.addChild(hdgT);
}

// ─── Assemble everything ──────────────────────────────────────────────────────

function buildPFD(stage: Container, state: AircraftState): void {
  drawFMA(stage, state);
  drawHorizon(stage, state);       // clipped horizon + pitch ladder
  drawBankScale(stage, state);     // bank arc above horizon
  drawAircraftSymbol(stage);       // fixed yellow symbol
  drawFlightDirector(stage);       // magenta FD bars
  drawSpeedTape(stage, state);
  drawAltitudeTape(stage, state);
  drawVSI(stage, state);
  drawHeadingTape(stage, state);

  // Outer bezel / LCD glow
  const bezel = new Graphics();
  bezel.rect(0, 0, W, H);
  bezel.stroke({ color: 0x111418, width: 6 });
  stage.addChild(bezel);
}

// ─── React wrapper ────────────────────────────────────────────────────────────

export function PfdPixi({
  state = DEFAULT_STATE,
}: {
  state?: AircraftState;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef       = useRef<Application | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!containerRef.current) return;

      const app = new Application();
      await app.init({
        width:           W,
        height:          H,
        backgroundColor: C.black,
        antialias:       true,
        resolution:      window.devicePixelRatio ?? 1,
        autoDensity:     true,
      });

      if (cancelled) {
        app.destroy(true);
        return;
      }

      appRef.current = app;

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width  = "100%";
      canvas.style.height = "100%";
      containerRef.current!.appendChild(canvas);

      buildPFD(app.stage, state);
    }

    void boot();

    return () => {
      cancelled = true;
      if (appRef.current) {
        const canvas = appRef.current.canvas as HTMLCanvasElement;
        canvas.parentNode?.removeChild(canvas);
        appRef.current.destroy();
        appRef.current = null;
      }
    };
  }, [state]);

  return (
    <div
      ref={containerRef}
      style={{
        width:       "100%",
        aspectRatio: "1 / 1",
        background:  "#000",
        overflow:    "hidden",
        display:     "block",
      }}
    />
  );
}
