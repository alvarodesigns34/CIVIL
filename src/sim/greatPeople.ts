// Personajes ilustres: nacen de lo que tu pueblo cultiva (saber, arte, comercio, guerra, fe, obras).
import type { Civ, GameState } from './types';
import { RNG } from '../core/rng';
import { personName } from '../data/names';
import { cultureOf } from './leaders';
import { civSettlements, tilesOfSettlement, capitalOf } from './world';
import { BUILDING } from '../data/buildings';
import { queueEvent, fire, EVENT } from './events';

import { GP_TYPES, GP_INFO, type GPType } from '../data/greats';
export { GP_TYPES, GP_INFO, type GPType };

export function gpCost(civ: Civ) {
  const born = civ.greats?.length ?? 0;
  return Math.round(90 * Math.pow(1.45, born));
}

export function gpRates(state: GameState, civ: Civ): Record<GPType, number> {
  const L = civ.ledger;
  let faith = 0, wonders = 0;
  for (const s of civSettlements(state, civ.id))
    for (const [, , t] of tilesOfSettlement(state, s)) {
      if (!t.b || t.b.progress < 1) continue;
      const d = BUILDING[t.b.type];
      if (d.cat === 'faith') faith += 1 + (t.b.staff > 0 ? 1 : 0);
      if (d.wonder) wonders++;
    }
  const tradeGold = (L.income.gold?.['Rutas comerciales'] ?? 0) + (L.income.gold?.['Mercado'] ?? 0) + (L.income.gold?.['Puerto'] ?? 0) + (L.income.gold?.['Banco'] ?? 0);
  const atWar = Object.values(civ.relations).some((r) => r.state === 'war');
  return {
    scholar: Math.max(0, L.net.knowledge) * 0.2,
    artist: Math.max(0, L.net.culture) * 0.6 + wonders,
    merchant: tradeGold * 0.45 + (civ.techs.includes('currency') ? 1 : 0),
    general: civ.soldiers * 0.08 + (atWar ? 4 : 0),
    prophet: faith * 1.0 + (civ.factions.clergy > 65 ? 1.5 : 0),
    engineer: (Math.max(0, L.net.stone) + Math.max(0, L.net.wood) * 0.5) * 0.25 + wonders * 0.5,
  };
}

export function yearlyGreatPeople(state: GameState, civ: Civ, rng: RNG) {
  civ.gp ??= {};
  civ.greats ??= [];
  const rates = gpRates(state, civ);
  const cost = gpCost(civ);
  for (const t of GP_TYPES) {
    civ.gp[t] = (civ.gp[t] ?? 0) + rates[t];
    if (civ.gp[t] >= cost) {
      civ.gp[t] -= cost;
      const name = personName(rng, cultureOf(civ));
      civ.greats.push({ name, type: t, year: state.year });
      civ.legacy += 8;
      const sid = capitalOf(state, civ.id)?.id ?? -1;
      if (civ.isPlayer) queueEvent(state, civ, 'sys_great', sid, -1, { type: t, name });
      else fire(state, civ, EVENT.sys_great, sid, -1, rng, { type: t, name });
      state.chronicle.push({ year: state.year, civ: civ.id, kind: 'culture', important: civ.isPlayer, text: `Nació ${name}, ${GP_INFO[t].name.toLowerCase()} ilustre de los ${civ.people}.` });
      break; // como mucho uno por año
    }
  }
}

