# Project Understanding Protocol

Before any assessment, understand the existing Aviator code for the system in
question. Skipping this step produces assessments that recommend things that
already exist.

## Step 1 — Map the layout (once per session)

Confirm these locations exist and note any drift from the plan:

```
src/
├── app/                    # Next.js App Router (marketing, app, api)
├── engine/                 # Isomorphic simulation core (no I/O)
│   ├── state.ts            # AircraftState, ECAMState, EngineState
│   ├── reducer.ts          # (state, event) → state
│   ├── triggers.ts         # Time/condition-driven transitions
│   └── ecam/               # ECAM tree, message logic, clear/recall
├── scenarios/              # Scenario definitions (data, not code)
├── components/
│   ├── cockpit/            # Bespoke panels, switches, displays
│   ├── ewd/                # Engine warning display + ECAM
│   ├── debrief/            # Score rubric, replay scrubber, chat
│   └── ui/                 # shadcn primitives
├── lib/
│   ├── llm/                # Provider abstraction (Groq default)
│   ├── db/                 # Drizzle client + schema
│   └── ...                 # auth, redis, analytics
└── styles/
```

Other top-level files of interest:
- `PLAN.md` — architecture, milestones, open questions
- `CLAUDE.md` — repo working rules
- `AGENTS.md` — Next.js 16 caveats
- `docs/AUTHORING_SCENARIOS.md` — practical scenario authoring guide
- `package.json` — Next.js version, scripts, deps

## Step 2 — Locate files for the system you're about to assess

Use this lookup table. If a file doesn't exist, that itself is a finding
(label as `existing-implementation: missing`).

| System | Likely files |
|---|---|
| APU | `src/engine/systems/apu.*`, `src/components/cockpit/overhead/ApuPanel.*` |
| ENG (engines) | `src/engine/systems/eng.*`, `src/components/cockpit/pedestal/EngMaster.*`, `src/scenarios/eng-*.ts` |
| FIRE | `src/engine/systems/fire.*`, `src/components/cockpit/overhead/FirePanel.*`, `src/components/ewd/EngFire.*` |
| HYD | `src/engine/systems/hyd.*`, `src/scenarios/dual-hyd-*.ts` |
| ELEC | `src/engine/systems/elec.*`, `src/components/cockpit/overhead/ElecPanel.*` |
| BLEED / AIR | `src/engine/systems/bleed.*`, `src/components/cockpit/overhead/AirPanel.*` |
| FUEL | `src/engine/systems/fuel.*`, `src/components/cockpit/overhead/FuelPanel.*` |
| F_CTL | `src/engine/systems/fctl.*`, `src/components/pfd/*` |
| ECAM tree | `src/engine/ecam/*.ts` |
| EWD/SD displays | `src/components/ewd/*`, `src/components/sd/*` |
| PFD | `src/components/pfd/*` |
| ND | `src/components/nd/*` |

Use `grep -rl "<keyword>" src/` for fast discovery if filenames don't match.

## Step 3 — Read, don't assume

For the scoped system:
1. Read all files identified in Step 2 — actually read, full contents.
2. Note what exists, what's stubbed, what's TODO'd.
3. Trace one event end-to-end (e.g. "user presses ENG MASTER OFF" → which
   reducer? which state transitions? which display updates?).
4. Note conventions used: file naming, component patterns, data shapes,
   state-machine style. Match them in any future suggestions.

## Step 4 — Read the scenario definitions

`src/scenarios/<name>.ts` contains the data-driven scenario. For the chosen
system, find:
- Which scenarios exercise this system?
- What `triggers` fire?
- What `validActions` are exposed?
- What `scoringCriteria` are evaluated?

## Step 5 — Note, don't change

Capture findings as classification-labeled bullets. Examples:

- `existing-implementation`: `apu.ts` reducer handles `MASTER:ON/OFF` but
  no `START` event yet
- `existing-implementation: missing`: no `apu.ts` file — only inline state
  in `state.ts`
- `existing-implementation`: ApuPanel.tsx renders MASTER pb but no light
  state transitions

These bullets feed the assessment (`improvement-assessment-template.md`).

## Anti-patterns

- ❌ Asking the user to describe their code instead of reading it.
- ❌ Recommending a refactor before reading the existing module.
- ❌ Treating PLAN.md as ground truth — it can be stale (e.g. it says
  Next.js 15 but `package.json` says 16).
- ❌ Searching for files with assumed paths and giving up if not found —
  use `grep -rl` instead.

## Output of this step

A short paragraph — under 200 words — summarizing what exists, where, and
in what state of completeness. Feeds into the "Existing implementation"
field of the assessment.
