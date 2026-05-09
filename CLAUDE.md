@AGENTS.md

# Crosscheck — project context

This repo is **Crosscheck**, an A320 abnormal-procedure training platform. MVP scenario: ENG 1 FIRE after V1.

- Read `PLAN.md` for architecture, milestones, and the scenario engine design.
- Read `~/.claude/projects/-Users-aditya-Code-pilotapp/memory/project_a320_platform.md` for the authoritative decision log (brand, scope, infra choices, why each call was made).

## Working rules in this repo

- **Stack is locked:** Next.js 16 + TypeScript + Tailwind v4 + Drizzle/Neon + Upstash + Clerk + Groq + PostHog. Don't propose Python, FastAPI, or alternative stacks. Don't reach for new infra without checking the memory log first.
- **Engine logic is isomorphic** — `src/engine/*` is pure TypeScript with no I/O, runs on both client and server. Keep it that way.
- **Scenarios are data**, not code — see `src/scenarios/eng1-fire-after-v1.ts`. New scenarios should be data definitions, not new modules with custom logic.
- **LLM calls go through `@/lib/llm`** with the provider abstraction. Don't import `groq-sdk` anywhere else.
- **Procedure content** (ECAM trees, callouts, scoring criteria) requires **SME pilot review** before user-visible release. Flag changes that need this pass.
- **No payments, no multi-tenancy, no offline, no mobile** in MVP. If a task drifts toward those, push back.

## Manual-first rule for Airbus content (FCOM brain)

For ANY work involving Airbus procedures, ECAM/EWD logic, system behaviour
(ENG, HYD, ELEC, FIRE, FUEL, BLEED, APU, F/CTL, NAV…), abnormal/emergency
content, callouts, tasksharing, or new scenario authoring — invoke the
`a320-fcom-trainer` skill BEFORE writing or modifying code. The skill enforces
a manual-first, READ-ONLY workflow: extract from FCOM/FCTM/QRH/SOP first,
classify findings, produce an assessment, and gate code changes behind the
trigger phrases listed in `.claude/skills/a320-fcom-trainer/SKILL.md` §7.

Pure UI/styling/layout changes (colour, font size, position, animation, copy
edits, dev tooling) do NOT need the skill — just edit. When uncertain whether
a change is "UI" or "procedure", default to invoking the skill.
