---
name: action-panel-layout
description: The rules for how the 3D cockpit panels (FIRE panel, THROTTLE, ENG START) lay out and behave in the scenario ACTION PANEL — both the compressed INLINE view and the popped-out view. Use BEFORE editing anything about action-panel layout, the DevMovable frames, which panels show/where, the inline↔popped logic, thrust-lever start position or throw, ENG MASTER / thr-lever click wiring, the fire-pushbutton red lighting, transparent backgrounds, or the dev-edit / export / bake-layout workflow. It exists so the panel layout never regresses again. It owns LAYOUT + PANEL BEHAVIOUR only — NOT the system-display (SD) pages (fuel/ENG/HYD SD are handled separately). Manual-first for FCOM values still applies via cockpit-ui / a320-eng-fire.
---

# Action-Panel Layout Skill

The action panel is the 3rd cell of the scenario runner's cockpit grid. During
ENG 1 FIRE it hosts three 3D panels — **FIRE** (`FireTestPanel3D`), **THROTTLE**
(`Throttle3D`), **ENG START** (`EngStartPanel3D`) — arranged with the
`DevMovable` layout system. This skill is the brain for that arrangement and the
panels' scenario behaviour. Read it before touching any of it.

Owning file: `src/components/cockpit/fire-panel.tsx` → **`DslControlPanel`**.
Panel components: `throttle-3d.tsx`, `eng-start-panel-3d.tsx`, `fire-test-panel-3d.tsx`.
Combined-pedestal helpers: `pedestal-stack-3d.tsx` (2-canvas stack), `pedestal-one-3d.tsx` (single-scene join — NOT used in the scenario).

---

## §0 HARD RULES (never break these — each cost real debugging time)

1. **`fill` is REQUIRED on any DevMovable whose child is a 3D `<Canvas>`.**
   A canvas child is `position:absolute; inset:0` and has **no intrinsic size**.
   Without `fill`, DevMovable measures the child's natural size → gets ~0 → the
   panel renders at zero size = **invisible** ("the panel is nowhere"). The FIRE
   panel worked and the added THROTTLE/ENG-START didn't — that was the only
   difference. Every 3D panel frame: `<DevMovable fill relative editMode={edit} …>`.

2. **INLINE and POPPED use SEPARATE DevMovable ids.** `inline_fire / inline_throttle
   / inline_engstart` vs `combo_panel3d / combo_throttle3 / combo_engstart3`. They
   persist independently so arranging one never disturbs the other. Never share ids
   across the two views.

3. **Do NOT add React hooks to `ThrottleScene` (or any component that calls
   `useThree`) to fix animation/state.** `useThree` uses `useSyncExternalStore`;
   adding a hook triggers a Fast-Refresh failure — `Cannot read properties of null
   (reading 'getSnapshot')` — that only clears on a full reload and looks like a
   real crash. Do lever/init work inside the existing `useMemo`, not new hooks.

4. **Content-pan (`fireDevContent.<id>`) only applies to NON-fill (2D) controls.**
   All our 3D panels are `fill`, so their exported `content` cx/cy values are
   saved-but-unused. When baking a layout, IGNORE `content` for fill panels.

5. **Don't reconstruct a panel's look by hand.** Reuse the real component + the
   `/dev/pedestal-3d` prop set (below). Hand-rolled percentage layouts drift and
   overlap. Import the panel; don't re-lay-it-out from memory.

6. **SD / system-display pages are OUT OF SCOPE here** (fuel/ENG/HYD SD). This
   skill is action-panel layout + panel behaviour only.

7. **The author cannot see the browser.** Framing/placement is verified by the
   USER via screenshots and the dev sliders. Provide controls; don't guess pixel
   positions blind. When a value must be seen to be right, expose it as a dev slider.

---

## §1 Inline vs Popped (the two states)

`DslControlPanel` returns one of two layouts:

```
const popped = USE_NEW_FIRE_PANEL && ((edit && poppedPreview) || (ecamActionsStarted && !retracted));
if (popped) return <…popped combo…>;   // floating, big
return <…inline…>;                      // compressed, in the grid cell
```

