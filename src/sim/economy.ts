// Simulación económica y demográfica anual de una civilización.
import type { Civ, GameState, Settlement, Tile, YieldId, ResId, FactionId } from './types';
import { RES_IDS, FACTION_IDS } from './types';
import { BUILDING, type BuildingDef, type PlaceCtx, type Bonus, BUILDINGS } from '../data/buildings';
import { DEPOSITS, LUXURIES, isLand, isWater, wildFood } from '../data/terrain';
import { civEra, TECH, TECHS, techCost } from '../data/techs';
import { FACTIONS, GOV } from '../data/politics';
import { civSettlements, tilesOfSettlement, nbrTiles, tileAt, claimTiles } from './world';
import { emptyLedger, addIncome, addExpense } from './ledger';
import { civFx, type Fx } from './mods';
import { hexDistance } from '../core/hex';
import { clamp } from '../core/noise';

const PRIORITY: Record<string, number> = { food: 0, materials: 1, military: 2, faith: 3, knowledge: 4, trade: 5, craft: 6, civic: 7, housing: 8, wonder: 9 };
export const CENTER_HOUSING = 30;

export function placeCtx(state: GameState, civ: Civ, s: Settlement, col: number, row: number): PlaceCtx {
  const tile = tileAt(state, col, row)!;
  return { tile, col, row, nbrs: nbrTiles(state, col, row), state, civ, s, distCenter: hexDistance(col, row, s.col, s.row) };
}

export interface BuildingYield {
  out: Partial<Record<YieldId, number>>; // a plantilla completa, con bonificaciones de casilla
  mult: number;
  bonuses: Bonus[];
}

export function buildingYield(def: BuildingDef, ctx: PlaceCtx): BuildingYield {
  const out: Partial<Record<YieldId, number>> = { ...(def.out ?? {}) };
  const bonuses = def.bonus ? def.bonus(ctx) : [];
  let mult = 1;
  for (const b of bonuses) {
    if (b.add) for (const [k, v] of Object.entries(b.add)) out[k as YieldId] = (out[k as YieldId] ?? 0) + (v as number);
    if (b.mult) mult += b.mult;
  }
  // Mercado: +1 oro por cada lujo distinto
  if (def.id === 'market') {
    const lux = ctx.civ.ledger.luxuries.length + ctx.civ.ledger.luxuryTrade.length;
    if (lux) {
      out.gold = (out.gold ?? 0) + lux;
      bonuses.push({ label: `${lux} lujos en el mercado`, add: { gold: lux } });
    }
  }
  return { out, mult: Math.max(0.1, mult), bonuses };
}

export function civLuxuries(state: GameState, civ: Civ): string[] {
  const set = new Set<string>();
  for (const s of civSettlements(state, civ.id)) {
    for (const [, , t] of tilesOfSettlement(state, s)) {
      if (t.dep && LUXURIES.includes(t.dep) && t.b && t.b.progress >= 1 && !t.b.paused) set.add(t.dep);
    }
  }
  return [...set];
}

export function hasStrategic(state: GameState, civ: Civ, dep: string): boolean {
  for (const s of civSettlements(state, civ.id))
    for (const [, , t] of tilesOfSettlement(state, s)) if (t.dep === dep) return true;
  // también por comercio
  for (const [oid, rel] of Object.entries(civ.relations)) {
    if (!rel.trade) continue;
    const o = state.civs[+oid];
    if (!o?.alive) continue;
    for (const s of civSettlements(state, o.id))
      for (const [, , t] of tilesOfSettlement(state, s)) if (t.dep === dep && t.b?.type === (dep === 'horses' ? 'pasture' : 'mine')) return true;
  }
  return false;
}

