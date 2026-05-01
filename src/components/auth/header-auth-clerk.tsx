"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";

export function Authed() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in"
        className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        Iniciar sesión
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/dashboard"
        className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        Dashboard
      </Link>
      <UserButton />
    </>
  );
}
