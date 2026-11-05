import type { FactionId, ModFx } from '../sim/types';

export const FACTIONS: Record<FactionId, { name: string; short: string; of: string; desc: string; color: string; tech?: string; wants: string }> = {
  commoners: { name: 'El Pueblo', short: 'Pueblo', of: 'del pueblo', desc: 'Campesinos, pastores y artesanos: la inmensa mayoría.', color: '#7a8b3c', wants: 'Comida segura, vivienda, bienes y pocos impuestos.' },
  warriors: { name: 'Los Guerreros', short: 'Guerreros', of: 'de los guerreros', desc: 'Jefes de clan, nobles armados y veteranos.', color: '#a23b2a', wants: 'Un ejército fuerte, gloria y victorias.' },
  clergy: { name: 'El Clero', short: 'Clero', of: 'del clero', desc: 'Chamanes, sacerdotes y guardianes de los ritos.', color: '#c08a2b', tech: 'mysticism', wants: 'Templos, piedad y respeto a la tradición.' },
  merchants: { name: 'Los Mercaderes', short: 'Mercaderes', of: 'de los mercaderes', desc: 'Comerciantes, prestamistas y armadores.', color: '#2f6f6a', tech: 'currency', wants: 'Paz, rutas comerciales y libertad económica.' },
  scholars: { name: 'Los Eruditos', short: 'Eruditos', of: 'de los eruditos', desc: 'Escribas, filósofos y maestros.', color: '#4a5a9a', tech: 'writing', wants: 'Bibliotecas, academias y libertad de pensamiento.' },
};

export interface GovDef {
  id: string;
  name: string;
  desc: string;
  tech?: string;
  slots: number;
  succession: 'council' | 'hereditary' | 'election' | 'clergy';
  title: string;
  fx: ModFx;
  pros: string;
  cons: string;
}

export const GOVERNMENTS: GovDef[] = [
  {
    id: 'tribal', name: 'Consejo tribal', title: 'Anciano', succession: 'council', slots: 1,
    desc: 'Los ancianos de los clanes deciden juntos alrededor del fuego.',
    fx: { stability: 6, faction: { commoners: 8 }, influence: -0.2 }, pros: 'Estable y cohesionado.', cons: 'Poca capacidad de mando y de influencia.',
  },
  {
    id: 'chiefdom', name: 'Jefatura', title: 'Gran Jefe', succession: 'hereditary', slots: 2, tech: 'masonry',
    desc: 'Un linaje guerrero gobierna sobre los clanes.',
    fx: { military: 0.15, faction: { warriors: 12, commoners: -4 }, influenceFlat: 0.5 }, pros: '+15% fuerza militar.', cons: 'El pueblo pierde voz.',
  },
  {
    id: 'monarchy', name: 'Monarquía', title: 'Rey', succession: 'hereditary', slots: 3, tech: 'law',
    desc: 'Un rey ungido, una corte y una ley común.',
    fx: { influenceFlat: 1.5, legitimacy: 1, faction: { warriors: 8, clergy: 5 } }, pros: '+1,5 influencia y legitimidad creciente.', cons: 'Sucesiones arriesgadas.',
  },
  {
    id: 'republic', name: 'República', title: 'Cónsul', succession: 'election', slots: 3, tech: 'philosophy',
    desc: 'Magistrados elegidos y un senado de ciudadanos.',
    fx: { gold: 0.1, knowledge: 0.1, trade: 0.15, faction: { merchants: 15, scholars: 10, warriors: -10 } }, pros: '+10% oro y saber, +15% comercio.', cons: 'Los guerreros desconfían.',
  },
  {
    id: 'theocracy', name: 'Teocracia', title: 'Sumo Sacerdote', succession: 'clergy', slots: 3, tech: 'theology',
    desc: 'Los dioses gobiernan a través de su clero.',
    fx: { culture: 0.25, stability: 8, knowledge: -0.15, faction: { clergy: 25, scholars: -15 } }, pros: '+25% cultura y +8 estabilidad.', cons: '−15% saber; los eruditos sufren.',
  },
  {
    id: 'empire', name: 'Imperio', title: 'Emperador', succession: 'hereditary', slots: 4, tech: 'bureaucracy',
    desc: 'Provincias, gobernadores y un trono por encima de todos.',
    fx: { influenceFlat: 3, military: 0.1, stability: -3, faction: { warriors: 10, commoners: -5 }, borders: 0.25 }, pros: '+3 influencia, fronteras rápidas.', cons: 'Gobernar tanto desgasta.',
  },
  {
    id: 'feudal', name: 'Monarquía feudal', title: 'Rey', succession: 'hereditary', slots: 4, tech: 'feudalism',
    desc: 'Señores y vasallos unidos por juramentos.',
    fx: { military: 0.25, food: 0.05, faction: { warriors: 15, commoners: -10, clergy: 5 } }, pros: '+25% fuerza militar.', cons: 'El pueblo, atado a la tierra.',
  },
  {
    id: 'constitutional', name: 'República constitucional', title: 'Presidente', succession: 'election', slots: 5, tech: 'enlightenment',
    desc: 'Derechos escritos, poderes separados y ciudadanos libres.',
    fx: { knowledge: 0.15, gold: 0.15, stability: 6, faction: { commoners: 10, scholars: 15, merchants: 10, clergy: -10 } }, pros: 'Saber, oro y estabilidad.', cons: 'El clero pierde su lugar.',
  },
];
export const GOV: Record<string, GovDef> = Object.fromEntries(GOVERNMENTS.map((g) => [g.id, g]));