export function militaryTier(state: GameState, civ: Civ): { tier: number; mult: number; label: string } {
  const has = (t: string) => civ.techs.includes(t);
  if (has('gunpowder')) return { tier: 3, mult: 3.6, label: 'Arcabuces y cañones' };
  if (has('ironworking') && hasStrategic(state, civ, 'iron')) return { tier: 2, mult: 2.3, label: 'Armas de hierro' };
  if (has('bronze') && hasStrategic(state, civ, 'copper')) return { tier: 1, mult: 1.55, label: 'Armas de bronce' };
  if (has('ironworking') || has('bronze')) return { tier: 0.5, mult: 1.2, label: 'Metal escaso' };
  return { tier: 0, mult: 1, label: 'Lanzas de piedra' };
}

export function foodStorage(state: GameState, civ: Civ): number {
  let cap = 80;
  for (const s of civSettlements(state, civ.id)) {
    cap += 50;
    for (const [c, r, t] of tilesOfSettlement(state, s)) {
      if (t.b?.type === 'granary' && t.b.progress >= 1) {
        const y = buildingYield(BUILDING.granary, placeCtx(state, civ, s, c, r));
        cap += (BUILDING.granary.storage ?? 0) * y.mult;
      }
    }
  }
  if (civ.techs.includes('pottery')) cap += 40;
  return Math.round(cap);
}

export function resCap(state: GameState, civ: Civ, r: ResId): number {
  if (r === 'food') return foodStorage(state, civ);
  if (r === 'gold') return 300 + civEra(civ.techs) * 350 + (civ.techs.includes('banking') ? 600 : 0);
  if (r === 'influence') return 200 + civEra(civ.techs) * 60;
  const n = civSettlements(state, civ.id).length;
  return 200 + n * 100 + civEra(civ.techs) * 150;
}

export function borderThreshold(radius: number) {
  return [0, 0, 25, 110, 320, 800][radius] ?? Infinity;
}

