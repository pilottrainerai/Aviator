# Last Session Context — 2026-05-18

## What we built (MacBook Air session)

### 1. Phase-based cockpit channel types
**File:** `src/scenarios/types.ts`

Added `ScenarioPhase` with 7 channels — all optional, no breaking changes:
- `pfd` → `PFDSnapshot` (speed, altitude, FMA, AP/ATHR state)
- `nd` → `NDSnapshot` (mode, range, heading, waypoint)
- `pf` → `PFState` (task + spoken callouts)
- `pm` → `PMState` (task + spoken callouts)
- `atc` → `ATCChannel` (transmissions, who initiated)
- `overhead` → `OverheadSnapshot` (panel items)
- `Scenario.phases?: readonly ScenarioPhase[]` added to the Scenario type

### 2. ENG FAIL after V1 — 10 FCTM phases
**File:** `src/scenarios/data/eng-failure-after-v1.ts`

All sourced from FCTM OP-020 + FCOM PRO-ABN-ENG:

| # | Phase | atMs |
|---|---|---|
| 1 | V1 Passed — Takeoff Committed | 6 000 |
| 2 | ENG 1 FAIL — Asymmetric Thrust | 8 000 |
| 3 | Rotation — VR 12.5° | 10 000 |
| 4 | Gear Up — AP1 Engaged | 14 000 |
| 5 | 400 ft — ECAM Actions | 18 000 |
| 6 | ECAM: MODE SEL IGN / THR LEVER IDLE | 20 000 |
| 7 | Relight Monitor — 30 Seconds | 22 000 |
| 8 | ENG 1 MASTER OFF — Secondary Failures | 52 000 |
| 9 | Eng-Out Accel Altitude — Level Off / Clean | 55 000 |
| 10 | MCT Set — Single-Engine Climb at Green Dot | 75 000 |

## What's next

1. **ENG 1 FIRE** (`src/scenarios/data/eng1-fire-after-v1.ts`) — populate phases the same way (fire-specific: MASTER OFF → FIRE PB → AGENT 1 → check fire light → AGENT 2 if needed)
2. **Other scenarios** — rapid depress, dual hyd, etc. — same pattern
3. **UI cards** — render the channel boxes (PFD card, ND card, PF card, PM card, ATC card, overhead card) — **deferred, backend/data only for now**

## Branch / repo state
- All work is on **main** (macbook branch was merged and pushed)
- GitHub: github.com/pilottrainerai/Aviator
- On MacBook Pro: `cd` into Aviator folder, run `git pull`, then `npm run dev`
