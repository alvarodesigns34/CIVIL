// Estrategia mundial: ambiciones de la IA, coaliciones contra el más fuerte, vasallaje y herencias.
import type { Civ, GameState } from './types';
import { RNG } from '../core/rng';
import { civSettlements, capitalOf } from './world';
import { declareWar, addOpinionMod } from './diplomacy';
import { queueEvent } from './events';
import { legacyBreakdown } from '../data/ambitions';

export const GOAL_NAME: Record<string, string> = {
  expand: 'Expandirse por nuevas tierras',
  conquer: 'Conquistar a un vecino',
  science: 'Liderar el saber del mundo',
  wonder: 'Levantar maravillas eternas',
  trade: 'Enriquecerse con el comercio',
  faith: 'Difundir su fe',
};

function pickGoal(state: GameState, civ: Civ, rng: RNG): { goal: string; target?: number } {
  const p = civ.personality;
  const weights: Record<string, number> = {
    expand: p === 'expansionist' ? 4 : 1.5,
    conquer: p === 'aggressive' ? 4 : p === 'expansionist' ? 1.5 : p === 'peaceful' ? 0.2 : 0.8,
    science: p === 'scholarly' ? 4 : 1,
    wonder: p === 'pious' || p === 'scholarly' ? 2 : 1,
    trade: p === 'merchant' ? 4 : p === 'peaceful' ? 2 : 0.8,
    faith: p === 'pious' ? 4 : 0.6,
  };
  const goal = rng.weighted(Object.keys(weights), (k) => weights[k])!;
  if (goal === 'conquer') {
    // el vecino más débil que conozca
    const near = state.civs.filter((o) => o.alive && o.id !== civ.id && civ.relations[o.id]?.met && o.strength < civ.strength * 0.9);
    if (near.length) return { goal, target: rng.pick(near).id };
    return { goal: 'expand' };
  }
  return { goal };
}

export function yearlyStrategy(state: GameState, rng: RNG) {
  const majors = state.civs.filter((c) => c.alive && !c.minor);
  // ambiciones de la IA
  for (const civ of majors) {
    if (civ.isPlayer) continue;
    if (civ.flags.goalYear == null || state.year - civ.flags.goalYear > 35) {
      const g = pickGoal(state, civ, rng);
      civ.flags.goalYear = state.year;
      (civ as any).goal = g;
    }
    const g = (civ as any).goal as { goal: string; target?: number } | undefined;
    if (g?.goal === 'conquer' && g.target != null) {
      const t = state.civs[g.target];
      const r = civ.relations[g.target];
      // prepara la guerra y la declara cuando se siente fuerte
      if (t?.alive && r && r.state === 'peace' && r.truceUntil <= state.year && !(r.nap && r.nap > state.year) && !r.vassalOf && civ.strength > t.strength * 1.25 && state.year > (t.isPlayer ? 70 : 40) && rng.chance(0.06)) {
        declareWar(state, civ, t);
      }
    }
  }
  // vasallaje: tributo anual y rebeliones
  for (const v of majors) {
    for (const [oid, r] of Object.entries(v.relations)) {
      if (r.vassalOf == null || +oid !== r.vassalOf) continue;
      const lord = state.civs[+oid];
      if (!lord?.alive) { r.vassalOf = undefined; continue; }
      const tribute = Math.max(2, (v.ledger.net.gold > 0 ? v.ledger.net.gold : 0) * 0.25 + 2);
      v.res.gold = Math.max(0, v.res.gold - tribute);
      lord.res.gold += tribute;
      if (!v.isPlayer && v.strength > lord.strength * 1.05 && rng.chance(0.05)) {
        r.vassalOf = undefined;
        state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important: lord.isPlayer, text: `Los ${v.people} se alzaron contra sus señores ${lord.people}.` });
        declareWar(state, v, lord);
      }
    }
  }
  // coaliciones contra la potencia dominante
  if (majors.length >= 3 && state.year > 150 && state.year % 5 === 0) {
    const scored = majors.map((c) => ({ c, s: legacyBreakdown(state, c).total + c.strength * 0.5 })).sort((a, b) => b.s - a.s);
    const [top, second] = scored;
    if (top.s > second.s * 1.55) {
      const leader = top.c;
      const fearful = majors.filter((o) => o !== leader && !o.isPlayer && o.relations[leader.id]?.met && o.relations[leader.id].state !== 'alliance');
      for (const o of fearful) addOpinionMod(state, o, leader.id, 'hegemony', 'Teme su hegemonía', -18, 12);
      const ready = fearful.filter((o) => o.relations[leader.id].opinion < 0 && o.relations[leader.id].truceUntil <= state.year);
      if (ready.length >= 2 && state.year - (leader.flags.coalitionYear ?? -999) > 70 && rng.chance(0.25)) {
        leader.flags.coalitionYear = state.year;
        // se alían entre sí y declaran la guerra juntos
        for (const a of ready) for (const b of ready) if (a !== b) { a.relations[b.id].state = 'alliance'; a.relations[b.id].met = true; }
        state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important: true, text: `Se formó una coalición de ${ready.map((x) => `los ${x.people}`).join(', ')} contra los ${leader.people}.` });
        for (const a of ready) if (a.relations[leader.id].state !== 'war') declareWar(state, a, leader, 'coalición');
        if (leader.isPlayer) leader.flags.coalition = state.year;
      }
    }
  }
}

// Herencia dinástica: llamado cuando muere un líder casado con otra casa
export function inheritanceCheck(state: GameState, dead: Civ, rng: RNG) {
  for (const [oid, r] of Object.entries(dead.relations)) {
    if (!r.married) continue;
    const heirHouse = state.civs[+oid];
    if (!heirHouse?.alive || heirHouse.minor) continue;
    const sets = civSettlements(state, dead.id).filter((s) => !s.capital);
    if (!sets.length || dead.stability > 45 || !rng.chance(0.5)) continue;
    const target = rng.pick(sets);
    if (heirHouse.isPlayer) queueEvent(state, heirHouse, 'sys_inheritance', target.id, dead.id);
    else if (rng.chance(0.4)) {
      target.civ = heirHouse.id;
      target.capital = false;
      for (const t of state.tiles) if (t.sid === target.id) t.owner = heirHouse.id;
    }
    return;
  }
}

export function goalOf(civ: Civ): string | null {
  const g = (civ as any).goal as { goal: string; target?: number } | undefined;
  return g ? GOAL_NAME[g.goal] ?? null : null;
}
export { capitalOf };
