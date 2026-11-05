// Ciudades con identidad: prosperidad por necesidades, especialización y gobernadores.
import type { Civ, GameState, Settlement, YieldId, ModFx } from './types';
import { RNG } from '../core/rng';
import { tilesOfSettlement, nbrTiles, civSettlements } from './world';
import { BUILDING } from '../data/buildings';
import { personName } from '../data/names';
import { cultureOf } from './leaders';

// ───────── Niveles de prosperidad
export const LEVELS = [
  { name: 'Campamento', short: 'Campamento' },
  { name: 'Aldea', short: 'Aldea' },
  { name: 'Pueblo', short: 'Pueblo' },
  { name: 'Villa', short: 'Villa' },
  { name: 'Ciudad', short: 'Ciudad' },
  { name: 'Metrópolis', short: 'Metrópolis' },
];

export interface Need { id: string; label: string; ok: boolean; detail?: string }

function has(state: GameState, s: Settlement, pred: (cat: string, id: string) => boolean) {
  for (const [, , t] of tilesOfSettlement(state, s)) if (t.b && t.b.progress >= 1 && pred(BUILDING[t.b.type].cat, t.b.type)) return true;
  return false;
}

// Necesidades para alcanzar (o mantener) cada nivel
export function needsFor(state: GameState, civ: Civ, s: Settlement, level: number): Need[] {
  const L = civ.ledger;
  const lux = L.luxuries.length + L.luxuryTrade.length;
  const fed = !(L as any).famine && L.net.food >= -1;
  const out: Need[] = [];
  if (level >= 1) {
    out.push({ id: 'pop1', label: '30 habitantes', ok: s.pop >= 30 });
    out.push({ id: 'food', label: 'Comida suficiente', ok: fed });
  }
  if (level >= 2) {
    out.push({ id: 'pop2', label: '80 habitantes', ok: s.pop >= 80 });
    out.push({ id: 'house', label: 'Sin hacinamiento', ok: s.pop <= s.housing * 1.02 });
    out.push({ id: 'shrine', label: 'Un santuario, templo o megalito', ok: has(state, s, (c, id) => c === 'faith' || id === 'monument') });
  }
  if (level >= 3) {
    out.push({ id: 'pop3', label: '160 habitantes', ok: s.pop >= 160 });
    out.push({ id: 'goods', label: 'Bienes para el 70% de la gente', ok: L.goodsNeed <= 0 || L.goodsMet >= 0.7, detail: `${Math.round(L.goodsMet * 100)}% cubierto` });
    out.push({ id: 'lux1', label: 'Al menos un lujo', ok: lux >= 1 });
  }
  if (level >= 4) {
    out.push({ id: 'pop4', label: '320 habitantes', ok: s.pop >= 320 });
    out.push({ id: 'lux3', label: 'Tres lujos distintos', ok: lux >= 3, detail: `${lux} disponibles` });
    out.push({ id: 'market', label: 'Mercado, puerto o casa gremial', ok: has(state, s, (c) => c === 'trade') || has(state, s, (_, id) => id === 'guild') });
    out.push({ id: 'know', label: 'Un edificio de saber', ok: has(state, s, (c) => c === 'knowledge') });
  }
  if (level >= 5) {
    out.push({ id: 'pop5', label: '650 habitantes', ok: s.pop >= 650 });
    out.push({ id: 'health', label: 'Salud positiva', ok: s.health >= 0 });
    out.push({ id: 'civic', label: 'Anfiteatro, termas o acueducto', ok: has(state, s, (_, id) => id === 'theater' || id === 'baths' || id === 'aqueduct') });
    out.push({ id: 'lux5', label: 'Cinco lujos distintos', ok: lux >= 5, detail: `${lux} disponibles` });
  }
  return out;
}

export function levelBonus(level: number): ModFx {
  return { housing: 0.08 * level, tax: 0.1 * level, knowledgeFlat: level * 0.6, cultureFlat: level * 0.4 };
}

