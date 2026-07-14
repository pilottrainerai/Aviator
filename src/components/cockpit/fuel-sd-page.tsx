"use client";

// A320 FUEL SD (lower ECAM) — shown while the crew monitors IMBALANCE during ENG 1 FIRE / FAIL.
// Source: user-approved designer SVG (KB displays/assets/sd/SD-fuel.svg → public/models/sd-fuel.svg),
// with an ENG 1 imbalance baked in: ENG 1 (LEFT) is shut down, so the LEFT inner tank stays HIGHER
// (3315) while the RIGHT depletes (2945); in-flight FOB 7640 / F.FLOW 2180. Mirrors the user's failure
// reference (which showed the opposite side for ENG 2).
//
// The fuel SVG is a raster schematic (embedded PNG) + text — served as a static file and shown via
// <img>, which isolates its cls-N classes from svg-pfd / hyd-sd (no @scope needed for an external doc).
// ponytail: <img> keeps the 1.1 MB asset out of the JS bundle; values edited in the public SVG.

export function FuelSdPage() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src="/models/sd-fuel.svg" alt="FUEL system display" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  );
}
