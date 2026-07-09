"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import type { Scenario, ScenarioStep } from "@/scenarios/types";

// ─── Priority tiers ───────────────────────────────────────────────────────────
// Three visual themes based on task criticality — not by group, by severity.
// CRITICAL  = red/amber  → glareshield warning, confirmRequired ECAM steps
// PROCEDURE = navy/cyan  → ECAM actions, flightcheck (normal ops)
// ADVISORY  = teal/blue  → CRM comms, checklists

type Theme = {
  bodyBg: string;      // card background (not pure black)
  border: string;      // border color
  headerBg: string;    // header strip background
  accent: string;      // text / button accent
  glow: string;        // box-shadow glow
  badge: string;       // top-left badge text
  chip: string;        // action-verb colour (lighter accent — the scan target)
  chipBg: string;      // action-verb / button background
};

const THEMES: Record<string, Theme> = {
  critical: {
    // Severity shows AROUND it: red OUTER border + red header DIVIDER only. No red fill
    // anywhere — body AND header background stay neutral. [user 2026-07-07]
    bodyBg:   "#080A0E",
    border:   "#FF3333",
    headerBg: "transparent",
    accent:   "#FF3333",
    glow:     "0 0 40px #FF333340, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "CRITICAL",
    chip:     "#FF8A8A",
    chipBg:   "#2A1010",
  },
  caution: {
    // amber alert — same treatment as critical: amber border + divider, neutral fill. [user 2026-07-07]
    bodyBg:   "#0F0C05",
    border:   "#FFB300",
    headerBg: "transparent",
    accent:   "#FFB300",
    glow:     "0 0 40px #FFB30035, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "CAUTION",
    chip:     "#FFCB57",
    chipBg:   "#2A2110",
  },
  pf: {
    bodyBg:   "#05090F",
    border:   "#00CFFF",
    headerBg: "#00CFFF18",
    accent:   "#00CFFF",
    glow:     "0 0 40px #00CFFF30, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "PF",
    chip:     "#6FE0FF",
    chipBg:   "#0E2630",
  },
  pm: {
    bodyBg:   "#080A05",
    border:   "#FFB300",
    headerBg: "#FFB30018",
    accent:   "#FFB300",
    glow:     "0 0 35px #FFB30028, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "PM",
    chip:     "#FFCB57",
    chipBg:   "#2A2110",
  },
  crm: {
    bodyBg:   "#050A10",
    border:   "#4F8CFF",
    headerBg: "#4F8CFF16",
    accent:   "#4F8CFF",
    glow:     "0 0 35px #4F8CFF28, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "CRM",
    chip:     "#8FB6FF",
    chipBg:   "#16243A",
  },
  checklist: {
    bodyBg:   "#050E08",
    border:   "#00D060",
    headerBg: "#00D06018",
    accent:   "#00D060",
    glow:     "0 0 35px #00D06028, 0 8px 32px rgba(0,0,0,0.8)",
    badge:    "CHECKLIST",
    chip:     "#5BD6A0",
    chipBg:   "#0E2A1E",
  },
};

// Execute-phase (second click on a confirmRequired step) amber chip
const EXEC_CHIP = "#FFCB57";
const EXEC_CHIP_BG = "#2A2110";

// B612 — Airbus cockpit typeface (see globals.css --font-procedure)
const FONT_PROCEDURE = "var(--font-procedure)";

function hexToRgbTriplet(hex: string): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function resolveTheme(step: ScenarioStep, executePhase: boolean): Theme {
  const { group, crew, variant, confirmRequired } = step;
  const isEcam = (step.category ?? "").toUpperCase().includes("ECAM");

  // Execute phase (second click on confirmRequired) — always caution amber
  if (executePhase) return THEMES.caution;

  // Glareshield warning (MASTER WARN) — critical red
  if (group === "glareshield" && variant === "warning") return THEMES.critical;

  // confirmRequired ECAM steps (MASTER OFF, FIRE PB) — caution amber
  if (confirmRequired) return THEMES.caution;

  // Glareshield caution (MASTER CAUT)
  if (group === "glareshield") return THEMES.caution;

  // ECAM alert severity → card colour: RED warning, AMBER caution (mirrors the E/WD).
  // This wins over procedure/checklist grouping: LAND ASAP is grouped with checklist flow,
  // but the ECAM line itself is red and must render as a red ECAM card.
  if (isEcam && variant === "warning") return THEMES.critical;
  if (isEcam && variant === "caution") return THEMES.caution;

  // Checklists
  if (group === "chclm") return THEMES.checklist;

  // CRM communications
  if (group === "comms") return THEMES.crm;

  // Procedure / flightcheck — split PF (cyan) vs PM (amber)
  if (crew === "PF") return THEMES.pf;
  return THEMES.pm;
}