// ───────────────────────── Simulación anual ─────────────────────────
export function simulateEconomy(state: GameState, civ: Civ) {
  const fx = civFx(state, civ);
  const era = civEra(civ.techs);
  const L = emptyLedger();
  const prevLedger = civ.ledger;
  L.luxuries = prevLedger.luxuries;
  L.luxuryTrade = prevLedger.luxuryTrade;
  civ.ledger = L; // las funciones de rendimiento leen los lujos del año anterior
  const sets = civSettlements(state, civ.id);
  const totalPop = sets.reduce((a, s) => a + s.pop, 0);
  const tier = militaryTier(state, civ);

  // Disponibilidad de insumos (según existencias al inicio del año)
  const inputDemand: Partial<Record<ResId, number>> = {};
  const staffed: { s: Settlement; c: number; r: number; t: Tile; def: BuildingDef; ratio: number }[] = [];

  let soldiers = 0;
  let soldierPower = 0;
  const constructionSpeed = 1 + fx.construction;

  for (const s of sets) {
    const tiles = tilesOfSettlement(state, s);
    let housing = CENTER_HOUSING;
    let healthB = 0;
    let stabB = 0;
    const jobsList: { c: number; r: number; t: Tile; def: BuildingDef }[] = [];
    for (const [c, r, t] of tiles) {
      const b = t.b;
      if (!b) continue;
      const def = BUILDING[b.type];
      if (!def) continue;
      if (b.progress < 1) {
        b.progress = Math.min(1, b.progress + constructionSpeed / def.time);
        if (b.progress >= 1) {
          b.built = state.year;
          onBuilt(state, civ, s, t, def);
        }
        continue;
      }
      housing += def.housing ?? 0;
      healthB += def.health ?? 0;
      stabB += def.stability ?? 0;
      if (def.jobs > 0 && !b.paused) jobsList.push({ c, r, t, def });
      else b.staff = 0;
    }
    s.housing = Math.round(housing * (1 + fx.housing));
    s.workforce = s.pop * clamp(0.58 + fx.workforce, 0.4, 0.75);
    // Por categoría y, dentro de ella, primero los puestos más productivos
    const perJob = (j: { c: number; r: number; def: BuildingDef }) => {
      const y = buildingYield(j.def, placeCtx(state, civ, s, j.c, j.r));
      let v = 0;
      for (const n of Object.values(y.out)) v += n as number;
      return (v * y.mult) / j.def.jobs;
    };
    const pj = new Map(jobsList.map((j) => [j, perJob(j)]));
    jobsList.sort((a, b) => PRIORITY[a.def.cat] - PRIORITY[b.def.cat] || pj.get(b)! - pj.get(a)!);
    (s as any)._jobsList = jobsList;
    (s as any)._free = s.workforce;
    s.jobs = jobsList.reduce((a, j) => a + j.def.jobs, 0);
    (s as any)._healthB = healthB;
    (s as any)._stabB = stabB;
    for (const j of jobsList) j.t.b!.staff = 0;
  }

  // Asignación de trabajadores: primero en su propio asentamiento, después (con un 15% de pérdida)
  // en asentamientos vecinos a menos de 7 casillas que tengan puestos vacíos.
  const fill = (from: Settlement, to: Settlement, eff: number, onlyFood: boolean) => {
    for (const j of (to as any)._jobsList as { c: number; r: number; t: Tile; def: BuildingDef }[]) {
      if (onlyFood !== (j.def.cat === 'food')) continue;
      const freeW = (from as any)._free as number;
      if (freeW <= 0.01) break;
      const gap = j.def.jobs - j.t.b!.staff;
      if (gap <= 0) continue;
      const take = Math.min(freeW * eff, gap);
      j.t.b!.staff += take;
      (from as any)._free = freeW - take / eff;
    }
  };
  const fillAll = (onlyFood: boolean) => {
    for (const s of sets) fill(s, s, 1, onlyFood);
    for (const to of sets)
      for (const from of sets) {
        if (from === to || hexDistance(from.col, from.row, to.col, to.row) > 7) continue;
        fill(from, to, 0.85, onlyFood);
      }
  };
  // 1) Primero los puestos de comida
  fillAll(true);
  // 2) Si la comida prevista no basta, los jefes mandan a recolectar antes de abrir otros oficios
  {
    const pm = 1 + fx.food;
    let expected = 0;
    for (const s of sets) {
      const center = tileAt(state, s.col, s.row)!;
      expected += (5 + (center.river ? 2 : 0)) * pm;
      for (const j of (s as any)._jobsList as { c: number; r: number; t: Tile; def: BuildingDef }[]) {
        if (j.def.cat !== 'food' || !j.t.b!.staff) continue;
        const y = buildingYield(j.def, placeCtx(state, civ, s, j.c, j.r));
        expected += (y.out.food ?? 0) * (j.t.b!.staff / j.def.jobs) * y.mult * pm;
      }
    }
    const need = totalPop * 1.08 - expected - (fx.foodFlat ?? 0);
    if (need > 0) {
      let remaining = need;
      for (const s of sets) {
        let cap = 0;
        for (const [, , t] of tilesOfSettlement(state, s)) if (!t.b) cap += wildFood(t);
        const capWorkers = (cap * 3.2) / 1.5;
        const reserve = Math.min((s as any)._free, capWorkers, remaining / (1.5 * pm));
        (s as any)._reserved = reserve;
        (s as any)._free -= reserve;
        remaining -= reserve * 1.5 * pm;
        if (remaining <= 0) break;
      }
    }
  }
  // 3) El resto de oficios
  fillAll(false);
  for (const s of sets) {
    (s as any)._free += (s as any)._reserved ?? 0;
    (s as any)._reserved = 0;
  }
  for (const s of sets) {
    for (const j of (s as any)._jobsList as { c: number; r: number; t: Tile; def: BuildingDef }[]) {
      const take = j.t.b!.staff;
      const ratio = take / j.def.jobs;
      staffed.push({ s, ...j, ratio });
      if (j.def.input) for (const [k, v] of Object.entries(j.def.input)) inputDemand[k as ResId] = (inputDemand[k as ResId] ?? 0) + (v as number) * ratio;
      if (j.def.soldiers) {
        soldiers += take;
        const y = buildingYield(j.def, placeCtx(state, civ, s, j.c, j.r));
        soldierPower += take * (j.def.soldierPower ?? 1) * y.mult;
      }
    }
    const free = (s as any)._free as number;
    s.employed = s.workforce - free;
    (s as any)._idle = free;
  }

  const inputRatio: Partial<Record<ResId, number>> = {};
  for (const [k, v] of Object.entries(inputDemand)) inputRatio[k as ResId] = v! > 0 ? Math.min(1, civ.res[k as ResId] / v!) : 1;

  const prodMult = (y: YieldId) => 1 + ((fx as any)[y] ?? 0);

  // Producción de edificios
  for (const st of staffed) {
    const { s, c, r, def, ratio } = st;
    if (ratio <= 0) continue;
    let eff = ratio;
    if (def.input) {
      let ir = 1;
      for (const k of Object.keys(def.input)) ir = Math.min(ir, inputRatio[k as ResId] ?? 1);
      eff *= ir;
      for (const [k, v] of Object.entries(def.input)) addExpense(L, k as ResId, def.name, (v as number) * eff);
    }
    const y = buildingYield(def, placeCtx(state, civ, s, c, r));
    for (const [k, v] of Object.entries(y.out)) {
      const amount = (v as number) * eff * y.mult * prodMult(k as YieldId);
      addIncome(L, k as YieldId, def.name, amount);
    }
    if (def.upkeep) addExpense(L, 'gold', 'Mantenimiento', def.upkeep * (1 + fx.upkeep) * (era >= 1 ? 1 : 0));
  }
  // Mantenimiento de edificios sin trabajadores también
  for (const s of sets) {
    for (const [, , t] of tilesOfSettlement(state, s)) {
      const b = t.b;
      if (!b || b.progress < 1) continue;
      const def = BUILDING[b.type];
      if (def.upkeep && (def.jobs === 0 || b.paused)) addExpense(L, 'gold', 'Mantenimiento', def.upkeep * (1 + fx.upkeep) * (era >= 1 ? 1 : 0));
    }
  }

  // Centros de asentamiento, recolección e impuestos
  for (const s of sets) {
    const center = tileAt(state, s.col, s.row)!;
    addIncome(L, 'food', 'Centros de población', (5 + (center.river ? 2 : 0)) * prodMult('food'));
    addIncome(L, 'influence', 'Centros de población', (s.capital ? 1 : 0.4) * prodMult('influence'));
    addIncome(L, 'culture', 'Centros de población', (s.capital ? 0.6 : 0.3) * prodMult('culture'));
    addIncome(L, 'knowledge', 'Población', (1.2 + s.pop * 0.008) * prodMult('knowledge'));
    // Recolectores: población ociosa
    const idle = (s as any)._idle as number;
    if (idle > 0) {
      let cap = 0;
      for (const [, , t] of tilesOfSettlement(state, s)) if (!t.b) cap += wildFood(t);
      cap *= 3.2;
      const gathered = Math.min(idle * 1.5, cap) * prodMult('food');
      addIncome(L, 'food', 'Recolección', gathered);
      // Algo de madera recogida
      addIncome(L, 'wood', 'Recolección', Math.min(idle * 0.1, 4));
    }
  }
  const taxRate = (0.008 + era * 0.006) * (1 + fx.tax);
  const taxes = totalPop * Math.max(0, taxRate);
  L.taxes = taxes;
  addIncome(L, 'gold', 'Impuestos', taxes * prodMult('gold'));

  // Comercio
  let tradeGold = 0;
  const luxTrade = new Set<string>();
  for (const [oid, rel] of Object.entries(civ.relations)) {
    if (!rel.trade) continue;
    const o = state.civs[+oid];
    if (!o?.alive) continue;
    const opop = civSettlements(state, o.id).reduce((a, s) => a + s.pop, 0);
    const g = (2.5 + Math.min(totalPop, opop) * 0.012 + era * 0.8) * (1 + fx.trade);
    tradeGold += g;
    for (const lx of o.ledger.luxuries) if (!L.luxuries.includes(lx)) luxTrade.add(lx);
  }
  if (tradeGold) addIncome(L, 'gold', 'Rutas comerciales', tradeGold * prodMult('gold'));

  // Bonificaciones planas
  if (fx.foodFlat) addIncome(L, 'food', 'Bonificaciones', fx.foodFlat);
  if (fx.goldFlat > 0) addIncome(L, 'gold', 'Bonificaciones', fx.goldFlat);
  else if (fx.goldFlat < 0) addExpense(L, 'gold', 'Gastos de la corte', -fx.goldFlat);
  if (fx.influenceFlat > 0) addIncome(L, 'influence', 'Gobierno', fx.influenceFlat);
  else if (fx.influenceFlat < 0) addExpense(L, 'influence', 'Gobierno', -fx.influenceFlat);
  if (fx.knowledgeFlat) addIncome(L, 'knowledge', 'Bonificaciones', fx.knowledgeFlat);
  if (fx.cultureFlat) addIncome(L, 'culture', 'Bonificaciones', fx.cultureFlat);

  // Ejército: mantenimiento
  if (era >= 1 && soldiers > 0) addExpense(L, 'gold', 'Soldada', soldiers * 0.06 * era * (1 + fx.upkeep));

  // Consumo de comida
  const foodNeed = totalPop * 1.0;
  L.foodNeed = foodNeed;
  addExpense(L, 'food', 'Consumo', foodNeed);

  // Bienes
  const goodsNeed = era >= 1 ? totalPop * (0.012 + 0.01 * era) * (1 + fx.goodsDemand) : 0;
  L.goodsNeed = goodsNeed;
  const goodsAvail = civ.res.goods + (L.net.goods > 0 ? L.net.goods : 0);
  const goodsUsed = Math.min(goodsNeed, Math.max(0, goodsAvail));
  L.goodsMet = goodsNeed > 0 ? goodsUsed / goodsNeed : 1;
  if (goodsUsed) addExpense(L, 'goods', 'Consumo', goodsUsed);

  // Aplicar a existencias
  let famine = 0;
  for (const r of RES_IDS) {
    civ.res[r] += L.net[r];
    if (r === 'food' && civ.res.food < 0) {
      famine = clamp(-civ.res.food / Math.max(1, foodNeed), 0, 1);
      civ.res.food = 0;
    }
    if (civ.res[r] < 0) civ.res[r] = 0;
  }
  // Almacenamiento y pérdidas
  const fcap = foodStorage(state, civ);
  if (civ.res.food > fcap) {
    const lost = civ.res.food - fcap;
    civ.res.food = fcap;
    addExpense(L, 'food', 'Excedente perdido', lost);
    L.net.food += lost; // no contar como neto negativo en la UI
  }
  for (const r of RES_IDS) if (r !== 'food') civ.res[r] = Math.min(civ.res[r], resCap(state, civ, r));
  (L as any).famine = famine;

  // Saber e investigación
  civ.knowledge += Math.max(0, L.net.knowledge);
  // Cultura: tradiciones y fronteras
  civ.culturePts += Math.max(0, L.net.culture);

  // Fronteras
  const cultPer = L.net.culture * (1 + fx.borders);
  for (const s of sets) {
    const share = s.capital ? 0.55 : 0.45 / Math.max(1, sets.length - 1);
    s.culture += cultPer * (sets.length === 1 ? 1 : share) + 0.5;
    while (s.radius < 4 && s.culture >= borderThreshold(s.radius + 1)) {
      s.radius++;
      claimTiles(state, s);
    }
  }

  civ.soldiers = Math.round(soldiers);
  civ.strength = Math.round(soldierPower * tier.mult * (1 + fx.military) * (0.6 + civ.stability / 250));

  // Lujos del año (para el próximo cálculo)
  L.luxuries = civLuxuries(state, civ);
  L.luxuryTrade = [...luxTrade].filter((x) => !L.luxuries.includes(x));

  simulatePopulation(state, civ, fx, famine);
  updateFactionsAndStability(state, civ, fx, era);
}

