---
name: atc-comms
description: ATC communication skill for the Aviator A320 trainer. Use BEFORE adding or editing any ATC distraction cards, `atc_notify` steps, MAYDAY/PAN PAN steps, or frequency-change sequences in any scenario `.ts` file. The skill enforces ICAO phraseology, correct MAYDAY vs PAN PAN classification, and a consistent distraction-card structure across all procedures.
---

# ATC Comms Skill

You are working on **Aviator** — a precision A320 abnormal-procedure training tool.
Every ATC distraction card, choice label, and crew callout must match ICAO Doc 9432
phraseology and the procedure-specific FCOM ATC NOTIFY timing.

**Claude's own knowledge of "what ATC says" is NOT a valid source.
Only ICAO Doc 9432 (via `icao-phraseology.txt`), FCOM `PRO-ABN-ABN-00`, and
the verified ENG1 FIRE reference implementation count.**

---

## 0. Hard rules (non-negotiable)

1. **STARTING PHASE first, then the inputs.** Determine the scenario's starting
   phase (§0a) before anything; then collect all §1 inputs. No distraction JSON,
   no step change, no choice label until both are done.
2. **MAYDAY vs PAN PAN must be determined from FCOM, not judgment.**
   Check `abnormal-procs.txt` LAND ASAP color for the procedure.
   RED LAND ASAP → MAYDAY. AMBER LAND ASAP → PAN PAN.
   If LAND ASAP is absent → PAN PAN unless FCOM explicitly states MAYDAY.
3. **No invented choice labels.** Every `label:` string must trace to
   ICAO Doc 9432 format or `callouts.txt`. Mark gaps `simulation-placeholder`.
4. **Trigger step must be sourced from the procedure's `.ts` file.**
   The gate step (what `requiresStep` points to) must be an existing step id.
   Do not invent a new gate step — use what is already there.
5. **Sequence is fixed.** Cards follow the standard sequence in §4.
   Do not reorder without a FCOM or user-stated reason.
6. **No code before "go".** Produce the card plan first. Wait for approval.
7. **One procedure per task.** Do not accept "do all procedures" — name one.
8. **When in difficulty, stop and discuss.** Format:
   "I'm stuck on [X]. Options: [A / B / C]. Which do you want?"
9. **No standby option in kind:"crew" cards.** A kind:"crew" card tests what
   the crew says on a deliberate, crew-initiated call — the only choices are
   correct and wrong versions of that call. Never offer "standby" as an option
   on a crew card. Standby options belong only on kind:"atc" cards where the
   crew may correctly defer an ATC query while the checklist is running.
10. **Never read the aircraft configuration or technique to ATC** [user-input
    2026-06-23 — the "Mumbai rule"]. Crew→ATC calls carry intentions (divert +
    runway), a concise emergency-services request, and stabilised/established/
    cleared read-backs ONLY. Never recite the approach/landing config or method
    on frequency ("establish ILS", "gear gravity", "FLAP 3", "VAPP+25", brake /
    anti-skid / NWS status). The configuration lives in the crew's internal
    briefing, not on the ATC frequency.
11. **Comms is gated on the procedure milestone before it (§0b).** Every exchange
    fires only after the step/trigger that logically precedes it — it is a
    *fallout* of reaching that point. Use `requiresStep`; never time-gate a call
    that depends on a crew action.
12. **To sequence a step AFTER a whole ATC chain, use a last-call gate.** Add a
    hidden `optional` step that the FINAL ATC card completes (`completesStep`),
    then have the downstream procedure step `requires` it (e.g. REQUEST TAXI
    gated on `ldg_clearance_done`, completed by the cleared-to-land call)
    [user-input 2026-06-23].

---

## 0a. Starting phase determines the opening (determine FIRST)

Identify the scenario's **starting phase** before building any card — it sets the
entire opening sequence:

- **TAKEOFF** (ENG 1(2) FIRE / FAILURE — after V1): Tower→Departure handoff,
  STANDBY while ECAM runs, declaration gated at **400 ft / engine-secured**.
- **CRUISE** (DUAL HYD G+Y and similar enroute failures): **no check-in / handoff.**
  The **PILOT INITIATES** the declaration (`kind:"crew"`) as the FIRST contact —
  MAYDAY/PAN PAN call → **ATC acknowledges** (`kind:"atc"`) → **crew reads back**.
  **No procedure card is shown while the call is live.** Descent unlocks only
  after the read-back.
- **DESCENT / APPROACH (failure discovered already descending — e.g. tomorrow's
  scenario):** SAME opener as cruise — the **PILOT INITIATES** the MAYDAY/PAN PAN
  declaration as the FIRST contact, from the current descent/approach frequency.
  A crew-discovered emergency ALWAYS opens with the pilot's declaration, never
  with an ATC call — only the frequency differs from the cruise case. After the
  declaration → ATC ack → read-back, reuse the shared descent/approach templates
  (descend-lower → weather → hold → approach → tower → landing).

---

## 0b. The model — ATC comms is a phase-gated to-and-fro

ATC communication is a sequence of **sets**, each tagged to a **phase** and gated
on the procedure milestone before it (the comms are a *fallout* of reaching that
step — use `requiresStep`, never time-gate a call that depends on a crew action).

### The set — two shapes, decided by who opens it

WHO OPENS THE SET IS DETERMINED BY THE PHASE (§0a). Identify the phase first.

- **Pilot-initiated set — 3 parts.** crew request/declare (carries altitude +
  navigation) → **ATC approves / instructs** → **crew reads back.** The read-back
  closes the set. Opener is `kind:"crew"` (no standby option, §0 rule 9).
- **ATC-initiated set — 2 parts.** ATC instructs or asks → **crew reads back.**
  That is the end of it — no third part. Opener is `kind:"atc"` (may allow a
  correct STANDBY while the checklist runs).

A crew-discovered failure (cruise OR already descending) → the crew opens with the
declaration. A frequency handoff or an ATC query → ATC opens.

### Two hard gates on the crew→ATC *information* sets

1. **Nothing but a lower level until the ECAM actions are complete.** During the
   immediate-action phase the only crew request is "descend lower." NO weather, NO
   intentions, NO diversion talk while actions are still running.
2. **Major / dual failures (G+Y, G+B, EMER ELEC): read the CRUISE part of the
   summary FIRST.** The crew reads the cruise portion of the QRH/ECAM summary
   (`qrh_summary_gy` or equivalent) BEFORE the weather request. Weather is the
   crew's FIRST call once actions are complete and that summary is read.
3. **Never read the configuration to ATC (§0 rule 10).** Intentions, ready-calls,
   and position reports carry divert + runway + a concise services request ONLY —
   never FLAP 3 / gear gravity / VAPP+25 / brake / anti-skid / NWS method.

### The phases run in sequence; each phase owns its sets

Build the phase map FIRST, then write cards onto it. Generalized progression
(enroute/descent failure; takeoff/climb opening differs per §0a):

