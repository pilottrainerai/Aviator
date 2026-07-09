"use client";

// A320 ECAM STATUS page — FCOM PRO-ABN-ENG p.39-42
// Two-column layout: left = status/limitations, right = INOP SYS.
// Appears after all required ECAM actions are complete.

import type { Scenario } from "@/scenarios/types";
import type { ScenarioState } from "@/engine/state";

const C = {
  red:    "#FF3333",
  amber:  "#FFB300",
  green:  "#00D060",
  cyan:   "#00CFFF",
  white:  "#E8ECF4",
  dim:    "#6A7488",
  border: "#1C2130",
} as const;

function statusColor(severity: "caution" | "advisory" | "memo"): string {
  switch (severity) {
    case "caution":  return C.amber;
    case "advisory": return C.cyan;
    case "memo":     return C.green;
  }
}

// STATUS is the LAST SD page: it appears only after the crew announces STATUS
// (P10 `announce_status` — the synoptic/WHEEL review is done). Scenarios without
// that cue fall back to "all ECAM actions complete". Exported so the SD cell can
// show the system synoptic (HYD…) until this flips true. Single source of truth.
export function isStatusReady(scenario: Scenario, state: ScenarioState): boolean {
  const hasStatusCue = scenario.steps.some((s) => s.id === "announce_status");
  if (hasStatusCue) return !!state.completedSteps["announce_status"];
  return scenario.steps.filter((s) => !!s.ecamRef).every((s) => !!state.completedSteps[s.id]);
}

