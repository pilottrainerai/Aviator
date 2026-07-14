---
name: training-card-ui
description: The reusable design system for Aviator's TRAINING CARDS — the procedure/flight-check card (flight-check-popup.tsx) and the ATC/comms card (distraction-modal.tsx). Use BEFORE editing or extending any scenario card's chrome, role labels, category/reference tags, or colours, and when applying the same card system to a NEW scenario or aircraft type (B737, G+B, …). Defines the four-corner Option-B layout, the alert-severity card color model, the category taxonomy + pill palette, the green-active/grey-monitor role model, and the FCOM/FCTM/QRH/TECHNIQUE reference tagging. Card CONTENT (label/action/hint/notes) is never changed to fit the design — only metadata + chrome. Comms-direction specifics live in the sibling `atc-comms` skill.
---

# Training-Card UI Skill — the scenario card design system

Governs the two scenario-facing cards, so every scenario/type reads the same:
- **Procedure card** — `flight-check-popup.tsx` (the active step card).
- **Comms card** — `distraction-modal.tsx` (ATC / cabin / company). Direction model = `atc-comms`.

Sister to `cockpit-ui` (cockpit instruments) and `pfd-fma-logic` (PFD values). This owns the CARDS.

## 0. Hard rules
1. **Never change card CONTENT to fit the design.** label / action / hint / notes / standard callouts
   are authored data — the design adds metadata (`category`, `reference`, `crew`) + chrome only.
2. **Manual-first reference** (same rule as the whole project): a tag is `FCOM`/`FCTM`/`QRH` only if
   the item is actually in that manual; otherwise `TECHNIQUE`. May combine (`QRH · TECHNIQUE`). If
   unsure, verify against the FCOM/FCTM dump before tagging — do not assert a reference from memory.
3. **Colour is an identity signal, not decoration.** Alert severity controls ECAM/glareshield alert card
   chrome (red warning, amber caution). Category colour lives on the PILL only for non-alert taxonomy.
   Role colour = who's active. Direction colour (comms) = who's transmitting. Keep the card body neutral.
4. **One scenario/card at a time.** Reuse the shared component; don't fork per scenario.
5. **Hint = FCOM-style STEPS, not prose.** Terse, specific, telegraphic — dotted-leader form
   (`ITEM......ACTION`, e.g. `HYD SD......CROSSCHECK`) or short `PM: '…'`/`PF: '…'` callout lines,
   ONE per line. `HintLines` splits on `.` + space → each sentence renders as its own step. NO
   paragraphs, NO meta ("crew understanding", "no standard callout"). The deep explanation / rationale
   belongs in the **INFO / learn-more** tab, never on the card. [user 2026-07-07]

## 1. Procedure card — four-corner Option B (`flight-check-popup.tsx`)
```
┌ TL: CATEGORY pill ─────────── TR: roles (doer green + monitor grey) ┐
│                DIRECTIVE  (label ▸ ACTION)                           │
│                why / hint / notes                                    │
└ BL: REFERENCE tag(s) ───────────────────────── BR: CONFIRM button ──┘
```
- **Top-left = CATEGORY** (`step.category`, else derived from `group`). What KIND of task.
- **Top-right = ROLES**: the **doer in GREEN `#3AD63A`** (active), the **monitor in GREY `#7D8794`**
  (the other pilot). No "MON" label — colour carries it. Single-pilot (CAPT/CREW) shows just the green.
  The doer = `step.crew`; monitor = the other pilot (PM↔PF; CAPT→PM; CREW→none).