| Phase | Enters when | Sets, in order | Opener |
|---|---|---|---|
| CRUISE / DESCENT (start) | the failure | MAYDAY/PAN PAN: nature + altitude + nav request → ATC approves descent/offset → read back | crew (3) |
|  |  | assistance offered → STANDBY · vectors offered → "continuing checklist" | ATC (2) |
| DESCENT | control regained | request clearance to descend lower → ATC clears → read back — nothing else here | crew (3) |
| ACTIONS COMPLETE / CRUISE SUMMARY READ | ECAM done & cruise summary read (`qrh_summary_gy`) | weather request → ATC delivers → read back | crew (3) |
| DECISION | landing perf + FORDEC (`fordec_hyd`) | inform intentions (divert + runway, NO config) → ATC | crew |
| HOLD | intentions passed, before FMC prep | request hold → ATC clears (fix / alt / two-minute legs) → read back | crew (3) |
| FMC PREP | holding | POB + endurance query → answer | ATC (2) |
| APPROACH | FMC prep done | ready for approach → ATC clears approach → read back · emergency services request | crew (3) |
| ESTABLISHED | gear down / stabilised | stabilised & established reports (NO config) · radar → TOWER changeover | crew report + ATC handoff |
| LANDING | on Tower | cleared to land → read back · (last) request taxi / tow | ATC then crew |

Holding marks the entry to the approach phase. The descent set is ONLY
"request to descend lower"; never collapse weather/intentions into it.

### Takeoff / initial-climb opening (engine-fire family — different from enroute)

On takeoff the crew is ALREADY on Tower and must **AVIATE FIRST**. The *opening*
differs from the cruise/descent case; after it, the flow **MERGES into the
generalized progression above** — from CLIMB onward the crew, "when ready," asks
for holding, weather, POB, approach, etc. — the SAME sets as the enroute case.

| Step | Set | Opener | Gate |
|---|---|---|---|
| V1 cut → rotate, positive climb, gear up | **no radio** — fly the aircraft first | — | — |
| Tower hands off / queries while ECAM runs | ATC **2-part** → crew answers **STANDBY** (defer; ECAM not done) | ATC | `atc_handoff_to_departure` |
| MAYDAY on Tower (current freq) | crew **3-part**: MAYDAY (nature + heading + climbing alt + STANDBY) → Tower ACK + handover → read back freq | crew | **`four_hundred_ft_cmd` / `engine_secured`** |
| Switch to Departure, position report | crew: heading + climbing + STANDBY → Departure confirms + vectors | crew | after declaration |

Two things unique to takeoff: (1) the declaration is **gated at 400 ft / engine
secured** — STANDBY is the *correct* answer to anything ATC says before that;
(2) there is a **Tower → Departure handoff** before the return sequence (in cruise
the crew is already with the enroute controller). Full 9-card sequence in §4;
reference implementation `eng1-fire-after-v1.ts` (§9 [2026-06-09]).

### Gated = fallout. Worked example — DUAL HYD G+Y:

| Procedure milestone (gate) | ATC set it unlocks |
|---|---|
| aircraft under control (cruise) | MAYDAY declaration + offset/descent read-back |
| cruise summary read (`qrh_summary_gy`) | weather request/delivery |
| ECAM complete (`crew_crosscheck`) | hold request + clearance |
| landing performance → **FORDEC** (`fordec_hyd`) | inform intentions · request emergency services |
| approach checklist (`approach_cl_hyd`) | ready for approach · cleared approach |
| gear down / landing CL | stabilised · established · Tower · cleared to land |
| full stop + all ATC done (last-call gate) | request tow / taxi (after ARFF) |

---

## 0c. The ENGINE — how ATC comms are wired (read before building; codified 2026-07-12)

Full write-up: vault `abnormals/atc-comms-sequencing-logic.md`. The non-negotiable rules:

1. **ATC comms live in the DISTRACTION layer, NOT as procedure step-cards.** Two layers:
   `scenario.steps[]` = the procedure checklist (the spine); `scenario.distractions[]` = the live
   ATC/crew R/T (the voice). Never build an ATC exchange as a step-card — that was the #1 mistake.
2. **Link radio ↔ card** by `requiresStep` (radio waits for a card) and `completesStep` (a correct
   readback unlocks a — often hidden — milestone the next card/radio needs). Milestone keys like
   `wx_received` / `ready_for_approach` / `approach_clearance_rcvd` exist ONLY as `completesStep`
   gates, not as step-cards.
3. **Card-gated, NOT time-based.** `atMs` is a *minimum delay after the gating card completes*
   (~5 s realistic R/T), never a free clock. `gapAfterMs` cools down before the next call surfaces.
   The queue is serial (one ATC card at a time). A card must not fire until the prior exchange resolves.
4. **Every ATC card is a proper to-and-fro — no acknowledge-only cards.** Crew-opened exchange =
   3-part (`pilotSays` crew call → ATC `message` → readback `choices`, one correct). ATC-opened =
   2-part (ATC `message` → crew `choices`). EVERY card has `choices` (3, one correct) — never
   `choices: []`. A clearance is READ BACK, never "acknowledged."
5. **Real R/T only** — Roger / hold approved / cleared / wilco. The word "acknowledged" is banned.
6. **Frequency handoff chain**: Tower → Departure → Approach → Tower(landing), each once. The
   Departure→Approach handoff fires **when the crew declares intentions** (fold it into the intention
   response: "…approved, expect ILS __, contact Approach 1__._"). Pre-handoff exchanges (weather, POB,
   intention) are on the CURRENT frequency (Departure); post-handoff (ready/cleared approach,
   emergency services) are Approach; landing is Tower. Weather = with Departure (or ATIS), not Approach.
7. **Don't print instructions or visible state on a card.** "FMC prep follows in parallel", "state the
   requirement not a fire category", "LAND ASAP + secondaries remain on the right" — these are notes to
   the builder or on-screen state, NOT card text. Differentiate instruction-to-Claude vs card content.

Adapt DUAL HYD G+Y — do not invent. Its distraction chain (§0c ref + `dual-hyd-g-y.ts`) is the template.

---

## 0d. BASIC ELEMENTS — validate EVERY scenario against this before declaring done

These are the recurring misses. They are STRUCTURAL rules, not one-off edits: apply the pattern across
the whole scenario, don't just patch the one card named. Diff the scenario against `dual-hyd-g-y.ts`
card-for-card — if G+Y has a structural element and this scenario doesn't, that is a miss.

1. **Every pilot→ATC message is a PILOT-INITIATED `kind:"crew"` card + a separate `kind:"atc"` response.**
   Never a lone `kind:"atc"` card carrying the crew's line in `pilotSays`. Mirror `pm_ready_for_approach`
   / `pm_wx_request`. This includes the INTENTION call (`pm_intention_call` → `atc_intention_ack`).
   Ask of every ATC fact the crew acts on: *"how did ATC learn this?"* — there must be a crew card.
