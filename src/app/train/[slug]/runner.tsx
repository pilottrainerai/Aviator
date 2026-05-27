"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useScenarioRunner } from "@/lib/scenarios/runner";
import type { Scenario, ScenarioDistraction, ScenarioStep, AirportOption } from "@/scenarios/types";
import type { ScenarioState } from "@/engine/state";
import type { PilotAction } from "@/engine/events";
import { ScenarioClock } from "@/components/cockpit/scenario-clock";
import { EwdDisplay } from "@/components/cockpit/ewd-display";
import { DecisionPanel } from "@/components/cockpit/decision-panel";
import { PreflightBrief } from "@/components/cockpit/preflight-brief";
import { FireBanner } from "@/components/cockpit/fire-banner";
import { GuidancePanel } from "@/components/cockpit/guidance-panel";
import { AudioController } from "@/components/cockpit/audio-controller";
import { NdCanvas } from "@/components/cockpit/pfd-nd";
import PfdMockup from "@/components/cockpit/pfd-mockup";
import { DistractionModal } from "@/components/cockpit/distraction-modal";
import { GlareshieldPanel } from "@/components/cockpit/glareshield-panel";
import { FlightCheckPopup } from "@/components/cockpit/flight-check-popup";
import { FirePanel } from "@/components/cockpit/fire-panel";
import { FirePanel3D } from "@/components/cockpit/fire-panel-3d";
import { SystemDisplay } from "@/components/cockpit/system-display";
import { StatusPanel } from "@/components/cockpit/status-panel";
import { getApplicableRequiredSteps, isStepApplicable } from "@/lib/scenarios/step-applicability";
import { track } from "@/lib/analytics";

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
// Wraps FirePanel (DOM) and FirePanel3D (Blender GLB) behind a toggle button.
// The toggle state is persisted in localStorage so it survives page reloads.
// FirePanel3D is only offered for legacy-mode scenarios (no engineDisplay DSL).
// ─────────────────────────────────────────────────────────────────────────────
const FP3D_KEY = "firePanelMode"; // "dom" | "3d"

