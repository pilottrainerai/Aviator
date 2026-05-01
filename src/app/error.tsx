"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[crosscheck] route error", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md border border-[var(--color-red)] bg-[var(--color-surface)] p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-red)] mb-3">
          MASTER WARN · UNCAUGHT EXCEPTION
        </div>
        <h1 className="font-sans text-xl font-semibold tracking-tight mb-3">
          Something went wrong.
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-2">
          The app hit an error it couldn&apos;t recover from. Try the page
          again, or head back to the library.
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] mb-6">
            DIGEST · {error.digest}
          </p>
        )}
        <div className="flex flex-col gap-3 mt-6">
          <button
            type="button"
            onClick={reset}
            className="h-11 inline-flex items-center justify-center bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/scenarios"
            className="h-10 inline-flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:border-[var(--color-brand)] hover:text-[var(--color-text)] transition-colors"
          >
            Back to scenarios
          </Link>
        </div>
      </div>
    </main>
  );
}
