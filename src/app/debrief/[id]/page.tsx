import Link from "next/link";
import { notFound } from "next/navigation";
import { getDebrief, getSession } from "@/lib/sessions/store";
import { Rubric } from "@/components/debrief/rubric";
import { Timeline } from "@/components/debrief/timeline";
import { Narrative } from "@/components/debrief/narrative";
import { ReplayScrubber } from "@/components/debrief/replay-scrubber";

export const dynamic = "force-dynamic";

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const debrief = await getDebrief(id);
  if (!debrief) notFound();
  const session = await getSession(debrief.sessionId);

  return (
    <main className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
            DEBRIEF · {session?.scenarioSlug ?? "—"}
          </div>
          <div className="font-sans text-base text-[var(--color-text)] mt-1">
            {new Date(debrief.createdAt).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/scenarios"
            className="h-10 px-4 inline-flex items-center border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:border-[var(--color-brand)] hover:text-[var(--color-text)] transition-colors"
          >
            All scenarios
          </Link>
          {session && (
            <Link
              href={`/train/${session.scenarioSlug}`}
              className="h-10 px-4 inline-flex items-center bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors"
            >
              Run again
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_440px] gap-6 p-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-6">
          <Rubric rubric={debrief.rubric} composite={debrief.compositeScore} />
          {session && <ReplayScrubber events={session.events} />}
          {session && <Timeline events={session.events} />}
        </div>
        <aside>
          <Narrative initial={debrief.narrative} debriefId={debrief.id} />
        </aside>
      </div>
    </main>
  );
}
