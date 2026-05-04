import { Container, Graphics, Text } from 'pixi.js';
import type { AircraftState } from '../core/aircraftState';

// ─── 1024 × 1024 logical coordinate space ─────────────────────────────────────
const W     = 1024;
const H     = 1024;
const FMA_H = 80;
const SPD_W = 128;
const ALT_W = 128;
const VS_W  = 26;
const HDG_H = 86;

const ATT_X  = SPD_W;
const ATT_Y  = FMA_H;
const ATT_W  = W - SPD_W - ALT_W - VS_W;
const ATT_H  = H - FMA_H - HDG_H;
const ATT_CX = ATT_X + ATT_W / 2;
const ATT_CY = ATT_Y + ATT_H / 2;
const HDG_Y  = H - HDG_H;
const ALT_X  = W - ALT_W - VS_W;
const VS_X   = W - VS_W;

// Pixels per degree of pitch (scaled so ±20° fills the AI height comfortably)
const PX_DEG = 15;

// FCOM DSC-22_10-40: AI boundary is a rounded rectangle, not a circle.
// Values tuned to match the FCOM CLIMB PHASE diagram proportions.
const AI_HW     = 308;   // AI half-width  (left/right extent from centre)
const AI_HH     = 372;   // AI half-height (top/bottom extent from centre)
const AI_CORNER = 88;    // corner radius — gives the characteristic squircle shape
const BANK_R    = 404;   // bank-scale arc radius (clear of the AI top edge at AI_HH)

// ─── Airbus EFIS display colours ─────────────────────────────────────────────
// Reference palette from FCOM canvas reference (see canvas A320PFD component)
const C = {
  sky:     0x0066CC,   // Airbus PFD sky blue
  ground:  0x7A3A00,   // Airbus PFD ground brown
  white:   0xFFFFFF,   // white  — manual modes, current readings
  green:   0x00FF00,   // green  — engaged/active modes, GS, track
  cyan:    0x00FFFF,   // cyan   — armed modes, selected targets, A/THR
  amber:   0xFFBF00,   // amber  — cautions, VLS strip, neg-pitch
  red:     0xFF0000,   // red    — warnings
  magenta: 0xFF00FF,   // magenta— flight director bars
  yellow:  0xFFE200,   // yellow — fixed aircraft reference symbol
  dim:     0x2A3348,
  border:  0x18202E,
  bg:      0x000000,
} as const;

// Scenario-defined FMGC speed schedule (CONF 1+F, typical MTOW VIDP ISA)
const SPD_VLS = 147;   // Lowest Selectable Speed — top of amber protection strip
const SPD_S   = 184;   // S speed  — slat retraction (shown as "S" on tape)
const SPD_F   = 212;   // F speed  — flap retraction (shown as "F" on tape)
const SPD_GD  = 228;   // Green Dot — best L/D clean manoeuvre speed

// ─── Text helper ──────────────────────────────────────────────────────────────
function txt(
  s: string, size: number, color: number,
  bold = false, align: 'left' | 'center' | 'right' = 'left',
): Text {
  const t = new Text({
    text: s,
    style: { fontFamily: 'monospace', fontSize: size, fill: color, fontWeight: bold ? 'bold' : 'normal', align },
  });
  t.anchor.x = align === 'center' ? 0.5 : align === 'right' ? 1 : 0;
  t.anchor.y = 0.5;
  return t;
}

// ─── PFD Renderer ─────────────────────────────────────────────────────────────
export class PFDRenderer extends Container {

  // Horizon (clipped container)
  private horizonCont:    Container;
  private pitchLabelCont: Container;   // child of horizonCont — rotates with bank
  private gHorizon:       Graphics;
  private gPitch:         Graphics;

  // Pitch number labels (inside pitchLabelCont)
  private pitchNums: Text[];   // 16 texts: [+20L,+20R, +15L,+15R, +10L,+10R, +5L,+5R,
                               //             -5L,-5R, -10L,-10R, -15L,-15R, -20L,-20R]

  // Static chrome (drawn once)
  private gChrome: Graphics;

  // Dynamic graphics
  private gBankArc:     Graphics;
  private gFD:          Graphics;
  private gAircraftSym: Graphics;
  private gSlip:        Graphics;
  private gSpeedTape:   Graphics;
  private gAltTape:     Graphics;
  private gVS:          Graphics;
  private gHdgTape:     Graphics;
  private gFMA:         Graphics;

  // Speed tape text
  private spdLabels: Text[];
  private spdBox:    Text;
  private spdSel:    Text;
  private machText:  Text;   // Mach number below speed box
  private spdSMark:  Text;   // S-speed marker label
  private spdFMark:  Text;   // F-speed marker label

  // Alt tape text
  private altLabels: Text[];
  private altBox:    Text;
  private altSel:    Text;
  private baroText:  Text;   // Baro setting (STD / QNH)

  // Heading tape text
  private hdgLabels: Text[];
  private hdgBox:    Text;

