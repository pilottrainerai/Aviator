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

/**
 * Mechanical pushbutton click-clack: a bright press-IN tick, then a duller pop-BACK tick
 * ~110 ms later — the sound of a real cockpit pushbutton dipping and springing back.
 * Each tick = a short decaying noise burst through a bandpass (the plastic "tick"), no
 * external audio files.
 */
// A REAL recorded pushbutton click, decoded once and cached. Drop the clip at
// public/audio/switch-click.mp3 (any browser-decodable format: mp3/wav/ogg/m4a — keep the name)
// and it plays automatically. Until the file exists, playSwitchClick falls back to the synth below.
const CLICK_URL = "/audio/switch-click.wav";
const CLICK_VOL = 0.7; // playback level of the sample (0–1)
let clickBuf: AudioBuffer | null = null;
let clickLoad: Promise<AudioBuffer | null> | null = null;

function loadClick(ac: AudioContext): Promise<AudioBuffer | null> {
  if (clickBuf) return Promise.resolve(clickBuf);
  if (!clickLoad) {
    clickLoad = fetch(CLICK_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
      .then((ab) => ac.decodeAudioData(ab))
      .then((buf) => { clickBuf = buf; return buf; })
      .catch(() => null); // no file yet (or bad format) → stay on the synth fallback
  }
  return clickLoad;
}

function playBuffer(ac: AudioContext, buf: AudioBuffer): void {
  const g = ac.createGain(); g.gain.value = CLICK_VOL;
  const src = ac.createBufferSource(); src.buffer = buf;
  src.connect(g).connect(ac.destination);
  src.start();
}

// Synth fallback — a single soft click, used only until the real sample is present so a press
// is never silent. Deliberately plain; the recorded sample is the real deal.
function synthClick(ac: AudioContext): void {
  const t0 = ac.currentTime;
  const n = Math.floor(ac.sampleRate * 0.006);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(); src.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2200; bp.Q.value = 0.7;
  const g = ac.createGain(); g.gain.value = 0.12;
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t0); src.stop(t0 + 0.02);
}

export function playSwitchClick(): void {
  const ac = getContext();
  if (!ac) return;
  if (clickBuf) { playBuffer(ac, clickBuf); return; } // real sample ready → use it
  void loadClick(ac);                                 // kick off load for the next clicks
  synthClick(ac);                                     // this click: immediate fallback, never silent
}

// Dev only: fetch + decode + play an arbitrary click file by URL, so the dev page can A/B the
// rendered candidates. Not cached — it's a one-off audition, not the hot path.
const previewCache = new Map<string, AudioBuffer>();
export function previewClick(url: string): void {
  const ac = getContext();
  if (!ac) return;
  const cached = previewCache.get(url);
  if (cached) { playBuffer(ac, cached); return; }
  void fetch(url)
    .then((r) => r.arrayBuffer())
    .then((ab) => ac.decodeAudioData(ab))
    .then((buf) => { previewCache.set(url, buf); playBuffer(ac, buf); })
    .catch(() => undefined);
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
