"use client";

// HUB_TAG: ENG1_FIRE_PANEL_HUB_BASELINE_V1

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { useScenarioRunner } from "@/lib/scenarios/runner";
import type { Scenario, ScenarioDistraction, ScenarioStep, AirportOption } from "@/scenarios/types";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import { ScenarioClock } from "@/components/cockpit/scenario-clock";
import { EwdDisplay } from "@/components/cockpit/ewd-display";
import { phaseEngine } from "@/components/cockpit/ewd-gauges";
import { DecisionPanel } from "@/components/cockpit/decision-panel";
import { PreflightBrief } from "@/components/cockpit/preflight-brief";
import { FireBanner } from "@/components/cockpit/fire-banner";
import { GuidancePanel } from "@/components/cockpit/guidance-panel";
import { AudioController } from "@/components/cockpit/audio-controller";
import { NdCanvas, buildAircraftState, getActivePfActionPhase } from "@/components/cockpit/pfd-nd";
import PfdMockup from "@/components/cockpit/pfd-mockup";
import SvgPfd from "@/components/cockpit/svg-pfd";
import { DistractionModal } from "@/components/cockpit/distraction-modal";
import { ScenarioInspector } from "@/components/dev/scenario-inspector";
import { GlareshieldPanel } from "@/components/cockpit/glareshield-panel";
import { CategoryChips, FlightCheckPopup, PerformerChip, ReferenceChips } from "@/components/cockpit/flight-check-popup";
import { FirePanel } from "@/components/cockpit/fire-panel";
import { SystemDisplay } from "@/components/cockpit/system-display";
import { ContextDisplay } from "@/components/cockpit/context-display";
import { StatusPanel, isStatusReady } from "@/components/cockpit/status-panel";
import { HydSdPage } from "@/components/cockpit/hyd-sd-page";
import { getApplicableRequiredSteps, isStepApplicable } from "@/lib/scenarios/step-applicability";
import { track } from "@/lib/analytics";
import { DescentProfile } from "@/components/cockpit/descent-profile";
import { applyDualHydGYCardOverrides } from "@/scenarios/data/dual-hyd-g-y-card-overrides";

const AUTO_END_DELAY_MS = 3_000;
const DEV_ANN_KEY = "devAnnotations:eng1-fire-v1";
const DEV_SEQ_KEY_PREFIX = "devSeqOrder:";

type DevAnnotation = {
  tag: string;
  note: string;
  fcomRef: string;
};

type DevAnnotations = Record<string, DevAnnotation>;

function reorderBySavedSequence<T extends { id: string }>(items: readonly T[], sequence: readonly string[]): T[] {
  if (!sequence.length) return [...items];

  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const ordered: T[] = [];

  for (const id of sequence) {
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    ordered.push(item);
    seen.add(id);
  }

  for (const item of items) {
    if (seen.has(item.id)) continue;
    ordered.push(item);
  }

  return ordered;
}