// Actualización anual de la prosperidad; devuelve los cambios de nivel para avisar
export function yearlyCities(state: GameState, civ: Civ, rng: RNG): { s: Settlement; from: number; to: number }[] {
  const changes: { s: Settlement; from: number; to: number }[] = [];
  for (const s of civSettlements(state, civ.id)) {
    const lv = s.level ?? 0;
    // ¿se cumplen las del siguiente nivel?
    if (lv < 5 && needsFor(state, civ, s, lv + 1).every((n) => n.ok)) {
      s.level = lv + 1;
      s.lowYears = 0;
      changes.push({ s, from: lv, to: lv + 1 });
      continue;
    }
    // ¿se incumplen las del nivel actual? Se tolera un tiempo antes de bajar
    if (lv > 0 && !needsFor(state, civ, s, lv).every((n) => n.ok)) {
      s.lowYears = (s.lowYears ?? 0) + 1;
      s.unrest = Math.min(100, s.unrest + 3);
      if (s.lowYears >= 5) {
        s.level = lv - 1;
        s.lowYears = 0;
        changes.push({ s, from: lv, to: lv - 1 });
      }
    } else s.lowYears = 0;
    // lealtad del gobernador
    if (s.governor) {
      const g = s.governor;
      g.loyalty = Math.max(0, Math.min(100, g.loyalty + (civ.stability - 50) / 25 + (GOVERNOR[g.kind]?.loyalty ?? 0) + (civ.leader.legitimacy > 60 ? 0.5 : -0.5)));
      g.age++;
      if (g.age > 75 || rng.chance(Math.max(0, (g.age - 55) * 0.01))) {
        state.chronicle.push({ year: state.year, civ: civ.id, kind: 'leader', text: `Murió ${g.name}, gobernador de ${s.name}.` });
        s.governor = undefined;
      }
    }
  }
  return changes;
}

// ───────── Especialización
export interface SpecDef { id: string; name: string; desc: string; mult: Partial<Record<YieldId, number>>; extra?: (s: Settlement) => void; coastal?: boolean; minLevel: number; fx?: ModFx }
export const SPECS: SpecDef[] = [
  { id: 'granary', name: 'Granero', desc: '+25% comida de sus campos, pastos y pescadores.', mult: { food: 0.25 }, minLevel: 1 },
  { id: 'mining', name: 'Ciudad minera', desc: '+30% piedra y metal.', mult: { stone: 0.3, metal: 0.3 }, minLevel: 2 },
  { id: 'forest', name: 'Ciudad maderera', desc: '+35% madera.', mult: { wood: 0.35 }, minLevel: 1 },
  { id: 'crafts', name: 'Ciudad artesana', desc: '+30% bienes.', mult: { goods: 0.3 }, minLevel: 2 },
  { id: 'port', name: 'Ciudad portuaria', desc: '+30% oro y comida del mar; +10% comercio de la civilización.', mult: { gold: 0.3 }, coastal: true, minLevel: 2, fx: { trade: 0.1 } },
  { id: 'trade', name: 'Ciudad mercantil', desc: '+35% oro.', mult: { gold: 0.35 }, minLevel: 3 },
  { id: 'holy', name: 'Ciudad santa', desc: '+35% cultura local, +4 estabilidad, +6 clero.', mult: { culture: 0.35 }, minLevel: 2, fx: { stability: 4, faction: { clergy: 6 } } },
  { id: 'learning', name: 'Ciudad del saber', desc: '+35% saber local, +6 eruditos.', mult: { knowledge: 0.35 }, minLevel: 3, fx: { faction: { scholars: 6 } } },
  { id: 'fortress', name: 'Fortaleza', desc: '+50% defensa; sus regimientos nacen con experiencia. +6 guerreros.', mult: {}, minLevel: 2, fx: { faction: { warriors: 6 } } },
];
export const SPEC: Record<string, SpecDef> = Object.fromEntries(SPECS.map((x) => [x.id, x]));

export function canSpecialize(state: GameState, civ: Civ, s: Settlement, id: string): string | null {
  const d = SPEC[id];
  if ((s.level ?? 0) < d.minLevel) return `Necesita ser ${LEVELS[d.minLevel].name.toLowerCase()}`;
  if (d.coastal && !nbrTiles(state, s.col, s.row).some((t) => t.biome === 'coast')) return 'Sólo en la costa';
  if (s.spec === id) return 'Ya es su especialidad';
  if (s.specYear != null && state.year - s.specYear < 30) return `Podrá cambiar en ${30 - (state.year - s.specYear)} años`;
  if (civ.res.influence < 20) return 'Necesitas 20 de influencia';
  return null;
}
export function specialize(state: GameState, civ: Civ, s: Settlement, id: string) {
  civ.res.influence -= 20;
  s.spec = id;
  s.specYear = state.year;
  state.chronicle.push({ year: state.year, civ: civ.id, kind: 'build', text: `${s.name} se convirtió en ${SPEC[id].name.toLowerCase()}.` });
}

