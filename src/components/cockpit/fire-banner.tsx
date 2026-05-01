"use client";

import type { ScenarioState } from "@/engine/state";

export function FireBanner({ state }: { state: ScenarioState }) {
  if (!state.masterWarnActive) return null;

  return (
    <div
      className="flex items-center justify-center gap-4 px-6 py-3 bg-[var(--color-red)] text-white animate-pulse"
      role="alert"
    >
      <div className="h-2.5 w-2.5 rounded-full bg-white" />
      <span className="font-mono text-sm font-bold uppercase tracking-[0.3em]">
        MASTER WARN{state.alarmLabel ? ` · ${state.alarmLabel}` : ""}
      </span>
      <div className="h-2.5 w-2.5 rounded-full bg-white" />
    </div>
  );
}
