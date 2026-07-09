import type { ScenarioStep } from "@/scenarios/types";

type StepOverride = Partial<Pick<ScenarioStep, "label" | "action" | "hint" | "variant" | "crew" | "category" | "reference" | "hardware" | "optional" | "group">>;

export const dualHydGYCardOverrides: Record<string, StepOverride> = {
  cancel_master_warn: {
    category: "ECAM",
    reference: "FCOM",
  },
  maintain_control: {
    category: "AVIATE",
    reference: "FCTM",
  },
  request_routing: {
    category: "NAVIGATE",
    reference: "FCTM · TECHNIQUE",
    crew: "PF",
  },
  declare_mayday: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  mayday_ack: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  start_descent: {
    category: "AVIATE",
    reference: "FCTM · TECHNIQUE",
  },
  descent_10k_requested: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  descent_10k_cleared: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  cleared_10000: {
    category: "AVIATE",
    reference: "TECHNIQUE",
    hint: "ATC cleared 10 000 ft — PF sets the FCU altitude to 10 000.  FMA ALT window → 10 000; OPEN DES.",
  },
  verify_hyd_cause: {
    category: "ECAM",
    reference: "FCOM",
    hint: "HYD SD......ANALYSE. CAUSE......RSVR LO LVL.",
  },
  ecam_actions: {
    category: "ECAM",
    reference: "FCOM",
    group: "procedure",
    hint: "PF: aircraft under control, navigated, MAYDAY declared → command ECAM ACTIONS (by pressing the ECAM).",
  },
  ptu_off: {
    category: "ECAM",
    reference: "FCOM",
    group: "procedure",
    hint: "PM: HYD overhead — PTU pushbutton → OFF. PTU is the first ECAM action for G+Y loss; deactivate to prevent dry cycling.",
  },
  grn_eng1_pump_off: {
    category: "ECAM",
    reference: "FCOM",
    group: "procedure",
    hint: "PM: HYD overhead — GREEN ENG 1 PUMP pushbutton → OFF. AFFECTED PUMPS OFF — GREEN system pressure unrecoverable; switch off to stop dry running.",
  },
  yel_eng2_pump_off: {
    category: "ECAM",
    reference: "FCOM",
    group: "procedure",
    hint: "PM: HYD overhead — YELLOW ENG 2 PUMP pushbutton → OFF. AFFECTED PUMPS OFF — YELLOW system pressure unrecoverable; switch off.",
  },
  speed_set: {
    category: "ECAM",
    reference: "FCOM",
    label: "MANEUVER WITH CARE",
    action: "MAX 320/0.77",
  },
  clear_auto_flt: {
    category: "ECAM",
    reference: "FCOM",
  },
  clear_hyd_gy: {
    category: "ECAM",
    reference: "FCOM",
  },
  clear_hyd_ptu: {
    category: "ECAM",
    reference: "FCOM",
  },
  clear_fctl: {
    category: "ECAM",
    reference: "FCOM",
  },
  land_asap_card: {
    category: "ECAM",
    reference: "FCOM",
    hint: "PM/PF: LAND ASAP (red) — land at the nearest airport where a safe landing can be made. MAYDAY has already been declared.",
  },
  fctl_check: {
    category: "ECAM",
    reference: "FCOM",
    label: "FLIGHT CONTROL PAGE CHECK",
  },
  wheel_check: {
    category: "ECAM",
    reference: "FCOM",
    label: "WHEEL PAGE CHECK",
  },
  cancel_master_caut: {
    category: "GLARESHIELD",
    reference: "FCOM",
  },
  announce_status: {
    category: "ECAM",
    reference: "FCOM",
  },
  stop_ecam: {
    category: "ECAM",
    reference: "FCOM",
  },
  oeb_check: {
    category: "PROCEDURE",
    reference: "FCTM",
  },
  read_status: {
    category: "ECAM",
    reference: "FCOM",
  },
  status_read_aloud: {
    category: "ECAM",
    reference: "FCOM",
    action: "READ",
    hint: "PM reads each STATUS limitation/memo line aloud; PF: 'CHECKED' after each.",
  },
  inop_sys_card: {
    category: "ECAM",
    reference: "FCOM",
    action: "REVIEW",
    hint: "PM reads the INOP SYS list from the STATUS page; PF cross-checks.  CLR to view the next INOP systems.",
  },
  clear_status_overflow: {
    category: "ECAM",
    reference: "FCOM",
    action: "READ",
    hint: "PM reads the REMAINING INOP systems aloud.",
  },
  crew_crosscheck: {
    category: "ECAM",
    reference: "FCOM",
  },
  qrh_summary_gy: {
    category: "QRH",
    reference: "QRH",
    action: "READ",
    hint: "PM reads the CRUISE part of the QRH HYD G+Y SYS LO PR summary aloud.",
  },
  weather_obtained: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  approach_freq_switched: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  ldg_perf: {
    category: "PROCEDURE",
    reference: "QRH",
  },
  fordec_hyd: {
    category: "PROCEDURE",
    reference: "TECHNIQUE",
  },
  inform_atc_intentions: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  intentions_acked: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  fmgc_prep: {
    category: "PROCEDURE",
    reference: "FCOM",
  },
  qrh_review: {
    category: "QRH",
    reference: "QRH",
    action: "READ",
    hint: "PM/PF read aloud the APPROACH / LANDING / GO-AROUND parts of the QRH HYD G+Y SYS LO PR summary.",
  },
  nis_brief_hyd: {
    category: "CRM · COMMS",
    reference: "TECHNIQUE",
  },
  pax_pa: {
    category: "CRM · COMMS",
    reference: "TECHNIQUE",
  },
  inform_company: {
    category: "CRM · COMMS",
    reference: "TECHNIQUE",
  },
  atc_emergency_svcs: {
    category: "CRM · COMMS",
    reference: "TECHNIQUE",
  },
  emg_services_sent: {
    category: "CRM · COMMS",
    reference: "TECHNIQUE",
  },
  gpws_ldg_flap3: {
    category: "ECAM",
    reference: "QRH",
    group: "procedure",
  },
  gpws_flap_mode: {
    category: "ECAM",
    reference: "QRH",
    group: "procedure",
  },
  approach_prep_hyd: {
    category: "PROCEDURE",
    reference: "FCOM",
  },
  approach_brief_normal_ils: {
    category: "CRM",
    reference: "FCTM",
  },
  approach_brief_hyd: {
    category: "CRM",
    reference: "FCTM",
  },
  approach_brief_landing: {
    category: "CRM",
    reference: "FCTM",
  },
  approach_brief_ga: {
    category: "CRM",
    reference: "FCTM",
  },
  prep_ready: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  prep_late: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  vectors_requested: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  holdpattern_requested: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  descent_7k_cleared: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  hold_cleared: {
    category: "AVIATE",
    reference: "FCOM",
  },
  at_hold_7000: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  cont_descent_acked: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  at_13000: {
    category: "AVIATE",
    reference: "TECHNIQUE",
  },
  approach_cl_hyd: {
    category: "CHECKLIST",
    reference: "FCOM",
  },
  ready_app_reported: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  approach_cleared: {
    category: "COMMS",
    reference: "TECHNIQUE",
  },
  descend_3700: {
    category: "AVIATE",
    reference: "TECHNIQUE",
    label: "DESCEND 3 700",
    action: "OPEN DES · LEVEL 3700",
  },
  at_level_3700: {
    category: "AVIATE",
    reference: "TECHNIQUE",
    label: "LEVEL 3 700",
  },
  flap_1: {
    category: "AVIATE",
    reference: "QRH · TECHNIQUE",
  },
  flap_2: {
    category: "AVIATE",
    reference: "QRH · TECHNIQUE",
  },
  flap_3: {
    category: "AVIATE",
    reference: "QRH · TECHNIQUE",
  },
  configure_for_approach: {
    category: "AVIATE",
    reference: "QRH",
  },
  lgr_gravity: {
    category: "PROCEDURE",
    reference: "QRH · TECHNIQUE",
    action: "DEPLOY AT 3700",
  },
  gs_intercept: {
    category: "AVIATE",
    reference: "FCTM",
  },
  touched_down: {
    category: "AVIATE",
    reference: "QRH · TECHNIQUE",
    hint: "Main-gear touchdown on RWY 27 — rollout, decelerating to stop.  Brakes: YELLOW ACCU pressure only — MAX 1 000 PSI, approx. 7 applications. NO anti-skid. NO reverse thrust. Apply firmly and hold — do NOT pump. Once accumulator depleted, NO further braking available.",
  },
  full_stop: {
    category: "AVIATE",
    reference: "TECHNIQUE",
  },
};

export function applyDualHydGYCardOverrides(steps: readonly ScenarioStep[]): ScenarioStep[] {
  return steps.map((step) => {
    const override = dualHydGYCardOverrides[step.id];
    return override ? { ...step, ...override } : step;
  });
}