function onBuilt(state: GameState, civ: Civ, s: Settlement, t: Tile, def: BuildingDef) {
  if (def.wonder) {
    state.wonders[def.id] = civ.id;
    civ.legacy += def.legacy ?? 50;
    state.chronicle.push({ year: state.year, civ: civ.id, kind: 'build', important: true, text: `Los ${civ.people} completaron ${def.name} en ${s.name}.` });
  } else if (civ.isPlayer && def.cat !== 'housing' && def.cat !== 'food' && def.cat !== 'materials') {
    // registro menor
  }
}

function simulatePopulation(state: GameState, civ: Civ, fx: Fx, famine: number) {
  const L = civ.ledger;
  const foodRatio = L.foodNeed > 0 ? L.net.food / L.foodNeed : 0;
  for (const s of civSettlements(state, civ.id)) {
    const center = tileAt(state, s.col, s.row)!;
    const freshWater = center.river > 0 || nbrTiles(state, s.col, s.row).some((n) => n.biome === 'lake' || n.river > 0);
    const crowd = s.pop / Math.max(1, s.housing);
    let health = 1 + fx.health + ((s as any)._healthB ?? 0) + (freshWater ? 1 : -0.5);
    if (crowd > 1) health -= (crowd - 1) * 8;
    health -= Math.max(0, (s.pop - 180) / 160);
    if (famine > 0) health -= 3;
    if (s.siege > 0) health -= 2;
    s.health = clamp(health, -10, 10);

    let birth = 0.036;
    const room = (s.housing - s.pop) / Math.max(1, s.housing);
    birth *= clamp(0.25 + room * 3.5, 0, 1.15);
    // La comida regula la natalidad antes de que llegue el hambre
    const stockYears = L.foodNeed > 0 ? civ.res.food / L.foodNeed : 1;
    if (foodRatio > 0.08) birth *= 1.12;
    else if (foodRatio < 0) birth *= stockYears > 0.6 ? 0.8 : stockYears > 0.2 ? 0.55 : 0.35;
    let death = 0.022 - s.health * 0.0018;
    if (room < 0) death += 0.03 * Math.min(1, -room * 2.5);
    death += famine * 0.25;
    if (civ.stability < 20) death += 0.004;
    let g = birth - death + fx.growth / 100;
    if (s.unrest > 60) g -= 0.01;
    const delta = s.pop * g;
    s.growth = delta;
    s.pop = Math.max(0, s.pop + delta);
    s.unrest = Math.max(0, s.unrest - 4 + (civ.stability < 30 ? 3 : 0) + (crowd > 1.15 ? 2 : 0) + (famine > 0 ? 5 : 0));
    if (s.loyalty < 100) s.loyalty = Math.min(100, s.loyalty + 2 + (civ.stability - 50) / 25);
  }
}

