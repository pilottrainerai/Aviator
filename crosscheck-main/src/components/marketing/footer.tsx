import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-auto">
      <div className="max-w-6xl mx-auto px-8 py-10 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 border border-[var(--color-brand)] rotate-45 relative">
              <div className="absolute inset-1 border border-[var(--color-brand)]" />
            </div>
            <span className="font-sans text-base font-semibold tracking-tight">
              Crosscheck
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Interactive, real-time training for A320 abnormal procedures.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            { href: "/scenarios", label: "Scenarios" },
            { href: "/pricing", label: "Pricing" },
            { href: "/dashboard", label: "Dashboard" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { href: "/#how", label: "How it works" },
            { href: "mailto:hello@crosscheck.aero", label: "Contact" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
          ]}
        />
      </div>
      <div className="border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
          <span>© CROSSCHECK · 2026</span>
          <span>BUILT FOR LINE PILOTS</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)] mb-3">
        {title}
      </div>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
