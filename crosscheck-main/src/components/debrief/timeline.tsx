"use client";

import type { ScenarioEvent } from "@/engine/events";

export function Timeline({ events }: { events: ScenarioEvent[] }) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)] mb-4">
        TIMELINE
      </div>
      <ol className="flex flex-col gap-1.5">
        {events.map((e, i) => (
          <li
            key={i}
            className="flex items-baseline gap-3 font-mono text-xs"
          >
            <span className="text-[var(--color-text-faint)] tabular-nums w-14">
              {(e.tMs / 1000).toFixed(1)}s
            </span>
            <span
              className={
                e.source === "pilot"
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-brand)]"
              }
            >
              {labelForEvent(e)}
            </span>
          </li>
        ))}
        {events.length === 0 && (
          <li className="font-mono text-xs text-[var(--color-text-faint)]">
            no events recorded
          </li>
        )}
      </ol>
    </div>
  );
}

function labelForEvent(e: ScenarioEvent): string {
  switch (e.kind) {
    case "STEP":
      return `STEP · ${e.stepId}`;
    case "DECISION":
      return `DECISION · ${e.value.replace(/_/g, " ")}`;
    case "TRIGGER":
      return `TRIGGER · ${e.triggerId}`;
    case "EFFECT":
      return `EFFECT · ${e.sourceId}`;
  }
}
