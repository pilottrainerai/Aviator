"use client";

// A320 ECAM System Display (lower ECAM / SD)
// Supports DSL-driven scenario configs (systemTabs) or falls back to hardcoded ENG 1 FIRE pages.

import { useState, useEffect } from "react";
import type { ScenarioState } from "@/engine/state";
import type {
  Scenario,
  SysCase,
  SysColor,
  SysSwState,
  SysTabDef,
  SysVal,
} from "@/scenarios/types";

const C = {
  red:    "#FF3333",
  amber:  "#FFB300",
  green:  "#00D060",
  cyan:   "#00CFFF",
  white:  "#E8ECF4",
  dim:    "#6A7488",
  dimLo:  "#3A4252",
  border: "#1C2130",
  bg:     "#000000",
  bezel:  "#1E2430",
  ledOff: "#06090D",
  btnFace:"#0A0D14",
} as const;

export const SYS_COLORS: Record<SysColor, string> = {
  green: "#00D060",
  amber: "#FFB300",
  red:   "#FF3333",
  cyan:  "#00CFFF",
  dim:   "#6A7488",
};

// ─── evalSysCase ─────────────────────────────────────────────────────────────
// Evaluates the states array in order — returns value of first matching case.
// Exported so FirePanel and other components can reuse it.
export function evalSysCase<T>(cases: SysCase<T>[], state: ScenarioState): T {
  for (const c of cases) {
    if (!c.when) return c.value;
    const t = c.when.trigger ? !!state.triggersFired[c.when.trigger] : true;
    const s = c.when.step    ? !!state.completedSteps[c.when.step]   : true;
    if (t && s) return c.value;
  }
  return cases[cases.length - 1].value;
}

