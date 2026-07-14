export interface AircraftState {
  speed:         number;  // CAS kt
  altitude:      number;  // ft
  heading:       number;  // °mag
  pitch:         number;  // ° nose-up positive
  bank:          number;  // ° right positive
  vs:            number;  // ft/min
  selectedSpeed: number;
  selectedAlt:   number;
  selectedHdg:   number;
  apEngaged:     boolean;
  apDual?:       boolean;  // true → FMA shows "AP1+2" (both APs); false/undefined → "AP1" (single AP — the default) [user: "autopilot only one"]
  athrActive:    boolean;  // A/THR actively managing thrust (green in FMA col 5)
  athrArmed?:    boolean;  // A/THR pb pressed but levers in manual detent (blue in FMA col 5)
  srsCyan?:      boolean;  // SRS displayed cyan (armed, before liftoff) vs green (active)
  altArmed?:     boolean;  // ALT armed (blue, FMA col-2 row 2) — descending/climbing toward the selected alt
  thrMode:       string;  // FMA col-1 label: 'MAN TOGA'|'MAN MCT'|'THR CLB'|'THR MCT'|'THR IDLE'|'TOGA LK'
  thrCue?:       string;  // FMA col-1 third line cue (flashing white): 'LVR CLB'|'LVR MCT'
  vertMode:      string;  // FMA col-2 label: 'SRS'|'CLB'|'OP CLB'|'ALT'|'ALT*'|'V/S'
  latMode:       string;  // 'NAV' | 'HDG' | 'TRACK' | 'LOC'
  masterWarn:    boolean;
  masterCaut:    boolean;
  eng1Failed:    boolean;
  eng2Failed:    boolean;
  gs:            number;  // ground speed kt
  tas:           number;  // true airspeed kt
  windDir:       number;  // wind from °
  windSpd:       number;  // wind kt
  track:         number;  // track angle °
  vmax?:         number;  // VMO/MMO red barber-pole limit (KCAS); falls back to 220
  // Flight-control law. NORMAL = green "=" pitch-limit bars on PFD; ALTN/DIRECT =
  // amber Xs replace them (FCOM DSC-27-20-20); DIRECT also shows "USE MAN PITCH
  // TRIM" amber in the FMA 3rd line (FCOM DSC-22-30-100).
  law?:          'NORMAL' | 'ALTN' | 'DIRECT';
  vls?:          number;  // lowest-selectable-speed — V_LS inverted-L (amber strip); falls back to the demo default
  alphaProt?:    number;  // V α-Prot — top of the amber/black barber below V_LS (drawVLS splits V_LS/α-Prot per the reference SVG)
  alphaMax?:     number;  // V α-Max — red, at the barber bottom; each of VLS/α-Prot/α-Max tracks its own speed (falls back ~8 kt below α-Prot)
  speedManaged?: boolean; // true → selected-speed bug is drawn MAGENTA (managed target, e.g. SRS V2+10); false/undefined → cyan (selected)
  // Characteristic speeds on the airspeed tape (FCOM DSC-31-40 visibility, DSC-22_10-50-20
  // definition). Each is shown ONLY in its config; a value set = marker visible. [user 2026-07-05]
  greenDot?:     number;  // green dot (best L/D, clean config) — QRH GREEN DOT table by weight/alt
  sSpeed?:       number;  // S speed (min slat retract) — green "S", shown at flap lever 1 (CONF 1)
  fSpeed?:       number;  // F speed (min flap retract) — green "F", shown at flap lever 2 or 3
  vfeNext?:      number;  // VFE NEXT amber "=" — VFE placard of the next flap position, below ~15 000 ft
  // Takeoff speeds on the tape (FCOM DSC-31-40): cyan; shown during the takeoff roll, disappear at liftoff. [user 2026-07-11]
  v1?:           number;  // V1 — cyan tick + "1" on the right edge of the tape (like F/S). "1" value at top if off-scale.
  vr?:           number;  // VR — cyan circle on the tape edge (built like the green dot). V2 = the magenta bug (selectedSpeed/managed).
  showBaroMin?:  boolean; // BARO minimum (MDA) on the PFD — shown only once approach prep is complete
  fieldElev?:    number;  // destination field elevation (ft AMSL) for the Radio Altimeter; falls back to 777 (VIDP)
  gsDev?:        number;  // ILS glideslope deviation in DOTS (+ = fly-up, aircraft below the glidepath); 0 = centred/captured
  locDev?:       number;  // ILS localizer deviation in DOTS (+ = diamond right, − = left); 0 = centred/captured
  dme?:          number;  // DME to the RWY threshold (NM) — drives the ILS readout + G/S geometry; computed in pfd-nd
  beta?:         boolean; // engine-out BETA TARGET active — slip index turns CYAN (blue β) instead of yellow. True once the affected engine is at idle (asymmetric thrust) in a high-thrust phase (FCTM AOP-40). [user 2026-07-10]
  // Abnormal-instrument flags (scenario audit 2026-07-11; consumed by svg-pfd). [SME-gated]
  raInop?:       boolean; // both radio altimeters INOP (e.g. EMER ELEC) → hide the RA entirely, even < 2500 ft AGL
  spdUnreliable?: boolean; // airspeed source is unreliable (ADR erroneous, still on) → speed value amber (present-but-wrong, no flag)
  spdFlag?:      boolean; // airspeed source LOST (ADR off / failed) → red "SPD" flag replaces the speed scale (FCOM DSC-31-40 item 6)
  fdOff?:        boolean; // both Flight Directors OFF → blank FD bars + FMA cols 2/3 (unreliable-speed memory items)
}

export const defaultAircraftState: AircraftState = {
  speed:         165,
  altitude:      1500,
  heading:       280,
  pitch:         8,
  bank:          0,
  vs:            1800,
  selectedSpeed: 165,
  selectedAlt:   3000,
  selectedHdg:   280,
  apEngaged:     false,
  athrActive:    true,
  thrMode:       'MAN TOGA',  // manual TOGA during SRS climb (pre-thrust-reduction alt)
  vertMode:      'SRS',       // Speed Reference System — active from liftoff to accel alt
  latMode:       'NAV',
  masterWarn:    false,
  masterCaut:    false,
  eng1Failed:    false,
  eng2Failed:    false,
  gs:            162,
  tas:           166,
  windDir:       260,   // Delhi prevailing wind (WSW)
  windSpd:       12,
  track:         281,
  vmax:          220,   // takeoff / low-alt default; cruise scenarios raise it
  law:           'NORMAL',
};
