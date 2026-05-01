import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-brand)] mb-3">
          NOT FOUND
        </div>
        <h1 className="text-5xl font-semibold tracking-tight mb-3">404</h1>
        <p className="text-base text-[var(--color-text-muted)] max-w-md mb-8">
          That page doesn&apos;t exist. Maybe it was renamed, or you took a
          wrong turn after V1.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="h-11 px-5 inline-flex items-center bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/scenarios"
            className="h-11 px-5 inline-flex items-center border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:border-[var(--color-brand)] hover:text-[var(--color-text)] transition-colors"
          >
            Browse scenarios
          </Link>
        </div>
      </div>
    </main>
  );
}
