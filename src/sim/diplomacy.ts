// Relaciones entre civilizaciones: contacto, opinión, comercio, alianzas, guerra y paz.
import type { Civ, GameState } from './types';
import { RNG } from '../core/rng';
import { civSettlements, getExplored, capitalOf } from './world';
import { hexDistance } from '../core/hex';
import { civFx } from './mods';
import { queueEvent } from './events';
import { GOV } from '../data/politics';
import { setDeclareWar, setMakePeace } from './systemEvents';
import { civReligion } from './religion';

export function rel(a: Civ, b: Civ) {
  return a.relations[b.id];
}

export function addOpinionMod(state: GameState, holder: Civ, about: number, id: string, label: string, value: number, years: number) {
  const r = holder.relations[about];
  if (!r) return;
  r.mods = r.mods.filter((m) => m.id !== id);
  r.mods.push({ id, label, value, until: state.year + years });
}

const PERSONALITY_BASE: Record<Civ['personality'], number> = { aggressive: -12, merchant: 6, pious: 0, expansionist: -6, scholarly: 4, peaceful: 12 };

export function opinionTarget(state: GameState, holder: Civ, other: Civ): { v: number; parts: { label: string; v: number }[] } {
  const r = holder.relations[other.id];
  const parts: { label: string; v: number }[] = [];
  if (!holder.isPlayer) parts.push({ label: 'Carácter', v: PERSONALITY_BASE[holder.personality] });
  const fxO = civFx(state, other);
  if (fxO.opinion) parts.push({ label: 'Reputación', v: fxO.opinion });
  if (r.trade) parts.push({ label: 'Socios comerciales', v: 15 });
  if (r.openBorders) parts.push({ label: 'Fronteras abiertas', v: 5 });
  if (r.vassalOf === other.id) parts.push({ label: 'Somos sus vasallos', v: -15 });
  if (other.relations[holder.id]?.vassalOf === holder.id) parts.push({ label: 'Nuestro vasallo', v: 10 });
  if (r.state === 'alliance') parts.push({ label: 'Aliados', v: 25 });
  if (r.state === 'war') parts.push({ label: 'En guerra', v: -50 });
  if (holder.government === other.government) parts.push({ label: 'Gobierno similar', v: 6 });
  const rh = civReligion(state, holder), ro = civReligion(state, other);
  if (rh && ro) parts.push(rh.founder === ro.founder ? { label: `Comparten la ${rh.name}`, v: 12 } : { label: 'Otra fe', v: rh.doctrines.includes('tolerant') ? 0 : -6 });
  const border = sharedBorder(state, holder, other);
  if (border > 0) parts.push({ label: 'Fronteras en disputa', v: -Math.min(20, border * (holder.personality === 'expansionist' ? 3 : 1.5)) });
  // Enemigos comunes
  const commonEnemy = state.civs.some((x) => x.alive && x.id !== holder.id && x.id !== other.id && holder.relations[x.id]?.state === 'war' && other.relations[x.id]?.state === 'war');
  if (commonEnemy) parts.push({ label: 'Enemigo común', v: 20 });
  // Miedo / respeto a la fuerza
  if (other.strength > holder.strength * 2 && holder.strength > 0) parts.push({ label: 'Temor a su ejército', v: holder.personality === 'aggressive' ? -10 : 5 });
  for (const m of r.mods) parts.push({ label: m.label, v: m.value * Math.max(0.2, Math.min(1, (m.until - state.year) / 15)) });
  const v = Math.max(-100, Math.min(100, parts.reduce((a, p) => a + p.v, 0)));
  return { v, parts };
}

export function sharedBorder(state: GameState, a: Civ, b: Civ) {
  // Número aproximado de pares de asentamientos cercanos
  let n = 0;
  for (const s1 of civSettlements(state, a.id))
    for (const s2 of civSettlements(state, b.id)) {
      const d = hexDistance(s1.col, s1.row, s2.col, s2.row);
      if (d <= s1.radius + s2.radius + 2) n += 2;
      else if (d <= 9) n += 1;
    }
  return n;
}

