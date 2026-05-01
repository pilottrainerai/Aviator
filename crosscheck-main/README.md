# Crosscheck

Interactive, real-time training for airline pilots. MVP scenario: **ENG 1 FIRE after V1** on the A320.

> Decision-based abnormal-procedure training with AI debrief. Not a checklist app, not a flight simulator.

## Stack

- **Next.js 16** (App Router, Turbopack, TypeScript) — frontend + API routes on a single Vercel deploy
- **Neon Postgres** + **Drizzle ORM** for durable state
- **Upstash Redis** for live session ticks
- **Clerk** auth (Google SSO + email magic link)
- **Groq + Llama 3.3 70B** for AI scoring + chat-style debrief (provider-swappable)
- **PostHog** for product analytics
- Cockpit visual direction: dark mode, Inter + JetBrains Mono, amber/red/green semantic palette

## Repo layout

```
src/
├── app/                 # Next.js routes (marketing, app, api)
├── engine/              # Isomorphic simulation core (pure TS, no I/O)
├── scenarios/           # Scenario definitions (data, not code)
├── components/
│   ├── cockpit/         # Bespoke panels, switches, displays
│   ├── ewd/             # Engine warning display + ECAM
│   ├── debrief/         # Score rubric, replay scrubber, chat
│   └── ui/              # shadcn primitives (added as needed)
├── lib/
│   ├── llm/             # Provider abstraction (Groq default)
│   ├── db/              # Drizzle client + schema
│   └── ...              # auth, redis, analytics
└── styles/
```

## Getting started

```bash
# 1. Install deps (first time)
npm install

# 2. Set up environment
cp .env.example .env.local
# Then fill in the keys — see .env.example for what each is.

# 3. Run the database migrations (once DATABASE_URL is set)
npm run db:push

# 4. Start the dev server
npm run dev
```

The app runs at <http://localhost:3000>.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migrations from `schema.ts` |
| `npm run db:push` | Apply schema directly (dev) |
| `npm run db:studio` | Open Drizzle Studio |

## Architecture & decisions

See **`PLAN.md`** for the full architecture plan, milestones, and open questions.

The authoritative log of *every* product/infra decision lives in your local Claude Code memory at `~/.claude/projects/-Users-aditya-Code-pilotapp/memory/project_a320_platform.md`.
