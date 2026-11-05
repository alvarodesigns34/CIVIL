import { useMemo, useState } from 'preact/hooks';
import { ctrl } from '../../game/controller';
import { Icon } from '../Icon';
import { Thumb } from '../Thumb';
import { TECHS, ERAS, TECH, civEra, type TechDef } from '../../data/techs';
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

// Disposición del árbol: columnas por era, filas ordenadas por el baricentro de sus requisitos
const COL_W = 212, ROW_H = 92, CARD_W = 184, CARD_H = 78, PAD_X = 16, PAD_Y = 40;
function layout() {
  const pos: Record<string, { x: number; y: number; row: number }> = {};
  let maxRows = 0;
  for (let e = 0; e < ERAS.length; e++) {
    const list = TECHS.filter((t) => t.era === e);
    const bary = (t: TechDef) => (t.req.length ? t.req.reduce((a, r) => a + (pos[r]?.row ?? 0), 0) / t.req.length : TECHS.indexOf(t) * 0.01);
    const sorted = [...list].sort((a, b) => bary(a) - bary(b));
    sorted.forEach((t, i) => {
      pos[t.id] = { x: PAD_X + e * COL_W, y: PAD_Y + i * ROW_H, row: i };
    });
    maxRows = Math.max(maxRows, sorted.length);
  }
  return { pos, width: PAD_X * 2 + ERAS.length * COL_W, height: PAD_Y + maxRows * ROW_H + 10 };
}

