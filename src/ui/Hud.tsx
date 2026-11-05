import { useState } from 'preact/hooks';
import { ctrl } from '../game/controller';
import { notify } from '../game/store';
import { sfx } from '../game/audio';
import { Icon, RES_COLOR } from './Icon';
import { Emblem, Portrait } from './Emblem';
import { LogPopover } from './Extras';
import { fmt, sgn, cls } from './util';
import type { ResId, YieldId } from '../sim/types';
import { RES_TITLE, RES_DESC, calendarYear } from '../sim/names';
import { resCap, techCostFor, traditionCost } from '../sim/economy';
import { civEra, ERAS, TECH } from '../data/techs';
import { civSettlements } from '../sim/world';
import { GOV } from '../data/politics';
import { maxProjects, activeProjects } from '../sim/actions';

const SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'];

export function TopBar() {
  const s = ctrl.state;
  const p = ctrl.player;
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | null>(null);
  const era = civEra(p.techs);
  const show: ResId[] = ['food', 'wood'];
  if (p.techs.includes('masonry') || p.res.stone > 0) show.push('stone');
  if (p.techs.includes('bronze') || p.res.metal > 0) show.push('metal');
  if (era >= 1 || p.res.goods > 0) show.push('goods');
  show.push('gold', 'influence');
  const L = p.ledger;
  const pop = civSettlements(s, p.id).reduce((a, x) => a + x.pop, 0);
  const tCost = p.research ? techCostFor(s, p, p.research) : 0;
  const season = Math.floor(ctrl.overlay.yearFrac * 4) % 4;
  const toggle = (id: string, e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setOpen(open?.id === id ? null : { id, x: r.left, y: r.bottom + 6 });
  };
  return (
    <>
      <header class="topbar">
        <div class="identity">
          <Emblem index={p.emblem} color={p.color} color2={p.color2} size={30} />
          <button class="leader-btn" onClick={() => { ctrl.panel = 'gov'; sfx('open', ctrl.settings); notify(); }} title={`${p.leader.title} ${p.leader.name}`} aria-label="Ver al líder">
            <Portrait leader={p.leader} color={p.color} size={38} />
          </button>
          <div class="idtext">
            <div class="name">{p.name}</div>
            <div class="sub">{GOV[p.government].name} · {p.leader.title} {p.leader.name}</div>
          </div>
        </div>
        <div class="res-strip">
          <button class={cls('cart', open?.id === 'pop' && 'open')} onClick={(e) => toggle('pop', e as any)} title="Población y estabilidad">
            <span class="disc" style={{ background: '#5a4a38' }}><Icon name="pop" /></span>
            <span class="cv"><b class="num">{fmt(pop)}</b><i class={cls(p.stability < 30 ? 'neg' : p.stability > 70 ? 'pos' : '')}>estab. {Math.round(p.stability)}</i></span>
          </button>
          {show.map((r) => {
            const net = L.net[r] ?? 0;
            const cap = resCap(s, p, r);
            const warn = r === 'food' ? net < 0 && p.res.food < L.foodNeed * 0.5 : r === 'gold' && net < 0 && p.res.gold < 30;
            const full = r !== 'gold' && r !== 'influence' && p.res[r] >= cap * 0.98;
            return (
              <button key={r} class={cls('cart', open?.id === r && 'open', warn && 'warn')} onClick={(e) => toggle(r, e as any)} title={RES_TITLE[r]}>
                <span class="disc" style={{ background: RES_COLOR[r] }}><Icon name={r} /></span>
                <span class="cv">
                  <b class="num">{fmt(p.res[r])}{full && <small> lleno</small>}</b>
                  <i class={cls(net > 0.05 ? 'pos' : net < -0.05 ? 'neg' : '')}>{sgn(net)}/año</i>
                </span>
              </button>
            );
          })}
          <button class={cls('cart wide', open?.id === 'knowledge' && 'open', !p.research && 'warn')} onClick={(e) => { ctrl.panel = 'tech'; ctrl.overlay.selected = null; setOpen(null); notify(); void e; }} title="Investigación">
            <span class="disc" style={{ background: RES_COLOR.knowledge }}><Icon name="knowledge" /></span>
            <span class="cv">
              <b class="tname">{p.research ? TECH[p.research].name : 'Elige investigación'}</b>
              {p.research ? <span class="progress-mini"><em style={{ width: `${Math.min(100, (p.knowledge / tCost) * 100)}%` }} /></span> : <i class="neg">sin investigar</i>}
            </span>
          </button>
          <button class={cls('cart', open?.id === 'culture' && 'open')} onClick={(e) => toggle('culture', e as any)} title="Cultura">
            <span class="disc" style={{ background: RES_COLOR.culture }}><Icon name="culture" /></span>
            <span class="cv">
              <span class="progress-mini"><em style={{ width: `${Math.min(100, (p.culturePts / traditionCost(p)) * 100)}%`, background: '#c58ad0' }} /></span>
              <i class="pos">{sgn(L.net.culture, 1)}/año</i>
            </span>
          </button>
        </div>
        <div class="timebox">
          <div class="datebox">
            <span class="era-medal" style={{ borderColor: ERAS[era].color }} title={ERAS[era].name}>{['I', 'II', 'III', 'IV', 'V', 'VI'][era]}</span>
            <div class="date">
              <div class="y num">{calendarYear(s.calendarStart, s.year)}</div>
              <div class="e">{ERAS[era].name}</div>
            </div>
            <span class="season-dial" title={SEASONS[season]} style={{ ['--a' as any]: `${ctrl.overlay.yearFrac * 360}deg` }}><i /></span>
          </div>
          <div class="speed" role="group" aria-label="Velocidad">
            <button class={cls(ctrl.paused && 'on')} onClick={() => ctrl.setSpeed(0)} aria-label="Pausa" title="Pausa (espacio)"><Icon name="pause" /></button>
            <button class={cls(!ctrl.paused && ctrl.speed === 1 && 'on')} onClick={() => ctrl.setSpeed(1)} aria-label="Velocidad normal" title="Normal (1)"><Icon name="play" /></button>
            <button class={cls('opt', !ctrl.paused && ctrl.speed === 2 && 'on')} onClick={() => ctrl.setSpeed(2)} aria-label="Rápido" title="Rápido (2)"><Icon name="fast" /></button>
            <button class={cls(!ctrl.paused && ctrl.speed >= 3 && 'on')} onClick={() => ctrl.setSpeed(ctrl.speed === 3 && !ctrl.paused ? 4 : 3)} aria-label="Muy rápido" title="Muy rápido (3/4)"><Icon name="faster" /></button>
          </div>
          <button class="icon-btn" onClick={(e) => toggle('log', e as any)} aria-label="Avisos"><Icon name="scroll" /></button>
          <button class="icon-btn" onClick={() => { ctrl.panel = ctrl.panel === 'menu' ? null : 'menu'; notify(); }} aria-label="Menú"><Icon name="menu" /></button>
        </div>
      </header>
      {open && open.id === 'log' && <LogPopover onClose={() => setOpen(null)} />}
      {open && open.id !== 'log' && <ResPopover id={open.id} x={open.x} y={open.y} onClose={() => setOpen(null)} />}
    </>
  );
}

