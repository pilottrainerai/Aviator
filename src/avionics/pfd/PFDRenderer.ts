import { Container, Graphics, Text } from 'pixi.js';
import type { AircraftState } from '../core/aircraftState';

// ─── Layout (1024 × 1024 logical coordinate space) ───────────────────────────
const W = 1024;
const H = 1024;

const FMA_H  = 80;   // FMA strip at top
const SPD_W  = 120;  // speed tape width (left)
const ALT_W  = 120;  // altitude tape width (right)
const VS_W   = 22;   // vertical speed strip (far right)
const HDG_H  = 82;   // heading tape at bottom

const ATT_X  = SPD_W;
const ATT_Y  = FMA_H;
const ATT_W  = W - SPD_W - ALT_W - VS_W;
const ATT_H  = H - FMA_H - HDG_H;
const ATT_CX = ATT_X + ATT_W / 2;  // 502
const ATT_CY = ATT_Y + ATT_H / 2;  // 511

const HDG_Y  = H - HDG_H;
const ALT_X  = W - ALT_W - VS_W;
const VS_X   = W - VS_W;

// Pitch: 1° = 10px; bank: radians
const PX_DEG = 10;

// ─── Airbus display colors ────────────────────────────────────────────────────
const C = {
  sky:     0x1A4F7A,
  ground:  0x7A5230,
  white:   0xE6E8EC,
  green:   0x00D060,
  cyan:    0x00CFFF,
  amber:   0xFFB300,
  red:     0xFF3333,
  magenta: 0xFF00FF,
  dim:     0x3A4050,
  bg:      0x000000,
  border:  0x1C2130,
} as const;

// ─── Small helpers ────────────────────────────────────────────────────────────

function txt(
  str: string,
  size: number,
  color: number,
  bold = false,
  align: 'left' | 'center' | 'right' = 'left',
): Text {
  const t = new Text({
    text: str,
    style: {
      fontFamily: 'monospace',
      fontSize: size,
      fill: color,
      fontWeight: bold ? 'bold' : 'normal',
      align,
    },
  });
  t.anchor.x = align === 'center' ? 0.5 : align === 'right' ? 1 : 0;
  t.anchor.y = 0.5;
  return t;
}

// ─── PFD Renderer ─────────────────────────────────────────────────────────────

export class PFDRenderer extends Container {

  // Horizon layers (inside horizonCont which is clipped)
  private horizonCont: Container;
  private gHorizon:    Graphics;   // sky + ground + horizon line
  private gPitch:      Graphics;   // pitch ladder

  // Static overlay chrome (drawn once)
  private gChrome: Graphics;

  // Dynamic overlay elements
  private gBankArc:     Graphics;
  private gSpeedTape:   Graphics;
  private gAltTape:     Graphics;
  private gVS:          Graphics;
  private gHdgTape:     Graphics;
  private gFD:          Graphics;
  private gAircraftSym: Graphics;
  private gFMA:         Graphics;
  private gSlip:        Graphics;

  // Text — speed tape
  private spdLabels: Text[];
  private spdBox:    Text;
  private spdSel:    Text;

  // Text — alt tape
  private altLabels: Text[];
  private altBox:    Text;
  private altSel:    Text;

  // Text — heading tape
  private hdgLabels: Text[];
  private hdgBox:    Text;

  // Text — V/S
  private vsText: Text;

  // Text — FMA (3 rows × 5 columns = 15 objects)
  private fmaTop: Text[];
  private fmaSub: Text[];

  // Text — bank pointer digit (optional, not on real A320 FMA)
  // Text — FAIL warnings
  private failText: Text;

