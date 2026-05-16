# FCOM Comparison Rubric

How to grade the alignment between Aviator code and the source manuals.

Apply this rubric per logical unit (a single ECAM action line, a single
state transition, a single push-button behavior). Do not grade an entire
module with one score — break it into items.

## Six classifications

For each item, pick one:

### 1. `accurate / source-aligned`
The code matches the manual verbatim or the deviation is documented and
intentional.

> Example: `apu.master` reducer transitions from OFF→ON exactly as
> `[FCOM DSC-49-10]` describes; legend lights ON in blue when state is ON.

### 2. `acceptable simulation simplification`
Deviates from the manual but in a way that's defensible for training UX
(e.g. a 6-second flap timer pinned to a value where FCOM says
"approximately"). The simplification is conscious and shouldn't be
"corrected" without conversation.

> Example: ECAM line render uses fixed-width font and 2-space indent
> instead of the FCOM's variable-width layout. Functionally equivalent.

### 3. `missing state logic`
A state, transition, or guard the manual specifies is absent in the
code. Crew action would not produce the manual-correct response in the
sim.

> Example: FCOM says ENG MASTER OFF closes LP+HP fuel valves; code only
> tracks the master switch boolean and doesn't model the valves.

### 4. `hardcoded UI`
Display elements are static text/sprites instead of being driven by
state. Will look right in one scenario, wrong in another.

> Example: ECAM "ENG 1 FIRE" title is rendered as a literal string in
> the component, not driven by `ecam.activeWarning`. New scenario can't
> trigger a different warning.

### 5. `missing ECAM behavior`
The ECAM tree, clear/recall, STATUS, INOP SYS, or LAND ASAP semantics
are not modeled or are partial.

> Example: STATUS page renders but no INOP SYS list; LAND ASAP color
> is hardcoded to red even when the procedure calls for amber.

### 6. `needs future rebuild`
The current implementation is far enough from the manual that patching
risks more than rewriting. Flag as a future-rebuild candidate; do **not**
trigger the rebuild from this assessment alone.

> Example: A monolithic `engine.tsx` mixes UI, state, and procedure logic
> without separation. Patching one ECAM line requires touching all three
> concerns.

## Alignment score (per module)

Aggregate the items into a single 0–10 score:

| Score | Composition |
|---|---|
| 9–10 | All items in `accurate` or `acceptable simulation simplification` |
| 7–8 | Mostly accurate; ≤2 items of `missing state logic` or `hardcoded UI` |
| 5–6 | Several gaps; user-facing behavior partly correct |
| 3–4 | Major gaps; would mislead a real pilot examining the sim |
| 0–2 | Tagged for `needs future rebuild` |

The score is a discussion artifact, not a target. Don't refactor to chase
the number. Use it to decide what's worth fixing now vs later.

## How to fill the rubric

1. Read the existing code (use `project-understanding-protocol.md`).
2. Read the manual section(s) (use `manual-reading-protocol.md`).
3. Extract source logic into the canonical template
   (`manual-extraction-template.md`).
4. Walk each row of the extracted state machine and ask:
   - Does the code reproduce this state variable?
   - Does the code reproduce this transition?
   - Does the code reproduce this output/indication?
5. Tag each gap with one of the six classifications.
6. Sum to score.

## Output of this step

Feeds the assessment's `Alignment score:` and `Gaps:` fields. Each gap
becomes one bullet under "Gaps", with classification label and source
citation.

Example:

```
Gaps:
- (missing state logic) APU flap-open timing not modeled
  [FCOM DSC-49-10] — flap takes ~6 s to open; START pb should be
  inhibited until then. File: src/engine/systems/apu.ts (does not exist).
- (hardcoded UI) ECAM title literal "ENG 1 FIRE" in EngFire.tsx; needs
  state-driven binding. File: src/components/ewd/EngFire.tsx:42.
- (missing ECAM behavior) LAND ASAP color hardcoded to red; FCOM specifies
  amber for some scenarios. [FCOM PRO-ABN-ENG / red vs amber LAND ASAP].
```

## Anti-patterns

- ❌ One-word grades like "ok" or "needs work".
- ❌ Mixing classifications without separating them.
- ❌ Grading without reading the actual code.
- ❌ Counting hardcoded UI as "missing state logic" — they're separate
  classes because they need different fixes.
- ❌ Using `needs future rebuild` as a default when you haven't read the
  code carefully enough to choose between (3), (4), (5), or (6).