export interface PolicyDef {
  id: string;
  name: string;
  group: string; // mutuamente exclusivas dentro del grupo
  tech?: string;
  cost: number; // influencia
  desc: string;
  fx: ModFx;
}

export const POLICY_GROUPS: Record<string, string> = {
  land: 'Tierra',
  labor: 'Trabajo',
  army: 'Ejército',
  faith: 'Fe',
  learning: 'Saber',
  commerce: 'Comercio',
  tax: 'Tributos',
};

export const POLICIES: PolicyDef[] = [
  { id: 'communal', name: 'Tierras comunales', group: 'land', cost: 10, desc: 'La tierra es de todos y la cosecha se reparte.', fx: { food: 0.05, stability: 3, faction: { commoners: 10, merchants: -10 } } },
  { id: 'clanland', name: 'Tierras de clan', group: 'land', cost: 10, desc: 'Cada linaje guerrero controla sus campos.', fx: { military: 0.1, faction: { warriors: 10, commoners: -6 } } },
  { id: 'private', name: 'Propiedad privada', group: 'land', tech: 'currency', cost: 25, desc: 'Cada cual es dueño de su parcela.', fx: { gold: 0.1, food: 0.05, faction: { merchants: 15, commoners: -5 } } },
  { id: 'serfdom', name: 'Servidumbre', group: 'land', tech: 'feudalism', cost: 30, desc: 'Los campesinos, atados al señor y a la tierra.', fx: { food: 0.15, workforce: 0.05, growth: -0.2, faction: { warriors: 15, commoners: -20 } } },

  { id: 'corvee', name: 'Prestación personal', group: 'labor', cost: 12, desc: 'Cada familia debe días de trabajo para obras comunes.', fx: { construction: 0.3, faction: { commoners: -8 } } },
  { id: 'apprentice', name: 'Aprendizaje de oficios', group: 'labor', tech: 'pottery', cost: 15, desc: 'Los jóvenes aprenden junto a un maestro.', fx: { goods: 0.2, faction: { commoners: 4 } } },
  { id: 'slavery', name: 'Esclavitud', group: 'labor', tech: 'bronze', cost: 20, desc: 'Cautivos de guerra trabajan en minas y canteras.', fx: { stone: 0.25, metal: 0.25, workforce: 0.06, stability: -4, opinion: -5, faction: { warriors: 6, scholars: -10, commoners: -4 } } },
  { id: 'freelabor', name: 'Trabajo libre', group: 'labor', tech: 'philosophy', cost: 25, desc: 'Salarios y contratos libres.', fx: { growth: 0.2, gold: 0.05, faction: { commoners: 10, merchants: 5, warriors: -5 } } },

  { id: 'levy', name: 'Leva tribal', group: 'army', cost: 10, desc: 'Todo adulto sano empuña una lanza si hace falta.', fx: { military: 0.2, workforce: -0.03, faction: { warriors: 6, commoners: -5 } } },
  { id: 'warrior_code', name: 'Código del guerrero', group: 'army', tech: 'bronze', cost: 20, desc: 'El honor marcial por encima de todo.', fx: { military: 0.25, culture: 0.05, faction: { warriors: 15, merchants: -8 } } },
  { id: 'standing', name: 'Ejército profesional', group: 'army', tech: 'ironworking', cost: 30, desc: 'Soldados pagados y disciplinados.', fx: { military: 0.35, upkeep: 0.25, faction: { warriors: 10 } } },
  { id: 'militia', name: 'Milicias ciudadanas', group: 'army', tech: 'philosophy', cost: 20, desc: 'Ciudadanos-soldado que defienden su ciudad.', fx: { military: 0.15, stability: 3, faction: { commoners: 6, warriors: -6 } } },

  { id: 'ancestors', name: 'Culto a los antepasados', group: 'faith', cost: 10, desc: 'Los muertos protegen a los vivos.', fx: { stability: 4, cultureFlat: 1, faction: { clergy: 8 } } },
  { id: 'statecult', name: 'Culto estatal', group: 'faith', tech: 'calendar', cost: 20, desc: 'El gobernante es el sumo intermediario con los dioses.', fx: { legitimacy: 1, culture: 0.1, faction: { clergy: 12, scholars: -6 } } },
  { id: 'tolerance', name: 'Tolerancia religiosa', group: 'faith', tech: 'philosophy', cost: 20, desc: 'Cada cual adora a sus dioses en paz.', fx: { opinion: 10, trade: 0.1, stability: 2, faction: { clergy: -12, merchants: 8, scholars: 6 } } },
  { id: 'zeal', name: 'Fervor', group: 'faith', tech: 'theology', cost: 30, desc: 'La fe lo es todo, también en la guerra.', fx: { culture: 0.2, military: 0.1, opinion: -10, faction: { clergy: 18, scholars: -12 } } },

  { id: 'oral', name: 'Tradición oral', group: 'learning', cost: 8, desc: 'Ancianos y bardos transmiten el saber.', fx: { culture: 0.1, knowledge: 0.05 } },
  { id: 'scribes', name: 'Escuelas de escribas', group: 'learning', tech: 'writing', cost: 20, desc: 'El estado forma a sus propios escribas.', fx: { knowledge: 0.2, influenceFlat: 0.5, faction: { scholars: 12 } } },
  { id: 'patronage', name: 'Mecenazgo', group: 'learning', tech: 'drama', cost: 30, desc: 'Los poderosos financian artistas y sabios.', fx: { culture: 0.25, knowledge: 0.1, goldFlat: -3, faction: { scholars: 10 } } },
  { id: 'publicschool', name: 'Educación pública', group: 'learning', tech: 'printing', cost: 40, desc: 'Escuelas para todos los niños.', fx: { knowledge: 0.3, growth: -0.1, goldFlat: -5, faction: { scholars: 15, commoners: 8, clergy: -8 } } },

  { id: 'barter', name: 'Ferias de trueque', group: 'commerce', cost: 10, desc: 'Encuentros periódicos para intercambiar excedentes.', fx: { trade: 0.15, goods: 0.05 } },
  { id: 'freetrade', name: 'Libre comercio', group: 'commerce', tech: 'currency', cost: 25, desc: 'Puertos y caminos abiertos a todos.', fx: { trade: 0.35, opinion: 5, faction: { merchants: 15, warriors: -5 } } },
  { id: 'protection', name: 'Proteccionismo', group: 'commerce', tech: 'guilds', cost: 25, desc: 'Aranceles para proteger a los artesanos propios.', fx: { goods: 0.25, trade: -0.2, faction: { commoners: 6, merchants: -6 } } },

  { id: 'tithe', name: 'Diezmo', group: 'tax', tech: 'calendar', cost: 15, desc: 'Una décima parte de todo, para los templos y el estado.', fx: { tax: 0.3, culture: 0.1, faction: { clergy: 8, commoners: -8 } } },
  { id: 'lowtax', name: 'Impuestos bajos', group: 'tax', cost: 10, desc: 'Que la gente conserve lo suyo.', fx: { tax: -0.4, growth: 0.15, faction: { commoners: 12, merchants: 6 } } },
  { id: 'hightax', name: 'Impuestos altos', group: 'tax', tech: 'currency', cost: 15, desc: 'El tesoro primero.', fx: { tax: 0.6, stability: -4, faction: { commoners: -14, merchants: -8 } } },
];
export const POLICY: Record<string, PolicyDef> = Object.fromEntries(POLICIES.map((p) => [p.id, p]));

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  fx: ModFx;
  good: boolean;
  opposite?: string;
}

