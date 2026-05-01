import Link from "next/link";
import { Footer } from "@/components/marketing/footer";

export const metadata = { title: "Privacy — Crosscheck" };

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border)]">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          ← CROSSCHECK
        </Link>
      </header>
      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-16">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] mb-3">
          PRIVACY
        </div>
        <h1 className="text-4xl font-semibold tracking-tight mb-8">
          Privacy policy
        </h1>
        <div className="prose prose-invert text-[var(--color-text-muted)] leading-relaxed flex flex-col gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-brand)]">
            DRAFT — PLACEHOLDER FOR LAUNCH
          </p>
          <p>
            Crosscheck collects only the data needed to run the training
            platform: your account email, training session events, scores, and
            debrief content. Session data is yours.
          </p>
          <h2 className="text-base font-semibold text-[var(--color-text)] mt-4">
            What we collect
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Account information: email address (via Clerk)</li>
            <li>Session events: clicks, decisions, timestamps</li>
            <li>Scoring + AI debrief content</li>
            <li>Anonymous product analytics (PostHog)</li>
          </ul>
          <h2 className="text-base font-semibold text-[var(--color-text)] mt-4">
            What we don&apos;t collect
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Voice or video recordings</li>
            <li>Identifying flight-school records</li>
            <li>Payment information (we don&apos;t process payments yet)</li>
          </ul>
          <p className="text-xs">
            Final policy lands before general availability. Questions:{" "}
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