- **Bottom-left = REFERENCE** (`step.reference`). **Bottom-right = CONFIRM.**
- Card theme (border/glow) is UNCHANGED by this skill — EXCEPT ECAM/glareshield alert cards, which carry
  the **alert SEVERITY as the card colour** (`resolveTheme` / `ProcedureIdleCard`):
  `variant: "warning"` → RED `#FF3333`; `variant: "caution"` → AMBER `#FFB300` (mirrors the E/WD).
  Set the announce/clear card's `variant` to the alert's level. Hardware glareshield:
  MASTER WARN (warning) = red; MASTER CAUT (caution) = amber. MASTER CAUT must NOT show a red top-left
  GLARESHIELD category pill and must NOT print `PANEL`; use only a bottom-right amber `GLARESHIELD`
  badge. Hardware ECAM **action lines** (`switch`/`advisory`, NOT `confirmRequired` — e.g. PTU/pumps OFF
  under a warning) = **BLUE** `#29B6F6`; irreversible hardware (`confirmRequired`: MASTER OFF, FIRE PB)
  = red. So a system reads top-down: red/amber warning title → blue ECAM action lines → clear.
- **The directive never prints `CONFIRM` as its action verb** — it's redundant with the confirm button.
  Hidden in `Directive` (`action !== "CONFIRM"`); the label carries the directive.
- **ECAM clear card label = the alert as seen on the E/WD** (no `CLR —` prefix, no numbering): `AUTO FLT AP OFF`,
  `HYD G+Y SYS LO PR`, `F/CTL ALTN LAW`. The **system prefix is underlined** (
  `underlineSysPrefix` / `SYS_PREFIXES` — AUTO FLT / HYD / F/CTL / ENG …). The clear itself is the 3-part
  callout in the hint (`PM: 'CLEAR ‹SYS›?' → PF: 'CLEAR.' PM presses CLR.`) — no "…clears from the E/WD" prose.

## 2. Category taxonomy + pill palette
Colour on the pill only (`CATEGORY_COLOR` in `flight-check-popup.tsx`). A pair joins with ` · `
(e.g. `CRM · COMMS` for a crew-decision radio call — both at once).
| Category | Meaning | Colour |
|---|---|---|
| ECAM | done from the ECAM | `#D99A3E` amber |
| QRH | done from the QRH | `#2FA69C` teal |
| PROCEDURE | crew calc / non-ECAM/QRH (landing dist, FORDEC, FMGC prep) | `#8593AB` slate |
| AVIATE / NAVIGATE | fly / navigate (PFD) | `#37AEDA` cyan |
| COMMS | ATC radio | `#5C7CD0` blue |
| CRM | crew-decision / human-factors (briefings, PA, emergency-svcs request) | `#9E76C4` violet |
| CHECKLIST | challenge-response checklists | `#4FB05E` green |
| GLARESHIELD | glareshield panel badge only; visual color comes from alert severity | warning red `#FF3333`, caution amber `#FFB300` |

### 2a. Card COLOUR = the ECAM FAILED-SYSTEM colour (not a per-interaction colour) [user 2026-07-12]
The pill carries the *category*; the CARD body/severity carries the **failed-system colour**. A card
inherits the colour of the ECAM failure it belongs to, driven by `variant`:
- `variant:"warning"` → **red** (Level-3 failure: ENG FIRE, …). `variant:"caution"` → **amber** (Level-2).
- Under a RED failure, EVERY action card of that procedure is **red** — IDENTIFY, VERIFY, THR IDLE,
  ENG MASTER OFF, FIRE PB, **AGENT 1/2**. "AGENT red and all." Set those cards `variant:"warning"`.
