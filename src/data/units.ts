// Tipos de unidad militar. Cada regimiento sale de la población (10 personas) y cuesta recursos.
import type { DepositId, ResId } from '../sim/types';

export type UnitGlyph = 'club' | 'bow' | 'spear' | 'chariot' | 'sword' | 'catapult' | 'horse' | 'pike' | 'knight' | 'trebuchet' | 'gun' | 'cannon' | 'raider';

export interface UnitDef {
  id: string;
  name: string;
  era: number;
  tech?: string;
  needs?: DepositId[]; // recursos estratégicos imprescindibles
  barracks?: boolean; // exige un cuartel en la ciudad que recluta
  atk: number;
  def: number;
  speed: number; // casillas por año en llano
  ranged?: boolean;
  mounted?: boolean;
  antiMounted?: boolean;
  siege?: number; // multiplicador contra murallas
  cost: Partial<Record<ResId, number>>;
  pop: number;
  time: number; // años de instrucción
  upkeep: number; // oro al año
  glyph: UnitGlyph;
  desc: string;
}

export const UNITS: UnitDef[] = [
  { id: 'warriors', name: 'Guerreros', era: 0, atk: 6, def: 5, speed: 5, cost: { food: 20, wood: 10 }, pop: 10, time: 1, upkeep: 0.3, glyph: 'club', desc: 'Mazas y hachas de piedra. Baratos y valientes.' },
  { id: 'archers', name: 'Arqueros', era: 0, atk: 5, def: 6, speed: 5, ranged: true, cost: { food: 20, wood: 25 }, pop: 10, time: 1, upkeep: 0.3, glyph: 'bow', desc: 'Disparan desde dos casillas sin recibir respuesta cuerpo a cuerpo.' },
  { id: 'spearmen', name: 'Lanceros', era: 1, tech: 'bronze', needs: ['copper'], barracks: true, atk: 9, def: 12, speed: 5, antiMounted: true, cost: { food: 25, wood: 15, metal: 15 }, pop: 10, time: 1, upkeep: 0.6, glyph: 'spear', desc: 'Muro de bronce. Doble fuerza contra jinetes y carros.' },
  { id: 'chariots', name: 'Carros de guerra', era: 1, tech: 'wheel', needs: ['horses'], barracks: true, atk: 14, def: 7, speed: 9, mounted: true, cost: { food: 25, wood: 35, metal: 5 }, pop: 10, time: 1, upkeep: 0.8, glyph: 'chariot', desc: 'Rápidos y temibles en llano; torpes en bosques y colinas.' },
  { id: 'swordsmen', name: 'Espadachines', era: 2, tech: 'ironworking', needs: ['iron'], barracks: true, atk: 17, def: 13, speed: 5, cost: { food: 30, metal: 30 }, pop: 10, time: 2, upkeep: 1, glyph: 'sword', desc: 'Infantería de hierro: la columna vertebral de un ejército.' },
  { id: 'catapults', name: 'Catapultas', era: 2, tech: 'mathematics', barracks: true, atk: 10, def: 4, speed: 3.5, ranged: true, siege: 3, cost: { wood: 50, metal: 15 }, pop: 8, time: 2, upkeep: 1, glyph: 'catapult', desc: 'Triplican el daño contra murallas. Necesitan escolta.' },
  { id: 'horsemen', name: 'Jinetes', era: 3, tech: 'horsemanship', needs: ['horses'], barracks: true, atk: 20, def: 12, speed: 10, mounted: true, cost: { food: 30, metal: 15, gold: 20 }, pop: 10, time: 2, upkeep: 1.4, glyph: 'horse', desc: 'Caballería ligera: exploran, flanquean y saquean.' },
  { id: 'pikemen', name: 'Piqueros', era: 4, tech: 'castles', barracks: true, atk: 18, def: 26, speed: 5, antiMounted: true, cost: { food: 30, metal: 25, gold: 15 }, pop: 10, time: 2, upkeep: 1.4, glyph: 'pike', desc: 'Un bosque de picas. Detienen a cualquier caballería.' },
  { id: 'knights', name: 'Caballeros', era: 4, tech: 'feudalism', needs: ['horses', 'iron'], barracks: true, atk: 32, def: 22, speed: 9, mounted: true, cost: { food: 30, metal: 40, gold: 40 }, pop: 10, time: 2, upkeep: 2, glyph: 'knight', desc: 'Nobles con armadura pesada. La carga decide batallas.' },
  { id: 'trebuchets', name: 'Fundíbulos', era: 4, tech: 'castles', barracks: true, atk: 18, def: 6, speed: 3, ranged: true, siege: 4, cost: { wood: 60, metal: 30 }, pop: 8, time: 2, upkeep: 1.6, glyph: 'trebuchet', desc: 'Contrapesos colosales que derriban castillos.' },
  { id: 'arquebusiers', name: 'Arcabuceros', era: 5, tech: 'gunpowder', barracks: true, atk: 40, def: 32, speed: 5, ranged: true, cost: { metal: 40, gold: 40, goods: 20 }, pop: 10, time: 2, upkeep: 2.4, glyph: 'gun', desc: 'El trueno en manos de cualquiera. Cambian la guerra para siempre.' },
  { id: 'bombards', name: 'Bombardas', era: 5, tech: 'gunpowder', barracks: true, atk: 36, def: 8, speed: 2.8, ranged: true, siege: 5, cost: { metal: 60, gold: 50 }, pop: 8, time: 3, upkeep: 2.4, glyph: 'cannon', desc: 'Ninguna muralla resiste mucho tiempo.' },
  { id: 'raiders', name: 'Saqueadores bárbaros', era: 0, atk: 7, def: 5, speed: 6, cost: {}, pop: 0, time: 0, upkeep: 0, glyph: 'raider', desc: 'Jinetes y guerreros sin rey ni ley.' },
];
export const UNIT: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const BARBARIAN = -1;
