import dynamic from "next/dynamic";
import Link from "next/link";

const ClerkSignIn = dynamic(
  () => import("@clerk/nextjs").then((m) => ({ default: m.SignIn })),
  { loading: () => <div /> },
);

export const metadata = {
  title: "Sign in — Crosscheck",
};

export default function SignInPage() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      {clerkConfigured ? (
        <ClerkSignIn />
      ) : (
        <Placeholder />
      )}
    </main>
  );
}

function Placeholder() {
  return (
    <div className="w-full max-w-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-5 w-5 border border-[var(--color-brand)] rotate-45 relative">
          <div className="absolute inset-1 border border-[var(--color-brand)]" />
        </div>
        <span className="font-sans text-base font-semibold tracking-tight">
          Crosscheck
        </span>
      </div>
      <h1 className="font-sans text-xl font-semibold tracking-tight mb-3">
        Sign in
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
        Auth activates when{" "}
        <span className="font-mono text-[var(--color-text)]">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</span>{" "}
        is configured. Until then, you can run the demo without signing in.
      </p>
      <div className="flex flex-col gap-3">
        <Link
          href="/scenarios"
          className="h-12 inline-flex items-center justify-center bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors"
        >
          Continue without signing in
        </Link>
        <Link
          href="/"
          className="h-10 inline-flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:border-[var(--color-brand)] hover:text-[var(--color-text)] transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
