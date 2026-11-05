import type { FactionId, ResId, Tile, YieldId, Settlement, Civ, GameState } from '../sim/types';
import { isLand, isWater } from './terrain';

export type BCat = 'housing' | 'food' | 'materials' | 'craft' | 'faith' | 'knowledge' | 'civic' | 'trade' | 'military' | 'wonder';

export const BCAT_NAME: Record<BCat, string> = {
  housing: 'Vivienda',
  food: 'Alimento',
  materials: 'Materiales',
  craft: 'Artesanía',
  faith: 'Fe',
  knowledge: 'Saber',
  civic: 'Cívico',
  trade: 'Comercio',
  military: 'Militar',
  wonder: 'Maravillas',
};

export interface PlaceCtx {
  tile: Tile;
  col: number;
  row: number;
  nbrs: Tile[];
  state: GameState;
  civ: Civ;
  s: Settlement;
  distCenter: number;
}

export interface Bonus {
  label: string;
  add?: Partial<Record<YieldId, number>>;
  mult?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  cat: BCat;
  desc: string;
  tech?: string;
  cost: Partial<Record<ResId, number>>;
  time: number; // años
  jobs: number;
  faction?: FactionId; // a quién da poder
  out?: Partial<Record<YieldId, number>>; // a plantilla completa
  input?: Partial<Record<ResId, number>>;
  housing?: number;
  health?: number;
  stability?: number;
  storage?: number;
  soldiers?: boolean; // los trabajadores son soldados
  soldierPower?: number;
  upkeep?: number; // oro/año
  upgradeOf?: string;
  perSettlement?: number;
  perCiv?: number;
  wonder?: boolean;
  legacy?: number;
  needsDep?: string[];
  placeText: string;
  place: (c: PlaceCtx) => boolean;
  bonus?: (c: PlaceCtx) => Bonus[];
}

const flatLand = (t: Tile) => isLand(t) && t.elev === 0 && t.feature !== 'marsh' && t.biome !== 'snow';
const buildable = (t: Tile) => isLand(t) && t.elev < 2 && t.biome !== 'snow';
const nearWater = (c: PlaceCtx) => c.tile.river > 0 || c.nbrs.some((n) => n.biome === 'lake' || n.biome === 'coast');
const countAdj = (c: PlaceCtx, type: string) => c.nbrs.filter((n) => n.b && n.b.type === type).length;
const adjLand = (c: PlaceCtx) => c.nbrs.some((n) => isLand(n));
const hasTech = (c: PlaceCtx, t: string) => c.civ.techs.includes(t);

