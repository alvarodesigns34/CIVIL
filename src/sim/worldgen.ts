import { RNG } from '../core/rng';
import { Noise2D, clamp } from '../core/noise';
import { hexDistance, hexesInRange, neighbors, hexToPixel } from '../core/hex';
import type { Biome, Civ, DepositId, GameState, Settlement, Tile, FactionId } from './types';
import { FACTION_IDS, RES_IDS } from './types';
import { isLand, isWater, wildFood } from '../data/terrain';
import { CIV_COLORS, CULTURES, PEOPLE_SUFFIX, makeRoot, settlementName } from '../data/names';
import { claimTiles, idx, inBounds, tileAt, encodeExplored, reveal } from './world';
import { makeLeader, cultureOf } from './leaders';
import { emptyLedger } from './ledger';

export interface NewGameOpts {
  seed: number;
  size: 'small' | 'normal' | 'large';
  civs: number;
  civName: string;
  colorIndex: number;
  emblem: number;
  culture: string;
  difficulty: 'easy' | 'normal' | 'hard';
}

const SIZES = { small: [44, 30], normal: [58, 38], large: [74, 48] } as const;

export function generateWorld(opts: NewGameOpts): GameState {
  const rng = new RNG(opts.seed);
  const [W, H] = SIZES[opts.size];
  const nElev = new Noise2D(rng.int(0, 1e9));
  const nMoist = new Noise2D(rng.int(0, 1e9));
  const nWarp = new Noise2D(rng.int(0, 1e9));
  const nTemp = new Noise2D(rng.int(0, 1e9));

  const elev = new Float32Array(W * H);
  const moist = new Float32Array(W * H);
  const temp = new Float32Array(W * H);

  // Varios "núcleos" continentales para formas interesantes
  const cores: { x: number; y: number; r: number }[] = [];
  const nCores = rng.int(3, 5);
  for (let i = 0; i < nCores; i++) cores.push({ x: rng.range(0.18, 0.82), y: rng.range(0.2, 0.8), r: rng.range(0.22, 0.38) });

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const [px, py] = hexToPixel(c, r);
      const x = px / (W * 55.4), y = py / (H * 48);
      const wx = x + nWarp.fbm(x * 3, y * 3, 3) * 0.12;
      const wy = y + nWarp.fbm(x * 3 + 7, y * 3 + 3, 3) * 0.12;
      let core = 0;
      for (const k of cores) {
        const d = Math.hypot((wx - k.x) * 1.15, wy - k.y) / k.r;
        core = Math.max(core, 1 - d);
      }
      const edge = Math.min(x, 1 - x, y, 1 - y);
      const edgeFall = clamp(edge / 0.09, 0, 1);
      const e = (nElev.fbm(wx * 4.2, wy * 4.2, 5) * 0.65 + core * 0.75) * edgeFall - (1 - edgeFall) * 0.4;
      elev[r * W + c] = e;
      moist[r * W + c] = nMoist.fbm(x * 5, y * 5, 4) * 0.5 + 0.5;
      const lat = Math.abs(y - 0.5) * 2; // 0 ecuador, 1 polos
      temp[r * W + c] = 1 - lat * 1.05 + nTemp.fbm(x * 4, y * 4, 3) * 0.25;
    }
  }
  // Nivel del mar por percentil (≈44% tierra)
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const sea = sorted[Math.floor(sorted.length * 0.56)];
  const landVals = sorted.filter((v) => v > sea);
  const mountainT = landVals[Math.floor(landVals.length * 0.9)];
  const hillT = landVals[Math.floor(landVals.length * 0.7)];

  const tiles: Tile[] = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      const e = elev[i];
      const t: Tile = { biome: 'ocean', elev: 0, feature: 'none', river: 0, riverTo: -1, dep: null, owner: -1, sid: -1, b: null, road: 0 };
      if (e > sea) {
        const tp = temp[i] - (e - sea) * 0.35;
        const m = moist[i];
        let b: Biome;
        if (tp < 0.12) b = 'snow';
        else if (tp < 0.3) b = 'tundra';
        else if (tp > 0.7 && m < 0.42) b = 'desert';
        else if (m > 0.5) b = 'grass';
        else b = 'plains';
        t.biome = b;
        t.elev = e > mountainT ? 2 : e > hillT ? 1 : 0;
        if (b !== 'desert' && b !== 'snow' && t.elev < 2) {
          if (m > 0.56 || (b === 'tundra' && m > 0.45)) t.feature = 'forest';
          else if (m > 0.5 && rng.chance(0.25)) t.feature = 'forest';
        }
        if (b === 'snow') t.elev = Math.max(t.elev, 0) as 0 | 1 | 2;
      }
      tiles.push(t);
    }
  }

  const state: GameState = {
    version: 1, seed: opts.seed, rng: 0, year: 1, calendarStart: -rng.int(32, 38) * 100,
    width: W, height: H, tiles, civs: [], settlements: [], nextId: 1, player: 0, explored: '',
    events: { pending: [], cooldown: {}, fired: {}, chains: [], lastYear: 0 },
    chronicle: [], wonders: {}, armies: [], scouts: [], colonists: [],
    difficulty: opts.difficulty, gameOver: null, stats: { techsFirst: {} }, lastAutosave: 0,
  };

  // Clasificar agua: costa (junto a tierra), mar, profundo
  const landAt = (c: number, r: number) => inBounds(state, c, r) && isLand(tiles[r * W + c]);
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const t = tiles[r * W + c];
      if (isLand(t)) continue;
      const nearLand = neighbors(c, r).some(([nc, nr]) => landAt(nc, nr));
      if (nearLand) t.biome = 'coast';
      else {
        const near2 = hexesInRange(c, r, 2).some(([nc, nr]) => landAt(nc, nr));
        t.biome = near2 ? 'ocean' : 'deep';
      }
    }

  // Lagos: depresiones húmedas interiores
  const nLakes = Math.round((W * H) / 420);
  for (let k = 0; k < nLakes * 4 && k < 400; k++) {
    const c = rng.int(2, W - 3), r = rng.int(2, H - 3);
    const t = tiles[r * W + c];
    if (!isLand(t) || t.elev > 0 || moist[r * W + c] < 0.5) continue;
    if (neighbors(c, r).some(([nc, nr]) => !landAt(nc, nr))) continue;
    t.biome = 'lake';
    t.feature = 'none';
    if (rng.chance(0.4)) {
      const [nc, nr] = rng.pick(neighbors(c, r));
      const n = tiles[nr * W + nc];
      if (isLand(n) && n.elev === 0) { n.biome = 'lake'; n.feature = 'none'; }
    }
    if (--k < 0) break;
  }

  // Ríos: desde tierras altas húmedas, siguiendo la pendiente hasta el agua
  const nRivers = Math.round((W * H) / 110);
  let made = 0;
  for (let k = 0; k < 600 && made < nRivers; k++) {
    let c = rng.int(1, W - 2), r = rng.int(1, H - 2);
    const t0 = tiles[r * W + c];
    if (!isLand(t0) || t0.elev === 0 || moist[r * W + c] < 0.42 || t0.river) continue;
    const path: [number, number][] = [];
    const seen = new Set<number>();
    let ok = false;
    for (let step = 0; step < 40; step++) {
      path.push([c, r]);
      seen.add(r * W + c);
      let best = -1, bestE = Infinity, bestDir = -1;
      const ns = neighbors(c, r);
      for (let d = 0; d < 6; d++) {
        const [nc, nr] = ns[d];
        if (!inBounds(state, nc, nr) || seen.has(nr * W + nc)) continue;
        const nt = tiles[nr * W + nc];
        const ne = isWater(nt) ? -10 : nt.river ? elev[nr * W + nc] - 0.5 : elev[nr * W + nc];
        if (ne < bestE) { bestE = ne; best = nr * W + nc; bestDir = d; }
      }
      if (best < 0) break;
      const cur = tiles[r * W + c];
      cur.riverTo = bestDir;
      const nt = tiles[best];
      c = best % W; r = Math.floor(best / W);
      if (isWater(nt) || nt.river) { ok = true; break; }
    }
    if (ok && path.length >= 3) {
      path.forEach(([pc, pr], j) => {
        const pt = tiles[pr * W + pc];
        pt.river = Math.max(pt.river, 1 + j * 0.25);
        if (pt.elev === 2 && j > 0) pt.elev = 1;
      });
      // propagar caudal aguas abajo si se une a otro río
      let [lc, lr] = path[path.length - 1];
      let lt = tiles[lr * W + lc];
      let add = path.length * 0.25;
      let guard = 0;
      while (lt.river && lt.riverTo >= 0 && guard++ < 60) {
        const [nc, nr] = neighbors(lc, lr)[lt.riverTo];
        if (!inBounds(state, nc, nr)) break;
        lc = nc; lr = nr; lt = tiles[nr * W + nc];
        if (lt.river) lt.river += add;
      }
      made++;
    } else {
      for (const [pc, pr] of path) {
        const pt = tiles[pr * W + pc];
        if (!pt.river) pt.riverTo = -1;
      }
    }
  }
  // Marismas: llano junto a ríos/lagos muy húmedo
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const t = tiles[r * W + c];
      if (!isLand(t) || t.elev !== 0 || t.biome === 'desert' || t.biome === 'snow') continue;
      const wet = moist[r * W + c];
      if (wet > 0.6 && (t.river || neighbors(c, r).some(([nc, nr]) => inBounds(state, nc, nr) && tiles[nr * W + nc].biome === 'lake')) && rng.chance(0.35)) {
        t.feature = 'marsh';
      }
    }

  // Depósitos
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const t = tiles[r * W + c];
      const tp = temp[r * W + c];
      const roll = rng.next();
      let d: DepositId | null = null;
      if (t.biome === 'coast') {
        if (roll < 0.1) d = 'fish';
        else if (roll < 0.125 && tp > 0.55) d = 'pearls';
      } else if (t.biome === 'lake') {
        if (roll < 0.25) d = 'fish';
      } else if (isLand(t) && t.biome !== 'snow') {
        if (t.elev === 2) {
          if (roll < 0.08) d = 'iron';
          else if (roll < 0.13) d = 'gold';
          else if (roll < 0.17) d = 'gems';
        } else if (t.elev === 1) {
          if (roll < 0.09) d = 'copper';
          else if (roll < 0.15) d = 'iron';
          else if (roll < 0.2) d = 'marble';
          else if (roll < 0.23) d = 'gold';
          else if (roll < 0.27 && tp > 0.55 && t.biome !== 'desert') d = 'wine';
          else if (roll < 0.3 && t.biome === 'desert') d = 'salt';
        } else if (t.feature === 'forest') {
          if (roll < 0.1) d = 'deer';
          else if (roll < 0.14 && tp < 0.4) d = 'furs';
          else if (roll < 0.17 && tp > 0.62) d = 'silk';
          else if (roll < 0.2 && tp > 0.62) d = 'spices';
        } else if (t.feature === 'none') {
          if (t.biome === 'desert') {
            if (roll < 0.06) d = 'incense';
            else if (roll < 0.1) d = 'salt';
          } else if (t.biome === 'tundra') {
            if (roll < 0.08) d = 'furs';
            else if (roll < 0.12) d = 'deer';
          } else {
            if (roll < 0.06) d = 'wheat';
            else if (roll < 0.1) d = 'cattle';
            else if (roll < 0.135) d = 'horses';
            else if (roll < 0.15 && tp > 0.6) d = 'spices';
            else if (roll < 0.165 && tp > 0.5) d = 'wine';
          }
        }
      }
      t.dep = d;
    }

  // Civilizaciones
  const starts = pickStarts(state, rng, opts.civs, temp);
  const cultures = rng.shuffle(CULTURES.map((c) => c.id));
  const colors = CIV_COLORS.map((_, i) => i).filter((i) => i !== opts.colorIndex);
  rng.shuffle(colors);
  const personalities: Civ['personality'][] = rng.shuffle(['aggressive', 'merchant', 'pious', 'expansionist', 'scholarly', 'peaceful', 'aggressive', 'expansionist']);
  for (let i = 0; i < starts.length; i++) {
    const isPlayer = i === 0;
    const culture = isPlayer ? opts.culture : cultures.filter((x) => x !== opts.culture)[i % (cultures.length - 1)];
    const colorIdx = isPlayer ? opts.colorIndex : colors[(i - 1) % colors.length];
    const civ = createCiv(state, rng, i, isPlayer, culture, colorIdx, isPlayer ? opts.emblem : rng.int(0, 11), isPlayer ? personalities[0] : personalities[i % personalities.length], isPlayer ? opts.civName : '');
    civ.startCol = starts[i][0];
    civ.startRow = starts[i][1];
    state.civs.push(civ);
    foundSettlement(state, rng, civ, starts[i][0], starts[i][1], 50, true);
  }
  for (const a of state.civs) for (const b of state.civs) if (a !== b) a.relations[b.id] = newRelation();

  // Exploración inicial del jugador
  const p = state.civs[0];
  reveal(state, p.startCol, p.startRow, 5);
  encodeExplored(state);
  state.rng = rng.state;
  return state;
}