export function StatusPanel({
  scenario,
  state,
  sat,
  tat,
}: {
  scenario: Scenario;
  state: ScenarioState;
  sat?: number;   // live static air temp (°C); falls back to static
  tat?: number;   // live total air temp (°C)
}) {
  if (!isStatusReady(scenario, state) || !scenario.statusItems?.length) return null;

  const leftItems  = scenario.statusItems.filter((i) => !i.inopSys);
  const allInop    = scenario.statusItems.filter((i) =>  i.inopSys);

  // STATUS overflow (FCOM DSC-31-20 §8): when INOP SYS runs past the page a green ↓ arrow
  // appears; the crew presses CLR to "scroll the display to view the overflow". Before the
  // CLR card → show page 1 + ↓ arrow; after it → scroll to the overflowed systems + ↑ arrow.
  const INOP_PAGE = 12;                                   // lines that fit before the arrow
  const hasOverflow = allInop.length > INOP_PAGE;
  // Reveal the overflow (scroll to remaining + arrow flips) on the FIRST INOP-SYS card's confirm,
  // so the remaining systems are already shown on the NEXT card. [user 2026-07-06]
  const overflowCleared = !!state.completedSteps["inop_sys_card"];
  const rightItems = !hasOverflow
    ? allInop
    : overflowCleared
      ? allInop.slice(INOP_PAGE)                          // CLR pressed → scrolled to overflow
      : allInop.slice(0, INOP_PAGE);                      // page 1

  return (
    <div
      className="select-none border"
      style={{
        // Fill the STATUS grid cell (equal-sized Airbus screens) instead of a fixed
        // 240px box — expands down to show more lines; overflow still scrolls.
        // Same font as the E/WD (B612 — the Airbus cockpit-display face).
        fontFamily: "var(--font-b612)",
        flex: "1 1 0",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#000000",
        borderColor: C.border,
        overflowY: "auto",
      }}
    >
      {/* STATUS header — centred + underlined. NO line under it (per the real SD). */}
      <div className="flex items-center justify-center px-3 py-[6px]">
        <span style={{ color: C.white, fontSize: "13px", letterSpacing: "0.28em", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "4px" }}>
          STATUS
        </span>
      </div>

      {/* Two-column body — content-height so the arrow lands at the last INOP line;
          a spacer below pushes the bottom bar to the base. Relative for the divider. */}
      <div className="flex" style={{ minHeight: 0, position: "relative" }}>

        {/* white column divider — STOPS where the green arrow starts (no white behind
            or below the arrow); the arrow then continues it downward. Full-height when
            there's no overflow arrow. */}
        <div aria-hidden style={{ position: "absolute", top: "2px", bottom: hasOverflow && !overflowCleared ? "29px" : "3px", right: "118px", width: "1.5px", background: C.white, transform: "translateX(50%)" }} />

        {/* LEFT — limitations / approach corrections / information (no bullet, per SD).
            Blank items ({ line: "" }) render as group separators. */}
        <div className="flex flex-col gap-[2px]" style={{ flex: "1 1 0", minWidth: 0, padding: "6px 6px 6px 10px" }}>
          {leftItems.map((item) =>
            item.line === "" ? (
              <div key={item.id} style={{ height: "6px" }} />
            ) : (
              <div
                key={item.id}
                style={{ color: statusColor(item.severity), fontSize: "11px", letterSpacing: "0.02em", lineHeight: "1.35", fontWeight: 500, whiteSpace: "pre" }}
              >
                {item.line}
              </div>
            ),
          )}
        </div>

        {/* RIGHT — INOP SYS (only when items exist) */}
        {rightItems.length > 0 && (
          <div
            className="flex flex-col gap-[2px]"
            style={{
              width: "118px",
              flexShrink: 0,
              // divider is drawn separately (absolute) so it can stop at the arrow
              padding: "6px 8px 2px 10px",
            }}
          >
            {/* INOP SYS header */}
            <div style={{ color: C.white, fontSize: "9px", letterSpacing: "0.18em", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px", marginBottom: "3px" }}>
              INOP SYS
            </div>
            {rightItems.map((item) => (
              <div
                key={item.id}
                style={{ color: statusColor(item.severity), fontSize: "11px", letterSpacing: "0.03em", lineHeight: "1.32", fontWeight: 500, whiteSpace: "nowrap" }}
              >
                {item.line}
              </div>
            ))}
          </div>
        )}

        {/* green ↓ overflow arrow — placed BELOW/ON the divider line in the gutter, same
            treatment as the E/WD overflow arrow (thick shaft + small head). Shows on page 1
            (INOP SYS runs past the screen); the CLR card reveals the leftover systems and the
            arrow simply disappears — nothing more to page. FCOM DSC-31-20(8). */}
        {hasOverflow && !overflowCleared && (
          <svg aria-hidden width="16" height="26" viewBox="0 0 16 26"
               style={{ position: "absolute", bottom: "3px", right: "118px", transform: "translateX(50%)" }}>
            <line x1="8" y1="0" x2="8" y2="16" stroke={C.green} strokeWidth="5" />
            <polygon points="1.5,14 14.5,14 8,25" fill={C.green} />
          </svg>
        )}
      </div>

      {/* spacer — pushes the bottom bar to the base of the cell (content sits at top) */}
      <div style={{ flex: "1 1 0", minHeight: 0 }} />

      {/* Bottom line + TAT/SAT/time/GW bar — the white line spans the width and
          connects to the column divider (same colour + thickness). Three cells split
          by the same white line, per the real SD.
          TAT/SAT are live when the runner passes them (altitude-driven); else static. */}
      <div className="flex" style={{ flexShrink: 0, borderTop: `1.5px solid ${C.white}`, fontSize: "11px" }}>
        <div style={{ flex: "1 1 0", padding: "4px 10px", lineHeight: "1.4" }}>
          <div><span style={{ color: C.white }}>TAT </span><span style={{ color: C.green }}>{tat != null ? String(tat).replace("-", "−") : "−20"}</span><span style={{ color: C.cyan }}> °C</span></div>
          <div><span style={{ color: C.white }}>SAT </span><span style={{ color: C.green }}>{sat != null ? String(sat).replace("-", "−") : "−36"}</span><span style={{ color: C.cyan }}> °C</span></div>
        </div>
        <div style={{ flex: "1 1 0", borderLeft: `1.5px solid ${C.white}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.green, letterSpacing: "0.1em" }}>
          13 H 58
        </div>
        <div style={{ flex: "1 1 0", borderLeft: `1.5px solid ${C.white}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: C.white }}>GW</span><span style={{ color: C.green, marginLeft: 6 }}>64000</span><span style={{ color: C.cyan, marginLeft: 5 }}>KG</span>
        </div>
      </div>
    </div>
  );
}
