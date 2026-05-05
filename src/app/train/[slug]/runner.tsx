"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useScenarioRunner } from "@/lib/scenarios/runner";
import type { Scenario, ScenarioDistraction, ScenarioStep } from "@/scenarios/types";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import { ScenarioClock } from "@/components/cockpit/scenario-clock";
import { EwdDisplay } from "@/components/cockpit/ewd-display";
import { DecisionPanel } from "@/components/cockpit/decision-panel";
import { PreflightBrief } from "@/components/cockpit/preflight-brief";
import { FireBanner } from "@/components/cockpit/fire-banner";
import { GuidancePanel } from "@/components/cockpit/guidance-panel";
import { AudioController } from "@/components/cockpit/audio-controller";
import { PfdCanvas, NdCanvas } from "@/components/cockpit/pfd-nd";
import { DistractionModal } from "@/components/cockpit/distraction-modal";
import { GlareshieldPanel } from "@/components/cockpit/glareshield-panel";
import { FlightCheckPopup } from "@/components/cockpit/flight-check-popup";
import { FirePanel } from "@/components/cockpit/fire-panel";
import { SystemDisplay } from "@/components/cockpit/system-display";
import { StatusPanel } from "@/components/cockpit/status-panel";
import { track } from "@/lib/analytics";

const AUTO_END_DELAY_MS = 3_000;

// ── ATC state machine ──────────────────────────────────────────────────────────
// A call can only be permanently dismissed by a CORRECT answer.
// Standby re-surfaces the same call (escalating delay on repeated standby).
// New queued calls are held until the current call is resolved.
type AtcPhase =
  | { kind: "idle" }
  | { kind: "active"; d: ScenarioDistraction }
  | { kind: "standby"; d: ScenarioDistraction; resumesAt: number };

export function ScenarioRunner({ scenario }: { scenario: Scenario }) {
  const [started, setStarted] = useState(false);
  if (!started) {
    return (
      <PreflightBrief
        scenario={scenario}
        onStart={() => {
          track("scenario_started", { slug: scenario.meta.slug });
          setStarted(true);
        }}
      />
    );
  }
  return <RunningScenario scenario={scenario} />;
}

