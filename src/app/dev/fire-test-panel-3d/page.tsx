"use client";

import { useCallback, useEffect, useState } from "react";
import { FireTestPanel3D } from "@/components/cockpit/fire-test-panel-3d";

// Interactive ENG1 + APU + ENG2 FIRE panel. TEST lights every FIRE pb red; then on
// ANY section run the drill by clicking the real 3D controls:
//   lift guard → push FIRE pb (SQUIB white) → AGENT 1 / AGENT 2 (DISCH amber).
// Press R to reset.
export default function FireTestPanel3DDevPage() {
  const [fireDetected, setFireDetected] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const reset = useCallback(() => { setFireDetected(false); setResetSignal((n) => n + 1); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "r" || e.key === "R") reset(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <FireTestPanel3D fireDetected={fireDetected} resetSignal={resetSignal} />

      {/* TEST trigger (stands in for the FCOM ENG FIRE TEST pb). */}
      <button type="button" onClick={() => (fireDetected ? reset() : setFireDetected(true))}
        style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", padding: "14px 28px",
          fontSize: 18, fontWeight: 700, letterSpacing: 1, color: "#eef6ff", background: fireDetected ? "#555c66" : "#c62828",
          border: "2px solid #ff8a80", borderRadius: 10, cursor: "pointer", boxShadow: "0 4px 18px rgba(0,0,0,0.5)", zIndex: 10 }}>
        {fireDetected ? "↺ RESET" : "🔥 TEST — trigger FIRE"}
      </button>
    </main>
  );
}
