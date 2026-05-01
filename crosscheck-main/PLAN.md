# Crosscheck — Architecture Plan

A320 interactive training platform. MVP: ENG 1 FIRE after V1, full loop trigger → debrief.

> Decisions log: see `/Users/aditya/.claude/projects/-Users-aditya-Code-pilotapp/memory/project_a320_platform.md` for the authoritative source-of-truth on every product/infra choice.

---

## 1. North Star — what the demo proves

Walk into the room, log in, fly ENG 1 FIRE in real time, see a graded rubric and an AI debrief, scrub the timeline. That's it. Every architectural choice serves this loop on this single scenario. Breadth comes after.

## 2. Stack — single-deploy, free-tier first

| Layer | Choice |
|---|---|
| Frontend + backend | **Next.js 15** (App Router, Turbopack, TypeScript) |
| Hosting | **Vercel** (single deploy: pages + Route Handlers + Server Actions) |
| Database | **Neon Postgres** (serverless, branchable) |
| ORM | **Drizzle ORM** (TS-native, lean, edge-compatible) |
| Cache / session ticks | **Upstash Redis** (REST-friendly, edge-compatible) |
| Auth | **Clerk** (Google SSO + email magic link) |
| LLM | **Groq + Llama 3.3 70B** via provider-swappable interface (Anthropic backup) |
| Analytics | **PostHog** (free tier, key events) |
| Audio | Native `<audio>` for MASTER WARN + CRC |
| Real-time | Client-side simulation tick + Route Handler checkpoints (no long-lived WS — Vercel constraint) |
| Styling | **Tailwind v4** + custom cockpit tokens (amber/red/green palette, Inter + Berkeley Mono) |
| UI primitives | **shadcn/ui** (radix-based) for menus/dialogs only — cockpit components are bespoke |

## 3. Repo layout (single Next.js app, modular packages-style)

```
crosscheck/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (marketing)/           # Landing, waitlist
│   │   ├── (app)/
│   │   │   ├── train/             # Scenario runner (live cockpit)
│   │   │   ├── debrief/[id]/      # Replay + AI debrief
│   │   │   └── layout.tsx         # Authed shell
│   │   ├── api/                   # Route Handlers
│   │   │   ├── scenarios/         # List/load scenario defs
│   │   │   ├── sessions/          # Create/checkpoint/finalize
│   │   │   ├── debrief/           # LLM scoring + debrief
│   │   │   └── waitlist/          # Email capture
│   │   └── layout.tsx
│   ├── engine/                    # Isomorphic simulation core (no I/O)
│   │   ├── state.ts               # AircraftState, ECAMState, EngineState
│   │   ├── reducer.ts             # (state, event) → state
│   │   ├── triggers.ts            # Time/condition-driven state transitions
│   │   └── ecam/                  # ECAM tree, message logic, clear/recall
│   ├── scenarios/                 # Scenario definitions (data, not code)
│   │   └── eng1-fire-after-v1.ts  # The MVP scenario
│   ├── components/
│   │   ├── cockpit/               # Bespoke: panels, switches, displays
│   │   ├── ewd/                   # Engine warning display + ECAM messages
│   │   ├── debrief/               # Score rubric, replay scrubber, chat
│   │   └── ui/                    # shadcn primitives
│   ├── lib/
│   │   ├── llm/                   # Provider abstraction (Groq default)
│   │   ├── db/                    # Drizzle client + schema
│   │   ├── redis.ts               # Upstash client
│   │   ├── analytics.ts           # PostHog wrapper
│   │   └── auth.ts                # Clerk helpers
│   └── styles/
│       ├── tokens.css             # Cockpit palette, type scale
│       └── globals.css
├── public/
│   ├── audio/                     # MASTER WARN, CRC
│   └── cockpit/                   # Photoreal panel art (TBD sourcing)
├── drizzle/                       # Migrations
├── PLAN.md                        # This file
└── package.json
```

## 4. Data model (initial)

