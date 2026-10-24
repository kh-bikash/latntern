// Aircraft performance and aerodynamic data. Masses, wing geometry, thrust/power and speeds follow
// published type figures; stability derivatives come from class templates (Roskam / JSBSim style).
// They are approximations for a game, not certified data.
export type AircraftId =
  | 'trainer'
  | 'pa28'
  | 'ask21'
  | 'twin'
  | 'citation'
  | 'atr42'
  | 'q400'
  | 'crj900'
  | 'e190'
  | 'cs300'
  | 'jet'
  | 'a321'
  | 'b738'
  | 'b752'
  | 'a333'
  | 'b789'
  | 'b773'
  | 'a359'
  | 'b744'
  | 'a380';
export type Category =
  | 'Light'
  | 'Glider'
  | 'Turboprop'
  | 'Business jet'
  | 'Regional jet'
  | 'Narrowbody'
  | 'Widebody'
  | 'Jumbo';
export type ModelInfo = {
  url: string;
  scale: number;
  ground: number;
  heading: number;
  eye: [number, number, number];
  cockpit: 'airliner' | 'ga' | 'glider';
  length: number;
  /** Optional modelled flight deck (glTF) and the pilot eye inside it, in the deck file's own coordinates. */
  deck?: { url: string; eye: [number, number, number] };
};
/** FlightGear models (GPL-2.0), converted from AC3D: detailed textured exteriors and full 3D flight decks. */
const fgModel = (
  file: string,
  ground: number,
  eye: [number, number, number],
  length: number,
  deckEye?: [number, number, number],
): ModelInfo => ({
  url: `/flight/models/fg/${file}.glb`,
  scale: 1,
  ground,
  heading: 180,
  eye,
  cockpit: 'airliner',
  length,
  ...(deckEye ? { deck: { url: `/flight/models/fg/${file}-deck.glb`, eye: deckEye } } : {}),
});
export type AircraftSpec = {
  id: AircraftId;
  name: string;
  kind: string;
  category: Category;
  summary: string;
  engine: 'piston' | 'turboprop' | 'jet' | 'none';
  engines: number;
  empty: number;
  payload: number;
  fuelMax: number;
  fuelStart: number;
  mtow: number;
  range: number;
  S: number;
  b: number;
  c: number;
  e: number;
  I: [number, number, number];
  cl0: number;
  cla: number;
  clmax: number;
  clFlap: number;
  clmaxFlap: number;
  clq: number;
  cd0: number;
  cdFlap: number;
  cdGear: number;
  cdSpoiler: number;
  clSpoiler: number;
  mcrit: number;
  cm0: number;
  cma: number;
  cmq: number;
  cmElev: number;
  cmTrim: number;
  cmFlap: number;
  cyb: number;
  cyRud: number;
  clb: number;
  clp: number;
  clr: number;
  clAil: number;
  cnb: number;
  cnp: number;
  cnr: number;
  cnRud: number;
  cnAil: number;
  power: number;
  staticThrust: number;
  propEff: number;
  thrust: number;
  idle: number;
  pFactor: number;
  fuelFlow: number;
  gearRetract: boolean;
  gearHeight: number;
  mainArm: number;
  wheelbase: number;
  staticPitch: number;
  tailStrike: number;
  brakeMu: number;
  flapDetents: number[];
  flapLabels: string[];
  flapSpeeds: number[];
  toFlap: number;
  vne: number;
  mmo: number;
  vr: number;
  vy: number;
  vapp: number;
  climbIas: number;
  cruiseIas: number;
  cruiseMach: number;
  ceiling: number;
  cruiseMax: number;
  maxBank: number;
  fbw: boolean;
  autothrottle: boolean;
  fuelUnit: string;
  model: ModelInfo;
};
const kt = 0.514444;
const fr24 = (
  file: string,
  ground: number,
  noseZ: number,
  noseToEye: number,
  eyeHeight: number,
  length: number,
  cockpit: ModelInfo['cockpit'] = 'airliner',
): ModelInfo => ({
  url: `/flight/models/fr24/${file}.glb`,
  scale: 1,
  ground,
  heading: 180,
  eye: [-noseZ - noseToEye, eyeHeight, 0.55],
  cockpit,
  length,
});
// Class templates: aerodynamic derivatives shared by aircraft of the same family.
const JET = {
  cl0: 0.2,
  cla: 5.7,
  clmax: 1.42,
  clFlap: 0.8,
  clmaxFlap: 1.38,
  clq: 5,
  cd0: 0.0215,
  cdFlap: 0.075,
  cdGear: 0.018,
  cdSpoiler: 0.07,
  clSpoiler: 0.45,
  mcrit: 0.74,
  cm0: 0.03,
  cma: -1.25,
  cmq: -35,
  cmElev: 0.85,
  cmTrim: 0.3,
  cmFlap: -0.12,
  cyb: -0.75,
  cyRud: 0.08,
  clb: -0.13,
  clp: -0.45,
  clr: 0.16,
  clAil: 0.075,
  cnb: 0.13,
  cnp: -0.02,
  cnr: -0.2,
  cnRud: 0.075,
  cnAil: -0.004,
  power: 0,
  staticThrust: 0,
  propEff: 0,
  idle: 0.21,
  pFactor: 0,
  fuelFlow: 0,
  gearRetract: true,
  staticPitch: 0.005,
  brakeMu: 0.5,
  e: 0.8,
  vr: 0,
  vy: 0,
  vapp: 0,
  climbIas: 250,
  autothrottle: true,
  fuelUnit: 'kg Jet A-1',
  maxBank: 30,
  toFlap: 1,
} as const;
const AIRBUS_FLAPS = {
    flapDetents: [0, 0.2, 0.45, 0.7, 1],
    flapLabels: ['0', '1', '2', '3', 'FULL'],
  },
  BOEING_FLAPS = {
    flapDetents: [0, 0.1, 0.25, 0.45, 0.75, 1],
    flapLabels: ['UP', '1', '5', '15', '25', '30'],
    toFlap: 2,
  };
