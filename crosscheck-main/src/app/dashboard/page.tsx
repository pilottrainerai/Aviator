import { listUserDebriefs } from "@/lib/sessions/store";
import { getUserId, isClerkConfigured } from "@/lib/auth";
import { SCENARIOS } from "@/scenarios/registry";
import { DashboardShell } from "./dashboard-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — Crosscheck",
};

export default async function DashboardPage() {
  const userId = await getUserId();
  const debriefs = userId ? await listUserDebriefs(userId) : [];

  const sessionsRun = debriefs.length;
  const bestScore = debriefs.length
    ? Math.max(...debriefs.map((d) => d.composite))
    : null;
  const avgScore = debriefs.length
    ? Math.round(
        debriefs.reduce((sum, d) => sum + d.composite, 0) / debriefs.length,
      )
    : null;
  const scenariosRun = new Set(debriefs.map((d) => d.scenarioSlug));
  const coverage = `${scenariosRun.size} / ${SCENARIOS.length}`;

  // Best per scenario for the completion grid
  const bestPerScenario = new Map<string, number>();
  for (const d of debriefs) {
    const cur = bestPerScenario.get(d.scenarioSlug);
    if (cur == null || d.composite > cur) bestPerScenario.set(d.scenarioSlug, d.composite);
  }

  return (
    <DashboardShell
      authConfigured={isClerkConfigured()}
      userId={userId}
      stats={{
        sessionsRun,
        bestScore,
        avgScore,
        coverage,
      }}
      debriefs={debriefs}
      bestPerScenarioEntries={Array.from(bestPerScenario.entries())}
      scenarios={SCENARIOS.map((s) => ({
        slug: s.slug,
        title: s.title,
        system: s.system,
        phase: s.phase,
        runHref: s.runHref ?? "/scenarios",
      }))}
    />
  );
}
