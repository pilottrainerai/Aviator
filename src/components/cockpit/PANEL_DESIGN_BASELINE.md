# A320 Overhead Panel — Design Baseline

This document is the **canonical spec** for the ENG 1 FIRE panel built in
[engine-fire-panel-mockup.tsx](./engine-fire-panel-mockup.tsx).  All new
overhead panels (HYD, ELEC, BLEED, FUEL, etc.) should reuse the same
values, patterns and interaction logic unless FCOM says otherwise.

When you change a number here, change it in the code too — and vice
versa.  This file is the source of truth for visual identity.

---

## 1. Panel container

| Property | Value | Notes |
|---|---|---|
| Width | `470 px` (single section) | Scale up for multi-section panels |
| Height | `420 px` | Standard section height |
| Background | `linear-gradient(180deg, #75B5C5 0%, #5A98A8 100%)` | Light desaturated cyan-teal base |
| Border | `1 px solid #1D1818` | Dark hairline frame |
| Border radius | `0.75 rem` (`rounded-xl`) | |
| Box-shadow | `inset 0 0 25px rgba(0,0,0,0.45), 0 0 30px rgba(0,0,0,0.5)` | Inset depth + outer drop |
| Corner screws | 4 × 12 px circles at `(12,12)`, `(panelW − 24, 12)`, `(12, panelH − 24)`, `(panelW − 24, panelH − 24)` | Two-tone radial `#c8ced6 → #2a303a` |
| Section title | `monospace, fontSize 24 px, letterSpacing 3 px, fontWeight 700, #f3f4f6` at `top: 105` | Title sits just below where AGENT pbs start |
| Vertical side marker | `FIRE` letters stacked top-down via `writing-mode: vertical-lr` + `text-orientation: upright` | `monospace, 16 px, letterSpacing 2 px, white` |
| Side white bar | 4-px wide × 65 px tall white bar at `left: 44, top: 145` | Sits flush against the FIRE letters' left edge |

---

## 2. Push button — large guarded (FIRE-style)

The plastic-bodied, hinged-cover pb used for FIRE / APU FIRE / similar
guarded master-action buttons.

### 2.1 Dimensions

| Property | Value |
|---|---|
| Width × height | `131 × 87 px` |
| Border radius | `10 px` |
| Position | absolute, centred in section (`left: 50%, top: 50%` with `translate(-50%, -50%)`) |
| Push-out lift | `translateY(-4 px)` while `firePbOut === true` |

### 2.2 Colours

| State | Body gradient | Border | Box shadow |
|---|---|---|---|
| Rest | `#A85A55 → #9A4E49 → #7A3835` (dusky burgundy) | `4 px solid #5A2A28` | `inset 0 1px 0 rgba(255,220,210,0.35), inset 0 -3px 6px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.55)` |
| Fire / TEST (`fireLightLit`) | `#FF2828 → #E81010 → #C80000` (bright red) | `4 px solid #FF6060` | `0 0 36px rgba(255,30,30,0.95), inset 0 0 18px rgba(255,80,80,0.45), inset 0 -8px 16px rgba(0,0,0,0.65)` |

### 2.3 Legend text

| Text | fontSize | letterSpacing | Position | Rest colour | Lit colour |
|---|---|---|---|---|---|
| `FIRE` | `22 px` | `0.06 em` | `top: 22, centred X` | `#5A0808` | `#FFFFFF` + glow |
| `PUSH` | `11 px` | `0.14 em` | `bottom: 14, centred X` | `#5A0808` | `#FFFFFF` + glow |
| Font | `"Helvetica Neue", Arial, sans-serif`, `fontWeight 700–800` | | | | |

### 2.4 Extra decorations (lit state)

- **4 corner red dots** at `top/bottom: 6, left/right: 6`, `6 × 6 px`, `#ff4040` with `0 0 8px rgba(255,80,80,0.95)` glow.
- **Amber OUT indicator dot** at `top: 6, right: 6`, `8 × 8 px`, `#FFB300` with `0 0 6 px rgba(255,179,0,0.85)` — shown when `firePbOut && !fireLightLit` (mechanically out, no fire light).

### 2.5 Interaction logic (FCOM two-step)

