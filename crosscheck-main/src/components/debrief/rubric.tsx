"use client";

import type { DebriefRubric } from "@/lib/sessions/store";

const AXES: Array<{
  key: keyof DebriefRubric;
  label: string;
  description: string;
}> = [
  {
    key: "correctness",
    label: "Correctness",
    description: "Did the right action items happen?",
  },
  {
    key: "sequence",
    label: "Sequence",
    description: "Were actions in procedurally valid order?",
  },
  {
    key: "decision",
    label: "Decision quality",
    description: "Was the strategic call sound?",
  },
];

function scoreColor(score: number): string {
  if (score >= 85) return "var(--color-green)";
  if (score >= 60) return "var(--color-brand)";
  return "var(--color-red)";
}

export function Rubric({
  rubric,
  composite,
}: {
  rubric: DebriefRubric;
  composite: number;
}) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)] mb-1">
            COMPOSITE SCORE
          </div>
          <div
            className="font-mono text-6xl font-semibold tabular-nums tracking-tight"
            style={{ color: scoreColor(composite) }}
          >
            {composite}
            <span className="text-2xl text-[var(--color-text-faint)]"> / 100</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {AXES.map((a) => {
          const s = rubric[a.key];
          return (
            <div
              key={a.key}
              className="border-l-2 pl-4"
              style={{ borderLeftColor: scoreColor(s.score) }}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
                    {a.label}
                  </div>
                  <div className="font-sans text-[13px] text-[var(--color-text-muted)]">
                    {a.description}
                  </div>
                </div>
                <div
                  className="font-mono text-xl tabular-nums"
                  style={{ color: scoreColor(s.score) }}
                >
                  {s.score}
                </div>
              </div>
              <div className="font-sans text-sm text-[var(--color-text)] leading-relaxed">
                {s.evidence}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
