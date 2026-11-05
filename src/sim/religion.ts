// Religiones: se fundan con fe, eligen doctrinas y se difunden de ciudad en ciudad.
import type { Civ, GameState, ModFx } from './types';
import { RNG } from '../core/rng';
import { civSettlements, tilesOfSettlement, capitalOf } from './world';
import { BUILDING } from '../data/buildings';
import { hexDistance } from '../core/hex';
import { queueEvent, fire, EVENT } from './events';
import { makeRoot } from '../data/names';
import { cultureOf } from './leaders';

import { DOCTRINES, DOCTRINE, type DoctrineDef } from '../data/doctrines';
export { DOCTRINES, DOCTRINE, type DoctrineDef };

export interface Religion { founder: number; name: string; doctrines: string[]; year: number }

export function religions(state: GameState): Religion[] {
  return ((state as any).religions ??= []) as Religion[];
}
export function religionOf(state: GameState, founder: number) {
  return religions(state).find((r) => r.founder === founder);
}

// Religión mayoritaria de una civilización (por población)
export function civReligion(state: GameState, civ: Civ): Religion | undefined {
  const tally = new Map<number, number>();
  for (const s of civSettlements(state, civ.id)) if (s.religion != null && s.religion >= 0) tally.set(s.religion, (tally.get(s.religion) ?? 0) + s.pop);
  let best = -1, bv = 0;
  for (const [k, v] of tally) if (v > bv) { bv = v; best = k; }
  return best >= 0 ? religionOf(state, best) : undefined;
}

export function faithIncome(state: GameState, civ: Civ) {
  let f = 0;
  for (const s of civSettlements(state, civ.id))
    for (const [, , t] of tilesOfSettlement(state, s)) {
      if (!t.b || t.b.progress < 1) continue;
      const id = t.b.type;
      if (id === 'shrine') f += 1;
      else if (id === 'temple') f += 2.5;
      else if (id === 'basilica') f += 5;
      else if (id === 'monument' || id === 'w_stones') f += 1;
      else if (id === 'w_cathedral') f += 8;
    }
  return f * (civ.factions.clergy > 60 ? 1.25 : 1);
}

export function foundCost(state: GameState) {
  return 40 + religions(state).length * 30;
}
export function maxReligions(state: GameState) {
  return Math.max(2, Math.ceil(state.civs.filter((c) => !c.minor).length * 0.7));
}

// Efectos de la religión sobre la civilización (para mods.ts)
export function religionFx(state: GameState, civ: Civ): { label: string; fx: ModFx }[] {
  const r = civReligion(state, civ);
  const out: { label: string; fx: ModFx }[] = [];
  if (r) {
    for (const d of r.doctrines) {
      const def = DOCTRINE[d];
      if (!def) continue;
      // los seguidores obtienen la mitad que el fundador
      const k = r.founder === civ.id ? 1 : 0.5;
      const fx: any = {};
      for (const [key, v] of Object.entries(def.fx)) fx[key] = typeof v === 'number' ? v * k : v;
      out.push({ label: `${r.name}: ${def.name}`, fx });
    }
    // ciudades con otra fe restan estabilidad (salvo tolerancia)
    if (!r.doctrines.includes('tolerant')) {
      const other = civSettlements(state, civ.id).filter((s) => s.religion != null && s.religion >= 0 && s.religion !== r.founder).length;
      if (other) out.push({ label: 'Ciudades de otra fe', fx: { stability: -2 * other } });
    }
  }
  // el fundador cobra un diezmo de los fieles extranjeros
  const mine = religionOf(state, civ.id);
  if (mine) {
    const foreign = state.settlements.filter((s) => s.religion === civ.id && s.civ !== civ.id).length;
    if (foreign) out.push({ label: `Fieles extranjeros de ${mine.name}`, fx: { influenceFlat: foreign * 0.4, cultureFlat: foreign * 0.8 } });
  }
  return out;
}

