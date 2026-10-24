// Synthesized aircraft sound (no recordings): piston or turbofan engines, airflow, runway rumble, warning
// tones, touchdown, radio clicks, plus spoken ATC and GPWS callouts through the browser speech engine.
export type AudioState = {
  n1: number;
  running: boolean;
  speed: number;
  ground: boolean;
  cockpit: boolean;
  stall: boolean;
  gearWarn: boolean;
  overspeed: boolean;
  reverse: boolean;
  spoilers: number;
  rain: number;
};
export class AircraftAudio {
  private ctx: AudioContext;
  private master: GainNode;
  private cabin: BiquadFilterNode;
  private parts: { stop: () => void }[] = [];
  private engGain: GainNode;
  private engOsc: OscillatorNode[] = [];
  private roarFilter: BiquadFilterNode;
  private roarGain: GainNode;
  private whine: OscillatorNode;
  private whineGain: GainNode;
  private air: GainNode;
  private airFilter: BiquadFilterNode;
  private rumble: GainNode;
  private rain: GainNode;
  private horn: OscillatorNode;
  private hornGain: GainNode;
  private clack: GainNode;
  constructor(
    private kind: 'piston' | 'jet',
    private engines: number,
  ) {
    const c = (this.ctx = new AudioContext());
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.cabin = c.createBiquadFilter();
    this.cabin.type = 'lowpass';
    this.cabin.frequency.value = 20000;
    this.master.connect(this.cabin).connect(c.destination);
    const noise = (seconds = 3, brown = false) => {
      const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate),
        d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        last = brown ? (last + 0.02 * w) / 1.02 : w;
        d[i] = brown ? last * 3.5 : w;
      }
      const s = c.createBufferSource();
      s.buffer = b;
      s.loop = true;
      s.start();
      this.parts.push({ stop: () => s.stop() });
      return s;
    };
    this.engGain = c.createGain();
    this.engGain.gain.value = 0;
    const engFilter = c.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = kind === 'jet' ? 600 : 900;
    this.engGain.connect(engFilter).connect(this.master);
    if (kind === 'piston')
      for (let e = 0; e < engines; e++)
        for (const [type, mult, g] of [
          ['sawtooth', 1, 0.6],
          ['square', 2, 0.18],
          ['triangle', 0.5, 0.5],
        ] as [OscillatorType, number, number][]) {
          const o = c.createOscillator();
          o.type = type;
          o.frequency.value = 40 * mult;
          const og = c.createGain();
          og.gain.value = g / engines;
          o.connect(og).connect(this.engGain);
          o.start();
          this.engOsc.push(o);
          this.parts.push({ stop: () => o.stop() });
          (o as any).mult = mult * (1 + e * 0.013);
        }
    this.roarFilter = c.createBiquadFilter();
    this.roarFilter.type = 'lowpass';
    this.roarFilter.frequency.value = 300;
    this.roarGain = c.createGain();
    this.roarGain.gain.value = 0;
    noise(4, kind === 'piston')
      .connect(this.roarFilter)
      .connect(this.roarGain)
      .connect(this.master);
    this.whine = c.createOscillator();
    this.whine.type = 'sine';
    this.whine.frequency.value = 800;
    this.whineGain = c.createGain();
    this.whineGain.gain.value = 0;
    this.whine.connect(this.whineGain).connect(this.master);
    this.whine.start();
    this.parts.push({ stop: () => this.whine.stop() });
    this.airFilter = c.createBiquadFilter();
    this.airFilter.type = 'bandpass';
    this.airFilter.frequency.value = 900;
    this.airFilter.Q.value = 0.6;
    this.air = c.createGain();
    this.air.gain.value = 0;
    noise(3).connect(this.airFilter).connect(this.air).connect(this.master);
    const rf = c.createBiquadFilter();
    rf.type = 'lowpass';
    rf.frequency.value = 140;
    this.rumble = c.createGain();
    this.rumble.gain.value = 0;
    noise(2, true).connect(rf).connect(this.rumble).connect(this.master);
    const rainF = c.createBiquadFilter();
    rainF.type = 'highpass';
    rainF.frequency.value = 2500;
    this.rain = c.createGain();
    this.rain.gain.value = 0;
    noise(2).connect(rainF).connect(this.rain).connect(this.master);
    this.horn = c.createOscillator();
    this.horn.type = 'square';
    this.horn.frequency.value = kind === 'jet' ? 520 : 1500;
    const hf = c.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = kind === 'jet' ? 600 : 1500;
    this.hornGain = c.createGain();
    this.hornGain.gain.value = 0;
    this.horn.connect(hf).connect(this.hornGain).connect(c.destination);
    this.horn.start();
    this.parts.push({ stop: () => this.horn.stop() });
    const cl = c.createOscillator();
    cl.type = 'square';
    cl.frequency.value = 2200;
    this.clack = c.createGain();
    this.clack.gain.value = 0;
    cl.connect(this.clack).connect(c.destination);
    cl.start();
    this.parts.push({ stop: () => cl.stop() });
    void c.resume();
  }
  update(s: AudioState) {
    const c = this.ctx,
      t = c.currentTime,
      n = Math.max(0, s.n1),
      cab = s.cockpit;
    this.cabin.frequency.setTargetAtTime(cab ? (this.kind === 'jet' ? 1800 : 1100) : 18000, t, 0.2);
    if (this.kind === 'piston') {
      const rpm = n * 2700,
        f = rpm / 60;
      for (const o of this.engOsc)
        o.frequency.setTargetAtTime(Math.max(8, f * ((o as any).mult ?? 1)), t, 0.15);
      this.engGain.gain.setTargetAtTime(
        n > 0.03 ? (0.05 + 0.16 * n) * (cab ? 1.3 : 1) : 0,
        t,
        0.15,
      );
      this.roarFilter.frequency.setTargetAtTime(160 + n * 900, t, 0.2);
      this.roarGain.gain.setTargetAtTime(n > 0.03 ? 0.03 + 0.08 * n : 0, t, 0.2);
      this.whineGain.gain.setTargetAtTime(0, t, 0.1);
    } else {
      this.roarFilter.frequency.setTargetAtTime(180 + n * n * 2600 + (s.reverse ? 900 : 0), t, 0.4);
      this.roarGain.gain.setTargetAtTime(
        n > 0.02 ? (0.02 + 0.22 * n * n + (s.reverse ? 0.1 : 0)) * (cab ? 0.55 : 1) : 0,
        t,
        0.4,
      );
      this.whine.frequency.setTargetAtTime(400 + n * 2900, t, 0.5);
      this.whineGain.gain.setTargetAtTime(n > 0.02 ? (cab ? 0.004 : 0.012) * (0.4 + n) : 0, t, 0.5);
      this.engGain.gain.setTargetAtTime(0, t, 0.1);
    }
    this.airFilter.frequency.setTargetAtTime(500 + s.speed * 10, t, 0.3);
    this.air.gain.setTargetAtTime(
      Math.min(0.14, s.speed * s.speed * 1.2e-5 + s.spoilers * 0.04) * (cab ? 0.7 : 1),
      t,
      0.3,
    );
    this.rumble.gain.setTargetAtTime(s.ground ? Math.min(0.5, s.speed * 0.012) : 0, t, 0.1);
    this.rain.gain.setTargetAtTime(s.rain * 0.05, t, 0.5);
    const beat = Math.sin(t * Math.PI * 2 * (this.kind === 'jet' ? 2.2 : 0)) > 0;
    this.hornGain.gain.setTargetAtTime(
      s.stall
        ? this.kind === 'jet'
          ? beat
            ? 0.05
            : 0
          : 0.05
        : s.gearWarn
          ? Math.sin(t * 6) > 0
            ? 0.03
            : 0
          : 0,
      t,
      0.02,
    );
    this.clack.gain.setTargetAtTime(
      s.overspeed && Math.sin(t * 2 * Math.PI * 9) > 0.6 ? 0.025 : 0,
      t,
      0.005,
    );
  }
  touchdown(sink: number) {
    const c = this.ctx,
      t = c.currentTime,
      b = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.08));
    const src = c.createBufferSource();
    src.buffer = b;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = c.createGain();
    g.gain.value = Math.min(0.6, 0.15 + sink * 0.12);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    const o = c.createOscillator(),
      og = c.createGain();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    og.gain.setValueAtTime(Math.min(0.8, 0.2 + sink * 0.2), t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
  }
  tone(kind: 'ap' | 'click' | 'chime' | 'master') {
    const c = this.ctx,
      t = c.currentTime,
      seq =
        kind === 'ap'
          ? this.kind === 'jet'
            ? [
                [1050, 0],
                [1400, 0.12],
                [1760, 0.24],
                [1400, 0.36],
                [1050, 0.48],
                [1400, 0.6],
              ]
            : [
                [880, 0],
                [660, 0.18],
                [880, 0.36],
              ]
          : kind === 'click'
            ? [[2400, 0]]
            : kind === 'chime'
              ? [
                  [1250, 0],
                  [1000, 0.25],
                ]
              : [
                  [700, 0],
                  [700, 0.3],
                  [700, 0.6],
                ];
    for (const [f, d] of seq) {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = kind === 'click' ? 'square' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(kind === 'click' ? 0.03 : 0.06, t + d);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + (kind === 'click' ? 0.03 : 0.2));
      o.connect(g).connect(c.destination);
      o.start(t + d);
      o.stop(t + d + 0.25);
    }
  }
  dispose() {
    for (const p of this.parts) {
      try {
        p.stop();
      } catch {}
    }
    void this.ctx.close();
  }
}
/** Speech for ATC voices, pilot readbacks and cockpit callouts. */
export class Speaker {
  queue: { text: string; voice: 'atc' | 'pilot' | 'gpws' }[] = [];
  speaking = false;
  enabled = true;
  onStart?: (v: string) => void;
  private pick(kind: 'atc' | 'pilot' | 'gpws') {
    const voices =
      typeof speechSynthesis === 'undefined'
        ? []
        : speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!voices.length) return undefined;
    const pref =
      kind === 'atc'
        ? /(Guy|David|Daniel|Google UK English Male|Mark|Alex)/i
        : kind === 'pilot'
          ? /(Aria|Zira|Samantha|Google US English|Jenny|Karen)/i
          : /(Fred|Google US English|Mark|David)/i;
    return (
      voices.find((v) => pref.test(v.name)) ??
      voices[kind === 'atc' ? 0 : kind === 'pilot' ? Math.min(1, voices.length - 1) : 0]
    );
  }
  say(text: string, voice: 'atc' | 'pilot' | 'gpws' = 'atc', urgent = false) {
    if (!this.enabled || typeof speechSynthesis === 'undefined') return;
    if (urgent) {
      this.queue = this.queue.filter((q) => q.voice !== 'gpws');
      this.queue.unshift({ text, voice });
      if (this.speaking && voice === 'gpws') {
        speechSynthesis.cancel();
        this.speaking = false;
      }
    } else {
      if (this.queue.length > 6) this.queue.shift();
      this.queue.push({ text, voice });
    }
    this.next();
  }
  private next() {
    if (this.speaking || !this.queue.length) return;
    const q = this.queue.shift()!,
      u = new SpeechSynthesisUtterance(q.text),
      v = this.pick(q.voice);
    if (v) u.voice = v;
    u.rate = q.voice === 'gpws' ? 1.05 : q.voice === 'atc' ? 1.12 : 1.08;
    u.pitch = q.voice === 'gpws' ? 0.8 : q.voice === 'pilot' ? 1.05 : 0.92;
    u.volume = q.voice === 'gpws' ? 1 : 0.85;
    this.speaking = true;
    this.onStart?.(q.voice);
    u.onend = u.onerror = () => {
      this.speaking = false;
      setTimeout(() => this.next(), q.voice === 'gpws' ? 50 : 350);
    };
    speechSynthesis.speak(u);
  }
  stop() {
    this.queue = [];
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.speaking = false;
  }
}