```
Tap 1  →  guardOpen = true   (wire-frame guard rotates open)
Tap 2  →  firePbOut = true   (pb releases mechanically)
once firePbOut, button is disabled
```

Click handler:
```ts
if (firePbOut) return;
if (!guardOpen) onOpenGuard();
else            onPush();
```

### 2.6 Wire-frame guard cover

Built as a transparent acrylic cover that rotates open like a hinged
door.  See section 3.

---

## 3. Guard cover (`GuardCover`)

### 3.1 Layer hierarchy (bottom → top in render order)

1. `OUTER_GUARD` frame fill (dark-red, `fill-rule: evenodd`)
2. `OUTER_GUARD` stroke (`#AE3816` — Figma "Guard" colour)
3. `INNER_GUARD` rectangle stroke
4. `OVAL_GAP` (transparent cut-out, panel shows through)
5. `GLASS_HIGHLIGHT` (top reflection line)
6. `JOINT` (separate static SVG, does NOT rotate)

### 3.2 Geometry (Figma-traced, exact)

```
NEW OUTER path (viewBox 135 × 112):
  M0.5 88.5
  V3 Q0.5 0.5 3 0.5
  H131 Q133.5 0.5 134 3
  L134.5 88.5
  H95.5 L75.5 111.5
  Q68.75 113.5 62 111.5
  L59.5 109 L50 98.5 L41.5 88.5
  H0.5 Z
```

- Main rect: `0.5 → 134.5` × `0.5 → 88.5`
- Tab on bottom centre, thumb-grip shape with curved tip
- Top corners: 2.5-px Q curves (subtle softening)

```
INNER GUARD: rect at (12, 17), 110 × 66 (height bumped 20 %)
OVAL GAP:    ellipse at (67.5, 100), rx 7, ry 3.5
JOINT:       rect at (40.5, 0.5), 54 × 14, filled #1D1818
             + inner light-gray rect 80 % size, fill #A8A7A6
```

### 3.3 Colours

| Element | Stroke / fill |
|---|---|
| OUTER stroke | `#AE3816`, `1.5 px` |
| OUTER frame fill | `rgba(174, 56, 22, 0.92)` (with `evenodd`) |
| INNER stroke | `rgba(92, 10, 10, 0.95)`, `0.75 px` |
| OVAL GAP stroke | `#1D1818`, `1 px`, transparent fill |
| GLASS HIGHLIGHT | `rgba(255, 160, 160, 0.28)`, `1 px` horizontal line at `y 8` |
| JOINT fill (outer) | `#1D1818` |
| JOINT fill (inner mech, 80 % of outer) | `#A8A7A6` |

### 3.4 Open/close animation

```
0°    = closed (cover over pb)
-120° = open (cover rotated up + back)
transformOrigin: PIVOT_X_PX 67.5px, PIVOT_Y_PX 0.5px (JOINT top edge)
transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1)
backfaceVisibility: visible    // so the cover stays rendered past 90°
perspective on wrapper: 300 px
```

`guardLifted = guardOpen || firePbOut`.

---

## 4. Indicator push button (SQUIB / DISCH-style)

The two-cell rectangular pb used for AGENT 1, AGENT 2, AGENT APU, etc.

### 4.1 Dimensions

| Property | Value |
|---|---|
| Width × height | `50 × 56 px` |
| Padding (between cells and bezel) | `3 px` |
| Cell gap | `2 px` (`gap: 2` on the flex container) |
| Cell border-radius | `3 px` |
| Border (always) | `1.5 px solid #3a4252` |
| Border-radius (bezel) | `4 px` |

### 4.2 Outline halo (popped-button silhouette)

```
outline:         2 px solid #FFFFFF
outline-offset:  2 px
box-shadow:      inset 0 0 4 px rgba(0,0,0,0.55),
                 0 0 0 2 px rgba(20,28,38,0.95),    // dark shadow ring in the gap
                 0 1 px 2 px rgba(0,0,0,0.5)
```

The `0 0 0 2 px rgba(20,28,38,0.95)` ring fills the 2-px gap between the
pb body and the white outline so it reads as a recessed shadow, not as
panel cyan.

### 4.3 Cell text rules