export function TechPanel() {
  const s = ctrl.state;
  const p = ctrl.player;
  const [sel, setSel] = useState<string | null>(p.research);
  const avail = new Set(availableTechs(p).map((t) => t.id));
  const era = civEra(p.techs);
  const cur = p.research ? TECH[p.research] : null;
  const curCost = cur ? techCostFor(s, p, cur.id) : 0;
  const rate = p.ledger.net.knowledge;
  const L = useMemo(layout, []);
  const mobile = window.innerWidth <= 760;
  const detail = sel ? TECH[sel] : null;

  const state = (id: string) => (p.techs.includes(id) ? 'known' : avail.has(id) ? 'avail' : 'locked');

  return (
    <PanelShell full title="Saber" sub={`${p.techs.length} de ${TECHS.length} tecnologías · ${fmt(rate)} de saber al año. Lo que otros pueblos conocidos ya saben cuesta menos.`}>
      <div class="tech-top">
        {cur ? (
          <div class="card research-now">
            <div class="eyebrow">Investigando · {ERAS[cur.era].name}</div>
            <div class="row" style={{ justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: 20 }}>{cur.name}</h4>
              <span class="num muted">{fmt(p.knowledge)} / {fmt(curCost)} · {rate > 0 ? `${Math.max(1, Math.ceil((curCost - p.knowledge) / rate))} años` : '—'}</span>
            </div>
            <div class="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (p.knowledge / curCost) * 100)}%`, background: 'var(--accent)' }} /></div>
            <div class="desc" style={{ marginTop: 6 }}><i>«{cur.quote}»</i></div>
          </div>
        ) : (
          <div class="card research-now" style={{ borderColor: 'var(--bad)' }}>
            <h4>Tus eruditos esperan</h4>
            <div class="desc">Elige una tecnología disponible (con borde oscuro). El saber acumulado ({fmt(p.knowledge)}) no se pierde.</div>
          </div>
        )}
        {detail && <TechDetail t={detail} st={state(detail.id)} />}
      </div>
      {mobile ? (
        ERAS.map((e, ei) => {
          if (ei > era + 1) return null;
          const list = TECHS.filter((t) => t.era === ei);
          return (
            <div class="tech-era" key={ei}>
              <h3>{e.name} <span class="muted" style={{ fontSize: 12.5, fontFamily: 'var(--font-text)' }}>{list.filter((t) => p.techs.includes(t.id)).length}/{list.length}</span></h3>
              <div class="tech-grid">
                {list.map((t) => <TechCard key={t.id} t={t} st={state(t.id)} onSel={setSel} sel={sel === t.id} />)}
              </div>
            </div>
          );
        })
      ) : (
        <div class="tree-scroll">
          <div class="tree" style={{ width: L.width + 'px', height: L.height + 'px' }}>
            {ERAS.map((e, ei) => (
              <div key={ei} class={cls('tree-era', ei === era && 'now')} style={{ left: PAD_X + ei * COL_W - 8 + 'px', width: COL_W - 12 + 'px', height: L.height + 'px' }}>
                <span style={{ color: e.color }}>{e.name}</span>
              </div>
            ))}
            <svg class="tree-lines" width={L.width} height={L.height}>
              {TECHS.flatMap((t) =>
                t.req.map((r) => {
                  const a = L.pos[r], b = L.pos[t.id];
                  const x1 = a.x + CARD_W, y1 = a.y + CARD_H / 2, x2 = b.x, y2 = b.y + CARD_H / 2;
                  const st = p.techs.includes(t.id) ? 'known' : p.techs.includes(r) ? 'open' : 'locked';
                  return <path key={r + t.id} class={'ln ' + st} d={`M${x1},${y1} C${x1 + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`} />;
                }),
              )}
            </svg>
            {TECHS.map((t) => (
              <div key={t.id} class="tree-node" style={{ left: L.pos[t.id].x + 'px', top: L.pos[t.id].y + 'px', width: CARD_W + 'px', height: CARD_H + 'px' }}>
                <TechCard t={t} st={state(t.id)} onSel={setSel} sel={sel === t.id} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function TechCard({ t, st, onSel, sel, compact }: { t: TechDef; st: string; onSel: (id: string) => void; sel: boolean; compact?: boolean }) {
  const p = ctrl.player;
  const s = ctrl.state;
  const isCur = p.research === t.id;
  const cost = techCostFor(s, p, t.id);
  const unl = BUILDINGS.filter((b) => b.tech === t.id).slice(0, 3);
  return (
    <button class={cls('tech', st, isCur && 'cur', sel && 'selt', compact && 'compact')}
      onClick={() => { onSel(t.id); if (st === 'avail') ctrl.research(t.id); }} title={t.desc}>
      <div class="n">{t.name}{t.final && <Icon name="star" size={14} style={{ marginLeft: 4, color: 'var(--gold)', verticalAlign: '-2px' }} />}</div>
      <div class="c num">{st === 'known' ? 'Conocida' : `${fmt(cost)} saber`}</div>
      {unl.length > 0 && (
        <div class="tech-thumbs">{unl.map((b) => <Thumb key={b.id} id={b.id} color={p.color} color2={p.color2} size={compact ? 26 : 30} />)}</div>
      )}
      {isCur && <div class="prog" style={{ width: `${Math.min(100, (p.knowledge / cost) * 100)}%` }} />}
    </button>
  );
}

function TechDetail({ t, st }: { t: TechDef; st: string }) {
  const p = ctrl.player;
  const s = ctrl.state;
  const unl = unlocksOf(t.id);
  const fx = t.fx ? describeFxObj(t.fx as any) : [];
  const others = s.civs.filter((o) => o.alive && o.id !== p.id && p.relations[o.id]?.met && o.techs.includes(t.id));
  return (
    <div class="card tech-detail">
      <div class="eyebrow">{ERAS[t.era].name} · {st === 'known' ? 'conocida' : st === 'avail' ? 'disponible' : 'bloqueada'}</div>
      <h4 style={{ fontSize: 18 }}>{t.name}</h4>
      <div class="desc">{t.desc}</div>
      <div class="pills">
        {unl.map((u) => <span key={u} class="pill good">{u}</span>)}
        {fx.map((f) => <span key={f} class="pill good">{f}</span>)}
        {st === 'locked' && <span class="pill accent">Requiere {t.req.filter((r) => !p.techs.includes(r)).map((r) => TECH[r].name).join(', ')}</span>}
        {others.length > 0 && st !== 'known' && <span class="pill">Ya la conocen: {others.map((o) => o.name).join(', ')}</span>}
      </div>
    </div>
  );
}
