// Objetivos guiados del Consejo de ancianos: enseñan el juego sin pantallas de tutorial.
import type { Civ, GameState, ResId } from './types';
import { civSettlements, tilesOfSettlement } from './world';

export interface TutStep {
  id: string;
  title: string;
  hint: string;
  panel: string | null; // panel que ayuda a cumplirlo
  reward: Partial<Record<ResId, number>>;
  progress: (s: GameState, c: Civ) => [number, number];
}

const count = (s: GameState, c: Civ, type: string, done = true) => {
  let n = 0;
  for (const st of civSettlements(s, c.id)) for (const [, , t] of tilesOfSettlement(s, st)) if (t.b?.type === type && (!done || t.b.progress >= 1)) n++;
  return n;
};
const pop = (s: GameState, c: Civ) => civSettlements(s, c.id).reduce((a, x) => a + x.pop, 0);

export const TUTORIAL: TutStep[] = [
  { id: 'research', title: 'Elige qué investigar', hint: 'Abre Saber y escoge una tecnología. La Agricultura es una buena apuesta.', panel: 'tech', reward: { food: 15 }, progress: (s, c) => [c.research || c.techs.length ? 1 : 0, 1] },
  { id: 'huts', title: 'Construye más chozas', hint: 'Sin hogar no hay crecimiento. Construye chozas cerca del centro.', panel: 'build', reward: { wood: 20 }, progress: (s, c) => [count(s, c, 'hut', false) + count(s, c, 'house', false), 3] },
  { id: 'agri', title: 'Descubre la Agricultura', hint: 'Los campos alimentan a mucha más gente que la caza.', panel: 'tech', reward: { food: 30 }, progress: (s, c) => [c.techs.includes('agriculture') ? 1 : 0, 1] },
  { id: 'farms', title: 'Cultiva dos campos', hint: 'Mejor junto a ríos y unos al lado de otros: se ayudan entre sí.', panel: 'build', reward: { food: 40, wood: 15 }, progress: (s, c) => [count(s, c, 'farm'), 2] },
  { id: 'grow', title: 'Alcanza 90 habitantes', hint: 'Excedente de comida + vivienda libre = crecimiento.', panel: 'cities', reward: { influence: 15 }, progress: (s, c) => [Math.floor(pop(s, c)), 90] },
  { id: 'scout', title: 'Envía exploradores', hint: 'Descubre el mundo y a los otros pueblos (Construir → Exploradores).', panel: 'build', reward: { food: 20 }, progress: (s, c) => [c.flags.scouted ? 1 : 0, 1] },
  { id: 'law', title: 'Proclama una ley', hint: 'En Gobierno → Leyes. Cada ley contenta a unos y molesta a otros.', panel: 'gov', reward: { influence: 10 }, progress: (s, c) => [c.policies.length, 1] },
  { id: 'colony', title: 'Funda un segundo asentamiento', hint: 'Cuando tu capital pase de 45 habitantes, envía colonos a buena tierra.', panel: 'build', reward: { wood: 40, food: 40 }, progress: (s, c) => [civSettlements(s, c.id).length + s.colonists.filter((x) => x.civ === c.id).length, 2] },
  { id: 'writing', title: 'Descubre la Escritura', hint: 'Abre la puerta a los eruditos y a las leyes escritas.', panel: 'tech', reward: { influence: 20 }, progress: (s, c) => [c.techs.includes('writing') ? 1 : 0, 1] },
];

export function currentTutorial(c: Civ): TutStep | null {
  const i = c.flags.tut ?? 0;
  return TUTORIAL[i] ?? null;
}

// Devuelve el paso completado (para notificarlo) o null
export function checkTutorial(s: GameState, c: Civ): TutStep | null {
  const step = currentTutorial(c);
  if (!step) return null;
  const [v, max] = step.progress(s, c);
  if (v < max) return null;
  for (const [k, n] of Object.entries(step.reward)) c.res[k as ResId] += n as number;
  c.flags.tut = (c.flags.tut ?? 0) + 1;
  return step;
}
