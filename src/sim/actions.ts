// Acciones compartidas por el jugador y la IA.
import type { Civ, GameState, ResId, Settlement } from './types';
import { BUILDING, BUILDINGS, type BuildingDef } from '../data/buildings';
import { placeCtx, foodStorage } from './economy';
import { tileAt, civSettlements, settlementById, canFoundAt, landPath, reveal, getExplored, inBounds } from './world';
import { isLand } from '../data/terrain';
import { hexDistance, hexesInRange } from '../core/hex';
import { fortCost, FORT_TECH } from './war';
import { RNG } from '../core/rng';
import { TRADITION } from '../data/politics';
import { foundSettlement } from './worldgen';

export function costMult(state: GameState, civ: Civ, def: BuildingDef) {
  // Cada asentamiento extra encarece ligeramente las maravillas; vivienda más barata con muchas chozas no.
  return 1;
}

export function buildCost(state: GameState, civ: Civ, def: BuildingDef): Partial<Record<ResId, number>> {
  const m = costMult(state, civ, def);
  const out: Partial<Record<ResId, number>> = {};
  for (const [k, v] of Object.entries(def.cost)) out[k as ResId] = Math.round((v as number) * m);
  return out;
}

export function canAfford(civ: Civ, cost: Partial<Record<ResId, number>>) {
  return Object.entries(cost).every(([k, v]) => civ.res[k as ResId] >= (v as number));
}

export function maxProjects(state: GameState, civ: Civ) {
  const pop = civSettlements(state, civ.id).reduce((a, s) => a + s.pop, 0);
  return 2 + Math.floor(pop / 160) + (civ.techs.includes('mathematics') ? 1 : 0) + (civ.techs.includes('engineering') ? 1 : 0);
}
export function activeProjects(state: GameState, civ: Civ) {
  let n = 0;
  for (const t of state.tiles) if (t.b && t.owner === civ.id && t.b.progress < 1) n++;
  return n;
}

export function buildingUnlocked(civ: Civ, def: BuildingDef) {
  return !def.tech || civ.techs.includes(def.tech);
}

// Comprueba si un edificio puede construirse en una casilla. Devuelve null si sí, o el motivo.
export function canBuildAt(state: GameState, civ: Civ, def: BuildingDef, col: number, row: number): string | null {
  const t = tileAt(state, col, row);
  if (!t) return 'Fuera del mapa';
  if (!buildingUnlocked(civ, def)) return 'Tecnología necesaria';
  if (t.owner !== civ.id || t.sid < 0) return 'Fuera de tu territorio';
  const s = settlementById(state, t.sid);
  if (!s) return 'Fuera de tu territorio';
  if (s.col === col && s.row === row) return 'Centro del asentamiento';
  if (def.upgradeOf) {
    if (t.b?.type !== def.upgradeOf || t.b.progress < 1) return `Debe mejorar: ${BUILDING[def.upgradeOf].name}`;
  } else if (t.b) return 'Casilla ocupada';
  if (def.wonder && state.wonders[def.id] != null) return 'Otra civilización ya la construyó';
  if (def.wonder) {
    for (const tt of state.tiles) if (tt.b?.type === def.id && tt.owner === civ.id) return 'Ya está en construcción';
  }
  if (def.perSettlement != null) {
    let n = 0;
    for (const tt of state.tiles) if (tt.b?.type === def.id && tt.sid === s.id) n++;
    if (n >= def.perSettlement) return `Máximo ${def.perSettlement} por asentamiento`;
  }
  if (def.perCiv != null) {
    let n = 0;
    for (const tt of state.tiles) if (tt.b?.type === def.id && tt.owner === civ.id) n++;
    if (n >= def.perCiv) return `Máximo ${def.perCiv} en tu civilización`;
  }
  if (def.needsDep) {
    const ok = def.needsDep.some((d) => civSettlements(state, civ.id).some((st) => hexesInRange(st.col, st.row, 4).some(([c, r]) => { const x = tileAt(state, c, r); return x?.owner === civ.id && x.dep === d; })));
    if (!ok) return 'Requiere caballos en tu territorio';
  }
  if (!def.place(placeCtx(state, civ, s, col, row))) return def.placeText;
  return null;
}

