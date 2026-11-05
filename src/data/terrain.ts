import type { Biome, DepositId, Tile } from '../sim/types';

export const BIOME_NAME: Record<Biome, string> = {
  deep: 'Océano profundo',
  ocean: 'Mar abierto',
  coast: 'Costa',
  lake: 'Lago',
  grass: 'Pradera',
  plains: 'Llanura',
  desert: 'Desierto',
  tundra: 'Tundra',
  snow: 'Glaciar',
};

export function isWater(t: Tile) {
  return t.biome === 'deep' || t.biome === 'ocean' || t.biome === 'coast' || t.biome === 'lake';
}
export function isLand(t: Tile) {
  return !isWater(t);
}

export function tileName(t: Tile): string {
  if (isWater(t)) return BIOME_NAME[t.biome];
  const base = t.elev === 2 ? 'Montañas' : BIOME_NAME[t.biome];
  const parts = [base];
  if (t.elev === 1) parts[0] = (t.feature === 'forest' ? 'Colinas boscosas' : 'Colinas') + (t.biome === 'desert' ? ' áridas' : t.biome === 'tundra' ? ' heladas' : '');
  else if (t.feature === 'forest') parts[0] = t.biome === 'tundra' ? 'Taiga' : t.biome === 'grass' ? 'Bosque' : 'Bosque claro';
  else if (t.feature === 'marsh') parts[0] = 'Marisma';
  if (t.river) parts.push('con río');
  return parts.join(' ');
}

// Alimento natural que la recolección obtiene de una casilla sin edificar
export function wildFood(t: Tile): number {
  if (t.biome === 'coast' || t.biome === 'lake') return 1.2;
  if (isWater(t)) return 0.3;
  let f = 0;
  if (t.biome === 'grass') f = 1;
  else if (t.biome === 'plains') f = 0.8;
  else if (t.biome === 'tundra') f = 0.4;
  else if (t.biome === 'desert') f = 0.1;
  if (t.feature === 'forest') f += 0.4;
  if (t.feature === 'marsh') f += 0.2;
  if (t.elev === 2) f = 0.1;
  if (t.river) f += 0.6;
  if (t.dep === 'deer' || t.dep === 'fish' || t.dep === 'cattle' || t.dep === 'wheat') f += 1;
  return f;
}

export interface DepositDef {
  id: DepositId;
  name: string;
  kind: 'food' | 'strategic' | 'luxury' | 'material';
  desc: string;
  reveal?: string; // tecnología que lo revela
}

export const DEPOSITS: Record<DepositId, DepositDef> = {
  wheat: { id: 'wheat', name: 'Cereal silvestre', kind: 'food', desc: 'Espigas salvajes. Las granjas aquí rinden mucho más.' },
  cattle: { id: 'cattle', name: 'Uros', kind: 'food', desc: 'Ganado salvaje. Ideal para pastos.' },
  deer: { id: 'deer', name: 'Caza mayor', kind: 'food', desc: 'Ciervos y jabalíes. Excelente para cazadores.' },
  fish: { id: 'fish', name: 'Bancos de peces', kind: 'food', desc: 'Aguas ricas. Los pescadores prosperan aquí.' },
  copper: { id: 'copper', name: 'Cobre', kind: 'strategic', desc: 'Necesario para armas de bronce. Las minas rinden más.', reveal: 'bronze' },
  iron: { id: 'iron', name: 'Hierro', kind: 'strategic', desc: 'Necesario para un ejército de la Edad del Hierro.', reveal: 'ironworking' },
  horses: { id: 'horses', name: 'Caballos', kind: 'strategic', desc: 'Manadas salvajes. Permiten caballería y mejoran el comercio.', reveal: 'husbandry' },
  marble: { id: 'marble', name: 'Mármol', kind: 'material', desc: 'Piedra noble. Acelera monumentos y maravillas.' },
  gold: { id: 'gold', name: 'Oro', kind: 'luxury', desc: 'Brillo que todos codician. Lujo y riqueza.' },
  gems: { id: 'gems', name: 'Gemas', kind: 'luxury', desc: 'Piedras preciosas. Lujo.' },
  spices: { id: 'spices', name: 'Especias', kind: 'luxury', desc: 'Aromas exóticos. Lujo muy comerciable.' },
  wine: { id: 'wine', name: 'Viñedos', kind: 'luxury', desc: 'Vid silvestre. Lujo y alegría.' },
  incense: { id: 'incense', name: 'Incienso', kind: 'luxury', desc: 'Resina sagrada. Lujo apreciado por el clero.' },
  furs: { id: 'furs', name: 'Pieles', kind: 'luxury', desc: 'Pieles finas del norte. Lujo.' },
  salt: { id: 'salt', name: 'Sal', kind: 'luxury', desc: 'Conserva alimentos (+almacenamiento) y es un lujo.' },
  pearls: { id: 'pearls', name: 'Perlas', kind: 'luxury', desc: 'Tesoros del mar. Lujo.' },
  silk: { id: 'silk', name: 'Seda', kind: 'luxury', desc: 'Gusanos de seda en bosques templados. Lujo.' },
};

export const LUXURIES: DepositId[] = ['gold', 'gems', 'spices', 'wine', 'incense', 'furs', 'salt', 'pearls', 'silk'];
