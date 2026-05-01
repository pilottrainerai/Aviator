"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CheckCircle2Icon,
  ArrowRightIcon,
  ClockIcon,
  UserIcon,
} from "lucide-react";
import type { Quiz, QuizQuestion } from "@/quizzes/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Footer } from "@/components/marketing/footer";

type Answers = Record<string, string>;

const draftKey = (slug: string) => `crosscheck-quiz-draft:${slug}`;

export function QuizClient({ quiz }: { quiz: Quiz }) {
  const [respondent, setRespondent] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hydrate draft from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(quiz.slug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { respondent?: string; answers?: Answers };
      if (parsed.respondent) setRespondent(parsed.respondent);
      if (parsed.answers) setAnswers(parsed.answers);
    } catch {
      // ignore
    }
  }, [quiz.slug]);

  // Persist draft on every change
  useEffect(() => {
    if (status === "success") return;
    try {
      window.localStorage.setItem(
        draftKey(quiz.slug),
        JSON.stringify({ respondent, answers }),
      );
    } catch {
      // ignore
    }
  }, [respondent, answers, quiz.slug, status]);

  const totalRequired = quiz.questions.filter((q) => q.type !== "text").length;
  const answered = useMemo(
    () =>
      quiz.questions.filter(
        (q) => q.type !== "text" && answers[q.id] && answers[q.id]!.length > 0,
      ).length,
    [answers, quiz.questions],
  );
  const progressPct = totalRequired === 0 ? 0 : Math.round((answered / totalRequired) * 100);
  const remaining = totalRequired - answered;

  const setAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  function scrollToFirstUnanswered() {
    const firstUnanswered = quiz.questions.find(
      (q) => q.type !== "text" && (!answers[q.id] || answers[q.id]!.length === 0),
    );
    if (!firstUnanswered) return;
    const el = document.getElementById(`q-${firstUnanswered.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (remaining > 0) {
      scrollToFirstUnanswered();
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizSlug: quiz.slug,
          respondent: respondent.trim(),
          answers,
          submittedAt: new Date().toISOString(),
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Submit failed");
      }
      setStatus("success");
      try {
        window.localStorage.removeItem(draftKey(quiz.slug));
      } catch {
        // ignore
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return <SuccessScreen respondent={respondent} />;
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Sticky top progress */}
      <div className="sticky top-0 z-30 bg-[var(--color-bg)]/90 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto w-full px-6 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Crosscheck
          </Link>
          <Progress value={progressPct} className="flex-1 h-1.5" />
          <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
            {answered} / {totalRequired}
          </span>
        </div>
      </div>

      <header className="max-w-3xl mx-auto w-full px-6 pt-12 pb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--color-brand)] mb-3">
          FOUNDER CALIBRATION
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight mb-4">
          {quiz.title}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed mb-6 max-w-2xl">
          {quiz.intro}
        </p>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" />
            ~{quiz.estimatedMinutes} min
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserIcon className="size-3.5" />
            For: {quiz.audience}
          </span>
        </div>
      </header>

      <form
        id="quiz-form"
        onSubmit={submit}
        className="max-w-3xl mx-auto w-full px-6 pb-32 flex flex-col gap-12"
      >
        <Card>
          <CardHeader>
            <span className="text-base font-semibold">Your name (optional)</span>
            <p className="text-sm text-muted-foreground">
              So we can attribute your answers to a face.
            </p>
          </CardHeader>
          <CardContent>
            <Input
              value={respondent}
              onChange={(e) => setRespondent(e.target.value)}
              placeholder="Captain Smith, A320 trainer"
              autoComplete="name"
              className="h-11"
            />
          </CardContent>
        </Card>

        {quiz.sections.map((section) => {
          const sectionQs = quiz.questions.filter((q) => q.section === section.id);
          if (sectionQs.length === 0) return null;
          return (
            <section key={section.id} className="flex flex-col gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--color-brand)] mb-2">
                  {section.title}
                </div>
                {section.description && (
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    {section.description}
                  </p>
                )}
              </div>
              {sectionQs.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={
                    quiz.questions.findIndex((qq) => qq.id === q.id) + 1
                  }
                  value={answers[q.id] ?? ""}
                  onChange={(v) => setAnswer(q.id, v)}
                />
              ))}
            </section>
          );
        })}

        <p className="text-xs text-muted-foreground text-center">
          Your answers save automatically as a draft in this browser.
        </p>
      </form>

      {/* Sticky bottom submit bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-[var(--color-bg)]/95 backdrop-blur border-t border-border shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-3xl mx-auto w-full px-6 py-3 flex items-center gap-4">
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs tabular-nums text-foreground">
                {answered} / {totalRequired}
              </span>
              <span className="text-sm text-muted-foreground truncate">
                {remaining === 0
                  ? "All answered. Ready to submit."
                  : `${remaining} unanswered`}
              </span>
            </div>
            {status === "error" && errorMsg && (
              <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--color-red)] mt-1 truncate">
                {errorMsg}
              </p>
            )}
          </div>
          {remaining > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={scrollToFirstUnanswered}
              className="font-mono uppercase tracking-[0.04em] shrink-0"
            >
              Find next
              <ArrowRightIcon className="size-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="submit"
              form="quiz-form"
              size="lg"
              disabled={status === "submitting"}
              className="font-mono uppercase tracking-[0.04em] shrink-0"
            >
              {status === "submitting" ? "Submitting…" : "Submit responses"}
              <ArrowRightIcon className="size-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}

function QuestionCard({
  question,
  index,
  value,
  onChange,
}: {
  question: QuizQuestion;
  index: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const isRequired = question.type !== "text";
  const unanswered = isRequired && (!value || value.length === 0);

  return (
    <Card
      id={`q-${question.id}`}
      className="overflow-hidden scroll-mt-24"
      style={{
        borderColor: unanswered ? undefined : undefined,
      }}
    >
      <CardHeader>
        <div className="flex items-baseline gap-3">
          <Badge
            variant="outline"
            className="font-mono text-[10px] tracking-[0.04em] shrink-0 inline-flex items-center gap-1"
          >
            <span>Q{index}</span>
            {unanswered && (
              <span
                aria-label="unanswered"
                className="text-[var(--color-red)] font-semibold leading-none"
              >
                *
              </span>
            )}
          </Badge>
          <p className="text-base font-medium leading-snug flex-1">
            {question.prompt}
            {unanswered && (
              <span
                aria-hidden
                className="text-[var(--color-red)] ml-1.5 align-text-top"
              >
                *
              </span>
            )}
          </p>
        </div>
        {question.helper && (
          <p className="text-sm text-muted-foreground mt-2 ml-12">
            {question.helper}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {question.type === "text" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            rows={question.rows ?? 3}
            className="w-full bg-background border border-input rounded-md px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {question.options.map((opt) => {
              const selected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(opt.value)}
                  className="group flex items-start gap-3 text-left p-3 border rounded-md transition-all"
                  style={{
                    borderColor: selected ? "var(--color-brand)" : "var(--color-border)",
                    backgroundColor: selected ? "var(--color-brand-soft)" : "transparent",
                  }}
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{
                      borderColor: selected ? "var(--color-brand)" : "var(--color-border-strong)",
                      backgroundColor: selected ? "var(--color-brand)" : "transparent",
                    }}
                  >
                    {selected && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: "white" }}
                      />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm leading-snug block"
                      style={{
                        color: selected ? "var(--color-brand)" : "var(--color-text)",
                        fontWeight: selected ? 500 : 400,
                      }}
                    >
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuccessScreen({ respondent }: { respondent: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center gap-4 py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <CheckCircle2Icon className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Submitted{respondent ? `, ${respondent.split(" ")[0]}` : ""}.
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your answers are with the team. We'll bake them into the next
              iteration. Thank you.
            </p>
          </div>
          <Link
            href="/"
            className="mt-4 h-10 px-5 inline-flex items-center bg-[var(--color-brand)] text-white font-mono text-xs uppercase tracking-[0.04em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors"
          >
            Back to Crosscheck
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
