---
name: scenario-alt-logic
description: The altitude-driven FLOW GOVERNOR for Aviator A320 scenarios. Use BEFORE wiring or editing how a scenario's LIVE altitude gates ATC cards + procedure steps + action-panel state — altitude triggers (`atAltitudeBelowFt`), the runner's altitude→step / branch effects in runner.tsx, request→clearance→read-back→FMU-action chains, conditional branches (vectors vs hold), pause-until-altitude, panel-state gates, and step↔ATC sequencing. It owns the INTERLOCK; atc-comms owns card content, pfd-fma-logic owns PFD values, pfd-instruments is the locked lerp.
---

# Scenario ALT Logic Skill

You are working on **Aviator** — a precision A320 abnormal-procedure training tool.
This skill governs the **orchestration**: how a scenario's **live (animated) altitude**
gates and sequences the **ATC cards**, the **procedure steps**, the **PFD target**, and the
**action-panel** state so the whole flow stays operationally coherent — the conductor that
sits above `atc-comms` (card content) and `pfd-fma-logic` (PFD values).

**Claude's own knowledge is NOT a valid source for procedure/ATC/PFD content** — that comes
from FCOM/FCTM/ICAO via the sibling skills. This skill owns the *wiring*: gates, triggers,
branches, and the cross-surface interlock.

---

## 0. Hard rules (non-negotiable)

1. **The LIVE LERPED altitude is the clock — never the FCU target.** Altitude gates and the
   `[ALT]` token read `liveAltRef.current` (runner.tsx, fed by `pfd-mockup` `onAltitude` = the
   animated tape value). `buildAircraftState(...).altitude` is the **FCU/selected target**, not
   the live value. Using the target for gating or `[ALT]` is the classic bug (check-in read
   "passing 10000" instead of the real ~14 000). [Fixed 2026-06-30, runner.tsx ~1034.]
2. **Content stays in its owner skill.** ATC phraseology/labels → `atc-comms`. PFD values/FMA
   modes/laws → `pfd-fma-logic`. PFD lerp/RA/VS geometry is LOCKED → `pfd-instruments`. This
   skill only wires WHEN/HOW they fire and interlock. Touching content → load that skill first.
3. **Level-offs are ALTITUDE CAPTURE, never a checklist step.** A descent TARGET changes on a
   step (an ATC clearance read-back or a crew FCU action); the level-off itself is
   `altArmed → ALT* → ALT` proximity capture in `pfd-fma-logic`. Never force VS=0 / a level
   from a procedure step (the FMC-prep-forces-7000 bug).
4. **Dev-seek is not the live flow.** The Inspector "SEEK SCENARIO TO HERE" marks steps in
   ARRAY order (`steps.slice(0, sel+1)`); it does NOT replay ATC cards or animate the lerp.
   So anything altitude-decided (branches, `[ALT]`, the PFD target) is only correct on a real
   play-through. Place runtime-decided gate steps AFTER their logical predecessors in the array.