- `resolveTheme` (`flight-check-popup.tsx`): the `confirmRequired` and execute phases **follow the
  failure severity** (`confirmRequired && warning → red`), they do NOT force amber. So a guarded/
  irreversible action under a red failure stays red. (G+Y has no `confirmRequired` cards, so this is
  safe cross-scenario — verify any new scenario's `confirmRequired + warning` cards before relying on it.)
See vault `ecam-procedure-card-model.md` §2a.

**Card colour = its CATEGORY colour (matches the pill); severity only overrides for real alerts.**
`resolveTheme` builds the card theme from `CATEGORY_COLOR[primary category]` via `catTheme()`, so the
card border/accent/CONFIRM all match the pill and **every card of a kind is the same colour**:
ECAM gold `#D99A3E`, CHECKLIST green, COMMS blue, CRM violet, AVIATE cyan, PROCEDURE slate, QRH teal.
It is coloured by CATEGORY — **never by group or crew**. (The old group rules were the bug: an ECAM
card in `group:"chclm"` rendered GREEN, a PROCEDURE card in `group:"comms"` rendered blue.)
**ECAM is the exception — it's SEVERITY-driven, red or amber only.** `if (isEcam) return warning ?
critical : caution` — a red ECAM line → RED card + red pill; anything else (caution, advisory ENG
SHUT DOWN / STATUS / STOP ECAM / CLEAR) → AMBER. **No third "ECAM gold", never green.** Every OTHER
category takes its own **pill colour** for the card (CHECKLIST green, COMMS blue, CRM violet, AVIATE
cyan, PROCEDURE slate `#8593AB`, QRH teal). Glareshield + `confirmRequired` also follow severity.
Only *untagged* cards fall back to the crew split (PF cyan / PM amber). Rule: tag every card's
category so it colours consistently; ECAM's colour comes from its `variant`. [user 2026-07-13]

## 3. Reference tagging (manual-first)
Bottom-left. The whole reference string renders as one neutral pill, matching the procedure-card color
reference page: `FCOM`, `FCTM`, `QRH`, `TECHNIQUE`, or combined strings such as `FCTM · TECHNIQUE` and
`QRH · TECHNIQUE`. Do NOT split `TECHNIQUE` into a separate amber/dashed/italic chip. Combined strings
mean part-manual, part-technique: gravity gear = `QRH · TECHNIQUE`; V/S descent = `TECHNIQUE`;
FLAP VFE-next-5 = `QRH · TECHNIQUE`; ECAM read = `FCOM`; QRH summary = `QRH`.

## 4. The doer is who does the ACTION — not who's quoted in the callout
`step.crew` = the pilot who performs (green). The standard callout in the hint (e.g.
`PM: 'CLEAR X?' → PF: 'CLEAR.' PM presses CLR`) STAYS as content and does NOT decide the doer:
ECAM clears → PM does (green) even though PF calls. FLAP → PM selects (green), PF calls (grey). A
"READ STATUS" CALL card → PF calls (green on that card); the actual reading is the NEXT card, PM (green).

## 5. Comms card → see `atc-comms`
`distraction-modal.tsx` shares this chrome but adds the DIRECTION model (INBOUND green / OUTBOUND blue /
CONTEXT neutral; crew-init = outbound + no context/pilotSays; ATC = inbound + drop pilotSays). Full
spec in the `atc-comms` skill (§ "Comms-card VISUAL model"). ATC direction colors are separate from
procedure-card category/reference colors.

## 6. Applying to a new scenario / type (the point of this skill)
1. Add `category` + `reference` to every step (manual-first §2/§3); set `crew` = the DOER (§4).
2. The shared components render it automatically — no per-scenario UI code.
3. Comms cards: set `kind` (`crew`/`atc`) correctly; the direction model follows (`atc-comms`).
4. Colours/roles/references are identical across types → B737, G+B, etc. inherit the same reading.

## 7. Examples log
### [2026-07-07] Skill created — from the DUAL HYD G+Y card redesign
- Four-corner Option B, category pill palette, green-active/grey-monitor roles, FCOM/FCTM/QRH/TECHNIQUE
  references — all live in `flight-check-popup.tsx`; 62 G+Y cards classified. Comms direction model in
  `distraction-modal.tsx` (+ `atc-comms`). Card CONTENT untouched throughout. tsc clean; LOCAL/uncommitted.

### [2026-07-08] Approved procedure-card color reference synced
- ECAM/glareshield alert cards use severity: warning red, caution amber. ECAM actions under a red ECAM
  warning stay red as cards unless the line itself is a blue switch/action chip. Reference chips are one
  neutral pill (`FCTM · TECHNIQUE`, not split amber). MASTER CAUT shows only a bottom-right amber
  `GLARESHIELD` badge, no top-left red Glareshield pill and no `PANEL` text.
