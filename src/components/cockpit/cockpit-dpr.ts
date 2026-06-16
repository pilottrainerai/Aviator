// ─────────────────────────────────────────────────────────────────────────────
// cockpitDpr — the REQUIRED device-pixel-ratio for every cockpit 3D <Canvas>.
//
// Cockpit panels carry fine detail: thin decal labels (ON/OFF/MASTER/CRANK…) and
// small geometry text (FIRE/FAULT, SQUIB/DISCH). At the native device ratio those
// soften/blur while only the large text stays sharp. We SUPERSAMPLE — render ~1.6×
// the device pixel ratio (capped at 3) — so everything reads crisp.
//
// IMPORTANT: do NOT use a `dpr={[min,max]}` range for this — R3F clamps the range to
// the display's own ratio, so on a 2× screen it renders at 2× and never supersamples.
// Pass a single number (this function) instead.
//
// Every cockpit Canvas (fire panel, ENG START panel, future panels) must use this.
// ─────────────────────────────────────────────────────────────────────────────
export function cockpitDpr(): number {
  const base = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 2;
  return Math.min(3, base * 1.6);
}
