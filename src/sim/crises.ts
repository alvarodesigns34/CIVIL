// Grandes crisis mundiales: golpean a todos y obligan a adaptarse.
import type { GameState, Settlement } from './types';
import type { EventDef } from './eventTypes';
import { RNG } from '../core/rng';
import { civEra } from '../data/techs';
import { hexDistance } from '../core/hex';
import { capitalOf, civSettlements } from './world';
import { queueEvent, fire, EVENT } from './events';

export interface Crisis { id: string; start: number; until: number }
import { CRISIS_INFO } from '../data/crisisEvents';
export { CRISIS_INFO };

export function crises(state: GameState): Crisis[] {
  return ((state as any).crises ??= []) as Crisis[];
}
export function crisisActive(state: GameState, id: string) {
  return crises(state).some((c) => c.id === id && c.until > state.year);
}

export function yearlyCrises(state: GameState, rng: RNG) {
  const worldEra = Math.max(0, ...state.civs.filter((c) => c.alive && !c.minor).map((c) => civEra(c.techs)));
  const had = (id: string) => crises(state).some((c) => c.id === id);
  const start = (id: string, years: number) => {
    crises(state).push({ id, start: state.year, until: state.year + years });
    state.chronicle.push({ year: state.year, civ: -1, kind: 'world', important: true, text: `Comienza ${CRISIS_INFO[id].name.toLowerCase()}.` });
    for (const civ of state.civs) {
      if (!civ.alive || civ.minor) continue;
      const sid = capitalOf(state, civ.id)?.id ?? -1;
      if (civ.isPlayer) queueEvent(state, civ, 'sys_crisis', sid, -1, { kind: id });
      else fire(state, civ, EVENT.sys_crisis, sid, -1, rng, { kind: id });
    }
    if (id === 'plague') {
      const big = [...state.settlements].sort((a, b) => b.pop - a.pop)[rng.int(0, 2)];
      if (big) big.plague = 6;
    }
  };
  if (!had('migration') && worldEra >= 1 && state.year > 120 && rng.chance(0.03)) start('migration', 35);
  if (!had('bronze') && worldEra >= 2 && rng.chance(0.08)) start('bronze', 25);
  if (!had('plague') && worldEra >= 3 && rng.chance(0.03)) start('plague', 30);
  if (!had('ice') && worldEra >= 4 && rng.chance(0.025)) start('ice', 40);

  // efectos continuos
  if (crisisActive(state, 'migration')) {
    const camps = (state.camps ??= []);
    if (camps.length < 8 && rng.chance(0.25)) {
      // un campamento nuevo en tierra de nadie cerca del borde del mundo conocido
      for (let k = 0; k < 40; k++) {
        const c = rng.int(1, state.width - 2), r = rng.int(1, state.height - 2);
        const t = state.tiles[r * state.width + c];
        if (t.owner >= 0 || t.biome === 'snow' || t.elev === 2 || ['deep', 'ocean', 'coast', 'lake'].includes(t.biome)) continue;
        if (state.settlements.some((s) => hexDistance(s.col, s.row, c, r) < 5)) continue;
        camps.push({ id: state.nextId++, col: c, row: r, timer: rng.int(1, 4), level: worldEra + 1 });
        break;
      }
    }
  }
  if (crisisActive(state, 'plague')) {
    for (const s of state.settlements) {
      if (!s.plague || s.plague <= 0) continue;
      s.pop *= 0.965;
      s.unrest = Math.min(100, s.unrest + 2);
      s.plague--;
      if (s.plague === 0) s.immune = state.year + 40;
      // contagio
      for (const o of state.settlements) {
        if (o === s || (o.plague ?? 0) > 0 || (o.immune ?? 0) > state.year) continue;
        const near = hexDistance(o.col, o.row, s.col, s.row) <= 6;
        const trade = state.civs[o.civ]?.relations[s.civ]?.trade && (o.capital || s.capital);
        if (!near && !trade) continue;
        const quarantine = state.civs[o.civ]?.flags.quarantine && state.civs[o.civ].flags.quarantine > state.year;
        const p = (near ? 0.18 : 0.12) * (quarantine ? 0.25 : 1) * Math.max(0.3, 1 - o.health * 0.08);
        if (rng.chance(p)) {
          o.plague = 6;
          if (state.civs[o.civ].isPlayer) state.chronicle.push({ year: state.year, civ: o.civ, kind: 'disaster', important: true, text: `La plaga llegó a ${o.name}.` });
        }
      }
    }
  }
}

// Comida perdida por el frío (se aplica como modificador en mods.ts)
export function crisisFx(state: GameState) {
  const out: { label: string; fx: any }[] = [];
  if (crisisActive(state, 'ice')) out.push({ label: 'Pequeña edad de hielo', fx: { food: -0.1 } });
  return out;
}
export function bronzeFx(state: GameState, techs: string[]) {
  if (crisisActive(state, 'bronze') && !techs.includes('ironworking')) return [{ label: 'Colapso del bronce', fx: { trade: -0.5, metal: -0.2 } }];
  return [];
}

export type { Settlement };
