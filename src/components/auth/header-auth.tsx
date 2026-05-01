"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const Authed = dynamic(() => import("./header-auth-clerk").then((m) => m.Authed), {
  ssr: false,
  loading: () => null,
});

export function HeaderAuth() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (clerkConfigured) {
    return <Authed />;
  }
  return (
    <Link
      href="/sign-in"
      className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
    >
      Iniciar sesión
    </Link>
  );
}