export function factionUnlocked(civ: Civ, f: FactionId) {
  const t = FACTIONS[f].tech;
  return !t || civ.techs.includes(t);
}

function updateFactionsAndStability(state: GameState, civ: Civ, fx: Fx, era: number) {
  const L = civ.ledger;
  const sets = civSettlements(state, civ.id);
  const totalPop = sets.reduce((a, s) => a + s.pop, 0);
  const workforce = sets.reduce((a, s) => a + s.workforce, 0);
  const famine = (L as any).famine as number;
  const foodRatio = L.foodNeed > 0 ? L.net.food / L.foodNeed : 0;
  const crowd = sets.reduce((a, s) => a + Math.max(0, s.pop / Math.max(1, s.housing) - 1) * s.pop, 0) / Math.max(1, totalPop);
  const atWar = Object.values(civ.relations).some((r) => r.state === 'war');
  const tradeCount = Object.values(civ.relations).filter((r) => r.trade).length;
  const nLux = L.luxuries.length + L.luxuryTrade.length * 0.5;

  const count = (pred: (d: BuildingDef) => boolean) => {
    let n = 0;
    for (const s of sets) for (const [, , t] of tilesOfSettlement(state, s)) if (t.b && t.b.progress >= 1 && pred(BUILDING[t.b.type])) n++;
    return n;
  };
  const staffOf = (f: FactionId) => {
    let n = 0;
    for (const s of sets) for (const [, , t] of tilesOfSettlement(state, s)) if (t.b && t.b.progress >= 1 && BUILDING[t.b.type].faction === f) n += t.b.staff;
    return n;
  };

  const tgt: Record<FactionId, number> = { commoners: 50, warriors: 50, clergy: 50, merchants: 50, scholars: 50 };
  // Pueblo
  tgt.commoners += famine > 0 ? -28 : foodRatio > 0.05 ? 6 : foodRatio < -0.05 ? -8 : 0;
  if (era >= 1) tgt.commoners += (L.goodsMet - 0.55) * 26;
  tgt.commoners -= Math.min(25, crowd * 40);
  tgt.commoners += Math.min(8, nLux * 2);
  if (atWar) tgt.commoners -= 6 + civ.warWeariness * 0.3;
  // Guerreros
  const milShare = workforce > 0 ? civ.soldiers / workforce : 0;
  tgt.warriors += milShare < 0.03 ? -12 : milShare > 0.09 ? 10 : (milShare - 0.03) * 150 - 3;
  if (atWar) {
    const ws = Object.values(civ.relations).filter((r) => r.state === 'war').reduce((a, r) => a + r.warScore, 0);
    tgt.warriors += ws > 15 ? 12 : ws < -15 ? -12 : 2;
  } else if (era >= 1 && state.year - (civ.flags.lastWar ?? 0) > 60) tgt.warriors -= 6;
  // Clero
  const faithB = count((d) => d.cat === 'faith') + (state.wonders.w_stones === civ.id ? 2 : 0) + (state.wonders.w_cathedral === civ.id ? 3 : 0);
  if (civ.techs.includes('mysticism')) tgt.clergy += faithB > 0 ? Math.min(20, faithB * 5) - 4 : -12;
  // Mercaderes
  tgt.merchants += tradeCount * 7 + Math.min(12, count((d) => d.cat === 'trade') * 4) - 8 - (atWar ? 14 : 0);
  // Eruditos
  const knowB = count((d) => d.cat === 'knowledge');
  tgt.scholars += knowB > 0 ? Math.min(20, knowB * 5) - 3 : -12;
  if (civ.research == null) tgt.scholars -= 5;

  for (const f of FACTION_IDS) {
    tgt[f] = clamp(tgt[f] + (fx.faction[f] ?? 0), 0, 100);
    civ.factions[f] += (tgt[f] - civ.factions[f]) * 0.18;
  }
  L.factionTargets = tgt;

  // Poder de cada facción
  const pow: Record<FactionId, number> = {
    commoners: 30 + totalPop / 25,
    warriors: 8 + civ.soldiers * 0.5 + (['chiefdom', 'monarchy', 'empire', 'feudal'].includes(civ.government) ? 12 : 0),
    clergy: factionUnlocked(civ, 'clergy') ? 5 + staffOf('clergy') * 1.5 + (civ.government === 'theocracy' ? 20 : 0) : 0,
    merchants: factionUnlocked(civ, 'merchants') ? 5 + staffOf('merchants') + tradeCount * 4 + (civ.government === 'republic' ? 10 : 0) : 0,
    scholars: factionUnlocked(civ, 'scholars') ? 5 + staffOf('scholars') * 1.2 : 0,
  };
  L.factionPower = pow;
  const totPow = FACTION_IDS.reduce((a, f) => a + pow[f], 0);

  // Estabilidad
  const parts: Record<string, number> = {};
  parts['Base'] = 50;
  let facPart = 0;
  for (const f of FACTION_IDS) facPart += (pow[f] / totPow) * (civ.factions[f] - 50);
  parts['Facciones'] = facPart * 0.8;
  if (fx.stability) parts['Gobierno, leyes y rasgos'] = fx.stability;
  if (buildingStab(state, civ)) parts['Edificios'] = buildingStab(state, civ);
  if (nLux) parts['Lujos'] = Math.min(15, nLux * 3.5);
  if (era >= 1) parts['Bienes'] = (L.goodsMet - 0.6) * 18;
  if (famine > 0) parts['Hambruna'] = -20;
  if (crowd > 0.02) parts['Hacinamiento'] = -Math.min(18, crowd * 35);
  if (civ.warWeariness > 0) parts['Cansancio de guerra'] = -civ.warWeariness;
  parts['Legitimidad'] = (civ.leader.legitimacy - 50) / 5;
  const nS = Math.max(0, sets.length - 1);
  const sizePen = (nS * 2.5 + nS * nS * 0.12) * (civ.techs.includes('bureaucracy') ? 0.6 : 1) * (civ.government === 'empire' ? 0.5 : 1);
  if (sizePen) parts['Tamaño del territorio'] = -sizePen;
  const conquered = sets.filter((s) => s.loyalty < 70).length;
  if (conquered) parts['Ciudades poco leales'] = -conquered * 4;
  const unrest = sets.reduce((a, s) => a + s.unrest, 0) / Math.max(1, sets.length);
  if (unrest > 5) parts['Malestar local'] = -unrest / 6;
  L.stabilityParts = parts;
  const target = clamp(Object.values(parts).reduce((a, b) => a + b, 0), 0, 100);
  civ.stability += (target - civ.stability) * 0.25;
}

