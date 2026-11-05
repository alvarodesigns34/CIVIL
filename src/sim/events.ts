// Motor de eventos: selección, contexto, efectos y previsualización.
import type { Civ, GameState, PendingEvent, ResId, Settlement } from './types';
import type { Effect, EventChoice, EventCtx, EventDef } from './eventTypes';
import { EVENTS } from '../data/events';
import { SYSTEM_EVENTS } from './systemEvents';
import { GREAT_EVENT } from '../data/greats';
import { RNG } from '../core/rng';
import { civEra } from '../data/techs';
import { civSettlements, capitalOf, settlementById, tileAt, nbrTiles } from './world';
import { BUILDING } from '../data/buildings';
import { TRAIT } from '../data/politics';
import { FACTIONS } from '../data/politics';
import { techCostFor, traditionCost } from './economy';
import { declareWar, makePeace, addOpinionMod } from './diplomacy';
import { killLeader } from './politics';
import { isWater } from '../data/terrain';
import { tilesOfSettlement } from './world';
import { RES_NAME } from './names';

export const ALL_EVENTS: EventDef[] = [...EVENTS, ...SYSTEM_EVENTS, GREAT_EVENT];
export const EVENT: Record<string, EventDef> = Object.fromEntries(ALL_EVENTS.map((e) => [e.id, e]));

export function makeCtx(state: GameState, civ: Civ, sid: number, other: number, data: Record<string, number | string> = {}): EventCtx {
  const s = settlementById(state, sid) ?? capitalOf(state, civ.id)!;
  const o = other >= 0 ? state.civs[other] : null;
  const sets = () => civSettlements(state, civ.id);
  const ctx: EventCtx = {
    state, civ, s, other: o, data,
    era: civEra(civ.techs),
    year: state.year,
    has: (t) => civ.techs.includes(t),
    res: (r) => civ.res[r],
    net: (r) => civ.ledger.net[r] ?? 0,
    pop: () => sets().reduce((a, x) => a + x.pop, 0),
    settlements: () => sets().length,
    stability: () => civ.stability,
    faction: (f) => civ.factions[f],
    atWar: () => Object.values(civ.relations).some((r) => r.state === 'war'),
    gov: () => civ.government,
    policy: (id) => civ.policies.includes(id),
    trait: (id) => civ.leader.traits.includes(id),
    flag: (n) => civ.flags[n] ?? 0,
    count: (b) => {
      let n = 0;
      for (const st of sets()) for (const [, , t] of tilesOfSettlement(state, st)) if (t.b && t.b.type === b && t.b.progress >= 1) n++;
      return n;
    },
    leaderAge: () => civ.leader.age,
    luxuries: () => civ.ledger.luxuries.length + civ.ledger.luxuryTrade.length,
    soldiers: () => civ.soldiers,
    health: () => {
      const l = sets();
      return l.reduce((a, x) => a + x.health, 0) / Math.max(1, l.length);
    },
    foodNeed: () => civ.ledger.foodNeed,
    coastal: () => nbrTiles(state, s.col, s.row).some((t) => t.biome === 'coast'),
    river: () => (tileAt(state, s.col, s.row)?.river ?? 0) > 0,
  };
  return ctx;
}

export function fmtText(text: string, c: EventCtx): string {
  return text
    .replace(/\{civ\}/g, c.civ.name)
    .replace(/\{people\}/g, c.civ.people)
    .replace(/\{settlement\}/g, c.s?.name ?? '')
    .replace(/\{other\}/g, c.other?.name ?? 'los extranjeros')
    .replace(/\{otherPeople\}/g, c.other?.people ?? 'extranjeros')
    .replace(/\{otherLeader\}/g, c.other?.leader.name ?? 'su caudillo')
    .replace(/\{leader\}/g, c.civ.leader.name)
    .replace(/\{title\}/g, c.civ.leader.title)
    .replace(/\{year\}/g, String(c.year))
    .replace(/\{(\w+)\}/g, (m, k) => (c.data[k] != null ? String(c.data[k]) : m));
}

