import { useState } from 'preact/hooks';
import { ctrl } from '../game/controller';
import { notify } from '../game/store';
import { Icon, RES_COLOR } from './Icon';
import { Emblem } from './Emblem';
import { tileAt, settlementAt, settlementById } from '../sim/world';
import { tileName, DEPOSITS, isLand } from '../data/terrain';
import { BUILDING, BUILDINGS, BCAT_NAME } from '../data/buildings';
import { buildingYield, placeCtx } from '../sim/economy';
import { canBuildAt, buildCost, canColonize, colonyCost, hurryCost, canFortify, canAfford } from '../sim/actions';
import { fortCost, FORT_NAME, settlementDefense } from '../sim/war';
import { RES_NAME } from '../sim/names';
import { fmt, sgn, cls } from './util';
import type { ResId, YieldId } from '../sim/types';

function CostPills({ cost }: { cost: Partial<Record<ResId, number>> }) {
  const p = ctrl.player;
  return (
    <>
      {Object.entries(cost).map(([r, v]) => (
        <span key={r} class={cls('pill', p.res[r as ResId] < (v as number) && 'bad')}>
          <Icon name={r} style={{ color: RES_COLOR[r] }} /> {fmt(v as number)}
        </span>
      ))}
    </>
  );
}

export function TileCard() {
  const sel = ctrl.overlay.selected;
  const [confirmDel, setConfirmDel] = useState(false);
  if (!sel || ctrl.overlay.mode !== 'select') return null;
  const s = ctrl.state;
  const p = ctrl.player;
  const [c, r] = sel;
  const t = tileAt(s, c, r);
  if (!t) return null;
  const owner = t.owner >= 0 ? s.civs[t.owner] : null;
  const st = settlementAt(s, c, r);
  const dep = t.dep ? DEPOSITS[t.dep] : null;
  const depVisible = dep && (!dep.reveal || p.techs.includes(dep.reveal));
  const close = () => { ctrl.overlay.selected = null; notify(); };
  const mine = t.owner === p.id;

  let body: any = null;
  let title = tileName(t);
  let kicker = owner ? (st ? (st.capital ? 'Capital' : 'Asentamiento') : `Territorio ${owner.isPlayer ? 'propio' : 'de ' + owner.name}`) : 'Tierra sin reclamar';

  if (st) {
    title = st.name;
    const civ = s.civs[st.civ];
    kicker = `${st.capital ? 'Capital' : 'Asentamiento'} de ${civ.name}`;
    const nextFort = st.fort + 1;
    body = (
      <>
        <div class="grid2">
          <div class="kv"><span class="k">Población</span><span class="v">{fmt(st.pop)}</span></div>
          <div class="kv"><span class="k">Vivienda</span><span class={cls('v', st.pop > st.housing && 'bad')}>{fmt(st.housing)}</span></div>
          <div class="kv"><span class="k">Crecimiento</span><span class={cls('v', st.growth >= 0 ? 'good' : 'bad')}>{sgn(st.growth, 1)}/año</span></div>
          <div class="kv"><span class="k">Salud</span><span class={cls('v', st.health < 0 ? 'bad' : 'good')}>{sgn(st.health, 1)}</span></div>
          {civ.isPlayer && <div class="kv"><span class="k">Trabajadores</span><span class="v">{fmt(st.employed)}/{fmt(st.workforce)}</span></div>}
          {civ.isPlayer && <div class="kv"><span class="k">Puestos</span><span class={cls('v', st.jobs > st.workforce && 'bad')}>{fmt(st.jobs)}</span></div>}
          <div class="kv"><span class="k">Defensa</span><span class="v">{fmt(settlementDefense(s, civ, st))}</span></div>
          <div class="kv"><span class="k">Malestar</span><span class={cls('v', st.unrest > 30 && 'bad')}>{Math.round(st.unrest)}</span></div>
        </div>
        <div class="kv"><span class="k">Fortificación</span><span class="v">{FORT_NAME[st.fort]}</span></div>
        {st.loyalty < 100 && <div class="kv"><span class="k">Lealtad</span><span class={cls('v', st.loyalty < 60 && 'bad')}>{Math.round(st.loyalty)}</span></div>}
        {civ.isPlayer && st.fort < 3 && (
          <div class="actions">
            <button class="btn small" disabled={!!canFortify(s, p, st)} onClick={() => ctrl.fortify(st.id)} title={canFortify(s, p, st) ?? ''}>
              <Icon name="shield" /> {FORT_NAME[nextFort]}
            </button>
            <span class="pills" style={{ marginTop: 0 }}><CostPills cost={fortCost(nextFort) as any} /></span>
          </div>
        )}
        {civ.isPlayer && <div class="muted" style={{ fontSize: 13, marginTop: 10 }}>La población ociosa recolecta alimento en las casillas libres. Construye vivienda antes de que llegue el hacinamiento.</div>}
      </>
    );
  } else if (t.b) {
    const def = BUILDING[t.b.type];
    title = def.name;
    kicker = `${BCAT_NAME[def.cat]}${owner ? ' · ' + (owner.isPlayer ? 'propio' : owner.name) : ''}`;
    const home = settlementById(s, t.b.sid);
    const y = home && owner ? buildingYield(def, placeCtx(s, owner, home, c, r)) : null;
    const building = t.b.progress < 1;
    const upgrades = BUILDINGS.filter((b) => b.upgradeOf === def.id);
    const hc = building ? hurryCost(s, p, c, r) : 0;
    body = (
      <>
        <div class="desc muted" style={{ fontSize: 14 }}>{def.desc}</div>
        {building ? (
          <div style={{ marginTop: 10 }}>
            <div class="kv"><span class="k">En construcción</span><span class="v">{Math.round(t.b.progress * 100)}%</span></div>
            <div class="bar"><i style={{ width: `${t.b.progress * 100}%`, background: 'var(--gold)' }} /></div>
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {def.jobs > 0 && <div class="kv"><span class="k">Trabajadores</span><span class={cls('v', t.b.staff < def.jobs && 'bad')}>{fmt(t.b.staff)} / {def.jobs}{t.b.paused ? ' (en pausa)' : ''}</span></div>}
            {y && Object.entries(y.out).map(([k, v]) => (
              <div class="kv" key={k}><span class="k">{RES_NAME[k as YieldId]} (plantilla completa)</span><span class="v good">+{fmt((v as number) * y.mult)}</span></div>
            ))}
            {def.input && Object.entries(def.input).map(([k, v]) => (
              <div class="kv" key={k}><span class="k">Consume {RES_NAME[k as YieldId]}</span><span class="v bad">−{fmt(v as number)}</span></div>
            ))}
            {def.housing && <div class="kv"><span class="k">Vivienda</span><span class="v">+{def.housing}</span></div>}
            {def.stability && <div class="kv"><span class="k">Estabilidad</span><span class="v">+{def.stability}</span></div>}
            {def.health && <div class="kv"><span class="k">Salud</span><span class="v">{sgn(def.health, 1)}</span></div>}
            {def.storage && <div class="kv"><span class="k">Almacén de comida</span><span class="v">+{def.storage}</span></div>}
            {def.upkeep && <div class="kv"><span class="k">Mantenimiento</span><span class="v bad">−{def.upkeep} oro</span></div>}
            {y && y.bonuses.length > 0 && (
              <div class="pills">
                {y.bonuses.map((b, i) => (
                  <span key={i} class={cls('pill', (b.mult ?? 0) < 0 ? 'bad' : 'good')}>{b.label}{b.mult ? ` ${b.mult > 0 ? '+' : ''}${Math.round(b.mult * 100)}%` : ''}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {mine && (
          <div class="actions">
            {building && <button class="btn small" disabled={p.res.gold < hc} onClick={() => ctrl.hurryBuilding(c, r)}><Icon name="hourglass" /> Acelerar · {fmt(hc)} oro</button>}
            {!building && def.jobs > 0 && <button class="btn ghost small" onClick={() => ctrl.pauseBuilding(c, r)}>{t.b.paused ? 'Reanudar' : 'Pausar'}</button>}
            {!building && upgrades.map((u) => {
              const why = canBuildAt(s, p, u, c, r);
              const cost = buildCost(s, p, u);
              return (
                <button key={u.id} class="btn small accent" disabled={!!why || !canAfford(p, cost)} title={why ?? ''} onClick={() => ctrl.upgrade(c, r, u.id)}>
                  <Icon name="up" /> {u.name}
                </button>
              );
            })}
            {!def.wonder && (confirmDel ? (
              <button class="btn small" style={{ background: 'var(--bad)' }} onClick={() => { ctrl.cancelBuilding(c, r); setConfirmDel(false); }}>{building ? 'Cancelar obra (recuperas 50%)' : 'Confirmar demolición'}</button>
            ) : (
              <button class="btn ghost small" onClick={() => setConfirmDel(true)}><Icon name="trash" /> {building ? 'Cancelar' : 'Demoler'}</button>
            ))}
          </div>
        )}
        {mine && !building && upgrades.length > 0 && (
          <div class="pills">{upgrades.map((u) => <span key={u.id} class="muted" style={{ fontSize: 12.5 }}>{u.name}: <CostPills cost={buildCost(s, p, u)} /></span>)}</div>
        )}
      </>
    );
  } else if (mine && isLand(t) || (mine && (t.biome === 'coast' || t.biome === 'lake'))) {
    // sugerencias de construcción
    const home = settlementById(s, t.sid);
    const opts = home
      ? BUILDINGS.filter((b) => !b.upgradeOf && !canBuildAt(s, p, b, c, r)).map((b) => {
          const y = buildingYield(b, placeCtx(s, p, home, c, r));
          let v = 0;
          for (const n of Object.values(y.out)) v += n as number;
          return { b, y, v: v * y.mult };
        }).sort((a, b) => b.v - a.v)
      : [];
    body = (
      <>
        {opts.length ? <div class="eyebrow" style={{ marginBottom: 6 }}>Construir aquí</div> : <div class="muted">No se puede construir nada aquí todavía.</div>}
        {opts.slice(0, 6).map(({ b, y }) => {
          const cost = buildCost(s, p, b);
          const ok = canAfford(p, cost);
          return (
            <button key={b.id} class={cls('card click', !ok && 'locked')} onClick={() => { ctrl.buildType = b.id; ctrl.tryBuild(c, r); }}>
              <div class="row" style={{ justifyContent: 'space-between' }}>
                <h4>{b.name}</h4>
                <span class="pills" style={{ marginTop: 0 }}>
                  {Object.entries(y.out).map(([k, v]) => (
                    <span key={k} class="pill good"><Icon name={k} style={{ color: RES_COLOR[k] }} />+{fmt((v as number) * y.mult)}</span>
                  ))}
                  {b.housing ? <span class="pill good"><Icon name="pop" />+{b.housing}</span> : null}
                </span>
              </div>
              <div class="pills"><CostPills cost={cost} />{b.jobs > 0 && <span class="pill"><Icon name="pop" /> {b.jobs} empleos</span>}</div>
            </button>
          );
        })}
      </>
    );
  } else {
    const why = canColonize(s, p, c, r);
    const showColony = isLand(t) && t.owner !== p.id && why !== 'El terreno no es apto';
    body = (
      <>
        {owner && !owner.isPlayer && <div class="row" style={{ gap: 8, display: 'flex', alignItems: 'center' }}><Emblem index={owner.emblem} color={owner.color} color2={owner.color2} size={22} /><span>{owner.name}</span></div>}
        {showColony && (
          <div style={{ marginTop: 8 }}>
            <button class="btn small accent" disabled={!!why} onClick={() => ctrl.tryColony(c, r)}><Icon name="flag" /> Fundar asentamiento</button>
            <div class="pills"><CostPills cost={colonyCost(s, p)} /><span class="pill"><Icon name="pop" /> 18 colonos</span></div>
            {why && <div class="muted" style={{ fontSize: 13, marginTop: 6 }}>{why}</div>}
          </div>
        )}
      </>
    );
  }

  return (
    <aside class="tilecard" aria-label={title}>
      <div class="head">
        {owner && <Emblem index={owner.emblem} color={owner.color} color2={owner.color2} size={30} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div class="eyebrow">{kicker}</div>
          <h3>{title}</h3>
          <div class="muted" style={{ fontSize: 13 }}>
            {st || t.b ? tileName(t) : ''}
            {depVisible && <span> · {dep!.name}</span>}
          </div>
        </div>
        <button class="close" onClick={close} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <div class="body scroll">
        {depVisible && !t.b && !st && <div class="muted" style={{ fontSize: 13.5, marginBottom: 8 }}>{dep!.desc}</div>}
        {body}
      </div>
    </aside>
  );
}
