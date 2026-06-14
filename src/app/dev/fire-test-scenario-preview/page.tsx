"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Preview: the NEW FireTestPanel3D driven by the REAL scenario engine.
//
// This route does NOT touch the live /train/eng1-fire-after-v1 scenario. It runs
// the same useScenarioRunner(eng1-fire-after-v1) engine, derives the exact props
// that fire-panel.tsx computes for the legacy FirePanel3D, and feeds them to our
// panel in `controlled` mode. Goal: see the new panel run the ENG 1 FIRE drill
// end-to-end against genuine engine state before swapping it into the scenario.
//
// Flow once loaded: fire_warn fires ~2 s in → FIRE pbs light red → lift ENG1
// guard, push FIRE pb → AGENT 1 → AGENT 2, each click advancing the real engine.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { FireTestPanel3D } from "@/components/cockpit/fire-test-panel-3d";
import { useScenarioRunner } from "@/lib/scenarios/runner";
import { getScenario } from "@/scenarios";

const SLUG = "eng1-fire-after-v1";

export default function FireTestScenarioPreviewPage() {
  const scenario = useMemo(() => getScenario(SLUG), []);
  // `key` remount = clean restart of the engine timeline.
  const [runKey, setRunKey] = useState(0);

  if (!scenario) {
    return (
      <main style={{ position: "fixed", inset: 0, background: "#05070a", color: "#eef6ff", display: "grid", placeItems: "center", fontFamily: "monospace" }}>
        Scenario “{SLUG}” not found.
      </main>
    );
  }

  return <PreviewInner key={runKey} scenario={scenario} onRestart={() => setRunKey((n) => n + 1)} />;
}

function PreviewInner({
  scenario,
  onRestart,
}: {
  scenario: NonNullable<ReturnType<typeof getScenario>>;
  onRestart: () => void;
}) {
  const runner = useScenarioRunner(scenario);
  const { state, perform, fireTrigger } = runner;

  // ── Derive panel props EXACTLY as fire-panel.tsx does for FirePanel3D ────────
  const completed = state.completedSteps;
  const triggers = state.triggersFired;

  const warningActive = !!triggers["fire_warn"];
  const fireExtinguished = !!triggers["fire_extinguished"];
  const fireLit = warningActive && !fireExtinguished;

  const firePbDone = !!completed["eng1_fire_pb"];
  const agent1Disch = !!completed["agent1"];
  const agent2Disch = !!completed["agent2"];

  const performStep = (id: string) => perform({ kind: "STEP", stepId: id });

  // Status / next-action readout
  const next =
    !fireLit ? "WAIT — fire warning arms ~8 s after start" :
    !firePbDone ? "Lift ENG1 guard → push FIRE pb" :
    !agent1Disch ? "Discharge AGENT 1" :
    !agent2Disch ? "Discharge AGENT 2 (if fire persists)" :
    "Drill complete";

  const Pill = ({ label, on, color }: { label: string; on: boolean; color: string }) => (
    <span style={{
      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
      color: on ? "#05070a" : "#8a93a0",
      background: on ? color : "#161b22",
      border: `1px solid ${on ? color : "#2a313b"}`,
    }}>{label}</span>
  );

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <FireTestPanel3D
        controlled
        framing="eng1"
        fireDetected={fireLit}
        firePbDone={firePbDone}
        agent1Disch={agent1Disch}
        agent2Disch={agent2Disch}
        onPushFirePb={() => performStep("eng1_fire_pb")}
        onPushAgent1={() => performStep("agent1")}
        onPushAgent2={() => performStep("agent2")}
      />

      {/* Engine-state readout — proves the panel is driven by the real reducer. */}
      <div style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        padding: "12px 18px", borderRadius: 12, zIndex: 10,
        background: "rgba(10,14,20,0.82)", border: "1px solid #2a313b",
        boxShadow: "0 6px 24px rgba(0,0,0,0.5)", fontFamily: "var(--font-cockpit, monospace)",
      }}>
        <div style={{ color: "#aeb8c4", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
          PREVIEW · real engine · ENG 1 controlled
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Pill label="FIRE" on={fireLit} color="#ff4d4d" />
          <Pill label="FIRE PB" on={firePbDone} color="#ffd24d" />
          <Pill label="AGENT 1" on={agent1Disch} color="#ffb300" />
          <Pill label="AGENT 2" on={agent2Disch} color="#ffb300" />
        </div>
        <div style={{ color: "#dfe6f0", fontSize: 12 }}>{next}</div>
      </div>

      {/* DEV MODE controls — skip the 8 s timeline so the drill can be driven now. */}
      <div style={{ position: "fixed", top: 16, right: 16, display: "flex", gap: 8, zIndex: 10 }}>
        <button type="button" onClick={() => fireTrigger("fire_warn")} disabled={fireLit}
          style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
            color: fireLit ? "#8a93a0" : "#eef6ff", background: fireLit ? "#1b2129" : "#c62828",
            border: `1px solid ${fireLit ? "#2a313b" : "#ff8a80"}`, borderRadius: 8,
            cursor: fireLit ? "default" : "pointer" }}>
          🔥 Trigger FIRE now
        </button>
        <button type="button" onClick={() => fireTrigger("fire_persists_30s")}
          style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700,
            color: "#eef6ff", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 8, cursor: "pointer" }}>
          Fire persists (AGENT 2)
        </button>
        <button type="button" onClick={onRestart}
          style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700,
            color: "#eef6ff", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 8, cursor: "pointer" }}>
          ↺ Restart
        </button>
      </div>
    </main>
  );
}
