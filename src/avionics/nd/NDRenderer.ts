import { Container, Graphics, Text } from 'pixi.js';
import type { AircraftState } from '../core/aircraftState';

const W = 1024;
const H = 1024;

const C = {
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

function txt(str: string, size: number, color: number, bold = false, align: 'left' | 'center' | 'right' = 'left'): Text {
  const t = new Text({
    text: str,
    style: { fontFamily: 'monospace', fontSize: size, fill: color, fontWeight: bold ? 'bold' : 'normal', align },
  });
  t.anchor.x = align === 'center' ? 0.5 : align === 'right' ? 1 : 0;
  t.anchor.y = 0.5;
  return t;
}

export class NDRenderer extends Container {

  private gCompass:   Graphics;
  private gRoute:     Graphics;
  private gWeather:   Graphics;
  private gFireBox:   Graphics;
  private gDataStrip: Graphics;

  // Text
  private gsText:    Text;
  private tasText:   Text;
  private windText:  Text;
  private trkText:   Text;
  private modeText:  Text;
  private rangeText: Text;
  private wp1Label:  Text;
  private wp2Label:  Text;

  // ARC compass geometry
  private readonly OX = W / 2;    // origin x = center
  private readonly OY = H - 80;   // origin y (ARC: aircraft at bottom)
  private readonly R  = H - 180;  // compass radius

  constructor() {
    super();

    this.gDataStrip = new Graphics();
    this.gCompass   = new Graphics();
    this.gWeather   = new Graphics();
    this.gRoute     = new Graphics();
    this.gFireBox   = new Graphics();

    this.addChild(this.gCompass);
    this.addChild(this.gWeather);
    this.addChild(this.gRoute);
    this.addChild(this.gFireBox);
    this.addChild(this.gDataStrip);

    this.gsText    = txt('GS   ---', 26, C.white); this.addChild(this.gsText);
    this.tasText   = txt('TAS  ---', 26, C.white); this.addChild(this.tasText);
    this.windText  = txt('---/--', 26, C.green);   this.addChild(this.windText);
    this.trkText   = txt('TRK ---', 22, C.white, false, 'right'); this.addChild(this.trkText);
    this.modeText  = txt('NAV ARC', 22, C.green);  this.addChild(this.modeText);
    this.rangeText = txt('40 NM',   22, C.cyan, false, 'right'); this.addChild(this.rangeText);
    this.wp1Label  = txt('UKASI', 20, C.white);    this.addChild(this.wp1Label);
    this.wp2Label  = txt('VIDP',  20, C.white);    this.addChild(this.wp2Label);

    // Static chrome
    this.drawChrome();
  }

  private drawChrome(): void {
    const g = new Graphics();
    g.rect(0, 0, W, H).stroke({ color: C.border, width: 3 });
    this.addChild(g);
  }

  update(s: AircraftState): void {
    this.drawDataStrip(s);
    this.drawCompass(s);
    this.drawRoute(s);
    this.drawWeather(s);
    this.drawFireBox(s);
    this.positionLabels(s);
  }

  private drawDataStrip(s: AircraftState): void {
    const g = this.gDataStrip;
    g.clear();
    g.rect(0, 0, W, 70).fill({ color: C.bg, alpha: 0.9 });
    g.moveTo(0, 70).lineTo(W, 70).stroke({ color: C.border, width: 1 });

    this.gsText.text   = `GS  ${Math.round(s.gs)}`;
    this.gsText.style.fill = C.cyan;
    this.gsText.x = 16; this.gsText.y = 38;

    this.tasText.text  = `TAS ${Math.round(s.tas)}`;
    this.tasText.style.fill = C.cyan;
    this.tasText.x = 200; this.tasText.y = 38;

    this.windText.text = `${String(s.windDir).padStart(3, '0')}°/${s.windSpd}kt`;
    this.windText.x = 420; this.windText.y = 38;

    this.trkText.text  = `TRK ${String(Math.round(((s.track % 360) + 360) % 360)).padStart(3, '0')}`;
    this.trkText.x = W - 16; this.trkText.y = 38;

    this.modeText.x = 16;      this.modeText.y = H - 28;
    this.rangeText.x = W - 16; this.rangeText.y = H - 28;
  }

  private drawCompass(s: AircraftState): void {
    const g  = this.gCompass;
    const ox = this.OX, oy = this.OY, R = this.R;
    g.clear();

    // Outer arc (ARC mode: half circle)
    g.arc(ox, oy, R, -Math.PI * 0.88, -Math.PI * 0.12)
     .stroke({ color: 0x5A6070, width: 2 });

    // Inner dashed range ring (half range)
    const R2 = R * 0.5;
    for (let a = Math.PI * 1.12; a <= Math.PI * 1.88; a += 0.04) {
      g.moveTo(ox + R2 * Math.cos(a), oy + R2 * Math.sin(a))
       .lineTo(ox + R2 * Math.cos(a + 0.025), oy + R2 * Math.sin(a + 0.025))
       .stroke({ color: 0x222830, width: 1 });
    }

    // Heading ticks
    const hdg = s.heading;
    for (let d = -9; d <= 9; d++) {
      const tickHdg = ((Math.round(hdg / 5) * 5 + d * 5) + 3600) % 360;
      let   delta   = tickHdg - hdg;
      if (delta > 180)  delta -= 360;
      if (delta < -180) delta += 360;

      const angle = Math.PI * 1.5 + delta * (Math.PI / 180);  // 270°=up base
      const x1    = ox + R * Math.cos(angle);
      const y1    = oy + R * Math.sin(angle);
      const major = tickHdg % 10 === 0;
      const tl    = major ? 28 : 16;
      const x2    = ox + (R - tl) * Math.cos(angle);
      const y2    = oy + (R - tl) * Math.sin(angle);

      g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: major ? C.white : 0x5A6070, width: major ? 2 : 1 });

      if (tickHdg % 30 === 0) {
        const lx = ox + (R - 52) * Math.cos(angle);
        const ly = oy + (R - 52) * Math.sin(angle);
        const lt = txt(String(tickHdg).padStart(3, '0'), 22, 0x9AA0A8, false, 'center');
        lt.x = lx; lt.y = ly;
        this.addChild(lt);
      }
    }

    // Track line (white, straight up from aircraft)
    const acY = oy - R * 0.26;
    g.moveTo(ox, oy).lineTo(ox, 80).stroke({ color: C.white, width: 1, alpha: 0.35 });

    // Aircraft symbol at ARC origin
    g.poly([ox, acY - 14, ox - 10, acY + 6, ox, acY, ox + 10, acY + 6]).fill({ color: C.amber });
    // Wing dots
    g.rect(ox - 50, acY - 2, 36, 5).fill({ color: C.amber });
    g.rect(ox + 14, acY - 2, 36, 5).fill({ color: C.amber });

    // Selected heading line
    let dSel = s.selectedHdg - hdg;
    if (dSel > 180)  dSel -= 360;
    if (dSel < -180) dSel += 360;
    if (Math.abs(dSel) < 90) {
      const sa = Math.PI * 1.5 + dSel * (Math.PI / 180);
      g.moveTo(ox, oy).lineTo(ox + R * Math.cos(sa), oy + R * Math.sin(sa))
       .stroke({ color: C.cyan, width: 2, alpha: 0.6 });
    }
  }

  private drawRoute(s: AircraftState): void {
    const g  = this.gRoute;
    const ox = this.OX, oy = this.OY, R = this.R;
    g.clear();

    const acY = oy - R * 0.26;

    // Magenta route
    const wp1 = { x: ox,      y: oy - R * 0.58 };
    const wp2 = { x: ox + 90, y: oy - R * 0.82 };

    g.moveTo(ox, acY).lineTo(wp1.x, wp1.y).lineTo(wp2.x, wp2.y)
     .stroke({ color: C.magenta, width: 3 });

    // Waypoint diamonds
    for (const wp of [wp1, wp2]) {
      g.poly([wp.x, wp.y - 7, wp.x + 7, wp.y, wp.x, wp.y + 7, wp.x - 7, wp.y]).fill({ color: C.white });
    }

    this.wp1Label.x = wp1.x + 12; this.wp1Label.y = wp1.y - 10;
    this.wp2Label.x = wp2.x + 12; this.wp2Label.y = wp2.y - 10;
  }

  private drawWeather(s: AircraftState): void {
    const g  = this.gWeather;
    const ox = this.OX, oy = this.OY, R = this.R;
    g.clear();
    if (s.eng1Failed || s.eng2Failed) return; // weather suppressed during emergency (simplified)

    // Green wx return
    g.rect(ox + 110, oy - R * 0.50, 60, 40).fill({ color: 0x005510, alpha: 0.8 });
    g.rect(ox + 130, oy - R * 0.55, 45, 30).fill({ color: C.green, alpha: 0.6 });
    // Amber wx return
    g.rect(ox + 180, oy - R * 0.68, 40, 28).fill({ color: C.amber, alpha: 0.5 });
  }

  private drawFireBox(s: AircraftState): void {
    const g  = this.gFireBox;
    const ox = this.OX, oy = this.OY, R = this.R;
    g.clear();

    if (!s.eng1Failed && !s.eng2Failed) return;

    const bx = ox + 80, by = oy - R * 0.65;
    g.rect(bx, by, 180, 60).fill({ color: 0x0A0500, alpha: 0.9 })
     .stroke({ color: C.amber, width: 2 });

    // Text is handled with a re-used text object
    const label = txt(s.eng1Failed ? 'ENG 1 FIRE' : 'ENG 2 FAIL', 24, C.amber, true);
    label.x = bx + 10; label.y = by + 22;
    const sub = txt('RTB VIDP', 20, C.amber);
    sub.x = bx + 10; sub.y = by + 44;
    this.gFireBox.addChild(label);
    this.gFireBox.addChild(sub);
  }

  private positionLabels(_s: AircraftState): void {
    // labels positioned per-frame inside drawCompass/drawRoute — no-op here
  }
}
