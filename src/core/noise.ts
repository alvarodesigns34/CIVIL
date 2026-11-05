// Ruido de valor/gradiente 2D sencillo con fBm, sembrado.
import { RNG } from './rng';

export class Noise2D {
  private perm: Uint8Array;
  constructor(seed: number) {
    const rng = new RNG(seed);
    const p = Array.from({ length: 256 }, (_, i) => i);
    rng.shuffle(p);
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  private grad(h: number, x: number, y: number) {
    switch (h & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  }
  noise(x: number, y: number): number {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const p = this.perm;
    const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
    const x1 = lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v) * 0.7071; // ~[-1,1]
  }
  fbm(x: number, y: number, oct = 5, lac = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lac;
    }
    return sum / norm;
  }
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
