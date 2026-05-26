import type { ScenarioState } from "@/engine/state";
import type { Scenario, ScenarioStep } from "@/scenarios/types";

type TriggerState = Pick<ScenarioState, "triggersFired">;

export function isStepApplicable(
  step: ScenarioStep,
  state?: TriggerState,
): boolean {
  if (!step.requiresTrigger) return true;
  return !!state?.triggersFired[step.requiresTrigger];
}

export function getApplicableRequiredSteps(
  scenario: Scenario,
  state?: TriggerState,
): ScenarioStep[] {
  return scenario.steps.filter(
    (step) => !step.optional && isStepApplicable(step, state),
  );
}

export function isStepCurrent(step: ScenarioStep, state: ScenarioState): boolean {
  if (state.completedSteps[step.id]) return false;
  if (!isStepApplicable(step, state)) return false;
  return (step.requires ?? []).every((requiredStepId) => !!state.completedSteps[requiredStepId]);
}