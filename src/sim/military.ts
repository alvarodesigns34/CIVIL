// Guerra táctica: unidades que se mueven por el mapa en tiempo real, combaten, asedian y saquean.
import type { Civ, GameState, Settlement, Unit, ResId, Tile } from './types';
import { UNIT, UNITS, BARBARIAN, type UnitDef } from '../data/units';
import { RNG } from '../core/rng';
import { hexDistance, neighbors, hexesInRange } from '../core/hex';
import { tileAt, civSettlements, settlementById, settlementAt, capitalOf, getExplored, inBounds } from './world';
import { isLand, isWater } from '../data/terrain';
import { BUILDING } from '../data/buildings';
import { conquer, checkElimination, settlementDefense } from './war';
import { civFx } from './mods';
import { hasStrategic } from './economy';
import { civEra } from '../data/techs';
import { personName } from '../data/names';
import { cultureOf } from './leaders';

export function units(state: GameState): Unit[] {
  return (state.units ??= []);
}
export function civUnits(state: GameState, civ: number) {
  return units(state).filter((u) => u.civ === civ);
}
export function unitsAt(state: GameState, c: number, r: number) {
  return units(state).filter((u) => u.col === c && u.row === r);
}

// ¿Están en guerra estos dos bandos?
export function hostile(state: GameState, a: number, b: number) {
  if (a === b) return false;
  if (a === BARBARIAN || b === BARBARIAN) return true;
  return state.civs[a]?.relations[b]?.state === 'war';
}

export function canEnter(state: GameState, civ: number, t: Tile) {
  if (t.owner < 0 || t.owner === civ || civ === BARBARIAN) return true;
  const r = state.civs[civ]?.relations[t.owner];
  if (!r) return true;
  return r.state === 'war' || r.state === 'alliance' || !!(r as any).openBorders;
}

function moveCost(t: Tile, def: UnitDef) {
  if (isWater(t)) return 1.6;
  let c = 1;
  if (t.elev === 1) c = 1.6;
  if (t.elev === 2) c = 3;
  if (t.feature === 'forest') c += def.mounted ? 0.9 : 0.5;
  if (t.feature === 'marsh') c += 0.8;
  if (t.road) c *= 0.6;
  return c;
}

export function canSail(state: GameState, civ: number) {
  return civ !== BARBARIAN && !!state.civs[civ]?.techs.includes('sailing');
}

// A* para unidades: respeta fronteras cerradas y el agua (sólo costa/lago con Navegación)
export function unitPath(state: GameState, u: Unit, to: [number, number], maxNodes = 5000): [number, number][] | null {
  const def = UNIT[u.type];
  const sail = canSail(state, u.civ);
  const W = state.width;
  const key = (c: number, r: number) => r * W + c;
  const open: { c: number; r: number; f: number; g: number }[] = [{ c: u.col, r: u.row, f: 0, g: 0 }];
  const came = new Map<number, number>();
  const g = new Map<number, number>([[key(u.col, u.row), 0]]);
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.c === to[0] && cur.r === to[1]) {
      const path: [number, number][] = [];
      let k = key(cur.c, cur.r);
      while (k !== key(u.col, u.row)) {
        path.push([k % W, Math.floor(k / W)]);
        k = came.get(k)!;
      }
      return path.reverse();
    }
    for (const [nc, nr] of neighbors(cur.c, cur.r)) {
      const t = tileAt(state, nc, nr);
      if (!t) continue;
      const isDest = nc === to[0] && nr === to[1];
      if (isWater(t) && !(sail && (t.biome === 'coast' || t.biome === 'lake'))) continue;
      if (!isDest && !canEnter(state, u.civ, t)) continue;
      const cost = moveCost(t, def);
      const gg = cur.g + cost;
      const k = key(nc, nr);
      if (gg < (g.get(k) ?? Infinity)) {
        g.set(k, gg);
        came.set(k, key(cur.c, cur.r));
        open.push({ c: nc, r: nr, g: gg, f: gg + hexDistance(nc, nr, to[0], to[1]) * 0.9 });
      }
    }
  }
  return null;
}

