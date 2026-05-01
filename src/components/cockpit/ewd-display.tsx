"use client";

import type { ScenarioState } from "@/engine/state";
import type { ECAMLevel } from "@/scenarios/types";

const LEVEL_COLOR: Record<ECAMLevel, string> = {
  warning: "var(--color-red)",
  caution: "var(--color-amber)",
  advisory: "var(--color-blue)",
  memo: "var(--color-green)",
};

export function EwdDisplay({ state }: { state: ScenarioState }) {
  const messages = state.ecamMessages;
  return (
    <div className="border border-[var(--color-border)] bg-[#050608] p-4 font-mono">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
          E-WD · ECAM
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
          {messages.length} {messages.length === 1 ? "MESSAGE" : "MESSAGES"}
        </span>
      </div>

      <div className="min-h-[180px] flex flex-col gap-1.5">
        {messages.length === 0 && (
          <span className="text-xs text-[var(--color-text-faint)]">
            — NORMAL —
          </span>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className="flex items-center text-sm tracking-[0.06em]"
            style={{ color: LEVEL_COLOR[m.level] }}
          >
            <span className="font-semibold">{m.line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