// ─── Option B card meta: category (top-left) · performer (top-right) · reference (bottom-left) ──
// Colours here are NEUTRAL PLACEHOLDERS — the card's own theme is unchanged; the colour design
// for these chips is a later pass. [user 2026-07-07]
const GROUP_CATEGORY: Record<string, string> = {
  procedure: "ECAM", chclm: "CHECKLIST", comms: "COMMS", flightcheck: "AVIATE", glareshield: "GLARESHIELD",
};
function cardCategory(step: ScenarioStep): string {
  return step.category ?? GROUP_CATEGORY[step.group ?? "procedure"] ?? "ECAM";
}
const CHIP_FONT = "ui-monospace, 'SF Mono', Menlo, monospace";
// Category identity colour lives on the PILL only — the card stays neutral. [user 2026-07-07]
const CATEGORY_COLOR: Record<string, string> = {
  ECAM: "#D99A3E", QRH: "#2FA69C", PROCEDURE: "#8593AB", AVIATE: "#37AEDA", NAVIGATE: "#37AEDA",
  COMMS: "#5C7CD0", CRM: "#9E76C4", CHECKLIST: "#4FB05E", GLARESHIELD: "#E5484D",
};
export function CategoryChips({ value, ecamColor }: { value: string; ecamColor?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {value.split(" · ").map((c) => {
        const col = c === "ECAM" && ecamColor ? ecamColor : CATEGORY_COLOR[c] ?? "#9AA6B4";
        return (
          <span key={c} style={{ fontFamily: CHIP_FONT, fontSize: "9px", letterSpacing: "0.14em", fontWeight: 700, padding: "3px 8px", borderRadius: "4px",
            color: col, border: `1px solid ${col}72`, background: `${col}28` }}>{c}</span>
        );
      })}
    </div>
  );
}
// Role: the ACTIVE pilot (does the action) in GREEN, the MONITOR (other pilot) in grey.
// No labels — colour carries it. Single-pilot calls (CAPT / CREW) show just the active one.
const ROLE_ACTIVE = "#3AD63A", ROLE_MON = "#7D8794";
export function PerformerChip({ crew }: { crew?: ScenarioStep["crew"] }) {
  const doer = crew ?? "PM";
  const monitor = crew === "PM" ? "PF" : (crew === "PF" || crew === "CAPT") ? "PM" : null;
  return (
    <span className="inline-flex items-center gap-2" style={{ fontFamily: CHIP_FONT, fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em" }}>
      <span style={{ color: ROLE_ACTIVE }}>{doer}</span>
      {monitor && <span style={{ color: ROLE_MON }}>{monitor}</span>}
    </span>
  );
}
export function ReferenceChips({ value }: { value?: string }) {
  if (!value) return <span />;
  return (
    <div className="flex items-center gap-1.5">
      <span
        style={{
          fontFamily: CHIP_FONT,
          fontSize: "9px",
          letterSpacing: "0.1em",
          fontWeight: 700,
          padding: "3px 7px",
          borderRadius: "4px",
          color: "#8A95A4",
          border: "1px solid #33404E",
          background: "#0C121A",
          fontStyle: "normal",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Hint renderer — splits on sentence boundaries for line-by-line display ───

function HintLines({ hint, color, fontSize, accent }: { hint: string; color: string; fontSize: string; accent: string }) {
  const lines = hint
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return <p style={{ color, fontSize, lineHeight: "1.6", letterSpacing: "0.02em" }}>{hint}</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2" style={{ fontSize, lineHeight: "1.55", letterSpacing: "0.02em" }}>
          <span style={{ color: accent + "80", fontSize: "8px", marginTop: "3px", flexShrink: 0 }}>▸</span>
          <span style={{ color }}>{line}</span>
        </li>
      ))}
    </ul>
  );
}

// System prefix UNDERLINE (the underlined SYS on the E/WD — AUTO FLT / HYD / F/CTL …). A label that
// starts with one gets its prefix underlined. [user 2026-07-07]
const SYS_PREFIXES = ["AUTO FLT", "F/CTL", "HYD", "ELEC", "AIR", "FUEL", "APU", "BLEED", "COND", "BRAKES", "NAV", "ENG"];
function underlineSysPrefix(item: string) {
  for (const p of SYS_PREFIXES) {
    if (item.startsWith(p + " ")) {
      return <><span style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>{p}</span>{item.slice(p.length)}</>;
    }
  }
  return item;
}

// ─── Directive headline — the action-led element (ITEM → ACTION) ──────────────
// The pilot's eye lands on WHAT TO DO first. The verb carries the accent colour
// (the scan target); the item is bright; the arrow is dim connective tissue.

function Directive({
  item,
  action,
  itemSize,
  actionColor,
  itemColor = "#EAF0F8",
}: {
  item: string;
  action?: string;
  itemSize: string;
  actionColor: string;
  /** ECAM cards colour the TITLE red/amber (the alert as on the E/WD); others keep it white. */
  itemColor?: string;
}) {
  return (
    <div className="flex items-baseline flex-wrap" style={{ gap: "6px 10px" }}>
      <span style={{ color: itemColor, fontSize: itemSize, fontWeight: 700, letterSpacing: "0.005em", lineHeight: 1.12, textTransform: "uppercase" }}>
        {underlineSysPrefix(item)}
      </span>
      {/* "CONFIRM" as an action verb is redundant with the confirm button — hide it (the label
          already carries the directive, e.g. "CLR — AUTO FLT AP OFF"). [user 2026-07-07] */}
      {action && action !== "CONFIRM" && (
        <>
          <span style={{ color: "#5E6B7E", fontSize: `calc(${itemSize} - 3px)`, fontWeight: 400, lineHeight: 1.12 }}>→</span>
          <span style={{ color: actionColor, fontSize: itemSize, fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1.12, textTransform: "uppercase" }}>
            {action}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Step sequencing ──────────────────────────────────────────────────────────

function nextPendingStep(steps: ScenarioStep[], state: ScenarioState): ScenarioStep | null {
  for (const s of steps) {
    if (s.optional) continue;
    if (s.hardware) continue; // completed via left-panel physical controls
    if (state.completedSteps[s.id]) continue;
    if (s.requiresTrigger && !state.triggersFired[s.requiresTrigger]) continue;
    const met = (s.requires ?? []).every((r) => !!state.completedSteps[r]);
    if (met) return s;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlightCheckPopup({
  scenario,
  state,
  perform,
  disabled,
  compact,
  inline = false,
  flashing = false,
}: {
  scenario: Scenario;
  state: ScenarioState;
  perform: (action: PilotAction) => void;
  disabled?: boolean;
  compact?: boolean;
  /** true = render as a block inside the right panel (no fixed position, no backdrop) */
  inline?: boolean;
  /** true = this card is the active surface → the deep ring + breathing lift (ccLift). */
  flashing?: boolean;
}) {
  const step = nextPendingStep(scenario.steps, state);

  const [pendingConfirm, setPendingConfirm] = useState(false);

  // Reading progress bar — gives trainee time to read before confirming.
  // Locks the CONFIRM button until bar completes. Runs for 6 s per step.
  const READ_SECS = 6;
  const [readPct, setReadPct] = useState(0);
  useEffect(() => {
    if (!step) return;
    setReadPct(0);
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / (READ_SECS * 1000)) * 100);
      setReadPct(pct);
      if (pct >= 100) clearInterval(id);
    }, 120);
    return () => clearInterval(id);
  }, [step?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPendingConfirm(false);
  }, [step?.id]);

  if (!step) return null;

  const isExecutePhase = !!(step.confirmRequired && pendingConfirm);
  const theme = resolveTheme(step, isExecutePhase);

  const handleConfirm = () => {
    if (step.confirmRequired && !pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    setPendingConfirm(false);
    perform({ kind: "STEP", stepId: step.id });
  };

  // Action-led colours: the CONFIRM button + reading bar carry the scan-target chip.
  const actionColor = isExecutePhase ? EXEC_CHIP : theme.chip;
  // The action VERB is WHITE (readable — COMMAND / ANALYSE / MAINTAIN CONTROL). The TITLE is the alert
  // colour (red/amber, as on the E/WD) ONLY on a true alert card (warning→red / caution→amber); every
  // other card — incl. advisory ECAM like STOP ECAM / READ STATUS — keeps a white title. [user 2026-07-07]
  const isAlertCard = theme === THEMES.critical || theme === THEMES.caution;
  const verbColor = "#EAF0F8";
  const itemColor = isAlertCard ? theme.accent : "#EAF0F8";
  const btnChipBg = isExecutePhase ? EXEC_CHIP_BG : theme.chipBg;
  const btnLabel = readPct < 100 ? "READING…" : isExecutePhase ? "EXECUTE ▶" : step.confirmRequired ? "CONFIRM?" : "CONFIRM ✓";
  const flashRgb = hexToRgbTriplet(theme.accent);
  // The procedure card has a CONFIRM (it's what advances the scenario), so it flashes
  // from the moment it loads — through the "READING…" phase and on into CONFIRM — to
  // pull the pilot's eye to it immediately.
  const flashNow = !!flashing;

  // ── INLINE MODE — renders as a block inside the right panel ──────────────
  if (inline) {
    return (
      <>
        <style>{`
          @keyframes action-fade-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div
          className="w-full"
          style={{
            fontFamily: FONT_PROCEDURE,
            backgroundColor: theme.bodyBg,
            // Lift: accent-tinted full border + accent ring + drop shadow + top inner
            // highlight, so the active step's card reads as raised above the chrome.
            border: `1px solid ${theme.accent}55`,
            borderRadius: "8px",
            overflow: "hidden",
            // Lighter, cooler drop-shadow: the card sits on a WHITE column now, so a
            // heavy black shadow would read as a muddy halo. This lets the dark card float.
            boxShadow: `0 0 0 1px ${theme.accent}22, 0 8px 22px rgba(15,20,30,0.16), inset 0 1px 0 rgba(255,255,255,0.05)`,
            // OUTER breathing glow follows the card severity: red warning, amber caution,
            // blue only for non-alert guidance. ccGlowOut = outer bloom (cards).
            animation: flashNow
              ? "action-fade-in 0.2s ease-out both, ccGlowOut 1.5s ease-in-out infinite"
              : "action-fade-in 0.2s ease-out both",
            ...(flashNow ? { "--cc-fc": flashRgb } : {}),
          } as CSSProperties}
        >
          {/* Header — category (left) + performer (right). Neutral fill; OUTER box + this DIVIDER carry the theme colour. [user 2026-07-07] */}
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{ backgroundColor: theme.headerBg, borderBottom: `1px solid ${theme.border}55` }}
          >
            <CategoryChips value={cardCategory(step)} ecamColor={theme.accent} />
            <span className="ml-auto"><PerformerChip crew={step.crew} /></span>
          </div>

          {/* Directive — the action-led headline */}
          <div className="px-4 pt-3 pb-2.5">
            <Directive item={step.label} action={step.action} itemSize="17px" actionColor={verbColor} itemColor={itemColor} />
          </div>

          {/* Why — demoted, muted */}
          <div className="px-4 pb-3">
            <HintLines hint={step.hint} color="#E6ECF5" fontSize="11.5px" accent={theme.accent} />
            {step.notes && step.notes.length > 0 && (
              <div className="mt-3 rounded px-3 py-2" style={{ backgroundColor: theme.accent + "0C", border: `1px solid ${theme.accent}20` }}>
                <ul className="flex flex-col gap-1">
                  {step.notes.map((note, i) => (
                    <li key={i} style={{ color: "#C9D4E1", fontSize: "10px", letterSpacing: "0.02em", lineHeight: "1.55" }}>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Reading progress bar — visual timer to pace reading */}
            <div className="mt-3" style={{ height: "2px", backgroundColor: "#0E1620", borderRadius: "1px" }}>
              <div
                className="h-full"
                style={{
                  width: `${readPct}%`,
                  backgroundColor: readPct < 100 ? actionColor + "80" : actionColor,
                  transition: "width 0.12s linear",
                }}
              />
            </div>
          </div>

          {/* Footer — reference (left) + confirm (right) */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: `1px solid ${theme.border}20` }}>
            <ReferenceChips value={step.reference} />
            <button
              type="button"
              disabled={disabled || readPct < 100}
              onClick={handleConfirm}
              className="transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontSize: "11px",
                letterSpacing: "0.08em",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "7px 18px",
                borderRadius: "7px",
                border: `1px solid ${actionColor}80`,
                backgroundColor: btnChipBg,
                color: actionColor,
              }}
            >
              {btnLabel}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── OVERLAY MODE — fixed position (legacy, kept for fallback) ──────────────
  return (
    <>
      <style>{`
        @keyframes crew-from-right {
          0%   { opacity: 0; transform: translateY(-50%) translateX(32px) scale(0.95); }
          65%  { transform: translateY(-50%) translateX(-5px) scale(1.01); }
          100% { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
        }
      `}</style>

      {!compact && (
        <div className="fixed inset-0" style={{ zIndex: 38, background: "linear-gradient(270deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, transparent 75%)", pointerEvents: "none" }} />
      )}

      <div
        className="fixed"
        style={{
          fontFamily: FONT_PROCEDURE,
          top: "50%",
          right: "32px",
          zIndex: 40,
          width: "min(520px, 44vw)",
          backgroundColor: theme.bodyBg,
          border: `1px solid ${theme.border}`,
          borderRadius: "9px",
          boxShadow: theme.glow,
          overflow: "hidden",
          animation: "crew-from-right 0.24s cubic-bezier(0.34, 1.4, 0.64, 1) both",
        }}
      >
        {/* ── Header — category (left) + performer / execute-warning (right) ── */}
        <div
          className="flex items-center gap-3 px-5 py-2.5"
          style={{ backgroundColor: theme.headerBg, borderBottom: `1px solid ${theme.border}30` }}
        >
          <CategoryChips value={cardCategory(step)} ecamColor={theme.accent} />
          <span className={isExecutePhase ? "ml-auto animate-pulse" : "ml-auto"}>
            {isExecutePhase ? (
              <span style={{ fontSize: "9px", letterSpacing: "0.12em", color: EXEC_CHIP, textTransform: "uppercase", fontWeight: 700 }}>
                ⚠ CONFIRM BEFORE ACTION
              </span>
            ) : (
              <PerformerChip crew={step.crew} />
            )}
          </span>
        </div>

        {/* ── Directive — the action-led headline ──────────────────── */}
        <div className="px-5 pt-4 pb-3">
          <Directive item={step.label} action={step.action} itemSize="19px" actionColor={verbColor} itemColor={itemColor} />
        </div>

        {/* ── Why — demoted, muted ─────────────────────────────────── */}
        <div className="px-5 pb-4">
          <HintLines hint={step.hint} color="#E6ECF5" fontSize="12.5px" accent={theme.accent} />

          {/* Notes (FORDEC, NIS, G/A review, checklists) */}
          {step.notes && step.notes.length > 0 && (
            <div
              className="mt-4 rounded px-4 py-3"
              style={{
                backgroundColor: theme.accent + "0C",
                border: `1px solid ${theme.accent}25`,
              }}
            >
              <ul className="flex flex-col gap-[5px]">
                {step.notes.map((note, i) => (
                  <li
                    key={i}
                    style={{
                      color: "#9AAABB",
                      fontSize: "11px",
                      letterSpacing: "0.02em",
                      lineHeight: "1.6",
                    }}
                  >
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Footer — reference (left) + confirm button (right) ────────── */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: `1px solid ${theme.border}25` }}
        >
          <ReferenceChips value={step.reference} />

          <button
            type="button"
            disabled={disabled || readPct < 100}
            onClick={handleConfirm}
            className="transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              fontSize: "12px",
              letterSpacing: "0.08em",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "9px 24px",
              borderRadius: "7px",
              border: `1px solid ${actionColor}80`,
              backgroundColor: btnChipBg,
              color: actionColor,
            }}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </>
  );
}
