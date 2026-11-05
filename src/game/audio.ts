// Motor de sonido sintetizado: música generativa por eras, ambiente del mundo y efectos.
// Todo se genera con Web Audio (sin archivos), con buses separados para música, ambiente y efectos.

type Settings = { sound: boolean; music?: number; sfx?: number; ambience?: number };

let ctx: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, ambBus: GainNode, reverb: ConvolverNode, reverbSend: GainNode;
let started = false;

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    ambBus = ctx.createGain();
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.2, 2.4);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.35;
    reverbSend.connect(reverb).connect(master);
    musicBus.connect(master);
    musicBus.connect(reverbSend);
    sfxBus.connect(master);
    ambBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function impulse(a: AudioContext, dur: number, decay: number) {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(a: AudioContext) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b = (b + 0.02 * w) / 1.02; // ruido marrón suave mezclado
    d[i] = w * 0.5 + b * 3;
  }
  return noiseBuf;
}

export function applyAudioSettings(s: Settings) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const on = s.sound ? 1 : 0;
  musicBus.gain.setTargetAtTime(on * (s.music ?? 0.6) * 0.55, t, 0.3);
  sfxBus.gain.setTargetAtTime(on * (s.sfx ?? 0.8), t, 0.1);
  ambBus.gain.setTargetAtTime(on * (s.ambience ?? 0.6) * 0.5, t, 0.3);
}

