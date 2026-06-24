"use client";

// QRH SUMMARY card — renders a scenario's `qrhSummary` in the real handbook
// print format: severity-coloured title end-caps (red = warning, amber =
// caution), grey phase-header bars, black-on-white body with dot leaders,
// ○ headings and rich (bold/italic) paragraphs. Pure presentation, no state.

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

export function QrhSummaryCard({ summary }: { summary: QrhSummary }) {
  const cap = CAP[summary.severity];
  return (
    <div
      style={{
        background: "#fff",
        color: "#000",
        height: "100%",
        overflow: "auto",
        fontFamily: MONO,
        fontSize: "10.5px",
        lineHeight: 1.55,
        border: "2px solid #000",
      }}
    >
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

      {summary.sections.map((sec, i) => (
        <div key={i}>
          <div
            style={{
              background: "#9C9C9C",
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
      ))}
    </div>
  );
}