export function orderMove(state: GameState, us: Unit[], to: [number, number], order: Unit['order'] = 'move', targetSid = -1): boolean {
  let ok = false;
  for (const u of us) {
    const p = unitPath(state, u, to);
    if (!p) continue;
    // si el destino es un asentamiento enemigo o una unidad enemiga, parar en la casilla anterior
    u.path = p;
    u.prog = 0;
    u.order = order;
    u.targetSid = targetSid;
    u.engaged = 0;
    ok = true;
  }
  return ok;
}

// ───────────────────── Fuerza y modificadores
function xpMult(u: Unit) {
  return 1 + Math.min(0.5, Math.floor(u.xp / 10) * 0.05);
}
function civMult(state: GameState, civ: number) {
  if (civ === BARBARIAN) return 1 + civEraWorld(state) * 0.35;
  const c = state.civs[civ];
  const fx = civFx(state, c);
  return (1 + fx.military) * (c.stability < 30 ? 0.85 : 1);
}
function civEraWorld(state: GameState) {
  return Math.max(0, ...state.civs.filter((c) => c.alive).map((c) => civEra(c.techs))) * 0.6;
}
const fxCache = new Map<number, { year: number; v: number }>();
function cachedCivMult(state: GameState, civ: number) {
  const h = fxCache.get(civ);
  if (h && h.year === state.year) return h.v;
  const v = civMult(state, civ);
  fxCache.set(civ, { year: state.year, v });
  return v;
}

export function unitPower(state: GameState, u: Unit) {
  const d = UNIT[u.type];
  return ((d.atk + d.def) / 2) * (u.hp / 100) * xpMult(u) * cachedCivMult(state, u.civ);
}
export function armyPower(state: GameState, civ: number) {
  return civUnits(state, civ).reduce((a, u) => a + unitPower(state, u), 0);
}

function attackValue(state: GameState, a: Unit, target: Unit | null) {
  const d = UNIT[a.type];
  let v = d.atk * xpMult(a) * cachedCivMult(state, a.civ) * (0.35 + 0.65 * a.hp / 100);
  if (target) {
    const td = UNIT[target.type];
    if (d.antiMounted && td.mounted) v *= 2;
    const t = tileAt(state, a.col, a.row)!;
    if (d.mounted && (t.elev > 0 || t.feature === 'forest')) v *= 0.8;
  }
  return v;
}
function defenseValue(state: GameState, u: Unit, vs: Unit | null) {
  const d = UNIT[u.type];
  let v = d.def * xpMult(u) * cachedCivMult(state, u.civ) * (0.35 + 0.65 * u.hp / 100);
  const t = tileAt(state, u.col, u.row)!;
  if (t.elev === 1) v *= 1.25;
  if (t.elev === 2) v *= 1.4;
  if (t.feature === 'forest') v *= 1.15;
  if (u.order === 'fortify') v *= 1.3;
  const s = settlementAt(state, u.col, u.row);
  if (s && s.civ === u.civ) v *= 1 + s.fort * 0.25;
  if (vs && d.antiMounted && UNIT[vs.type].mounted) v *= 1.6;
  return v;
}

// ───────────────────── Paso de simulación continuo
export interface BattleFx { x0c: number; x0r: number; x1c: number; x1r: number; kind: 'melee' | 'arrow' | 'stone' | 'shot'; }
export const battleLog: { a: number; b: number; kind: BattleFx['kind'] }[] = []; // para efectos visuales (ids unidad atacante y objetivo; objetivo<0 = asentamiento)
export const deathLog: { civ: number; col: number; row: number; type: string; killer: number }[] = [];