function pickSettlement(state: GameState, civ: Civ, mode: EventDef['ctxSettlement'], rng: RNG): Settlement | undefined {
  const l = civSettlements(state, civ.id);
  if (!l.length) return undefined;
  switch (mode) {
    case 'largest': return [...l].sort((a, b) => b.pop - a.pop)[0];
    case 'smallest': return [...l].sort((a, b) => a.pop - b.pop)[0];
    case 'coastal': {
      const cs = l.filter((s) => nbrTiles(state, s.col, s.row).some((t) => t.biome === 'coast'));
      return cs.length ? rng.pick(cs) : undefined;
    }
    case 'frontier': {
      const fs = l.filter((s) => !s.capital);
      return fs.length ? rng.pick(fs) : l[0];
    }
    case 'random': return rng.pick(l);
    default: return capitalOf(state, civ.id);
  }
}

function knownOthers(state: GameState, civ: Civ) {
  return state.civs.filter((o) => o.alive && o.id !== civ.id && civ.relations[o.id]?.met);
}

let uidCounter = 1;
export function queueEvent(state: GameState, civ: Civ, id: string, sid = -1, other = -1, data?: Record<string, number | string>) {
  const pe: PendingEvent = { uid: Date.now() % 1e9 + uidCounter++, id, civ: civ.id, sid, other, data };
  state.events.pending.push(pe);
  return pe;
}

// Intenta disparar un evento aleatorio este año. Devuelve el evento puesto en cola (si lo hay).
export function rollEvents(state: GameState, civ: Civ, rng: RNG) {
  // Cadenas programadas
  const due = state.events.chains.filter((ch) => ch.civ === civ.id && ch.year <= state.year);
  if (due.length) {
    state.events.chains = state.events.chains.filter((ch) => !due.includes(ch));
    for (const ch of due) {
      const def = EVENT[ch.id];
      if (!def) continue;
      const other = ch.other >= 0 && state.civs[ch.other]?.alive ? ch.other : -1;
      const ctx = makeCtx(state, civ, ch.sid, other, ch.data);
      if (def.cond && !safeCond(def, ctx)) continue;
      fire(state, civ, def, ctx.s?.id ?? -1, other, rng, ch.data);
    }
  }
  const era = civEra(civ.techs);
  const chance = civ.isPlayer ? 0.2 + Math.min(0.08, era * 0.015) : 0.14;
  if (!rng.chance(chance)) return;
  if (civ.isPlayer && state.events.pending.some((p) => p.civ === civ.id)) return;
  const others = knownOthers(state, civ);
  const cands: { def: EventDef; sid: number; other: number; w: number }[] = [];
  for (const def of EVENTS) {
    if (def.chainOnly) continue;
    if (def.playerOnly && !civ.isPlayer) continue;
    if (def.minEra != null && era < def.minEra) continue;
    if (def.maxEra != null && era > def.maxEra) continue;
    const key = `${civ.id}:${def.id}`;
    if (def.once && state.events.fired[key]) continue;
    const cd = def.cooldown ?? 40;
    if (state.events.cooldown[key] != null && state.year - state.events.cooldown[key] < cd) continue;
    let other = -1;
    if (def.needsOther) {
      if (!others.length) continue;
      other = rng.pick(others).id;
    } else if (others.length) other = rng.pick(others).id;
    const s = pickSettlement(state, civ, def.ctxSettlement, rng);
    if (!s) continue;
    const ctx = makeCtx(state, civ, s.id, other);
    if (def.cond && !safeCond(def, ctx)) continue;
    cands.push({ def, sid: s.id, other, w: def.weight });
  }
  const pick = rng.weighted(cands, (c) => c.w);
  if (pick) fire(state, civ, pick.def, pick.sid, pick.other, rng);
}

function safeCond(def: EventDef, ctx: EventCtx) {
  try {
    return !!def.cond!(ctx);
  } catch (e) {
    console.warn('Evento con condición defectuosa', def.id, e);
    return false;
  }
}

export function fire(state: GameState, civ: Civ, def: EventDef, sid: number, other: number, rng: RNG, data?: Record<string, number | string>) {
  const key = `${civ.id}:${def.id}`;
  state.events.cooldown[key] = state.year;
  state.events.fired[key] = (state.events.fired[key] ?? 0) + 1;
  if (civ.isPlayer) {
    queueEvent(state, civ, def.id, sid, other, data);
  } else {
    // La IA resuelve al momento
    const ctx = makeCtx(state, civ, sid, other, data ?? {});
    const choices = getChoices(def, ctx).filter((ch) => choiceAvailable(ch, ctx));
    const ch = rng.weighted(choices, (c) => (c.ai ?? 1) * (c.cost && Object.entries(c.cost).some(([r, v]) => civ.res[r as ResId] < (v as number)) ? 0 : 1));
    if (ch) applyChoice(state, ctx, ch, rng);
  }
}