function ResPopover({ id, x, y, onClose }: { id: string; x: number; y: number; onClose: () => void }) {
  const p = ctrl.player;
  const s = ctrl.state;
  const L = p.ledger;
  const left = Math.max(8, Math.min(x, window.innerWidth - 316));
  if (id === 'pop') {
    const sets = civSettlements(s, p.id);
    const parts = Object.entries(L.stabilityParts).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    return (
      <div class="pop" style={{ left, top: y }} onClick={onClose}>
        <h4>Población y estabilidad</h4>
        <div class="desc">La estabilidad tiende hacia la suma de estos factores. Por debajo de 30 hay disturbios; por encima de 75, edad dorada.</div>
        {sets.map((st) => (
          <div class="kv" key={st.id}><span class="k">{st.name}</span><span class="v">{fmt(st.pop)} / {fmt(st.housing)} <span class={st.growth >= 0 ? 'good' : 'bad'}>{sgn(st.growth, 1)}</span></span></div>
        ))}
        <div style={{ height: 10 }} />
        {parts.map(([k, v]) => (
          <div class="kv" key={k}><span class="k">{k}</span><span class={cls('v', v > 0 && k !== 'Base' ? 'good' : v < 0 ? 'bad' : '')}>{k === 'Base' ? v : sgn(v)}</span></div>
        ))}
      </div>
    );
  }
  const r = id as YieldId;
  const inc = Object.entries(L.income[r] ?? {}).sort((a, b) => b[1] - a[1]);
  const exp = Object.entries(L.expense[r] ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div class="pop" style={{ left, top: y }} onClick={onClose}>
      <h4>{RES_TITLE[r]}</h4>
      <div class="desc">{RES_DESC[r]}</div>
      {inc.map(([k, v]) => (
        <div class="kv" key={'i' + k}><span class="k">{k}</span><span class="v good">+{fmt(v)}</span></div>
      ))}
      {exp.map(([k, v]) => (
        <div class="kv" key={'e' + k}><span class="k">{k}</span><span class="v bad">−{fmt(v)}</span></div>
      ))}
      {r === 'food' && <div class="kv"><span class="k">Almacenamiento máximo</span><span class="v">{fmt(resCap(s, p, 'food'))}</span></div>}
      {r === 'goods' && L.goodsNeed > 0 && <div class="kv"><span class="k">Demanda cubierta</span><span class={cls('v', L.goodsMet < 0.8 ? 'bad' : 'good')}>{Math.round(L.goodsMet * 100)}%</span></div>}
      {r === 'culture' && <div class="kv"><span class="k">Próxima tradición</span><span class="v">{fmt(p.culturePts)} / {fmt(traditionCost(p))}</span></div>}
      {!inc.length && !exp.length && <div class="muted" style={{ fontSize: 13 }}>Sin movimientos el año pasado.</div>}
    </div>
  );
}