  constructor() {
    super();

    // ── Horizon container ────────────────────────────────────────────────────
    this.gHorizon    = new Graphics();
    this.gPitch      = new Graphics();
    this.horizonCont = new Container();
    this.horizonCont.addChild(this.gHorizon);
    this.horizonCont.addChild(this.gPitch);

    // Clip horizon to attitude area
    const mask = new Graphics();
    mask.rect(ATT_X, ATT_Y, ATT_W, ATT_H - HDG_H).fill(0xffffff);
    this.horizonCont.mask = mask;
    this.addChild(mask);
    this.addChild(this.horizonCont);

    // ── Dynamic graphics (layered above horizon) ─────────────────────────────
    this.gBankArc     = new Graphics();
    this.gFD          = new Graphics();
    this.gAircraftSym = new Graphics();
    this.gSlip        = new Graphics();
    this.gSpeedTape   = new Graphics();
    this.gAltTape     = new Graphics();
    this.gVS          = new Graphics();
    this.gHdgTape     = new Graphics();
    this.gFMA         = new Graphics();
    this.gChrome      = new Graphics();

    this.addChild(this.gBankArc);
    this.addChild(this.gFD);
    this.addChild(this.gAircraftSym);
    this.addChild(this.gSlip);
    this.addChild(this.gSpeedTape);
    this.addChild(this.gAltTape);
    this.addChild(this.gVS);
    this.addChild(this.gHdgTape);
    this.addChild(this.gFMA);

    // ── Text objects ─────────────────────────────────────────────────────────
    // Speed labels (10 labels for visible range)
    this.spdLabels = Array.from({ length: 10 }, () => txt('---', 20, C.white));
    this.spdBox    = txt('---', 32, C.white, true, 'center');
    this.spdSel    = txt('---', 18, C.cyan,  false, 'right');
    this.spdLabels.forEach((t) => this.addChild(t));
    this.addChild(this.spdBox);
    this.addChild(this.spdSel);

    // Alt labels
    this.altLabels = Array.from({ length: 10 }, () => txt('-----', 18, C.white));
    this.altBox    = txt('-----', 28, C.cyan, true, 'center');
    this.altSel    = txt('-----', 18, C.cyan, false, 'left');
    this.altLabels.forEach((t) => this.addChild(t));
    this.addChild(this.altBox);
    this.addChild(this.altSel);

    // Heading labels
    this.hdgLabels = Array.from({ length: 10 }, () => txt('---', 18, C.white, false, 'center'));
    this.hdgBox    = txt('---', 28, C.white, true,  'center');
    this.hdgLabels.forEach((t) => this.addChild(t));
    this.addChild(this.hdgBox);

    // V/S
    this.vsText = txt('+0', 18, C.green, false, 'center');
    this.addChild(this.vsText);

    // FMA — 5 columns, 2 rows each
    this.fmaTop = Array.from({ length: 5 }, () => txt('', 22, C.green, true,  'center'));
    this.fmaSub = Array.from({ length: 5 }, () => txt('', 18, C.cyan,  false, 'center'));
    this.fmaTop.forEach((t) => this.addChild(t));
    this.fmaSub.forEach((t) => this.addChild(t));

    // FAIL overlay
    this.failText = txt('', 22, C.amber, true, 'center');
    this.addChild(this.failText);

    // Draw static chrome once
    this.addChild(this.gChrome);
    this.drawChrome();
  }

  // ── Static chrome — drawn once ────────────────────────────────────────────
  private drawChrome(): void {
    const g = this.gChrome;
    // Outer bezel
    g.rect(0, 0, W, H).stroke({ color: C.border, width: 3 });
    // FMA divider
    g.moveTo(0, FMA_H).lineTo(W, FMA_H).stroke({ color: C.border, width: 1 });
    // FMA column separators
    for (let i = 1; i < 5; i++) {
      g.moveTo((W / 5) * i, 4).lineTo((W / 5) * i, FMA_H - 4).stroke({ color: C.dim, width: 1 });
    }
    // Speed tape border
    g.moveTo(SPD_W, FMA_H).lineTo(SPD_W, HDG_Y).stroke({ color: C.border, width: 1 });
    // Alt tape border
    g.moveTo(ALT_X, FMA_H).lineTo(ALT_X, HDG_Y).stroke({ color: C.border, width: 1 });
    // V/S border
    g.moveTo(VS_X, FMA_H).lineTo(VS_X, HDG_Y).stroke({ color: C.border, width: 1 });
    // Heading tape border
    g.moveTo(ATT_X, HDG_Y).lineTo(ATT_X + ATT_W, HDG_Y).stroke({ color: C.border, width: 1 });
    // Speed tape header label
    const sLabel = txt('SPD', 16, C.dim, false, 'center');
    sLabel.position.set(SPD_W / 2, FMA_H + 18);
    this.addChild(sLabel);
    // Alt tape header label
    const aLabel = txt('ALT', 16, C.dim, false, 'center');
    aLabel.position.set(ALT_X + ALT_W / 2, FMA_H + 18);
    this.addChild(aLabel);
  }

