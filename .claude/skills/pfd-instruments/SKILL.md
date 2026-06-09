---
name: pfd-instruments
description: Locked working baseline for the Aviator PFD instruments in pfd-mockup.tsx — VS indicator, Radio Altimeter, and altitude animation. Load this skill before touching any of these three elements. Contains exact geometry, animation loop, and RA formula as confirmed working by the pilot on 2026-06-09. DO NOT change the VS bar movement, RA liftoff, or altitude lerp without reading this first.
---

# PFD Instruments Skill — VS / RA / Altitude baseline

**File:** `src/components/cockpit/pfd-mockup.tsx`

This skill locks the working state of three PFD instruments confirmed correct
by the pilot on 2026-06-09. Before modifying any of them, read this skill and
confirm which part you are changing.

---

## 0. Hard rules

1. **Do not change VS bar movement without pilot sign-off.** The geometry below
   is confirmed working. Changing PX, TX, halfH, or yFor breaks alignment.
2. **Do not change the animation loop lerp factors** (0.05 speed, 0.06 VS)
   without understanding the RA liftoff dependency.
3. **RA = lerpAlt − 777.** VIDP field elevation = 777 ft AMSL. Do not change
   this formula or the field elevation constant.
4. **One element at a time.** If asked to "fix the VS and RA together", split
   into two separate assessments.

---

## 1. Canvas layout constants

```
W = 520, H = 740           canvas size (pfd-mockup.tsx top of drawPFD)

VX = 468, VW = 30          VS strip: left=468, right=498, width=30 px
VT = 115, VH = 365         VS strip: top=115, bottom=480, height=365 px

AX = 392, AW = 72          Altitude tape: left=392, right=464
AT = 125, AH = 345         Altitude tape: top=125, height=345 px
```

Gap between altitude tape right edge (464) and VS strip left edge (468) = **4 px**.
Scale labels that bleed left of 468 will overlap the altitude tape.

---

## 2. VS strip — confirmed working geometry

### Constants (inside drawVS)

```
mid   = top + h/2           = VT + VH/2 = 297.5   (vertical centre of strip)
halfH = h/2 - 22            = 160.5                (±160 px = ±6000 fpm range)
MAX_VS = 6000               fpm
BULGE  = 14                 banana curve inward depth

PX = x + w - 1 = 497       datum — RIGHT end of bar, fixed (banana curve apex)
TX = x + 1     = 469       tip   — LEFT  end of bar, fixed x, y varies with VS
```

### Banana curve (decorative right edge)

```typescript
const xCurve = (yFrac: number) => (x + w - 1) - BULGE * yFrac * yFrac;
// yFrac ∈ [−1, +1]  →  xCurve ∈ [483, 497]
// Drawn from yFrac=−1 (bottom) to yFrac=+1 (top): 40 line segments, #666, lw=1.5
```

### Scale mark Y positions (full strip height, linear)

```typescript
const yFor = (fpm: number) => mid - (fpm / MAX_VS) * halfH;
// +6000 fpm → y = mid − 160 = 137   (top of scale)
// +2000 fpm → y = mid −  53 = 244
// +1000 fpm → y = mid −  27 = 271
//     0 fpm → y = mid       = 297   (zero tick)
// −1000 fpm → y = mid +  27 = 324
// −6000 fpm → y = mid + 160 = 457   (bottom of scale)
```

### Scale marks layout

```
Labeled marks:   [6000, "6"], [2000, "2"], [1000, "1"]
Unlabeled marks: [4000, null], [500, null]

For labeled marks:
  tickX = TX + 7 = 476          tick starts 7 px right of left edge
  tick  = 476 → 481 (5 px)     #aaa, lw=1.5
  label = bold 10px #ddd, right-aligned at tickX−1=475
          → digit occupies ≈469–475 (inside strip)

For unlabeled marks:
  tickX = TX + 2 = 471
  tick  = 471 → 474 (3 px)     #aaa, lw=1
```

### VS bar

```typescript
// Right end: fixed at (PX=497, mid=297.5) — the datum
// Left end:  fixed x=TX=469, y=yFor(vc)
// At VS=0: bar is horizontal, lies on the zero tick
// As |VS| increases: bar tip rises (climb) or falls (descent), bar gets longer

if (Math.abs(vc) > 30) {
  const tipY = yFor(vc);
  // clip to strip rect — never bleeds into altitude tape
  ctx.lineCap = "round";
  ctx.strokeStyle = "#00cc00"; ctx.lineWidth = 3;
  ctx.moveTo(PX, mid); ctx.lineTo(TX, tipY);
}
```

### Readout box

```
boxX = TX + 1 = 470     inside strip, at the tip
boxW = 18, boxH = 12
boxY = clamp(tipY − 6, top+2, top+h−boxH−2)
text = Math.round(Math.abs(vc) / 100)   e.g. 2000 fpm → "20"
       bold 10px #00cc00, centered in box, black fill + green stroke
```

