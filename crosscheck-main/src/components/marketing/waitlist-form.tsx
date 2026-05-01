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
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="captain@airline.com"
          aria-label="Email address"
          className="flex-1 h-12 px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-sm font-sans text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] focus:outline-none transition-colors"
          disabled={status === "submitting" || status === "success"}
        />
        <button
          type="submit"
          disabled={status === "submitting" || status === "success"}
          className="h-12 px-6 bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