| Cell | Colour at rest | Colour lit | Colour arming |
|---|---|---|---|
| SQUIB | `#3a4252` (dim) | `#e8ecf4` (white) + `0 0 4 px #e8ecf4` glow | `#FFB300` (amber) + `0 0 3 px rgba(255,179,0,0.7)` glow |
| DISCH | `#3a4252` (dim) | `#ffb300` (amber) + `0 0 4 px #ffb300` glow | n/a |

Cell BACKGROUND stays `#06080c` (near-black) in **all** states — per the
"only letters light up, not around them" rule.  Layout is preserved via
`visibility: hidden` on the SQUIB span when its agent has been actually
discharged (so SQUIB letters disappear after AGENT press).

### 4.4 Below the pb — label

```
fontSize: 11 px
letterSpacing: 0.08 em
fontWeight: 700
font: '"Helvetica Neue", Arial, sans-serif'
color: text-gray-200
marginBottom: 2 px (very tight to the cell)
```

### 4.5 FCOM state logic (per AGENT)

```
armed      = firePbOut || testActive             // SQUIB white
discharged = thisAgentDisch || testActive        // DISCH amber
actuallyDisch = thisAgentDisch                   // hide SQUIB letters

SquibCell.armed       = armed && !actuallyDisch
SquibCell.discharged  = actuallyDisch            // visibility:hidden
Indicator.lit (DISCH) = discharged
```

**Sequence:**
1. Rest: SQUIB dim, DISCH dim.
2. TEST: SQUIB white + DISCH amber (both visible; `actuallyDisch` stays
   `false`).
3. FIRE pb released: SQUIB white on every AGENT of the section.
4. Press AGENT N → that AGENT's SQUIB letters **disappear** + its DISCH
   lights amber.  Other AGENTs unaffected.

### 4.6 Clickability gate

```
clickable = firePbOut && (Date.now() - firePbOutAt >= ARM_DELAY_MS)
            && !thisAgentDisch
ARM_DELAY_MS = 10_000   // FCOM "AGENT 1 AFTER 10 S → DISCH"
```

---

## 5. Round push button (TEST-style)

Small circular pb that does **not** illuminate when pressed.

| Property | Value |
|---|---|
| Diameter | `26 × 26 px` (~25 % of FIRE pb width) |
| Background | `#000000` |
| Border | `none` |
| Centre dot | `6 × 6 px` `#FFFFFF`, `border-radius: 50%`, ~20 % of pb diameter |
| Box-shadow | `0 1 px 2 px rgba(0,0,0,0.5)` |
| Label | `TEST` above the pb, 11 px sans-serif, letterSpacing 0.14 em, `text-gray-300` |
| Position | `testSide`: `"left"`, `"center"`, `"right"` — anchored under the AGENT pb on the same side; APU sections use `"center"` |

---

## 6. Typography master list

| Use | Family | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Section title (ENG 1 / APU) | `monospace` | `24 px` | 700 | `3 px` |
| FIRE legend on pb | `"Helvetica Neue", Arial, sans-serif` | `22 px` | 800 | `0.06 em` |
| PUSH sub-legend on pb | same sans-serif | `11 px` | 700 | `0.14 em` |
| AGENT label (above pb) | same sans-serif | `11 px` | 700 | `0.08 em` |
| SQUIB / DISCH cells | same sans-serif | `9 px` | 800 | `0.06 em` / `0.08 em` |
| TEST label | same sans-serif | `11 px` | 700 | `0.14 em` |
| Vertical FIRE side marker | `monospace` | `16 px` | 700 | `2 px` |

---

## 7. Colour master list

