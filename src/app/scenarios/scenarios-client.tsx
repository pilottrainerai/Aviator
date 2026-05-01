"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ClockIcon,
  FlameIcon,
  PlaneIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import {
  PHASE_LABEL,
  SYSTEM_LABEL,
  type ScenarioMeta,
  type ScenarioPhase,
  type ScenarioSystem,
} from "@/scenarios/registry";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Footer } from "@/components/marketing/footer";

type SystemFilter = "all" | ScenarioSystem;
type PhaseFilter = "all" | ScenarioPhase;
type DifficultyFilter = "all" | "easy" | "moderate" | "hard";

const SYSTEM_OPTIONS: Array<{ value: SystemFilter; label: string }> = [
  { value: "all", label: "All systems" },
  { value: "fire", label: "Fire" },
  { value: "engines", label: "Engines" },
  { value: "hydraulics", label: "Hydraulics" },
  { value: "electrical", label: "Electrical" },
  { value: "pressurization", label: "Pressurization" },
  { value: "flight-controls", label: "Flight controls" },
  { value: "smoke-fumes", label: "Smoke / fumes" },
];

const PHASE_OPTIONS: Array<{ value: PhaseFilter; label: string }> = [
  { value: "all", label: "All phases" },
  { value: "takeoff", label: "Takeoff" },
  { value: "cruise", label: "Cruise" },
  { value: "approach", label: "Approach" },
  { value: "any", label: "Any phase" },
];

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyFilter; label: string }> = [
  { value: "all", label: "Any difficulty" },
  { value: "easy", label: "1–2" },
  { value: "moderate", label: "3" },
  { value: "hard", label: "4–5" },
];

function matchesDifficulty(value: number, filter: DifficultyFilter) {
  if (filter === "all") return true;
  if (filter === "easy") return value <= 2;
  if (filter === "moderate") return value === 3;
  return value >= 4;
}

