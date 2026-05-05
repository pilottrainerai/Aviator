"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { reduce } from "@/engine/reducer";
import { initialScenarioState, type ScenarioState } from "@/engine/state";
import type { ScenarioEvent, PilotAction } from "@/engine/events";
import type { Scenario } from "@/scenarios/types";

const TICK_HZ = 10;
const TICK_INTERVAL_MS = 1000 / TICK_HZ;

export type RunnerStatus = "running" | "ended";

export type RunnerHandle = {
  state: ScenarioState;
  events: ScenarioEvent[];
  elapsedMs: number;
  status: RunnerStatus;
  paused: boolean;
  perform: (action: PilotAction) => void;
  end: () => void;
  pause: () => void;
  resume: () => void;
  /** Manually fire a trigger by id (dev mode only). No-op if already fired. */
  fireTrigger: (triggerId: string) => void;
};

export function useScenarioRunner(scenario: Scenario): RunnerHandle {
  const [state, dispatch] = useReducer(reduce, undefined, initialScenarioState);
  const [events, setEvents] = useState<ScenarioEvent[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<RunnerStatus>("running");
  const [paused, setPaused] = useState(false);

  const startedAtRef = useRef<number>(performance.now());
  const pausedElapsedRef = useRef<number | null>(null);
  const firedTriggersRef = useRef<Set<string>>(new Set());
  const sideEffectTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Tick loop — fires scenario timed triggers as wall-clock crosses thresholds.
  // Stops when paused or ended.
  useEffect(() => {
    if (status !== "running" || paused) return;
    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startedAtRef.current;
      setElapsedMs(elapsed);

      for (const trig of scenario.triggers) {
        if (
          elapsed >= trig.atMs &&
          !firedTriggersRef.current.has(trig.id)
        ) {
          firedTriggersRef.current.add(trig.id);
          const evt: ScenarioEvent = {
            kind: "TRIGGER",
            triggerId: trig.id,
            effects: trig.effects,
            tMs: elapsed,
            source: "system",
          };
          dispatch(evt);
          setEvents((prev) => [...prev, evt]);
        }
      }
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [scenario, status, paused]);

  useEffect(() => {
    if (status === "ended") {
      sideEffectTimersRef.current.forEach((t) => clearTimeout(t));
      sideEffectTimersRef.current.clear();
    }
  }, [status]);

  const perform = useCallback(
    (action: PilotAction) => {
      if (status !== "running") return;
      const tMs = performance.now() - startedAtRef.current;
      const evt: ScenarioEvent = { ...action, tMs, source: "pilot" };
      dispatch(evt);
      setEvents((prev) => [...prev, evt]);

      // Schedule the step's after-effect, if any
      if (action.kind === "STEP") {
        const step = scenario.steps.find((s) => s.id === action.stepId);
        if (step?.afterEffect) {
          const { delayMs, triggerId, effects } = step.afterEffect;
          const timer = setTimeout(() => {
            const t = performance.now() - startedAtRef.current;
            const effectEvt: ScenarioEvent = {
              kind: "EFFECT",
              sourceId: triggerId,
              effects,
              tMs: t,
              source: "system",
            };
            dispatch(effectEvt);
            setEvents((prev) => [...prev, effectEvt]);
            sideEffectTimersRef.current.delete(timer);
          }, delayMs);
          sideEffectTimersRef.current.add(timer);
        }
      }
    },
    [scenario, status],
  );

  const pause = useCallback(() => {
    pausedElapsedRef.current = performance.now() - startedAtRef.current;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (pausedElapsedRef.current !== null) {
      // Shift startedAt forward so elapsed continues from the paused snapshot
      startedAtRef.current = performance.now() - pausedElapsedRef.current;
    }
    pausedElapsedRef.current = null;
    setPaused(false);
  }, []);

  const fireTrigger = useCallback(
    (triggerId: string) => {
      if (firedTriggersRef.current.has(triggerId)) return;
      const trig = scenario.triggers.find((t) => t.id === triggerId);
      if (!trig) return;
      firedTriggersRef.current.add(triggerId);
      const tMs = pausedElapsedRef.current ?? (performance.now() - startedAtRef.current);
      const evt: ScenarioEvent = {
        kind: "TRIGGER",
        triggerId: trig.id,
        effects: trig.effects,
        tMs,
        source: "system",
      };
      dispatch(evt);
      setEvents((prev) => [...prev, evt]);
    },
    [scenario],
  );

  const end = useCallback(() => {
    setStatus("ended");
  }, []);

  return { state, events, elapsedMs, status, paused, perform, end, pause, resume, fireTrigger };
}

export const TICK_INTERVAL_MS_PUBLIC = TICK_INTERVAL_MS;
