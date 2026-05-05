"use client";

import { useEffect, useRef, useState } from "react";
import { playMasterWarn, playMasterCaut } from "@/lib/audio/cockpit-audio";
import { Volume2, VolumeX } from "lucide-react";

export function AudioController({ active, cautActive }: { active: boolean; cautActive?: boolean }) {
  const [muted, setMuted] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const prevCautRef = useRef(false);

  // CRC / repetitive chime for MASTER WARNING
  useEffect(() => {
    if (active && !muted) {
      const handle = playMasterWarn();
      stopRef.current = handle.stop;
      return () => handle.stop();
    } else {
      stopRef.current?.();
      stopRef.current = null;
    }
  }, [active, muted]);

  // Single chime (SC) on rising edge of MASTER CAUTION
  useEffect(() => {
    if (cautActive && !prevCautRef.current && !muted) {
      playMasterCaut();
    }
    prevCautRef.current = cautActive ?? false;
  }, [cautActive, muted]);

  return (
    <button
      type="button"
      onClick={() => setMuted((m) => !m)}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-sm font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-brand)] transition-colors"
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {muted ? "Muted" : "Audio on"}
    </button>
  );
}
