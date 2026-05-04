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
  athrActive:    boolean;
  thrMode:       string;  // 'CLB' | 'IDLE' | 'MCT' | 'TOGA' | 'MAN THR'
  vertMode:      string;  // 'SRS' | 'CLB' | 'OP CLB' | 'ALT' | 'ALT*' | 'VS'
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
  thrMode:       'CLB',
  vertMode:      'SRS',
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