// ───────────────────────── Instrumentos
function pluck(freq: number, t: number, dur: number, vol: number, bus: AudioNode, bright = 0.5) {
  const a = ctx!;
  const o = a.createOscillator();
  const o2 = a.createOscillator();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  o.type = 'triangle';
  o2.type = 'sawtooth';
  o.frequency.value = freq;
  o2.frequency.value = freq * 1.003;
  const g2 = a.createGain();
  g2.gain.value = 0.18 * bright;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(400 + bright * 3600, t);
  f.frequency.exponentialRampToValueAtTime(300, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f);
  o2.connect(g2).connect(f);
  f.connect(g).connect(bus);
  o.start(t); o2.start(t);
  o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function pad(freqs: number[], t: number, dur: number, vol: number, bus: AudioNode, type: OscillatorType = 'sawtooth') {
  const a = ctx!;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  f.Q.value = 0.5;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(bus);
  for (const fr of freqs) {
    for (const det of [-6, 6]) {
      const o = a.createOscillator();
      o.type = type;
      o.frequency.value = fr;
      o.detune.value = det;
      const og = a.createGain();
      og.gain.value = 0.5 / freqs.length;
      o.connect(og).connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
  // lfo del filtro
  const lfo = a.createOscillator();
  const lg = a.createGain();
  lfo.frequency.value = 0.08;
  lg.gain.value = 350;
  lfo.connect(lg).connect(f.frequency);
  lfo.start(t);
  lfo.stop(t + dur);
}
function drum(t: number, freq: number, vol: number, bus: AudioNode, dur = 0.35) {
  const a = ctx!;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * 2.2, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function shaker(t: number, vol: number, bus: AudioNode, freq = 6000, dur = 0.06) {
  const a = ctx!;
  const s = a.createBufferSource();
  s.buffer = noiseBuffer(a);
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random());
  s.stop(t + dur + 0.02);
}
function flute(freq: number, t: number, dur: number, vol: number, bus: AudioNode) {
  const a = ctx!;
  const o = a.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const vib = a.createOscillator();
  const vg = a.createGain();
  vib.frequency.value = 5;
  vg.gain.value = freq * 0.006;
  vib.connect(vg).connect(o.frequency);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.08);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  // aliento
  const n = a.createBufferSource();
  n.buffer = noiseBuffer(a);
  const nf = a.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = freq * 2;
  nf.Q.value = 6;
  const ng = a.createGain();
  ng.gain.value = vol * 0.25;
  n.connect(nf).connect(ng).connect(g);
  o.connect(g).connect(bus);
  o.start(t); vib.start(t); n.start(t, Math.random());
  o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05); n.stop(t + dur + 0.05);
}

// ───────────────────────── Música generativa
// Cada era tiene su modo, tempo e instrumentación.
const ERA_MUSIC = [
  { root: 146.83, scale: [0, 3, 5, 7, 10], bpm: 66, lead: 'flute', drums: 'frame', padType: 'triangle' as OscillatorType }, // tribal: pentatónica menor, tambores
  { root: 155.56, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 72, lead: 'pluck', drums: 'frame', padType: 'sawtooth' as OscillatorType }, // bronce: frigio dominante
  { root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 76, lead: 'pluck', drums: 'march', padType: 'sawtooth' as OscillatorType }, // hierro: dórico
  { root: 164.81, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 80, lead: 'flute', drums: 'none', padType: 'triangle' as OscillatorType }, // clásica: jónico
  { root: 146.83, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 70, lead: 'pluck', drums: 'march', padType: 'sawtooth' as OscillatorType }, // medieval: eólico
  { root: 174.61, scale: [0, 2, 4, 5, 7, 9, 10], bpm: 84, lead: 'pluck', drums: 'none', padType: 'triangle' as OscillatorType }, // renacimiento: mixolidio
];

interface MusicState { era: number; mood: 'calm' | 'tense' | 'war'; step: number; next: number; chord: number; phrase: number[]; }
const music: MusicState = { era: 0, mood: 'calm', step: 0, next: 0, chord: 0, phrase: [] };
let musicTimer = 0;

function noteFreq(root: number, scale: number[], degree: number) {
  const oct = Math.floor(degree / scale.length);
  const d = ((degree % scale.length) + scale.length) % scale.length;
  return root * Math.pow(2, oct + scale[d] / 12);
}

function makePhrase(len: number) {
  const out: number[] = [];
  let d = Math.floor(Math.random() * 4) + 4;
  for (let i = 0; i < len; i++) {
    if (Math.random() < 0.28) out.push(-99); // silencio
    else {
      d += [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(Math.random() * 8)];
      d = Math.max(2, Math.min(11, d));
      out.push(d);
    }
  }
  return out;
}

function scheduleMusic() {
  if (!ctx) return;
  const a = ctx;
  const m = ERA_MUSIC[music.era] ?? ERA_MUSIC[0];
  const war = music.mood === 'war';
  const bpm = m.bpm * (war ? 1.25 : 1);
  const beat = 60 / bpm;
  const eighth = beat / 2;
  while (music.next < a.currentTime + 0.6) {
    const t = Math.max(music.next, a.currentTime + 0.02);
    const step = music.step;
    const bar = Math.floor(step / 8);
    // acordes cada 2 compases
    if (step % 16 === 0) {
      const prog = war ? [0, 5, 3, 4] : [0, 3, 4, 0, 5, 3, 1, 4];
      music.chord = prog[Math.floor(step / 16) % prog.length];
      const c = music.chord;
      const notes = [noteFreq(m.root / 2, m.scale, c), noteFreq(m.root / 2, m.scale, c + 2), noteFreq(m.root / 2, m.scale, c + 4)];
      pad(notes, t, eighth * 16 + 0.5, war ? 0.07 : 0.055, musicBus, m.padType);
      // bajo
      pluck(noteFreq(m.root / 4, m.scale, c), t, eighth * 6, 0.12, musicBus, 0.2);
      if (step % 32 === 0) music.phrase = makePhrase(16);
    }
    // melodía (más escasa en calma, para que respire)
    const restBars = music.mood === 'calm' ? bar % 4 === 3 : false;
    if (!restBars) {
      const deg = music.phrase[step % 16];
      if (deg !== undefined && deg > -50 && (step % 2 === 0 || Math.random() < 0.35)) {
        const f = noteFreq(m.root, m.scale, deg + music.chord);
        if (m.lead === 'flute') flute(f, t, eighth * (Math.random() < 0.3 ? 3 : 1.8), 0.07, musicBus);
        else pluck(f, t, eighth * 3, 0.09, musicBus, 0.6);
      }
    }
    // percusión
    if (m.drums === 'frame' || war) {
      if (step % 8 === 0) drum(t, 70, war ? 0.5 : 0.32, musicBus);
      if (step % 8 === 3 || step % 8 === 6) drum(t, 110, war ? 0.26 : 0.16, musicBus, 0.2);
      if (war && step % 2 === 1) shaker(t, 0.05, musicBus);
    } else if (m.drums === 'march') {
      if (step % 4 === 0) drum(t, 80, 0.2, musicBus);
      if (step % 4 === 2) shaker(t, 0.06, musicBus, 3000, 0.12);
    } else if (step % 4 === 2) shaker(t, 0.025, musicBus, 7000, 0.05);
    music.step++;
    music.next = t + eighth;
  }
}

export function setMusicContext(era: number, mood: MusicState['mood']) {
  if (music.era !== era || music.mood !== mood) {
    music.era = era;
    music.mood = mood;
  }
}

// ───────────────────────── Ambiente
interface Amb { wind: GainNode; water: GainNode; town: GainNode; windF: BiquadFilterNode; }
let amb: Amb | null = null;
const ambTarget = { wind: 0.3, water: 0.2, town: 0.1, birds: 0.5, winter: 0 };
let birdTimer = 0, townTimer = 0;

function startAmbience() {
  const a = ctx!;
  const mk = (type: BiquadFilterType, freq: number, q: number) => {
    const s = a.createBufferSource();
    s.buffer = noiseBuffer(a);
    s.loop = true;
    const f = a.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = a.createGain();
    g.gain.value = 0;
    s.connect(f).connect(g).connect(ambBus);
    s.start(0, Math.random() * 2);
    return { g, f };
  };
  const wind = mk('bandpass', 500, 0.6);
  const water = mk('bandpass', 1400, 0.4);
  const town = mk('lowpass', 300, 0.5);
  // ráfagas de viento
  const lfo = a.createOscillator();
  const lg = a.createGain();
  lfo.frequency.value = 0.07;
  lg.gain.value = 260;
  lfo.connect(lg).connect(wind.f.frequency);
  lfo.start();
  amb = { wind: wind.g, water: water.g, town: town.g, windF: wind.f };
}

function bird(t: number) {
  const a = ctx!;
  const n = 2 + Math.floor(Math.random() * 4);
  const base = 2400 + Math.random() * 1800;
  for (let i = 0; i < n; i++) {
    const o = a.createOscillator();
    const g = a.createGain();
    const st = t + i * (0.09 + Math.random() * 0.05);
    o.type = 'sine';
    o.frequency.setValueAtTime(base, st);
    o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.8), st + 0.07);
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.05, st + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
    const p = a.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    o.connect(g).connect(p).connect(ambBus);
    o.start(st);
    o.stop(st + 0.1);
  }
}
function townSound(t: number) {
  // martillo lejano o campana
  if (Math.random() < 0.6) {
    for (let i = 0; i < 3; i++) shaker(t + i * 0.32, 0.05, ambBus, 1800, 0.05);
  } else {
    const a = ctx!;
    const f = 520 + Math.random() * 200;
    for (const h of [1, 2.76, 5.4]) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = f * h;
      g.gain.setValueAtTime(0.025 / h, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g).connect(ambBus);
      o.connect(g);
      o.start(t);
      o.stop(t + 2.5);
    }
  }
}