const TPROP = {
  cl0: 0.3,
  cla: 5.2,
  clmax: 1.72,
  clFlap: 1.3,
  clmaxFlap: 1.25,
  clq: 4.5,
  cd0: 0.027,
  cdFlap: 0.06,
  cdGear: 0.02,
  cdSpoiler: 0,
  clSpoiler: 0,
  mcrit: 0.66,
  cm0: 0.035,
  cma: -1.0,
  cmq: -20,
  cmElev: 0.6,
  cmTrim: 0.2,
  cmFlap: -0.08,
  cyb: -0.5,
  cyRud: 0.07,
  clb: -0.1,
  clp: -0.47,
  clr: 0.12,
  clAil: 0.07,
  cnb: 0.1,
  cnp: -0.03,
  cnr: -0.15,
  cnRud: 0.05,
  cnAil: -0.006,
  thrust: 0,
  idle: 0.25,
  pFactor: 0,
  gearRetract: true,
  staticPitch: 0.0,
  brakeMu: 0.45,
  e: 0.8,
  autothrottle: true,
  fuelUnit: 'kg Jet A-1',
  maxBank: 30,
  fbw: false,
  toFlap: 1,
  mmo: 1,
} as const;
function inertia(m: number, b: number, L: number): [number, number, number] {
  const ixx = 0.056 * m * (b / 2) ** 2,
    iyy = 0.125 * m * (L / 2) ** 2;
  return [ixx, iyy, (ixx + iyy) * 0.95];
}
type Over = Partial<AircraftSpec> &
  Pick<
    AircraftSpec,
    | 'id'
    | 'name'
    | 'kind'
    | 'category'
    | 'summary'
    | 'engines'
    | 'empty'
    | 'payload'
    | 'fuelMax'
    | 'fuelStart'
    | 'mtow'
    | 'range'
    | 'S'
    | 'b'
    | 'c'
    | 'gearHeight'
    | 'mainArm'
    | 'tailStrike'
    | 'flapSpeeds'
    | 'vne'
    | 'cruiseIas'
    | 'ceiling'
    | 'cruiseMax'
    | 'model'
  >;
