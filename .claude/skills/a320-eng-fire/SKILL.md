---
name: a320-eng-fire
description: The canonical brain for the A320 ENG 1(2) FIRE scenario in Aviator. Use BEFORE building, editing, reviewing, or reasoning about any engine-fire scenario — the flow, the E/WD, the ECAM tree, the PFD/FMA, the procedure cards, or the ATC comms. It owns the "normal takeoff → fire → engine failure" model and the fire→failure conversion point, and it dispatches each layer to the domain skill that governs it (pfd-fma-logic, cockpit-ui, a320-fcom-trainer, training-card-ui, atc-comms, scenario-alt-logic). Read this first for engine-fire work; it composes the others, it does not replace them. Manual-first: every procedure line traces to FCOM — nothing invented.
---

# A320 ENG FIRE — scenario brain

The single entry point for **ENG 1(2) FIRE after V1** work in Aviator. It encodes the model + the correct sequence, and hands each layer to its governing skill. Live scenario: `src/scenarios/data/eng1-fire-after-v1.ts`. Vault capture + reference frames + FCOM breakdown: `Rohit-AI-Command-Center/01-KNOWLEDGE-BASES/Aviator/abnormals/captures/eng-1-fire/`.

---

## 0. THE MODEL — normal takeoff → fire → failure  (the core insight)

ENG FIRE is **not** an engine failure at rotation. It is a **normal takeoff that converts to a fire, then to a failure** at a precise point:

| Phase | Engine state | Aircraft handling |
|---|---|---|
| V1 → rotate → initial climb | Fire warning, **engine still running at T/O thrust** (symmetric) | **NORMAL takeoff.** Rotate to normal pitch / follow SRS, hold **V2+10**. **Do NOT reduce thrust** — the live engine's thrust is needed for single-engine climb, and the affected lever is not touched until the 400 ft ECAM actions. **NO beta target yet.** 12.5° is the *engine-out* pitch — it does **not** apply here. |
| **THR LEVER (affected) → IDLE** | thrust goes **asymmetric** | ⭐ **CONVERSION POINT.** Beta target appears (blue, replaces yellow sideslip); rudder toward the **live** engine ("LIVE ENG > LIVE RUDDER"); SRS recomputes → pitch settles toward **~12.5°**; FMGC engine-out logic engages → speed target = **higher of V2 / current, limited to V2+15**; MAX FL 250. |
| ENG MASTER (affected) → OFF | engine **failed / shut down** | Failure confirmed. From here the **flight handling == engine-failure handling** (same FMA/beta/single-engine model as `eng-failure-after-v1`). |

**Key rule:** the **ECAM stays fire-specific** (ENG FIRE tree + ENG SHUT DOWN block), but from THR IDLE onward the **PFD / FMA / flight dynamics are engine-failure handling.** Reuse the FAIL scenario's engine-out model at the conversion point — do not invent a parallel one.

---

## 1. Canonical sequence (phases) → governing skill

Lay every ENG FIRE scenario on this spine (FCOM PRO-ABN-ENG + Family Procedures):

| Phase | Steps | Governing skill |
|---|---|---|
| **AVIATE** (engine running, symmetric) | continue rotation (normal pitch/SRS) · positive climb → GEAR UP · AP1 + read FMA · cancel MASTER WARN | `pfd-fma-logic` · `scenario-alt-logic` |
| **ECAM ACTIONS @ 400 ft** | THR LEVER 1 IDLE ⭐ · ENG 1 MASTER OFF · ENG 1 FIRE P/B PUSH · cancel MASTER CAUT · AGENT 1 (after 10 s) · AGENT 2 (if fire 30 s) · ENGINE SECURED | `a320-fcom-trainer` (procedure) · `cockpit-ui` (E/WD render) · `eng-params` (engine numbers) |
| **MAINTAIN DIRECTION** (single-engine, from THR IDLE) | rudder to centre β · rudder trim (1°/sec, ~15-18°) · AP recommended · reset trim before thrust reduction | `pfd-fma-logic` (beta/FMA) |
| **COMMUNICATE** | LAND ASAP announce · MAYDAY ×3 | `atc-comms` |
| **ACCEL / CLEAN** | V/S 0 @ MAA (level 1500) · flaps on schedule · green dot → PULL ALT (OP CLB) · **LVR MCT → MCT** · TCAS → TA | `pfd-fma-logic` · `scenario-alt-logic` |
| **ECAM → STATUS** | secondary failures (`* HYD/* ELEC/* AIR BLEED`) · STATUS announce · STOP ECAM · After T/O C/L · OEB · read STATUS | `a320-fcom-trainer` |

Cards for every non-hardware step: `training-card-ui`. Comms cards + phraseology: `atc-comms`.
**Engine numbers** (what N1/EGT/N2/FF/thrust each engine shows — symmetric at the fire, the
failed-engine spool-down at THR IDLE → windmill at MASTER OFF, live engine → MCT): `eng-params`.
The fire is **not** an EGT/N1 exceedance — params stay symmetric until thrust is pulled.

