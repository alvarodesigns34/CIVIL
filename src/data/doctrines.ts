import type { ModFx, GameState } from '../sim/types';
import type { EventDef } from '../sim/eventTypes';
import { RNG } from '../core/rng';
import { capitalOf } from '../sim/world';

export interface DoctrineDef { id: string; name: string; desc: string; fx: ModFx; spread?: number }
export const DOCTRINES: DoctrineDef[] = [
  { id: 'sun', name: 'Sol invicto', desc: '+15% cultura y +3 estabilidad.', fx: { culture: 0.15, stability: 3 } },
  { id: 'earth', name: 'Madre tierra', desc: '+10% comida y +0,2% crecimiento.', fx: { food: 0.1, growth: 0.2 } },
  { id: 'war', name: 'Dios de la guerra', desc: '+15% fuerza militar, +6 guerreros.', fx: { military: 0.15, faction: { warriors: 6 } } },
  { id: 'trade', name: 'Comercio sagrado', desc: '+10% oro y +15% comercio.', fx: { gold: 0.1, trade: 0.15 } },
  { id: 'ascetic', name: 'Ascetismo', desc: '+10% saber y +1 salud.', fx: { knowledge: 0.1, health: 1 } },
  { id: 'mission', name: 'Proselitismo', desc: 'La fe se difunde un 60% más rápido.', fx: {}, spread: 0.6 },
  { id: 'tolerant', name: 'Tolerancia divina', desc: '+10 opinión ajena; otras fes no restan estabilidad.', fx: { opinion: 10 } },
  { id: 'temple', name: 'Templos grandiosos', desc: '+25% de influencia y +6 clero.', fx: { influence: 0.25, faction: { clergy: 6 } } },
];
export const DOCTRINE: Record<string, DoctrineDef> = Object.fromEntries(DOCTRINES.map((d) => [d.id, d]));


// Eventos de fundación y reforma (aquí para evitar dependencias circulares)
function rels(state: GameState) {
  return ((state as any).religions ??= []) as { founder: number; name: string; doctrines: string[]; year: number }[];
}
function offer(seed: number, exclude: string[], n: number) {
  const rng = new RNG(seed);
  return rng.shuffle(DOCTRINES.filter((d) => !exclude.includes(d.id))).slice(0, n);
}
export const RELIGION_EVENTS: EventDef[] = [
  {
    id: 'sys_religion', title: 'Nace una fe', cat: 'religion', art: 'temple', weight: 0, chainOnly: true, text: '', choices: [],
    build: (c) => {
      const name = String(c.data.name ?? 'la Fe');
      return {
        title: `Nace la ${name}`,
        text: `Los sacerdotes de ${c.civ.name} han reunido mitos, ritos y profecías en una sola fe: la ${name}. Predicará en nuestras ciudades y más allá de nuestras fronteras. ¿Cuál será su corazón?`,
        choices: offer(Number(c.data.seed ?? 1), [], 3).map((d) => ({
          label: d.name, hint: d.desc, ai: 1,
          fx: [{ t: 'custom' as const, label: `Fundar la ${name} con «${d.name}»`, run: (k) => {
            rels(k.state).push({ founder: k.civ.id, name, doctrines: [d.id], year: k.year });
            const cap = capitalOf(k.state, k.civ.id);
            if (cap) { cap.religion = k.civ.id; cap.relPressure = { [k.civ.id]: 40 }; }
            k.civ.legacy += 25;
            k.state.chronicle.push({ year: k.year, civ: k.civ.id, kind: 'culture', important: true, text: `Los ${k.civ.people} fundaron la ${name}.` });
          } }, { t: 'faction' as const, f: 'clergy' as const, v: 12 }],
        })),
      };
    },
  },
  {
    id: 'sys_reform', title: 'Concilio religioso', cat: 'religion', art: 'council', weight: 0, chainOnly: true, text: '', choices: [],
    build: (c) => {
      const r = rels(c.state).find((x) => x.founder === c.civ.id);
      return {
        text: `Los sacerdotes de la ${r?.name ?? 'fe'} se reúnen en concilio. La fe ha crecido y necesita una segunda doctrina que la guíe.`,
        choices: offer(Number(c.data.seed ?? 2), r?.doctrines ?? [], 3).map((d) => ({
          label: d.name, hint: d.desc, ai: 1,
          fx: [{ t: 'custom' as const, label: `Añadir «${d.name}»`, run: () => { if (r) r.doctrines.push(d.id); } }, { t: 'faction' as const, f: 'clergy' as const, v: 6 }],
        })),
      };
    },
  },
];