export const TRAITS: TraitDef[] = [
  { id: 'wise', name: 'Sabio', desc: 'Escucha antes de hablar.', fx: { knowledge: 0.15, faction: { scholars: 8 } }, good: true, opposite: 'foolish' },
  { id: 'foolish', name: 'Necio', desc: 'Confunde terquedad con firmeza.', fx: { knowledge: -0.1, stability: -3 }, good: false, opposite: 'wise' },
  { id: 'brave', name: 'Valiente', desc: 'Siempre en primera línea.', fx: { military: 0.15, faction: { warriors: 10 } }, good: true, opposite: 'craven' },
  { id: 'craven', name: 'Cobarde', desc: 'Evita el peligro a toda costa.', fx: { military: -0.15, faction: { warriors: -12 } }, good: false, opposite: 'brave' },
  { id: 'pious', name: 'Piadoso', desc: 'Reza al alba y al ocaso.', fx: { culture: 0.1, faction: { clergy: 12 } }, good: true, opposite: 'cynic' },
  { id: 'cynic', name: 'Escéptico', desc: 'Duda de los dioses y de quienes hablan por ellos.', fx: { knowledge: 0.05, faction: { clergy: -12, scholars: 5 } }, good: false, opposite: 'pious' },
  { id: 'builder', name: 'Constructor', desc: 'Quiere dejar su nombre en piedra.', fx: { construction: 0.25, stone: 0.1 }, good: true },
  { id: 'charismatic', name: 'Carismático', desc: 'Las multitudes le adoran.', fx: { stability: 5, influenceFlat: 1, opinion: 10 }, good: true },
  { id: 'cruel', name: 'Cruel', desc: 'El miedo es su herramienta favorita.', fx: { stability: -2, military: 0.1, opinion: -10, faction: { commoners: -8, warriors: 4 } }, good: false, opposite: 'just' },
  { id: 'just', name: 'Justo', desc: 'La ley vale igual para todos.', fx: { stability: 4, legitimacy: 0.5, faction: { commoners: 6 } }, good: true, opposite: 'cruel' },
  { id: 'greedy', name: 'Codicioso', desc: 'Cuenta cada moneda dos veces.', fx: { gold: 0.15, stability: -2, faction: { commoners: -5, merchants: 5 } }, good: false, opposite: 'generous' },
  { id: 'generous', name: 'Generoso', desc: 'Reparte sin mirar a quién.', fx: { goldFlat: -1, stability: 3, faction: { commoners: 8 } }, good: true, opposite: 'greedy' },
  { id: 'ambitious', name: 'Ambicioso', desc: 'Nada le basta.', fx: { influenceFlat: 1, borders: 0.2, faction: { warriors: 4, clergy: -4 } }, good: true },
  { id: 'paranoid', name: 'Paranoico', desc: 'Ve conspiraciones en cada sombra.', fx: { stability: -3, legitimacy: -0.5, faction: { warriors: -4 } }, good: false },
  { id: 'sickly', name: 'Enfermizo', desc: 'Su salud siempre ha sido frágil.', fx: { legitimacy: -0.5 }, good: false },
  { id: 'diplomat', name: 'Diplomático', desc: 'Encuentra siempre la palabra justa.', fx: { opinion: 15, trade: 0.1 }, good: true },
  { id: 'merchant', name: 'Mercader', desc: 'Nació entre balanzas y monedas.', fx: { trade: 0.2, gold: 0.05, faction: { merchants: 10 } }, good: true },
  { id: 'scholar', name: 'Erudito', desc: 'Pasa las noches entre tablillas y pergaminos.', fx: { knowledge: 0.1, culture: 0.1, faction: { scholars: 10, warriors: -4 } }, good: true },
  { id: 'drunkard', name: 'Bebedor', desc: 'Sus banquetes son legendarios. Su resaca también.', fx: { stability: -2, influenceFlat: -0.5 }, good: false },
  { id: 'reformer', name: 'Reformista', desc: 'Cree que todo puede hacerse mejor.', fx: { knowledge: 0.05, culture: 0.05, faction: { clergy: -5, scholars: 6, commoners: 4 } }, good: true },
];
export const TRAIT: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

