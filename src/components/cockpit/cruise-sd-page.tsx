"use client";

// A320 CRUISE SD (lower ECAM) — the flight-phase page shown AFTER the ECAM procedure is complete, once
// the crew levels off / holds to burn down below MLW (single-engine, overweight). FCOM DSC-31-20: the SD
// reverts to the flight-phase page after STATUS. Compact ENG (F.USED / OIL QT / VIB) + AIR (LDG ELEV,
// cabin ΔP, CAB V/S, CAB ALT, zone temps) summary.
//
// ENG 1 = the secured engine, so its column reads the reduced values (F.USED frozen lower, VIB low),
// matching the ENGINE SD page. Source: user designer SVG (cruise display.svg → public/models/sd-cruise.svg),
// viewBox cropped above the strip line (the shared SdPermanentStrip is rendered by the runner). Served via
// <img> (isolates cls-N).

export function CruiseSdPage() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src="/models/sd-cruise.svg" alt="CRUISE system display" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  );
}