// ───────── Gobernadores
export const GOVERNOR: Record<string, { name: string; desc: string; fx: Partial<Record<YieldId, number>>; loyalty: number; defense?: number; construction?: number }> = {
  admin: { name: 'Administrador', desc: '+10% a toda la producción de la ciudad.', fx: { food: 0.1, wood: 0.1, stone: 0.1, metal: 0.1, goods: 0.1, gold: 0.1, knowledge: 0.1, culture: 0.1 }, loyalty: 0 },
  tax: { name: 'Recaudador', desc: '+30% oro, pero su lealtad es frágil.', fx: { gold: 0.3 }, loyalty: -0.6 },
  builder: { name: 'Maestro de obras', desc: 'Las obras de la ciudad avanzan un 40% más rápido.', fx: {}, loyalty: 0.2, construction: 0.4 },
  general: { name: 'Estratega', desc: '+40% defensa de la ciudad.', fx: {}, loyalty: -0.2, defense: 0.4 },
  sage: { name: 'Sabio', desc: '+25% saber y cultura.', fx: { knowledge: 0.25, culture: 0.25 }, loyalty: 0.3 },
  steward: { name: 'Benefactor', desc: '+15% comida y −20 de malestar cada año.', fx: { food: 0.15 }, loyalty: 0.6 },
};

export function governorCandidates(state: GameState, civ: Civ, s: Settlement) {
  const rng = new RNG((state.year * 7919 + s.id * 104729) >>> 0);
  const kinds = rng.shuffle(Object.keys(GOVERNOR)).slice(0, 3);
  return kinds.map((k) => ({ kind: k, name: personName(rng, cultureOf(civ)), age: rng.int(28, 55), loyalty: rng.int(45, 80) }));
}
export function appointGovernor(state: GameState, civ: Civ, s: Settlement, g: { kind: string; name: string; age: number; loyalty: number }) {
  civ.res.influence -= 15;
  s.governor = { ...g };
  state.chronicle.push({ year: state.year, civ: civ.id, kind: 'politics', text: `${g.name} fue nombrado gobernador de ${s.name}.` });
}

// Multiplicador local de un rendimiento para un edificio de esta ciudad
export function cityYieldMult(s: Settlement, y: YieldId): number {
  let m = 0;
  if (s.spec) m += SPEC[s.spec]?.mult[y] ?? 0;
  if (s.governor) m += GOVERNOR[s.governor.kind]?.fx[y] ?? 0;
  return m;
}
export function cityConstruction(s: Settlement) {
  return s.governor ? GOVERNOR[s.governor.kind]?.construction ?? 0 : 0;
}
export function cityDefenseMult(s: Settlement) {
  return 1 + (s.spec === 'fortress' ? 0.5 : 0) + (s.governor ? GOVERNOR[s.governor.kind]?.defense ?? 0 : 0);
}

// Rasgos únicos de cada cultura
export const CULTURE_TRAIT: Record<string, { name: string; desc: string; fx: ModFx }> = {
  river: { name: 'Hijos de los grandes ríos', desc: '+10% comida y +0,2% de crecimiento.', fx: { food: 0.1, growth: 0.2 } },
  steppe: { name: 'Jinetes de la estepa', desc: '+15% fuerza militar y fronteras más rápidas.', fx: { military: 0.15, borders: 0.2 } },
  forest: { name: 'Pueblo del bosque', desc: '+25% madera y +5% cultura.', fx: { wood: 0.25, culture: 0.05 } },
  sea: { name: 'Señores del mar', desc: '+25% comercio y +10% oro.', fx: { trade: 0.25, gold: 0.1 } },
  mountain: { name: 'Hijos de la montaña', desc: '+20% piedra, +15% metal.', fx: { stone: 0.2, metal: 0.15 } },
  desert: { name: 'Caravaneros del desierto', desc: '+15% oro, +15% comercio.', fx: { gold: 0.15, trade: 0.15 } },
  jungle: { name: 'Guardianes de la selva', desc: '+15% cultura y +1 salud.', fx: { culture: 0.15, health: 1 } },
};

export { civSettlements };