**At 2000 fpm:** bar goes from (497, 297.5) to (469, 244). Length ≈ 61 px.
Readout "20" at (470, 244). The readout overlays the "2" scale mark — correct.

---

## 3. Animation loop — confirmed working

File: `src/components/cockpit/pfd-mockup.tsx`, `animate()` function.

```typescript
let lerpAlt = -1, lerpSpd = -1, lerpVs = 0;   // −1 = uninitialised sentinel

// FIRST FRAME initialisation:
if (lerpAlt < 0) {
  lerpAlt = tgtAlt < 900 ? 777 : tgtAlt;   // start from ground (777 AMSL) when near ground
  lerpSpd = tgtSpd;
  lerpVs  = tgtAlt < 900 ? 0 : tgtVs;     // ramp VS from 0 on fresh takeoff
}

// SUBSEQUENT FRAMES:
lerpSpd += (tgtSpd − lerpSpd) * 0.05;
lerpVs  += (tgtVs  − lerpVs)  * 0.06;     // VS leads altitude (drives climb rate)

const vsMs   = Math.abs(lerpVs) / 60000;  // ft/ms at current animated VS
const rateMs = Math.abs(altDiff) > 200
  ? 2000 / 60000                           // large gap: cap at 2000 fpm
  : Math.max(vsMs, 50 / 60000);            // small gap: follow lerpVs, min 50 fpm
const altStep = Math.sign(altDiff) * Math.min(Math.abs(altDiff), rateMs * deltaMs);
lerpAlt += altStep;

// FREEZE: when a PF-action ring is visible AND lerpAlt has reached tgtAlt
const frozen = nowHasRing && Math.abs(altDiff) < 1;
// While frozen: lerpAlt snapped to tgtAlt; lerpVs/lerpSpd not updated
```

**Why VS leads altitude:** `lerpVs` converges ~97% within 1 second (0.06 factor,
60 fps). Altitude uses `lerpVs` as its rate, so the RA climbs gradually from
ground (0 ft) as VS builds — avoids the "shooting up" 0→50 ft jump on liftoff.

---

## 4. Radio Altimeter

```typescript
d.ra = Math.max(0, Math.round(Math.min(2500, lerpAlt - 777)));
```

- **VIDP field elevation = 777 ft AMSL** (hardcoded)
- `lerpAlt` is always in ft AMSL (same units as scenario altitude values from `buildAircraftState`)
- RA displayed on ADI in green when `d.ra < 2500`
- On ground: `lerpAlt = 777` → `d.ra = 0` ✓
- At 50 ft AGL: `lerpAlt = 827` → `d.ra = 50` ✓
- RA climbs gradually because `lerpAlt` ramps via `lerpVs` rate, not instantly

---

## 5. What to do before modifying any of these

### Modifying VS bar position / scale

1. Read §2 of this skill.
2. Confirm which constant you are changing (PX, TX, halfH, yFor, BULGE).
3. Changing `halfH` changes BOTH bar tip positions AND scale mark positions —
   always update both together.
4. Changing `PX` or `TX` changes the bar pivot/tip — also move the zero tick
   endpoints to match.

### Modifying RA behaviour

1. Read §3 and §4.
2. If changing the field elevation constant (777), search for ALL references to
   `777` in pfd-mockup.tsx — it appears in both the animation init (`lerpAlt = 777`)
   and the RA formula (`lerpAlt - 777`). Change both together.
3. If changing `lerpVs` factor (0.06), check the RA liftoff: slower factor =
   more gradual VS ramp = slower RA climb from 0. Test the 0→50 ft transition.

### Modifying altitude animation

1. Read §3.
2. The `> 200` large-gap check exists to prevent very slow catch-up when
   resuming mid-scenario. Do not remove it without a replacement.
3. The `atTarget` threshold is 1 ft. Increasing this causes the freeze logic
   to trigger early (altitude snaps before reaching exact target).

---

## 6. Scenario altitude units

`buildAircraftState()` in `pfd-nd.tsx` returns altitude in **ft AMSL**.
Ground roll at VIDP = 777 ft. Liftoff at 50 ft AGL = 827 ft AMSL.
The scenario `pfd.altitude` values (0, 50, 120 …) are AGL — but
`buildAircraftState` converts them to AMSL before returning `live.altitude`.

**Do not subtract 777 from `tgtAlt` anywhere in pfd-mockup.tsx** — it is
already AMSL when received.

---

## 7. Things that are NOT broken — do not touch without pilot sign-off

| Element | Status | Location |
|---|---|---|
| VS bar movement (left tip rises with VS) | ✓ Working | drawVS lines 737–761 |
| VS scale marks at correct heights | ✓ Working | drawVS lines 718–731 |
| VS banana curve right edge | ✓ Working | drawVS lines 701–711 |
| VS readout inside strip at tip | ✓ Working | drawVS lines 753–760 |
| RA 0→50 ft smooth liftoff | ✓ Working | animate lines 839–848 |
| Altitude freeze on PF-action ring | ✓ Working | animate lines 848–865 |
| lerpVs-driven climb rate | ✓ Working | animate lines 855–860 |
