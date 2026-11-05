import { useEffect, useRef, useState } from 'preact/hooks';
import { ctrl } from '../game/controller';
import { Renderer } from '../render/renderer';
import { generateWorld } from '../sim/worldgen';
import { yearTick } from '../sim/game';
import { getExplored, capitalOf } from '../sim/world';
import { CIV_COLORS } from '../data/names';
import { Emblem } from './Emblem';
import { Icon } from './Icon';
import { cls } from './util';
import { calendarYear } from '../sim/names';
import { CULTURE_TRAIT } from '../sim/cities';

const CULTURE_LABEL: Record<string, string> = {
  river: 'Ribereña', steppe: 'Esteparia', forest: 'Silvana', sea: 'Marinera', mountain: 'Andina', desert: 'Desértica', jungle: 'Selvática',
};

function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const st = generateWorld({ seed: 7 + Math.floor(Math.random() * 9999), size: 'small', civs: 4, civName: '', colorIndex: 0, emblem: 0, culture: 'river', difficulty: 'normal' });
    st.civs[0].isPlayer = false;
    for (let i = 0; i < 140; i++) yearTick(st);
    getExplored(st).fill(1);
    const r = new Renderer(canvas, st);
    const resize = () => r.resize(canvas.parentElement!.clientWidth, canvas.parentElement!.clientHeight);
    resize();
    window.addEventListener('resize', resize);
    const cap = capitalOf(st, st.civs.find((c) => c.alive)!.id)!;
    r.centerOn(cap.col, cap.row, 1.05, true);
    let raf = 0, last = performance.now(), t = 0;
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      t += dt;
      r.cam.x += dt * 9;
      r.cam.y += Math.sin(t * 0.1) * dt * 4;
      r.draw(dt, { selected: null, hover: null, buildPreview: null, colonyPreview: null, mode: 'select', yearFrac: (t / 12) % 1, reducedMotion: false });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} />;
}

export function Title() {
  const [step, setStep] = useState<'menu' | 'new'>('menu');
  const [name, setName] = useState('');
  const [color, setColor] = useState(0);
  const [emblem, setEmblem] = useState(0);
  const [culture, setCulture] = useState('river');
  const [size, setSize] = useState<'small' | 'normal' | 'large'>('normal');
  const [rivals, setRivals] = useState(4);
  const [diff, setDiff] = useState<'easy' | 'normal' | 'hard'>('normal');
  const save = ctrl.saveInfo();
  const start = () => {
    ctrl.newGame({
      seed: Math.floor(Math.random() * 1e9), size, civs: rivals + 1, civName: name.trim() || defaultName(culture), colorIndex: color, emblem, culture, difficulty: diff,
    });
  };
  return (
    <div class="title-screen">
      <Backdrop />
      <div class="title-veil" />
      <div class="title-inner">
        <div class="title-mark">
          <div class="eyebrow">Una crónica de pueblos, siglos y decisiones</div>
          <h1>Civilization <em>Engine</em></h1>
          <p>Guía a un puñado de familias desde el primer fuego hasta el umbral de la era industrial. Cada cosecha, cada ley y cada guerra quedarán escritas en tu crónica.</p>
        </div>
        <div class="title-card">
          {step === 'menu' ? (
            <>
              <h2>Bienvenida, cronista</h2>
              <p class="muted" style={{ margin: '0 0 16px' }}>Un mundo nuevo se genera en cada partida, con pueblos rivales que viven bajo las mismas reglas que el tuyo.</p>
              {save && (
                <button class="btn accent" style={{ width: '100%', marginBottom: 8 }} onClick={() => ctrl.load()}>
                  <Icon name="play" /> Continuar · {save.name}, {calendarYear((save as any).cal ?? -3500, save.year)}
                </button>
              )}
              <button class={cls('btn', save ? 'ghost' : 'accent')} style={{ width: '100%' }} onClick={() => setStep('new')}>Nueva partida</button>
            </>
          ) : (
            <>
              <h2>Tu pueblo</h2>
              <div class="field">
                <label for="civname">Nombre</label>
                <input id="civname" type="text" maxLength={18} placeholder={defaultName(culture)} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
              </div>
              <div class="field">
                <label>Cultura</label>
                <div class="seg">{Object.entries(CULTURE_LABEL).map(([k, v]) => <button key={k} class={cls(culture === k && 'on')} onClick={() => setCulture(k)}>{v}</button>)}</div>
                <div class="muted" style={{ fontSize: 13.5, marginTop: 6 }}><b>{CULTURE_TRAIT[culture].name}:</b> {CULTURE_TRAIT[culture].desc}</div>
              </div>
              <div class="field" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <label>Colores</label>
                  <div class="swatches">{CIV_COLORS.map(([c], i) => <button key={i} aria-label={`Color ${i + 1}`} class={cls(color === i && 'on')} style={{ background: c }} onClick={() => setColor(i)} />)}</div>
                </div>
                <Emblem index={emblem} color={CIV_COLORS[color][0]} color2={CIV_COLORS[color][1]} size={48} />
              </div>
              <div class="field">
                <label>Emblema</label>
                <div class="emblems">{Array.from({ length: 12 }, (_, i) => <button key={i} aria-label={`Emblema ${i + 1}`} class={cls(emblem === i && 'on')} onClick={() => setEmblem(i)}><Emblem index={i} color={CIV_COLORS[color][0]} color2={CIV_COLORS[color][1]} size={24} /></button>)}</div>
              </div>
              <div class="field">
                <label>Mundo</label>
                <div class="seg">
                  {(['small', 'normal', 'large'] as const).map((k) => <button key={k} class={cls(size === k && 'on')} onClick={() => setSize(k)}>{{ small: 'Pequeño', normal: 'Mediano', large: 'Grande' }[k]}</button>)}
                </div>
              </div>
              <div class="field">
                <label>Pueblos rivales</label>
                <div class="seg">{[2, 3, 4, 5].map((n) => <button key={n} class={cls(rivals === n && 'on')} onClick={() => setRivals(n)}>{n}</button>)}</div>
              </div>
              <div class="field">
                <label>Dificultad</label>
                <div class="seg">
                  {(['easy', 'normal', 'hard'] as const).map((k) => <button key={k} class={cls(diff === k && 'on')} onClick={() => setDiff(k)}>{{ easy: 'Crónica serena', normal: 'Equilibrada', hard: 'Implacable' }[k]}</button>)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button class="btn ghost" onClick={() => setStep('menu')}>Atrás</button>
                <button class="btn accent" style={{ flex: 1 }} onClick={start}>Encender el primer fuego</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultName(c: string) {
  return { river: 'Sumaru', steppe: 'Temurai', forest: 'Valdheim', sea: 'Thalassia', mountain: 'Intipata', desert: 'Qasirah', jungle: 'Ixtapan' }[c] ?? 'Aldaru';
}