- **INLINE** (compressed) — before the pop-out; what trainees see pre-ECAM-actions.
  A `position:relative` container holding `inline_fire`, `inline_throttle`,
  `inline_engstart` DevMovables.
- **POPPED** — rises when the PF commands ECAM ACTIONS (`ecamActionsStarted`), or
  in dev when `poppedPreview` is on. One `combo_outer` (`container`) DevMovable
  holds `combo_panel3d` (fire) + `combo_throttle3` + `combo_engstart3`, all `relative`.
- **`poppedPreview`** (dev toggle, "Editing: POPPED / INLINE") decides which layout
  edit mode shows, so BOTH can be edited. Persisted `fireDevPoppedPreview`.
- Live/trainee: `edit` is forced off, so `popped` is purely ECAM-driven and no dev
  chrome shows.

---

## §2 DevMovable rules

- Frame = `<DevMovable id label fill relative editMode={edit} def={{x,y,w,h}}>`.
  `container` on the outer frame (combo_outer) gives its `relative` children a
  positioning context.
- **Position source order:** localStorage `DEV_BOX_PREFIX+id` first, else `def`.
  So changing a `def` does NOT move a box the user already dragged — bump the id or
  hit **Reset layout** to force the new def.
- **All edit chrome is `editMode`-gated:** the label + `W×H` numbers, dashed border,
  body scrim, move bar, resize handles. Edit OFF ⇒ clean panel. Trainees never see it.
- Negative x / off-frame positions are legitimate (user pushes a panel partly past
  the container edge on purpose). Don't "correct" them.

---

## §3 The panels — canonical prop sets

**THROTTLE** — reuse the `/dev/pedestal-3d` look (do not invent framing):
```
<Throttle3D bg="transparent" controlled viewDir={[0,0.985,0.173]} zoom={1.0}
  tune={THROTTLE_TUNE_DEFAULT} showTrimWheels tiltX={10} tiltY={0}
  lever1Deg={isDone("thr_lever_idle") ? 0 : 36} lever2Deg={36}
  onThrLever={() => performStep("thr_lever_idle")} />
```
**ENG START:**
```
<EngStartPanel3D controlled bg="transparent" tune={engTune}
  fires={[fp3dFireDetected,false]} masters={[!isDone("eng1_master_off"),true]} mode={1}
  onToggleMaster={(i)=>{ if(i===0) performStep("eng1_master_off"); }} />
```
**FIRE:**
```
<FireTestPanel3D bg="transparent" controlled framing="all" panX/panY/zoom={view3d…}
  fireDetected={fp3dFireDetected} fireSections={[fp3dFireDetected,false,false]}
  firePbDone={…} agent1Disch/agent2Disch onPushFirePb/onPushAgent1/onPushAgent2 />
```

- **`bg="transparent"`** on all three → panels float with no black box. For them to
  read on black (not the page), the CONTAINER carries the dark backing.
- **Combined pedestal:** the scenario uses **two separate canvases** (`Throttle3D` +
  `EngStartPanel3D`, the `/dev/pedestal-3d` approach), NOT `PedestalOne3D` (a single
  3D-scene join). PedestalOne3D looked different because its camera/lighting weren't
  matched — leave it for the `/dev/pedestal-one` page.

### §3a Thrust levers
- **Start at TOGA (36°).** FMA is MAN TOGA at takeoff.
- **Only the affected engine retards:** `lever1Deg` (ENG 1) = `0` when
  `thr_lever_idle` is done, else `36`; **`lever2Deg` (ENG 2) is fixed `36`** and
  never moves. TLV1=ENG1 (lower world-X), TLV2=ENG2.
- **No jump on mount/pop-out:** lever pivots are pre-set to their target in
  `ThrottleScene`'s `useMemo` (`pivot.rotation.x = degToRad(-(i===0?lever1Deg:lever2Deg))`),
  so a fresh mount shows them already thrown. `useFrame` then lerps only on changes.
  (This is why §0.3 matters — the snap must live in useMemo, not a new hook.)