// ─── Data row ─────────────────────────────────────────────────────────────────
function SysRow({ label, value, color, unit }: { label: string; value: string; color: string; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between px-3 py-[4px]" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: "#8A9AAE", fontSize: "10px", letterSpacing: "0.08em", fontFamily: "monospace" }}>{label}</span>
      <span style={{ color, fontSize: "12px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.06em" }}>
        {value}
        {unit && <span style={{ color: "#6A7A8A", fontSize: "9px", marginLeft: "3px" }}>{unit}</span>}
      </span>
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────
function SysSection({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-[5px]" style={{ backgroundColor: color + "18" }}>
      <div style={{ flex: 1, height: "1px", backgroundColor: color + "55" }} />
      <span style={{ color, fontSize: "9px", letterSpacing: "0.22em", fontFamily: "monospace", fontWeight: 700 }}>{title}</span>
      <div style={{ flex: 1, height: "1px", backgroundColor: color + "55" }} />
    </div>
  );
}

// ─── Overhead Panel Switch indicator ─────────────────────────────────────────
const SW_COLORS: Record<SysSwState, string> = {
  norm:   C.green,
  fault:  C.amber,
  off:    C.dimLo,
  auto:   C.green,
  open:   C.amber,
  fire:   C.red,
  armed:  C.cyan,
};
const SW_LABELS: Record<SysSwState, string> = {
  norm:   "NORM",
  fault:  "FAULT",
  off:    "OFF",
  auto:   "AUTO",
  open:   "OPEN",
  fire:   "FIRE",
  armed:  "ARM",
};

function OHPSwitch({ label, sublabel, swState }: { label: string; sublabel?: string; swState: SysSwState }) {
  const ledColor = SW_COLORS[swState];
  const ledText  = SW_LABELS[swState];
  const isFault  = swState === "fault" || swState === "open";
  const isAlarm  = swState === "fire" || swState === "armed";
  const isOff    = swState === "off";

  const ledBg = (isFault || isAlarm)
    ? ledColor + "50"
    : isOff
    ? "#1A1018"
    : ledColor + "22";

  const ledTextColor = (isFault || isAlarm) ? ledColor : isOff ? "#886655" : ledColor;
  const bezelBorder = (isFault || isAlarm) ? ledColor : "#3A4A5A";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "52px" }}>
      <div
        style={{
          width: "52px",
          backgroundColor: "#141A24",
          border: `1.5px solid ${bezelBorder}`,
          borderRadius: "3px",
          padding: "2px",
          boxShadow: (isFault || isAlarm)
            ? `0 0 8px ${ledColor}80, inset 0 0 4px ${ledColor}20`
            : "inset 0 1px 2px rgba(0,0,0,0.6)",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        <div
          style={{
            backgroundColor: ledBg,
            borderRadius: "2px 2px 0 0",
            padding: "4px 3px",
            textAlign: "center",
            minHeight: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: `1px solid ${bezelBorder}`,
          }}
        >
          <span style={{
            fontSize: "8px",
            fontFamily: "monospace",
            fontWeight: 800,
            letterSpacing: "0.06em",
            color: ledTextColor,
            textTransform: "uppercase",
            textShadow: (isFault || isAlarm) ? `0 0 6px ${ledColor}` : "none",
          }}>
            {ledText}
          </span>
        </div>
        <div style={{ backgroundColor: "#0C1018", borderRadius: "0 0 2px 2px", padding: "4px 3px", textAlign: "center" }}>
          <div style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.05em", color: "#C8D4E0", lineHeight: 1.2, textTransform: "uppercase" }}>
            {label}
          </div>
          {sublabel && (
            <div style={{ fontSize: "7px", fontFamily: "monospace", color: C.dim, letterSpacing: "0.04em", marginTop: "2px", textTransform: "uppercase" }}>
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Switches tray ────────────────────────────────────────────────────────────
function SwTray({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "8px 8px 10px", borderTop: `1px solid ${C.border}`, backgroundColor: "#050810" }}>
      <div style={{ color: "#8AABBB", fontSize: "8px", letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: "8px", textTransform: "uppercase" }}>
        OHP — {title}
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {children}
      </div>
      {note && (
        <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: `1px solid ${C.border}`, color: "#9AABB8", fontSize: "8px", fontFamily: "monospace", letterSpacing: "0.04em", lineHeight: 1.65 }}>
          {note}
        </div>
      )}
    </div>
  );
}

// ─── DSL-driven tab page ───────────────────────────────────────────────────────
function DslTabPage({ tab, state }: { tab: SysTabDef; state: ScenarioState }) {
  return (
    <>
      {tab.sections.map((section) => {
        const color = SYS_COLORS[evalSysCase(section.colorStates, state)];
        return (
          <div key={section.title}>
            <SysSection title={section.title} color={color} />
            {section.rows.map((row) => {
              const val: SysVal = evalSysCase(row.states, state);
              return (
                <SysRow
                  key={row.label}
                  label={row.label}
                  value={val.v}
                  color={SYS_COLORS[val.c]}
                  unit={row.unit}
                />
              );
            })}
          </div>
        );
      })}
      {tab.tray && (
        <SwTray title={tab.tray.title} note={tab.tray.note}>
          {tab.tray.switches.map((sw) => {
            const swState = evalSysCase(sw.states, state);
            return (
              <OHPSwitch key={sw.label} label={sw.label} sublabel={sw.sub} swState={swState} />
            );
          })}
        </SwTray>
      )}
    </>
  );
}

// ─── Hardcoded fallback pages (ENG 1 FIRE scenario) ──────────────────────────

function activePage(state: ScenarioState): "eng" | "hyd" | "elec" | "air" | "normal" {
  const done = (id: string) => !!state.completedSteps[id];
  if (done("eng1_fire_pb")) return "hyd";
  if (done("eng1_master_off")) return "eng";
  if (state.masterWarnActive) return "eng";
  return "normal";
}

function EngPage({ state }: { state: ScenarioState }) {
  const done = (id: string) => !!state.completedSteps[id];
  const fire = !!state.triggersFired?.["fire_warn"];
  const masterOff  = done("eng1_master_off");
  const firePbDone = done("eng1_fire_pb");
  const thrIdle    = done("thr_lever_idle");
  const eng1Color  = masterOff ? C.amber : fire ? C.red : C.green;

  return (
    <>
      <SysSection title="ENG 1" color={fire ? C.red : C.dim} />
      <SysRow label="THR LVR"  value={thrIdle ? "IDLE" : fire ? "MCT/FLX" : "CLB"}  color={thrIdle ? C.green : fire ? C.amber : C.green} />
      <SysRow label="N1"       value={masterOff ? "0.0" : fire ? "- -" : "84.2"}    color={eng1Color} unit="%" />
      <SysRow label="EGT"      value={firePbDone ? "180" : fire ? "820" : "620"}     color={eng1Color} unit="°C" />
      <SysRow label="FF"       value={masterOff ? "0" : fire ? "0" : "2400"}         color={eng1Color} unit="KG/H" />
      <SysRow label="STATUS"   value={masterOff ? "SHUT DOWN" : fire ? "FIRE" : "NORMAL"} color={eng1Color} />
      <SysSection title="ENG 2" color={C.dim} />
      <SysRow label="N1"     value="84.2" color={C.green} unit="%" />
      <SysRow label="EGT"    value="618"  color={C.green} unit="°C" />
      <SysRow label="FF"     value="2350" color={C.green} unit="KG/H" />
      <SysRow label="STATUS" value="NORMAL" color={C.green} />
      <SwTray title="ENG PANEL" note="FCOM step 2 — MASTER OFF: fuel SOV + oil SOV close, FADEC de-energised">
        <OHPSwitch label="MASTER" sublabel="ENG 1" swState={masterOff ? "off" : "norm"} />
      </SwTray>
      <SwTray title="FIRE PANEL" note="Step 3: FIRE PB pull → HYD/bleed/IDG SOVs + fuel shutoff. Steps 4-5: AGENT 1 → AGENT 2 if fire light persists (30 s each)">
        <OHPSwitch label="FIRE PB" sublabel="ENG 1"  swState={firePbDone ? "off" : fire ? "fire"  : "norm"} />
        <OHPSwitch label="AGENT 1" sublabel="DISCH"  swState={done("agent1") ? "off" : firePbDone ? "armed" : "norm"} />
        <OHPSwitch label="AGENT 2" sublabel="DISCH"  swState={done("agent2") ? "off" : done("agent1") ? "armed" : "norm"} />
      </SwTray>
    </>
  );
}

function HydPage({ state }: { state: ScenarioState }) {
  const done = (id: string) => !!state.completedSteps[id];
  const firePbDone = done("eng1_fire_pb");
  const grnColor = firePbDone ? C.amber : C.green;

  return (
    <>
      <SysSection title="GREEN SYS" color={firePbDone ? C.amber : C.green} />
      <SysRow label="ENG 1 PUMP" value={firePbDone ? "LO PR" : "NORM"} color={grnColor} />
      <SysRow label="PRESSURE"   value={firePbDone ? "LO PR" : "3000"} color={grnColor} unit={firePbDone ? "" : "PSI"} />
      <SysRow label="RESERVOIR"  value="NORM" color={C.green} />
      <SysSection title="BLUE SYS" color={C.green} />
      <SysRow label="ELEC PUMP"  value="AUTO / ON" color={C.green} />
      <SysRow label="PRESSURE"   value="3000" color={C.green} unit="PSI" />
      <SysSection title="YELLOW SYS" color={C.green} />
      <SysRow label="ENG 2 PUMP" value="NORM" color={C.green} />
      <SysRow label="PRESSURE"   value="3000" color={C.green} unit="PSI" />
      <SwTray
        title="HYD PANEL — AFFECTED"
        note="FCOM DSC-29-10: FIRE PB closes green HYD fire SOV → GRN ENG 1 pump shows LO PR (FAULT). Blue ELEC pump auto-activates → maintains brakes, NW steering, spoilers. No crew action required."
      >
        <OHPSwitch label="GRN" sublabel="ENG1 PMP" swState={firePbDone ? "fault" : "norm"} />
        <OHPSwitch label="BLU" sublabel="ELEC PMP" swState="auto" />
      </SwTray>
    </>
  );
}

function ElecPage({ state }: { state: ScenarioState }) {
  const done = (id: string) => !!state.completedSteps[id];
  const firePbDone = done("eng1_fire_pb");
  const gen1Color  = firePbDone ? C.amber : C.green;

  return (
    <>
      <SysSection title="AC NETWORK" color={firePbDone ? C.amber : C.green} />
      <SysRow label="GEN 1"    value={firePbDone ? "FAULT / OFF" : "ON"} color={gen1Color} />
      <SysRow label="GEN 2"    value="ON — NORM" color={C.green} />
      <SysRow label="AC BUS 1" value={firePbDone ? "← GEN 2 (BTC)" : "GEN 1"} color={firePbDone ? C.amber : C.green} />
      <SysRow label="AC BUS 2" value="GEN 2" color={C.green} />
      <SysRow label="BUS TIE"  value={firePbDone ? "CLOSED (AUTO)" : "AUTO"} color={firePbDone ? C.cyan : C.green} />
      <SysSection title="DC NETWORK" color={C.green} />
      <SysRow label="TR 1"     value={firePbDone ? "FAULT" : "NORM"} color={firePbDone ? C.amber : C.green} />
      <SysRow label="TR 2"     value="NORM" color={C.green} />
      <SysRow label="ESS TR"   value={firePbDone ? "AUTO (ALTN)" : "NORM"} color={firePbDone ? C.cyan : C.green} />
      <SysRow label="BAT 1/2"  value="AUTO" color={C.green} />
      <SwTray
        title="ELEC PANEL — AFFECTED"
        note="FCOM DSC-24-10: FIRE PB disconnects IDG 1 → GEN 1 FAULT/OFF. Bus Tie Contactor (sw in AUTO) auto-closes → AC BUS 1 now fed by GEN 2. TR 1 may show FAULT; ESS TR switches to ALTN supply. No crew action required."
      >
        <OHPSwitch label="GEN 1"   sublabel="IDG 1"   swState={firePbDone ? "fault" : "norm"} />
        <OHPSwitch label="BUS TIE" sublabel="CONTCTR" swState="auto" />
      </SwTray>
    </>
  );
}

function AirPage({ state }: { state: ScenarioState }) {
  const done = (id: string) => !!state.completedSteps[id];
  const firePbDone = done("eng1_fire_pb");
  const pk1Color   = firePbDone ? C.amber : C.green;

  return (
    <>
      <SysSection title="BLEED" color={firePbDone ? C.amber : C.green} />
      <SysRow label="ENG 1 BLEED" value={firePbDone ? "FAULT (SOV CL)" : "NORM"} color={pk1Color} />
      <SysRow label="ENG 2 BLEED" value="NORM" color={C.green} />
      <SysRow label="X BLEED"     value="AUTO" color={C.green} />
      <SysRow label="APU BLEED"   value="OFF" color={C.dim} />
      <SysSection title="PACKS" color={firePbDone ? C.amber : C.green} />
      <SysRow label="PACK 1"    value={firePbDone ? "FAULT / OFF" : "AUTO"} color={pk1Color} />
      <SysRow label="PACK 2"    value="AUTO — NORM" color={C.green} />
      <SysRow label="CABIN ΔP"  value="NORM" color={C.green} />
      <SysRow label="DUCT TEMP" value="PACK 2 ONLY" color={firePbDone ? C.cyan : C.green} />
      <SwTray
        title="AIR PANEL — AFFECTED"
        note="FCOM DSC-21-10: FIRE PB closes bleed SOV → ENG 1 BLEED FAULT. PACK 1 loses bleed supply → FAULT/OFF. X BLEED stays AUTO (closed) — PACK 2 uses ENG 2 bleed only (single pack ops). Cabin ΔP maintained by PACK 2."
      >
        <OHPSwitch label="ENG 1"   sublabel="BLEED" swState={firePbDone ? "fault" : "norm"} />
        <OHPSwitch label="PACK 1"  sublabel="FLOW"  swState={firePbDone ? "fault" : "norm"} />
        <OHPSwitch label="X BLEED" sublabel="SEL"   swState="auto" />
      </SwTray>
    </>
  );
}

function NormalPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-2" style={{ minHeight: "80px", padding: "16px" }}>
      <span style={{ color: C.green, fontSize: "11px", letterSpacing: "0.12em", fontFamily: "monospace" }}>— NORMAL —</span>
      <span style={{ color: C.dimLo, fontSize: "9px", letterSpacing: "0.1em", fontFamily: "monospace" }}>ALL SYSTEMS NORM</span>
    </div>
  );
}