  // VS text
  private vsText:  Text;
  private fpmText: Text;

  // FMA text
  private fmaTop:  Text[];
  private fmaSub:  Text[];
  private failBox: Graphics;
  private failTxt: Text;

  constructor() {
    super();

    // ── Horizon container ────────────────────────────────────────────────────
    this.gHorizon    = new Graphics();
    this.gPitch      = new Graphics();
    this.pitchLabelCont = new Container();
    this.horizonCont = new Container();
    this.horizonCont.addChild(this.gHorizon);
    this.horizonCont.addChild(this.gPitch);
    this.horizonCont.addChild(this.pitchLabelCont);

    // Rounded-rectangle AI mask — per FCOM DSC-22_10-40 diagram shape
    const mask = new Graphics();
    mask.roundRect(ATT_CX - AI_HW, ATT_CY - AI_HH, AI_HW * 2, AI_HH * 2, AI_CORNER)
        .fill(0xffffff);
    this.horizonCont.mask = mask;
    this.addChild(mask);
    this.addChild(this.horizonCont);

    // Pitch number labels — 4 angles × each side × positive+negative = 16
    const pitchDefs: Array<{ deg: number; color: number }> = [
      { deg:  20, color: C.white },
      { deg:  15, color: C.white },
      { deg:  10, color: C.white },
      { deg:   5, color: C.white },
      { deg:  -5, color: C.amber },
      { deg: -10, color: C.amber },
      { deg: -15, color: C.amber },
      { deg: -20, color: C.amber },
    ];
    this.pitchNums = [];
    for (const pd of pitchDefs) {
      const major = Math.abs(pd.deg) % 10 === 0;
      if (!major) {
        this.pitchNums.push(txt('', 1, C.white)); // invisible placeholder
        this.pitchNums.push(txt('', 1, C.white));
        continue;
      }
      const label = String(Math.abs(pd.deg));
      const tL = txt(label, 22, pd.color);
      const tR = txt(label, 22, pd.color, false, 'right');
      this.pitchLabelCont.addChild(tL);
      this.pitchLabelCont.addChild(tR);
      this.pitchNums.push(tL, tR);
    }

    // ── Dynamic graphics ─────────────────────────────────────────────────────
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

    // ── Text — speed tape ────────────────────────────────────────────────────
    this.spdLabels = Array.from({ length: 14 }, () => txt('', 20, C.white));
    this.spdBox    = txt('---', 38, C.white, true,  'center');
    this.spdSel    = txt('---', 18, C.cyan,  false, 'right');
    this.machText  = txt('.00', 20, C.green, false, 'center');  // Mach number
    this.spdSMark  = txt('S',   20, C.green, true,  'right');   // S-speed marker
    this.spdFMark  = txt('F',   20, C.green, true,  'right');   // F-speed marker
    this.spdLabels.forEach((t) => this.addChild(t));
    this.addChild(this.spdBox);
    this.addChild(this.spdSel);
    this.addChild(this.machText);
    this.addChild(this.spdSMark);
    this.addChild(this.spdFMark);

    // ── Text — alt tape ──────────────────────────────────────────────────────
    this.altLabels = Array.from({ length: 14 }, () => txt('', 18, C.white));
    this.altBox    = txt('-----', 30, C.white, true, 'center');
    this.altSel    = txt('-----', 22, C.cyan,  true, 'center');
    this.baroText  = txt('STD',   18, C.cyan,  false, 'center');  // Baro setting
    this.altLabels.forEach((t) => this.addChild(t));
    this.addChild(this.altBox);
    this.addChild(this.altSel);
    this.addChild(this.baroText);

    // ── Text — heading tape ──────────────────────────────────────────────────
    this.hdgLabels = Array.from({ length: 14 }, () => txt('', 20, C.white, false, 'center'));
    this.hdgBox    = txt('---', 32, C.white, true, 'center');
    this.hdgLabels.forEach((t) => this.addChild(t));
    this.addChild(this.hdgBox);

    // ── Text — VS ────────────────────────────────────────────────────────────
    this.vsText  = txt('+0', 18, C.green, false, 'center');
    this.fpmText = txt('', 19, C.green, false, 'center');
    this.addChild(this.vsText);
    this.addChild(this.fpmText);

    // ── Text — FMA ───────────────────────────────────────────────────────────
    this.fmaTop = Array.from({ length: 5 }, () => txt('', 22, C.green, true,  'center'));
    this.fmaSub = Array.from({ length: 5 }, () => txt('', 18, C.cyan,  false, 'center'));
    this.fmaTop.forEach((t) => this.addChild(t));
    this.fmaSub.forEach((t) => this.addChild(t));

    // ENG FAIL indicator (drawn once, visibility toggled)
    this.failBox = new Graphics();
    this.failTxt = txt('', 22, C.amber, true, 'center');
    this.addChild(this.failBox);
    this.addChild(this.failTxt);

    // Static chrome
    this.addChild(this.gChrome);
    this.drawChrome();
  }

