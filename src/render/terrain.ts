// Pintor de terreno por bloques con caché. Estilo: atlas pintado a mano con tinta.
import type { GameState, Tile } from '../sim/types';
import { HEX_SIZE, HEX_W, ROW_H, hexToPixel, hexCorners, neighbors, DIR_EDGE } from '../core/hex';
import { hash2 } from '../core/rng';
import { BIOME_COLOR, INK, PARCHMENT, mix, shade } from './palette';
import { isLand, isWater } from '../data/terrain';
import { getExplored } from '../sim/world';

export const CHUNK_C = 10;
export const CHUNK_R = 10;
export const CHUNK_W = CHUNK_C * HEX_W;
export const CHUNK_H = CHUNK_R * ROW_H;

interface ChunkEntry {
  canvas: HTMLCanvasElement;
  sig: number;
  scale: number;
  used: number;
  px: number;
}

let grain: HTMLCanvasElement | null = null;
let hatch: HTMLCanvasElement | null = null;

function makeGrain(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const x = i % 256, y = (i / 256) | 0;
    const v = 128 + (hash2(x, y, 3) - 0.5) * 90 + (hash2(x >> 2, y >> 2, 5) - 0.5) * 60;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function makeHatch(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = PARCHMENT;
  g.fillRect(0, 0, 64, 64);
  // manchas de envejecimiento
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(150,120,70,${0.02 + hash2(i, 1) * 0.04})`;
    g.beginPath();
    g.arc(hash2(i, 2) * 64, hash2(i, 3) * 64, 2 + hash2(i, 4) * 10, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(120,95,60,0.13)';
  g.lineWidth = 1;
  for (let i = -64; i < 64; i += 8) {
    g.beginPath();
    g.moveTo(i, 64);
    g.lineTo(i + 64, 0);
    g.stroke();
  }
  return c;
}

export class TerrainPainter {
  cache = new Map<string, ChunkEntry>();
  frame = 0;
  totalPx = 0;
  budget = 90e6;
  state: GameState;
  constructor(state: GameState) {
    this.state = state;
    grain ??= makeGrain();
    hatch ??= makeHatch();
  }

  setState(s: GameState) {
    this.state = s;
    this.cache.clear();
    this.totalPx = 0;
  }

  chunkSig(cx: number, cy: number): number {
    const s = this.state;
    const ex = getExplored(s);
    let sig = 7;
    for (let r = cy * CHUNK_R - 1; r <= (cy + 1) * CHUNK_R; r++) {
      if (r < 0 || r >= s.height) continue;
      for (let c = cx * CHUNK_C - 1; c <= (cx + 1) * CHUNK_C; c++) {
        if (c < 0 || c >= s.width) continue;
        const i = r * s.width + c;
        const t = s.tiles[i];
        sig = (sig * 31 + ex[i] * 3 + (t.feature === 'forest' ? 5 : t.feature === 'marsh' ? 11 : 0) + t.elev * 17) | 0;
      }
    }
    return sig;
  }

  get(cx: number, cy: number, scale: number): HTMLCanvasElement {
    const key = `${cx},${cy},${scale}`;
    this.frame++;
    const sig = this.chunkSig(cx, cy);
    const e = this.cache.get(key);
    if (e && e.sig === sig) {
      e.used = this.frame;
      return e.canvas;
    }
    const canvas = e?.canvas ?? document.createElement('canvas');
    const w = Math.ceil(CHUNK_W * scale), h = Math.ceil(CHUNK_H * scale);
    if (!e) {
      canvas.width = w;
      canvas.height = h;
      this.totalPx += w * h;
    }
    this.paint(canvas, cx, cy, scale);
    this.cache.set(key, { canvas, sig, scale, used: this.frame, px: w * h });
    this.evict();
    return canvas;
  }

  evict() {
    if (this.totalPx <= this.budget) return;
    const list = [...this.cache.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k, v] of list) {
      if (this.totalPx <= this.budget * 0.8) break;
      this.cache.delete(k);
      this.totalPx -= v.px;
      v.canvas.width = v.canvas.height = 0;
    }
  }

  paint(canvas: HTMLCanvasElement, cx: number, cy: number, scale: number) {
    const s = this.state;
    const g = canvas.getContext('2d')!;
    const x0 = cx * CHUNK_W, y0 = cy * CHUNK_H;
    g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    g.fillStyle = BIOME_COLOR.deep[0];
    g.fillRect(x0, y0, CHUNK_W, CHUNK_H);
    const ex = getExplored(s);
    const tiles: [number, number, Tile][] = [];
    const r0 = Math.max(0, cy * CHUNK_R - 2), r1 = Math.min(s.height - 1, (cy + 1) * CHUNK_R + 1);
    const c0 = Math.max(0, cx * CHUNK_C - 2), c1 = Math.min(s.width - 1, (cx + 1) * CHUNK_C + 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) tiles.push([c, r, s.tiles[r * s.width + c]]);
    const detail = scale >= 0.45;

    // 1. Base
    for (const [c, r, t] of tiles) {
      const [px, py] = hexToPixel(c, r);
      const [a, b] = BIOME_COLOR[t.biome];
      let col = mix(a, b, hash2(c, r, 1));
      if (isLand(t)) {
        if (t.elev === 1) col = mix(col.startsWith('rgb') ? rgbToHex(col) : col, '#7d7350', 0.18);
        if (t.elev === 2) col = mix(rgbToHex(col), '#8c8471', 0.45);
        if (t.feature === 'forest') col = mix(rgbToHex(col), t.biome === 'tundra' ? '#5c6b55' : '#5f7a3c', 0.35);
        if (t.feature === 'marsh') col = mix(rgbToHex(col), '#6f8a6a', 0.4);
      }
      hexPath(g, px, py, HEX_SIZE + 0.8);
      g.fillStyle = col;
      g.fill();
    }
    // Agua: degradado hacia la costa
    for (const [c, r, t] of tiles) {
      if (!isWater(t) || t.biome === 'deep') continue;
      const [px, py] = hexToPixel(c, r);
      const grad = g.createRadialGradient(px, py, 2, px, py, HEX_SIZE * 1.1);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, t.biome === 'coast' || t.biome === 'lake' ? 'rgba(190,225,215,0.18)' : 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      hexPath(g, px, py, HEX_SIZE);
      g.fill();
    }
    // Textura de grano
    g.save();
    g.globalAlpha = 0.16;
    g.globalCompositeOperation = 'overlay';
    const pat = g.createPattern(grain!, 'repeat')!;
    g.fillStyle = pat;
    g.fillRect(x0, y0, CHUNK_W, CHUNK_H);
    g.restore();

    // 2. Líneas de costa (espuma + tinta)
    for (const [c, r, t] of tiles) {
      if (!isLand(t)) continue;
      const [px, py] = hexToPixel(c, r);
      const corners = hexCorners(px, py, HEX_SIZE);
      const ns = neighbors(c, r);
      for (let d = 0; d < 6; d++) {
        const [nc, nr] = ns[d];
        if (nc < 0 || nr < 0 || nc >= s.width || nr >= s.height) continue;
        const n = s.tiles[nr * s.width + nc];
        if (!isWater(n)) continue;
        const [i0, i1] = DIR_EDGE[d];
        const [ax, ay] = corners[i0], [bx, by] = corners[i1];
        const [nx, ny] = hexToPixel(nc, nr);
        // olas concéntricas hacia el agua
        if (detail) {
          for (let k = 1; k <= 2; k++) {
            const f = k * 0.16;
            g.strokeStyle = `rgba(230,240,232,${0.32 - k * 0.1})`;
            g.lineWidth = 1.1;
            g.beginPath();
            g.moveTo(ax + (nx - ax) * f, ay + (ny - ay) * f);
            g.lineTo(bx + (nx - bx) * f, by + (ny - by) * f);
            g.stroke();
          }
        }
        g.strokeStyle = 'rgba(236,228,200,0.85)';
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
        g.strokeStyle = 'rgba(42,33,25,0.7)';
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
      }
    }

    // 3. Ríos
    for (const [c, r, t] of tiles) {
      if (!t.river || t.riverTo < 0 || !isLand(t)) continue;
      const [px, py] = hexToPixel(c, r);
      const [nc, nr] = neighbors(c, r)[t.riverTo];
      if (nc < 0 || nr < 0 || nc >= s.width || nr >= s.height) continue;
      const [qx, qy] = hexToPixel(nc, nr);
      const nt = s.tiles[nr * s.width + nc];
      const mx = (px + qx) / 2 + (hash2(c, r, 9) - 0.5) * 10;
      const my = (py + qy) / 2 + (hash2(c, r, 10) - 0.5) * 10;
      const w = 1.6 + Math.min(4.5, t.river * 0.45);
      const ex2 = isWater(nt) ? (px + qx) / 2 + (qx - px) * 0.1 : qx;
      const ey2 = isWater(nt) ? (py + qy) / 2 + (qy - py) * 0.1 : qy;
      for (const [col, lw] of [['rgba(42,33,25,0.45)', w + 2], ['#4f8aa0', w], ['rgba(190,225,235,0.5)', w * 0.35]] as [string, number][]) {
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo(mx, my, ex2, ey2);
        g.stroke();
      }
    }

    // 4. Relieve y vegetación (por filas, de arriba abajo)
    for (const [c, r, t] of tiles) {
      if (!isLand(t)) continue;
      const [px, py] = hexToPixel(c, r);
      if (t.elev === 2) drawMountains(g, px, py, c, r, t);
      else {
        if (t.elev === 1) drawHills(g, px, py, c, r, t);
        if (t.feature === 'forest') drawForest(g, px, py, c, r, t, detail);
        else if (t.feature === 'marsh') drawMarsh(g, px, py, c, r);
        else if (t.biome === 'desert') drawDunes(g, px, py, c, r);
        else if (detail && (t.biome === 'grass' || t.biome === 'plains' || t.biome === 'tundra')) drawTufts(g, px, py, c, r, t);
        if (t.biome === 'snow') drawSnow(g, px, py, c, r);
      }
    }

    // 5. Niebla: pergamino sobre lo inexplorado
    const hp = g.createPattern(hatch!, 'repeat')!;
    for (const [c, r] of tiles) {
      if (ex[r * s.width + c]) continue;
      const [px, py] = hexToPixel(c, r);
      hexPath(g, px, py, HEX_SIZE + 1.2);
      g.fillStyle = hp;
      g.fill();
    }
    // Borde de lo explorado: trazo de tinta irregular
    g.strokeStyle = 'rgba(80,60,35,0.55)';
    g.lineWidth = 1.4;
    g.lineCap = 'round';
    for (const [c, r] of tiles) {
      if (ex[r * s.width + c]) continue;
      const [px, py] = hexToPixel(c, r);
      const corners = hexCorners(px, py, HEX_SIZE);
      const ns = neighbors(c, r);
      for (let d = 0; d < 6; d++) {
        const [nc, nr] = ns[d];
        if (nc < 0 || nr < 0 || nc >= s.width || nr >= s.height) continue;
        if (!ex[nr * s.width + nc]) continue;
        const [i0, i1] = DIR_EDGE[d];
        const [ax, ay] = corners[i0], [bx, by] = corners[i1];
        const j = (hash2(c * 7 + d, r, 4) - 0.5) * 3;
        g.beginPath();
        g.moveTo(ax, ay);
        g.quadraticCurveTo((ax + bx) / 2 + j, (ay + by) / 2 - j, bx, by);
        g.stroke();
      }
    }
    // Garabatos cartográficos en zonas inexploradas
    for (const [c, r] of tiles) {
      if (ex[r * s.width + c]) continue;
      const h = hash2(c, r, 77);
      if (h > 0.03) continue;
      const [px, py] = hexToPixel(c, r);
      drawDoodle(g, px, py, Math.floor(hash2(c, r, 78) * 3));
    }
  }
}

function rgbToHex(c: string): string {
  if (c.startsWith('#')) return c;
  const m = c.match(/\d+/g)!;
  return '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('');
}

export function hexPath(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const X = x + size * Math.cos(a), Y = y + size * Math.sin(a);
    if (i === 0) g.moveTo(X, Y);
    else g.lineTo(X, Y);
  }
  g.closePath();
}

function drawMountains(g: CanvasRenderingContext2D, px: number, py: number, c: number, r: number, t: Tile) {
  const n = 2 + Math.floor(hash2(c, r, 21) * 2);
  const cold = t.biome === 'snow' || t.biome === 'tundra';
  const peaks: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const ox = (i - (n - 1) / 2) * 15 + (hash2(c, r, 30 + i) - 0.5) * 6;
    const oy = 6 + (i % 2) * 6 + (hash2(c, r, 40 + i) - 0.5) * 4;
    const h = 22 + hash2(c, r, 50 + i) * 12;
    peaks.push([ox, oy, h]);
  }
  peaks.sort((a, b) => a[1] - b[1]);
  for (const [ox, oy, h] of peaks) {
    const bx = px + ox, by = py + oy;
    const w = h * 0.75;
    // sombra
    g.fillStyle = 'rgba(40,30,20,0.18)';
    g.beginPath();
    g.ellipse(bx + 4, by + 1, w * 0.9, 3.5, 0, 0, Math.PI * 2);
    g.fill();
    // cara iluminada
    g.fillStyle = '#b3aa96';
    g.beginPath();
    g.moveTo(bx - w, by);
    g.lineTo(bx, by - h);
    g.lineTo(bx + w * 0.1, by);
    g.closePath();
    g.fill();
    // cara en sombra
    g.fillStyle = '#7d7462';
    g.beginPath();
    g.moveTo(bx, by - h);
    g.lineTo(bx + w, by);
    g.lineTo(bx + w * 0.1, by);
    g.closePath();
    g.fill();
    // nieve
    if (cold || h > 29) {
      g.fillStyle = '#f2f1ea';
      g.beginPath();
      g.moveTo(bx, by - h);
      g.lineTo(bx - w * 0.32, by - h * 0.62);
      g.lineTo(bx - w * 0.1, by - h * 0.68);
      g.lineTo(bx + w * 0.05, by - h * 0.58);
      g.lineTo(bx + w * 0.3, by - h * 0.64);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = INK;
    g.lineWidth = 1.1;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(bx - w, by);
    g.lineTo(bx, by - h);
    g.lineTo(bx + w, by);
    g.stroke();
    // estrías
    g.strokeStyle = 'rgba(42,33,25,0.35)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(bx + w * 0.15, by - h * 0.55);
    g.lineTo(bx + w * 0.45, by - h * 0.15);
    g.moveTo(bx + w * 0.35, by - h * 0.5);
    g.lineTo(bx + w * 0.6, by - h * 0.2);
    g.stroke();
  }
}

function drawHills(g: CanvasRenderingContext2D, px: number, py: number, c: number, r: number, t: Tile) {
  const n = 2 + Math.floor(hash2(c, r, 61) * 2);
  for (let i = 0; i < n; i++) {
    const ox = (i - (n - 1) / 2) * 17 + (hash2(c, r, 62 + i) - 0.5) * 8;
    const oy = 4 + (i % 2) * 9 + (hash2(c, r, 66 + i) - 0.5) * 5;
    const w = 13 + hash2(c, r, 70 + i) * 5;
    const h = 8 + hash2(c, r, 74 + i) * 4;
    const bx = px + ox, by = py + oy;
    g.fillStyle = 'rgba(60,45,25,0.16)';
    g.beginPath();
    g.ellipse(bx + 3, by + 1, w, 3, 0, 0, Math.PI * 2);
    g.fill();
    const base = t.biome === 'desert' ? '#d2b475' : t.biome === 'tundra' ? '#9a9a83' : t.biome === 'snow' ? '#e2e8ea' : '#93954f';
    g.fillStyle = base;
    g.beginPath();
    g.moveTo(bx - w, by);
    g.quadraticCurveTo(bx - w * 0.3, by - h * 2, bx + w, by);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(40,30,15,0.18)';
    g.beginPath();
    g.moveTo(bx + w * 0.05, by - h * 0.95);
    g.quadraticCurveTo(bx + w * 0.5, by - h * 0.6, bx + w, by);
    g.lineTo(bx + w * 0.2, by);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(42,33,25,0.75)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(bx - w, by);
    g.quadraticCurveTo(bx - w * 0.3, by - h * 2, bx + w, by);
    g.stroke();
  }
}

function drawForest(g: CanvasRenderingContext2D, px: number, py: number, c: number, r: number, t: Tile, detail: boolean) {
  const conifer = t.biome === 'tundra' || t.biome === 'snow' || t.elev === 1;
  const n = detail ? 7 : 4;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = hash2(c, r, 100 + i) * Math.PI * 2;
    const d = Math.sqrt(hash2(c, r, 120 + i)) * HEX_SIZE * 0.62;
    pts.push([px + Math.cos(a) * d, py + Math.sin(a) * d * 0.85 + (t.elev === 1 ? -4 : 0), 0.8 + hash2(c, r, 140 + i) * 0.45]);
  }
  pts.sort((a, b) => a[1] - b[1]);
  for (const [x, y, k] of pts) {
    g.fillStyle = 'rgba(30,35,15,0.22)';
    g.beginPath();
    g.ellipse(x + 2.5 * k, y + 1.5, 5.5 * k, 2.2 * k, 0, 0, Math.PI * 2);
    g.fill();
    if (conifer) {
      const h = 13 * k, w = 5.5 * k;
      g.fillStyle = '#3e5a3f';
      g.beginPath();
      g.moveTo(x, y - h);
      g.lineTo(x + w, y);
      g.lineTo(x - w, y);
      g.closePath();
      g.fill();
      g.fillStyle = '#2f4732';
      g.beginPath();
      g.moveTo(x, y - h);
      g.lineTo(x + w, y);
      g.lineTo(x, y);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(25,30,20,0.7)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x - w, y);
      g.lineTo(x, y - h);
      g.lineTo(x + w, y);
      g.stroke();
    } else {
      const rad = 5.5 * k;
      g.fillStyle = '#5a3f26';
      g.fillRect(x - 0.8, y - 2, 1.6, 3);
      g.fillStyle = '#56763a';
      g.beginPath();
      g.arc(x, y - rad, rad, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6f9047';
      g.beginPath();
      g.arc(x - rad * 0.3, y - rad * 1.25, rad * 0.55, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(30,35,15,0.65)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.arc(x, y - rad, rad, Math.PI * 0.85, Math.PI * 2.15);
      g.stroke();
    }
  }
}

function drawMarsh(g: CanvasRenderingContext2D, px: number, py: number, c: number, r: number) {
  for (let i = 0; i < 4; i++) {
    const x = px + (hash2(c, r, 200 + i) - 0.5) * 34, y = py + (hash2(c, r, 210 + i) - 0.5) * 26;
    g.fillStyle = 'rgba(80,130,140,0.55)';
    g.beginPath();
    g.ellipse(x, y, 6, 2.3, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(50,60,30,0.7)';
    g.lineWidth = 0.9;
    g.beginPath();
    for (let k = -1; k <= 1; k++) {
      g.moveTo(x + k * 2.5 + 7, y);
      g.lineTo(x + k * 3.2 + 7, y - 6 - Math.abs(k));
    }
    g.stroke();
  }
}

function drawDunes(g: CanvasRenderingContext2D, px: number, py: number, c: number, r: number) {
  g.strokeStyle = 'rgba(140,105,55,0.45)';
  g.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const x = px + (hash2(c, r, 300 + i) - 0.5) * 30, y = py + (i - 1) * 9 + (hash2(c, r, 310 + i) - 0.5) * 4;
    g.beginPath();
    g.moveTo(x - 9, y + 2);
    g.quadraticCurveTo(x - 2, y - 4, x + 9, y + 1);
    g.stroke();
  }
}

function drawTufts(g: CanvasRenderingContext2D, px: number, py: number, c: number, r: number, t: Tile) {
  g.strokeStyle = t.biome === 'plains' ? 'rgba(110,95,40,0.35)' : 'rgba(55,75,30,0.35)';
  g.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const x = px + (hash2(c, r, 400 + i) - 0.5) * 36, y = py + (hash2(c, r, 410 + i) - 0.5) * 30;
    g.beginPath();
    g.moveTo(x - 2, y);
    g.lineTo(x - 3, y - 3);
    g.moveTo(x, y);
    g.lineTo(x, y - 4);
    g.moveTo(x + 2, y);
    g.lineTo(x + 3, y - 3);
    g.stroke();
  }
}

function drawSnow(g: CanvasRenderingContext2D, px: number, py: number, c: number, r: number) {
  g.strokeStyle = 'rgba(120,150,170,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    const x = px + (hash2(c, r, 500 + i) - 0.5) * 30, y = py + (hash2(c, r, 510 + i) - 0.5) * 24;
    g.beginPath();
    g.moveTo(x - 8, y);
    g.quadraticCurveTo(x, y - 3, x + 8, y);
    g.stroke();
  }
}

function drawDoodle(g: CanvasRenderingContext2D, x: number, y: number, kind: number) {
  g.save();
  g.strokeStyle = 'rgba(110,85,50,0.35)';
  g.lineWidth = 1.1;
  g.lineCap = 'round';
  if (kind === 0) {
    // rosa de los vientos
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
      g.lineTo(x + Math.cos(a + 0.4) * 4, y + Math.sin(a + 0.4) * 4);
      g.lineTo(x + Math.cos(a - 0.4) * 4, y + Math.sin(a - 0.4) * 4);
      g.closePath();
      g.stroke();
    }
  } else if (kind === 1) {
    // serpiente marina
    g.beginPath();
    g.moveTo(x - 18, y + 4);
    g.bezierCurveTo(x - 12, y - 8, x - 6, y + 10, x, y);
    g.bezierCurveTo(x + 6, y - 10, x + 12, y + 8, x + 18, y - 2);
    g.stroke();
    g.beginPath();
    g.arc(x + 18, y - 3, 2.5, 0, Math.PI * 2);
    g.stroke();
  } else {
    // montes esbozados
    g.beginPath();
    g.moveTo(x - 16, y + 6);
    g.lineTo(x - 8, y - 6);
    g.lineTo(x, y + 6);
    g.lineTo(x + 7, y - 3);
    g.lineTo(x + 14, y + 6);
    g.stroke();
  }
  g.restore();
}
