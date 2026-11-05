// Efectos de sonido sintetizados (sin archivos): cálidos y discretos.
let ctx: AudioContext | null = null;

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slide = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, delay = 0, freq = 1200) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export function sfx(kind: 'tap' | 'build' | 'tech' | 'good' | 'war' | 'event' | 'error' | 'coin', settings: { sound: boolean }) {
  if (!settings.sound) return;
  switch (kind) {
    case 'tap': tone(660, 0.06, 'triangle', 0.04); break;
    case 'build': noise(0.09, 0.12, 0, 500); noise(0.09, 0.1, 0.12, 420); break;
    case 'tech': [523, 659, 784].forEach((f, i) => tone(f, 0.5, 'sine', 0.06, i * 0.09)); break;
    case 'good': tone(587, 0.25, 'triangle', 0.06); tone(880, 0.35, 'triangle', 0.05, 0.1); break;
    case 'war': tone(110, 0.6, 'sawtooth', 0.05, 0, 0.7); noise(0.4, 0.12, 0, 200); tone(98, 0.6, 'sawtooth', 0.04, 0.35, 0.7); break;
    case 'event': tone(392, 0.4, 'sine', 0.05); tone(523, 0.6, 'sine', 0.04, 0.15); break;
    case 'error': tone(220, 0.15, 'square', 0.03, 0, 0.8); break;
    case 'coin': tone(1320, 0.08, 'square', 0.025); tone(1760, 0.12, 'square', 0.02, 0.06); break;
  }
}
