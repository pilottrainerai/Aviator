# No Change Until Commanded

## The discipline

This skill exists to **understand**, not to ship. The user has working code
and working scenarios. Premature changes burn trust.

The default state is **read-only**. Code only changes when the user explicitly
authorizes it with one of the trigger phrases below.

## Trigger phrases (the only way to authorize changes)

- **"Proceed with implementation"** — execute the most recent assessment's recommendation. Limited to that assessment's scope.
- **"Rebuild this module"** — full rewrite of one named module. Scoped to one system at a time.
- **"Apply this fix"** — narrow, surgical change for a specific assessment item.

If the user's wording is ambiguous (e.g. "yes", "ok", "go"), ask which trigger
phrase applies. Do not infer authorization.

## What "do not modify" means in practice

| You may | You may NOT |
|---|---|
| Read any file in the repo | Edit, create, or delete project files |
| Run `git status`, `git log`, `git diff` | Run `git add`, `git commit`, `git push`, `git checkout`, `git reset`, `git stash drop` |
| Run `grep`/`find` over manuals + repo | Run `npm install`, `npm uninstall`, modify `package.json` |
| Start a dev server (already-approved tooling) | Refactor, rename, or restructure existing modules |
| Write notes to a temp file (`/tmp/...`) you tell the user about | Save anything inside `src/`, `scenarios/`, `engine/`, `components/` |
| Ask clarifying questions | Touch emergency / scenario / ECAM modules |

## When the user says "improve X" without a trigger

Respond with:
1. The standard assessment (see `improvement-assessment-template.md`).
2. A list of the trigger phrases above.
3. Ask which one applies.

Example:
> "I have an assessment ready for the APU start sequence. Three options:
> (a) Proceed with implementation — I'll add the missing flap-open timer
> only. (b) Rebuild this module — I'll rewrite `apu.ts` end-to-end against
> FCOM DSC-49. (c) Apply this fix — just patch the legend color. Which?"

## When the user says "fix the bug" but you have no assessment

Slow down. Run the §5 workflow first (project understanding → manual reading
→ extraction → comparison → assessment). Then ask for the trigger phrase.

A bug that "just needs a one-line fix" still needs the assessment, because
the one line might be load-bearing for a procedure the user hasn't named.

## Scope rules

- One system per task. APU **or** ENG **or** HYD — never two.
- One scenario per task if scenario logic is involved.
- If the user gives a wide scope ("update all emergency procedures"), reply
  with the assessment for the most-likely-meant single system and ask which
  to do first.

## Things that look like changes but aren't

These are read-only and always allowed:
- Showing a diff in chat (without applying it).
- Writing an assessment to a temp file outside the repo.
- Drafting state-machine pseudocode in chat.
- Summarizing what *would* change.

These are changes — never do them without a trigger:
- Editing an `.ts/.tsx` file.
- Adding a new file under `src/`.
- Modifying `package.json`, `tsconfig.json`, `eslint.config.mjs`.
- Touching `.env`, secrets, or env-specific config.

## Emergency / scenario / ECAM modules

Treat these as locked. They represent existing FCOM-aligned work the user
has built and validated. Even with a trigger phrase, confirm scope before
touching `src/scenarios/`, `src/engine/ecam/`, or `src/components/ewd/`.

If a change here is genuinely needed, present the assessment, name the
specific file, name the specific lines, and wait for an explicit "yes,
that file, those lines."
