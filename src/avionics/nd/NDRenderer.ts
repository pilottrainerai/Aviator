import { Container, Graphics, Text } from 'pixi.js';
import type { AircraftState } from '../core/aircraftState';

const W = 1024;
const H = 1024;

// ARC geometry — aircraft symbol sits at OX, OY; compass arc is centred there
const OX  = W / 2;       // horizontal centre
const OY  = H * 0.87;    // arc centre / aircraft anchor (lower quarter)
const R   = H * 0.77;    // compass radius

const HDR_H = 82;         // header strip height
const FTR_H = 58;         // footer strip height

const C = {
  white:   0xE6E8EC,
  green:   0x00C850,
  cyan:    0x00CFFF,
  amber:   0xFFB300,
  yellow:  0xFFE200,
  magenta: 0xFF40FF,
  dim:     0x3A4050,
  dimG:    0x1A1F28,
  bg:      0x000000,
  border:  0x1C2130,
  sky:     0x05080F,
} as const;

function mkTxt(
  str: string,
  size: number,
  color: number,
  bold   = false,
  anchor: [number, number] = [0, 0.5],
): Text {
  const t = new Text({
    text: str,
    style: { fontFamily: 'monospace', fontSize: size, fill: color,
             fontWeight: bold ? 'bold' : 'normal' },
  });
  t.anchor.set(...anchor);
  return t;
}

// Route waypoints: dx/dy as fraction of R, relative to OX/OY (aircraft)
// VIDP (Delhi) departure — Runway 28 westbound SID fixes
const WAYPOINTS = [
  { id: 'BIDUR', dx:  0.00, dy: -0.30 },  // VIDP SID exit ~22nm W
  { id: 'DOTSA', dx:  0.07, dy: -0.50 },  // ~38nm
  { id: 'VAGAD', dx:  0.18, dy: -0.68 },  // ~52nm
  { id: 'LALDO', dx:  0.30, dy: -0.84 },  // ~65nm
] as const;

const HDG_POOL = 20;   // pre-allocated heading label objects

export class NDRenderer extends Container {

  // Layer graphics
  private gBg:         Graphics;
  private gCompass:    Graphics;
  private gRoute:      Graphics;
  private gWeather:    Graphics;
  private gAc:         Graphics;
  private gFailStrip:  Graphics;
  private gHdr:        Graphics;
  private gFtr:        Graphics;

  // Pre-allocated text pools — NEVER allocate text in update()
  private hdgPool:  Text[];          // heading labels
  private wpLabels: Text[];          // waypoint names

  // Header texts
  private tGS:     Text;
  private tTAS:    Text;
  private tWind:   Text;
  private tTrk:    Text;
  private tHdgBox: Text;

  // Footer texts
  private tMode:  Text;
  private tRange: Text;

  // Fail strip texts
  private tFail1: Text;
  private tFail2: Text;

  constructor() {
    super();

    this.gBg        = new Graphics();
    this.gCompass   = new Graphics();
    this.gRoute     = new Graphics();
    this.gWeather   = new Graphics();
    this.gAc        = new Graphics();
    this.gFailStrip = new Graphics();
    this.gHdr       = new Graphics();
    this.gFtr       = new Graphics();

    // Layer order: bg → compass → weather → route → ac symbol → fail strip → hdr/ftr
    this.addChild(this.gBg, this.gCompass, this.gWeather, this.gRoute);

    // Heading label pool
    this.hdgPool = [];
    for (let i = 0; i < HDG_POOL; i++) {
      const t = mkTxt('', 26, 0x9AA0A8, false, [0.5, 0.5]);
      t.visible = false;
      this.addChild(t);
      this.hdgPool.push(t);
    }

    // Waypoint label pool
    this.wpLabels = WAYPOINTS.map(wp => {
      const t = mkTxt(wp.id, 24, C.white, false, [0, 0.5]);
      this.addChild(t);
      return t;
    });

    this.addChild(this.gAc, this.gFailStrip);

    // Fail strip texts
    this.tFail1 = mkTxt('', 38, C.amber, true,  [0.5, 0.5]);
    this.tFail2 = mkTxt('', 28, C.amber, false, [0.5, 0.5]);
    this.addChild(this.tFail1, this.tFail2);

    // Header / footer on top
    this.addChild(this.gHdr, this.gFtr);

    this.tGS     = mkTxt('GS  ---', 30, C.cyan,  false, [0,   0.5]); this.addChild(this.tGS);
    this.tTAS    = mkTxt('TAS ---', 30, C.cyan,  false, [0,   0.5]); this.addChild(this.tTAS);
    this.tWind   = mkTxt('---/--kt', 28, C.green, false, [0,  0.5]); this.addChild(this.tWind);
    this.tTrk    = mkTxt('TRK ---', 26, C.white, false, [1,   0.5]); this.addChild(this.tTrk);
    this.tHdgBox = mkTxt('---',     34, C.cyan,  true,  [0.5, 0.5]); this.addChild(this.tHdgBox);

    this.tMode  = mkTxt('NAV ARC', 28, C.green, false, [0, 0.5]); this.addChild(this.tMode);
    this.tRange = mkTxt('40 NM',   28, C.cyan,  false, [1, 0.5]); this.addChild(this.tRange);

    // Static background
    this.gBg.rect(0, 0, W, H).fill({ color: C.sky });
  }