export function newRelation() {
  return { met: false, opinion: 0, state: 'peace' as const, trade: false, since: 0, truceUntil: 0, warScore: 0, warStart: 0, mods: [], lastDemand: -100 };
}

function startScore(state: GameState, c: number, r: number, temp: Float32Array) {
  const t = tileAt(state, c, r)!;
  if (!isLand(t) || t.elev === 2 || t.biome === 'snow' || t.biome === 'tundra' || t.feature === 'marsh') return -1;
  let sc = 0;
  let land = 0;
  for (const [hc, hr] of hexesInRange(c, r, 2)) {
    const n = tileAt(state, hc, hr);
    if (!n) continue;
    sc += wildFood(n);
    if (isLand(n)) land++;
    if (n.feature === 'forest') sc += 0.4;
    if (n.elev === 1) sc += 0.3;
    if (n.dep) sc += 0.6;
  }
  if (t.river) sc += 3;
  if (land < 10) sc -= 6;
  const tp = temp[r * state.width + c];
  if (tp < 0.35) sc -= 5;
  return sc;
}

function pickStarts(state: GameState, rng: RNG, n: number, temp: Float32Array): [number, number][] {
  const cands: { c: number; r: number; s: number }[] = [];
  for (let r = 3; r < state.height - 3; r++)
    for (let c = 3; c < state.width - 3; c++) {
      const s = startScore(state, c, r, temp);
      if (s > 8) cands.push({ c, r, s: s + rng.next() * 3 });
    }
  cands.sort((a, b) => b.s - a.s);
  let minD = Math.floor(Math.min(state.width, state.height) / 2.2);
  const out: [number, number][] = [];
  while (out.length < n && minD > 4) {
    for (const k of cands) {
      if (out.length >= n) break;
      if (out.every(([c, r]) => hexDistance(c, r, k.c, k.r) >= minD)) out.push([k.c, k.r]);
    }
    if (out.length < n) {
      minD -= 2;
      out.length = 0;
    }
  }
  // El jugador recibe un buen inicio pero no siempre el mejor: elegimos uno al azar entre los 3 primeros
  const pi = rng.int(0, Math.min(2, out.length - 1));
  [out[0], out[pi]] = [out[pi], out[0]];
  return out;
}