export function ScenariosClient({ scenarios }: { scenarios: ScenarioMeta[] }) {
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<SystemFilter>("all");
  const [phase, setPhase] = useState<PhaseFilter>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");

  const filtered = useMemo(() => {
    return scenarios.filter((s) => {
      if (
        query &&
        !s.title.toLowerCase().includes(query.toLowerCase()) &&
        !s.summary.toLowerCase().includes(query.toLowerCase())
      ) {
        return false;
      }
      if (system !== "all" && s.system !== system) return false;
      if (phase !== "all" && s.phase !== phase) return false;
      if (!matchesDifficulty(s.difficulty, difficulty)) return false;
      return true;
    });
  }, [scenarios, query, system, phase, difficulty]);

  const activeFilters = [
    system !== "all" && { key: "system", label: SYSTEM_LABEL[system as ScenarioSystem], reset: () => setSystem("all") },
    phase !== "all" && { key: "phase", label: PHASE_LABEL[phase as ScenarioPhase], reset: () => setPhase("all") },
    difficulty !== "all" && { key: "difficulty", label: DIFFICULTY_OPTIONS.find((o) => o.value === difficulty)?.label ?? "", reset: () => setDifficulty("all") },
    query && { key: "query", label: `"${query}"`, reset: () => setQuery("") },
  ].filter(Boolean) as Array<{ key: string; label: string; reset: () => void }>;

  const clearAll = () => {
    setQuery("");
    setSystem("all");
    setPhase("all");
    setDifficulty("all");
  };

  return (
    <main className="flex flex-1 flex-col">
      <Header
        availableCount={scenarios.length}
        filteredCount={filtered.length}
      />

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 space-y-8">
        <FilterBar
          query={query}
          setQuery={setQuery}
          system={system}
          setSystem={setSystem}
          phase={phase}
          setPhase={setPhase}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
        />

        {activeFilters.length > 0 && (
          <ActiveFilters filters={activeFilters} clearAll={clearAll} />
        )}

        {filtered.length === 0 ? (
          <EmptyState clearAll={clearAll} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s, i) => (
              <ScenarioCard key={s.slug} scenario={s} index={i} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

function Header({
  availableCount,
  filteredCount,
}: {
  availableCount: number;
  filteredCount: number;
}) {
  return (
    <header className="border-b border-border">
      <div className="max-w-7xl mx-auto w-full px-6 pt-10 pb-12">
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← CROSSCHECK
          </Link>
          <Link
            href="/dashboard"
            className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard →
          </Link>
        </div>

        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--color-brand)] mb-3">
              SCENARIO LIBRARY
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight max-w-3xl">
              {availableCount} A320 abnormal procedures.
              <span className="text-muted-foreground"> Pick one and run it.</span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
              Each scenario uses the same engine, scoring, and AI debrief.
              Authored against published training references; type-rated SME
              reviews each before user-visible release.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-[0.04em]">
              {filteredCount} / {availableCount} matching
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}

function FilterBar({
  query,
  setQuery,
  system,
  setSystem,
  phase,
  setPhase,
  difficulty,
  setDifficulty,
}: {
  query: string;
  setQuery: (v: string) => void;
  system: SystemFilter;
  setSystem: (v: SystemFilter) => void;
  phase: PhaseFilter;
  setPhase: (v: PhaseFilter) => void;
  difficulty: DifficultyFilter;
  setDifficulty: (v: DifficultyFilter) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search by name or system…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <FilterRow label="System">
        <ToggleGroup
          type="single"
          value={system}
          onValueChange={(v) => v && setSystem(v as SystemFilter)}
          variant="outline"
          size="sm"
          className="flex-wrap justify-start"
        >
          {SYSTEM_OPTIONS.map((o) => (
            <ToggleGroupItem
              key={o.value}
              value={o.value}
              className="font-mono text-[10px] uppercase tracking-[0.04em] data-[state=on]:bg-[var(--color-brand-soft)] data-[state=on]:text-[var(--color-brand)] data-[state=on]:border-[var(--color-brand)]"
            >
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FilterRow>

      <FilterRow label="Phase">
        <ToggleGroup
          type="single"
          value={phase}
          onValueChange={(v) => v && setPhase(v as PhaseFilter)}
          variant="outline"
          size="sm"
          className="flex-wrap justify-start"
        >
          {PHASE_OPTIONS.map((o) => (
            <ToggleGroupItem
              key={o.value}
              value={o.value}
              className="font-mono text-[10px] uppercase tracking-[0.04em] data-[state=on]:bg-[var(--color-brand-soft)] data-[state=on]:text-[var(--color-brand)] data-[state=on]:border-[var(--color-brand)]"
            >
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FilterRow>

      <FilterRow label="Difficulty">
        <ToggleGroup
          type="single"
          value={difficulty}
          onValueChange={(v) => v && setDifficulty(v as DifficultyFilter)}
          variant="outline"
          size="sm"
          className="justify-start"
        >
          {DIFFICULTY_OPTIONS.map((o) => (
            <ToggleGroupItem
              key={o.value}
              value={o.value}
              className="font-mono text-[10px] uppercase tracking-[0.04em] data-[state=on]:bg-[var(--color-brand-soft)] data-[state=on]:text-[var(--color-brand)] data-[state=on]:border-[var(--color-brand)]"
            >
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FilterRow>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ActiveFilters({
  filters,
  clearAll,
}: {
  filters: Array<{ key: string; label: string; reset: () => void }>;
  clearAll: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
        ACTIVE
      </span>
      {filters.map((f) => (
        <Badge
          key={f.key}
          variant="outline"
          className="gap-1.5 font-mono text-[10px] uppercase tracking-[0.04em] border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]"
        >
          {f.label}
          <button
            type="button"
            onClick={f.reset}
            aria-label={`Remove ${f.label} filter`}
            className="hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <Button
        size="sm"
        variant="ghost"
        onClick={clearAll}
        className="h-6 px-2 font-mono text-[10px] uppercase tracking-[0.04em]"
      >
        Clear all
      </Button>
    </div>
  );
}

function EmptyState({ clearAll }: { clearAll: () => void }) {
  return (
    <Card className="py-16">
      <CardContent className="flex flex-col items-center text-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
          <SearchIcon className="size-5" />
        </div>
        <div>
          <p className="text-base font-medium">No scenarios match.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try widening your filters or clearing them all.
          </p>
        </div>
        <Button onClick={clearAll} variant="outline" size="sm">
          Clear filters
        </Button>
      </CardContent>
    </Card>
  );
}

function ScenarioCard({ scenario }: { scenario: ScenarioMeta; index: number }) {
  const SystemIcon =
    scenario.system === "fire"
      ? FlameIcon
      : scenario.system === "engines"
      ? PlaneIcon
      : SparklesIcon;

  return (
    <Link
      href={scenario.runHref ?? "/scenarios"}
      className="group focus-visible:outline-none"
    >
      <Card className="relative h-full overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-[var(--color-brand)] hover:shadow-[0_0_0_1px_var(--color-brand-soft)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brand)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <SystemIcon className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[9px] uppercase tracking-[0.04em] text-muted-foreground leading-tight">
                  {SYSTEM_LABEL[scenario.system]}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.04em] text-muted-foreground leading-tight">
                  {PHASE_LABEL[scenario.phase]}
                </span>
              </div>
            </div>
            <DifficultyBars value={scenario.difficulty} />
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight leading-snug">
            {scenario.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {scenario.summary}
          </p>
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t [.border-t]:pt-4 mt-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ClockIcon className="size-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-[0.04em]">
              ~{scenario.estimatedMinutes} MIN
            </span>
          </div>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--color-brand)] group-hover:gap-2 transition-all">
            START
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardFooter>

        <Separator className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brand)] to-transparent opacity-0 group-hover:opacity-50 transition-opacity" />
      </Card>
    </Link>
  );
}

function DifficultyBars({ value }: { value: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Difficulty ${value} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="h-1 w-2 rounded-sm transition-colors"
          style={{
            backgroundColor:
              i < value ? "var(--color-brand)" : "var(--color-border)",
          }}
        />
      ))}
    </div>
  );
}