  // ── Public update (called every ticker tick) ─────────────────────────────
  update(s: AircraftState): void {
    this.drawHeader(s);
    this.drawCompass(s);
    this.drawWeather(s);
    this.drawRoute(s);
    this.drawAircraft();
    this.drawFailStrip(s);
    this.drawFooter(s);
  }

  // ── Header strip ─────────────────────────────────────────────────────────
  private drawHeader(s: AircraftState): void {
    const g = this.gHdr;
    g.clear();
    g.rect(0, 0, W, HDR_H).fill({ color: 0x020406 });
    g.moveTo(0, HDR_H).lineTo(W, HDR_H).stroke({ color: C.border, width: 1 });

    // Heading box (centre top)
    const hdgStr = String(Math.round(((s.heading % 360) + 360) % 360)).padStart(3, '0');
    g.rect(W / 2 - 52, 8, 104, 44).fill({ color: 0x001820 })
                                    .stroke({ color: C.cyan, width: 2 });
    this.tHdgBox.text = hdgStr;
    this.tHdgBox.x = W / 2; this.tHdgBox.y = 32;

    // GS / TAS left
    this.tGS.text  = `GS  ${String(Math.round(s.gs)).padStart(3, ' ')}`;
    this.tTAS.text = `TAS ${String(Math.round(s.tas)).padStart(3, ' ')}`;
    this.tGS.x = 18; this.tGS.y = 30;
    this.tTAS.x = 18; this.tTAS.y = 58;

    // Wind top-left second row
    this.tWind.text = `${String(s.windDir).padStart(3, '0')}°/${s.windSpd}kt`;
    this.tWind.x = 280; this.tWind.y = 44;

    // TRK right
    const trkStr = String(Math.round(((s.track % 360) + 360) % 360)).padStart(3, '0');
    this.tTrk.text = `TRK ${trkStr}`;
    this.tTrk.x = W - 18; this.tTrk.y = 30;
  }

  // ── Footer strip ─────────────────────────────────────────────────────────
  private drawFooter(s: AircraftState): void {
    void s;  // footer content is static in this simulation
    const g = this.gFtr;
    g.clear();
    const fy = H - FTR_H;
    g.rect(0, fy, W, FTR_H).fill({ color: 0x020406 });
    g.moveTo(0, fy).lineTo(W, fy).stroke({ color: C.border, width: 1 });

    this.tMode.x  = 18;      this.tMode.y  = H - FTR_H / 2;
    this.tRange.x = W - 18;  this.tRange.y = H - FTR_H / 2;
  }

  // ── Compass arc + ticks + labels ─────────────────────────────────────────
  private drawCompass(s: AircraftState): void {
    const g = this.gCompass;
    g.clear();

    // Dashed inner half-range ring
    const R2 = R * 0.5;
    for (let a = Math.PI * 1.12; a <= Math.PI * 1.88; a += 0.045) {
      const ex = a + 0.026;
      g.moveTo(OX + R2 * Math.cos(a),  OY + R2 * Math.sin(a))
       .lineTo(OX + R2 * Math.cos(ex), OY + R2 * Math.sin(ex))
       .stroke({ color: C.dimG, width: 1.5 });
    }

    // Outer compass arc (ARC mode ~144°)
    g.arc(OX, OY, R, Math.PI * 1.1, Math.PI * 1.9)
     .stroke({ color: 0x5A6070, width: 3 });

    // Track line — white, slightly transparent, from aircraft straight up
    g.moveTo(OX, OY).lineTo(OX, HDR_H + 10)
     .stroke({ color: C.white, width: 1.5, alpha: 0.25 });

    // Heading ticks + pooled labels
    const hdg = s.heading;
    let lblIdx = 0;

    for (let d = -80; d <= 80; d += 5) {
      const tickHdg = ((Math.round(hdg / 5) * 5 + d) + 3600) % 360;
      let delta = tickHdg - hdg;
      if (delta >  180) delta -= 360;
      if (delta < -180) delta += 360;

      // PixiJS: 0=right, π/2=down, π=left, 3π/2=up
      const angle = Math.PI * 1.5 + delta * (Math.PI / 180);
      const cx = OX + R * Math.cos(angle);
      const cy = OY + R * Math.sin(angle);

      // Skip ticks that are below the aircraft (i.e. outside the drawn arc)
      if (cy > OY - 10) continue;
      // Skip ticks outside horizontal view
      if (cx < -60 || cx > W + 60) continue;

      const major = tickHdg % 10 === 0;
      const tl    = major ? 36 : 20;
      const ix = OX + (R - tl) * Math.cos(angle);
      const iy = OY + (R - tl) * Math.sin(angle);

      g.moveTo(cx, cy).lineTo(ix, iy)
       .stroke({ color: major ? C.white : 0x5A6070, width: major ? 2.5 : 1.5 });

      // Every 10° gets a label from the pre-allocated pool
      if (major && lblIdx < this.hdgPool.length) {
        const lx = OX + (R - 72) * Math.cos(angle);
        const ly = OY + (R - 72) * Math.sin(angle);
        const t  = this.hdgPool[lblIdx++];
        t.text    = String(tickHdg).padStart(3, '0');
        t.x       = lx;
        t.y       = ly;
        t.visible = true;
      }
    }

    // Hide unused pool slots
    for (let i = lblIdx; i < this.hdgPool.length; i++) {
      this.hdgPool[i].visible = false;
    }

    // Selected-heading bug on arc
    let dSel = s.selectedHdg - hdg;
    if (dSel >  180) dSel -= 360;
    if (dSel < -180) dSel += 360;
    if (Math.abs(dSel) < 78) {
      const sa = Math.PI * 1.5 + dSel * (Math.PI / 180);
      const bx = OX + R * Math.cos(sa);
      const by = OY + R * Math.sin(sa);
      g.poly([bx, by - 12, bx + 10, by + 4, bx, by - 2, bx - 10, by + 4]).fill({ color: C.cyan });
    }
  }

