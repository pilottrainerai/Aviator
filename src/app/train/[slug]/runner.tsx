"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useScenarioRunner } from "@/lib/scenarios/runner";
import type { Scenario, ScenarioDistraction } from "@/scenarios/types";
import { ScenarioClock } from "@/components/cockpit/scenario-clock";
import { EwdDisplay } from "@/components/cockpit/ewd-display";
import { CockpitControls } from "@/components/cockpit/cockpit-controls";
import { DecisionPanel } from "@/components/cockpit/decision-panel";
import { PreflightBrief } from "@/components/cockpit/preflight-brief";
import { FireBanner } from "@/components/cockpit/fire-banner";
import { GuidancePanel } from "@/components/cockpit/guidance-panel";
import { AudioController } from "@/components/cockpit/audio-controller";
import { PfdNd } from "@/components/cockpit/pfd-nd";
import { FirePanel } from "@/components/cockpit/fire-panel";
import { DistractionModal } from "@/components/cockpit/distraction-modal";
import { CommChecklist } from "@/components/cockpit/comm-checklist";
import { ChclmChecklist } from "@/components/cockpit/chclm-checklist";
import { GlareshieldPanel } from "@/components/cockpit/glareshield-panel";
import { FlightCheckPopup } from "@/components/cockpit/flight-check-popup";
import { track } from "@/lib/analytics";