  // ── Main update — call from ticker ────────────────────────────────────────
  update(state: AircraftState): void {
    this.drawHorizon(state);
    this.drawBankScale(state);
    this.drawFlightDirector(state);
    this.drawAircraftSymbol(state);
    this.drawSlip(state);
    this.drawSpeedTape(state);
    this.drawAltTape(state);
    this.drawVS(state);
    this.drawHdgTape(state);
    this.drawFMA(state);
    this.drawFailWarnings(state);
  }

  // ── Horizon ───────────────────────────────────────────────────────────────
  private drawHorizon(s: AircraftState): void {
    const pitchOff = s.pitch * PX_DEG;  // px: positive = horizon moves down (nose up)
    const bankRad  = -s.bank * (Math.PI / 180);

    this.horizonCont.position.set(ATT_CX, ATT_CY);
    this.horizonCont.pivot.set(0, 0);
    this.horizonCont.rotation = bankRad;

    const g = this.gHorizon;
    g.clear();

    // Draw in container local space (0,0 = ATT_CX,ATT_CY on screen)
    // Horizon is at local y = pitchOff (positive pitch → horizon below center)
    const hy = pitchOff;

    // Sky (above horizon)
    g.rect(-2000, -2000, 4000, 2000 + hy).fill({ color: C.sky });
    // Ground (below horizon)
    g.rect(-2000, hy, 4000, 2000).fill({ color: C.ground });
    // Horizon line
    g.moveTo(-2000, hy).lineTo(2000, hy).stroke({ color: C.white, width: 4 });
    // Zero-pitch reference bars (fixed at horizon level)
    g.moveTo(-350, hy).lineTo(-120, hy).stroke({ color: C.white, width: 5, alpha: 0.6 });
    g.moveTo( 120, hy).lineTo( 350, hy).stroke({ color: C.white, width: 5, alpha: 0.6 });

    // Pitch ladder
    const gp = this.gPitch;
    gp.clear();
    const pitchLines = [-20, -15, -10, -5, 5, 10, 15, 20];
    for (const deg of pitchLines) {
      const ly   = hy - deg * PX_DEG;
      const hw   = Math.abs(deg) % 10 === 0 ? 140 : 90;
      const col  = deg < 0 ? 0xFFB300 : 0xFFFFFF;   // negative pitch = amber dashes
      const w    = 3;

      if (deg < 0) {
        // Negative pitch: dashed style (draw as two segments)
        for (let x = -hw; x < hw; x += 24) {
          gp.moveTo(x, ly).lineTo(Math.min(x + 14, hw), ly).stroke({ color: col, width: w, alpha: 0.75 });
        }
      } else {
        gp.moveTo(-hw, ly).lineTo(-20, ly).stroke({ color: col, width: w, alpha: 0.8 });
        gp.moveTo( 20,  ly).lineTo(hw,  ly).stroke({ color: col, width: w, alpha: 0.8 });
      }

      // End-cap ticks on major lines
      if (Math.abs(deg) % 10 === 0) {
        gp.moveTo(-hw, ly).lineTo(-hw, ly + (deg > 0 ? 12 : -12)).stroke({ color: col, width: w, alpha: 0.8 });
        gp.moveTo( hw, ly).lineTo( hw, ly + (deg > 0 ? 12 : -12)).stroke({ color: col, width: w, alpha: 0.8 });
      }
    }
  }

