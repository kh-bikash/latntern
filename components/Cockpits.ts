// Original procedural flight decks rendered over the globe. The camera sits at the pilot's eye looking
// down -Z; glass screens are canvas textures painted with the shared avionics renderer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
export type DeckKind = 'airliner' | 'ga' | 'glider';
export type Screen = {
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  w: number;
  h: number;
};
export type Deck = {
  group: THREE.Group;
  screens: Record<string, Screen>;
  fcu?: Screen;
  update: (s: {
    roll: number;
    pitch: number;
    throttle: number;
    flaps: number;
    spoilers: number;
    light: number;
  }) => void;
};
function screen(w: number, h: number, pxW = 512, pxH = Math.round((pxW * h) / w)) {
  const c = document.createElement('canvas');
  c.width = pxW;
  c.height = pxH;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  return { mesh, s: { ctx, tex, w: pxW, h: pxH } as Screen };
}
function panelTexture(base: string, seed: number, kind: 'switches' | 'plain') {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  let s = seed;
  const r = () => (
    (s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) | 0),
    (s >>> 0) / 4294967296
  );
  for (let i = 0; i < 4000; i++) {
    const g = r() * 14 - 7;
    x.fillStyle = `rgba(${g > 0 ? 255 : 0},${g > 0 ? 255 : 0},${g > 0 ? 255 : 0},${Math.abs(g) / 250})`;
    x.fillRect(r() * 512, r() * 512, 2, 2);
  }
  if (kind === 'switches') {
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 8; col++) {
        if (r() < 0.25) continue;
        const px = 24 + col * 61,
          py = 26 + row * 70;
        x.strokeStyle = '#ffffff30';
        x.strokeRect(px - 4, py - 4, 52, 58);
        x.fillStyle = '#d9dcd6';
        x.font = '9px Arial';
        x.fillText(
          [
            'FUEL',
            'HYD',
            'ELEC',
            'BLEED',
            'PACK',
            'APU',
            'ENG',
            'ANTI ICE',
            'LIGHTS',
            'WIPER',
            'PROBE',
            'CAB',
          ][Math.floor(r() * 12)],
          px,
          py + 6,
        );
        const t = r();
        if (t < 0.5) {
          x.fillStyle = '#1b1f22';
          x.fillRect(px + 6, py + 14, 30, 24);
          x.fillStyle = r() < 0.3 ? '#4ef07a' : '#ffffffcc';
          x.fillRect(px + 10, py + 18, 22, 6);
          x.fillStyle = '#ffb02e88';
          x.fillRect(px + 10, py + 28, 22, 6);
        } else {
          x.fillStyle = '#c8ccd0';
          x.beginPath();
          x.arc(px + 21, py + 28, 9, 0, 7);
          x.fill();
          x.fillStyle = '#2a2e32';
          x.fillRect(px + 19, py + 16, 4, 14);
        }
      }
    x.strokeStyle = '#ffffff22';
    x.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      x.beginPath();
      x.moveTo(i * 128, 0);
      x.lineTo(i * 128, 512);
      x.stroke();
    }
  }
  for (let i = 0; i < 40; i++) {
    x.fillStyle = '#9a9fa4';
    const px = r() * 512,
      py = r() * 512;
    x.beginPath();
    x.arc(px, py, 2.2, 0, 7);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function buildDeck(
  kind: DeckKind,
  renderer: THREE.WebGLRenderer,
  opts: { sidestick: boolean; engines: number; airbus: boolean },
): { scene: THREE.Scene; deck: Deck } {
  const scene = new THREE.Scene(),
    pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const hemi = new THREE.HemisphereLight('#dfe8f0', '#3a3f44', 1.1),
    sun = new THREE.DirectionalLight('#fff1dc', 1.6);
  sun.position.set(-1, 3, -2);
  scene.add(hemi, sun);
  const group = new THREE.Group();
  scene.add(group);
  const screens: Record<string, Screen> = {};
  let fcu: Screen | undefined;
  const tone = opts.airbus ? '#56616c' : '#5b5d5f',
    mat = (color: string, rough = 0.75, metal = 0.15, map?: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map }),
    panel = mat(tone, 0.8, 0.1, panelTexture(tone, 7, 'plain')),
    dark = mat('#23272b', 0.6, 0.2),
    black = mat('#0d0f11', 0.4, 0.3),
    trim = mat('#8b9196', 0.45, 0.6),
    seatMat = mat('#2f3a46', 0.9, 0);
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: THREE.Material = panel,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    group.add(o);
    return o;
  };
  const glass = (
    name: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    tilt: number,
    px = 512,
  ) => {
    const { mesh, s } = screen(w, h, px);
    mesh.position.set(x, y, z);
    mesh.rotation.x = -tilt;
    group.add(mesh);
    const bezel = box(w + 0.03, h + 0.03, 0.02, x, y, z - 0.012, black, -tilt);
    void bezel;
    screens[name] = s;
  };
  const levers: THREE.Object3D[] = [];
  let yoke: THREE.Object3D | undefined,
    stick: THREE.Object3D | undefined,
    flapLever: THREE.Object3D | undefined,
    spoilerLever: THREE.Object3D | undefined;
  if (kind === 'airliner') {
    // Windshield structure: centre post, side posts, header and sill.
    for (const s of [-1, 1]) {
      box(0.06, 0.7, 0.06, s * 0.82, 0.32, -1.18, dark, 0.38, 0, s * -0.1);
      box(0.055, 0.7, 0.055, s * 1.22, 0.28, -0.7, dark, 0.22, s * 0.5, s * -0.2);
      box(0.05, 0.6, 0.9, s * 1.35, 0.2, 0.05, dark);
    }
    box(0.05, 0.62, 0.05, 0, 0.36, -1.24, dark, 0.4);
    box(2.7, 0.08, 0.25, 0, 0.72, -0.98, dark, 0.4);
    box(2.9, 0.06, 0.6, 0, 0.92, -0.35, panel, 0.25);
    // Glareshield with the flight control unit, then the main instrument panel.
    box(2.4, 0.05, 0.36, 0, -0.2, -1.12, dark);
    box(2.4, 0.09, 0.03, 0, -0.245, -0.94, dark);
    {
      const { mesh, s } = screen(0.78, 0.06, 1024);
      mesh.position.set(0, -0.24, -0.923);
      group.add(mesh);
      fcu = s;
    }
    box(2.4, 0.56, 0.05, 0, -0.56, -1.13, panel, -0.1);
    const sy = -0.46,
      sz = -1.1,
      t = 0.1,
      sw = 0.22;
    glass('pfd', sw, sw, -0.72, sy, sz, t);
    glass('nd', sw, sw, -0.47, sy, sz, t);
    glass('ecam', sw, sw * 0.95, 0, sy, sz + 0.005, t);
    glass('nd2', sw, sw, 0.47, sy, sz, t);
    glass('pfd2', sw, sw, 0.72, sy, sz, t);
    glass('ecam2', 0.2, 0.18, 0, -0.74, -0.86, 0.75);
    // Pedestal with thrust levers, flap and speedbrake handles.
    box(0.52, 0.32, 1.0, 0, -0.92, -0.42, panel);
    box(0.5, 0.02, 0.95, 0, -0.755, -0.42, dark);
    for (let e = 0; e < opts.engines; e++) {
      const g = new THREE.Group();
      g.position.set((e - (opts.engines - 1) / 2) * 0.075, -0.75, -0.62);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.02), trim);
      arm.position.y = 0.08;
      g.add(arm);
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.035), black);
      knob.position.y = 0.165;
      g.add(knob);
      group.add(g);
      levers.push(g);
    }
    flapLever = new THREE.Group();
    flapLever.position.set(0.18, -0.75, -0.4);
    {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.1, 0.015), trim);
      a.position.y = 0.05;
      flapLever.add(a);
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.04), mat('#c9ccc8'));
      k.position.y = 0.1;
      flapLever.add(k);
    }
    group.add(flapLever);
    spoilerLever = new THREE.Group();
    spoilerLever.position.set(-0.18, -0.75, -0.55);
    {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.015), trim);
      a.position.y = 0.045;
      spoilerLever.add(a);
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.06), black);
      k.position.y = 0.09;
      spoilerLever.add(k);
    }
    group.add(spoilerLever);
    // Side consoles, sidestick or yoke, seats and the overhead panel.
    for (const s of [-1, 1]) {
      box(0.4, 0.25, 1.0, s * 1.0, -0.88, -0.25, panel);
      box(0.6, 0.9, 0.08, s * 0.55, -0.95, 0.45, seatMat);
      box(0.05, 1.0, 1.9, s * 1.4, -0.55, -0.3, panel);
      box(0.08, 0.05, 1.6, s * 1.33, -0.06, -0.3, dark);
    }
    box(3, 0.04, 2.8, 0, -1.08, -0.2, dark);
    box(3, 2.2, 0.05, 0, 0, 0.9, dark);
    if (opts.sidestick) {
      stick = new THREE.Group();
      stick.position.set(-1.0, -0.74, -0.28);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.18, 12), black);
      st.position.y = 0.09;
      stick.add(st);
      const grip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), black);
      grip.scale.set(1, 1.4, 1);
      grip.position.y = 0.2;
      stick.add(grip);
      group.add(stick);
    } else {
      yoke = new THREE.Group();
      yoke.position.set(-0.55, -0.68, -0.62);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), dark);
      col.rotation.x = 0.3;
      col.position.set(0, -0.2, 0.06);
      yoke.add(col);
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.018, 10, 28, Math.PI * 1.25),
        black,
      );
      wheel.rotation.z = Math.PI * 1.125;
      yoke.add(wheel);
      group.add(yoke);
    }
    const over = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.05, 0.9),
      mat(tone, 0.8, 0.1, panelTexture(tone, 11, 'switches')),
    );
    over.position.set(0, 0.98, -0.1);
    over.rotation.x = 0.42;
    group.add(over);
  } else if (kind === 'ga') {
    for (const s of [-1, 1]) {
      box(0.05, 0.7, 0.05, s * 0.62, 0.2, -0.85, dark, 0.45, 0, s * -0.15);
      box(0.05, 0.5, 1.1, s * 0.78, 0.05, -0.2, dark);
    }
    box(1.6, 0.06, 0.5, 0, 0.62, -0.45, mat('#d9d5cc', 0.9));
    box(1.36, 0.035, 0.24, 0, -0.2, -0.9, black);
    box(1.36, 0.05, 0.02, 0, -0.225, -0.78, black);
    box(
      1.36,
      0.4,
      0.06,
      0,
      -0.43,
      -0.92,
      mat('#3a3d40', 0.75, 0.15, panelTexture('#3a3d40', 5, 'plain')),
      -0.06,
    );
    glass('pfd', 0.3, 0.225, -0.24, -0.39, -0.885, 0.06);
    glass('mfd', 0.3, 0.225, 0.2, -0.39, -0.885, 0.06);
    for (const s of [-1, 1]) box(0.04, 0.6, 1.4, s * 0.74, -0.72, -0.3, panel);
    box(1.5, 0.04, 1.6, 0, -1.05, -0.3, dark);
    box(0.6, 0.2, 0.6, 0, -0.78, -0.35, panel);
    yoke = new THREE.Group();
    yoke.position.set(-0.24, -0.6, -0.7);
    {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 10), dark);
      col.rotation.x = Math.PI / 2;
      col.position.z = -0.1;
      yoke.add(col);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.03), black);
      yoke.add(bar);
      for (const s of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 10), black);
        h.position.set(s * 0.11, 0.035, 0);
        yoke.add(h);
      }
    }
    group.add(yoke);
    for (let e = 0; e < Math.max(1, opts.engines); e++) {
      const g = new THREE.Group();
      g.position.set(0.02 + e * 0.05, -0.66, -0.7);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 8), trim);
      a.rotation.x = Math.PI / 2;
      a.position.z = 0.06;
      g.add(a);
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), black);
      k.position.z = 0.12;
      g.add(k);
      group.add(g);
      levers.push(g);
    }
    for (const s of [-1, 1]) box(0.5, 0.8, 0.08, s * 0.36, -0.95, 0.4, seatMat);
  } else {
    box(0.7, 0.26, 0.08, 0, -0.42, -0.66, panel, -0.2);
    glass('gauges', 0.6, 0.2, 0, -0.41, -0.615, 0.2, 768);
    stick = new THREE.Group();
    stick.position.set(0, -0.78, -0.32);
    {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.4, 10), black);
      st.position.y = 0.2;
      stick.add(st);
    }
    group.add(stick);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.02, 8, 40, Math.PI), dark);
    frame.position.set(0, -0.3, 0.25);
    frame.rotation.y = Math.PI / 2;
    group.add(frame);
    for (const s of [-1, 1]) box(0.06, 0.12, 1.6, s * 0.42, -0.62, -0.2, mat('#e9ecee', 0.5));
  }
  const update: Deck['update'] = (s) => {
    for (const l of levers) l.rotation.x = kind === 'ga' ? 0 : -0.35 + s.throttle * 0.75;
    if (kind === 'ga') for (const l of levers) l.position.z = -0.7 - s.throttle * 0.06;
    if (yoke) {
      yoke.rotation.z = -s.roll * 0.6;
      yoke.position.z = (kind === 'ga' ? -0.7 : -0.62) + s.pitch * -0.05;
    }
    if (stick) {
      stick.rotation.z = -s.roll * 0.25;
      stick.rotation.x = s.pitch * 0.25;
    }
    if (flapLever) flapLever.rotation.x = -0.6 * s.flaps + 0.3;
    if (spoilerLever) spoilerLever.rotation.x = -0.6 * s.spoilers + 0.25;
    hemi.intensity = 0.25 + 0.9 * s.light;
    sun.intensity = 0.2 + 1.5 * s.light;
    scene.environmentIntensity = 0.25 + 0.75 * s.light;
  };
  return { scene, deck: { group, screens, fcu, update } };
}
/** Painted autopilot panel strip (speed, heading, altitude, vertical speed windows and mode lights). */
export function drawFcu(
  s: Screen,
  ap: {
    spd: number;
    hdg: number;
    alt: number;
    vs: number;
    master: boolean;
    athr: boolean;
    lat: string;
    vert: string;
    apr: boolean;
  },
) {
  const c = s.ctx,
    W = s.w,
    H = s.h;
  c.fillStyle = '#3d464f';
  c.fillRect(0, 0, W, H);
  const win = (x: number, label: string, val: string, on: boolean) => {
    c.fillStyle = '#e6e8e4';
    c.font = 'bold 13px Arial';
    c.textAlign = 'center';
    c.fillText(label, x, 16);
    c.fillStyle = '#0a0c0d';
    c.fillRect(x - 62, 22, 124, 40);
    c.fillStyle = '#ff9b2e';
    c.font = 'bold 30px "Roboto Mono",monospace';
    c.fillText(val, x, 54);
    if (on) {
      c.fillStyle = '#4ef07a';
      c.beginPath();
      c.arc(x + 74, 42, 5, 0, 7);
      c.fill();
    }
  };
  win(110, 'SPD', String(Math.round(ap.spd)), ap.athr);
  win(300, 'HDG', String(Math.round(ap.hdg)).padStart(3, '0'), ap.lat === 'HDG');
  win(
    560,
    'ALT',
    String(Math.round(ap.alt)).padStart(5, '0'),
    ap.vert === 'ALT' || ap.vert === 'ALTS',
  );
  win(800, 'V/S', `${ap.vs > 0 ? '+' : ''}${Math.round(ap.vs)}`, ap.vert === 'VS');
  const btn = (x: number, t: string, on: boolean) => {
    c.fillStyle = '#1f2428';
    c.fillRect(x - 30, 66, 60, 14);
    c.fillStyle = on ? '#4ef07a' : '#69737b';
    c.fillRect(x - 14, 68, 28, 4);
    c.fillStyle = '#d9dcd6';
    c.font = 'bold 10px Arial';
    c.fillText(t, x, 80);
  };
  btn(930, 'AP', ap.master);
  btn(990, 'A/THR', ap.athr);
  btn(400, 'LOC', ap.lat === 'LOC');
  btn(460, 'APPR', ap.apr);
  btn(680, 'NAV', ap.lat === 'NAV');
  s.tex.needsUpdate = true;
}
/** Glider instruments: airspeed, altimeter and variometer. */
export function drawGliderGauges(s: Screen, d: { ias: number; alt: number; vs: number }) {
  const c = s.ctx,
    W = s.w,
    H = s.h;
  c.fillStyle = '#1a1d20';
  c.fillRect(0, 0, W, H);
  const g = (i: number, label: string, v: number, max: number, text: string, center = false) => {
    const x = (W * (i + 0.5)) / 3,
      y = H / 2,
      r = H * 0.42;
    c.fillStyle = '#08090a';
    c.beginPath();
    c.arc(x, y, r, 0, 7);
    c.fill();
    c.strokeStyle = '#ddd';
    c.lineWidth = 2;
    for (let k = 0; k <= 10; k++) {
      const a =
        (center ? -Math.PI : -Math.PI * 0.75) + (k / 10) * (center ? Math.PI * 2 : Math.PI * 1.5);
      c.beginPath();
      c.moveTo(x + Math.cos(a - Math.PI / 2) * r * 0.8, y + Math.sin(a - Math.PI / 2) * r * 0.8);
      c.lineTo(x + Math.cos(a - Math.PI / 2) * r * 0.92, y + Math.sin(a - Math.PI / 2) * r * 0.92);
      c.stroke();
    }
    const f = center ? Math.max(-1, Math.min(1, v / max)) : Math.max(0, Math.min(1, v / max)),
      a = center ? f * Math.PI * 0.9 : -Math.PI * 0.75 + f * Math.PI * 1.5;
    c.strokeStyle = '#fff';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.sin(a) * r * 0.78, y - Math.cos(a) * r * 0.78);
    c.stroke();
    c.fillStyle = '#ddd';
    c.font = `${Math.round(H * 0.09)}px Arial`;
    c.textAlign = 'center';
    c.fillText(label, x, y + r * 0.45);
    c.font = `bold ${Math.round(H * 0.11)}px "Roboto Mono",monospace`;
    c.fillText(text, x, y - r * 0.3);
  };
  g(0, 'KT', d.ias, 150, String(Math.round(d.ias)));
  g(1, 'FT', d.alt % 1000, 1000, String(Math.round(d.alt)));
  g(2, 'M/S', d.vs / 196.85, 5, (d.vs / 196.85).toFixed(1), true);
  s.tex.needsUpdate = true;
}
/** Modelled flight deck (converted FlightGear deck): placed so the pilot eye is at the camera origin, with the
 *  display units turned into live canvas screens keyed like the procedural deck's (pfd, nd, ecam …). */
