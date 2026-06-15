"use client";

// Dev sandbox for the ENG START panel (free orbit). Render-first; controls wired later.
import { EngStartPanel3D } from "@/components/cockpit/eng-start-panel-3d";

export default function EngStartPanel3DDevPage() {
  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <EngStartPanel3D />
      <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10,
        padding: "6px 14px", borderRadius: 8, background: "rgba(10,14,20,0.9)", border: "1px solid #2a313b",
        fontFamily: "monospace", fontSize: 12, color: "#8aabbb", letterSpacing: 1 }}>
        ENG START PANEL · render preview · drag to orbit
      </div>
    </main>
  );
}
