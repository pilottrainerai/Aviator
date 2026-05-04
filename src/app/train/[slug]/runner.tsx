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
import { PfdNd } from "@/components/cockpit/pfd-nd";
import { DistractionModal } from "@/components/cockpit/distraction-modal";
import { GlareshieldPanel } from "@/components/cockpit/glareshield-panel";
import { FlightCheckPopup } from "@/components/cockpit/flight-check-popup";
import { FirePanel } from "@/components/cockpit/fire-panel";
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

  // Promote from queue only when ATC slot is truly idle
  useEffect(() => {
    if (atcPhase.kind === "idle" && distractionQueue.length > 0) {
      const [next, ...rest] = distractionQueue;
      setDistractionQueue(rest);
      setAtcPhase({ kind: "active", d: next });
    }
  }, [atcPhase.kind, distractionQueue]);

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
        // Correct → permanently dismiss, free slot
        standbyCountRef.current.delete(d.id);
        setAtcPhase({ kind: "idle" });
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
        popupGapUntilRef.current = Date.now() + 2_000;
        setTimeout(bumpPopupRevision, 2_100);
      }
    },
    [runner],
  );

  const popupReady = Date.now() >= popupGapUntilRef.current;

  // Hardware step that is currently actionable — shown in right panel idle state
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
    <main className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      <FireBanner state={runner.state} />
      <AudioController active={runner.state.masterWarnActive} />
      <ScenarioClock elapsedMs={runner.elapsedMs} state={runner.state} scenario={scenario} />

      <div className="flex flex-1 min-h-0">

        {/* ── LEFT PANEL — 70% — cockpit view ─────────────────────────── */}
        <div
          className="flex flex-col gap-4 p-4 overflow-y-auto"
          style={{ flex: "0 0 70%", borderRight: "1px solid var(--color-border)" }}
        >
          <PfdNd state={runner.state} />
          <GlareshieldPanel
            scenario={scenario}
            state={runner.state}
            perform={runner.perform}
            disabled={runner.status !== "running"}
          />
          <div className="grid gap-3 min-w-0" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <div className="min-w-0 overflow-hidden">
              <EwdDisplay state={runner.state} scenario={scenario} />
            </div>
            <div className="min-w-0 overflow-hidden">
              <FirePanel
                scenario={scenario}
                state={runner.state}
                perform={runner.perform}
                disabled={runner.status !== "running"}
              />
            </div>
          </div>
          <ScenarioProgress scenario={scenario} state={runner.state} />
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
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--color-text-faint)]">
              ◈ ACTION PANEL
            </span>
            {distractionQueue.length > 0 && (
              <span className="font-mono text-[8px] uppercase tracking-[0.15em]" style={{ color: "var(--color-amber)" }}>
                {distractionQueue.length} QUEUED
              </span>
            )}
          </div>

          {/* ── COMMS SECTION ── */}
          <div
            className="shrink-0"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div
              className="px-4 py-1.5"
              style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(0,0,0,0.3)" }}
            >
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
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
              <AtcStandbyCard d={atcPhase.d} resumesAt={atcPhase.resumesAt} />
            ) : (
              <CommsClearCard />
            )}
          </div>

          {/* ── PROCEDURE SECTION ── */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            <div
              className="px-4 py-1.5 shrink-0"
              style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(0,0,0,0.3)" }}
            >
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
                ▸ PROCEDURE
              </span>
            </div>

            <div className="flex-1">
              {runner.status === "running" && popupReady ? (
                <FlightCheckPopup
                  scenario={scenario}
                  state={runner.state}
                  perform={performWithGap}
                  disabled={runner.status !== "running"}
                  inline
                />
              ) : runner.status === "running" && !popupReady ? (
                <ActionGapCard />
              ) : (
                <ProcedureIdleCard nextHardwareStep={nextHardwareStep} />
              )}
            </div>
          </div>

          {/* ── DECISION SECTION — only unlocks after ECAM (agent1) complete ── */}
          {!!runner.state.completedSteps["agent1"] && !runner.state.decision && runner.status === "running" && (
            <div
              className="shrink-0"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <div
                className="px-4 py-1.5"
                style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(0,0,0,0.3)" }}
              >
                <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
                  ▸ DECISION
                </span>
              </div>
              <DecisionPanel
                scenario={scenario}
                state={runner.state}
                perform={runner.perform}
                disabled={runner.status !== "running"}
              />
            </div>
          )}

          {/* ── COACH — shown only after decision ── */}
          {runner.state.decision && (
            <div
              className="shrink-0 overflow-y-auto"
              style={{ borderTop: "1px solid var(--color-border)", maxHeight: "220px" }}
            >
              <GuidancePanel scenario={scenario} state={runner.state} />
            </div>
          )}

          {/* ── SESSION CONTROLS ── */}
          <div
            className="shrink-0 p-3 flex flex-col gap-2"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
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

            <details className="border border-[var(--color-border)]">
              <summary className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] cursor-pointer px-3 py-2 hover:text-[var(--color-text)]">
                EVENT LOG ({runner.events.length})
              </summary>
              <ol className="flex flex-col gap-1 max-h-40 overflow-y-auto p-3">
                {runner.events.length === 0 && (
                  <li className="font-mono text-[10px] text-[var(--color-text-faint)]">— no events —</li>
                )}
                {runner.events.map((e, i) => (
                  <li key={i} className="flex items-baseline gap-2 font-mono text-[10px]">
                    <span className="text-[var(--color-text-faint)] tabular-nums w-10">
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
      </div>
    </main>
  );
}

// ── Right-panel status cards ───────────────────────────────────────────────────

function CommsClearCard() {
  return (
    <div className="px-4 py-3 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#00D06060" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
        COMMS CLEAR
      </span>
    </div>
  );
}

function AtcStandbyCard({ d, resumesAt }: { d: ScenarioDistraction; resumesAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const secLeft = Math.max(0, Math.ceil((resumesAt - now) / 1000));
  const totalSec = Math.round((resumesAt - (resumesAt - secLeft * 1000 - 250)) / 1000);
  const pct = Math.max(0, (secLeft / Math.max(secLeft, totalSec)) * 100);

  return (
    <div className="px-4 py-3" style={{ opacity: 0.75 }}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="px-1.5 py-[2px] rounded-sm font-mono"
          style={{ fontSize: "7px", letterSpacing: "0.15em", fontWeight: 700, backgroundColor: "#FFB30020", color: "#FFB300", border: "1px solid #FFB30050" }}
        >
          STANDBY
        </span>
        <span className="font-mono text-[10px]" style={{ color: "#FFB300" }}>{d.from}</span>
        <span className="ml-auto font-mono text-[9px]" style={{ color: "#4A5566" }}>resumes {secLeft}s</span>
      </div>
      <p className="font-mono text-[10px] italic" style={{ color: "#5A6475", lineHeight: "1.5" }}>
        &ldquo;{d.message}&rdquo;
      </p>
      <div className="mt-2" style={{ height: "1px", backgroundColor: "#1A2030" }}>
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: "#FFB30040" }} />
      </div>
    </div>
  );
}

