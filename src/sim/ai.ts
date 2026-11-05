// Inteligencia artificial de las civilizaciones rivales. Usa exactamente las mismas reglas que el jugador.
import type { Civ, GameState, Settlement, YieldId, Tile, ResId } from './types';
import { RNG } from '../core/rng';
import { BUILDINGS, BUILDING, type BuildingDef } from '../data/buildings';
import { TECH } from '../data/techs';
import { civEra } from '../data/techs';
import { GOV, GOVERNMENTS, POLICIES, POLICY } from '../data/politics';
import { availableTechs, buildingYield, placeCtx, techCostFor, foodStorage } from './economy';
import { civSettlements, tilesOfSettlement, tileAt, capitalOf } from './world';
import { marketTrade, hurry, hurryCost, canBuildAt, startBuild, canAfford, buildCost, activeProjects, maxProjects, colonyCost, canColonize, sendColonists, canFortify, fortify } from './actions';
import { hexesInRange, hexDistance } from '../core/hex';
import { isLand, wildFood } from '../data/terrain';
import { adoptPolicy, canAdoptPolicy, changeGovernment, govChangeCost } from './politics';
import { acceptTrade, acceptAlliance, declareWar, addOpinionMod } from './diplomacy';
import { queueEvent } from './events';

const VALUE: Record<YieldId, number> = { food: 1, wood: 0.8, stone: 0.9, metal: 1.2, goods: 1.1, gold: 1, knowledge: 1.3, culture: 1.2, influence: 1.5 };

const TECH_PREF: Record<Civ['personality'], string[]> = {
  aggressive: ['bronze', 'ironworking', 'horsemanship', 'castles', 'gunpowder', 'masonry', 'husbandry', 'feudalism'],
  merchant: ['currency', 'wheel', 'sailing', 'banking', 'mercantile', 'cartography', 'guilds', 'pottery'],
  pious: ['mysticism', 'calendar', 'theology', 'drama', 'university', 'masonry'],
  expansionist: ['agriculture', 'husbandry', 'irrigation', 'plough', 'bureaucracy', 'engineering', 'rotation'],
  scholarly: ['writing', 'philosophy', 'mathematics', 'university', 'printing', 'science', 'medicine'],
  peaceful: ['agriculture', 'pottery', 'calendar', 'medicine', 'drama', 'irrigation', 'law'],
};

export function aiYear(state: GameState, civ: Civ, rng: RNG) {
  aiResearch(state, civ, rng);
  aiTradition(state, civ, rng);
  aiPolitics(state, civ, rng);
  const tries = 2 + civSettlements(state, civ.id).length;
  for (let i = 0; i < tries; i++) if (!aiBuild(state, civ, rng)) break;
  aiSpendGold(state, civ, rng);
  aiExpand(state, civ, rng);
  aiFortify(state, civ, rng);
  aiDiplomacy(state, civ, rng);
}

function aiSpendGold(state: GameState, civ: Civ, rng: RNG) {
  // Comprar lo que falta
  const need: [ResId, number][] = [['food', civ.ledger.foodNeed * 0.25], ['wood', 40], ['stone', 40], ['metal', civ.techs.includes('bronze') ? 25 : 0]];
  for (const [r, min] of need) {
    if (civ.res[r] < min && civ.res.gold > 80) marketTrade(state, civ, r, Math.min(Math.ceil(min - civ.res[r]), Math.floor(civ.res.gold * 0.3)));
  }
  // Acelerar obras
  if (civ.res.gold > 150) {
    for (const s of civSettlements(state, civ.id)) {
      for (const [c, r, t] of tilesOfSettlement(state, s)) {
        if (t.b && t.b.progress < 1) {
          const cost = hurryCost(state, civ, c, r);
          if (cost < civ.res.gold * 0.4) { hurry(state, civ, c, r); return; }
        }
      }
    }
  }
}