export const BUILDINGS: BuildingDef[] = [
  // ── Vivienda
  {
    id: 'hut', name: 'Chozas', cat: 'housing', desc: 'Refugios de ramas y barro para las familias.',
    cost: { wood: 12 }, time: 1, jobs: 0, housing: 22,
    placeText: 'Terreno llano o colinas.', place: (c) => buildable(c.tile) && c.tile.feature !== 'marsh',
    bonus: (c) => (c.distCenter <= 1 ? [{ label: 'Junto al centro', add: { culture: 0.2 } }] : []),
  },
  {
    id: 'house', name: 'Casas de adobe', cat: 'housing', desc: 'Muros sólidos, hogares duraderos. Mejora de las chozas.',
    tech: 'masonry', upgradeOf: 'hut', cost: { wood: 10, stone: 18 }, time: 2, jobs: 0, housing: 40, health: 0.3,
    placeText: 'Mejora unas chozas existentes.', place: (c) => c.tile.b?.type === 'hut',
  },
  {
    id: 'townhouse', name: 'Viviendas urbanas', cat: 'housing', desc: 'Edificios de varias plantas para una ciudad que crece.',
    tech: 'engineering', upgradeOf: 'house', cost: { wood: 20, stone: 40, gold: 25 }, time: 3, jobs: 0, housing: 75, health: -0.5,
    placeText: 'Mejora unas casas de adobe.', place: (c) => c.tile.b?.type === 'house',
  },
  // ── Alimento
  {
    id: 'hunters', name: 'Campamento de caza', cat: 'food', desc: 'Cazadores y recolectores que recorren el bosque.',
    cost: { wood: 8 }, time: 1, jobs: 6, faction: 'warriors', out: { food: 12 },
    placeText: 'Bosque o casilla con caza.', place: (c) => isLand(c.tile) && c.tile.elev < 2 && (c.tile.feature === 'forest' || c.tile.dep === 'deer' || c.tile.dep === 'furs'),
    bonus: (c) => {
      const b: Bonus[] = [];
      if (c.tile.dep === 'deer') b.push({ label: 'Caza mayor', add: { food: 6 } });
      if (c.tile.dep === 'furs') b.push({ label: 'Pieles', add: { gold: 2 } });
      if (countAdj(c, 'hunters') > 0) b.push({ label: 'Cotos solapados', mult: -0.2 });
      return b;
    },
  },
  {
    id: 'farm', name: 'Campos de cultivo', cat: 'food', desc: 'Surcos de cereal. Los campos contiguos se ayudan entre sí.',
    tech: 'agriculture', cost: { wood: 10 }, time: 1, jobs: 10, faction: 'commoners', out: { food: 22 },
    placeText: 'Pradera o llanura; si hay bosque, se tala (desierto solo con río).',
    place: (c) => flatLand(c.tile) && c.tile.biome !== 'tundra' && (c.tile.biome !== 'desert' || c.tile.river > 0),
    bonus: (c) => {
      const b: Bonus[] = [];
      if (c.tile.dep === 'wheat') b.push({ label: 'Cereal silvestre', add: { food: 7 } });
      if (c.tile.river) b.push({ label: 'Vega fluvial', add: { food: 4 } });
      if (c.tile.biome === 'plains') b.push({ label: 'Suelo de llanura', mult: -0.1 });
      if (c.tile.biome === 'desert') b.push({ label: 'Suelo árido', mult: -0.3 });
      const adj = Math.min(3, countAdj(c, 'farm'));
      if (adj) b.push({ label: `${adj} campo${adj > 1 ? 's' : ''} contiguo${adj > 1 ? 's' : ''}`, mult: 0.06 * adj });
      if (hasTech(c, 'irrigation') && nearWater(c)) b.push({ label: 'Irrigación', mult: 0.3 });
      if (hasTech(c, 'plough')) b.push({ label: 'Arado', mult: 0.25 });
      if (hasTech(c, 'rotation')) b.push({ label: 'Rotación de cultivos', mult: 0.25 });
      if (c.nbrs.some((n) => n.b?.type === 'pasture')) b.push({ label: 'Estiércol de pastos', mult: 0.08 });
      return b;
    },
  },
  {
    id: 'pasture', name: 'Pastos', cat: 'food', desc: 'Rebaños de cabras, ovejas y bueyes.',
    tech: 'husbandry', cost: { wood: 12 }, time: 1, jobs: 6, faction: 'commoners', out: { food: 12 },
    placeText: 'Pradera, llanura, tundra o colinas (el bosque se tala).',
    place: (c) => buildable(c.tile) && c.tile.feature !== 'marsh' && c.tile.biome !== 'desert',
    bonus: (c) => {
      const b: Bonus[] = [];
      if (c.tile.dep === 'cattle') b.push({ label: 'Uros', add: { food: 6 } });
      if (c.tile.dep === 'horses') b.push({ label: 'Caballos', add: { gold: 3 } });
      if (c.tile.dep === 'wine') b.push({ label: 'Viñedo', add: { gold: 2 } });
      if (c.tile.elev === 1) b.push({ label: 'Pastos de altura', add: { goods: 1 } });
      return b;
    },
  },
  {
    id: 'fishery', name: 'Embarcadero de pesca', cat: 'food', desc: 'Canoas, redes y secaderos de pescado.',
    tech: 'fishing', cost: { wood: 14 }, time: 1, jobs: 6, faction: 'commoners', out: { food: 13 },
    placeText: 'Costa o lago junto a tierra.', place: (c) => (c.tile.biome === 'coast' || c.tile.biome === 'lake') && adjLand(c),
    bonus: (c) => {
      const b: Bonus[] = [];
      if (c.tile.dep === 'fish') b.push({ label: 'Bancos de peces', add: { food: 7 } });
      if (c.tile.dep === 'pearls') b.push({ label: 'Perlas', add: { gold: 3 } });
      if (hasTech(c, 'sailing')) b.push({ label: 'Navegación', mult: 0.25 });
      return b;
    },
  },
  {
    id: 'granary', name: 'Granero', cat: 'food', desc: 'Silos que guardan la cosecha y reducen las pérdidas.',
    tech: 'pottery', cost: { wood: 15, stone: 5 }, time: 2, jobs: 2, faction: 'commoners', storage: 160,
    perSettlement: 2, placeText: 'Terreno llano.', place: (c) => flatLand(c.tile),
    bonus: (c) => (c.nbrs.some((n) => n.dep === 'salt') || c.tile.dep === 'salt' ? [{ label: 'Salazones', mult: 0.5 }] : []),
  },
  // ── Materiales
  {
    id: 'lumber', name: 'Leñadores', cat: 'materials', desc: 'Hachas de piedra y troncos apilados.',
    cost: {}, time: 1, jobs: 6, faction: 'commoners', out: { wood: 9 },
    placeText: 'Bosque.', place: (c) => isLand(c.tile) && c.tile.feature === 'forest' && c.tile.elev < 2,
    bonus: (c) => (hasTech(c, 'bronze') ? [{ label: 'Hachas de metal', mult: 0.3 }] : []),
  },
  {
    id: 'quarry', name: 'Cantera', cat: 'materials', desc: 'Bloques arrancados a la roca.',
    tech: 'masonry', cost: { wood: 15 }, time: 2, jobs: 6, faction: 'commoners', out: { stone: 8 },
    placeText: 'Colinas o montañas.', place: (c) => isLand(c.tile) && c.tile.elev >= 1,
    bonus: (c) => {
      const b: Bonus[] = [];
      if (c.tile.dep === 'marble') b.push({ label: 'Mármol', add: { stone: 5, culture: 1 } });
      if (c.tile.elev === 2) b.push({ label: 'Roca viva', mult: 0.2 });
      return b;
    },
  },
  {
    id: 'mine', name: 'Mina', cat: 'materials', desc: 'Galerías que siguen las vetas de mineral.',
    tech: 'bronze', cost: { wood: 20, stone: 10 }, time: 2, jobs: 8, faction: 'commoners', out: { metal: 5 },
    placeText: 'Colinas o montañas.', place: (c) => isLand(c.tile) && c.tile.elev >= 1,
    bonus: (c) => {
      const b: Bonus[] = [];
      if (c.tile.dep === 'copper') b.push({ label: 'Veta de cobre', add: { metal: 5 } });
      if (c.tile.dep === 'iron') b.push({ label: 'Veta de hierro', add: { metal: 6 } });
      if (c.tile.dep === 'gold') b.push({ label: 'Filón de oro', add: { gold: 8 } });
      if (c.tile.dep === 'gems') b.push({ label: 'Gemas', add: { gold: 6 } });
      if (c.tile.dep === 'salt') b.push({ label: 'Sal gema', add: { gold: 3, food: 2 } });
      if (c.tile.elev === 2) b.push({ label: 'Montaña', mult: 0.2 });
      if (hasTech(c, 'ironworking')) b.push({ label: 'Herramientas de hierro', mult: 0.2 });
      return b;
    },
  },
  // ── Artesanía
  {
    id: 'workshop', name: 'Taller artesano', cat: 'craft', desc: 'Cestos, cerámica, telas y herramientas. Convierte madera en bienes.',
    tech: 'pottery', cost: { wood: 20 }, time: 2, jobs: 6, faction: 'commoners', input: { wood: 4 }, out: { goods: 6 },
    placeText: 'Terreno llano o colinas.', place: (c) => buildable(c.tile) && c.tile.feature !== 'marsh',
    bonus: (c) => (c.distCenter <= 2 ? [{ label: 'Cerca del mercado del pueblo', mult: 0.1 }] : []),
  },
  {
    id: 'forge', name: 'Herrería', cat: 'craft', desc: 'Yunques y fuelles. Bienes de metal y armas.',
    tech: 'ironworking', cost: { wood: 20, stone: 20, metal: 10 }, time: 2, jobs: 6, faction: 'warriors', input: { metal: 3, wood: 2 }, out: { goods: 9 },
    placeText: 'Terreno llano o colinas.', place: (c) => buildable(c.tile) && c.tile.feature !== 'marsh',
    bonus: (c) => (c.nbrs.some((n) => n.b?.type === 'mine') ? [{ label: 'Junto a una mina', mult: 0.2 }] : []),
  },
  {
    id: 'guild', name: 'Casa gremial', cat: 'craft', desc: 'Maestros artesanos organizados. Producción de alta calidad.',
    tech: 'guilds', cost: { wood: 30, stone: 40, gold: 40 }, time: 3, jobs: 10, faction: 'merchants', input: { wood: 3, metal: 3 }, out: { goods: 16, gold: 4 },
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => flatLand(c.tile) && c.distCenter <= 2,
  },
  // ── Fe
  {
    id: 'shrine', name: 'Santuario', cat: 'faith', desc: 'Un lugar sagrado para los espíritus y los antepasados.',
    tech: 'mysticism', cost: { wood: 10, stone: 10 }, time: 2, jobs: 2, faction: 'clergy', out: { culture: 1.2 }, stability: 2, perSettlement: 2,
    placeText: 'Cualquier tierra no helada.', place: (c) => isLand(c.tile) && c.tile.biome !== 'snow',
    bonus: (c) => {
      const b: Bonus[] = [];
      if (c.tile.elev === 2) b.push({ label: 'Cumbre sagrada', add: { culture: 1 } });
      if (c.tile.dep === 'incense' || c.nbrs.some((n) => n.dep === 'incense')) b.push({ label: 'Incienso', add: { culture: 1 } });
      return b;
    },
  },
  {
    id: 'temple', name: 'Templo', cat: 'faith', desc: 'Sacerdotes, ofrendas y fiestas del calendario.',
    tech: 'calendar', cost: { wood: 15, stone: 35 }, time: 3, jobs: 4, faction: 'clergy', out: { culture: 2.5, influence: 0.4 }, stability: 3, upkeep: 1, perSettlement: 1,
    placeText: 'Terreno llano o colinas.', place: (c) => buildable(c.tile),
    bonus: (c) => (c.tile.elev === 1 ? [{ label: 'En lo alto', add: { culture: 0.5 } }] : []),
  },
  {
    id: 'basilica', name: 'Gran templo', cat: 'faith', desc: 'Una casa de la fe que domina el horizonte.',
    tech: 'theology', cost: { wood: 30, stone: 80, gold: 40 }, time: 5, jobs: 8, faction: 'clergy', out: { culture: 5, influence: 1 }, stability: 6, upkeep: 3, perSettlement: 1,
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => buildable(c.tile) && c.distCenter <= 2,
  },
  // ── Saber
  {
    id: 'archive', name: 'Casa de tablillas', cat: 'knowledge', desc: 'Escribas que registran cosechas, leyes y estrellas.',
    tech: 'writing', cost: { wood: 15, stone: 20 }, time: 2, jobs: 4, faction: 'scholars', out: { knowledge: 4 },
    perSettlement: 2, placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => buildable(c.tile) && c.distCenter <= 2,
  },
  {
    id: 'academy', name: 'Academia', cat: 'knowledge', desc: 'Maestros y discípulos discuten bajo los pórticos.',
    tech: 'philosophy', cost: { wood: 20, stone: 45, gold: 25 }, time: 3, jobs: 6, faction: 'scholars', out: { knowledge: 9, culture: 1 }, upkeep: 2,
    perSettlement: 1, placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => buildable(c.tile) && c.distCenter <= 2,
    bonus: (c) => (c.nbrs.some((n) => n.b?.type === 'archive') ? [{ label: 'Junto al archivo', mult: 0.15 }] : []),
  },
  {
    id: 'university', name: 'Universidad', cat: 'knowledge', desc: 'Facultades, bibliotecas y disputas eruditas.',
    tech: 'university', cost: { wood: 30, stone: 80, gold: 60 }, time: 4, jobs: 10, faction: 'scholars', out: { knowledge: 18, culture: 2 }, upkeep: 4,
    perSettlement: 1, placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => flatLand(c.tile) && c.distCenter <= 2,
  },
  {
    id: 'observatory', name: 'Observatorio', cat: 'knowledge', desc: 'Lentes y cuadrantes apuntados al cielo.',
    tech: 'science', cost: { stone: 60, metal: 30, gold: 80 }, time: 4, jobs: 8, faction: 'scholars', out: { knowledge: 24 }, upkeep: 4,
    perSettlement: 1, placeText: 'Colinas o montaña.', place: (c) => isLand(c.tile) && c.tile.elev >= 1,
  },
  // ── Cívico
  {
    id: 'monument', name: 'Megalito', cat: 'civic', desc: 'Piedras alzadas en honor de los antepasados. Cultura y orgullo.',
    tech: 'masonry', cost: { stone: 25 }, time: 3, jobs: 0, out: { culture: 1.5 }, stability: 1, perSettlement: 1,
    placeText: 'Cualquier tierra no helada.', place: (c) => isLand(c.tile) && c.tile.biome !== 'snow',
    bonus: (c) => (c.tile.dep === 'marble' || c.nbrs.some((n) => n.b?.type === 'quarry') ? [{ label: 'Piedra cercana', add: { culture: 0.5 } }] : []),
  },
  {
    id: 'theater', name: 'Anfiteatro', cat: 'civic', desc: 'Tragedias, comedias y discursos ante miles de personas.',
    tech: 'drama', cost: { stone: 60, gold: 30 }, time: 4, jobs: 6, faction: 'scholars', out: { culture: 6 }, stability: 5, upkeep: 2, perSettlement: 1,
    placeText: 'Colinas o llano junto al centro.', place: (c) => buildable(c.tile) && c.distCenter <= 2,
    bonus: (c) => (c.tile.elev === 1 ? [{ label: 'Gradas en ladera', mult: 0.2 }] : []),
  },
  {
    id: 'aqueduct', name: 'Acueducto', cat: 'civic', desc: 'Agua limpia traída desde lejos. Más salud y vivienda.',
    tech: 'engineering', cost: { stone: 70, gold: 20 }, time: 4, jobs: 2, health: 4, housing: 30, upkeep: 1, perSettlement: 1,
    placeText: 'Junto al centro.', place: (c) => isLand(c.tile) && c.distCenter === 1 && c.tile.elev < 2,
  },
  {
    id: 'baths', name: 'Termas', cat: 'civic', desc: 'Baños públicos: higiene, reposo y conversación.',
    tech: 'medicine', cost: { stone: 50, wood: 20, gold: 20 }, time: 3, jobs: 4, faction: 'commoners', health: 3, stability: 2, upkeep: 2, perSettlement: 1,
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => flatLand(c.tile) && c.distCenter <= 2,
    bonus: (c) => (c.tile.river || c.nbrs.some((n) => n.biome === 'lake') ? [{ label: 'Agua abundante', mult: 0.2 }] : []),
  },
  {
    id: 'palace', name: 'Palacio', cat: 'civic', desc: 'Sede del poder. Solo en la capital.',
    tech: 'bureaucracy', cost: { stone: 90, wood: 30, gold: 60 }, time: 5, jobs: 6, faction: 'warriors', out: { influence: 3, culture: 2 }, stability: 4, upkeep: 2, perCiv: 1,
    placeText: 'Junto al centro de la capital.', place: (c) => c.s.capital && c.distCenter === 1 && buildable(c.tile),
  },
  // ── Comercio
  {
    id: 'market', name: 'Mercado', cat: 'trade', desc: 'Puestos, balanzas y regateo. Más oro por cada lujo disponible.',
    tech: 'currency', cost: { wood: 25, stone: 25 }, time: 2, jobs: 6, faction: 'merchants', out: { gold: 6 }, perSettlement: 1,
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => flatLand(c.tile) && c.distCenter <= 2,
  },
  {
    id: 'harbor', name: 'Puerto', cat: 'trade', desc: 'Muelles para barcos mercantes y pesqueros.',
    tech: 'sailing', cost: { wood: 40, stone: 20 }, time: 3, jobs: 8, faction: 'merchants', out: { gold: 5, food: 4 }, perSettlement: 1,
    placeText: 'Costa junto a tierra.', place: (c) => c.tile.biome === 'coast' && adjLand(c),
  },
  {
    id: 'bank', name: 'Banco', cat: 'trade', desc: 'Prestamistas, cambistas y letras de crédito.',
    tech: 'banking', cost: { stone: 50, gold: 80 }, time: 3, jobs: 6, faction: 'merchants', out: { gold: 12 }, perSettlement: 1,
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => flatLand(c.tile) && c.distCenter <= 2,
  },
  {
    id: 'company', name: 'Compañía comercial', cat: 'trade', desc: 'Una sociedad por acciones con flotas en todos los mares.',
    tech: 'mercantile', cost: { wood: 60, stone: 40, gold: 120 }, time: 4, jobs: 10, faction: 'merchants', out: { gold: 18, goods: 4 }, perCiv: 2,
    placeText: 'Costa junto a tierra.', place: (c) => c.tile.biome === 'coast' && adjLand(c),
  },
  // ── Militar
  {
    id: 'warcamp', name: 'Campamento guerrero', cat: 'military', desc: 'Guerreros que defienden el poblado y cazan en sus ratos.',
    cost: { wood: 15 }, time: 1, jobs: 8, faction: 'warriors', soldiers: true, soldierPower: 1, out: { food: 2 },
    placeText: 'Terreno llano o colinas.', place: (c) => buildable(c.tile) && c.tile.feature !== 'marsh',
  },
  {
    id: 'barracks', name: 'Cuartel', cat: 'military', desc: 'Soldados profesionales, entrenados y equipados.',
    tech: 'bronze', cost: { wood: 25, stone: 30, metal: 10 }, time: 2, jobs: 12, faction: 'warriors', soldiers: true, soldierPower: 1.3, upkeep: 2,
    placeText: 'Terreno llano o colinas.', place: (c) => buildable(c.tile) && c.tile.feature !== 'marsh',
    bonus: (c) => (c.nbrs.some((n) => n.b?.type === 'forge') ? [{ label: 'Herrería cercana', mult: 0.15 }] : []),
  },
  {
    id: 'stables', name: 'Establos', cat: 'military', desc: 'Jinetes rápidos y temibles. Necesitan caballos en tu territorio.',
    tech: 'horsemanship', cost: { wood: 30, stone: 20, gold: 20 }, time: 2, jobs: 8, faction: 'warriors', soldiers: true, soldierPower: 2, upkeep: 2,
    needsDep: ['horses'], placeText: 'Pradera o llanura (requiere caballos en el territorio).', place: (c) => flatLand(c.tile) && c.tile.feature === 'none',
  },
  // ── Maravillas
  {
    id: 'w_stones', name: 'Círculo de Piedras', cat: 'wonder', wonder: true, legacy: 60, desc: 'Un anillo de monolitos alineado con el solsticio. +4 cultura, +4 estabilidad.',
    tech: 'mysticism', cost: { stone: 80, wood: 40, food: 60 }, time: 8, jobs: 0, out: { culture: 4 }, stability: 4,
    placeText: 'Llanura o colinas.', place: (c) => buildable(c.tile) && c.tile.feature === 'none',
  },
  {
    id: 'w_ziggurat', name: 'Gran Zigurat', cat: 'wonder', wonder: true, legacy: 80, desc: 'Una montaña escalonada hecha por manos humanas. +4 cultura, +4 saber, +2 influencia.',
    tech: 'calendar', cost: { stone: 140, wood: 60, food: 80 }, time: 10, jobs: 0, out: { culture: 4, knowledge: 4, influence: 2 }, stability: 2,
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => flatLand(c.tile) && c.distCenter <= 2,
  },
  {
    id: 'w_library', name: 'Gran Biblioteca', cat: 'wonder', wonder: true, legacy: 100, desc: 'Todo el saber del mundo bajo un mismo techo. +14 saber, +4 cultura.',
    tech: 'philosophy', cost: { stone: 160, wood: 60, gold: 100 }, time: 10, jobs: 0, out: { knowledge: 14, culture: 4 },
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => flatLand(c.tile) && c.distCenter <= 2,
  },
  {
    id: 'w_colossus', name: 'Coloso del Puerto', cat: 'wonder', wonder: true, legacy: 100, desc: 'Un gigante de bronce vigila la bahía. +12 oro, +20% comercio.',
    tech: 'sailing', cost: { stone: 80, metal: 80, gold: 60 }, time: 10, jobs: 0, out: { gold: 12, culture: 2 },
    placeText: 'Costa junto a tierra.', place: (c) => c.tile.biome === 'coast' && adjLand(c),
  },
  {
    id: 'w_canal', name: 'Gran Canal', cat: 'wonder', wonder: true, legacy: 100, desc: 'Un río hecho a mano. +15% comida en toda la civilización y +2 influencia.',
    tech: 'engineering', cost: { stone: 200, wood: 80, gold: 80 }, time: 12, jobs: 0, out: { influence: 2, culture: 2 },
    placeText: 'Casilla con río.', place: (c) => flatLand(c.tile) && c.tile.river > 0,
  },
  {
    id: 'w_arena', name: 'Gran Anfiteatro', cat: 'wonder', wonder: true, legacy: 120, desc: 'Cincuenta mil gargantas a la vez. +10 estabilidad, +6 cultura.',
    tech: 'drama', cost: { stone: 240, wood: 60, gold: 120 }, time: 12, jobs: 0, out: { culture: 6 }, stability: 10,
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => buildable(c.tile) && c.distCenter <= 2,
  },
  {
    id: 'w_cathedral', name: 'Catedral de las Mil Velas', cat: 'wonder', wonder: true, legacy: 140, desc: 'Generaciones enteras trabajaron en ella. +10 cultura, +8 estabilidad, +3 influencia.',
    tech: 'university', cost: { stone: 320, wood: 100, gold: 200 }, time: 15, jobs: 0, out: { culture: 10, influence: 3 }, stability: 8,
    placeText: 'Terreno llano a 2 casillas del centro.', place: (c) => flatLand(c.tile) && c.distCenter <= 2,
  },
  {
    id: 'w_observatory', name: 'Real Observatorio', cat: 'wonder', wonder: true, legacy: 160, desc: 'El cielo, medido al fin. +30 saber.',
    tech: 'science', cost: { stone: 260, metal: 120, gold: 260 }, time: 14, jobs: 0, out: { knowledge: 30, culture: 4 },
    placeText: 'Colinas o montaña.', place: (c) => isLand(c.tile) && c.tile.elev >= 1,
  },
];

export const BUILDING: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export { flatLand, buildable, isWater };