2. **Decision → inform ATC → ATC acknowledges → THEN execute.** After FORDEC/decision, the crew makes a
   pilot-initiated intentions call (G+Y `inform_atc_intentions`, "YOUR call, not a response"); a hidden
   `*_acked` gate is completed by the ATC ack; FMC PREP / NITS / approach prep `require` that gate.
   **No procedure card appears before the return/diversion is acknowledged.**
3. **Adapt G+Y card-for-card — change VALUES only.** Same structure, same gating chain, same category/
   reference. Card count flexes with item count; the skeleton does not. Inventing your own = the #1 complaint.
4. **Performance checks NAME the method** — QRH LDG DIST PROC / EFB (FlySmart) LDG PERF app, "do NOT eyeball".
   Never a bare "distance ADEQUATE".
5. **No duplicated action across cards** (e.g. rudder-trim reset lives on ONE card only, not also in FLAP FULL).
6. **Guarded / irreversible actions require CONFIRMATION** (ENG FIRE pb, ENG MASTER OFF, AGENT) — worded as a
   guarded pushbutton, irreversible, `confirmRequired`.
7. **E/WD order (ENG SHUT DOWN family):** left-side action lines complete → **LAND ASAP** (amber, first
   thing) → then right-side `*` secondary failures. LAND ASAP is never below the secondaries.

Process rule for Claude: when the user names one card, treat it as a symptom — check whether the same rule is
violated elsewhere and fix the class, not the instance. Run this list top-to-bottom before saying "done".

---

## 1. Mandatory inputs

Determine STARTING PHASE (§0a) first, then collect ALL of the following.

```
0. STARTING PHASE     — Takeoff / Cruise / Descent / Approach (see §0a).
                        Sets the opening: takeoff = handoff + 400 ft gate;
                        cruise = pilot-initiated MAYDAY first, no check-in;
                        descent (failure found already descending) = same
                        pilot-initiated MAYDAY first, on the current freq.

1. PROCEDURE NAME     — Exact FCOM title.
                        Example: "ENG 1(2) FAILURE — AFTER V1"
                        Example: "RAPID DEPRESS"

2. CALL TYPE          — MAYDAY or PAN PAN?
                        Claude derives from FCOM LAND ASAP color:
                          RED  → MAYDAY
                          AMBER → PAN PAN
                          None → PAN PAN (unless FCOM says MAYDAY)
                        User may override — state reason.

3. GATE STEP          — The step id in the `.ts` file after which the
                        declaration fires. Must be an existing step id.
                        For MAYDAY: typically the "primary actions complete"
                        announcement (e.g. `engine_secured`, `ecam_complete`).
                        For PAN PAN: typically after initial ECAM actions are
                        done, first stable opportunity.
                        Claude greps the `.ts` file to confirm the id exists.

4. SCENARIO DETAILS   — Callsign, departure airport, Tower freq,
                        Departure freq, runway, heading after V1.
                        Example: callsign IFLY101, VIDP, TWR 118.10,
                        DEP 124.85, RWY 28, heading 280.

5. PROCEDURE-SPECIFIC — Any non-standard elements:
                        • Squawk 7700 required? (RAPID DEPRESS, FIRE)
                        • POB / endurance timing (deferred until ECAM done)
                        • Emergency services request? (yes for fire/structural)
                        • ATC hold requested? (fire, hyd failure)
                        • Second MAYDAY on Departure? (yes — always repeat
                          on first contact with new frequency)
                        User confirms or states "standard".

6. USER RULES         — Training simplifications or constraints.
                        Example: "skip the hold — not relevant here",
                        "always show POB question",
                        "do not change existing cards — add only".
                        Can be "none" — user must confirm.
```

**Checklist before proceeding:**
```
[ ] STARTING PHASE determined (§0a) — takeoff / cruise / descent / approach
[ ] PROCEDURE NAME received
[ ] CALL TYPE determined (MAYDAY / PAN PAN) and source confirmed
[ ] GATE STEP confirmed — id exists in .ts file
[ ] SCENARIO DETAILS received (callsign / airport / freqs / runway / hdg)
[ ] PROCEDURE-SPECIFIC items confirmed or "standard"
[ ] USER RULES received or "none"
→ All: proceed to §2 intake summary
→ Any missing: stop and ask
```

---

## 2. Intake summary

