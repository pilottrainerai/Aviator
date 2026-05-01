import Link from "next/link";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "Pricing — Crosscheck",
};

const TIERS = [
  {
    name: "Pilot",
    tagline: "For individual line pilots",
    price: "$—",
    cadence: "/ month",
    cta: { label: "Join the waitlist", href: "/#waitlist" },
    features: [
      "Full scenario library",
      "Real-time decision scoring",
      "AI debrief on every run",
      "Replay timeline",
      "Personal session history",
    ],
    note: "Pricing finalizes at general availability.",
    primary: true,
  },
  {
    name: "Training school",
    tagline: "For ATOs running A320 type-rating courses",
    price: "Custom",
    cadence: "per cohort",
    cta: { label: "Contact us", href: "mailto:hello@crosscheck.aero" },
    features: [
      "Everything in Pilot",
      "Instructor view of trainee sessions",
      "Cohort dashboards + roster",
      "Custom scenarios on request",
      "Onboarding session",
    ],
  },
  {
    name: "Airline",
    tagline: "Per-pilot licensing for line operations",
    price: "Custom",
    cadence: "per pilot, per year",
    cta: { label: "Contact us", href: "mailto:hello@crosscheck.aero" },
    features: [
      "Everything in Training school",
      "SSO + role-based admin",
      "Compliance reporting",
      "Tail-specific scenarios",
      "SOC-2 path on request",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border)]">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          ← CROSSCHECK
        </Link>
        <Link
          href="/scenarios"
          className="font-mono text-xs uppercase tracking-[0.15em] border border-[var(--color-brand)] text-[var(--color-brand)] px-3 py-2 rounded-sm hover:bg-[var(--color-brand-soft)] transition-colors"
        >
          Try the demo
        </Link>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-8 py-16">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-brand)] mb-3">
          PRICING
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-3">
          Built for individuals, schools, and airlines.
        </h1>
        <p className="text-base text-[var(--color-text-muted)] max-w-2xl mb-16">
          Crosscheck is in private beta. Final pricing is being calibrated against
          willingness-to-pay from the waitlist. No charges today.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <article
              key={t.name}
              className="border bg-[var(--color-surface)] p-6 flex flex-col"
              style={{
                borderColor: t.primary
                  ? "var(--color-brand)"
                  : "var(--color-border)",
              }}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] mb-2"
                style={{ color: t.primary ? "var(--color-brand)" : "var(--color-text-faint)" }}
              >
                {t.name.toUpperCase()}
              </div>
              <h2 className="text-lg font-semibold tracking-tight mb-1">
                {t.tagline}
              </h2>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold tracking-tight">
                  {t.price}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {t.cadence}
                </span>
              </div>
              <ul className="mt-6 flex flex-col gap-2 flex-1">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-baseline gap-2 text-sm text-[var(--color-text)]"
                  >
                    <span className="text-[var(--color-brand)] mt-1">·</span>
                    {f}
                  </li>
                ))}
              </ul>
              {t.note && (
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
                  {t.note}
                </p>
              )}
              <Link
                href={t.cta.href}
                className={`mt-6 h-11 inline-flex items-center justify-center font-mono text-xs uppercase tracking-[0.15em] rounded-sm transition-colors ${
                  t.primary
                    ? "bg-[var(--color-brand)] text-[var(--color-bg)] hover:bg-[var(--color-brand)]/90"
                    : "border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-brand)]"
                }`}
              >
                {t.cta.label}
              </Link>
            </article>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
