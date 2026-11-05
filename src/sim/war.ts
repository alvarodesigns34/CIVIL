// Guerra abstracta: ejércitos que marchan, asedios, batallas, saqueos y conquistas.
import type { Civ, GameState, Settlement } from './types';
import { RNG } from '../core/rng';
import { civSettlements, capitalOf, settlementById, tilesOfSettlement, claimTiles, tileAt } from './world';
import { hexDistance, hexesInRange } from '../core/hex';
import { BUILDING } from '../data/buildings';
import { makePeace, acceptPeace, addOpinionMod } from './diplomacy';
import { queueEvent } from './events';

export const FORT_NAME = ['Sin murallas', 'Empalizada', 'Murallas de piedra', 'Castillo'];
export const FORT_TECH = [null, null, 'masonry', 'castles'];
export function fortCost(level: number) {
  return [{}, { wood: 30 }, { stone: 70, wood: 20 }, { stone: 160, gold: 80 }][level] as Record<string, number>;
}

export function settlementDefense(state: GameState, civ: Civ, s: Settlement) {
  const share = civ.strength * (s.capital ? 0.35 : 0.2);
  const militia = s.pop * 0.05;
  return Math.round((share + militia + 4) * (1 + s.fort * 0.5));
}

function enemiesOf(state: GameState, civ: Civ) {
  return state.civs.filter((o) => o.alive && o.id !== civ.id && civ.relations[o.id]?.state === 'war');
}

export function yearlyWar(state: GameState, rng: RNG) {
  // Avance de ejércitos
  for (const ar of [...state.armies]) {
    const target = settlementById(state, ar.target);
    const att = state.civs[ar.civ];
    if (!target || !att.alive || target.civ === ar.civ || att.relations[target.civ]?.state !== 'war') {
      state.armies = state.armies.filter((x) => x !== ar);
      continue;
    }
    const from = settlementById(state, ar.from);
    const dist = from ? hexDistance(from.col, from.row, target.col, target.row) : 8;
    ar.t += Math.min(1, 6 / Math.max(3, dist));
    if (ar.t >= 1) {
      resolveBattle(state, ar, target, rng);
      state.armies = state.armies.filter((x) => x !== ar);
    }
  }
  // Nuevas campañas
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    const enemies = enemiesOf(state, civ);
    if (!enemies.length) {
      civ.warWeariness = Math.max(0, civ.warWeariness - 1.5);
      continue;
    }
    civ.warWeariness = Math.min(40, civ.warWeariness + 1.2);
    if (state.armies.some((a) => a.civ === civ.id)) continue;
    if (civ.strength < 6) continue;
    // Objetivo: asentamiento enemigo más cercano
    let best: { s: Settlement; from: Settlement; d: number } | null = null;
    for (const e of enemies)
      for (const ts of civSettlements(state, e.id))
        for (const fs of civSettlements(state, civ.id)) {
          const d = hexDistance(fs.col, fs.row, ts.col, ts.row);
          if (!best || d < best.d) best = { s: ts, from: fs, d };
        }
    if (!best || best.d > 22) continue;
    const def = settlementDefense(state, state.civs[best.s.civ], best.s);
    const str = civ.strength * 0.7;
    const kind = str > def * 0.75 ? 'army' : 'raid';
    // La IA prudente no ataca si es muy inferior
    if (!civ.isPlayer && str < def * 0.35 && rng.chance(0.6)) continue;
    if (civ.isPlayer && civ.flags.defensive) continue;
    state.armies.push({ id: state.nextId++, civ: civ.id, target: best.s.id, from: best.from.id, strength: Math.round(str), t: 0, kind });
  }
  // Tratados de paz entre IA o propuestas al jugador
  for (const a of state.civs) {
    if (!a.alive) continue;
    for (const b of enemiesOf(state, a)) {
      if (b.id < a.id && !a.isPlayer && !b.isPlayer) continue;
      const r = a.relations[b.id];
      const years = state.year - r.warStart;
      if (years < 4) continue;
      if (a.isPlayer || b.isPlayer) {
        const ai = a.isPlayer ? b : a;
        const pl = a.isPlayer ? a : b;
        const rAi = ai.relations[pl.id];
        if (!state.events.pending.some((p) => p.id === 'sys_peace_offer') && rng.chance(0.12 + Math.max(0, -rAi.warScore) / 250 + ai.warWeariness / 200)) {
          const tribute = rAi.warScore < -30 ? Math.round(20 + ai.res.gold * 0.3) : rAi.warScore > 40 ? -Math.round(20 + pl.res.gold * 0.25) : 0;
          queueEvent(state, pl, 'sys_peace_offer', capitalOf(state, pl.id)?.id ?? -1, ai.id, { tribute });
        }
        continue;
      }
      if (rng.chance(acceptPeace(state, a, b, 0) * 0.35)) makePeace(state, a, b, 0);
    }
  }
}

