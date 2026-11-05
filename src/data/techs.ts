import type { ModFx } from '../sim/types';

export const ERAS = [
  { name: 'Edad Tribal', short: 'Tribal', color: '#8a6a3f' },
  { name: 'Edad del Bronce', short: 'Bronce', color: '#a8692c' },
  { name: 'Edad del Hierro', short: 'Hierro', color: '#5e6670' },
  { name: 'Era Clásica', short: 'Clásica', color: '#8b4a3a' },
  { name: 'Era Medieval', short: 'Medieval', color: '#4f5a3a' },
  { name: 'Renacimiento', short: 'Renacimiento', color: '#6b3f63' },
];

export interface TechDef {
  id: string;
  name: string;
  era: number;
  req: string[];
  desc: string;
  quote: string;
  fx?: ModFx;
  militaryTier?: number; // fija el nivel de armamento si se poseen recursos
  final?: boolean;
}

export const TECHS: TechDef[] = [
  // ── Edad Tribal
  { id: 'agriculture', name: 'Agricultura', era: 0, req: [], desc: 'Sembrar y cosechar. Desbloquea los campos de cultivo: la base de cualquier excedente.', quote: 'Quien siembra, se queda.' },
  { id: 'pottery', name: 'Alfarería', era: 0, req: [], desc: 'Vasijas para guardar grano. Desbloquea graneros y talleres artesanos.', quote: 'El barro recuerda la forma de las manos.' },
  { id: 'husbandry', name: 'Domesticación', era: 0, req: [], desc: 'Rebaños y monturas. Desbloquea los pastos y revela los caballos.', quote: 'El lobo aprendió a esperar junto al fuego.' },
  { id: 'masonry', name: 'Cantería', era: 0, req: [], desc: 'Tallar la piedra. Desbloquea canteras, megalitos y la Jefatura.', quote: 'La piedra no olvida.' },
  { id: 'fishing', name: 'Pesca', era: 0, req: [], desc: 'Redes y canoas. Desbloquea los embarcaderos de pesca.', quote: 'El río da a quien sabe esperar.' },
  { id: 'mysticism', name: 'Misticismo', era: 0, req: ['pottery'], desc: 'Los primeros ritos. Desbloquea santuarios y el Círculo de Piedras.', quote: 'Los muertos hablan en el humo.', fx: { cultureFlat: 0.5 } },
  // ── Bronce
  { id: 'bronze', name: 'Metalurgia del bronce', era: 1, req: ['masonry'], desc: 'Cobre y estaño fundidos. Desbloquea minas y armas de bronce (requiere cobre).', quote: 'El fuego obedeció.', militaryTier: 1 },
  { id: 'writing', name: 'Escritura', era: 1, req: ['pottery'], desc: 'Signos que perduran. Desbloquea la Casa de Tablillas y la facción de los eruditos.', quote: 'Lo dicho se va; lo escrito queda.', fx: { knowledgeFlat: 1 } },
  { id: 'wheel', name: 'La rueda', era: 1, req: ['husbandry'], desc: 'Carros y caminos. +25% comercio y +10% velocidad de construcción.', quote: 'El mundo se hizo más pequeño.', fx: { trade: 0.25, construction: 0.1 } },
  { id: 'irrigation', name: 'Irrigación', era: 1, req: ['agriculture'], desc: 'Acequias y canales. Los campos junto a agua rinden un 30% más.', quote: 'Domar el agua es domar el hambre.' },
  { id: 'calendar', name: 'Calendario', era: 1, req: ['mysticism', 'agriculture'], desc: 'El ciclo de las estaciones. +10% comida. Desbloquea templos y el Gran Zigurat.', quote: 'Las estrellas dicen cuándo sembrar.', fx: { food: 0.1 } },
  { id: 'law', name: 'Código de leyes', era: 1, req: ['writing'], desc: 'Normas escritas para todos. Desbloquea la Monarquía y nuevas leyes.', quote: 'Ojo por ojo, pero escrito en piedra.', fx: { influenceFlat: 1 } },
  // ── Hierro
  { id: 'ironworking', name: 'Siderurgia', era: 2, req: ['bronze'], desc: 'Hierro forjado. Herrerías y armas de hierro (requiere hierro).', quote: 'El hierro no es raro; es terco.', militaryTier: 2 },
  { id: 'currency', name: 'Moneda', era: 2, req: ['bronze', 'writing'], desc: 'Metal acuñado. Desbloquea mercados y la facción mercantil. +20% impuestos.', quote: 'Una promesa redonda.', fx: { tax: 0.2 } },
  { id: 'plough', name: 'Arado', era: 2, req: ['irrigation'], desc: 'Surcos profundos. +25% producción de las granjas.', quote: 'El buey y el hombre, juntos.' },
  { id: 'philosophy', name: 'Filosofía', era: 2, req: ['law', 'calendar'], desc: 'Preguntas sobre todo. Academias, la República y la Gran Biblioteca.', quote: 'Solo sé que no sé nada.', fx: { knowledge: 0.1 } },
  { id: 'mathematics', name: 'Matemáticas', era: 2, req: ['writing', 'wheel'], desc: 'Números y geometría. +15% construcción y máquinas de asedio.', quote: 'Todo es número.', fx: { construction: 0.15, military: 0.1 } },
  { id: 'sailing', name: 'Navegación', era: 2, req: ['fishing', 'wheel'], desc: 'Velas y estrellas. Puertos, comercio por mar y el Coloso.', quote: 'El horizonte es una invitación.', fx: { trade: 0.15 } },
  // ── Clásica
  { id: 'engineering', name: 'Ingeniería', era: 3, req: ['mathematics'], desc: 'Arcos y acueductos. Viviendas urbanas, acueductos y el Gran Canal.', quote: 'Roma no se hizo en un día.', fx: { construction: 0.15 } },
  { id: 'theology', name: 'Teología', era: 3, req: ['philosophy'], desc: 'La fe sistematizada. Grandes templos y la Teocracia.', quote: 'Creer para entender.', fx: { culture: 0.1 } },
  { id: 'drama', name: 'Drama y poesía', era: 3, req: ['philosophy', 'currency'], desc: 'El pueblo se mira a sí mismo. Anfiteatros y el Gran Anfiteatro.', quote: 'Todo el mundo es un escenario.', fx: { culture: 0.15 } },
  { id: 'medicine', name: 'Medicina', era: 3, req: ['philosophy'], desc: 'Humores y hierbas. Termas. +2 salud en todas partes.', quote: 'Primero, no hacer daño.', fx: { health: 2 } },
  { id: 'bureaucracy', name: 'Burocracia', era: 3, req: ['law', 'currency'], desc: 'Escribas y archivos. El Imperio y el Palacio. +2 influencia.', quote: 'El sello vale más que la espada.', fx: { influenceFlat: 2 } },
  { id: 'horsemanship', name: 'Equitación', era: 3, req: ['ironworking', 'husbandry'], desc: 'Estribos y jinetes. Desbloquea establos de caballería (requiere caballos).', quote: 'Un reino por un caballo.', fx: { military: 0.1 } },
  // ── Medieval
  { id: 'feudalism', name: 'Feudalismo', era: 4, req: ['bureaucracy'], desc: 'Vasallos y señores. La Monarquía feudal y la servidumbre.', quote: 'Tierra a cambio de lealtad.' },
  { id: 'guilds', name: 'Gremios', era: 4, req: ['currency', 'engineering'], desc: 'Maestros y aprendices. Casas gremiales. +15% bienes.', quote: 'El oficio es la riqueza de la ciudad.', fx: { goods: 0.15 } },
  { id: 'rotation', name: 'Rotación de cultivos', era: 4, req: ['plough'], desc: 'Barbecho y leguminosas. +25% producción de las granjas.', quote: 'La tierra también descansa.' },
  { id: 'university', name: 'Universidad', era: 4, req: ['theology', 'mathematics'], desc: 'Maestros y escolares. Desbloquea universidades.', quote: 'Universitas magistrorum et scholarium.', fx: { knowledge: 0.1 } },
  { id: 'banking', name: 'Banca', era: 4, req: ['currency', 'bureaucracy'], desc: 'Letras de cambio y préstamos. Desbloquea bancos.', quote: 'El dinero viaja sin moverse.', fx: { gold: 0.1 } },
  { id: 'castles', name: 'Fortificación', era: 4, req: ['engineering', 'feudalism'], desc: 'Castillos y torres. Murallas de nivel 3 y +15% fuerza militar.', quote: 'Detrás de cada muro, un miedo.', fx: { military: 0.15 } },
  // ── Renacimiento
  { id: 'printing', name: 'Imprenta', era: 5, req: ['university', 'guilds'], desc: 'Tipos móviles. +25% saber y +15% cultura.', quote: 'Mil copias de una idea.', fx: { knowledge: 0.25, culture: 0.15 } },
  { id: 'gunpowder', name: 'Pólvora', era: 5, req: ['castles', 'university'], desc: 'Truenos domados. Ejércitos con arcabuces.', quote: 'Las murallas ya no bastan.', militaryTier: 3 },
  { id: 'cartography', name: 'Cartografía', era: 5, req: ['sailing', 'university'], desc: 'Mapas precisos. +25% comercio. Revela el mundo conocido.', quote: 'Aquí hay dragones… o no.', fx: { trade: 0.25 } },
  { id: 'mercantile', name: 'Mercantilismo', era: 5, req: ['banking', 'cartography'], desc: 'Compañías y monopolios. Desbloquea las compañías comerciales.', quote: 'Comprar barato, vender caro.', fx: { gold: 0.15 } },
  { id: 'science', name: 'Método científico', era: 5, req: ['printing'], desc: 'Observar, medir, dudar. Observatorios y el Real Observatorio.', quote: 'Y sin embargo, se mueve.', fx: { knowledge: 0.15 } },
  { id: 'enlightenment', name: 'Ilustración', era: 5, req: ['science', 'printing'], desc: 'Razón y derechos. La República constitucional.', quote: 'Sapere aude.', fx: { culture: 0.15, stability: 5 } },
  { id: 'steam', name: 'Máquina de vapor', era: 5, req: ['science', 'mercantile'], desc: 'El umbral de una nueva era. Quien lo cruce primero cambiará el mundo para siempre.', quote: 'El vapor movió el mundo.', final: true },
];

export const TECH: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export function techCost(t: TechDef): number {
  const idx = TECHS.filter((x) => x.era === t.era).indexOf(t);
  return Math.round(24 * Math.pow(2.2, t.era) * (1 + 0.08 * idx));
}

export function civEra(techs: string[]): number {
  let era = 0;
  for (const id of techs) era = Math.max(era, TECH[id]?.era ?? 0);
  // Se entra en una era al conocer 2 tecnologías de ella (o 1 si es la siguiente y se tiene 4 de la anterior)
  const count = (e: number) => techs.filter((id) => TECH[id]?.era === e).length;
  let cur = 0;
  for (let e = 1; e <= 5; e++) {
    if (count(e) >= 2) cur = e;
  }
  return Math.max(cur, era > 0 && count(era) >= 1 && count(era - 1) >= 5 ? era : cur);
}