```
users (managed by Clerk; we mirror clerk_id)
  id, clerk_id, email, created_at

waitlist
  id, email, source, created_at

scenarios
  id, slug, title, version, definition_json, created_at
  -- definition is the scenario DSL (see §5); seeded with ENG 1 FIRE

sessions
  id, user_id, scenario_id, scenario_version, started_at, ended_at, status
  -- status: in_progress | completed | abandoned

session_events                     -- the action log
  id, session_id, t_ms, kind, payload_json, created_at
  -- kind: 'action' | 'state_snapshot' | 'trigger_fired' | 'phase_change'

debriefs
  id, session_id, rubric_json, composite_score, narrative, created_at
  -- rubric_json: {correctness: {score, evidence}, sequence: {...}, decision: {...}}

debrief_messages                   -- chat follow-ups
  id, debrief_id, role, content, created_at
```

Session ticks while running live in **Upstash Redis** keyed by `session:{id}:state` for low-latency reads/writes; flushed to Postgres on checkpoint and at session end. This keeps Vercel functions stateless.

## 5. Scenario DSL (data-driven, not hardcoded)

The engine reads scenarios as data so adding a second scenario later is content, not code.

```ts
type Scenario = {
  slug: string;
  title: string;
  initialState: AircraftState;        // fuel, altitude, speed, weight, weather, ENG x running
  triggers: Trigger[];                 // e.g., at t=4s after takeoff roll → ENG_1_FIRE
  ecamTree: ECAMNode[];                // root: FIRE > ENG > 1; children = action items
  validActions: Action[];              // what hotspots/controls the user can interact with
  decisionPoints: DecisionPoint[];     // pause-or-not (we use real-time, but eval points exist)
  scoringCriteria: {                   // evaluated by LLM
    correctness: string;               // natural-language criterion text
    sequence: string;
    decision: string;
  };
  branches: Branch[];                  // probabilistic outcomes (AGENT 1 may not extinguish)
};
```

The MVP scenario: `eng1-fire-after-v1.ts` encodes the full ECAM tree (MASTER 1 OFF → ENG 1 FIRE pb → AGENT 1 → wait 30s → AGENT 2 if needed → LAND ASAP decision → divert), with the well-known A320 abnormal procedure variants.

## 6. Engine architecture

Isomorphic TS — runs both client (for sub-second ticks during a session) and server (for authoritative scoring). Pure functions, no I/O.

```
loop @ 10 Hz on the client:
  state = reduce(state, [
    ...elapsedTimeEvents(prevTime, now),        // automatic ECAM transitions, fire spread
    ...userActions.drainSinceLastTick(),         // clicks/hotspots
  ]);
  if (snapshotDue) sendCheckpoint(state);        // every 1s → server, also on every action
  render(state);
```

Server validates each checkpoint (replay events server-side; reject if divergent). On session end, server has the full event log; LLM evaluates against `scoringCriteria`.

## 7. Real-time on Vercel

Vercel does not support long-lived WebSockets in the standard runtime. Approach:

- **Client owns the tick clock.** Engine reducer runs locally at 10 Hz.
- **Server authoritativeness via checkpoints.** Every action + every 1s snapshot, the client POSTs to `/api/sessions/[id]/checkpoint`. Server replays from last verified state, persists to Redis (hot) + Postgres (cold).
- **No server-pushed events needed for MVP.** Because the user is the only actor and there's no PM/instructor watching live, we don't need server→client streaming. Future feature (instructor live-watch) → switch to SSE or Pusher/Ably.

## 8. Scoring & debrief flow

```
session ends
  ↓
server has: scenario.scoringCriteria + full event log
  ↓
POST /api/debrief
  ↓ (LLM provider = Groq; model = llama-3.3-70b-versatile)
  ↓ system prompt: "You are an A320 type-rating examiner. Evaluate against:
                   correctness=…, sequence=…, decision=…. Return JSON."
  ↓ user prompt: scenario context + event log
  ↓
parse JSON → rubric_json + narrative
  ↓
write debriefs row
  ↓
client renders rubric + chat-style narrative
  ↓
follow-up chat (POST /api/debrief/[id]/chat) → same LLM, debrief context cached
```

## 9. Brand tokens (Tailwind v4 `@theme`)