5. **One scenario / one altitude rule per task.** Never "fix all the gates" — name one.
6. **No code before "go" (§7).** Produce the gate/flow plan first; wait for approval.
7. **When the altitude rule and the card/step placement conflict, stop and surface it.**
   (e.g. "branch on the approach CHECKLIST at 10 500, but the checklist is at 7 000 → it can
   never be true → always-hold. Move the checklist to 10 000, or accept always-hold?")
8. **Sequence-enforcing, never-freezing.** This is a TRAINING module — gates exist to TEACH the
   correct order, so cards fire IN SEQUENCE, not in parallel (do not call the flow "independent").
   But the flow must NEVER freeze on a gate. The only deferral is **STANDBY**: it collapses a card
   and **resurfaces** it (`standbyResurfaceMs` / `standbyResurfaceOnStep`) — a required call is
   deferred, never dropped, and must come again.
9. **The comms ⇄ instrument loop is mandatory and bidirectional.** IN: every cleared request ends
   in a **read-back → an instrument-action card** (FCU/PFD/ND) — the FMA/target moves on the action,
   not the request (mech 4). OUT: an instrument STATE drives a call — the check-in reads the **live
   tape** ("passing [ALT]"), the "established" report follows **GS/LOC capture**. Never leave a
   clearance without its action card, or a capture/level without its report.
10. **An ATC exchange is an ATOMIC LOOP — it runs to completion before any other call starts.** A full
   exchange (e.g. changeover: ATC "contact [station] [freq]" → crew read-back + check-in with passing
   altitude → new station acknowledges) is ONE unit. A trigger that fires mid-loop — **including an
   altitude gate** (mech 1) or the vectors/hold **decision snapshot** (mech 3) — must **QUEUE behind the
   running loop, never preempt it**. Altitude/event triggers decide *eligibility*, not *preemption*: the
   branch may be decided silently at its altitude, but the resulting **request card is held until the live
   exchange finishes**. (Bug 2026-07-01: the 12 500 vectors/hold branch fired its request mid-changeover
   and superseded the in-progress check-in/ack loop.) Mechanically: the ATC queue must not promote a new
   set while a multi-card exchange is still mid-loop — treat changeover→check-in→ack as one indivisible set.
11. **A comms/consequence card is GATED ON a physical state — it NEVER DRIVES it.** The physical PFD
    state (descending, stopped) is set by a **physical / live-signal gate** (touchdown at ≤50 ft; full-stop
    when `liveSpeedRef ≤ 5` after touchdown — mech 10), and cards that *report* that state (the "landed
    and stopped" taxi call) `require` the gate. Never OR a comms card into the physical predicate
    (`stopped = touched_down || request_taxi_to_stand` let a prematurely-available card collapse the PFD
    to 0 kt while still airborne — fixed 2026-07-04). Direction is one-way: state → card, never card →
    state. A "must happen after speed = 0 / after the aircraft is X" request → a live-signal gate, not a
    card requirement that opens earlier in the chain.

---

## 1. The model — three surfaces, one clock

```
            ┌───────────── completedSteps  +  liveAltRef.current (live tape) ─────────────┐
            │                                                                              │
   ATC cards (distractions)      Procedure steps              PFD (buildAircraftState)
   gated by requiresStep +       gated by requires[] +        reads completedSteps → target
   atAltitudeBelowFt             runner altitude effects      + altArmed capture (pfd-fma-logic)
   (atc-comms = content)         (a320-fcom-trainer = content)(pfd-fma-logic = values)
            │                                                                              │
            └────────── action panel (fire-panel.tsx) pops/retracts on completedSteps ─────┘
```

The **live altitude** (`liveAltRef`) and **`completedSteps`** are the shared state. Every gate
is a predicate over those two. This skill defines the gate predicates and the order they fire.

**`liveAltRef`** (runner.tsx ~386, init 35 000): set by `onAltitude={(ft)=>liveAltRef.current=ft}`
(~816/845) from the PFD's lerped tape. Read in the distraction loop (~397) and the altitude
effects (~410–429). It LAGS the FCU target on a dev-seek; it is correct in a real play-through.

---

## 2. The gating-mechanism catalogue (the primitives we built)

| # | Mechanism | Where | Use |
|---|---|---|---|
| 1 | **Altitude-gated ATC card** | `atAltitudeBelowFt: N` on a distraction; runner ~397 `if (liveAltRef.current > N) continue` | fire a call passing N ft (AND `requiresStep`) |
| 2 | **Silent altitude→step milestone** | runner `useEffect` keyed on `elapsedMs`, guarded by a `firedXRef`: when `liveAltRef ≤ N` & precondition step done → `perform({kind:"STEP", stepId})` | unlock a step (and everything after it) at an altitude, no card. e.g. `at_hold_7000` (≤7 600 → approach CL) |
| 3 | **Conditional branch (altitude snapshot)** | same effect, but picks ONE of two mutually-exclusive steps from a condition at the crossing | vectors-vs-hold: at ≤10 500, `approach_cl_hyd done ? prep_ready : prep_late`; each gates its own card pair |
| 4 | **Request → clearance → read-back → ACTION** | crew card `completesStep:req` → ATC card `requiresStep:req, completesStep:cleared` → visible **FCU/PFD card** (`action:""`, `requiresStep:cleared`, `completesStep:` the PFD-driver step) | the FMA/target changes on the crew's FCU action AFTER the read-back, not on the request. e.g. A3→A4→`cleared_10000` (FCU SELECT 10 000) |
| 5 | **Path-specific milestone** | each request card completes its OWN step (`vectors_requested` / `holdpattern_requested`) so each clearance follows only its request | mutually-exclusive branches that converge (both clearances → `hold_cleared`) |
| 6 | **Pause-until-altitude** | downstream step/ATC requires an altitude milestone (mech 2) | "don't run the approach CL / its ATC until 7 000" |
| 7 | **Panel-state gate** | derive a flag from `completedSteps` (`ecamPanelActive = ecam_actions && !(all 4 pumps)`) and branch the PFD on it | hold FL200 while the ECAM action panel is popped; only descend to 10 000 once it retracts |
| 8 | **Step-after-ATC (last-call)** | a procedure step `requires` a hidden step that an ATC card `completesStep` | sequence a crew action after a radio exchange. e.g. P21 `fmgc_prep` requires `intentions_acked` (completed by the diversion-ack A13) |
| 9 | **5-second cadence** | `gapAfterMs: 5_000` per card; runner default 5 000 (was 15 000) | request → reply / next call in ~5 s |
| 10 | **Live-signal physical gate** | PFD emits a live value (`onAltitude`→`liveAltRef`, `onSpeed`→`liveSpeedRef`); runner `useEffect` + `firedXRef`: when precondition step done & `liveSignal ≤ N` → `perform({STEP})` | complete a PHYSICAL milestone from the animated value, then gate comms/steps on it (rule 11). e.g. `full_stop` = `touched_down` && `liveSpeedRef ≤ 5` → the taxi call requires it. Same shape as mech 2 but on speed (or any exposed signal), not only altitude |

**Card/step NUMBERING (so you match the user's "P21 / A13"):**
- **P#** = index in `scenario.steps.filter(s => !s.hardware && !s.optional)` + 1 (runner.tsx ~1063). Hardware (pushbuttons/levers) and hidden gate steps are EXCLUDED.
- **A#** = index in `scenario.distractions` + 1 (sequential array order).
Always recompute from the live file before referencing a number — adding a card renumbers.

---

## 3. The pattern library (composed mechanisms — proven on DUAL HYD G+Y)

- **Continuous-descent ATC spine.** Each cleared altitude is an alt-gated crew request → ATC
  clearance → read-back → FCU card. Passing 22 000 → descend 10 000 (mech 1+4); 15 000 →
  changeover + check-in (mech 1, `[ALT]` = live); 12 000/10 500 → branch (mech 3).
- **Vectors-vs-hold at a decision altitude.** Snapshot "is the readiness step done?" at ≤10 500
  (mech 3) → `prep_ready` (long-vectors path: request/clearance) OR `prep_late` (hold path).
  Both clearances → `hold_cleared` → the PFD 10 000→7 000 descent. **Reachability check (rule 7):
  the snapshot step MUST be completable before the decision altitude, else one branch is dead.**
- **Approach platform.** OP DES on a HEADING → **level off at 3 700 (ALT, VS 0)** (capture) →
  configure FLAP 3 → **gravity gear BEFORE GS/LOC** (ALT·HDG, DIRECT, USE MAN PITCH TRIM) →
  **GS/LOC capture** then descend the 3° slope (ROD = GS × 5.3) → landing CL → touchdown at
  field elevation, **speed → 0** at the full stop.
- **Dynamic ATC frequency.** A `[STATION]` token resolves Control vs Approach from the live
  altitude (≤15 000 → Approach) at render (distraction-modal). Comms-content; coordinate w/ atc-comms.
- **Don't read config/time to ATC** (the "Mumbai rule", atc-comms): no holding TIME in a
  clearance, no "landing checklist complete", no FLAP/gear method on frequency.

### 3.1 The five rule-family catalogues (scenario-agnostic "if X → then Y")

**(A) ALTITUDE-TRIGGER catalogue.** A descending abnormal fires a fixed ladder; each rung is
mech 1/2/3 against the LIVE tape:
- intermediate cleared alt (e.g. 22 000) → **crew requests** the next descent (→ clearance ladder, fam E).
- changeover alt (e.g. 15 000) → **changeover + check-in** (fam B).
- decision alt (e.g. 10 500) → **readiness branch** (fam D + the vectors/hold split).
- platform alt (e.g. 7 000 / 3 700) → **level-off (capture) + the gated checklist/config** (fam C/D).
- field elevation → **touchdown, speed → 0**.
Each threshold is a *descending* crossing (`liveAltRef ≤ N`); never gate on the FCU target.

**(B) CHANGEOVER catalogue.** A frequency handoff = a two-card set, gated `(passing N) AND
(prior phase complete)`:
1. outgoing controller: **"contact [next] [freq]"** → crew reads back the freq.
2. crew check-in on the new freq: **"[next], [callsign], MAYDAY, passing [live ALT], [cleared/req]."**
The chain is **Control → Approach(radar) → Tower**; Tower handoff fires **after GS/LOC capture**
(established). Controlling agency = `f(changeover state)` → the **`[STATION]` token** (atc-comms).
Never check in before the changeover; never read config on check-in (Mumbai rule).

**(C) GS/LOC INTERCEPT ladder.** The ILS is a strict sequence, each step a PFD state (pfd-fma-logic):
1. **ALT + HDG** level at the platform (vectored) — localizer NOT yet captured.
2. **configure** (FLAP 3, decel VAPP) — still ALT + HDG.
3. **gravity gear DOWN** — *before* GS/LOC capture → **DIRECT law → USE MAN PITCH TRIM**.
4. **LOC then G/S captured** → **"established"** report (fam E, OUT).
5. descend the **3° slope: ROD = ground-speed × 5.3** (geometry, not a magic number); decel to VREF.
6. **touchdown at field elevation; speed → 0** at the full stop.
Only descend once on the glideslope — at the platform it is **ALT, VS 0**, never OP DES.

**(D) CHECKLIST-GATING catalogue.** Checklists are **altitude/config-gated, never time-gated**:
- a checklist gates on a **readiness milestone** (briefing done) and is **doable from that point on**.
- **approach checklist:** doable after the briefing → if done by the **decision alt (10 500) → vectors**,
  else done **in the hold at 7 000**. (This is *why* the snapshot step must be completable before
  the decision alt — rule 7; fixed 2026-06-30: `approach_cl_hyd` requires `approach_brief_ga`, not 7 000.)
- **landing checklist:** after **gear DOWN + established** (G/S · LOC).

**(E) PROCEDURE ↔ ATC SEQUENCING catalogue (the comms ⇄ instrument loop, rule 9).** Two directions:
- **IN — execute the clearance:** a crew FCU/FMC action follows the **read-back/ack**, not the request.
  (FCU 10 000 after the descent clearance; FMC prep after the diversion ack — P21 after A13.) [mech 4/8]
- **OUT — report the state:** an ATC report follows a crew/instrument milestone — **check-in** after the
  changeover (reads the live tape); **stabilised/established** after GS/LOC capture. [mech 9]
Sequence is **enforced** (training); a deferral is **STANDBY → resurface**; the flow never freezes (rule 8).

---

## 4. The canonical DUAL HYD G+Y "Trainer ALT logic" (the worked reference)

| Altitude / phase | Procedure | ATC | PFD |
|---|---|---|---|
| FL350 failure | MASTER WARN → AVIATE → NAV → COMM | MAYDAY (crew) → ack | ALT CRZ → ALTN |
| FL200, **ECAM panel popped** | ECAM actions (pumps) | — | **HOLD FL200** (mech 7) |
| passing 22 000 | — | PM **request** 10 000 → ATC **clears** → read-back → **FCU 10 000 card** | FL200 → 10 000 (after panel retracts) |
| passing 15 000 | (ECAM complete) | changeover Approach + check-in **passing [live ALT]** | descending 10 000 |
| ~10 500 **snapshot** | — | prep done → **long vectors**; not → **hold** (mech 3) | level 10 000 |
| passing 12 000 | — | the chosen request → clearance → `hold_cleared` | → 7 000 hold |
| ~7 500 | — | (gate) | level 7 000 (hold speed **210**) |
| at 7 000 (mech 2) | **APPROACH CL** unlocks (+ all ATC after it) | | |
| approach cleared | descend 3 700 | crew **requests** approach → ATC clears (descend 3 700) | OP DES HDG → **level 3 700 ALT** |
| 3 700 | configure FLAP 3 → **gravity gear** | — | ALT·HDG; gear → DIRECT (USE MAN PITCH TRIM) |
| GS/LOC | established (after gs_intercept) | stabilised report → tower changeover → cleared land | **G/S·LOC**, ROD = GS×5.3 |
| touchdown / stop | landing CL → taxi | cleared to land → taxi req | field elev (~39 ft), **speed → 0** |

---

## 5. Source / file map

| Concern | File |
|---|---|
| altitude gating + runner effects (mech 1,2,3,8,9) | `src/app/train/[slug]/runner.tsx` (liveAltRef, distraction loop, `at_hold_7000`/`prep_*` effects, gap default) |
| `[ALT]`/`[STATION]` substitution | `src/components/cockpit/distraction-modal.tsx` |
| PFD target + capture (mech 7 reads completedSteps) | `src/components/cockpit/pfd-nd.tsx` `buildAircraftState` |
| action-panel pop/retract | `src/components/cockpit/fire-panel.tsx` |
| the scenario wiring | `src/scenarios/data/<slug>.ts` (steps `requires`, distractions `requiresStep`/`atAltitudeBelowFt`/`completesStep`) |

```bash
grep -n "liveAltRef\|atAltitudeBelowFt\|firedHoldGateRef\|firedPrepGateRef" src/app/train/\[slug\]/runner.tsx
# P# numbering: steps.filter(!hardware && !optional); A# = distractions index
```

---

## 6. Trigger phrases & the reusable mechanism

- **"go"** — approve the gate/flow plan, proceed.
- **"Add altitude trigger <x>"** — wire mech 1/2 at a named altitude.
- **"Branch on <condition> at <alt>"** — wire mech 3.
- **"Sequence <step> after <ATC card>"** — wire mech 8.
- **"new flow"** — restart from the gate plan.

**Apply-everywhere:** when the developer states an altitude/sequence rule ("passing N, request
M"; "X only after Y"), capture it as ONE gate using the §2 catalogue and wire it through the
shared `liveAltRef` + `completedSteps` — same primitive reused across scenarios, never re-invented.

---

## 7. Anti-patterns

- ❌ Gating or `[ALT]` off `buildAircraftState().altitude` (the FCU target) instead of `liveAltRef`.
- ❌ Forcing a level-off / VS=0 from a checklist step (use altitude capture, rule 3).
- ❌ A conditional branch whose snapshot step can't be done before the decision altitude (dead path, rule 7).
- ❌ A clearance card with no path-specific request milestone → both clearances fire (mech 5).
- ❌ A runtime-decided gate step placed EARLY in the array → dev-seek marks it (rule 4).
- ❌ Writing ATC phraseology / PFD values here — that's `atc-comms` / `pfd-fma-logic`.
- ❌ Editing the lerp/RA/VS geometry (`pfd-instruments`, LOCKED).
- ❌ Long ATC gaps (>5 s) or reading time/config to ATC.
- ❌ "Wire all the altitudes" — one rule per task.
- ❌ ORing a comms card into a physical predicate (`stopped = … || <card>`) — it drives state early (rule 11).
- ❌ Gating an "after speed/state X" call on a card that opens earlier in the chain, instead of a live-signal gate (mech 10).

---

## 8. Examples log (self-improving)

### [2026-06-30] Skill created — seeded from the DUAL HYD G+Y altitude/ATC/procedure session
- Catalogued the 9 gating primitives (§2) and 4 patterns (§3) built across 2026-06-28…30:
  continuous-descent spine, vectors-vs-hold snapshot at 10 500, the approach platform (level
  3 700 → gear-before-GS → 3° glide → speed-0 stop), `[STATION]` dynamic freq.
- Fixed the master bug: `[ALT]`/gates must read `liveAltRef` (live tape), not the FCU target
  (runner.tsx ~1034 `liveAltFt={liveAltRef.current}`).
- Documented P#/A# numbering (P = non-hardware non-optional index; A = distraction index).
- RESOLVED (per rule 7): the vectors path was dead because the branch snapshots `approach_cl_hyd`
  while the checklist was gated at 7 000 (never done by 10 500 → always hold). Fix: `approach_cl_hyd`
  now requires `approach_brief_ga` (doable after the briefing). Prompt crew finishes it by 10 500 →
  **vectors**; slow crew → **hold at 7 000** (and runs it there). `at_hold_7000` is now vestigial.
- Added §3.1 — the five rule-family catalogues (altitude-trigger · changeover · GS/LOC ladder ·
  checklist-gating · procedure↔ATC sequencing). + rules 8 (sequence-enforcing/STANDBY) & 9 (comms⇄loop).
- Boundary fixed vs `atc-comms` (content), `pfd-fma-logic` (PFD values), `pfd-instruments` (LOCKED).

### [2026-07-04] Live-signal physical gate (mech 10) + rule 11 (state → card, one-way)
- Added mech 10: a PFD-emitted live value drives a physical milestone step, then comms/steps gate on it.
  Added `onSpeed`→`liveSpeedRef` to the SVG PFD (alongside `onAltitude`); new `full_stop` gate =
  `touched_down` && `liveSpeedRef ≤ 5`. `request_taxi_to_stand` now `requires:["ldg_clearance_done","full_stop"]`.
- Fixed two coupled end-of-flight bugs: REQUEST TAXI appeared before landing (only required
  `ldg_clearance_done`, which completes on short final); and `stopped = touched_down || request_taxi_to_stand`
  let that early card force the PFD to full-stop (speed→0, FMA blank) while airborne. Rule 11 codifies the
  fix: physical state is set by a live-signal/physical gate; comms cards are gated on it, never drive it.
- Pairs with `pfd-fma-logic` §5c G5 (this owns the gate WIRING; that owns the VALUES). The altitude-driven
  transition governor itself (VS capture, band scoping, seamless handoff) is locked in `pfd-fma-logic` §5c.

### [2026-07-06] Abnormal-approach descent profile — reusable rules (V/S leg · idle decel · action-driven range)
Codified from the DUAL HYD G+Y redesign (all LOCAL, tsc-clean). **Reuse for G+B and any type's abnormal approach.**
- **Descent = physics, not round numbers.** Idle descent ROD = `TAS · sin(γ) · 101.3` with γ ≈ 3–3.6°
  (`≈1/(L/D)` minus idle thrust) → 250 kt ≈ 1 700 fpm. V/S time = Δalt / V/S; track = GS · time. Size the
  legs from these (e.g. 7 000→5 000 @ V/S −1000 = 2 min ≈ 8.5 NM), don't eyeball.
- **V/S mode for small altitude changes** (small thrust): a V/S SHALLOWER than the idle-path ROD leaves
  surplus drag → the aircraft DECELERATES as it descends. Use a shallow V/S leg to arrive at green dot.
  The card drops "OPEN DES", says "V/S", and states the technique. FMA shows the V/S value (`pfd-fma-logic`).
- **ACTION-DRIVEN RANGE ("horizontal DME"):** on a descent, range/DME = f(alt); on a LEVEL segment the
  alt-map can't close range, so drive the DME (and thus the G/S diamond) off the crew ACTION progression —
  flaps close the DECELERATION miles, then the gravity GEAR closes its OWN miles. **Allocate the level
  segment as DECEL-miles + GEAR-miles separately** (the gravity gear needs time BEFORE the glide — that is
  NOT decel time). Compute in `pfd-nd` (it sees the steps); `pfd-fma-logic` owns the DME→gsDev math.
- **Speed schedule steps down with the FLAP lever** (SPD SEL = VFE-next−5), and CONFIGURE holds VAPP (don't
  let a later phase re-accelerate above the config target — that made the gear card read a stale high speed).
- **ECAM callout order/labels:** secondary-failure clearing follows the SD-page order (…WHEEL, F/CTL);
  CLR cards read **CONFIRM** (announce → confirm → clear); the BARO minimum appears at approach-prep (MDA set).

- **ECAM STATUS overflow (FCOM DSC-31-20 §8):** when the INOP SYS list runs past the page a green **↓**
  arrow appears; "the flight crew can press the **CLR** pb, in order to scroll the display to view the
  overflow." Model it as a SEPARATE **CONFIRM** card: page 1 shows the max systems that fit + the ↓
  arrow; on confirm, the panel shows ONLY the leftover (overflowed) systems and the arrow DISAPPEARS
  (do NOT flip it to the opposite side — the user rejected the ↑). One constant sets the page-1 count.
- **Remove the STATUS page when the review is DONE:** the SD reverts to BLANK once ECAM ACTIONS
  COMPLETED (don't leave STATUS up for the rest of the flight). Sequence: system synoptic → STATUS → blank.
- **Every "clear"/page-check card uses CONFIRM** (announce → confirm → clear callout), and the page-check
  cards drop redundant "CHECK" wording (label = the page, the CONFIRM button is the action). Reviewing a
  secondary-failure SD page CONFIRMs its card → CLEAR_ECAM removes its `*`-memo from the E/WD (WHEEL then F/CTL).