export function setAmbience(o: Partial<typeof ambTarget>) {
  Object.assign(ambTarget, o);
}

function tickAmbience(dt: number) {
  if (!ctx || !amb) return;
  const t = ctx.currentTime;
  amb.wind.gain.setTargetAtTime(0.05 + ambTarget.wind * 0.35 + ambTarget.winter * 0.25, t, 1.5);
  amb.water.gain.setTargetAtTime(ambTarget.water * 0.18, t, 1.5);
  amb.town.gain.setTargetAtTime(ambTarget.town * 0.3, t, 1.5);
  birdTimer -= dt;
  if (birdTimer <= 0) {
    birdTimer = 1.5 + Math.random() * 5 / Math.max(0.1, ambTarget.birds);
    if (ambTarget.birds > 0.05 && ambTarget.winter < 0.5) bird(t + 0.05);
  }
  townTimer -= dt;
  if (townTimer <= 0) {
    townTimer = 3 + Math.random() * 8;
    if (ambTarget.town > 0.2) townSound(t + 0.05);
  }
}

// Bucle de audio (llamado desde el bucle de juego)
export function audioFrame(dt: number) {
  if (!ctx || !started) return;
  musicTimer += dt;
  if (musicTimer > 0.1) {
    musicTimer = 0;
    scheduleMusic();
  }
  tickAmbience(dt);
}

// Debe llamarse tras una interacción del usuario
export function startAudio(s: Settings) {
  const a = ac();
  if (!a || started) {
    if (a) applyAudioSettings(s);
    return;
  }
  started = true;
  music.next = a.currentTime + 0.3;
  startAmbience();
  applyAudioSettings(s);
}

