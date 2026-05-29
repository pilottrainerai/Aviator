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
  athrActive:    boolean;  // A/THR actively managing thrust (green in FMA col 5)
  athrArmed?:    boolean;  // A/THR pb pressed but levers in manual detent (blue in FMA col 5)
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
};