  // ── Static chrome ────────────────────────────────────────────────────────
  private drawChrome(): void {
    const g = this.gChrome;

    // Outer display bezel
    g.rect(0, 0, W, H).stroke({ color: C.border, width: 4 });

    // ── FMA box and column dividers (white, per FCOM reference) ───────────
    const cw = W / 5;
    g.rect(4, 4, W - 8, FMA_H - 8).stroke({ color: C.white, width: 1.5 });
    g.moveTo(4, FMA_H).lineTo(W - 4, FMA_H).stroke({ color: C.white, width: 1 });
    for (let i = 1; i < 5; i++) {
      g.moveTo(cw * i, 6).lineTo(cw * i, FMA_H - 6).stroke({ color: C.white, width: 1 });
    }

    // ── Rounded-rect AI bezel (per FCOM DSC-22_10-40) ─────────────────────
    g.roundRect(ATT_CX - AI_HW, ATT_CY - AI_HH, AI_HW * 2, AI_HH * 2, AI_CORNER)
     .stroke({ color: C.white, width: 2.5 });

    // ── Tape lane borders (dim, just structural guides) ───────────────────
    g.moveTo(SPD_W, FMA_H).lineTo(SPD_W, HDG_Y).stroke({ color: C.border, width: 1 });
    g.moveTo(ALT_X, FMA_H).lineTo(ALT_X, HDG_Y).stroke({ color: C.border, width: 1 });
    g.moveTo(VS_X,  FMA_H).lineTo(VS_X,  HDG_Y).stroke({ color: C.border, width: 1 });
    g.moveTo(ATT_X, HDG_Y).lineTo(ATT_X + ATT_W, HDG_Y).stroke({ color: C.border, width: 1 });
  }

  // ── Main update ──────────────────────────────────────────────────────────
  update(s: AircraftState): void {
    this.drawHorizon(s);
    this.drawBankScale(s);
    this.drawFlightDirector(s);
    this.drawAircraftSymbol();
    this.drawSlip(s);
    this.drawSpeedTape(s);
    this.drawAltTape(s);
    this.drawVS(s);
    this.drawHdgTape(s);
    this.drawFMA(s);
    this.drawEngFail(s);
  }

  // ── Horizon ──────────────────────────────────────────────────────────────
  private drawHorizon(s: AircraftState): void {
    const pitchOff = s.pitch * PX_DEG;
    const bankRad  = -s.bank * (Math.PI / 180);

    // Position and rotate the whole horizon container around display centre
    this.horizonCont.position.set(ATT_CX, ATT_CY);
    this.horizonCont.pivot.set(0, 0);
    this.horizonCont.rotation = bankRad;

    const g = this.gHorizon;
    g.clear();

    const hy = pitchOff;  // local y of horizon line (0,0 = display centre)

    // Sky
    g.rect(-3000, -3000, 6000, 3000 + hy).fill({ color: C.sky });
    // Ground
    g.rect(-3000, hy, 6000, 3000).fill({ color: C.ground });
    // Horizon line
    g.moveTo(-3000, hy).lineTo(3000, hy).stroke({ color: C.white, width: 4 });
    // Horizon side reference bars — span from AI half-width to aircraft symbol gap
    g.moveTo(-AI_HW + 10, hy).lineTo(-130, hy).stroke({ color: C.white, width: 5, alpha: 0.6 });
    g.moveTo( 130, hy).lineTo(AI_HW - 10, hy).stroke({ color: C.white, width: 5, alpha: 0.6 });

    // ── Pitch ladder ──────────────────────────────────────────────────────
    const gp = this.gPitch;
    gp.clear();

    // Ladder widths scaled for the wider AI (AI_HW = 308 in local coords).
    // FCOM shows major rungs spanning ~60% of AI width, minor ~40%.
    const rungs = [-20, -15, -10, -5, 5, 10, 15, 20];
    for (const deg of rungs) {
      const ly    = hy - deg * PX_DEG;
      const major = Math.abs(deg) % 10 === 0;
      const hw    = major ? 190 : 110;   // wider to match FCOM proportions
      const lw    = major ? 3 : 2;
      const col   = deg < 0 ? C.amber : C.white;
      const alpha = deg < 0 ? 0.9 : 1;

      if (deg < 0) {
        // Negative pitch: dashed amber (FCOM style)
        const dash = 20, gap = 8;
        for (let x = -hw; x < hw; x += dash + gap) {
          gp.moveTo(x, ly).lineTo(Math.min(x + dash, hw), ly)
            .stroke({ color: col, width: lw, alpha });
        }
      } else {
        gp.moveTo(-hw, ly).lineTo(-24, ly).stroke({ color: col, width: lw, alpha });
        gp.moveTo( 24, ly).lineTo( hw, ly).stroke({ color: col, width: lw, alpha });
      }

      // End-cap ticks pointing toward the horizon line
      const capDir = deg > 0 ? 16 : -16;
      gp.moveTo(-hw, ly).lineTo(-hw, ly + capDir).stroke({ color: col, width: lw, alpha });
      gp.moveTo( hw, ly).lineTo( hw, ly + capDir).stroke({ color: col, width: lw, alpha });
    }

    // ── Pitch number positions ────────────────────────────────────────────
    // pitchNums layout: 2 placeholders each for 5/15 (non-major), 2 real for 10/20
    const numDefs = [
      { deg:  20, idx: 0, lx: -202, rx: 202 },
      { deg:  15, idx: 2, lx:    0, rx:   0 }, // invisible placeholder
      { deg:  10, idx: 4, lx: -125, rx: 125 },
      { deg:   5, idx: 6, lx:    0, rx:   0 }, // invisible placeholder
      { deg:  -5, idx: 8, lx:    0, rx:   0 }, // invisible placeholder
      { deg: -10, idx:10, lx: -125, rx: 125 },
      { deg: -15, idx:12, lx:    0, rx:   0 }, // invisible placeholder
      { deg: -20, idx:14, lx: -202, rx: 202 },
    ];

    for (const nd of numDefs) {
      const major = Math.abs(nd.deg) % 10 === 0;
      if (!major) continue;
      const ly = hy - nd.deg * PX_DEG;
      const tL = this.pitchNums[nd.idx];
      const tR = this.pitchNums[nd.idx + 1];
      // pitchLabelCont is a child of horizonCont whose origin (0,0) IS the AI centre.
      // Use local coordinates only — no ATT_CX/ATT_CY offset.
      tL.position.set(nd.lx - 8, ly);
      tR.position.set(nd.rx + 8, ly);
      tL.visible = true;
      tR.visible = true;
    }
  }

