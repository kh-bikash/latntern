import { WORLD_SCENES, zoneCenter, type Chapter, type SoundKind } from "./world";
import type { TrialKind } from "./adventure";
export type Surface = "grass" | "concrete" | "wood" | "snow";
export type AudioMix = { master: number; ambience: number; effects: number };
export const DEFAULT_MIX: AudioMix = { master: .8, ambience: .75, effects: .8 };
type Layer = { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; filter: BiquadFilterNode };
let audio: AudioContext | null = null, master: GainNode, worldBus: GainNode, effectsBus: GainNode;
let roomVerb: ConvolverNode, verbSend: GainNode, enabled = false, generation = 0, cinematic = false;
let mix = { ...DEFAULT_MIX }, lastStep = -1;
const buffers = new Map<string, Promise<AudioBuffer>>(), layers = new Map<string, Layer>();
const pending = new Map<string, number>(), activeEffects = new Set<AudioBufferSourceNode>();
const desired = new Map<string, { volume: number; pan: number; cutoff: number }>();
const loopBuffers = new WeakMap<AudioBuffer, AudioBuffer>();
const AMBIENT_FILES = ["wind-trees", "forest-birds", "rain-puddles", "ocean-waves", "small-cascade", "hearth"];
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
function context() {
  if (!audio) {
    audio = new AudioContext(); master = audio.createGain(); worldBus = audio.createGain(); effectsBus = audio.createGain();
    const lowCut = audio.createBiquadFilter(), limiter = audio.createDynamicsCompressor();
    lowCut.type = "highpass"; lowCut.frequency.value = 45;
    limiter.threshold.value = -9; limiter.knee.value = 8; limiter.ratio.value = 6; limiter.attack.value = .004; limiter.release.value = .2;
    worldBus.connect(master); effectsBus.connect(master); master.connect(lowCut).connect(limiter).connect(audio.destination); master.gain.value = 0;
    // A quiet diffuse reflection tail models the cavern; all source sounds are recordings.
    roomVerb = audio.createConvolver(); verbSend = audio.createGain(); const impulse = audio.createBuffer(2, audio.sampleRate * 1.8, audio.sampleRate);
    for (let c = 0; c < 2; c++) { const data = impulse.getChannelData(c); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3); }
    roomVerb.buffer = impulse; effectsBus.connect(verbSend).connect(roomVerb).connect(master); verbSend.gain.value = 0;
    document.addEventListener("visibilitychange", () => { if (!audio) return; if (document.hidden) void audio.suspend(); else if (enabled) void audio.resume().catch(() => {}); });
  }
  return audio;
}
function applyMix() { if (!audio) return; const t = audio.currentTime; master.gain.setTargetAtTime(enabled ? mix.master : 0, t, .035); worldBus.gain.setTargetAtTime(mix.ambience * (cinematic ? .85 : 1), t, .35); effectsBus.gain.setTargetAtTime(mix.effects, t, .04); }
export function setAudioMix(next: AudioMix) { mix = { master: clamp(next.master), ambience: clamp(next.ambience), effects: clamp(next.effects) }; applyMix(); }
export function setCinematicMix(value: boolean) { cinematic = value; applyMix(); }
export function unlockAudio() { const ctx = context(); enabled = true; if (!document.hidden) void ctx.resume().catch(() => {}); applyMix(); }
function buffer(path: string) {
  let result = buffers.get(path);
  if (!result) { const ctx = context(); result = fetch(path).then(r => { if (!r.ok) throw new Error(`Audio unavailable: ${path}`); return r.arrayBuffer(); }).then(data => ctx.decodeAudioData(data)).then(decoded => {
    if (!AMBIENT_FILES.some(file => path === `/audio/${file}.mp3`)) return decoded;
    // Keep a substantial recording passage, avoiding start handling noise and oversized decoded loops.
    const start = Math.floor(Math.min(8, decoded.duration * .05) * decoded.sampleRate), length = Math.min(decoded.length - start, decoded.sampleRate * 50);
    const passage = ctx.createBuffer(decoded.numberOfChannels, length, decoded.sampleRate); let sum=0,count=0;
    for(let c=0;c<decoded.numberOfChannels;c++){const input=decoded.getChannelData(c).subarray(start,start+length);passage.getChannelData(c).set(input);for(let i=0;i<input.length;i+=32){sum+=input[i]*input[i];count++;}}
    const level=Math.min(10,.12/Math.max(.001,Math.sqrt(sum/count)));
    for(let c=0;c<passage.numberOfChannels;c++){const data=passage.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=Math.tanh(data[i]*level)*.95;}
    return passage;
  }); buffers.set(path, result); result.catch(() => buffers.delete(path)); }
  return result;
}
function seamless(source: AudioBuffer) {
  const cached=loopBuffers.get(source);if(cached)return cached;
  const ctx = context(), fade = Math.min(Math.floor(source.sampleRate * 1.2), Math.floor(source.length / 6)), size = source.length - fade;
  const result = ctx.createBuffer(source.numberOfChannels, size, source.sampleRate);
  for (let c = 0; c < source.numberOfChannels; c++) { const input = source.getChannelData(c), output = result.getChannelData(c); output.set(input.subarray(fade, source.length - fade)); for (let i = 0; i < fade; i++) { const t = i / fade; output[size - fade + i] = input[source.length - fade + i] * (1 - t) + input[i] * t; } }
  loopBuffers.set(source,result);return result;
}
function layer(file: string, volume: number, pan = 0, cutoff = 8500) {
  desired.set(file, { volume, pan, cutoff }); const existing = layers.get(file);
  if (existing && audio) { const t = audio.currentTime; existing.gain.gain.setTargetAtTime(volume, t, .6); existing.pan.pan.setTargetAtTime(pan, t, .25); existing.filter.frequency.setTargetAtTime(cutoff, t, .4); return; }
  if (!enabled || pending.has(file) || volume < .002) return;
  const ticket = generation; pending.set(file, ticket);
  void buffer(`/audio/${file}.mp3`).then(decoded => {
    if (!enabled || ticket !== generation) return;
    const target = desired.get(file); if (!target || target.volume < .002) return;
    const ctx = context(), source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner(), filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = target.cutoff; source.buffer = seamless(decoded); source.loop = true; gain.gain.value = 0; pan.pan.value = target.pan;
    source.connect(filter).connect(gain).connect(pan).connect(worldBus); source.start(0, Math.random() * Math.max(.01, source.buffer.duration - 2));
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
    layers.set(file, { source, gain, pan, filter }); gain.gain.setTargetAtTime(target.volume, ctx.currentTime, .8);
  }).catch(() => {}).finally(() => { if (pending.get(file) === ticket) pending.delete(file); });
}
export function stopAmbience() { enabled = false; generation++; applyMix(); for (const value of layers.values()) { try { value.source.stop(); } catch {} } for (const source of activeEffects) { try { source.stop(); } catch {} } layers.clear(); activeEffects.clear(); desired.clear(); pending.clear(); }
export function startAmbience(kind: Chapter["ambient"]) {
  unlockAudio(); updateAdventureSoundscape(kind, .04, 0);
  for (const surface of ["grass", "concrete", "wood", "snow"]) for (let i = 0; i < 5; i++) void buffer(`/audio/foley/footstep_${surface}_00${i}.ogg`).catch(() => {});
  for (const file of ["bronze-bell.mp3", "page-turn.mp3", "foley/impactSoft_medium_000.ogg", "foley/impactMetal_light_000.ogg"]) void buffer(`/audio/${file}`).catch(() => {});
}
async function effect(path: string, volume: number, rate = 1, pan = 0, duration?: number, offset = 0, delay = 0) {
  if (!enabled || document.hidden) return; const ticket = generation;
  try {
    const decoded = await buffer(path); if (!enabled || ticket !== generation || document.hidden || activeEffects.size >= 24) return;
    const ctx = context(), start = ctx.currentTime + delay, length = Math.min(duration ?? decoded.duration / rate, (decoded.duration - offset) / rate); if (length <= .012) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    source.buffer = decoded; source.playbackRate.value = rate; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .004);
    gain.gain.setValueAtTime(volume, start + Math.max(.005, length - .06)); gain.gain.linearRampToValueAtTime(0, start + length); stereo.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain).connect(stereo).connect(effectsBus); activeEffects.add(source); source.onended = () => { activeEffects.delete(source); source.disconnect(); gain.disconnect(); stereo.disconnect(); };
    source.start(start, offset); source.stop(start + length + .01);
  } catch { /* Audio failures must never block the game. */ }
}
export function playFootstep(surface: Surface, speed: number, side = 0, pan = 0, distance = 0) {
  let sample = Math.floor(Math.random() * 5); if (sample === lastStep) sample = (sample + 1) % 5; lastStep = sample;
  void effect(`/audio/foley/footstep_${surface}_00${sample}.ogg`, (speed > 3.2 ? .32 : .23) * Math.max(0, 1 - distance / 1100), .97 + Math.random() * .06, pan + (side ? .035 : -.035));
}
export function playJump() { void effect("/audio/foley/impactSoft_medium_000.ogg", .16, 1.12); }
export function playLanding(surface: Surface, impact: number) { void effect(`/audio/foley/footstep_${surface}_003.ogg`, Math.min(.5, .18 + impact / 2200), .83); void effect("/audio/foley/impactSoft_heavy_000.ogg", .09, 1); }
export function playInteraction(kind: TrialKind | "shard" | "page" | "gate" | "checkpoint" | "inspect" | "quest" | "upgrade", value: unknown, pan = 0) {
  if (kind === "bells") { const note = typeof value === "number" ? value : 0; void effect("/audio/bronze-bell.mp3", .35, [1, 1.25992, 1.49831][note] ?? 1, pan); }
  else if (kind === "mirrors") { void effect("/audio/foley/impactMetal_light_000.ogg", .24, .98, pan); void effect("/audio/foley/impactMetal_light_001.ogg", .1, 1.05, pan, undefined, 0, .13); }
  else if (kind === "page") { void effect("/audio/foley/impactWood_light_001.ogg", .22, .88, pan); void effect("/audio/page-turn.mp3", .3, 1, pan, undefined, 0, .15); }
  else if (kind === "shard" || kind === "embers") void effect("/audio/foley/impactGlass_light_000.ogg", .23, kind === "shard" ? 1.14 : .9, pan);
  else if (kind === "gate") void effect("/audio/foley/impactWood_heavy_000.ogg", .3, .9, pan);
  else if (kind === "checkpoint") void effect("/audio/foley/impactSoft_heavy_000.ogg", .18);
  else if (kind === "runes" || kind === "inspect") void effect("/audio/foley/impactMining_000.ogg", .2, .95, pan);
  else if (kind === "rescue" || kind === "quest") playStoryCue("paper");
  else if (kind === "upgrade") { void effect("/audio/foley/impactMetal_light_000.ogg", .25); playStoryCue("bell"); }
}
export function playStoryCue(cue: "paper" | "bell" | "footsteps" | "shadow" | "dawn") {
  if (cue === "paper") void effect("/audio/page-turn.mp3", .26);
  else if (cue === "footsteps") { playFootstep("concrete", 1); void effect("/audio/foley/footstep_concrete_002.ogg", .16, 1, -.1, undefined, 0, .4); }
  else if (cue === "shadow") void effect("/audio/foley/impactMining_000.ogg", .19, .73);
  else if (cue === "dawn") { void effect("/audio/bronze-bell.mp3", .25); void effect("/audio/bronze-bell.mp3", .13, 1.49831, .3, undefined, 0, .7); }
  else void effect("/audio/bronze-bell.mp3", .23);
}
export function playRestoration() { playStoryCue("dawn"); void effect("/audio/foley/impactWood_heavy_000.ogg", .14, .78, 0, undefined, 0, .12); }
export function updateAdventureSoundscape(kind: Chapter["ambient"], progress: number, time: number, shrineX?: number, charge = 0) {
  if (!enabled) return; const x = progress * 4100, riverSource = 1650, water = Math.exp(-Math.abs(riverSource - x) / 1100);
  layer("wind-trees", (kind === "cave" ? .007 : kind === "snow" ? .085 : .032) * (.85 + Math.sin(time * .17) * .12 + Math.sin(time * .043) * .06), Math.sin(time * .045) * .18, kind === "cave" ? 950 : 4200);
  layer("forest-birds", ["forest", "wind", "village", "river"].includes(kind) ? (kind === "forest" ? .055 : .025) * (.75 + Math.sin(time * .061) * .25) : 0, Math.sin(time * .032) * .5);
  layer("rain-puddles", kind === "rain" ? .13 : 0, -.1); layer("ocean-waves", kind === "sea" ? .11 * (.8 + Math.sin(time * .12) * .12) : 0, .25);
  layer("small-cascade", kind === "river" ? .04 + .16 * water : kind === "cave" ? .015 + .012 * water : 0, Math.max(-.75, Math.min(.75, (riverSource - x) / 900)), kind === "cave" ? 1900 : 10000);
  const fireDistance = shrineX === undefined ? Infinity : Math.abs(shrineX - x);
  layer("hearth", Math.exp(-fireDistance / 210) * (.035 + charge * .05), Math.max(-.6, Math.min(.6, ((shrineX ?? x) - x) / 500)), 7200);
  if (audio) verbSend.gain.setTargetAtTime(kind === "cave" ? .2 : kind === "snow" ? .035 : 0, audio.currentTime, .6);
}
// Compatibility for archived 3D components.
export function updateSoundscape(x: number, z: number, _facing: number, time: number) { let nearest = WORLD_SCENES[0], distance = Infinity; for (const scene of WORLD_SCENES) { const center = zoneCenter(scene), d = Math.hypot(x - center.x, z - center.z); if (d < distance) { distance = d; nearest = scene; } } updateAdventureSoundscape(nearest.ambient, .5, time); }
export function playSound(kind: SoundKind) { if (kind === "bell") playStoryCue("bell"); else if (kind === "wood" || kind === "fire") playInteraction("gate", null); else if (kind === "leaves" || kind === "snow") playFootstep(kind === "snow" ? "snow" : "grass", 1); }
