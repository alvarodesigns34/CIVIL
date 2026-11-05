import type { Ledger, YieldId, FactionId } from './types';
import { YIELD_IDS, FACTION_IDS } from './types';

export function emptyLedger(): Ledger {
  return {
    income: {},
    expense: {},
    net: Object.fromEntries(YIELD_IDS.map((y) => [y, 0])) as Record<YieldId, number>,
    foodNeed: 0,
    goodsNeed: 0,
    goodsMet: 1,
    luxuries: [],
    luxuryTrade: [],
    stabilityParts: {},
    factionTargets: Object.fromEntries(FACTION_IDS.map((f) => [f, 50])) as Record<FactionId, number>,
    factionPower: Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as Record<FactionId, number>,
    taxes: 0,
  };
}

export function addIncome(l: Ledger, y: YieldId, src: string, v: number) {
  if (!v) return;
  const m = (l.income[y] ??= {});
  m[src] = (m[src] ?? 0) + v;
  l.net[y] += v;
}
export function addExpense(l: Ledger, y: YieldId, src: string, v: number) {
  if (!v) return;
  const m = (l.expense[y] ??= {});
  m[src] = (m[src] ?? 0) + v;
  l.net[y] -= v;
}
