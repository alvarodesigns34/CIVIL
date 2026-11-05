// Pueblos menores (ciudades-estado): se ganan con emisarios y regalos, y dan ventajas a sus amigos.
import type { Civ, GameState } from './types';
import { RNG } from '../core/rng';
import { capitalOf, civSettlements } from './world';
import { spawnUnit } from './military';
import { UNITS } from '../data/units';
import { civEra } from '../data/techs';

export const MINOR_INFO: Record<string, { name: string; friend: string; ally: string }> = {
  merchant: { name: 'Ciudad-estado mercantil', friend: '+3 oro al año', ally: '+8 oro al año y comparte sus lujos' },
  culture: { name: 'Ciudad-estado culta', friend: '+2 cultura al año', ally: '+6 cultura y +2 saber al año' },
  military: { name: 'Ciudad-estado guerrera', friend: 'Regala un regimiento cada 20 años', ally: 'Regala un regimiento cada 8 años, +10% fuerza' },
};
export const FRIEND = 30, ALLY = 60;

export function minorStanding(minor: Civ, civId: number): 'none' | 'friend' | 'ally' {
  const pts = minor.envoys?.[civId] ?? 0;
  if (pts < FRIEND) return 'none';
  if (pts >= ALLY) {
    // sólo el que más influye es aliado
    const top = Object.entries(minor.envoys ?? {}).sort((a, b) => b[1] - a[1])[0];
    if (top && +top[0] === civId) return 'ally';
  }
  return 'friend';
}

export function sendEnvoy(state: GameState, from: Civ, minor: Civ, kind: 'envoy' | 'gift'): string | null {
  if (kind === 'envoy') {
    if (from.res.influence < 10) return 'Necesitas 10 de influencia';
    from.res.influence -= 10;
    addPts(minor, from.id, 12);
  } else {
    const cost = 30 + civEra(from.techs) * 15;
    if (from.res.gold < cost) return `Necesitas ${cost} de oro`;
    from.res.gold -= cost;
    minor.res.gold += cost;
    addPts(minor, from.id, 18);
  }
  return null;
}
function addPts(minor: Civ, id: number, v: number) {
  minor.envoys ??= {};
  minor.envoys[id] = Math.min(120, (minor.envoys[id] ?? 0) + v);
}

export function yearlyMinors(state: GameState, rng: RNG) {
  for (const m of state.civs) {
    if (!m.alive || !m.minor) continue;
    m.envoys ??= {};
    for (const k of Object.keys(m.envoys)) {
      m.envoys[+k] *= 0.97;
      // la guerra con la ciudad-estado borra la amistad
      if (m.relations[+k]?.state === 'war') m.envoys[+k] = 0;
    }
    for (const c of state.civs) {
      if (!c.alive || c.minor || !m.relations[c.id]?.met) continue;
      const st = minorStanding(m, c.id);
      if (st === 'none') continue;
      const ally = st === 'ally';
      if (m.minor === 'merchant') c.res.gold += ally ? 8 : 3;
      if (m.minor === 'culture') { c.culturePts += ally ? 6 : 2; if (ally) c.knowledge += 2; }
      if (m.minor === 'military' && state.year % (ally ? 8 : 20) === 0) {
        const cap = capitalOf(state, c.id);
        if (cap) {
          const era = civEra(m.techs);
          const def = [...UNITS].filter((u) => u.id !== 'raiders' && !u.siege && u.era <= era && (!u.tech || m.techs.includes(u.tech))).sort((a, b) => b.atk - a.atk)[0];
          if (def) {
            spawnUnit(state, c.id, def.id, cap.col, cap.row, cap.id);
            if (c.isPlayer) state.chronicle.push({ year: state.year, civ: c.id, kind: 'diplo', important: true, text: `${m.name} os regaló un regimiento de ${def.name.toLowerCase()}.` });
          }
        }
      }
    }
  }
  // la IA también corteja a los pueblos menores
  for (const c of state.civs) {
    if (!c.alive || c.minor || c.isPlayer) continue;
    if (c.res.influence < 45 || !rng.chance(c.personality === 'merchant' || c.personality === 'peaceful' ? 0.25 : 0.12)) continue;
    const ms = state.civs.filter((m) => m.alive && m.minor && c.relations[m.id]?.met && c.relations[m.id].state !== 'war');
    if (ms.length) sendEnvoy(state, c, rng.pick(ms), 'envoy');
  }
}

export function minorsAlive(state: GameState) {
  return state.civs.filter((c) => c.alive && c.minor && civSettlements(state, c.id).length);
}