export function startBuild(state: GameState, civ: Civ, id: string, col: number, row: number): string | null {
  const def = BUILDING[id];
  const why = canBuildAt(state, civ, def, col, row);
  if (why) return why;
  const cost = buildCost(state, civ, def);
  if (!canAfford(civ, cost)) return 'Recursos insuficientes';
  if (activeProjects(state, civ) >= maxProjects(state, civ)) return `Máximo ${maxProjects(state, civ)} obras simultáneas`;
  for (const [k, v] of Object.entries(cost)) civ.res[k as ResId] -= v as number;
  const t = tileAt(state, col, row)!;
  if (def.upgradeOf) {
    t.b = { type: id, sid: t.sid, progress: 0, staff: 0, built: 0 };
  } else {
    t.b = { type: id, sid: t.sid, progress: 0, staff: 0, built: 0 };
    if (id === 'lumber' || id === 'hunters') { /* el bosque se mantiene */ }
    else if (t.feature === 'forest' && id !== 'shrine') {
      t.feature = 'none';
      civ.res.wood += 10; // madera de la tala
    }
  }
  if (def.wonder) state.chronicle.push({ year: state.year, civ: civ.id, kind: 'build', text: `Los ${civ.people} comenzaron a levantar ${def.name}.` });
  return null;
}

export function cancelBuild(state: GameState, civ: Civ, col: number, row: number) {
  const t = tileAt(state, col, row);
  if (!t?.b || t.owner !== civ.id) return;
  const def = BUILDING[t.b.type];
  if (t.b.progress < 1) {
    // devolver la mitad
    for (const [k, v] of Object.entries(def.cost)) civ.res[k as ResId] += Math.floor((v as number) * 0.5);
    t.b = def.upgradeOf ? { type: def.upgradeOf, sid: t.sid, progress: 1, staff: 0, built: state.year } : null;
  } else {
    t.b = null;
  }
}

export function togglePause(state: GameState, civ: Civ, col: number, row: number) {
  const t = tileAt(state, col, row);
  if (!t?.b || t.owner !== civ.id) return;
  t.b.paused = !t.b.paused;
}

// ───── Colonias ─────
export function colonyCost(state: GameState, civ: Civ) {
  const n = civSettlements(state, civ.id).length + state.colonists.filter((c) => c.civ === civ.id).length;
  return { food: 50 + n * 15, wood: 30 + n * 10, influence: 15 + n * 8 };
}
export const COLONY_POP = 18;

export function canColonize(state: GameState, civ: Civ, col: number, row: number): string | null {
  const why = canFoundAt(state, civ, col, row);
  if (why) return why;
  const cost = colonyCost(state, civ);
  if (!canAfford(civ, cost)) return 'Recursos insuficientes';
  const from = nearestOwn(state, civ, col, row);
  if (!from || from.pop < COLONY_POP + 25) return 'Ningún asentamiento cercano tiene población suficiente (mín. 43)';
  return null;
}