function loadSavedSequence(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${DEV_SEQ_KEY_PREFIX}${slug}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

// ── ATC state machine ──────────────────────────────────────────────────────────
// A call can only be permanently dismissed by a CORRECT answer.
// Standby re-surfaces the same call (escalating delay on repeated standby).
// New queued calls are held until the current call is resolved.
type AtcPhase =
  | { kind: "idle" }
  | { kind: "active"; d: ScenarioDistraction }
  | { kind: "standby"; d: ScenarioDistraction; resumesAt: number };

// ── FirePanelContainer ────────────────────────────────────────────────────────
// ── FirePanelContainer ────────────────────────────────────────────────────────
// Renders the full 2D FirePanel (ENGINE DISPLAY + ACTION PANEL + thrust levers).
// FirePanel3D is embedded *inside* FirePanel at the fire_pb control slot —
// only the actual pushbutton cluster is 3D; everything else stays 2D.
// ─────────────────────────────────────────────────────────────────────────────
function FirePanelContainer({
  scenario,
  state,
  perform,
  disabled,
  flashing,
  actionOnly,
}: {
  scenario: import("@/scenarios/types").Scenario;
  state: import("@/engine/state").ScenarioState;
  perform: (a: import("@/engine/events").PilotAction) => void;
  disabled?: boolean;
  flashing?: boolean;
  actionOnly?: boolean;
}) {
  return (
    <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <FirePanel scenario={scenario} state={state} perform={perform} disabled={disabled} flashing={flashing} actionOnly={actionOnly} />
    </div>
  );
}

function DeveloperOverlay({
  scenario,
  currentStepId,
  activeAtcId,
}: {
  scenario: Scenario;
  currentStepId?: string;
  activeAtcId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [annotations, setAnnotations] = useState<DevAnnotations>({});
  const [kind, setKind] = useState<"step" | "distraction" | "trigger" | "phase">("step");
  const [selectedId, setSelectedId] = useState("");
  const [section, setSection] = useState("GENERAL");
  const [fcomRef, setFcomRef] = useState("");
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEV_ANN_KEY);
      setAnnotations(raw ? JSON.parse(raw) : {});
    } catch {
      setAnnotations({});
    }
  }, []);

  const options = useMemo(() => {
    if (kind === "step") return scenario.steps.map((s) => ({ id: s.id, label: s.label }));
    if (kind === "distraction") return (scenario.distractions ?? []).map((d) => ({ id: d.id, label: `${d.from}: ${d.message}` }));
    if (kind === "trigger") return scenario.triggers.map((t) => ({ id: t.id, label: t.description }));
    return (scenario.phases ?? []).map((p) => ({ id: p.id, label: p.label }));
  }, [kind, scenario]);

  useEffect(() => {
    if (!options.length) {
      setSelectedId("");
      return;
    }
    setSelectedId((prev) => (prev && options.some((o) => o.id === prev) ? prev : options[0].id));
  }, [options]);

  const key = selectedId ? `${kind}:${selectedId}` : "";
  const current = key ? annotations[key] : undefined;
  const directionLines = (current?.note ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  function persist(next: DevAnnotations) {
    setAnnotations(next);
    try {
      localStorage.setItem(DEV_ANN_KEY, JSON.stringify(next));
    } catch {
      // no-op
    }
  }

  function saveDirection() {
    const line = text.trim();
    if (!key || !line) return;
    const prev = annotations[key] ?? { tag: "edit_pending", note: "", fcomRef: "" };
    const payload = `[${section}] ${line}`;
    const next: DevAnnotations = {
      ...annotations,
      [key]: {
        tag: "edit_pending",
        note: prev.note ? `${prev.note}\n${payload}` : payload,
        fcomRef: fcomRef.trim() || prev.fcomRef || "",
      },
    };
    persist(next);
    setText("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1000);
  }

  async function copyPayload() {
    const seqRaw = localStorage.getItem("devSeqOrder:eng1-fire-v1");
    const phaseRaw = localStorage.getItem("devPhaseEdits:eng1-fire-v1");
    const payload = {
      annotations,
      sequence: seqRaw ? JSON.parse(seqRaw) : [],
      phaseEdits: phaseRaw ? JSON.parse(phaseRaw) : {},
      scenarioSlug: scenario.meta.slug,
      exportedAt: new Date().toISOString(),
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked; user can still copy from prompt.
      window.prompt("Copy payload", text);
    }
  }

  return (
    <div style={{ borderBottom: "1px solid var(--color-border)", background: "#0A0F18" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ color: "#50FA7B" }}
      >
        {open ? "Close" : "Open"} Developer Directions
      </button>

      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (currentStepId) {
                  setKind("step");
                  setSelectedId(currentStepId);
                }
              }}
              className="px-2 py-1 text-[9px] border border-[#1E2530] hover:border-[#50FA7B]"
            >
              Use Current Step
            </button>
            <button
              onClick={() => {
                if (activeAtcId) {
                  setKind("distraction");
                  setSelectedId(activeAtcId);
                }
              }}
              className="px-2 py-1 text-[9px] border border-[#1E2530] hover:border-[#FFD700]"
            >
              Use Active ATC
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="text-[10px] bg-[#101722] border border-[#1C2530] text-white px-2 py-1">
              <option value="step">Step</option>
              <option value="distraction">ATC</option>
              <option value="trigger">Trigger</option>
              <option value="phase">Phase</option>
            </select>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="text-[10px] bg-[#101722] border border-[#1C2530] text-white px-2 py-1">
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.id}</option>
              ))}
            </select>
          </div>

          <div className="text-[9px] text-[#77839A] border border-[#1C2530] bg-[#101722] px-2 py-1 truncate">
            {options.find((o) => o.id === selectedId)?.label ?? "No item selected"}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Section (PF, PM, PFD/FMA...)"
              className="text-[10px] bg-[#101722] border border-[#1C2530] text-white px-2 py-1"
            />
            <input
              value={fcomRef}
              onChange={(e) => setFcomRef(e.target.value)}
              placeholder="FCOM ref (optional)"
              className="text-[10px] bg-[#101722] border border-[#1C2530] text-white px-2 py-1"
            />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                saveDirection();
                e.preventDefault();
              }
            }}
            rows={3}
            placeholder="Add recommendation while scenario runs..."
            className="text-[11px] bg-[#101722] border border-[#1C2530] text-white px-2 py-1 resize-y"
          />

          <button onClick={saveDirection} className="px-2 py-1.5 text-[10px] font-bold bg-[#50FA7B] text-black hover:bg-[#40EA6B]">
            Save Direction
          </button>
          <button onClick={copyPayload} className="px-2 py-1.5 text-[10px] font-bold border border-[#1C2530] text-[#B9C7D8] hover:border-[#50FA7B]">
            Copy Saved Payload
          </button>
          {saved && <div className="text-[9px] text-[#50FA7B]">Saved</div>}
          {copied && <div className="text-[9px] text-[#50FA7B]">Copied payload</div>}

          {directionLines.length > 0 && (
            <div className="border border-[#1C2530] bg-[#101722] p-2">
              <div className="text-[8px] uppercase tracking-wider text-[#50FA7B] mb-1">Saved Directions ({directionLines.length})</div>
              <div className="max-h-24 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {directionLines.slice(-8).map((line, i) => (
                  <div key={i} className="text-[10px] text-[#B9C7D8] mb-1 break-words">{line}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScenarioRunner({ scenario }: { scenario: Scenario }) {
  const [started, setStarted] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<AirportOption | undefined>(undefined);
  if (!started) {
    return (
      <PreflightBrief
        scenario={scenario}
        onStart={(airport) => {
          track("scenario_started", { slug: scenario.meta.slug });
          setSelectedAirport(airport);
          setStarted(true);
        }}
      />
    );
  }
  return <RunningScenario scenario={scenario} selectedAirport={selectedAirport} />;
}

function RunningScenario({ scenario: baseScenario, selectedAirport }: { scenario: Scenario; selectedAirport?: AirportOption }) {
  const scenario = useMemo<Scenario>(() => {
    const hydratedBase = baseScenario.meta.slug === "dual-hyd-g-y"
      ? { ...baseScenario, steps: applyDualHydGYCardOverrides(baseScenario.steps) }
      : baseScenario;

    const sequence = loadSavedSequence(baseScenario.meta.slug);
    if (!sequence.length) return hydratedBase;

    const orderedSteps = reorderBySavedSequence(hydratedBase.steps, sequence);
    const orderedDistractions = reorderBySavedSequence(hydratedBase.distractions ?? [], sequence);

    return {
      ...hydratedBase,
      steps: orderedSteps,
      distractions: orderedDistractions,
    };
  }, [baseScenario]);

  const router = useRouter();
  const runner = useScenarioRunner(scenario);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoEndAt, setAutoEndAt] = useState<number | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);

  // Dev/admin mode — toggle via ?dev=1 (on) or ?dev=0 (off); persisted in
  // localStorage so the flag follows the user across scenarios + reloads.
  const [isDevMode, setIsDevMode] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  useEffect(() => {
    const urlVal = new URLSearchParams(window.location.search).get("dev");
    if (urlVal === "1") {
      localStorage.setItem("crosscheck:dev", "1");
      setIsDevMode(true);
    } else if (urlVal === "0") {
      localStorage.removeItem("crosscheck:dev");
      setIsDevMode(false);
    } else {
      setIsDevMode(localStorage.getItem("crosscheck:dev") === "1");
    }
  }, []);

  // ── ATC state machine ──────────────────────────────────────────────────────
  const [atcPhase, setAtcPhase] = useState<AtcPhase>({ kind: "idle" });
  const [distractionQueue, setDistractionQueue] = useState<ScenarioDistraction[]>([]);
  const firedDistractionsRef = useRef<Set<string>>(new Set());
  const standbyCountRef = useRef<Map<string, number>>(new Map());
  const atcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live (animated) aircraft altitude, reported by the PFD each frame — used for
  // altitude-gated distractions (e.g. "passing 22 000 ft → descend 10 000").
  const liveAltRef = useRef<number>(35_000);
  const liveSpeedRef = useRef<number>(265);
  // Reactive copy of the live altitude for the DescentProfile (the ref doesn't
  // re-render). Throttled to ~300 ms — CSS transition smooths the gaps.
  // ponytail: throttled state, not per-frame; below-fold viz, churn is fine.
  const [liveAlt, setLiveAlt] = useState<number>(35_000);
  const liveAltTsRef = useRef<number>(0);

  // Fire distractions at their scheduled atMs.  If `requiresStep` is set,
  // the distraction also waits for that step to be marked complete — atMs
  // becomes a minimum delay rather than the fire time.
  useEffect(() => {
    if (runner.status !== "running" || !scenario.distractions) return;
    for (const d of scenario.distractions) {
      if (firedDistractionsRef.current.has(d.id)) continue;
      if (runner.elapsedMs < d.atMs) continue;
      if (d.requiresStep && !runner.state.completedSteps[d.requiresStep]) continue;
      if (d.atAltitudeBelowFt != null && liveAltRef.current > d.atAltitudeBelowFt) continue;
      firedDistractionsRef.current.add(d.id);
      setDistractionQueue((prev) => [...prev, d]);
    }
  }, [runner.elapsedMs, runner.status, runner.state.completedSteps, scenario.distractions]);

  // Altitude-driven step gate: APPROACHING 7 500 ft (descending to the 7 000 hold) completes
  // the hidden `at_hold_7000` step (silent — no card), which unlocks the approach checklist
  // and everything after it [Trainer ALT #3]. Only fires once the briefing is done and the
  // live (animated) altitude has descended to ~7 500.
  const firedHoldGateRef = useRef(false);
  useEffect(() => {
    if (runner.status !== "running" || firedHoldGateRef.current) return;
    if (!scenario.steps.some((s) => s.id === "at_hold_7000")) return;
    if (runner.state.completedSteps["at_hold_7000"]) { firedHoldGateRef.current = true; return; }
    if (!runner.state.completedSteps["approach_brief_ga"]) return;
    if (liveAltRef.current > 7_600) return;
    firedHoldGateRef.current = true;
    runner.perform({ kind: "STEP", stepId: "at_hold_7000" });
  }, [runner.elapsedMs, runner.status, runner.state.completedSteps, scenario.steps]);

  // [user 2026-07-05] At/below ~5 100 ft with the 5 000 descent (P33) done → complete the hidden
  // `at_level_3700` gate, so P35 CONFIGURE FOR APPROACH only happens once LEVEL at 5 000 (ALT).
  const firedLevel3700Ref = useRef(false);
  useEffect(() => {
    if (runner.status !== "running" || firedLevel3700Ref.current) return;
    if (!scenario.steps.some((s) => s.id === "at_level_3700")) return;
    if (runner.state.completedSteps["at_level_3700"]) { firedLevel3700Ref.current = true; return; }
    if (!runner.state.completedSteps["descend_3700"]) return;
    if (liveAltRef.current > 5_100) return;
    firedLevel3700Ref.current = true;
    runner.perform({ kind: "STEP", stepId: "at_level_3700" });
  }, [runner.elapsedMs, runner.status, runner.state.completedSteps, scenario.steps]);

  // [user 2026-07-01] At/below 13 000 ft with the briefing done → complete `at_13000`, so the
  // APPROACH CHECKLIST becomes available AT 13 000 — a window to finish it before the 12 500 decision.
  const fired13000Ref = useRef(false);
  useEffect(() => {
    if (runner.status !== "running" || fired13000Ref.current) return;
    if (!scenario.steps.some((s) => s.id === "at_13000")) return;
    if (runner.state.completedSteps["at_13000"]) { fired13000Ref.current = true; return; }
    if (!runner.state.completedSteps["approach_brief_ga"]) return;
    if (liveAltRef.current > 13_000) return;
    fired13000Ref.current = true;
    runner.perform({ kind: "STEP", stepId: "at_13000" });
  }, [runner.elapsedMs, runner.status, runner.state.completedSteps, scenario.steps]);

  // [user 2026-07-01] TOUCHDOWN — once the landing checklist is done and the live tape reaches the
  // runway (≤ 50 ft), complete `touched_down` so the PFD drops the FD ILS modes and decelerates the
  // speed to 0 (the hand-flown rollout — no autoland ROLL OUT). Altitude-driven, fires once.
  const firedTouchdownRef = useRef(false);
  useEffect(() => {
    if (runner.status !== "running" || firedTouchdownRef.current) return;
    if (!scenario.steps.some((s) => s.id === "touched_down")) return;
    if (runner.state.completedSteps["touched_down"]) { firedTouchdownRef.current = true; return; }
    if (!runner.state.completedSteps["landing_cl_hyd"]) return;
    if (liveAltRef.current > 50) return;
    firedTouchdownRef.current = true;
    runner.perform({ kind: "STEP", stepId: "touched_down" });
  }, [runner.elapsedMs, runner.status, runner.state.completedSteps, scenario.steps]);

  // [user 2026-07-04] FULL STOP — after touchdown, once the live speed has decelerated to ~0 kt on the
  // rollout, complete `full_stop`. This is what gates the REQUEST TAXI / Mumbai-Tower call, so it can
  // NEVER appear while still airborne or rolling. Speed-driven, fires once.
  const firedFullStopRef = useRef(false);
  useEffect(() => {
    if (runner.status !== "running" || firedFullStopRef.current) return;
    if (!scenario.steps.some((s) => s.id === "full_stop")) return;
    if (runner.state.completedSteps["full_stop"]) { firedFullStopRef.current = true; return; }
    if (!runner.state.completedSteps["touched_down"]) return;
    if (liveSpeedRef.current > 5) return;                 // only at the full stop (0 kt)
    firedFullStopRef.current = true;
    runner.perform({ kind: "STEP", stepId: "full_stop" });
  }, [runner.elapsedMs, runner.status, runner.state.completedSteps, scenario.steps]);

  // [Trainer ALT #3 · user 2026-06-30] Vectors-vs-hold decision — a SINGLE SNAPSHOT at 12 500 ft.
  // At the first crossing of 12 500 the runner reads the APPROACH CHECKLIST (`approach_cl_hyd`):
  //   • DONE by 12 500 → `prep_ready` (LONG VECTORS: A14 request → descend 7 000 → at 7 000
  //     ready-for-approach → descend 5 000 + cleared approach);
  //   • NOT done → `prep_late` (HOLD: request hold → descend 7 000 → hold there, finish the
  //     checklist, then approach).
  // Both paths converge on 7 000. Silent, fires once. liveAltRef = the live (animated) tape.
  const firedPrepGateRef = useRef(false);
  useEffect(() => {
    if (runner.status !== "running" || firedPrepGateRef.current) return;
    if (!scenario.steps.some((s) => s.id === "prep_ready")) return;
    if (runner.state.completedSteps["prep_ready"] || runner.state.completedSteps["prep_late"]) { firedPrepGateRef.current = true; return; }
    if (liveAltRef.current > 12_500) return;                           // decision at 12 500
    // [user 2026-07-01 · rule 10 atomic loop] Don't fire the decision — and thus its request card —
    // until the changeover LOOP (check-in → radar continue-descent ack) is complete, so a lower-altitude
    // request never supersedes the running check-in/ack exchange.
    if (scenario.steps.some((s) => s.id === "cont_descent_acked") && !runner.state.completedSteps["cont_descent_acked"]) return;
    firedPrepGateRef.current = true;
    const ready = !!runner.state.completedSteps["approach_cl_hyd"];    // APP CL done?
    runner.perform({ kind: "STEP", stepId: ready ? "prep_ready" : "prep_late" });
  }, [runner.elapsedMs, runner.status, runner.state.completedSteps, scenario.steps]);

  // Cooldown after a correct answer — next queued call waits this long
  const [atcNextAllowedAt, setAtcNextAllowedAt] = useState(0);

  // Promote from queue only when idle AND past the post-answer cooldown
  useEffect(() => {
    if (atcPhase.kind !== "idle" || distractionQueue.length === 0) return;
    // Suppress ATC cards while the HYD action panel is popped (ECAM drill in
    // progress): nothing surfaces from ECAM ACTIONS until all pumps are done.
    const ed = scenario.engineDisplay;
    if (ed?.panel3d === "hyd" && ed.hydMap) {
      const pumpIds = Object.values(ed.hydMap).filter(Boolean) as string[];
      const ecamPanelActive =
        !!runner.state.completedSteps["ecam_actions"] &&
        !pumpIds.every((id) => !!runner.state.completedSteps[id]);
      if (ecamPanelActive) return;
    }
    // The action panel has PRIORITY over ATC: also suppress while the GPWS action panel is popped
    // (approach CONFIG window — APPR PREP 1/2 done → APPR PREP 2/2 not yet). [user 2026-07-06]
    if (ed?.gpwsMap) {
      const gpwsPanelActive =
        !!runner.state.completedSteps["approach_prep_hyd"] &&
        !runner.state.completedSteps["approach_prep_config"];
      if (gpwsPanelActive) return;
    }
    const now = Date.now();
    if (now < atcNextAllowedAt) {
      const delay = atcNextAllowedAt - now;
      const id = setTimeout(() => {
        setDistractionQueue((q) => {
          if (q.length === 0) return q;
          const [next, ...rest] = q;
          setAtcPhase({ kind: "active", d: next });
          return rest;
        });
      }, delay);
      return () => clearTimeout(id);
    }
    const [next, ...rest] = distractionQueue;
    setDistractionQueue(rest);
    setAtcPhase({ kind: "active", d: next });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atcPhase.kind, distractionQueue.length, atcNextAllowedAt, runner.state.completedSteps]);

  // Cleanup ATC timer when scenario ends
  useEffect(() => {
    if (runner.status === "ended" && atcTimerRef.current) {
      clearTimeout(atcTimerRef.current);
    }
  }, [runner.status]);

  const handleAtcRespond = useCallback(
    (choiceId: string, correct: boolean) => {
      if (atcPhase.kind !== "active") return;
      void choiceId;
      const d = atcPhase.d;
      if (correct) {
        // Correct → permanently dismiss. Gap before next call is per-card:
        // 1 s for the opening MAYDAY exchange, 15 s default for the rest.
        standbyCountRef.current.delete(d.id);
        setAtcPhase({ kind: "idle" });
        setAtcNextAllowedAt(Date.now() + (d.gapAfterMs ?? 5_000));
        // If the distraction declares a step (e.g. PM MAYDAY card completing
        // mayday_atc), complete it now so downstream gates fire correctly.
        if (d.completesStep) {
          runner.perform({ kind: "STEP", stepId: d.completesStep });
        }
      } else {
        // Wrong → short re-surface (8 s)
        const count = (standbyCountRef.current.get(d.id) ?? 0) + 1;
        standbyCountRef.current.set(d.id, count);
        const delay = 8_000;
        const resumesAt = Date.now() + delay;
        setAtcPhase({ kind: "standby", d, resumesAt });
        if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
        atcTimerRef.current = setTimeout(() => setAtcPhase({ kind: "active", d }), delay);
      }
    },
    [atcPhase],
  );

  // Lets the pilot manually re-open the response choices from standby
  const handleAtcManualActivate = useCallback(() => {
    if (atcPhase.kind !== "standby") return;
    if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
    setAtcPhase({ kind: "active", d: atcPhase.d });
  }, [atcPhase]);

  const handleAtcStandby = useCallback(() => {
    if (atcPhase.kind !== "active") return;
    const d = atcPhase.d;
    const count = (standbyCountRef.current.get(d.id) ?? 0) + 1;
    standbyCountRef.current.set(d.id, count);
    if (d.standbyResurfaceOnStep) {
      // Step-gated standby — no timer; resurface useEffect watches for the step
      const resumesAt = Date.now() + 999_999;
      setAtcPhase({ kind: "standby", d, resumesAt });
      if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
      return;
    }
    // Escalating delay: 20 s → 12 s → 6 s → 3 s (persistent pressure)
    const delay = count === 1 ? 20_000 : count === 2 ? 12_000 : count <= 4 ? 6_000 : 3_000;
    const resumesAt = Date.now() + delay;
    setAtcPhase({ kind: "standby", d, resumesAt });
    if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
    atcTimerRef.current = setTimeout(() => setAtcPhase({ kind: "active", d }), delay);
  }, [atcPhase]);

  // When a distraction was stood-by with standbyResurfaceOnStep, resurface it
  // as soon as the named step completes — no fixed timer involved.
  useEffect(() => {
    if (atcPhase.kind !== "standby") return;
    const d = atcPhase.d;
    if (!d.standbyResurfaceOnStep) return;
    if (!runner.state.completedSteps[d.standbyResurfaceOnStep]) return;
    if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
    setAtcPhase({ kind: "active", d });
  }, [atcPhase, runner.state.completedSteps]);

  // ── Crew-action popup gap (2 s between steps) ──────────────────────────────
  const popupGapUntilRef = useRef(0);
  const [, bumpPopupRevision] = useReducer((n: number) => n + 1, 0);

  const performWithGap = useCallback(
    (action: PilotAction) => {
      runner.perform(action);
      if (action.kind === "STEP") {
        popupGapUntilRef.current = Date.now() + 1_000;
        setTimeout(bumpPopupRevision, 1_100);
      }
    },
    [runner],
  );

  const popupReady = Date.now() >= popupGapUntilRef.current;

  // Hardware step that is currently actionable — confirmed via left-panel controls
  const nextHardwareStep = useMemo(() => {
    if (runner.status !== "running") return null;
    return (
      scenario.steps.find(
        (s) =>
          !s.optional &&
          s.hardware &&
          !runner.state.completedSteps[s.id] &&
          (!s.requiresTrigger || !!runner.state.triggersFired[s.requiresTrigger]) &&
          (s.requires ?? []).every((r) => !!runner.state.completedSteps[r]),
      ) ?? null
    );
  }, [runner.state.completedSteps, runner.state.triggersFired, runner.status, scenario.steps]);

  // Next non-hardware step — if null while hardware step exists, right panel shows attention card
  const nextSoftwareStep = useMemo(() => {
    if (runner.status !== "running") return null;
    return (
      scenario.steps.find(
        (s) =>
          !s.optional &&
          !s.hardware &&
          !runner.state.completedSteps[s.id] &&
          (!s.requiresTrigger || !!runner.state.triggersFired[s.requiresTrigger]) &&
          (s.requires ?? []).every((r) => !!runner.state.completedSteps[r]),
      ) ?? null
    );
  }, [runner.state.completedSteps, runner.state.triggersFired, runner.status, scenario.steps]);

  // ── Training-mode guidance: flash the surface of the SINGLE primary next step ──
  const [trainingGuide, setTrainingGuide] = useState(true);
  const primaryNextStep = useMemo(() => {
    if (runner.status !== "running") return null;
    return (
      scenario.steps.find(
        (s) =>
          !s.optional &&
          !runner.state.completedSteps[s.id] &&
          (!s.requiresTrigger || !!runner.state.triggersFired[s.requiresTrigger]) &&
          (s.requires ?? []).every((r) => !!runner.state.completedSteps[r]),
      ) ?? null
    );
  }, [runner.state.completedSteps, runner.state.triggersFired, runner.status, scenario.steps]);
  // Which surface should flash (null = none). comms→ATC, hardware→action panel, glareshield→glareshield.
  const pfActionSteps = useMemo(
    () => new Set((scenario.phases ?? []).map((p) => p.pfAction?.stepId).filter((x): x is string => !!x)),
    [scenario.phases],
  );
  // ATC/COMMS flashes the whole time a call is active — no auto-collapse (stays on until answered).
  const commsCallFlash = trainingGuide && atcPhase.kind === "active";
  // Each panel flashes distinctly: PFD / ND / ECAM(+fire) / fire / glareshield / comms(ATC) / procedure.
  // An explicit step.flashSurface wins (drives the AVIATE→NAVIGATE→COMMUNICATE→ACTIONS sequence);
  // otherwise fall back to pfAction/group/hardware.
  const baseFlash =
    !trainingGuide || !primaryNextStep
      ? null
      : primaryNextStep.flashSurface
        ? primaryNextStep.flashSurface
        : pfActionSteps.has(primaryNextStep.id)
          ? "pfd"
          : primaryNextStep.group === "glareshield"
            ? "glareshield"
            : primaryNextStep.group === "comms"
              ? "comms"
              : primaryNextStep.hardware
                ? "firepanel"
                : "procedure";
  const ecamCommanded = !!runner.state.completedSteps["ecam_actions"];
  // SET of surfaces that pulse for the current step — the "next action" pointer.
  // Exactly ONE surface pulses (the next thing to read/press/review) so the pilot's
  // eye lands on it across the 4-6 screens. This pointer PERSISTS for the whole
  // scenario (it is NOT switched off after ECAM ACTIONS — the trainee always needs
  // to see what's next). Special case: COMMUNICATE (declare_mayday) PFD + ND.
  let activeFlashes: string[] =
    !trainingGuide || !primaryNextStep
      ? []
      : primaryNextStep.id === "start_descent"
        ? ["pfd", "nd"]                          // descent card (after MAYDAY): PFD + ND both pulse
        : baseFlash
          ? [baseFlash]
          : [];
  // ATC priority: while a call is pending, DON'T flash the procedure section.
  if (commsCallFlash) activeFlashes = activeFlashes.filter((s) => s !== "procedure");
  const commsFlashOn = commsCallFlash;
  const flashes = new Set(activeFlashes);
  const FLASH_ANIM = "ccPulse 1.7s ease-in-out infinite";
  // Severity colour for the MASTER WARN/CAUT (glareshield) + ECAM flash: RED for a
  // warning, AMBER for a caution — matches the real warning lights, far more legible
  // than guidance-blue. Source: the next step's variant, else the live master light,
  // else the scenario's warning condition (a red warning persists after the light is
  // cancelled — the situation is still a warning).
  const warnSituation = !!(scenario.engineDisplay?.warningTrigger && runner.state.triggersFired[scenario.engineDisplay.warningTrigger]);
  const sevRgb = () =>
    primaryNextStep?.variant === "warning" ? "255,51,51"
      : primaryNextStep?.variant === "caution" ? "255,179,0"
        : runner.state.masterWarnActive ? "255,51,51"
          : runner.state.masterCautActive ? "255,179,0"
            : warnSituation ? "255,51,51"
              : "57,129,246";
  // Per-surface accent (RGB triplet, consumed as rgba(var(--cc-fc),a)). Glareshield +
  // ECAM carry the severity colour; comms = cyan; other instruments = guidance blue.
  const flashRgb = (key: string) =>
    key === "comms" ? "0,207,255"
      : key === "glareshield" || key === "firepanel" ? sevRgb()
        : "57,129,246";
  // Overlay flash — sits ON TOP of opaque panel content (PFD / ND / glareshield / ECAM,
  // all black inside). These INSTRUMENT panels use the INSET glow (ccLift) — the glow
  // lights the black interior from the edges inward. (The comms/procedure CARDS use the
  // OUTER bloom ccGlowOut instead — see their components.)
  const flashOverlay = (key: string) =>
    flashes.has(key) ? (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, borderRadius: "6px", animation: `${key === "glareshield" ? "ccLiftEdge" : "ccLift"} 1.5s ease-in-out infinite`, "--cc-fc": flashRgb(key) } as CSSProperties} />
    ) : null;
  // White-column card highlight (comms + procedure): the deep ring + breathing lift
  // (ccLift) is applied ON THE CARD itself — see the `flashing` prop on DistractionModal /
  // FlightCheckPopup — so it hugs the card instead of ringing the whole panel.
  const commsCardFlash = flashes.has("comms") || commsFlashOn;
  // The procedure card flashes whenever it's presenting a CONFIRM (guide on). The
  // CONFIRM is the only thing that advances the scenario, so it ALWAYS needs to flash —
  // independent of which instrument surface the step also points to (e.g. AVIATE points
  // to the PFD, but its confirm card must still flash). The card itself gates out the
  // "READING…" phase (see flashNow in FlightCheckPopup).
  const procCardFlash = trainingGuide;
  // On-screen guidance word (AVIATE / NAVIGATE / DESCENT) over the flashing PFD/ND.
  // Per-surface guidance word. DESCENT card splits: PFD = "DESCENT", ND = "OFFSET 2 NM R".
  const flashMsgFor = (key: string): string | undefined => {
    if (!trainingGuide || !primaryNextStep) return undefined;
    if (primaryNextStep.id === "start_descent") return key === "nd" ? "OFFSET 2 NM R" : "DESCENT";
    return primaryNextStep.flashMsg;
  };
  const flashLabel = (key: string) => {
    const msg = flashMsgFor(key);
    return flashes.has(key) && msg ? (
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 51, pointerEvents: "none", background: "rgba(57,129,246,0.92)", color: "#fff", fontFamily: "monospace", fontWeight: 700, fontSize: "12px", letterSpacing: "0.16em", padding: "3px 12px", borderRadius: "4px", whiteSpace: "nowrap", animation: "ccGuideMsg 1.25s ease-in-out infinite" }}>
        {msg}
      </div>
    ) : null;
  };

  // Auto-open decision drawer when it first unlocks (agent1 completed)
  const agent1Done = !!runner.state.completedSteps["agent1"];
  useEffect(() => {
    if (agent1Done) setDecisionOpen(true);
  }, [agent1Done]);

  // ── Auto-end after decision ────────────────────────────────────────────────
  const decisionKey = runner.state.decision?.tMs ?? null;
  useEffect(() => {
    if (decisionKey == null || autoEndAt != null || submitting) return;
    track("decision_committed", { slug: scenario.meta.slug });
    setAutoEndAt(Date.now() + AUTO_END_DELAY_MS);
    const id = setTimeout(() => submit(), AUTO_END_DELAY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionKey]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    runner.end();
    track("scenario_completed", { slug: scenario.meta.slug, events: runner.events.length });
    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioSlug: scenario.meta.slug,
          startedAt: Date.now() - runner.elapsedMs,
          endedAt: Date.now(),
          events: runner.events,
          finalState: runner.state,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not submit session");
      }
      const { debriefId } = (await res.json()) as { debriefId: string };
      router.push(`/debrief/${debriefId}`);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [router, runner, scenario.meta.slug]);

  const remaining = autoEndAt != null ? Math.max(0, autoEndAt - Date.now()) : null;

  // dual-hyd: derive live phase-thrust + SAT/TAT from the governor (computed once, reused).
  const liveAc = scenario.meta.slug === "dual-hyd-g-y"
    ? buildAircraftState(runner.state, scenario, runner.elapsedMs, liveAltRef.current) : null;
  const liveEng = liveAc ? phaseEngine(liveAc.vertMode, liveAltRef.current, liveAc.altitude) : undefined;
  // Mumbai descent: SAT 32°C at sea level → −44°C at FL350 (ISA+10); TAT = SAT + ram rise (TAS²/7592).
  const liveSat = liveAc ? Math.round(32 - liveAltRef.current * (76 / 35000)) : undefined;
  const liveTat = liveAc ? Math.round(liveSat! + (liveAc.tas ?? 0) ** 2 / 7592) : undefined;

  return (
    <main className="flex flex-col">

      {/* ── DEV — Scenario Inspector overlay (?dev=1 → 🔍 Inspector button). Opens
             on the current live step; browse all steps + the full structure at each. ── */}
      {isDevMode && inspectorOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(4,7,11,0.6)" }}>
          <div style={{ position: "absolute", inset: "3vh 3vw", border: "1px solid #1C2530", borderRadius: 10, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
            <ScenarioInspector
              scenario={scenario}
              initialStepId={primaryNextStep?.id ?? nextHardwareStep?.id ?? nextSoftwareStep?.id}
              onClose={() => setInspectorOpen(false)}
              onSeek={(stepIds) => {
                const set = new Set(stepIds);
                const triggers = ["structural_fail", ...scenario.steps
                  .filter((s) => set.has(s.id) && s.afterEffect?.triggerId)
                  .map((s) => s.afterEffect!.triggerId)];
                runner.seekToCheckpoint(stepIds, triggers);
                setInspectorOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* ── ABOVE FOLD — fills one full viewport; no scroll needed ── */}
      <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      <FireBanner state={runner.state} />
      <AudioController active={runner.state.masterWarnActive} cautActive={runner.state.masterCautActive} />
      <ScenarioClock elapsedMs={runner.elapsedMs} state={runner.state} scenario={scenario} />

      <style>{`
        @keyframes ccPulse{
          0%,100%{box-shadow:inset 0 0 0 1px rgba(var(--cc-fc,57,129,246),.30), 0 0 0 0 rgba(var(--cc-fc,57,129,246),0)}
          50%{box-shadow:inset 0 0 0 1px rgba(var(--cc-fc,57,129,246),.92), 0 0 16px 1px rgba(var(--cc-fc,57,129,246),.5)}
        }
        /* ccLift — the highlight for elements that sit on a BLACK inside (comms /
           procedure cards, glareshield, ECAM, pop-out). The glow is INSET: it lights
           the black interior from the edges INWARD (not an outer bloom into the white
           surroundings). Bright ring at the very edge + an inward glow; colour via --cc-fc. */
        @keyframes ccLift{
          0%,100%{box-shadow:
            inset 0 0 0 1px rgba(var(--cc-fc,57,129,246),.5),
            inset 0 0 10px 1px rgba(var(--cc-fc,57,129,246),.18)}
          50%{box-shadow:
            inset 0 0 0 2px rgba(var(--cc-fc,57,129,246),1),
            inset 0 0 26px 4px rgba(var(--cc-fc,57,129,246),.5)}
        }
        /* ccLiftEdge — SHALLOW inset glow for SMALL panels (master warn/caut): the glow
           hugs the edges and doesn't reach far into the interior (the deep ccLift reach
           swallows a small panel). Same bright edge ring, much shorter inward bloom. */
        @keyframes ccLiftEdge{
          0%,100%{box-shadow:
            inset 0 0 0 1px rgba(var(--cc-fc,57,129,246),.5),
            inset 0 0 5px 0 rgba(var(--cc-fc,57,129,246),.2)}
          50%{box-shadow:
            inset 0 0 0 2px rgba(var(--cc-fc,57,129,246),1),
            inset 0 0 11px 1px rgba(var(--cc-fc,57,129,246),.55)}
        }
        /* ccGlowOut — OUTER bloom, for the comms/procedure CARDS: the glow blooms
           outward around the card in its black well (the card reads as a lifted object).
           Instruments use the inset ccLift instead. */
        @keyframes ccGlowOut{
          0%,100%{box-shadow:
            inset 0 0 0 1px rgba(var(--cc-fc,57,129,246),.45),
            0 0 0 0 rgba(var(--cc-fc,57,129,246),0)}
          50%{box-shadow:
            inset 0 0 0 2px rgba(var(--cc-fc,57,129,246),1),
            0 0 22px 3px rgba(var(--cc-fc,57,129,246),.6)}
        }
        @keyframes ccGuideMsg{0%,100%{opacity:.6}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){
          [style*="ccPulse"]{animation:none !important;box-shadow:inset 0 0 0 1px rgba(var(--cc-fc,57,129,246),.85), 0 0 14px 1px rgba(var(--cc-fc,57,129,246),.45) !important}
          [style*="ccLift"]{animation:none !important;box-shadow:inset 0 0 0 2px rgba(var(--cc-fc,57,129,246),1), inset 0 0 24px 3px rgba(var(--cc-fc,57,129,246),.5) !important}
          [style*="ccLiftEdge"]{animation:none !important;box-shadow:inset 0 0 0 2px rgba(var(--cc-fc,57,129,246),1), inset 0 0 10px 1px rgba(var(--cc-fc,57,129,246),.5) !important}
          [style*="ccGlowOut"]{animation:none !important;box-shadow:inset 0 0 0 2px rgba(var(--cc-fc,57,129,246),1), 0 0 20px 3px rgba(var(--cc-fc,57,129,246),.55) !important}
          [style*="ccGuideMsg"]{animation:none !important;opacity:1 !important}
        }
      `}</style>
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT PANEL — 6 equal cockpit screens in a 3×2 grid ──────────── */}
        <div
          style={{ flex: "0 0 68%", borderRight: "1px solid var(--color-border)", overflow: "hidden", display: "flex", flexDirection: "column" }}
        >
          {/* Glareshield — compact strip across the top */}
          <div style={{ flexShrink: 0, padding: "8px 10px 0", position: "relative" }}>
            <GlareshieldPanel
              scenario={scenario}
              state={runner.state}
              perform={runner.perform}
              disabled={runner.status !== "running"}
            />
            {flashOverlay("glareshield")}
          </div>

          {/* row1: PFD · ND · ACTION  |  row2: E/WD · STATUS · SD — all same size */}
          <div style={{ flex: "1 1 0", minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "1fr 1fr", gap: "8px", padding: "8px 10px" }}>

            {/* PFD */}
            <div style={{ minWidth: 0, minHeight: 0, border: "1px solid var(--color-border)", backgroundColor: "#000", overflow: "hidden", position: "relative" }}>
              {flashOverlay("pfd")}
              {flashLabel("pfd")}
              {scenario.meta.slug === "dual-hyd-g-y" ? (
                <SvgPfd
                  state={runner.state}
                  scenario={scenario}
                  elapsedMs={runner.elapsedMs}
                  paused={runner.paused}
                  onAltitude={(ft) => { liveAltRef.current = ft; const now = Date.now(); if (now - liveAltTsRef.current > 300) { liveAltTsRef.current = now; setLiveAlt(ft); } }}
                  onSpeed={(kt) => { liveSpeedRef.current = kt; }}
                />
              ) : (
                <PfdMockup
                  state={runner.state}
                  scenario={scenario}
                  elapsedMs={runner.elapsedMs}
                  paused={runner.paused}
                  onAltitude={(ft) => { liveAltRef.current = ft; }}
                  onPfAction={(phaseId) => {
                    const phase = scenario.phases?.find(p => p.id === phaseId);
                    if (phase?.pfAction?.stepId) {
                      runner.perform({ kind: "STEP", stepId: phase.pfAction.stepId });
                    }
                  }}
                />
              )}
              {isDevMode && runner.paused && (
                <div style={{
                  position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)",
                  background: "rgba(255,215,0,0.15)", border: "1px solid #FFD700",
                  color: "#FFD700", fontSize: "10px", fontFamily: "monospace",
                  fontWeight: 700, letterSpacing: "0.12em", padding: "2px 10px",
                  borderRadius: "3px", pointerEvents: "none",
                }}>
                  ⏸ PAUSED
                </div>
              )}
            </div>

            {/* ND */}
            <div style={{ minWidth: 0, minHeight: 0, border: "1px solid var(--color-border)", backgroundColor: "#000", overflow: "hidden", position: "relative" }}>
              <NdCanvas state={runner.state} scenario={scenario} elapsedMs={runner.elapsedMs} paused={runner.paused} />
              {flashOverlay("nd")}
              {flashLabel("nd")}
            </div>

            {/* ACTION PANEL — engine display removed (the E/WD shows it) */}
            <div style={{ minWidth: 0, minHeight: 0, border: "1px solid var(--color-border)", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
              <FirePanelContainer
                scenario={scenario}
                state={runner.state}
                perform={runner.perform}
                disabled={runner.status !== "running"}
                flashing={flashes.has("firepanel")}
                actionOnly
              />
            </div>

            {/* E/WD (engine/warning display) — dual-hyd drives idle/level/cruise/climb/approach
                thrust from the live PFD phase (reuses buildAircraftState). [user 2026-07-05] */}
            <div style={{ minWidth: 0, minHeight: 0, border: "1px solid var(--color-border)", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
              <EwdDisplay state={runner.state} scenario={scenario} live={liveEng} />
              {flashOverlay("firepanel")}
              {trainingGuide && primaryNextStep?.id === "ecam_actions" && !ecamCommanded && (
                <button
                  type="button"
                  onClick={() => runner.perform({ kind: "STEP", stepId: "ecam_actions" })}
                  title="Press ECAM — command ECAM ACTIONS"
                  style={{ position: "absolute", inset: 0, zIndex: 52, cursor: "pointer", background: "transparent", border: "none", borderRadius: "4px" }}
                />
              )}
            </div>

            {/* SD lower page — the affected-system synoptic pops on failure and holds
                until the crew announces STATUS (FCOM: synoptic → STATUS is the last page).
                HYD synoptic is G+Y-specific; other scenarios show STATUS only, as before. */}
            <div style={{ minWidth: 0, minHeight: 0, border: "1px solid var(--color-border)", backgroundColor: "#000", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
              {scenario.meta.slug === "dual-hyd-g-y" && runner.state.completedSteps["crew_crosscheck"]
                ? null   /* STATUS reviewed + ECAM ACTIONS COMPLETED → SD reverts to clear (blank) [user 2026-07-06] */
                : scenario.meta.slug === "dual-hyd-g-y" && runner.state.triggersFired["structural_fail"] && !isStatusReady(scenario, runner.state)
                  ? <HydSdPage />   /* synoptic pops ONLY after the failure fires, holds until STATUS [user 2026-07-06] */
                  : <StatusPanel scenario={scenario} state={runner.state} sat={liveSat} tat={liveTat} />}
            </div>

            {/* SD — SYSTEM / QRH / GRAPHIC / INFO */}
            <div style={{ minWidth: 0, minHeight: 0, border: "1px solid var(--color-border)", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
              {(isDevMode || scenario.qrhSummary) ? (
                <ContextDisplay state={runner.state} scenario={scenario} activeStep={primaryNextStep} />
              ) : (
                <SystemDisplay state={runner.state} scenario={scenario} />
              )}
              {trainingGuide && primaryNextStep?.id === "ecam_actions" && !ecamCommanded && (
                <button
                  type="button"
                  onClick={() => runner.perform({ kind: "STEP", stepId: "ecam_actions" })}
                  title="Press ECAM — command ECAM ACTIONS"
                  style={{ position: "absolute", inset: 0, zIndex: 52, cursor: "pointer", background: "transparent", border: "none", borderRadius: "4px", animation: FLASH_ANIM }}
                />
              )}
            </div>

          </div>
        </div>

        {/* ── RIGHT PANEL — 30% — action window ───────────────────────── */}
        <div
          className="flex flex-col"
          style={{
            flex: "0 0 30%", minWidth: "300px",
            // WHITE canvas for the action window. The comms / procedure / idle
            // cards stay self-contained dark (cockpit ECAM look, Airbus colours);
            // only the column behind them is white. The chrome tokens below are
            // retuned to DARK INK so the section headers (◈ ACTION PANEL, ▸ COMMS,
            // ▸ PROCEDURE) and dividers stay readable on white. The dark cards get
            // a lighter drop-shadow (in their own components) so they float clean
            // on white instead of casting a muddy black halo.
            background: "#FFFFFF",
            "--color-surface": "#F7F8FA",
            "--color-surface-2": "#EEF0F3",
            "--color-border": "#E6E8EB",
            "--color-text": "#1A1D23",
            "--color-text-muted": "#5B616A",
            "--color-text-faint": "#8A909A",
          } as CSSProperties}
        >
          {/* No panel title — the right 30% column IS comms + procedure (no "ACTION
              PANEL" label; that name clashes with the engine-display action panel).
              The GUIDE / PAUSE controls live in the COMMS header below. */}

          {/* ── COMMS SECTION — now the top of the column ── */}
          <div
            className="shrink-0 flex flex-col"
            style={{ borderBottom: "1px solid var(--color-border)", height: "420px", position: "relative" }}
          >
            <div
              className="px-4 py-1.5 shrink-0 flex items-center justify-between gap-2"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] font-bold" style={{ color: "var(--color-text)" }}>
                ▸ COMMS
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTrainingGuide((v) => !v)}
                  title="Training guidance — flash the next action's surface"
                  style={{
                    fontFamily: "monospace", fontSize: "8px", letterSpacing: "0.12em",
                    padding: "2px 6px", borderRadius: "3px", border: "1px solid var(--color-border)",
                    color: trainingGuide ? "#1f6fe0" : "var(--color-text-muted)",
                    background: trainingGuide ? "rgba(31,111,224,0.10)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  ✦ GUIDE {trainingGuide ? "ON" : "OFF"}
                </button>
                <button
                  onClick={() => (runner.paused ? runner.resume() : runner.pause())}
                  className="px-2 py-0.5 border border-[var(--color-border)] text-[9px] uppercase tracking-wider"
                  style={{ color: runner.paused ? "#1f8a4c" : "#9A6B00" }}
                >
                  {runner.paused ? "Resume" : "Pause"}
                </button>
                {isDevMode && (
                  <button
                    onClick={() => setInspectorOpen(true)}
                    className="px-2 py-0.5 border border-[var(--color-border)] text-[9px] uppercase tracking-wider hover:border-[#1f8a4c]"
                    style={{ color: "#1f8a4c" }}
                  >
                    🔍 Inspector
                  </button>
                )}
                {runner.paused && <span className="font-mono text-[8px] uppercase tracking-[0.15em]" style={{ color: "#9A6B00" }}>PAUSED</span>}
                {distractionQueue.length > 0 && (
                  <span className="font-mono text-[8px] uppercase tracking-[0.15em]" style={{ color: "var(--color-amber)" }}>
                    {distractionQueue.length} QUEUED
                  </span>
                )}
                {/* A{N} tag — only in ?dev=1 mode, shows which ATC call is active */}
                {isDevMode && (() => {
                  const activeD = atcPhase.kind === "active" ? atcPhase.d : atcPhase.kind === "standby" ? atcPhase.d : null;
                  if (!activeD || !scenario.distractions) return null;
                  const idx = scenario.distractions.findIndex(d => d.id === activeD.id);
                  if (idx < 0) return null;
                  return (
                    <span style={{ padding: "2px 8px", backgroundColor: "#FFEB3B", color: "#000", fontSize: "12px", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.05em", borderRadius: "3px" }}>A{idx + 1}</span>
                  );
                })()}
              </div>
            </div>
            {/* Inner scroll container — BLACK well so the card's bright flash pops.
                (Header stays white; only the content area below it is black.) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-2 pb-4" style={{ background: "#04070C" }}>
              {atcPhase.kind === "active" ? (
                <DistractionModal
                  distraction={atcPhase.d}
                  onRespond={handleAtcRespond}
                  onStandby={handleAtcStandby}
                  liveAltFt={liveAltRef.current}
                  noAutoDismiss={scenario.meta.slug === "dual-hyd-g-y"}
                  flashing={commsCardFlash}
                  inline
                />
              ) : atcPhase.kind === "standby" ? (
                <AtcStandbyCard
                  d={atcPhase.d}
                  resumesAt={atcPhase.resumesAt}
                  onRespond={handleAtcManualActivate}
                />
              ) : (
                <CommsClearCard />
              )}
            </div>
          </div>

          {/* ── PROCEDURE SECTION — stable reserved space, never shifts ── */}
          <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: "180px" }}>
            {/* Header */}
            <div
              className="px-4 py-1.5 shrink-0 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] font-bold" style={{ color: "var(--color-text)" }}>
                ▸ PROCEDURE
              </span>
              {/* P{N} tag — only in ?dev=1 mode, shows which procedure step is active */}
              {isDevMode && nextSoftwareStep && (() => {
                const swSteps = scenario.steps.filter(s => !s.hardware && !s.optional);
                const idx = swSteps.findIndex(s => s.id === nextSoftwareStep.id);
                if (idx < 0) return null;
                return (
                  <span style={{
                    padding: "2px 8px",
                    backgroundColor: "#FFEB3B",
                    color: "#000",
                    fontSize: "12px",
                    fontWeight: 800,
                    fontFamily: "monospace",
                    letterSpacing: "0.05em",
                    borderRadius: "3px",
                  }}>P{idx + 1}</span>
                );
              })()}
            </div>
            {/* Body — single active step card; BLACK well so the card's bright flash pops.
                (Header stays white; only the content area below it is black.) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-2 pb-4" style={{ background: "#04070C" }}>
              {atcPhase.kind === "active" ? (
                // No procedure card while a radio call is in progress (ATC-comms rule).
                <div className="flex items-center justify-center text-center px-4" style={{ minHeight: "120px" }}>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-faint)]">— radio in progress · procedure paused —</span>
                </div>
              ) : runner.status === "running" && !popupReady ? (
                <ActionGapCard />
              ) : runner.status === "running" && nextSoftwareStep ? (
                <FlightCheckPopup
                  scenario={scenario}
                  state={runner.state}
                  perform={performWithGap}
                  disabled={runner.status !== "running"}
                  flashing={procCardFlash}
                  inline
                />
              ) : (
                <ProcedureIdleCard nextHardwareStep={nextHardwareStep} />
              )}
            </div>
          </div>

        </div>
      </div>
      </div>{/* end above-fold */}

      {/* ── BELOW FOLD — scroll down to see procedure progress, decision, controls ── */}
      <div style={{ display: "flex", borderTop: "2px solid var(--color-border)", minHeight: "70vh" }}>

        {/* Left 68%: Full procedure progress tracker */}
        <div style={{ flex: "0 0 68%", borderRight: "1px solid var(--color-border)", padding: "16px 12px" }}>
          {scenario.meta.slug === "dual-hyd-g-y" && (() => {
            const req = getApplicableRequiredSteps(scenario, runner.state);
            const done = req.filter((s) => runner.state.completedSteps[s.id]).length;
            return (
              <div style={{ marginBottom: 14 }}>
                <DescentProfile progress={req.length ? done / req.length : 0} currentStepId={primaryNextStep?.id} liveAlt={liveAlt} />
              </div>
            );
          })()}
          <ScenarioProgress scenario={scenario} state={runner.state} />
        </div>

        {/* Right 32%: Decision → Guidance → Submit controls */}
        <div className="flex flex-col bg-[var(--color-surface)]" style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "12px", padding: "16px 12px" }}>

          {/* Decision — unlocks after AGENT 1 step */}
          {agent1Done && !runner.state.decision && runner.status === "running" && (
            <>
              <div
                className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]"
                style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "6px" }}
              >
                ▸ DECISION
              </div>
              <DecisionPanel
                scenario={scenario}
                state={runner.state}
                perform={runner.perform}
                disabled={runner.status !== "running"}
              />
            </>
          )}

          {/* Guidance — shown after decision committed */}
          {runner.state.decision && (
            <GuidancePanel scenario={scenario} state={runner.state} />
          )}

          {/* Auto-finalizing banner */}
          {autoEndAt != null && (
            <div
              className="flex items-center justify-between px-3 py-2 border"
              style={{ borderColor: "var(--color-brand)", backgroundColor: "var(--color-brand-soft)" }}
            >
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-brand)]">AUTO-FINALIZING</div>
                <div className="font-sans text-xs text-[var(--color-text)] mt-0.5">
                  Submitting in {Math.ceil((remaining ?? 0) / 1000)}s
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoEndAt(Number.MAX_SAFE_INTEGER)}
                className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* End & Score */}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || runner.status !== "running"}
            className="h-10 bg-[var(--color-brand)] text-[var(--color-bg)] font-mono text-[10px] uppercase tracking-[0.15em] rounded-sm hover:bg-[var(--color-brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Scoring…" : "End & Score"}
          </button>

          {error && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-red)]">{error}</p>
          )}

          {/* Event Log */}
          <details className="border border-[var(--color-border)]">
            <summary className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] cursor-pointer px-3 py-2 hover:text-[var(--color-text)]">
              EVENT LOG ({runner.events.length})
            </summary>
            <ol className="flex flex-col gap-1 max-h-60 overflow-y-auto p-3">
              {runner.events.length === 0 && (
                <li className="font-mono text-[10px]" style={{ color: "#4b5666" }}>— no events —</li>
              )}
              {runner.events.map((e, i) => (
                <li key={i} className="flex items-baseline gap-2 font-mono text-[10px]">
                  <span className="text-[var(--color-text-muted)] tabular-nums w-10">
                    {(e.tMs / 1000).toFixed(1)}s
                  </span>
                  <span className={e.source === "pilot" ? "text-[var(--color-text)]" : "text-[var(--color-brand)]"}>
                    {e.kind === "STEP" ? `STEP · ${e.stepId}`
                      : e.kind === "DECISION" ? `DECISION · ${e.value}`
                      : e.kind === "TRIGGER" ? `TRIGGER · ${e.triggerId}`
                      : `EFFECT · ${e.sourceId}`}
                  </span>
                </li>
              ))}
            </ol>
          </details>

        </div>
      </div>

      {/* ── DEV PANEL — only when ?dev=1 in URL ── */}
      {isDevMode && (
        <>
          <DevPanel runner={runner} scenario={scenario} />
          <AtcDevPanel
            scenario={scenario}
            atcPhase={atcPhase}
            firedDistractionsRef={firedDistractionsRef}
            setAtcPhase={setAtcPhase}
            setDistractionQueue={setDistractionQueue}
          />
        </>
      )}
    </main>
  );
}