  // ── Aircraft symbol ───────────────────────────────────────────────────────
  private drawAircraft(): void {
    const g = this.gAc;
    g.clear();

    const ax = OX, ay = OY;
    // Triangle (nose up)
    g.poly([ax, ay - 24, ax - 15, ay + 8, ax, ay + 1, ax + 15, ay + 8]).fill({ color: C.yellow });
    // Wings
    g.rect(ax - 76, ay - 5, 56, 9).fill({ color: C.yellow });
    g.rect(ax + 20, ay - 5, 56, 9).fill({ color: C.yellow });
    // Horizontal stabiliser
    g.rect(ax - 20, ay + 7, 40, 7).fill({ color: C.yellow });
  }

  // ── Route + waypoints ─────────────────────────────────────────────────────
  private drawRoute(_s: AircraftState): void {
    const g = this.gRoute;
    g.clear();

    const pts = WAYPOINTS.map(wp => ({
      x: OX + wp.dx * R,
      y: OY + wp.dy * R,
    }));

    // Magenta route line from aircraft to last waypoint
    g.moveTo(OX, OY);
    for (const p of pts) g.lineTo(p.x, p.y);
    g.stroke({ color: C.magenta, width: 3.5 });

    // Waypoint diamonds
    pts.forEach((p, i) => {
      const d = 10;
      g.poly([p.x, p.y - d, p.x + d, p.y, p.x, p.y + d, p.x - d, p.y]).fill({ color: C.white });
      this.wpLabels[i].x = p.x + 16;
      this.wpLabels[i].y = p.y - 14;
    });
  }

  // ── Weather radar returns ─────────────────────────────────────────────────
  private drawWeather(_s: AircraftState): void {
    const g = this.gWeather;
    g.clear();

    // Blobs at ~10 o'clock direction (-55° from heading = left-forward)
    // angle in PixiJS: 3π/2 = straight up, subtract 55° for left
    const ang = Math.PI * 1.5 - 55 * (Math.PI / 180);
    const d   = R * 0.42;
    const bx  = OX + d * Math.cos(ang);
    const by  = OY + d * Math.sin(ang);

    // Outer diffuse green
    g.arc(bx - 18, by - 8, 88, 0, Math.PI * 2).fill({ color: 0x003018, alpha: 0.80 });
    // Medium green
    g.arc(bx,      by,      62, 0, Math.PI * 2).fill({ color: 0x006830, alpha: 0.70 });
    // Bright green core
    g.arc(bx - 8,  by - 5,  38, 0, Math.PI * 2).fill({ color: C.green,  alpha: 0.55 });

    // Amber cell (heavier precip, slightly ahead and right of green)
    g.arc(bx + 52, by - 36, 48, 0, Math.PI * 2).fill({ color: 0x7A3C00, alpha: 0.80 });
    g.arc(bx + 60, by - 42, 30, 0, Math.PI * 2).fill({ color: C.amber,  alpha: 0.60 });
  }

  // ── ENG FAIL strip ────────────────────────────────────────────────────────
  private drawFailStrip(s: AircraftState): void {
    const g = this.gFailStrip;
    g.clear();

    const active = s.eng1Failed || s.eng2Failed;
    this.tFail1.visible = active;
    this.tFail2.visible = active;

    if (!active) return;

    const label  = s.eng1Failed ? 'ENG 1 FAIL' : 'ENG 2 FAIL';
    const stripY = H - FTR_H - 110;
    const stripH = 100;

    g.rect(0, stripY, W, stripH)
     .fill({ color: 0x0C0600, alpha: 0.96 })
     .stroke({ color: C.amber, width: 2.5 });

    this.tFail1.text = label;
    this.tFail1.x = W / 2; this.tFail1.y = stripY + 32;

    this.tFail2.text = 'RETURN CONSIDERED';
    this.tFail2.x = W / 2; this.tFail2.y = stripY + 72;
  }
}