export function updateContacts(state: GameState, rng: RNG) {
  const explored = getExplored(state);
  const player = state.civs[state.player];
  for (const a of state.civs) {
    if (!a.alive) continue;
    for (const b of state.civs) {
      if (b.id <= a.id || !b.alive) continue;
      const r = a.relations[b.id];
      if (r.met) continue;
      let met = false;
      // Cercanía de asentamientos
      for (const s1 of civSettlements(state, a.id)) {
        for (const s2 of civSettlements(state, b.id)) if (hexDistance(s1.col, s1.row, s2.col, s2.row) <= s1.radius + s2.radius + 5) met = true;
      }
      // El jugador conoce a quien ve
      if (!met && (a === player || b === player)) {
        const o = a === player ? b : a;
        for (let i = 0; i < state.tiles.length && !met; i++) if (explored[i] && state.tiles[i].owner === o.id) met = true;
      }
      // Encuentros por azar (mercaderes, nómadas) con el paso del tiempo
      if (!met && state.year > 120 && rng.chance(0.004 * (state.year / 120))) met = true;
      if (met) {
        r.met = true;
        b.relations[a.id].met = true;
        r.since = b.relations[a.id].since = state.year;
        if (a === player || b === player) {
          const o = a === player ? b : a;
          state.chronicle.push({ year: state.year, civ: player.id, kind: 'diplo', important: true, text: `Los ${player.people} entraron en contacto con los ${o.people} de ${o.name}.` });
          queueEvent(state, player, 'sys_contact', capitalOf(state, player.id)?.id ?? -1, o.id);
        }
      }
    }
  }
}

export function yearlyDiplomacy(state: GameState, rng: RNG) {
  for (const a of state.civs) {
    if (!a.alive) continue;
    for (const b of state.civs) {
      if (a === b || !b.alive) continue;
      const r = a.relations[b.id];
      if (!r.met) continue;
      r.mods = r.mods.filter((m) => m.until > state.year);
      const t = opinionTarget(state, a, b).v;
      r.opinion += (t - r.opinion) * 0.2;
      // Guerra: el comercio se rompe
      if (r.state === 'war') r.trade = false;
    }
  }
}

export function declareWar(state: GameState, attacker: Civ, defender: Civ, reason = '') {
  const ra = attacker.relations[defender.id];
  const rd = defender.relations[attacker.id];
  const wasAlly = ra.state === 'alliance';
  // un vasallo que se alza rompe el vasallaje
  if (ra.vassalOf === defender.id) ra.vassalOf = undefined;
  if (rd.vassalOf === attacker.id) rd.vassalOf = undefined;
  ra.state = rd.state = 'war';
  ra.trade = rd.trade = false;
  ra.warScore = rd.warScore = 0;
  ra.warStart = rd.warStart = state.year;
  ra.met = rd.met = true;
  attacker.flags.lastWar = defender.flags.lastWar = state.year;
  addOpinionMod(state, defender, attacker.id, 'war_decl', 'Nos declaró la guerra', -30, 40);
  // Reputación con terceros si rompió una tregua o una alianza
  if (wasAlly || ra.truceUntil > state.year || (ra.nap ?? 0) > state.year) {
    ra.nap = rd.nap = 0;
    for (const o of state.civs) if (o.alive && o !== attacker && o !== defender) addOpinionMod(state, o, attacker.id, 'backstab', 'Rompe sus juramentos', -20, 50);
    attacker.modifiers.push({ id: 'oathbreaker', name: 'Perjurio', until: state.year + 15, fx: { stability: -8, legitimacy: -1 }, good: false });
  }
  state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important: attacker.isPlayer || defender.isPlayer, text: `Los ${attacker.people} declararon la guerra a los ${defender.people}.` });
  // Aliados del defensor se unen
  for (const o of state.civs) {
    if (!o.alive || o === attacker || o === defender) continue;
    const lordOf = defender.relations[o.id]?.vassalOf === o.id;
    if ((o.relations[defender.id]?.state === 'alliance' || lordOf) && o.relations[attacker.id]?.state !== 'war') {
      if (o.isPlayer) {
        queueEvent(state, o, 'sys_ally_call', capitalOf(state, o.id)?.id ?? -1, defender.id, { enemy: attacker.id });
        continue;
      }
      const ro = o.relations[attacker.id];
      const ra2 = attacker.relations[o.id];
      ro.state = ra2.state = 'war';
      ro.trade = ra2.trade = false;
      ro.warScore = ra2.warScore = 0;
      ro.warStart = ra2.warStart = state.year;
      ro.met = ra2.met = true;
      state.chronicle.push({ year: state.year, civ: -1, kind: 'war', important: o.isPlayer || attacker.isPlayer, text: `Los ${o.people} acudieron en ayuda de sus aliados ${defender.people}.` });
    }
  }
  if (defender.isPlayer) {
    defender.modifiers.push({ id: 'rally', name: 'Patria en peligro', until: state.year + 5, fx: { military: 0.15, stability: 4 }, good: true });
  }
}

