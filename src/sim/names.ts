import type { ResId, YieldId } from './types';

export const RES_NAME: Record<YieldId, string> = {
  food: 'comida', wood: 'madera', stone: 'piedra', metal: 'metal', goods: 'bienes', gold: 'oro', influence: 'influencia', knowledge: 'saber', culture: 'cultura',
};
export const RES_TITLE: Record<YieldId, string> = {
  food: 'Comida', wood: 'Madera', stone: 'Piedra', metal: 'Metal', goods: 'Bienes', gold: 'Oro', influence: 'Influencia', knowledge: 'Saber', culture: 'Cultura',
};
export const RES_DESC: Record<YieldId, string> = {
  food: 'Cada habitante come 1 al año. Sin excedente no hay crecimiento; sin reservas llega el hambre.',
  wood: 'Material básico de construcción y combustible de los talleres.',
  stone: 'Para casas sólidas, templos, murallas y maravillas.',
  metal: 'Herramientas, armas y bienes de calidad. Requiere minas.',
  goods: 'Desde la Edad del Bronce la gente exige bienes. Satisfacerla mantiene contento al pueblo.',
  gold: 'Paga mantenimiento, soldados, regalos y proyectos.',
  influence: 'Capital político: leyes, gobiernos, diplomacia y colonias.',
  knowledge: 'Avanza la investigación en curso.',
  culture: 'Expande fronteras y desbloquea tradiciones.',
};
export function calendarYear(start: number, year: number) {
  const y = start + year;
  return y < 0 ? `${-y} a. C.` : y === 0 ? '1 d. C.' : `${y} d. C.`;
}
export type { ResId };
