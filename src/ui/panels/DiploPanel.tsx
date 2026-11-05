import { useState } from 'preact/hooks';
import { ctrl } from '../../game/controller';
import { Icon } from '../Icon';
import { Emblem, Portrait } from '../Emblem';
import { diploActions, opinionTarget } from '../../sim/diplomacy';
import { civSettlements, capitalOf } from '../../sim/world';
import { civEra, ERAS } from '../../data/techs';
import { GOV, TRAIT } from '../../data/politics';
import { fmt, sgn, cls, attitude, PERSONALITY_NAME } from '../util';
import { PanelShell } from './PanelShell';
import { MINOR_INFO, minorStanding, FRIEND, ALLY } from '../../sim/minors';

export function DiploPanel() {
  const s = ctrl.state;
  const p = ctrl.player;
  const known = s.civs.filter((o) => o.id !== p.id && !o.minor && p.relations[o.id]?.met);
  const minors = s.civs.filter((o) => o.minor && p.relations[o.id]?.met);
  const [open, setOpen] = useState<number | null>(known[0]?.id ?? null);
  const unknown = s.civs.filter((o) => o.id !== p.id && !o.minor && !p.relations[o.id]?.met && o.alive).length;
  return (
    <PanelShell title="Pueblos" sub={`${known.length} pueblos conocidos${unknown ? ` · ${unknown} por descubrir` : ''}. Tu fuerza militar: ${fmt(p.strength)}.`}>
      {!known.length && (
        <div class="card">
          <h4>Aún no conocéis a nadie</h4>
          <div class="desc">Envía exploradores desde el panel Construir o expande tus fronteras para encontrar a otros pueblos.</div>
          <button class="btn small" style={{ marginTop: 10 }} onClick={() => ctrl.enterScout()}><Icon name="compass" /> Enviar exploradores</button>
        </div>
      )}
      {known.map((o) => {
        const r = p.relations[o.id];
        const theirs = o.relations[p.id];
        const att = attitude(theirs.opinion);
        const pop = civSettlements(s, o.id).reduce((a, x) => a + x.pop, 0);
        const isOpen = open === o.id;
        const ratio = o.strength / Math.max(1, p.strength);
        return (
          <div key={o.id} class={cls('card', !o.alive && 'locked')}>
            <button class="row" style={{ width: '100%', textAlign: 'left', gap: 12 }} onClick={() => setOpen(isOpen ? null : o.id)}>
              <Emblem index={o.emblem} color={o.color} color2={o.color2} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4>{o.name} <span class="muted" style={{ fontFamily: 'var(--font-text)', fontSize: 13, fontWeight: 500 }}>· {o.people}</span></h4>
                <div class="pills" style={{ marginTop: 4 }}>
                  {!o.alive ? <span class="pill bad">Desaparecido</span> : (
                    <>
                      <span class={cls('pill', r.state === 'war' ? 'bad' : r.state === 'alliance' ? 'good' : '')}>{r.state === 'war' ? 'En guerra' : r.state === 'alliance' ? 'Aliados' : 'Paz'}</span>
                      <span class={cls('pill', att.c)}>{att.t} ({sgn(theirs.opinion)})</span>
                      {r.trade && <span class="pill good">Comercio</span>}
                      {r.state === 'war' && <span class={cls('pill', r.warScore >= 0 ? 'good' : 'bad')}>Guerra {sgn(r.warScore)}</span>}
                    </>
                  )}
                </div>
              </div>
              <Icon name={isOpen ? 'minus' : 'plus'} size={18} />
            </button>
            {isOpen && o.alive && (
              <div style={{ marginTop: 12 }}>
                <div class="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                  <Portrait leader={o.leader} color={o.color} size={64} />
                  <div style={{ flex: 1 }}>
                    <div class="eyebrow">{o.leader.title}</div>
                    <div style={{ fontWeight: 700 }}>{o.leader.name}</div>
                    <div class="muted" style={{ fontSize: 13 }}>{o.leader.age} años · {o.leader.traits.map((t) => TRAIT[t]?.name).join(', ')}</div>
                    <div class="muted" style={{ fontSize: 13 }}>Carácter: {PERSONALITY_NAME[o.personality]} · {GOV[o.government].name}</div>
                  </div>
                </div>
                <div class="grid2" style={{ marginTop: 10 }}>
                  <div class="kv"><span class="k">Población</span><span class="v">{fmt(pop)}</span></div>
                  <div class="kv"><span class="k">Ciudades</span><span class="v">{civSettlements(s, o.id).length}</span></div>
                  <div class="kv"><span class="k">Era</span><span class="v">{ERAS[civEra(o.techs)].short}</span></div>
                  <div class="kv"><span class="k">Ejército</span><span class={cls('v', ratio > 1.3 ? 'bad' : ratio < 0.7 ? 'good' : '')}>{ratio > 1.6 ? 'Muy superior' : ratio > 1.15 ? 'Superior' : ratio > 0.85 ? 'Parejo' : ratio > 0.5 ? 'Inferior' : 'Muy inferior'}</span></div>
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary class="muted" style={{ cursor: 'pointer', fontSize: 13.5 }}>Por qué opinan así de nosotros</summary>
                  {opinionTarget(s, o, p).parts.map((x, i) => (
                    <div class="kv" key={i}><span class="k">{x.label}</span><span class={cls('v', x.v > 0 ? 'good' : 'bad')}>{sgn(x.v)}</span></div>
                  ))}
                </details>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {diploActions(s, p, o).map((a) => (
                    <button key={a.id} class={cls('btn small', a.id === 'war' || a.id === 'breakalliance' ? '' : 'ghost')} style={a.id === 'war' ? { background: 'var(--bad)' } : { justifyContent: 'space-between' }} disabled={!!a.available} title={a.available ?? a.desc} onClick={() => ctrl.diplo(o.id, a.id)}>
                      <span>{a.label}</span>
                      <span class="muted" style={{ fontWeight: 500, fontSize: 12.5 }}>
                        {a.cost?.influence ? `${a.cost.influence} infl.` : ''}
                        {a.accept != null ? ` · ${Math.round(a.accept * 100)}% acepta` : ''}
                        {a.available ? ` · ${a.available}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
                <button class="btn small ghost" style={{ marginTop: 8 }} onClick={() => { const c = capitalOf(s, o.id); if (c) ctrl.focusTile(c.col, c.row); }}><Icon name="pin" /> Ver su capital</button>
              </div>
            )}
          </div>
        );
      })}
      {minors.length > 0 && (
        <div class="section">
          <span class="eyebrow">Ciudades-estado</span>
          {minors.map((m) => {
            const pts = m.envoys?.[p.id] ?? 0;
            const st = minorStanding(m, p.id);
            const info = MINOR_INFO[m.minor!];
            const rivals = Object.entries(m.envoys ?? {}).filter(([k]) => +k !== p.id).sort((a, b) => b[1] - a[1])[0];
            const atWar = p.relations[m.id]?.state === 'war';
            return (
              <div key={m.id} class={cls('card', !m.alive && 'locked')}>
                <div class="row" style={{ gap: 10 }}>
                  <Emblem index={m.emblem} color={m.color} color2={m.color2} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4>{m.name}</h4>
                    <div class="muted" style={{ fontSize: 13 }}>{info.name}{st !== 'none' ? ` · ${st === 'ally' ? 'Aliada' : 'Amiga'}` : ''}{atWar ? ' · en guerra' : ''}</div>
                  </div>
                </div>
                <div class="bar" style={{ marginTop: 8 }}>
                  <i style={{ width: `${Math.min(100, (pts / 120) * 100)}%`, background: st === 'ally' ? 'var(--good)' : 'var(--gold)' }} />
                  <b style={{ left: `${(FRIEND / 120) * 100}%` }} /><b style={{ left: `${(ALLY / 120) * 100}%` }} />
                </div>
                <div class="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Amistad: {info.friend}. Alianza: {info.ally}.{rivals ? ` Compite: ${s.civs[+rivals[0]]?.name} (${Math.round(rivals[1])}).` : ''}</div>
                {m.alive && !atWar && (
                  <div class="actions">
                    <button class="btn small" disabled={p.res.influence < 10} onClick={() => ctrl.envoy(m.id, 'envoy')}>Enviar emisarios · 10 infl.</button>
                    <button class="btn small ghost" onClick={() => ctrl.envoy(m.id, 'gift')}>Regalo de oro</button>
                    <button class="btn small ghost" onClick={() => { const c = capitalOf(s, m.id); if (c) ctrl.focusTile(c.col, c.row); }}><Icon name="pin" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}
