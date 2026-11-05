import { useState } from 'preact/hooks';
import { ctrl } from '../../game/controller';
import { Icon, RES_COLOR } from '../Icon';
import { civSettlements } from '../../sim/world';
import { marketPrices } from '../../sim/actions';
import { settlementDefense, FORT_NAME } from '../../sim/war';
import { militaryTier } from '../../sim/economy';
import { RES_TITLE } from '../../sim/names';
import { fmt, sgn, cls } from '../util';
import type { ResId } from '../../sim/types';
import { PanelShell } from './PanelShell';
import { UnitIcon } from '../UnitCard';
import { UNIT } from '../../data/units';

export function CitiesPanel() {
  const [tab, setTab] = useState('cities');
  const s = ctrl.state;
  const p = ctrl.player;
  const sets = civSettlements(s, p.id).sort((a, b) => Number(b.capital) - Number(a.capital) || b.pop - a.pop);
  const tier = militaryTier(s, p);
  const myUnits = (s.units ?? []).filter((u) => u.civ === p.id);
  return (
    <PanelShell title="Territorio" sub="Tus asentamientos, su gente y el mercado." tabs={[{ id: 'cities', label: 'Asentamientos' }, { id: 'market', label: 'Mercado' }, { id: 'army', label: 'Ejército' }]} tab={tab} onTab={setTab}>
      {tab === 'cities' && sets.map((st) => {
        const idle = Math.max(0, st.workforce - st.employed);
        const crowd = st.pop / Math.max(1, st.housing);
        return (
          <button key={st.id} class="card click" onClick={() => ctrl.focusSettlement(st.id)}>
            <div class="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div class="eyebrow">{st.capital ? 'Capital' : `Fundada en el año ${st.founded}`}</div>
                <h4>{st.name}</h4>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 18 }} class="num">{fmt(st.pop)}</div>
                <div class={cls('num', st.growth >= 0 ? 'good' : 'bad')} style={{ fontSize: 13 }}>{sgn(st.growth, 1)}/año</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div class="kv"><span class="k">Vivienda</span><span class={cls('v', crowd > 1 && 'bad')}>{fmt(st.pop)} / {fmt(st.housing)}</span></div>
              <div class="bar"><i style={{ width: `${Math.min(100, crowd * 100)}%`, background: crowd > 1 ? 'var(--bad)' : crowd > 0.85 ? 'var(--gold)' : 'var(--good)' }} /></div>
            </div>
            <div class="pills">
              <span class="pill"><Icon name="pop" />{fmt(st.employed)} empleados</span>
              {idle > 1 && <span class="pill">{fmt(idle)} recolectores</span>}
              {st.jobs > st.workforce + 1 && <span class="pill bad">{fmt(st.jobs - st.workforce)} puestos vacíos</span>}
              <span class={cls('pill', st.health < 0 ? 'bad' : 'good')}><Icon name="health" />{sgn(st.health, 1)}</span>
              <span class="pill"><Icon name="shield" />{FORT_NAME[st.fort]}</span>
              {st.unrest > 20 && <span class="pill bad">Malestar {Math.round(st.unrest)}</span>}
            </div>
          </button>
        );
      })}
      {tab === 'market' && <Market />}
      {tab === 'army' && (
        <>
          <div class="card">
            <div class="grid2">
              <div class="kv"><span class="k">Guarnición</span><span class="v">{fmt(p.garrison ?? 0)}</span></div>
              <div class="kv"><span class="k">Fuerza</span><span class="v">{fmt(p.strength)}</span></div>
            </div>
            <div class="kv"><span class="k">Armamento</span><span class="v">{tier.label} (×{tier.mult})</span></div>
            <div class="kv"><span class="k">Cansancio de guerra</span><span class={cls('v', p.warWeariness > 10 && 'bad')}>{Math.round(p.warWeariness)}</span></div>
            <div class="muted" style={{ fontSize: 13, marginTop: 8 }}>Los soldados son trabajadores de campamentos, cuarteles y establos. El bronce y el hierro multiplican su fuerza, pero solo si tienes cobre o hierro (propio o por comercio).</div>
          </div>
          <div class="card">
            <div class="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h4>Postura en guerra</h4>
                <div class="desc">{p.flags.defensive ? 'Defensiva: tus tropas no lanzan ataques.' : 'Ofensiva: tus ejércitos atacan la ciudad enemiga más cercana.'}</div>
              </div>
              <button class="btn small" onClick={() => ctrl.toggleDefensive()}>{p.flags.defensive ? 'Pasar a ofensiva' : 'Pasar a defensiva'}</button>
            </div>
          </div>
          <span class="eyebrow" style={{ display: 'block', margin: '16px 0 8px' }}>Regimientos ({myUnits.length})</span>
          {!myUnits.length && <div class="muted" style={{ fontSize: 13.5 }}>No tienes tropas en campaña. Recluta desde la ficha de cualquier ciudad (tócala en el mapa).</div>}
          {myUnits.map((u) => (
            <button key={u.id} class="unit-row" onClick={() => { ctrl.selectUnits([u.id]); ctrl.renderer.centerOn(u.col, u.row); ctrl.panel = null; }}>
              <UnitIcon type={u.type} color={p.color} color2={p.color2} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div class="row" style={{ justifyContent: 'space-between' }}><b>{UNIT[u.type].name}</b><span class="muted" style={{ fontSize: 12.5 }}>{u.name}</span></div>
                <div class="bar" style={{ marginTop: 4, height: 6 }}><i style={{ width: `${Math.max(0, u.hp)}%`, background: u.hp > 60 ? 'var(--good)' : u.hp > 30 ? 'var(--gold)' : 'var(--bad)' }} /></div>
              </div>
            </button>
          ))}
          <span class="eyebrow" style={{ display: 'block', margin: '16px 0 8px' }}>Defensa por asentamiento</span>
          {sets.map((st) => (
            <div class="kv" key={st.id}><span class="k">{st.name}</span><span class="v">{fmt(settlementDefense(s, p, st))}</span></div>
          ))}
        </>
      )}
    </PanelShell>
  );
}

function Market() {
  const p = ctrl.player;
  const prices = marketPrices(p);
  const coin = p.techs.includes('currency');
  return (
    <>
      <div class="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>{coin ? 'Con la moneda, el comercio es más justo.' : 'Sin moneda solo hay trueque: los intermediarios se quedan con buena parte. La Moneda mejora los precios.'}</div>
      {(Object.keys(prices) as ResId[]).map((r) => (
        <div class="card" key={r}>
          <div class="row" style={{ justifyContent: 'space-between' }}>
            <div class="row">
              <Icon name={r} size={22} style={{ color: RES_COLOR[r] }} />
              <div>
                <h4>{RES_TITLE[r]}</h4>
                <div class="muted num" style={{ fontSize: 12.5 }}>Tienes {fmt(p.res[r])} · compra {prices[r].buy} · venta {prices[r].sell}</div>
              </div>
            </div>
          </div>
          <div class="pills">
            {[10, 50].map((n) => (
              <button key={'b' + n} class="btn small ghost" disabled={p.res.gold < Math.ceil(prices[r].buy * n)} onClick={() => ctrl.trade(r, n)}>Comprar {n} · {Math.ceil(prices[r].buy * n)} oro</button>
            ))}
            {[10, 50].map((n) => (
              <button key={'s' + n} class="btn small ghost" disabled={p.res[r] < n} onClick={() => ctrl.trade(r, -n)}>Vender {n}</button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