```
┌─ ATC COMMS INTAKE ─────────────────────────────────────────────────┐
PROCEDURE:      <name>
CALL TYPE:      MAYDAY / PAN PAN   source: <FCOM line / user-input>
GATE STEP:      <id>  (confirmed in <file>)
CALLSIGN:       <IFLY101>
AIRPORT:        <VIDP>
TWR FREQ:       <118.10>   DEP FREQ: <124.85>
RUNWAY:         <28>       HEADING:  <280>

CARDS TO BUILD:
  ① <id>  Tower changeover → STANDBY  [gate: continue_rotation or equiv]
  ② <id>  PM declares <MAYDAY/PAN PAN> on Tower  [gate: <GATE STEP>]
  ③ <id>  Tower ACK + handover → PM readback + freq change  [gate: step ②]
  ④ <id>  PM initial call on Departure  [gate: step ②]
  ⑤ <id>  Departure confirms + vectors/climb  [gate: step ②]
  ⑥ <id>  POB + endurance → STANDBY  [gate: step ②, resurface: <step>]
  [+]     Procedure-specific extras listed here

PROCEDURE-SPECIFIC:
  Squawk 7700:          yes / no
  Emergency svcs req:   yes / no   (at step: <id>)
  Hold request:         yes / no
  Second <M/PP> on DEP: always yes (ICAO — repeat on new freq)

USER RULES: <list / "none">

Ready to build cards? Say "go" to proceed.
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. MAYDAY vs PAN PAN classification

### How to determine call type

```bash
# Check LAND ASAP color for this procedure
grep -n "LAND ASAP" ~/.claude/manuals/a320/fcom-full.txt | grep -i "<procedure-keyword>"
grep -n "MAYDAY\|PAN PAN\|PANPAN" ~/.claude/manuals/a320/abnormal-procs.txt | grep -i "<procedure-keyword>"
```

| LAND ASAP color | Correct call | Reason |
|----------------|-------------|--------|
| RED | MAYDAY | Distress — immediate danger to life |
| AMBER | PAN PAN | Urgency — serious but not immediate |
| None | PAN PAN | Unless FCOM explicitly mandates MAYDAY |

### Known classification by procedure

| Procedure | Call type | Source |
|-----------|----------|--------|
| ENG 1(2) FIRE — AFTER V1 | **MAYDAY** | RED LAND ASAP [fcom:L94604 / abnormal-procs:L229] |
| ENG 1(2) FAILURE — AFTER V1 | **PAN PAN** | AMBER LAND ASAP — no fire, no structural damage |
| RAPID DEPRESS | **MAYDAY** | RED LAND ASAP + squawk 7700 |
| DUAL HYD G+Y LOSS | **MAYDAY** | RED LAND ASAP — alternate law, severe degradation |
| ELEC EMER CONFIG | **MAYDAY** | RED LAND ASAP — total AC loss |
| SMOKE / FUMES / FIRE | **MAYDAY** | RED LAND ASAP |
| UNRELIABLE SPEED | **PAN PAN** | Urgency — unable RVSM, precautionary |
| NAV ADR 1+2 FAULT | **PAN PAN** | Urgency — unable RVSM, system degradation |
| RTO LOW SPEED | **ATC NOTIFY only** | No LAND ASAP — aircraft stopped on runway |

---

## 4. Standard card sequence

### ENG FIRE and ENG FAILURE are structurally identical post-declaration

The ATC card sequence after the initial MAYDAY/PAN PAN declaration is the same
for both procedures. The only differences are:
- MAYDAY (fire) vs PAN PAN (failure) on the declaration card
- ENG FIRE: crew declares on TOWER, Tower ACKs, hands to Departure (2 extra cards)
- ENG FAILURE: crew is already on Departure when they declare (no Tower ACK cards)
- Both require a hold request during descent/approach preparation

This means post-declaration cards (vectors, STANDBY during ECAM, weather request,
POB/fuel/services, hold, approach, tower, landing) can be copied between the two
procedures with only the MAYDAY/PAN PAN label changed.

### Hold rule (confirmed [user-input 2026-06-09])

A hold request is required for any procedure that involves a return to field after
engine secured (ENG FIRE, ENG FAILURE, and equivalent). The hold is requested:
- During descent / approach preparation phase
- After ECAM complete (gate: `ecam_completed` or equivalent)
- Crew tells ATC they need time before committing to approach
- ATC issues hold clearance; crew reads back hold fix + altitude + direction

Cards needed:
  pm_hold_req    [crew → Dep/Appr]  — PM requests holding pattern
  atc_hold_clr   [Dep/Appr → crew]  — ATC issues hold clearance + readback

### MAYDAY sequence (9 cards — ENG FIRE pattern)

All cards are in the `distractions: []` array of the scenario `.ts` file.

```
① atc_handoff_to_departure     [Tower → crew] — changeover, STANDBY (gate: four_hundred_ft_cmd)
② <proc>_mayday_declare        [crew → Tower] — PM declares MAYDAY (gate: GATE_STEP)
③ atc_tower_mayday_ack         [Tower → crew] — ACK + handover (gate: step ②)
④ pm_dep_initial_call          [crew → Dep]   — position + STANDBY (gate: step ②)
⑤ atc_dep_mayday_confirm       [Dep → crew]   — confirm + vectors (gate: step ④)
⑥ atc_vectors_when_ready       [Dep → crew]   — STANDBY / hold request (gate: step ②)
⑦ pm_hold_req                  [crew → Dep]   — request hold (gate: ecam_completed)
⑧ atc_hold_clr                 [Dep → crew]   — hold clearance + readback (gate: pm_hold_req)
⑨ atc_pob_endurance            [Dep → crew]   — POB + fuel (gate: ecam_completed)
   [+ weather, approach, tower, landing cards — identical to PAN PAN sequence]
```

### PAN PAN sequence (8 cards — ENG FAILURE pattern)

```
① atc_handoff_to_departure     [Tower → crew] — changeover, switch to Dep (gate: four_hundred_ft_cmd)
② atc_radar_contact            [Dep → crew]   — STANDBY while ECAM running (no gate, time-based)
③ <proc>_panpan_declare        [crew → Dep]   — PM declares PAN PAN (gate: eng1_master_off or equiv)
④ atc_vectors_climb            [Dep → crew]   — confirm + vectors (gate: GATE_STEP)
⑤ atc_vectors_when_ready       [Dep → crew]   — STANDBY / hold request (time-based)
⑥ pm_hold_req                  [crew → Dep]   — request hold (gate: ecam_completed)
⑦ atc_hold_clr                 [Dep → crew]   — hold clearance + readback (gate: pm_hold_req)
⑧ atc_pob_endurance            [Dep → crew]   — POB + fuel (gate: ecam_completed)
   [+ weather, approach, tower, landing cards — identical to MAYDAY sequence]
