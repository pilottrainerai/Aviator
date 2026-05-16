/**
 * Cockpit alert audio. Web Audio API only — no external sound files until
 * SME-licensed clips are sourced. Produces:
 *   - MASTER WARN chime: rapid repetitive beep (≈3.5 Hz, 660 Hz tone) — Level 3 warning
 *   - MASTER CAUT chime: single chime (SC), one short tone — Level 2 caution
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Active = {
  stop: () => void;
};

export function playMasterWarn(): Active {
  const ac = getContext();
  if (!ac) return { stop: () => undefined };

  const gain = ac.createGain();
  gain.gain.value = 0.05; // gentle — cockpits are loud, the demo is not
  gain.connect(ac.destination);

  let stopped = false;
  const beep = () => {
    if (stopped) return;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.value = 660;
    const env = ac.createGain();
    env.gain.setValueAtTime(0, ac.currentTime);
    env.gain.linearRampToValueAtTime(1, ac.currentTime + 0.01);
    env.gain.linearRampToValueAtTime(0, ac.currentTime + 0.18);
    osc.connect(env).connect(gain);
    osc.start();
    osc.stop(ac.currentTime + 0.18);
  };

  beep();
  const id = setInterval(beep, 280); // ~3.5 Hz repetition

  return {
    stop: () => {
      stopped = true;
      clearInterval(id);
      gain.disconnect();
    },
  };
}

/** Single chime (SC) — FCOM: one brief 800 Hz tone, played once on MASTER CAUTION */
export function playMasterCaut(): void {
  const ac = getContext();
  if (!ac) return;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.07, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
  gain.connect(ac.destination);
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(820, ac.currentTime + 0.15);
  osc.connect(gain);
  osc.start();
  osc.stop(ac.currentTime + 0.4);
}
