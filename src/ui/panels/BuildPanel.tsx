import { useState } from 'preact/hooks';
import { ctrl } from '../../game/controller';
import { Icon, RES_COLOR } from '../Icon';
import { BUILDINGS, BCAT_NAME, type BCat } from '../../data/buildings';
import { TECH } from '../../data/techs';
import { buildCost, canAfford, colonyCost, scoutCost, maxProjects, activeProjects, buildingUnlocked } from '../../sim/actions';
import { fmt, cls } from '../util';
import type { ResId } from '../../sim/types';
import { PanelShell } from './PanelShell';
import { Thumb } from '../Thumb';

const CATS: (BCat | 'all')[] = ['all', 'housing', 'food', 'materials', 'craft', 'faith', 'knowledge', 'civic', 'trade', 'military', 'wonder'];

export function BuildPanel() {
  const [cat, setCat] = useState<BCat | 'all'>('all');
  const s = ctrl.state;
  const p = ctrl.player;
  const list = BUILDINGS.filter((b) => (cat === 'all' ? b.cat !== 'wonder' : b.cat === cat) && !b.upgradeOf);
  list.sort((a, b) => Number(buildingUnlocked(p, b)) === Number(buildingUnlocked(p, a)) ? 0 : buildingUnlocked(p, a) ? -1 : 1);
  const cc = colonyCost(s, p);
  const sc = scoutCost(s, p);
  const proj = activeProjects(s, p), maxP = maxProjects(s, p);
  return (
    <PanelShell title="Construir" sub={`Obras en curso: ${proj} de ${maxP}. Cada edificio emplea a parte de tu gente.`}
      tabs={CATS.map((c) => ({ id: c, label: c === 'all' ? 'Todo' : BCAT_NAME[c] }))} tab={cat} onTab={(t) => setCat(t as any)}>
      {cat === 'all' && (
        <div class="section">
          <span class="eyebrow">Expansión</span>
          <div class="grid2">
            <button class={cls('card click', !canAfford(p, cc) && 'locked')} onClick={() => ctrl.enterColony()}>
              <div class="row"><Icon name="flag" size={20} /><h4>Fundar asentamiento</h4></div>
              <div class="desc">18 colonos parten hacia nuevas tierras.</div>
              <div class="pills">{Object.entries(cc).map(([r, v]) => <span key={r} class={cls('pill', p.res[r as ResId] < v && 'bad')}><Icon name={r} style={{ color: RES_COLOR[r] }} />{fmt(v)}</span>)}</div>
            </button>
            <button class={cls('card click', !canAfford(p, sc) && 'locked')} onClick={() => ctrl.enterScout()}>
              <div class="row"><Icon name="compass" size={20} /><h4>Exploradores</h4></div>
              <div class="desc">Revelan el mapa y encuentran otros pueblos.</div>
              <div class="pills"><span class={cls('pill', p.res.food < sc.food && 'bad')}><Icon name="food" style={{ color: RES_COLOR.food }} />{sc.food}</span></div>
            </button>
          </div>
        </div>
      )}
      <div class="section">
        {cat === 'all' && <span class="eyebrow">Edificios</span>}
        {list.map((b) => {
          const unlocked = buildingUnlocked(p, b);
          const cost = buildCost(s, p, b);
          const afford = canAfford(p, cost);
          const taken = b.wonder && s.wonders[b.id] != null;
          const sel = ctrl.buildType === b.id;
          return (
            <button key={b.id} class={cls('card click bcard', (!unlocked || taken) && 'locked', sel && 'sel')} disabled={!unlocked || taken} onClick={() => ctrl.enterBuild(b.id)}>
              <Thumb id={b.id} color={p.color} color2={p.color2} size={64} />
              <div class="bbody">
                <div class="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4>{b.name}</h4>
                  {b.jobs > 0 && <span class="pill" title="Empleos"><Icon name="pop" />{b.jobs}</span>}
                </div>
                <div class="desc">{b.desc}</div>
                <div class="pills">
                  {Object.entries(b.out ?? {}).map(([k, v]) => <span key={k} class="pill good"><Icon name={k} style={{ color: RES_COLOR[k] }} />+{fmt(v as number)}</span>)}
                  {b.input && Object.entries(b.input).map(([k, v]) => <span key={k} class="pill bad"><Icon name={k} style={{ color: RES_COLOR[k] }} />−{fmt(v as number)}</span>)}
                  {b.housing ? <span class="pill good"><Icon name="cities" />+{b.housing} hogar</span> : null}
                  {b.stability ? <span class="pill good"><Icon name="stability" />+{b.stability}</span> : null}
                  {b.health ? <span class={cls('pill', b.health > 0 ? 'good' : 'bad')}><Icon name="health" />{b.health > 0 ? '+' : ''}{b.health}</span> : null}
                  {b.soldiers ? <span class="pill accent"><Icon name="sword" />soldados</span> : null}
                  {b.upkeep ? <span class="pill bad"><Icon name="gold" />−{b.upkeep}/año</span> : null}
                </div>
                <div class="pills cost">
                  {unlocked ? (
                    <>
                      {Object.entries(cost).map(([r, v]) => <span key={r} class={cls('pill', p.res[r as ResId] < (v as number) && 'bad')}><Icon name={r} style={{ color: RES_COLOR[r] }} />{fmt(v as number)}</span>)}
                      <span class="pill"><Icon name="hourglass" />{b.time} año{b.time > 1 ? 's' : ''}</span>
                      {!afford && <span class="pill bad">Faltan recursos</span>}
                    </>
                  ) : (
                    <span class="pill accent"><Icon name="tech" />Requiere {TECH[b.tech!].name}</span>
                  )}
                  {taken && <span class="pill bad">Construida por {s.civs[s.wonders[b.id]].name}</span>}
                </div>
                <div class="place">{b.placeText}</div>
              </div>
            </button>
          );
        })}
      </div>
    </PanelShell>
  );
}