function aiResearch(state: GameState, civ: Civ, rng: RNG) {
  if (civ.research) return;
  const av = availableTechs(civ);
  if (!av.length) return;
  const pref = TECH_PREF[civ.personality];
  const pick = rng.weighted(av, (t) => {
    let w = 100 / techCostFor(state, civ, t.id);
    if (pref.includes(t.id)) w *= 2.5;
    if (t.id === 'agriculture' || t.id === 'pottery') w *= 2;
    if (t.final) w *= 3;
    return w;
  });
  civ.research = pick?.id ?? null;
}

function aiTradition(state: GameState, civ: Civ, rng: RNG) {
  if (!civ.traditionOffer) return;
  const id = rng.pick(civ.traditionOffer);
  civ.traditions.push(id);
  civ.traditionOffer = null;
}

function aiPolitics(state: GameState, civ: Civ, rng: RNG) {
  // Gobierno
  if (state.year - civ.govChanged > 50 && civ.stability > 45 && civ.res.influence >= govChangeCost(civ) && rng.chance(0.2)) {
    const order: Record<Civ['personality'], string[]> = {
      aggressive: ['feudal', 'empire', 'chiefdom', 'monarchy'],
      merchant: ['constitutional', 'republic', 'monarchy', 'chiefdom'],
      pious: ['theocracy', 'monarchy', 'feudal', 'chiefdom'],
      expansionist: ['empire', 'feudal', 'monarchy', 'chiefdom'],
      scholarly: ['constitutional', 'republic', 'monarchy', 'chiefdom'],
      peaceful: ['constitutional', 'republic', 'monarchy', 'chiefdom'],
    };
    const cur = order[civ.personality].indexOf(civ.government);
    for (const g of order[civ.personality]) {
      const def = GOV[g];
      const idx = order[civ.personality].indexOf(g);
      if (cur !== -1 && idx >= cur) break;
      if (def.tech && !civ.techs.includes(def.tech)) continue;
      civ.res.influence -= govChangeCost(civ);
      changeGovernment(state, civ, g);
      break;
    }
  }
  // Leyes
  if (rng.chance(0.25)) {
    const slots = GOV[civ.government].slots;
    const pref: Record<Civ['personality'], string[]> = {
      aggressive: ['warrior_code', 'standing', 'levy', 'clanland', 'slavery'],
      merchant: ['freetrade', 'barter', 'private', 'apprentice', 'lowtax'],
      pious: ['statecult', 'ancestors', 'zeal', 'tithe'],
      expansionist: ['corvee', 'communal', 'private', 'levy'],
      scholarly: ['scribes', 'oral', 'patronage', 'publicschool', 'tolerance'],
      peaceful: ['communal', 'lowtax', 'ancestors', 'tolerance', 'militia'],
    };
    const list = [...pref[civ.personality], ...POLICIES.map((p) => p.id)];
    for (const id of list) {
      const p = POLICY[id];
      const sameGroup = civ.policies.find((x) => POLICY[x].group === p.group);
      if (sameGroup) continue;
      if (civ.policies.length >= slots) break;
      if (!canAdoptPolicy(civ, id)) {
        adoptPolicy(state, civ, id);
        break;
      }
    }
  }
}

function freeTiles(state: GameState, s: Settlement) {
  return tilesOfSettlement(state, s).filter(([c, r]) => !(c === s.col && r === s.row));
}

function tileValue(state: GameState, civ: Civ, def: BuildingDef, s: Settlement, c: number, r: number) {
  const y = buildingYield(def, placeCtx(state, civ, s, c, r));
  let v = 0;
  for (const [k, n] of Object.entries(y.out)) v += (n as number) * VALUE[k as YieldId];
  return v * y.mult;
}