  // ── Bank scale ───────────────────────────────────────────────────────────
  // Arc centred on AI_CX/CY at radius BANK_R, wrapping the top of the circular AI.
  private drawBankScale(s: AircraftState): void {
    const g  = this.gBankArc;
    g.clear();
    const CX = ATT_CX, CY = ATT_CY;

    // Top arc: from -150° to -30° (leaves room for heading area below)
    g.arc(CX, CY, BANK_R, -Math.PI * 5 / 6, -Math.PI / 6)
     .stroke({ color: C.white, width: 2 });

    // Tick marks at 0, ±10, ±20, ±30, ±45, ±60°
    for (const deg of [0, 10, 20, 30, 45, 60]) {
      const sides: number[] = deg === 0 ? [0] : [-1, 1];
      for (const side of sides) {
        // angle: 0=right, -90=top; bank 0 → top
        const a  = (-90 + deg * side) * (Math.PI / 180);
        const tl = [0, 30, 60].includes(deg) ? 24 : 14;
        const x1 = CX + BANK_R * Math.cos(a);
        const y1 = CY + BANK_R * Math.sin(a);
        const x2 = CX + (BANK_R - tl) * Math.cos(a);
        const y2 = CY + (BANK_R - tl) * Math.sin(a);
        g.moveTo(x1, y1).lineTo(x2, y2)
         .stroke({ color: C.white, width: deg === 0 ? 3 : 2 });
      }
    }

    // Rotating bank pointer — triangle from arc to just inside the AI boundary.
    // Tip radius: at 0° bank the AI top edge is AI_HH away from centre; use
    // AI_HH - 20 so the apex sits cleanly on the bezel border.
    const ba   = (-90 + s.bank) * (Math.PI / 180);
    const tipX = CX + (AI_HH - 20) * Math.cos(ba);
    const tipY = CY + (AI_HH - 20) * Math.sin(ba);
    const basX = CX + (BANK_R - 4) * Math.cos(ba);
    const basY = CY + (BANK_R - 4) * Math.sin(ba);
    const perp = ba + Math.PI / 2;
    g.poly([
      basX, basY,
      tipX + 10 * Math.cos(perp), tipY + 10 * Math.sin(perp),
      tipX - 10 * Math.cos(perp), tipY - 10 * Math.sin(perp),
    ]).fill({ color: C.white });
  }

  // ── Slip indicator ───────────────────────────────────────────────────────
  private drawSlip(s: AircraftState): void {
    this.gSlip.clear();
    // Position at bottom of rounded-rect AI area
    const sy    = ATT_CY + AI_HH - 62;
    const slipX = ATT_CX + (s.bank / 60) * 52;
    this.gSlip.rect(slipX - 14, sy, 28, 14).stroke({ color: C.white, width: 2 });
    this.gSlip.rect(ATT_CX - 24, sy, 10, 14).stroke({ color: C.white, width: 1 });
    this.gSlip.rect(ATT_CX + 14, sy, 10, 14).stroke({ color: C.white, width: 1 });
  }

