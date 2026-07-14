"use client";

// A320 ELEC SD (lower ECAM) — ENG 1 FIRE / FAIL: GEN 1 offline (engine 1 secured).
// Source: user designer SVG (Downloads/elec panel.svg → public/models/sd-elec.svg), edited so GEN 1
// reads amber 0 %/0 V/0 HZ with an amber box and IDG 1 cools to 46 °C. The AC 1 bus stays powered (via
// bus-tie), GEN 2 normal. Mirrors the user's ELEC reference (which showed GEN 2 offline on the ENG 2 side).
//
// Served as a static <img> (isolates its cls-N classes from the other SDs — no @scope needed).
// ponytail: <img> keeps the 18 KB asset out of the bundle; values edited in the public SVG.

export function ElecSdPage() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src="/models/sd-elec.svg" alt="ELEC system display" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  );
}
