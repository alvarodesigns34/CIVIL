import type { Civ, GameState } from '../sim/types';
import { civSettlements, tilesOfSettlement } from '../sim/world';
import { civEra } from './techs';

export interface AmbitionDef {
  id: string;
  name: string;
  desc: string;
  legacy: number;
  progress: (s: GameState, c: Civ) => [number, number];
}

const pop = (s: GameState, c: Civ) => civSettlements(s, c.id).reduce((a, x) => a + x.pop, 0);
const maxPop = (s: GameState, c: Civ) => Math.max(0, ...civSettlements(s, c.id).map((x) => x.pop));
const countB = (s: GameState, c: Civ, type: string) => {
  let n = 0;
  for (const st of civSettlements(s, c.id)) for (const [, , t] of tilesOfSettlement(s, st)) if (t.b?.type === type && t.b.progress >= 1) n++;
  return n;
};

export const AMBITIONS: AmbitionDef[] = [
  { id: 'fields', name: 'Primeros campos', desc: 'Cultiva 3 campos.', legacy: 15, progress: (s, c) => [countB(s, c, 'farm'), 3] },
  { id: 'village', name: 'Un pueblo numeroso', desc: 'Alcanza 150 habitantes.', legacy: 15, progress: (s, c) => [pop(s, c), 150] },
  { id: 'contact', name: 'No estamos solos', desc: 'Contacta con otra civilización.', legacy: 10, progress: (s, c) => [Object.values(c.relations).filter((r) => r.met).length, 1] },
  { id: 'expansion', name: 'Hijos de la tierra', desc: 'Gobierna 3 asentamientos.', legacy: 20, progress: (s, c) => [civSettlements(s, c.id).length, 3] },
  { id: 'writing', name: 'La memoria escrita', desc: 'Descubre la Escritura.', legacy: 10, progress: (s, c) => [c.techs.includes('writing') ? 1 : 0, 1] },
  { id: 'town', name: 'Ciudad', desc: 'Un asentamiento con 250 habitantes.', legacy: 25, progress: (s, c) => [maxPop(s, c), 250] },
  { id: 'trade', name: 'Caminos de caravanas', desc: 'Mantén 2 rutas comerciales.', legacy: 20, progress: (s, c) => [Object.values(c.relations).filter((r) => r.trade).length, 2] },
  { id: 'traditions', name: 'Un pueblo con alma', desc: 'Adopta 5 tradiciones.', legacy: 25, progress: (s, c) => [c.traditions.length, 5] },
  { id: 'wonder', name: 'Maravilla del mundo', desc: 'Completa una maravilla.', legacy: 25, progress: (s, c) => [Object.values(s.wonders).filter((x) => x === c.id).length, 1] },
  { id: 'golden', name: 'Edad dorada', desc: 'Alcanza 80 de estabilidad.', legacy: 25, progress: (s, c) => [Math.round(c.stability), 80] },
  { id: 'classical', name: 'Herederos de la Antigüedad', desc: 'Entra en la Era Clásica.', legacy: 30, progress: (s, c) => [civEra(c.techs), 3] },
  { id: 'realm', name: 'Un reino extenso', desc: 'Gobierna 6 asentamientos.', legacy: 35, progress: (s, c) => [civSettlements(s, c.id).length, 6] },
  { id: 'metropolis', name: 'Metrópolis', desc: 'Un asentamiento con 500 habitantes.', legacy: 40, progress: (s, c) => [maxPop(s, c), 500] },
  { id: 'alliance', name: 'Hermanos de armas', desc: 'Forma una alianza.', legacy: 15, progress: (s, c) => [Object.values(c.relations).filter((r) => r.state === 'alliance').length, 1] },
  { id: 'scholars', name: 'Biblioteca del mundo', desc: 'Conoce 20 tecnologías.', legacy: 30, progress: (s, c) => [c.techs.length, 20] },
  { id: 'thousand', name: 'Mil almas', desc: 'Alcanza 1.000 habitantes.', legacy: 40, progress: (s, c) => [pop(s, c), 1000] },
  { id: 'renaissance', name: 'Renacimiento', desc: 'Entra en el Renacimiento.', legacy: 50, progress: (s, c) => [civEra(c.techs), 5] },
  { id: 'great_power', name: 'Gran potencia', desc: 'Alcanza 2.500 habitantes.', legacy: 60, progress: (s, c) => [pop(s, c), 2500] },
];

export function legacyBreakdown(s: GameState, c: Civ) {
  const p = pop(s, c);
  const parts = [
    { label: 'Ambiciones, maravillas y hazañas', v: Math.round(c.legacy) },
    { label: 'Población', v: Math.round(p / 8) },
    { label: 'Tecnologías', v: c.techs.length * 6 },
    { label: 'Tradiciones', v: c.traditions.length * 8 },
    { label: 'Asentamientos', v: civSettlements(s, c.id).length * 12 },
  ];
  return { parts, total: parts.reduce((a, x) => a + x.v, 0) };
}