```css
--color-bg: #0A0B0D;
--color-surface: #14161A;
--color-surface-2: #1C1F25;
--color-border: #2A2F38;
--color-text: #E6E8EC;
--color-text-muted: #8A92A0;

/* Cockpit semantic */
--color-amber: #FFB000;        /* CAUTION */
--color-red: #FF2C2C;          /* WARNING */
--color-green: #00C26B;        /* NOMINAL */
--color-blue: #4F8CFF;         /* INFORMATION */

/* Type */
--font-sans: "Inter", system-ui, sans-serif;
--font-mono: "Berkeley Mono", "JetBrains Mono", ui-monospace;
```

## 10. Milestones

### Week 1 — rough end-to-end (DoD = demoable)
- [ ] Repo + deploy pipeline live (Vercel, Neon, Upstash, Clerk, PostHog connected)
- [ ] Landing page with waitlist (no pricing)
- [ ] Auth (Clerk): Google + magic link
- [ ] Scenario engine reducer + ECAM tree for ENG 1 FIRE (data-only, no UI yet)
- [ ] Train route with placeholder cockpit (geometric panels, real switches): MASTER, FIRE pb, AGENT 1, AGENT 2
- [ ] Real-time tick + checkpoint → DB
- [ ] Score rubric route + LLM debrief (Groq) returning JSON
- [ ] Action timeline list (no scrub yet)
- [ ] **Wow beat:** one photoreal panel (overhead ENG section) wired through
- [ ] Story-mode click-through to fill in: full PFD/ND, missing audio, polish

### Weeks 2–3 — functional MVP
- [ ] Photoreal panels for all relevant cockpit sections (overhead full, ECAM panel, thrust quadrant)
- [ ] Live E-WD with real ECAM message clear/recall logic
- [ ] Scrubbable timeline replay with state at any t
- [ ] Branching outcomes wired (AGENT 1 effectiveness probabilistic)
- [ ] Multi-axis rubric with evidence per axis
- [ ] Chat follow-ups on debrief
- [ ] MASTER WARN + CRC audio

### Weeks 4–6 — polished MVP
- [ ] Visual polish pass (animations, motion design)
- [ ] PostHog funnels live
- [ ] SME review pass on procedure logic + content
- [ ] Pilot SME testing session
- [ ] Pricing page (still no checkout)
- [ ] Performance tuning (engine tick rate stability, LLM latency)
- [ ] Investor demo dry-run

## 11. SME checkpoints (mandatory)

Procedure content cannot ship to a user-facing surface without SME review. Mandatory pass-throughs:
- ECAM tree text + ordering (Week 1)
- Scoring criteria phrasing (Week 1, before first LLM call to a user)
- Audio fidelity (Week 2)
- Photoreal panel labeling (Week 2)
- Pre-investor-demo full session run (Week 6)

## 12. Risks I'm watching

| Risk | Mitigation |
|---|---|
| Photoreal cockpit imagery sourcing (clean slate, no assets) | Start with high-res public-domain references for layout; commission/license real renders before any external launch |
| Llama 3.3 70B quality vs. Opus on nuanced rubric scoring | Provider abstraction lets us swap to Anthropic in a single config change; prompt-engineer carefully against test action logs |
| Vercel cold starts on first interaction | Keep API handlers tiny; warm via PostHog event ping on landing |
| Real-time feel without WebSockets | Client-driven tick + ≤1s checkpoint; verified event log is server-authoritative |
| SME availability blocking content sign-off | Schedule SME review checkpoints into milestones, not as discoveries |
| User-perceived "is this just a checklist app?" | Differentiation must be visible in Week 1 demo: real-time pressure, AI debrief, decision phase scoring |

## 13. Open questions to resolve in next session

- Which exact A320 cockpit imagery source? (public-domain photos vs. licensed renders)
- Final Groq model selection — `llama-3.3-70b-versatile` is the planned default; verify availability + rate limits
- Does the SME want to author the ECAM tree directly in `eng1-fire-after-v1.ts` data or via a writeup we transcribe?
- Vercel project name + final deployed subdomain
