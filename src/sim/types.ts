// Tipos centrales del estado de partida. Todo el estado es serializable (JSON).

export type ResId = 'food' | 'wood' | 'stone' | 'metal' | 'goods' | 'gold' | 'influence';
export type FlowId = 'knowledge' | 'culture';
export type YieldId = ResId | FlowId;
export const RES_IDS: ResId[] = ['food', 'wood', 'stone', 'metal', 'goods', 'gold', 'influence'];
export const YIELD_IDS: YieldId[] = [...RES_IDS, 'knowledge', 'culture'];

export type FactionId = 'commoners' | 'warriors' | 'clergy' | 'merchants' | 'scholars';
export const FACTION_IDS: FactionId[] = ['commoners', 'warriors', 'clergy', 'merchants', 'scholars'];

export type Biome = 'deep' | 'ocean' | 'coast' | 'lake' | 'grass' | 'plains' | 'desert' | 'tundra' | 'snow';
export type Feature = 'none' | 'forest' | 'marsh';
export type Elev = 0 | 1 | 2; // llano, colinas, montaña

export type DepositId =
  | 'wheat' | 'cattle' | 'deer' | 'fish'
  | 'copper' | 'iron' | 'horses' | 'marble'
  | 'gold' | 'gems' | 'spices' | 'wine' | 'incense' | 'furs' | 'salt' | 'pearls' | 'silk';

export interface BuildingInst {
  type: string;
  sid: number; // asentamiento al que pertenece
  progress: number; // 0..1; 1 = completo
  staff: number; // trabajadores asignados (calculado cada año)
  built: number; // año de finalización
  paused?: boolean; // el jugador ha retirado a los trabajadores
}

export interface Tile {
  biome: Biome;
  elev: Elev;
  feature: Feature;
  river: number; // caudal (0 = sin río)
  riverTo: number; // dirección 0..5 a la que fluye, -1 si desemboca/no hay
  dep: DepositId | null;
  owner: number; // id de civ, -1 libre
  sid: number; // asentamiento que la reclama, -1
  b: BuildingInst | null;
  road: number; // 0 sin camino, 1 sendero, 2 calzada
  ruin?: number; // año en que quedó en ruinas (asentamiento destruido)
}

export interface Settlement {
  id: number;
  name: string;
  civ: number;
  col: number;
  row: number;
  pop: number;
  founded: number;
  culture: number; // cultura acumulada local (expansión de fronteras)
  radius: number;
  capital: boolean;
  health: number; // -10..10 aprox (calculado)
  housing: number; // calculado
  growth: number; // crecimiento último año
  unrest: number; // 0..100 malestar local
  siege: number; // años bajo asedio
  workforce: number; // calculado
  jobs: number; // calculado
  employed: number; // calculado
  garrison: number; // soldados (calculado)
  defense: number; // calculado
  fort: number; // nivel de murallas 0..3
  loyalty: number; // 0..100 (asentamientos conquistados)
  origCiv: number; // civ fundadora
}

export interface Leader {
  name: string;
  title: string;
  age: number;
  traits: string[];
  legitimacy: number; // 0..100
  reignStart: number;
  dynasty: string;
  portrait: number; // semilla visual
}

export interface Relation {
  met: boolean;
  opinion: number; // -100..100
  state: 'peace' | 'war' | 'alliance';
  trade: boolean;
  since: number;
  truceUntil: number;
  warScore: number; // -100..100 desde la perspectiva de esta civ
  warStart: number;
  mods: { id: string; label: string; value: number; until: number }[];
  lastDemand: number;
}

export interface TimedModifier {
  id: string;
  name: string;
  until: number; // año en que expira (Infinity = permanente) — se guarda como 1e9
  fx: ModFx;
  good: boolean;
}

