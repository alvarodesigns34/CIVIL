import { useState } from 'preact/hooks';
import { ctrl } from '../../game/controller';
import { Icon } from '../Icon';
import { Portrait } from '../Emblem';
import { FACTIONS, GOVERNMENTS, GOV, POLICIES, POLICY, POLICY_GROUPS, TRAIT, TRADITION } from '../../data/politics';
import { TECH } from '../../data/techs';
import { factionUnlocked, traditionCost } from '../../sim/economy';
import { canAdoptPolicy, govChangeCost } from '../../sim/politics';
import { describeFxObj } from '../../sim/events';
import { fmt, sgn, cls } from '../util';
import { FACTION_IDS } from '../../sim/types';
import { PanelShell } from './PanelShell';
import { GP_TYPES, GP_INFO, gpCost, gpRates } from '../../sim/greatPeople';

export function GovPanel() {
  const p = ctrl.player;
  const [tab, setTab] = useState(p.traditionOffer ? 'traditions' : 'leader');
  return (
    <PanelShell title="Gobierno" sub={`${GOV[p.government].name} · estabilidad ${Math.round(p.stability)}`} tabs={[{ id: 'leader', label: 'Líder' }, { id: 'factions', label: 'Facciones' }, { id: 'laws', label: 'Leyes' }, { id: 'regime', label: 'Régimen' }, { id: 'traditions', label: p.traditionOffer ? 'Tradiciones •' : 'Tradiciones' }, { id: 'greats', label: 'Ilustres' }]} tab={tab} onTab={setTab}>
      {tab === 'leader' && <Leader />}
      {tab === 'factions' && <Factions />}
      {tab === 'laws' && <Laws />}
      {tab === 'regime' && <Regime />}
      {tab === 'traditions' && <Traditions />}
      {tab === 'greats' && <Greats />}
    </PanelShell>
  );
}

function Leader() {
  const p = ctrl.player;
  const s = ctrl.state;
  const L = p.leader;
  return (
    <>
      <div class="card">
        <div class="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <Portrait leader={L} color={p.color} size={92} />
          <div style={{ flex: 1 }}>
            <div class="eyebrow">{L.title} · {L.dynasty}</div>
            <h4 style={{ fontSize: 22 }}>{L.name}</h4>
            <div class="muted num">{L.age} años · gobierna desde hace {s.year - L.reignStart} años</div>
            <div style={{ marginTop: 8 }}>
              <div class="kv"><span class="k">Legitimidad</span><span class="v">{Math.round(L.legitimacy)}</span></div>
              <div class="bar"><i style={{ width: `${L.legitimacy}%`, background: 'var(--gold)' }} /></div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {L.traits.map((t) => {
            const d = TRAIT[t];
            if (!d) return null;
            return (
              <div key={t} class="kv">
                <span class="k"><b style={{ color: d.good ? 'var(--good)' : 'var(--bad)' }}>{d.name}</b> — {d.desc}</span>
                <span class="v" style={{ fontSize: 12.5, fontWeight: 600 }}>{describeFxObj(d.fx as any).join(', ')}</span>
              </div>
            );
          })}
        </div>
      </div>
      {p.heir && (
        <div class="card">
          <div class="row" style={{ gap: 12 }}>
            <Portrait leader={p.heir} color={p.color} size={56} />
            <div>
              <div class="eyebrow">Heredero</div>
              <h4>{p.heir.name}</h4>
              <div class="muted">{p.heir.age} años · {p.heir.traits.map((t) => TRAIT[t]?.name).join(', ')}</div>
            </div>
          </div>
        </div>
      )}
      <div class="muted" style={{ fontSize: 13.5, marginTop: 12 }}>
        {GOV[p.government].succession === 'hereditary' ? 'A su muerte le sucederá su heredero; si es menor o el reino está inestable, habrá crisis.' : GOV[p.government].succession === 'election' ? 'A su muerte se celebrarán elecciones entre los candidatos de las facciones.' : GOV[p.government].succession === 'council' ? 'A su muerte, el consejo de ancianos elegirá un sucesor.' : 'A su muerte, el clero designará a su sucesor.'}
      </div>
    </>
  );
}

