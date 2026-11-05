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
  const view = useRef({ k: 1, ox: 0, oy: 0 });
  useEffect(() => {
    let raf = 0;
    let lastBase = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      const s = ctrl.state;
      if (!c || !s || !ctrl.renderer) return;
      const W = c.width, H = c.height;
      const g = c.getContext('2d')!;
      if (!base.current || now - lastBase > 1500) {
        lastBase = now;
        const ex = getExplored(s);
        // encuadre: lo explorado (con margen), nunca menos del 35% del mundo
        const worldW = s.width * HEX_W + HEX_W / 2, worldH = s.height * ROW_H + ROW_H;
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (let r = 0; r < s.height; r++)
          for (let col = 0; col < s.width; col++) {
            if (!ex[r * s.width + col]) continue;
            const [x, y] = hexToPixel(col, r);
            if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
            if (y < by0) by0 = y; if (y > by1) by1 = y;
          }
        if (!isFinite(bx0)) { bx0 = 0; by0 = 0; bx1 = worldW; by1 = worldH; }
        const pad = HEX_W * 2.5;
        let vw = bx1 - bx0 + pad * 2, vh = by1 - by0 + pad * 2;
        const minW = worldW * 0.35;
        // respetar la proporción del lienzo
        const asp = W / H;
        vw = Math.max(vw, minW, vh * asp);
        vh = vw / asp;
        if (vw > worldW) { vw = worldW; vh = vw / asp; }
        const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
        const k = W / vw;
        view.current = { k, ox: W / 2 - cx * k, oy: H / 2 - cy * k };
        const img = base.current?.img ?? document.createElement('canvas');
        img.width = W;
        img.height = H;
        const b = img.getContext('2d')!;
        // pergamino de fondo con viñeta
        b.fillStyle = '#e6d8b5';
        b.fillRect(0, 0, W, H);
        const { ox, oy } = view.current;
        const rad = (HEX_W / Math.sqrt(3)) * k + 0.6;
        const hexPath = (x: number, y: number) => {
          b.beginPath();
          for (let i = 0; i < 6; i++) {
            const an = Math.PI / 6 + (i * Math.PI) / 3;
            b.lineTo(x + Math.cos(an) * rad, y + Math.sin(an) * rad);
          }
          b.closePath();
        };
        for (let r = 0; r < s.height; r++)
          for (let col = 0; col < s.width; col++) {
            const i = r * s.width + col;
            if (!ex[i]) continue;
            const t = s.tiles[i];
            const [wx, wy] = hexToPixel(col, r);
            const x = ox + wx * k, y = oy + wy * k;
            if (x < -rad || y < -rad || x > W + rad || y > H + rad) continue;
            let color = BIOME_COLOR[t.biome][0];
            if (t.elev === 2) color = '#9a917e';
            else if (t.feature === 'forest') color = '#5f7a3c';
            hexPath(x, y);
            b.fillStyle = color;
            b.fill();
            if (t.owner >= 0) {
              b.fillStyle = s.civs[t.owner].color + '80';
              b.fill();
            }
          }
        for (const st of s.settlements) {
          if (!ex[st.row * s.width + st.col]) continue;
          const [wx, wy] = hexToPixel(st.col, st.row);
          const x = ox + wx * k, y = oy + wy * k;
          const R = (st.capital ? 4 : 2.8) * (W / 216);
          b.fillStyle = '#2a2119';
          b.beginPath();
          b.arc(x, y, R * 1.35, 0, Math.PI * 2);
          b.fill();
          b.fillStyle = s.civs[st.civ].color;
          b.beginPath();
          b.arc(x, y, R, 0, Math.PI * 2);
          b.fill();
          if (st.capital) { b.fillStyle = '#f6edd6'; b.beginPath(); b.arc(x, y, R * 0.35, 0, Math.PI * 2); b.fill(); }
        }
        const vg = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        vg.addColorStop(0, 'rgba(60,40,20,0)');
        vg.addColorStop(1, 'rgba(60,40,20,0.28)');
        b.fillStyle = vg;
        b.fillRect(0, 0, W, H);
        base.current = { img, sig: 0 };
      }
      g.clearRect(0, 0, W, H);
      g.drawImage(base.current.img, 0, 0);
      const { k, ox, oy } = view.current;
      const cam = ctrl.renderer.cam;
      const [x0, y0] = cam.toWorld(0, 0);
      const [x1, y1] = cam.toWorld(cam.vw, cam.vh);
      const rx = ox + x0 * k, ry = oy + y0 * k, rw = (x1 - x0) * k, rh = (y1 - y0) * k;
      g.strokeStyle = 'rgba(42,33,25,0.85)';
      g.lineWidth = 6;
      g.strokeRect(rx, ry, rw, rh);
      g.strokeStyle = '#fff8e0';
      g.lineWidth = 3;
      g.strokeRect(rx, ry, rw, rh);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  const go = (e: PointerEvent) => {
    const c = ref.current!;
    const rect = c.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * c.width, py = ((e.clientY - rect.top) / rect.height) * c.height;
    const { k, ox, oy } = view.current;
    const cam = ctrl.renderer.cam;
    cam.x = (px - ox) / k;
    cam.y = (py - oy) / k;
    cam.target = null;
    cam.clamp();
  };
  const w = 216, h = 150;
  return (
    <div class="minimap" aria-label="Minimapa">
      <canvas ref={ref} width={w * 2} height={h * 2} style={{ width: w + 'px', height: h + 'px' }}
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

// Capas del mapa
const LENSES: { id: NonNullable<typeof ctrl.overlay.lens>; label: string; icon: string }[] = [
  { id: 'none', label: 'Mapa', icon: 'eye' },
  { id: 'resources', label: 'Recursos', icon: 'gold' },
  { id: 'military', label: 'Militar', icon: 'sword' },
  { id: 'religion', label: 'Fe', icon: 'star' },
  { id: 'mood', label: 'Ánimo', icon: 'health' },
];
export function LensBar() {
  const cur = ctrl.overlay.lens ?? 'none';
  return (
    <div class="lensbar" role="group" aria-label="Capas del mapa">
      {LENSES.map((l) => (
        <button key={l.id} class={cls(cur === l.id && 'on')} onClick={() => { ctrl.overlay.lens = l.id; notify(); }} title={l.label} aria-label={l.label}>
          <Icon name={l.icon} />
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  );
}

// Historial de avisos
export function LogPopover({ onClose }: { onClose: () => void }) {
  return (
    <div class="pop logpop" onClick={onClose}>
      <h4>Últimos avisos</h4>
      {!ctrl.log.length && <div class="muted">Nada todavía.</div>}
      {ctrl.log.slice(0, 40).map((t) => (
        <div key={t.id} class={cls('logrow', 'tone-' + t.tone)}>
          <span class="num muted">{t.at}</span>
          <div><b>{t.title}</b>{t.text && <div class="muted">{t.text}</div>}</div>
        </div>
      ))}
    </div>
  );
}