export function stepMilitary(state: GameState, dt: number) {
  if (dt <= 0) return;
  const list = units(state);
  // índice por casilla
  const byTile = new Map<number, Unit[]>();
  for (const u of list) {
    const k = u.row * state.width + u.col;
    (byTile.get(k) ?? byTile.set(k, []).get(k)!).push(u);
  }
  const enemyNear = (u: Unit, range: number): Unit | null => {
    let best: Unit | null = null, bh = Infinity;
    for (const [c, r] of hexesInRange(u.col, u.row, range)) {
      if (!inBounds(state, c, r)) continue;
      const here = byTile.get(r * state.width + c);
      if (!here) continue;
      for (const o of here) if (o.hp > 0 && hostile(state, u.civ, o.civ) && o.hp < bh) { best = o; bh = o.hp; }
    }
    return best;
  };
  const winter = (state.year % 1) >= 0; // marcador (el invierno visual no afecta aquí)
  void winter;

  for (const u of list) {
    if (u.hp <= 0) continue;
    const d = UNIT[u.type];
    const range = d.ranged ? 2 : 1;
    const foe = enemyNear(u, range);
    // asentamiento enemigo adyacente
    let foeCity: Settlement | null = null;
    for (const [c, r] of neighbors(u.col, u.row)) {
      const s = settlementAt(state, c, r);
      if (s && hostile(state, u.civ, s.civ)) { foeCity = s; break; }
    }
    if (!foeCity && d.ranged) {
      for (const [c, r] of hexesInRange(u.col, u.row, 2)) {
        const s = inBounds(state, c, r) ? settlementAt(state, c, r) : undefined;
        if (s && hostile(state, u.civ, s.civ)) { foeCity = s; break; }
      }
    }
    const pathTarget = u.path.length ? u.path[0] : null;
    const blockedByFoe = foe && (hexDistance(u.col, u.row, foe.col, foe.row) <= 1 || !pathTarget);

    if (foe && (blockedByFoe || d.ranged || u.order !== 'move')) {
      // combate contra unidades
      u.engaged = foe.id;
      const atk = attackValue(state, u, foe);
      const def = defenseValue(state, foe, u);
      const dmg = 62 * Math.pow(atk / Math.max(0.5, def), 0.85) * dt;
      foe.hp -= dmg;
      u.xp += dmg * 0.08;
      if (Math.random() < dt * 6) battleLog.push({ a: u.id, b: foe.id, kind: d.ranged ? (d.siege ? 'stone' : d.glyph === 'gun' ? 'shot' : 'arrow') : 'melee' });
      if (foe.hp <= 0) killUnit(state, foe, u.civ);
      continue;
    }
    if (foeCity && (u.order === 'campaign' || u.order === 'fortify' || u.order === 'idle' || (u.path.length && u.path[u.path.length - 1][0] === foeCity.col && u.path[u.path.length - 1][1] === foeCity.row) || (pathTarget && pathTarget[0] === foeCity.col && pathTarget[1] === foeCity.row))) {
      u.engaged = -foeCity.id;
      siegeTick(state, u, foeCity, dt);
      continue;
    }
    u.engaged = 0;

    // saqueo
    if (u.order === 'raid' || (u.civ === BARBARIAN && !u.path.length)) {
      const t = tileAt(state, u.col, u.row)!;
      if (t.b && t.owner >= 0 && hostile(state, u.civ, t.owner) && t.b.progress >= 1 && !BUILDING[t.b.type].wonder) {
        u.raidT += dt;
        if (u.raidT > 0.4) {
          u.raidT = 0;
          pillage(state, u, t);
        }
        continue;
      }
    }

    // movimiento
    if (u.path.length) {
      const [nc, nr] = u.path[0];
      const nt = tileAt(state, nc, nr);
      if (!nt) { u.path = []; continue; }
      const occupiedByFoe = (byTile.get(nr * state.width + nc) ?? []).some((o) => o.hp > 0 && hostile(state, u.civ, o.civ));
      const city = settlementAt(state, nc, nr);
      if (occupiedByFoe) continue; // se combatirá en el siguiente paso
      if (city && hostile(state, u.civ, city.civ)) {
        // entrar sólo si las defensas han caído
        if ((city.defHp ?? 1) > 0) continue;
        if (u.civ === BARBARIAN) { plunderCity(state, u, city); u.path = []; continue; }
        if (!UNIT[u.type].siege || true) {
          conquer(state, state.civs[u.civ], city, new RNG((state.rng ^ u.id) >>> 0));
          city.defHp = 30;
        }
      }
      const spd = d.speed * (state.civs[u.civ]?.techs.includes('wheel') ? 1.1 : 1);
      u.prog += (dt * spd) / moveCost(nt, d);
      if (u.prog >= 1) {
        u.prog = 0;
        const k0 = u.row * state.width + u.col;
        const arr = byTile.get(k0);
        if (arr) arr.splice(arr.indexOf(u), 1);
        u.col = nc;
        u.row = nr;
        u.path.shift();
        (byTile.get(nr * state.width + nc) ?? byTile.set(nr * state.width + nc, []).get(nr * state.width + nc)!).push(u);
        if (state.civs[u.civ]?.isPlayer) revealAround(state, u.col, u.row, 2);
        // campamento bárbaro
        if (u.civ !== BARBARIAN) destroyCampAt(state, u);
        if (!u.path.length && u.order === 'move') u.order = 'idle';
      }
      continue;
    }

    // abastecimiento y curación
    const t = tileAt(state, u.col, u.row)!;
    const home = t.owner === u.civ || (t.owner >= 0 && state.civs[u.civ]?.relations[t.owner]?.state === 'alliance');
    if (home) u.hp = Math.min(100, u.hp + (settlementAt(state, u.col, u.row) ? 35 : 18) * dt);
    else if (u.civ !== BARBARIAN) u.hp -= 5 * dt;
    if (u.hp <= 0) killUnit(state, u, -2);
  }
  // abastecimiento en marcha (fuera de casa) también desgasta
  for (const u of list) {
    if (u.hp <= 0 || !u.path.length || u.civ === BARBARIAN) continue;
    const t = tileAt(state, u.col, u.row)!;
    if (t.owner !== u.civ) u.hp -= 2.5 * dt;
  }
  state.units = list.filter((u) => u.hp > 0);
  // las defensas se reparan si nadie las ataca
  for (const s of state.settlements) {
    const max = defMax(state, s);
    if ((s as any)._hit) { (s as any)._hit = false; s.siege = Math.max(s.siege, 1); }
    else {
      s.defHp = Math.min(max, (s.defHp ?? max) + max * 0.25 * dt);
      if (s.siege > 0 && (s.defHp ?? 0) >= max * 0.99) s.siege = 0;
    }
  }
}