function RunningScenario({ scenario }: { scenario: Scenario }) {
  const router = useRouter();
  const runner = useScenarioRunner(scenario);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoEndAt, setAutoEndAt] = useState<number | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);

  // ── ATC state machine ──────────────────────────────────────────────────────
  const [atcPhase, setAtcPhase] = useState<AtcPhase>({ kind: "idle" });
  const [distractionQueue, setDistractionQueue] = useState<ScenarioDistraction[]>([]);
  const firedDistractionsRef = useRef<Set<string>>(new Set());
  const standbyCountRef = useRef<Map<string, number>>(new Map());
  const atcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fire distractions at their scheduled atMs
  useEffect(() => {
    if (runner.status !== "running" || !scenario.distractions) return;
    for (const d of scenario.distractions) {
      if (runner.elapsedMs >= d.atMs && !firedDistractionsRef.current.has(d.id)) {
        firedDistractionsRef.current.add(d.id);
        setDistractionQueue((prev) => [...prev, d]);
      }
    }
  }, [runner.elapsedMs, runner.status, scenario.distractions]);

  // Cooldown after a correct answer — next queued call waits this long
  const [atcNextAllowedAt, setAtcNextAllowedAt] = useState(0);

  // Promote from queue only when idle AND past the post-answer cooldown
  useEffect(() => {
    if (atcPhase.kind !== "idle" || distractionQueue.length === 0) return;
    const now = Date.now();
    if (now < atcNextAllowedAt) {
      const delay = atcNextAllowedAt - now;
      const id = setTimeout(() => {
        setDistractionQueue((q) => {
          if (q.length === 0) return q;
          const [next, ...rest] = q;
          setAtcPhase({ kind: "active", d: next });
          return rest;
        });
      }, delay);
      return () => clearTimeout(id);
    }
    const [next, ...rest] = distractionQueue;
    setDistractionQueue(rest);
    setAtcPhase({ kind: "active", d: next });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atcPhase.kind, distractionQueue.length, atcNextAllowedAt]);

  // Cleanup ATC timer when scenario ends
  useEffect(() => {
    if (runner.status === "ended" && atcTimerRef.current) {
      clearTimeout(atcTimerRef.current);
    }
  }, [runner.status]);

  const handleAtcRespond = useCallback(
    (choiceId: string, correct: boolean) => {
      if (atcPhase.kind !== "active") return;
      void choiceId;
      const d = atcPhase.d;
      if (correct) {
        // Correct → permanently dismiss, then 9 s gap before next call
        standbyCountRef.current.delete(d.id);
        setAtcPhase({ kind: "idle" });
        setAtcNextAllowedAt(Date.now() + 9_000);
      } else {
        // Wrong → short re-surface (8 s)
        const count = (standbyCountRef.current.get(d.id) ?? 0) + 1;
        standbyCountRef.current.set(d.id, count);
        const delay = 8_000;
        const resumesAt = Date.now() + delay;
        setAtcPhase({ kind: "standby", d, resumesAt });
        if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
        atcTimerRef.current = setTimeout(() => setAtcPhase({ kind: "active", d }), delay);
      }
    },
    [atcPhase],
  );

  // Lets the pilot manually re-open the response choices from standby
  const handleAtcManualActivate = useCallback(() => {
    if (atcPhase.kind !== "standby") return;
    if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
    setAtcPhase({ kind: "active", d: atcPhase.d });
  }, [atcPhase]);

  const handleAtcStandby = useCallback(() => {
    if (atcPhase.kind !== "active") return;
    const d = atcPhase.d;
    const count = (standbyCountRef.current.get(d.id) ?? 0) + 1;
    standbyCountRef.current.set(d.id, count);
    // Escalating delay: 20 s → 12 s → 6 s → 3 s (persistent pressure)
    const delay = count === 1 ? 20_000 : count === 2 ? 12_000 : count <= 4 ? 6_000 : 3_000;
    const resumesAt = Date.now() + delay;
    setAtcPhase({ kind: "standby", d, resumesAt });
    if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
    atcTimerRef.current = setTimeout(() => setAtcPhase({ kind: "active", d }), delay);
  }, [atcPhase]);

  // ── Crew-action popup gap (2 s between steps) ──────────────────────────────
  const popupGapUntilRef = useRef(0);
  const [, bumpPopupRevision] = useReducer((n: number) => n + 1, 0);

  const performWithGap = useCallback(
    (action: PilotAction) => {
      runner.perform(action);
      if (action.kind === "STEP") {
        popupGapUntilRef.current = Date.now() + 1_000;
        setTimeout(bumpPopupRevision, 1_100);
      }
    },
    [runner],
  );

  const popupReady = Date.now() >= popupGapUntilRef.current;

  // Hardware step that is currently actionable — confirmed via left-panel controls
  const nextHardwareStep = useMemo(() => {
    if (runner.status !== "running") return null;
    return (
      scenario.steps.find(
        (s) =>
          !s.optional &&
          s.hardware &&
          !runner.state.completedSteps[s.id] &&
          (s.requires ?? []).every((r) => !!runner.state.completedSteps[r]),
      ) ?? null
    );
  }, [runner.state.completedSteps, runner.status, scenario.steps]);

  // Next non-hardware step — if null while hardware step exists, right panel shows attention card
  const nextSoftwareStep = useMemo(() => {
    if (runner.status !== "running") return null;
    return (
      scenario.steps.find(
        (s) =>
          !s.optional &&
          !s.hardware &&
          !runner.state.completedSteps[s.id] &&
          (s.requires ?? []).every((r) => !!runner.state.completedSteps[r]),
      ) ?? null
    );
  }, [runner.state.completedSteps, runner.status, scenario.steps]);

  // Auto-open decision drawer when it first unlocks (agent1 completed)
  const agent1Done = !!runner.state.completedSteps["agent1"];
  useEffect(() => {
    if (agent1Done) setDecisionOpen(true);
  }, [agent1Done]);

  // ── Auto-end after decision ────────────────────────────────────────────────
  const decisionKey = runner.state.decision?.tMs ?? null;
  useEffect(() => {
    if (decisionKey == null || autoEndAt != null || submitting) return;
    track("decision_committed", { slug: scenario.meta.slug });
    setAutoEndAt(Date.now() + AUTO_END_DELAY_MS);
    const id = setTimeout(() => submit(), AUTO_END_DELAY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionKey]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    runner.end();
    track("scenario_completed", { slug: scenario.meta.slug, events: runner.events.length });
    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioSlug: scenario.meta.slug,
          startedAt: Date.now() - runner.elapsedMs,
          endedAt: Date.now(),
          events: runner.events,
          finalState: runner.state,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not submit session");
      }
      const { debriefId } = (await res.json()) as { debriefId: string };
      router.push(`/debrief/${debriefId}`);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [router, runner, scenario.meta.slug]);

  const remaining = autoEndAt != null ? Math.max(0, autoEndAt - Date.now()) : null;

  return (
    <main className="flex flex-col">

      {/* ── ABOVE FOLD — fills one full viewport; no scroll needed ── */}
      <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      <FireBanner state={runner.state} />
      <AudioController active={runner.state.masterWarnActive} cautActive={runner.state.masterCautActive} />
      <ScenarioClock elapsedMs={runner.elapsedMs} state={runner.state} scenario={scenario} />

      <div className="flex flex-1 min-h-0">

        {/* ── LEFT PANEL — cockpit instruments ────────────────────────── */}
        <div
          style={{ flex: "0 0 68%", borderRight: "1px solid var(--color-border)", overflow: "hidden", display: "flex", flexDirection: "row" }}
        >
          {/* Left sub-column: PFD + ND → Glareshield → ECAM fills remaining height */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", padding: "10px 4px 8px 10px", overflow: "hidden" }}>
            {/* PFD + ND */}
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <div style={{ width: "330px", height: "330px", border: "1px solid var(--color-border)", backgroundColor: "#000", overflow: "hidden" }}>
                <PfdCanvas state={runner.state} />
              </div>
              <div style={{ width: "330px", height: "330px", border: "1px solid var(--color-border)", backgroundColor: "#000", overflow: "hidden" }}>
                <NdCanvas state={runner.state} />
              </div>
            </div>
            {/* Glareshield — compact strip */}
            <div style={{ flexShrink: 0, marginTop: "4px" }}>
              <GlareshieldPanel
                scenario={scenario}
                state={runner.state}
                perform={runner.perform}
                disabled={runner.status !== "running"}
              />
            </div>
            {/* ECAM (E/WD) — fills remaining height */}
            <div style={{ flex: "1 1 0", minHeight: 0, marginTop: "4px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <EwdDisplay state={runner.state} scenario={scenario} />
            </div>
            {/* STATUS page — appears below ECAM once all required steps done */}
            <StatusPanel scenario={scenario} state={runner.state} />
          </div>

          {/* Right sub-column: Engine Display (top) + System Display (bottom) */}
          <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "6px", padding: "10px 10px 8px 4px" }}>
            <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <FirePanel
                scenario={scenario}
                state={runner.state}
                perform={runner.perform}
                disabled={runner.status !== "running"}
              />
            </div>
            <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <SystemDisplay state={runner.state} scenario={scenario} />
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — 30% — action window ───────────────────────── */}
        <div
          className="flex flex-col bg-[var(--color-surface)]"
          style={{ flex: "0 0 30%", minWidth: "300px" }}
        >
          {/* Panel header */}
          <div
            className="px-4 py-2 shrink-0 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              ◈ ACTION PANEL
            </span>
            {distractionQueue.length > 0 && (
              <span className="font-mono text-[8px] uppercase tracking-[0.15em]" style={{ color: "var(--color-amber)" }}>
                {distractionQueue.length} QUEUED
              </span>
            )}
          </div>

          {/* ── COMMS SECTION — fixed height, no layout shift ── */}
          <div
            className="shrink-0"
            style={{ borderBottom: "1px solid var(--color-border)", height: "290px", overflow: "hidden" }}
          >
            <div
              className="px-4 py-1.5"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                ▸ COMMS
              </span>
            </div>

            {atcPhase.kind === "active" ? (
              <DistractionModal
                distraction={atcPhase.d}
                onRespond={handleAtcRespond}
                onStandby={handleAtcStandby}
                inline
              />
            ) : atcPhase.kind === "standby" ? (
              <AtcStandbyCard
                d={atcPhase.d}
                resumesAt={atcPhase.resumesAt}
                onRespond={handleAtcManualActivate}
              />
            ) : (
              <CommsClearCard />
            )}
          </div>

          {/* ── PROCEDURE SECTION — full active-step card, no internal scroll ── */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Header */}
            <div
              className="px-4 py-1.5 shrink-0"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                ▸ PROCEDURE
              </span>
            </div>
            {/* Body — single active step card; progress tracker is on the left panel */}
            <div className="flex-1 overflow-y-auto">
              {runner.status === "running" && !popupReady ? (
                <ActionGapCard />
              ) : runner.status === "running" && nextSoftwareStep ? (
                <FlightCheckPopup
                  scenario={scenario}
                  state={runner.state}
                  perform={performWithGap}
                  disabled={runner.status !== "running"}
                  inline
                />
              ) : (
                <ProcedureIdleCard nextHardwareStep={nextHardwareStep} />
              )}
            </div>
          </div>

        </div>
      </div>
      </div>{/* end above-fold */}

      {/* ── BELOW FOLD — scroll down to see procedure progress, decision, controls ── */}
      <div style={{ display: "flex", borderTop: "2px solid var(--color-border)", minHeight: "70vh" }}>

        {/* Left 68%: Full procedure progress tracker */}
        <div style={{ flex: "0 0 68%", borderRight: "1px solid var(--color-border)", padding: "16px 12px" }}>
          <ScenarioProgress scenario={scenario} state={runner.state} />
        </div>

        {/* Right 32%: Decision → Guidance → Submit controls */}
        <div className="flex flex-col bg-[var(--color-surface)]" style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "12px", padding: "16px 12px" }}>

          {/* Decision — unlocks after AGENT 1 step */}
          {agent1Done && !runner.state.decision && runner.status === "running" && (
            <>
              <div
                className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]"
                style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "6px" }}
              >
                ▸ DECISION
              </div>
              <DecisionPanel
                scenario={scenario}
                state={runner.state}
                perform={runner.perform}
                disabled={runner.status !== "running"}
              />
            </>
          )}

          {/* Guidance — shown after decision committed */}
          {runner.state.decision && (
            <GuidancePanel scenario={scenario} state={runner.state} />
          )}

          {/* Auto-finalizing banner */}
          {autoEndAt != null && (
            <div
              className="flex items-center justify-between px-3 py-2 border"
              style={{ borderColor: "var(--color-brand)", backgroundColor: "var(--color-brand-soft)" }}
            >
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-brand)]">AUTO-FINALIZING</div>
                <div className="font-sans text-xs text-[var(--color-text)] mt-0.5">
                  Submitting in {Math.ceil((remaining ?? 0) / 1000)}s
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoEndAt(Number.MAX_SAFE_INTEGER)}
                className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* End & Score */}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || runner.status !== "running"}
            className="h-10 bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-[10px] uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Scoring…" : "End & Score"}
          </button>

          {error && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-red)]">{error}</p>
          )}

          {/* Event Log */}
          <details className="border border-[var(--color-border)]">
            <summary className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] cursor-pointer px-3 py-2 hover:text-[var(--color-text)]">
              EVENT LOG ({runner.events.length})
            </summary>
            <ol className="flex flex-col gap-1 max-h-60 overflow-y-auto p-3">
              {runner.events.length === 0 && (
                <li className="font-mono text-[10px]" style={{ color: "#4b5666" }}>— no events —</li>
              )}
              {runner.events.map((e, i) => (
                <li key={i} className="flex items-baseline gap-2 font-mono text-[10px]">
                  <span className="text-[var(--color-text-muted)] tabular-nums w-10">
                    {(e.tMs / 1000).toFixed(1)}s
                  </span>
                  <span className={e.source === "pilot" ? "text-[var(--color-text)]" : "text-[var(--color-brand)]"}>
                    {e.kind === "STEP" ? `STEP · ${e.stepId}`
                      : e.kind === "DECISION" ? `DECISION · ${e.value}`
                      : e.kind === "TRIGGER" ? `TRIGGER · ${e.triggerId}`
                      : `EFFECT · ${e.sourceId}`}
                  </span>
                </li>
              ))}
            </ol>
          </details>

        </div>
      </div>
    </main>
  );
}