// ───────────────────────── Efectos
function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slide = 0) {
  const a = ctx!;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function thud(delay: number, freq: number, vol: number) {
  drum(ctx!.currentTime + delay, freq, vol, sfxBus, 0.25);
}

export type Sfx = 'tap' | 'open' | 'close' | 'build' | 'built' | 'tech' | 'good' | 'war' | 'event' | 'error' | 'coin' | 'battle' | 'era' | 'death' | 'select' | 'place' | 'victory' | 'defeat';

export function sfx(kind: Sfx, settings: Settings) {
  if (!settings.sound) return;
  const a = ac();
  if (!a) return;
  if (!started) startAudio(settings);
  switch (kind) {
    case 'tap': tone(880, 0.05, 'triangle', 0.035); break;
    case 'select': tone(660, 0.06, 'sine', 0.05); tone(990, 0.08, 'sine', 0.03, 0.03); break;
    case 'open': shaker(a.currentTime, 0.05, sfxBus, 2500, 0.12); tone(440, 0.12, 'triangle', 0.03, 0, 1.5); break;
    case 'close': shaker(a.currentTime, 0.04, sfxBus, 2500, 0.08); tone(660, 0.1, 'triangle', 0.025, 0, 0.66); break;
    case 'place': thud(0, 120, 0.35); shaker(a.currentTime + 0.02, 0.06, sfxBus, 1200, 0.1); break;
    case 'build': thud(0, 140, 0.3); thud(0.16, 120, 0.25); shaker(a.currentTime + 0.05, 0.07, sfxBus, 900, 0.15); break;
    case 'built': [392, 523.25, 659.25].forEach((f, i) => pluck(f, a.currentTime + i * 0.07, 0.6, 0.08, sfxBus, 0.7)); break;
    case 'tech': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { pluck(f, a.currentTime + i * 0.09, 1.2, 0.07, sfxBus, 0.8); }); break;
    case 'good': pluck(587.33, a.currentTime, 0.5, 0.08, sfxBus); pluck(880, a.currentTime + 0.1, 0.8, 0.07, sfxBus); break;
    case 'era': {
      const t = a.currentTime;
      pad([130.81, 196, 261.63, 329.63], t, 3.5, 0.12, sfxBus, 'sawtooth');
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => pluck(f, t + 0.3 + i * 0.12, 1.5, 0.07, sfxBus, 0.8));
      drum(t, 60, 0.6, sfxBus, 1.2);
      break;
    }
    case 'war': {
      const t = a.currentTime;
      for (let i = 0; i < 3; i++) drum(t + i * 0.22, 55, 0.7, sfxBus, 0.4);
      tone(196, 0.7, 'sawtooth', 0.06, 0.1); tone(185, 0.9, 'sawtooth', 0.05, 0.5, 0.9);
      break;
    }
    case 'battle': {
      const t = a.currentTime;
      for (let i = 0; i < 6; i++) shaker(t + i * 0.07 + Math.random() * 0.05, 0.12, sfxBus, 3500 + Math.random() * 2000, 0.08);
      drum(t, 70, 0.5, sfxBus);
      break;
    }
    case 'event': pad([196, 293.66, 392], a.currentTime, 1.6, 0.08, sfxBus, 'triangle'); pluck(587.33, a.currentTime + 0.15, 1.2, 0.06, sfxBus); break;
    case 'death': pad([110, 130.81, 164.81], a.currentTime, 2.5, 0.08, sfxBus, 'sawtooth'); drum(a.currentTime, 50, 0.5, sfxBus, 1); break;
    case 'error': tone(220, 0.12, 'square', 0.025, 0, 0.8); tone(196, 0.14, 'square', 0.02, 0.08, 0.8); break;
    case 'coin': tone(1318.5, 0.07, 'square', 0.02); tone(1760, 0.14, 'square', 0.018, 0.06); break;
    case 'victory': {
      const t = a.currentTime;
      [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((f, i) => pluck(f, t + i * 0.15, 2, 0.08, sfxBus, 0.9));
      pad([130.81, 196, 261.63], t, 4, 0.12, sfxBus);
      break;
    }
    case 'defeat': pad([110, 130.81, 155.56], a.currentTime, 4, 0.12, sfxBus); drum(a.currentTime, 45, 0.6, sfxBus, 1.5); break;
  }
}
