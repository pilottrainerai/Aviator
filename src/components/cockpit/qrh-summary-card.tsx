"use client";

// QRH SUMMARY card — renders a scenario's `qrhSummary` in the real handbook
// print format: severity-coloured title end-caps (red = warning, amber =
// caution), grey phase-header bars, black-on-white body with dot leaders,
// ○ headings and rich (bold/italic) paragraphs.
//
// `activeSections` marks the section(s) the crew is working RIGHT NOW with the
// lightest-touch cue: the section's HEADER TEXT gently flashes (opacity breathe) —
// nothing recoloured, no red brackets, no blue bar; the grey handbook header is
// untouched. The first active section also auto-scrolls into view. Untagged →
// the plain handbook facsimile, unchanged.

import { useEffect, useRef } from "react";
import type { QrhSummary, QrhLine, QrhSeverity } from "@/scenarios/types";

const CAP: Record<QrhSeverity, string> = {
  warning: "#CC1122",
  caution: "#FFB300",
  advisory: "#888888",
};

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

function pad(indent?: number): React.CSSProperties {
  return indent ? { paddingLeft: `${indent * 16}px` } : {};
}

function LineRow({ line }: { line: QrhLine }) {
  if ("head" in line) {
    return (
      <div style={{ fontWeight: 700, marginTop: "3px", ...pad(line.indent) }}>
        ○ {line.head}
      </div>
    );
  }
  if ("row" in line) {
    const { label, value } = line.row;
    return (
      <div style={{ display: "flex", alignItems: "baseline", ...pad(line.indent) }}>
        <span>{label}</span>
        {value && (
          <>
            <span
              style={{
                flex: 1,
                borderBottom: "1.5px dotted #000",
                margin: "0 6px",
                transform: "translateY(-4px)",
              }}
            />
            <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>
          </>
        )}
      </div>
    );
  }
  return (
    <div style={pad(line.indent)}>
      {line.para.map((s, k) => (
        <span
          key={k}
          style={{
            fontWeight: s.b ? 700 : 400,
            fontStyle: s.i ? "italic" : "normal",
            color: s.i ? "#333" : "#000",
          }}
        >
          {s.text}
        </span>
      ))}
    </div>
  );
}

export function QrhSummaryCard({
  summary,
  activeSections,
}: {
  summary: QrhSummary;
  /** Section titles to highlight as "being worked now". Matched case-insensitively. */
  activeSections?: readonly string[];
}) {
  const cap = CAP[summary.severity];

  const activeSet = new Set((activeSections ?? []).map((s) => s.trim().toUpperCase()));
  const isActive = (title: string) => activeSet.has(title.trim().toUpperCase());

  // Auto-scroll the first active section into view when the active set changes.
  // IMPORTANT: scroll ONLY this card's own container — NOT the page. `scrollIntoView`
  // bubbles to every scrollable ancestor and moves the whole screen, so instead we
  // compute the offset and scroll just the card's overflow container.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const activeKey = [...activeSet].sort().join("|");
  useEffect(() => {
    const container = cardRef.current;
    const target = scrollRef.current;
    if (!container || !target) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const HEADER = 40; // sticky title height — stop just below it
    const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top: container.scrollTop + delta - HEADER, behavior: reduce ? "auto" : "smooth" });
  }, [activeKey]);

  return (
    <div
      ref={cardRef}
      style={{
        background: "#fff",
        color: "#000",
        height: "100%",
        overflow: "auto",
        // Stop auto-scroll just below the sticky title so the active section's
        // header (with its red end-caps) is never hidden behind the title bar.
        scrollPaddingTop: "40px",
        fontFamily: MONO,
        fontSize: "10.5px",
        lineHeight: 1.55,
        border: "2px solid #000",
      }}
    >
      <style>{`
        /* Active section: the GREY HEADER BAR pulses dark↔grey (text inverts so it
           stays readable) — a clear "you are here" blink, still greyscale/handbook. */
        @keyframes qrhActiveFlash {
          0%,100% { background-color:#9C9C9C; color:#000; }
          50%     { background-color:#363636; color:#fff; }
        }
        .qrh-active-flash { animation: qrhActiveFlash 1.25s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .qrh-active-flash { animation: none; background-color:#5E5E5E; color:#fff; }
        }
      `}</style>

      {/* Title row — severity end-caps + white centre box */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          borderBottom: "2px solid #000",
          position: "sticky",
          top: 0,
          background: "#fff",
        }}
      >
        <div style={{ width: "30px", background: cap, borderRight: "2px solid #000" }} />
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontWeight: 800,
            letterSpacing: "0.04em",
            padding: "7px 4px",
            fontSize: "12px",
          }}
        >
          {summary.title}
        </div>
        <div style={{ width: "30px", background: cap, borderLeft: "2px solid #000" }} />
      </div>

      {(() => {
        const firstActive = summary.sections.findIndex((s) => isActive(s.title));
        return summary.sections.map((sec, i) => {
          const active = isActive(sec.title);
          return (
            <div key={i} ref={i === firstActive ? scrollRef : undefined}>
              <div
                // Active section → the whole grey bar flashes (class drives the
                // background/colour pulse); inactive → plain grey handbook header.
                className={active ? "qrh-active-flash" : undefined}
                style={{
                  background: "#9C9C9C",
                  color: "#000",
                  textAlign: "center",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  padding: "3px",
                  fontSize: "11px",
                  borderBottom: "2px solid #000",
                  borderTop: i === 0 ? "none" : "2px solid #000",
                }}
              >
                {sec.title}
              </div>
              <div style={{ padding: "6px 12px" }}>
                {sec.lines.map((ln, j) => (
                  <LineRow key={j} line={ln} />
                ))}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
