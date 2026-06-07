"use client";

import { useState } from "react";
import Link from "next/link";
import type { Scenario, AirportOption } from "@/scenarios/types";
import { DIFFICULTY_LABEL } from "@/scenarios/registry";

export function PreflightBrief({
  scenario,
  onStart,
}: {
  scenario: Scenario;
  onStart: (airport?: AirportOption) => void;
}) {
  const hasAirports = (scenario.airports?.length ?? 0) > 0;
  const [phase, setPhase] = useState<"brief" | "airports" | "countdown">("brief");
  const [count, setCount] = useState(3);
  const [selectedAirport, setSelectedAirport] = useState<AirportOption | null>(null);

  function startCountdown(airport?: AirportOption) {
    setPhase("countdown");
    setCount(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        onStart(airport);
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

  // ── Airport selection phase ───────────────────────────────────────────────
  if (phase === "airports") {
    const airports = scenario.airports ?? [];
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-4xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] mb-3">
            SELECT DESTINATION
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-2">
            Where are you diverting?
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] mb-10">
            FLAP 3 LANDING · VREF+10 · SELECT ALTERNATE AERODROME
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {airports.map((ap) => {
              const isSelected = selectedAirport?.icao === ap.icao;
              return (
                <button
                  key={ap.icao}
                  type="button"
                  onClick={() => setSelectedAirport(ap)}
                  className={[
                    "text-left border p-4 rounded-sm transition-colors",
                    isSelected
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/50",
                  ].join(" ")}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-mono text-base font-bold text-[var(--color-text)]">
                      {ap.icao}
                    </span>
                    <span className="font-mono text-xs text-[var(--color-text-faint)]">
                      {ap.iata}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--color-text)] leading-snug mb-3">
                    {ap.city}
                  </div>
                  <div className="space-y-1">
                    {ap.runways.map((rwy) => (
                      <div key={rwy.id} className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-[var(--color-text-faint)]">
                          RWY {rwy.id}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-text-faint)]">
                          {rwy.lengthM} M
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 font-mono text-[10px] text-[var(--color-text-faint)]">
                    ELEV {ap.elevFt} FT
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={!selectedAirport}
              onClick={() => selectedAirport && startCountdown(selectedAirport)}
              className="h-12 px-8 bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-sm uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm &amp; Start
            </button>
            <button
              type="button"
              onClick={() => setPhase("brief")}
              className="h-12 px-6 inline-flex items-center border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:border-[var(--color-brand)] hover:text-[var(--color-text)] transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Brief phase ───────────────────────────────────────────────────────────
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
          {scenario.meta.system.toUpperCase()} · {scenario.meta.phase.toUpperCase()} · LEVEL {DIFFICULTY_LABEL[scenario.meta.difficulty].toUpperCase()}
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
            onClick={() => hasAirports ? setPhase("airports") : startCountdown(undefined)}
            className="h-12 px-8 bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-sm uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors"
          >
            {hasAirports ? "Select destination →" : "Start scenario"}
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
