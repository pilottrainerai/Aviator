"use client";

import { useState } from "react";
import Link from "next/link";
import type { Scenario } from "@/scenarios/types";

export function PreflightBrief({
  scenario,
  onStart,
}: {
  scenario: Scenario;
  onStart: () => void;
}) {
  const [phase, setPhase] = useState<"brief" | "countdown">("brief");
  const [count, setCount] = useState(3);

  function startCountdown() {
    setPhase("countdown");
    setCount(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        onStart();
      } else {
        setCount(n);
      }
    }, 800);
  }

  if (phase === "countdown") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-faint)]">
            SCENARIO STARTING
          </div>
          <div className="font-mono text-9xl tabular-nums text-[var(--color-brand)]">
            {count}
          </div>
        </div>
      </main>
    );
  }

  const requiredSteps = scenario.steps.filter((s) => !s.optional);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] mb-3">
          MISSION BRIEF
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight mb-2">
          {scenario.meta.title}
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] mb-10">
          {scenario.meta.system.toUpperCase()} · {scenario.meta.phase.toUpperCase()} · DIFFICULTY {scenario.meta.difficulty}/5
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)] mb-2">
              SITUATION
            </div>
            <p className="text-base text-[var(--color-text)] leading-relaxed">
              {scenario.brief.situation}
            </p>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)] mb-2">
              YOUR JOB
            </div>
            <p className="text-base text-[var(--color-text)] leading-relaxed">
              {scenario.brief.job}
            </p>
          </div>
        </div>

        <div className="border border-[var(--color-border)] bg-[var(--color-surface)] mb-10">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
              EXPECTED PROCEDURE
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
              {requiredSteps.length} STEPS · ~{scenario.meta.estimatedMinutes} MIN
            </div>
          </div>
          <ol className="divide-y divide-[var(--color-border)]">
            {scenario.steps.map((s, i) => (
              <li key={s.id} className="flex items-baseline gap-4 px-5 py-3">
                <span className="font-mono text-xs tabular-nums text-[var(--color-text-faint)] w-4">
                  {i + 1}
                </span>
                <span className="font-sans text-sm text-[var(--color-text)] flex-1">
                  {s.label}
                  {s.optional && (
                    <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-faint)]">
                      OPTIONAL
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--color-brand)]">
                  {s.action}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={startCountdown}
            className="h-12 px-8 bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-sm uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors"
          >
            Start scenario
          </button>
          <Link
            href="/scenarios"
            className="h-12 px-6 inline-flex items-center border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:border-[var(--color-brand)] hover:text-[var(--color-text)] transition-colors"
          >
            Back to library
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] ml-auto">
            CLOCK STARTS THE MOMENT YOU PRESS START
          </p>
        </div>
      </div>
    </main>
  );
}
