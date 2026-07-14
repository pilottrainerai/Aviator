import Link from "next/link";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { Footer } from "@/components/marketing/footer";
import { HeaderAuth } from "@/components/auth/header-auth";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Header />
      <Hero />
      <Differentiators />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5 sm:px-8 sm:py-6">
      <Link href="/" className="flex min-w-0 items-center gap-3">
        <Logo />
        <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)] sm:inline">
          A320 · Abnormal training
        </span>
      </Link>
      <nav className="flex items-center gap-4 sm:gap-6">
        <div className="hidden items-center gap-6 text-sm text-[var(--color-text-muted)] md:flex">
          <a href="#how" className="transition-colors hover:text-[var(--color-text)]">
            How it works
          </a>
          <Link href="/scenarios" className="transition-colors hover:text-[var(--color-text)]">
            Scenarios
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-[var(--color-text)]">
            Pricing
          </Link>
        </div>
        <span className="hidden sm:inline-flex">
          <HeaderAuth />
        </span>
        <Link
          href="/scenarios"
          className="whitespace-nowrap rounded-sm border border-[var(--color-brand)] px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand-soft)]"
        >
          Try the demo
        </Link>
      </nav>
    </header>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-6 w-6 rotate-45 border border-[var(--color-brand)]">
        <div className="absolute inset-1 border border-[var(--color-brand)]" />
      </div>
      <span className="font-sans text-base font-semibold tracking-tight">Crosscheck</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-start px-6 py-20 sm:px-8 md:py-28">
      <div className="mb-6 flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-brand)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] sm:text-[11px]">
          Private beta · Invite only
        </span>
      </div>

      <h1 className="w-full max-w-4xl text-balance text-[clamp(2.25rem,6vw,4.5rem)] font-semibold leading-[1.05] tracking-tight">
        The decision is yours.{" "}
        <span className="text-[var(--color-text-muted)]">The clock is real.</span>
      </h1>

      <p className="mt-7 w-full max-w-2xl text-pretty text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
        Crosscheck runs A320 abnormal procedures end-to-end: real-time pressure, live
        ECAM, decision-phase scoring, and an AI debrief, without the simulator slot.
      </p>

      <div className="mt-10 w-full max-w-md" id="waitlist">
        <WaitlistForm />
      </div>

      <div className="mt-6 flex w-full flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
        <span>Not a checklist app</span>
        <span aria-hidden>·</span>
        <span>Not a flight simulator</span>
      </div>
    </section>
  );
}

function Differentiators() {
  const items = [
    {
      tag: "REAL-TIME",
      title: "Wall-clock pressure",
      body: "The fire warning runs in real time. Hesitation has consequences. No turn-based hand-holding.",
    },
    {
      tag: "DECISION-FOCUSED",
      title: "Scored on judgment, not memorization",
      body: "Correctness, sequence, and decision quality, evaluated against the procedure, not a multiple-choice grader.",
    },
    {
      tag: "AI DEBRIEF",
      title: "Structured coaching after every run",
      body: "A multi-axis rubric and a chat-style debrief. Ask follow-ups. Understand what to fix before the next attempt.",
    },
  ];

  return (
    <section id="how" className="border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8 md:py-24">
        <div className="mb-10 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
          Why Crosscheck
        </div>
        <div className="grid gap-10 sm:gap-12 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.tag}
              className="flex flex-col border-t border-[var(--color-border-strong)] pt-6"
            >
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)]">
                {item.tag}
              </div>
              <h3 className="mb-3 text-balance text-xl font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="text-pretty text-sm leading-relaxed text-[var(--color-text-muted)]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