const LEGACY_PAGES = ["ENG", "HYD", "ELEC", "AIR"] as const;
type LegacyPage = typeof LEGACY_PAGES[number];

// ─── Main SystemDisplay ───────────────────────────────────────────────────────
export function SystemDisplay({ state, scenario }: { state: ScenarioState; scenario: Scenario }) {
  const tabs = scenario.systemTabs;

  // ── DSL mode ──────────────────────────────────────────────────────────────
  if (tabs && tabs.length > 0) {
    return <DslSystemDisplay state={state} tabs={tabs} />;
  }

  // ── Legacy hardcoded fallback (ENG 1 FIRE) ────────────────────────────────
  return <LegacySystemDisplay state={state} />;
}

function DslSystemDisplay({ state, tabs }: { state: ScenarioState; tabs: readonly SysTabDef[] }) {
  const [selectedTab, setSelectedTab] = useState<string>(tabs[0].id);
  const [manuallySelected, setManuallySelected] = useState(false);

  // Auto-tab switching: check autoSelect conditions unless manually overridden
  useEffect(() => {
    if (manuallySelected) return;
    for (const tab of tabs) {
      if (!tab.autoSelect) continue;
      const t = tab.autoSelect.trigger ? !!state.triggersFired[tab.autoSelect.trigger] : true;
      const s = tab.autoSelect.step    ? !!state.completedSteps[tab.autoSelect.step]   : true;
      if (t && s) {
        setSelectedTab(tab.id);
        return;
      }
    }
  }, [state, tabs, manuallySelected]);

  const activeTab = tabs.find((t) => t.id === selectedTab) ?? tabs[0];

  // Header status: derive from active tab's alertStates
  const anyAlert = tabs.some((t) => evalSysCase(t.alertStates, state));

  function handleTabClick(id: string) {
    setSelectedTab(id);
    setManuallySelected(true);
  }

  return (
    <div
      className="border border-[var(--color-border)] font-mono select-none flex flex-col"
      style={{ backgroundColor: C.bg, flex: "1 1 0", minHeight: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-[5px] border-b" style={{ borderColor: C.border }}>
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.25em" }}>SYS DISPLAY</span>
        <span style={{ color: anyAlert ? C.amber : C.dim, fontSize: "9px", letterSpacing: "0.12em" }}>
          {anyAlert ? "DEGRAD" : "NORM"}
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: C.border }}>
        {tabs.map((tab) => {
          const hasAlert = evalSysCase(tab.alertStates, state);
          const isActive = tab.id === selectedTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className="flex-1 py-[4px] font-mono"
              style={{
                fontSize: "8px",
                letterSpacing: "0.15em",
                color: isActive ? C.white : hasAlert ? C.amber : C.dimLo,
                backgroundColor: isActive ? C.dimLo : "transparent",
                borderRight: `1px solid ${C.border}`,
                transition: "background-color 0.15s",
              }}
            >
              {tab.label}
              {hasAlert && !isActive && (
                <span style={{ color: C.amber, marginLeft: "2px", fontSize: "7px" }}>●</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <DslTabPage tab={activeTab} state={state} />
      </div>
    </div>
  );
}

function LegacySystemDisplay({ state }: { state: ScenarioState }) {
  const auto = activePage(state);
  const defaultTab: LegacyPage = auto === "hyd" ? "HYD" : "ENG";
  const [tab, setTab] = useState<LegacyPage>(defaultTab);

  useEffect(() => {
    if (auto === "hyd") setTab("HYD");
  }, [auto]);

  const done = (id: string) => !!state.completedSteps[id];
  const fire = !!state.triggersFired?.["fire_warn"];

  return (
    <div
      className="border border-[var(--color-border)] font-mono select-none flex flex-col"
      style={{ backgroundColor: C.bg, flex: "1 1 0", minHeight: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-[5px] border-b" style={{ borderColor: C.border }}>
        <span style={{ color: C.dim, fontSize: "9px", letterSpacing: "0.25em" }}>SYS DISPLAY</span>
        <span style={{ color: done("eng1_fire_pb") ? C.amber : C.dim, fontSize: "9px", letterSpacing: "0.12em" }}>
          {!fire ? "NORM" : done("eng1_fire_pb") ? "DEGRAD" : "ENG FIRE"}
        </span>
      </div>

      {/* Page tabs */}
      <div className="flex border-b" style={{ borderColor: C.border }}>
        {LEGACY_PAGES.map((p) => {
          const hasAlert =
            (p === "ENG"  && fire) ||
            (p === "HYD"  && done("eng1_fire_pb")) ||
            (p === "ELEC" && done("eng1_fire_pb")) ||
            (p === "AIR"  && done("eng1_fire_pb"));
          return (
            <button
              key={p}
              type="button"
              onClick={() => setTab(p)}
              className="flex-1 py-[4px] font-mono"
              style={{
                fontSize: "8px",
                letterSpacing: "0.15em",
                color: tab === p ? C.white : hasAlert ? C.amber : C.dimLo,
                backgroundColor: tab === p ? C.dimLo : "transparent",
                borderRight: `1px solid ${C.border}`,
                transition: "background-color 0.15s",
              }}
            >
              {p}
              {hasAlert && tab !== p && (
                <span style={{ color: C.amber, marginLeft: "2px", fontSize: "7px" }}>●</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {!fire ? (
          <NormalPage />
        ) : tab === "ENG" ? (
          <EngPage state={state} />
        ) : tab === "HYD" ? (
          <HydPage state={state} />
        ) : tab === "ELEC" ? (
          <ElecPage state={state} />
        ) : (
          <AirPage state={state} />
        )}
      </div>
    </div>
  );
}