export function getChoices(def: EventDef, ctx: EventCtx): EventChoice[] {
  if (def.build) {
    const b = def.build(ctx);
    if (b.choices) return b.choices;
  }
  return def.choices;
}
export function getText(def: EventDef, ctx: EventCtx): { title: string; text: string } {
  let title = def.title, text = def.text;
  if (def.build) {
    const b = def.build(ctx);
    if (b.text) text = b.text;
    if (b.title) title = b.title;
  }
  return { title: fmtText(title, ctx), text: fmtText(text, ctx) };
}

export function choiceAvailable(ch: EventChoice, ctx: EventCtx): boolean {
  if (ch.req) {
    try {
      if (!ch.req(ctx)) return false;
    } catch {
      return false;
    }
  }
  if (ch.cost) for (const [r, v] of Object.entries(ch.cost)) if (ctx.civ.res[r as ResId] < (v as number)) return false;
  return true;
}

// ───────────── Aplicación de efectos ─────────────
export function applyChoice(state: GameState, ctx: EventCtx, ch: EventChoice, rng: RNG): string[] {
  const out: string[] = [];
  if (ch.cost) for (const [r, v] of Object.entries(ch.cost)) ctx.civ.res[r as ResId] = Math.max(0, ctx.civ.res[r as ResId] - (v as number));
  applyEffects(state, ctx, ch.fx, rng, out);
  if (ch.log) {
    state.chronicle.push({ year: state.year, civ: ctx.civ.id, kind: 'event', text: fmtText(ch.log, ctx) });
  }
  return out;
}

export function scaledRes(e: Extract<Effect, { t: 'res' }>, ctx: EventCtx) {
  let v = e.v;
  if (e.scale === 'pop') v = (v * ctx.pop()) / 100;
  if (e.scale === 'era') v = v * (1 + ctx.era);
  return Math.round(v);
}