  // ── Aircraft symbol (fixed yellow reference — per FCOM) ─────────────────
  // FCOM standard miniature aircraft: horizontal wings with downward wingtips,
  // short fuselage stubs above and below centre dot.
  private drawAircraftSymbol(): void {
    const g  = this.gAircraftSym;
    g.clear();
    const cx = ATT_CX, cy = ATT_CY;
    // Left wing horizontal bar
    g.moveTo(cx - 110, cy).lineTo(cx - 18, cy).stroke({ color: C.yellow, width: 7 });
    // Left wingtip — short downward tick
    g.moveTo(cx - 110, cy).lineTo(cx - 110, cy + 16).stroke({ color: C.yellow, width: 7 });
    // Right wing horizontal bar
    g.moveTo(cx + 18,  cy).lineTo(cx + 110, cy).stroke({ color: C.yellow, width: 7 });
    // Right wingtip — short downward tick
    g.moveTo(cx + 110, cy).lineTo(cx + 110, cy + 16).stroke({ color: C.yellow, width: 7 });
    // Centre dot (fuselage reference)
    g.circle(cx, cy, 7).fill({ color: C.yellow });
    // Short fuselage stub below centre (stabiliser reference)
    g.moveTo(cx, cy + 7).lineTo(cx, cy + 20).stroke({ color: C.yellow, width: 6 });
  }

  // ── Flight directors ──────────────────────────────────────────────────────
  private drawFlightDirector(_s: AircraftState): void {
    this.gFD.clear();
    // FD bars not displayed in this phase — aircraft is stabilised on SRS/NAV
  }

  // ── Speed tape ───────────────────────────────────────────────────────────
  private drawSpeedTape(s: AircraftState): void {
    const g      = this.gSpeedTape;
    g.clear();

    const spd     = s.speed;
    const tapeTop = FMA_H + 44;
    const tapeBot = HDG_Y - 8;
    const midY    = (tapeTop + tapeBot) / 2;
    const pxPerKt = 5.2;

    // Background
    g.rect(0, FMA_H, SPD_W, H - FMA_H - HDG_H).fill({ color: C.bg, alpha: 0.92 });

    // ── VLS amber protection strip (below VLS = Lowest Selectable Speed) ───
    const vlsY = midY + (spd - SPD_VLS) * pxPerKt;
    if (vlsY < tapeBot) {
      const stripTop = Math.max(tapeTop, vlsY);
      g.rect(SPD_W - 14, stripTop, 14, tapeBot - stripTop)
       .fill({ color: C.amber, alpha: 0.45 });
      g.moveTo(SPD_W - 14, vlsY).lineTo(SPD_W, vlsY).stroke({ color: C.amber, width: 3 });
    }

    // ── Tape ticks and labels ──────────────────────────────────────────────
    const lo = Math.floor(spd / 10) * 10 - 80;
    let   li = 0;
    for (let v = lo; v <= lo + 160; v += 10) {
      if (v < 30) continue;
      const y = midY + (spd - v) * pxPerKt;
      if (y < tapeTop || y > tapeBot) continue;
      const major = v % 20 === 0;
      const tw    = major ? 28 : 16;
      g.moveTo(SPD_W - tw, y).lineTo(SPD_W, y).stroke({ color: C.white, width: 1 });
      if (major && li < this.spdLabels.length) {
        const t = this.spdLabels[li++];
        t.text = String(v);
        t.x = SPD_W - 38; t.y = y; t.visible = true;
      }
    }
    for (let i = li; i < this.spdLabels.length; i++) this.spdLabels[i].visible = false;

    // ── Current speed box ─────────────────────────────────────────────────
    const bH = 56, bW = SPD_W - 6;
    g.rect(3, midY - bH / 2, bW, bH)
     .fill({ color: 0x050810 })
     .stroke({ color: C.white, width: 2.5 });
    this.spdBox.text = Math.round(spd).toString();
    this.spdBox.x = SPD_W / 2; this.spdBox.y = midY;

    // ── Speed trend vector (green line, 10-second lookahead) ─────────────
    const trendPx = (s.vs / 600) * pxPerKt * 10;
    if (Math.abs(trendPx) > 4) {
      g.moveTo(SPD_W - 5, midY)
       .lineTo(SPD_W - 5, Math.max(tapeTop, Math.min(tapeBot, midY - trendPx)))
       .stroke({ color: C.green, width: 4 });
    }

    // ── Selected-speed cyan bug ───────────────────────────────────────────
    const selY = midY + (spd - s.selectedSpeed) * pxPerKt;
    if (selY > tapeTop && selY < tapeBot) {
      g.moveTo(4, selY - 14).lineTo(26, selY - 14).lineTo(26, selY - 2).lineTo(SPD_W, selY - 2)
       .stroke({ color: C.cyan, width: 2 });
      g.moveTo(4, selY + 14).lineTo(26, selY + 14).lineTo(26, selY + 2).lineTo(SPD_W, selY + 2)
       .stroke({ color: C.cyan, width: 2 });
    }
    this.spdSel.text = String(Math.round(s.selectedSpeed));
    this.spdSel.x    = SPD_W - 4;
    this.spdSel.y    = Math.max(tapeTop + 14, Math.min(tapeBot - 14, selY - 32));

    // ── FMGC speed markers: S, F, Green Dot ──────────────────────────────
    // S — slat retraction speed (green S on left edge of tape)
    const sy_s = midY + (spd - SPD_S) * pxPerKt;
    if (sy_s > tapeTop && sy_s < tapeBot) {
      g.moveTo(SPD_W - 22, sy_s).lineTo(SPD_W - 2, sy_s)
       .stroke({ color: C.green, width: 2.5 });
      this.spdSMark.x = SPD_W - 24; this.spdSMark.y = sy_s; this.spdSMark.visible = true;
    } else {
      this.spdSMark.visible = false;
    }

    // F — flap retraction speed (green F on left edge of tape)
    const sy_f = midY + (spd - SPD_F) * pxPerKt;
    if (sy_f > tapeTop && sy_f < tapeBot) {
      g.moveTo(SPD_W - 22, sy_f).lineTo(SPD_W - 2, sy_f)
       .stroke({ color: C.green, width: 2.5 });
      this.spdFMark.x = SPD_W - 24; this.spdFMark.y = sy_f; this.spdFMark.visible = true;
    } else {
      this.spdFMark.visible = false;
    }

    // Green Dot — best L/D clean manoeuvre speed (hollow circle on tape edge)
    const sy_gd = midY + (spd - SPD_GD) * pxPerKt;
    if (sy_gd > tapeTop && sy_gd < tapeBot) {
      g.circle(SPD_W - 8, sy_gd, 6).stroke({ color: C.green, width: 2.5 });
    }

    // ── Mach number below speed box (FCOM: shown inside speed column) ────
    const T_K  = Math.max(216.65, 288.15 - 0.0019812 * Math.min(s.altitude, 36089));
    const mach = s.tas / (661.4788 * Math.sqrt(T_K / 288.15));
    this.machText.text = '.' + Math.round(mach * 100).toString().padStart(2, '0');
    this.machText.x    = SPD_W / 2;
    this.machText.y    = midY + bH / 2 + 22;  // just below speed box
  }

