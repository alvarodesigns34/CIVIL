import { useEffect, useRef, useState } from 'preact/hooks';
import { ctrl } from '../game/controller';
import { notify } from '../game/store';
import { Icon, RES_COLOR } from './Icon';
import { currentTutorial, TUTORIAL } from '../sim/tutorial';
import { getExplored } from '../sim/world';
import { hexToPixel, HEX_W, ROW_H } from '../core/hex';
import { BIOME_COLOR } from '../render/palette';
import { fmt, cls } from './util';
import { RES_NAME } from '../sim/names';
import type { ResId } from '../sim/types';

// Objetivo actual del Consejo de ancianos
export function ObjectiveCard() {
  const [open, setOpen] = useState(window.innerWidth > 760);
  const p = ctrl.player;
  const step = currentTutorial(p);
  if (!step) return null;
  const [v, max] = step.progress(ctrl.state, p);
  const idx = TUTORIAL.indexOf(step);
  if (!open) {
    return (
      <button class="objective mini" onClick={() => setOpen(true)} aria-label="Ver objetivo">
        <Icon name="star" /> <span class="num">{idx + 1}/{TUTORIAL.length}</span> <span class="obj-mini-t">{step.title}</span>{max > 1 && <span class="num" style={{ color: 'var(--night-muted)' }}>{Math.min(v, max)}/{max}</span>}
      </button>
    );
  }
  return (
    <div class="objective">
      <div class="obj-head">
        <span class="eyebrow">Consejo de ancianos · {idx + 1}/{TUTORIAL.length}</span>
        <button class="obj-x" onClick={() => setOpen(false)} aria-label="Plegar"><Icon name="minus" /></button>
      </div>
      <button class="obj-body" onClick={() => { if (step.panel) { ctrl.panel = step.panel; notify(); } }}>
        <div class="obj-title">{step.title}</div>
        <div class="obj-hint">{step.hint}</div>
        {max > 1 && (
          <div class="bar" style={{ marginTop: 8 }}><i style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: 'var(--gold)' }} /></div>
        )}
        <div class="obj-reward">
          Recompensa:{' '}
          {Object.entries(step.reward).map(([k, n]) => (
            <span key={k} class="pill"><Icon name={k} style={{ color: RES_COLOR[k] }} />+{n} {RES_NAME[k as ResId]}</span>
          ))}
        </div>
      </button>
    </div>
  );
}

// Minimapa con navegación
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = useRef<{ img: HTMLCanvasElement; sig: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    let lastBase = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      const s = ctrl.state;
      if (!c || !s || !ctrl.renderer) return;
      const W = c.width, H = c.height;
      const sx = W / (s.width * HEX_W + HEX_W / 2), sy = H / (s.height * ROW_H + ROW_H);
      const g = c.getContext('2d')!;
      if (!base.current || now - lastBase > 1500) {
        lastBase = now;
        const img = base.current?.img ?? document.createElement('canvas');
        img.width = W;
        img.height = H;
        const b = img.getContext('2d')!;
        b.fillStyle = '#e6d8b5';
        b.fillRect(0, 0, W, H);
        const ex = getExplored(s);
        const cw = HEX_W * sx + 1, ch = ROW_H * sy + 1.5;
        for (let r = 0; r < s.height; r++)
          for (let col = 0; col < s.width; col++) {
            const i = r * s.width + col;
            if (!ex[i]) continue;
            const t = s.tiles[i];
            const [x, y] = hexToPixel(col, r);
            let color = BIOME_COLOR[t.biome][0];
            if (t.elev === 2) color = '#9a917e';
            else if (t.feature === 'forest') color = '#5f7a3c';
            b.fillStyle = color;
            b.fillRect(x * sx - cw / 2, y * sy - ch / 2, cw, ch);
            if (t.owner >= 0) {
              b.fillStyle = s.civs[t.owner].color + '88';
              b.fillRect(x * sx - cw / 2, y * sy - ch / 2, cw, ch);
            }
          }
        for (const st of s.settlements) {
          if (!ex[st.row * s.width + st.col]) continue;
          const [x, y] = hexToPixel(st.col, st.row);
          b.fillStyle = '#2a2119';
          b.beginPath();
          b.arc(x * sx, y * sy, st.capital ? 3.2 : 2.3, 0, Math.PI * 2);
          b.fill();
          b.fillStyle = s.civs[st.civ].color;
          b.beginPath();
          b.arc(x * sx, y * sy, st.capital ? 2 : 1.4, 0, Math.PI * 2);
          b.fill();
        }
        base.current = { img, sig: 0 };
      }
      g.drawImage(base.current.img, 0, 0);
      const cam = ctrl.renderer.cam;
      const [x0, y0] = cam.toWorld(0, 0);
      const [x1, y1] = cam.toWorld(cam.vw, cam.vh);
      g.strokeStyle = '#fff8e0';
      g.lineWidth = 2;
      g.strokeRect(x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy);
      g.strokeStyle = '#2a2119';
      g.lineWidth = 1;
      g.strokeRect(x0 * sx - 1, y0 * sy - 1, (x1 - x0) * sx + 2, (y1 - y0) * sy + 2);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  const go = (e: PointerEvent) => {
    const c = ref.current!;
    const rect = c.getBoundingClientRect();
    const s = ctrl.state;
    const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
    const cam = ctrl.renderer.cam;
    cam.x = fx * (s.width * HEX_W + HEX_W / 2);
    cam.y = fy * (s.height * ROW_H + ROW_H);
    cam.target = null;
    cam.clamp();
  };
  const s = ctrl.state;
  const w = 216, h = Math.round((w * (s.height * ROW_H + ROW_H)) / (s.width * HEX_W + HEX_W / 2));
  return (
    <div class="minimap" aria-label="Minimapa">
      <canvas ref={ref} width={w} height={h} style={{ width: w + 'px', height: h + 'px' }}
        onPointerDown={(e) => { (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId); go(e as any); }}
        onPointerMove={(e) => { if ((e as PointerEvent).buttons) go(e as any); }} />
    </div>
  );
}

export function PausedBadge() {
  if (!ctrl.paused || ctrl.blockingEvent() || ctrl.state.gameOver) return null;
  return (
    <button class="paused-badge" onClick={() => ctrl.setSpeed(ctrl.speed || 1)}>
      <Icon name="play" /> <span>En pausa · pulsa para continuar</span>
    </button>
  );
}

export { fmt, cls };