```

### Phase rules (confirmed [user-input 2026-06-09])

- **Takeoff**: gate PAN PAN/MAYDAY on engine secured step (eng1_master_off for failure,
  engine_secured for fire). NOT during ECAM — STANDBY while checklist running.
- **Cruise / climb**: first ATC contact IS the emergency declaration. No prior handoff
  or STANDBY sequence.
- **LAND ASAP amber** on STATUS → PAN PAN. **LAND ASAP red** → MAYDAY.

### Airport selection rule (confirmed [user-input 2026-06-09])

The crew does **not** select a diversion airport or request vectors until ALL of
the following are done:
  1. Immediate emergency action complete (descent stabilised, ECAM done)
  2. Weather obtained from ATC
  3. Landing performance computed
  4. FORDEC complete

**During the immediate action phase**, the only correct crew response to ATC
"advise intentions" is a deferral:
  - "Continuing checklist, will advise intentions, CALLSIGN"
  - "Continuing descent, will advise when ready, CALLSIGN"

Any option that selects an airport, requests vectors, or commits to a runway
while the emergency action is still running is **wrong** — even if the airport
choice is ultimately correct.

This applies to ALL procedures: engine failure, decompression, hydraulic failure,
electrical emergency. The pattern does not change based on urgency.

Exception — initial MAYDAY only: when the emergency forces an immediate departure
from the current flight path (unable RVSM, emergency descent), state the forced
manoeuvre in the MAYDAY call. Do not state a destination airport.

### Navigation statement rule (confirmed [user-input 2026-06-09])

Navigation must be established in every emergency communication sequence.
The crew cannot start a descent, turn, or offset on the airway without ATC
knowing and approving the deviation — that is the whole logic.

Navigation is established in one of two ways:
  1. **Crew states it in the MAYDAY** — crew-initiated deviation (turning,
     requesting offset, requesting descent out of cleared level)
  2. **ATC assigns it in the ack** — ATC gives heading/offset instruction;
     crew reads it back fully

Both are valid. Either way, navigation must appear in the sequence — never
leave the MAYDAY ack card without a lateral or vertical navigation element.

Valid navigation forms in a MAYDAY/PAN PAN call:
  - **Turning**: "turning right heading <HDG>" — crew is already executing
    the turn as an immediate emergency action
  - **Offset request**: "request 5 miles right offset" — crew requests
    lateral separation before deviating
  - **On track + altitude request**: "heading <HDG>, request descent flight
    level <X>" — crew states current track and requests vertical deviation
  - **RVSM/system departure**: "unable RVSM, request descent flight level <X>"
    — the request itself is the navigation deviation statement

Format of a complete MAYDAY call:
  MAYDAY × 3, CALLSIGN, NATURE, NAVIGATION, LEVEL, STANDBY

Examples:
  Decompression (immediate turn, crew-initiated):
    "MAYDAY MAYDAY MAYDAY, IFLY202, cabin depressurisation, turning right
     heading 270, emergency descent to FL100, standby"
  Dual hydraulic (crew on track, unable RVSM — ATC then assigns offset in ack):
    "MAYDAY MAYDAY MAYDAY, IFLY101, dual hydraulic failure, heading <HDG>,
     unable RVSM, request descent flight level two five zero, standby"
  Engine fire (departing SID, tracking runway heading):
    "MAYDAY MAYDAY MAYDAY, IFLY101, engine fire engine 1, heading 280,
     climbing 2 500 feet, standby"

**Squawk 7700 is a transponder action — never stated verbally in the MAYDAY call.**
The transponder is set separately; ATC sees it on radar.

### PAN PAN format rule (confirmed [user-input 2026-06-09])

"PAN PAN" is called three times = **6 words total**. Never 3 words.

  Correct: `PAN PAN PAN PAN PAN PAN, CALLSIGN, nature, navigation, level, standby`
  Wrong:   `PAN PAN PAN, CALLSIGN, ...`  ← 3-word form is always wrong — never mark as correct

### Emergency services by procedure (confirmed [user-input 2026-06-09])

The services request belongs in the POB/fuel/services card, NOT in the initial MAYDAY/PAN PAN.
Never include technical aircraft status (no autoland, batteries limited, alternate law) in the
services request — only operational facts that affect ground operations.

| Procedure | Call type | Correct services request |
|-----------|-----------|--------------------------|
| ENG FIRE — after V1 | MAYDAY | "full emergency services" |
| ENG FAILURE — after V1 | PAN PAN | "fire services as a precaution" |
| RAPID DEPRESS / structural | MAYDAY | "medical and emergency services standby, possible structural damage" |
| DUAL HYD G+Y | MAYDAY | "full emergency services" |
| ELEC EMER CONFIG | MAYDAY | "full emergency services" |
| SMOKE / FUMES | MAYDAY | "full emergency services and medical, smoke on board, possible evacuation on landing" |
| UNRELIABLE SPEED | PAN PAN | "fire services as a precaution" |
| NAV ADR 1+2 FAULT | PAN PAN | "emergency services standby as a precaution" |
| RTO — ENG FIRE on ground | ATC NOTIFY | "ARFF and ambulance" (immediate, not precautionary) |

### ELEC EMER CONFIG exception — no hold cards (confirmed [user-input 2026-06-09])

30-minute battery-only endurance makes holding unacceptable — every minute burned holding
increases risk of total power loss. **No hold cards for ELEC EMER CONFIG.** Crew goes
MAYDAY → FORDEC → intentions crew card → direct approach without holding.
Replace the hold phase with a crew intentions card gated on `fordec_elec`.

### ATC NOTIFY only (RTO / ground events)

```
① atc_notify_ground            [crew → TWR]   — brief nature + intentions
② atc_twr_ack                  [TWR → crew]   — acknowledge + CFR if required
```

---

## 5. Card templates

### ① Tower changeover → STANDBY

```typescript
{
  id: "atc_handoff_to_departure",
  atMs: 5_000,
  requiresStep: "<first_stable_step_after_fire_or_failure>",
  kind: "atc",
  from: "<AIRPORT> TOWER",
  message: "<CALLSIGN>, contact <AIRPORT> Departure <DEP_FREQ>.",
  standbyResurfaceMs: 25_000,
  choices: [
    { id: "a", label: "STANDBY, <CALLSIGN>",                         correct: true  },
    { id: "b", label: "<AIRPORT> Departure <DEP_FREQ>, <CALLSIGN>",  correct: false },
    { id: "c", label: "Roger, <CALLSIGN>",                           correct: false },
    // For MAYDAY procedures add wrong option: premature declaration
    { id: "d", label: "<MAYDAY/PANPAN × 3>, <CALLSIGN>, <nature>, STANDBY", correct: false },
  ],
},
```

### ② PM declares MAYDAY on Tower

```typescript
{
  id: "<proc>_mayday_declare",
  atMs: 3_000,
  requiresStep: "<GATE_STEP>",
  kind: "crew",
  from: "PM → TOWER <TWR_FREQ>",
  message: "Select MAYDAY call for <AIRPORT> Tower <TWR_FREQ>.",
  standbyResurfaceMs: 20_000,
  completesStep: "<mayday_atc_step_id>",
  choices: [
    // Correct — ICAO MAYDAY: nature + heading + altitude + STANDBY (no intentions yet)
    { id: "a", label: "MAYDAY MAYDAY MAYDAY, <CALLSIGN>, <nature>, heading <HDG>, <climbing/descending> [ALT] feet, STANDBY", correct: true  },
    // Wrong — missing position data
    { id: "b", label: "MAYDAY MAYDAY MAYDAY, <CALLSIGN>, <nature>, STANDBY",  correct: false },
    // Wrong — premature intentions
    { id: "c", label: "MAYDAY MAYDAY MAYDAY, <CALLSIGN>, <nature>, returning <AIRPORT> runway <RWY>, <POB> POB, request full emergency", correct: false },
    // Wrong — informal
    { id: "d", label: "<CALLSIGN>, declaring emergency, <nature>, standby",  correct: false },
  ],
},
```

### ② PM declares PAN PAN on Tower

```typescript
{
  id: "<proc>_panpan_declare",
  atMs: 3_000,
  requiresStep: "<GATE_STEP>",
  kind: "crew",
  from: "PM → TOWER <TWR_FREQ>",
  message: "Select PAN PAN call for <AIRPORT> Tower <TWR_FREQ>.",
  standbyResurfaceMs: 20_000,
  completesStep: "<panpan_atc_step_id>",
  choices: [
    // Correct — ICAO PAN PAN: nature + heading + altitude + STANDBY
    { id: "a", label: "PAN PAN PAN PAN PAN PAN, <CALLSIGN>, <nature>, heading <HDG>, <climbing/level> [ALT] feet, STANDBY", correct: true  },
    // Wrong — MAYDAY (over-declaring — no immediate danger)
    { id: "b", label: "MAYDAY MAYDAY MAYDAY, <CALLSIGN>, <nature>, heading <HDG>, [ALT] feet, STANDBY", correct: false },
    // Wrong — missing position data
    { id: "c", label: "PAN PAN PAN PAN PAN PAN, <CALLSIGN>, <nature>, STANDBY", correct: false },
    // Wrong — informal
    { id: "d", label: "<CALLSIGN>, urgency, <nature>, standby",  correct: false },
  ],
},
```

### ③ Tower ACK + handover

```typescript
{
  id: "atc_tower_ack",
  atMs: 2_000,
  requiresStep: "<proc_mayday_or_panpan_step_id>",
  kind: "atc",
  from: "<AIRPORT> TOWER",
  message: "<CALLSIGN>, <MAYDAY/PAN PAN> acknowledged. Contact <AIRPORT> Departure <DEP_FREQ>. Emergency services alerted.",
  standbyResurfaceMs: 20_000,
  choices: [
    // Correct — readback: freq + callsign only
    { id: "a", label: "<AIRPORT> Departure <DEP_FREQ>, <CALLSIGN>",  correct: true  },
    // Wrong — no freq readback
    { id: "b", label: "Roger, <CALLSIGN>",                            correct: false },
  ],
},
```

### ④ PM initial call on Departure

```typescript
{
  id: "pm_dep_initial_call",
  atMs: 8_000,
  requiresStep: "<proc_mayday_or_panpan_step_id>",
  kind: "crew",
  from: "PM → DEPARTURE <DEP_FREQ>",
  message: "Select PM initial call on <AIRPORT> Departure <DEP_FREQ>.",
  standbyResurfaceMs: 25_000,
  choices: [
    // Correct — position report only; no repeat MAYDAY on Departure
    // NOTE: ICAO — second MAYDAY on new freq IS required per Doc 9432.
    //       For training: position + STANDBY is accepted as correct at this
    //       workload level. Full repeat MAYDAY is an alternative correct.
    { id: "a", label: "<CALLSIGN>, heading <HDG>, climbing [ALT] feet, STANDBY",  correct: true  },
    // Also correct — full MAYDAY repeat on Departure (ICAO compliant)
    { id: "b", label: "MAYDAY MAYDAY MAYDAY, <CALLSIGN>, <nature>, heading <HDG>, climbing [ALT] feet, STANDBY", correct: true },
    // Wrong — premature intentions
    { id: "c", label: "<CALLSIGN>, emergency, returning <AIRPORT>, request runway <RWY> ILS, full emergency services", correct: false },
  ],
},
```

### ⑤ Departure confirms + vectors

```typescript
{
  id: "atc_dep_confirm",
  atMs: 15_000,
  requiresStep: "<proc_mayday_or_panpan_step_id>",
  kind: "atc",
  from: "<AIRPORT> DEPARTURE",
  message: "<CALLSIGN>, <MAYDAY/PAN PAN> acknowledged, radar contact, continue runway track, climb <ALT> feet, QNH <QNH>.",
  standbyResurfaceMs: 25_000,
  choices: [],    // Information-only — no quiz
},
```

### ⑥ POB + endurance question (while ECAM running)

```typescript
{
  id: "atc_pob_endurance",
  atMs: 25_000,
  requiresStep: "<proc_mayday_or_panpan_step_id>",
  kind: "atc",
  from: "<AIRPORT> DEPARTURE",
  message: "<CALLSIGN>, say persons on board and endurance.",
  standbyResurfaceMs: 30_000,
  standbyResurfaceOnStep: "<wx_request_equiv>",   // resurfaces when crew is ready
  choices: [
    // Correct — STANDBY while checklist running
    { id: "a", label: "Standby <CALLSIGN>",                                          correct: true  },
    // Wrong — too early, ECAM not complete
    { id: "b", label: "<CALLSIGN>, <POB> persons on board, endurance <X> hours",     correct: false },
  ],
},
```

---

## 6. Source library

All at `~/.claude/manuals/a320/`:

| File | When to use |
|------|-------------|
| `fcom-full.txt` | LAND ASAP color, ATC NOTIFY ECAM line, procedure-specific comms |
| `abnormal-procs.txt` | LAND ASAP semantics, MAYDAY vs PAN PAN classification |
| `callouts.txt` | Verbatim PF/PM callout text for ATC calls |
| `icao-phraseology.txt` | ICAO Doc 9432 MAYDAY / PAN PAN / readback format |

**Key grep recipes:**
```bash
# Find LAND ASAP color for a procedure
grep -n "LAND ASAP" ~/.claude/manuals/a320/fcom-full.txt | grep -i "<keyword>" | head
grep -n "MAYDAY\|PAN PAN" ~/.claude/manuals/a320/abnormal-procs.txt | grep -i "<keyword>" | head

