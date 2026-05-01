"use client";

import Link from "next/link";
import {
  TrophyIcon,
  PlayIcon,
  TargetIcon,
  GridIcon,
  HomeIcon,
  ListIcon,
  TagIcon,
  PlaneIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import StatisticsCard from "@/components/shadcn-studio/blocks/statistics-card-01";

type Debrief = {
  debriefId: string;
  scenarioSlug: string;
  composite: number;
  createdAt: number;
};

type ScenarioLite = {
  slug: string;
  title: string;
  system: string;
  phase: string;
  runHref: string;
};

export function DashboardShell({
  authConfigured,
  userId,
  stats,
  debriefs,
  bestPerScenarioEntries,
  scenarios,
}: {
  authConfigured: boolean;
  userId: string | null;
  stats: {
    sessionsRun: number;
    bestScore: number | null;
    avgScore: number | null;
    coverage: string;
  };
  debriefs: Debrief[];
  bestPerScenarioEntries: Array<[string, number]>;
  scenarios: ScenarioLite[];
}) {
  const bestPerScenario = new Map(bestPerScenarioEntries);

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <Link
            href="/"
            className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
          >
            <div className="h-6 w-6 border border-[var(--color-brand)] rotate-45 relative shrink-0">
              <div className="absolute inset-1 border border-[var(--color-brand)]" />
            </div>
            <span className="font-sans text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              Crosscheck
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive>
                    <Link href="/dashboard">
                      <HomeIcon />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/scenarios">
                      <ListIcon />
                      <span>Scenarios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/pricing">
                      <TagIcon />
                      <span>Pricing</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Train</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {scenarios.slice(0, 4).map((s) => (
                  <SidebarMenuItem key={s.slug}>
                    <SidebarMenuButton asChild>
                      <Link href={s.runHref}>
                        <PlaneIcon />
                        <span>{s.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Crosscheck</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <Link
              href="/scenarios"
              className="font-mono text-xs uppercase tracking-[0.15em] border border-[var(--color-brand)] text-[var(--color-brand)] px-3 py-1.5 rounded-sm hover:bg-[var(--color-brand-soft)] transition-colors"
            >
              New session
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] mb-1.5">
              DASHBOARD
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Your sessions</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {!authConfigured
                ? "Sign-in is not yet configured. Once Clerk is wired, your sessions accumulate here."
                : !userId
                ? "Sign in to see your past sessions."
                : debriefs.length === 0
                ? "No sessions yet. Pick a scenario and run your first one."
                : `${debriefs.length} session${debriefs.length === 1 ? "" : "s"} recorded.`}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatisticsCard
              icon={<PlayIcon className="size-4" />}
              value={String(stats.sessionsRun)}
              title="Sessions run"
              changePercentage={stats.sessionsRun > 0 ? "+ tracked" : "—"}
            />
            <StatisticsCard
              icon={<TrophyIcon className="size-4" />}
              value={stats.bestScore != null ? String(stats.bestScore) : "—"}
              title="Best score"
              changePercentage={stats.bestScore != null ? "Composite" : "—"}
            />
            <StatisticsCard
              icon={<TargetIcon className="size-4" />}
              value={stats.avgScore != null ? String(stats.avgScore) : "—"}
              title="Average score"
              changePercentage={stats.avgScore != null ? "Across runs" : "—"}
            />
            <StatisticsCard
              icon={<GridIcon className="size-4" />}
              value={stats.coverage}
              title="Scenario coverage"
              changePercentage={stats.sessionsRun > 0 ? "Unique slugs" : "—"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ScoreTrendCard debriefs={debriefs} />
            <ScenarioMixCard debriefs={debriefs} />
          </div>

          {debriefs.length > 0 && <SessionsTable debriefs={debriefs} scenarios={scenarios} />}

          <CompletionGrid scenarios={scenarios} bestPerScenario={bestPerScenario} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ScoreTrendCard({ debriefs }: { debriefs: Debrief[] }) {
  const data = [...debriefs]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((d, i) => ({ run: i + 1, composite: d.composite }));
  if (data.length === 0) {
    data.push({ run: 0, composite: 0 });
  }

  const config = {
    composite: { label: "Composite", color: "var(--primary)" },
  } satisfies ChartConfig;

  return (
    <Card className="lg:col-span-2 gap-4">
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-semibold">Score trend</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {debriefs.length === 0 ? "NO DATA YET" : `${debriefs.length} RUNS`}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <LineChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="run"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={32}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="composite"
              type="monotone"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--primary)" }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ScenarioMixCard({ debriefs }: { debriefs: Debrief[] }) {
  // Count of runs per scenario
  const counts = new Map<string, number>();
  for (const d of debriefs) {
    counts.set(d.scenarioSlug, (counts.get(d.scenarioSlug) ?? 0) + 1);
  }
  const data = Array.from(counts.entries()).map(([slug, count]) => ({
    slug: slug.replace(/-/g, " ").slice(0, 14),
    count,
  }));

  const config = {
    count: { label: "Runs", color: "var(--primary)" },
  } satisfies ChartConfig;

  return (
    <Card className="gap-4">
      <CardHeader>
        <span className="text-base font-semibold">Scenario mix</span>
        <p className="text-xs text-muted-foreground">
          Runs per scenario.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-56 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            No runs yet
          </div>
        ) : (
          <ChartContainer config={config} className="h-56 w-full">
            <BarChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="slug"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--primary)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function SessionsTable({
  debriefs,
  scenarios,
}: {
  debriefs: Debrief[];
  scenarios: ScenarioLite[];
}) {
  const titleBySlug = new Map(scenarios.map((s) => [s.slug, s.title]));
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-6 py-4 border-b border-border">
        <span className="text-base font-semibold">Recent sessions</span>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              <Th>Date</Th>
              <Th>Scenario</Th>
              <Th>Composite</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {debriefs.map((d) => (
              <tr
                key={d.debriefId}
                className="border-t border-border last:border-b-0"
              >
                <Td className="font-mono text-xs text-muted-foreground">
                  {new Date(d.createdAt).toLocaleString()}
                </Td>
                <Td className="text-sm">
                  {titleBySlug.get(d.scenarioSlug) ?? d.scenarioSlug}
                </Td>
                <Td>
                  <ScoreBadge value={d.composite} />
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/debrief/${d.debriefId}`}
                    className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-brand)] hover:text-foreground"
                  >
                    View →
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CompletionGrid({
  scenarios,
  bestPerScenario,
}: {
  scenarios: ScenarioLite[];
  bestPerScenario: Map<string, number>;
}) {
  return (
    <section>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] mb-3">
        SCENARIO COVERAGE
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {scenarios.map((s) => {
          const best = bestPerScenario.get(s.slug);
          return (
            <Link
              key={s.slug}
              href={s.runHref}
              className="border border-border bg-card p-4 hover:border-[var(--color-brand)] transition-colors rounded-md"
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
                {s.system.toUpperCase()} · {s.phase.toUpperCase()}
              </div>
              <div className="font-sans text-sm font-medium leading-snug mb-3">
                {s.title}
              </div>
              {best != null ? (
                <ScoreBadge value={best} small />
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Not run
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ScoreBadge({ value, small }: { value: number; small?: boolean }) {
  const color =
    value >= 85
      ? "var(--color-green)"
      : value >= 60
      ? "var(--color-brand)"
      : "var(--color-red)";
  return (
    <span
      className={`font-mono tabular-nums tracking-tight ${small ? "text-base" : "text-xl"}`}
      style={{ color }}
    >
      {value}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-4 py-3 font-normal">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
