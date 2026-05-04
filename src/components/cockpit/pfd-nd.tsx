"use client";

import type { ScenarioState } from "@/engine/state";
import { Wind } from "lucide-react";
import { PfdPixi } from "./pfd-pixi";

export function PfdNd({ state }: { state?: ScenarioState }) {
  const fireActive = !!(
    state?.triggersFired?.["fire_warn"] ||
    state?.masterWarnActive ||
    state?.completedSteps?.["cancel_master_warn"]
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <div
        className="border border-[var(--color-border)] bg-[#050608] overflow-hidden"
        style={{ height: "200px" }}
      >
        <PfdPixi />
      </div>
      <div
        className="border border-[var(--color-border)] bg-[#050608] overflow-hidden"
        style={{ height: "200px" }}
      >
        <Nd fireActive={fireActive} />
      </div>
    </div>
  );
}

function Nd({ fireActive }: { fireActive: boolean }) {
  return (
    <div className="w-full h-full bg-black font-mono relative overflow-hidden flex flex-col p-1">
      {/* Data row */}
      <div
        className="flex justify-between border-b border-zinc-800 pb-1 mb-1"
        style={{ fontSize: "8px", flexShrink: 0 }}
      >
        <span style={{ color: "#E6E8EC" }}>
          GS <span style={{ color: "#00CFFF" }}>195</span>{" "}
          TAS <span style={{ color: "#00CFFF" }}>198</span>
        </span>
        <span style={{ color: "#E6E8EC", display: "flex", alignItems: "center", gap: "2px" }}>
          280/08 <Wind size={8} />
        </span>
        <span style={{ color: "#00FF00" }}>14:15Z</span>
      </div>

      {/* Arc */}
      <div className="flex-1 relative">
        <svg viewBox="0 0 180 160" className="w-full h-full">
          {/* Compass arc */}
          <path
            d="M 15 120 A 90 90 0 0 1 165 120"
            fill="none"
            stroke="#3A3F48"
            strokeWidth="1.5"
          />
          {/* Inner range ring */}
          <path
            d="M 45 120 A 60 60 0 0 1 135 120"
            fill="none"
            stroke="#222"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Heading ticks */}
          {[-30, -20, -10, 0, 10, 20, 30].map((offset) => {
            const angle = (offset * Math.PI) / 180;
            const r = 90;
            const cx = 90 + r * Math.sin(angle);
            const cy = 120 - r * Math.cos(angle);
            const inner = offset % 10 === 0 ? 6 : 3;
            const ix = 90 + (r - inner) * Math.sin(angle);
            const iy = 120 - (r - inner) * Math.cos(angle);
            return (
              <g key={offset}>
                <line x1={cx} y1={cy} x2={ix} y2={iy} stroke="#5A626F" strokeWidth="1" />
                {offset % 10 === 0 && (
                  <text
                    x={90 + (r - 14) * Math.sin(angle)}
                    y={120 - (r - 14) * Math.cos(angle)}
                    fontSize="7"
                    fill="#9AA0A8"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontFamily="monospace"
                  >
                    {String(Math.round((280 + offset + 360) % 360)).padStart(3, "0")}
                  </text>
                )}
              </g>
            );
          })}

          {/* Track line */}
          <line x1="90" y1="120" x2="90" y2="30" stroke="#FFFFFF" strokeWidth="1" opacity="0.4" />

          {/* Route line */}
          <polyline
            points="90,120 90,70 115,25"
            fill="none"
            stroke="#00FF00"
            strokeWidth="1.5"
          />

          {/* Waypoints */}
          <circle cx="90" cy="70" r="2" fill="#FFFFFF" />
          <text x="95" y="72" fontSize="6" fill="#FFFFFF" fontFamily="monospace">
            UKASI
          </text>
          <circle cx="115" cy="25" r="2" fill="#FFFFFF" />
          <text x="120" y="27" fontSize="6" fill="#FFFFFF" fontFamily="monospace">
            VIDP
          </text>

          {/* Aircraft symbol */}
          <polygon points="90,116 87,124 90,121 93,124" fill="#FFB000" />

          {fireActive && (
            <g>
              <rect x="95" y="80" width="70" height="28" fill="black" stroke="#FFBF00" strokeWidth="0.8" />
              <text x="130" y="91" fontSize="6" fill="#FFBF00" textAnchor="middle" fontFamily="monospace">
                ENG 1 FIRE
              </text>
              <text x="130" y="101" fontSize="5.5" fill="#FFBF00" textAnchor="middle" fontFamily="monospace">
                RTB VIDP
              </text>
            </g>
          )}
        </svg>

        {/* Range + mode labels */}
        <div
          className="absolute bottom-0 left-0 right-0 flex justify-between"
          style={{ fontSize: "8px" }}
        >
          <span style={{ color: "#00FF00" }}>NAV ARC</span>
          <span style={{ color: "#00CFFF" }}>40 NM</span>
        </div>
      </div>
    </div>
  );
}