// ── Right-panel status cards ───────────────────────────────────────────────────

function CommsClearCard() {
  return (
    <div className="px-4 py-3 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#16a34a" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4b5666" }}>
        COMMS CLEAR
      </span>
    </div>
  );
}

function AtcStandbyCard({
  d,
  resumesAt,
  onRespond,
}: {
  d: ScenarioDistraction;
  resumesAt: number;
  onRespond: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const totalMs = resumesAt - (Date.now() - (Date.now() - resumesAt + (resumesAt - Date.now())));
  const secLeft = Math.max(0, Math.ceil((resumesAt - now) / 1000));
  // compute initial total by assuming standby countdown hasn't changed since mount
  const [initTotal] = useState(() => Math.ceil((resumesAt - Date.now()) / 1000));
  const pct = Math.max(0, (secLeft / Math.max(1, initTotal)) * 100);
  void totalMs;

  return (
    <div className="px-4 py-3 font-mono">
      {/* Message stays visible in standby — per FCOM radio discipline */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="px-1.5 py-[2px] rounded-sm"
          style={{ fontSize: "7px", letterSpacing: "0.15em", fontWeight: 700, backgroundColor: "#FFB30020", color: "#FFB300", border: "1px solid #FFB30050" }}
        >
          STANDBY
        </span>
        <span style={{ color: "#FFB300", fontSize: "10px" }}>{d.from}</span>
        <span className="ml-auto" style={{ color: "#4A5566", fontSize: "9px" }}>resumes {secLeft}s</span>
      </div>
      <p style={{ color: "#8A9AAB", fontSize: "10px", lineHeight: "1.55", fontStyle: "italic" }}>
        &ldquo;{d.message}&rdquo;
      </p>
      {/* Countdown bar */}
      <div className="mt-2 mb-2" style={{ height: "1px", backgroundColor: "#1A2030" }}>
        <div className="h-full transition-all duration-250" style={{ width: `${pct}%`, backgroundColor: "#FFB30040" }} />
      </div>
      {/* Pilot can click to re-open response choices at any time */}
      <button
        type="button"
        onClick={onRespond}
        className="w-full text-left px-2 py-1.5 border border-dashed"
        style={{ borderColor: "#00D06040", backgroundColor: "#00D06008", color: "#00D060", fontSize: "8px", letterSpacing: "0.15em", textTransform: "uppercase" }}
      >
        ▸ TAP TO RESPOND NOW
      </button>
    </div>
  );
}

function ActionGapCard() {
  return (
    <div className="px-4 py-4 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#3981f6" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4b5666" }}>
        NEXT STEP…
      </span>
    </div>
  );
}

function splitHint(hint: string): string[] {
  return hint
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ProcedureIdleCard({ nextHardwareStep }: { nextHardwareStep?: ScenarioStep | null }) {
  if (nextHardwareStep) {
    const isGlareshield = nextHardwareStep.group === "glareshield";
    const accent = isGlareshield ? "#FFB300" : "#FF3333";
    const hintLines = splitHint(nextHardwareStep.hint ?? "");

    return (
      <div className="font-mono flex flex-col" style={{ borderLeft: `3px solid ${accent}`, backgroundColor: accent === "#FF3333" ? "#0F0505" : "#0A0800" }}>
        {/* Top accent bar */}
        <div style={{ height: "2px", background: `linear-gradient(90deg, ${accent}, ${accent}00)` }} />

        {/* Attention banner */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ backgroundColor: accent + "18", borderBottom: `1px solid ${accent}35` }}
        >
          <span className="animate-pulse text-[18px]" style={{ lineHeight: 1 }}>←</span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold tracking-[0.25em] uppercase" style={{ color: accent }}>
              ACTION REQUIRED — LEFT PANEL
            </span>
            <span className="text-[7px] tracking-[0.18em] uppercase" style={{ color: accent + "70" }}>
              operate controls on the left display
            </span>
          </div>
        </div>

        {/* Step detail */}
        <div className="px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: accent }}>
              {nextHardwareStep.label}
            </span>
            <span
              className="text-[8px] px-2 py-0.5"
              style={{ backgroundColor: accent + "20", color: accent, border: `1px solid ${accent}40`, borderRadius: "2px" }}
            >
              {nextHardwareStep.action}
            </span>
          </div>

          {/* Hint — line by line */}
          {hintLines.length > 0 && (
            <ul className="flex flex-col gap-1.5" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {hintLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span style={{ color: accent + "70", fontSize: "8px", marginTop: "3px", flexShrink: 0 }}>▸</span>
                  <span style={{ color: "#8A9AAB", fontSize: "10px", lineHeight: "1.55", letterSpacing: "0.02em" }}>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {nextHardwareStep.crew && (
          <div className="px-4 pb-3">
            <span className="text-[7px] tracking-[0.18em] uppercase" style={{ color: "#3A4858" }}>
              {nextHardwareStep.crew} — {nextHardwareStep.group?.toUpperCase() ?? "PROCEDURE"}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4b5666" }}>
        MONITORING — STANDBY
      </span>
    </div>
  );
}

// ── Left-panel step progress tracker ──────────────────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  flightcheck: "AVIATE",
  glareshield: "GLARESHIELD",
  procedure:   "ECAM",
  comms:       "CRM / ASSESS",
  chclm:       "CHECKLIST",
};
const GROUP_ORDER = ["flightcheck", "glareshield", "procedure", "comms", "chclm"];

function ScenarioProgress({ scenario, state }: { scenario: Scenario; state: ScenarioState }) {
  const grouped: Record<string, ScenarioStep[]> = {};
  for (const s of scenario.steps) {
    if (s.optional) continue;
    const g = s.group ?? "procedure";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(s);
  }

  const allRequired = scenario.steps.filter((s) => !s.optional);
  const doneCount = allRequired.filter((s) => state.completedSteps[s.id]).length;

  // Active group = first group that has a step whose requires are all met but not yet done
  const activeGroup = GROUP_ORDER.find((g) =>
    grouped[g]?.some(
      (s) => !state.completedSteps[s.id] && (s.requires ?? []).every((r) => !!state.completedSteps[r]),
    ),
  );

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    new Set(activeGroup ? [activeGroup] : [GROUP_ORDER[0]]),
  );

  // Auto-expand the newly active group as the procedure advances
  useEffect(() => {
    if (activeGroup) {
      setExpanded((prev) => (prev.has(activeGroup) ? prev : new Set([...prev, activeGroup])));
    }
  }, [activeGroup]);

  const toggle = (g: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <span className="font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: "#4b5666" }}>PROCEDURE PROGRESS</span>
        <span className="font-mono text-[9px]" style={{ color: "#4b5666" }}>{doneCount} / {allRequired.length}</span>
      </div>
      {/* Overall progress bar */}
      <div style={{ height: "2px", backgroundColor: "var(--color-border)" }}>
        <div className="h-full transition-all duration-500" style={{ width: `${(doneCount / allRequired.length) * 100}%`, backgroundColor: "var(--color-brand)" }} />
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {GROUP_ORDER.filter((g) => grouped[g]).map((g) => (
          <AccordionGroupRow
            key={g}
            label={GROUP_LABELS[g] ?? g}
            steps={grouped[g]}
            state={state}
            isActive={activeGroup === g}
            expanded={expanded.has(g)}
            onToggle={() => toggle(g)}
          />
        ))}
      </div>
    </div>
  );
}

function AccordionGroupRow({
  label, steps, state, isActive, expanded, onToggle,
}: {
  label: string;
  steps: ScenarioStep[];
  state: ScenarioState;
  isActive: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const doneCount = steps.filter((s) => state.completedSteps[s.id]).length;
  const allDone = doneCount === steps.length;
  const accentColor = allDone ? "var(--color-green)" : isActive ? "var(--color-brand)" : "var(--color-text-faint)";

  return (
    <div>
      {/* Clickable header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
        style={{ backgroundColor: isActive && !allDone ? "rgba(0,207,255,0.04)" : "transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = isActive && !allDone ? "rgba(0,207,255,0.04)" : "transparent"; }}
      >
        {/* Phase label */}
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] shrink-0" style={{ width: "82px", color: accentColor }}>
          {label}
        </span>
        {/* Step dots */}
        <div className="flex items-center gap-1 flex-1 flex-wrap">
          {steps.map((s) => {
            const done = !!state.completedSteps[s.id];
            const cur = !done && (s.requires ?? []).every((r) => !!state.completedSteps[r]);
            return (
              <div
                key={s.id}
                title={`${s.label} ${s.action}`}
                className={cur ? "animate-pulse" : ""}
                style={{ height: "6px", width: "6px", borderRadius: "50%", flexShrink: 0, backgroundColor: done ? "var(--color-green)" : cur ? "var(--color-brand)" : "var(--color-border)" }}
              />
            );
          })}
        </div>
        <span className="font-mono text-[8px] shrink-0" style={{ color: accentColor }}>{doneCount}/{steps.length}</span>
        {/* Chevron */}
        <span className="font-mono text-[9px] shrink-0 ml-1" style={{ color: "var(--color-text-faint)", display: "inline-block", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>▾</span>
      </button>

      {/* Expanded step list */}
      {expanded && (
        <div className="divide-y" style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", borderLeft: "2px solid var(--color-border)" }}>
          {steps.map((s) => {
            const done = !!state.completedSteps[s.id];
            const cur = !done && (s.requires ?? []).every((r) => !!state.completedSteps[r]);
            const stepAccent = done ? "var(--color-text-faint)" : cur ? "var(--color-text)" : "var(--color-text-faint)";
            return (
              <div key={s.id} className="flex items-center gap-2.5 px-5 py-2" style={{ borderColor: "var(--color-border)", opacity: done ? 0.45 : 1 }}>
                {/* Status dot */}
                <div
                  className={cur ? "animate-pulse shrink-0" : "shrink-0"}
                  style={{ height: "5px", width: "5px", borderRadius: "50%", backgroundColor: done ? "var(--color-green)" : cur ? "var(--color-brand)" : "var(--color-border)" }}
                />
                {/* Label */}
                <span className="font-mono text-[10px] flex-1" style={{ color: stepAccent, textDecoration: done ? "line-through" : "none" }}>
                  {s.label}
                </span>
                {/* Action */}
                <span className="font-mono text-[8px] shrink-0" style={{ color: cur ? "var(--color-brand)" : "var(--color-border)" }}>
                  {s.action}
                </span>
                {/* ← LEFT PANEL badge for active hardware steps */}
                {s.hardware && cur && (
                  <span className="shrink-0 px-1.5 py-[1px] font-mono text-[7px] uppercase tracking-wider animate-pulse"
                    style={{ backgroundColor: "#FF333318", color: "#FF3333", border: "1px solid #FF333335" }}>
                    ← LEFT
                  </span>
                )}
                {/* Crew badge */}
                {s.crew && (
                  <span className="shrink-0 px-1 py-[1px] font-mono text-[7px]" style={{ color: "var(--color-text-faint)", border: "1px solid var(--color-border)" }}>
                    {s.crew}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