const AUTO_END_DELAY_MS = 3_000;
// After "Stand By", ATC resurfaces in this many ms (scenario may override per-call)
const STANDBY_REQUEUE_DEFAULT_MS = 25_000;

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

  // ── Distraction queue ───────────────────────────────────────────────────────
  const firedDistractionsRef = useRef<Set<string>>(new Set());
  const standbyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [distractionQueue, setDistractionQueue] = useState<ScenarioDistraction[]>([]);
  const [activeDistraction, setActiveDistraction] = useState<ScenarioDistraction | null>(null);

  // Fire distractions as elapsedMs passes their atMs threshold
  useEffect(() => {
    if (runner.status !== "running" || !scenario.distractions) return;
    for (const d of scenario.distractions) {
      if (runner.elapsedMs >= d.atMs && !firedDistractionsRef.current.has(d.id)) {
        firedDistractionsRef.current.add(d.id);
        setDistractionQueue((prev) => [...prev, d]);
      }
    }
  }, [runner.elapsedMs, runner.status, scenario.distractions]);

  // Promote from queue to active whenever the slot is empty
  useEffect(() => {
    if (activeDistraction === null && distractionQueue.length > 0) {
      const [next, ...rest] = distractionQueue;
      setActiveDistraction(next);
      setDistractionQueue(rest);
    }
  }, [activeDistraction, distractionQueue]);

  // Clean up standby timers when scenario ends
  useEffect(() => {
    if (runner.status === "ended") {
      standbyTimersRef.current.forEach((t) => clearTimeout(t));
      standbyTimersRef.current.clear();
    }
  }, [runner.status]);

  const handleDistractionRespond = useCallback(
    (choiceId: string, correct: boolean) => {
      if (!activeDistraction) return;
      const d = activeDistraction;
      setActiveDistraction(null);

      if (!correct) {
        // Wrong response — ATC calls back (same re-queue logic as Stand By)
        const existing = standbyTimersRef.current.get(d.id);
        if (existing) clearTimeout(existing);
        const delayMs = d.standbyResurfaceMs ?? STANDBY_REQUEUE_DEFAULT_MS;
        const timer = setTimeout(() => {
          setDistractionQueue((prev) => [...prev, d]);
          standbyTimersRef.current.delete(d.id);
        }, delayMs);
        standbyTimersRef.current.set(d.id, timer);
      }
      // correct: permanent dismiss — no re-queue
      void choiceId;
    },
    [activeDistraction],
  );

  // Stand By: dismiss for now, re-queue after standbyResurfaceMs
  const handleDistractionStandby = useCallback(() => {
    if (!activeDistraction) return;
    const d = activeDistraction;
    setActiveDistraction(null);

    // Clear any existing standby timer for this call (in case of repeat Stand By)
    const existing = standbyTimersRef.current.get(d.id);
    if (existing) clearTimeout(existing);

    const delayMs = d.standbyResurfaceMs ?? STANDBY_REQUEUE_DEFAULT_MS;
    const timer = setTimeout(() => {
      setDistractionQueue((prev) => [...prev, d]);
      standbyTimersRef.current.delete(d.id);
    }, delayMs);
    standbyTimersRef.current.set(d.id, timer);
  }, [activeDistraction]);

  // ── Session submit ──────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    runner.end();
    track("scenario_completed", {
      slug: scenario.meta.slug,
      events: runner.events.length,
    });
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

  // ── Popup gap: 2-second pause between consecutive crew procedure steps ─────
  // Prevents back-to-back popups from firing instantly — mirrors real cockpit pacing.
  const popupGapUntilRef = useRef(0);
  const [, bumpPopupRevision] = useReducer((n: number) => n + 1, 0);

  const performWithGap = useCallback((action: import("@/engine/events").PilotAction) => {
    runner.perform(action);
    if (action.kind === "STEP") {
      popupGapUntilRef.current = Date.now() + 2000;
      setTimeout(bumpPopupRevision, 2100);
    }
  }, [runner]);

  const popupReady = Date.now() >= popupGapUntilRef.current;

  const decisionKey = runner.state.decision?.tMs ?? null;
  useEffect(() => {
    if (decisionKey == null || autoEndAt != null || submitting) return;
    track("decision_committed", { slug: scenario.meta.slug });
    setAutoEndAt(Date.now() + AUTO_END_DELAY_MS);
    const id = setTimeout(() => {
      submit();
    }, AUTO_END_DELAY_MS);
    return () => clearTimeout(id);
  }, [decisionKey, autoEndAt, submitting, submit, scenario.meta.slug]);

  const remaining = autoEndAt != null ? Math.max(0, autoEndAt - Date.now()) : null;

  return (
    <main className="flex flex-col flex-1">
      <FireBanner state={runner.state} />
      <AudioController active={runner.state.masterWarnActive} />
      <ScenarioClock
        elapsedMs={runner.elapsedMs}
        state={runner.state}
        scenario={scenario}
      />

      <div className="flex-1 grid lg:grid-cols-[1fr_400px] gap-6 p-6 max-w-[1400px] mx-auto w-full">
        <div className="flex flex-col gap-6">
          <PfdNd state={runner.state} />
          <GlareshieldPanel
            scenario={scenario}
            state={runner.state}
            perform={runner.perform}
            disabled={runner.status !== "running"}
          />
          <div className="grid lg:grid-cols-[1fr_280px] gap-4">
            <EwdDisplay state={runner.state} scenario={scenario} />
            <FirePanel
              scenario={scenario}
              state={runner.state}
              perform={runner.perform}
              disabled={runner.status !== "running"}
            />
          </div>
          <CockpitControls
            scenario={scenario}
            state={runner.state}
            perform={runner.perform}
            disabled={runner.status !== "running"}
          />
          {/* CHCLM crosscheck — appears after Agent 1 discharged, gates CRM checklist */}
          <ChclmChecklist
            scenario={scenario}
            state={runner.state}
            perform={runner.perform}
            disabled={runner.status !== "running"}
          />
          <CommChecklist
            scenario={scenario}
            state={runner.state}
            perform={runner.perform}
            disabled={runner.status !== "running"}
          />
          <DecisionPanel
            scenario={scenario}
            state={runner.state}
            perform={runner.perform}
            disabled={runner.status !== "running"}
          />
        </div>

        <aside className="flex flex-col gap-4">
          {/* Coach panel: hidden during active run — appears after decision for self-review */}
          {runner.state.decision ? (
            <GuidancePanel scenario={scenario} state={runner.state} />
          ) : (
            <div
              className="border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 flex items-center gap-3"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-brand)] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
                Scenario in progress — coach available after decision
              </span>
            </div>
          )}

          {autoEndAt != null && (
            <div className="border border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-brand)]">
                  AUTO-FINALIZING
                </div>
                <div className="font-sans text-sm text-[var(--color-text)] mt-0.5">
                  Submitting in {Math.ceil((remaining ?? 0) / 1000)}s
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoEndAt(Number.MAX_SAFE_INTEGER)}
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline underline-offset-2"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || runner.status !== "running"}
            className="h-12 bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Scoring…" : "End session & score now"}
          </button>

          {error && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-red)]">
              {error}
            </p>
          )}

          {/* Distraction queue indicator */}
          {distractionQueue.length > 0 && (
            <div className="border border-[var(--color-amber)] bg-[var(--color-amber-soft)] px-3 py-2 font-mono">
              <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-amber)]">
                {distractionQueue.length} ATC COMM{distractionQueue.length > 1 ? "S" : ""} QUEUED
              </span>
            </div>
          )}

          <details className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <summary className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)] cursor-pointer hover:text-[var(--color-text)]">
              EVENT LOG ({runner.events.length})
            </summary>
            <ol className="flex flex-col gap-1.5 max-h-60 overflow-y-auto mt-3">
              {runner.events.length === 0 && (
                <li className="font-mono text-xs text-[var(--color-text-faint)]">
                  — no events —
                </li>
              )}
              {runner.events.map((e, i) => (
                <li key={i} className="flex items-baseline gap-3 font-mono text-xs">
                  <span className="text-[var(--color-text-faint)] tabular-nums w-12">
                    {(e.tMs / 1000).toFixed(1)}s
                  </span>
                  <span
                    className={
                      e.source === "pilot"
                        ? "text-[var(--color-text)]"
                        : "text-[var(--color-brand)]"
                    }
                  >
                    {e.kind === "STEP"
                      ? `STEP · ${e.stepId}`
                      : e.kind === "DECISION"
                      ? `DECISION · ${e.value}`
                      : e.kind === "TRIGGER"
                      ? `TRIGGER · ${e.triggerId}`
                      : `EFFECT · ${e.sourceId}`}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </aside>
      </div>

      {/* ATC / comms modal — LEFT side, always visible alongside crew popup */}
      {activeDistraction && runner.status === "running" && (
        <DistractionModal
          distraction={activeDistraction}
          onRespond={handleDistractionRespond}
          onStandby={handleDistractionStandby}
        />
      )}

      {/* Crew action popup — RIGHT side, 2-second gap between steps */}
      {runner.status === "running" && popupReady && (
        <FlightCheckPopup
          scenario={scenario}
          state={runner.state}
          perform={performWithGap}
          disabled={runner.status !== "running"}
          compact={!!activeDistraction}
        />
      )}
    </main>
  );
}
