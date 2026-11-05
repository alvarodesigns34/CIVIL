export const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
export function fmt(n: number) {
  if (Math.abs(n) >= 10000) return nf1.format(n / 1000) + ' k';
  return nf.format(Math.round(n));
}
export function sgn(n: number, digits = 0) {
  const v = digits ? Math.round(n * 10 ** digits) / 10 ** digits : Math.round(n);
  if (v === 0) return '±0';
  return (v > 0 ? '+' : '−') + (digits ? nf1.format(Math.abs(v)) : nf.format(Math.abs(v)));
}
export function pct(n: number) {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n * 100))}%`;
}
export function cls(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}
export function attitude(op: number) {
  if (op >= 50) return { t: 'Amistosa', c: 'good' };
  if (op >= 15) return { t: 'Cordial', c: 'good' };
  if (op > -15) return { t: 'Neutral', c: '' };
  if (op > -45) return { t: 'Recelosa', c: 'bad' };
  return { t: 'Hostil', c: 'bad' };
}
export const PERSONALITY_NAME: Record<string, string> = {
  aggressive: 'Belicosa', merchant: 'Mercantil', pious: 'Devota', expansionist: 'Expansionista', scholarly: 'Erudita', peaceful: 'Pacífica',
};
