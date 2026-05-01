"use client";

/**
 * PFD + ND placeholder panel. Static — per Q24 only the E-WD is "live" in MVP.
 * These exist so the cockpit doesn't feel naked, and so the sidebar layout
 * has parity with a real flight deck.
 */

export function PfdNd() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Panel label="PFD">
        <Pfd />
      </Panel>
      <Panel label="ND">
        <Nd />
      </Panel>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--color-border)] bg-[#050608] aspect-[3/4] relative overflow-hidden">
      <div className="absolute top-2 left-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]">
        {label}
      </div>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

function Pfd() {
  // Stylized A320 PFD — speed tape on left, attitude in center, alt tape on right
  return (
    <svg viewBox="0 0 200 240" className="w-full h-full">
      {/* sky / ground horizon */}
      <rect x="40" y="40" width="120" height="80" fill="#3b82f6" opacity="0.15" />
      <rect x="40" y="120" width="120" height="80" fill="#a3a380" opacity="0.18" />
      <line x1="40" y1="120" x2="160" y2="120" stroke="#fff" strokeWidth="1" />
      {/* aircraft symbol */}
      <line x1="80" y1="120" x2="120" y2="120" stroke="#FFB000" strokeWidth="2" />
      <rect x="98" y="118" width="4" height="4" fill="#FFB000" />
      {/* speed tape */}
      <rect x="6" y="40" width="28" height="160" fill="#000" stroke="#2A2F38" />
      <text x="20" y="125" fontSize="14" fill="#E6E8EC" textAnchor="middle" fontFamily="monospace">
        250
      </text>
      <text x="20" y="32" fontSize="8" fill="#5A626F" textAnchor="middle" fontFamily="monospace">
        SPD
      </text>
      {/* alt tape */}
      <rect x="166" y="40" width="28" height="160" fill="#000" stroke="#2A2F38" />
      <text x="180" y="125" fontSize="11" fill="#E6E8EC" textAnchor="middle" fontFamily="monospace">
        FL230
      </text>
      <text x="180" y="32" fontSize="8" fill="#5A626F" textAnchor="middle" fontFamily="monospace">
        ALT
      </text>
      {/* heading at bottom */}
      <rect x="40" y="206" width="120" height="22" fill="#000" stroke="#2A2F38" />
      <text x="100" y="222" fontSize="11" fill="#E6E8EC" textAnchor="middle" fontFamily="monospace">
        HDG 270
      </text>
      {/* FMA strip on top */}
      <rect x="40" y="6" width="120" height="20" fill="#000" stroke="#2A2F38" />
      <text x="60" y="20" fontSize="8" fill="#00C26B" fontFamily="monospace">
        SPEED
      </text>
      <text x="100" y="20" fontSize="8" fill="#00C26B" fontFamily="monospace">
        ALT
      </text>
      <text x="140" y="20" fontSize="8" fill="#00C26B" fontFamily="monospace">
        NAV
      </text>
    </svg>
  );
}

function Nd() {
  return (
    <svg viewBox="0 0 200 240" className="w-full h-full">
      <circle cx="100" cy="160" r="90" fill="none" stroke="#2A2F38" strokeWidth="1" />
      <circle cx="100" cy="160" r="60" fill="none" stroke="#2A2F38" strokeWidth="0.5" strokeDasharray="2 2" />
      <circle cx="100" cy="160" r="30" fill="none" stroke="#2A2F38" strokeWidth="0.5" strokeDasharray="2 2" />
      {/* aircraft symbol at center */}
      <polygon points="100,150 95,162 100,158 105,162" fill="#FFB000" />
      {/* heading line */}
      <line x1="100" y1="70" x2="100" y2="160" stroke="#fff" strokeWidth="1" opacity="0.5" />
      <text x="100" y="60" fontSize="9" fill="#E6E8EC" textAnchor="middle" fontFamily="monospace">
        N
      </text>
      {/* TO waypoint marker */}
      <polygon points="100,90 96,98 104,98" fill="#4F8CFF" />
      <text x="110" y="95" fontSize="8" fill="#4F8CFF" fontFamily="monospace">
        WPT
      </text>
      {/* range */}
      <text x="14" y="232" fontSize="8" fill="#5A626F" fontFamily="monospace">
        80NM
      </text>
      <text x="186" y="232" fontSize="8" fill="#5A626F" textAnchor="end" fontFamily="monospace">
        ROSE
      </text>
    </svg>
  );
}