# Find ATC NOTIFY ECAM line placement
grep -n "ATC.*NOTIFY\|NOTIFY.*ATC" ~/.claude/manuals/a320/fcom-full.txt | grep -i "<keyword>" | head

# Find existing gate step in scenario .ts
grep -n "\"id\":" src/scenarios/data/<scenario>.ts | grep -i "<step-name>"
```

---

## 7. Workflow — every ATC comms task

1. **Collect all six inputs** (§1). Do not skip any.
2. **Show intake summary** (§2). Wait for "go".
3. **Confirm MAYDAY vs PAN PAN** from FCOM (§3). Show source line.
4. **Confirm gate step exists** in the `.ts` file. Show grep result.
5. **Build card plan** — list all cards with ids, gates, and choice labels.
   Do not write TypeScript yet.
6. **Wait for "go"** — then write the full distraction block.
7. **Verify**: after writing, grep the `.ts` to confirm all ids are unique
   and all `requiresStep` values match existing step ids.

---

## 8. Trigger phrases

- **"go"** — approve intake / plan, proceed to next stage
- **"Apply this card"** — add one specific card only
- **"Rebuild ATC block"** — replace all existing ATC distractions for this procedure
- **"new procedure"** — abandon current work, restart intake

Any card change WITHOUT one of these → return the plan, list triggers, ask which applies.

---

## 9. Examples log

### [2026-06-09] ENG 1(2) FIRE — AFTER V1 (reference implementation)
- Call type: MAYDAY — RED LAND ASAP [fcom:L94604 / abnormal-procs:L229]
- Gate step: `engine_secured`
- Callsign: IFLY101 · VIDP · TWR 118.10 · DEP 124.85 · RWY 28 · HDG 280
- Cards built: 7 (handoff standby, mayday_tower_declare, tower_ack,
  pm_dep_initial_call, dep_vectors_confirm, vectors_when_ready,
  pm_hold_req_card, atc_hold_clearance, pob_endurance)
- Key rules confirmed:
  - Tower STANDBY correct until engine_secured
  - No second MAYDAY required on Departure in training (position + STANDBY accepted)
  - POB/endurance deferred until after crew_crosscheck (ECAM complete)
  - Emergency services requested at `atc_emergency_services` step (after FORDEC)
- File: `src/scenarios/data/eng1-fire-after-v1.ts`

### [2026-06-09] DUAL HYD G+Y SYS LO PR — cruise
> **SUPERSEDED by [2026-06-24] below** — the card ids and gates here are the
> ORIGINAL build and were replaced by the 06-23 redesign. `atc_handoff_checkin`
> → `pm_mayday_declare`; `pm_hold_req` → `atc_hold_req`; `atc_descend_10000`
> added; the `crew_crosscheck` gates were re-sequenced (weather→`qrh_summary_gy`,
> hold/POB→`inform_atc_intentions`). Kept for history; for the CURRENT card list
> read the [2026-06-24] entry.
- Call type: MAYDAY — RED LAND ASAP [abnormal-procs / skill §3 known classification]
- Phase rule: cruise — first ATC contact IS the MAYDAY (no prior Tower handoff/STANDBY sequence)
- Gate steps: weather/hold = `crew_crosscheck` · intentions/emg services = `fordec_hyd`
- Callsign: IFLY101 · route VIDP–VABB · divert VABB · approach Mumbai Tower 118.10
- Cards built: 16
  - ① atc_handoff_checkin: routine check-in → MAYDAY "unable RVSM, request descent FL250, standby"
  - ② atc_mayday_ack: ATC ack + offset + descent → readback BOTH
  - ③ atc_assistance_req: "assistance required?" → STANDBY (ECAM not started)
  - ④ atc_vectors_when_ready: vectors offered → "continuing checklist" (two correct options)
  - ⑤ atc_weather_request: [crew, gate: crew_crosscheck] weather request only; no airport decision yet
  - ⑥ atc_weather_delivery: [gate: crew_crosscheck] ATC delivers weather → full readback incl QNH
  - ⑦ pm_hold_req: [crew, gate: crew_crosscheck] request holding (buy time for FORDEC)
  - ⑧ atc_hold_clr: [gate: crew_crosscheck] hold clearance → fix + altitude + direction readback
  - ⑨ atc_pob_fuel_services: ATC asks POB/endurance → POB + fuel + endurance only (no tech status)
  - ⑩ atc_intentions_advise: [crew, gate: fordec_hyd] VABB (correct) vs VAAH (wrong, too short)
  - ⑪ atc_emg_services_req: [crew, gate: fordec_hyd] "full emergency services" only
  - ⑫–⑯ approach, tower, landing, taxi: standard pattern
- Key rules confirmed:
  - Initial MAYDAY = nature + unable RVSM + descent request + standby. No airport, no vectors.
  - G+Y: AP 1+2 INOP → unable RVSM → must state in MAYDAY; request descent out of RVSM block
  - Don't say "Green and Yellow" — just "dual hydraulic failure"
  - Airport selection only after weather + landing performance + FORDEC
  - Emergency services = "full emergency services" only; no technical aircraft status to ATC
  - kind:"crew" cards must not offer standby (§0 rule 9 — added this session)
  - VAAH (2743m) insufficient for flapless + accumulator-brake landing; VABB (3445m) required
- File: `src/scenarios/data/dual-hyd-g-y.ts`

### [2026-06-09] ENG 1(2) FAILURE — AFTER V1
- Call type: PAN PAN — AMBER LAND ASAP (engine failure, no fire, no damage)
  [fcom ENG 1(2) SHUT DOWN STATUS / abnormal-procs:L241 / user-input 2026-06-09]
- Gate step: `eng1_master_off`
  FCTM source: "An engine is considered as secured when ECAM actions performed
  until ENG MASTER OFF for an engine failure without damage" [fctm:L15835]
- Callsign: IFLY101 · VIDP · TWR 118.10 · DEP 124.85 · RWY 28 · HDG 280
- Cards built / modified: 4
  - atc_handoff_to_departure: + requiresStep four_hundred_ft_cmd, + STANDBY as wrong option
  - atc_radar_contact_pan_pan: repurposed → STANDBY test (mid-ECAM, MASTER OFF not done)
  - eng_failure_panpan_declare: NEW — kind:"crew", gates on eng1_master_off
  - atc_vectors_climb: + requiresStep eng1_master_off
- Key rules confirmed:
  - PAN PAN declared AFTER ENG MASTER OFF (engine secured per FCTM) — not during ECAM
  - PAN PAN declared on Departure (crew already switched) — not on Tower
  - STANDBY on Departure while ECAM running is correct discipline
  - Departure radar contact at T+42s → STANDBY (ECAM in progress)
  - PAN PAN at T+58s+ → after eng1_master_off
- Phase rules (generalised from this procedure):
  - TAKEOFF: PAN PAN/MAYDAY gates on engine secured step (eng1_master_off or equiv)
  - CRUISE/CLIMB: first ATC contact IS the emergency declaration (no prior handoff)
  - LAND ASAP amber on STATUS → PAN PAN. Red → MAYDAY.
- File: `src/scenarios/data/eng-failure-after-v1.ts`

### [2026-06-23] DUAL HYD G+Y SYS LO PR — refinements (live-tuned on localhost)
Built on the 2026-06-09 entry; refined card-by-card against the running scenario.
- **No config read to ATC (§0 rule 10).** Stripped "gear gravity, FLAP 3" / "gear
  down FLAP 3" from the crew→ATC calls (`atc_stabilised_report`, `atc_tower_contact`,
  `atc_cleared_to_land`). The reports keep the navigation phase only — "stabilised
  / established **on the ILS** runway 27", "cleared to land runway 27" — never the
  landing configuration or method.
- **Holding leg detail.** Non-standard hold for the degraded jet states **two-minute
  legs** in BOTH the PM request (`atc_hold_req`) and the clearance + read-back
  (`atc_hold_clr`).
- **Last-call gate (§0 rule 12).** REQUEST TAXI must be the final action → added a
  hidden `optional` step `ldg_clearance_done`, `completesStep`-ed by `atc_cleared_to_land`;
  `request_taxi_to_stand.requires = ["ldg_clearance_done"]`. Engine only writes a
  step to `completedSteps` via `completesStep` — ATC card ids are NOT auto-recorded.
- **Squawk** stays a crew transponder action on the emergency-services card (§0 rule:
  never spoken verbally) — kept, not ATC-requested [user confirmed 2026-06-23].
- **Sync:** the data-driven workbook `atcCalls` array + vault §5 were regenerated
  from the `.ts` after these edits.
- File: `src/scenarios/data/dual-hyd-g-y.ts`

### [2026-06-24] Comms MODEL refinement (§0a + §0b rewritten) [user-input]
Captured the developer's verbal model of ATC comms as a phase-gated to-and-fro.
No scenario change — skill §0a/§0b only.
- **The "set" is the atomic unit, and its shape is set by who opens it:**
  pilot-initiated = **3 parts** (request/declare → ATC approves → crew read-back);
  ATC-initiated = **2 parts** (ATC instructs/asks → crew read-back, "end of it").
- **Phase decides the opener.** A crew-discovered failure — cruise OR already
  descending — ALWAYS opens with the pilot's MAYDAY/PAN PAN declaration, never an
  ATC call (§0a generalized to the descent-start case for the next scenario).
- **Two hard gates on the crew→ATC info sets** (§0b): (1) nothing but "descend
  lower" until ECAM actions complete — no weather / intentions / diversion while
  actions run; (2) **major/dual failures (G+Y, G+B, EMER ELEC) read the CRUISE
  part of the summary FIRST**, then weather is the crew's first call; (3) never
  read the config (FLAP 3 / gravity gear / VAPP+25) to ATC (reinforces §0 rule 10).
- **Generalized phase-progression table** added (CRUISE/DESCENT → DESCENT →
  ACTIONS COMPLETE/CRUISE SUMMARY → DECISION → HOLD → FMC PREP → APPROACH →
  ESTABLISHED → LANDING), each row naming its sets + opener — scenario-agnostic,
  replacing the dual-hyd-only gate map (kept as the worked example).
- **Completeness audit of DUAL HYD G+Y (this session):** all 19 ATC cards map to
  the phases; fire/emergency services (`atc_emg_services_req` + `atc_taxi_to_stand`
  inspection) and special requests (unable-to-vacate / NWS inop, long final) all
  present — nothing missing. One OPTIONAL item left to the developer: no explicit
  MUMBAI CONTROL → MUMBAI APPROACH frequency-handoff set (cards jump Control→Appr).
- **Takeoff / initial-climb opening folded into §0b** — a 4-row mini-table for the
  engine-fire family: aviate first (no radio) → Tower handoff/STANDBY while ECAM
  runs → MAYDAY on Tower gated at **400 ft / engine secured** → Tower→Departure
  handoff + position report. After CLIMB it MERGES into the generalized progression
  (the crew, "when ready," asks for holding/weather/POB/approach — same sets as
  enroute). All three starting phases (takeoff · cruise · descent) now in one model.
  Reference impl `eng1-fire-after-v1.ts` (declaration gated `four_hundred_ft_cmd`/
  `engine_secured`, `atc_handoff_to_departure` present).
- **AUTHORITATIVE current DUAL HYD G+Y card list (20, replaces the 06-09 list)** —
  id · kind · gate (`completesStep` noted), in scenario order:
  1. `pm_mayday_declare` · crew · `request_routing` → completes `declare_mayday`
  2. `atc_mayday_ack` · atc · `declare_mayday` → completes `mayday_ack`
  3. `atc_descend_10000` · atc · `start_descent` → completes `cleared_10000`
  4. `atc_assistance_req` · atc · `speed_set`
  5. `atc_vectors_when_ready` · atc · `speed_set`
  6. `atc_control_to_approach` · atc · `crew_crosscheck`  (CONTROL→APPROACH freq handoff "Mumbai Approach 127.9"; added 2026-06-24)
  7. `atc_weather_request` · crew · `qrh_summary_gy`
  8. `atc_weather_delivery` · atc · `qrh_summary_gy` → completes `weather_obtained`
  9. `atc_intentions_advise` · crew · `fordec_hyd`
  10. `atc_hold_req` · crew · `inform_atc_intentions`
  11. `atc_hold_clr` · atc · `inform_atc_intentions`
  12. `atc_pob_fuel_services` · atc · `inform_atc_intentions`
  13. `atc_emg_services_req` · crew · `atc_emergency_svcs`  (full emerg svcs + unable to vacate / NWS inop)
  14. `atc_ready_for_approach` · atc · `approach_cl_hyd`  (request vectors + long final)
  15. `atc_cleared_approach` · atc · `approach_cl_hyd`  (cleared ILS + Tower handoff)
  16. `atc_stabilised_report` · crew · `lgr_gravity`
  17. `atc_established_report` · crew · `landing_cl_hyd`
  18. `atc_tower_contact` · atc · `landing_cl_hyd`
  19. `atc_cleared_to_land` · atc · `landing_cl_hyd` → completes `ldg_clearance_done`
  20. `atc_taxi_to_stand` · crew · `request_taxi_to_stand`  (hold position, request tyre/brake inspection)
  Verified against the live `.ts` (47 steps · 20 cards · `status: DRAFT`; tsc clean).
  [2026-06-24] The optional CONTROL→APPROACH frequency-handoff gap is now CLOSED
  (`atc_control_to_approach`, freq 127.9 = simulation-placeholder, confirm w/ SME).
- **[2026-06-24] ENG 1 FIRE comms audit (eng1-fire-after-v1.ts):** opening + return
  sequence already match the model (it is the reference). Two scoring fixes applied
  [user-input]: (1) `pm_dep_initial_call` — the ICAO **MAYDAY repeat on the new
  Departure freq is now CORRECT** (was marked wrong; position+STANDBY also stays
  correct). (2) `atc_pob_fuel_services` — STANDBY (defer while ECAM runs) stays
  correct AND the **clean POB+endurance answer is now correct** (the card resurfaces
  at `wx_request` and must be answerable). Single-card limit: can't be presentation-
  specific, so both read correct. Workbook `atcCalls` flags synced; `tsc` + `node
  --check` clean. Then two more applied: (3) added **DEPARTURE→APPROACH handoff**
  `atc_dep_to_approach` (atc, gate `crew_crosscheck`, "Delhi Approach 127.45" =
  placeholder) — parity with G+Y; (4) `atc_tower_contact` — "Continuing ILS 28, will
  report established" now **correct** too (was wrong; it is correct in G+Y — resolved
  the inconsistency). Fire ATC cards 18 → 19; workbook synced (`node --check` clean).
  NOTE: the fire workbook is otherwise drifted from the live `.ts` (missing ~5 cards)
  — a separate full parity-rebuild job.

## [2026-07-07] Comms-card VISUAL model — INBOUND / OUTBOUND / CONTEXT (`distraction-modal.tsx`)
Colour encodes the DIRECTION of each leg; layout stays STACKED + left-aligned (never chat left/right).
Keys off `distraction.kind` — reusable across every scenario's comms, no per-card wiring.
- **INBOUND** (ATC → crew) = **GREEN `#35C46E`**. The `message` on a `kind:"atc"` card, labelled
  `▼ INBOUND · ATC → FLIGHT CREW`, green left-accent box; header tag `▼ INBOUND`.