function FirePanelContainer({
  scenario,
  state,
  perform,
  disabled,
}: {
  scenario: import("@/scenarios/types").Scenario;
  state: import("@/engine/state").ScenarioState;
  perform: (a: import("@/engine/events").PilotAction) => void;
  disabled?: boolean;
}) {
  const [use3D, setUse3D] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(FP3D_KEY) === "3d";
  });

  // Default to 3D for fire-panel capable scenarios so users consistently
  // land on the Blender panel first after reloads/crashes.
  useEffect(() => {
    if (!scenario.steps.some(s => s.id === "eng1_fire_pb")) return;
    setUse3D(true);
    localStorage.setItem(FP3D_KEY, "3d");
  }, [scenario]);

  const toggle = () => {
    const next = !use3D;
    setUse3D(next);
    localStorage.setItem(FP3D_KEY, next ? "3d" : "dom");
  };

  // FirePanel3D works for any ENG 1 FIRE scenario regardless of whether the
  // scenario uses the engineDisplay DSL — that DSL drives the ECAM SD (SystemDisplay),
  // not the fire panel itself.  Allow 3D toggle for all scenarios that have
  // eng1_fire_pb as a step.
  const can3D = scenario.steps.some(s => s.id === "eng1_fire_pb");

  // Derive FirePanel3D props from scenario state
  const fireDetected  = !!state.triggersFired["fire_warn"];
  const firePbDone    = !!state.completedSteps["eng1_fire_pb"];
  const agent1Disch   = !!state.completedSteps["agent1"];
  const agent2Disch   = !!state.completedSteps["agent2"];
  // agent2 becomes available once fire_persists_30s trigger fires (conditional branch)
  const agent2Available = !!state.triggersFired["fire_persists_30s"] || agent1Disch;
  const step = (id: string) => { if (!disabled) perform({ kind: "STEP", stepId: id }); };

  return (
    <div
      style={{
        flex: use3D ? "0 0 230px" : "1 1 0",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Mode toggle — only shown when 3D is available */}
      {can3D && (
        <div style={{ position: "absolute", top: 4, right: 6, zIndex: 10 }}>
          <button
            onClick={toggle}
            style={{
              fontSize: "8px", fontFamily: "monospace", letterSpacing: "0.15em",
              padding: "2px 6px", border: "1px solid #2A3448",
              backgroundColor: use3D ? "#0E1A2C" : "transparent",
              color: use3D ? "#00CFFF" : "#4A5570",
              cursor: "pointer", textTransform: "uppercase",
            }}
          >
            {use3D ? "3D ▣" : "3D ☐"}
          </button>
        </div>
      )}

      {can3D && use3D ? (
        <FirePanel3D
          fireDetected={fireDetected}
          firePbDone={firePbDone}
          agent1Disch={agent1Disch}
          agent2Disch={agent2Disch}
          agent2Available={agent2Available}
          onPushFirePb={() => step("eng1_fire_pb")}
          onPushAgent1={() => step("agent1")}
          onPushAgent2={() => step("agent2")}
        />
      ) : (
        <FirePanel
          scenario={scenario}
          state={state}
          perform={perform}
          disabled={disabled}
        />
      )}
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
    const sequence = loadSavedSequence(baseScenario.meta.slug);
    if (!sequence.length) return baseScenario;

    const orderedSteps = reorderBySavedSequence(baseScenario.steps, sequence);
    const orderedDistractions = reorderBySavedSequence(baseScenario.distractions ?? [], sequence);

    return {
      ...baseScenario,
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

  // Fire distractions at their scheduled atMs.  If `requiresStep` is set,
  // the distraction also waits for that step to be marked complete — atMs
  // becomes a minimum delay rather than the fire time.
  useEffect(() => {
    if (runner.status !== "running" || !scenario.distractions) return;
    for (const d of scenario.distractions) {
      if (firedDistractionsRef.current.has(d.id)) continue;
      if (runner.elapsedMs < d.atMs) continue;
      if (d.requiresStep && !runner.state.completedSteps[d.requiresStep]) continue;
      firedDistractionsRef.current.add(d.id);
      setDistractionQueue((prev) => [...prev, d]);
    }
  }, [runner.elapsedMs, runner.status, runner.state.completedSteps, scenario.distractions]);

  // Cooldown after a correct answer — next queued call waits this long
  const [atcNextAllowedAt, setAtcNextAllowedAt] = useState(0);

  // Promote from queue only when idle AND past the post-answer cooldown
  useEffect(() => {
    if (atcPhase.kind !== "idle" || distractionQueue.length === 0) return;
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
  }, [atcPhase.kind, distractionQueue.length, atcNextAllowedAt]);

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
        // Correct → permanently dismiss, then 9 s gap before next call
        standbyCountRef.current.delete(d.id);
        setAtcPhase({ kind: "idle" });
        setAtcNextAllowedAt(Date.now() + 9_000);
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
    // Escalating delay: 20 s → 12 s → 6 s → 3 s (persistent pressure)
    const delay = count === 1 ? 20_000 : count === 2 ? 12_000 : count <= 4 ? 6_000 : 3_000;
    const resumesAt = Date.now() + delay;
    setAtcPhase({ kind: "standby", d, resumesAt });
    if (atcTimerRef.current) clearTimeout(atcTimerRef.current);
    atcTimerRef.current = setTimeout(() => setAtcPhase({ kind: "active", d }), delay);
  }, [atcPhase]);

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

  return (
    <main className="flex flex-col">

      {/* ── ABOVE FOLD — fills one full viewport; no scroll needed ── */}
      <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      <FireBanner state={runner.state} />
      <AudioController active={runner.state.masterWarnActive} cautActive={runner.state.masterCautActive} />
      <ScenarioClock elapsedMs={runner.elapsedMs} state={runner.state} scenario={scenario} />

      <div className="flex flex-1 min-h-0">

        {/* ── LEFT PANEL — cockpit instruments ────────────────────────── */}
        <div
          style={{ flex: "0 0 68%", borderRight: "1px solid var(--color-border)", overflow: "hidden", display: "flex", flexDirection: "row" }}
        >
          {/* Left sub-column: PFD + ND → Glareshield → ECAM fills remaining height */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", padding: "10px 4px 8px 10px", overflow: "hidden" }}>
            {/* PFD + ND */}
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <div style={{ width: "380px", height: "380px", border: "1px solid var(--color-border)", backgroundColor: "#000", overflow: "hidden" }}>
                <PfdMockup state={runner.state} scenario={scenario} elapsedMs={runner.elapsedMs} />
              </div>
              <div style={{ width: "330px", height: "330px", border: "1px solid var(--color-border)", backgroundColor: "#000", overflow: "hidden" }}>
                <NdCanvas state={runner.state} scenario={scenario} elapsedMs={runner.elapsedMs} />
              </div>
            </div>
            {/* Glareshield — compact strip */}
            <div style={{ flexShrink: 0, marginTop: "4px" }}>
              <GlareshieldPanel
                scenario={scenario}
                state={runner.state}
                perform={runner.perform}
                disabled={runner.status !== "running"}
              />
            </div>
            {/* ECAM (E/WD) — fills remaining height */}
            <div style={{ flex: "1 1 0", minHeight: 0, marginTop: "4px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <EwdDisplay state={runner.state} scenario={scenario} />
            </div>
            {/* STATUS page — below ECAM, same left sub-column */}
            <StatusPanel scenario={scenario} state={runner.state} />
          </div>

          {/* Right sub-column: Fire/Engine (top) + System Display (mid) */}
          <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "6px", padding: "10px 10px 8px 4px" }}>
            <FirePanelContainer
              scenario={scenario}
              state={runner.state}
              perform={runner.perform}
              disabled={runner.status !== "running"}
            />
            <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <SystemDisplay state={runner.state} scenario={scenario} />
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — 30% — action window ───────────────────────── */}
        <div
          className="flex flex-col bg-[var(--color-surface)]"
          style={{ flex: "0 0 30%", minWidth: "300px" }}
        >
          {/* Panel header */}
          <div
            className="px-4 py-2 shrink-0 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                ◈ ACTION PANEL
              </span>
              <button
                onClick={() => (runner.paused ? runner.resume() : runner.pause())}
                className="px-2 py-0.5 border border-[#1C2530] text-[9px] uppercase tracking-wider hover:border-[#3A4555]"
                style={{ color: runner.paused ? "#50FA7B" : "#FFD700" }}
              >
                {runner.paused ? "Resume" : "Pause"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {runner.paused && <span className="font-mono text-[8px] uppercase tracking-[0.15em]" style={{ color: "#FFD700" }}>PAUSED</span>}
              {distractionQueue.length > 0 && (
                <span className="font-mono text-[8px] uppercase tracking-[0.15em]" style={{ color: "var(--color-amber)" }}>
                  {distractionQueue.length} QUEUED
                </span>
              )}
            </div>
          </div>

          <DeveloperOverlay
            scenario={scenario}
            currentStepId={nextSoftwareStep?.id ?? nextHardwareStep?.id}
            activeAtcId={atcPhase.kind === "active" || atcPhase.kind === "standby" ? atcPhase.d.id : undefined}
          />

          {/* ── COMMS SECTION — fixed reservation, content scrolls if overflow ── */}
          <div
            className="shrink-0 flex flex-col"
            style={{ borderBottom: "1px solid var(--color-border)", height: "420px" }}
          >
            <div
              className="px-4 py-1.5 shrink-0 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                ▸ COMMS
              </span>
              {/* A{N} tag — only in ?dev=1 mode, shows which ATC call is active */}
              {isDevMode && (() => {
                const activeD = atcPhase.kind === "active" ? atcPhase.d : atcPhase.kind === "standby" ? atcPhase.d : null;
                if (!activeD || !scenario.distractions) return null;
                const idx = scenario.distractions.findIndex(d => d.id === activeD.id);
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
                  }}>A{idx + 1}</span>
                );
              })()}
            </div>
            {/* Inner scroll container — comms modal is always fully visible */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {atcPhase.kind === "active" ? (
                <DistractionModal
                  distraction={atcPhase.d}
                  onRespond={handleAtcRespond}
                  onStandby={handleAtcStandby}
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
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
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
            {/* Body — single active step card; scrolls internally if card is tall */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {runner.status === "running" && !popupReady ? (
                <ActionGapCard />
              ) : runner.status === "running" && nextSoftwareStep ? (
                <FlightCheckPopup
                  scenario={scenario}
                  state={runner.state}
                  perform={performWithGap}
                  disabled={runner.status !== "running"}
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
    const isGlareshield = nextHardwareStep.group === "glareshield";
    const accent = isGlareshield ? "#FFB300" : "#FF3333";
    const hintLines = splitHint(nextHardwareStep.hint ?? "");

    return (
      <div className="font-mono flex flex-col" style={{ borderLeft: `3px solid ${accent}`, backgroundColor: accent === "#FF3333" ? "#0F0505" : "#0A0800" }}>
        {/* Top accent bar */}
        <div style={{ height: "2px", background: `linear-gradient(90deg, ${accent}, ${accent}00)` }} />

        {/* Attention banner */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ backgroundColor: accent + "18", borderBottom: `1px solid ${accent}35` }}
        >
          <span className="animate-pulse text-[18px]" style={{ lineHeight: 1 }}>←</span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold tracking-[0.25em] uppercase" style={{ color: accent }}>
              ACTION REQUIRED — LEFT PANEL
            </span>
            <span className="text-[7px] tracking-[0.18em] uppercase" style={{ color: accent + "70" }}>
              operate controls on the left display
            </span>
          </div>
        </div>

        {/* Step detail */}
        <div className="px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: accent }}>
              {nextHardwareStep.label}
            </span>
            <span
              className="text-[8px] px-2 py-0.5"
              style={{ backgroundColor: accent + "20", color: accent, border: `1px solid ${accent}40`, borderRadius: "2px" }}
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
                  <span style={{ color: "#8A9AAB", fontSize: "10px", lineHeight: "1.55", letterSpacing: "0.02em" }}>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {nextHardwareStep.crew && (
          <div className="px-4 pb-3">
            <span className="text-[7px] tracking-[0.18em] uppercase" style={{ color: "#3A4858" }}>
              {nextHardwareStep.crew} — {nextHardwareStep.group?.toUpperCase() ?? "PROCEDURE"}
            </span>
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
