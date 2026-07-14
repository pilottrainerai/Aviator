"use client";

// A320 WHEEL SD (lower ECAM) — the flight-phase page shown ON THE GROUND during takeoff (FCOM
// DSC-31-20, phases 2–5). This is the ENG 1 FIRE scenario's OPENING SD page, before the fire fires.
// Gear down (green), brakes released (REL), spoilers/speedbrakes retracted, doors closed — a normal
// takeoff-roll picture.
//
// Source: user designer SVG (WHEEL PANEL.svg → public/models/sd-wheel.svg) with the permanent strip set
// to the scenario values (TAT +33 / SAT +30 / 04 H 30 / GW 65000) and the °C mojibake fixed.
// Served via <img> (isolates its cls-N classes — no @scope needed).

export function WheelSdPage() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src="/models/sd-wheel.svg" alt="WHEEL system display" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  );
}
