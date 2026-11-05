// Decretos: acciones directas del gobernante, con coste, efectos y tiempo de recarga.
import type { Effect, EventCtx } from '../sim/eventTypes';
import type { ResId } from '../sim/types';

export interface DecreeDef {
  id: string;
  name: string;
  desc: string;
  cooldown: number;
  tech?: string;
  req?: (c: EventCtx) => boolean;
  reqText?: string;
  cost: (c: EventCtx) => Partial<Record<ResId, number>>;
  fx: (c: EventCtx) => Effect[];
}

export const DECREES: DecreeDef[] = [
  {
    id: 'festival', name: 'Gran festival', cooldown: 20,
    desc: 'Banquetes, música y juegos durante días. El pueblo olvida sus penas, por un tiempo.',
    cost: (c) => ({ food: 30 + Math.round(c.pop() * 0.08), gold: 10 + c.era * 10 }),
    fx: () => [{ t: 'stability', v: 10 }, { t: 'faction', f: 'commoners', v: 8 }, { t: 'mod', id: 'dec_festival', name: 'Recuerdo del festival', years: 6, fx: { culture: 0.15, stability: 3 } }],
  },
  {
    id: 'grain', name: 'Repartir grano', cooldown: 15,
    desc: 'Abrir los graneros a las familias pobres. Más hijos y menos quejas.',
    cost: (c) => ({ food: 25 + Math.round(c.pop() * 0.12) }),
    fx: () => [{ t: 'faction', f: 'commoners', v: 12 }, { t: 'mod', id: 'dec_grain', name: 'Graneros abiertos', years: 6, fx: { growth: 0.4, health: 1 } }],
  },
  {
    id: 'offerings', name: 'Ofrendas a los dioses', cooldown: 15, tech: 'mysticism',
    desc: 'Grandes ofrendas en los santuarios. El clero bendice al gobernante.',
    cost: (c) => ({ food: 30, goods: c.era >= 1 ? 15 : 0, gold: 10 }),
    fx: () => [{ t: 'faction', f: 'clergy', v: 15 }, { t: 'legitimacy', v: 6 }, { t: 'stability', v: 4 }],
  },
  {
    id: 'works', name: 'Obras públicas', cooldown: 25, tech: 'masonry',
    desc: 'Movilizar a todo el pueblo para construir. Las obras avanzan como nunca.',
    cost: () => ({ stone: 40, wood: 40, influence: 10 }),
    fx: () => [{ t: 'mod', id: 'dec_works', name: 'Obras públicas', years: 10, fx: { construction: 0.45 } }, { t: 'faction', f: 'commoners', v: 4 }],
  },
  {
    id: 'tribute', name: 'Tributo extraordinario', cooldown: 15,
    desc: 'Recaudadores casa por casa. Mucho oro rápido; nadie lo agradecerá.',
    cost: () => ({ influence: 10 }),
    fx: (c) => [{ t: 'res', r: 'gold', v: Math.round(15 + c.pop() * 0.25 * (1 + c.era * 0.3)) }, { t: 'faction', f: 'commoners', v: -12 }, { t: 'faction', f: 'merchants', v: -6 }, { t: 'stability', v: -4 }],
  },
  {
    id: 'census', name: 'Censo y reforma fiscal', cooldown: 50, tech: 'writing',
    desc: 'Contar a cada familia y cada rebaño. Un estado que sabe, recauda mejor.',
    cost: () => ({ influence: 25, gold: 20 }),
    fx: () => [{ t: 'mod', id: 'dec_census', name: 'Registro del censo', years: 30, fx: { tax: 0.2, influenceFlat: 1 } }, { t: 'faction', f: 'scholars', v: 6 }],
  },
  {
    id: 'expedition', name: 'Expedición de sabios', cooldown: 25, tech: 'writing',
    desc: 'Enviar eruditos a lejanas tierras a copiar libros y observar estrellas.',
    cost: (c) => ({ gold: 30 + c.era * 20, food: 20 }),
    fx: () => [{ t: 'knowledge', v: 0.45 }, { t: 'faction', f: 'scholars', v: 8 }],
  },
  {
    id: 'levy', name: 'Leva de emergencia', cooldown: 25,
    req: (c) => c.atWar(), reqText: 'Solo en tiempo de guerra',
    desc: 'Todo hombre capaz a las armas. El ejército crece; los campos se vacían.',
    cost: () => ({ influence: 15, food: 30 }),
    fx: () => [{ t: 'mod', id: 'dec_levy', name: 'Leva de emergencia', years: 8, fx: { military: 0.45, food: -0.1, growth: -0.3 } }, { t: 'faction', f: 'warriors', v: 10 }, { t: 'faction', f: 'commoners', v: -10 }],
  },
  {
    id: 'amnesty', name: 'Amnistía general', cooldown: 30, tech: 'law',
    desc: 'Perdonar deudas y delitos. Las ciudades respiran; los nobles murmuran.',
    cost: () => ({ influence: 15 }),
    fx: () => [{ t: 'custom', label: 'Malestar −30 en todas tus ciudades', run: (c) => { for (const s of c.state.settlements) if (s.civ === c.civ.id) s.unrest = Math.max(0, s.unrest - 30); } }, { t: 'stability', v: 6 }, { t: 'faction', f: 'warriors', v: -6 }],
  },
  {
    id: 'purge', name: 'Purgar la corte', cooldown: 30,
    desc: 'Desterrar a los intrigantes. El poder se afirma, aunque los guerreros recelan.',
    cost: () => ({ influence: 20 }),
    fx: () => [{ t: 'legitimacy', v: 15 }, { t: 'faction', f: 'warriors', v: -10 }, { t: 'stability', v: -3 }],
  },
  {
    id: 'embassy', name: 'Embajadas permanentes', cooldown: 40, tech: 'bureaucracy',
    req: (c) => Object.values(c.civ.relations).some((r) => r.met), reqText: 'Necesitas conocer a otro pueblo',
    desc: 'Residencias diplomáticas en todas las cortes conocidas.',
    cost: () => ({ gold: 60, influence: 20 }),
    fx: () => [{ t: 'opinion', v: 15, who: 'all', label: 'Embajada permanente' }, { t: 'faction', f: 'merchants', v: 6 }],
  },
  {
    id: 'triumph', name: 'Desfile triunfal', cooldown: 20,
    req: (c) => Object.values(c.civ.relations).some((r) => r.state === 'war' && r.warScore > 20), reqText: 'Necesitas ir ganando una guerra',
    desc: 'Los vencedores desfilan con el botín por la capital.',
    cost: () => ({ gold: 20 }),
    fx: () => [{ t: 'faction', f: 'warriors', v: 15 }, { t: 'stability', v: 8 }, { t: 'legitimacy', v: 8 }],
  },
];
export const DECREE: Record<string, DecreeDef> = Object.fromEntries(DECREES.map((d) => [d.id, d]));
