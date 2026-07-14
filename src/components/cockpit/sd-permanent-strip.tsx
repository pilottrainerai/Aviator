"use client";

// A320 SD permanent-data strip — the bottom bar shown UNDER every System Display page (TAT/SAT · UTC ·
// GW). ONE shared, live component so all SD pages stay in sync like the real aircraft: same GW everywhere,
// and GW reduces as fuel burns (driven from the runner). Replaces the per-page baked strips (those SVGs
// are now cropped above the strip line). [user 2026-07-14]

const WHITE = "#fff", GREEN = "#5aba47", CYAN = "#2dc3e8";
const sign = (n: number) => (n >= 0 ? "+" : "−") + Math.abs(n);

export function SdPermanentStrip({ tat, sat, clock, gw }: { tat: number; sat: number; clock: string; gw: number }) {
  const cell: React.CSSProperties = { flex: "1 1 0", display: "flex", alignItems: "center", justifyContent: "center" };
  const div: React.CSSProperties = { borderLeft: `2px solid ${WHITE}` };
  return (
    <div style={{ display: "flex", flexShrink: 0, borderTop: `2px solid ${WHITE}`, background: "#000",
      fontFamily: "var(--font-b612), Futura, monospace", fontWeight: 600, fontSize: "clamp(8px, 2.5vh, 15px)", lineHeight: 1.3 }}>
      <div style={{ flex: "1 1 0", padding: "3px 4% ", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div><span style={{ color: WHITE }}>TAT </span><span style={{ color: GREEN }}>{sign(tat)}</span><span style={{ color: CYAN }}> °C</span></div>
        <div><span style={{ color: WHITE }}>SAT </span><span style={{ color: GREEN }}>{sign(sat)}</span><span style={{ color: CYAN }}> °C</span></div>
      </div>
      <div style={{ ...cell, ...div, color: GREEN, letterSpacing: "0.08em" }}>{clock}</div>
      <div style={{ ...cell, ...div, gap: 6 }}>
        <span style={{ color: WHITE }}>GW</span><span style={{ color: GREEN }}>{gw}</span><span style={{ color: CYAN }}>KG</span>
      </div>
    </div>
  );
}