function wants(state: GameState, civ: Civ): Record<string, number> {
  const L = civ.ledger;
  const sets = civSettlements(state, civ.id);
  const era = civEra(civ.techs);
  const pop = sets.reduce((a, s) => a + s.pop, 0);
  const idle = sets.reduce((a, s) => a + Math.max(0, s.workforce - s.employed), 0);
  const w: Record<string, number> = {};
  const foodRatio = L.foodNeed ? L.net.food / L.foodNeed : 0;
  const foodW = foodRatio < 0 ? 10 : foodRatio < 0.1 ? 6 : foodRatio < 0.2 ? 2.5 : civ.res.food < foodStorage(state, civ) * 0.3 ? 1.5 : 0.3;
  for (const id of ['farm', 'pasture', 'fishery', 'hunters']) w[id] = foodW * (id === 'hunters' ? 0.6 : 1);
  const crowded = sets.some((s) => s.pop > s.housing * 0.85);
  w.hut = (crowded ? 7 : 0.2) * (civ.techs.includes('masonry') ? 0.25 : 1);
  w.house = crowded ? 6 : 0.3;
  w.townhouse = crowded ? 5 : 0.2;
  w.granary = civ.res.food >= foodStorage(state, civ) * 0.9 ? 3 : 0.2;
  w.lumber = civ.res.wood < 40 ? 4 : L.net.wood < 2 ? 2 : 0.4;
  w.quarry = civ.techs.includes('masonry') ? (civ.res.stone < 40 ? 3 : L.net.stone < 2 ? 1.5 : 0.4) : 0;
  w.mine = era >= 1 ? (civ.res.metal < 25 ? 3 : 0.8) : 0;
  w.workshop = era >= 1 && L.goodsMet < 0.95 ? 4 : 0.6;
  w.forge = era >= 2 && L.goodsMet < 0.95 ? 3 : 0.4;
  w.guild = era >= 4 ? 2 : 0;
  const pers = civ.personality;
  w.shrine = civ.factions.clergy < 45 || pers === 'pious' ? 2.5 : 0.8;
  w.temple = w.shrine * 1.1;
  w.basilica = w.shrine;
  w.monument = 1.2;
  w.archive = pers === 'scholarly' ? 3 : 1.6;
  w.academy = w.archive;
  w.university = w.archive;
  w.observatory = w.archive;
  w.market = pers === 'merchant' ? 3 : 1.6;
  w.harbor = w.market;
  w.bank = w.market;
  w.company = w.market;
  w.theater = civ.stability < 50 ? 3 : 1;
  w.baths = sets.some((s) => s.health < 0) ? 3 : 0.6;
  w.aqueduct = sets.some((s) => s.pop > 140) ? 3 : 0.3;
  w.palace = 3;
  const workforce = sets.reduce((a, s) => a + s.workforce, 0);
  const milShare = workforce ? civ.soldiers / workforce : 0;
  const milTarget = (pers === 'aggressive' ? 0.12 : pers === 'expansionist' ? 0.09 : pers === 'peaceful' ? 0.05 : 0.07) * (era === 0 ? 0.6 : 1);
  const atWar = Object.values(civ.relations).some((r) => r.state === 'war');
  const milW = milShare < milTarget || atWar ? (atWar ? 6 : 3) : 0.1;
  w.warcamp = era === 0 ? milW : milW * 0.3;
  w.barracks = milW;
  w.stables = milW;
  // Mano de obra ociosa favorece producción; escasez la penaliza
  const laborW = idle > 8 ? 1.4 : idle < 2 ? 0.5 : 1;
  for (const k of Object.keys(w)) if (BUILDING[k] && BUILDING[k].jobs > 0 && !['farm', 'pasture', 'fishery'].includes(k)) w[k] *= laborW;
  // Sin trabajadores libres no tiene sentido abrir más puestos (salvo comida en crisis)
  for (const k of Object.keys(w)) {
    const d = BUILDING[k];
    if (!d || d.jobs === 0) continue;
    if (idle < d.jobs * 0.6 && !(d.cat === 'food' && foodRatio < 0.15 && k !== 'hunters')) w[k] *= 0.03;
  }
  if (w.hunters && civ.techs.includes('agriculture')) w.hunters *= 0.3;
  return w;
}

