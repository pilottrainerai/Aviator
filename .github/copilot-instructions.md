# Aviator — GitHub Copilot Instructions

This repo is **Crosscheck**, an A320 abnormal-procedure training platform.
MVP scenario: ENG 1 FIRE after V1.

## Project context

- **Stack is locked:** Next.js 16 + TypeScript + Tailwind v4 + Drizzle/Neon +
  Upstash + Clerk + Groq + PostHog. Don't propose Python, FastAPI, or
  alternative stacks. Don't reach for new infra.
- **Next.js 16 has breaking changes** from prior versions. APIs, conventions,
  and file structure may differ from your training data. Heed deprecation
  notices.
- **Engine logic is isomorphic** — `src/engine/*` is pure TypeScript with
  no I/O, runs on both client and server. Keep it that way.
- **Scenarios are data, not code** — see `src/scenarios/eng1-fire-after-v1.ts`.
  New scenarios should be data definitions, not new modules with custom logic.
- **LLM calls go through `@/lib/llm`** with the provider abstraction. Don't
  import `groq-sdk` anywhere else.
- **Procedure content** (ECAM trees, callouts, scoring) requires SME pilot
  review before user-visible release. Flag changes that need this pass.
- **No payments, no multi-tenancy, no offline, no mobile** in MVP. Push back
  if a task drifts toward those.

## Manual-first rule for Airbus content

The Aviator project enforces a **manual-first, READ-ONLY workflow** for all
A320 content. Procedure text, callouts, ECAM logic, PF/PM tasksharing,
and cockpit visuals must match Airbus source documents exactly.

**Your own knowledge of "how A320 procedures work" is NOT a valid source.**
Only what is extracted from the manuals (FCOM, FCTM, QRH) counts.

Three scoped skills enforce this discipline, auto-loaded based on the files
you're editing:

| Skill | Files | What it covers |
|---|---|---|
| `cockpit-ui` | `src/components/cockpit/**`, `src/components/pfd/**`, `src/components/nd/**`, `src/components/ewd/**`, `src/components/sd/**` | Visual rendering — colors, geometry, animation, states |
| `a320-fcom-trainer` | `src/scenarios/**`, `src/engine/ecam/**` | Procedure steps, callouts, ECAM logic |
| `blender-panels` | `blender/**/*.py`, `docs/blender*.py` | Blender panel scripting from references |

If a request touches files covered by one of these skills, that skill's
intake and stop-rules apply BEFORE any code is written.

- `cockpit-ui`: use the six-input intake for cockpit visuals before any UI code.
- `a320-fcom-trainer`: collect the abnormal/procedure source text, PF/PM
  split, start state, and end state before editing scenario or ECAM logic.
- `blender-panels`: collect panel name, goal, reference images, dimensions,
  output target, and user inputs before editing Blender scripts.

If the required inputs are missing, stop and ask only for the missing inputs.

## Source priority for Airbus work

When Airbus content is in scope, use sources in this order:

1. `docs/manuals/` inside the repo when those files are provided locally
2. The reference PDFs at repo root when those files are provided locally
3. User-provided reference photos or pasted extracts
4. `~/.claude/manuals/a320/` only as the upstream source mirror

If repo manuals and user-provided extracts differ, surface the conflict and
ask which source should drive the change. Do not silently merge them.

Do not assume copyrighted manuals or extracted text are committed to Git.
They may exist only in a local/private working copy.

## Cockpit UI boundary

When the task is cockpit UI only:

- Treat `src/components/**` visuals as a separate target from Blender assets.
- Do not use `blender/**/*.py`, rendered Blender outputs, or existing 3D
  panel geometry as visual truth for UI implementation.
- Blender files may help locate names, grouping, or rough panel structure,
  but they are not an authoritative source for UI colors, proportions,
  spacing, or panel-face artwork.
- If a UI visual detail is not explicitly visible in the supplied photo or
  stated in the manuals, do not add it.

This applies especially to panel-face graphics such as lines, arrows,
brackets, boxed labels, or flow artwork.

## Do not infer panel-face artwork

For cockpit UI, only render panel-face artwork when at least one of these is true:

1. It is clearly visible in the user-provided reference image.
2. The user explicitly asks for it.
3. The relevant manual extract explicitly describes or depicts it.

If none of those are true, leave it out and ask.

## What counts as "code without a trigger"

Don't generate code in these cases until the user explicitly says one of
the trigger phrases listed in the relevant skill instructions:
- "go" — approve intake/plan
- "Apply this fix" — surgical change
- "Rebuild this element" — full rewrite, restarts intake
- "Match the FCOM spec" — apply all fcom-sourced divergences

If a request asks for code without a clear trigger, respond with the
relevant intake checklist and ask which inputs are missing.

This no-code rule applies to cockpit UI, procedure logic, and Blender panel
work equally. Do not bypass it just because the request sounds specific.

## Source library locations

- Manuals in repo: `docs/manuals/` when present in the local/private working copy
- Manuals (text-extracted source): `~/.claude/manuals/a320/` (fcom-full.txt,
  fctm-full.txt, tasksharing.txt, callouts.txt, abnormal-procs.txt,
  abnormal-notes.txt, eng-malfunctions.txt, cockpit-fam.txt)
- Source PDFs (reference): `414215430-FCOM-...pdf`, `348571042-FCTM.pdf`,
  `a320-abnormal-procedures.pdf` at repo root when present locally
- Reference photos: `~/Desktop/PANELS/` (fire panel, HYD, AIR COND, etc.)

## Pure dev-tooling exceptions

These don't trigger the manual-first skills — just edit:
- Build config, lint config, dependency updates
- Documentation files (README, PLAN.md edits)
- Test infrastructure (not test content for procedures)
- Copy/style edits outside procedure or cockpit components

## Expected behavior when content is under-specified

If the user asks for Airbus content but the request is under-specified:

- Do not invent geometry, colors, states, callouts, timings, or logic.
- Do not "fill in the obvious parts" from model knowledge.
- Do not carry over visual assumptions from older repo scripts or renders.
- State which source-backed values are missing.
- Ask for the minimum missing inputs needed to continue.
