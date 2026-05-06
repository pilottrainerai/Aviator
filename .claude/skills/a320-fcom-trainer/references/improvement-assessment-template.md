# Improvement Assessment Template

The standard output the skill produces. Every system review uses this exact
shape. Fill every field. Use classification labels from `SKILL.md` §4.

## The format

```
Module:
Existing implementation:
Manual source logic:
Alignment score:
Gaps:
Risk of changing now:
Recommended future improvement:
Files likely involved:
Do not modify yet:
```

## Field-by-field guidance

### `Module:`
The single system in scope. Examples: `APU start sequence`, `ENG 1 FIRE
on ground procedure`, `ECAM clear/recall`, `LAND ASAP color logic`. Not
"the simulator" or "everything engine-related" — one specific named scope.

### `Existing implementation:`
A short factual description (≤4 lines) of what's currently in the code
**after reading it**. Cite paths. Don't editorialize.

> Example: "`src/engine/state.ts` has `apu: { master, n }` fields. No
> dedicated `apu.ts` reducer; transitions are inlined in `reducer.ts`.
> `ApuPanel.tsx` (overhead) renders MASTER + START pbs but only updates
> visual state on click — no reducer dispatch for START."

### `Manual source logic:`
Bullet list of source-derived facts with citations. Use classification
labels.

> Example:
> - (official-source-derived) APU MASTER pb opens APU flap, powers ECB.
>   `[FCOM DSC-49-10]`
> - (official-source-derived) APU START pb is inhibited until flap fully
>   open. `[FCOM DSC-49-10]`
> - (inferred-from-source) Flap-open time approximately 6 s; sim should
>   pin a value. `[FCOM "approximately"]`
> - (official-source-derived) APU N rises to 95% in 30–40 s on bleed-off
>   start. `[FCOM DSC-49-10 / start sequence]`

### `Alignment score:`
0–10 number from `fcom-comparison-rubric.md`, with one-line justification.

> Example: "5/10 — APU master state present but no flap, no start
> sequence, no ECB power model."

### `Gaps:`
Numbered list. Each gap = one classification + concise description +
citation + file/line if known.

> Example:
> 1. (missing state logic) APU flap state and timer absent.
>    `[FCOM DSC-49-10]`. File: `src/engine/systems/apu.ts` (does not
>    exist).
> 2. (hardcoded UI) `ApuPanel.tsx` renders MASTER pb in fixed "ON" style
>    regardless of `state.apu.master`. File:
>    `src/components/cockpit/overhead/ApuPanel.tsx:34`.
> 3. (missing ECAM behavior) APU FLAP OPEN MEMO not displayed.
>    `[FCOM DSC-49-10]`.

### `Risk of changing now:`
Honest assessment of blast radius. Include:
- Other systems that touch the same code paths.
- Existing scenarios that might break.
- Tests that exist or are missing.

> Example: "Low — APU is largely untouched in current scenarios. Only
> scenario `eng-fail-after-v1` references APU state, and only reads
> `apu.master` boolean. New `apu.flap` field is additive. No tests
> currently exercise APU."

### `Recommended future improvement:`
The proposed change (still not authorized to execute). Be concrete:
files to add, files to edit, shape of new state, transitions to add.

> Example: "Add `src/engine/systems/apu.ts` with explicit reducer:
> states {flap, master, n_pct, egt_c, fault}. Wire timer for flap open
> (6 s) and N spinup (30 s). Update `ApuPanel.tsx` to bind to state.
> Add `apu-flap-open` MEMO entry to ECAM tree."

### `Files likely involved:`
List with paths. Mark which exist vs new.

> Example:
> - NEW `src/engine/systems/apu.ts`
> - EDIT `src/engine/state.ts` (add fields)
> - EDIT `src/engine/reducer.ts` (route APU events)
> - EDIT `src/components/cockpit/overhead/ApuPanel.tsx`
> - EDIT `src/engine/ecam/memo.ts` (add APU FLAP OPEN)

### `Do not modify yet:`
Verbatim restatement of the no-change rule for this assessment, with the
trigger phrases needed to authorize execution.

