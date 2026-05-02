"use client";

import type { ScenarioState } from "@/engine/state";
import { Wind } from "lucide-react";

// FMA column — Airbus green/cyan/white text on black strip
function FmaCol({
  label,
  color = "#00FF00",
  sub = "",
}: {
  label: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center border-r border-zinc-800 last:border-r-0 h-full px-1">
      <span
        style={{ color, fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em" }}
        className="uppercase font-mono leading-none"
      >
        {label}
      </span>
      {sub && (
        <span
          style={{ color: "#00CFFF", fontSize: "8px" }}
          className="font-mono mt-px leading-none"
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function Pfd({ apEngaged, fireActive }: { apEngaged: boolean; fireActive: boolean }) {
  const thrMode = fireActive ? "THR IDLE" : "THR CLB";
  const vertMode = fireActive ? "OP CLB" : "CLB";
  const apLabel = apEngaged ? "A/P 1" : "FD 1+2";
  const thrColor = fireActive ? "#FFBF00" : "#FFFFFF";

  return (
    <div className="w-full h-full bg-black font-mono flex flex-col overflow-hidden">
      {/* FMA strip */}
      <div
        className="flex border-b border-zinc-800"
        style={{ height: "28px", flexShrink: 0 }}
      >
        <FmaCol label={thrMode} color={thrColor} />
        <FmaCol label={vertMode} />
        <FmaCol label="NAV" />
        <FmaCol label="1FD2" color="#00CFFF" sub={apLabel} />
        <FmaCol label="A/THR" color="#00CFFF" />
      </div>

      {/* Main display */}
      <div className="flex-1 relative">
        {/* Sky */}
        <div
          className="absolute left-10 right-10 top-0"
          style={{ bottom: "50%", backgroundColor: "#1A4F7A" }}
        />
        {/* Ground */}
        <div
          className="absolute left-10 right-10 bottom-8"
          style={{ top: "50%", backgroundColor: "#5C3A1E" }}
        />
        {/* Horizon line */}
        <div
          className="absolute left-10 right-10"
          style={{ top: "50%", height: "1px", backgroundColor: "#fff", opacity: 0.7 }}
        />

        {/* Pitch lines */}
        {[10, 5, -5, -10].map((deg) => (
          <div
            key={deg}
            className="absolute"
            style={{
              left: "30%",
              right: "30%",
              top: `calc(50% + ${-deg * 3}px)`,
              height: "1px",
              backgroundColor: "rgba(255,255,255,0.45)",
            }}
          >
            <span
              className="absolute font-mono"
              style={{
                fontSize: "8px",
                color: "rgba(255,255,255,0.6)",
                left: "-18px",
                top: "-5px",
              }}
            >
              {Math.abs(deg)}
            </span>
          </div>
        ))}

        {/* Aircraft symbol */}
        <div
          className="absolute"
          style={{
            top: "calc(50% - 2px)",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          <div style={{ width: "20px", height: "3px", backgroundColor: "#FFB000" }} />
          <div style={{ width: "4px", height: "4px", backgroundColor: "#FFB000", borderRadius: "1px" }} />
          <div style={{ width: "20px", height: "3px", backgroundColor: "#FFB000" }} />
        </div>

        {/* Speed tape (left) */}
        <div
          className="absolute top-0 bottom-8"
          style={{ left: 0, width: "36px", backgroundColor: "rgba(0,0,0,0.7)", borderRight: "1px solid #2A2F38" }}
        >
          <div
            className="absolute"
            style={{ top: "50%", transform: "translateY(-50%)", width: "100%" }}
          >
            <div
              className="text-center font-mono font-bold"
              style={{ fontSize: "13px", color: "#E6E8EC", backgroundColor: "#000", border: "1px solid #ccc", padding: "1px 2px" }}
            >
              165
            </div>
          </div>
          <div
            className="absolute top-1 w-full text-center font-mono"
            style={{ fontSize: "7px", color: "#5A626F" }}
          >
            SPD
          </div>
          {/* V2 bug */}
          <div
            className="absolute right-0 font-mono"
            style={{ top: "40%", fontSize: "7px", color: "#00CFFF", borderRight: "2px solid #00CFFF" }}
          >
            V2
          </div>
        </div>

        {/* Altitude tape (right) */}
        <div
          className="absolute top-0 bottom-8"
          style={{ right: 0, width: "40px", backgroundColor: "rgba(0,0,0,0.7)", borderLeft: "1px solid #2A2F38" }}
        >
          <div
            className="absolute"
            style={{ top: "50%", transform: "translateY(-50%)", width: "100%" }}
          >
            <div
              className="text-center font-mono font-bold"
              style={{ fontSize: "11px", color: "#00CFFF", backgroundColor: "#000", border: "1px solid #ccc", padding: "1px 2px" }}
            >
              1500
            </div>
          </div>
          <div
            className="absolute top-1 w-full text-center font-mono"
            style={{ fontSize: "7px", color: "#5A626F" }}
          >
            ALT
          </div>
          {/* Target altitude */}
          <div
            className="absolute font-mono"
            style={{ top: "20%", right: "2px", fontSize: "7px", color: "#00CFFF" }}
          >
            3000
          </div>
        </div>

        {/* Heading box (bottom) */}
        <div
          className="absolute bottom-0 left-10 right-10"
          style={{ height: "28px", backgroundColor: "#000", borderTop: "1px solid #2A2F38", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {/* Mini heading scale */}
          <div className="flex items-center gap-3 font-mono" style={{ fontSize: "9px", color: "#5A626F" }}>
            <span>26</span><span>27</span>
            <span style={{ color: "#E6E8EC", fontWeight: 700, fontSize: "11px", borderTop: "2px solid #E6E8EC", padding: "0 4px" }}>280</span>
            <span>29</span><span>30</span>
          </div>
        </div>

        {/* Vertical speed indicator (right side strip) */}
        <div
          className="absolute"
          style={{ right: "40px", top: "20%", bottom: "28px", width: "8px", display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <div
            style={{ flex: 1, width: "2px", backgroundColor: "#2A2F38" }}
          />
          {/* V/S pointer — positive = up */}
          <div
            style={{
              position: "absolute",
              top: "35%",
              width: "6px",
              height: "6px",
              backgroundColor: "#00FF00",
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
            }}
          />
        </div>
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

export function PfdNd({ state }: { state?: ScenarioState }) {
  const fireActive = !!(
    state?.triggersFired?.["fire_warn"] ||
    state?.masterWarnActive ||
    state?.completedSteps?.["cancel_master_warn"]
  );
  const apEngaged = !!(state?.completedSteps?.["engage_ap_fma"]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="border border-[var(--color-border)] bg-[#050608] overflow-hidden" style={{ height: "200px" }}>
        <Pfd apEngaged={apEngaged} fireActive={fireActive} />
      </div>
      <div className="border border-[var(--color-border)] bg-[#050608] overflow-hidden" style={{ height: "200px" }}>
        <Nd fireActive={fireActive} />
      </div>
    </div>
  );
}