function createCiv(state: GameState, rng: RNG, id: number, isPlayer: boolean, culture: string, colorIdx: number, emblem: number, personality: Civ['personality'], customName: string): Civ {
  const civ: Civ = {
    id, name: '', people: '', adjective: '', color: CIV_COLORS[colorIdx][0], color2: CIV_COLORS[colorIdx][1], emblem, culture,
    isPlayer, alive: true, personality,
    res: Object.fromEntries(RES_IDS.map((r) => [r, 0])) as Civ['res'],
    knowledge: 0, research: null, techs: [], culturePts: 0, traditions: [], traditionOffer: null,
    government: 'tribal', govChanged: 0, policies: [],
    factions: Object.fromEntries(FACTION_IDS.map((f) => [f, 55])) as Record<FactionId, number>,
    stability: 60,
    leader: null as any, heir: null, modifiers: [], relations: {}, flags: {}, warWeariness: 0,
    soldiers: 0, strength: 0, legacy: 0, ambitionsDone: [], history: [], ledger: emptyLedger(),
    startCol: 0, startRow: 0, collapseYears: 0,
  };
  const cult = cultureOf(civ);
  const root = customName || cap(makeRoot(rng, cult));
  civ.name = root;
  civ.people = (root.toLowerCase().replace(/[aeiou]$/, '') + rng.pick(PEOPLE_SUFFIX));
  civ.adjective = civ.people.replace(/s$/, '');
  civ.res.food = 60;
  civ.res.wood = 30;
  civ.res.influence = 10;
  civ.leader = makeLeader(rng, civ, 1);
  if (!isPlayer && state.difficulty === 'hard') {
    civ.res.food += 40;
    civ.res.wood += 20;
  }
  return civ;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function foundSettlement(state: GameState, rng: RNG, civ: Civ, c: number, r: number, pop: number, capital: boolean, name?: string): Settlement {
  const st: Settlement = {
    id: state.nextId++, name: name ?? settlementName(rng, cultureOf(civ)), civ: civ.id, col: c, row: r, pop, founded: state.year,
    culture: 0, radius: capital ? 2 : 1, capital, health: 0, housing: 0, growth: 0, unrest: 0, siege: 0,
    workforce: 0, jobs: 0, employed: 0, garrison: 0, defense: 0, fort: 0, loyalty: 100, origCiv: civ.id,
  };
  const t = tileAt(state, c, r)!;
  t.feature = t.feature === 'marsh' ? 'none' : t.feature;
  t.b = null;
  t.road = 2;
  state.settlements.push(st);
  claimTiles(state, st);
  if (capital) {
    // Edificios iniciales: un campamento de caza y unas chozas
    placeInitial(state, st, 'hunters');
    placeInitial(state, st, 'hut');
    placeInitial(state, st, 'lumber');
  }
  return st;
}

function placeInitial(state: GameState, st: Settlement, type: string) {
  const ring = hexesInRange(st.col, st.row, 2).filter(([c, r]) => !(c === st.col && r === st.row));
  ring.sort((a, b) => hexDistance(st.col, st.row, a[0], a[1]) - hexDistance(st.col, st.row, b[0], b[1]));
  for (const [c, r] of ring) {
    const t = tileAt(state, c, r);
    if (!t || t.sid !== st.id || t.b || !isLand(t) || t.elev === 2) continue;
    if (type === 'hunters' && !(t.feature === 'forest' || t.dep === 'deer')) continue;
    if (type === 'lumber' && t.feature !== 'forest') continue;
    if (type === 'hut' && (t.feature === 'forest' || t.feature === 'marsh')) continue;
    t.b = { type, sid: st.id, progress: 1, staff: 0, built: 0 };
    return;
  }
  // Si no hay bosque, coloca chozas en su lugar
  if (type !== 'hut') {
    for (const [c, r] of ring) {
      const t = tileAt(state, c, r);
      if (!t || t.sid !== st.id || t.b || !isLand(t) || t.elev === 2) continue;
      if (type === 'hunters') {
        t.b = { type: 'hunters', sid: st.id, progress: 1, staff: 0, built: 0 };
        t.feature = 'forest';
        return;
      }
    }
  }
}

export { idx };