function revealAround(state: GameState, c: number, r: number, rad: number) {
  const ex = getExplored(state);
  for (const [hc, hr] of hexesInRange(c, r, rad)) if (inBounds(state, hc, hr)) ex[hr * state.width + hc] = 1;
}

export function defMax(state: GameState, s: Settlement) {
  const civ = state.civs[s.civ];
  return Math.round(60 + settlementDefense(state, civ, s) * 5);
}

function siegeTick(state: GameState, u: Unit, s: Settlement, dt: number) {
  const d = UNIT[u.type];
  const max = defMax(state, s);
  if (s.defHp == null) s.defHp = max;
  const atk = attackValue(state, u, null) * (d.siege ?? 1);
  s.defHp = Math.max(0, s.defHp - atk * 3 * dt);
  (s as any)._hit = true;
  u.xp += dt * 2;
  if (Math.random() < dt * 5) battleLog.push({ a: u.id, b: -s.id, kind: d.siege ? 'stone' : d.ranged ? (d.glyph === 'gun' ? 'shot' : 'arrow') : 'melee' });
  // la ciudad responde
  const civ = state.civs[s.civ];
  const ret = settlementDefense(state, civ, s) * 2.2 * (s.defHp > 0 ? 1 : 0.4);
  if (!(d.ranged && hexDistance(u.col, u.row, s.col, s.row) > 1)) u.hp -= (ret / Math.max(1, defenseValue(state, u, null))) * 9 * dt;
  if (u.hp <= 0) killUnit(state, u, s.civ);
  // asalto final: unidad cuerpo a cuerpo adyacente con las defensas por los suelos
  if (s.defHp <= 0 && !d.ranged && hexDistance(u.col, u.row, s.col, s.row) === 1) {
    const defenders = unitsAt(state, s.col, s.row).filter((o) => o.hp > 0 && o.civ === s.civ);
    if (!defenders.length) {
      if (u.civ === BARBARIAN) plunderCity(state, u, s);
      else {
        conquer(state, state.civs[u.civ], s, new RNG((state.rng ^ u.id) >>> 0));
        s.defHp = 25;
        // la unidad entra en la ciudad
        u.col = s.col; u.row = s.row; u.path = []; u.order = 'fortify';
        const ra = state.civs[u.civ].relations[civ.id];
        if (ra) { ra.warScore = Math.min(100, ra.warScore + 20); civ.relations[u.civ].warScore = -ra.warScore; }
      }
    }
  }
}