function ActionGapCard() {
  return (
    <div className="px-4 py-4 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#00CFFF60" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
        NEXT STEP LOADING…
      </span>
    </div>
  );
}

function ProcedureIdleCard({ nextHardwareStep }: { nextHardwareStep?: ScenarioStep | null }) {
  if (nextHardwareStep) {
    const isEcam = nextHardwareStep.group === "glareshield" || !nextHardwareStep.group;
    const accent = isEcam ? "#FF3333" : "#FFB300";
    return (
      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="animate-pulse inline-block h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: accent }}>
            ← ACTION REQUIRED — LEFT PANEL
          </span>
        </div>
        <div
          className="px-3 py-2.5 rounded-sm"
          style={{ backgroundColor: accent + "10", border: `1px solid ${accent}40` }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[11px] font-bold tracking-wider" style={{ color: accent }}>
              {nextHardwareStep.label}
            </span>
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-sm" style={{ backgroundColor: accent + "20", color: accent, border: `1px solid ${accent}40` }}>
              {nextHardwareStep.action}
            </span>
          </div>
          <p className="font-mono text-[10px] leading-relaxed" style={{ color: "#8A9AAB" }}>
            {nextHardwareStep.hint}
          </p>
        </div>
        {nextHardwareStep.crew && (
          <span className="font-mono text-[8px]" style={{ color: "#3A4858" }}>
            {nextHardwareStep.crew} — see fire panel / glareshield
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#3A4252" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
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
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">PROCEDURE PROGRESS</span>
        <span className="font-mono text-[9px] text-[var(--color-text-faint)]">{doneCount} / {allRequired.length}</span>
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
        <div className="divide-y" style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "rgba(0,0,0,0.25)" }}>
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
