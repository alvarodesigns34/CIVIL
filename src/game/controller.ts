// Controlador de partida: bucle de tiempo, entrada, acciones del jugador y guardado.
import type { GameState, PendingEvent, ResId } from '../sim/types';
import { Renderer, type Overlay } from '../render/renderer';
import { yearTick, type YearReport } from '../sim/game';
import { generateWorld, type NewGameOpts } from '../sim/worldgen';
import { notify } from './store';
import { RNG } from '../core/rng';
import { BUILDING } from '../data/buildings';
import { TECH } from '../data/techs';
import { canBuildAt, startBuild, cancelBuild, togglePause, sendColonists, canColonize, sendScout, fortify, hurry, marketTrade } from '../sim/actions';
import { buildingYield, placeCtx, progressResearch, simulateEconomy } from '../sim/economy';
import { encodeExplored, getExplored, settlementById, tileAt, capitalOf, reveal, civSettlements } from '../sim/world';
import { applyEffects, queueEvent, EVENT, makeCtx, getChoices, applyChoice, choiceAvailable } from '../sim/events';
import { adoptPolicy, canAdoptPolicy, changeGovernment, govChangeCost, revokePolicy } from '../sim/politics';
import { doDiplo } from '../sim/diplomacy';
import { advanceScouts } from '../sim/actions';
import { AMBITIONS, legacyBreakdown } from '../data/ambitions';
import { clearSpriteCache } from '../render/sprites';
import { sfx, startAudio, audioFrame, applyAudioSettings, setMusicContext, setAmbience } from './audio';
import { builtLog } from '../sim/economy';
import { checkTutorial } from '../sim/tutorial';
import { DECREE } from '../data/decrees';
import { RES_NAME } from '../sim/names';
import { civEra } from '../data/techs';
import type { Unit } from '../sim/types';
import { stepMilitary, deathLog, campLog, unitsAt, hostile, canEnter, orderMove, disband, recruit } from '../sim/military';
import { UNIT } from '../data/units';
import { sendEnvoy } from '../sim/minors';
import { LEVELS, canSpecialize, specialize, appointGovernor, type SpecDef } from '../sim/cities';
import { settlementAt } from '../sim/world';
import { isWater } from '../data/terrain';
import { hexToPixel } from '../core/hex';

export const SPEEDS = [0, 3.2, 1.7, 0.85, 0.35]; // segundos por año
const SAVE_KEY = 'civengine.save.v1';
const SETTINGS_KEY = 'civengine.settings.v1';

export interface Toast {
  id: number;
  title: string;
  text?: string;
  tone: 'good' | 'bad' | 'info' | 'tech' | 'war';
  at: number;
}

export interface Settings {
  reducedMotion: boolean;
  sound: boolean;
  autoPauseEvents: boolean;
  music: number;
  sfx: number;
  ambience: number;
  textScale: number;
  colorblind: boolean;
  reports: boolean;
}

export class Controller {
  state!: GameState;
  renderer!: Renderer;
  canvas!: HTMLCanvasElement;
  speed = 1;
  paused = true;
  acc = 0;
  last = 0;
  running = false;
  overlay: Overlay = { lens: 'none', selected: null, hover: null, buildPreview: null, colonyPreview: null, mode: 'select', yearFrac: 0, reducedMotion: false };
  buildType: string | null = null;
  toasts: Toast[] = [];
  toastId = 1;
  panel: string | null = null;
  lastResult: { title: string; lines: string[] } | null = null;
  settings: Settings = { reducedMotion: false, sound: true, autoPauseEvents: true, music: 0.6, sfx: 0.8, ambience: 0.6, textScale: 1, colorblind: false, reports: true };
  log: Toast[] = [];
  report: { from: number; to: number; d: Record<string, number>; snap: Record<string, number> } | null = null;
  snap: Record<string, number> | null = null;
  audioClock = 0;
  screen: 'title' | 'game' = 'title';
  lastReport: YearReport | null = null;
  pendingConfirm: [number, number] | null = null; // confirmación de construcción en táctil
  isTouch = false;
  needCenter = true;
  keysBound = false;