  // ── Altitude tape ────────────────────────────────────────────────────────
  private drawAltTape(s: AircraftState): void {
    const g      = this.gAltTape;
    g.clear();

    const alt     = s.altitude;
    const tapeTop = FMA_H + 44;
    const tapeBot = HDG_Y - 8;
    const midY    = (tapeTop + tapeBot) / 2;
    const px100   = 15.5;

    g.rect(ALT_X, FMA_H, ALT_W, H - FMA_H - HDG_H).fill({ color: C.bg, alpha: 0.9 });

    const lo = Math.floor(alt / 200) * 200 - 1200;
    let   li = 0;
    for (let v = lo; v <= lo + 2400; v += 100) {
      const y = midY + ((alt - v) / 100) * px100;
      if (y < tapeTop || y > tapeBot) continue;
      const major = v % 500 === 0;
      const tw    = major ? 26 : 14;
      g.moveTo(ALT_X, y).lineTo(ALT_X + tw, y).stroke({ color: C.white, width: 1 });
      if (major && li < this.altLabels.length) {
        const t = this.altLabels[li++];
        t.text = String(v); t.x = ALT_X + 32; t.y = y; t.visible = true;
      }
    }
    for (let i = li; i < this.altLabels.length; i++) this.altLabels[i].visible = false;

    // Current altitude box — white border
    const bH = 56, bW = ALT_W - 6;
    g.rect(ALT_X + 3, midY - bH / 2, bW, bH).fill({ color: C.bg }).stroke({ color: C.white, width: 2.5 });
    this.altBox.text = Math.round(alt).toString();
    this.altBox.x    = ALT_X + ALT_W / 2;
    this.altBox.y    = midY;
    this.altBox.style.fill = C.white;

    // Selected alt bug
    const selY = midY + ((alt - s.selectedAlt) / 100) * px100;
    if (selY > tapeTop && selY < tapeBot) {
      g.moveTo(ALT_X, selY - 2).lineTo(ALT_X + 30, selY - 2).lineTo(ALT_X + 30, selY - 16).lineTo(ALT_X + ALT_W, selY - 16)
       .stroke({ color: C.cyan, width: 2 });
      g.moveTo(ALT_X, selY + 2).lineTo(ALT_X + 30, selY + 2).lineTo(ALT_X + 30, selY + 16).lineTo(ALT_X + ALT_W, selY + 16)
       .stroke({ color: C.cyan, width: 2 });
    }

    // Selected alt readout (cyan box at very top of tape area)
    const sbH = 38, sbW = ALT_W - 6;
    g.rect(ALT_X + 3, FMA_H + 6, sbW, sbH).fill({ color: C.bg }).stroke({ color: C.cyan, width: 2 });
    this.altSel.text = String(Math.round(s.selectedAlt));
    this.altSel.x    = ALT_X + ALT_W / 2;
    this.altSel.y    = FMA_H + 6 + sbH / 2;

    // Baro setting (STD above transition altitude — fixed for this scenario)
    this.baroText.text = 'STD';
    this.baroText.x    = ALT_X + ALT_W / 2;
    this.baroText.y    = midY + bH / 2 + 22;  // just below altitude box
  }

