"use client";

// Looping preview of pop-out animation variants for the ENG fire action panel.
// Each card replays its variant (with the 3-frame stagger) every couple seconds
// so the motion can be compared and one chosen. Pure CSS — no engine needed.

import { useEffect, useState } from "react";

const CSS = `
@keyframes ppv-spring   { 0%{opacity:0;transform:translateY(14px) scale(.94)} 55%{opacity:1} 100%{opacity:1;transform:translateY(0) scale(1)} }
@keyframes ppv-snappy   { 0%{opacity:0;transform:translateY(8px) scale(.96)} 100%{opacity:1;transform:none} }
@keyframes ppv-bounce   { 0%{opacity:0;transform:translateY(20px) scale(.86)} 60%{opacity:1} 100%{opacity:1;transform:none} }
@keyframes ppv-smooth   { 0%{opacity:0;transform:scale(.97)} 100%{opacity:1;transform:none} }
@keyframes ppv-slide    { 0%{opacity:0;transform:translateX(-46px)} 100%{opacity:1;transform:none} }
@keyframes ppv-rise     { 0%{opacity:0;transform:translateY(40px) scale(.98)} 100%{opacity:1;transform:none} }
`;

type Variant = { id: string; name: string; desc: string; anim: string; stagger: number };
const VARIANTS: Variant[] = [
  { id: "spring", name: "A · Spring (current)", desc: "0.42s, gentle overshoot, staggered", anim: "ppv-spring 0.42s cubic-bezier(.34,1.45,.55,1) both", stagger: 100 },
  { id: "snappy", name: "B · Snappy", desc: "0.26s, no overshoot, quick", anim: "ppv-snappy 0.26s cubic-bezier(.2,.8,.2,1) both", stagger: 60 },
  { id: "bounce", name: "C · Big bounce", desc: "0.6s, strong overshoot, playful", anim: "ppv-bounce 0.6s cubic-bezier(.34,1.7,.5,1) both", stagger: 130 },
  { id: "smooth", name: "D · Smooth fade", desc: "0.4s, scale-only, no rise/overshoot", anim: "ppv-smooth 0.4s cubic-bezier(.2,.7,.3,1) both", stagger: 90 },
  { id: "slide", name: "E · Slide from left", desc: "0.45s, slides in from the left", anim: "ppv-slide 0.45s cubic-bezier(.2,.8,.25,1) both", stagger: 110 },
  { id: "rise", name: "F · Rise up", desc: "0.5s, lifts up from below", anim: "ppv-rise 0.5s cubic-bezier(.2,.85,.3,1) both", stagger: 110 },
];

function Frame({ label, w, h, anim, delay }: { label: string; w: number; h: number; anim: string; delay: number }) {
  return (
    <div style={{
      width: w, height: h, animation: anim, animationDelay: `${delay}ms`,
      background: "linear-gradient(180deg,#101620,#0a0e14)", border: "1px dashed rgba(138,171,187,0.5)",
      borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em", color: "#8aabbb", flexShrink: 0,
    }}>{label}</div>
  );
}

function VariantCard({ v, tick }: { v: Variant; tick: number }) {
  return (
    <div style={{ background: "#0b0f16", border: "1px solid #232b36", borderRadius: 10, padding: 14, minHeight: 170 }}>
      <div style={{ color: "#dfe6f0", fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>{v.name}</div>
      <div style={{ color: "#7c8696", fontFamily: "monospace", fontSize: 10, marginBottom: 12 }}>{v.desc}</div>
      {/* key={tick} remounts so the entrance animation replays each loop */}
      <div key={tick} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Frame label="THR" w={44} h={96} anim={v.anim} delay={v.stagger} />
        <Frame label="MSTR" w={40} h={96} anim={v.anim} delay={v.stagger * 2} />
        <Frame label="3D FIRE PANEL" w={210} h={70} anim={v.anim} delay={0} />
      </div>
    </div>
  );
}

export default function FirePopAnimPreview() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 2400); return () => clearInterval(t); }, []);
  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "auto", padding: 24 }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <h1 style={{ color: "#eef6ff", fontFamily: "monospace", fontSize: 16, margin: 0 }}>Pop-out animation variants</h1>
        <button type="button" onClick={() => setTick((n) => n + 1)}
          style={{ padding: "6px 14px", fontSize: 12, color: "#05070a", background: "#7ad9a5", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ↺ Replay all
        </button>
        <span style={{ color: "#7c8696", fontFamily: "monospace", fontSize: 11 }}>auto-replays every 2.4s — tell me a letter (A–F)</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, maxWidth: 1100 }}>
        {VARIANTS.map((v) => <VariantCard key={v.id} v={v} tick={tick} />)}
      </div>
    </main>
  );
}
