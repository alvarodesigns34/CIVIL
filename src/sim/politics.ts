// Líderes, sucesión, gobiernos y leyes.
import type { Civ, GameState, Leader } from './types';
import { RNG } from '../core/rng';
import { GOV, POLICY, TRAIT } from '../data/politics';
import { makeLeader, deathChance } from './leaders';
import { queueEvent } from './events';
import { civFx } from './mods';
import { capitalOf } from './world';
import { inheritanceCheck } from './strategy';

export function yearlyLeader(state: GameState, civ: Civ, rng: RNG) {
  const L = civ.leader;
  L.age++;
  const fx = civFx(state, civ);
  L.legitimacy += fx.legitimacy + (civ.stability > 60 ? 0.4 : civ.stability < 30 ? -0.8 : 0) + (50 - L.legitimacy) * 0.01;
  L.legitimacy = Math.max(0, Math.min(100, L.legitimacy));
  // Heredero en gobiernos hereditarios
  const g = GOV[civ.government];
  if (g.succession === 'hereditary' && !civ.heir && L.age >= 30 && rng.chance(0.08)) {
    civ.heir = makeLeader(rng, civ, state.year, { age: 0, dynasty: L.dynasty, inherit: L.traits });
  }
  if (civ.heir) civ.heir.age++;
  if (rng.chance(deathChance(L))) killLeader(state, civ, rng, 'natural');
}

export function killLeader(state: GameState, civ: Civ, rng: RNG, cause: 'natural' | 'event' | 'battle' | 'coup') {
  const old = civ.leader;
  const g = GOV[civ.government];
  const causeTxt = cause === 'natural' ? (old.age > 55 ? 'de viejo' : 'de enfermedad') : cause === 'battle' ? 'en batalla' : cause === 'coup' ? 'derrocado' : '';
  state.chronicle.push({ year: state.year, civ: civ.id, kind: 'leader', important: civ.isPlayer, text: `${old.title} ${old.name} de los ${civ.people} murió ${causeTxt} a los ${old.age} años, tras ${state.year - old.reignStart} años de gobierno.` });
  civ.flags.lastLeaderDeath = state.year;
  inheritanceCheck(state, civ, rng);

  if (civ.isPlayer && (g.succession === 'election' || g.succession === 'council' || (g.succession === 'hereditary' && (!civ.heir || civ.heir.age < 16 || civ.stability < 35)))) {
    // El jugador decide (evento de sistema). Mientras tanto, un regente provisional.
    civ.leader = { ...makeLeader(rng, civ, state.year, { age: rng.int(40, 60), dynasty: old.dynasty }), title: 'Regente', legitimacy: 30 };
    queueEvent(state, civ, g.succession === 'election' ? 'sys_election' : g.succession === 'council' ? 'sys_council' : 'sys_succession_crisis', capitalOf(state, civ.id)?.id ?? -1, -1, { old: old.name, seed: rng.int(0, 1e9) });
    return;
  }
  civ.leader = autoSuccessor(state, civ, rng, old);
  civ.heir = null;
  state.chronicle.push({ year: state.year, civ: civ.id, kind: 'leader', important: civ.isPlayer, text: `${civ.leader.title} ${civ.leader.name} ${civ.leader.dynasty} tomó el poder.` });
}

export function autoSuccessor(state: GameState, civ: Civ, rng: RNG, old: Leader): Leader {
  const g = GOV[civ.government];
  let L: Leader;
  if (g.succession === 'hereditary' && civ.heir && civ.heir.age >= 16) {
    L = { ...civ.heir, reignStart: state.year, title: g.title, legitimacy: 45 + old.legitimacy * 0.35 };
  } else if (g.succession === 'clergy') {
    L = makeLeader(rng, civ, state.year, { age: rng.int(45, 62) });
    if (!L.traits.includes('pious')) L.traits = [...L.traits.filter((t) => t !== 'cynic'), 'pious'];
    L.legitimacy = 60;
  } else {
    L = makeLeader(rng, civ, state.year, { age: g.succession === 'council' ? rng.int(42, 60) : rng.int(35, 55), dynasty: g.succession === 'hereditary' ? old.dynasty : undefined });
    L.legitimacy = g.succession === 'hereditary' ? 35 : 55;
  }
  L.title = g.title;
  return L;
}

export function changeGovernment(state: GameState, civ: Civ, id: string) {
  const g = GOV[id];
  const old = GOV[civ.government];
  civ.government = id;
  civ.govChanged = state.year;
  civ.leader.title = g.title;
  // Recortar leyes si hay menos huecos
  while (civ.policies.length > g.slots) civ.policies.pop();
  civ.modifiers = civ.modifiers.filter((m) => m.id !== 'gov_transition');
  civ.modifiers.push({ id: 'gov_transition', name: 'Transición de gobierno', until: state.year + 8, fx: { stability: -10 }, good: false });
  state.chronicle.push({ year: state.year, civ: civ.id, kind: 'politics', important: true, text: `Los ${civ.people} abandonaron ${old.name.toLowerCase()} y adoptaron ${g.name.toLowerCase()}.` });
}

export function govChangeCost(civ: Civ) {
  return 40 + civ.techs.length * 2;
}

export function canAdoptPolicy(civ: Civ, id: string): string | null {
  const p = POLICY[id];
  if (!p) return 'Desconocida';
  if (civ.policies.includes(id)) return 'Ya está en vigor';
  if (p.tech && !civ.techs.includes(p.tech)) return 'Requiere tecnología';
  const g = GOV[civ.government];
  const sameGroup = civ.policies.find((x) => POLICY[x].group === p.group);
  if (!sameGroup && civ.policies.length >= g.slots) return `Tu gobierno solo admite ${g.slots} ley${g.slots > 1 ? 'es' : ''}`;
  if (civ.res.influence < p.cost) return `Necesitas ${p.cost} de influencia`;
  return null;
}

export function adoptPolicy(state: GameState, civ: Civ, id: string) {
  const p = POLICY[id];
  civ.policies = civ.policies.filter((x) => POLICY[x].group !== p.group);
  civ.policies.push(id);
  civ.res.influence -= p.cost;
  if (civ.isPlayer) state.chronicle.push({ year: state.year, civ: civ.id, kind: 'politics', text: `Se proclamó la ley «${p.name}».` });
}

export function revokePolicy(state: GameState, civ: Civ, id: string) {
  civ.policies = civ.policies.filter((x) => x !== id);
  civ.modifiers.push({ id: `revoke_${id}_${state.year}`, name: 'Ley derogada', until: state.year + 4, fx: { stability: -3 }, good: false });
}

export function traitList(l: Leader) {
  return l.traits.map((t) => TRAIT[t]).filter(Boolean);
}