function jet(
  o: Over & { thrust: number; mmo: number; cruiseMach: number; fbw: boolean },
): AircraftSpec {
  const m = o.empty + o.payload + o.fuelStart;
  return {
    ...JET,
    ...AIRBUS_FLAPS,
    I: inertia(m, o.b, o.model.length),
    wheelbase: o.model.length * 0.36,
    engine: 'jet',
    ...o,
  } as AircraftSpec;
}
function tprop(
  o: Over & {
    power: number;
    staticThrust: number;
    fuelFlow: number;
    flapDetents: number[];
    flapLabels: string[];
    vr: number;
    vy: number;
    vapp: number;
    climbIas: number;
    cruiseMach?: number;
  },
): AircraftSpec {
  const m = o.empty + o.payload + o.fuelStart;
  return {
    ...TPROP,
    propEff: 0.85,
    cruiseMach: 0,
    I: inertia(m, o.b, o.model.length),
    wheelbase: o.model.length * 0.4,
    engine: 'turboprop',
    ...o,
  } as AircraftSpec;
}
export const AIRCRAFT: Record<AircraftId, AircraftSpec> = {
  trainer: {
    id: 'trainer',
    name: 'Kestrel T-180',
    kind: 'Single-engine piston trainer',
    category: 'Light',
    summary:
      'High-wing four-seat trainer. 180 hp, fixed gear, 122 kt cruise. Forgiving, slow and honest.',
    engine: 'piston',
    engines: 1,
    empty: 767,
    payload: 170,
    fuelMax: 144,
    fuelStart: 110,
    mtow: 1157,
    range: 1150,
    S: 16.2,
    b: 11,
    c: 1.49,
    e: 0.75,
    I: [1285, 1825, 2667],
    cl0: 0.25,
    cla: 4.9,
    clmax: 1.72,
    clFlap: 0.62,
    clmaxFlap: 0.6,
    clq: 3.9,
    cd0: 0.031,
    cdFlap: 0.045,
    cdGear: 0,
    cdSpoiler: 0,
    clSpoiler: 0,
    mcrit: 0.6,
    cm0: 0.04,
    cma: -0.89,
    cmq: -12.4,
    cmElev: 0.48,
    cmTrim: 0.14,
    cmFlap: -0.06,
    cyb: -0.31,
    cyRud: 0.06,
    clb: -0.089,
    clp: -0.47,
    clr: 0.096,
    clAil: 0.065,
    cnb: 0.065,
    cnp: -0.03,
    cnr: -0.099,
    cnRud: 0.024,
    cnAil: -0.008,
    power: 134e3,
    staticThrust: 2700,
    propEff: 0.8,
    thrust: 0,
    idle: 0.22,
    pFactor: 0.22,
    fuelFlow: 0.0098,
    gearRetract: false,
    gearHeight: 1.25,
    mainArm: 0.55,
    wheelbase: 1.65,
    staticPitch: 0.01,
    tailStrike: 0.24,
    brakeMu: 0.45,
    flapDetents: [0, 1 / 3, 2 / 3, 1],
    flapLabels: ['UP', '10°', '20°', '30°'],
    flapSpeeds: [163, 110, 85, 85],
    toFlap: 1,
    vne: 163,
    mmo: 1,
    vr: 55,
    vy: 74,
    vapp: 65,
    climbIas: 76,
    cruiseIas: 110,
    cruiseMach: 0,
    ceiling: 14000,
    cruiseMax: 8500,
    maxBank: 25,
    fbw: false,
    autothrottle: false,
    fuelUnit: 'kg avgas',
    model: {
      url: 'proc:trainer',
      scale: 1,
      ground: 1.22,
      heading: 0,
      eye: [0.55, 1.95, 0.28],
      cockpit: 'ga',
      length: 8.3,
    },
  },
  pa28: {
    id: 'pa28',
    name: 'Piper PA-28-181 Archer',
    kind: 'Low-wing piston single',
    category: 'Light',
    summary: 'Four-seat low-wing classic. 180 hp, fixed gear, 128 kt cruise, docile stall.',
    engine: 'piston',
    engines: 1,
    empty: 770,
    payload: 200,
    fuelMax: 131,
    fuelStart: 110,
    mtow: 1157,
    range: 1100,
    S: 15.8,
    b: 10.7,
    c: 1.6,
    e: 0.76,
    I: [1250, 1850, 2700],
    cl0: 0.27,
    cla: 4.9,
    clmax: 1.62,
    clFlap: 0.55,
    clmaxFlap: 0.55,
    clq: 3.9,
    cd0: 0.029,
    cdFlap: 0.045,
    cdGear: 0,
    cdSpoiler: 0,
    clSpoiler: 0,
    mcrit: 0.6,
    cm0: 0.04,
    cma: -0.9,
    cmq: -12.4,
    cmElev: 0.48,
    cmTrim: 0.14,
    cmFlap: -0.06,
    cyb: -0.31,
    cyRud: 0.06,
    clb: -0.1,
    clp: -0.47,
    clr: 0.096,
    clAil: 0.065,
    cnb: 0.07,
    cnp: -0.03,
    cnr: -0.1,
    cnRud: 0.024,
    cnAil: -0.008,
    power: 134e3,
    staticThrust: 2700,
    propEff: 0.8,
    thrust: 0,
    idle: 0.22,
    pFactor: 0.22,
    fuelFlow: 0.0098,
    gearRetract: false,
    gearHeight: 1.3,
    mainArm: 0.5,
    wheelbase: 1.9,
    staticPitch: 0.01,
    tailStrike: 0.24,
    brakeMu: 0.45,
    flapDetents: [0, 1 / 3, 2 / 3, 1],
    flapLabels: ['UP', '10°', '25°', '40°'],
    flapSpeeds: [154, 103, 103, 103],
    toFlap: 0,
    vne: 154,
    mmo: 1,
    vr: 58,
    vy: 76,
    vapp: 66,
    climbIas: 80,
    cruiseIas: 115,
    cruiseMach: 0,
    ceiling: 13200,
    cruiseMax: 8500,
    maxBank: 25,
    fbw: false,
    autothrottle: false,
    fuelUnit: 'kg avgas',
    model: fr24('pa28', 0.03, -2.5, 2.2, 1.7, 7.2, 'ga'),
  },
  ask21: {
    id: 'ask21',
    name: 'Schleicher ASK 21',
    kind: 'Two-seat sailplane',
    category: 'Glider',
    summary:
      'Training glider with no engine. Glide ratio about 34:1, airbrakes, starts released from tow at 3,000 ft.',
    engine: 'none',
    engines: 0,
    empty: 360,
    payload: 150,
    fuelMax: 0,
    fuelStart: 0,
    mtow: 600,
    range: 0,
    S: 17.95,
    b: 17,
    c: 1.1,
    e: 0.9,
    I: [3600, 900, 4300],
    cl0: 0.3,
    cla: 5.4,
    clmax: 1.45,
    clFlap: 0,
    clmaxFlap: 0,
    clq: 4,
    cd0: 0.0105,
    cdFlap: 0,
    cdGear: 0,
    cdSpoiler: 0.06,
    clSpoiler: 0.3,
    mcrit: 0.5,
    cm0: 0.03,
    cma: -0.9,
    cmq: -14,
    cmElev: 0.5,
    cmTrim: 0.15,
    cmFlap: 0,
    cyb: -0.3,
    cyRud: 0.07,
    clb: -0.08,
    clp: -0.6,
    clr: 0.15,
    clAil: 0.05,
    cnb: 0.06,
    cnp: -0.04,
    cnr: -0.06,
    cnRud: 0.03,
    cnAil: -0.012,
    power: 0,
    staticThrust: 0,
    propEff: 0,
    thrust: 0,
    idle: 0,
    pFactor: 0,
    fuelFlow: 0,
    gearRetract: false,
    gearHeight: 0.75,
    mainArm: 0.25,
    wheelbase: 3,
    staticPitch: 0.03,
    tailStrike: 0.3,
    brakeMu: 0.35,
    flapDetents: [0],
    flapLabels: ['—'],
    flapSpeeds: [151],
    toFlap: 0,
    vne: 151,
    mmo: 1,
    vr: 45,
    vy: 50,
    vapp: 55,
    climbIas: 50,
    cruiseIas: 55,
    cruiseMach: 0,
    ceiling: 15000,
    cruiseMax: 3000,
    maxBank: 45,
    fbw: false,
    autothrottle: false,
    fuelUnit: '—',
    model: fr24('ask21', 0.75, -4.0, 1.2, 1.0, 8.3, 'glider'),
  },
  twin: {
    id: 'twin',
    name: 'Cesium Air Twin',
    kind: 'Twin-engine piston',
    category: 'Light',
    summary:
      'Six-seat piston twin. 2 × 300 hp, retractable gear, 190 kt cruise at 8,000–12,000 ft.',
    engine: 'piston',
    engines: 2,
    empty: 1580,
    payload: 380,
    fuelMax: 528,
    fuelStart: 400,
    mtow: 2495,
    range: 1700,
    S: 18.5,
    b: 11.5,
    c: 1.65,
    e: 0.78,
    I: [4100, 5600, 9100],
    cl0: 0.22,
    cla: 5.1,
    clmax: 1.48,
    clFlap: 0.6,
    clmaxFlap: 0.62,
    clq: 4.2,
    cd0: 0.026,
    cdFlap: 0.05,
    cdGear: 0.016,
    cdSpoiler: 0,
    clSpoiler: 0,
    mcrit: 0.62,
    cm0: 0.035,
    cma: -0.95,
    cmq: -14,
    cmElev: 0.5,
    cmTrim: 0.15,
    cmFlap: -0.07,
    cyb: -0.38,
    cyRud: 0.065,
    clb: -0.09,
    clp: -0.48,
    clr: 0.1,
    clAil: 0.07,
    cnb: 0.075,
    cnp: -0.03,
    cnr: -0.11,
    cnRud: 0.028,
    cnAil: -0.008,
    power: 224e3,
    staticThrust: 3900,
    propEff: 0.82,
    thrust: 0,
    idle: 0.22,
    pFactor: 0,
    fuelFlow: 0.0155,
    gearRetract: true,
    gearHeight: 1.45,
    mainArm: 0.65,
    wheelbase: 2.6,
    staticPitch: 0.0,
    tailStrike: 0.22,
    brakeMu: 0.45,
    flapDetents: [0, 0.5, 1],
    flapLabels: ['UP', 'APP', 'DN'],
    flapSpeeds: [223, 152, 122],
    toFlap: 1,
    vne: 223,
    mmo: 1,
    vr: 85,
    vy: 105,
    vapp: 95,
    climbIas: 120,
    cruiseIas: 165,
    cruiseMach: 0,
    ceiling: 20000,
    cruiseMax: 12000,
    maxBank: 30,
    fbw: false,
    autothrottle: false,
    fuelUnit: 'kg avgas',
    model: {
      url: '/flight/models/Cesium_Air.glb',
      scale: 0.5,
      ground: 1.15,
      heading: 0,
      eye: [2.3, 2.3, 0.3],
      cockpit: 'ga',
      length: 10.7,
    },
  },
  citation: jet({
    id: 'citation',
    name: 'Cessna Citation II',
    kind: 'Light business jet',
    category: 'Business jet',
    summary:
      'Eight-seat business jet. 2 × 11 kN turbofans, 380 kt cruise, FL430 ceiling, short-field capable.',
    engines: 2,
    empty: 3650,
    payload: 700,
    fuelMax: 2200,
    fuelStart: 1500,
    mtow: 6850,
    range: 2800,
    S: 30,
    b: 15.9,
    c: 2.0,
    thrust: 11.1e3,
    gearHeight: 1.6,
    mainArm: 0.7,
    tailStrike: 0.24,
    cl0: 0.22,
    clmax: 1.45,
    clFlap: 0.6,
    clmaxFlap: 0.9,
    cd0: 0.023,
    mcrit: 0.7,
    flapDetents: [0, 0.4, 1],
    flapLabels: ['UP', '15', '40'],
    flapSpeeds: [262, 200, 174],
    vne: 262,
    mmo: 0.705,
    cruiseMach: 0.7,
    cruiseIas: 260,
    climbIas: 220,
    ceiling: 43000,
    cruiseMax: 39000,
    fbw: false,
    cdSpoiler: 0.05,
    clSpoiler: 0.3,
    model: fr24('citation', 0.0, -6.3, 2.2, 2.2, 14.5),
  }),
  atr42: tprop({
    id: 'atr42',
    name: 'ATR 42-500',
    kind: 'Regional turboprop',
    category: 'Turboprop',
    summary:
      '48-seat high-wing turboprop. 2 × 1,610 kW, 300 kt cruise at FL170, robust and economical.',
    engines: 2,
    empty: 11250,
    payload: 4000,
    fuelMax: 4500,
    fuelStart: 2500,
    mtow: 18600,
    range: 1300,
    S: 54.5,
    b: 24.6,
    c: 2.3,
    power: 1.61e6,
    staticThrust: 40e3,
    fuelFlow: 0.125,
    gearHeight: 2.3,
    mainArm: 0.9,
    tailStrike: 0.17,
    flapDetents: [0, 0.43, 0.71, 1],
    flapLabels: ['0', '15', '25', '35'],
    flapSpeeds: [250, 180, 170, 150],
    vne: 250,
    vr: 105,
    vy: 160,
    vapp: 110,
    climbIas: 170,
    cruiseIas: 215,
    ceiling: 25000,
    cruiseMax: 17000,
    model: fr24('atr42', 0.0, -10.7, 2.6, 2.8, 22.7),
  }),
  q400: tprop({
    id: 'q400',
    name: 'De Havilland Dash 8 Q400',
    kind: 'Fast regional turboprop',
    category: 'Turboprop',
    summary: '78-seat high-speed turboprop. 2 × 3,780 kW, 360 kt cruise at FL250.',
    engines: 2,
    empty: 17100,
    payload: 7000,
    fuelMax: 5300,
    fuelStart: 3500,
    mtow: 29260,
    range: 1500,
    S: 63.1,
    b: 28.4,
    c: 2.3,
    power: 3.78e6,
    staticThrust: 66e3,
    toFlap: 2,
    fuelFlow: 0.25,
    gearHeight: 2.6,
    mainArm: 1.0,
    tailStrike: 0.17,
    cd0: 0.025,
    flapDetents: [0, 0.14, 0.29, 0.43, 1],
    flapLabels: ['0', '5', '10', '15', '35'],
    flapSpeeds: [286, 200, 181, 172, 148],
    vne: 286,
    vr: 115,
    vy: 170,
    vapp: 120,
    climbIas: 190,
    cruiseIas: 245,
    ceiling: 27000,
    cruiseMax: 25000,
    model: fr24('q400', 0.0, -13.9, 2.6, 3.0, 32.6),
  }),
  crj900: jet({
    id: 'crj900',
    name: 'Bombardier CRJ900',
    kind: 'Regional jet',
    category: 'Regional jet',
    summary: '90-seat regional jet with rear engines and T-tail. 2 × 64.5 kN, Mach 0.78 cruise.',
    engines: 2,
    empty: 21845,
    payload: 8000,
    fuelMax: 8800,
    fuelStart: 5000,
    mtow: 38330,
    range: 2900,
    S: 70.6,
    b: 24.9,
    c: 3.1,
    thrust: 64.5e3,
    gearHeight: 2.2,
    mainArm: 1.0,
    tailStrike: 0.17,
    cd0: 0.023,
    flapDetents: [0, 0.02, 0.18, 0.44, 0.67, 1],
    flapLabels: ['0', '1', '8', '20', '30', '45'],
    toFlap: 2,
    flapSpeeds: [335, 230, 230, 220, 185, 170],
    vne: 335,
    mmo: 0.85,
    cruiseMach: 0.78,
    cruiseIas: 290,
    ceiling: 41000,
    cruiseMax: 37000,
    fbw: false,
    model: fr24('crj900', 0.18, -17.3, 2.6, 3.0, 36.4),
  }),
  e190: jet({
    id: 'e190',
    name: 'Embraer E190',
    kind: 'Regional jet',
    category: 'Regional jet',
    summary: '100-seat fly-by-wire regional jet. 2 × 82 kN, Mach 0.78 cruise at FL370.',
    engines: 2,
    empty: 28000,
    payload: 10000,
    fuelMax: 12900,
    fuelStart: 7000,
    mtow: 51800,
    range: 4000,
    S: 92.5,
    b: 28.7,
    c: 3.5,
    thrust: 82e3,
    gearHeight: 2.5,
    mainArm: 1.1,
    tailStrike: 0.2,
    flapDetents: [0, 0.15, 0.3, 0.5, 0.7, 1],
    flapLabels: ['0', '1', '2', '3', '4', 'FULL'],
    flapSpeeds: [320, 230, 215, 200, 180, 165],
    vne: 320,
    mmo: 0.82,
    cruiseMach: 0.78,
    cruiseIas: 290,
    ceiling: 41000,
    cruiseMax: 37000,
    fbw: true,
    model: fr24('e190', 0.52, -15.4, 2.8, 3.4, 35.7),
  }),
  cs300: jet({
    id: 'cs300',
    name: 'Airbus A220-300',
    kind: 'Small narrowbody',
    category: 'Narrowbody',
    summary: '140-seat fly-by-wire twinjet with geared turbofans. 2 × 103 kN, Mach 0.78.',
    engines: 2,
    empty: 37080,
    payload: 15000,
    fuelMax: 17000,
    fuelStart: 10000,
    mtow: 70900,
    range: 6000,
    S: 112.3,
    b: 35.1,
    c: 3.6,
    thrust: 103e3,
    gearHeight: 2.8,
    mainArm: 1.2,
    tailStrike: 0.19,
    flapSpeeds: [330, 230, 210, 190, 170],
    vne: 330,
    mmo: 0.82,
    cruiseMach: 0.78,
    cruiseIas: 290,
    ceiling: 41000,
    cruiseMax: 37000,
    fbw: true,
    model: fr24('cs300', 0.0, -16.4, 3.0, 3.6, 38.2),
  }),
  jet: {
    ...jet({
      id: 'jet',
      name: 'Airbus A320-200',
      kind: 'Narrowbody airliner',
      category: 'Narrowbody',
      summary:
        'The classic 150-seat fly-by-wire twinjet. 2 × 120 kN turbofans, Mach 0.78 at FL350, autothrottle and autoland.',
      engines: 2,
      empty: 42600,
      payload: 15000,
      fuelMax: 19000,
      fuelStart: 12500,
      mtow: 78000,
      range: 5600,
      S: 122.6,
      b: 35.8,
      c: 4.19,
      thrust: 120e3,
      gearHeight: 2.9,
      mainArm: 1.25,
      tailStrike: 0.2,
      flapSpeeds: [350, 230, 200, 185, 177],
      vne: 350,
      mmo: 0.82,
      cruiseMach: 0.78,
      cruiseIas: 290,
      ceiling: 39800,
      cruiseMax: 37000,
      fbw: true,
      model: fgModel('a320', 4.39, [16.19, 4.96, 0.45], 37.6, [-0.45, 0.572, -16.193]),
    }),
    I: [1.25e6, 3.1e6, 4.2e6],
    wheelbase: 12.6,
  },
  a321: jet({
    id: 'a321',
    name: 'Airbus A321',
    kind: 'Stretched narrowbody',
    category: 'Narrowbody',
    summary:
      '200-seat stretched A320. 2 × 147 kN, longer runway and careful rotation — watch the tail.',
    engines: 2,
    empty: 48500,
    payload: 18000,
    fuelMax: 18600,
    fuelStart: 13000,
    mtow: 89000,
    range: 5900,
    S: 122.6,
    b: 35.8,
    c: 4.19,
    thrust: 147e3,
    gearHeight: 2.9,
    mainArm: 1.3,
    tailStrike: 0.17,
    flapSpeeds: [350, 235, 215, 195, 190],
    vne: 350,
    mmo: 0.82,
    cruiseMach: 0.78,
    cruiseIas: 290,
    ceiling: 39100,
    cruiseMax: 37000,
    fbw: true,
    model: fr24('a321', 0.96, -19.8, 3.0, 3.7, 44.5),
  }),
  b738: jet({
    id: 'b738',
    name: 'Boeing 737-800',
    kind: 'Narrowbody airliner',
    category: 'Narrowbody',
    summary:
      '189-seat workhorse with conventional controls (no fly-by-wire). 2 × 121 kN, Mach 0.785.',
    engines: 2,
    empty: 41413,
    payload: 16000,
    fuelMax: 20800,
    fuelStart: 13000,
    mtow: 79010,
    range: 5400,
    S: 124.6,
    b: 35.8,
    c: 3.96,
    thrust: 121e3,
    gearHeight: 2.6,
    mainArm: 1.2,
    tailStrike: 0.19,
    ...BOEING_FLAPS,
    flapSpeeds: [340, 250, 250, 200, 190, 175],
    vne: 340,
    mmo: 0.82,
    cruiseMach: 0.785,
    cruiseIas: 290,
    ceiling: 41000,
    cruiseMax: 37000,
    fbw: false,
    model: fr24('b738', 2.2, -19.9, 3.0, 3.6, 39.4),
  }),
  b752: jet({
    id: 'b752',
    name: 'Boeing 757-200',
    kind: 'Narrowbody airliner',
    category: 'Narrowbody',
    summary: 'The muscular single-aisle. 2 × 190 kN, steep climbs, Mach 0.80.',
    engines: 2,
    empty: 58390,
    payload: 20000,
    fuelMax: 33800,
    fuelStart: 20000,
    mtow: 115680,
    range: 6500,
    S: 185.25,
    b: 38.05,
    c: 5.6,
    thrust: 190e3,
    gearHeight: 3.2,
    mainArm: 1.5,
    tailStrike: 0.17,
    ...BOEING_FLAPS,
    flapSpeeds: [350, 240, 220, 210, 190, 162],
    vne: 350,
    mmo: 0.86,
    cruiseMach: 0.8,
    cruiseIas: 290,
    ceiling: 42000,
    cruiseMax: 39000,
    fbw: false,
    model: fr24('b752', 0.05, -19.6, 3.0, 3.8, 46.3),
  }),
  a333: jet({
    id: 'a333',
    name: 'Airbus A330-300',
    kind: 'Widebody airliner',
    category: 'Widebody',
    summary: '300-seat fly-by-wire widebody. 2 × 320 kN, Mach 0.82, long haul.',
    engines: 2,
    empty: 129400,
    payload: 35000,
    fuelMax: 75000,
    fuelStart: 50000,
    mtow: 242000,
    range: 11000,
    S: 361.6,
    b: 60.3,
    c: 7.26,
    thrust: 320e3,
    gearHeight: 4.6,
    mainArm: 2.0,
    tailStrike: 0.17,
    cd0: 0.0195,
    mcrit: 0.76,
    flapSpeeds: [330, 240, 215, 195, 180],
    vne: 330,
    mmo: 0.86,
    cruiseMach: 0.82,
    cruiseIas: 290,
    ceiling: 41000,
    cruiseMax: 39000,
    fbw: true,
    maxBank: 25,
    model: fr24('a333', 5.26, -30.3, 4.6, 5.6, 62.9),
  }),
  b789: jet({
    id: 'b789',
    name: 'Boeing 787-9',
    kind: 'Widebody airliner',
    category: 'Widebody',
    summary: '290-seat composite fly-by-wire widebody. 2 × 340 kN, Mach 0.85 cruise.',
    engines: 2,
    empty: 128850,
    payload: 35000,
    fuelMax: 101000,
    fuelStart: 60000,
    mtow: 254000,
    range: 14000,
    S: 360,
    b: 60.1,
    c: 7.0,
    thrust: 340e3,
    gearHeight: 4.4,
    mainArm: 2.0,
    tailStrike: 0.17,
    cd0: 0.0185,
    mcrit: 0.79,
    ...BOEING_FLAPS,
    flapSpeeds: [340, 250, 230, 210, 180, 175],
    vne: 340,
    mmo: 0.9,
    cruiseMach: 0.85,
    cruiseIas: 290,
    ceiling: 43000,
    cruiseMax: 41000,
    fbw: true,
    maxBank: 25,
    model: fr24('b789', 2.74, -29.8, 4.6, 5.6, 65.9),
  }),
  b773: jet({
    id: 'b773',
    name: 'Boeing 777-300',
    kind: 'Widebody airliner',
    category: 'Widebody',
    summary: 'The long twin. 2 × 400 kN, 74 m fuselage, Mach 0.84 — easy tail strike on rotation.',
    engines: 2,
    empty: 160500,
    payload: 40000,
    fuelMax: 135000,
    fuelStart: 70000,
    mtow: 299370,
    range: 11000,
    S: 427.8,
    b: 60.9,
    c: 7.6,
    thrust: 400e3,
    gearHeight: 4.7,
    mainArm: 2.4,
    tailStrike: 0.15,
    cd0: 0.019,
    mcrit: 0.78,
    ...BOEING_FLAPS,
    flapSpeeds: [340, 255, 235, 215, 185, 170],
    vne: 340,
    mmo: 0.89,
    cruiseMach: 0.84,
    cruiseIas: 290,
    ceiling: 43100,
    cruiseMax: 41000,
    fbw: true,
    maxBank: 25,
    model: fr24('b773', 4.86, -29.9, 4.8, 5.8, 74.3),
  }),
  a359: jet({
    id: 'a359',
    name: 'Airbus A350-900',
    kind: 'Widebody airliner',
    category: 'Widebody',
    summary: '315-seat carbon-fibre fly-by-wire widebody. 2 × 375 kN, Mach 0.85.',
    engines: 2,
    empty: 142400,
    payload: 40000,
    fuelMax: 110000,
    fuelStart: 65000,
    mtow: 283000,
    range: 15000,
    S: 442,
    b: 64.75,
    c: 7.6,
    thrust: 375e3,
    gearHeight: 4.7,
    mainArm: 2.2,
    tailStrike: 0.18,
    cd0: 0.0185,
    mcrit: 0.79,
    flapSpeeds: [340, 255, 220, 196, 186],
    vne: 340,
    mmo: 0.89,
    cruiseMach: 0.85,
    cruiseIas: 290,
    ceiling: 43100,
    cruiseMax: 41000,
    fbw: true,
    maxBank: 25,
    model: fr24('a359', 0.99, -28.5, 4.6, 5.6, 67.0),
  }),
  b744: jet({
    id: 'b744',
    name: 'Boeing 747-400',
    kind: 'Four-engine jumbo',
    category: 'Jumbo',
    summary: 'The Queen of the Skies. 4 × 267 kN, upper-deck cockpit, Mach 0.855.',
    engines: 4,
    empty: 184570,
    payload: 50000,
    fuelMax: 174000,
    fuelStart: 100000,
    mtow: 396890,
    range: 11500,
    S: 541,
    b: 64.4,
    c: 8.32,
    thrust: 267e3,
    gearHeight: 5.0,
    mainArm: 2.5,
    tailStrike: 0.2,
    cd0: 0.0195,
    mcrit: 0.8,
    ...BOEING_FLAPS,
    flapSpeeds: [365, 280, 260, 240, 205, 180],
    vne: 365,
    mmo: 0.92,
    cruiseMach: 0.855,
    cruiseIas: 290,
    ceiling: 45100,
    cruiseMax: 41000,
    fbw: false,
    maxBank: 25,
    model: fr24('b744', 4.0, -29.9, 4.5, 8.8, 70.9),
  }),
  a380: jet({
    id: 'a380',
    name: 'Airbus A380-800',
    kind: 'Double-deck superjumbo',
    category: 'Jumbo',
    summary: 'The largest airliner. 4 × 311 kN, 575 t, fly-by-wire, Mach 0.85.',
    engines: 4,
    empty: 277000,
    payload: 66000,
    fuelMax: 254000,
    fuelStart: 140000,
    mtow: 575000,
    range: 13500,
    S: 845,
    b: 79.75,
    c: 12,
    thrust: 311e3,
    gearHeight: 5.4,
    mainArm: 3.0,
    tailStrike: 0.2,
    cd0: 0.0185,
    mcrit: 0.79,
    flapSpeeds: [340, 263, 220, 196, 182],
    vne: 340,
    mmo: 0.89,
    cruiseMach: 0.85,
    cruiseIas: 290,
    ceiling: 43000,
    cruiseMax: 41000,
    fbw: true,
    maxBank: 25,
    model: fr24('a380', 0.32, -27.3, 5.0, 7.6, 72.7),
  }),
};
export const AIRCRAFT_IDS = Object.keys(AIRCRAFT) as AircraftId[];
export const CATEGORIES: Category[] = [
  'Light',
  'Glider',
  'Turboprop',
  'Business jet',
  'Regional jet',
  'Narrowbody',
  'Widebody',
  'Jumbo',
];
export function spec(id: unknown): AircraftSpec {
  return AIRCRAFT[(typeof id === 'string' && id in AIRCRAFT ? id : 'twin') as AircraftId];
}
export function aircraftMass(a: AircraftSpec, fuelPercent: number) {
  return a.empty + a.payload + (a.fuelMax * Math.max(0, fuelPercent)) / 100;
}
/** Equivalent (≈ indicated) stall speed in m/s for a given mass, flap setting and load factor. */
export function stallEas(a: AircraftSpec, mass: number, flaps: number, n = 1) {
  return Math.sqrt(
    (2 * mass * 9.80665 * Math.max(0.2, n)) / (1.225 * a.S * (a.clmax + a.clmaxFlap * flaps)),
  );
}
/** Reference speeds (knots indicated). Jets compute speeds from weight, propeller aircraft use handbook speeds. */
export function vSpeeds(a: AircraftSpec, mass: number) {
  const vs = (f: number) => stallEas(a, mass, f) / kt,
    takeoffFlap = a.flapDetents[a.toFlap] ?? 0,
    landFlap = a.flapDetents[a.flapDetents.length - 1];
  if (a.engine === 'jet') {
    const vr = Math.round(vs(takeoffFlap) * 1.1),
      v2 = Math.round(vs(takeoffFlap) * 1.2);
    return {
      vs: Math.round(vs(0)),
      vs0: Math.round(vs(landFlap)),
      v1: vr - 3,
      vr,
      v2,
      vref: Math.round(vs(landFlap) * 1.23),
      vapp: Math.round(vs(landFlap) * 1.23 + 5),
      vy: Math.round(Math.max(250, vs(0) * 1.7)),
      green: Math.round(vs(0) * 1.28),
    };
  }
  return {
    vs: Math.round(vs(0)),
    vs0: Math.round(vs(landFlap)),
    v1: a.vr,
    vr: Math.max(a.vr, Math.round(vs(takeoffFlap) * 1.1)),
    v2: a.vy,
    vref: Math.round(Math.max(a.vapp - 5, vs(landFlap) * 1.3)),
    vapp: Math.max(a.vapp, Math.round(vs(landFlap) * 1.3)),
    vy: a.vy,
    green: a.vy,
  };
}
/** Still-air range estimate in km with reserves at the starting fuel load, for flight planning warnings. */
export function rangeKm(a: AircraftSpec) {
  return a.fuelMax ? (a.range * (a.fuelStart / a.fuelMax)) / 0.85 : 0;
}
export function cruiseAltitudeFt(a: AircraftSpec, distanceKm: number) {
  const nm = distanceKm / 1.852,
    raw = a.engine === 'jet' ? nm * 130 : a.engine === 'turboprop' ? nm * 90 : nm * 60,
    alt = Math.min(a.cruiseMax, Math.max(3000, raw));
  return a.engine === 'jet' ? Math.round(alt / 1000) * 1000 : Math.round(alt / 500) * 500;
}
