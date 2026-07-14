// Render candidate pushbutton-click samples to public/audio/ as 16-bit PCM WAV.
// No deps, no external audio. Each candidate is a shaped, filtered click — far more
// controllable than the live WebAudio synth. A/B them on /dev/hyd-panel-3d, then the
// winner is copied to switch-click.wav (the file the panel actually plays).
//   run:  node scripts/gen-switch-clicks.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
mkdirSync(OUT, { recursive: true });

const rand = () => Math.random() * 2 - 1;

// RBJ band-pass biquad (constant 0 dB peak gain) applied in place — gives the click its "wood".
function bandpass(x, freq, Q) {
  const w0 = (2 * Math.PI * freq) / SR, cos = Math.cos(w0), sin = Math.sin(w0);
  const alpha = sin / (2 * Q);
  const b0 = alpha, b1 = 0, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = a1 / a0, A2 = a2 / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = B0 * xi + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi;
  }
  return y;
}

// A single click layer: filtered noise burst under an exponential decay, plus an optional
// short damped sine "body" (very low level so it reads as thump, not a beep).
function clickLayer({ ms, freq, Q, bodyHz = 0, bodyLvl = 0, at = 0, gain = 1 }, buf) {
  const n = Math.floor((ms / 1000) * SR);
  const tau = (ms / 1000) / 4; // decay so the tail is ~gone by `ms`
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rand();
  const filt = bandpass(noise, freq, Q);
  const start = Math.floor((at / 1000) * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t / tau);
    let s = filt[i] * env;
    if (bodyLvl) s += bodyLvl * Math.sin(2 * Math.PI * bodyHz * t) * Math.exp(-t / (tau * 1.6));
    const j = start + i;
    if (j < buf.length) buf[j] += s * gain;
  }
}

function normalize(buf, peak = 0.9) {
  let m = 0;
  for (const v of buf) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] / m) * peak;
}

function toWav(buf) {
  const n = buf.length, bytes = 44 + n * 2, a = new ArrayBuffer(bytes), dv = new DataView(a);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); ws(8, "WAVE");
  ws(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ws(36, "data"); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, buf[i])); dv.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true); }
  return Buffer.from(a);
}

function render(totalMs, layers) {
  const buf = new Float32Array(Math.ceil((totalMs / 1000) * SR));
  layers.forEach((l) => clickLayer(l, buf));
  normalize(buf);
  return toWav(buf);
}

// ── The candidates ─────────────────────────────────────────────────────────────
const candidates = {
  // A — soft "dome": woody, rounded, a gentle desk-button press.
  a: render(90, [
    { ms: 14, freq: 900, Q: 4, bodyHz: 180, bodyLvl: 0.25 },
    { ms: 30, freq: 620, Q: 3, bodyHz: 150, bodyLvl: 0.12, at: 55, gain: 0.5 },
  ]),
  // B — tight tactile: short, snappy, mechanical-keyboard "tk".
  b: render(60, [
    { ms: 8, freq: 1500, Q: 7 },
    { ms: 14, freq: 1200, Q: 6, at: 45, gain: 0.4 },
  ]),
  // C — deep thunk: lower, heavier, a substantial guarded-switch press.
  c: render(110, [
    { ms: 20, freq: 520, Q: 3, bodyHz: 120, bodyLvl: 0.35 },
    { ms: 34, freq: 420, Q: 2.5, bodyHz: 100, bodyLvl: 0.18, at: 60, gain: 0.55 },
  ]),
  // D — crisp click-clack: two bright transients, a distinct press + release.
  d: render(130, [
    { ms: 10, freq: 1700, Q: 6, bodyHz: 260, bodyLvl: 0.15 },
    { ms: 16, freq: 1150, Q: 5, bodyHz: 200, bodyLvl: 0.1, at: 95, gain: 0.55 },
  ]),
};

for (const [k, wav] of Object.entries(candidates)) {
  writeFileSync(join(OUT, `switch-click-${k}.wav`), wav);
  console.log(`wrote switch-click-${k}.wav (${wav.length} bytes)`);
}
// Default the panel to A until you pick — so the real sample plays immediately.
writeFileSync(join(OUT, "switch-click.wav"), candidates.a);
console.log("wrote switch-click.wav (= candidate A, default)");