| Role | Hex | Where |
|---|---|---|
| Panel base (gradient top) | `#75B5C5` | container background |
| Panel base (gradient bottom) | `#5A98A8` | container background |
| Panel frame stroke | `#1D1818` | container border |
| FIRE pb rest body | `#A85A55 → #9A4E49 → #7A3835` | gradient on pb body |
| FIRE pb rest border | `#5A2A28` | pb border |
| FIRE pb lit body | `#FF2828 → #E81010 → #C80000` | gradient when fire/test |
| FIRE pb lit border | `#FF6060` | border when fire/test |
| FIRE legend rest | `#5A0808` | text |
| FIRE legend lit | `#FFFFFF` | text |
| Guard outer stroke / fill | `#AE3816` / `rgba(174,56,22,0.92)` | wire-frame cover |
| Guard inner stroke | `rgba(92,10,10,0.95)` | inner pane border |
| JOINT outer | `#1D1818` | hinge bar |
| JOINT inner mech | `#A8A7A6` | hinge mechanism (80 % inset) |
| OVAL GAP stroke | `#1D1818` | cutout outline |
| AGENT pb body | `#1e2430` | bezel |
| AGENT pb border | `#3a4252` | bezel border |
| AGENT outline halo | `#FFFFFF` (2 px @ 2 px offset) | popped-button white |
| AGENT shadow ring | `rgba(20,28,38,0.95)` (2 px) | recessed gap |
| Cell background (always) | `#06080c` | SQUIB / DISCH cell background |
| Cell text dim | `#3a4252` | SQUIB / DISCH at rest |
| SQUIB lit | `#e8ecf4` | SQUIB armed (white) |
| SQUIB arming | `#FFB300` | SQUIB during 10-s pulse |
| DISCH lit | `#ffb300` | DISCH discharged (amber) |
| TEST pb body | `#000000` | TEST circle |
| TEST centre dot | `#FFFFFF` | TEST inner dot |

---

## 8. Animations / keyframes

```css
@keyframes agent-arming-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
@keyframes test-pulse {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}
```

Used on SQUIB during the FCOM 10-s arming window (text amber, pulsing).

---

## 9. State model

```ts
type EngFire = {
  fireDetected: boolean;
  guardOpen:    boolean;      // pilot has lifted the wire-frame cover
  firePbOut:    boolean;      // pb has been released
  firePbOutAt:  number | null;// timestamp ms (for 10-s arming gate)
  agent1Disch:  boolean;
  agent2Disch:  boolean;
  testActive:   boolean;
};
```

```ts
type ApuFire = {
  fireDetected: boolean;
  guardOpen:    boolean;
  firePbOut:    boolean;
  firePbOutAt:  number | null;
  agentDisch:   boolean;       // APU has a single AGENT
  testActive:   boolean;
};
```

Per-engine derived flags inside `FireSection`:

```ts
const fireLightLit = fireDetected || testActive;
const a1Arming     = firePbOutAt !== null && elapsed <  10_000 && !agent1Disch;
const a1Armed      = firePbOutAt !== null && elapsed >= 10_000 && !agent1Disch;
```

---

## 10. FCOM references

| Behaviour | FCOM section |
|---|---|
| ENG 1(2) FIRE pb function | DSC-26-20-20 |
| AGENT pb-sw function | DSC-26-20-20 |
| FIRE TEST pb function | DSC-26-20-20 |
| Visual element placement (PFD/ND/ECAM) | DSC-31-* |

Verbatim FCOM bullets stored in
`~/.claude/manuals/a320/fcom-full.txt`; greppable.

---

## 11. Reuse — building a new panel

To create a new overhead panel (e.g. ELEC), reuse the patterns:

1. **Section container** — copy the panel container in
   `EngineFirePanel` (gradient, frame, corner screws, top section
   title, vertical side marker).  Swap colours / labels per FCOM
   chapter (e.g. `ELEC` if needed).
2. **Push-buttons** — re-use `FirePushbutton`, `AgentPanel`,
   `SquibCell`, `Indicator`, `GuardCover` components.  When the new
   panel needs a different pb (e.g. flat momentary), follow the
   colour / typography rules from sections 2–7 of this doc.
3. **State model** — mirror the `EngFire` / `ApuFire` shape per system.
   Keep `xxxDetected / xxxPbOut / xxxPbOutAt / testActive` and any
   discharge or fault flags.
4. **FCOM cross-check** — grep `~/.claude/manuals/a320/fcom-full.txt`
   for the panel's `DSC-XX-YY` section before changing any indicator
   colour, blink rate, or sequence.

---

## 12. Change log of this doc

| Date | Change | Author |
|---|---|---|
| 2026-05-12 | Initial baseline from the ENG 1 FIRE single-section panel | Claude |
