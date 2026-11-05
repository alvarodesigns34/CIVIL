// Simulación sin interfaz para equilibrar la economía: el jugador también lo controla la IA.
import { generateWorld } from '../src/sim/worldgen';
import { yearTick, totalPop, rankings } from '../src/sim/game';
import { aiYear } from '../src/sim/ai';
import { RNG } from '../src/core/rng';
import { EVENT, makeCtx, getChoices, choiceAvailable, applyChoice } from '../src/sim/events';
import { civEra } from '../src/data/techs';

declare const process: any;
const seed = Number(process.argv[2] ?? 12345);
const years = Number(process.argv[3] ?? 400);
const state = generateWorld({ seed, size: 'normal', civs: 5, civName: 'Prueba', colorIndex: 0, emblem: 0, culture: 'river', difficulty: 'normal' });
const p = state.civs[0];
const t0 = Date.now();
for (let y = 0; y < years && !state.gameOver; y++) {
  const rng = new RNG(state.rng + 17);
  aiYear(state, p, rng);
  if (p.traditionOffer) { p.traditions.push(p.traditionOffer[0]); p.traditionOffer = null; }
  // Resolver eventos del jugador automáticamente
  for (const pe of state.events.pending.splice(0)) {
    const def = EVENT[pe.id];
    const ctx = makeCtx(state, state.civs[pe.civ], pe.sid, pe.other, pe.data ?? {});
    const ch = getChoices(def, ctx).filter((c) => choiceAvailable(c, ctx));
    if (ch.length) applyChoice(state, ctx, ch[0], rng);
  }
  yearTick(state);
  if (state.year % 25 === 0) {
    const line = state.civs.map((c) => `${c.name.slice(0, 8).padEnd(8)} ${c.alive ? '' : '✝'}p${Math.round(totalPop(state, c))} e${civEra(c.techs)} t${c.techs.length} s${state.settlements.filter((s) => s.civ === c.id).length} st${Math.round(c.stability)} f${Math.round(c.res.food)} g${Math.round(c.res.gold)} k${c.ledger.net.knowledge.toFixed(1)} m${c.strength}`).join(' | ');
    console.log(`Año ${state.year}: ${line}`);
  }
}
console.log('Tiempo', Date.now() - t0, 'ms');
console.log('Fin:', state.gameOver);
console.log(rankings(state).map((r) => `${r.civ.name}: ${r.score}`).join(', '));
const wars = state.chronicle.filter((c) => c.kind === 'war').length;
console.log('Entradas de crónica', state.chronicle.length, 'guerra', wars, 'maravillas', JSON.stringify(state.wonders));
import { civSettlements as cs2, tilesOfSettlement as ts2 } from '../src/sim/world';
for (const c of state.civs) { const ss = cs2(state, c.id); const b: Record<string, number> = {}; for (const s of ss) for (const [, , t] of ts2(state, s)) if (t.b) b[t.b.type] = (b[t.b.type] ?? 0) + 1;
  console.log(c.name, c.personality, 'pop', ss.map((s) => `${Math.round(s.pop)}/${s.housing} wf${Math.round(s.workforce)} emp${Math.round(s.employed)} jobs${s.jobs}`).join(' '), JSON.stringify(b), 'net', JSON.stringify(Object.fromEntries(Object.entries(c.ledger.net).map(([k, v]) => [k, Math.round(v)]))), 'res', JSON.stringify(Object.fromEntries(Object.entries(c.res).map(([k, v]) => [k, Math.round(v)])))); }
console.log(state.chronicle.slice(-15).map((c) => `${c.year}: ${c.text}`).join('\n'));
const pc = state.civs[0];
console.log('Ledger jugador', JSON.stringify(pc.ledger.net), 'stab parts', JSON.stringify(pc.ledger.stabilityParts));
console.log('Facciones', JSON.stringify(pc.factions), 'gob', pc.government, pc.policies);
