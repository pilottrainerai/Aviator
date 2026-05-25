/**
 * Aggregator for all playable scenarios. Adding a scenario:
 *   1. Author src/scenarios/data/<slug>.ts
 *   2. Add a META constant + entry to registry.ts
 *   3. Import the scenario object here and add to ALL_SCENARIOS
 */

import type { Scenario } from "./types";
import { eng1FireAfterV1 } from "./data/eng1-fire-after-v1";
import { engFailureAfterV1 } from "./data/eng-failure-after-v1";
import { rtoLowSpeed } from "./data/rto-low-speed";
import { dualHydGY } from "./data/dual-hyd-g-y";
import { dualHydGB } from "./data/dual-hyd-g-b";
import { dualHydGBLowLevel } from "./data/dual-hyd-g-b-low-level";
import { elecEmerConfig } from "./data/elec-emer-config";
import { rapidDepress } from "./data/rapid-depress";
import { smokeCabin } from "./data/smoke-cabin";
import { unreliableSpeed } from "./data/unreliable-speed";

export const ALL_SCENARIOS: Scenario[] = [
  eng1FireAfterV1,
  engFailureAfterV1,
  rtoLowSpeed,
  dualHydGY,
  dualHydGB,
  dualHydGBLowLevel,
  elecEmerConfig,
  rapidDepress,
  smokeCabin,
  unreliableSpeed,
];

export function getScenario(slug: string): Scenario | undefined {
  return ALL_SCENARIOS.find((s) => s.meta.slug === slug);
}

export type { Scenario } from "./types";
