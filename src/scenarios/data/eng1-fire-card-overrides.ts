import type { ScenarioStep } from "@/scenarios/types";

// Card design metadata (four-corner, per `training-card-ui`) for ENG 1 FIRE — same system
// as DUAL HYD G+Y. EVERY step is tagged, including HARDWARE steps: G+Y tags its hardware
// ECAM actions (ptu_off/pump_off = hardware:true + ECAM/FCOM), so the fire-drill hardware
// (THR LEVER, ENG MASTER, FIRE PB, AGENT, MASTER WARN/CAUT) must carry ECAM/FCOM too — they
// ARE the FCOM PRO-ABN-ENG ECAM procedure. [audited vs G+Y 2026-07-11]
// category = KIND of task (ECAM/AVIATE/PROCEDURE/COMMS/CRM/CHECKLIST/QRH/GLARESHIELD);
// reference = the manual (FCOM/FCTM/QRH) or TECHNIQUE — manual-first, tagged only if truly in it.
// Governed by the a320-eng-fire + training-card-ui skills.

type StepOverride = Partial<Pick<ScenarioStep, "label" | "action" | "hint" | "variant" | "crew" | "category" | "reference" | "hardware" | "optional" | "group" | "flashSurface">>;

export const eng1FireCardOverrides: Record<string, StepOverride> = {
  // ── AVIATE — fly the path (both engines up until THR IDLE). flashSurface "pfd" so the
  //    guidance pointer lands on the PFD (fly), not the procedure card — the G+Y pointer model. ──
  continue_rotation:     { category: "AVIATE", reference: "FCTM", flashSurface: "pfd" },
  positive_rate_gear_up: { category: "AVIATE", reference: "FCOM", flashSurface: "pfd" },   // gear-up callout = FCOM normal SOP
  engage_ap_fma:         { category: "AVIATE", reference: "FCTM", flashSurface: "pfd" },
  maintain_direction:    { category: "AVIATE", reference: "FCTM · TECHNIQUE", flashSurface: "pfd" },  // single-engine β on the PFD
  level_off_maa:         { category: "AVIATE", reference: "FCTM", flashSurface: "pfd" },
  accel_clean:           { category: "AVIATE", reference: "FCTM", flashSurface: "pfd" },
  slats_up:              { category: "AVIATE", reference: "FCTM", flashSurface: "pfd" },   // SLATS UP at S speed = AVIATE config
  pull_alt_op_clb:       { category: "AVIATE", reference: "FCTM", flashSurface: "pfd" },
  mct_open_clb:          { category: "AVIATE", reference: "FCTM", flashSurface: "pfd" },

  // ── GLARESHIELD — master lights (hardware) ──
  cancel_master_warn:    { category: "ECAM", reference: "FCOM" },          // G+Y: cancel_master_warn = ECAM/FCOM
  cancel_master_caut:    { category: "GLARESHIELD", reference: "FCOM" },   // G+Y: cancel_master_caut = GLARESHIELD/FCOM

  // ── ECAM — the fire tree (all FCOM PRO-ABN-ENG). Hardware ECAM actions tagged too, per G+Y ──
  four_hundred_ft_cmd:   { category: "PROCEDURE", reference: "FCTM" },      // the 400 ft aviate-complete gate is a PROCEDURE/FCTM step, NOT an ECAM line [user 2026-07-12]
  identify_eng1_fire:    { category: "ECAM", reference: "FCOM" },          // ECAM title/cause = FCOM (G+Y verify_hyd_cause), NOT FCTM
  verify_eng1_fire:      { category: "ECAM", reference: "FCOM", flashSurface: "firepanel" }, // verify fire vs FIRE panel + ENG START + SD
  thr_lever_idle:        { category: "ECAM", reference: "FCOM" },          // hardware ECAM action
  eng1_master_off:       { category: "ECAM", reference: "FCOM" },          // hardware ECAM action (confirm)
  eng1_fire_pb:          { category: "ECAM", reference: "FCOM" },          // hardware ECAM action (confirm)
  agent1:                { category: "ECAM", reference: "FCOM" },          // hardware ECAM action
  agent2:                { category: "ECAM", reference: "FCOM" },          // hardware ECAM action
  engine_secured:        { category: "ECAM", reference: "FCOM" },
  // ENG SHUT DOWN follow-on (surfaces after securing)
  sd_mode_ign:           { category: "ECAM", reference: "FCOM" },
  sd_imbalance:          { category: "ECAM", reference: "FCOM" },
  sd_tcas_ta:            { category: "ECAM", reference: "FCOM" },
  sd_x_bleed:            { category: "ECAM", reference: "FCOM" },   // applies — FIRE pb pushed (FCOM P71-74)
  sd_wing_ai:            { category: "ECAM", reference: "FCOM" },   // applies — FIRE pb pushed
  announce_land_asap:    { category: "ECAM", reference: "FCOM" },
  // review + CLEAR each SD page (ENG 2 video + G+Y clear_* pattern)
  clear_eng_fire:        { category: "ECAM", reference: "FCOM" },
  clear_eng:             { category: "ECAM", reference: "FCOM" },
  clear_air_bleed:       { category: "ECAM", reference: "FCOM" },
  clear_elec:            { category: "ECAM", reference: "FCOM" },
  clear_hyd:             { category: "ECAM", reference: "FCOM" },
  announce_status:       { category: "ECAM", reference: "FCOM" },
  stop_ecam:             { category: "ECAM", reference: "FCOM" },
  read_status:           { category: "ECAM", reference: "FCOM" },
  status_read_aloud:     { category: "ECAM", reference: "FCOM" },
  crew_crosscheck:       { category: "ECAM", reference: "FCOM" },

  // ── PROCEDURE — crew calc / prep (non-ECAM/QRH task): OEB, landing dist, FORDEC, FMGC/APPR prep ──
  oeb_check:             { category: "PROCEDURE", reference: "FCTM" },     // G+Y oeb_check = PROCEDURE/FCTM
  ldg_perf:              { category: "PROCEDURE", reference: "QRH" },      // G+Y ldg_perf = PROCEDURE/QRH
  fordec:                { category: "PROCEDURE", reference: "TECHNIQUE" },// G+Y fordec = PROCEDURE/TECHNIQUE
  fmgc_prep:             { category: "PROCEDURE", reference: "FCOM" },     // G+Y fmgc_prep = PROCEDURE/FCOM
  approach_prep:         { category: "PROCEDURE", reference: "FCTM" },     // approach setup = prep (PROCEDURE)

  // ── CHECKLIST ──
  after_takeoff_cl:      { category: "CHECKLIST", reference: "FCOM" },
  approach_cl:           { category: "CHECKLIST", reference: "FCOM" },
  landing_cl:            { category: "CHECKLIST", reference: "FCOM" },

  // ── COMMS — ATC / company radio ──
  mayday_atc:            { category: "COMMS", reference: "TECHNIQUE" },
  pm_hold_req:           { category: "COMMS", reference: "TECHNIQUE" },
  wx_request:            { category: "COMMS", reference: "TECHNIQUE" },
  intention_to_atc:      { category: "COMMS", reference: "TECHNIQUE" },
  company_notify:        { category: "COMMS", reference: "TECHNIQUE" },
  atc_emergency_services:{ category: "CRM · COMMS", reference: "TECHNIQUE" }, // emergency-svcs advisory = CRM (taxonomy)

  // ── CRM — briefings / PA / human-factors ──
  nis_brief:             { category: "CRM · COMMS", reference: "TECHNIQUE" }, // G+Y nis_brief_hyd = CRM·COMMS/TECHNIQUE
  pax_pa:                { category: "CRM · COMMS", reference: "TECHNIQUE" },
  approach_brief:        { category: "CRM", reference: "FCTM" },   // NORMAL half (standard ILS)
  approach_brief_abnormal: { category: "CRM", reference: "FCTM" }, // ABNORMAL half (single-engine FCTM highlights)
  go_around_review:      { category: "CRM", reference: "FCTM" },
};

export function applyEng1FireCardOverrides(steps: readonly ScenarioStep[]): ScenarioStep[] {
  return steps.map((step) => {
    const override = eng1FireCardOverrides[step.id];
    return override ? { ...step, ...override } : step;
  });
}