const NAV = [
  { id: 'build', label: 'Construir', icon: 'build' },
  { id: 'cities', label: 'Territorio', icon: 'cities' },
  { id: 'tech', label: 'Saber', icon: 'tech' },
  { id: 'gov', label: 'Gobierno', icon: 'gov' },
  { id: 'diplo', label: 'Pueblos', icon: 'diplo' },
  { id: 'chronicle', label: 'Crónica', icon: 'chronicle' },
];

export function Rail() {
  const p = ctrl.player;
  const s = ctrl.state;
  const badges: Record<string, { n: number | string; pulse?: boolean } | null> = {
    build: activeProjects(s, p) < maxProjects(s, p) && civSettlements(s, p.id).some((x) => x.workforce - x.employed > 6) ? { n: '!' } : null,
    tech: !p.research ? { n: '!', pulse: true } : null,
    gov: p.traditionOffer ? { n: 1, pulse: true } : null,
    diplo: Object.values(p.relations).some((r) => r.state === 'war') ? { n: Object.values(p.relations).filter((r) => r.state === 'war').length } : null,
  };
  return (
    <nav class="rail" aria-label="Paneles">
      {NAV.map((n) => (
        <button key={n.id} class={cls(ctrl.panel === n.id && 'on')} onClick={() => { ctrl.panel = ctrl.panel === n.id ? null : n.id; sfx(ctrl.panel ? 'open' : 'close', ctrl.settings); if (ctrl.isTouch) ctrl.overlay.selected = null; notify(); }}>
          <Icon name={n.icon} />
          <span>{n.label}</span>
          {badges[n.id] && <span class={cls('badge', badges[n.id]!.pulse && 'pulse')}>{badges[n.id]!.n}</span>}
        </button>
      ))}
    </nav>
  );
}

export function Toasts() {
  return (
    <div class="toasts" aria-live="polite">
      {ctrl.toasts.map((t) => (
        <div key={t.id} class={cls('toast', 'tone-' + t.tone)} onClick={() => { ctrl.toasts = ctrl.toasts.filter((x) => x !== t); notify(); }}>
          <div>
            <div class="t">{t.title}</div>
            {t.text && <div class="x">{t.text}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