export function nearestOwn(state: GameState, civ: Civ, col: number, row: number): Settlement | undefined {
  let best: Settlement | undefined, bd = Infinity;
  for (const s of civSettlements(state, civ.id)) {
    const d = hexDistance(s.col, s.row, col, row);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function sendColonists(state: GameState, civ: Civ, col: number, row: number, rng: RNG): string | null {
  const why = canColonize(state, civ, col, row);
  if (why) return why;
  const cost = colonyCost(state, civ);
  for (const [k, v] of Object.entries(cost)) civ.res[k as ResId] -= v;
  const from = nearestOwn(state, civ, col, row)!;
  from.pop -= COLONY_POP;
  state.colonists.push({ id: state.nextId++, civ: civ.id, from: from.id, col, row, t: 0, pop: COLONY_POP, name: '' });
  return null;
}

export function advanceColonists(state: GameState, rng: RNG) {
  for (const c of [...state.colonists]) {
    const from = settlementById(state, c.from);
    const dist = from ? hexDistance(from.col, from.row, c.col, c.row) : 4;
    c.t += Math.min(1, 4 / Math.max(2, dist));
    if (c.t >= 1) {
      state.colonists = state.colonists.filter((x) => x !== c);
      const civ = state.civs[c.civ];
      const t = tileAt(state, c.col, c.row);
      if (!civ.alive || !t || (t.owner !== -1 && t.owner !== civ.id) || state.settlements.some((s) => hexDistance(s.col, s.row, c.col, c.row) < 3)) {
        if (from) from.pop += c.pop * 0.7;
        continue;
      }
      const s = foundSettlement(state, rng, civ, c.col, c.row, c.pop, false);
      state.chronicle.push({ year: state.year, civ: civ.id, kind: 'build', important: civ.isPlayer, text: `Colonos de los ${civ.people} fundaron ${s.name}.` });
      if (civ.isPlayer) reveal(state, c.col, c.row, s.radius + 3);
      civ.legacy += 10;
    }
  }
}

// ───── Exploración ─────
export function scoutCost(state: GameState, civ: Civ) {
  return { food: 15 + state.scouts.filter((s) => s.civ === civ.id).length * 10 };
}
export function sendScout(state: GameState, civ: Civ, col: number, row: number): string | null {
  if (state.scouts.filter((s) => s.civ === civ.id).length >= 2) return 'Ya hay dos expediciones en marcha';
  const cost = scoutCost(state, civ);
  if (!canAfford(civ, cost)) return 'Comida insuficiente';
  const from = nearestOwn(state, civ, col, row);
  if (!from) return 'Sin asentamientos';
  const allowWater = civ.techs.includes('sailing');
  const path = landPath(state, [from.col, from.row], [col, row], allowWater, 9000);
  if (!path) return allowWater ? 'No hay ruta posible' : 'No hay ruta por tierra (Navegación permite cruzar el mar)';
  civ.res.food -= cost.food;
  state.scouts.push({ id: state.nextId++, civ: civ.id, col: from.col, row: from.row, path, t: 0 });
  return null;
}

// Avance continuo de exploradores (en casillas por año)
export function advanceScouts(state: GameState, dtYears: number) {
  for (const sc of [...state.scouts]) {
    sc.t += dtYears * 6;
    const i = Math.min(sc.path.length - 1, Math.floor(sc.t));
    const [c, r] = sc.path[i];
    sc.col = c; sc.row = r;
    if (state.civs[sc.civ].isPlayer) reveal(state, c, r, 2);
    if (sc.t >= sc.path.length - 1) state.scouts = state.scouts.filter((x) => x !== sc);
  }
}

// ───── Murallas ─────
export function canFortify(state: GameState, civ: Civ, s: Settlement): string | null {
  if (s.fort >= 3) return 'Fortificación máxima';
  const tech = FORT_TECH[s.fort + 1];
  if (tech && !civ.techs.includes(tech)) return tech === 'masonry' ? 'Requiere Cantería' : 'Requiere Fortificación';
  if (!canAfford(civ, fortCost(s.fort + 1))) return 'Recursos insuficientes';
  return null;
}
export function fortify(state: GameState, civ: Civ, s: Settlement): string | null {
  const why = canFortify(state, civ, s);
  if (why) return why;
  for (const [k, v] of Object.entries(fortCost(s.fort + 1))) civ.res[k as ResId] -= v;
  s.fort++;
  return null;
}

// ───── Tradiciones ─────
export function offerTraditions(civ: Civ, rng: RNG, era: number) {
  const pool = Object.values(TRADITION).filter((t) => t.era <= era && !civ.traditions.includes(t.id));
  rng.shuffle(pool);
  // favorecer las de la era actual
  pool.sort((a, b) => b.era - a.era);
  const pick = pool.slice(0, 5);
  rng.shuffle(pick);
  return pick.slice(0, 3).map((t) => t.id);
}

export { BUILDINGS, isLand, getExplored, inBounds, foodStorage };

// ───── Mercado: compraventa con oro ─────
export const BASE_PRICE: Record<string, number> = { food: 0.8, wood: 1, stone: 1.3, metal: 2.6, goods: 2.2 };
export function marketPrices(civ: Civ) {
  const coin = civ.techs.includes('currency');
  const spread = coin ? 1.25 : 1.6; // sin moneda, trueque caro
  const out: Record<string, { buy: number; sell: number }> = {};
  for (const [k, v] of Object.entries(BASE_PRICE)) out[k] = { buy: +(v * spread).toFixed(2), sell: +(v / spread).toFixed(2) };
  return out;
}
export function marketTrade(state: GameState, civ: Civ, res: ResId, amount: number): string | null {
  const p = marketPrices(civ)[res];
  if (!p) return 'No se comercia';
  if (amount > 0) {
    const cost = Math.ceil(p.buy * amount);
    if (civ.res.gold < cost) return 'Oro insuficiente';
    civ.res.gold -= cost;
    civ.res[res] += amount;
  } else {
    const n = -amount;
    if (civ.res[res] < n) return 'No tienes suficiente';
    civ.res[res] -= n;
    civ.res.gold += Math.floor(p.sell * n);
  }
  return null;
}

// ───── Acelerar obras con oro ─────
export function hurryCost(state: GameState, civ: Civ, col: number, row: number): number {
  const t = tileAt(state, col, row);
  if (!t?.b || t.b.progress >= 1) return 0;
  const def = BUILDING[t.b.type];
  const base = Object.entries(def.cost).reduce((a, [k, v]) => a + (v as number) * (BASE_PRICE[k] ?? 1), 0);
  return Math.ceil((1 - t.b.progress) * (base * 1.5 + def.time * 8) * (def.wonder ? 2 : 1));
}
export function hurry(state: GameState, civ: Civ, col: number, row: number): string | null {
  const c = hurryCost(state, civ, col, row);
  if (!c) return 'Nada que acelerar';
  if (civ.res.gold < c) return 'Oro insuficiente';
  civ.res.gold -= c;
  const t = tileAt(state, col, row)!;
  t.b!.progress = 0.999;
  return null;
}
