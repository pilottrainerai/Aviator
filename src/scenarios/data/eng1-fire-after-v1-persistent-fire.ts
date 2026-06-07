import type { Scenario, ScenarioPhase } from "@/scenarios/types";
import { ENG1_FIRE_AFTER_V1_PERSISTENT_FIRE_META } from "@/scenarios/registry";
import { eng1FireAfterV1 } from "./eng1-fire-after-v1";

const persistentFireSteps = eng1FireAfterV1.steps.map((step) => {
  if (step.id !== "agent1") {
    return step;
  }

  return {
    ...step,
    hint: "PM waits ECAM 10 s countdown after FIRE pb, discharges AGENT 1, then monitors the fire warning for the full 30-second conditional gate.",
    afterEffect: {
      delayMs: 30_000,
      triggerId: "fire_persists_30s",
      effects: [
        {
          type: "CLEAR_ECAM" as const,
          ids: ["ecam_thr", "ecam_master", "ecam_fire_pb", "ecam_agent1", "ecam_400ft"],
        },
      ],
    },
  };
});

const persistentFirePhases: Scenario["phases"] = eng1FireAfterV1.phases?.map((phase): ScenarioPhase => {
  if (phase.id === "fire_extinguished_after_agent1") {
    return {
      id: "fire_persists_30s",
      label: "FIRE WARN PERSISTS — 30 S ELAPSED",
      atMs: 66_000,
      pfd: {
        speed: 210,
        targetSpeed: "V2+10",
        altitude: 1_800,
        targetAltitude: 3_000,
        verticalSpeed: 1_600,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        flags: ["ENG 1 FIRE pb — still illuminated"],
        notes: [
          "Fire warning persists 30 s after Agent 1 — AGENT 2 required",
          "ECAM clears primary lines — only IF FIRE WARN + AGENT 2 + LAND ASAP remain",
          "Primary CRC silenced — crew remains focused but not distracted",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Tracking SID/EO procedure — AP holding"],
      },
      pf: {
        task: "Confirm FIRE warning still on. Authorise AGENT 2 discharge. Monitor aircraft — remain on SRS to accel altitude.",
        callouts: [
          { role: "PM", speech: "FIRE WARNING AFTER 30 SECONDS" },
          { role: "PF", speech: "AGENT TWO — CONFIRM DISCHARGE" },
        ],
      },
      pm: {
        task: "Announce 'FIRE WARNING AFTER 30 SECONDS'. Read ECAM: AGENT 2 DISCH. PF confirms — discharge AGENT 2.",
        callouts: [{ role: "PM", speech: "ECAM — AGENT TWO DISCHARGE. DISCHARGING." }],
      },
      overhead: {
        items: [
          "ENG 1 FIRE P/B — illuminated (fire loop still active)",
          "AGENT 2 button — about to be pressed",
        ],
        notes: [
          "Last available extinguishing agent — no further restart possible",
          "LAND ASAP remains on ECAM regardless of outcome",
        ],
      },
    };
  }

  if (phase.id === "engine_secured") {
    return {
      ...phase,
      label: "ENGINE SECURED — FIRE EXTINGUISHED",
      atMs: 71_000,
      pfd: {
        speed: 215,
        targetSpeed: "V2+10",
        altitude: 2_000,
        targetAltitude: 3_000,
        verticalSpeed: 1_500,
        fmaThrust: "MAN TOGA",
        fmaPitch: "SRS",
        fmaLateral: "NAV",
        ap1: true,
        athr: false,
        notes: [
          "FIRE pb red light extinguished — fire confirmed out",
          "ENG MASTER FIRE light on overhead panel off",
          "ENG 1 N1 = 0, EGT cooling",
          "PM to announce ENGINE SECURED — accel sequence can begin after",
        ],
      },
      nd: {
        mode: "ARC",
        range: 10,
        heading: 280,
        activeWpt: "VIDP",
      },
      pf: {
        task: "Acknowledge ENGINE SECURED. Announce LAND ASAP. Prepare for acceleration at minimum accel altitude.",
        callouts: [
          { role: "PM", speech: "ENGINE SECURED" },
          { role: "PF", speech: "ENGINE SECURED — ACKNOWLEDGED" },
          { role: "PF", speech: "LAND ASAP — RETURN DELHI" },
        ],
      },
      pm: {
        task: "Announce 'ENGINE SECURED' once FIRE pb light goes out. Read secondary failures. Announce STATUS.",
        callouts: [
          { role: "PM", speech: "ENGINE SECURED. SECONDARY FAILURES ON ECAM — HYD, ELEC, AIR BLEED." },
          { role: "PM", speech: "STATUS APPEARING." },
        ],
      },
      overhead: {
        items: [
          "ENG 1 FIRE P/B — extinguished (dark) — fire out",
          "ENG 1 MASTER — OFF",
          "AGENT 1 + AGENT 2 — both DISCH",
          "GEN 1 — FAULT/OFF (IDG disconnected by FIRE PB)",
          "ENG 1 BLEED — FAULT (SOV closed by FIRE PB)",
        ],
        notes: ["All FIRE panel actions complete — engine is secured"],
      },
    };
  }

  if (phase.id === "accel_level_off") {
    return {
      ...phase,
      atMs: 78_000,
      pfd: {
        speed: 225,
        targetSpeed: "S",
        altitude: 2_800,
        targetAltitude: 3_000,
        verticalSpeed: 200,
        fmaThrust: "MAN TOGA",
        fmaPitch: "OP CLB",
        fmaLateral: "NAV",
        ap1: true,
        athr: true,
        notes: [
          "V/S 0 selected at MAA — aircraft levelling off",
          "A/THR activated — ENG 2 maintaining speed at TOGA then CLB",
          "SRS reverts to OP CLB as level-off captures at target alt",
          "F speed passed — FLAPS 1 retracted. S speed approaching — prepare FLAPS UP.",
          "Rudder trim maintained ~2 units right for single-engine",
        ],
      },
      nd: {
        mode: "ARC",
        range: 20,
        heading: 280,
        activeWpt: "VIDP",
        notes: ["Range increased to 20 nm for VIDP return planning"],
      },
      pf: {
        task: "V/S 0 at MAA. Call FLAPS 1 at F speed, FLAPS UP at S speed. Call MCT at green dot. Monitor A/THR.",
        callouts: [
          { role: "PF", speech: "V/S ZERO — LEVELLING OFF" },
          { role: "PF", speech: "FLAPS ONE" },
          { role: "PM", speech: "SPEED CHECKED — FLAPS ONE" },
          { role: "PF", speech: "FLAPS UP" },
          { role: "PM", speech: "SPEED CHECKED — FLAPS UP — CONFIG CLEAN" },
          { role: "PF", speech: "MCT" },
          { role: "PM", speech: "MCT — THRUST SET" },
        ],
      },
      pm: {
        task: "Cross-check each flap selection (check speed before calling back). Verify CONFIG CLEAN on ECAM. Set MCT on PF call.",
        callouts: [{ role: "PM", speech: "SINGLE ENGINE — MCT SET — GREEN DOT TARGET" }],
      },
      overhead: {
        items: ["No new overhead actions — all ENG FIRE panel items already completed"],
        notes: ["After Takeoff CL to follow: ECAM ACTIONS COMPLETE → normal CL → OEB → STATUS"],
      },
    };
  }

  return phase;
});

export const eng1FireAfterV1PersistentFire: Scenario = {
  ...eng1FireAfterV1,
  meta: ENG1_FIRE_AFTER_V1_PERSISTENT_FIRE_META,
  brief: {
    ...eng1FireAfterV1.brief,
    job: "PF: Aviate, stabilise, and authorise AGENT 2 only if the fire warning persists after the 30-second monitor. PM: Run the ECAM in order and execute the conditional branch correctly.",
  },
  steps: persistentFireSteps,
  phases: persistentFirePhases,
};