function pillage(state: GameState, u: Unit, t: Tile) {
  const owner = state.civs[t.owner];
  const def = BUILDING[t.b!.type];
  const loot = Math.round(8 + def.time * 6);
  owner.res.gold = Math.max(0, owner.res.gold - loot);
  owner.res.food = Math.max(0, owner.res.food - loot);
  if (u.civ !== BARBARIAN) { state.civs[u.civ].res.gold += loot; state.civs[u.civ].res.food += loot * 0.6; }
  t.b!.progress = 0.4; // dañado: hay que repararlo
  u.xp += 3;
  const r = u.civ !== BARBARIAN ? state.civs[u.civ].relations[owner.id] : null;
  if (r) { r.warScore = Math.min(100, r.warScore + 3); owner.relations[u.civ].warScore = -r.warScore; }
  battleLog.push({ a: u.id, b: 0, kind: 'melee' });
  if (owner.isPlayer || state.civs[u.civ]?.isPlayer) state.chronicle.push({ year: state.year, civ: owner.id, kind: 'war', text: `${u.civ === BARBARIAN ? 'Los bárbaros' : `Los ${state.civs[u.civ].people}`} saquearon ${def.name.toLowerCase()} de los ${owner.people}.` });
}

function plunderCity(state: GameState, u: Unit, s: Settlement) {
  const owner = state.civs[s.civ];
  const g = Math.min(owner.res.gold, 20 + owner.res.gold * 0.3);
  owner.res.gold -= g;
  owner.res.food = Math.max(0, owner.res.food * 0.7);
  s.pop *= 0.9;
  s.unrest = Math.min(100, s.unrest + 25);
  s.defHp = defMax(state, s) * 0.3;
  u.hp -= 30;
  state.chronicle.push({ year: state.year, civ: owner.id, kind: 'war', important: owner.isPlayer, text: `Los bárbaros saquearon ${s.name} y se llevaron ${Math.round(g)} de oro.` });
  // los saqueadores se retiran
  u.path = [];
  u.order = 'idle';
}

export function killUnit(state: GameState, u: Unit, killer: number) {
  u.hp = 0;
  deathLog.push({ civ: u.civ, col: u.col, row: u.row, type: u.type, killer });
  if (killer >= 0 && u.civ >= 0) {
    const r = state.civs[killer]?.relations[u.civ];
    if (r) { r.warScore = Math.min(100, r.warScore + 5); state.civs[u.civ].relations[killer].warScore = -r.warScore; }
    state.civs[u.civ].warWeariness = Math.min(40, state.civs[u.civ].warWeariness + 1);
  }
  const pl = state.civs[state.player];
  if (u.civ === pl.id || killer === pl.id) {
    const who = u.civ === BARBARIAN ? 'una banda bárbara' : u.civ === pl.id ? `nuestro regimiento «${u.name}»` : `un regimiento de los ${state.civs[u.civ].people}`;
    state.chronicle.push({ year: state.year, civ: pl.id, kind: 'war', text: u.civ === pl.id ? `Cayó ${who} (${UNIT[u.type].name}).` : `Nuestras tropas aniquilaron a ${who}.` });
  }
}

// ───────────────────── Reclutamiento
export function recruitable(state: GameState, civ: Civ, s: Settlement): { def: UnitDef; ok: boolean; why?: string }[] {
  const era = civEra(civ.techs);
  const hasBarracks = [...hexesInRange(s.col, s.row, 4)].some(([c, r]) => { const t = tileAt(state, c, r); return t?.sid === s.id && t.b && (t.b.type === 'barracks' || t.b.type === 'stables') && t.b.progress >= 1; });
  return UNITS.filter((d) => d.id !== 'raiders' && (!d.tech || civ.techs.includes(d.tech)) && d.era <= era + 1)
    .map((d) => {
      if (d.barracks && !hasBarracks) return { def: d, ok: false, why: 'Necesita un cuartel en esta ciudad' };
      if (d.needs && !d.needs.every((x) => hasStrategic(state, civ, x))) return { def: d, ok: false, why: `Necesita ${d.needs.map((x) => ({ copper: 'cobre', iron: 'hierro', horses: 'caballos' } as any)[x] ?? x).join(' y ')}` };
      if (s.pop < d.pop + 15) return { def: d, ok: false, why: 'Población insuficiente' };
      for (const [k, v] of Object.entries(d.cost)) if (civ.res[k as ResId] < (v as number)) return { def: d, ok: false, why: 'Recursos insuficientes' };
      return { def: d, ok: true };
    })
    // ocultar unidades obsoletas: si hay una mejor del mismo papel
    .filter((x, _, all) => !all.some((y) => y.def.glyph !== x.def.glyph && false));
}