  constructor() {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) this.settings = { ...this.settings, ...JSON.parse(s) };
    } catch {}
    this.overlay.reducedMotion = this.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    // El audio solo puede empezar tras un gesto del usuario
    const unlock = () => {
      startAudio(this.settings);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    this.overlay.reducedMotion = this.settings.reducedMotion;
    applyAudioSettings(this.settings);
    this.applyLook();
    notify();
  }

  // Accesibilidad: tamaño de interfaz y paleta para daltónicos
  applyLook() {
    document.documentElement.style.setProperty('--ui-scale', String(this.settings.textScale || 1));
    document.documentElement.dataset.scale = String(this.settings.textScale || 1);
    if (!this.state) return;
    const CB = ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#d55e00', '#56b4e9', '#7a5c00', '#333333', '#8c564b', '#7f7f7f', '#17becf'];
    let changed = false;
    for (const c of this.state.civs) {
      const any = c as any;
      if (this.settings.colorblind) {
        if (!any.origColor) { any.origColor = c.color; c.color = CB[c.id % CB.length]; changed = true; }
      } else if (any.origColor) { c.color = any.origColor; delete any.origColor; changed = true; }
    }
    if (changed && this.renderer) { clearSpriteCache(); this.renderer.borderCache = null; }
  }

  get player() {
    return this.state.civs[this.state.player];
  }

  bound = new WeakSet<HTMLCanvasElement>();
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    if (this.renderer) {
      this.renderer.canvas = canvas;
      this.renderer.g = canvas.getContext('2d', { alpha: false })!;
      if (this.renderer.state !== this.state) this.renderer.setState(this.state);
    } else {
      this.renderer = new Renderer(canvas, this.state);
    }
    if (!this.bound.has(canvas)) {
      this.bound.add(canvas);
      this.bindInput(canvas);
    }
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas.parentElement!);
    this.resize();
    const cap = capitalOf(this.state, this.state.player);
    if (cap && this.needCenter) {
      this.renderer.centerOn(cap.col, cap.row, 1.25, true);
      this.needCenter = false;
    }
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.frame);
    }
  }

  resize() {
    const p = this.canvas.parentElement!;
    this.renderer.resize(p.clientWidth, p.clientHeight);
  }

  newGame(opts: NewGameOpts) {
    this.state = generateWorld(opts);
    this.afterLoad();
    primeLedgers(this.state);
    const cap = capitalOf(this.state, this.state.player)!;
    this.renderer?.setState(this.state);
    this.renderer?.centerOn(cap.col, cap.row, 1.25, true);
    this.needCenter = true;
    this.state.chronicle.push({ year: 1, civ: this.state.player, kind: 'world', important: true, text: `Los ${this.player.people} encendieron su primer fuego en ${cap.name}. Así empezó su historia.` });
    this.paused = true;
    this.speed = 1;
    this.screen = 'game';
    queueEvent(this.state, this.player, 'sys_intro', cap.id);
    this.toast('Tu pueblo despierta', 'Elige qué investigar y empieza a construir. Pulsa ▶ para que corra el tiempo.', 'info');
    notify();
  }

  afterLoad() {
    this.snap = null;
    this.report = null;
    setTimeout(() => this.applyLook(), 0);
    this.log = [];
    this.overlay.selected = null;
    this.overlay.mode = 'select';
    this.buildType = null;
    this.panel = null;
    this.toasts = [];
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }
  saveInfo(slot = 0): { year: number; name: string; cal?: number } | null {
    try {
      const raw = localStorage.getItem(this.key(slot) + '.meta');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  key(slot: number) {
    return slot ? `${SAVE_KEY}.slot${slot}` : SAVE_KEY;
  }
  exportSave(): string {
    encodeExplored(this.state);
    return JSON.stringify(this.state);
  }
  importSave(text: string): boolean {
    try {
      const st = JSON.parse(text) as GameState;
      if (!st.tiles || !st.civs) throw new Error('formato');
      this.state = migrate(st);
      this.afterLoad();
      this.renderer?.setState(this.state);
      const cap = capitalOf(this.state, this.state.player);
      if (cap) this.renderer?.centerOn(cap.col, cap.row, 1.2, true);
      this.needCenter = true;
      this.paused = true;
      this.screen = 'game';
      this.toast('Partida importada', undefined, 'good');
      notify();
      return true;
    } catch {
      this.toast('No se pudo importar', 'El archivo no es una partida válida.', 'bad');
      return false;
    }
  }
  save(silent = false, slot = 0) {
    if (!this.state) return;
    try {
      encodeExplored(this.state);
      localStorage.setItem(this.key(slot), JSON.stringify(this.state));
      localStorage.setItem(this.key(slot) + '.meta', JSON.stringify({ year: this.state.year, name: this.player.name, cal: this.state.calendarStart }));
      if (!silent) this.toast('Partida guardada', undefined, 'info');
    } catch (e) {
      this.toast('No se pudo guardar', 'El almacenamiento del navegador no está disponible.', 'bad');
    }
  }
  load(slot = 0): boolean {
    try {
      const raw = localStorage.getItem(this.key(slot));
      if (!raw) return false;
      const s = migrate(JSON.parse(raw) as GameState);
      // los modificadores permanentes se guardaron con números grandes; nada que convertir
      this.state = s;
      this.afterLoad();
      this.renderer?.setState(s);
      const cap = capitalOf(s, s.player);
      if (cap) this.renderer?.centerOn(cap.col, cap.row, 1.2, true);
      this.needCenter = true;
      this.paused = true;
      this.screen = 'game';
      notify();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  toast(title: string, text?: string, tone: Toast['tone'] = 'info') {
    const t = { id: this.toastId++, title, text, tone, at: performance.now() };
    this.toasts.push(t);
    if (this.state) { this.log.unshift({ ...t, at: this.state.year }); if (this.log.length > 80) this.log.pop(); }
    if (this.toasts.length > 4) this.toasts.shift();
    notify();
  }

  // ───────────── Bucle
  frame = (now: number) => {
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    if (this.state && this.screen === 'game' && this.renderer) {
      const blocking = this.blockingEvent();
      if (!this.paused && !blocking && !this.state.gameOver && this.speed > 0) {
        const spy = SPEEDS[this.speed];
        this.acc += dt;
        advanceScouts(this.state, dt / spy);
        stepMilitary(this.state, dt / spy);
        this.militaryFeedback();
        if (this.acc >= spy) {
          this.acc -= spy;
          this.tick();
        }
        this.overlay.yearFrac = Math.min(0.999, this.acc / spy);
      }
      this.renderer.draw(dt, this.overlay);
      this.audioClock -= dt;
      if (this.audioClock <= 0) {
        this.audioClock = 1;
        this.updateSoundscape();
      }
      // caducidad de avisos
      const before = this.toasts.length;
      this.toasts = this.toasts.filter((t) => now - t.at < 5500);
      if (this.toasts.length !== before) notify();
    }
    audioFrame(dt);
    requestAnimationFrame(this.frame);
  };

  // Muertes, combates cercanos y pausa automática ante invasiones
  invadedAt = -100;
  militaryFeedback() {
    const s = this.state;
    const p = this.player;
    for (const d of deathLog.splice(0)) {
      this.renderer.unitDeath(d.col, d.row);
      if (d.civ === p.id) { this.toast(`Hemos perdido un regimiento de ${UNIT[d.type].name.toLowerCase()}`, undefined, 'war'); sfx('battle', this.settings); }
      else if (d.killer === p.id) { this.toast(`¡Victoria! Enemigo derrotado`, d.civ < 0 ? 'Una banda de saqueadores ha sido aniquilada.' : `${UNIT[d.type].name} de ${s.civs[d.civ].name} aniquilados.`, 'good'); sfx('battle', this.settings); }
    }
    for (const c of campLog.splice(0)) if (c.civ === p.id) { this.toast('Campamento bárbaro arrasado', `+${c.reward} de oro`, 'good'); sfx('victory', this.settings); }
    // invasión: tropas hostiles en nuestro territorio
    if (s.year - this.invadedAt > 6) {
      const intr = (s.units ?? []).find((u) => hostile(s, p.id, u.civ) && s.tiles[u.row * s.width + u.col].owner === p.id);
      if (intr) {
        this.invadedAt = s.year;
        this.toast(intr.civ < 0 ? '¡Bárbaros en nuestras tierras!' : `¡Tropas de ${s.civs[intr.civ].name} en nuestras tierras!`, 'Toca para verlas. Recluta tropas en una ciudad o envía las que tengas.', 'war');
        sfx('war', this.settings);
        if (this.settings.autoPauseEvents) this.paused = true;
        this.renderer.centerOn(intr.col, intr.row);
        notify();
      }
    }
  }

  // Música y ambiente según lo que ocurre y lo que se ve
  updateSoundscape() {
    const s = this.state;
    const p = this.player;
    const atWar = Object.values(p.relations).some((r) => r.state === 'war');
    setMusicContext(civEra(p.techs), atWar ? 'war' : p.stability < 30 ? 'tense' : 'calm');
    const cam = this.renderer.cam;
    const [c0, r0] = [Math.floor((cam.x - cam.vw / 2 / cam.zoom) / 55.4), Math.floor((cam.y - cam.vh / 2 / cam.zoom) / 48)];
    const [c1, r1] = [Math.ceil((cam.x + cam.vw / 2 / cam.zoom) / 55.4), Math.ceil((cam.y + cam.vh / 2 / cam.zoom) / 48)];
    let water = 0, forest = 0, n = 0, town = 0;
    for (let r = Math.max(0, r0); r <= Math.min(s.height - 1, r1); r += 2)
      for (let c = Math.max(0, c0); c <= Math.min(s.width - 1, c1); c += 2) {
        const t = s.tiles[r * s.width + c];
        n++;
        if (t.biome === 'coast' || t.biome === 'ocean' || t.biome === 'deep' || t.biome === 'lake') water++;
        if (t.feature === 'forest') forest++;
      }
    for (const st of s.settlements) {
      const [x, y] = hexToPixel(st.col, st.row);
      if (Math.abs(x - cam.x) < cam.vw / cam.zoom / 2 && Math.abs(y - cam.y) < cam.vh / cam.zoom / 2) town += st.pop / 400;
    }
    const season = Math.floor(this.overlay.yearFrac * 4) & 3;
    setAmbience({
      water: n ? (water / n) * 1.3 : 0,
      birds: n ? 0.3 + (forest / n) * 1.5 : 0.3,
      wind: 0.25 + (cam.zoom < 0.6 ? 0.4 : 0) + (season === 3 ? 0.3 : 0),
      town: Math.min(1, town * cam.zoom),
      winter: season === 3 ? 1 : 0,
    });
  }

  blockingEvent(): PendingEvent | null {
    if (!this.state) return null;
    return this.state.events.pending.find((p) => p.civ === this.state.player) ?? null;
  }

  tick() {
    const s = this.state;
    const p = this.player;
    const prevWars = new Set(Object.entries(p.relations).filter(([, r]) => r.state === 'war').map(([k]) => k));
    const prevSettlements = s.settlements.filter((x) => x.civ === p.id).length;
    builtLog.length = 0;
    const chronBefore = s.chronicle.length;
    const leaderBefore = p.leader.name;
    const report = yearTick(s);
    // Batallas y sucesos que nos afectan
    for (const e of s.chronicle.slice(chronBefore)) {
      if (e.kind === 'war' && e.text.includes(p.people) && !e.text.includes('declararon')) {
        this.toast('Noticias del frente', e.text, e.text.includes(`Los ${p.people}`) && !e.text.includes('derrotado') ? 'good' : 'war');
        sfx('battle', this.settings);
      }
    }
    if (p.leader.name !== leaderBefore) sfx('death', this.settings);
    this.lastReport = report;
    let builtCount = 0;
    for (const b of builtLog) {
      if (b.civ !== p.id) continue;
      builtCount++;
      this.renderer.burst(b.col, b.row, BUILDING[b.type].wonder ? 2 : 1);
      if (BUILDING[b.type].wonder) this.toast(`¡${BUILDING[b.type].name} completada!`, 'Una maravilla que el mundo recordará.', 'good');
    }
    if (builtCount) sfx('built', this.settings);
    // exploración pasiva alrededor del territorio propio
    for (const st of s.settlements) if (st.civ === p.id && st.pop > 0) reveal(s, st.col, st.row, st.radius + 2);
    for (const t of report.techs) {
      if (t.civ === p.id) {
        this.toast(`Descubierto: ${TECH[t.id].name}`, TECH[t.id].desc, 'tech');
        sfx('tech', this.settings);
      }
    }
    for (const a of report.ambitions) {
      const def = AMBITIONS.find((x) => x.id === a)!;
      this.toast(`Ambición cumplida: ${def.name}`, `+${def.legacy} de legado`, 'good');
      sfx('good', this.settings);
    }
    for (const lv of report.levels) {
      const st = settlementById(s, lv.sid);
      if (!st) continue;
      if (lv.to > lv.from) {
        this.toast(`${st.name} es ahora ${LEVELS[lv.to].name.toLowerCase()}`, 'Más vivienda, impuestos, saber y cultura.', 'good');
        this.renderer.burst(st.col, st.row, 1.6);
        sfx('built', this.settings);
      } else this.toast(`${st.name} decae a ${LEVELS[lv.to].name.toLowerCase()}`, 'Sus necesidades llevan años sin cubrirse.', 'bad');
    }
    if (report.traditionReady) this.toast('Nueva tradición disponible', 'Tu cultura ha madurado: elige una tradición.', 'good');
    for (const [k, r] of Object.entries(p.relations)) {
      if (r.state === 'war' && !prevWars.has(k)) {
        this.toast('¡Guerra!', `Estáis en guerra con ${s.civs[+k].name}.`, 'war');
        sfx('war', this.settings);
      }
    }
    const nowS = s.settlements.filter((x) => x.civ === p.id).length;
    if (nowS < prevSettlements) this.toast('Hemos perdido un asentamiento', undefined, 'bad');
    if (!p.research && this.state.year % 6 === 0) {
      // recordatorio suave
    }
    this.checkTut();
    // Informe de la generación
    const now = this.snapshot();
    if (!this.snap) this.snap = now;
    if (this.settings.reports && s.year % 50 === 0 && s.year > 1 && !s.gameOver) {
      const d: Record<string, number> = {};
      for (const k of Object.keys(now)) d[k] = now[k] - (this.snap[k] ?? 0);
      this.report = { from: this.snap.year, to: s.year, d, snap: now };
      this.snap = now;
      this.paused = true;
    }
    if (s.year - s.lastAutosave >= 10) {
      s.lastAutosave = s.year;
      this.save(true);
    }
    if (this.blockingEvent()) sfx('event', this.settings);
    if (s.gameOver) {
      this.paused = true;
      this.save(true);
    }
    // recalcular vista previa
    if (this.overlay.mode === 'build' && this.buildType) this.computeBuildPreview();
    notify();
  }

  snapshot(): Record<string, number> {
    const s = this.state;
    const p = this.player;
    return {
      year: s.year,
      pop: civSettlements(s, p.id).reduce((a, x) => a + x.pop, 0),
      cities: civSettlements(s, p.id).length,
      techs: p.techs.length,
      legacy: legacyBreakdown(s, p).total,
      units: (s.units ?? []).filter((u) => u.civ === p.id).length,
      greats: p.greats?.length ?? 0,
      traditions: p.traditions.length,
    };
  }

  checkTut() {
    if (!this.state) return;
    const step = checkTutorial(this.state, this.player);
    if (step) {
      const rw = Object.entries(step.reward).map(([k, v]) => `+${v} ${RES_NAME[k as ResId]}`).join(', ');
      this.toast(`Objetivo cumplido: ${step.title}`, `El consejo os recompensa: ${rw}.`, 'good');
      sfx('good', this.settings);
    }
  }

  setSpeed(n: number) {
    if (n === 0) this.paused = true;
    else {
      this.speed = n;
      this.paused = false;
    }
    notify();
  }
  togglePause() {
    this.paused = !this.paused;
    notify();
  }

  // ───────────── Entrada
  bindInput(canvas: HTMLCanvasElement) {
    const pointers = new Map<number, { x: number; y: number }>();
    let dragDist = 0;
    let pinchD = 0;
    let downAt = 0;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      dragDist = 0;
      downAt = performance.now();
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      }
      if (e.pointerType !== 'mouse') this.isTouch = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') {
          const h = this.renderer.pick(e.offsetX, e.offsetY);
          const hv = this.overlay.hover;
          if (!h || !hv || h[0] !== hv[0] || h[1] !== hv[1]) {
            this.overlay.hover = h;
            if (this.overlay.mode !== 'select') notify();
          }
        }
        return;
      }
      const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
      p.x = e.offsetX;
      p.y = e.offsetY;
      if (pointers.size === 1) {
        dragDist += Math.abs(dx) + Math.abs(dy);
        if (dragDist > 6) this.renderer.cam.pan(dx, dy);
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchD > 0) this.renderer.cam.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchD);
        pinchD = d;
        dragDist = 99;
      }
    });
    const up = (e: PointerEvent) => {
      const had = pointers.has(e.pointerId);
      pointers.delete(e.pointerId);
      if (!had) return;
      if (pointers.size === 0 && dragDist <= 6 && performance.now() - downAt < 600) this.onTap(e.offsetX, e.offsetY, e.pointerType !== 'mouse');
      if (pointers.size < 2) pinchD = 0;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
    canvas.addEventListener('pointerleave', () => { this.overlay.hover = null; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      this.renderer.cam.zoomAt(e.offsetX, e.offsetY, f);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelMode();
      this.overlay.selectedUnits = [];
    });
    if (this.keysBound) return;
    this.keysBound = true;
    window.addEventListener('keydown', (e) => {
      if (this.screen !== 'game' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const cam = this.renderer.cam;
      const step = 60;
      switch (e.key) {
        case ' ': e.preventDefault(); if (!this.blockingEvent()) this.togglePause(); break;
        case '1': case '2': case '3': case '4': this.setSpeed(+e.key); break;
        case 'Escape': this.cancelMode(); this.panel = null; this.overlay.selected = null; this.overlay.selectedUnits = []; notify(); break;
        case 'ArrowLeft': case 'a': cam.pan(step, 0); break;
        case 'ArrowRight': case 'd': cam.pan(-step, 0); break;
        case 'ArrowUp': case 'w': cam.pan(0, step); break;
        case 'ArrowDown': case 's': cam.pan(0, -step); break;
        case '+': case '=': cam.zoomAt(cam.vw / 2, cam.vh / 2, 1.2); break;
        case '-': cam.zoomAt(cam.vw / 2, cam.vh / 2, 1 / 1.2); break;
        case 'b': this.panel = this.panel === 'build' ? null : 'build'; notify(); break;
        case 't': this.panel = this.panel === 'tech' ? null : 'tech'; notify(); break;
        case 'g': this.panel = this.panel === 'gov' ? null : 'gov'; notify(); break;
      }
    });
  }

  onTap(sx: number, sy: number, touch: boolean) {
    const hex = this.renderer.pick(sx, sy);
    if (!hex) return;
    const [c, r] = hex;
    const s = this.state;
    // Tropas seleccionadas: el toque es una orden
    const sel = this.selectedUnits();
    if (sel.length && this.overlay.mode === 'select') {
      if (sel.some((u) => u.col === c && u.row === r) && !(sel[0].path.length)) {
        this.clearUnits();
        return;
      }
      const mineHere = unitsAt(s, c, r).filter((u) => u.civ === this.player.id);
      if (mineHere.length && !sel.some((u) => mineHere.includes(u))) {
        this.selectUnits(mineHere.map((u) => u.id));
        return;
      }
      this.orderUnits(c, r);
      return;
    }
    if (!getExplored(s)[r * s.width + c]) {
      if (this.overlay.mode === 'scout') this.tryScout(c, r);
      return;
    }
    if (this.overlay.mode === 'build' && this.buildType) {
      // En táctil: primer toque selecciona, segundo confirma
      if (touch && !(this.pendingConfirm && this.pendingConfirm[0] === c && this.pendingConfirm[1] === r)) {
        this.pendingConfirm = [c, r];
        this.overlay.selected = [c, r];
        this.overlay.hover = [c, r];
        notify();
        return;
      }
      this.tryBuild(c, r);
      return;
    }
    if (this.overlay.mode === 'colony') {
      if (touch && !(this.pendingConfirm && this.pendingConfirm[0] === c && this.pendingConfirm[1] === r)) {
        this.pendingConfirm = [c, r];
        this.overlay.selected = [c, r];
        this.overlay.hover = [c, r];
        notify();
        return;
      }
      this.tryColony(c, r);
      return;
    }
    if (this.overlay.mode === 'scout') {
      this.tryScout(c, r);
      return;
    }
    // Tocar tropas propias las selecciona (si no hay ciudad propia, o si ya estaba seleccionada la casilla)
    const mine = unitsAt(s, c, r).filter((u) => u.civ === this.player.id);
    const st = settlementAt(s, c, r);
    const again = this.overlay.selected && this.overlay.selected[0] === c && this.overlay.selected[1] === r;
    if (mine.length && (!st || st.civ !== this.player.id || again)) {
      this.selectUnits(mine.map((u) => u.id));
      return;
    }
    this.overlay.selected = [c, r];
    sfx('tap', this.settings);
    notify();
  }

  // ───────────── Tropas
  selectedUnits(): Unit[] {
    const ids = new Set(this.overlay.selectedUnits ?? []);
    return (this.state.units ?? []).filter((u) => ids.has(u.id));
  }
  selectUnits(ids: number[]) {
    this.overlay.selectedUnits = ids;
    this.overlay.selected = null;
    sfx('select', this.settings);
    notify();
  }
  clearUnits() {
    this.overlay.selectedUnits = [];
    notify();
  }
  orderUnits(c: number, r: number) {
    const s = this.state;
    const p = this.player;
    const sel = this.selectedUnits();
    const city = settlementAt(s, c, r);
    const foeHere = unitsAt(s, c, r).some((u) => hostile(s, p.id, u.civ));
    const t = tileAt(s, c, r)!;
    if (t.owner >= 0 && t.owner !== p.id && !canEnter(s, p.id, t) && !foeHere) {
      const o = s.civs[t.owner];
      this.toast('Frontera cerrada', `No estáis en guerra con ${o.name}. Declarad la guerra o firmad paso libre para entrar.`, 'bad');
      sfx('error', this.settings);
      return;
    }
    let ok: boolean;
    if (city && hostile(s, p.id, city.civ)) {
      ok = orderMove(s, sel, [c, r], 'campaign', city.id);
      if (ok) this.toast('¡Al asalto!', `Tus tropas marchan sobre ${city.name}. Rompe sus murallas y entra.`, 'war');
    } else if (foeHere || (s.camps ?? []).some((x) => x.col === c && x.row === r)) {
      ok = orderMove(s, sel, [c, r], 'move');
      if (ok) this.toast('¡Al ataque!', undefined, 'war');
    } else ok = orderMove(s, sel, [c, r], 'move');
    if (!ok) {
      this.toast('No hay camino', isWater(t) && !p.techs.includes('sailing') ? 'Necesitas Navegación para cruzar el agua.' : 'Tus tropas no pueden llegar allí.', 'bad');
      sfx('error', this.settings);
    } else sfx(foeHere || city ? 'war' : 'place', this.settings);
    if (ok && this.paused && this.settings.autoPauseEvents) {
      // en pausa: las órdenes quedan dadas; recordatorio suave
    }
    notify();
  }
  unitCommand(cmd: 'fortify' | 'raid' | 'home' | 'disband' | 'stop') {
    const s = this.state;
    const sel = this.selectedUnits();
    for (const u of sel) {
      if (cmd === 'fortify') { u.path = []; u.order = 'fortify'; }
      if (cmd === 'stop') { u.path = []; u.order = 'idle'; }
      if (cmd === 'raid') u.order = 'raid';
      if (cmd === 'disband') disband(s, u);
      if (cmd === 'home') {
        const home = settlementById(s, u.home) ?? capitalOf(s, u.civ);
        if (home) orderMove(s, [u], [home.col, home.row], 'move');
      }
    }
    if (cmd === 'disband') this.clearUnits();
    sfx('select', this.settings);
    notify();
  }
  specialize(sid: number, id: string) {
    const st = settlementById(this.state, sid)!;
    const why = canSpecialize(this.state, this.player, st, id);
    if (why) return this.toast('No es posible', why, 'bad');
    specialize(this.state, this.player, st, id);
    this.renderer.burst(st.col, st.row, 1);
    sfx('good', this.settings);
    notify();
  }
  appoint(sid: number, g: { kind: string; name: string; age: number; loyalty: number }) {
    if (this.player.res.influence < 15) return this.toast('Influencia insuficiente', 'Nombrar un gobernador cuesta 15.', 'bad');
    appointGovernor(this.state, this.player, settlementById(this.state, sid)!, g);
    sfx('good', this.settings);
    notify();
  }
  envoy(mid: number, kind: 'envoy' | 'gift') {
    const m = this.state.civs[mid];
    const err = sendEnvoy(this.state, this.player, m, kind);
    if (err) { this.toast('No es posible', err, 'bad'); sfx('error', this.settings); }
    else { this.toast(kind === 'envoy' ? 'Emisarios enviados' : 'Regalo entregado', `${m.name}: amistad ${Math.round(m.envoys?.[this.player.id] ?? 0)}`, 'good'); sfx('coin', this.settings); }
    notify();
  }
  recruit(sid: number, type: string) {
    const st = settlementById(this.state, sid)!;
    const err = recruit(this.state, this.player, st, type);
    if (err) { this.toast('No se puede reclutar', err, 'bad'); sfx('error', this.settings); }
    else { sfx('build', this.settings); this.toast(`Reclutando ${UNIT[type].name.toLowerCase()}`, `Estarán listos en ${UNIT[type].time} año${UNIT[type].time > 1 ? 's' : ''} en ${st.name}.`, 'good'); }
    notify();
  }

  // ───────────── Modos
  enterBuild(type: string) {
    this.buildType = type;
    this.overlay.mode = 'build';
    this.pendingConfirm = null;
    this.computeBuildPreview();
    if (this.isTouch) this.panel = null;
    notify();
  }
  enterColony() {
    this.overlay.mode = 'colony';
    this.buildType = null;
    this.pendingConfirm = null;
    const s = this.state;
    const m = new Map<number, boolean>();
    const ex = getExplored(s);
    for (let i = 0; i < s.tiles.length; i++) {
      if (!ex[i]) continue;
      const c = i % s.width, r = Math.floor(i / s.width);
      const why = canColonize(s, this.player, c, r);
      if (!why || why === 'Recursos insuficientes' || why.startsWith('Ningún')) m.set(i, !why || true);
    }
    this.overlay.colonyPreview = m;
    if (this.isTouch) this.panel = null;
    notify();
  }
  enterScout() {
    this.overlay.mode = 'scout';
    this.buildType = null;
    if (this.isTouch) this.panel = null;
    this.toast('Elige un destino', 'Toca cualquier punto del mapa, explorado o no.', 'info');
    notify();
  }
  cancelMode() {
    this.overlay.mode = 'select';
    this.buildType = null;
    this.overlay.buildPreview = null;
    this.overlay.colonyPreview = null;
    this.pendingConfirm = null;
    notify();
  }

  computeBuildPreview() {
    const s = this.state;
    const def = BUILDING[this.buildType!];
    const civ = this.player;
    const m = new Map<number, { ok: boolean; label?: string; good?: boolean }>();
    const vals: number[] = [];
    const entries: [number, number, string][] = [];
    for (let i = 0; i < s.tiles.length; i++) {
      const t = s.tiles[i];
      if (t.owner !== civ.id) continue;
      const c = i % s.width, r = Math.floor(i / s.width);
      const why = canBuildAt(s, civ, def, c, r);
      if (why) continue;
      const st = settlementById(s, t.sid)!;
      const y = buildingYield(def, placeCtx(s, civ, st, c, r));
      const main = Object.entries(y.out).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
      let label = '';
      let v = 0;
      if (main) {
        v = (main[1] as number) * y.mult;
        label = `+${Math.round(v)}`;
      } else if (def.housing) {
        v = def.housing;
        label = `+${def.housing} hogar`;
      } else if (def.stability) label = `+${def.stability} est.`;
      vals.push(v);
      entries.push([i, v, label]);
    }
    const best = Math.max(0, ...vals);
    for (const [i, v, label] of entries) m.set(i, { ok: true, label, good: best > 0 && v >= best * 0.85 });
    this.overlay.buildPreview = m;
  }

  // ───────────── Acciones
  tryBuild(c: number, r: number) {
    const err = startBuild(this.state, this.player, this.buildType!, c, r);
    if (err) {
      this.toast('No se puede construir', err, 'bad');
      sfx('error', this.settings);
    } else {
      sfx('place', this.settings);
      this.renderer.burst(c, r, 0.4);
      this.checkTut();
      this.overlay.selected = [c, r];
      this.pendingConfirm = null;
      const def = BUILDING[this.buildType!];
      // seguir en modo construcción para colocar varios (salvo maravillas/únicos)
      if (def.wonder || def.perSettlement || def.perCiv || this.isTouch) this.cancelMode();
      else this.computeBuildPreview();
    }
    notify();
  }
  tryColony(c: number, r: number) {
    const err = sendColonists(this.state, this.player, c, r, new RNG(this.state.rng ^ 0x5bd1));
    if (err) {
      this.toast('No se puede fundar aquí', err, 'bad');
      sfx('error', this.settings);
    } else {
      this.toast('Los colonos se ponen en marcha', 'Fundarán un nuevo asentamiento en unos años.', 'good');
      sfx('build', this.settings);
      this.cancelMode();
    }
    notify();
  }
  tryScout(c: number, r: number) {
    const err = sendScout(this.state, this.player, c, r);
    if (err) {
      this.toast('Expedición imposible', err, 'bad');
      sfx('error', this.settings);
    } else {
      this.toast('Los exploradores parten', undefined, 'good');
      this.checkTut();
      this.cancelMode();
    }
    notify();
  }
  cancelBuilding(c: number, r: number) {
    cancelBuild(this.state, this.player, c, r);
    notify();
  }
  pauseBuilding(c: number, r: number) {
    togglePause(this.state, this.player, c, r);
    notify();
  }
  hurryBuilding(c: number, r: number) {
    const err = hurry(this.state, this.player, c, r);
    if (err) this.toast('No se puede acelerar', err, 'bad');
    else sfx('build', this.settings);
    notify();
  }
  upgrade(c: number, r: number, to: string) {
    this.buildType = to;
    const err = startBuild(this.state, this.player, to, c, r);
    this.buildType = null;
    if (err) this.toast('No se puede mejorar', err, 'bad');
    else sfx('build', this.settings);
    notify();
  }
  fortify(sid: number) {
    const st = settlementById(this.state, sid);
    if (!st) return;
    const err = fortify(this.state, this.player, st);
    if (err) this.toast('No se puede fortificar', err, 'bad');
    else { this.toast(`${st.name} refuerza sus defensas`, undefined, 'good'); sfx('build', this.settings); }
    notify();
  }
  research(id: string) {
    this.player.research = id;
    progressResearch(this.state, this.player);
    sfx('select', this.settings);
    this.checkTut();
    notify();
  }
  chooseTradition(id: string) {
    const p = this.player;
    if (!p.traditionOffer?.includes(id)) return;
    p.traditions.push(id);
    p.traditionOffer = null;
    this.state.chronicle.push({ year: this.state.year, civ: p.id, kind: 'culture', text: `Los ${p.people} abrazaron una nueva tradición.` });
    sfx('good', this.settings);
    notify();
  }
  adopt(id: string) {
    const why = canAdoptPolicy(this.player, id);
    if (why) return this.toast('No se puede adoptar', why, 'bad');
    adoptPolicy(this.state, this.player, id);
    sfx('good', this.settings);
    this.checkTut();
    notify();
  }
  revoke(id: string) {
    revokePolicy(this.state, this.player, id);
    notify();
  }
  setGovernment(id: string) {
    const cost = govChangeCost(this.player);
    if (this.player.res.influence < cost) return this.toast('Influencia insuficiente', `Necesitas ${cost}.`, 'bad');
    this.player.res.influence -= cost;
    changeGovernment(this.state, this.player, id);
    sfx('good', this.settings);
    notify();
  }
  diplo(other: number, action: string) {
    const res = doDiplo(this.state, this.player, this.state.civs[other], action, new RNG((this.state.rng ^ (other * 7919) ^ action.length * 31 ^ Math.floor(performance.now()))));
    this.toast(res.ok ? 'Diplomacia' : 'Respuesta', res.msg, res.ok ? 'good' : 'bad');
    notify();
  }
  trade(res: ResId, amount: number) {
    const err = marketTrade(this.state, this.player, res, amount);
    if (err) this.toast('Mercado', err, 'bad');
    else sfx('coin', this.settings);
    notify();
  }
  decreeStatus(id: string): { ok: boolean; why?: string; cost: Partial<Record<ResId, number>> } {
    const d = DECREE[id];
    const p = this.player;
    const ctx = makeCtx(this.state, p, capitalOf(this.state, p.id)?.id ?? -1, -1);
    const cost = Object.fromEntries(Object.entries(d.cost(ctx)).filter(([, v]) => v)) as Partial<Record<ResId, number>>;
    if (d.tech && !p.techs.includes(d.tech)) return { ok: false, why: 'Requiere tecnología', cost };
    const last = p.flags[`dec_${id}`];
    if (last != null && this.state.year - last < d.cooldown) return { ok: false, why: `Disponible en ${d.cooldown - (this.state.year - last)} años`, cost };
    if (d.req && !d.req(ctx)) return { ok: false, why: d.reqText ?? 'No disponible', cost };
    for (const [k, v] of Object.entries(cost)) if (p.res[k as ResId] < (v as number)) return { ok: false, why: 'Recursos insuficientes', cost };
    return { ok: true, cost };
  }
  decree(id: string) {
    const st = this.decreeStatus(id);
    if (!st.ok) return this.toast('No se puede decretar', st.why, 'bad');
    const p = this.player;
    const d = DECREE[id];
    for (const [k, v] of Object.entries(st.cost)) p.res[k as ResId] -= v as number;
    const ctx = makeCtx(this.state, p, capitalOf(this.state, p.id)?.id ?? -1, -1);
    const out: string[] = [];
    applyEffects(this.state, ctx, d.fx(ctx), new RNG(this.state.rng ^ 0x77), out);
    p.flags[`dec_${id}`] = this.state.year;
    this.state.chronicle.push({ year: this.state.year, civ: p.id, kind: 'politics', text: `${p.leader.title} ${p.leader.name} decretó: ${d.name.toLowerCase()}.` });
    this.toast(`Decreto: ${d.name}`, undefined, 'good');
    sfx('good', this.settings);
    notify();
  }

  setTarget(sid: number, raid: boolean) {
    const p = this.player;
    if (p.flags.target === sid && !!p.flags.targetRaid === raid) {
      p.flags.target = 0;
      this.toast('Campaña cancelada', 'Tus ejércitos elegirán sus objetivos.', 'info');
    } else {
      p.flags.target = sid;
      p.flags.targetRaid = raid ? 1 : 0;
      const st = settlementById(this.state, sid);
      this.toast(raid ? 'Orden de saqueo' : 'Orden de conquista', `Tus tropas marcharán sobre ${st?.name}.`, 'war');
      sfx('war', this.settings);
    }
    notify();
  }

  toggleDefensive() {
    this.player.flags.defensive = this.player.flags.defensive ? 0 : 1;
    notify();
  }

  resolveEvent(pe: PendingEvent, idx: number) {
    const s = this.state;
    const def = EVENT[pe.id];
    const civ = s.civs[pe.civ];
    const ctx = makeCtx(s, civ, pe.sid, pe.other, pe.data ?? {});
    const choices = getChoices(def, ctx);
    const ch = choices[idx];
    if (!ch || !choiceAvailable(ch, ctx)) return;
    s.events.pending = s.events.pending.filter((p) => p !== pe);
    const lines = applyChoice(s, ctx, ch, new RNG(s.rng ^ (pe.uid * 2654435761)));
    s.rng = (s.rng + 0x9e37) >>> 0;
    if (lines.length) this.lastResult = { title: ch.label, lines };
    sfx('tap', this.settings);
    notify();
  }

  focusSettlement(id: number) {
    const st = settlementById(this.state, id);
    if (!st) return;
    this.renderer.centerOn(st.col, st.row, Math.max(1.1, this.renderer.cam.zoom));
    this.overlay.selected = [st.col, st.row];
    if (this.isTouch) this.panel = null;
    notify();
  }
  focusTile(c: number, r: number) {
    this.renderer.centerOn(c, r);
    this.overlay.selected = [c, r];
    notify();
  }
}