export function aiBuild(state: GameState, civ: Civ, rng: RNG): boolean {
  if (activeProjects(state, civ) >= maxProjects(state, civ)) return false;
  const w = wants(state, civ);
  const sets = civSettlements(state, civ.id);
  // Maravillas: si va sobrado
  const wonders = BUILDINGS.filter((b) => b.wonder && (!b.tech || civ.techs.includes(b.tech)) && state.wonders[b.id] == null);
  const richness = civ.res.stone + civ.res.gold + civ.res.wood;
  if (wonders.length && rng.chance(civ.personality === 'pious' || civ.personality === 'scholarly' ? 0.12 : 0.06) && richness > 250) {
    const def = rng.pick(wonders);
    if (canAfford(civ, buildCost(state, civ, def))) {
      for (const s of sets) {
        for (const [c, r] of freeTiles(state, s)) {
          if (!canBuildAt(state, civ, def, c, r)) {
            if (!startBuild(state, civ, def.id, c, r)) return true;
          }
        }
      }
    }
  }
  const types = BUILDINGS.filter((b) => !b.wonder && (!b.tech || civ.techs.includes(b.tech)) && (w[b.id] ?? 0) > 0.15);
  types.sort((a, b) => (w[b.id] ?? 0) * rng.range(0.7, 1.3) - (w[a.id] ?? 0) * rng.range(0.7, 1.3));
  // ¿Hay ya edificios de este tipo sin personal? Entonces no construir más.
  const understaffed = (id: string) => {
    for (const st of sets) for (const [, , t] of tilesOfSettlement(state, st)) if (t.b?.type === id && (t.b.progress < 1 || t.b.staff < BUILDING[id].jobs * 0.8)) return true;
    return false;
  };
  for (const def of types.slice(0, 5)) {
    if (!canAfford(civ, buildCost(state, civ, def))) continue;
    if (def.jobs > 0 && understaffed(def.id)) continue;
    let best: { c: number; r: number; v: number } | null = null;
    for (const s of sets) {
      // la vivienda va donde hace falta; los empleos, donde hay gente libre
      if (def.cat === 'housing' && s.pop < s.housing * 0.8) continue;
      if (def.jobs > 0 && def.cat !== 'food' && (s.workforce - s.employed) < def.jobs * 0.4 && sets.length > 1) continue;
      for (const [c, r] of freeTiles(state, s)) {
        if (canBuildAt(state, civ, def, c, r)) continue;
        const v = tileValue(state, civ, def, s, c, r) + rng.next() - (def.cat === 'housing' ? hexDistance(c, r, s.col, s.row) : 0) + (def.cat === 'housing' && s.pop > s.housing * 0.85 ? 5 : 0);
        if (!best || v > best.v) best = { c, r, v };
      }
    }
    if (best && !startBuild(state, civ, def.id, best.c, best.r)) return true;
    // Sin sitio: derribar un edificio vacío para hacer hueco a lo que de verdad hace falta
    if (!best && (w[def.id] ?? 0) >= 2.5 && !def.upgradeOf) {
      for (const s of sets) {
        const victims = freeTiles(state, s).filter(([c, r, t]) => t.b && t.b.progress >= 1 && t.b.staff < 0.5 && BUILDING[t.b.type].jobs > 0 && !BUILDING[t.b.type].wonder && t.b.type !== def.id);
        for (const [c, r, t] of victims) {
          const old = t.b;
          t.b = null;
          if (!canBuildAt(state, civ, def, c, r) && !startBuild(state, civ, def.id, c, r)) return true;
          t.b = old;
        }
      }
    }
  }
  return false;
}

export function siteScore(state: GameState, c: number, r: number) {
  const t = tileAt(state, c, r);
  if (!t || !isLand(t) || t.elev === 2 || t.biome === 'snow') return -99;
  let s = 0;
  for (const [hc, hr] of hexesInRange(c, r, 2)) {
    const n = tileAt(state, hc, hr);
    if (!n) continue;
    if (n.owner !== -1) s -= 0.8;
    s += wildFood(n) * 0.8;
    if (n.dep) s += 1.2;
    if (n.elev === 1) s += 0.3;
  }
  if (t.river) s += 3;
  if (t.biome === 'tundra') s -= 3;
  if (t.biome === 'desert' && !t.river) s -= 4;
  return s;
}

