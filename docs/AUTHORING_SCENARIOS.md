# Authoring a new scenario

Crosscheck scenarios are pure data. The engine, runner, and UI are scenario-agnostic — to add a new abnormal procedure, you write one TypeScript file and register it in two more.

## Anatomy

A `Scenario` (in `src/scenarios/types.ts`) is:

```ts
{
  meta: ScenarioMeta;       // library card metadata
  brief: { situation, job }; // pre-flight brief copy
  steps: ScenarioStep[];     // the procedure as ordered, requirable units
  triggers: ScenarioTrigger[]; // timed system events (fire warnings, etc.)
  decisions: ScenarioDecision[]; // strategic decision options
}
```

## Step-by-step

### 1. Add metadata to the registry

In `src/scenarios/registry.ts`, define a `META` constant and add it to the `SCENARIOS` array:

```ts
export const MY_SCENARIO_META: ScenarioMeta = {
  slug: "my-scenario",
  title: "MY SCENARIO TITLE",
  system: "engines", // or "fire" | "hydraulics" | "electrical" | "pressurization" | "flight-controls" | "smoke-fumes" | "other"
  phase: "cruise", // or "takeoff" | "approach" | "any"
  status: "available",
  difficulty: 3, // 1-5
  estimatedMinutes: 5,
  summary: "One-paragraph description shown on the library card.",
  runHref: runHref("my-scenario"),
};

export const SCENARIOS: ScenarioMeta[] = [
  // ...existing
  MY_SCENARIO_META,
];
```

### 2. Author the scenario data file

Create `src/scenarios/data/my-scenario.ts`:

```ts
import type { Scenario } from "@/scenarios/types";
import { MY_SCENARIO_META } from "@/scenarios/registry";

export const myScenario: Scenario = {
  meta: MY_SCENARIO_META,
  brief: {
    situation: "What's happening, in two sentences. Plain English.",
    job: "What the pilot has to do, in one sentence.",
  },
  triggers: [
    {
      id: "the_event",
      atMs: 5_000, // wall-clock ms from session start
      description: "What the trigger represents",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "MY ALARM" },
        {
          type: "ADD_ECAM",
          messages: [{ id: "msg1", line: "ECAM TEXT", level: "warning" }],
        },
      ],
    },
  ],
  steps: [
    {
      id: "step1",
      label: "CONTROL LABEL",
      action: "ACTION",   // "OFF", "PUSH", "DISCHARGE", etc.
      hint: "Plain-English description shown to the pilot.",
      variant: "switch", // or "warning" | "caution" | "advisory"
    },
    {
      id: "step2",
      label: "NEXT CONTROL",
      action: "ACTION",
      hint: "...",
      variant: "warning",
      requires: ["step1"], // step1 must be done first
      afterEffect: { // Optional: schedule a side-effect after this step
        delayMs: 5_000,
        triggerId: "step2_complete",
        effects: [
          { type: "SET_MASTER_WARN", active: false },
          { type: "CLEAR_ECAM", ids: ["msg1"] },
        ],
      },
    },
    // ...4-5 steps total works well
  ],
  decisions: [
    { value: "LAND_ASAP", label: "LAND ASAP", description: "...", tone: "primary" },
    { value: "DIVERT", label: "DIVERT", description: "...", tone: "secondary" },
    { value: "CONTINUE", label: "CONTINUE", description: "...", tone: "danger" },
  ],
};
```

**Tone meanings:**
- `primary` — correct response (full points)
- `secondary` — acceptable but not best (partial points)
- `danger` — explicitly wrong (near-zero points)

### 3. Register the data file

In `src/scenarios/index.ts`, import and add to the array:

```ts
import { myScenario } from "./data/my-scenario";

export const ALL_SCENARIOS: Scenario[] = [
  // ...existing
  myScenario,
];
```

### 4. SME pass (mandatory before user-visible release)

Procedure content **must** be reviewed by the named pilot SME before the scenario goes live. The mock scorer will work without review, but inaccurate ECAM phrasing or wrong step ordering will damage credibility with type-rated pilots.

Pass-through items:
- ECAM message text + ordering
- Step labels, actions, and hint text
- Decision option phrasing + tone classification
- Brief situation + job

### 5. Verify

```bash
npm run typecheck
npm run dev
# Visit /scenarios — your scenario should appear
# Visit /train/my-scenario — runs the pre-flight brief
```

## Scoring contract

The mock scorer reads from your data:
- **Correctness** = % of non-optional steps with a STEP event
- **Sequence** = penalty per `requires` violation (out-of-order or missing prerequisite)
- **Decision** = score derived from the matching decision's `tone`

Composite = 0.4 × correctness + 0.3 × sequence + 0.3 × decision.

When `GROQ_API_KEY` is set, the LLM scorer takes over and uses your scenario's brief + steps + decisions as context. The deterministic mock remains the fallback.

## Common mistakes

- **Steps without prerequisites** — if you intend a sequence (A → B → C), put `requires` on B and C. The scorer needs this to detect out-of-order play.
- **Optional steps without `optional: true`** — anything in `steps` is required by default. AGENT 2 in the ENG 1 FIRE scenario is the canonical optional step.
- **Triggers that don't match wall-clock pacing** — if your `atMs` is too late, the pilot is staring at a normal cockpit waiting for something to happen. Aim for ≤8s after start.
- **Too many steps** — 4–5 works. 7+ feels like a checklist app, which is exactly the positioning Crosscheck rejects.