- Reverse lever is set directly in a `useEffect` (no lerp).
- Click either lever → `onThrLever` → the THR-LVR step. Wired via the primitive's
  `onClick`, walking parents to find `TLV1_pivot`/`TLV2_pivot`.

### §3b ENG MASTER
- `masters={[!isDone("eng1_master_off"), true]}` — ENG 1 driven by the step, ENG 2 ON.
- Click ENG 1 master → `onToggleMaster(0)` → `performStep("eng1_master_off")`.

### §3c FIRE pushbuttons — per-section red
- **`fireSections` = per-section fire `[ENG1, APU, ENG2]`.** When provided, ONLY
  those sections light red. The ENG 1 scenario passes `[true,false,false]` → only
  ENG 1 FIRE pb is red. **`fireDetected` alone lights ALL three** — that's the
  dev/test page behaviour; never use it alone in the scenario.
- **`framing="all"`** fits the whole 3-section panel and scales on resize (fitMargin
  1.02 = tight fill). `framing="eng1"` anchors the left edge and grows right only —
  it cuts the left when you shrink it; don't use it in the movable action panel.

---

## §4 Dev-edit → export → bake workflow

1. Dev bar (bottom-left, `SHOW_LAYOUT_EDITOR`): **Edit ON/OFF**, **Editing:
   POPPED/INLINE**, **Export layout**, **Reset layout**.
2. Arrange each view: Edit ON, pick POPPED or INLINE, drag bars / resize edges.
3. **Export layout** copies JSON to clipboard + a "paste this to Claude" prompt.
   The author has NO other way to see the layout — the user pastes the JSON.
4. **Bake** = write the exported boxes into code so they ship without dev mode:
   - `VIEW_DEFAULT` ← `view` (fire panel pan/zoom).
   - `COMBO_OUTER`, `COMBO_INNER.panel3d` ← the popped outer + fire boxes.
   - literal `def` on `combo_throttle3` / `combo_engstart3` ← popped throttle/eng.
   - literal `def` on `inline_fire` / `inline_throttle` / `inline_engstart` ← inline boxes.
   - **IGNORE** `content` (fill panels) and the stale `engstart_panel` key.
   - Baking only changes fresh-session/production defaults; a browser with saved
     localStorage still shows the user's own values (localStorage wins).

---

## §5 Anti-patterns (things that already went wrong)

- ❌ 3D panel DevMovable without `fill` → invisible. (§0.1)
- ❌ Sharing ids between inline and popped → layouts clobber each other. (§0.2)
- ❌ Adding a hook to a `useThree` component → Fast-Refresh `getSnapshot` crash. (§0.3)
- ❌ Baking `content` cx/cy for fill panels → no effect, misleading. (§0.4)
- ❌ Hand-rebuilding the pedestal with percentages instead of importing the component. (§0.5)
- ❌ `fireDetected` alone in the scenario → all three FIRE pbs red; use `fireSections`. (§3c)
- ❌ `framing="eng1"` in the movable panel → left gets cut on resize; use `"all"`. (§3c)
- ❌ Both thrust levers moving to idle → only the affected engine's lever retards. (§3a)
- ❌ Levers animating up from 0 on pop-out → pre-set pivots in useMemo. (§3a)
- ❌ Editing SD pages here → out of scope. (§0.6)

---

## §6 Where things live

| Thing | Location |
|---|---|
| Action-panel branches, popped/inline, dev bar, baked defaults | `fire-panel.tsx` → `DslControlPanel` |
| Throttle scene + levers + snap-in-useMemo + `bg`/`onThrLever` | `throttle-3d.tsx` |
| ENG START panel + `bg`/`onToggleMaster` | `eng-start-panel-3d.tsx` |
| FIRE panel + `framing` + `fireSections` + `bg` | `fire-test-panel-3d.tsx` |
| 2-canvas pedestal helper (reads tuned localStorage) | `pedestal-stack-3d.tsx` |
| Dev tuning pages | `/dev/pedestal-3d`, `/dev/pedestal-one`, `/dev/throttle-3d` |

Vault mirror: `Aviator/wiki/action-panel-layout.md`.