- **OUTBOUND** (crew → ATC) = **BLUE `#5C9CF5`**. The crew's `choices` (readback / call), labelled
  `OUTBOUND ▲`, blue-tinted option buttons; header tag `▲ OUTBOUND` on crew cards.
- **CONTEXT** = a cue to the crew, NOT on the radio (e.g. "FORDEC complete, advise intentions").
  NEUTRAL — NOT green, NOT a transmission. On a `kind:"crew"` card the `message` IS such a prompt →
  **it is NOT shown at all** (redundant); the crew's call lives in the options.
- **`kind:"crew"` (crew-initiated)** = the whole card is OUTBOUND: header `▲ OUTBOUND`; NO inbound
  message; options label `CREW CALL`; **NO second OUTBOUND tag on the options row** (header already
  carries it — never two OUTBOUND labels on one card).
- **`kind:"atc"`** = header `▼ INBOUND`; show the green inbound message; **DROP `pilotSays`** (rendering
  the crew's prior call as a second outbound at the top confuses inbound-vs-outbound); options label
  `CREW READBACK` + `OUTBOUND ▲`.
- RULES: never two OUTBOUND labels on a card · never label a context cue as INBOUND · never render
  `pilotSays` as a top outbound leg. See sibling skill `training-card-ui` for the shared card chrome.
- These ATC direction colors are independent from procedure-card alert/reference colors: INBOUND stays
  green, OUTBOUND stays blue, CONTEXT stays neutral. Do not borrow ECAM red/amber or reference-chip amber
  into ATC cards unless the user is explicitly designing a cockpit alert card, not a comms direction card.
