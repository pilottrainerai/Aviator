"use client";

// HYD panel dev sandbox — free orbit + EDIT BAR to dial the button press positions
// (NEUTRAL / IN / OUT) and cross-check the cap colour against the live fire panel.
import { useEffect, useState } from "react";
import { HydPanel3D, HYD_TUNE_DEFAULT, HYD_PUMP_ORDER, HYD_PUMP_LABELS, HYD_RAT_GUARD_DEFAULT, HYD_ELEC_GUARD_DEFAULT, HYD_RAT_BTN_DEFAULT, HYD_ELEC_BTN_DEFAULT, type HydTune, type HydPos, type HydPumpState, type HydPumpKey, type HydGuard, type HydBtn } from "@/components/cockpit/hyd-panel-3d";

const KEY = "hydTune.v23"; // bump on every default change to discard stale saved tunes so new defaults load without a manual Reset

export default function HydPanel3DDevPage() {
  const [tune, setTune] = useState<HydTune>(HYD_TUNE_DEFAULT);
  const [pos, setPos] = useState<HydPos>("neutral");
  const [collapsed, setCollapsed] = useState(false); // dev edit bar collapse toggle
  const [pumps, setPumps] = useState<HydPumpState>({}); // FCOM DSC-29-20 pump light state
  const toggleOff = (k: HydPumpKey) => setPumps((p) => ({ ...p, [k]: { ...p[k], off: !p[k]?.off } }));
  const toggleOn = (k: HydPumpKey) => setPumps((p) => ({ ...p, [k]: { ...p[k], on: !p[k]?.on } }));
  const toggleFault = (k: HydPumpKey) => setPumps((p) => ({ ...p, [k]: { ...p[k], fault: !p[k]?.fault } }));
  // RAT MAN ON + BLUE ELEC PUMP — guard flip + pushbutton (colour + IN/OUT), persisted.
  const CKEY = "hydCtl.v4"; // bump: HydGuard reshaped (pos X/Y/Z + pivot Y/Z); discard old hinge-only state
  const [ratGuard, setRatGuard] = useState<HydGuard>(HYD_RAT_GUARD_DEFAULT);
  const [elecGuard, setElecGuard] = useState<HydGuard>(HYD_ELEC_GUARD_DEFAULT);
  const [ratBtn, setRatBtn] = useState<HydBtn>(HYD_RAT_BTN_DEFAULT);
  const [elecBtn, setElecBtn] = useState<HydBtn>(HYD_ELEC_BTN_DEFAULT);
  useEffect(() => { try { const v = localStorage.getItem(CKEY); if (v) { const o = JSON.parse(v); if (o.ratGuard) setRatGuard({ ...HYD_RAT_GUARD_DEFAULT, ...o.ratGuard }); if (o.elecGuard) setElecGuard({ ...HYD_ELEC_GUARD_DEFAULT, ...o.elecGuard }); if (o.ratBtn) setRatBtn({ ...HYD_RAT_BTN_DEFAULT, ...o.ratBtn }); if (o.elecBtn) setElecBtn({ ...HYD_ELEC_BTN_DEFAULT, ...o.elecBtn }); } } catch { /* ignore */ } }, []);
  const saveCtl = (rg: HydGuard, eg: HydGuard, rb: HydBtn, eb: HydBtn) => { try { localStorage.setItem(CKEY, JSON.stringify({ ratGuard: rg, elecGuard: eg, ratBtn: rb, elecBtn: eb })); } catch { /* ignore */ } };
  const setG = (k: keyof HydGuard, v: number | boolean | string) => setRatGuard((g) => { const n = { ...g, [k]: v }; saveCtl(n, elecGuard, ratBtn, elecBtn); return n; });
  const setEG = (k: keyof HydGuard, v: number | boolean | string) => setElecGuard((g) => { const n = { ...g, [k]: v }; saveCtl(ratGuard, n, ratBtn, elecBtn); return n; });
  const setRB = (k: keyof HydBtn, v: number | string) => setRatBtn((b) => { const n = { ...b, [k]: v }; saveCtl(ratGuard, elecGuard, n, elecBtn); return n; });
  const setEB = (k: keyof HydBtn, v: number | string) => setElecBtn((b) => { const n = { ...b, [k]: v }; saveCtl(ratGuard, elecGuard, ratBtn, n); return n; });
  const [showPivot, setShowPivot] = useState(true); // dev aid: draw the hinge-rod marker at each guard pivot
  const [latched, setLatched] = useState(false); // false = rests at neutral, true = rests at out
  // Play the real press: dip to IN momentarily, then settle at the toggled resting state.
  const press = () => {
    setPos("in");
    const settle = latched ? "neutral" : "out";
    setLatched((v) => !v);
    setTimeout(() => setPos(settle as HydPos), 190);
  };
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v) setTune({ ...HYD_TUNE_DEFAULT, ...JSON.parse(v) }); } catch { /* ignore */ } }, []);
  const set = (k: keyof HydTune, v: number | string) => setTune((t) => { const n = { ...t, [k]: v }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; });

  const rowS: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
  const numS: React.CSSProperties = { width: 78, background: "#161b22", color: "#eef6ff", border: "1px solid #3a434f", borderRadius: 4, padding: "2px 6px", fontFamily: "monospace", fontSize: 11, textAlign: "right" };
  // editing a position slider auto-previews that position so the cap moves live
  const posForKey: Partial<Record<keyof HydTune, HydPos>> = { neutralY: "neutral", inY: "in", outY: "out" };
  const setPos2 = (k: keyof HydTune, v: number) => { const p = posForKey[k]; if (p) setPos(p); set(k, v); };
  const num = (label: string, k: keyof HydTune, min: number, max: number, step: number) => (
    <label key={k} style={rowS}>
      <span style={{ width: 86 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={tune[k] as number} onChange={(e) => setPos2(k, Number(e.target.value))} style={{ flex: 1 }} />
      <input type="number" min={min} max={max} step={step} value={tune[k] as number} onChange={(e) => setPos2(k, Number(e.target.value))} style={numS} />
    </label>
  );
  const posBtn = (p: HydPos, label: string): React.CSSProperties => ({
    flex: 1, padding: "6px 8px", fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: "pointer", border: "1px solid #3a434f",
    fontFamily: "monospace", color: pos === p ? "#05070a" : "#cdd6e0", background: pos === p ? "#8aabbb" : "#2a313b",
  });

  return (
    <main style={{ position: "fixed", inset: 0, background: "#05070a", overflow: "hidden" }}>
      <HydPanel3D tune={tune} pos={pos} pumps={pumps} ratGuard={ratGuard} elecGuard={elecGuard} ratBtn={ratBtn} elecBtn={elecBtn} showPivot={showPivot} />

      {/* GUARD LID EDITOR — isolated on the LEFT so the lid can be placed without the busy right panel.
          pos = move the whole lid (X left/right, Y in/out depth, Z up/down); pivot = move only the
          rotation centre; Open angle flips it about that pivot. */}
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 10, width: 262, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.95)", border: "1px solid #2a313b",
        fontFamily: "monospace", fontSize: 12, color: "#cdd6e0" }}>
        <div style={{ letterSpacing: 1, color: "#dfe6f0", fontWeight: 700 }}>GUARD LID EDITOR</div>
        <div style={{ color: "#7d8794", fontSize: 9, lineHeight: 1.35 }}>
          Lid = the cover, Rod = the hinge — moved INDEPENDENTLY. up/dn + L/R = along the face; in/out = depth (usually 0).
        </div>
        <label style={{ ...rowS, cursor: "pointer", color: "#ffd23f" }}>
          <input type="checkbox" checked={showPivot} onChange={(e) => setShowPivot(e.target.checked)} />
          <span>Show hinge rod (yellow bar = the pivot line)</span>
        </label>
        {([
          ["RAT MAN ON", ratGuard, setG, "#e08a2b"],
          ["BLUE ELEC PUMP", elecGuard, setEG, "#3f6fb0"],
        ] as [string, HydGuard, (k: keyof HydGuard, v: number | boolean | string) => void, string][]).map(([title, g, sg, accent]) => (
          <div key={title} style={{ borderTop: "1px solid #222a35", paddingTop: 6, marginTop: 2 }}>
            <div style={{ color: "#8aabbb", fontSize: 10 }}>{title}</div>
            <button type="button" onClick={() => sg("open", !g.open)}
              style={{ width: "100%", marginTop: 4, padding: "6px 8px", fontSize: 11, fontWeight: 700, fontFamily: "monospace",
                color: g.open ? "#05070a" : "#cdd6e0", background: g.open ? accent : "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>
              {g.open ? "GUARD OPEN ▲" : "GUARD CLOSED ▼"}
            </button>
            <label style={rowS}>
              <span style={{ width: 92 }}>Lid colour</span>
              <input type="color" value={g.coverColor} onChange={(e) => sg("coverColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
            </label>
            {([
              ["Open angle", "angleDeg", -270, 270, 1, "open"],
              ["Close angle", "closedDeg", -270, 270, 1, "close"],
              ["Lid L/R", "posXOff", -0.9, 0.9, 0.002, ""],
              ["Lid up/dn", "posZOff", -0.9, 0.9, 0.002, ""],
              ["Lid in/out", "posYOff", -0.9, 0.9, 0.002, ""],
              ["Rod up/dn", "pivotZOff", -0.9, 0.9, 0.002, ""],
              ["Rod in/out", "pivotYOff", -0.9, 0.9, 0.002, ""],
            ] as [string, keyof HydGuard, number, number, number, string][]).map(([label, k, min, max, step, mode]) => (
              <label key={k} style={rowS}>
                <span style={{ width: 92 }}>{label}</span>
                <input type="range" min={min} max={max} step={step} value={g[k] as number} onChange={(e) => { if (mode === "open" && !g.open) sg("open", true); if (mode === "close" && g.open) sg("open", false); sg(k, Number(e.target.value)); }} style={{ flex: 1 }} />
                <input type="number" min={min} max={max} step={step} value={g[k] as number} onChange={(e) => sg(k, Number(e.target.value))} style={numS} />
              </label>
            ))}
          </div>
        ))}
      </div>

      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10, width: 270, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 14px", borderRadius: 10, background: "rgba(10,14,20,0.95)", border: "1px solid #2a313b",
        fontFamily: "monospace", fontSize: 12, color: "#cdd6e0" }}>
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", letterSpacing: 1, color: "#dfe6f0", fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: 12, padding: 0 }}>
          <span>HYD · PANEL + BUTTON EDIT</span>
          <span style={{ color: "#8aabbb" }}>{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed && <>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>PANEL (FACE) — fire hue + faked sheen</div>
        <label style={rowS}>
          <span style={{ width: 86 }}>Colour</span>
          <input type="color" value={tune.panelColor} onChange={(e) => set("panelColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
        </label>
        {num("Roughness", "panelRough", 0, 1, 0.02)}
        {num("Metalness", "panelMetal", 0, 3, 0.02)}
        {num("Clearcoat", "panelClear", 0, 1, 0.02)}
        {num("Reflections", "panelEnv", 0, 6, 0.05)}
        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 4 }}>SHEEN per edge (1.0 = neutral)</div>
        {num("Sheen top", "sheenT", 0.1, 2.5, 0.05)}
        {num("Sheen bot", "sheenB", 0.1, 2.5, 0.05)}
        {num("Sheen left", "sheenL", 0.1, 2.5, 0.05)}
        {num("Sheen right", "sheenR", 0.1, 2.5, 0.05)}

        <button type="button" onClick={press}
          style={{ marginTop: 4, padding: "8px 8px", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#05070a", background: "#8aabbb", border: "1px solid #3a434f", borderRadius: 6, cursor: "pointer", fontFamily: "monospace" }}>
          ▶ PRESS  (neutral → in → stays)
        </button>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>PREVIEW POSITION</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={posBtn("neutral", "NEUTRAL")} onClick={() => setPos("neutral")}>NEUTRAL</button>
          <button type="button" style={posBtn("in", "IN")} onClick={() => setPos("in")}>IN</button>
          <button type="button" style={posBtn("out", "OUT")} onClick={() => setPos("out")}>STAYS</button>
        </div>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>ABSOLUTE CAP POSITIONS (border stays fixed)</div>
        {num("Neutral", "neutralY", -0.05, 0.05, 0.001)}
        {num("In", "inY", -0.05, 0.05, 0.001)}
        {num("Stays", "outY", -0.05, 0.05, 0.001)}
        <div style={{ marginTop: 4, padding: "4px 6px", borderRadius: 4, background: "#161b22", color: "#9fe6c0", fontSize: 11 }}>
          N {(tune.neutralY as number).toFixed(3)}  ·  I {(tune.inY as number).toFixed(3)}  ·  S {(tune.outY as number).toFixed(3)}
        </div>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 6 }}>BUTTON COLOURS (live fire: cap #070a0e / border #222730)</div>
        <label style={rowS}>
          <span style={{ width: 86 }}>Cap</span>
          <input type="color" value={tune.capColor} onChange={(e) => set("capColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
        </label>
        <label style={rowS}>
          <span style={{ width: 86 }}>Border / frame</span>
          <input type="color" value={tune.borderColor} onChange={(e) => set("borderColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
        </label>
        <label style={rowS}>
          <span style={{ width: 86 }}>RAT switch</span>
          <input type="color" value={tune.ratColor} onChange={(e) => set("ratColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
        </label>

        <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 8 }}>PUMP LIGHTS — FAULT amber / OFF white (FCOM DSC-29-20)</div>
        {HYD_PUMP_ORDER.map((k) => {
          const isYellow = k === "yellowElec";
          const off = !!pumps[k]?.off;
          const on = !!pumps[k]?.on;
          const fault = !!pumps[k]?.fault;
          const offSelected = isYellow ? !on : off;
          const faultLit = fault && !offSelected; // FCOM: FAULT goes out when OFF selected (no overheat in this dev toggle)
          const bottomLit = isYellow ? on : off;
          const chip = (active: boolean, label: string, bg: string, fn: () => void) => (
            <button type="button" onClick={fn}
              style={{ width: 52, padding: "4px 0", fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                color: active ? "#05070a" : "#8893a2", background: active ? bg : "#222730", border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer" }}>
              {label}
            </button>
          );
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ flex: 1, fontSize: 10 }}>{HYD_PUMP_LABELS[k]}</span>
              {chip(faultLit, "FAULT", "#ff9f00", () => toggleFault(k))}
              {isYellow
                ? chip(bottomLit, "ON", "#f3f6fa", () => toggleOn(k))
                : chip(bottomLit, "OFF", "#f3f6fa", () => toggleOff(k))}
            </div>
          );
        })}

        {/* PUSHBUTTONS only — guard-lid controls live in the LEFT panel. */}
        {([
          ["RAT MAN ON", ratBtn, setRB],
          ["BLUE ELEC PUMP", elecBtn, setEB],
        ] as [string, HydBtn, (k: keyof HydBtn, v: number | string) => void][]).map(([title, b, sb]) => (
          <div key={title}>
            <div style={{ color: "#8aabbb", fontSize: 10, marginTop: 8 }}>{title} — PUSHBUTTON</div>
            <label style={rowS}>
              <span style={{ width: 86 }}>{b.plateColor !== undefined ? "Round btn" : "Btn colour"}</span>
              <input type="color" value={b.color} onChange={(e) => sb("color", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
            </label>
            {b.plateColor !== undefined && (
              <label style={rowS}>
                <span style={{ width: 86 }}>Flat plate</span>
                <input type="color" value={b.plateColor} onChange={(e) => sb("plateColor", e.target.value)} style={{ flex: 1, height: 22, border: "1px solid #3a434f", borderRadius: 4, cursor: "pointer", padding: 0, background: "transparent" }} />
              </label>
            )}
            {b.plateColor !== undefined && (<>
              <label style={rowS}>
                <span style={{ width: 86 }}>Round darkness</span>
                <input type="range" min={0} max={1.5} step={0.01} value={b.env ?? 1} onChange={(e) => sb("env", Number(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min={0} max={1.5} step={0.01} value={b.env ?? 1} onChange={(e) => sb("env", Number(e.target.value))} style={numS} />
              </label>
              <label style={rowS}>
                <span style={{ width: 86 }}>Plate darkness</span>
                <input type="range" min={0} max={1.5} step={0.01} value={b.plateEnv ?? 1} onChange={(e) => sb("plateEnv", Number(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min={0} max={1.5} step={0.01} value={b.plateEnv ?? 1} onChange={(e) => sb("plateEnv", Number(e.target.value))} style={numS} />
              </label>
              <div style={{ color: "#7d8794", fontSize: 9, lineHeight: 1.3 }}>lower = blacker (less HDRI reflection); 1.0 = original</div>
            </>)}
            <label style={rowS}>
              <span style={{ width: 86 }}>Btn in/out</span>
              <input type="range" min={-0.06} max={0.04} step={0.002} value={b.inOut} onChange={(e) => sb("inOut", Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={-0.06} max={0.04} step={0.002} value={b.inOut} onChange={(e) => sb("inOut", Number(e.target.value))} style={numS} />
            </label>
            {b.plateColor !== undefined && (
              // Momentary press of the CENTRE round: dip in, then return to the rest offset.
              <button type="button" onClick={() => { const rest = b.inOut; sb("inOut", rest - 0.03); setTimeout(() => sb("inOut", rest), 200); }}
                style={{ marginTop: 4, width: "100%", padding: "7px 8px", fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "#05070a", background: "#8aabbb", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>
                ▶ PRESS CENTRE  (in → out)
              </button>
            )}
          </div>
        ))}

        {/* Dump every live-dialled value (tune + guards + buttons) so it can be baked as a code
            default. Copies JSON to clipboard AND logs it — paste it back to lock the settings. */}
        <button type="button" onClick={() => {
          const dump = JSON.stringify({ tune, ratGuard, elecGuard, ratBtn, elecBtn }, null, 2);
          console.log("[HYD settings dump]\n" + dump);
          navigator.clipboard?.writeText(dump).catch(() => {});
        }}
          style={{ marginTop: 10, padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#05070a", background: "#8aabbb", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer", fontFamily: "monospace" }}>⧉ COPY SETTINGS JSON</button>

        <button type="button" onClick={() => { setTune(HYD_TUNE_DEFAULT); try { localStorage.setItem(KEY, JSON.stringify(HYD_TUNE_DEFAULT)); } catch { /* ignore */ } }}
          style={{ marginTop: 6, padding: "5px 8px", fontSize: 11, color: "#eef6ff", background: "#2a313b", border: "1px solid #3a434f", borderRadius: 5, cursor: "pointer" }}>Reset</button>
        </>}
      </div>
    </main>
  );
}