// ── Right-panel status cards ───────────────────────────────────────────────────

function CommsClearCard() {
  return (
    <div className="px-4 py-3 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#16a34a" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4b5666" }}>
        COMMS CLEAR
      </span>
    </div>
  );
}

function AtcStandbyCard({
  d,
  resumesAt,
  onRespond,
}: {
  d: ScenarioDistraction;
  resumesAt: number;
  onRespond: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const totalMs = resumesAt - (Date.now() - (Date.now() - resumesAt + (resumesAt - Date.now())));
  const secLeft = Math.max(0, Math.ceil((resumesAt - now) / 1000));
  // compute initial total by assuming standby countdown hasn't changed since mount
  const [initTotal] = useState(() => Math.ceil((resumesAt - Date.now()) / 1000));
  const pct = Math.max(0, (secLeft / Math.max(1, initTotal)) * 100);
  void totalMs;

  return (
    <div className="px-4 py-3 font-mono">
      {/* Message stays visible in standby — per FCOM radio discipline */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="px-1.5 py-[2px] rounded-sm"
          style={{ fontSize: "7px", letterSpacing: "0.15em", fontWeight: 700, backgroundColor: "#FFB30020", color: "#FFB300", border: "1px solid #FFB30050" }}
        >
          STANDBY
        </span>
        <span style={{ color: "#FFB300", fontSize: "10px" }}>{d.from}</span>
        <span className="ml-auto" style={{ color: "#4A5566", fontSize: "9px" }}>resumes {secLeft}s</span>
      </div>
      <p style={{ color: "#8A9AAB", fontSize: "10px", lineHeight: "1.55", fontStyle: "italic" }}>
        &ldquo;{d.message}&rdquo;
      </p>
      {/* Countdown bar */}
      <div className="mt-2 mb-2" style={{ height: "1px", backgroundColor: "#1A2030" }}>
        <div className="h-full transition-all duration-250" style={{ width: `${pct}%`, backgroundColor: "#FFB30040" }} />
      </div>
      {/* Pilot can click to re-open response choices at any time */}
      <button
        type="button"
        onClick={onRespond}
        className="w-full text-left px-2 py-1.5 border border-dashed"
        style={{ borderColor: "#00D06040", backgroundColor: "#00D06008", color: "#00D060", fontSize: "8px", letterSpacing: "0.15em", textTransform: "uppercase" }}
      >
        ▸ TAP TO RESPOND NOW
      </button>
    </div>
  );
}

function ActionGapCard() {
  return (
    <div className="px-4 py-4 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#3981f6" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4b5666" }}>
        NEXT STEP…
      </span>
    </div>
  );
}

function splitHint(hint: string): string[] {
  return hint
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ProcedureIdleCard({ nextHardwareStep }: { nextHardwareStep?: ScenarioStep | null }) {
  if (nextHardwareStep) {
    // Box OUTLINE = the alert SEVERITY (red warning / amber caution) — a PTU/pump action still sits
    // under the red HYD warning, so its box is red. CONTENT (ACTION REQUIRED + the action) is BLUE
    // for a plain ECAM action line (switch/advisory, not glareshield/irreversible); glareshield and
    // irreversible content match the box. [user 2026-07-07]
    const isGlareshield = nextHardwareStep.group === "glareshield";
    const box = nextHardwareStep.variant === "caution" ? "#FFB300" : "#FF3333";
    const accent = (!isGlareshield && !nextHardwareStep.confirmRequired) ? "#29B6F6" : box;
    // Action verb colour mirrors the E/WD: a real switch command (PTU / pump OFF) is a BLUE action;
    // everything else (COMMAND, CANCEL) is white for readability. [user 2026-07-07]
    const isSwitchAction = nextHardwareStep.variant === "switch";
    const actCol = isSwitchAction ? "#29B6F6" : "#EAF0F8";
    const hintLines = splitHint(nextHardwareStep.hint ?? "");

    return (
      <div className="flex flex-col" style={{
        fontFamily: "var(--font-procedure)",
        // Neutral body — severity colour is only AROUND it (border) + the upper banner, not inside. [user 2026-07-07]
        backgroundColor: "#070C12",
        // Full border + lift — the BOX OUTLINE carries the alert severity (red/amber).
        border: `1px solid ${box}55`,
        borderRadius: "8px",
        overflow: "hidden",
        // Lighter, cooler drop-shadow for the white column (see flight-check-popup).
        boxShadow: `0 0 0 1px ${box}22, 0 8px 22px rgba(15,20,30,0.16), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}>

        {/* Header — same chip vocabulary as the ECAM procedure cards, plus the left-panel cue. */}
        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `1px solid ${box}55` }}>
          {!isGlareshield && <CategoryChips value={nextHardwareStep.category ?? "ECAM"} ecamColor={box} />}
          <span className="text-[8px] font-bold tracking-[0.18em] uppercase" style={{ color: box }}>
            ← Left panel
          </span>
          <span className="ml-auto"><PerformerChip crew={nextHardwareStep.crew} /></span>
        </div>

        {/* Step detail — label WHITE, action in the content colour (blue for an ECAM action line) */}
        <div className="px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: "#EAF0F8" }}>
              {nextHardwareStep.label}
            </span>
            <span
              className="text-[8px] px-2 py-0.5"
              style={{ backgroundColor: isSwitchAction ? actCol + "20" : "rgba(255,255,255,0.06)", color: actCol, border: `1px solid ${isSwitchAction ? actCol + "40" : "rgba(255,255,255,0.18)"}`, borderRadius: "2px" }}
            >
              {nextHardwareStep.action}
            </span>
          </div>

          {/* Hint — line by line */}
          {hintLines.length > 0 && (
            <ul className="flex flex-col gap-1.5" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {hintLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span style={{ color: accent + "70", fontSize: "8px", marginTop: "3px", flexShrink: 0 }}>▸</span>
                  <span style={{ color: "#E6ECF5", fontSize: "10px", lineHeight: "1.55", letterSpacing: "0.02em" }}>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {(nextHardwareStep.reference || isGlareshield) && (
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: `1px solid ${box}20` }}>
            {nextHardwareStep.reference ? <ReferenceChips value={nextHardwareStep.reference} /> : <span />}
            {isGlareshield && (
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em]"
                style={{
                  color: "#FFB300",
                  border: "1px solid #FFB30057",
                  backgroundColor: "#FFB30021",
                  borderRadius: "5px",
                  padding: "3px 8px",
                }}
              >
                GLARESHIELD
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "#4b5666" }}>
        MONITORING — STANDBY
      </span>
    </div>
  );
}

// ── Left-panel step progress tracker ──────────────────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  flightcheck: "AVIATE",
  glareshield: "GLARESHIELD",
  procedure:   "ECAM",
  comms:       "CRM / ASSESS",
  chclm:       "CHECKLIST",
};
const GROUP_ORDER = ["flightcheck", "glareshield", "procedure", "comms", "chclm"];

function ScenarioProgress({ scenario, state }: { scenario: Scenario; state: ScenarioState }) {
  const grouped: Record<string, ScenarioStep[]> = {};
  for (const s of scenario.steps) {
    if (s.optional || !isStepApplicable(s, state)) continue;
    const g = s.group ?? "procedure";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(s);
  }

  const allRequired = getApplicableRequiredSteps(scenario, state);
  const doneCount = allRequired.filter((s) => state.completedSteps[s.id]).length;

  // Active group = first group with a step whose trigger + requires are all met but not yet done
  const activeGroup = GROUP_ORDER.find((g) =>
    grouped[g]?.some(
      (s) =>
        !state.completedSteps[s.id] &&
        (!s.requiresTrigger || !!state.triggersFired[s.requiresTrigger]) &&
        (s.requires ?? []).every((r) => !!state.completedSteps[r]),
    ),
  );

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    new Set(activeGroup ? [activeGroup] : [GROUP_ORDER[0]]),
  );

  // Auto-expand the newly active group as the procedure advances
  useEffect(() => {
    if (activeGroup) {
      setExpanded((prev) => (prev.has(activeGroup) ? prev : new Set([...prev, activeGroup])));
    }
  }, [activeGroup]);

  const toggle = (g: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <span className="font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: "#4b5666" }}>PROCEDURE PROGRESS</span>
        <span className="font-mono text-[9px]" style={{ color: "#4b5666" }}>{doneCount} / {allRequired.length}</span>
      </div>
      {/* Overall progress bar */}
      <div style={{ height: "2px", backgroundColor: "var(--color-border)" }}>
        <div className="h-full transition-all duration-500" style={{ width: `${(doneCount / allRequired.length) * 100}%`, backgroundColor: "var(--color-brand)" }} />
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {GROUP_ORDER.filter((g) => grouped[g]).map((g) => (
          <AccordionGroupRow
            key={g}
            label={GROUP_LABELS[g] ?? g}
            steps={grouped[g]}
            state={state}
            isActive={activeGroup === g}
            expanded={expanded.has(g)}
            onToggle={() => toggle(g)}
          />
        ))}
      </div>
    </div>
  );
}

function AccordionGroupRow({
  label, steps, state, isActive, expanded, onToggle,
}: {
  label: string;
  steps: ScenarioStep[];
  state: ScenarioState;
  isActive: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const doneCount = steps.filter((s) => state.completedSteps[s.id]).length;
  const allDone = doneCount === steps.length;
  const accentColor = allDone ? "var(--color-green)" : isActive ? "var(--color-brand)" : "var(--color-text-faint)";

  return (
    <div>
      {/* Clickable header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
        style={{ backgroundColor: isActive && !allDone ? "rgba(0,207,255,0.04)" : "transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = isActive && !allDone ? "rgba(0,207,255,0.04)" : "transparent"; }}
      >
        {/* Phase label */}
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] shrink-0" style={{ width: "82px", color: accentColor }}>
          {label}
        </span>
        {/* Step dots */}
        <div className="flex items-center gap-1 flex-1 flex-wrap">
          {steps.map((s) => {
            const done = !!state.completedSteps[s.id];
            const triggerMet = !s.requiresTrigger || !!state.triggersFired[s.requiresTrigger];
            const cur = !done && triggerMet && (s.requires ?? []).every((r) => !!state.completedSteps[r]);
            return (
              <div
                key={s.id}
                title={`${s.label} ${s.action}`}
                className={cur ? "animate-pulse" : ""}
                style={{ height: "6px", width: "6px", borderRadius: "50%", flexShrink: 0, backgroundColor: done ? "var(--color-green)" : cur ? "var(--color-brand)" : "var(--color-border)" }}
              />
            );
          })}
        </div>
        <span className="font-mono text-[8px] shrink-0" style={{ color: accentColor }}>{doneCount}/{steps.length}</span>
        {/* Chevron */}
        <span className="font-mono text-[9px] shrink-0 ml-1" style={{ color: "var(--color-text-faint)", display: "inline-block", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>▾</span>
      </button>

      {/* Expanded step list */}
      {expanded && (
        <div className="divide-y" style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", borderLeft: "2px solid var(--color-border)" }}>
          {steps.map((s) => {
            const done = !!state.completedSteps[s.id];
            const triggerMet = !s.requiresTrigger || !!state.triggersFired[s.requiresTrigger];
            const cur = !done && triggerMet && (s.requires ?? []).every((r) => !!state.completedSteps[r]);
            const stepAccent = done ? "var(--color-text-faint)" : cur ? "var(--color-text)" : "var(--color-text-faint)";
            return (
              <div key={s.id} className="flex items-center gap-2.5 px-5 py-2" style={{ borderColor: "var(--color-border)", opacity: done ? 0.45 : 1 }}>
                {/* Status dot */}
                <div
                  className={cur ? "animate-pulse shrink-0" : "shrink-0"}
                  style={{ height: "5px", width: "5px", borderRadius: "50%", backgroundColor: done ? "var(--color-green)" : cur ? "var(--color-brand)" : "var(--color-border)" }}
                />
                {/* Label */}
                <span className="font-mono text-[10px] flex-1" style={{ color: stepAccent, textDecoration: done ? "line-through" : "none" }}>
                  {s.label}
                </span>
                {/* Action */}
                <span className="font-mono text-[8px] shrink-0" style={{ color: cur ? "var(--color-brand)" : "var(--color-border)" }}>
                  {s.action}
                </span>
                {/* ← LEFT PANEL badge for active hardware steps */}
                {s.hardware && cur && (
                  <span className="shrink-0 px-1.5 py-[1px] font-mono text-[7px] uppercase tracking-wider animate-pulse"
                    style={{ backgroundColor: "#FF333318", color: "#FF3333", border: "1px solid #FF333335" }}>
                    ← LEFT
                  </span>
                )}
                {/* Crew badge */}
                {s.crew && (
                  <span className="shrink-0 px-1 py-[1px] font-mono text-[7px]" style={{ color: "var(--color-text-faint)", border: "1px solid var(--color-border)" }}>
                    {s.crew}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Dev / Admin Panel ─────────────────────────────────────────────────────────
// Shown only when URL contains ?dev=1.
// Lets the scenario author pause time, fire triggers manually, and skip steps.

import type { RunnerHandle } from "@/lib/scenarios/runner";

// ─── Draggable helper — header acts as drag handle ──────────────────────────
function useDraggable(defaultX: number, defaultY: number) {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: defaultX, y: defaultY });
  const originRef = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!originRef.current) return;
      const dx = e.clientX - originRef.current.mouseX;
      const dy = e.clientY - originRef.current.mouseY;
      setPos({ x: originRef.current.panelX + dx, y: originRef.current.panelY + dy });
    };
    const onUp = () => { originRef.current = null; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);
  const startDrag = useCallback((e: React.MouseEvent) => {
    originRef.current = { mouseX: e.clientX, mouseY: e.clientY, panelX: pos.x, panelY: pos.y };
    document.body.style.userSelect = "none";
    e.preventDefault();
  }, [pos.x, pos.y]);
  return { pos, startDrag };
}

function DevPanel({ runner, scenario }: { runner: RunnerHandle; scenario: Scenario }) {
  const [open, setOpen] = useState(true);
  const { pos, startDrag } = useDraggable(16, typeof window !== "undefined" ? window.innerHeight - 720 : 100);

  const unFiredTriggers = scenario.triggers.filter(
    (t) => !runner.state.triggersFired[t.id],
  );
  const firedTriggers = scenario.triggers.filter(
    (t) => !!runner.state.triggersFired[t.id],
  );
  const pendingSteps = scenario.steps.filter(
    (s) => !runner.state.completedSteps[s.id] && !s.optional,
  );
  // Completed steps in the order they were completed (most recent first)
  const completedSteps = scenario.steps
    .filter((s) => !!runner.state.completedSteps[s.id])
    .sort(
      (a, b) =>
        (runner.state.completedSteps[b.id] || 0) -
        (runner.state.completedSteps[a.id] || 0),
    );

  return (
    <div
      className="font-mono"
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 9999,
        width: open ? "300px" : "auto",
        backgroundColor: "#0A0D10",
        border: "1px solid #FF660040",
        borderRadius: "4px",
        boxShadow: "0 0 20px #FF660020",
      }}
    >
      {/* Header — drag handle (whole bar).  Toggle button is separate. */}
      <div
        onMouseDown={startDrag}
        className="flex items-center justify-between px-3 py-2 select-none"
        style={{ borderBottom: open ? "1px solid #FF660025" : "none", cursor: "grab" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "9px", color: "#FF660080" }}>⋮⋮</span>
          <span style={{ fontSize: "7px", letterSpacing: "0.25em", color: "#FF6600", fontWeight: 700 }}>
            ⚙ DEV MODE
          </span>
          {runner.paused && (
            <span style={{ fontSize: "7px", letterSpacing: "0.2em", color: "#FFB300", fontWeight: 700 }}>
              ⏸ PAUSED
            </span>
          )}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          style={{ color: "#FF660060", fontSize: "9px", padding: "0 4px", cursor: "pointer" }}
        >
          {open ? "▾" : "▸"}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 p-3">

          {/* Clock control */}
          <div className="flex items-center gap-2">
            <span style={{ color: "#4A5566", fontSize: "8px", letterSpacing: "0.15em", flex: 1 }}>
              T+{(runner.elapsedMs / 1000).toFixed(1)}s
            </span>
            <button
              type="button"
              onClick={runner.paused ? runner.resume : runner.pause}
              style={{
                padding: "4px 10px",
                fontSize: "8px",
                letterSpacing: "0.15em",
                fontWeight: 700,
                backgroundColor: runner.paused ? "#00D06018" : "#FF330018",
                color: runner.paused ? "#00D060" : "#FF3333",
                border: `1px solid ${runner.paused ? "#00D06040" : "#FF333340"}`,
                borderRadius: "2px",
                cursor: "pointer",
              }}
            >
              {runner.paused ? "▶ RESUME" : "⏸ PAUSE"}
            </button>
          </div>

          {/* FMA live readout */}
          {(() => {
            const ls = buildAircraftState(runner.state, scenario, runner.elapsedMs);
            const activePf = getActivePfActionPhase(scenario, runner.state);
            const vsLabel = ls.vertMode === "V/S" && ls.vs === 0 ? "V/S=0" : ls.vertMode;
            return (
              <div style={{ borderTop: "1px solid #1A2230", paddingTop: "8px" }}>
                <div style={{ color: "#3A4858", fontSize: "7px", letterSpacing: "0.2em", marginBottom: "5px" }}>
                  FMA LIVE
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em" }}>
                  <span style={{ color: "#ffffff" }}>{ls.thrMode}</span>
                  <span style={{ color: "#2A3848" }}>│</span>
                  <span style={{ color: "#00D060" }}>{vsLabel}</span>
                  <span style={{ color: "#2A3848" }}>│</span>
                  <span style={{ color: "#00D060" }}>{ls.latMode}</span>
                  {ls.thrCue && (
                    <>
                      <span style={{ color: "#2A3848" }}>│</span>
                      <span style={{ color: "#FFB300", animation: "pulse 1s ease-in-out infinite" }}>{ls.thrCue}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Phase checkpoints (ENG1-FIRE only) — these buttons are hardcoded fire phases
              (>100ft / 400ft / green dot / MCT). Hidden for other scenarios; dual-hyd etc.
              use the Inspector's per-step "Seek scenario to here". */}
          {scenario.meta?.slug?.startsWith("eng1-fire") && (
          <div>
            <div style={{ color: "#3A4858", fontSize: "7px", letterSpacing: "0.2em", marginBottom: "4px" }}>
              SEEK TO PHASE
            </div>
            <div className="flex flex-wrap gap-1">
              {([
                {
                  label: "①  >100ft",
                  sub:   "ENGAGE AP1 ring",
                  fma:   "MAN TOGA · SRS · NAV",
                  triggers: ["fire_warn"],
                  steps: ["continue_rotation", "positive_rate_gear_up"],
                },
                {
                  label: "②  400ft",
                  sub:   "START ECAM ACTIONS ring",
                  fma:   "MAN TOGA · SRS · NAV",
                  triggers: ["fire_warn", "four_hundred_ft"],
                  steps: ["continue_rotation", "positive_rate_gear_up", "engage_ap_fma", "cancel_master_warn"],
                },
                {
                  label: "③  MAA V/S=0",
                  sub:   "Level off 2 300 ft",
                  fma:   "MAN TOGA · V/S=0 · NAV",
                  triggers: ["fire_warn", "four_hundred_ft", "fire_extinguished"],
                  steps: ["continue_rotation", "positive_rate_gear_up", "engage_ap_fma", "cancel_master_warn", "four_hundred_ft_cmd", "thr_lever_idle", "eng1_master_off", "eng1_fire_pb", "cancel_master_caut", "agent1", "engine_secured", "announce_land_asap", "mayday_atc"],
                },
                {
                  label: "④  GRN DOT / OP CLB",
                  sub:   "LVR MCT flash — PULL ALT ring",
                  fma:   "MAN TOGA · OP CLB · NAV",
                  triggers: ["fire_warn", "four_hundred_ft", "fire_extinguished"],
                  steps: ["continue_rotation", "positive_rate_gear_up", "engage_ap_fma", "cancel_master_warn", "four_hundred_ft_cmd", "thr_lever_idle", "eng1_master_off", "eng1_fire_pb", "cancel_master_caut", "agent1", "engine_secured", "announce_land_asap", "mayday_atc", "level_off_maa", "accel_clean"],
                },
                {
                  label: "⑤  THR MCT",
                  sub:   "SET MCT ring",
                  fma:   "THR MCT · OP CLB · NAV",
                  triggers: ["fire_warn", "four_hundred_ft", "fire_extinguished"],
                  steps: ["continue_rotation", "positive_rate_gear_up", "engage_ap_fma", "cancel_master_warn", "four_hundred_ft_cmd", "thr_lever_idle", "eng1_master_off", "eng1_fire_pb", "cancel_master_caut", "agent1", "engine_secured", "announce_land_asap", "mayday_atc", "level_off_maa", "accel_clean", "pull_alt_op_clb"],
                },
              ] as { label: string; sub: string; fma: string; triggers: string[]; steps: string[] }[]).map((cp) => (
                <button
                  key={cp.label}
                  type="button"
                  onClick={() => runner.seekToCheckpoint(cp.steps, cp.triggers)}
                  style={{
                    padding: "4px 7px 3px",
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    backgroundColor: "#7744FF18",
                    color: "#9966FF",
                    border: "1px solid #7744FF40",
                    borderRadius: "2px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1px",
                    alignItems: "flex-start",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#7744FF30"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#7744FF18"; }}
                >
                  <span>{cp.label}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Triggers */}
          {unFiredTriggers.length > 0 && (
            <div>
              <div style={{ color: "#3A4858", fontSize: "7px", letterSpacing: "0.2em", marginBottom: "4px" }}>
                TRIGGERS — click to fire
              </div>
              <div className="flex flex-col gap-1">
                {unFiredTriggers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => runner.fireTrigger(t.id)}
                    className="flex items-center justify-between px-2 py-1.5 text-left"
                    style={{
                      backgroundColor: "#FF660008",
                      border: "1px solid #FF660030",
                      borderRadius: "2px",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FF660018"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FF660008"; }}
                  >
                    <span style={{ color: "#CC8844", fontSize: "9px" }}>{t.id}</span>
                    <span style={{ color: "#4A5566", fontSize: "7px" }}>T+{(t.atMs / 1000).toFixed(0)}s</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          {pendingSteps.length > 0 && (
            <div>
              <div style={{ color: "#3A4858", fontSize: "7px", letterSpacing: "0.2em", marginBottom: "4px" }}>
                STEPS — click to complete
              </div>
              <div className="flex flex-col gap-1" style={{ maxHeight: "220px", overflowY: "auto" }}>
                {pendingSteps.map((s) => {
                  const requiresMet = (s.requires ?? []).every((r) => !!runner.state.completedSteps[r]);
                  const triggerMet = !s.requiresTrigger || !!runner.state.triggersFired[s.requiresTrigger];
                  const ready = requiresMet && triggerMet;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => runner.perform({ kind: "STEP", stepId: s.id })}
                      className="flex items-center justify-between px-2 py-1.5 text-left"
                      style={{
                        backgroundColor: ready ? "#00CFFF08" : "#1A2030",
                        border: `1px solid ${ready ? "#00CFFF30" : "#1E2A3A"}`,
                        borderRadius: "2px",
                        opacity: ready ? 1 : 0.4,
                        cursor: ready ? "pointer" : "default",
                      }}
                      onMouseEnter={(e) => { if (ready) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#00CFFF14"; }}
                      onMouseLeave={(e) => { if (ready) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#00CFFF08"; }}
                    >
                      <span style={{ color: ready ? "#8ABCCC" : "#3A4858", fontSize: "9px" }}>{s.label}</span>
                      <span style={{ color: "#3A4858", fontSize: "7px" }}>{s.action}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed steps — undo buttons for moving BACK */}
          {completedSteps.length > 0 && (
            <div>
              <div style={{ color: "#3A4858", fontSize: "7px", letterSpacing: "0.2em", marginBottom: "4px" }}>
                COMPLETED — click ↩ to undo
              </div>
              <div className="flex flex-col gap-1" style={{ maxHeight: "180px", overflowY: "auto" }}>
                {completedSteps.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5"
                    style={{
                      backgroundColor: "#00D06008",
                      border: "1px solid #00D06030",
                      borderRadius: "2px",
                    }}
                  >
                    <span style={{ color: "#5AAA75", fontSize: "9px", flex: 1 }}>{s.label}</span>
                    <button
                      type="button"
                      onClick={() => runner.undoStep(s.id)}
                      title={`Undo ${s.label}`}
                      style={{
                        padding: "1px 6px",
                        fontSize: "9px",
                        fontWeight: 700,
                        backgroundColor: "#FFB30018",
                        color: "#FFB300",
                        border: "1px solid #FFB30040",
                        borderRadius: "2px",
                        cursor: "pointer",
                      }}
                    >
                      ↩
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fired triggers — undo to re-fire */}
          {firedTriggers.length > 0 && (
            <div>
              <div style={{ color: "#3A4858", fontSize: "7px", letterSpacing: "0.2em", marginBottom: "4px" }}>
                FIRED TRIGGERS — click ↩ to un-fire
              </div>
              <div className="flex flex-col gap-1" style={{ maxHeight: "120px", overflowY: "auto" }}>
                {firedTriggers.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 px-2 py-1.5"
                    style={{
                      backgroundColor: "#FF660008",
                      border: "1px solid #FF660030",
                      borderRadius: "2px",
                    }}
                  >
                    <span style={{ color: "#CC8844", fontSize: "9px", flex: 1 }}>{t.id}</span>
                    <button
                      type="button"
                      onClick={() => runner.undoTrigger(t.id)}
                      title={`Un-fire ${t.id}`}
                      style={{
                        padding: "1px 6px",
                        fontSize: "9px",
                        fontWeight: 700,
                        backgroundColor: "#FFB30018",
                        color: "#FFB300",
                        border: "1px solid #FFB30040",
                        borderRadius: "2px",
                        cursor: "pointer",
                      }}
                    >
                      ↩
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingSteps.length === 0 && unFiredTriggers.length === 0 && (
            <span style={{ color: "#2E3A48", fontSize: "8px", letterSpacing: "0.15em" }}>
              ALL STEPS COMPLETE
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ATC dev panel — right side, lets dev jump to any ATC call ──────────────
function AtcDevPanel({
  scenario,
  atcPhase,
  firedDistractionsRef,
  setAtcPhase,
  setDistractionQueue,
}: {
  scenario: Scenario;
  atcPhase: AtcPhase;
  firedDistractionsRef: React.RefObject<Set<string>>;
  setAtcPhase: React.Dispatch<React.SetStateAction<AtcPhase>>;
  setDistractionQueue: React.Dispatch<React.SetStateAction<ScenarioDistraction[]>>;
}) {
  const [open, setOpen] = useState(true);
  const { pos, startDrag } = useDraggable(
    typeof window !== "undefined" ? window.innerWidth - 340 : 800,
    typeof window !== "undefined" ? window.innerHeight - 720 : 100,
  );
  const distractions = scenario.distractions ?? [];
  const activeId = atcPhase.kind !== "idle" ? atcPhase.d.id : null;

  const fireDistraction = (d: ScenarioDistraction) => {
    firedDistractionsRef.current?.add(d.id);
    setDistractionQueue([]);                     // clear any pending queue
    setAtcPhase({ kind: "active", d });
  };

  const skipCurrent = () => {
    setAtcPhase({ kind: "idle" });
  };

  const replayDistraction = (d: ScenarioDistraction) => {
    firedDistractionsRef.current?.delete(d.id);  // allow re-fire
    setAtcPhase({ kind: "active", d });
  };

  if (distractions.length === 0) return null;

  return (
    <div
      className="font-mono"
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 9999,
        width: open ? "320px" : "auto",
        backgroundColor: "#0A0D10",
        border: "1px solid #00D06040",
        borderRadius: "4px",
        boxShadow: "0 0 20px #00D06020",
      }}
    >
      <div
        onMouseDown={startDrag}
        className="flex items-center justify-between px-3 py-2 select-none"
        style={{ borderBottom: open ? "1px solid #00D06025" : "none", cursor: "grab" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "9px", color: "#00D06080" }}>⋮⋮</span>
          <span style={{ fontSize: "7px", letterSpacing: "0.25em", color: "#00D060", fontWeight: 700 }}>
            📡 ATC DEV
          </span>
          {activeId && (
            <span style={{ fontSize: "7px", letterSpacing: "0.2em", color: "#FFB300", fontWeight: 700 }}>
              {atcPhase.kind === "active" ? "▶ ACTIVE" : "⏸ STANDBY"}
            </span>
          )}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          style={{ color: "#00D06060", fontSize: "9px", padding: "0 4px", cursor: "pointer" }}
        >
          {open ? "▾" : "▸"}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 p-3">
          {activeId && (
            <button
              type="button"
              onClick={skipCurrent}
              style={{
                padding: "4px 10px",
                fontSize: "8px",
                letterSpacing: "0.15em",
                fontWeight: 700,
                backgroundColor: "#FF330018",
                color: "#FF6666",
                border: "1px solid #FF333340",
                borderRadius: "2px",
                cursor: "pointer",
              }}
            >
              ⏭ SKIP CURRENT
            </button>
          )}

          <div>
            <div style={{ color: "#3A4858", fontSize: "7px", letterSpacing: "0.2em", marginBottom: "4px" }}>
              ATC CALLS — click to fire, ↩ to replay
            </div>
            <div className="flex flex-col gap-1" style={{ maxHeight: "420px", overflowY: "auto" }}>
              {distractions.map((d, idx) => {
                const fired = firedDistractionsRef.current?.has(d.id) ?? false;
                const isActive = activeId === d.id;
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 px-2 py-1.5"
                    style={{
                      backgroundColor: isActive ? "#00D06020" : fired ? "#1A2030" : "#00D06008",
                      border: `1px solid ${isActive ? "#00D06080" : fired ? "#1E2A3A" : "#00D06030"}`,
                      borderRadius: "2px",
                      opacity: isActive ? 1 : fired ? 0.5 : 1,
                    }}
                  >
                    <span
                      style={{
                        padding: "1px 4px",
                        fontSize: "8px",
                        fontWeight: 800,
                        backgroundColor: "#FFEB3B",
                        color: "#000",
                        borderRadius: "2px",
                        letterSpacing: "0.04em",
                        fontFamily: "monospace",
                      }}
                    >
                      A{idx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: isActive ? "#9AE0A8" : "#7A8A9A", fontSize: "9px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {d.from}
                      </div>
                      <div style={{ color: "#3A4858", fontSize: "7px", letterSpacing: "0.05em" }}>
                        {d.id} · T+{(d.atMs / 1000).toFixed(0)}s
                      </div>
                    </div>
                    {fired && !isActive ? (
                      <button
                        type="button"
                        onClick={() => replayDistraction(d)}
                        title={`Replay ${d.id}`}
                        style={{
                          padding: "1px 6px",
                          fontSize: "9px",
                          fontWeight: 700,
                          backgroundColor: "#FFB30018",
                          color: "#FFB300",
                          border: "1px solid #FFB30040",
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                      >
                        ↩
                      </button>
                    ) : !isActive ? (
                      <button
                        type="button"
                        onClick={() => fireDistraction(d)}
                        title={`Fire ${d.id}`}
                        style={{
                          padding: "1px 6px",
                          fontSize: "9px",
                          fontWeight: 700,
                          backgroundColor: "#00D06018",
                          color: "#00D060",
                          border: "1px solid #00D06040",
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                      >
                        ▶
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