export function recruit(state: GameState, civ: Civ, s: Settlement, type: string): string | null {
  const opt = recruitable(state, civ, s).find((x) => x.def.id === type);
  if (!opt) return 'No disponible';
  if (!opt.ok) return opt.why ?? 'No disponible';
  if ((s.queue?.length ?? 0) >= 3) return 'Cola de reclutamiento llena (máx. 3)';
  for (const [k, v] of Object.entries(opt.def.cost)) civ.res[k as ResId] -= v as number;
  s.pop -= opt.def.pop;
  (s.queue ??= []).push({ type, prog: 0 });
  return null;
}

let unitCounter = 0;
export function spawnUnit(state: GameState, civ: number, type: string, c: number, r: number, home = -1): Unit {
  const n = ++unitCounter + civUnits(state, civ).length;
  const ord = ['1.ª', '2.ª', '3.ª', '4.ª', '5.ª', '6.ª', '7.ª', '8.ª', '9.ª', '10.ª'][n % 10];
  const homeS = home >= 0 ? settlementById(state, home) : null;
  const u: Unit = {
    id: state.nextId++, civ, type, col: c, row: r, hp: 100, xp: 0, path: [], prog: 0, order: 'idle', targetSid: -1, engaged: 0,
    name: civ === BARBARIAN ? 'Horda' : `${ord} de ${homeS?.name ?? UNIT[type].name}`, home, raidT: 0,
  };
  units(state).push(u);
  return u;
}

export function disband(state: GameState, u: Unit) {
  const t = tileAt(state, u.col, u.row)!;
  if (t.owner === u.civ && t.sid >= 0) {
    const s = settlementById(state, t.sid);
    if (s) s.pop += UNIT[u.type].pop * 0.8 * (u.hp / 100);
  }
  state.units = units(state).filter((x) => x !== u);
}

// Anual: reclutamiento, mantenimiento, bárbaros, IA
export function yearlyMilitary(state: GameState, rng: RNG) {
  for (const s of state.settlements) {
    if (!s.queue?.length) continue;
    const q = s.queue[0];
    const d = UNIT[q.type];
    q.prog += 1 / Math.max(1, d.time);
    if (q.prog >= 0.999) {
      s.queue.shift();
      const u = spawnUnit(state, s.civ, q.type, s.col, s.row, s.id);
      if (state.civs[s.civ].isPlayer) state.chronicle.push({ year: state.year, civ: s.civ, kind: 'war', text: `${s.name} formó un regimiento de ${d.name.toLowerCase()}.` });
      void u;
    }
  }
  // mantenimiento
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    const us = civUnits(state, civ.id);
    const up = us.reduce((a, u) => a + UNIT[u.type].upkeep, 0) * (1 + civEra(civ.techs) * 0.15);
    civ.res.gold -= up;
    if (up) {
      const m = (civ.ledger.expense.gold ??= {});
      m['Ejércitos'] = up;
      civ.ledger.net.gold -= up;
    }
    if (civ.res.gold < 0) {
      civ.res.gold = 0;
      for (const u of us) u.hp -= 20; // deserciones
      civ.stability = Math.max(0, civ.stability - 3);
    }
    // unidades de civilizaciones muertas desaparecen
  }
  state.units = units(state).filter((u) => u.hp > 0 && (u.civ === BARBARIAN || state.civs[u.civ]?.alive));
  yearlyBarbarians(state, rng);
  for (const civ of state.civs) if (civ.alive && !civ.isPlayer) aiMilitary(state, civ, rng);
}