  // ── VS strip ─────────────────────────────────────────────────────────────
  private drawVS(s: AircraftState): void {
    const g = this.gVS;
    g.clear();

    g.rect(VS_X, FMA_H, VS_W, H - FMA_H - HDG_H).fill({ color: 0x030608, alpha: 0.92 });

    const cy     = (FMA_H + HDG_Y) / 2;
    const sclH   = (HDG_Y - FMA_H) * 0.35;
    const maxFPM = 2000;

    for (const fpm of [500, 1000, 2000]) {
      const dy = (fpm / maxFPM) * sclH;
      g.moveTo(VS_X,        cy - dy).lineTo(VS_X + VS_W, cy - dy).stroke({ color: C.white, width: 1 });
      g.moveTo(VS_X,        cy + dy).lineTo(VS_X + VS_W, cy + dy).stroke({ color: C.white, width: 1 });
    }
    // Centre zero tick
    g.moveTo(VS_X, cy).lineTo(VS_X + 8, cy).stroke({ color: C.white, width: 2 });

    // VS pointer
    const clamp = Math.max(-maxFPM, Math.min(maxFPM, s.vs));
    const py    = cy - (clamp / maxFPM) * sclH;
    const mx    = VS_X + VS_W / 2;
    if (s.vs >= 0) {
      g.poly([mx, py, mx - 8, py + 14, mx + 8, py + 14]).fill({ color: C.green });
    } else {
      g.poly([mx, py, mx - 8, py - 14, mx + 8, py - 14]).fill({ color: C.green });
    }

    const sign  = s.vs >= 0 ? '+' : '';
    this.vsText.text = sign + Math.round(s.vs);
    this.vsText.x    = VS_X + VS_W / 2;
    this.vsText.y    = py > cy ? py + 32 : py - 32;

    // -1200 FPM bottom label
    this.fpmText.text = `${sign}${Math.round(s.vs)} FPM`;
    this.fpmText.x    = VS_X + VS_W / 2;
    this.fpmText.y    = HDG_Y + HDG_H / 2;
  }

  // ── Heading tape ─────────────────────────────────────────────────────────
  private drawHdgTape(s: AircraftState): void {
    const g      = this.gHdgTape;
    g.clear();

    const hdg    = s.heading;
    const tapeL  = ATT_X + 44;
    const tapeR  = ATT_X + ATT_W - 44;
    const cx     = ATT_CX;
    const pxDeg  = 6.2;

    g.rect(ATT_X, HDG_Y, ATT_W, HDG_H).fill({ color: C.bg, alpha: 0.92 });
    g.moveTo(ATT_X, HDG_Y).lineTo(ATT_X + ATT_W, HDG_Y).stroke({ color: C.border, width: 1 });

    const lo = Math.round(hdg / 5) * 5 - 80;
    let   li = 0;
    for (let d = lo; d <= lo + 160; d += 5) {
      const norm = ((d % 360) + 360) % 360;
      let   dx   = d - hdg;
      if (dx >  180) dx -= 360;
      if (dx < -180) dx += 360;
      const tx = cx + dx * pxDeg;
      if (tx < tapeL || tx > tapeR) continue;

      const major = norm % 10 === 0;
      const th    = major ? 22 : 12;
      g.moveTo(tx, HDG_Y + 4).lineTo(tx, HDG_Y + th).stroke({ color: C.white, width: 1 });

      if (norm % 10 === 0 && li < this.hdgLabels.length) {
        const t    = this.hdgLabels[li++];
        const disp = norm === 0 ? 360 : norm;
        // Two-digit A320 format: 270 → "27", 360 → "36"
        t.text    = String(Math.round(disp / 10)).padStart(2, '0');
        t.x       = tx;
        t.y       = HDG_Y + 46;
        t.visible = true;
      }
    }
    for (let i = li; i < this.hdgLabels.length; i++) this.hdgLabels[i].visible = false;

    // Current heading box
    const bW = 94, bH = HDG_H - 14;
    g.rect(cx - bW / 2, HDG_Y + 4, bW, bH).fill({ color: C.bg }).stroke({ color: C.white, width: 2.5 });
    g.poly([cx, HDG_Y + 2, cx - 12, HDG_Y + 16, cx + 12, HDG_Y + 16]).fill({ color: C.white });
    this.hdgBox.text = Math.round(((hdg % 360) + 360) % 360).toString().padStart(3, '0');
    this.hdgBox.x    = cx;
    this.hdgBox.y    = HDG_Y + HDG_H / 2 + 10;

    // Selected heading bug (cyan)
    let dSel = s.selectedHdg - hdg;
    if (dSel >  180) dSel -= 360;
    if (dSel < -180) dSel += 360;
    const stx = cx + dSel * pxDeg;
    if (stx > tapeL && stx < tapeR) {
      g.poly([stx, HDG_Y + 4, stx - 10, HDG_Y + 20, stx + 10, HDG_Y + 20])
       .fill({ color: C.cyan });
    }

    // Track bug (green)
    let dTrk = s.track - hdg;
    if (dTrk >  180) dTrk -= 360;
    if (dTrk < -180) dTrk += 360;
    const ttx = cx + dTrk * pxDeg;
    if (ttx > tapeL && ttx < tapeR) {
      g.moveTo(ttx, HDG_Y + 4).lineTo(ttx, HDG_Y + 12).stroke({ color: C.green, width: 3 });
    }
  }

