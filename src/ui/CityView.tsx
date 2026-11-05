import { useState } from 'preact/hooks';
import { ctrl } from '../game/controller';
import { Icon } from './Icon';
import { RecruitSection } from './UnitCard';
import { LEVELS, needsFor, SPECS, canSpecialize, GOVERNOR, governorCandidates } from '../sim/cities';
import { settlementDefense, fortCost, FORT_NAME } from '../sim/war';
import { canFortify } from '../sim/actions';
import { tilesOfSettlement } from '../sim/world';
import { BUILDING } from '../data/buildings';
import { fmt, sgn, cls } from './util';
import type { Settlement } from '../sim/types';
import { RES_COLOR } from './Icon';

export function CityView({ st }: { st: Settlement }) {
  const [tab, setTab] = useState<'sum' | 'pros' | 'gov' | 'army'>('sum');
  const s = ctrl.state;
  const p = ctrl.player;
  const lv = st.level ?? 0;
  const next = lv < 5 ? needsFor(s, p, st, lv + 1) : [];
  const done = next.filter((n) => n.ok).length;
  return (
    <>
      <div class="level-strip">
        {LEVELS.slice(1).map((l, i) => (
          <span key={i} class={cls('lv', i + 1 <= lv && 'on', i + 1 === lv + 1 && 'next')} title={l.name}>{l.short}</span>
        ))}
      </div>
      <div class="seg city-tabs">
        <button class={cls(tab === 'sum' && 'on')} onClick={() => setTab('sum')}>Resumen</button>
        <button class={cls(tab === 'pros' && 'on')} onClick={() => setTab('pros')}>Prosperidad{lv < 5 ? ` ${done}/${next.length}` : ''}</button>
        <button class={cls(tab === 'gov' && 'on')} onClick={() => setTab('gov')}>Gobierno</button>
        <button class={cls(tab === 'army' && 'on')} onClick={() => setTab('army')}>Ejército{st.queue?.length ? ` (${st.queue.length})` : ''}</button>
      </div>
      {tab === 'sum' && <Summary st={st} />}
      {tab === 'pros' && (
        <div>
          {lv < 5 ? (
            <>
              <div class="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>Para convertirse en <b>{LEVELS[lv + 1].name}</b>:</div>
              {[...next].sort((a, b) => Number(a.ok) - Number(b.ok)).map((n) => (
                <div key={n.id} class={cls('need', n.ok && 'ok')}>
                  <span class="tick">{n.ok ? <Icon name="check" /> : null}</span>
                  <span>{n.label}{n.detail ? <span class="muted"> · {n.detail}</span> : null}</span>
                </div>
              ))}
            </>
          ) : <div class="muted">Es una metrópolis: la cumbre de la vida urbana.</div>}
          <div class="card" style={{ marginTop: 10 }}>
            <div class="eyebrow">Cada nivel concede</div>
            <div class="desc">+8% vivienda, +10% impuestos, +0,6 saber y +0,4 cultura al año. Si sus necesidades dejan de cubrirse durante 5 años, la ciudad decae.</div>
            {(st.lowYears ?? 0) > 0 && <div class="bad" style={{ fontSize: 13, marginTop: 6 }}>Lleva {st.lowYears} años sin cubrir sus necesidades.</div>}
          </div>
        </div>
      )}
      {tab === 'gov' && <CityGov st={st} />}
      {tab === 'army' && <RecruitSection st={st} />}
    </>
  );
}