  // ── Bank scale + slip indicator ───────────────────────────────────────────
  private drawBankScale(s: AircraftState): void {
    const g = this.gBankArc;
    g.clear();

    const R   = 400;
    const CX  = ATT_CX;
    const CY  = ATT_Y + 60;  // bank scale arc top of display

    // Arc
    g.arc(CX, CY + R, R, -Math.PI * 0.85, -Math.PI * 0.15).stroke({ color: C.white, width: 2 });

    // Bank angle ticks
    const marks = [0, 10, 20, 30, 45, 60];
    for (const deg of marks) {
      for (const side of [-1, 1]) {
        const a  = Math.PI / 2 + deg * side * (Math.PI / 180);
        const x1 = CX + R * Math.cos(Math.PI - a);
        const y1 = (CY + R) - R * Math.sin(a);
        const tl = deg === 0 || deg === 30 || deg === 60 ? 22 : 14;
        const x2 = CX + (R - tl) * Math.cos(Math.PI - a);
        const y2 = (CY + R) - (R - tl) * Math.sin(a);
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: C.white, width: deg === 0 ? 3 : 2 });
      }
    }

    // Bank pointer (inverted triangle, rotates with bank)
    const bankA = Math.PI / 2 + s.bank * (Math.PI / 180);
    const px    = CX + R * Math.cos(Math.PI - bankA);
    const py    = (CY + R) - R * Math.sin(bankA);
    // Point toward center (inward-pointing triangle)
    const dir   = Math.atan2(CY + R - py, CX - px);
    const perp  = dir + Math.PI / 2;
    g.poly([
      px, py,
      px + Math.cos(perp) * 14, py + Math.sin(perp) * 14,
      px - Math.cos(perp) * 14, py - Math.sin(perp) * 14,
    ]).fill({ color: C.white });
  }

  private drawSlip(s: AircraftState): void {
    this.gSlip.clear();
    // Slip/skid indicator — box moves laterally (placeholder: bank/5 px)
    const slipX = ATT_CX + (s.bank / 60) * 60;
    const sy    = ATT_Y + ATT_H - HDG_H - 20;
    this.gSlip.rect(slipX - 14, sy, 28, 14).stroke({ color: C.white, width: 2 });
    // Center reference marks
    this.gSlip.rect(ATT_CX - 22, sy, 10, 14).stroke({ color: C.white, width: 1 });
    this.gSlip.rect(ATT_CX + 12, sy, 10, 14).stroke({ color: C.white, width: 1 });
  }

  // ── Aircraft symbol ───────────────────────────────────────────────────────
  private drawAircraftSymbol(_s: AircraftState): void {
    const g = this.gAircraftSym;
    g.clear();
    // Fixed amber symbol at display center
    const cx = ATT_CX, cy = ATT_CY;
    g.rect(cx - 90, cy - 5, 66, 10).fill({ color: C.amber });   // left wing
    g.rect(cx + 24,  cy - 5, 66, 10).fill({ color: C.amber });   // right wing
    g.rect(cx - 10, cy - 5, 20, 10).fill({ color: C.amber });    // fuselage body
    g.circle(cx, cy, 7).fill({ color: C.amber });                 // center dot
    // Tail fin
    g.rect(cx - 5, cy - 22, 10, 18).fill({ color: C.amber });
  }

  // ── Flight directors ──────────────────────────────────────────────────────
  private drawFlightDirector(_s: AircraftState): void {
    const g = this.gFD;
    g.clear();
    // Pitch FD bar (horizontal) — fly to
    g.moveTo(ATT_CX - 140, ATT_CY).lineTo(ATT_CX - 28, ATT_CY).stroke({ color: C.magenta, width: 12 });
    g.moveTo(ATT_CX + 28,  ATT_CY).lineTo(ATT_CX + 140, ATT_CY).stroke({ color: C.magenta, width: 12 });
    // Roll FD bar (vertical)
    g.moveTo(ATT_CX, ATT_CY - 100).lineTo(ATT_CX, ATT_CY - 28).stroke({ color: C.magenta, width: 12 });
    g.moveTo(ATT_CX, ATT_CY + 28). lineTo(ATT_CX, ATT_CY + 100).stroke({ color: C.magenta, width: 12 });
  }

  // ── Speed tape ────────────────────────────────────────────────────────────
  private drawSpeedTape(s: AircraftState): void {
    const g = this.gSpeedTape;
    g.clear();

    const spd      = s.speed;
    const tapeTop  = FMA_H + 40;
    const tapeBot  = HDG_Y - 8;
    const midY     = (tapeTop + tapeBot) / 2;
    const pxPerKt  = 5;

    // Background
    g.rect(0, FMA_H, SPD_W, H - FMA_H - HDG_H).fill({ color: C.bg, alpha: 0.88 });

    // Ticks and labels
    const loSpd = Math.floor(spd / 10) * 10 - 80;
    const hiSpd = loSpd + 160;
    let li = 0;

    for (let v = loSpd; v <= hiSpd; v += 10) {
      if (v < 0) continue;
      const y = midY + (spd - v) * pxPerKt;
      if (y < tapeTop || y > tapeBot) continue;

      const major = v % 20 === 0;
      const tw    = major ? 26 : 16;
      g.moveTo(SPD_W - tw, y).lineTo(SPD_W, y).stroke({ color: C.white, width: 1 });

      if (major && li < this.spdLabels.length) {
        const t = this.spdLabels[li++];
        t.text     = String(v);
        t.x        = SPD_W - 34;
        t.y        = y;
        t.visible  = true;
      }
    }
    // Hide unused labels
    for (let i = li; i < this.spdLabels.length; i++) this.spdLabels[i].visible = false;

    // Speed readout box
    const bH = 54, bW = SPD_W - 6;
    g.rect(3, midY - bH / 2, bW, bH).fill({ color: C.bg }).stroke({ color: C.white, width: 2 });
    this.spdBox.text = Math.round(spd).toString();
    this.spdBox.x    = SPD_W / 2;
    this.spdBox.y    = midY;

    // Trend vector (10-second)
    const trendPx = (s.vs / 600) * pxPerKt * 10; // approximate kt change in 10s from V/S
    if (Math.abs(trendPx) > 4) {
      g.moveTo(SPD_W - 4, midY)
       .lineTo(SPD_W - 4, midY - trendPx)
       .stroke({ color: C.green, width: 4 });
    }

    // Selected speed bug (cyan)
    const selY = midY + (spd - s.selectedSpeed) * pxPerKt;
    if (selY > tapeTop && selY < tapeBot) {
      g.moveTo(2, selY - 16).lineTo(2, selY + 16).lineTo(28, selY + 16)
       .lineTo(28, selY + 2).lineTo(SPD_W, selY + 2).stroke({ color: C.cyan, width: 2 });
      g.moveTo(2, selY - 16).lineTo(28, selY - 16)
       .lineTo(28, selY - 2).lineTo(SPD_W, selY - 2).stroke({ color: C.cyan, width: 2 });
    }
    this.spdSel.text = String(Math.round(s.selectedSpeed));
    this.spdSel.x    = SPD_W - 6;
    this.spdSel.y    = selY < tapeTop + 20 ? tapeTop + 14 : selY > tapeBot - 20 ? tapeBot - 14 : selY - 30;

    // VLS — amber lower limit (static sim value: speed - 18 kt)
    const vlsY = midY + 18 * pxPerKt;
    if (vlsY < tapeBot) {
      g.rect(SPD_W - 10, vlsY, 10, tapeBot - vlsY).fill({ color: C.amber, alpha: 0.4 });
      g.moveTo(SPD_W - 10, vlsY).lineTo(SPD_W, vlsY).stroke({ color: C.amber, width: 3 });
    }
  }

  // ── Altitude tape ─────────────────────────────────────────────────────────
  private drawAltTape(s: AircraftState): void {
    const g = this.gAltTape;
    g.clear();

    const alt      = s.altitude;
    const tapeTop  = FMA_H + 40;
    const tapeBot  = HDG_Y - 8;
    const midY     = (tapeTop + tapeBot) / 2;
    const pxPer100 = 15;

    g.rect(ALT_X, FMA_H, ALT_W, H - FMA_H - HDG_H).fill({ color: C.bg, alpha: 0.88 });

    const loAlt = Math.floor(alt / 200) * 200 - 1200;
    const hiAlt = loAlt + 2400;
    let li = 0;

    for (let v = loAlt; v <= hiAlt; v += 100) {
      const y = midY + ((alt - v) / 100) * pxPer100;
      if (y < tapeTop || y > tapeBot) continue;

      const major = v % 500 === 0;
      const tw    = major ? 24 : 14;
      g.moveTo(ALT_X, y).lineTo(ALT_X + tw, y).stroke({ color: C.white, width: 1 });

      if (major && li < this.altLabels.length) {
        const t = this.altLabels[li++];
        t.text    = String(v);
        t.x       = ALT_X + 30;
        t.y       = y;
        t.visible = true;
      }
    }
    for (let i = li; i < this.altLabels.length; i++) this.altLabels[i].visible = false;

    // Altitude readout box
    const bH = 54, bW = ALT_W - 6;
    g.rect(ALT_X + 3, midY - bH / 2, bW, bH).fill({ color: C.bg }).stroke({ color: C.cyan, width: 2 });
    this.altBox.text = Math.round(alt).toString();
    this.altBox.x    = ALT_X + ALT_W / 2;
    this.altBox.y    = midY;

    // Selected alt bug
    const selY = midY + ((alt - s.selectedAlt) / 100) * pxPer100;
    if (selY > tapeTop && selY < tapeBot) {
      g.moveTo(ALT_X, selY - 2).lineTo(ALT_X + 30, selY - 2)
       .lineTo(ALT_X + 30, selY - 16).lineTo(ALT_X + ALT_W, selY - 16)
       .stroke({ color: C.cyan, width: 2 });
      g.moveTo(ALT_X, selY + 2).lineTo(ALT_X + 30, selY + 2)
       .lineTo(ALT_X + 30, selY + 16).lineTo(ALT_X + ALT_W, selY + 16)
       .stroke({ color: C.cyan, width: 2 });
    }
    this.altSel.text = String(Math.round(s.selectedAlt));
    this.altSel.x    = ALT_X + 4;
    this.altSel.y    = FMA_H + 30;
  }

  // ── Vertical speed strip ──────────────────────────────────────────────────
  private drawVS(s: AircraftState): void {
    const g = this.gVS;
    g.clear();

    g.rect(VS_X, FMA_H, VS_W, H - FMA_H - HDG_H).fill({ color: 0x050810, alpha: 0.9 });

    const cy      = (FMA_H + HDG_Y) / 2;
    const scaleH  = (HDG_Y - FMA_H) * 0.36;
    const maxFPM  = 2000;

    // Scale marks
    for (const fpm of [500, 1000, 2000]) {
      const dy = (fpm / maxFPM) * scaleH;
      g.moveTo(VS_X, cy - dy).lineTo(VS_X + VS_W, cy - dy).stroke({ color: C.white, width: 1 });
      g.moveTo(VS_X, cy + dy).lineTo(VS_X + VS_W, cy + dy).stroke({ color: C.white, width: 1 });
    }

    // Pointer
    const clamp = Math.max(-maxFPM, Math.min(maxFPM, s.vs));
    const py    = cy - (clamp / maxFPM) * scaleH;
    const mx    = VS_X + VS_W / 2;
    if (s.vs >= 0) {
      g.poly([mx, py, mx - 8, py + 14, mx + 8, py + 14]).fill({ color: C.green });
    } else {
      g.poly([mx, py, mx - 8, py - 14, mx + 8, py - 14]).fill({ color: C.green });
    }

    // V/S readout
    const sign  = s.vs >= 0 ? '+' : '';
    this.vsText.text = sign + Math.round(s.vs).toString();
    this.vsText.x    = VS_X + VS_W / 2;
    this.vsText.y    = py > cy ? py + 30 : py - 30;
  }

  // ── Heading tape ──────────────────────────────────────────────────────────
  private drawHdgTape(s: AircraftState): void {
    const g = this.gHdgTape;
    g.clear();

    const hdg      = s.heading;
    const tapeL    = ATT_X + 40;
    const tapeR    = ATT_X + ATT_W - 40;
    const cx       = ATT_CX;
    const pxPerDeg = 6;

    g.rect(ATT_X, HDG_Y, ATT_W, HDG_H).fill({ color: C.bg, alpha: 0.9 });
    g.moveTo(ATT_X, HDG_Y).lineTo(ATT_X + ATT_W, HDG_Y).stroke({ color: C.border, width: 1 });

    const loHdg = Math.round(hdg / 5) * 5 - 75;
    let li = 0;

    for (let d = loHdg; d <= loHdg + 150; d += 5) {
      const norm = ((d % 360) + 360) % 360;
      let  dx   = d - hdg;
      if (dx > 180)  dx -= 360;
      if (dx < -180) dx += 360;
      const tx   = cx + dx * pxPerDeg;
      if (tx < tapeL || tx > tapeR) continue;

      const major = norm % 10 === 0;
      const th    = major ? 20 : 12;
      g.moveTo(tx, HDG_Y + 4).lineTo(tx, HDG_Y + th).stroke({ color: C.white, width: 1 });

      if (norm % 30 === 0 && li < this.hdgLabels.length) {
        const t = this.hdgLabels[li++];
        t.text    = String(norm).padStart(3, '0');
        t.x       = tx;
        t.y       = HDG_Y + 44;
        t.visible = true;
      }
    }
    for (let i = li; i < this.hdgLabels.length; i++) this.hdgLabels[i].visible = false;

    // Current heading box
    const bW = 90, bH = HDG_H - 16;
    g.rect(cx - bW / 2, HDG_Y + 2, bW, bH).fill({ color: C.bg }).stroke({ color: C.white, width: 2 });
    // Pointer triangle
    g.poly([cx, HDG_Y + 2, cx - 12, HDG_Y + 14, cx + 12, HDG_Y + 14]).fill({ color: C.white });
    this.hdgBox.text = Math.round(((hdg % 360) + 360) % 360).toString().padStart(3, '0');
    this.hdgBox.x    = cx;
    this.hdgBox.y    = HDG_Y + HDG_H / 2 + 8;

    // Selected heading bug (cyan)
    let dSel = s.selectedHdg - hdg;
    if (dSel > 180)  dSel -= 360;
    if (dSel < -180) dSel += 360;
    const selTx = cx + dSel * pxPerDeg;
    if (selTx > tapeL && selTx < tapeR) {
      g.poly([selTx, HDG_Y + 2, selTx - 10, HDG_Y + 18, selTx + 10, HDG_Y + 18]).fill({ color: C.cyan });
    }

    // Track bug (small arrow)
    let dTrk = s.track - hdg;
    if (dTrk > 180)  dTrk -= 360;
    if (dTrk < -180) dTrk += 360;
    const trkX = cx + dTrk * pxPerDeg;
    if (trkX > tapeL && trkX < tapeR) {
      g.moveTo(trkX, HDG_Y + 2).lineTo(trkX, HDG_Y + 10).stroke({ color: C.green, width: 3 });
    }
  }

  // ── FMA (5-column mode display) ───────────────────────────────────────────
  private drawFMA(s: AircraftState): void {
    const g = this.gFMA;
    g.clear();

    g.rect(0, 0, W, FMA_H).fill({ color: C.bg });

    // Columns: A/THR | VERT | LAT | AP/FD | A/THR status
    const cols: Array<{ top: string; topColor: number; sub: string; subColor: number }> = [
      {
        top: s.thrMode, topColor: s.thrMode === 'CLB' ? C.green : C.amber,
        sub: s.athrActive ? 'A/THR' : '',  subColor: C.cyan,
      },
      { top: s.vertMode, topColor: C.green, sub: '', subColor: C.cyan },
      { top: s.latMode,  topColor: C.green, sub: '', subColor: C.cyan },
      {
        top: s.apEngaged ? 'A/P 1' : '1FD2', topColor: C.cyan,
        sub: '', subColor: C.cyan,
      },
      {
        top: s.masterWarn ? 'MASTER WARN' : s.masterCaut ? 'MASTER CAUT' : '',
        topColor: s.masterWarn ? C.red : C.amber,
        sub: '', subColor: C.amber,
      },
    ];

    const cw = W / 5;
    cols.forEach((col, i) => {
      const cx = i * cw + cw / 2;
      const t1 = this.fmaTop[i];
      const t2 = this.fmaSub[i];
      t1.text  = col.top;
      t1.style.fill = col.topColor;
      t1.x     = cx;
      t1.y     = FMA_H * 0.38;
      t2.text  = col.sub;
      t2.style.fill = col.subColor;
      t2.x     = cx;
      t2.y     = FMA_H * 0.72;
    });

    // Box around AP mode when engaged
    if (s.apEngaged) {
      g.rect(3 * cw + 6, 4, cw - 12, FMA_H - 8).stroke({ color: C.cyan, width: 2 });
    }

    // Box around active vert mode
    g.rect(cw + 4, 4, cw - 8, FMA_H - 8).stroke({ color: C.green, width: 1, alpha: 0.4 });
  }

  // ── Failure warnings ──────────────────────────────────────────────────────
  private drawFailWarnings(s: AircraftState): void {
    if (s.eng1Failed) {
      this.failText.text  = 'ENG 1 FAIL';
      this.failText.style.fill = C.red;
      this.failText.x     = ATT_CX;
      this.failText.y     = ATT_Y + 40;
      this.failText.visible = true;
    } else if (s.eng2Failed) {
      this.failText.text  = 'ENG 2 FAIL';
      this.failText.style.fill = C.amber;
      this.failText.x     = ATT_CX;
      this.failText.y     = ATT_Y + 40;
      this.failText.visible = true;
    } else {
      this.failText.visible = false;
    }
  }
}
