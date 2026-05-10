/**
 * Pure (state, event) -> state reducer. Runs identically on client + server.
 */

import type { ScenarioState } from "./state";
import type { ScenarioEvent } from "./events";
import type { TriggerEffect } from "@/scenarios/types";

function applyEffect(state: ScenarioState, e: TriggerEffect): ScenarioState {
  switch (e.type) {
    case "ADD_ECAM":
      return {
        ...state,
        ecamMessages: [
          ...state.ecamMessages.filter(
            (m) => !e.messages.some((nm) => nm.id === m.id),
          ),
          ...e.messages,
        ],
      };
    case "CLEAR_ECAM":
      return {
        ...state,
        ecamMessages: state.ecamMessages.filter((m) => !e.ids.includes(m.id)),
      };
    case "SET_MASTER_WARN":
      return { ...state, masterWarnActive: e.active };
    case "SET_MASTER_CAUT":
      return { ...state, masterCautActive: e.active };
    case "SET_ALARM_LABEL":
      return { ...state, alarmLabel: e.label };
  }
}

export function reduce(state: ScenarioState, event: ScenarioEvent): ScenarioState {
  switch (event.kind) {
    case "STEP": {
      if (state.completedSteps[event.stepId]) return state;
      const order = Object.keys(state.completedSteps).length + 1;
      return {
        ...state,
        tMs: event.tMs,
        completedSteps: { ...state.completedSteps, [event.stepId]: order },
      };
    }
    case "DECISION": {
      if (state.decision) return state;
      return {
        ...state,
        tMs: event.tMs,
        decision: { value: event.value, tMs: event.tMs },
      };
    }
    case "TRIGGER": {
      if (state.triggersFired[event.triggerId]) return state;
      let next: ScenarioState = {
        ...state,
        tMs: event.tMs,
        triggersFired: { ...state.triggersFired, [event.triggerId]: event.tMs },
      };
      for (const effect of event.effects) {
        next = applyEffect(next, effect);
      }
      return next;
    }
    case "EFFECT": {
      // An EFFECT event represents the delayed side-effect of a step's
      // afterEffect.  Mark the source trigger id as fired so downstream
      // queries (e.g. fireLit = !triggersFired.fire_extinguished) work.
      let next: ScenarioState = {
        ...state,
        tMs: event.tMs,
        triggersFired: state.triggersFired[event.sourceId]
          ? state.triggersFired
          : { ...state.triggersFired, [event.sourceId]: event.tMs },
      };
      for (const effect of event.effects) {
        next = applyEffect(next, effect);
      }
      return next;
    }
    default: {
      const _exhaustive: never = event;
      return state;
    }
  }
}
