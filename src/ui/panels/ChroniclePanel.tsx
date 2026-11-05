import { useState } from 'preact/hooks';
import { ctrl } from '../../game/controller';
import { Icon } from '../Icon';
import { Emblem } from '../Emblem';
import { AMBITIONS, legacyBreakdown } from '../../data/ambitions';
import { calendarYear } from '../../sim/names';
import { rankings, MAX_YEARS } from '../../sim/game';
import { fmt, cls } from '../util';
import { PanelShell } from './PanelShell';
import { victoryProgress } from '../../sim/victory';

export function ChroniclePanel() {
  const [tab, setTab] = useState('chron');
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  const s = ctrl.state;
  const p = ctrl.player;
  const entries = s.chronicle.filter((e) => (filter === 'mine' ? e.civ === p.id || (e.civ === -1 && e.important) : e.civ === p.id || e.civ === -1 || p.relations[e.civ]?.met)).slice(-160).reverse();
  const lb = legacyBreakdown(s, p);
  return (
    <PanelShell title="Crónica" sub={`Año ${s.year} de ${MAX_YEARS}. La historia que tu pueblo deja escrita.`} tabs={[{ id: 'chron', label: 'Anales' }, { id: 'victory', label: 'Victoria' }, { id: 'legacy', label: 'Legado' }, { id: 'world', label: 'El mundo' }]} tab={tab} onTab={setTab}>
      {tab === 'chron' && (
        <>
          <div class="seg" style={{ marginBottom: 12 }}>
            <button class={cls(filter === 'mine' && 'on')} onClick={() => setFilter('mine')}>Mi pueblo</button>
            <button class={cls(filter === 'all' && 'on')} onClick={() => setFilter('all')}>Todo lo conocido</button>
          </div>
          <div class="chron">
            {entries.map((e, i) => (
              <div key={i} class={cls('chron-item', e.important && 'imp')}>
                <div class="y">{calendarYear(s.calendarStart, e.year)}</div>
                <div>{e.text}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'legacy' && (
        <>
          <div class="card">
            <div class="eyebrow">Legado</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 650, letterSpacing: '-0.02em' }} class="num">{fmt(lb.total)}</div>
            {lb.parts.map((x) => <div class="kv" key={x.label}><span class="k">{x.label}</span><span class="v">{fmt(x.v)}</span></div>)}
          </div>
          <div class="section">
            <span class="eyebrow">Ambiciones</span>
            {AMBITIONS.map((a) => {
              const done = p.ambitionsDone.includes(a.id);
              const [v, max] = a.progress(s, p);
              return (
                <div key={a.id} class={cls('card')} style={done ? { background: 'var(--good-quiet)' } : undefined}>
                  <div class="row" style={{ justifyContent: 'space-between' }}>
                    <div class="row">{done ? <Icon name="check" size={18} style={{ color: 'var(--good)' }} /> : <Icon name="star" size={18} style={{ color: 'var(--ink-faint)' }} />}<h4>{a.name}</h4></div>
                    <span class="pill accent">+{a.legacy}</span>
                  </div>
                  <div class="desc">{a.desc}</div>
                  {!done && <div class="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: 'var(--gold)' }} /></div>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === 'world' && <World />}
      {tab === 'victory' && <Victory />}
    </PanelShell>
  );
}

function Victory() {
  const s = ctrl.state;
  const p = ctrl.player;
  const mine = victoryProgress(s, p);
  const rivals = s.civs.filter((c) => c.alive && !c.minor && c.id !== p.id && p.relations[c.id]?.met);
  const types = mine.filter((v) => v.name);
  return (
    <>
      <div class="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Hay cinco caminos hacia la gloria. Si nadie gana antes, tras 900 años vence el mayor legado.</div>
      {types.map((v) => {
        const best = rivals.map((r) => ({ r, v: victoryProgress(s, r).find((x) => x.id === v.id)!.v })).sort((a, b) => b.v - a.v)[0];
        return (
          <div class="card" key={v.id}>
            <div class="row" style={{ justifyContent: 'space-between' }}><h4>{v.name}</h4><span class="num muted" style={{ fontSize: 13 }}>{fmt(v.v)} / {fmt(v.max)}</span></div>
            <div class="desc">{v.desc}</div>
            <div class="vbar"><span>Tú</span><div class="bar"><i style={{ width: `${Math.min(100, (v.v / v.max) * 100)}%`, background: p.color }} /></div></div>
            {best && <div class="vbar"><span>{best.r.name}</span><div class="bar"><i style={{ width: `${Math.min(100, (best.v / v.max) * 100)}%`, background: best.r.color }} /></div></div>}
          </div>
        );
      })}
      <div class="card"><h4>Legado</h4><div class="desc">Año {s.year} de {MAX_YEARS}. Consulta la pestaña Legado.</div></div>
    </>
  );
}

function World() {
  const s = ctrl.state;
  const p = ctrl.player;
  const rk = rankings(s).filter((r) => r.civ.id === p.id || p.relations[r.civ.id]?.met);
  const series = s.civs.filter((c) => c.id === p.id || p.relations[c.id]?.met);
  const maxPop = Math.max(10, ...series.flatMap((c) => c.history.map((h) => h.pop)));
  const maxY = Math.max(10, s.year);
  const W = 360, H = 160;
  return (
    <>
      <span class="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Clasificación de legado (pueblos conocidos)</span>
      {rk.map((r, i) => (
        <div key={r.civ.id} class="kv" style={{ alignItems: 'center' }}>
          <span class="k row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><b class="num">{i + 1}.</b><Emblem index={r.civ.emblem} color={r.civ.color} color2={r.civ.color2} size={18} /> {r.civ.name}{!r.civ.alive && ' (desaparecido)'}</span>
          <span class="v">{fmt(r.score)}</span>
        </div>
      ))}
      <div class="section">
        <span class="eyebrow">Población a lo largo del tiempo</span>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'var(--paper-raised)', border: '1px solid var(--hairline)', borderRadius: 10 }} role="img" aria-label="Gráfico de población">
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H - f * (H - 16)} y2={H - f * (H - 16)} stroke="rgba(42,33,25,.08)" />)}
          {series.map((c) => (
            <polyline key={c.id} fill="none" stroke={c.color} stroke-width={c.id === p.id ? 2.6 : 1.6} stroke-linejoin="round"
              points={c.history.map((h) => `${(h.y / maxY) * W},${H - (h.pop / maxPop) * (H - 16)}`).join(' ')} />
          ))}
          <text x="6" y="12" font-size="10" fill="#6e5d49">{fmt(maxPop)}</text>
        </svg>
      </div>
    </>
  );
}
