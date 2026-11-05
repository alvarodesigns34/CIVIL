// Renderizador principal del mapa (Canvas 2D).
import type { GameState, Settlement, Tile } from '../sim/types';
import { Camera } from './camera';
import { TerrainPainter, CHUNK_W, CHUNK_H, hexPath } from './terrain';
import { HEX_SIZE, HEX_W, ROW_H, hexToPixel, hexCorners, neighbors, DIR_EDGE, pixelToHex } from '../core/hex';
import { BUILDING_ART, getSprite, blitSprite, drawSettlement, settlementTier, drawScaffold, flag } from './sprites';
import { BUILDING } from '../data/buildings';
import { getExplored, settlementById, capitalOf, landPath, civSettlements } from '../sim/world';
import { DEPOSITS } from '../data/terrain';
import { hash2 } from '../core/rng';
import { INK, alpha } from './palette';
import { drawDepositIcon } from './icons';
import { drawRegiment, drawCamp } from './unitArt';
import { UNIT } from '../data/units';
import { battleLog, defMax } from '../sim/military';
import { settlementDefense } from '../sim/war';

export interface Overlay {
  selected: [number, number] | null;
  hover: [number, number] | null;
  buildPreview: Map<number, { ok: boolean; label?: string; good?: boolean }> | null;
  colonyPreview: Map<number, boolean> | null;
  mode: 'select' | 'build' | 'colony' | 'scout';
  selectedUnits?: number[];
  lens?: 'none' | 'religion' | 'resources' | 'military' | 'mood';
  dayNight?: boolean;
  yearFrac: number; // 0..1 dentro del año actual
  reducedMotion: boolean;
}

interface Walker {
  x: number; y: number; tx: number; ty: number; hx: number; hy: number;
  speed: number; wait: number; color: string; carry: string | null; goingHome: boolean;
  jobs: [number, number, string][];
}

const CARRY: Record<string, string> = { food: '#d9b851', wood: '#8a6440', stone: '#c9c2b0', metal: '#7a8590', goods: '#b5643a', gold: '#e2c044', knowledge: '#efe4c8', culture: '#a05aa0', influence: '#b4432a' };
const CLOTHES = ['#8a4a2f', '#3f5a6b', '#6b6a3a', '#7a3a5a', '#a07a3a', '#4a6a4a', '#5a4a3a'];

export class Renderer {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  cam = new Camera();
  terrain: TerrainPainter;
  state: GameState;
  dpr = 1;
  walkers = new Map<number, Walker[]>();
  routes = new Map<string, [number, number][]>();
  borderCache: { sig: number; paths: Map<number, { fill: Path2D; edge: Path2D }> } | null = null;
  clouds: { x: number; y: number; r: number; s: number }[] = [];
  time = 0;
  smoke: { x: number; y: number; life: number; vx: number }[] = [];
  playerId = 0;
  vignette: HTMLCanvasElement | null = null;
  sparks: { x: number; y: number; vx: number; vy: number; life: number; c: string; r: number }[] = [];
  rings: { x: number; y: number; life: number; big: boolean }[] = [];
  snow: { x: number; y: number; s: number }[] = [];
  birds: { x: number; y: number; vx: number; vy: number; n: number; ph: number }[] = [];
  weather = { rain: 0, rainTarget: 0, timer: 0 };

  // Destello al completar una obra
  burst(col: number, row: number, size = 1) {
    const [x, y] = hexToPixel(col, row);
    const cols = ['#f6d36b', '#e2c044', '#fff3c4', '#d98a3a'];
    for (let i = 0; i < 26 * size; i++) {
      const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50 * size;
      this.sparks.push({ x, y: y - 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 1, c: cols[i % 4], r: 1 + Math.random() * 1.6 });
    }
    this.rings.push({ x, y, life: 1, big: size > 1 });
  }

