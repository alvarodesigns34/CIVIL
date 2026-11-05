import { ctrl } from '../game/controller';
import { Icon, RES_COLOR } from './Icon';
import { UNIT, type UnitDef } from '../data/units';
import { drawRegiment } from '../render/unitArt';
import { tileAt, settlementAt, settlementById } from '../sim/world';
import { recruitable, unitPower, hostile } from '../sim/military';
import { BUILDING } from '../data/buildings';
import { fmt, cls } from './util';
import type { ResId, Settlement } from '../sim/types';

const cache = new Map<string, string>();
export function unitThumb(type: string, color: string, color2: string, size = 112) {
  const k = `${type}|${color}|${size}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grd.addColorStop(0, '#efe4c8');
  grd.addColorStop(1, '#cdbb92');
  g.fillStyle = grd;
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(42,33,25,.5)'; g.lineWidth = 2; g.stroke();
  g.translate(size / 2 + 2, size * 0.72);
  g.lineCap = 'round'; g.lineJoin = 'round';
  drawRegiment(g, UNIT[type].glyph, color, color2, 0.4, false, size / 34);
  const url = c.toDataURL();
  cache.set(k, url);
  return url;
}

export function UnitIcon({ type, color, color2, size = 44 }: { type: string; color: string; color2: string; size?: number }) {
  return <img class="unit-ico" src={unitThumb(type, color, color2)} width={size} height={size} alt="" draggable={false} />;
}

const ORDER: Record<string, string> = { idle: 'En espera', move: 'En marcha', fortify: 'Fortificados', raid: 'Saqueando', campaign: 'En campaña' };

export function UnitCard() {
  const sel = ctrl.selectedUnits();
  if (!sel.length) return null;
  const s = ctrl.state;
  const p = ctrl.player;
  const lead = sel[0];
  const t = tileAt(s, lead.col, lead.row)!;
  const canRaid = t.owner >= 0 && hostile(s, p.id, t.owner) && t.b && t.b.progress >= 1 && !BUILDING[t.b.type].wonder;
  const power = sel.reduce((a, u) => a + unitPower(s, u), 0);
  const target = lead.targetSid >= 0 ? settlementById(s, lead.targetSid) : null;
  return (
    <aside class="tilecard unitcard" aria-label="Tropas seleccionadas">
      <div class="head">
        <UnitIcon type={lead.type} color={p.color} color2={p.color2} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div class="eyebrow">{sel.length > 1 ? `Ejército · ${sel.length} regimientos` : ORDER[lead.order] ?? ''}{target ? ` · objetivo ${target.name}` : ''}</div>
          <h3>{sel.length > 1 ? `Fuerza ${fmt(power)}` : lead.name}</h3>
          <div class="muted" style={{ fontSize: 13 }}>Toca el mapa para mover. Toca un enemigo o una ciudad enemiga para atacar.</div>
        </div>
        <button class="close" onClick={() => ctrl.clearUnits()} aria-label="Deseleccionar"><Icon name="close" /></button>
      </div>
      <div class="body scroll">
        {sel.map((u) => {
          const d = UNIT[u.type];
          return (
            <button key={u.id} class="unit-row" onClick={() => ctrl.selectUnits([u.id])} title="Seleccionar sólo este">
              <UnitIcon type={u.type} color={p.color} color2={p.color2} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div class="row" style={{ justifyContent: 'space-between' }}>
                  <b>{d.name}</b>
                  <span class="muted num stat" style={{ fontSize: 12.5 }}><Icon name="sword" />{d.atk} <Icon name="shield" />{d.def}{u.xp >= 10 ? ` · nivel ${Math.min(5, Math.floor(u.xp / 10))}` : ''}</span>
                </div>
                <div class="bar" style={{ marginTop: 4, height: 6 }}><i style={{ width: `${Math.max(0, u.hp)}%`, background: u.hp > 60 ? 'var(--good)' : u.hp > 30 ? 'var(--gold)' : 'var(--bad)' }} /></div>
                <div class="muted" style={{ fontSize: 12, marginTop: 2 }}>{u.name} · {ORDER[u.order]}{u.engaged ? ' · ¡combatiendo!' : ''}</div>
              </div>
            </button>
          );
        })}
        <div class="actions unit-actions">
          <button class="btn small" onClick={() => ctrl.unitCommand('fortify')}><Icon name="shield" /> Fortificar</button>
          {canRaid && <button class="btn small" style={{ background: 'var(--bad)' }} onClick={() => ctrl.unitCommand('raid')}><Icon name="sword" /> Saquear</button>}
          <button class="btn small ghost" onClick={() => ctrl.unitCommand('home')}><Icon name="cities" /> A casa</button>
          {lead.path.length > 0 && <button class="btn small ghost" onClick={() => ctrl.unitCommand('stop')}>Detener</button>}
          <button class="btn small ghost" onClick={() => ctrl.unitCommand('disband')}><Icon name="trash" /> Licenciar</button>
        </div>
        <div class="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Fuera de tu territorio las tropas se desgastan; en casa se curan. Colinas, bosques y murallas ayudan a defender. Los lanceros y piqueros frenan a la caballería.</div>
      </div>
    </aside>
  );
}

// Sección de reclutamiento dentro de la ficha de un asentamiento propio
export function RecruitSection({ st }: { st: Settlement }) {
  const s = ctrl.state;
  const p = ctrl.player;
  const opts = recruitable(s, p, st);
  const here = (s.units ?? []).filter((u) => u.civ === p.id && u.col === st.col && u.row === st.row);
  return (
    <div class="section" style={{ marginTop: 14 }}>
      <span class="eyebrow">Ejército</span>
      {here.length > 0 && (
        <button class="btn small" style={{ marginBottom: 8 }} onClick={() => ctrl.selectUnits(here.map((u) => u.id))}>
          <Icon name="sword" /> Mandar a las {here.length} tropas de aquí
        </button>
      )}
      {(st.queue ?? []).map((q, i) => (
        <div key={i} class="kv"><span class="k">{i === 0 ? 'Instruyendo' : 'En cola'}: {UNIT[q.type].name}</span><span class="v">{Math.round(q.prog * 100)}%</span></div>
      ))}
      <div class="recruit-grid">
        {opts.map(({ def, ok, why }) => (
          <button key={def.id} class={cls('recruit', !ok && 'locked')} disabled={!ok} onClick={() => ctrl.recruit(st.id, def.id)} title={why ?? def.desc}>
            <UnitIcon type={def.id} color={p.color} color2={p.color2} size={46} />
            <div class="rn">{def.name}</div>
            <div class="rs num stat"><Icon name="sword" />{def.atk} <Icon name="shield" />{def.def}{def.mounted ? ' · rápida' : def.ranged ? ' · distancia' : ''}{def.siege ? ' · asedio' : ''}</div>
            <div class="rc">
              {Object.entries(def.cost).map(([r, v]) => <span key={r} class={cls(p.res[r as ResId] < (v as number) && 'bad')}><Icon name={r} style={{ color: RES_COLOR[r] }} />{v as number}</span>)}
              <span><Icon name="pop" />{def.pop}</span>
            </div>
            {!ok && <div class="rw">{why}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function useless(_: UnitDef) {}
export { settlementAt };