  // ── FMA ──────────────────────────────────────────────────────────────────
  // Per FCOM DSC-22_30-100:
  //   Col 1  Autothrust modes     (THR CLB / THR IDLE / TOGA LK / MAN THR)
  //   Col 2  AP/FD vertical mode  (SRS / CLB / OP CLB / ALT* / ALT / V/S …)
  //   Col 3  AP/FD lateral mode   (NAV / HDG / TRK / LOC …)
  //   Col 4  Approach capabilities (blank in normal flight; CAT 1/2/3 in approach)
  //   Col 5  AP/FD + A/THR status  (1FD2 / AP 1 / AP 2) + sub-row "A/THR"
  private drawFMA(s: AircraftState): void {
    const g  = this.gFMA;
    g.clear();
    g.rect(0, 0, W, FMA_H).fill({ color: C.bg });

    const cw = W / 5;

    // Col 1 — A/THR thrust mode
    // MAN* = manual (white), TOGA LK = locked (amber), THR* = A/THR active (green)
    const thrColor = s.thrMode.startsWith('MAN') ? C.white
                   : s.thrMode === 'TOGA LK'     ? C.amber
                   : C.green;

    // Col 2 sub-row — armed vertical mode (cyan, per FCOM FMA layout)
    // FCOM: CLB armed below SRS; ALT armed below CLB/OP CLB
    const vertSub = s.vertMode === 'SRS'                         ? 'CLB'
                  : s.vertMode === 'CLB' || s.vertMode === 'OP CLB' ? 'ALT'
                  : '';

    // Col 4 — approach capabilities (blank during climb; CAT 1/2/3 shown on approach)
    const apprCap = '';

    // Col 5 — AP/FD engagement (white) + A/THR armed (cyan sub-row)
    // FCOM format: "AP1 FD1" when AP engaged, "1FD2" when FDs only
    const apfdLabel = s.apEngaged ? 'AP1 FD1' : '1FD2';
    const athrSub   = s.athrActive ? 'A/THR' : '';

    const cols: Array<{ top: string; topColor: number; sub: string; subColor: number }> = [
      { top: s.thrMode,  topColor: thrColor,  sub: '',       subColor: C.cyan },
      { top: s.vertMode, topColor: C.green,   sub: vertSub,  subColor: C.cyan },
      { top: s.latMode,  topColor: C.green,   sub: '',       subColor: C.cyan },
      { top: apprCap,    topColor: C.white,   sub: '',       subColor: C.cyan },
      { top: apfdLabel,  topColor: C.white,   sub: athrSub,  subColor: C.cyan },
    ];

    cols.forEach((col, i) => {
      const cx = i * cw + cw / 2;
      this.fmaTop[i].text = col.top;
      this.fmaTop[i].style.fill = col.topColor;
      this.fmaTop[i].x = cx; this.fmaTop[i].y = FMA_H * 0.36;
      this.fmaSub[i].text = col.sub;
      this.fmaSub[i].style.fill = col.subColor;
      this.fmaSub[i].x = cx; this.fmaSub[i].y = FMA_H * 0.72;
    });

    // White box around col 5 when AP engaged — per FCOM FMA convention
    if (s.apEngaged) {
      g.rect(4 * cw + 6, 3, cw - 12, FMA_H - 6).stroke({ color: C.white, width: 2 });
    }
    // Dim green outline around active vertical mode col (col 2)
    g.rect(cw + 4, 3, cw - 8, FMA_H - 6).stroke({ color: C.green, width: 1, alpha: 0.3 });
    // Column separators
    for (let i = 1; i < 5; i++) {
      g.moveTo(i * cw, 6).lineTo(i * cw, FMA_H - 6).stroke({ color: 0x1A2030, width: 1 });
    }
  }

  // ── Engine fail indicator — removed; ECAM handles failure annunciation ───
  private drawEngFail(_s: AircraftState): void {
    this.failBox.visible = false;
    this.failTxt.visible = false;
  }
}