function buildingStab(state: GameState, civ: Civ) {
  let n = 0;
  for (const s of civSettlements(state, civ.id)) {
    let k = 0;
    for (const [, , t] of tilesOfSettlement(state, s)) if (t.b && t.b.progress >= 1) k += BUILDING[t.b.type].stability ?? 0;
    n += Math.min(18, k);
  }
  return Math.min(30, n);
}

// ───────────────────────── Investigación ─────────────────────────
export function availableTechs(civ: Civ) {
  return TECHS.filter((t) => !civ.techs.includes(t.id) && t.req.every((r) => civ.techs.includes(r)));
}

export function techCostFor(state: GameState, civ: Civ, id: string) {
  const t = TECH[id];
  let cost = techCost(t);
  // Difusión: más barato si otras civs conocidas ya lo tienen
  const knowers = state.civs.filter((o) => o.alive && o.id !== civ.id && civ.relations[o.id]?.met && o.techs.includes(id)).length;
  cost *= 1 - Math.min(0.3, knowers * 0.1);
  // Las civilizaciones grandes investigan más despacio (coordinar más territorio)
  cost *= 1 + 0.05 * Math.max(0, civSettlements(state, civ.id).length - 1);
  // Cada descubrimiento hace el siguiente algo más difícil
  cost *= 1 + 0.02 * civ.techs.length;
  return Math.round(cost);
}

export function progressResearch(state: GameState, civ: Civ): string | null {
  if (!civ.research) return null;
  const cost = techCostFor(state, civ, civ.research);
  if (civ.knowledge >= cost) {
    civ.knowledge -= cost;
    const id = civ.research;
    civ.techs.push(id);
    civ.research = null;
    return id;
  }
  return null;
}

export function traditionCost(civ: Civ) {
  return Math.round(35 * Math.pow(1.55, civ.traditions.length));
}

export { BUILDINGS, DEPOSITS, isLand, isWater, GOV };
