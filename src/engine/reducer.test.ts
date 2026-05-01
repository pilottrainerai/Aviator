import { describe, expect, it } from "vitest";
import { reduce } from "./reducer";
import { initialScenarioState } from "./state";
import type { ScenarioEvent } from "./events";

describe("scenario reducer", () => {
  it("records completed steps in order", () => {
    let state = initialScenarioState();
    const e1: ScenarioEvent = {
      kind: "STEP",
      stepId: "a",
      tMs: 100,
      source: "pilot",
    };
    const e2: ScenarioEvent = {
      kind: "STEP",
      stepId: "b",
      tMs: 200,
      source: "pilot",
    };
    state = reduce(state, e1);
    state = reduce(state, e2);
    expect(state.completedSteps).toEqual({ a: 1, b: 2 });
    expect(state.tMs).toBe(200);
  });

  it("ignores duplicate STEP events for the same id", () => {
    let state = initialScenarioState();
    state = reduce(state, {
      kind: "STEP",
      stepId: "a",
      tMs: 100,
      source: "pilot",
    });
    state = reduce(state, {
      kind: "STEP",
      stepId: "a",
      tMs: 200,
      source: "pilot",
    });
    expect(state.completedSteps).toEqual({ a: 1 });
  });

  it("applies trigger effects in order", () => {
    let state = initialScenarioState();
    state = reduce(state, {
      kind: "TRIGGER",
      triggerId: "fire",
      effects: [
        { type: "SET_MASTER_WARN", active: true },
        { type: "SET_ALARM_LABEL", label: "ENG 1 FIRE" },
        {
          type: "ADD_ECAM",
          messages: [{ id: "f1", line: "ENG 1 FIRE", level: "warning" }],
        },
      ],
      tMs: 1000,
      source: "system",
    });
    expect(state.masterWarnActive).toBe(true);
    expect(state.alarmLabel).toBe("ENG 1 FIRE");
    expect(state.ecamMessages).toHaveLength(1);
    expect(state.triggersFired.fire).toBe(1000);
  });

  it("CLEAR_ECAM removes a message by id", () => {
    let state = initialScenarioState();
    state = reduce(state, {
      kind: "TRIGGER",
      triggerId: "fire",
      effects: [
        {
          type: "ADD_ECAM",
          messages: [{ id: "f1", line: "ENG 1 FIRE", level: "warning" }],
        },
      ],
      tMs: 100,
      source: "system",
    });
    state = reduce(state, {
      kind: "EFFECT",
      sourceId: "extinguish",
      effects: [{ type: "CLEAR_ECAM", ids: ["f1"] }],
      tMs: 200,
      source: "system",
    });
    expect(state.ecamMessages).toHaveLength(0);
  });

  it("ignores duplicate TRIGGER events with the same triggerId", () => {
    let state = initialScenarioState();
    const trig: ScenarioEvent = {
      kind: "TRIGGER",
      triggerId: "fire",
      effects: [{ type: "SET_MASTER_WARN", active: true }],
      tMs: 1000,
      source: "system",
    };
    state = reduce(state, trig);
    const beforeT = state.tMs;
    state = reduce(state, { ...trig, tMs: 5000 });
    expect(state.tMs).toBe(beforeT);
  });

  it("locks decision once made", () => {
    let state = initialScenarioState();
    state = reduce(state, {
      kind: "DECISION",
      value: "LAND_ASAP",
      tMs: 1000,
      source: "pilot",
    });
    state = reduce(state, {
      kind: "DECISION",
      value: "CONTINUE",
      tMs: 2000,
      source: "pilot",
    });
    expect(state.decision?.value).toBe("LAND_ASAP");
  });
});