export function applyEffects(state: GameState, ctx: EventCtx, fx: Effect[], rng: RNG, out: string[]) {
  const civ = ctx.civ;
  for (const e of fx) {
    switch (e.t) {
      case 'res': {
        const v = scaledRes(e, ctx);
        civ.res[e.r] = Math.max(0, civ.res[e.r] + v);
        break;
      }
      case 'knowledge': {
        const target = civ.research ?? null;
        const base = target ? techCostFor(state, civ, target) : 60;
        civ.knowledge = Math.max(0, civ.knowledge + base * e.v);
        break;
      }
      case 'culture':
        civ.culturePts = Math.max(0, civ.culturePts + traditionCost(civ) * e.v);
        break;
      case 'pop': {
        const l = e.where === 'all' ? civSettlements(state, civ.id) : ctx.s ? [ctx.s] : [];
        for (const s of l) s.pop = Math.max(3, s.pop * (1 + e.v));
        break;
      }
      case 'faction':
        civ.factions[e.f] = Math.max(0, Math.min(100, civ.factions[e.f] + e.v));
        break;
      case 'stability':
        civ.stability = Math.max(0, Math.min(100, civ.stability + e.v));
        break;
      case 'legitimacy':
        civ.leader.legitimacy = Math.max(0, Math.min(100, civ.leader.legitimacy + e.v));
        break;
      case 'mod': {
        civ.modifiers = civ.modifiers.filter((m) => m.id !== e.id);
        const good = Object.entries(e.fx).reduce((a, [k, v]) => a + (typeof v === 'number' ? v : 0), 0) >= 0;
        civ.modifiers.push({ id: e.id, name: e.name, until: state.year + e.years, fx: e.fx, good });
        break;
      }
      case 'opinion': {
        const targets = e.who === 'all' ? state.civs.filter((o) => o.alive && o.id !== civ.id) : ctx.other ? [ctx.other] : [];
        for (const o of targets) addOpinionMod(state, o, civ.id, `ev_${Math.round(rng.next() * 1e6)}`, e.label ?? 'Acontecimiento', e.v, 25);
        break;
      }
      case 'war':
        if (ctx.other && civ.relations[ctx.other.id]?.state !== 'war') declareWar(state, ctx.other, civ, 'evento');
        break;
      case 'peace':
        if (ctx.other && civ.relations[ctx.other.id]?.state === 'war') makePeace(state, civ, ctx.other, 0);
        break;
      case 'trait': {
        const tr = civ.leader.traits;
        if (e.remove) civ.leader.traits = tr.filter((t) => t !== e.remove);
        if (e.add && !civ.leader.traits.includes(e.add)) {
          const opp = TRAIT[e.add]?.opposite;
          civ.leader.traits = civ.leader.traits.filter((t) => t !== opp);
          civ.leader.traits.push(e.add);
        }
        break;
      }
      case 'leaderAge':
        civ.leader.age += e.v;
        break;
      case 'killLeader':
        killLeader(state, civ, rng, 'event');
        break;
      case 'flag':
        civ.flags[e.name] = e.v ?? 1;
        break;
      case 'chain':
        state.events.chains.push({ id: e.id, civ: civ.id, year: state.year + e.years, sid: ctx.s?.id ?? -1, other: ctx.other?.id ?? -1, data: ctx.data });
        break;
      case 'destroy': {
        if (!ctx.s) break;
        const cands = tilesOfSettlement(state, ctx.s).filter(([, , t]) => t.b && t.b.progress >= 1 && !BUILDING[t.b.type].wonder && (!e.cat || BUILDING[t.b.type].cat === e.cat));
        if (cands.length) {
          const [, , t] = rng.pick(cands);
          out.push(`Se perdió: ${BUILDING[t.b!.type].name}.`);
          t.b = null;
        }
        break;
      }
      case 'unrest':
        if (ctx.s) ctx.s.unrest = Math.max(0, Math.min(100, ctx.s.unrest + e.v));
        break;
      case 'warScore':
        if (ctx.other) {
          const r = civ.relations[ctx.other.id];
          const r2 = ctx.other.relations[civ.id];
          if (r?.state === 'war') {
            r.warScore = Math.max(-100, Math.min(100, r.warScore + e.v));
            r2.warScore = -r.warScore;
          }
        }
        break;
      case 'chance':
        if (rng.chance(e.p)) {
          out.push('La suerte os sonrió.');
          applyEffects(state, ctx, e.then, rng, out);
        } else {
          out.push('La fortuna os dio la espalda.');
          if (e.else) applyEffects(state, ctx, e.else, rng, out);
        }
        break;
      case 'text':
        out.push(fmtText(e.v, ctx));
        break;
      case 'custom':
        e.run(ctx);
        break;
    }
  }
}

// ───────────── Previsualización (para la UI) ─────────────
export interface FxLine {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  sub?: FxLine[];
}

const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

export function describeFxObj(fx: Record<string, any>): string[] {
  const names: Record<string, string> = {
    food: 'comida', wood: 'madera', stone: 'piedra', metal: 'metal', goods: 'bienes', gold: 'oro', influence: 'influencia', knowledge: 'saber', culture: 'cultura',
    military: 'fuerza militar', construction: 'construcción', trade: 'comercio', tax: 'impuestos', housing: 'vivienda', workforce: 'población activa', upkeep: 'mantenimiento', borders: 'expansión de fronteras', goodsDemand: 'demanda de bienes',
  };
  const out: string[] = [];
  for (const [k, v] of Object.entries(fx)) {
    if (k === 'faction') {
      for (const [f, fv] of Object.entries(v as Record<string, number>)) out.push(`${sign(fv)} ${FACTIONS[f as keyof typeof FACTIONS].short}`);
      continue;
    }
    if (typeof v !== 'number' || !v) continue;
    if (k.endsWith('Flat')) out.push(`${sign(v)} ${names[k.replace('Flat', '')]}/año`);
    else if (k === 'growth') out.push(`${sign(v)}% crecimiento`);
    else if (k === 'health') out.push(`${sign(v)} salud`);
    else if (k === 'stability') out.push(`${sign(v)} estabilidad`);
    else if (k === 'legitimacy') out.push(`${sign(v)} legitimidad/año`);
    else if (k === 'opinion') out.push(`${sign(v)} opinión ajena`);
    else if (names[k]) out.push(`${pct(v)} ${names[k]}`);
  }
  return out;
}