export function makePeace(state: GameState, a: Civ, b: Civ, tribute: number) {
  const ra = a.relations[b.id];
  const rb = b.relations[a.id];
  ra.state = rb.state = 'peace';
  ra.truceUntil = rb.truceUntil = state.year + 20;
  ra.warScore = rb.warScore = 0;
  ra.since = rb.since = state.year;
  a.warWeariness *= 0.5;
  b.warWeariness *= 0.5;
  addOpinionMod(state, a, b.id, 'peace', 'Tratado de paz', 10, 20);
  addOpinionMod(state, b, a.id, 'peace', 'Tratado de paz', 10, 20);
  // las tropas en territorio del otro regresan a casa
  for (const u of state.units ?? []) {
    if (u.civ !== a.id && u.civ !== b.id) continue;
    const other = u.civ === a.id ? b.id : a.id;
    const t = state.tiles[u.row * state.width + u.col];
    u.engaged = 0;
    if (u.order === 'campaign') u.order = 'idle';
    if (t.owner === other || (u.path.length && u.targetSid >= 0)) {
      const home = civSettlements(state, u.civ).sort((x, y) => Math.abs(x.col - u.col) + Math.abs(x.row - u.row) - Math.abs(y.col - u.col) - Math.abs(y.row - u.row))[0];
      if (home) { u.col = home.col; u.row = home.row; u.path = []; u.prog = 0; }
    }
  }
  state.armies = state.armies.filter((ar) => !((ar.civ === a.id && civOfSettlement(state, ar.target) === b.id) || (ar.civ === b.id && civOfSettlement(state, ar.target) === a.id)));
  state.chronicle.push({ year: state.year, civ: -1, kind: 'diplo', important: a.isPlayer || b.isPlayer, text: `Los ${a.people} y los ${b.people} firmaron la paz${tribute ? ` (tributo de ${Math.abs(tribute)} de oro)` : ''}.` });
}

function civOfSettlement(state: GameState, sid: number) {
  return state.settlements.find((s) => s.id === sid)?.civ ?? -1;
}

// ───────────── Acciones del jugador (o de la IA) ─────────────
export interface DiploAction {
  id: string;
  label: string;
  desc: string;
  cost?: { gold?: number; influence?: number };
  available: string | null; // null = disponible; texto = motivo
  accept?: number; // probabilidad estimada de aceptación (0..1)
}

export function acceptTrade(state: GameState, from: Civ, to: Civ) {
  const r = to.relations[from.id];
  let p = 0.35 + r.opinion / 100;
  if (to.personality === 'merchant') p += 0.25;
  if (to.personality === 'aggressive') p -= 0.1;
  if (r.state === 'war') p = 0;
  return Math.max(0, Math.min(0.97, p));
}
export function acceptAlliance(state: GameState, from: Civ, to: Civ) {
  const r = to.relations[from.id];
  let p = (r.opinion - 35) / 50;
  if (to.personality === 'peaceful') p += 0.1;
  if (from.strength < to.strength * 0.4) p -= 0.2;
  if (r.state === 'war') p = 0;
  return Math.max(0, Math.min(0.95, p));
}
export function acceptPeace(state: GameState, from: Civ, to: Civ, tribute: number) {
  // tribute > 0: from paga a to
  const r = to.relations[from.id];
  let p = 0.15 + (-r.warScore) / 120 + to.warWeariness / 50 + (state.year - r.warStart) / 80;
  if (to.personality === 'aggressive') p -= 0.15;
  if (to.personality === 'peaceful') p += 0.2;
  p += tribute / Math.max(30, to.res.gold + 60);
  if (from.strength > to.strength * 1.5) p += 0.15;
  return Math.max(0, Math.min(0.97, p));
}
export function acceptDemand(state: GameState, from: Civ, to: Civ, amount: number) {
  const ratio = from.strength / Math.max(1, to.strength);
  let p = (ratio - 1.3) * 0.5 - amount / Math.max(40, to.res.gold * 2);
  if (to.personality === 'aggressive') p -= 0.25;
  if (to.res.gold < amount) p = 0;
  return Math.max(0, Math.min(0.9, p));
}

