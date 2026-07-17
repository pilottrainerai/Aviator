"use client";

// A320 BLEED SD (lower ECAM) — ENG 1 FIRE / FAIL: ENG 1 bleed + PACK 1 lost.
// Source: user designer SVG (Desktop/SD/bleed panel.svg → public/models/sd-bleed.svg). Values mirrored
// from the user's BLEED failure reference (which showed ENG 2 failed) per KB
// abnormals/captures/eng-1-fire/sd-pages/README.md: failed side PSI 0 amber / 42 °C, HP valve amber,
// pack C 21 °C / LO 65 °C; live side 36 PSI / 259 °C, C 20 °C / LO 182 °C.
// Valve states follow the scenario's own FCOM state (eng1-fire-after-v1.ts:2052/2083): FIRE pb shut the
// ENG 1 bleed SOV (amber), PACK 1 lost its supply → FAULT/OFF (amber), X BLEED SHUT + APU BLEED OFF
// (green — commanded, not faults). Closed-valve convention copied from the RAM AIR valve in the same SVG.
//
// Served as a static <img> (isolates its cls-N classes from the other SDs — no @scope needed).
// ponytail: single state — the page only appears at the CLEAR AIR BLEED card, long after the engine is
// secured, so no `secured` prop is needed (cf. EngineSdPage). Values edited in the public SVG.

export function BleedSdPage() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src="/models/sd-bleed.svg" alt="BLEED system display" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  );
}