function resolveBattle(state: GameState, ar: { civ: number; strength: number; kind: string; target: number }, target: Settlement, rng: RNG) {
  const att = state.civs[ar.civ];
  const def = state.civs[target.civ];
  const atkStr = Math.max(1, att.strength * 0.7) * rng.range(0.75, 1.25);
  const defStr = settlementDefense(state, def, target) * rng.range(0.8, 1.2);
  const ra = att.relations[def.id];
  const rd = def.relations[att.id];
  const ratio = atkStr / Math.max(1, defStr);
  const loss = (c: Civ, frac: number) => {
    for (const s of civSettlements(state, c.id)) s.pop = Math.max(5, s.pop * (1 - frac));
  };
  const important = att.isPlayer || def.isPlayer;
  if (ar.kind === 'raid' && ratio < 1.3) {
    if (ratio > 0.7) {
      const food = Math.min(def.res.food, 15 + target.pop * 0.15);
      const gold = Math.min(def.res.gold, 10 + target.pop * 0.05);
      def.res.food -= food; def.res.gold -= gold;
      att.res.food += food * 0.7; att.res.gold += gold;
      ra.warScore = Math.min(100, ra.warScore + 6); rd.warScore = -ra.warScore;
      target.unrest = Math.min(100, target.unrest + 12);
      state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important, text: `Una partida de los ${att.people} saqueó los alrededores de ${target.name}.` });
    } else {
      ra.warScore = Math.max(-100, ra.warScore - 5); rd.warScore = -ra.warScore;
      loss(att, 0.01);
      state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important, text: `Los defensores de ${target.name} rechazaron una incursión de los ${att.people}.` });
    }
    return;
  }
  if (ratio >= 1) {
    target.siege++;
    loss(def, 0.012 + 0.01 * Math.min(2, ratio));
    loss(att, 0.006);
    ra.warScore = Math.min(100, ra.warScore + 10); rd.warScore = -ra.warScore;
    const decisive = ratio > 1.6 || target.siege >= 2;
    if (decisive) {
      conquer(state, att, target, rng);
      ra.warScore = Math.min(100, ra.warScore + 18); rd.warScore = -ra.warScore;
    } else {
      state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important, text: `Los ${att.people} vencieron a los ${def.people} ante ${target.name} y pusieron sitio a la ciudad.` });
    }
  } else {
    loss(att, 0.015);
    loss(def, 0.006);
    target.siege = 0;
    ra.warScore = Math.max(-100, ra.warScore - 10); rd.warScore = -ra.warScore;
    def.modifiers = def.modifiers.filter((m) => m.id !== 'victory');
    def.modifiers.push({ id: 'victory', name: 'Victoria defensiva', until: state.year + 4, fx: { stability: 4, faction: { warriors: 8 } }, good: true });
    state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important, text: `El ejército de los ${att.people} fue derrotado ante las murallas de ${target.name}.` });
    if (rng.chance(0.06) && !att.isPlayer) {
      // el líder enemigo cae en batalla — raro
    }
  }
}

export function conquer(state: GameState, att: Civ, s: Settlement, rng: RNG) {
  const def = state.civs[s.civ];
  const important = att.isPlayer || def.isPlayer;
  const wasCapital = s.capital;
  s.pop *= 0.75;
  s.siege = 0;
  const loot = Math.min(def.res.gold, 20 + def.res.gold * 0.25);
  def.res.gold -= loot;
  att.res.gold += loot;
  // destrucción parcial
  for (const [, , t] of tilesOfSettlement(state, s)) {
    if (t.b && !BUILDING[t.b.type].wonder && rng.chance(0.2)) t.b = null;
  }
  // transferencia
  if (civSettlements(state, def.id).length <= 1) {
    s.civ = att.id;
    s.capital = false;
  } else {
    s.civ = att.id;
    s.capital = false;
    if (wasCapital) {
      const next = civSettlements(state, def.id).sort((a, b) => b.pop - a.pop)[0];
      if (next) next.capital = true;
      def.modifiers.push({ id: 'lostcapital', name: 'Capital perdida', until: state.year + 20, fx: { stability: -12, legitimacy: -2 }, good: false });
    }
  }
  s.loyalty = 25;
  s.unrest = 50;
  for (const [, , t] of tilesOfSettlement(state, s)) {
    t.owner = att.id;
    if (t.b && state.wonders[t.b.type] === def.id) state.wonders[t.b.type] = att.id;
  }
  claimTiles(state, s);
  att.legacy += 15;
  addOpinionMod(state, def, att.id, `conq${s.id}`, `Nos arrebató ${s.name}`, -40, 80);
  state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important: true, text: `Los ${att.people} conquistaron ${s.name}, arrebatándosela a los ${def.people}.` });
  checkElimination(state, def, att);
}

export function checkElimination(state: GameState, def: Civ, by?: Civ) {
  if (civSettlements(state, def.id).length > 0 || !def.alive) return;
  def.alive = false;
  for (const o of state.civs) {
    const r = o.relations[def.id];
    if (r) { r.state = 'peace'; r.trade = false; }
  }
  state.armies = state.armies.filter((a) => a.civ !== def.id);
  state.chronicle.push({ year: state.year, civ: -1, kind: 'world', important: true, text: `Los ${def.people} desaparecieron de la historia${by ? `, sometidos por los ${by.people}` : ''}.` });
  if (def.isPlayer) state.gameOver = { won: false, reason: `Tu civilización ha caído${by ? ` ante los ${by.people}` : ''}.`, year: state.year };
}

export function ruinsRadius(state: GameState, s: Settlement) {
  return hexesInRange(s.col, s.row, s.radius).map(([c, r]) => tileAt(state, c, r)).filter(Boolean);
}
