"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DEV PAGE — FirePanel3D (Blender GLB baseline)
//
// Standalone interactive view of the Blender-sourced ENG1 fire panel.
// Loads public/models/fire_panel.glb and lets you step through the full
// FCOM procedure manually without needing a running scenario.
//
// URL: http://localhost:3000/dev/fire-panel-3d
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { FirePanel3D } from "@/components/cockpit/fire-panel-3d";

export default function FirePanel3DDevPage() {
  const [fireDetected, setFireDetected] = useState(false);
  const [firePbDone,   setFirePbDone]   = useState(false);
  const [agent1Disch,  setAgent1Disch]  = useState(false);
  const [agent2Disch,  setAgent2Disch]  = useState(false);

  function reset() {
    setFireDetected(false);
    setFirePbDone(false);
    setAgent1Disch(false);
    setAgent2Disch(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080C12",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 24px",
        gap: 32,
        fontFamily: "monospace",
        color: "#8899BB",
      }}
    >
      {/* Title */}
      <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "#4A5060" }}>
        FirePanel3D — Blender GLB Baseline · ENG1 Left Section
      </div>

      {/* Panel canvas */}
      <div
        style={{
          width: 380,
          height: 200,
          background: "#0A0E16",
          borderRadius: 4,
          border: "1px solid #1A2030",
          overflow: "hidden",
        }}
      >
        <FirePanel3D
          fireDetected={fireDetected}
          firePbDone={firePbDone}
          agent1Disch={agent1Disch}
          agent2Disch={agent2Disch}
          agent2Available={true}
          onFireDetect={() => setFireDetected(true)}
          onPushFirePb={() => setFirePbDone(true)}
          onPushAgent1={() => setAgent1Disch(true)}
          onPushAgent2={() => setAgent2Disch(true)}
        />
      </div>

      {/* State badge row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { label: "FIRE DETECTED", active: fireDetected,  color: "#FF3333" },
          { label: "FIRE PB OUT",   active: firePbDone,    color: "#FF3333" },
          { label: "AGENT 1 DISCH", active: agent1Disch,   color: "#FFB300" },
          { label: "AGENT 2 DISCH", active: agent2Disch,   color: "#FFB300" },
        ].map(({ label, active, color }) => (
          <div
            key={label}
            style={{
              padding: "4px 12px",
              fontSize: 10,
              letterSpacing: "0.2em",
              borderRadius: 2,
              border: `1px solid ${active ? color : "#1A2030"}`,
              color: active ? color : "#2A3040",
              background: active ? `${color}18` : "transparent",
              transition: "all 0.2s",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn
          label={fireDetected ? "FIRE OFF" : "FIRE ON"}
          active={fireDetected}
          color="#FF3333"
          onClick={() => setFireDetected(v => !v)}
        />
        <Btn
          label="PUSH FIRE PB"
          active={firePbDone}
          color="#FF3333"
          disabled={firePbDone}
          onClick={() => setFirePbDone(true)}
        />
        <Btn
          label="DISCH AGENT 1"
          active={agent1Disch}
          color="#FFB300"
          disabled={agent1Disch}
          onClick={() => setAgent1Disch(true)}
        />
        <Btn
          label="DISCH AGENT 2"
          active={agent2Disch}
          color="#FFB300"
          disabled={agent2Disch}
          onClick={() => setAgent2Disch(true)}
        />
        <Btn label="RESET" active={false} color="#4A5060" onClick={reset} />
      </div>

      {/* GLB source note */}
      <div style={{ fontSize: 10, color: "#2A3040", letterSpacing: "0.15em" }}>
        public/models/eng1_left_panel.glb · blender/eng1_left/eng1_left_panel.blend
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
        padding: "6px 16px",
        fontSize: 10,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        borderRadius: 2,
        border: `1px solid ${active ? color : disabled ? "#1A2030" : "#2A3848"}`,
        color: disabled ? "#2A3040" : active ? color : "#6688AA",
        background: active ? `${color}22` : "transparent",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "monospace",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}
