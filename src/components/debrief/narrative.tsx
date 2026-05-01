"use client";

import { useState, type FormEvent } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export function Narrative({
  initial,
  debriefId,
}: {
  initial: string;
  debriefId: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: initial },
  ]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.trim() || pending) return;
    const userMsg: Msg = { role: "user", content: draft.trim() };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setPending(true);
    try {
      const res = await fetch(`/api/debrief/${debriefId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });
      const data = (await res.json()) as { ok: boolean; reply?: string; error?: string };
      const replyContent = data.reply ?? data.error ?? "No response.";
      setMessages((m) => [...m, { role: "assistant", content: replyContent }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            err instanceof Error ? err.message : "Something went wrong.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col gap-4 min-h-[440px]">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
        DEBRIEF
      </div>
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "assistant"
                ? "text-[var(--color-text)]"
                : "text-[var(--color-brand)] font-mono text-xs uppercase tracking-[0.15em]"
            }`}
          >
            {m.role === "user" ? `> ${m.content}` : m.content}
          </div>
        ))}
        {pending && (
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-faint)] animate-pulse">
            Thinking…
          </div>
        )}
      </div>
      <form onSubmit={ask} className="flex gap-2 mt-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a follow-up..."
          disabled={pending}
          className="flex-1 h-10 px-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-sm font-sans text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-brand)] focus:outline-none transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="h-10 px-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] font-mono text-xs uppercase tracking-[0.15em] rounded-sm hover:border-[var(--color-brand)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