  constructor(canvas: HTMLCanvasElement, state: GameState) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.state = state;
    this.terrain = new TerrainPainter(state);
    this.setState(state);
  }

  setState(state: GameState) {
    this.state = state;
    this.terrain.setState(state);
    this.walkers.clear();
    this.routes.clear();
    this.borderCache = null;
    this.playerId = state.player;
    this.cam.worldW = state.width * HEX_W + HEX_W;
    this.cam.worldH = state.height * ROW_H + HEX_SIZE;
    this.clouds = [];
    for (let i = 0; i < 14; i++) this.clouds.push({ x: hash2(i, 1, 9) * this.cam.worldW, y: hash2(i, 2, 9) * this.cam.worldH, r: 90 + hash2(i, 3, 9) * 140, s: 6 + hash2(i, 4, 9) * 8 });
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.cam.vw = w;
    this.cam.vh = h;
    this.cam.clamp();
  }

  centerOn(col: number, row: number, zoom?: number, instant = false) {
    const [x, y] = hexToPixel(col, row);
    if (instant) {
      this.cam.x = x; this.cam.y = y;
      if (zoom) this.cam.zoom = zoom;
      this.cam.clamp();
    } else this.cam.flyTo(x, y, zoom ?? this.cam.zoom);
  }

  pick(sx: number, sy: number): [number, number] | null {
    const [wx, wy] = this.cam.toWorld(sx, sy);
    const [c, r] = pixelToHex(wx, wy);
    if (c < 0 || r < 0 || c >= this.state.width || r >= this.state.height) return null;
    return [c, r];
  }

  // ───────────────────────── Dibujo
  draw(dt: number, ov: Overlay) {
    const s = this.state;
    this.time += dt;
    this.cam.update(dt);
    const g = this.g;
    const cam = this.cam;
    const z = cam.zoom;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#e8dbbb';
    g.fillRect(0, 0, cam.vw, cam.vh);
    // transformación de mundo
    const sx = z * this.dpr;
    g.setTransform(sx, 0, 0, sx, (cam.vw / 2 - cam.x * z) * this.dpr, (cam.vh / 2 - cam.y * z) * this.dpr);
    const [wx0, wy0] = cam.toWorld(0, 0);
    const [wx1, wy1] = cam.toWorld(cam.vw, cam.vh);

    // Terreno por bloques
    const want = z * this.dpr;
    const scale = want > 1.6 ? 2 : want > 0.8 ? 1 : want > 0.4 ? 0.5 : 0.25;
    const cx0 = Math.max(0, Math.floor(wx0 / CHUNK_W)), cx1 = Math.min(Math.ceil(this.cam.worldW / CHUNK_W), Math.floor(wx1 / CHUNK_W));
    const cy0 = Math.max(0, Math.floor(wy0 / CHUNK_H)), cy1 = Math.min(Math.ceil(this.cam.worldH / CHUNK_H), Math.floor(wy1 / CHUNK_H));
    g.imageSmoothingEnabled = true;
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const cv = this.terrain.get(cx, cy, scale);
        g.drawImage(cv, cx * CHUNK_W, cy * CHUNK_H, CHUNK_W + 1.5 / z, CHUNK_H + 1.5 / z);
      }

    const ex = getExplored(s);
    const c0 = Math.max(0, Math.floor(wx0 / HEX_W) - 1), c1 = Math.min(s.width - 1, Math.ceil(wx1 / HEX_W) + 1);
    const r0 = Math.max(0, Math.floor(wy0 / ROW_H) - 1), r1 = Math.min(s.height - 1, Math.ceil(wy1 / ROW_H) + 2);
    const visible = (c: number, r: number) => c >= c0 && c <= c1 && r >= r0 && r <= r1;

    // Animación de olas y brillo del agua
    if (z > 0.6 && !ov.reducedMotion) this.drawWater(g, c0, c1, r0, r1, ex);

    // Fronteras
    this.drawBorders(g, ex);
    if (ov.lens && ov.lens !== 'none') this.drawLens(g, ov.lens, c0, c1, r0, r1, ex);

    // Rutas comerciales y caminos
    this.drawRoutes(g, ov, ex);

    // Vista previa de construcción
    if (ov.buildPreview && (ov.mode === 'build')) {
      for (const [i, p] of ov.buildPreview) {
        const c = i % s.width, r = Math.floor(i / s.width);
        if (!visible(c, r)) continue;
        const [px, py] = hexToPixel(c, r);
        hexPath(g, px, py, HEX_SIZE - 2);
        g.fillStyle = p.ok ? (p.good ? 'rgba(120,200,90,0.32)' : 'rgba(230,200,90,0.28)') : 'rgba(80,40,30,0.18)';
        g.fill();
        if (p.ok) {
          g.strokeStyle = p.good ? 'rgba(60,120,40,0.8)' : 'rgba(150,110,30,0.8)';
          g.lineWidth = 1.5 / Math.max(0.6, z);
          g.stroke();
        }
      }
    }
    if (ov.colonyPreview && ov.mode === 'colony') {
      for (const [i, ok] of ov.colonyPreview) {
        const c = i % s.width, r = Math.floor(i / s.width);
        if (!visible(c, r) || !ok) continue;
        const [px, py] = hexToPixel(c, r);
        hexPath(g, px, py, HEX_SIZE - 3);
        g.fillStyle = 'rgba(255,240,180,0.22)';
        g.fill();
        g.setLineDash([4, 4]);
        g.strokeStyle = 'rgba(120,80,30,0.7)';
        g.lineWidth = 1.4 / Math.max(0.6, z);
        g.stroke();
        g.setLineDash([]);
      }
    }

    // Objetos por filas
    const season = Math.max(0, Math.floor(ov.yearFrac * 4)) & 3;
    const sprScale = z * this.dpr > 1.3 ? 3 : z * this.dpr > 0.65 ? 1.5 : 0.75;
    const setsByTile = new Map<number, Settlement>();
    for (const st of s.settlements) setsByTile.set(st.row * s.width + st.col, st);
    const deps = z > 0.55;
    const player = s.civs[s.player];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * s.width + c;
        if (!ex[i]) continue;
        const t = s.tiles[i];
        const [px, py] = hexToPixel(c, r);
        const st = setsByTile.get(i);
        if (st) {
          const civ = s.civs[st.civ];
          const tier = settlementTier(st.pop);
          const key = `set:${tier}:${st.fort}:${civ.color}:${st.capital ? 1 : 0}`;
          const spr = getSprite(key, sprScale, (gg) => drawSettlement(gg, tier, st.fort, civ.color, civ.color2, st.capital, 0));
          const big = tier >= 4 ? 1.4 : tier === 3 ? 1.2 : 1;
          if (big > 1) {
            g.save();
            g.translate(px, py);
            g.scale(big, big);
            blitSprite(g, spr, 0, 0, sprScale);
            g.restore();
          } else blitSprite(g, spr, px, py, sprScale);
          if (!ov.reducedMotion && Math.random() < dt * 2.5 && z > 0.7) this.smoke.push({ x: px + (Math.random() - 0.5) * 20, y: py - 10, life: 1, vx: (Math.random() - 0.3) * 6 });
          continue;
        }
        if (t.b) {
          const def = BUILDING[t.b.type];
          const civ = s.civs[t.owner] ?? player;
          if (t.b.progress < 1) {
            const spr = getSprite('scaffold', sprScale, drawScaffold);
            blitSprite(g, spr, px, py, sprScale);
            // anillo de progreso
            g.strokeStyle = 'rgba(42,33,25,0.35)';
            g.lineWidth = 3;
            g.beginPath(); g.arc(px, py + 20, 6, 0, Math.PI * 2); g.stroke();
            g.strokeStyle = '#e2c044';
            g.beginPath(); g.arc(px, py + 20, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t.b.progress); g.stroke();
          } else if (def && BUILDING_ART[def.id]) {
            const v = Math.floor(hash2(c, r, 5) * 6);
            const seasonal = def.id === 'farm' ? season : 0;
            const key = `b:${def.id}:${civ.color}:${seasonal}:${def.id === 'farm' || def.id === 'pasture' ? v : 0}`;
            const spr = getSprite(key, sprScale, (gg) => BUILDING_ART[def.id](gg, { color: civ.color, color2: civ.color2, season: seasonal, variant: v }));
            blitSprite(g, spr, px, py, sprScale);
            if (t.b.paused) {
              g.fillStyle = 'rgba(42,33,25,0.55)';
              g.beginPath(); g.arc(px + 16, py - 16, 6, 0, Math.PI * 2); g.fill();
              g.fillStyle = '#efe4c8'; g.fillRect(px + 13.5, py - 19, 2, 6); g.fillRect(px + 16.5, py - 19, 2, 6);
            }
            if (!ov.reducedMotion && (def.id === 'workshop' || def.id === 'forge' || def.id === 'hunters' || def.id === 'guild') && t.b.staff > 0 && Math.random() < dt * 1.6 && z > 0.7) this.smoke.push({ x: px + 6, y: py - 14, life: 1, vx: Math.random() * 4 });
          }
        } else if (deps && t.dep) {
          const d = DEPOSITS[t.dep];
          if (!d.reveal || player.techs.includes(d.reveal)) drawDepositIcon(g, t.dep, px + 14, py + 14, z);
        }
      }
      // caminantes de esta fila se dibujan al final
    }

    // Humo
    this.drawSmoke(g, dt);
    if (!ov.reducedMotion) this.drawLife(g, dt, c0, c1, r0, r1, ex, ov);
    this.drawSparks(g, dt);

    // Habitantes
    if (z > 0.75) this.drawWalkers(g, dt, ov, wx0, wy0, wx1, wy1);

    // Unidades en movimiento
    this.drawMovers(g, ov);
    this.drawUnits(g, dt, ov, ex);

    // Selección y cursor
    if (ov.hover && ov.mode !== 'select') this.hexOutline(g, ov.hover[0], ov.hover[1], 'rgba(255,250,220,0.9)', 2.5);
    else if (ov.hover) this.hexOutline(g, ov.hover[0], ov.hover[1], 'rgba(255,250,220,0.45)', 1.5);
    if (ov.selected) {
      const pulse = 0.6 + Math.sin(this.time * 4) * 0.25;
      this.hexOutline(g, ov.selected[0], ov.selected[1], `rgba(226,192,68,${pulse})`, 3.5);
      this.hexOutline(g, ov.selected[0], ov.selected[1], 'rgba(42,33,25,0.8)', 1);
    }

    // Nubes y tinte estacional
    if (!ov.reducedMotion) this.drawClouds(g, dt);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSeason(g, ov.yearFrac);
    if (ov.dayNight !== false && !ov.reducedMotion) this.drawNight(g, ex);
    if (!ov.reducedMotion) this.drawWeather(g, dt, ov.yearFrac);

    // Etiquetas en coordenadas de pantalla
    this.drawLabels(g, ex, ov);

    // Etiquetas de vista previa de construcción
    if (ov.buildPreview && ov.mode === 'build' && z > 0.5) {
      g.font = `600 ${Math.round(11 + z * 2)}px "Alegreya Sans", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const [i, p] of ov.buildPreview) {
        if (!p.ok || !p.label) continue;
        const c = i % s.width, r = Math.floor(i / s.width);
        if (!visible(c, r)) continue;
        const [px, py] = hexToPixel(c, r);
        const [qx, qy] = cam.toScreen(px, py);
        const w = g.measureText(p.label).width + 10;
        g.fillStyle = p.good ? 'rgba(36,70,28,0.86)' : 'rgba(80,60,20,0.82)';
        roundRect(g, qx - w / 2, qy - 9, w, 18, 9);
        g.fill();
        g.fillStyle = '#f6efd8';
        g.fillText(p.label, qx, qy + 0.5);
      }
    }
  }

  hexOutline(g: CanvasRenderingContext2D, c: number, r: number, color: string, w: number) {
    const [px, py] = hexToPixel(c, r);
    hexPath(g, px, py, HEX_SIZE - 1);
    g.strokeStyle = color;
    g.lineWidth = w / Math.max(0.5, this.cam.zoom);
    g.stroke();
  }

  drawWater(g: CanvasRenderingContext2D, c0: number, c1: number, r0: number, r1: number, ex: Uint8Array) {
    const s = this.state;
    g.strokeStyle = 'rgba(235,245,240,0.35)';
    g.lineWidth = 1;
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * s.width + c;
        const t = s.tiles[i];
        if (!ex[i] || (t.biome !== 'coast' && t.biome !== 'ocean' && t.biome !== 'lake')) continue;
        const ph = hash2(c, r, 11) * 6.28;
        const a = (Math.sin(this.time * 1.3 + ph) + 1) / 2;
        if (a < 0.55) continue;
        const [px, py] = hexToPixel(c, r);
        const ox = (hash2(c, r, 12) - 0.5) * 30, oy = (hash2(c, r, 13) - 0.5) * 24;
        g.globalAlpha = (a - 0.55) * 1.8;
        g.beginPath();
        g.moveTo(px + ox - 6, py + oy);
        g.quadraticCurveTo(px + ox - 3, py + oy - 2.5, px + ox, py + oy);
        g.quadraticCurveTo(px + ox + 3, py + oy - 2.5, px + ox + 6, py + oy);
        g.stroke();
      }
    g.globalAlpha = 1;
  }

  drawBorders(g: CanvasRenderingContext2D, ex: Uint8Array) {
    const s = this.state;
    let sig = 17;
    for (let i = 0; i < s.tiles.length; i++) sig = (sig * 31 + s.tiles[i].owner + 2 + (ex[i] ? 7 : 0)) | 0;
    if (!this.borderCache || this.borderCache.sig !== sig) {
      const paths = new Map<number, { fill: Path2D; edge: Path2D }>();
      for (let r = 0; r < s.height; r++)
        for (let c = 0; c < s.width; c++) {
          const i = r * s.width + c;
          const t = s.tiles[i];
          if (t.owner < 0 || !ex[i]) continue;
          let p = paths.get(t.owner);
          if (!p) paths.set(t.owner, (p = { fill: new Path2D(), edge: new Path2D() }));
          const [px, py] = hexToPixel(c, r);
          const cs = hexCorners(px, py, HEX_SIZE + 0.5);
          p.fill.moveTo(cs[0][0], cs[0][1]);
          for (let k = 1; k < 6; k++) p.fill.lineTo(cs[k][0], cs[k][1]);
          p.fill.closePath();
          const inner = hexCorners(px, py, HEX_SIZE - 2.2);
          const ns = neighbors(c, r);
          for (let d = 0; d < 6; d++) {
            const [nc, nr] = ns[d];
            const n = nc >= 0 && nr >= 0 && nc < s.width && nr < s.height ? s.tiles[nr * s.width + nc] : null;
            if (n && n.owner === t.owner) continue;
            const [a, b] = DIR_EDGE[d];
            p.edge.moveTo(inner[a][0], inner[a][1]);
            p.edge.lineTo(inner[b][0], inner[b][1]);
          }
        }
      this.borderCache = { sig, paths };
    }
    const z = this.cam.zoom;
    for (const [civId, p] of this.borderCache.paths) {
      const civ = s.civs[civId];
      g.fillStyle = alpha(civ.color, 0.1);
      g.fill(p.fill);
      g.lineCap = 'round';
      g.strokeStyle = alpha(civ.color, 0.35);
      g.lineWidth = 7 / Math.max(0.7, z);
      g.stroke(p.edge);
      g.strokeStyle = civ.color;
      g.lineWidth = 2.4 / Math.max(0.7, z);
      g.setLineDash([]);
      g.stroke(p.edge);
    }
  }

  routeBetween(a: Settlement, b: Settlement): [number, number][] | null {
    const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
    if (this.routes.has(key)) return this.routes.get(key)!;
    const p = landPath(this.state, [a.col, a.row], [b.col, b.row], true, 6000);
    const path = p ? (a.id < b.id ? p : [...p].reverse()) : [];
    this.routes.set(key, path);
    return path;
  }

  drawRoutes(g: CanvasRenderingContext2D, ov: Overlay, ex: Uint8Array) {
    const s = this.state;
    const z = this.cam.zoom;
    // Caminos internos: capital ↔ otros asentamientos de cada civ
    g.lineCap = 'round';
    for (const civ of s.civs) {
      if (!civ.alive) continue;
      const cap = capitalOf(s, civ.id);
      if (!cap) continue;
      for (const st of civSettlements(s, civ.id)) {
        if (st === cap) continue;
        const path = this.routeBetween(cap, st);
        if (!path || path.length < 2) continue;
        if (!ex[st.row * s.width + st.col]) continue;
        this.strokePath(g, path, 'rgba(110,80,45,0.5)', 3 / Math.max(0.8, z), [6, 5]);
      }
    }
    // Rutas comerciales con caravanas
    const drawn = new Set<string>();
    for (const civ of s.civs) {
      if (!civ.alive) continue;
      for (const [oid, rel] of Object.entries(civ.relations)) {
        if (!rel.trade) continue;
        const k = civ.id < +oid ? `${civ.id}:${oid}` : `${oid}:${civ.id}`;
        if (drawn.has(k)) continue;
        drawn.add(k);
        const a = capitalOf(s, civ.id), b = capitalOf(s, +oid);
        if (!a || !b) continue;
        const involvesPlayer = civ.id === s.player || +oid === s.player;
        if (!involvesPlayer && !(ex[a.row * s.width + a.col] && ex[b.row * s.width + b.col])) continue;
        const path = this.routeBetween(a, b);
        if (!path || path.length < 2) continue;
        this.strokePath(g, path, involvesPlayer ? 'rgba(201,162,58,0.7)' : 'rgba(201,162,58,0.35)', 2.2 / Math.max(0.8, z), [2, 6]);
        // caravana
        if (!ov.reducedMotion) {
          const n = path.length - 1;
          const t = ((this.time * 0.6) / n + hash2(a.id, b.id, 3)) % 1;
          const pingpong = t < 0.5 ? t * 2 : 2 - t * 2;
          const fi = pingpong * n;
          const i0 = Math.floor(fi), i1 = Math.min(n, i0 + 1);
          const [x0, y0] = hexToPixel(path[i0][0], path[i0][1]);
          const [x1, y1] = hexToPixel(path[i1][0], path[i1][1]);
          const f = fi - i0;
          const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
          const ti = s.tiles[path[i0][1] * s.width + path[i0][0]];
          if (ex[path[i0][1] * s.width + path[i0][0]]) this.drawCaravan(g, x, y, ti.biome === 'coast' || ti.biome === 'ocean' || ti.biome === 'deep', civ.color);
        }
      }
    }
  }

  strokePath(g: CanvasRenderingContext2D, path: [number, number][], color: string, w: number, dash: number[]) {
    g.beginPath();
    path.forEach(([c, r], i) => {
      const [x, y] = hexToPixel(c, r);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.strokeStyle = color;
    g.lineWidth = w;
    g.setLineDash(dash.map((d) => d / Math.max(0.8, this.cam.zoom)));
    g.stroke();
    g.setLineDash([]);
  }

  drawCaravan(g: CanvasRenderingContext2D, x: number, y: number, sea: boolean, color: string) {
    if (sea) {
      g.fillStyle = '#5e3f26';
      g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.lineTo(x + 4, y + 3); g.lineTo(x - 4, y + 3); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 0.6; g.stroke();
      g.fillStyle = '#efe4c8'; g.fillRect(x - 3, y - 8, 6, 7);
      g.fillStyle = color; g.fillRect(x - 3, y - 4, 6, 1.5);
    } else {
      g.fillStyle = '#6b4a2a';
      g.beginPath(); g.ellipse(x - 4, y, 3.5, 2, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(x - 2, y - 4, 1.5, 3);
      g.fillStyle = '#b59a72'; g.fillRect(x + 1, y - 4, 7, 4);
      g.strokeStyle = INK; g.lineWidth = 0.6; g.strokeRect(x + 1, y - 4, 7, 4);
      g.fillStyle = '#3b2a1c';
      g.beginPath(); g.arc(x + 2.5, y + 0.5, 1.3, 0, Math.PI * 2); g.arc(x + 6.5, y + 0.5, 1.3, 0, Math.PI * 2); g.fill();
    }
  }

  drawSmoke(g: CanvasRenderingContext2D, dt: number) {
    for (const p of this.smoke) {
      p.life -= dt * 0.35;
      p.y -= dt * 9;
      p.x += p.vx * dt;
      if (p.life <= 0) continue;
      g.fillStyle = `rgba(235,230,220,${p.life * 0.35})`;
      g.beginPath();
      g.arc(p.x, p.y, 2 + (1 - p.life) * 6, 0, Math.PI * 2);
      g.fill();
    }
    this.smoke = this.smoke.filter((p) => p.life > 0).slice(-220);
  }

  drawWalkers(g: CanvasRenderingContext2D, dt: number, ov: Overlay, wx0: number, wy0: number, wx1: number, wy1: number) {
    const s = this.state;
    const ex = getExplored(s);
    for (const st of s.settlements) {
      const [sx, sy] = hexToPixel(st.col, st.row);
      if (sx < wx0 - 200 || sx > wx1 + 200 || sy < wy0 - 200 || sy > wy1 + 200 || !ex[st.row * s.width + st.col]) {
        this.walkers.delete(st.id);
        continue;
      }
      let list = this.walkers.get(st.id);
      const want = Math.max(3, Math.min(26, Math.round(st.pop / 9)));
      if (!list) this.walkers.set(st.id, (list = []));
      // puestos de trabajo y hogares
      const jobs: [number, number, string][] = [];
      const homes: [number, number][] = [[sx, sy]];
      for (let r = st.row - 4; r <= st.row + 4; r++)
        for (let c = st.col - 4; c <= st.col + 4; c++) {
          if (c < 0 || r < 0 || c >= s.width || r >= s.height) continue;
          const t = s.tiles[r * s.width + c];
          if (t.sid !== st.id || !t.b || t.b.progress < 1) continue;
          const def = BUILDING[t.b.type];
          const [x, y] = hexToPixel(c, r);
          if (def.cat === 'housing') homes.push([x, y]);
          else if (t.b.staff > 0) {
            const out = Object.keys(def.out ?? {})[0] ?? 'goods';
            jobs.push([x, y, out]);
          }
        }
      while (list.length < want) {
        const [hx, hy] = homes[Math.floor(Math.random() * homes.length)];
        list.push({ x: hx, y: hy, tx: hx, ty: hy, hx, hy, speed: 9 + Math.random() * 7, wait: Math.random() * 3, color: CLOTHES[Math.floor(Math.random() * CLOTHES.length)], carry: null, goingHome: true, jobs });
      }
      if (list.length > want) list.length = want;
      for (const w of list) {
        w.jobs = jobs;
        if (!ov.reducedMotion) {
          if (w.wait > 0) w.wait -= dt;
          else {
            const dx = w.tx - w.x, dy = w.ty - w.y;
            const d = Math.hypot(dx, dy);
            if (d < 1.5) {
              w.wait = 0.8 + Math.random() * 2.5;
              if (w.goingHome && jobs.length) {
                const j = jobs[Math.floor(Math.random() * jobs.length)];
                w.tx = j[0] + (Math.random() - 0.5) * 22; w.ty = j[1] + (Math.random() - 0.5) * 16;
                w.carry = null;
                w.goingHome = false;
              } else {
                const prev = jobs.find((j) => Math.hypot(j[0] - w.x, j[1] - w.y) < 25);
                const h = homes[Math.floor(Math.random() * homes.length)];
                w.hx = h[0]; w.hy = h[1];
                w.tx = h[0] + (Math.random() - 0.5) * 18; w.ty = h[1] + (Math.random() - 0.5) * 12;
                w.carry = prev ? prev[2] : null;
                w.goingHome = true;
              }
            } else {
              const step = Math.min(d, w.speed * dt);
              w.x += (dx / d) * step;
              w.y += (dy / d) * step;
            }
          }
        }
        const bob = w.wait > 0 ? 0 : Math.abs(Math.sin(this.time * 9 + w.speed)) * 0.8;
        g.fillStyle = 'rgba(30,20,10,0.25)';
        g.beginPath(); g.ellipse(w.x + 0.5, w.y + 0.3, 1.8, 0.7, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = w.color;
        g.fillRect(w.x - 1, w.y - 4 - bob, 2, 3.6);
        g.fillStyle = '#d9b48c';
        g.beginPath(); g.arc(w.x, w.y - 5 - bob, 1.05, 0, Math.PI * 2); g.fill();
        if (w.carry) {
          g.fillStyle = CARRY[w.carry] ?? '#b59a72';
          g.fillRect(w.x + 0.6, w.y - 6.2 - bob, 2.4, 2.2);
        }
      }
    }
  }

  drawMovers(g: CanvasRenderingContext2D, ov: Overlay) {
    const s = this.state;
    const ex = getExplored(s);
    const seen = (x: number, y: number) => {
      const [c, r] = pixelToHex(x, y);
      return c >= 0 && r >= 0 && c < s.width && r < s.height && ex[r * s.width + c];
    };
    for (const ar of s.armies) {
      const from = settlementById(s, ar.from), to = settlementById(s, ar.target);
      if (!from || !to) continue;
      const [x0, y0] = hexToPixel(from.col, from.row);
      const [x1, y1] = hexToPixel(to.col, to.row);
      const dist = Math.hypot(x1 - x0, y1 - y0) / HEX_W;
      const t = Math.min(1, ar.t + ov.yearFrac * Math.min(1, 6 / Math.max(3, dist)));
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (!seen(x, y)) continue;
      const civ = s.civs[ar.civ];
      // trayectoria
      g.setLineDash([5, 5]);
      g.strokeStyle = alpha(civ.color, 0.6);
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.setLineDash([]);
      // soldados
      const n = ar.kind === 'raid' ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const ox = (i % 3 - 1) * 5, oy = Math.floor(i / 3) * 4;
        g.fillStyle = civ.color;
        g.fillRect(x + ox - 1.2, y + oy - 5, 2.4, 4);
        g.fillStyle = '#d9b48c';
        g.beginPath(); g.arc(x + ox, y + oy - 6, 1.2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#4a4a4a'; g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(x + ox + 1.6, y + oy - 1); g.lineTo(x + ox + 1.6, y + oy - 9); g.stroke();
      }
      flag(g, x - 9, y + 2, 13, civ.color, civ.color2);
      if (t > 0.9) {
        // combate
        const k = Math.sin(this.time * 12);
        g.strokeStyle = `rgba(255,220,120,${0.5 + k * 0.4})`;
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x1 - 6, y1 - 20); g.lineTo(x1 + 6, y1 - 30); g.moveTo(x1 + 6, y1 - 20); g.lineTo(x1 - 6, y1 - 30); g.stroke();
      }
    }
    for (const sc of s.scouts) {
      const i = Math.min(sc.path.length - 1, Math.floor(sc.t));
      const j = Math.min(sc.path.length - 1, i + 1);
      const f = sc.t - Math.floor(sc.t);
      const [ax, ay] = hexToPixel(sc.path[i][0], sc.path[i][1]);
      const [bx, by] = hexToPixel(sc.path[j][0], sc.path[j][1]);
      const x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
      if (!seen(x, y)) continue;
      const civ = s.civs[sc.civ];
      g.fillStyle = 'rgba(30,20,10,0.25)';
      g.beginPath(); g.ellipse(x, y + 1, 4, 1.5, 0, 0, Math.PI * 2); g.fill();
      for (const ox of [-2.5, 2.5]) {
        g.fillStyle = civ.color; g.fillRect(x + ox - 1.2, y - 5, 2.4, 4);
        g.fillStyle = '#d9b48c'; g.beginPath(); g.arc(x + ox, y - 6, 1.2, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + 5, y - 9); g.stroke();
      // destino
      const [dc, dr] = sc.path[sc.path.length - 1];
      const [dx, dy] = hexToPixel(dc, dr);
      g.strokeStyle = alpha(civ.color, 0.7);
      g.setLineDash([3, 4]);
      g.beginPath(); g.arc(dx, dy, 8, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
    for (const co of s.colonists) {
      const from = settlementById(s, co.from);
      if (!from) continue;
      const [x0, y0] = hexToPixel(from.col, from.row);
      const [x1, y1] = hexToPixel(co.col, co.row);
      const dist = Math.hypot(x1 - x0, y1 - y0) / HEX_W;
      const t = Math.min(1, co.t + ov.yearFrac * Math.min(1, 4 / Math.max(2, dist)));
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const civ = s.civs[co.civ];
      if (!seen(x, y) && !seen(x1, y1)) continue;
      g.setLineDash([4, 5]);
      g.strokeStyle = alpha(civ.color, 0.55);
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.setLineDash([]);
      this.drawCaravan(g, x, y, false, civ.color);
      for (const ox of [-6, -10]) {
        g.fillStyle = civ.color; g.fillRect(x + ox - 1, y - 4, 2, 3.5);
        g.fillStyle = '#d9b48c'; g.beginPath(); g.arc(x + ox, y - 5, 1.1, 0, Math.PI * 2); g.fill();
      }
      flag(g, x1, y1 + 4, 12, civ.color, civ.color2);
    }
  }

  drawClouds(g: CanvasRenderingContext2D, dt: number) {
    const W = this.cam.worldW, H = this.cam.worldH;
    for (const c of this.clouds) {
      c.x += c.s * dt;
      if (c.x - c.r > W) c.x = -c.r;
      g.fillStyle = 'rgba(40,40,60,0.06)';
      g.beginPath(); g.ellipse(c.x + 40, c.y + 60, c.r, c.r * 0.45, 0, 0, Math.PI * 2); g.fill();
      if (this.cam.zoom < 0.9) {
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath(); g.ellipse(c.x, c.y, c.r * 0.9, c.r * 0.38, 0, 0, Math.PI * 2); g.fill();
      }
      void H;
    }
  }

  projectiles: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; kind: string }[] = [];
  unitPos(u: { col: number; row: number; path: [number, number][]; prog: number }): [number, number] {
    const [x, y] = hexToPixel(u.col, u.row);
    if (!u.path.length) return [x, y];
    const [x1, y1] = hexToPixel(u.path[0][0], u.path[0][1]);
    return [x + (x1 - x) * u.prog, y + (y1 - y) * u.prog];
  }
  unitDeath(col: number, row: number) {
    const [x, y] = hexToPixel(col, row);
    for (let i = 0; i < 14; i++) this.smoke.push({ x: x + (Math.random() - 0.5) * 16, y: y - 4, life: 1, vx: (Math.random() - 0.5) * 14 });
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; this.sparks.push({ x, y: y - 6, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 30, life: 0.8, c: '#8a2a1a', r: 1.4 }); }
  }

  drawUnits(g: CanvasRenderingContext2D, dt: number, ov: Overlay, ex: Uint8Array) {
    const s = this.state;
    const list = s.units ?? [];
    const sel = new Set(ov.selectedUnits ?? []);
    const t = this.time;
    // campamentos bárbaros
    for (const c of s.camps ?? []) {
      if (!ex[c.row * s.width + c.col]) continue;
      const [x, y] = hexToPixel(c.col, c.row);
      drawCamp(g, x, y + 4, t);
    }
    // rutas de las unidades seleccionadas
    for (const u of list) {
      if (!sel.has(u.id) || !u.path.length) continue;
      g.strokeStyle = 'rgba(255,240,190,0.9)';
      g.lineWidth = 3 / Math.max(0.6, this.cam.zoom);
      g.setLineDash([6, 5]);
      g.lineDashOffset = -t * 12;
      g.beginPath();
      const [sx, sy] = this.unitPos(u);
      g.moveTo(sx, sy);
      for (const [c, r] of u.path) { const [x, y] = hexToPixel(c, r); g.lineTo(x, y); }
      g.stroke();
      g.setLineDash([]);
      const [dc, dr] = u.path[u.path.length - 1];
      const [dx, dy] = hexToPixel(dc, dr);
      flag(g, dx, dy + 6, 14, '#e2c044', '#2a2119');
    }
    // agrupar por casilla para repartir posiciones
    const groups = new Map<number, typeof list>();
    for (const u of list) {
      const k = u.row * s.width + u.col;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(u);
    }
    const drawn: { u: (typeof list)[0]; x: number; y: number }[] = [];
    const hidden = new Set<number>();
    const stackBadges: { x: number; y: number; n: number; color: string }[] = [];
    for (const [k, arr] of groups) {
      if (!ex[k]) continue;
      // pilas grandes: se dibujan tres regimientos y una insignia con el total
      const still = arr.filter((u) => !u.path.length || u.prog === 0);
      if (still.length > 3) {
        const extra = still.slice(3);
        const [bx, by] = hexToPixel(arr[0].col, arr[0].row);
        stackBadges.push({ x: bx + 16, y: by - 14, n: still.length, color: arr[0].civ >= 0 ? s.civs[arr[0].civ].color : '#3a2420' });
        for (const e of extra) hidden.add(e.id);
      }
      arr.filter((u) => !hidden.has(u.id)).forEach((u, i, vis) => {
        let [x, y] = this.unitPos(u);
        if (!u.path.length || u.prog === 0) {
          const n = vis.length;
          if (n > 1) { const a = (i / n) * Math.PI * 2 + 0.6; x += Math.cos(a) * 11; y += Math.sin(a) * 7 + 6; }
          else y += 8;
        }
        drawn.push({ u, x, y });
      });
    }
    drawn.sort((a, b) => a.y - b.y);
    const scale = this.cam.zoom < 0.7 ? 1.5 : 1.1;
    for (const { u, x, y } of drawn) {
      const def = UNIT[u.type];
      const civ = u.civ >= 0 ? s.civs[u.civ] : null;
      const color = civ?.color ?? '#3a2420';
      const color2 = civ?.color2 ?? '#efe4c8';
      if (sel.has(u.id)) {
        const p = 0.6 + Math.sin(t * 5) * 0.3;
        g.strokeStyle = `rgba(226,192,68,${p})`;
        g.lineWidth = 2.4;
        g.beginPath(); g.ellipse(x, y + 1, 14 * scale, 5 * scale, 0, 0, Math.PI * 2); g.stroke();
      } else if (u.engaged) {
        g.strokeStyle = `rgba(200,60,40,${0.5 + Math.sin(t * 9) * 0.3})`;
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(x, y + 1, 13 * scale, 4.5 * scale, 0, 0, Math.PI * 2); g.stroke();
      }
      g.save();
      g.translate(x, y);
      const jitter = u.engaged ? Math.sin(t * 20 + u.id) * 0.8 : 0;
      g.translate(jitter, 0);
      drawRegiment(g, def.glyph, color, color2, t + u.id, u.path.length > 0 || !!u.engaged, scale);
      g.restore();
      // barra de vida
      const w = 18 * scale;
      g.fillStyle = 'rgba(30,20,10,0.6)';
      g.fillRect(x - w / 2 - 0.5, y + 4.5 * scale, w + 1, 3.2);
      g.fillStyle = u.hp > 60 ? '#7fbf5a' : u.hp > 30 ? '#e2c044' : '#d0563a';
      g.fillRect(x - w / 2, y + 5 * scale, (w * Math.max(0, u.hp)) / 100, 2.2);
      if (u.order === 'fortify' && !u.path.length) {
        g.fillStyle = '#efe4c8'; g.strokeStyle = INK; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x + w / 2 + 2, y + 2); g.lineTo(x + w / 2 + 6, y + 2); g.lineTo(x + w / 2 + 6, y + 6); g.lineTo(x + w / 2 + 4, y + 8); g.lineTo(x + w / 2 + 2, y + 6); g.closePath(); g.fill(); g.stroke();
      }
      if (u.xp >= 10) {
        g.fillStyle = '#e2c044';
        const lv = Math.min(5, Math.floor(u.xp / 10));
        for (let i = 0; i < lv; i++) g.fillRect(x - w / 2 + i * 3, y + 9 * scale, 2, 1.6);
      }
    }
    for (const b of stackBadges) {
      g.fillStyle = b.color;
      g.beginPath(); g.arc(b.x, b.y, 7.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#f3ead6'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#fff8e8';
      g.font = '700 9px "Alegreya Sans", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(b.n), b.x, b.y + 0.5);
    }
    // proyectiles e impactos
    const posOf = new Map(drawn.map((d) => [d.u.id, [d.x, d.y - 6] as [number, number]]));
    for (const b of battleLog.splice(0)) {
      const a = posOf.get(b.a);
      if (!a) continue;
      let target: [number, number] | undefined;
      if (b.b > 0) target = posOf.get(b.b);
      else if (b.b < 0) { const st = s.settlements.find((x) => x.id === -b.b); if (st) { const [px, py] = hexToPixel(st.col, st.row); target = [px + (Math.random() - 0.5) * 14, py - 6]; } }
      if (!target) target = [a[0] + 6, a[1]];
      const dur = b.kind === 'melee' ? 0.25 : b.kind === 'stone' ? 0.9 : b.kind === 'shot' ? 0.12 : 0.45;
      this.projectiles.push({ x0: a[0], y0: a[1], x1: target[0], y1: target[1], t: 0, dur, kind: b.kind });
      if (this.projectiles.length > 160) this.projectiles.shift();
    }
    for (const p of this.projectiles) {
      p.t += dt;
      const f = Math.min(1, p.t / p.dur);
      if (p.kind === 'melee') {
        const mx = (p.x0 + p.x1) / 2, my = (p.y0 + p.y1) / 2;
        g.strokeStyle = `rgba(255,235,170,${1 - f})`;
        g.lineWidth = 1.4;
        g.beginPath();
        for (let k = 0; k < 4; k++) { const a = k * 1.57 + f * 3; g.moveTo(mx, my); g.lineTo(mx + Math.cos(a) * (3 + f * 7), my + Math.sin(a) * (3 + f * 7)); }
        g.stroke();
      } else {
        const x = p.x0 + (p.x1 - p.x0) * f;
        const arc = p.kind === 'stone' ? 40 : p.kind === 'arrow' ? 16 : 0;
        const y = p.y0 + (p.y1 - p.y0) * f - Math.sin(f * Math.PI) * arc;
        if (p.kind === 'arrow') {
          const ang = Math.atan2((p.y1 - p.y0) - Math.cos(f * Math.PI) * arc * Math.PI, p.x1 - p.x0);
          g.strokeStyle = '#2a2119'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(ang) * 5, y - Math.sin(ang) * 5); g.stroke();
        } else if (p.kind === 'stone') {
          g.fillStyle = '#5a554e'; g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
        } else {
          g.fillStyle = `rgba(255,220,140,${1 - f})`; g.beginPath(); g.arc(p.x0, p.y0, 3 + f * 3, 0, Math.PI * 2); g.fill();
        }
        if (f >= 1 && p.t - p.dur < dt * 1.5) {
          for (let k = 0; k < (p.kind === 'stone' ? 6 : 2); k++) this.smoke.push({ x: p.x1 + (Math.random() - 0.5) * 6, y: p.y1, life: 0.7, vx: (Math.random() - 0.5) * 10 });
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.t < p.dur + 0.05);
    // barras de integridad de murallas en asedio
    for (const st of s.settlements) {
      if (!st.siege || !ex[st.row * s.width + st.col] || st.defHp == null) continue;
      const max = defMax(s, st);
      const [x, y] = hexToPixel(st.col, st.row);
      const w = 40;
      g.fillStyle = 'rgba(30,20,10,0.7)'; g.fillRect(x - w / 2 - 1, y - 30, w + 2, 5);
      g.fillStyle = '#c8b48a'; g.fillRect(x - w / 2, y - 29, (w * st.defHp) / max, 3);
    }
  }

  drawLens(g: CanvasRenderingContext2D, lens: string, c0: number, c1: number, r0: number, r1: number, ex: Uint8Array) {
    const s = this.state;
    const byId = new Map(s.settlements.map((x) => [x.id, x]));
    // velo para destacar la capa
    g.fillStyle = 'rgba(30,22,14,0.28)';
    g.fillRect(c0 * HEX_W - HEX_W, r0 * ROW_H - HEX_SIZE, (c1 - c0 + 3) * HEX_W, (r1 - r0 + 3) * ROW_H);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * s.width + c;
        if (!ex[i]) continue;
        const t = s.tiles[i];
        const [px, py] = hexToPixel(c, r);
        let fill: string | null = null;
        if (lens === 'religion') {
          const st = t.sid >= 0 ? byId.get(t.sid) : undefined;
          if (st && st.religion != null && st.religion >= 0) fill = alpha(s.civs[st.religion].color, 0.55);
        } else if (lens === 'mood') {
          const st = t.sid >= 0 ? byId.get(t.sid) : undefined;
          if (st) {
            const v = Math.max(0, Math.min(1, 0.5 + st.health * 0.05 - st.unrest / 120 - Math.max(0, st.pop / Math.max(1, st.housing) - 1)));
            fill = `rgba(${Math.round(200 - v * 140)},${Math.round(70 + v * 120)},60,0.5)`;
          }
        } else if (lens === 'military') {
          if (t.owner >= 0) {
            const pl = s.civs[s.player];
            const rel = pl.relations[t.owner];
            fill = t.owner === pl.id ? 'rgba(80,140,200,0.35)' : rel?.state === 'war' ? 'rgba(200,50,40,0.5)' : rel?.state === 'alliance' ? 'rgba(80,170,90,0.4)' : 'rgba(200,180,120,0.25)';
          }
        } else if (lens === 'resources') {
          if (t.dep) fill = 'rgba(240,210,120,0.45)';
        }
        if (fill) {
          hexPath(g, px, py, HEX_SIZE - 0.5);
          g.fillStyle = fill;
          g.fill();
        }
        if (lens === 'resources' && t.dep) {
          const d = DEPOSITS[t.dep];
          if (!d.reveal || s.civs[s.player].techs.includes(d.reveal)) drawDepositIcon(g, t.dep, px, py, 2);
        }
      }
    if (lens === 'military') {
      for (const st of s.settlements) {
        if (!ex[st.row * s.width + st.col]) continue;
        const [x, y] = hexToPixel(st.col, st.row);
        const def = settlementDefense(s, s.civs[st.civ], st);
        g.fillStyle = 'rgba(30,20,10,0.75)';
        roundRect(g, x - 16, y - 34, 32, 14, 7);
        g.fill();
        g.fillStyle = '#f3ead6';
        g.font = '700 10px "Alegreya Sans", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(def), x, y - 27);
      }
    }
  }

  drawSparks(g: CanvasRenderingContext2D, dt: number) {
    for (const r of this.rings) {
      r.life -= dt * 0.9;
      if (r.life <= 0) continue;
      const k = 1 - r.life;
      g.strokeStyle = `rgba(246,211,107,${r.life * 0.9})`;
      g.lineWidth = 3 * r.life + 0.5;
      g.beginPath();
      g.ellipse(r.x, r.y + 4, 10 + k * (r.big ? 70 : 36), 6 + k * (r.big ? 40 : 20), 0, 0, Math.PI * 2);
      g.stroke();
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const p of this.sparks) {
      p.life -= dt * 0.8;
      p.vy += 90 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) continue;
      g.globalAlpha = Math.min(1, p.life * 1.5);
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    this.sparks = this.sparks.filter((p) => p.life > 0).slice(-400);
  }

  // Vida en el mapa: rebaños, barcas, aves, nieve en el suelo y fuegos de asedio
  drawLife(g: CanvasRenderingContext2D, dt: number, c0: number, c1: number, r0: number, r1: number, ex: Uint8Array, ov: Overlay) {
    const s = this.state;
    const t = this.time;
    const z = this.cam.zoom;
    const winter = this.winterAmount(ov.yearFrac);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * s.width + c;
        if (!ex[i]) continue;
        const tile = s.tiles[i];
        const [px, py] = hexToPixel(c, r);
        // nieve estacional en latitudes frías y templadas
        if (winter > 0 && tile.biome !== 'deep' && tile.biome !== 'ocean' && tile.biome !== 'coast' && tile.biome !== 'desert') {
          const lat = Math.abs(r / s.height - 0.5) * 2;
          const a = winter * Math.max(0, (lat - 0.25) * 1.1) * (tile.biome === 'lake' ? 0.6 : 1);
          if (a > 0.02) {
            hexPath(g, px, py, HEX_SIZE + 0.5);
            g.fillStyle = `rgba(244,247,250,${Math.min(0.55, a)})`;
            g.fill();
          }
        }
        if (z < 0.7 || !tile.b || tile.b.progress < 1 || tile.b.staff <= 0) continue;
        const type = tile.b.type;
        if (type === 'pasture') {
          for (let k = 0; k < 4; k++) {
            const ph = hash2(c, r, 90 + k) * 6.28;
            const x = px + Math.cos(t * 0.15 + ph) * 13 + Math.sin(t * 0.07 + ph * 2) * 5;
            const y = py + 2 + Math.sin(t * 0.12 + ph) * 8;
            g.fillStyle = k === 0 ? '#5b4030' : '#f3ede0';
            g.beginPath(); g.ellipse(x, y, 2.6, 1.7, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#2b2119'; g.fillRect(x + (Math.cos(t * 0.15 + ph) > 0 ? 1.8 : -3), y - 1.4, 1.3, 1.3);
          }
        } else if (type === 'fishery' || type === 'harbor' || type === 'company') {
          const ph = hash2(c, r, 7) * 6.28;
          const R = type === 'fishery' ? 14 : 18;
          const x = px + Math.cos(t * 0.25 + ph) * R, y = py + Math.sin(t * 0.25 + ph) * R * 0.5 + 4;
          const bob = Math.sin(t * 2 + ph) * 0.8;
          g.fillStyle = '#5e3f26';
          g.beginPath(); g.moveTo(x - 4, y + bob); g.lineTo(x + 4, y + bob); g.lineTo(x + 2.5, y + 2 + bob); g.lineTo(x - 2.5, y + 2 + bob); g.closePath(); g.fill();
          g.fillStyle = '#efe4c8';
          g.beginPath(); g.moveTo(x, y - 6 + bob); g.lineTo(x + 3.5, y - 0.5 + bob); g.lineTo(x, y - 0.5 + bob); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(235,245,240,0.45)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(x - 6, y + 3); g.lineTo(x - 10, y + 3.5); g.stroke();
        } else if (type === 'farm' && Math.floor(ov.yearFrac * 4) === 1) {
          // campesinos segando en verano
          const ph = hash2(c, r, 3);
          const x = px - 12 + ((t * 3 + ph * 20) % 24), y = py + 6;
          g.fillStyle = '#8a4a2f'; g.fillRect(x - 0.8, y - 3.5, 1.6, 3);
          g.fillStyle = '#d9b48c'; g.beginPath(); g.arc(x, y - 4.4, 0.9, 0, Math.PI * 2); g.fill();
        }
      }
    // Plaga: miasma verdosa
    for (const st of s.settlements) {
      if (!(st.plague ?? 0) || !ex[st.row * s.width + st.col]) continue;
      const [x, y] = hexToPixel(st.col, st.row);
      for (let k = 0; k < 4; k++) {
        const a = t * 0.4 + k * 1.6;
        g.fillStyle = 'rgba(120,150,60,0.16)';
        g.beginPath(); g.ellipse(x + Math.cos(a) * 14, y - 4 + Math.sin(a) * 6, 16, 8, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // Asedios: humo y fuego en ciudades sitiadas
    for (const st of s.settlements) {
      if (st.siege <= 0 || !ex[st.row * s.width + st.col]) continue;
      const [x, y] = hexToPixel(st.col, st.row);
      if (Math.random() < dt * 8) this.smoke.push({ x: x + (Math.random() - 0.5) * 30, y: y - 6, life: 1, vx: (Math.random() - 0.5) * 8 });
      for (let k = 0; k < 3; k++) {
        const fx = x - 14 + k * 13, fy = y + 6 - k * 3;
        const fl = 0.6 + Math.sin(t * 13 + k * 2) * 0.25;
        g.fillStyle = `rgba(240,140,50,${fl})`;
        g.beginPath(); g.moveTo(fx - 3, fy); g.quadraticCurveTo(fx, fy - 10 * fl, fx + 3, fy); g.fill();
      }
    }
    // Aves migratorias
    if (this.birds.length < 3 && Math.random() < dt * 0.15) {
      const [wx0, wy0] = this.cam.toWorld(0, 0);
      const [wx1, wy1] = this.cam.toWorld(this.cam.vw, this.cam.vh);
      const fromLeft = Math.random() < 0.5;
      this.birds.push({ x: fromLeft ? wx0 - 40 : wx1 + 40, y: wy0 + Math.random() * (wy1 - wy0), vx: (fromLeft ? 1 : -1) * (28 + Math.random() * 20), vy: (Math.random() - 0.5) * 8, n: 3 + Math.floor(Math.random() * 5), ph: Math.random() * 6 });
    }
    g.strokeStyle = 'rgba(42,33,25,0.55)';
    g.lineWidth = 1.1;
    for (const b of this.birds) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const dir = Math.sign(b.vx);
      for (let k = 0; k < b.n; k++) {
        const row = Math.ceil(k / 2), side = k % 2 ? 1 : -1;
        const x = b.x - dir * row * 9, y = b.y + side * row * 6;
        const flap = Math.sin(t * 9 + b.ph + k) * 2.2;
        g.beginPath(); g.moveTo(x - 4, y - flap); g.lineTo(x, y); g.lineTo(x + 4, y - flap); g.stroke();
      }
    }
    const [bx0] = this.cam.toWorld(-200, 0);
    const [bx1] = this.cam.toWorld(this.cam.vw + 200, 0);
    this.birds = this.birds.filter((b) => b.x > bx0 - 200 && b.x < bx1 + 200);
  }

  winterAmount(f: number) {
    // 0 fuera de invierno; sube a finales de otoño y se funde al empezar la primavera
    const p = f * 4;
    if (p >= 3) return Math.min(1, (p - 3) * 4);
    if (p < 0.4) return 1 - p / 0.4;
    if (p > 2.8) return (p - 2.8) * 2;
    return 0;
  }

  drawWeather(g: CanvasRenderingContext2D, dt: number, f: number) {
    const W = this.cam.vw, H = this.cam.vh;
    const winter = this.winterAmount(f);
    // copos de nieve (pantalla)
    const want = Math.round(winter * 90);
    while (this.snow.length < want) this.snow.push({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() });
    if (this.snow.length > want) this.snow.length = want;
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (const p of this.snow) {
      p.y += (18 + p.s * 22) * dt;
      p.x += Math.sin(this.time + p.s * 9) * 12 * dt;
      if (p.y > H) { p.y = -4; p.x = Math.random() * W; }
      g.beginPath(); g.arc(p.x, p.y, p.s * 1.4, 0, Math.PI * 2); g.fill();
    }
    // chaparrones ocasionales en primavera y otoño
    const w = this.weather;
    w.timer -= dt;
    if (w.timer <= 0) {
      const season = Math.floor(f * 4) & 3;
      w.rainTarget = (season === 0 || season === 2) && Math.random() < 0.35 ? 0.5 + Math.random() * 0.5 : 0;
      w.timer = 6 + Math.random() * 10;
    }
    w.rain += (w.rainTarget - w.rain) * Math.min(1, dt * 0.6);
    if (w.rain > 0.03) {
      g.fillStyle = `rgba(60,70,90,${w.rain * 0.08})`;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = `rgba(200,215,230,${w.rain * 0.35})`;
      g.lineWidth = 1;
      g.beginPath();
      const n = Math.round(w.rain * 140);
      for (let i = 0; i < n; i++) {
        const x = (hash2(i, 1, 4) * W + this.time * 240 * (0.8 + hash2(i, 2, 4) * 0.4)) % (W + 40) - 20;
        const y = (hash2(i, 3, 4) * H + this.time * 700 * (0.8 + hash2(i, 4, 4) * 0.4)) % H;
        g.moveTo(x, y);
        g.lineTo(x - 4, y + 12);
      }
      g.stroke();
    }
  }

  // Ciclo lento de luz (unos 4 minutos): atardecer, noche suave y amanecer
  nightAmount() {
    const ph = (this.time / 240) % 1;
    const v = Math.sin(ph * Math.PI * 2);
    return v > 0 ? Math.pow(v, 1.6) * 0.38 : 0;
  }
  drawNight(g: CanvasRenderingContext2D, ex: Uint8Array) {
    const n = this.nightAmount();
    if (n < 0.01) return;
    const W = this.cam.vw, H = this.cam.vh;
    const ph = (this.time / 240) % 1;
    // tono cálido al atardecer, azul profundo de noche
    const dusk = ph < 0.12 || ph > 0.38 ? 1 : 0;
    g.fillStyle = dusk ? `rgba(120,60,40,${n * 0.5})` : `rgba(18,24,58,${n})`;
    g.fillRect(0, 0, W, H);
    // luces de las ciudades
    const s = this.state;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const st of s.settlements) {
      if (!ex[st.row * s.width + st.col]) continue;
      const [px, py] = hexToPixel(st.col, st.row);
      const [x, y] = this.cam.toScreen(px, py);
      if (x < -120 || y < -120 || x > W + 120 || y > H + 120) continue;
      const rad = (22 + Math.sqrt(st.pop) * 2.4) * this.cam.zoom;
      const grd = g.createRadialGradient(x, y, 1, x, y, rad);
      const flick = 0.85 + Math.sin(this.time * 3 + st.id) * 0.08;
      grd.addColorStop(0, `rgba(255,190,100,${n * 0.9 * flick})`);
      grd.addColorStop(0.4, `rgba(255,150,60,${n * 0.35 * flick})`);
      grd.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      // ventanas
      if (this.cam.zoom > 0.8) {
        g.fillStyle = `rgba(255,220,140,${n * 1.6})`;
        const k = Math.min(14, Math.round(st.pop / 30));
        for (let i = 0; i < k; i++) {
          const wx = x + (hash2(st.id, i, 1) - 0.5) * 40 * this.cam.zoom, wy = y + (hash2(st.id, i, 2) - 0.6) * 26 * this.cam.zoom;
          g.fillRect(wx, wy, 1.6 * this.cam.zoom, 1.6 * this.cam.zoom);
        }
      }
    }
    g.restore();
  }

  drawSeason(g: CanvasRenderingContext2D, f: number) {
    // primavera, verano, otoño, invierno — transiciones suaves
    const cols: [number, number, number, number][] = [[140, 200, 120, 0.04], [255, 210, 120, 0.06], [200, 120, 50, 0.07], [200, 220, 240, 0.1]];
    const p = f * 4;
    const i = Math.floor(p) % 4, j = (i + 1) % 4, t = p - Math.floor(p);
    const k = t < 0.75 ? 0 : (t - 0.75) / 0.25;
    const c = cols[i].map((v, n) => v + (cols[j][n] - v) * k);
    g.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`;
    g.fillRect(0, 0, this.cam.vw, this.cam.vh);
    // viñeta de grabado: bordes del mapa algo más oscuros
    const W = this.cam.vw, H = this.cam.vh;
    if (!this.vignette || this.vignette.width !== Math.round(W) || this.vignette.height !== Math.round(H)) {
      const v = document.createElement('canvas');
      v.width = Math.round(W); v.height = Math.round(H);
      const vg = v.getContext('2d')!;
      const grd = vg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
      grd.addColorStop(0, 'rgba(40,25,10,0)');
      grd.addColorStop(1, 'rgba(40,25,10,0.28)');
      vg.fillStyle = grd;
      vg.fillRect(0, 0, W, H);
      this.vignette = v;
    }
    g.drawImage(this.vignette, 0, 0, W, H);
  }

  drawLabels(g: CanvasRenderingContext2D, ex: Uint8Array, ov: Overlay) {
    const s = this.state;
    const z = this.cam.zoom;
    const fs = Math.round(Math.max(11, Math.min(16, 10 + z * 3.5)));
    g.textBaseline = 'middle';
    for (const st of s.settlements) {
      if (!ex[st.row * s.width + st.col]) continue;
      const [px, py] = hexToPixel(st.col, st.row);
      const [x, y] = this.cam.toScreen(px, py + HEX_SIZE * 0.8);
      if (x < -100 || y < -40 || x > this.cam.vw + 100 || y > this.cam.vh + 40) continue;
      const civ = s.civs[st.civ];
      g.font = `600 ${fs}px "Fraunces Variable", Georgia, serif`;
      const name = st.name;
      const popTxt = String(Math.round(st.pop));
      const nw = g.measureText(name).width;
      g.font = `600 ${fs - 2}px "Alegreya Sans", sans-serif`;
      const pw = g.measureText(popTxt).width;
      const w = nw + pw + 26;
      const h = fs + 9;
      const lx = x - w / 2, ly = y - h / 2;
      g.fillStyle = 'rgba(42,33,25,0.25)';
      roundRect(g, lx + 1.5, ly + 2, w, h, 4);
      g.fill();
      g.fillStyle = '#f3ead6';
      roundRect(g, lx, ly, w, h, 4);
      g.fill();
      g.strokeStyle = 'rgba(42,33,25,0.55)';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = civ.color;
      g.fillRect(lx + 1, ly + 1, 5, h - 2);
      if (st.capital) {
        g.fillStyle = '#c9a23a';
        g.beginPath(); g.arc(lx + 3.5, ly - 1, 3, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#2a2119';
      g.font = `600 ${fs}px "Fraunces Variable", Georgia, serif`;
      g.textAlign = 'left';
      g.fillText(name, lx + 11, y + 0.5);
      g.fillStyle = '#6b5b48';
      g.font = `600 ${fs - 2}px "Alegreya Sans", sans-serif`;
      g.fillText(popTxt, lx + 16 + nw, y + 1);
      if (st.religion != null && st.religion >= 0 && s.civs[st.religion]) {
        // fe de la ciudad: pequeño sello del color de su fundador
        g.fillStyle = s.civs[st.religion].color;
        g.beginPath(); g.arc(lx + w - 3, ly + 3, 4.2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#f3ead6'; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = '#f3ead6'; g.fillRect(lx + w - 3.6, ly + 0.6, 1.2, 4.8); g.fillRect(lx + w - 5.2, ly + 2, 4.4, 1.2);
      }
      if ((st.plague ?? 0) > 0) {
        g.fillStyle = '#5a7a2a';
        g.font = `700 ${fs - 3}px "Alegreya Sans", sans-serif`;
        g.fillText('PLAGA', lx, ly - 7);
      }
      if (st.siege > 0) {
        g.fillStyle = '#b4432a';
        g.font = `700 ${fs - 2}px "Alegreya Sans", sans-serif`;
        g.fillText('ASEDIO', lx + w + 4, y + 1);
      }
    }
    void ov;
  }
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