const DECK_SCREENS: Record<string, string> = {
  'pfd1.screen': 'pfd',
  'pfd2.screen': 'pfd2',
  'ND.screen': 'nd',
  'ND_R.screen': 'nd2',
  'uecam.screen': 'ecam',
  'lecam.screen': 'ecam2',
};
// GLTFLoader strips dots from node names, so match on the sanitised name
const SCREEN_BY_NAME = Object.fromEntries(
  Object.entries(DECK_SCREENS).map(([k, v]) => [k.replace(/[.\s]/g, ''), v]),
);
export function modelDeck(model: THREE.Object3D, eye: [number, number, number]): Deck {
  const group = new THREE.Group();
  model.position.set(-eye[0], -eye[1], -eye[2]);
  group.add(model);
  const screens: Record<string, Screen> = {};
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const plain = (n?: string) => (n ?? '').replace(/[.\s]/g, ''),
      key = SCREEN_BY_NAME[plain(mesh.name)] ?? SCREEN_BY_NAME[plain(mesh.parent?.name)];
    if (key && !screens[key]) {
      const c = document.createElement('canvas');
      c.width = c.height = 640;
      const ctx = c.getContext('2d')!;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.anisotropy = 8;
      mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      screens[key] = { ctx, tex, w: 640, h: 640 };
      return;
    }
    // other glass screens (MCDU, DCDU …) stay dark glass
    if (/screen/i.test(mesh.name + (mesh.parent?.name ?? '')))
      mesh.material = new THREE.MeshStandardMaterial({
        color: '#05080a',
        roughness: 0.15,
        metalness: 0.1,
      });
  });
  return { group, screens, update: () => {} };
}
