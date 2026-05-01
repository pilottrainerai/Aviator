import { describe, expect, it } from "vitest";
import { scoreSessionMock } from "./mock";
import { eng1FireAfterV1 } from "@/scenarios/data/eng1-fire-after-v1";
import { initialScenarioState } from "@/engine/state";
import type { ScenarioEvent } from "@/engine/events";

const state = initialScenarioState();

describe("mock scorer", () => {
  it("scores a perfect run at 100", () => {
    const events: ScenarioEvent[] = [
      { kind: "STEP", stepId: "eng1_master_off", tMs: 9000, source: "pilot" },
      { kind: "STEP", stepId: "eng1_fire_pb", tMs: 11000, source: "pilot" },
      { kind: "STEP", stepId: "agent1", tMs: 13000, source: "pilot" },
      { kind: "DECISION", value: "LAND_ASAP", tMs: 25000, source: "pilot" },
    ];
    const out = scoreSessionMock({
      scenario: eng1FireAfterV1,
      events,
      finalState: state,
    });
    expect(out.compositeScore).toBe(100);
    expect(out.rubric.correctness.score).toBe(100);
    expect(out.rubric.sequence.score).toBe(100);
    expect(out.rubric.decision.score).toBe(100);
  });

  it("flags missing required steps", () => {
    const events: ScenarioEvent[] = [
      { kind: "DECISION", value: "LAND_ASAP", tMs: 25000, source: "pilot" },
    ];
    const out = scoreSessionMock({
      scenario: eng1FireAfterV1,
      events,
      finalState: state,
    });
    expect(out.rubric.correctness.score).toBeLessThan(50);
    expect(out.rubric.correctness.evidence).toMatch(/Missing/);
  });

  it("penalizes wrong decisions", () => {
    const events: ScenarioEvent[] = [
      { kind: "STEP", stepId: "eng1_master_off", tMs: 9000, source: "pilot" },
      { kind: "STEP", stepId: "eng1_fire_pb", tMs: 11000, source: "pilot" },
      { kind: "STEP", stepId: "agent1", tMs: 13000, source: "pilot" },
      { kind: "DECISION", value: "CONTINUE", tMs: 25000, source: "pilot" },
    ];
    const out = scoreSessionMock({
      scenario: eng1FireAfterV1,
      events,
      finalState: state,
    });
    expect(out.rubric.decision.score).toBeLessThan(20);
  });

  it("flags out-of-order steps", () => {
    const events: ScenarioEvent[] = [
      // AGENT 1 before FIRE pb before MASTER OFF — backwards
      { kind: "STEP", stepId: "agent1", tMs: 9000, source: "pilot" },
      { kind: "STEP", stepId: "eng1_fire_pb", tMs: 11000, source: "pilot" },
      { kind: "STEP", stepId: "eng1_master_off", tMs: 13000, source: "pilot" },
      { kind: "DECISION", value: "LAND_ASAP", tMs: 25000, source: "pilot" },
    ];
    const out = scoreSessionMock({
      scenario: eng1FireAfterV1,
      events,
      finalState: state,
    });
    expect(out.rubric.sequence.score).toBeLessThan(100);
    expect(out.rubric.sequence.evidence).toMatch(/before/);
  });
});
