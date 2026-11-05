// Esquema de eventos narrativos. Los efectos son datos para poder previsualizarlos en la UI.
import type { Civ, FactionId, GameState, ModFx, ResId, Settlement, YieldId } from './types';

export type EventCategory =
  | 'disaster' | 'society' | 'politics' | 'religion' | 'discovery' | 'economy'
  | 'diplomacy' | 'war' | 'leader' | 'nature' | 'culture';

// Clave de ilustración (se dibuja proceduralmente)
export type ArtKey =
  | 'famine' | 'plague' | 'fire' | 'flood' | 'earthquake' | 'storm' | 'comet' | 'festival'
  | 'council' | 'crown' | 'temple' | 'scroll' | 'market' | 'caravan' | 'ship' | 'battle'
  | 'army' | 'envoy' | 'birth' | 'death' | 'harvest' | 'mine' | 'forest' | 'mountain'
  | 'riot' | 'stars' | 'beast' | 'ruins' | 'wedding' | 'drought';

export interface EventCtx {
  state: GameState;
  civ: Civ;
  s: Settlement; // asentamiento de contexto (capital u otro elegido)
  other: Civ | null; // otra civilización conocida (si la hay)
  data: Record<string, number | string>;
  // Ayudas
  era: number;
  year: number;
  has: (tech: string) => boolean;
  res: (r: ResId) => number;
  net: (r: YieldId) => number; // producción neta del último año
  pop: () => number; // población total
  settlements: () => number;
  stability: () => number;
  faction: (f: FactionId) => number; // aprobación 0..100
  atWar: () => boolean;
  gov: () => string;
  policy: (id: string) => boolean;
  trait: (id: string) => boolean; // rasgo del líder
  flag: (name: string) => number; // 0 si no existe
  count: (buildingId: string) => number; // edificios completos de ese tipo
  leaderAge: () => number;
  luxuries: () => number;
  soldiers: () => number;
  health: () => number; // salud media
  foodNeed: () => number; // consumo anual de comida
  coastal: () => boolean;
  river: () => boolean;
}

export type Effect =
  | { t: 'res'; r: ResId; v: number; scale?: 'pop' | 'era' } // pop: v por cada 100 habitantes; era: v*(1+era)
  | { t: 'knowledge'; v: number } // fracción del coste de la investigación actual (0.25 = 25%)
  | { t: 'culture'; v: number } // fracción hacia la próxima tradición
  | { t: 'pop'; v: number; where?: 'ctx' | 'all' } // fracción (−0.1 = −10%)
  | { t: 'faction'; f: FactionId; v: number }
  | { t: 'stability'; v: number }
  | { t: 'legitimacy'; v: number }
  | { t: 'mod'; id: string; name: string; years: number; fx: ModFx } // modificador temporal
  | { t: 'opinion'; v: number; who?: 'other' | 'all'; label?: string }
  | { t: 'war'; who?: 'other' } // la otra civ nos declara/le declaramos la guerra
  | { t: 'peace'; who?: 'other' }
  | { t: 'trait'; add?: string; remove?: string } // rasgo del líder
  | { t: 'leaderAge'; v: number } // envejece/rejuvenece (salud)
  | { t: 'killLeader' } // el líder muere (provoca sucesión)
  | { t: 'flag'; name: string; v?: number } // marca persistente (v por defecto 1)
  | { t: 'chain'; id: string; years: number } // evento que ocurrirá en N años
  | { t: 'destroy'; cat?: string } // destruye un edificio del asentamiento contexto (categoría opcional)
  | { t: 'unrest'; v: number } // malestar local en el asentamiento de contexto
  | { t: 'warScore'; v: number } // sólo en guerra con 'other'
  | { t: 'chance'; p: number; then: Effect[]; else?: Effect[]; label?: string } // efecto con riesgo
  | { t: 'text'; v: string } // línea narrativa extra en el resultado
  | { t: 'custom'; label: string; run: (c: EventCtx) => void }; // efectos de sistema (sucesiones, tratados)

export interface EventChoice {
  label: string;
  hint?: string; // explicación breve de las intenciones
  req?: (c: EventCtx) => boolean; // disponible solo si...
  reqText?: string; // por qué no está disponible
  cost?: Partial<Record<ResId, number>>;
  fx: Effect[];
  log?: string; // línea para la crónica, admite marcadores
  ai?: number; // peso para la IA (por defecto 1)
}

export interface EventDef {
  id: string;
  title: string;
  cat: EventCategory;
  art: ArtKey;
  weight: number; // peso base (1 = normal)
  minEra?: number;
  maxEra?: number;
  cooldown?: number; // años antes de poder repetirse (por defecto 40)
  once?: boolean;
  chainOnly?: boolean; // solo se dispara por cadena
  playerOnly?: boolean;
  cond?: (c: EventCtx) => boolean;
  ctxSettlement?: 'capital' | 'random' | 'largest' | 'smallest' | 'coastal' | 'frontier';
  needsOther?: boolean; // requiere otra civ conocida
  text: string; // admite marcadores: {civ} {people} {settlement} {other} {otherPeople} {leader} {title} {otherLeader} {year}
  choices: EventChoice[];
  // Eventos de sistema: texto y opciones generados dinámicamente
  build?: (c: EventCtx) => { text?: string; title?: string; choices?: EventChoice[] };
}