> Example: "Awaiting one of: 'Proceed with implementation' (do this
> exact recommendation), 'Rebuild this module' (full APU rewrite), or
> 'Apply this fix' (with which specific gap number)."

## Filled-in example (full)

```
Module: APU start sequence

Existing implementation:
- `src/engine/state.ts` has `apu: { master, n }` fields.
- No dedicated `apu.ts` reducer; transitions inlined in
  `src/engine/reducer.ts:128-145`.
- `src/components/cockpit/overhead/ApuPanel.tsx` renders MASTER and
  START pbs but only updates visual state on click — no reducer dispatch
  for START. No flap, no light states.

Manual source logic:
- (official-source-derived) APU MASTER pb opens APU flap and powers ECB.
  [FCOM DSC-49-10]
- (official-source-derived) APU START pb is inhibited until flap is
  fully open. [FCOM DSC-49-10]
- (inferred-from-source) Flap-open time ~6 s — pin a value for sim.
  [FCOM uses "approximately"]
- (official-source-derived) APU N rises to 95% in 30–40 s on bleed-off
  start; "AVAIL" indication appears at ≥95%. [FCOM DSC-49-10]
- (official-source-derived) APU FLAP OPEN MEMO appears on EWD MEMO area
  while flap is not closed. [FCOM DSC-49-10 + EWD reference]

Alignment score: 5/10 — basic master state but no flap, no timed start
sequence, no MEMO, no light state binding.

Gaps:
1. (missing state logic) APU flap state and open timer absent.
   [FCOM DSC-49-10]. File: src/engine/systems/apu.ts (does not exist).
2. (missing state logic) START pb does nothing.
   File: src/components/cockpit/overhead/ApuPanel.tsx:67.
3. (hardcoded UI) MASTER pb visual not bound to state.
   File: src/components/cockpit/overhead/ApuPanel.tsx:34.
4. (missing ECAM behavior) APU FLAP OPEN MEMO not present.
   [FCOM DSC-49-10]. File: src/engine/ecam/memo.ts.
5. (simulation-placeholder) APU N spinup curve simplified to instant.
   File: src/engine/state.ts:56.

Risk of changing now: Low.
- Only `scenarios/eng-fail-after-v1.ts` reads `apu.master` (boolean).
  New fields are additive — won't break.
- No APU tests exist; no test-breakage risk.
- `ApuPanel.tsx` is unique to APU — rebinding visuals isolates change.

Recommended future improvement:
- Add `src/engine/systems/apu.ts` with explicit reducer:
  state { flap: 'CLOSED'|'OPENING'|'OPEN', master, start_armed, n_pct,
  egt_c, fault, avail }.
- Add timers: flap-open (6 s), N-spinup (30 s to 95%, then to 100%).
- Wire START pb dispatch in ApuPanel.tsx.
- Bind MASTER pb visuals to state.apu.master.
- Add APU FLAP OPEN MEMO trigger in ecam/memo.ts.
- Optional: APU AVAIL ECAM MEMO when n_pct ≥ 95%.

Files likely involved:
- NEW    src/engine/systems/apu.ts
- EDIT   src/engine/state.ts (add fields)
- EDIT   src/engine/reducer.ts (route APU events through new reducer)
- EDIT   src/components/cockpit/overhead/ApuPanel.tsx
- EDIT   src/engine/ecam/memo.ts (add APU FLAP OPEN, APU AVAIL)
- (no scenario edits — additive)

Do not modify yet:
Awaiting one of:
- "Proceed with implementation" — execute this exact recommendation.
- "Rebuild this module" — full APU rewrite.
- "Apply this fix" — narrow surgical change to a specific gap (say
  which gap #).
```

## Anti-patterns

- ❌ Skipping fields ("just give me the gist") — fill all of them.
- ❌ Vague gaps without citations.
- ❌ Mixing system scopes in one assessment.
- ❌ Recommending without classifying.
- ❌ Filling "Do not modify yet" with a single line — explicitly list
  the trigger phrases the user must use.
