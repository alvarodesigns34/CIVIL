// Miniaturas ilustradas de edificios (mismo arte que el mapa), cacheadas como imágenes.
import { BUILDING_ART, drawSettlement } from '../render/sprites';
import { BUILDING } from '../data/buildings';
import { hexPath } from '../render/terrain';

const cache = new Map<string, string>();

const GROUND: Record<string, string> = {
  food: '#a6b766', materials: '#a59c74', housing: '#b9b07a', craft: '#b7a77c', faith: '#c2b38a', knowledge: '#b3b08f', civic: '#b9b07a', trade: '#a9b48a', military: '#a8a07a', wonder: '#c9b77e',
};

export function thumbURL(id: string, color: string, color2: string, size = 128): string {
  const key = `${id}|${color}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const k = size / 84;
  g.setTransform(k, 0, 0, k, size / 2, size / 2 + 4 * k);
  const def = BUILDING[id];
  const water = id === 'fishery' || id === 'harbor' || id === 'company' || id === 'w_colossus';
  hexPath(g, 0, 2, 34);
  const grd = g.createRadialGradient(0, 0, 4, 0, 2, 38);
  grd.addColorStop(0, water ? '#7fb0bd' : '#d4c79a');
  grd.addColorStop(1, water ? '#4f8391' : GROUND[def?.cat ?? 'civic'] ?? '#b9b07a');
  g.fillStyle = grd;
  g.fill();
  g.strokeStyle = 'rgba(42,33,25,0.45)';
  g.lineWidth = 1.2;
  g.stroke();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.scale(1.22, 1.22);
  g.translate(0, -2);
  if (id.startsWith('settlement')) drawSettlement(g, Number(id.split(':')[1] ?? 2), 0, color, color2, true, 0);
  else BUILDING_ART[id]?.(g, { color, color2, season: 1, variant: 2 });
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function Thumb({ id, color, color2, size = 56 }: { id: string; color: string; color2: string; size?: number }) {
  return <img class="thumb" src={thumbURL(id, color, color2)} width={size} height={size} alt="" draggable={false} />;
}