function Factions() {
  const p = ctrl.player;
  const L = p.ledger;
  const total = FACTION_IDS.reduce((a, f) => a + L.factionPower[f], 0) || 1;
  const parts = Object.entries(L.stabilityParts).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return (
    <>
      {FACTION_IDS.filter((f) => factionUnlocked(p, f)).map((f) => {
        const d = FACTIONS[f];
        const a = p.factions[f];
        const t = L.factionTargets[f];
        return (
          <div class="card" key={f}>
            <div class="row" style={{ justifyContent: 'space-between' }}>
              <div class="row"><span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, display: 'inline-block' }} /><h4>{d.name}</h4></div>
              <span class="num" style={{ fontWeight: 700 }}>{Math.round(a)} <span class={cls(t > a + 1 ? 'good' : t < a - 1 ? 'bad' : 'muted')} style={{ fontSize: 12.5 }}>{t > a + 1 ? '↑' : t < a - 1 ? '↓' : '·'} {Math.round(t)}</span></span>
            </div>
            <div class="bar" style={{ marginTop: 6 }}>
              <i style={{ width: `${a}%`, background: a < 30 ? 'var(--bad)' : a > 65 ? 'var(--good)' : d.color }} />
              <b style={{ left: `${t}%` }} />
            </div>
            <div class="desc">{d.desc} <b>Quieren:</b> {d.wants}</div>
            <div class="pills"><span class="pill">Poder {Math.round((L.factionPower[f] / total) * 100)}%</span></div>
          </div>
        );
      })}
      <div class="section">
        <span class="eyebrow">Qué sostiene la estabilidad</span>
        <div class="card">
          {parts.map(([k, v]) => (
            <div class="kv" key={k}><span class="k">{k}</span><span class={cls('v', k !== 'Base' && v > 0 ? 'good' : v < 0 ? 'bad' : '')}>{k === 'Base' ? v : sgn(v)}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}

function Laws() {
  const p = ctrl.player;
  const g = GOV[p.government];
  const groups = Object.keys(POLICY_GROUPS);
  return (
    <>
      <div class="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>{g.name} admite <b>{g.slots}</b> ley{g.slots > 1 ? 'es' : ''} (una por ámbito). Tienes {p.policies.length}. Influencia disponible: <b>{fmt(p.res.influence)}</b>.</div>
      {groups.map((gr) => {
        const list = POLICIES.filter((x) => x.group === gr);
        return (
          <div class="section" key={gr}>
            <span class="eyebrow">{POLICY_GROUPS[gr]}</span>
            {list.map((pol) => {
              const active = p.policies.includes(pol.id);
              const why = canAdoptPolicy(p, pol.id);
              const locked = pol.tech && !p.techs.includes(pol.tech);
              return (
                <div key={pol.id} class={cls('card', active && 'sel', locked && 'locked')}>
                  <div class="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4>{pol.name}</h4>
                      <div class="desc">{pol.desc}</div>
                    </div>
                    {active ? (
                      <button class="btn small ghost" onClick={() => ctrl.revoke(pol.id)}>Derogar</button>
                    ) : (
                      <button class="btn small" disabled={!!why} title={why ?? ''} onClick={() => ctrl.adopt(pol.id)}>{fmt(pol.cost)} <Icon name="influence" /></button>
                    )}
                  </div>
                  <div class="pills">
                    {describeFxObj(pol.fx as any).map((t, i) => <span key={i} class={cls('pill', t.startsWith('-') || t.startsWith('−') ? 'bad' : 'good')}>{t}</span>)}
                    {locked && <span class="pill accent">Requiere {TECH[pol.tech!].name}</span>}
                    {!active && !locked && why && why.startsWith('Tu gobierno') && <span class="pill">{why}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function Regime() {
  const p = ctrl.player;
  const s = ctrl.state;
  const cost = govChangeCost(p);
  return (
    <>
      <div class="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Cambiar de régimen cuesta <b>{cost}</b> de influencia y provoca 8 años de inestabilidad. Cada régimen cambia las facciones, la sucesión y cuántas leyes admite.</div>
      {GOVERNMENTS.map((g) => {
        const cur = p.government === g.id;
        const locked = g.tech && !p.techs.includes(g.tech);
        return (
          <div key={g.id} class={cls('card', cur && 'sel', locked && 'locked')}>
            <div class="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4>{g.name}</h4>
                <div class="desc">{g.desc}</div>
              </div>
              {cur ? <span class="pill accent">Actual</span> : <button class="btn small" disabled={!!locked || p.res.influence < cost || s.year - p.govChanged < 10} onClick={() => ctrl.setGovernment(g.id)}>Adoptar</button>}
            </div>
            <div class="pills">
              <span class="pill">{g.slots} leyes</span>
              <span class="pill">Título: {g.title}</span>
              {describeFxObj(g.fx as any).map((t, i) => <span key={i} class={cls('pill', t.startsWith('-') || t.startsWith('−') ? 'bad' : 'good')}>{t}</span>)}
              {locked && <span class="pill accent">Requiere {TECH[g.tech!].name}</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Traditions() {
  const p = ctrl.player;
  const offer = p.traditionOffer;
  return (
    <>
      {offer ? (
        <div class="section">
          <span class="eyebrow">Elige una tradición</span>
          {offer.map((id) => {
            const t = TRADITION[id];
            return (
              <button key={id} class="card click" onClick={() => ctrl.chooseTradition(id)}>
                <h4>{t.name}</h4>
                <div class="desc">{t.desc}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div class="card">
          <h4>Próxima tradición</h4>
          <div class="desc">La cultura acumulada desbloquea tradiciones permanentes.</div>
          <div class="bar" style={{ marginTop: 8 }}><i style={{ width: `${Math.min(100, (p.culturePts / traditionCost(p)) * 100)}%`, background: '#b67ac0' }} /></div>
          <div class="muted num" style={{ fontSize: 13, marginTop: 4 }}>{fmt(p.culturePts)} / {fmt(traditionCost(p))}</div>
        </div>
      )}
      <div class="section">
        <span class="eyebrow">Tradiciones de tu pueblo ({p.traditions.length})</span>
        {p.traditions.length === 0 && <div class="muted">Todavía ninguna.</div>}
        {p.traditions.map((id) => (
          <div class="kv" key={id}><span class="k"><b>{TRADITION[id].name}</b></span><span class="v" style={{ fontWeight: 500, fontSize: 13 }}>{TRADITION[id].desc}</span></div>
        ))}
      </div>
    </>
  );
}

function Greats() {
  const p = ctrl.player;
  const s = ctrl.state;
  const rates = gpRates(s, p);
  const cost = gpCost(p);
  return (
    <>
      <div class="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Los personajes ilustres nacen de lo que tu pueblo cultiva. Cada uno que nace encarece al siguiente. El próximo necesitará <b>{fmt(cost)}</b> puntos.</div>
      {GP_TYPES.map((t) => {
        const info = GP_INFO[t];
        const v = p.gp?.[t] ?? 0;
        const r = rates[t];
        return (
          <div class="card" key={t}>
            <div class="row" style={{ justifyContent: 'space-between' }}>
              <div class="row"><span style={{ width: 10, height: 10, borderRadius: 3, background: info.color, display: 'inline-block' }} /><h4>{info.plural}</h4></div>
              <span class="num muted" style={{ fontSize: 13 }}>{fmt(v)} / {fmt(cost)} · {r > 0.05 ? `+${r.toFixed(1)}/año` : 'sin avance'}</span>
            </div>
            <div class="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (v / cost) * 100)}%`, background: info.color }} /></div>
            <div class="desc">{info.desc}</div>
          </div>
        );
      })}
      <div class="section">
        <span class="eyebrow">Galería de ilustres ({p.greats?.length ?? 0})</span>
        {!(p.greats?.length) && <div class="muted">Todavía no ha nacido ninguno.</div>}
        {(p.greats ?? []).slice().reverse().map((g, i) => (
          <div class="kv" key={i}><span class="k"><b>{g.name}</b> · {GP_INFO[g.type as keyof typeof GP_INFO].name}</span><span class="v">año {g.year}</span></div>
        ))}
      </div>
    </>
  );
}

export { POLICY };
