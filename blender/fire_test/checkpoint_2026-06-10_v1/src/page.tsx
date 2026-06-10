"use client";

import { useEffect, useState } from "react";
import { FireTestPanel3D } from "@/components/cockpit/fire-test-panel-3d";

export default function FireTestPanel3DDevPage() {
  const [fireDetected, setFireDetected] = useState(false);
  const [firePbDone, setFirePbDone] = useState(false);
  const [agent1Disch, setAgent1Disch] = useState(false);
  const [agent2Disch, setAgent2Disch] = useState(false);

  // Dev helper: allow ?fire=1&pb=1&a1=1&a2=1 to preset the sequence state so
  // each discharge step can be loaded directly (e.g. for screenshots/QA).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if ([...q.keys()].length === 0) return;
    if (q.has("fire")) setFireDetected(q.get("fire") === "1");
    if (q.has("pb")) setFirePbDone(q.get("pb") === "1");
    if (q.has("a1")) setAgent1Disch(q.get("a1") === "1");
    if (q.has("a2")) setAgent2Disch(q.get("a2") === "1");
  }, []);

  function reset() {
    setFireDetected(false);
    setFirePbDone(false);
    setAgent1Disch(false);
    setAgent2Disch(false);
  }

  const activeStepId =
    !firePbDone && fireDetected ? "eng1_fire_pb" :
    firePbDone && !agent1Disch ? "agent1" :
    agent1Disch && !agent2Disch ? "agent2" :
    undefined;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#070a0e",
        color: "#8fa5bd",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        padding: "32px 24px",
        fontFamily: "monospace",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#56687a" }}>
        Fire Test Panel 3D · Downloads Blend · ENG1 Practice Contract
      </div>

      <div
        style={{
          width: "min(1180px, 100%)",
          height: 520,
          background: "#05070a",
          border: "1px solid #1d2834",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <FireTestPanel3D
          fireDetected={fireDetected}
          firePbDone={firePbDone}
          agent1Disch={agent1Disch}
          agent2Disch={agent2Disch}
          agent2Available={true}
          activeStepId={activeStepId}
          onFireDetect={() => setFireDetected(true)}
          onPushFirePb={() => setFirePbDone(true)}
          onPushAgent1={() => setAgent1Disch(true)}
          onPushAgent2={() => setAgent2Disch(true)}
        />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { label: "FIRE DETECTED", active: fireDetected, color: "#ff2218" },
          { label: "FIRE PB OUT", active: firePbDone, color: "#ff2218" },
          { label: "AGENT 1 DISCH", active: agent1Disch, color: "#ffb300" },
          { label: "AGENT 2 DISCH", active: agent2Disch, color: "#ffb300" },
        ].map(({ label, active, color }) => (
          <div
            key={label}
            style={{
              padding: "4px 12px",
              fontSize: 10,
              letterSpacing: "0.18em",
              border: `1px solid ${active ? color : "#1d2834"}`,
              color: active ? color : "#354251",
              background: active ? `${color}1f` : "transparent",
              borderRadius: 2,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn
          label={fireDetected ? "FIRE OFF" : "FIRE ON"}
          active={fireDetected}
          color="#ff2218"
          onClick={() => setFireDetected((v) => !v)}
        />
        <Btn
          label="PUSH FIRE PB"
          active={firePbDone}
          color="#ff2218"
          disabled={firePbDone || !fireDetected}
          onClick={() => setFirePbDone(true)}
        />
        <Btn
          label="DISCH AGENT 1"
          active={agent1Disch}
          color="#ffb300"
          disabled={agent1Disch || !firePbDone}
          onClick={() => setAgent1Disch(true)}
        />
        <Btn
          label="DISCH AGENT 2"
          active={agent2Disch}
          color="#ffb300"
          disabled={agent2Disch || !agent1Disch}
          onClick={() => setAgent2Disch(true)}
        />
        <Btn label="RESET" active={false} color="#56687a" onClick={reset} />
      </div>

      <div style={{ fontSize: 10, color: "#354251", letterSpacing: "0.14em" }}>
        public/models/fire_test_panel.glb · blender/fire_test/fire_test.blend
      </div>
    </main>
  );
}

function Btn({
  label,
  active,
  color,
  disabled = false,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 120,
        padding: "7px 14px",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        borderRadius: 2,
        border: `1px solid ${active ? color : disabled ? "#16202a" : "#2b3b4a"}`,
        color: disabled ? "#2a3440" : active ? color : "#7898b8",
        background: active ? `${color}1f` : "#080d13",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "monospace",
      }}
    >
      {label}
    </button>
  );
}