function Summary({ st }: { st: Settlement }) {
  const s = ctrl.state;
  const p = ctrl.player;
  const nextFort = st.fort + 1;
  const queued = tilesOfSettlement(s, st).filter(([, , t]) => t.b && t.b.progress < 1);
  return (
    <>
      <div class="grid2">
        <div class="kv"><span class="k">Población</span><span class="v">{fmt(st.pop)}</span></div>
        <div class="kv"><span class="k">Vivienda</span><span class={cls('v', st.pop > st.housing && 'bad')}>{fmt(st.housing)}</span></div>
        <div class="kv"><span class="k">Crecimiento</span><span class={cls('v', st.growth >= 0 ? 'good' : 'bad')}>{sgn(st.growth, 1)}/año</span></div>
        <div class="kv"><span class="k">Salud</span><span class={cls('v', st.health < 0 ? 'bad' : 'good')}>{sgn(st.health, 1)}</span></div>
        <div class="kv"><span class="k">Trabajadores</span><span class="v">{fmt(st.employed)}/{fmt(st.workforce)}</span></div>
        <div class="kv"><span class="k">Puestos</span><span class={cls('v', st.jobs > st.workforce && 'bad')}>{fmt(st.jobs)}</span></div>
        <div class="kv"><span class="k">Defensa</span><span class="v">{fmt(settlementDefense(s, p, st))}</span></div>
        <div class="kv"><span class="k">Malestar</span><span class={cls('v', st.unrest > 30 && 'bad')}>{Math.round(st.unrest)}</span></div>
      </div>
      {queued.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span class="eyebrow">Obras</span>
          {queued.map(([c, r, t]) => (
            <div class="kv" key={c + ',' + r}><span class="k">{BUILDING[t.b!.type].name}{(t.b as any).queued ? ' (en espera)' : ''}</span><span class="v">{Math.round(t.b!.progress * 100)}%</span></div>
          ))}
        </div>
      )}
      <div class="kv" style={{ marginTop: 6 }}><span class="k">Fortificación</span><span class="v">{FORT_NAME[st.fort]}</span></div>
      {st.fort < 3 && (
        <div class="actions">
          <button class="btn small" disabled={!!canFortify(s, p, st)} onClick={() => ctrl.fortify(st.id)} title={canFortify(s, p, st) ?? ''}><Icon name="shield" /> {FORT_NAME[nextFort]}</button>
          <span class="pills" style={{ marginTop: 0 }}>{Object.entries(fortCost(nextFort)).map(([r, v]) => <span key={r} class={cls('pill', p.res[r as keyof typeof p.res] < v && 'bad')}><Icon name={r} style={{ color: RES_COLOR[r] }} />{v}</span>)}</span>
        </div>
      )}
    </>
  );
}

function CityGov({ st }: { st: Settlement }) {
  const s = ctrl.state;
  const p = ctrl.player;
  const [cands, setCands] = useState<ReturnType<typeof governorCandidates> | null>(null);
  return (
    <>
      <span class="eyebrow">Especialización {st.spec ? '' : '(20 de influencia)'}</span>
      <div class="spec-grid">
        {SPECS.map((d) => {
          const why = canSpecialize(s, p, st, d.id);
          const cur = st.spec === d.id;
          return (
            <button key={d.id} class={cls('spec', cur && 'on', why && !cur && 'locked')} disabled={!!why && !cur} onClick={() => ctrl.specialize(st.id, d.id)} title={why ?? ''}>
              <b>{d.name}</b>
              <span>{d.desc}</span>
              {why && !cur && <em>{why}</em>}
            </button>
          );
        })}
      </div>
      {!st.capital && (
        <div class="section">
          <span class="eyebrow">Gobernador</span>
          {st.governor ? (
            <div class="card">
              <div class="row" style={{ justifyContent: 'space-between' }}>
                <h4>{st.governor.name}</h4>
                <span class="pill">{GOVERNOR[st.governor.kind].name}</span>
              </div>
              <div class="desc">{GOVERNOR[st.governor.kind].desc}</div>
              <div class="kv"><span class="k">Lealtad</span><span class={cls('v', st.governor.loyalty < 35 && 'bad')}>{Math.round(st.governor.loyalty)}</span></div>
              <div class="bar"><i style={{ width: `${st.governor.loyalty}%`, background: st.governor.loyalty < 35 ? 'var(--bad)' : 'var(--gold)' }} /></div>
              <div class="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{st.governor.age} años. La lealtad sube con la estabilidad y la legitimidad del líder.</div>
            </div>
          ) : cands ? (
            cands.map((g) => (
              <button key={g.name} class="card click" onClick={() => { ctrl.appoint(st.id, g); setCands(null); }}>
                <div class="row" style={{ justifyContent: 'space-between' }}><h4>{g.name}</h4><span class="pill">{GOVERNOR[g.kind].name}</span></div>
                <div class="desc">{GOVERNOR[g.kind].desc} · {g.age} años · lealtad {g.loyalty}</div>
              </button>
            ))
          ) : (
            <button class="btn small" disabled={p.res.influence < 15} onClick={() => setCands(governorCandidates(s, p, st))}>Buscar candidatos · 15 influencia</button>
          )}
        </div>
      )}
    </>
  );
}