export function yearlyReligion(state: GameState, rng: RNG) {
  // fe acumulada y fundación
  for (const civ of state.civs) {
    if (!civ.alive || civ.minor) continue;
    civ.faithPts = (civ.faithPts ?? 0) + faithIncome(state, civ);
    const own = religionOf(state, civ.id);
    if (!own && civ.techs.includes('mysticism') && religions(state).length < maxReligions(state) && civ.faithPts >= foundCost(state) && !state.events.pending.some((p) => p.civ === civ.id && p.id === 'sys_religion')) {
      const name = `Fe de ${capitalize(makeRoot(rng, cultureOf(civ)))}`;
      civ.faithPts -= foundCost(state);
      const sid = capitalOf(state, civ.id)?.id ?? -1;
      if (civ.isPlayer) queueEvent(state, civ, 'sys_religion', sid, -1, { name, seed: rng.int(0, 1e9) });
      else fire(state, civ, EVENT.sys_religion, sid, -1, rng, { name, seed: rng.int(0, 1e9) });
    }
    // segunda doctrina (reforma)
    if (own && own.doctrines.length < 2 && civ.faithPts >= 120) {
      civ.faithPts -= 120;
      const sid = capitalOf(state, civ.id)?.id ?? -1;
      if (civ.isPlayer) queueEvent(state, civ, 'sys_reform', sid, -1, { seed: rng.int(0, 1e9) });
      else fire(state, civ, EVENT.sys_reform, sid, -1, rng, { seed: rng.int(0, 1e9) });
    }
  }
  // difusión: cada ciudad recibe presión de las fes cercanas
  const rels = religions(state);
  if (!rels.length) return;
  for (const s of state.settlements) {
    const pressure = new Map<number, number>();
    const owner = state.civs[s.civ];
    // edificios de fe propios empujan la fe del dueño
    const ownRel = civReligion(state, owner);
    let faithB = 0;
    for (const [, , t] of tilesOfSettlement(state, s)) if (t.b && t.b.progress >= 1 && BUILDING[t.b.type].cat === 'faith') faithB++;
    if (ownRel) pressure.set(ownRel.founder, (pressure.get(ownRel.founder) ?? 0) + 4 + faithB * 4);
    for (const o of state.settlements) {
      if (o === s || o.religion == null || o.religion < 0) continue;
      const d = hexDistance(o.col, o.row, s.col, s.row);
      if (d > 9) continue;
      const r = religionOf(state, o.religion);
      if (!r) continue;
      const spread = 1 + r.doctrines.reduce((a, x) => a + (DOCTRINE[x]?.spread ?? 0), 0);
      const tradeLink = owner.relations[o.civ]?.trade ? 1.5 : 1;
      pressure.set(o.religion, (pressure.get(o.religion) ?? 0) + ((o.pop / 40) * spread * tradeLink * (o.capital && o.civ === o.religion ? 2 : 1)) / (1 + d * 0.5));
    }
    s.relPressure ??= {};
    for (const [k, v] of pressure) s.relPressure[k] = (s.relPressure[k] ?? 0) * 0.9 + v;
    for (const k of Object.keys(s.relPressure)) if (!pressure.has(+k)) s.relPressure[+k] *= 0.9;
    let best = -1, bv = 0;
    for (const [k, v] of Object.entries(s.relPressure)) if (v > bv) { bv = v; best = +k; }
    const cur = s.religion ?? -1;
    const curV = cur >= 0 ? s.relPressure[cur] ?? 0 : 0;
    if (best >= 0 && best !== cur && bv > 12 && bv > curV * 1.35) {
      s.religion = best;
      const r = religionOf(state, best)!;
      const pl = state.civs[state.player];
      if (s.civ === pl.id || best === pl.id) state.chronicle.push({ year: state.year, civ: pl.id, kind: 'culture', text: `${s.name} abrazó la ${r.name}.` });
    }
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
