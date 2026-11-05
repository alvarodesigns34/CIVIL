// Orquestador de la simulación anual.
import type { Civ, GameState } from './types';
import { RNG } from '../core/rng';
import { simulateEconomy, progressResearch, traditionCost } from './economy';
import { civEra, TECH, ERAS } from '../data/techs';
import { offerTraditions, advanceColonists } from './actions';
import { yearlyLeader } from './politics';
import { yearlyGreatPeople } from './greatPeople';
import { yearlyWar, checkElimination } from './war';
import { updateContacts, yearlyDiplomacy } from './diplomacy';
import { aiYear } from './ai';
import { rollEvents, queueEvent, fire, EVENT } from './events';
import { civSettlements, capitalOf, reveal, tilesOfSettlement, encodeExplored } from './world';
import { AMBITIONS, legacyBreakdown } from '../data/ambitions';

export const MAX_YEARS = 900;

export interface YearReport {
  techs: { civ: number; id: string }[];
  ambitions: string[];
  traditionReady: boolean;
}

export function yearTick(state: GameState): YearReport {
  const rng = new RNG(state.rng);
  const report: YearReport = { techs: [], ambitions: [], traditionReady: false };
  const player = state.civs[state.player];

  for (const civ of state.civs) {
    if (!civ.alive) continue;
    const eraBefore = civEra(civ.techs);
    simulateEconomy(state, civ);

    // Investigación
    const got = progressResearch(state, civ);
    if (got) {
      report.techs.push({ civ: civ.id, id: got });
      if (state.stats.techsFirst[got] == null) {
        state.stats.techsFirst[got] = civ.id;
        civ.legacy += 3;
      }
      if (civ.isPlayer) state.chronicle.push({ year: state.year, civ: civ.id, kind: 'tech', text: `Los ${civ.people} descubrieron ${TECH[got].name}.` });
      if (got === 'pottery' || got === 'agriculture') {} // sin efectos inmediatos
      if (got === 'cartography' && civ.isPlayer) for (const o of state.civs) if (o.alive) { const c = capitalOf(state, o.id); if (c) reveal(state, c.col, c.row, 3); }
      if (TECH[got].final) {
        civ.legacy += 200;
        state.chronicle.push({ year: state.year, civ: -1, kind: 'world', important: true, text: `Los ${civ.people} construyeron la primera máquina de vapor. El mundo nunca volverá a ser igual.` });
        state.gameOver = civ.isPlayer
          ? { won: true, reason: 'Tu civilización ha cruzado el umbral industrial antes que nadie.', year: state.year }
          : { won: false, reason: `Los ${civ.people} han cruzado primero el umbral industrial.`, year: state.year };
      }
    }
    const eraAfter = civEra(civ.techs);
    if (eraAfter > eraBefore) {
      state.chronicle.push({ year: state.year, civ: civ.id, kind: 'culture', important: civ.isPlayer, text: `Los ${civ.people} entraron en la ${ERAS[eraAfter].name}.` });
      if (civ.isPlayer) queueEvent(state, civ, 'sys_era', capitalOf(state, civ.id)?.id ?? -1, -1, { era: eraAfter });
      else fire(state, civ, EVENT.sys_era, capitalOf(state, civ.id)?.id ?? -1, -1, rng, { era: eraAfter });
    }

    // Tradiciones
    if (!civ.traditionOffer && civ.culturePts >= traditionCost(civ)) {
      civ.culturePts -= traditionCost(civ);
      civ.traditionOffer = offerTraditions(civ, rng, eraAfter);
      if (!civ.traditionOffer.length) civ.traditionOffer = null;
      if (civ.isPlayer && civ.traditionOffer) report.traditionReady = true;
    }

    yearlyLeader(state, civ, rng);
    yearlyGreatPeople(state, civ, rng);
    civ.modifiers = civ.modifiers.filter((m) => m.until > state.year);

    // Hambruna del jugador
    if (civ.isPlayer && (civ.ledger as any).famine > 0) {
      const key = `${civ.id}:sys_famine`;
      if (state.events.cooldown[key] == null || state.year - state.events.cooldown[key] > 12) {
        state.events.cooldown[key] = state.year;
        queueEvent(state, civ, 'sys_famine', capitalOf(state, civ.id)?.id ?? -1);
      }
    }
    // Revolución por caos prolongado
    if (civ.stability < 12) civ.collapseYears++;
    else civ.collapseYears = Math.max(0, civ.collapseYears - 1);
    if (civ.collapseYears >= 6) {
      civ.collapseYears = 0;
      const sid = capitalOf(state, civ.id)?.id ?? -1;
      if (civ.isPlayer) queueEvent(state, civ, 'sys_revolt', sid, -1, { seed: rng.int(0, 1e9) });
      else fire(state, civ, EVENT.sys_revolt, sid, -1, rng, { seed: rng.int(0, 1e9) });
    }

    // Asentamientos abandonados
    for (const s of civSettlements(state, civ.id)) {
      if (s.pop < 4) {
        for (const [, , t] of tilesOfSettlement(state, s)) { t.owner = -1; t.sid = -1; if (t.b) t.b = null; }
        state.settlements = state.settlements.filter((x) => x !== s);
        state.chronicle.push({ year: state.year, civ: civ.id, kind: 'disaster', important: civ.isPlayer, text: `${s.name} quedó abandonada.` });
        if (s.capital) { const n = civSettlements(state, civ.id)[0]; if (n) n.capital = true; }
      }
    }
    checkElimination(state, civ);

    if (state.year % 5 === 0) {
      civ.history.push({ y: state.year, pop: Math.round(civSettlements(state, civ.id).reduce((a, s) => a + s.pop, 0)), str: civ.strength, know: civ.techs.length });
      if (civ.history.length > 200) civ.history.shift();
    }
  }

  advanceColonists(state, rng);
  yearlyWar(state, rng);
  updateContacts(state, rng);
  yearlyDiplomacy(state, rng);
  for (const civ of state.civs) if (civ.alive && !civ.isPlayer) aiYear(state, civ, rng);
  for (const civ of state.civs) if (civ.alive) rollEvents(state, civ, rng);

  // Ambiciones
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    for (const a of AMBITIONS) {
      if (civ.ambitionsDone.includes(a.id)) continue;
      const [v, max] = a.progress(state, civ);
      if (v >= max) {
        civ.ambitionsDone.push(a.id);
        civ.legacy += a.legacy;
        if (civ.isPlayer) {
          report.ambitions.push(a.id);
          state.chronicle.push({ year: state.year, civ: civ.id, kind: 'culture', text: `Ambición cumplida: ${a.name}.` });
        }
      }
    }
  }

  // Fin por tiempo o conquista
  if (!state.gameOver) {
    const alive = state.civs.filter((c) => c.alive);
    if (alive.length === 1 && alive[0].isPlayer) state.gameOver = { won: true, reason: 'Tu civilización es la única que perdura.', year: state.year };
    else if (state.year >= MAX_YEARS) {
      const ranking = rankings(state);
      const won = ranking[0].civ.isPlayer;
      state.gameOver = { won, reason: won ? 'Tras nueve siglos, tu legado es el mayor del mundo.' : `Tras nueve siglos, el legado de los ${ranking[0].civ.people} supera al tuyo.`, year: state.year };
    }
  }

  if (state.chronicle.length > 1500) state.chronicle.splice(0, state.chronicle.length - 1200);
  state.year++;
  state.rng = rng.state;
  if (state.year % 4 === 0) encodeExplored(state);
  void player;
  return report;
}

export function rankings(state: GameState) {
  return state.civs
    .map((civ) => ({ civ, score: civ.alive ? legacyBreakdown(state, civ).total : Math.round(civ.legacy * 0.5) }))
    .sort((a, b) => b.score - a.score);
}

export function totalPop(state: GameState, civ: Civ) {
  return civSettlements(state, civ.id).reduce((a, s) => a + s.pop, 0);
}
