import type { Biome } from '../sim/types';

export const BIOME_COLOR: Record<Biome, [string, string]> = {
  deep: ['#284c63', '#23455a'],
  ocean: ['#346178', '#2f5a70'],
  coast: ['#5a8e9b', '#4f8391'],
  lake: ['#5b91a0', '#4f8696'],
  grass: ['#8ea459', '#839a50'],
  plains: ['#bbb26a', '#aea660'],
  desert: ['#dfc68b', '#d4b97c'],
  tundra: ['#a5a68d', '#9a9b83'],
  snow: ['#e9eef0', '#dde5e8'],
};

export const INK = '#2a2119';
export const PARCHMENT = '#e8dbbb';
export const PARCHMENT_DARK = '#d6c59c';

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function mix(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const r = ((na >> 16) & 255) * (1 - t) + ((nb >> 16) & 255) * t;
  const g = ((na >> 8) & 255) * (1 - t) + ((nb >> 8) & 255) * t;
  const bl = (na & 255) * (1 - t) + (nb & 255) * t;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}

export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