export function diploActions(state: GameState, me: Civ, o: Civ): DiploAction[] {
  const r = me.relations[o.id];
  const out: DiploAction[] = [];
  const giftAmt = Math.max(20, Math.round(10 + civSettlements(state, me.id).reduce((a, s) => a + s.pop, 0) * 0.05));
  if (r.state !== 'war') {
    out.push({ id: 'gift', label: `Enviar regalos (${giftAmt} oro)`, desc: 'Mejora la opinión que tienen de nosotros.', cost: { gold: giftAmt }, available: me.res.gold >= giftAmt ? null : 'Oro insuficiente' });
    if (!r.trade) out.push({ id: 'trade', label: 'Proponer ruta comercial', desc: 'Oro anual para ambos y acceso a sus lujos.', cost: { influence: 10 }, available: me.res.influence >= 10 ? null : 'Influencia insuficiente', accept: acceptTrade(state, me, o) });
    else out.push({ id: 'canceltrade', label: 'Cancelar ruta comercial', desc: 'Pierdes el oro y los lujos de la ruta.', available: null });
    if (r.state !== 'alliance') out.push({ id: 'alliance', label: 'Proponer alianza', desc: 'Os defenderéis mutuamente.', cost: { influence: 25 }, available: me.res.influence >= 25 ? (r.opinion < 30 ? 'Su opinión es demasiado baja' : null) : 'Influencia insuficiente', accept: acceptAlliance(state, me, o) });
    else out.push({ id: 'breakalliance', label: 'Romper la alianza', desc: 'Se lo tomarán muy mal.', available: null });
    const hereditary = (c: Civ) => GOV[c.government]?.succession === 'hereditary';
    if (!(r.nap && r.nap > state.year)) out.push({ id: 'nap', label: 'Pacto de no agresión (30 años)', desc: 'Ninguno atacará al otro. Romperlo es perjurio.', cost: { influence: 10 }, available: me.res.influence >= 10 ? (r.opinion < -10 ? 'Desconfían demasiado' : null) : 'Influencia insuficiente', accept: Math.max(0, Math.min(0.95, 0.45 + r.opinion / 80 + (o.personality === 'peaceful' ? 0.2 : o.personality === 'aggressive' ? -0.25 : 0))) });
    out.push(r.openBorders
      ? { id: 'closeborders', label: 'Cerrar las fronteras', desc: 'Sus tropas ya no podrán cruzar tus tierras.', available: null }
      : { id: 'borders', label: 'Paso libre', desc: 'Las tropas de ambos pueden cruzar el territorio del otro; +10% comercio entre ambos.', cost: { influence: 5 }, available: me.res.influence >= 5 ? null : 'Influencia insuficiente', accept: Math.max(0, Math.min(0.95, 0.4 + r.opinion / 70)) });
    if (!r.married && hereditary(me) && hereditary(o)) out.push({ id: 'marry', label: 'Matrimonio dinástico', desc: 'Unir las casas reales: amistad duradera, legitimidad y, quizá, una herencia.', cost: { influence: 20, gold: 30 }, available: me.res.influence >= 20 && me.res.gold >= 30 ? (r.opinion < 10 ? 'Su opinión es demasiado baja' : null) : 'Recursos insuficientes', accept: Math.max(0, Math.min(0.9, 0.3 + r.opinion / 60)) });
    const demand = Math.round(20 + o.res.gold * 0.3);
    out.push({ id: 'demand', label: `Exigir tributo (${demand} oro)`, desc: 'Solo funciona si nos temen. Ofende.', cost: { influence: 10 }, available: me.res.influence >= 10 ? null : 'Influencia insuficiente', accept: acceptDemand(state, me, o, demand) });
    const vassal = Object.values(me.relations).some((x) => x.vassalOf != null);
    out.push({ id: 'war', label: 'Declarar la guerra', desc: r.truceUntil > state.year ? 'Rompe una tregua: perjurio y pérdida de reputación.' : r.state === 'alliance' ? 'Traicionar a un aliado tiene un alto precio.' : 'Movilizar el ejército contra ellos.', cost: { influence: 15 }, available: vassal ? 'Un vasallo no puede declarar guerras' : me.res.influence >= 15 ? null : 'Influencia insuficiente' });
  } else {
    out.push({ id: 'peace', label: 'Proponer paz blanca', desc: 'Volver a las fronteras actuales.', cost: { influence: 5 }, available: me.res.influence >= 5 ? null : 'Influencia insuficiente', accept: acceptPeace(state, me, o, 0) });
    const pay = Math.round(30 + me.res.gold * 0.25);
    out.push({ id: 'peacepay', label: `Comprar la paz (${pay} oro)`, desc: 'Pagar para que se retiren.', cost: { gold: pay, influence: 5 }, available: me.res.gold >= pay && me.res.influence >= 5 ? null : 'Recursos insuficientes', accept: acceptPeace(state, me, o, pay) });
    if (r.warScore > 60) out.push({ id: 'vassal', label: 'Exigir vasallaje', desc: 'Que se rindan y nos paguen tributo cada año. No podrán hacer la guerra por su cuenta.', cost: { influence: 10 }, available: me.res.influence >= 10 ? null : 'Influencia insuficiente', accept: Math.max(0, Math.min(0.9, (r.warScore - 50) / 60 + o.warWeariness / 80 - (o.personality === 'aggressive' ? 0.15 : 0))) });
    if (r.warScore > 30) {
      const take = Math.round(30 + o.res.gold * 0.5);
      out.push({ id: 'peacetribute', label: `Exigir paz con tributo (${take} oro)`, desc: 'Vamos ganando: que paguen.', cost: { influence: 5 }, available: me.res.influence >= 5 ? null : 'Influencia insuficiente', accept: Math.max(0, acceptPeace(state, me, o, 0) - 0.15 + r.warScore / 200) });
    }
  }
  return out;
}

