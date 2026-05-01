import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuiz } from "@/quizzes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/marketing/footer";

export const dynamic = "force-dynamic";

type Row = {
  submittedAt?: string;
  respondent?: string;
  quizSlug?: string;
  answers?: Record<string, string>;
  userAgent?: string;
};

async function fetchResponses(slug: string): Promise<{
  configured: boolean;
  rows: Row[];
  message?: string;
}> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/quiz/${slug}/responses`, {
      cache: "no-store",
    });
    if (!res.ok) return { configured: false, rows: [], message: "Fetch failed" };
    const data = (await res.json()) as {
      configured?: boolean;
      rows?: Row[];
      message?: string;
    };
    return {
      configured: !!data.configured,
      rows: data.rows ?? [],
      message: data.message,
    };
  } catch {
    return { configured: false, rows: [], message: "Network error" };
  }
}

export default async function AdminQuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const quiz = getQuiz(slug);
  if (!quiz) notFound();
  const { configured, rows, message } = await fetchResponses(slug);

  const optionLabels = new Map<string, Map<string, string>>();
  for (const q of quiz.questions) {
    if (q.type === "single" || q.type === "multi") {
      const m = new Map<string, string>();
      for (const o of q.options) m.set(o.value, o.label);
      optionLabels.set(q.id, m);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Crosscheck
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight mt-2">
              Quiz responses · {quiz.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {rows.length} response{rows.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={configured ? "default" : "secondary"}>
              {configured ? "Webhook live" : "Webhook not configured"}
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto w-full px-6 py-10 space-y-6">
        {!configured && (
          <Card>
            <CardContent className="py-6 space-y-2">
              <p className="text-sm">
                Set <code className="font-mono text-xs">QUIZ_WEBHOOK_URL</code>{" "}
                in your environment to point at your deployed Google Apps Script
                web-app URL. The script lives at{" "}
                <code className="font-mono text-xs">docs/quiz-google-script.gs</code>{" "}
                in this repo.
              </p>
              {message && (
                <p className="text-xs text-muted-foreground">{message}</p>
              )}
            </CardContent>
          </Card>
        )}

        {configured && rows.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No responses yet. Share <code className="font-mono">/quiz/{slug}</code>{" "}
                with respondents to start collecting answers.
              </p>
            </CardContent>
          </Card>
        )}

        {rows.map((row, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <span className="text-base font-semibold">
                    {row.respondent || "Anonymous respondent"}
                  </span>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    {row.submittedAt
                      ? new Date(row.submittedAt).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Response #{i + 1}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {quiz.questions.map((q) => {
                  const ans = row.answers?.[q.id];
                  if (!ans) return null;
                  const labelLookup = optionLabels.get(q.id);
                  const display = labelLookup?.get(ans) ?? ans;
                  return (
                    <div key={q.id} className="border-l-2 border-border pl-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground mb-1">
                        {q.section} · {q.id}
                      </p>
                      <p className="text-sm font-medium mb-1">{q.prompt}</p>
                      <p className="text-sm text-[var(--color-brand)] whitespace-pre-wrap">
                        {display}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Footer />
    </main>
  );
}
