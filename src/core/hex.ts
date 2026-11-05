// Rejilla hexagonal "pointy-top" con coordenadas offset impares (odd-r).
export const HEX_SIZE = 32; // radio en píxeles de mundo
export const HEX_W = Math.sqrt(3) * HEX_SIZE;
export const HEX_H = 2 * HEX_SIZE;
export const ROW_H = HEX_H * 0.75;

export function hexToPixel(col: number, row: number): [number, number] {
  const x = HEX_W * (col + 0.5 * (row & 1)) + HEX_W / 2;
  const y = ROW_H * row + HEX_SIZE;
  return [x, y];
}

function offsetToCube(col: number, row: number): [number, number, number] {
  const q = col - (row - (row & 1)) / 2;
  const r = row;
  return [q, r, -q - r];
}
function cubeToOffset(q: number, r: number): [number, number] {
  const col = q + (r - (r & 1)) / 2;
  return [col, r];
}
function cubeRound(q: number, r: number, s: number): [number, number, number] {
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  else rs = -rq - rr;
  return [rq, rr, rs];
}

export function pixelToHex(px: number, py: number): [number, number] {
  const x = px - HEX_W / 2;
  const y = py - HEX_SIZE;
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / HEX_SIZE;
  const r = ((2 / 3) * y) / HEX_SIZE;
  const [cq, cr] = cubeRound(q, r, -q - r);
  return cubeToOffset(cq, cr);
}

export function hexDistance(c1: number, r1: number, c2: number, r2: number): number {
  const [q1, rr1, s1] = offsetToCube(c1, r1);
  const [q2, rr2, s2] = offsetToCube(c2, r2);
  return Math.max(Math.abs(q1 - q2), Math.abs(rr1 - rr2), Math.abs(s1 - s2));
}

// Vecinos en orden: E, NE, NW, W, SW, SE
const EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
export function neighbors(col: number, row: number): [number, number][] {
  const d = row & 1 ? ODD : EVEN;
  return d.map(([dc, dr]) => [col + dc, row + dr] as [number, number]);
}
export function neighborDir(col: number, row: number, dir: number): [number, number] {
  const d = (row & 1 ? ODD : EVEN)[dir];
  return [col + d[0], row + d[1]];
}

export function hexCorners(cx: number, cy: number, size = HEX_SIZE): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    out.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return out;
}

// Esquinas que comparte el borde en la dirección dada (para fronteras)
// dirección 0=E: esquinas 0 y 1 (con ángulo -30 y 30)
export const DIR_EDGE: [number, number][] = [
  [0, 1], // E  (corners at -30°, 30°)
  [5, 0], // NE (-90, -30)
  [4, 5], // NW (-150,-90)
  [3, 4], // W
  [2, 3], // SW
  [1, 2], // SE
];

export function hexesInRange(col: number, row: number, radius: number): [number, number][] {
  const out: [number, number][] = [];
  const [q0, r0] = offsetToCube(col, row);
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      out.push(cubeToOffset(q0 + dq, r0 + dr));
    }
  }
  return out;
}
