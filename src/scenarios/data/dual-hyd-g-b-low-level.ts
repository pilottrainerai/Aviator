import type { Scenario, ScenarioPhase, ScenarioStep, SysSwitchDef } from "@/scenarios/types";
import { DUAL_HYD_G_B_LOW_LEVEL_META } from "@/scenarios/registry";
import { dualHydGB } from "./dual-hyd-g-b";

const baseEngineDisplay = dualHydGB.engineDisplay!;

const ptuOffStep: ScenarioStep = {
  id: "ptu_off",
  label: "PTU",
  action: "OFF",
  hint: "PM: if the green system is lost due to low level, the HYD PTU FAULT message may appear and request PTU OFF. Switch the PTU OFF before continuing with the G+B low-pressure procedure.",
  variant: "switch",
  crew: "PM",
  hardware: true,
  ecamRef: "ecam_ptu_off",
  requires: ["cancel_master_warn"],
};

const baseSteps = dualHydGB.steps.map((step) => {
  if (step.id === "rat_man_on") {
    return {
      ...step,
      requires: ["ptu_off"],
    };
  }

  return step;
});

const ratIndex = baseSteps.findIndex((step) => step.id === "rat_man_on");

const steps = [
  ...baseSteps.slice(0, ratIndex),
  ptuOffStep,
  ...baseSteps.slice(ratIndex),
];

const triggers = dualHydGB.triggers.map((trigger) => {
  if (trigger.id !== "structural_fail") {
    return trigger;
  }

  return {
    ...trigger,
    description:
      "HYD G+B SYS LO PR - green system low level with HYD PTU FAULT and blue system low pressure. Level 3 WARNING (CRC + MASTER WARN), LAND ASAP red.",
    effects: trigger.effects.map((effect) => {
      if (effect.type !== "ADD_ECAM") {
        return effect;
      }

      return {
        ...effect,
        messages: [
          ...effect.messages.slice(0, 3),
          { id: "hyd_ptu_fault", line: "HYD PTU FAULT", level: "caution" as const },
          { id: "ecam_ptu_off", line: "PTU.........OFF", level: "advisory" as const },
          ...effect.messages.slice(3),
        ],
      };
    }),
  };
});

const controlPanel = baseEngineDisplay.controlPanel ?? [];
const ratControlIndex = controlPanel.findIndex((control) => control.stepId === "rat_man_on");
const basePhases = dualHydGB.phases ?? [];

const hydTraySwitches = dualHydGB.systemTabs?.find((tab) => tab.id === "hyd")?.tray?.switches ?? [];

const ptuSwitch: SysSwitchDef = {
  label: "PTU",
  states: [
    { when: { step: "ptu_off" }, value: "off" },
    { when: { trigger: "structural_fail" }, value: "fault" },
    { value: "norm" },
  ],
};

const lowLevelPhases: ScenarioPhase[] = [
  ...basePhases.slice(0, 2),
  {
    id: "ptu_fault_entry",
    label: "GREEN LOW LEVEL - PTU FAULT",
    atMs: 10_000,
    pfd: {
      speed: 280,
      targetSpeed: "280 SELECTED",
      altitude: 35_000,
      targetAltitude: 35_000,
      verticalSpeed: 0,
      fmaThrust: "SPEED",
      fmaPitch: "ALT",
      fmaLateral: "NAV",
      ap1: false,
      athr: true,
      flags: ["HYD PTU FAULT"],
      notes: [
        "This low-level entry path adds HYD PTU FAULT before the standard G+B flow continues.",
        "Aircraft remains hand flown in ALTN LAW while PTU OFF is actioned.",
      ],
    },
    nd: {
      mode: "ARC",
      range: 80,
      heading: 220,
      notes: ["Route remains unchanged while the extra PTU action is completed."],
    },
    pf: {
      task: "Continue to hand fly the aircraft and keep the flight path steady while PM actions the extra PTU fault step.",
    },
    pm: {
      task: "Action HYD PTU FAULT - PTU OFF, then continue the standard G+B ECAM sequence with RAT and pump actions.",
    },
    overhead: {
      items: ["PTU - OFF"],
      notes: ["This additional PTU action is specific to the green low-level entry path."],
    },
  },
  ...basePhases.slice(2).map((phase) => {
    if (phase.id !== "hyd_warning") {
      return phase;
    }

    return {
      ...phase,
      pfd: phase.pfd
        ? {
            ...phase.pfd,
            flags: [...(phase.pfd.flags ?? []), "HYD PTU FAULT"],
            notes: [
              ...(phase.pfd.notes ?? []),
              "Green low level is the entry mechanism in this variant.",
            ],
          }
        : phase.pfd,
      overhead: phase.overhead
        ? {
            ...phase.overhead,
            notes: [
              ...(phase.overhead.notes ?? []),
              "Expect PTU OFF to be added before the standard RAT and pump actions.",
            ],
          }
        : phase.overhead,
    };
  }),
];

export const dualHydGBLowLevel: Scenario = {
  ...dualHydGB,
  meta: DUAL_HYD_G_B_LOW_LEVEL_META,
  brief: {
    situation:
      "Cruise FL350, VIDP-VABB. The GREEN hydraulic system is lost due to low level and the BLUE system is simultaneously lost, triggering HYD G+B SYS LO PR. Because the green system is lost by low level, the HYD PTU FAULT message also appears and requests PTU OFF before the crew continues with the dual-hydraulic procedure.",
    job:
      "Aviate first, cancel the warning, then action the extra HYD PTU FAULT step before continuing the standard G+B low-pressure path. After PTU OFF, continue with RAT MAN ON for the blue ELEC pump entry path, affected pumps OFF, LAND ASAP, and the FLAP 3 direct-law landing profile.",
  },
  triggers,
  steps,
  engineDisplay: {
    ...baseEngineDisplay,
    controlPanel: [
      ...controlPanel.slice(0, ratControlIndex),
      { stepId: "ptu_off", kind: "toggle_sw", label: "PTU", sub: "OFF" },
      ...controlPanel.slice(ratControlIndex),
    ],
  },
  systemTabs: (dualHydGB.systemTabs ?? []).map((tab) => {
    if (tab.id !== "hyd") {
      return tab;
    }

    return {
      ...tab,
      tray: tab.tray
        ? {
            ...tab.tray,
            note: "Low-level/PTU entry path: green loss by low level adds HYD PTU FAULT and PTU OFF before the standard G+B landing profile.",
            switches: [
              ...hydTraySwitches.slice(0, 3),
              ptuSwitch,
              ...hydTraySwitches.slice(3),
            ],
          }
        : tab.tray,
    };
  }),
  phases: lowLevelPhases,
};