// ───────────────────── Bárbaros
function yearlyBarbarians(state: GameState, rng: RNG) {
  const camps = (state.camps ??= []);
  const worldEra = Math.max(0, ...state.civs.filter((c) => c.alive).map((c) => civEra(c.techs)));
  // aparición de campamentos en tierras de nadie
  if (worldEra <= 3 && camps.length < 2 + Math.floor(state.width / 25) && rng.chance(0.06) && state.year > 15) {
    for (let k = 0; k < 60; k++) {
      const c = rng.int(1, state.width - 2), r = rng.int(1, state.height - 2);
      const t = tileAt(state, c, r)!;
      if (!isLand(t) || t.owner >= 0 || t.elev === 2 || t.biome === 'snow') continue;
      if (state.settlements.some((s) => hexDistance(s.col, s.row, c, r) < 6)) continue;
      if (camps.some((x) => hexDistance(x.col, x.row, c, r) < 8)) continue;
      camps.push({ id: state.nextId++, col: c, row: r, timer: rng.int(3, 8), level: worldEra });
      break;
    }
  }
  // generación de saqueadores
  for (const camp of camps) {
    camp.timer -= 1;
    if (camp.timer > 0) continue;
    camp.timer = rng.int(9, 16);
    const mine = units(state).filter((u) => u.civ === BARBARIAN && hexDistance(u.col, u.row, camp.col, camp.row) < 12);
    if (mine.length >= 2 + camp.level) continue;
    const u = spawnUnit(state, BARBARIAN, 'raiders', camp.col, camp.row);
    u.hp = 80 + camp.level * 10;
    // objetivo: el asentamiento más cercano
    let best: Settlement | null = null, bd = 13;
    for (const s of state.settlements) {
      const d = hexDistance(s.col, s.row, camp.col, camp.row);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) {
      // primero una casilla con edificios cerca de la ciudad, para saquear
      const tgt = hexesInRange(best.col, best.row, 2).find(([c, r]) => { const t = tileAt(state, c, r); return t?.b && t.sid === best!.id; }) ?? [best.col, best.row];
      const p = unitPath(state, u, tgt as [number, number]);
      if (p) { u.path = p; u.order = 'raid'; }
    }
  }
  // los bárbaros sin objetivo vuelven a buscar
  for (const u of units(state)) {
    if (u.civ !== BARBARIAN || u.path.length || u.engaged) continue;
    if (Math.random() < 0.3) {
      let best: Settlement | null = null, bd = 12;
      for (const s of state.settlements) {
        const d = hexDistance(s.col, s.row, u.col, u.row);
        if (d < bd) { bd = d; best = s; }
      }
      if (best) {
        const near = hexesInRange(best.col, best.row, 2).filter(([c, r]) => { const t = tileAt(state, c, r); return t?.b && t.sid === best!.id && t.b.progress >= 1; });
        const tgt = near.length ? near[Math.floor(Math.random() * near.length)] : [best.col, best.row];
        const p = unitPath(state, u, tgt as [number, number]);
        if (p) { u.path = p; u.order = 'raid'; }
      }
    }
  }
}

function destroyCampAt(state: GameState, u: Unit) {
  const camps = state.camps ?? [];
  const camp = camps.find((c) => c.col === u.col && c.row === u.row);
  if (!camp) return;
  if (unitsAt(state, u.col, u.row).some((o) => o.civ === BARBARIAN && o.hp > 0)) return;
  state.camps = camps.filter((c) => c !== camp);
  const civ = state.civs[u.civ];
  const reward = 30 + 25 * civEra(civ.techs);
  civ.res.gold += reward;
  civ.legacy += 5;
  u.xp += 10;
  state.chronicle.push({ year: state.year, civ: civ.id, kind: 'war', important: civ.isPlayer, text: `Los ${civ.people} arrasaron un campamento bárbaro y obtuvieron ${reward} de oro.` });
  campLog.push({ civ: civ.id, reward });
}
export const campLog: { civ: number; reward: number }[] = [];

