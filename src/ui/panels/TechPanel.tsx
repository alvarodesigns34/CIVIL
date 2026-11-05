import { ctrl } from '../../game/controller';
import { Icon } from '../Icon';
import { TECHS, ERAS, TECH, civEra } from '../../data/techs';
import { BUILDINGS } from '../../data/buildings';
import { GOVERNMENTS, POLICIES } from '../../data/politics';
import { availableTechs, techCostFor } from '../../sim/economy';
import { fmt, cls } from '../util';
import { PanelShell } from './PanelShell';
import { describeFxObj } from '../../sim/events';

export function unlocksOf(id: string): string[] {
  const out: string[] = [];
  for (const b of BUILDINGS) if (b.tech === id) out.push(b.name);
  for (const g of GOVERNMENTS) if (g.tech === id) out.push(g.name);
  for (const p of POLICIES) if (p.tech === id) out.push(`Ley: ${p.name}`);
  return out;
}

export function TechPanel() {
  const s = ctrl.state;
  const p = ctrl.player;
  const avail = new Set(availableTechs(p).map((t) => t.id));
  const era = civEra(p.techs);
  const cur = p.research ? TECH[p.research] : null;
  const curCost = cur ? techCostFor(s, p, cur.id) : 0;
  const rate = p.ledger.net.knowledge;
  return (
    <PanelShell wide title="Saber" sub={`${p.techs.length} de ${TECHS.length} tecnologías · ${fmt(rate)} de saber al año. Lo que otros pueblos conocidos ya saben es más barato de aprender.`}>
      {cur ? (
        <div class="card" style={{ borderColor: 'var(--accent)' }}>
          <div class="eyebrow">Investigando</div>
          <div class="row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 19 }}>{cur.name}</h4>
            <span class="num muted">{fmt(p.knowledge)} / {fmt(curCost)} · {rate > 0 ? `${Math.max(1, Math.ceil((curCost - p.knowledge) / rate))} años` : '—'}</span>
          </div>
          <div class="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (p.knowledge / curCost) * 100)}%`, background: 'var(--accent)' }} /></div>
          <div class="desc" style={{ marginTop: 8 }}>{cur.desc}</div>
        </div>
      ) : (
        <div class="card" style={{ borderColor: 'var(--bad)' }}>
          <h4>Tus eruditos esperan</h4>
          <div class="desc">Elige una tecnología disponible. El saber acumulado ({fmt(p.knowledge)}) no se pierde.</div>
        </div>
      )}
      {ERAS.map((e, ei) => {
        const list = TECHS.filter((t) => t.era === ei);
        if (ei > era + 1) return null;
        return (
          <div class="tech-era" key={ei}>
            <h3>{e.name} <span class="muted" style={{ fontSize: 12.5, fontFamily: 'var(--font-text)' }}>{list.filter((t) => p.techs.includes(t.id)).length}/{list.length}</span></h3>
            <div class="tech-grid">
              {list.map((t) => {
                const known = p.techs.includes(t.id);
                const can = avail.has(t.id);
                const isCur = p.research === t.id;
                const cost = techCostFor(s, p, t.id);
                const others = s.civs.filter((o) => o.alive && o.id !== p.id && p.relations[o.id]?.met && o.techs.includes(t.id)).length;
                const unl = unlocksOf(t.id);
                const fx = t.fx ? describeFxObj(t.fx as any) : [];
                return (
                  <button key={t.id} class={cls('tech', known && 'known', can && 'avail', isCur && 'cur', !known && !can && 'locked')} disabled={!can} onClick={() => ctrl.research(t.id)} title={t.desc}>
                    <div class="n">{t.name}{t.final && <Icon name="star" size={14} style={{ marginLeft: 4, color: 'var(--gold)', verticalAlign: '-2px' }} />}</div>
                    <div class="c num">{known ? 'Conocida' : `${fmt(cost)} saber${others ? ` · ${others} pueblo${others > 1 ? 's' : ''} la conoce${others > 1 ? 'n' : ''}` : ''}`}</div>
                    {!known && t.req.length > 0 && !can && <div class="c">Requiere: {t.req.filter((r) => !p.techs.includes(r)).map((r) => TECH[r].name).join(', ')}</div>}
                    {(unl.length > 0 || fx.length > 0) && <div class="c" style={{ marginTop: 4, color: 'var(--ink-2)' }}>{[...unl, ...fx].join(' · ')}</div>}
                    {isCur && <div class="prog" style={{ width: `${Math.min(100, (p.knowledge / cost) * 100)}%` }} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </PanelShell>
  );
}