function aiExpand(state: GameState, civ: Civ, rng: RNG) {
  const sets = civSettlements(state, civ.id);
  const maxS = civ.personality === 'expansionist' ? 9 : civ.personality === 'aggressive' ? 6 : 5;
  if (sets.length >= maxS || state.colonists.some((c) => c.civ === civ.id)) return;
  if (!sets.some((s) => s.pop > 70)) return;
  if (civ.ledger.net.food < 0) return;
  if (!rng.chance(0.3)) return;
  let best: { c: number; r: number; v: number } | null = null;
  for (const s of sets) {
    for (let k = 0; k < 40; k++) {
      const c = s.col + rng.int(-8, 8), r = s.row + rng.int(-7, 7);
      const d = hexDistance(s.col, s.row, c, r);
      if (d < 4 || d > 8) continue;
      if (canColonize(state, civ, c, r)) continue;
      const v = siteScore(state, c, r) - d * 0.4;
      if (!best || v > best.v) best = { c, r, v };
    }
  }
  if (best && best.v > 6) sendColonists(state, civ, best.c, best.r, rng);
}

function aiFortify(state: GameState, civ: Civ, rng: RNG) {
  const atWar = Object.values(civ.relations).some((r) => r.state === 'war');
  if (!atWar && !rng.chance(0.03)) return;
  const sets = civSettlements(state, civ.id).sort((a, b) => a.fort - b.fort);
  for (const s of sets) if (!canFortify(state, civ, s)) { fortify(state, civ, s); return; }
}

function aiDiplomacy(state: GameState, civ: Civ, rng: RNG) {
  const player = state.civs[state.player];
  for (const o of state.civs) {
    if (o === civ || !o.alive) continue;
    const r = civ.relations[o.id];
    if (!r.met) continue;
    // Comercio
    if (!r.trade && r.state !== 'war' && r.opinion > 5 && rng.chance(civ.personality === 'merchant' ? 0.12 : 0.05)) {
      if (o.isPlayer) {
        if (rng.chance(0.25) && !state.events.pending.some((p) => p.id === 'sys_ai_proposal')) queueEvent(state, o, 'sys_ai_proposal', capitalOf(state, o.id)?.id ?? -1, civ.id);
      } else if (rng.chance(acceptTrade(state, civ, o))) {
        r.trade = o.relations[civ.id].trade = true;
      }
    }
    // Alianzas entre IA
    if (!o.isPlayer && r.state === 'peace' && r.opinion > 55 && rng.chance(0.03) && rng.chance(acceptAlliance(state, civ, o))) {
      r.state = o.relations[civ.id].state = 'alliance';
      state.chronicle.push({ year: state.year, civ: -1, kind: 'diplo', text: `Los ${civ.people} y los ${o.people} sellaron una alianza.` });
    }
    // Guerra
    if (r.state === 'peace' && r.truceUntil <= state.year) {
      const hostile = civ.personality === 'aggressive' ? 1 : civ.personality === 'expansionist' ? 0.7 : civ.personality === 'peaceful' ? 0.15 : 0.35;
      const ratio = civ.strength / Math.max(1, o.strength);
      const graceOk = state.year > (o.isPlayer ? (state.difficulty === 'easy' ? 120 : 70) : 40);
      if (graceOk && r.opinion < -20 && ratio > 1.3 && civ.strength > 15 && civ.stability > 35 && rng.chance(0.05 * hostile)) {
        declareWar(state, civ, o);
        continue;
      }
      // Exigir tributo al jugador
      if (o.isPlayer && graceOk && ratio > 1.8 && hostile >= 0.7 && r.opinion < 10 && state.year - r.lastDemand > 30 && rng.chance(0.04)) {
        r.lastDemand = state.year;
        queueEvent(state, o, 'sys_demand', capitalOf(state, o.id)?.id ?? -1, civ.id, { amount: Math.round(20 + o.res.gold * 0.35) });
      }
    }
  }
}

export { TECH, GOVERNMENTS, addOpinionMod };
