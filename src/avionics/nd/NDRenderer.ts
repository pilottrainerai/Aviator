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
  white:   0xFFFFFF,        // vibrant pure white (was 0xE6E8EC)
  green:   0x00C850,
  cyan:    0x00CFFF,
  amber:   0xFFB300,
  yellow:  0xFFE200,
  magenta: 0xFF40FF,
  dim:     0x3A4050,
  dimG:    0x1A1F28,
  bg:      0x000000,
  border:  0x1C2130,
  sky:     0x000000,        // pure black background (was 0x05080F)
} as const;

// Clean sans-serif matching the FCOM-style ND photo (Windows-era Tahoma /
// Verdana family — slightly condensed, rounded digits).
const FONT_FAMILY = 'Tahoma, Verdana, "Helvetica Neue", Arial, sans-serif';

function mkTxt(
  str: string,
  size: number,
  color: number,
  bold   = false,
  anchor: [number, number] = [0, 0.5],
): Text {
  const t = new Text({
    text: str,
    style: { fontFamily: FONT_FAMILY, fontSize: size, fill: color,
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

  // Header texts — GS/TAS now split into label (white) + value (green)
  private tGSLabel:  Text;
  private tGSValue:  Text;
  private tTASLabel: Text;
  private tTASValue: Text;
  private tWind:     Text;
  private tWpName:   Text;        // TO-waypoint name (magenta)
  private tWpBrg:    Text;        // TO-waypoint bearing
  private tWpDist:   Text;        // TO-waypoint distance
  private tHdgBox:   Text;

  // Range-arc NM labels (one per arc — 25 %, 50 %, 75 % of selected range)
  private tArc1:   Text;
  private tArc2:   Text;
  private tArc3:   Text;

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

    // Waypoint label pool — first waypoint (the TO fix) is magenta,
    // the rest are white.
    this.wpLabels = WAYPOINTS.map((wp, i) => {
      const t = mkTxt(wp.id, 24, i === 0 ? C.magenta : C.white,
                      i === 0, [0, 0.5]);
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

    // GS / TAS — labels white, values green (FCOM convention).  Both on the
    // same row; wind is on the row below.
    this.tGSLabel  = mkTxt('GS',     24, C.white, true,  [0,   0.5]); this.addChild(this.tGSLabel);
    this.tGSValue  = mkTxt('---',    30, C.green, true,  [0,   0.5]); this.addChild(this.tGSValue);
    this.tTASLabel = mkTxt('TAS',    24, C.white, true,  [0,   0.5]); this.addChild(this.tTASLabel);
    this.tTASValue = mkTxt('---',    30, C.green, true,  [0,   0.5]); this.addChild(this.tTASValue);
    this.tWind     = mkTxt('---/--kt', 28, C.green,  false, [0, 0.5]); this.addChild(this.tWind);
    this.tWpName   = mkTxt('',       30, C.magenta, true,  [1,   0.5]); this.addChild(this.tWpName);
    this.tWpBrg    = mkTxt('',       26, C.white,   false, [1,   0.5]); this.addChild(this.tWpBrg);
    this.tWpDist   = mkTxt('',       26, C.white,   false, [1,   0.5]); this.addChild(this.tWpDist);
    // Current heading — yellow numerals (was cyan).
    this.tHdgBox   = mkTxt('---',    34, C.yellow,  true,  [0.5, 0.5]); this.addChild(this.tHdgBox);

    this.tMode  = mkTxt('GPS PRIMARY', 28, C.white, true,  [0.5, 0.5]); this.addChild(this.tMode);
    this.tRange = mkTxt('10 NM',       28, C.cyan,  false, [1,   0.5]); this.addChild(this.tRange);

    // Range-arc NM labels — at 10 NM selected range, arcs at 25 % / 50 % / 75 %
    // ⇒ 2.5, 5, 7.5 NM (matches the user's reference photo).
    this.tArc1 = mkTxt('2.5', 20, C.white, false, [0.5, 0.5]); this.addChild(this.tArc1);
    this.tArc2 = mkTxt('5',   20, C.white, false, [0.5, 0.5]); this.addChild(this.tArc2);
    this.tArc3 = mkTxt('7.5', 20, C.white, false, [0.5, 0.5]); this.addChild(this.tArc3);

    // Static background
    this.gBg.rect(0, 0, W, H).fill({ color: C.sky });
  }

  // ── Public: change the selected range (5 / 10 / 20 / 40 NM).  Updates
  //    the three arc labels and the footer readout.  Geometry stays fixed
  //    (waypoints aren't scaled to NM in this demo).
  setRange(nm: number): void {
    const fmt = (n: number) =>
      n % 1 === 0 ? String(n)
                  : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    this.tArc1.text  = fmt(nm * 0.25);
    this.tArc2.text  = fmt(nm * 0.5);
    this.tArc3.text  = fmt(nm * 0.75);
    this.tRange.text = `${nm} NM`;
  }

  // ── Public update (called every ticker tick) ─────────────────────────────
  update(s: AircraftState): void {
    this.drawHeader(s);
    this.drawCompass(s);
    // Weather radar disabled — was rendering green precip blobs the user
    // didn't want on the demo ND.  drawWeather() still exists if we want
    // to bring it back behind a toggle.
    this.gWeather.clear();
    this.drawRoute(s);
    this.drawAircraft();
    this.drawFailStrip(s);
    this.drawFooter(s);
  }

  // ── Header strip ─────────────────────────────────────────────────────────
  // No background fill — keep pure black so heading ticks + labels can
  // extend up into this band from the compass arc.
  private drawHeader(s: AircraftState): void {
    const g = this.gHdr;
    g.clear();

    // Heading box (centre top) — yellow border + yellow numerals.
    const hdgStr = String(Math.round(((s.heading % 360) + 360) % 360)).padStart(3, '0');
    g.rect(W / 2 - 56, 6, 112, 44).fill({ color: 0x000000 })
                                   .stroke({ color: C.yellow, width: 2 });
    this.tHdgBox.text = hdgStr;
    this.tHdgBox.x = W / 2; this.tHdgBox.y = 30;

    // GS / TAS — same row, white label + green value.
    const gsStr  = String(Math.round(s.gs));
    const tasStr = String(Math.round(s.tas));
    this.tGSLabel.text  = 'GS';
    this.tGSLabel.x  = 18;   this.tGSLabel.y  = 30;
    this.tGSValue.text  = gsStr;
    this.tGSValue.x  = 64;   this.tGSValue.y  = 30;
    this.tTASLabel.text = 'TAS';
    this.tTASLabel.x = 150;  this.tTASLabel.y = 30;
    this.tTASValue.text = tasStr;
    this.tTASValue.x = 210;  this.tTASValue.y = 30;

    // Wind on the row below GS/TAS — green.
    this.tWind.text = `${String(s.windDir).padStart(3, '0')}°/${s.windSpd}kt`;
    this.tWind.x = 18; this.tWind.y = 64;

    // TO-waypoint info top-right — name (magenta), bearing, distance.
    const trkStr = String(Math.round(((s.track % 360) + 360) % 360)).padStart(3, '0');
    this.tWpName.text = 'BIDUR';
    this.tWpName.x = W - 18; this.tWpName.y = 22;
    this.tWpBrg.text  = `${trkStr}°`;
    this.tWpBrg.x = W - 18;  this.tWpBrg.y = 48;
    this.tWpDist.text = '3.0 NM';
    this.tWpDist.x = W - 18; this.tWpDist.y = 72;
  }

  // ── Footer strip ─────────────────────────────────────────────────────────
  // Footer: no background strip — just the GPS PRIMARY pill + range readout.
  private drawFooter(s: AircraftState): void {
    void s;
    const g = this.gFtr;
    g.clear();

    const modeY = H - FTR_H / 2;
    const modeW = 240, modeH = 38;
    g.rect(W / 2 - modeW / 2, modeY - modeH / 2, modeW, modeH)
     .fill({ color: 0x000000 })
     .stroke({ color: C.white, width: 1.5 });
    this.tMode.x = W / 2;  this.tMode.y = modeY;

    this.tRange.x = W - 18; this.tRange.y = modeY;
  }

  // ── Compass arc + ticks + labels ─────────────────────────────────────────
  private drawCompass(s: AircraftState): void {
    const g = this.gCompass;
    g.clear();

    // Three dashed range arcs at 1/4, 1/2, 3/4 of selected range —
    // FCOM DSC-31-45 §(1).  Smaller dashes (30 px) + visible gaps (18 px)
    // so the rings clearly read as "dash gap dash gap" rather than a
    // solid-ish line.  Dash length is in PIXELS (converted to radians per
    // arc) so the pattern is consistent on every ring.
    const DASH_PX = 30, GAP_PX = 18;
    const fracs   = [0.25, 0.5, 0.75] as const;
    fracs.forEach(frac => {
      const r       = R * frac;
      const dashAng = DASH_PX / r;
      const stepAng = (DASH_PX + GAP_PX) / r;
      for (let a = Math.PI * 1.12; a <= Math.PI * 1.88; a += stepAng) {
        const ex = Math.min(a + dashAng, Math.PI * 1.88);
        g.moveTo(OX + r * Math.cos(a),  OY + r * Math.sin(a))
         .lineTo(OX + r * Math.cos(ex), OY + r * Math.sin(ex))
         .stroke({ color: C.white, width: 3, alpha: 0.90 });
      }
    });

    // NM labels on each arc — positioned at the lower-left of each ring,
    // just INSIDE the dashed line so they read as "below the arc" and sit
    // in clear black space rather than on top of a dash.
    const labelAng = Math.PI * 1.22;
    [this.tArc1, this.tArc2, this.tArc3].forEach((t, i) => {
      const r = R * fracs[i] - 20;
      t.x = OX + r * Math.cos(labelAng);
      t.y = OY + r * Math.sin(labelAng);
    });

    // Outer compass arc (ARC mode ~144°)
    g.arc(OX, OY, R, Math.PI * 1.1, Math.PI * 1.9)
     .stroke({ color: 0x5A6070, width: 3 });

    // Heading ticks + pooled labels
    const hdg = s.heading;
    let lblIdx = 0;

    // Ticks + labels sit OUTSIDE the compass arc (FCOM convention).  Ticks
    // grow from r=R outward to r=R+tl; labels are further out at r=R+LBL.
    const LBL = 38;
    for (let d = -80; d <= 80; d += 5) {
      const tickHdg = ((Math.round(hdg / 5) * 5 + d) + 3600) % 360;
      let delta = tickHdg - hdg;
      if (delta >  180) delta -= 360;
      if (delta < -180) delta += 360;

      // PixiJS: 0=right, π/2=down, π=left, 3π/2=up
      const angle = Math.PI * 1.5 + delta * (Math.PI / 180);
      const ax = OX + R * Math.cos(angle);
      const ay = OY + R * Math.sin(angle);

      // Skip ticks that fall below the aircraft (outside the drawn arc)
      if (ay > OY - 10) continue;
      if (ax < -60 || ax > W + 60) continue;

      const major = tickHdg % 10 === 0;
      const tl    = major ? 22 : 12;
      const ox = OX + (R + tl) * Math.cos(angle);
      const oy = OY + (R + tl) * Math.sin(angle);

      g.moveTo(ax, ay).lineTo(ox, oy)
       .stroke({ color: major ? C.white : 0x8A8F9A, width: major ? 2.5 : 1.5 });

      // Every 10° gets a label OUTSIDE the arc.  Cardinal letters at
      // N/E/S/W, 2-digit abbreviated tens elsewhere (280° → "28").
      if (major && lblIdx < this.hdgPool.length) {
        const lx = OX + (R + LBL) * Math.cos(angle);
        const ly = OY + (R + LBL) * Math.sin(angle);
        const t  = this.hdgPool[lblIdx++];
        if      (tickHdg === 0)   t.text = 'N';
        else if (tickHdg === 90)  t.text = 'E';
        else if (tickHdg === 180) t.text = 'S';
        else if (tickHdg === 270) t.text = 'W';
        else                      t.text = String(tickHdg / 10);
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

    // Yellow lubber marker — fixed indicator at the top of the arc that
    // shows the aircraft's current heading.  Vertical bar above the arc +
    // small downward-pointing triangle whose tip sits just inside the arc.
    const lubBaseY = OY - R - 4;        // triangle base (also bottom of bar)
    const lubTopY  = OY - R - 30;       // top of vertical bar
    const lubTipY  = OY - R + 8;        // triangle tip (inside the arc)
    g.moveTo(OX, lubBaseY).lineTo(OX, lubTopY)
     .stroke({ color: C.yellow, width: 3 });
    g.poly([OX, lubTipY, OX - 8, lubBaseY, OX + 8, lubBaseY])
     .fill({ color: C.yellow });
  }

  // ── Aircraft symbol ───────────────────────────────────────────────────────
  // FCOM DSC-31-45: yellow aircraft symbol on the ND, oriented to true track.
  // User-specified stylisation: vertical big line + top horizontal (wider) +
  // bottom horizontal (smaller).  Matches the /mockups/nd Canvas-2D version
  // (28-tall vertical, 32-wide top, 14-wide bottom) scaled ~2× for the
  // 1024×1024 Pixi stage.
  private drawAircraft(): void {
    const g = this.gAc;
    g.clear();

    const ax = OX, ay = OY;
    g.rect(ax - 4,  ay - 34, 8,  60).fill({ color: C.yellow }); // vertical
    g.rect(ax - 34, ay - 13, 68, 7 ).fill({ color: C.yellow }); // top horizontal (wider)
    g.rect(ax - 15, ay + 17, 30, 7 ).fill({ color: C.yellow }); // bottom horizontal (smaller)
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

    // Waypoint markers — first (TO) fix is a hollow magenta circle with a
    // small inner magenta diamond.  Subsequent fixes are smaller hollow
    // white diamonds.
    pts.forEach((p, i) => {
      if (i === 0) {
        g.circle(p.x, p.y, 14).stroke({ color: C.magenta, width: 2.5 });
        const d = 5;
        g.poly([p.x, p.y - d, p.x + d, p.y, p.x, p.y + d, p.x - d, p.y])
         .fill({ color: C.magenta });
      } else {
        const d = 9;
        g.poly([p.x, p.y - d, p.x + d, p.y, p.x, p.y + d, p.x - d, p.y])
         .stroke({ color: C.white, width: 1.8 });
      }
      this.wpLabels[i].x = p.x + 20;
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

  // ── ENG FAIL strip — removed; ECAM handles failure annunciation ──────────
  private drawFailStrip(_s: AircraftState): void {
    this.gFailStrip.clear();
    this.tFail1.visible = false;
    this.tFail2.visible = false;
  }
}