// Partidas de versiones anteriores: completar campos nuevos
function migrate(s: GameState): GameState {
  s.units ??= [];
  s.camps ??= [];
  for (const st of s.settlements) { st.queue ??= []; st.level ??= 0; }
  for (const c of s.civs) { c.gp ??= {}; c.greats ??= []; }
  s.version = 2;
  return s;
}

// Calcula la contabilidad inicial sin avanzar el tiempo (para que la interfaz arranque con datos reales)
function primeLedgers(state: GameState) {
  const clone: GameState = structuredClone(state);
  for (const c of clone.civs) simulateEconomy(clone, c);
  for (const c of state.civs) c.ledger = clone.civs[c.id].ledger;
  for (const st of state.settlements) {
    const k = clone.settlements.find((x) => x.id === st.id)!;
    Object.assign(st, { housing: k.housing, workforce: k.workforce, jobs: k.jobs, employed: k.employed, health: k.health, growth: k.growth });
  }
}

export const ctrl = new Controller();
(window as any).__ctrl = ctrl;
if (import.meta.env.DEV) {
  // Ayudas de depuración: dejar que la IA juegue por el jugador durante N años
  (window as any).__autoplay = async (years: number) => {
    const { aiYear } = await import('../sim/ai');
    for (let i = 0; i < years && !ctrl.state.gameOver; i++) {
      const p = ctrl.player;
      aiYear(ctrl.state, p, new RNG(ctrl.state.rng + i));
      const mil = await import('../sim/military');
      mil.aiMilitary(ctrl.state, p, new RNG(ctrl.state.rng + i * 3));
      for (let k = 0; k < 6; k++) mil.stepMilitary(ctrl.state, 1 / 6);
      if (p.traditionOffer) { p.traditions.push(p.traditionOffer[0]); p.traditionOffer = null; }
      for (const pe of [...ctrl.state.events.pending]) ctrl.resolveEvent(pe, 0);
      ctrl.lastResult = null;
      ctrl.tick();
    }
    notify();
  };
}
export { tileAt };
