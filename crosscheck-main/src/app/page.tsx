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
    <header className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border)]">
      <Link href="/" className="flex items-center gap-3">
        <Logo />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          A320 · ABNORMAL TRAINING
        </span>
      </Link>
      <nav className="flex items-center gap-6 text-sm text-[var(--color-text-muted)]">
        <a href="#how" className="hover:text-[var(--color-text)] transition-colors">
          How it works
        </a>
        <Link
          href="/scenarios"
          className="hover:text-[var(--color-text)] transition-colors"
        >
          Scenarios
        </Link>
        <Link
          href="/pricing"
          className="hover:text-[var(--color-text)] transition-colors"
        >
          Pricing
        </Link>
        <HeaderAuth />
        <Link
          href="/scenarios"
          className="font-mono text-xs uppercase tracking-[0.15em] border border-[var(--color-brand)] text-[var(--color-brand)] px-3 py-2 rounded-sm hover:bg-[var(--color-brand-soft)] transition-colors"
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
      <div className="h-6 w-6 border border-[var(--color-brand)] rotate-45 relative">
        <div className="absolute inset-1 border border-[var(--color-brand)]" />
      </div>
      <span className="font-sans text-base font-semibold tracking-tight">
        Crosscheck
      </span>
    </div>
  );
}

function Hero() {
  return (
    <section className="flex flex-col items-start max-w-5xl mx-auto px-8 py-32">
      <div className="flex items-center gap-2 mb-8">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)] animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)]">
          PRIVATE BETA · INVITE ONLY
        </span>
      </div>

      <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-4xl">
        The decision is yours.{" "}
        <span className="text-[var(--color-text-muted)]">
          The clock is real.
        </span>
      </h1>

      <p className="mt-8 max-w-2xl text-lg text-[var(--color-text-muted)] leading-relaxed">
        Crosscheck runs A320 abnormal procedures end-to-end. Real-time pressure,
        live ECAM, decision-phase scoring, and an AI debrief — without the
        simulator slot.
      </p>

      <div className="mt-12 w-full max-w-md" id="waitlist">
        <WaitlistForm />
      </div>

      <div className="mt-6 flex items-center gap-4 font-mono text-xs text-[var(--color-text-faint)]">
        <span>NOT A CHECKLIST APP</span>
        <span aria-hidden>·</span>
        <span>NOT A FLIGHT SIMULATOR</span>
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
      body: "Correctness, sequence, and decision quality — evaluated against the procedure, not a multiple-choice grader.",
    },
    {
      tag: "AI DEBRIEF",
      title: "Structured coaching after every run",
      body: "A multi-axis rubric and a chat-style debrief. Ask follow-ups. Understand what to fix before the next attempt.",
    },
  ];

  return (
    <section id="how" className="border-t border-[var(--color-border)]">
      <div className="max-w-5xl mx-auto px-8 py-24">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-8">
          WHY CROSSCHECK
        </div>
        <div className="grid gap-12 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.tag} className="border-l border-[var(--color-brand)] pl-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] mb-3">
                {item.tag}
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">
                {item.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
