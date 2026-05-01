"use client";

import type { ScenarioState } from "@/engine/state";
import type { Scenario } from "@/scenarios/types";

function formatClock(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  const cs = Math.floor((ms % 1000) / 100);
  return `${m}:${s}.${cs}`;
}

export function ScenarioClock({
  elapsedMs,
  state,
  scenario,
}: {
  elapsedMs: number;
  state: ScenarioState;
  scenario: Scenario;
}) {
  const completed = Object.keys(state.completedSteps).length;
  const required = scenario.steps.filter((s) => !s.optional).length;

  return (
    <div className="flex items-center justify-between gap-6 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
            Time
          </div>
          <div className="font-mono text-2xl tabular-nums tracking-tight">
            {formatClock(elapsedMs)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
            Scenario
          </div>
          <div className="font-mono text-sm tracking-[0.1em] text-[var(--color-text)]">
            {scenario.meta.title.toUpperCase()}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
            Progress
          </div>
          <div className="font-mono text-sm tabular-nums tracking-[0.1em] text-[var(--color-text)]">
            {completed} / {required} STEPS
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {state.decision ? (
          <Indicator label="DECISION" value={state.decision.value.replace(/_/g, " ")} color="var(--color-amber)" />
        ) : null}
      </div>
    </div>
  );
}

function Indicator({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-end" style={{ color }}>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
        {label}
      </div>
      <div className="font-mono text-sm tracking-[0.1em]">{value}</div>
    </div>
  );
}
