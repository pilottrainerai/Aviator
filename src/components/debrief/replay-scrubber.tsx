"use client";

import { useMemo, useState } from "react";
import type { ScenarioEvent } from "@/engine/events";

/**
 * Scrubbable replay — slider over the action log. Clicking through shows the
 * cumulative action sequence at any point in the run. Lightweight version of
 * the "state-snapshot reconstruction" planned in PLAN.md §4 — re-running the
 * reducer over the prefix is exact-equivalent because the reducer is pure.
 */
export function ReplayScrubber({ events }: { events: ScenarioEvent[] }) {
  const total = events.length;
  const [idx, setIdx] = useState(total);

  const upTo = useMemo(() => events.slice(0, idx), [events, idx]);
  const elapsedMs = upTo.length ? upTo[upTo.length - 1].tMs : 0;

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
          REPLAY
        </div>
        <div className="flex items-baseline gap-4 font-mono text-xs text-[var(--color-text-muted)]">
          <span className="tabular-nums">
            {idx} / {total} EVENTS
          </span>
          <span className="tabular-nums">{(elapsedMs / 1000).toFixed(1)}s</span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={total}
        value={idx}
        onChange={(e) => setIdx(Number(e.target.value))}
        className="w-full accent-[var(--color-brand)] cursor-pointer"
        aria-label="Replay position"
      />

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] mb-2">
            COMPLETED STEPS
          </div>
          <ol className="flex flex-col gap-1">
            {upTo
              .filter((e) => e.kind === "STEP")
              .map((e, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-3 font-mono text-xs"
                >
                  <span className="text-[var(--color-text-faint)] tabular-nums w-12">
                    {(e.tMs / 1000).toFixed(1)}s
                  </span>
                  <span className="text-[var(--color-green)]">
                    {e.kind === "STEP" ? e.stepId : ""}
                  </span>
                </li>
              ))}
            {upTo.filter((e) => e.kind === "STEP").length === 0 && (
              <li className="font-mono text-xs text-[var(--color-text-faint)]">
                — none yet —
              </li>
            )}
          </ol>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] mb-2">
            SYSTEM EVENTS
          </div>
          <ol className="flex flex-col gap-1">
            {upTo
              .filter((e) => e.source === "system")
              .map((e, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-3 font-mono text-xs"
                >
                  <span className="text-[var(--color-text-faint)] tabular-nums w-12">
                    {(e.tMs / 1000).toFixed(1)}s
                  </span>
                  <span className="text-[var(--color-brand)]">
                    {e.kind === "TRIGGER"
                      ? e.triggerId
                      : e.kind === "EFFECT"
                      ? e.sourceId
                      : ""}
                  </span>
                </li>
              ))}
            {upTo.filter((e) => e.source === "system").length === 0 && (
              <li className="font-mono text-xs text-[var(--color-text-faint)]">
                — none yet —
              </li>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
