import { RNG } from '../core/rng';
import { CULTURES, personName } from '../data/names';
import { GOV, TRAIT, TRAITS } from '../data/politics';
import type { Civ, Leader } from './types';

export function cultureOf(civ: Civ) {
  return CULTURES.find((c) => c.id === civ.culture) ?? CULTURES[0];
}

export function randomTraits(rng: RNG, n: number, inherit: string[] = []): string[] {
  const out: string[] = [];
  // Herencia parcial de rasgos del progenitor
  for (const t of inherit) if (rng.chance(0.3) && out.length < n) out.push(t);
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const t = rng.weighted(TRAITS, (x) => (x.good ? 1.4 : 1)) !;
    if (out.includes(t.id)) continue;
    if (t.opposite && out.includes(t.opposite)) continue;
    out.push(t.id);
  }
  return out;
}

export function makeLeader(rng: RNG, civ: Civ, year: number, opts: { age?: number; dynasty?: string; inherit?: string[] } = {}): Leader {
  const cult = cultureOf(civ);
  return {
    name: personName(rng, cult),
    title: GOV[civ.government]?.title ?? 'Jefe',
    age: opts.age ?? rng.int(24, 42),
    traits: randomTraits(rng, rng.chance(0.5) ? 2 : 3, opts.inherit),
    legitimacy: 60,
    reignStart: year,
    dynasty: opts.dynasty ?? rng.pick(cult.dynasty),
    portrait: rng.int(0, 1e6),
  };
}

export function traitNames(l: Leader) {
  return l.traits.map((t) => TRAIT[t]?.name ?? t);
}

// Probabilidad anual de muerte natural
export function deathChance(l: Leader): number {
  let p = 0.004;
  if (l.age > 40) p += (l.age - 40) * 0.0035;
  if (l.age > 60) p += (l.age - 60) * 0.009;
  if (l.traits.includes('sickly')) p *= 1.8;
  return Math.min(0.5, p);
}