export function describeEffects(fx: Effect[], ctx: EventCtx): FxLine[] {
  const out: FxLine[] = [];
  for (const e of fx) {
    switch (e.t) {
      case 'res': {
        const v = scaledRes(e, ctx);
        if (v) out.push({ text: `${sign(v)} ${RES_NAME[e.r]}`, tone: v > 0 ? 'good' : 'bad' });
        break;
      }
      case 'knowledge': out.push({ text: `${pct(e.v)} de la investigación actual`, tone: e.v > 0 ? 'good' : 'bad' }); break;
      case 'culture': out.push({ text: `${pct(e.v)} hacia la próxima tradición`, tone: e.v > 0 ? 'good' : 'bad' }); break;
      case 'pop': out.push({ text: `${pct(e.v)} población${e.where === 'all' ? ' (todas)' : ` en ${ctx.s?.name ?? ''}`}`, tone: e.v > 0 ? 'good' : 'bad' }); break;
      case 'faction': out.push({ text: `${sign(e.v)} aprobación ${FACTIONS[e.f].of}`, tone: e.v > 0 ? 'good' : 'bad' }); break;
      case 'stability': out.push({ text: `${sign(e.v)} estabilidad`, tone: e.v > 0 ? 'good' : 'bad' }); break;
      case 'legitimacy': out.push({ text: `${sign(e.v)} legitimidad`, tone: e.v > 0 ? 'good' : 'bad' }); break;
      case 'mod': {
        const parts = describeFxObj(e.fx);
        const good = Object.entries(e.fx).reduce((a, [, v]) => a + (typeof v === 'number' ? v : 0), 0) >= 0;
        out.push({ text: `«${e.name}»${e.years >= 900 ? ' para siempre' : ` durante ${e.years} años`}: ${parts.join(', ')}`, tone: good ? 'good' : 'bad' });
        break;
      }
      case 'opinion': out.push({ text: `${sign(e.v)} opinión de ${e.who === 'all' ? 'todos los pueblos' : ctx.other?.name ?? 'extranjeros'}`, tone: e.v > 0 ? 'good' : 'bad' }); break;
      case 'war': out.push({ text: `Guerra con ${ctx.other?.name ?? 'extranjeros'}`, tone: 'bad' }); break;
      case 'peace': out.push({ text: `Paz con ${ctx.other?.name ?? 'el enemigo'}`, tone: 'good' }); break;
      case 'trait':
        if (e.add) out.push({ text: `${ctx.civ.leader.name} gana «${TRAIT[e.add]?.name ?? e.add}»`, tone: TRAIT[e.add]?.good ? 'good' : 'bad' });
        if (e.remove) out.push({ text: `${ctx.civ.leader.name} pierde «${TRAIT[e.remove]?.name ?? e.remove}»`, tone: TRAIT[e.remove]?.good ? 'bad' : 'good' });
        break;
      case 'leaderAge': out.push({ text: e.v > 0 ? `La salud de ${ctx.civ.leader.name} se resiente` : `${ctx.civ.leader.name} recupera vigor`, tone: e.v > 0 ? 'bad' : 'good' }); break;
      case 'killLeader': out.push({ text: `${ctx.civ.leader.name} morirá`, tone: 'bad' }); break;
      case 'chain': out.push({ text: 'Esto tendrá consecuencias…', tone: 'neutral' }); break;
      case 'destroy': out.push({ text: `Se perderá un edificio en ${ctx.s?.name ?? ''}`, tone: 'bad' }); break;
      case 'unrest': out.push({ text: `${sign(e.v)} malestar en ${ctx.s?.name ?? ''}`, tone: e.v > 0 ? 'bad' : 'good' }); break;
      case 'warScore': out.push({ text: `${sign(e.v)} puntuación de guerra`, tone: e.v > 0 ? 'good' : 'bad' }); break;
      case 'chance':
        out.push({ text: e.label ?? `${Math.round(e.p * 100)}% de probabilidad`, tone: 'neutral', sub: [...describeEffects(e.then, ctx), ...(e.else ? [{ text: 'si no:', tone: 'neutral' as const, sub: describeEffects(e.else, ctx) }] : [])] });
        break;
      case 'custom': out.push({ text: e.label, tone: 'neutral' }); break;
      default: break;
    }
  }
  return out;
}

export function costText(cost?: Partial<Record<ResId, number>>) {
  if (!cost) return '';
  return Object.entries(cost).map(([r, v]) => `${v} ${RES_NAME[r as ResId]}`).join(', ');
}

export { isWater };
