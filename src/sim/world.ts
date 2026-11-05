import type { GameState, Settlement, Tile, Civ } from './types';
import { hexDistance, hexesInRange, neighbors } from '../core/hex';
import { isLand } from '../data/terrain';

export function idx(s: GameState, c: number, r: number) {
  return r * s.width + c;
}
export function inBounds(s: GameState, c: number, r: number) {
  return c >= 0 && r >= 0 && c < s.width && r < s.height;
}
export function tileAt(s: GameState, c: number, r: number): Tile | undefined {
  if (!inBounds(s, c, r)) return undefined;
  return s.tiles[r * s.width + c];
}
export function nbrTiles(s: GameState, c: number, r: number): Tile[] {
  const out: Tile[] = [];
  for (const [nc, nr] of neighbors(c, r)) {
    const t = tileAt(s, nc, nr);
    if (t) out.push(t);
  }
  return out;
}

export function settlementById(s: GameState, id: number): Settlement | undefined {
  return s.settlements.find((x) => x.id === id);
}
export function civSettlements(s: GameState, civ: number): Settlement[] {
  return s.settlements.filter((x) => x.civ === civ);
}
export function capitalOf(s: GameState, civ: number): Settlement | undefined {
  return s.settlements.find((x) => x.civ === civ && x.capital) ?? s.settlements.find((x) => x.civ === civ);
}
export function settlementAt(s: GameState, c: number, r: number): Settlement | undefined {
  return s.settlements.find((x) => x.col === c && x.row === r);
}

// Reclama casillas dentro del radio del asentamiento que no tengan dueño
export function claimTiles(s: GameState, st: Settlement) {
  for (const [c, r] of hexesInRange(st.col, st.row, st.radius)) {
    const t = tileAt(s, c, r);
    if (!t) continue;
    if (t.owner === -1 || (t.owner === st.civ && t.sid === -1)) {
      t.owner = st.civ;
      t.sid = st.id;
    }
  }
  const center = tileAt(s, st.col, st.row)!;
  center.owner = st.civ;
  center.sid = st.id;
}

export function tilesOfSettlement(s: GameState, st: Settlement): [number, number, Tile][] {
  const out: [number, number, Tile][] = [];
  for (const [c, r] of hexesInRange(st.col, st.row, Math.max(st.radius, 4))) {
    const t = tileAt(s, c, r);
    if (t && t.sid === st.id) out.push([c, r, t]);
  }
  return out;
}

export function canFoundAt(s: GameState, civ: Civ, c: number, r: number): string | null {
  const t = tileAt(s, c, r);
  if (!t) return 'Fuera del mapa';
  if (!isLand(t) || t.elev === 2 || t.biome === 'snow') return 'El terreno no es apto';
  if (t.owner !== -1 && t.owner !== civ.id) return 'Territorio ajeno';
  if (t.b) return 'La casilla está ocupada';
  for (const st of s.settlements) {
    if (hexDistance(st.col, st.row, c, r) < 4) return 'Demasiado cerca de otro asentamiento';
  }
  for (const col of s.colonists) {
    if (hexDistance(col.col, col.row, c, r) < 4) return 'Ya hay colonos en camino cerca';
  }
  const own = civSettlements(s, civ.id);
  const near = own.some((st) => hexDistance(st.col, st.row, c, r) <= 9);
  if (!near) return 'Demasiado lejos de tus asentamientos (máx. 9 casillas)';
  return null;
}

export function landPath(s: GameState, from: [number, number], to: [number, number], allowWater = false, maxNodes = 4000): [number, number][] | null {
  // A* sencillo sobre la rejilla hexagonal
  const key = (c: number, r: number) => r * s.width + c;
  const open: { c: number; r: number; f: number; g: number }[] = [{ c: from[0], r: from[1], f: 0, g: 0 }];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[key(from[0], from[1]), 0]]);
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.c === to[0] && cur.r === to[1]) {
      const path: [number, number][] = [[cur.c, cur.r]];
      let k = key(cur.c, cur.r);
      while (came.has(k)) {
        k = came.get(k)!;
        path.push([k % s.width, Math.floor(k / s.width)]);
      }
      return path.reverse();
    }
    for (const [nc, nr] of neighbors(cur.c, cur.r)) {
      const t = tileAt(s, nc, nr);
      if (!t) continue;
      const land = isLand(t);
      if (!land && !allowWater && !(nc === to[0] && nr === to[1])) continue;
      let cost = 1;
      if (land) {
        if (t.elev === 1) cost = 1.6;
        if (t.elev === 2) cost = 3.5;
        if (t.feature === 'forest') cost += 0.4;
        if (t.feature === 'marsh') cost += 0.8;
        if (t.road) cost *= 0.5;
      } else cost = t.biome === 'coast' || t.biome === 'lake' ? 1.2 : 2;
      const g = cur.g + cost;
      const k = key(nc, nr);
      if (g < (gScore.get(k) ?? Infinity)) {
        gScore.set(k, g);
        came.set(k, key(cur.c, cur.r));
        open.push({ c: nc, r: nr, g, f: g + hexDistance(nc, nr, to[0], to[1]) });
      }
    }
  }
  return null;
}

// Bitset de exploración del jugador
export function getExplored(s: GameState): Uint8Array {
  return exploredCache.get(s) ?? decodeExplored(s);
}
const exploredCache = new WeakMap<GameState, Uint8Array>();
function decodeExplored(s: GameState) {
  const arr = new Uint8Array(s.width * s.height);
  if (s.explored) {
    const bin = atob(s.explored);
    for (let i = 0; i < arr.length; i++) arr[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  }
  exploredCache.set(s, arr);
  return arr;
}
export function encodeExplored(s: GameState) {
  const arr = getExplored(s);
  const bytes = new Uint8Array(Math.ceil(arr.length / 8));
  for (let i = 0; i < arr.length; i++) if (arr[i]) bytes[i >> 3] |= 1 << (i & 7);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  s.explored = btoa(bin);
}
export let exploredVersion = 0;
export function reveal(s: GameState, c: number, r: number, radius: number) {
  const arr = getExplored(s);
  let changed = false;
  for (const [hc, hr] of hexesInRange(c, r, radius)) {
    if (!inBounds(s, hc, hr)) continue;
    const i = hr * s.width + hc;
    if (!arr[i]) {
      arr[i] = 1;
      changed = true;
    }
  }
  if (changed) exploredVersion++;
  return changed;
}
export function isExplored(s: GameState, c: number, r: number) {
  return getExplored(s)[r * s.width + c] === 1;
}