// Efectos agregables (políticas, rasgos, tecnologías, gobiernos, tradiciones, modificadores)
export interface ModFx {
  food?: number; wood?: number; stone?: number; metal?: number; goods?: number; gold?: number;
  influence?: number; knowledge?: number; culture?: number; // multiplicadores (+0.1 = +10%)
  foodFlat?: number; goldFlat?: number; influenceFlat?: number; knowledgeFlat?: number; cultureFlat?: number;
  growth?: number; // puntos porcentuales de crecimiento anual (+0.5 = +0.5%)
  health?: number;
  stability?: number;
  military?: number; // multiplicador fuerza
  construction?: number; // multiplicador velocidad de obra
  trade?: number; // multiplicador ingresos comerciales
  tax?: number; // multiplicador impuestos
  housing?: number; // multiplicador vivienda
  workforce?: number; // +% población activa
  upkeep?: number; // multiplicador mantenimiento
  legitimacy?: number; // puntos por año
  faction?: Partial<Record<FactionId, number>>; // aprobación objetivo
  opinion?: number; // opinión de otras civs
  borders?: number; // multiplicador crecimiento fronteras
  goodsDemand?: number; // multiplicador demanda de bienes
}

export interface Army {
  id: number;
  civ: number;
  target: number; // id asentamiento objetivo
  from: number; // id asentamiento origen
  strength: number;
  t: number; // progreso del trayecto 0..1
  kind: 'army' | 'raid';
}

export interface ChronicleEntry {
  year: number;
  text: string;
  kind: 'event' | 'war' | 'diplo' | 'tech' | 'build' | 'politics' | 'disaster' | 'culture' | 'world' | 'leader';
  civ: number; // -1 mundo
  important?: boolean;
}

export interface PendingEvent {
  uid: number;
  id: string;
  civ: number;
  sid: number; // asentamiento contexto
  other: number; // civ contexto (-1)
  data?: Record<string, number | string>;
}

export interface Civ {
  id: number;
  name: string; // "Reino de Kaledra"
  people: string; // "kaledrios"
  adjective: string;
  color: string;
  color2: string;
  emblem: number;
  culture: string; // estilo de nombres
  isPlayer: boolean;
  alive: boolean;
  personality: 'aggressive' | 'merchant' | 'pious' | 'expansionist' | 'scholarly' | 'peaceful';
  res: Record<ResId, number>;
  knowledge: number; // acumulado hacia la tecnología actual
  research: string | null;
  techs: string[];
  culturePts: number; // hacia la siguente tradición
  traditions: string[];
  traditionOffer: string[] | null;
  government: string;
  govChanged: number;
  policies: string[];
  factions: Record<FactionId, number>; // aprobación 0..100
  stability: number; // 0..100
  leader: Leader;
  heir: Leader | null;
  modifiers: TimedModifier[];
  relations: Record<number, Relation>;
  flags: Record<string, number>;
  warWeariness: number;
  soldiers: number; // calculado
  strength: number; // calculado
  legacy: number; // puntuación de legado
  ambitionsDone: string[];
  history: { y: number; pop: number; str: number; know: number }[];
  // última producción (para UI)
  ledger: Ledger;
  startCol: number;
  startRow: number;
  collapseYears: number;
}

export interface Ledger {
  income: Partial<Record<YieldId, Record<string, number>>>; // fuente -> cantidad
  expense: Partial<Record<YieldId, Record<string, number>>>;
  net: Record<YieldId, number>;
  foodNeed: number;
  goodsNeed: number;
  goodsMet: number; // 0..1
  luxuries: string[];
  luxuryTrade: string[];
  stabilityParts: Record<string, number>;
  factionTargets: Record<FactionId, number>;
  factionPower: Record<FactionId, number>;
  taxes: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  year: number; // años desde el inicio (año 1)
  calendarStart: number; // año de calendario de inicio (negativo = a.C.)
  width: number;
  height: number;
  tiles: Tile[];
  civs: Civ[];
  settlements: Settlement[];
  nextId: number;
  player: number;
  explored: string; // bitset base64 del jugador
  events: {
    pending: PendingEvent[];
    cooldown: Record<string, number>;
    fired: Record<string, number>; // id -> veces
    chains: { id: string; civ: number; year: number; sid: number; other: number; data?: Record<string, number | string> }[];
    lastYear: number;
  };
  chronicle: ChronicleEntry[];
  wonders: Record<string, number>; // maravilla -> civ id
  armies: Army[];
  scouts: { id: number; civ: number; col: number; row: number; path: [number, number][]; t: number }[];
  colonists: { id: number; civ: number; from: number; col: number; row: number; t: number; pop: number; name: string }[];
  difficulty: 'easy' | 'normal' | 'hard';
  gameOver: null | { won: boolean; reason: string; year: number };
  stats: { techsFirst: Record<string, number> };
  lastAutosave: number;
}
