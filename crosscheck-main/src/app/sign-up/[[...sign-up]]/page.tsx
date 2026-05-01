import dynamic from "next/dynamic";
import Link from "next/link";

const ClerkSignUp = dynamic(
  () => import("@clerk/nextjs").then((m) => ({ default: m.SignUp })),
  { loading: () => <div /> },
);

export const metadata = {
  title: "Sign up — Crosscheck",
};

export default function SignUpPage() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      {clerkConfigured ? (
        <ClerkSignUp />
      ) : (
        <Placeholder />
      )}
    </main>
  );
}

function Placeholder() {
  return (
    <div className="w-full max-w-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
      <h1 className="font-sans text-xl font-semibold tracking-tight mb-3">
        Request access
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
        Crosscheck is in private beta. Join the waitlist on the home page.
      </p>
      <Link
        href="/#waitlist"
        className="h-12 inline-flex items-center justify-center bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 transition-colors w-full"
      >
        Join the waitlist
      </Link>
    </div>
  );
}