// ───────────────────── IA militar
export function aiMilitary(state: GameState, civ: Civ, rng: RNG) {
  const mine = civUnits(state, civ.id);
  const sets = civSettlements(state, civ.id);
  if (!sets.length) return;
  const pop = sets.reduce((a, s) => a + s.pop, 0);
  const era = civEra(civ.techs);
  const enemies = state.civs.filter((o) => o.alive && o.id !== civ.id && civ.relations[o.id]?.state === 'war');
  const pers = civ.personality;
  const want = Math.round((pop / (pers === 'aggressive' ? 70 : pers === 'expansionist' ? 90 : pers === 'peaceful' ? 160 : 120)) * (enemies.length ? 1.6 : 1)) + (era >= 1 ? 1 : 0);
  // reclutar
  const queued = sets.reduce((a, s) => a + (s.queue?.length ?? 0), 0);
  if (mine.length + queued < want && rng.chance(0.6)) {
    const s = [...sets].sort((a, b) => b.pop - a.pop)[0];
    const opts = recruitable(state, civ, s).filter((x) => x.ok);
    if (opts.length) {
      // composición: mejor cuerpo a cuerpo, algo a distancia, montada y asedio en guerra
      const roll = rng.next();
      const pickBest = (f: (d: UnitDef) => boolean) => opts.filter((x) => f(x.def)).sort((a, b) => b.def.atk + b.def.def - (a.def.atk + a.def.def))[0];
      const choice = (roll < 0.5 && pickBest((d) => !d.ranged && !d.mounted)) || (roll < 0.72 && pickBest((d) => !!d.ranged && !d.siege)) || (roll < 0.88 && pickBest((d) => !!d.mounted)) || (enemies.length && pickBest((d) => !!d.siege)) || opts[0];
      if (choice) recruit(state, civ, s, choice.def.id);
    }
  }
  // defensa: interceptar enemigos en el territorio
  const intruders = units(state).filter((u) => hostile(state, civ.id, u.civ) && tileAt(state, u.col, u.row)?.owner === civ.id);
  for (const intr of intruders.slice(0, 2)) {
    const free = mine.filter((u) => !u.path.length && !u.engaged && u.order !== 'campaign').sort((a, b) => hexDistance(a.col, a.row, intr.col, intr.row) - hexDistance(b.col, b.row, intr.col, intr.row)).slice(0, 2);
    orderMove(state, free, [intr.col, intr.row], 'move');
  }
  // campamentos bárbaros cercanos
  for (const camp of state.camps ?? []) {
    if (!sets.some((s) => hexDistance(s.col, s.row, camp.col, camp.row) <= 8)) continue;
    const free = mine.filter((u) => !u.path.length && !u.engaged && u.order !== 'campaign' && u.hp > 70);
    if (free.length >= 2 && rng.chance(0.3)) orderMove(state, free.slice(0, 2), [camp.col, camp.row], 'move');
  }
  // ofensiva
  if (enemies.length) {
    const free = mine.filter((u) => u.order !== 'campaign' && !u.engaged && u.hp > 60);
    const army = mine.filter((u) => u.order === 'campaign');
    if (!army.length && free.length >= Math.max(2, Math.floor(want * 0.6))) {
      let best: { s: Settlement; d: number } | null = null;
      for (const e of enemies)
        for (const ts of civSettlements(state, e.id))
          for (const fs of sets) {
            const d = hexDistance(fs.col, fs.row, ts.col, ts.row) + (ts.fort * 2);
            if (!best || d < best.d) best = { s: ts, d };
          }
      if (best && best.d < 20) {
        const go = free.slice(0, Math.max(3, Math.floor(free.length * 0.75)));
        orderMove(state, go, [best.s.col, best.s.row], 'campaign', best.s.id);
      }
    }
    // reasignar objetivos perdidos
    for (const u of army) if (!u.path.length && !u.engaged) {
      const t = settlementById(state, u.targetSid);
      if (!t || !hostile(state, civ.id, t.civ)) { u.order = 'idle'; u.targetSid = -1; }
      else orderMove(state, [u], [t.col, t.row], 'campaign', t.id);
    }
  } else {
    // en paz: volver a casa y fortificarse
    for (const u of mine) {
      if (u.order === 'campaign') u.order = 'idle';
      if (!u.path.length && !u.engaged && u.order === 'idle') {
        const t = tileAt(state, u.col, u.row)!;
        if (t.owner !== civ.id) {
          const home = sets.sort((a, b) => hexDistance(a.col, a.row, u.col, u.row) - hexDistance(b.col, b.row, u.col, u.row))[0];
          orderMove(state, [u], [home.col, home.row], 'move');
        } else u.order = 'fortify';
      }
    }
  }
}

export function capitalFor(state: GameState, civ: number) {
  return capitalOf(state, civ);
}
export { personName, cultureOf };
