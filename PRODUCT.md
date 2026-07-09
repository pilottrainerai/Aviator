# PRODUCT.md — Crosscheck

## Register

**Product / tool UI.** Design *serves* the task; it is not the product. This is a real-time, high-information-density **A320 abnormal-procedure training simulator** used under cognitive load. The closest design neighbours are flight-deck glass, mission-control consoles, and trading terminals — not marketing or content surfaces.

## What it is

Crosscheck is interactive, real-time training for airline pilots. The trainee runs an abnormal/emergency procedure end-to-end in a cockpit-faithful screen (PFD, ND, ECAM/EWD, system display, overhead/fire panels, glareshield), is scored on **correctness, sequence, and decision quality**, and receives an AI debrief. MVP scenario family: ENG 1 FIRE after V1, DUAL HYD G+Y, ELEC EMER, RAPID DEPRESS, etc.

## Users

Type-rated A320 airline pilots and training captains. Expert domain users. They read ECAM/FCOM fluently, expect exact phraseology and instrument fidelity, and are unforgiving of anything that looks "gamified" or wrong. The interface is used in a focused, time-pressured loop (aviate → navigate → communicate → ECAM actions).

## Purpose / desired outcome

Let a pilot execute the real procedure with the real task-sharing and decision points, and make the **one correct next action** unmistakable at a glance — without dumbing down the cockpit. Speed and clarity of the scan matter more than decoration.

## Brand personality

Serious, precise, aviation-grade, calm under pressure. Instrument-panel restraint: dark, legible, purposeful. Confidence comes from accuracy and clarity, never from flourish.

## Anti-references

- Consumer quiz / gamified e-learning apps (badges, mascots, confetti).
- SaaS-cream dashboards, rounded pastel cards, marketing gradients.
- Glassmorphism, decorative motion, hero-metric templates.
- Anything that reads "AI-generated dashboard."

## Hard constraint — FCOM fidelity (read before restyling)

The actual **instrument renderings are spec-locked**, not free design surface. PFD, ND, ECAM/EWD, system display (SD), FMA, glareshield lights, fire/overhead pushbuttons follow FCOM `DSC-XX-YY` geometry, colours, and behaviour and are governed by the `cockpit-ui`, `pfd-instruments`, and `a320-fcom-trainer` skills. Their colours (Airbus green/amber/red/cyan/magenta semantics) and layouts must **not** be casually restyled.

Design freedom lives in the **shell/chrome around the instruments**: panel framing, backgrounds/elevation, spacing and rhythm, the header/clock, the procedure / comms / decision / guidance / context cards, and the **training-guidance flash system** (which surface pulses, how it reads). Improve visibility and hierarchy there — without breaking instrument fidelity.

## Strategic design principles

1. **One next action, unmistakable.** The current step's surface must win the scan instantly; everything else recedes.
2. **Density with hierarchy, not density as noise.** Pilots want all the data — but grouped, with clear elevation tiers (active vs idle vs reference) so the eye isn't flat-scanning 25 equal boxes.
3. **Legibility under load.** Minimum readable type; verified contrast on every panel; no dim-gray-on-near-black body text.
4. **Instrument-true colour.** Reserve Airbus semantic colours for their real meaning; use neutral chrome for framing so semantic colour stays meaningful.
5. **Calm, purposeful motion.** The flash guides; it must be unmissable but not seizure-bright or constant everywhere at once.
