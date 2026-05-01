import Link from "next/link";
import { Footer } from "@/components/marketing/footer";

export const metadata = { title: "Terms — Crosscheck" };

export default function TermsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border)]">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          ← CROSSCHECK
        </Link>
      </header>
      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-16">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] mb-3">
          TERMS
        </div>
        <h1 className="text-4xl font-semibold tracking-tight mb-8">
          Terms of service
        </h1>
        <div className="prose prose-invert text-[var(--color-text-muted)] leading-relaxed flex flex-col gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-brand)]">
            DRAFT — PLACEHOLDER FOR LAUNCH
          </p>
          <p>
            Crosscheck is a training platform for A320 abnormal procedures.
            It is a supplement to formal training, not a substitute. It does
            not grant currency, ratings, or qualifications.
          </p>
          <h2 className="text-base font-semibold text-[var(--color-text)] mt-4">
            Use at your own risk
          </h2>
          <p>
            Procedures depicted are based on public training references and
            reviewed by type-rated SMEs. They are for self-study only. Always
            defer to your operator&apos;s OM-D, current FCOM, and QRH for
            real-world operations.
          </p>
          <h2 className="text-base font-semibold text-[var(--color-text)] mt-4">
            Account &amp; conduct
          </h2>
          <p>
            One account per person. Don&apos;t attempt to reverse-engineer the
            scoring engine or share credentials. We&apos;re a small team — be
            kind.
          </p>
          <p className="text-xs">
            Final terms land before general availability. Questions:{" "}
            <a className="underline" href="mailto:hello@crosscheck.aero">
              hello@crosscheck.aero
            </a>
            .
          </p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
