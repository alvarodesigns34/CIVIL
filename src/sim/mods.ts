import type { Civ, GameState, ModFx, FactionId } from './types';
import { TECH } from '../data/techs';
import { GOV, POLICY, TRADITION, TRAIT, WONDER_FX } from '../data/politics';
import { CULTURE_TRAIT, SPEC } from './cities';

export interface FxSource {
  label: string;
  fx: ModFx;
}

export function fxSources(state: GameState, civ: Civ): FxSource[] {
  const out: FxSource[] = [];
  for (const t of civ.techs) {
    const d = TECH[t];
    if (d?.fx) out.push({ label: d.name, fx: d.fx });
  }
  const g = GOV[civ.government];
  if (g) out.push({ label: g.name, fx: g.fx });
  for (const p of civ.policies) {
    const d = POLICY[p];
    if (d) out.push({ label: d.name, fx: d.fx });
  }
  for (const t of civ.traditions) {
    const d = TRADITION[t];
    if (d) out.push({ label: d.name, fx: d.fx });
  }
  for (const t of civ.leader.traits) {
    const d = TRAIT[t];
    if (d) out.push({ label: `${civ.leader.name} (${d.name})`, fx: d.fx });
  }
  for (const m of civ.modifiers) out.push({ label: m.name, fx: m.fx });
  for (const [w, owner] of Object.entries(state.wonders)) {
    if (owner === civ.id && WONDER_FX[w]) out.push({ label: 'Maravilla', fx: WONDER_FX[w] });
  }
  // Rasgo de la cultura
  const ct = CULTURE_TRAIT[civ.culture];
  if (ct) out.push({ label: ct.name, fx: ct.fx });
  // Especializaciones con efecto general
  for (const st of state.settlements) if (st.civ === civ.id && st.spec && SPEC[st.spec]?.fx) out.push({ label: `${st.name} (${SPEC[st.spec].name})`, fx: SPEC[st.spec].fx! });
  // Herramientas: con bienes de sobra, todo el mundo trabaja mejor
  if (civ.ledger.goodsNeed > 0 && civ.ledger.goodsMet >= 0.95) out.push({ label: 'Herramientas abundantes', fx: { food: 0.05, wood: 0.05, stone: 0.05, metal: 0.05, construction: 0.1 } });
  // Estado de ánimo general
  if (civ.stability >= 75) out.push({ label: 'Edad dorada', fx: { culture: 0.15, knowledge: 0.1, growth: 0.2 } });
  else if (civ.stability < 15) out.push({ label: 'Caos', fx: { food: -0.1, wood: -0.25, stone: -0.25, metal: -0.25, goods: -0.25, gold: -0.25, knowledge: -0.25, culture: -0.25, military: -0.2 } });
  else if (civ.stability < 30) out.push({ label: 'Disturbios', fx: { food: -0.04, wood: -0.12, stone: -0.12, metal: -0.12, goods: -0.12, gold: -0.12, knowledge: -0.12, culture: -0.12 } });
  // Dificultad
  if (!civ.isPlayer && state.difficulty === 'hard') out.push({ label: 'Dificultad', fx: { food: 0.1, knowledge: 0.15, military: 0.15, construction: 0.15 } });
  if (!civ.isPlayer && state.difficulty === 'easy') out.push({ label: 'Dificultad', fx: { knowledge: -0.15, military: -0.15 } });
  return out;
}

export function sumFx(list: FxSource[]): Required<Omit<ModFx, 'faction'>> & { faction: Record<FactionId, number> } {
  const r: any = { faction: { commoners: 0, warriors: 0, clergy: 0, merchants: 0, scholars: 0 } };
  for (const { fx } of list) {
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'faction') {
        for (const [f, fv] of Object.entries(v as Record<string, number>)) r.faction[f] = (r.faction[f] ?? 0) + fv;
      } else r[k] = (r[k] ?? 0) + (v as number);
    }
  }
  const keys = ['food', 'wood', 'stone', 'metal', 'goods', 'gold', 'influence', 'knowledge', 'culture', 'foodFlat', 'goldFlat', 'influenceFlat', 'knowledgeFlat', 'cultureFlat', 'growth', 'health', 'stability', 'military', 'construction', 'trade', 'tax', 'housing', 'workforce', 'upkeep', 'legitimacy', 'opinion', 'borders', 'goodsDemand'];
  for (const k of keys) r[k] ??= 0;
  return r;
}

export type Fx = ReturnType<typeof sumFx>;

export function civFx(state: GameState, civ: Civ): Fx {
  return sumFx(fxSources(state, civ));
}

// Fuentes que afectan a una clave concreta (para tooltips)
export function fxBreakdown(state: GameState, civ: Civ, key: keyof ModFx): { label: string; v: number }[] {
  return fxSources(state, civ)
    .map((s) => ({ label: s.label, v: (s.fx[key] as number) ?? 0 }))
    .filter((x) => x.v);
}