export function doDiplo(state: GameState, me: Civ, o: Civ, id: string, rng: RNG): { ok: boolean; msg: string } {
  const acts = diploActions(state, me, o);
  const a = acts.find((x) => x.id === id);
  if (!a || a.available) return { ok: false, msg: a?.available ?? 'No disponible' };
  if (a.cost?.gold) me.res.gold -= a.cost.gold;
  if (a.cost?.influence) me.res.influence -= a.cost.influence;
  const r = me.relations[o.id];
  const ro = o.relations[me.id];
  switch (id) {
    case 'gift':
      o.res.gold += a.cost!.gold!;
      addOpinionMod(state, o, me.id, `gift${state.year}`, 'Regalos', 18, 20);
      return { ok: true, msg: `Los ${o.people} aceptan los regalos con agrado.` };
    case 'trade':
      if (rng.chance(a.accept!)) {
        r.trade = ro.trade = true;
        state.chronicle.push({ year: state.year, civ: me.id, kind: 'diplo', text: `Se abrió una ruta comercial entre los ${me.people} y los ${o.people}.` });
        return { ok: true, msg: `${o.leader.name} acepta. Las caravanas se ponen en marcha.` };
      }
      addOpinionMod(state, me, o.id, `rej${state.year}`, 'Nos rechazó', -5, 10);
      return { ok: false, msg: `${o.leader.name} rechaza la propuesta.` };
    case 'canceltrade':
      r.trade = ro.trade = false;
      addOpinionMod(state, o, me.id, 'canceltrade', 'Canceló nuestra ruta', -15, 25);
      return { ok: true, msg: 'La ruta comercial se ha cerrado.' };
    case 'alliance':
      if (rng.chance(a.accept!)) {
        r.state = ro.state = 'alliance';
        state.chronicle.push({ year: state.year, civ: me.id, kind: 'diplo', important: true, text: `Los ${me.people} y los ${o.people} sellaron una alianza.` });
        return { ok: true, msg: `¡Alianza sellada con ${o.name}!` };
      }
      return { ok: false, msg: `${o.leader.name} no está preparado para una alianza.` };
    case 'breakalliance':
      r.state = ro.state = 'peace';
      addOpinionMod(state, o, me.id, 'betrayal', 'Rompió nuestra alianza', -35, 50);
      return { ok: true, msg: 'La alianza ha terminado.' };
    case 'demand': {
      const amount = Math.round(20 + o.res.gold * 0.3);
      addOpinionMod(state, o, me.id, `demand${state.year}`, 'Nos exigió tributo', -20, 30);
      if (rng.chance(a.accept!)) {
        o.res.gold -= amount;
        me.res.gold += amount;
        return { ok: true, msg: `Los ${o.people} pagan ${amount} de oro, temerosos.` };
      }
      if (o.personality === 'aggressive' && o.strength > me.strength * 0.8 && rng.chance(0.5)) {
        declareWar(state, o, me);
        return { ok: false, msg: `¡${o.leader.name} responde declarándonos la guerra!` };
      }
      return { ok: false, msg: `${o.leader.name} se ríe de nuestra exigencia.` };
    }
    case 'nap':
      if (rng.chance(a.accept!)) {
        r.nap = ro.nap = state.year + 30;
        addOpinionMod(state, o, me.id, 'nap', 'Pacto de no agresión', 8, 30);
        state.chronicle.push({ year: state.year, civ: me.id, kind: 'diplo', text: `Los ${me.people} y los ${o.people} firmaron un pacto de no agresión.` });
        return { ok: true, msg: 'Pacto firmado: treinta años de paz asegurada.' };
      }
      return { ok: false, msg: `${o.leader.name} no se fía de vosotros.` };
    case 'borders':
      if (rng.chance(a.accept!)) {
        r.openBorders = ro.openBorders = true;
        return { ok: true, msg: 'Fronteras abiertas entre ambos pueblos.' };
      }
      return { ok: false, msg: `${o.leader.name} prefiere mantener sus fronteras cerradas.` };
    case 'closeborders':
      r.openBorders = ro.openBorders = false;
      addOpinionMod(state, o, me.id, 'closed', 'Nos cerró sus fronteras', -8, 20);
      return { ok: true, msg: 'Fronteras cerradas.' };
    case 'marry':
      if (rng.chance(a.accept!)) {
        r.married = ro.married = state.year;
        addOpinionMod(state, o, me.id, 'marriage', 'Lazos de sangre', 25, 80);
        addOpinionMod(state, me, o.id, 'marriage', 'Lazos de sangre', 25, 80);
        me.leader.legitimacy = Math.min(100, me.leader.legitimacy + 10);
        state.chronicle.push({ year: state.year, civ: me.id, kind: 'diplo', important: true, text: `Las casas reales de los ${me.people} y los ${o.people} se unieron en matrimonio.` });
        return { ok: true, msg: '¡Boda real! Las dos casas quedan unidas.' };
      }
      return { ok: false, msg: `${o.leader.name} rechaza el enlace.` };
    case 'vassal':
      if (rng.chance(a.accept!)) {
        makePeace(state, me, o, 0);
        ro.vassalOf = me.id;
        state.chronicle.push({ year: state.year, civ: -1, kind: 'diplo', important: true, text: `Los ${o.people} se convirtieron en vasallos de los ${me.people}.` });
        return { ok: true, msg: `${o.name} se rinde y se convierte en vasallo vuestro.` };
      }
      return { ok: false, msg: `${o.leader.name} prefiere morir de pie.` };
    case 'war':
      declareWar(state, me, o);
      return { ok: true, msg: `Guerra contra ${o.name}.` };
    case 'peace':
    case 'peacepay':
    case 'peacetribute': {
      if (rng.chance(a.accept!)) {
        let trib = 0;
        if (id === 'peacepay') { o.res.gold += a.cost!.gold!; trib = a.cost!.gold!; }
        if (id === 'peacetribute') {
          trib = Math.min(o.res.gold, Math.round(30 + o.res.gold * 0.5));
          o.res.gold -= trib;
          me.res.gold += trib;
        }
        makePeace(state, me, o, trib);
        return { ok: true, msg: `${o.leader.name} acepta la paz.` };
      }
      if (id === 'peacepay') me.res.gold += a.cost!.gold!; // devolvemos el oro
      return { ok: false, msg: `${o.leader.name} rechaza la paz. La guerra continúa.` };
    }
  }
  return { ok: false, msg: '' };
}

export function govName(c: Civ) {
  return GOV[c.government]?.name ?? '';
}

setDeclareWar(declareWar);
setMakePeace((s, a, b) => makePeace(s, a, b, 0));
