"use client";

import { useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";

type Status = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not join waitlist");
      }
      setStatus("success");
      setMessage("You're on the list. We'll be in touch.");
      setEmail("");
      track("waitlist_submitted", {});
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="captain@airline.com"
          aria-label="Email address"
          className="h-12 flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 font-sans text-sm text-[var(--color-text)] transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:outline-none"
          disabled={status === "submitting" || status === "success"}
        />
        <button
          type="submit"
          disabled={status === "submitting" || status === "success"}
          className="h-12 rounded-sm bg-[var(--color-brand)] px-6 font-mono text-xs uppercase tracking-[0.15em] text-[var(--color-brand-foreground)] transition-colors hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "submitting" ? "..." : "Request access"}
        </button>
      </div>
      {message && (
        <p
          className={`font-mono text-[11px] uppercase tracking-wider ${
            status === "error"
              ? "text-[var(--color-red)]"
              : "text-[var(--color-green)]"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