export interface TraditionDef {
  id: string;
  name: string;
  era: number;
  desc: string;
  fx: ModFx;
}

export const TRADITIONS: TraditionDef[] = [
  { id: 'fire_stories', name: 'Historias junto al fuego', era: 0, desc: '+15% cultura. Los mayores enseñan a los jóvenes.', fx: { culture: 0.15 } },
  { id: 'hunt_rites', name: 'Ritos de caza', era: 0, desc: '+10% comida, +5 aprobación de los guerreros.', fx: { food: 0.1, faction: { warriors: 5 } } },
  { id: 'kinship', name: 'Lazos de sangre', era: 0, desc: '+5 estabilidad y +0,3% crecimiento.', fx: { stability: 5, growth: 0.3 } },
  { id: 'wanderers', name: 'Espíritu nómada', era: 0, desc: 'Fronteras +40% más rápidas.', fx: { borders: 0.4 } },
  { id: 'stone_hands', name: 'Manos de piedra', era: 0, desc: '+20% piedra y madera.', fx: { stone: 0.2, wood: 0.2 } },
  { id: 'herbal_lore', name: 'Saber de las hierbas', era: 0, desc: '+2 salud.', fx: { health: 2 } },
  { id: 'feasts', name: 'Grandes banquetes', era: 1, desc: '+6 estabilidad, pero −5% comida.', fx: { stability: 6, food: -0.05 } },
  { id: 'smiths', name: 'Hermandad de herreros', era: 1, desc: '+20% metal y +10% fuerza militar.', fx: { metal: 0.2, military: 0.1 } },
  { id: 'river_gods', name: 'Dioses del río', era: 1, desc: '+10% comida y +5 aprobación del clero.', fx: { food: 0.1, faction: { clergy: 5 } } },
  { id: 'caravans', name: 'Tradición caravanera', era: 1, desc: '+30% comercio y +10 opinión ajena.', fx: { trade: 0.3, opinion: 10 } },
  { id: 'epic_poems', name: 'Poemas épicos', era: 1, desc: '+20% cultura y +1 legitimidad anual.', fx: { culture: 0.2, legitimacy: 1 } },
  { id: 'hospitality', name: 'Ley de hospitalidad', era: 2, desc: '+15 opinión de otras civilizaciones.', fx: { opinion: 15, influenceFlat: 1 } },
  { id: 'citizen_army', name: 'Ejército ciudadano', era: 2, desc: '+20% fuerza militar, +5 pueblo.', fx: { military: 0.2, faction: { commoners: 5 } } },
  { id: 'academies', name: 'Amor al saber', era: 2, desc: '+20% saber.', fx: { knowledge: 0.2 } },
  { id: 'coinage', name: 'Acuñación sagrada', era: 2, desc: '+15% oro, +5 clero.', fx: { gold: 0.15, faction: { clergy: 5 } } },
  { id: 'civic_pride', name: 'Orgullo cívico', era: 3, desc: '+8 estabilidad.', fx: { stability: 8 } },
  { id: 'roads', name: 'Todos los caminos', era: 3, desc: '+25% construcción y +15% comercio.', fx: { construction: 0.25, trade: 0.15 } },
  { id: 'hygiene', name: 'Higiene pública', era: 3, desc: '+3 salud, +0,3% crecimiento.', fx: { health: 3, growth: 0.3 } },
  { id: 'pilgrimage', name: 'Peregrinaciones', era: 3, desc: '+20% cultura, +3 oro anual.', fx: { culture: 0.2, goldFlat: 3 } },
  { id: 'chivalry', name: 'Caballería', era: 4, desc: '+25% fuerza militar, +10 guerreros.', fx: { military: 0.25, faction: { warriors: 10 } } },
  { id: 'scholastic', name: 'Escolástica', era: 4, desc: '+20% saber, +5 clero.', fx: { knowledge: 0.2, faction: { clergy: 5 } } },
  { id: 'fairs', name: 'Grandes ferias', era: 4, desc: '+25% oro y bienes.', fx: { gold: 0.25, goods: 0.1 } },
  { id: 'humanism', name: 'Humanismo', era: 5, desc: '+25% cultura y saber.', fx: { culture: 0.25, knowledge: 0.15 } },
  { id: 'exploration', name: 'Afán explorador', era: 5, desc: '+30% comercio, fronteras +30%.', fx: { trade: 0.3, borders: 0.3 } },
];
export const TRADITION: Record<string, TraditionDef> = Object.fromEntries(TRADITIONS.map((t) => [t.id, t]));

// Efectos globales de maravillas (además de su producción)
export const WONDER_FX: Record<string, ModFx> = {
  w_canal: { food: 0.15 },
  w_colossus: { trade: 0.2 },
  w_arena: {},
  w_library: { knowledge: 0.05 },
};