**Generic ECAM spine (adapt, don't invent).** ENG FIRE is the same 6-phase FCOM flow as every
abnormal — only the values differ. The reusable spine (DETECTION → ECAM ACTIONS → SYSTEM DISPLAYS →
STATUS → SITUATION ASSESSMENT/DECISION → SYNTHESIS), the warning-level→severity map, the
confirm-before-ACTION and confirm-before-CLEAR grammars, the **WARD** approach briefing/prep, and
the STATUS/QRH logic live in the vault: `Aviator/abnormals/ecam-procedure-card-model.md`
(sourced from the Airbus ECAM Philosophy + Bond ECAM lecture + airline SOP + airbusdriver callouts).
Read it before authoring prep/briefing/CLEAR/comms cards. **Prep + briefing cards follow WARD, SIZED
to the items** (Weather · Automation/FMC-prep · Report/briefing incl. approach+go-around · Descent/CL) —
not a fixed count. SD-memo lines are FCOM-revision/config dependent (X BLEED SHUT vs FUEL X FEED OPEN):
see the capture's cross-source variation table — SME-gated. [2026-07-12]

---

## 2. Layer → skill map (what activates when you touch ENG FIRE)

- **E/WD engine gauges + ECAM tree render** → `cockpit-ui` (+ `a320-fcom-trainer` ref `ecam-logic-mapping.md` for primary-boxed/secondary-star, L1/L2, LAND ASAP, INOP SYS).
- **ECAM procedure content / verbs / sequence / tasksharing** → `a320-fcom-trainer` (manual-first, nine inputs).
- **PFD / FMA / beta target / speed-target / pitch / single-engine dynamics** → `pfd-fma-logic` (+ `pfd-instruments` for the locked VS/RA/alt baseline).
- **Altitude gating (400 ft, MAA), step↔ATC interlock, panel-vs-ATC priority** → `scenario-alt-logic`.
- **Procedure / flight-check cards (four-corner)** → `training-card-ui`.
- **ATC cards, MAYDAY, phraseology, comms direction** → `atc-comms`.
- **3D FIRE / ENG START panels** → `blender-panels` / `blender-panels-to-web`.

---

## 3. E/WD & ECAM behaviour (the fire display — already corrected, keep it so)

- Engine is **EPR-rated (IAE) in the reference frames**; sim currently CFM/N1 (open EPR-vs-N1 decision). Config **1+F** takeoff.
- **Fire ≠ failure on the gauges:** at fire warning only **EGT is red**; N1/N2/FF stay **normal** (green). They degrade only after THR IDLE / MASTER OFF. Never show the engine dead at fire onset.
- **Failure title `ENG 1 FIRE` = red, UNDERLINED, NOT boxed** (per frames `fire-01/02`). Applies to all primary titles.
- **Actions right-justified** with an auto-filling dot leader: `THR LEVER 1 …… IDLE` etc. FCOM verbs verbatim.
- **8-line fire tree must fit** (no overflow arrow): title + 5 actions + `IF FIRE AFTER 30 S:` + AGENT 2. Gauges capped ~58% to leave room.
- **Secondary failures** `* HYD / * ELEC / * AIR BLEED` (from ENG 1(2) SHUT DOWN, PRO-ABN-ENG P72) below LAND ASAP; **LAND ASAP red → amber** when fire out.
- **ENG SHUT DOWN follow-on** (in sim, locked to the ENG 2 teaching-video memo): ENG MODE SEL IGN · IF NO FUEL LEAK · IMBALANCE MONITOR · **TCAS → TA** · AVOID ICING + STATUS/INOP SYS. **X BLEED SHUT is conditional** (only if the crossbleed is open — config-dependent, not modelled) so it's omitted, not invented; **WING ANTI ICE** is a STATUS/INOP item, not an SD action line. [user 2026-07-11]

---

## 4. Sources (never invent — trace to these)

- **FCOM:** ENG 1(2) FIRE (IN FLIGHT) `[PRO-ABN-ENG P40 / L94604–94643]`; ENG 1(2) SHUT DOWN `[P71–74 / L96040–96200]`. Grep `~/.claude/manuals/a320/fcom-full.txt`.
- **Desktop libraries:** `~/Desktop/Airbus/` (FCTM, A320 Emergencies, Call-Outs) · `~/Desktop/A320 OBS/` (A320-SOP, **A320 Family Procedures — Capt VH Ram**, Abnormal/Emergency, QRH). The Family Procedures doc has the fullest CRM/callout ENG FIRE sequence.
- **Vault capture** (transcripts + FCOM breakdown + reference frames): `abnormals/captures/eng-1-fire/`.
- **CRM confirm rule** `[Family]`: Thrust levers = **PF** (retard only after PNF confirms); Master = **PNF** (cut only after PF confirms).

---

## 5. Build state + what's next (as of 2026-07-10, LOCAL/uncommitted)

**DONE & verified:** E/WD corrected (fire≠failure gauges, 1+F, underlined-not-boxed title, right-justified
actions, 8-line fit) · **β-target ported** (`AircraftState.beta`, `beta: thrIdle` — cyan when thrust
reduced/THR IDLE, OFF during fire warning; `#slipTrap` in svg-pfd) · **MAINTAIN DIRECTION step** added ·
**all 34 non-hardware cards tagged** (`eng1-fire-card-overrides.ts`, applied in runner).

**NEXT (when the user says "go"):**
1. **PFD VS moving-pivot** — port the GMAP/`pivAt`/`goalPivot`/mirror/ease logic from `displays/PFD-CURRENT.html`
   into svg-pfd's `drawVS` (still fixed pivot). **BLOCKER:** pivot coords `P0/P400/P700` live only in browser
   `localStorage['pfdPivots5']` → must be captured + baked into [[displays/PFD]] first. Verify app vs PFD-CURRENT.
2. **ATC interlock** (§7) — extend the action-panel > ATC suppression to the fire panel; upgrade the
   to-and-fro comms to G+Y quality (climb-out MAYDAY→Departure atomic loop + read-back→FCU; return leg = G+Y).
3. **Card cleanup** to the G+Y clean standard (§6).
4. **ENG SHUT DOWN follow-on block** to the ECAM (§3): ENG MODE SEL IGN · IF NO FUEL LEAK · IMBALANCE MONITOR · TCAS→TA · AVOID ICING (no X BLEED / WING ANTI ICE — see §1).
5. Phase expansion: takeoff → climb → cruise (currently after-V1 climb-out only).

---

## 6. Card standard — MATCH DUAL HYD G+Y (the gold reference)

Every non-hardware step gets `category` + `reference` + `crew`, four-corner (`training-card-ui`). G+Y is the
exact target — copy its conventions, don't reinvent.
- **Reference tokens (clean):** `FCOM` · `FCTM` · `QRH` · `TECHNIQUE` (+ `FCTM · TECHNIQUE`, `QRH · TECHNIQUE`).
  Manual tag ONLY if the item is really in that manual (manual-first), else `TECHNIQUE`.
- **Category tokens:** `ECAM` · `COMMS` · `AVIATE` · `PROCEDURE` · `CRM` · `CRM · COMMS` · `QRH` · `CHECKLIST` ·
  `GLARESHIELD` · `NAVIGATE` (pairs join ` · `).
- **Hint = terse FCOM-style STEPS** — dotted-leader `ITEM......ACTION` or one `PM: '…'`/`PF: '…'` line each.
- **Colours:** alert severity = card colour (warning RED / caution AMBER, mirrors E/WD) · category on the pill
  only · doer green `#3AD63A` / monitor grey `#7D8794` · hardware ECAM action lines (PTU/pumps) BLUE ·
  irreversible hardware (MASTER OFF, FIRE PB) RED · MASTER CAUT = amber GLARESHIELD badge only.
- **❌ NEVER in a card (G+Y has zero):** `DRAFT`/`SME` flags · inline citations (`[fcom:L…]`, `[fctm:…]`) ·
  prose paragraphs · meta ("crew understanding") · changing card CONTENT to fit the design. Rationale → INFO tab.

## 7. ATC interlock — MATCH G+Y (runner.tsx ATC promotion, scenario-alt-logic + atc-comms)

Promote an ATC card ONLY when ALL hold:
1. **ATOMIC** — one exchange runs to completion (`atcPhase === "idle"`); the next queues, never preempts (a
   lower-altitude request waits behind a running changeover).
2. **ACTION PANEL > ATC** — no ATC surfaces while an action panel is popped. G+Y covers HYD + GPWS panels;
   **ENG FIRE must extend it to the fire panel: suppress while `four_hundred_ft_cmd` done AND `engine_secured`
   not yet** (fire ECAM drill in progress). Currently NOT wired → the gap to close.
3. **POST-ANSWER COOLDOWN** before the next call.
4. **ALTITUDE-GATED** — `atAltitudeBelowFt` + `requiresStep`; for ENG FIRE the crossings are CLIMBING
   (400 ft, MAA) then descending on the return.
5. **COMMS ⇄ INSTRUMENT loop (bidirectional)** — IN: cleared request → read-back → FCU/FMC action (FMA moves on
   the action, not the request). OUT: instrument state drives a call (check-in reads the LIVE tape "passing [ALT]").
6. **Direction colour** (atc-comms): INBOUND (ATC→crew) green · OUTBOUND (crew→ATC) blue. MAYDAY×3 on the
   current freq only; changeover Tower→Departure on climb, and the return mirrors G+Y (Approach→Tower).

---

**MAIN RULES (always):** manual-first (nothing invented — trace to FCOM/FCTM/QRH); **verify a port/repro against
its REFERENCE, never "done" from a pointer** ([[feedback_verify_against_reference_not_proxy]]); one system per
task; assessment before code (`a320-fcom-trainer` §0/§7); after any `.ts` change `npx tsc --noEmit` + drive it in
the runner + mirror the vault capture. The working loop: reference (Obsidian/frames/FCOM) → build → cross-check
against the reference → fix.
