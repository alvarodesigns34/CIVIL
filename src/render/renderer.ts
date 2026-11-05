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

export interface Overlay {
  selected: [number, number] | null;
  hover: [number, number] | null;
  buildPreview: Map<number, { ok: boolean; label?: string; good?: boolean }> | null;
  colonyPreview: Map<number, boolean> | null;
  mode: 'select' | 'build' | 'colony' | 'scout';
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
          blitSprite(g, spr, px, py, sprScale);
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

    // Habitantes
    if (z > 0.75) this.drawWalkers(g, dt, ov, wx0, wy0, wx1, wy1);

    // Unidades en movimiento
    this.drawMovers(g, ov);

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

  drawSeason(g: CanvasRenderingContext2D, f: number) {
    // primavera, verano, otoño, invierno — transiciones suaves
    const cols: [number, number, number, number][] = [[140, 200, 120, 0.04], [255, 210, 120, 0.06], [200, 120, 50, 0.07], [200, 220, 240, 0.1]];
    const p = f * 4;
    const i = Math.floor(p) % 4, j = (i + 1) % 4, t = p - Math.floor(p);
    const k = t < 0.75 ? 0 : (t - 0.75) / 0.25;
    const c = cols[i].map((v, n) => v + (cols[j][n] - v) * k);
    g.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`;
    g.fillRect(0, 0, this.cam.vw, this.cam.vh);
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
      if (st.siege > 0) {
        g.fillStyle = '#b4432a';
        g.font = `700 ${fs - 2}px "Alegreya Sans", sans-serif`;
        g.fillText('⚔ asedio', lx + w + 4, y + 1);
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
