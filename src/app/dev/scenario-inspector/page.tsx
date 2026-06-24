"use client";

// DEV — Scenario Inspector page for DUAL HYD G+Y. Route: /dev/scenario-inspector
import { dualHydGY } from "@/scenarios/data/dual-hyd-g-y";
import { ScenarioInspector } from "@/components/dev/scenario-inspector";

export default function ScenarioInspectorPage() {
  return (
    <main style={{ height: "100vh", background: "#0A0F18" }}>
      <ScenarioInspector scenario={dualHydGY} />
    </main>
  );
}
