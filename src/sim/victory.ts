// Condiciones de victoria y su progreso.
import type { Civ, GameState } from './types';
import { civSettlements } from './world';
import { minorStanding, minorsAlive } from './minors';
import { TECH } from '../data/techs';

export const CULTURE_GOAL = 32000;
export const DIPLO_YEARS = 15;

export interface VictoryProgress { id: string; name: string; desc: string; v: number; max: number }

export function victoryProgress(state: GameState, civ: Civ): VictoryProgress[] {
  const majors = state.civs.filter((c) => !c.minor);
  const capitals = state.settlements.filter((s) => s.origCapital);
  const owned = capitals.filter((s) => s.civ === civ.id).length;
  const allies = majors.filter((o) => o.alive && o.id !== civ.id && civ.relations[o.id]?.state === 'alliance').length;
  const aliveOthers = majors.filter((o) => o.alive && o.id !== civ.id).length;
  const ms = minorsAlive(state);
  const minorAllies = ms.filter((m) => minorStanding(m, civ.id) !== 'none').length;
  const wonders = Object.values(state.wonders).filter((x) => x === civ.id).length;
  const sciTotal = Object.keys(TECH).length;
  return [
    { id: 'science', name: 'Científica', desc: 'Construir la primera máquina de vapor.', v: civ.techs.length, max: sciTotal },
    { id: 'culture', name: 'Cultural', desc: `Acumular ${CULTURE_GOAL.toLocaleString('es-ES')} de cultura y poseer 4 maravillas.`, v: Math.min(CULTURE_GOAL, civ.cultureTotal ?? 0) * (wonders >= 4 ? 1 : 0.95), max: CULTURE_GOAL },
    { id: 'domination', name: 'Dominación', desc: 'Controlar todas las capitales originales de los grandes pueblos.', v: owned, max: Math.max(1, capitals.length) },
    { id: 'diplomacy', name: 'Diplomática', desc: `Ser aliado de todos los grandes pueblos vivos y amigo de la mitad de las ciudades-estado durante ${DIPLO_YEARS} años.`, v: Math.min(DIPLO_YEARS, civ.flags.diploYears ?? 0), max: DIPLO_YEARS },
    { id: 'diploNow', name: '', desc: '', v: allies + (ms.length ? minorAllies / ms.length : 1), max: aliveOthers + 1 },
  ];
}

export function checkVictories(state: GameState) {
  if (state.gameOver) return;
  for (const civ of state.civs) {
    if (!civ.alive || civ.minor) continue;
    const majors = state.civs.filter((c) => !c.minor && c.alive && c.id !== civ.id);
    // diplomática: contar años seguidos cumpliendo
    const ms = minorsAlive(state);
    const okDiplo = majors.length >= 1 && majors.every((o) => civ.relations[o.id]?.state === 'alliance') && ms.filter((m) => minorStanding(m, civ.id) !== 'none').length >= Math.ceil(ms.length / 2);
    civ.flags.diploYears = okDiplo ? (civ.flags.diploYears ?? 0) + 1 : 0;
    const capitals = state.settlements.filter((s) => s.origCapital);
    const wonders = Object.values(state.wonders).filter((x) => x === civ.id).length;
    let won: string | null = null;
    if ((civ.cultureTotal ?? 0) >= CULTURE_GOAL && wonders >= 4) won = 'cultural';
    else if (capitals.length > 1 && capitals.every((s) => s.civ === civ.id)) won = 'por dominación';
    else if ((civ.flags.diploYears ?? 0) >= DIPLO_YEARS) won = 'diplomática';
    if (won) {
      civ.legacy += 200;
      state.chronicle.push({ year: state.year, civ: -1, kind: 'world', important: true, text: `Los ${civ.people} lograron una victoria ${won}.` });
      state.gameOver = civ.isPlayer
        ? { won: true, reason: `Has logrado una victoria ${won}.`, year: state.year }
        : { won: false, reason: `Los ${civ.people} han logrado una victoria ${won}.`, year: state.year };
      return;
    }
  }
}

export function civPop(state: GameState, civ: Civ) {
  return civSettlements(state, civ.id).reduce((a, s) => a + s.pop, 0);
}
