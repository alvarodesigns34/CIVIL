// Ilustraciones vectoriales de edificios y asentamientos, cacheadas como sprites.
import { INK, shade } from './palette';
import { hash2 } from '../core/rng';

type G = CanvasRenderingContext2D;
const SPR_W = 84, SPR_H = 84, OX = 42, OY = 50;

const cache = new Map<string, HTMLCanvasElement>();
export function clearSpriteCache() {
  cache.clear();
}

export function getSprite(key: string, scale: number, draw: (g: G) => void): HTMLCanvasElement {
  const k = `${key}@${scale}`;
  let c = cache.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.ceil(SPR_W * scale);
  c.height = Math.ceil(SPR_H * scale);
  const g = c.getContext('2d')!;
  g.setTransform(scale, 0, 0, scale, OX * scale, OY * scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  cache.set(k, c);
  if (cache.size > 900) {
    const first = cache.keys().next().value!;
    cache.delete(first);
  }
  return c;
}
export function blitSprite(g: G, spr: HTMLCanvasElement, x: number, y: number, scale: number) {
  g.drawImage(spr, x - OX, y - OY, spr.width / scale, spr.height / scale);
}

// ── Primitivas
function shadow(g: G, x: number, y: number, w: number, h = 3) {
  g.fillStyle = 'rgba(30,22,12,0.25)';
  g.beginPath();
  g.ellipse(x + 2, y + 1, w, h, 0, 0, Math.PI * 2);
  g.fill();
}
function stroke(g: G, w = 1) {
  g.strokeStyle = INK;
  g.lineWidth = w;
  g.stroke();
}
// Casa en perspectiva caballera: fachada + tejado a dos aguas
function house(g: G, x: number, y: number, w: number, h: number, wall: string, roof: string, roofH = h * 0.7) {
  shadow(g, x, y, w * 0.7);
  g.fillStyle = wall;
  g.beginPath();
  g.rect(x - w / 2, y - h, w, h);
  g.fill();
  stroke(g, 0.8);
  g.fillStyle = shade(wall, -0.25);
  g.fillRect(x + w * 0.1, y - h, w * 0.4, h);
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - w / 2 - 1.5, y - h);
  g.lineTo(x - w * 0.15, y - h - roofH);
  g.lineTo(x + w / 2 + 1.5, y - h - roofH * 0.35);
  g.lineTo(x + w / 2 + 1.5, y - h);
  g.closePath();
  g.fill();
  stroke(g, 0.8);
  g.fillStyle = shade(roof, -0.25);
  g.beginPath();
  g.moveTo(x - w * 0.15, y - h - roofH);
  g.lineTo(x + w / 2 + 1.5, y - h - roofH * 0.35);
  g.lineTo(x + w / 2 + 1.5, y - h);
  g.lineTo(x - w * 0.05, y - h);
  g.closePath();
  g.fill();
  // puerta
  g.fillStyle = '#3b2a1c';
  g.fillRect(x - w * 0.3, y - h * 0.5, w * 0.18, h * 0.5);
}
function roundHut(g: G, x: number, y: number, r: number, wall = '#b08a5a', roof = '#9c7a3c') {
  shadow(g, x, y, r * 1.1);
  g.fillStyle = wall;
  g.beginPath();
  g.rect(x - r, y - r * 0.8, r * 2, r * 0.8);
  g.fill();
  stroke(g, 0.7);
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - r * 1.25, y - r * 0.7);
  g.lineTo(x, y - r * 2.1);
  g.lineTo(x + r * 1.25, y - r * 0.7);
  g.closePath();
  g.fill();
  stroke(g, 0.7);
  g.strokeStyle = 'rgba(60,40,15,0.5)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(x, y - r * 2.1);
  g.lineTo(x - r * 0.5, y - r * 0.75);
  g.moveTo(x, y - r * 2.1);
  g.lineTo(x + r * 0.5, y - r * 0.75);
  g.stroke();
  g.fillStyle = '#3b2a1c';
  g.fillRect(x - r * 0.25, y - r * 0.6, r * 0.5, r * 0.6);
}
function tent(g: G, x: number, y: number, r: number, cloth = '#c9b28a') {
  shadow(g, x, y, r);
  g.fillStyle = cloth;
  g.beginPath();
  g.moveTo(x - r, y);
  g.lineTo(x, y - r * 1.5);
  g.lineTo(x + r, y);
  g.closePath();
  g.fill();
  stroke(g, 0.8);
  g.fillStyle = shade(cloth, -0.3);
  g.beginPath();
  g.moveTo(x, y - r * 1.5);
  g.lineTo(x + r, y);
  g.lineTo(x + r * 0.2, y);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(x - r * 0.2, y - r * 1.8);
  g.lineTo(x, y - r * 1.5);
  g.lineTo(x + r * 0.25, y - r * 1.85);
  g.stroke();
}
function fire(g: G, x: number, y: number, s = 1) {
  g.fillStyle = '#e0892e';
  g.beginPath();
  g.moveTo(x - 2.5 * s, y);
  g.quadraticCurveTo(x, y - 7 * s, x + 2.5 * s, y);
  g.fill();
  g.fillStyle = '#f6d36b';
  g.beginPath();
  g.moveTo(x - 1.2 * s, y);
  g.quadraticCurveTo(x, y - 4 * s, x + 1.2 * s, y);
  g.fill();
  g.strokeStyle = '#4a3420';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x - 3 * s, y + 1);
  g.lineTo(x + 3 * s, y - 0.5);
  g.moveTo(x - 3 * s, y - 0.5);
  g.lineTo(x + 3 * s, y + 1);
  g.stroke();
}
export function flag(g: G, x: number, y: number, h: number, color: string, color2: string) {
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - h);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - h);
  g.lineTo(x + h * 0.55, y - h + h * 0.12);
  g.lineTo(x + h * 0.45, y - h + h * 0.22);
  g.lineTo(x + h * 0.55, y - h + h * 0.34);
  g.lineTo(x, y - h + h * 0.34);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.7;
  g.stroke();
  g.fillStyle = color2;
  g.fillRect(x + 1.5, y - h + h * 0.13, h * 0.12, h * 0.1);
}
function tower(g: G, x: number, y: number, w: number, h: number, wall: string, roof: string) {
  shadow(g, x, y, w * 0.7);
  g.fillStyle = wall;
  g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = shade(wall, -0.25);
  g.fillRect(x, y - h, w / 2, h);
  g.strokeStyle = INK;
  g.lineWidth = 0.8;
  g.strokeRect(x - w / 2, y - h, w, h);
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - w / 2 - 1.5, y - h);
  g.lineTo(x, y - h - w * 1.2);
  g.lineTo(x + w / 2 + 1.5, y - h);
  g.closePath();
  g.fill();
  stroke(g, 0.8);
  g.fillStyle = '#2b2119';
  g.fillRect(x - 1, y - h * 0.7, 2, 3);
}
function column(g: G, x: number, y: number, h: number, c = '#e8e0cc') {
  g.fillStyle = c;
  g.fillRect(x - 1.3, y - h, 2.6, h);
  g.strokeStyle = 'rgba(42,33,25,0.7)';
  g.lineWidth = 0.6;
  g.strokeRect(x - 1.3, y - h, 2.6, h);
}
function stoneBlock(g: G, x: number, y: number, w: number, h: number, c = '#c9c2b0') {
  g.fillStyle = c;
  g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = shade(c, -0.2);
  g.fillRect(x, y - h, w / 2, h);
  g.strokeStyle = INK;
  g.lineWidth = 0.7;
  g.strokeRect(x - w / 2, y - h, w, h);
}
function figure(g: G, x: number, y: number, c: string, s = 1) {
  g.fillStyle = c;
  g.fillRect(x - 1 * s, y - 4 * s, 2 * s, 4 * s);
  g.fillStyle = '#d8b48a';
  g.beginPath();
  g.arc(x, y - 5 * s, 1.1 * s, 0, Math.PI * 2);
  g.fill();
}

// Campo de cultivo con surcos; el color depende de la estación (0 primavera,1 verano,2 otoño,3 invierno)
function fieldPatch(g: G, x: number, y: number, w: number, h: number, angle: number, season: number, seed: number) {
  const cols = [['#8fb153', '#a3c262'], ['#d9b851', '#e6c866'], ['#b9874a', '#c9985a'], ['#a99a7c', '#b8aa8c']][season & 3];
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = cols[Math.abs(seed) % 2];
  g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = 'rgba(80,60,25,0.35)';
  g.lineWidth = 0.7;
  for (let i = -w / 2 + 2; i < w / 2; i += 3) {
    g.beginPath();
    g.moveTo(i, -h / 2);
    g.lineTo(i, h / 2);
    g.stroke();
  }
  g.strokeStyle = 'rgba(42,33,25,0.6)';
  g.lineWidth = 0.8;
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.restore();
}

export interface DrawOpts {
  color: string;
  color2: string;
  season: number;
  variant: number;
}

// ── Edificios
export const BUILDING_ART: Record<string, (g: G, o: DrawOpts) => void> = {
  hut: (g) => {
    roundHut(g, -10, -2, 6);
    roundHut(g, 9, -6, 5.5, '#a7804f', '#8f6f35');
    roundHut(g, 2, 9, 6.5);
  },
  house: (g) => {
    house(g, -11, -3, 11, 7, '#d9c7a0', '#a2492f');
    house(g, 9, -7, 10, 7, '#e0d0aa', '#b0563a');
    house(g, -2, 10, 12, 8, '#d4c096', '#9a432b');
    house(g, 14, 9, 9, 6, '#dccbaa', '#a2492f');
  },
  townhouse: (g) => {
    house(g, -12, -2, 11, 14, '#e2d3b2', '#7a3a2a');
    house(g, 1, -5, 10, 18, '#d6c4a0', '#86402d');
    house(g, 13, -1, 10, 13, '#e8dcc0', '#7a3a2a');
    house(g, -6, 13, 12, 12, '#dccbaa', '#8a4530');
    house(g, 9, 14, 10, 10, '#e2d3b2', '#7a3a2a');
  },
  hunters: (g) => {
    tent(g, -7, 2, 8, '#b59a72');
    tent(g, 10, -4, 6, '#a88b62');
    fire(g, 6, 9);
    // tendedero de pieles
    g.strokeStyle = INK;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-18, 10); g.lineTo(-18, 2); g.moveTo(-8, 12); g.lineTo(-8, 4); g.moveTo(-18, 3); g.lineTo(-8, 5);
    g.stroke();
    g.fillStyle = '#7b5537';
    g.fillRect(-16, 3.5, 3, 5);
    g.fillRect(-12, 4.2, 3, 4.5);
  },
  farm: (g, o) => {
    const a = (o.variant % 3) * 0.25 - 0.25;
    fieldPatch(g, -9, -6, 17, 14, a, o.season, o.variant);
    fieldPatch(g, 10, -4, 15, 15, a + 0.1, o.season, o.variant + 1);
    fieldPatch(g, 0, 11, 22, 12, a - 0.1, o.season, o.variant);
    if (o.season < 3) {
      g.fillStyle = '#c9a85a';
      g.strokeStyle = INK;
      g.lineWidth = 0.6;
      for (const [x, y] of [[-14, 12], [16, 10]]) {
        g.beginPath();
        g.moveTo(x - 2.5, y); g.lineTo(x, y - 5); g.lineTo(x + 2.5, y); g.closePath();
        g.fill(); g.stroke();
      }
    }
  },
  pasture: (g, o) => {
    g.strokeStyle = '#6a4c2d';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(0, 2, 22, 15, 0, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 22, 2 + Math.sin(a) * 15);
      g.lineTo(Math.cos(a) * 22, 2 + Math.sin(a) * 15 - 3);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const x = (hash2(i, o.variant, 1) - 0.5) * 30, y = 2 + (hash2(i, o.variant, 2) - 0.5) * 18;
      g.fillStyle = i % 3 === 0 ? '#5b4030' : '#efe8d8';
      g.beginPath();
      g.ellipse(x, y, 3, 2, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 0.5;
      g.stroke();
      g.fillStyle = '#2b2119';
      g.fillRect(x + 2.2, y - 1.6, 1.4, 1.4);
    }
  },
  fishery: (g) => {
    g.fillStyle = '#8a6440';
    g.fillRect(-20, -3, 22, 4);
    g.strokeStyle = INK;
    g.lineWidth = 0.7;
    g.strokeRect(-20, -3, 22, 4);
    for (const x of [-18, -10, -2]) { g.beginPath(); g.moveTo(x, 1); g.lineTo(x, 5); g.stroke(); }
    // barca
    g.fillStyle = '#6e4b2c';
    g.beginPath();
    g.moveTo(4, 8); g.quadraticCurveTo(12, 14, 20, 8); g.lineTo(4, 8);
    g.fill(); g.stroke();
    g.beginPath(); g.moveTo(12, 8); g.lineTo(12, -4); g.stroke();
    g.fillStyle = '#efe4c8';
    g.beginPath(); g.moveTo(12, -4); g.lineTo(18, 5); g.lineTo(12, 5); g.closePath(); g.fill(); g.stroke();
    // red
    g.strokeStyle = 'rgba(60,45,30,0.6)';
    g.beginPath();
    for (let i = 0; i < 5; i++) { g.moveTo(-14 + i * 3, -12); g.lineTo(-16 + i * 3, -4); }
    g.moveTo(-17, -10); g.lineTo(-2, -10); g.moveTo(-17, -7); g.lineTo(-3, -7);
    g.stroke();
  },
  granary: (g) => {
    for (const [x, y, r] of [[-8, 4, 6], [6, 0, 7], [2, 13, 5]] as const) {
      shadow(g, x, y, r);
      g.fillStyle = '#d6b47a';
      g.fillRect(x - r, y - r * 1.4, r * 2, r * 1.4);
      g.fillStyle = shade('#d6b47a', -0.2);
      g.fillRect(x, y - r * 1.4, r, r * 1.4);
      g.strokeStyle = INK;
      g.lineWidth = 0.8;
      g.strokeRect(x - r, y - r * 1.4, r * 2, r * 1.4);
      g.fillStyle = '#a8763a';
      g.beginPath();
      g.ellipse(x, y - r * 1.4, r, r * 0.9, 0, Math.PI, 0);
      g.fill();
      g.stroke();
    }
  },
  lumber: (g) => {
    for (const [x, y] of [[-12, 6], [10, 10], [14, -6]]) {
      g.fillStyle = '#9b7a4d';
      g.beginPath(); g.ellipse(x, y, 3.5, 2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
      g.fillStyle = '#d8bf8c'; g.beginPath(); g.ellipse(x, y - 1, 2.8, 1.4, 0, 0, Math.PI * 2); g.fill();
    }
    // pila de troncos
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3 - i; j++) {
        const x = -4 + j * 6 + i * 3, y = 2 - i * 4.5;
        g.fillStyle = '#7d5a35';
        g.fillRect(x - 10, y - 2.3, 10, 4.6);
        g.fillStyle = '#d9bf8a';
        g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = INK; g.lineWidth = 0.6; g.stroke();
      }
    // hacha
    g.strokeStyle = '#4a3420'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-14, -6); g.lineTo(-8, -14); g.stroke();
    g.fillStyle = '#8c949c'; g.beginPath(); g.moveTo(-9, -15); g.lineTo(-5, -14); g.lineTo(-7, -11); g.closePath(); g.fill();
  },
  quarry: (g) => {
    g.fillStyle = '#b8b09c';
    g.beginPath(); g.moveTo(-22, 8); g.lineTo(-14, -10); g.lineTo(16, -12); g.lineTo(22, 6); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    g.fillStyle = '#d8d2c2';
    g.beginPath(); g.moveTo(-14, -10); g.lineTo(16, -12); g.lineTo(12, -4); g.lineTo(-11, -3); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8f8775';
    g.beginPath(); g.moveTo(-11, -3); g.lineTo(12, -4); g.lineTo(10, 3); g.lineTo(-8, 4); g.closePath(); g.fill(); g.stroke();
    stoneBlock(g, -6, 14, 7, 5);
    stoneBlock(g, 3, 15, 6, 5);
    stoneBlock(g, -1, 10, 6, 4, '#d8d2c2');
    figure(g, 12, 13, '#7a5a3a');
  },
  mine: (g) => {
    g.fillStyle = '#8b7d64';
    g.beginPath(); g.moveTo(-22, 10); g.quadraticCurveTo(-4, -22, 22, 10); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#1f1812';
    g.beginPath(); g.moveTo(-6, 10); g.lineTo(-6, 0); g.quadraticCurveTo(0, -6, 6, 0); g.lineTo(6, 10); g.closePath(); g.fill();
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-7, 10); g.lineTo(-7, -1); g.lineTo(7, -1); g.lineTo(7, 10); g.stroke();
    // vagoneta
    g.fillStyle = '#5b4a3a'; g.fillRect(10, 8, 9, 5);
    g.fillStyle = '#b07a3a'; g.beginPath(); g.ellipse(14.5, 8, 4, 2, 0, Math.PI, 0); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.7; g.strokeRect(10, 8, 9, 5);
  },
  workshop: (g) => {
    house(g, -4, 6, 18, 10, '#cdb48a', '#6f5a3c');
    g.fillStyle = '#7a6a58'; g.fillRect(4, -14, 3.5, 8); g.strokeStyle = INK; g.lineWidth = 0.7; g.strokeRect(4, -14, 3.5, 8);
    // vasijas
    for (const [x, y, c] of [[12, 12, '#b5643a'], [16, 10, '#c97a45'], [-16, 12, '#a85a35']] as const) {
      g.fillStyle = c; g.beginPath(); g.ellipse(x, y - 2.5, 2.5, 3, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  },
  forge: (g) => {
    house(g, -2, 6, 20, 10, '#7a6d60', '#4a3b30');
    g.fillStyle = '#5a4f45'; g.fillRect(5, -14, 4, 9); g.strokeStyle = INK; g.lineWidth = 0.7; g.strokeRect(5, -14, 4, 9);
    g.fillStyle = '#f08a2a'; g.fillRect(-9, 0, 5, 5);
    g.fillStyle = '#3a3a3e'; g.fillRect(12, 8, 7, 3); g.fillRect(14, 11, 3, 3);
  },
  guild: (g, o) => {
    house(g, 0, 10, 30, 16, '#e1cfa6', '#7a3a2a', 12);
    tower(g, -14, 4, 7, 18, '#d6c49c', '#7a3a2a');
    flag(g, 13, -16, 12, o.color, o.color2);
  },
  shrine: (g) => {
    for (const [x, y, h] of [[-12, 4, 12], [12, 4, 12], [-7, -6, 10], [7, -6, 10]]) stoneBlock(g, x, y, 5, h, '#bdb6a3');
    g.fillStyle = '#a69f8c'; g.fillRect(-5, 6, 10, 5); g.strokeStyle = INK; g.strokeRect(-5, 6, 10, 5);
    fire(g, 0, 6, 0.8);
  },
  temple: (g) => {
    shadow(g, 0, 12, 22, 4);
    g.fillStyle = '#d9cfb6'; g.fillRect(-20, 6, 40, 6); g.fillRect(-16, 1, 32, 5);
    g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-20, 6, 40, 6); g.strokeRect(-16, 1, 32, 5);
    for (let x = -12; x <= 12; x += 6) column(g, x, 1, 14);
    g.fillStyle = '#b5563a';
    g.beginPath(); g.moveTo(-17, -13); g.lineTo(0, -24); g.lineTo(17, -13); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e8e0cc'; g.fillRect(-16, -14, 32, 2); g.strokeRect(-16, -14, 32, 2);
  },
  basilica: (g, o) => {
    house(g, 0, 12, 34, 16, '#e8dcc0', '#8a4530', 10);
    g.fillStyle = '#e8dcc0'; g.fillRect(-7, -14, 14, 12); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-7, -14, 14, 12);
    g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(0, -14, 8, Math.PI, 0); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -22); g.lineTo(0, -28); g.stroke();
    flag(g, 0, -28, 0.1, o.color, o.color2);
  },
  archive: (g) => {
    house(g, 0, 10, 24, 12, '#e3d6b4', '#6e5a3e', 8);
    // rollo
    g.fillStyle = '#efe3c2'; g.fillRect(12, 0, 9, 6); g.strokeStyle = INK; g.lineWidth = 0.6; g.strokeRect(12, 0, 9, 6);
    g.fillStyle = '#a58a5a'; g.beginPath(); g.arc(12, 3, 2, 0, Math.PI * 2); g.arc(21, 3, 2, 0, Math.PI * 2); g.fill();
  },
  academy: (g) => {
    shadow(g, 0, 12, 24, 4);
    g.fillStyle = '#e6dcc4'; g.fillRect(-22, 7, 44, 5); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-22, 7, 44, 5);
    for (let x = -18; x <= 18; x += 6) column(g, x, 7, 15, '#f0e8d6');
    g.fillStyle = '#6a7a8a'; g.fillRect(-22, -11, 44, 4); g.strokeRect(-22, -11, 44, 4);
    figure(g, -6, 16, '#6a4a8a'); figure(g, 2, 17, '#3a5a7a');
  },
  university: (g, o) => {
    house(g, -6, 12, 28, 16, '#d9c39a', '#5a3a2a', 9);
    tower(g, 14, 10, 9, 28, '#d2bb90', '#4a5a7a');
    flag(g, 14, -30, 10, o.color, o.color2);
  },
  observatory: (g) => {
    house(g, -4, 12, 20, 12, '#d9d0bd', '#6a6a6a', 6);
    g.fillStyle = '#9aa7ae'; g.beginPath(); g.arc(8, 0, 9, Math.PI, 0); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = '#3a3a3a'; g.save(); g.translate(8, -6); g.rotate(-0.7); g.fillRect(0, -1.5, 14, 3); g.restore();
  },
  monument: (g) => {
    stoneBlock(g, -7, 10, 5, 18, '#b8b19c');
    stoneBlock(g, 7, 10, 5, 18, '#b8b19c');
    stoneBlock(g, 0, -8, 20, 4, '#c6bfaa');
    stoneBlock(g, -16, 14, 4, 10, '#aaa38e');
    stoneBlock(g, 16, 14, 4, 11, '#aaa38e');
  },
  theater: (g) => {
    shadow(g, 0, 10, 24, 5);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#d8ccb0' : '#e6dcc2';
      g.beginPath(); g.ellipse(0, 4 - i * 2, 22 - i * 3.2, 13 - i * 2.2, 0, Math.PI, 0); g.fill();
      g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
    }
    g.fillStyle = '#b5563a'; g.fillRect(-10, 4, 20, 5); g.strokeRect(-10, 4, 20, 5);
  },
  aqueduct: (g) => {
    g.fillStyle = '#cdbf9f';
    g.fillRect(-24, -10, 48, 5);
    g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-24, -10, 48, 5);
    for (let x = -22; x <= 18; x += 10) {
      g.fillStyle = '#cdbf9f'; g.fillRect(x, -5, 4, 16); g.strokeRect(x, -5, 4, 16);
      g.beginPath(); g.arc(x + 9, -5, 5, 0, Math.PI); g.stroke();
    }
    g.fillStyle = '#6fa3b5'; g.fillRect(-24, -11, 48, 1.5);
  },
  baths: (g) => {
    house(g, -8, 6, 18, 11, '#e2d4b4', '#8a4530');
    g.fillStyle = '#7fb3c4'; g.fillRect(4, 4, 17, 9); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(4, 4, 17, 9);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(7, 7); g.lineTo(12, 7); g.moveTo(13, 10); g.lineTo(18, 10); g.stroke();
  },
  palace: (g, o) => {
    house(g, 0, 14, 34, 16, '#efe3c6', o.color, 10);
    tower(g, -19, 12, 8, 26, '#e6d8b8', o.color);
    tower(g, 19, 12, 8, 26, '#e6d8b8', o.color);
    flag(g, -19, -24, 10, o.color, o.color2);
    flag(g, 19, -24, 10, o.color, o.color2);
  },
  market: (g) => {
    const cols = ['#b4432a', '#2f6f6a', '#c9a23a', '#4a5a9a'];
    for (let i = 0; i < 4; i++) {
      const x = -15 + (i % 2) * 18 + (i > 1 ? 6 : 0), y = -2 + Math.floor(i / 2) * 14;
      shadow(g, x, y, 8);
      g.fillStyle = '#8a6440'; g.fillRect(x - 7, y - 4, 14, 4);
      g.fillStyle = cols[i];
      g.beginPath(); g.moveTo(x - 9, y - 7); g.lineTo(x, y - 12); g.lineTo(x + 9, y - 7); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
      g.strokeStyle = '#efe4c8'; g.beginPath(); g.moveTo(x - 4.5, y - 9.5); g.lineTo(x - 4.5, y - 7); g.moveTo(x + 4.5, y - 9.5); g.lineTo(x + 4.5, y - 7); g.stroke();
      g.fillStyle = ['#e0b050', '#9c3', '#d06030', '#efe'][i]; g.fillRect(x - 5, y - 5, 3, 2); g.fillRect(x + 1, y - 5, 3, 2);
    }
  },
  harbor: (g, o) => {
    g.fillStyle = '#8a6440';
    g.fillRect(-24, -8, 30, 5); g.fillRect(-4, -8, 5, 22);
    g.strokeStyle = INK; g.lineWidth = 0.7; g.strokeRect(-24, -8, 30, 5); g.strokeRect(-4, -8, 5, 22);
    // barco
    g.fillStyle = '#5e3f26';
    g.beginPath(); g.moveTo(5, 10); g.lineTo(23, 10); g.lineTo(20, 15); g.lineTo(8, 15); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(14, 10); g.lineTo(14, -10); g.stroke();
    g.fillStyle = '#efe4c8'; g.fillRect(9, -8, 10, 12); g.strokeRect(9, -8, 10, 12);
    g.fillStyle = o.color; g.fillRect(9, -2, 10, 2);
  },
  bank: (g) => {
    shadow(g, 0, 12, 20, 4);
    g.fillStyle = '#efe6cf'; g.fillRect(-18, -6, 36, 18); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-18, -6, 36, 18);
    for (let x = -14; x <= 14; x += 7) column(g, x, 12, 16, '#f6efdc');
    g.fillStyle = '#c9a23a'; g.beginPath(); g.moveTo(-20, -6); g.lineTo(0, -16); g.lineTo(20, -6); g.closePath(); g.fill(); g.stroke();
  },
  company: (g, o) => {
    house(g, -10, 8, 22, 14, '#c9b08a', '#5a4630', 8);
    g.fillStyle = '#5e3f26';
    g.beginPath(); g.moveTo(4, 14); g.lineTo(26, 14); g.lineTo(22, 20); g.lineTo(8, 20); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
    for (const x of [10, 19]) {
      g.beginPath(); g.moveTo(x, 14); g.lineTo(x, -8); g.stroke();
      g.fillStyle = '#efe4c8'; g.fillRect(x - 5, -6, 10, 8); g.strokeRect(x - 5, -6, 10, 8);
    }
    flag(g, 19, -8, 8, o.color, o.color2);
  },
  warcamp: (g, o) => {
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(0, 4, 21, 14, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 0.6;
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 21, 4 + Math.sin(a) * 14); g.lineTo(Math.cos(a) * 21, 4 + Math.sin(a) * 14 - 4); g.stroke(); }
    tent(g, -8, 6, 6, '#a88b62');
    tent(g, 7, 8, 6, '#b59a72');
    flag(g, 0, -2, 14, o.color, o.color2);
  },
  barracks: (g, o) => {
    shadow(g, 0, 12, 22, 4);
    g.fillStyle = '#b9ad94'; g.fillRect(-20, -4, 40, 16); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-20, -4, 40, 16);
    for (let x = -20; x < 20; x += 5) g.fillRect(x, -7, 3, 3);
    house(g, 0, 8, 20, 9, '#d8cbb0', o.color, 6);
    flag(g, 15, -6, 14, o.color, o.color2);
  },
  stables: (g, o) => {
    house(g, -6, 6, 24, 11, '#a8865a', '#6a4a2a', 9);
    for (const [x, y] of [[14, 12], [8, 16]]) {
      g.fillStyle = '#6b4a2a'; g.beginPath(); g.ellipse(x, y - 3, 4, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(x + 2.5, y - 7, 1.8, 4); g.fillRect(x - 3, y - 2, 1, 3); g.fillRect(x + 2, y - 2, 1, 3);
    }
    flag(g, -16, -8, 10, o.color, o.color2);
  },
  // ── Maravillas
  w_stones: (g) => {
    shadow(g, 0, 8, 26, 9);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * 22, y = 4 + Math.sin(a) * 12;
      if (Math.sin(a) < 0) stoneBlock(g, x, y, 4.5, 13, '#b8b19c');
    }
    stoneBlock(g, 0, 6, 8, 16, '#c6bfaa');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * 22, y = 4 + Math.sin(a) * 12;
      if (Math.sin(a) >= 0) stoneBlock(g, x, y, 4.5, 13, '#b8b19c');
    }
  },
  w_ziggurat: (g, o) => {
    shadow(g, 0, 14, 30, 5);
    const steps = [[32, 8], [24, 8], [16, 8], [9, 7]];
    let y = 14;
    for (const [w, h] of steps) {
      stoneBlock(g, 0, y, w * 1.4, h, '#d1b07a');
      y -= h;
    }
    g.fillStyle = '#8a5a3a'; g.fillRect(-2.5, 14, 5, -30);
    flag(g, 0, y, 12, o.color, o.color2);
  },
  w_library: (g, o) => {
    shadow(g, 0, 14, 30, 5);
    g.fillStyle = '#efe6cf'; g.fillRect(-28, -2, 56, 16); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-28, -2, 56, 16);
    for (let x = -24; x <= 24; x += 6) column(g, x, 14, 16, '#f7f0de');
    g.fillStyle = '#6a7a8a'; g.beginPath(); g.moveTo(-30, -2); g.lineTo(0, -16); g.lineTo(30, -2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#c9a23a'; g.beginPath(); g.arc(0, -7, 3, 0, Math.PI * 2); g.fill();
    flag(g, 0, -16, 10, o.color, o.color2);
  },
  w_colossus: (g) => {
    stoneBlock(g, 0, 16, 18, 6, '#a39b88');
    g.fillStyle = '#b5893a';
    g.beginPath();
    g.moveTo(-6, 10); g.lineTo(-3, -12); g.lineTo(3, -12); g.lineTo(6, 10); g.lineTo(2, 10); g.lineTo(0, -2); g.lineTo(-2, 10); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
    g.beginPath(); g.arc(0, -16, 4, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(3, -10); g.lineTo(12, -24); g.lineWidth = 2.4; g.strokeStyle = '#b5893a'; g.stroke();
    fire(g, 12, -24, 1);
  },
  w_canal: (g) => {
    g.fillStyle = '#c9bb98'; g.fillRect(-28, -6, 56, 14); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(-28, -6, 56, 14);
    g.fillStyle = '#5f97ab'; g.fillRect(-28, -2, 56, 6);
    g.fillStyle = '#6e4b2c'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(8, 0); g.lineTo(6, 3); g.lineTo(-4, 3); g.closePath(); g.fill();
    for (const x of [-20, 18]) tower(g, x, -6, 6, 10, '#d8cbb0', '#8a4530');
  },
  w_arena: (g, o) => {
    shadow(g, 0, 12, 30, 8);
    g.fillStyle = '#d9c8a4'; g.beginPath(); g.ellipse(0, 2, 28, 16, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    g.fillStyle = '#c9a982'; g.beginPath(); g.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#e8d8a8'; g.beginPath(); g.ellipse(0, 1, 11, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(42,33,25,0.5)';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 18, Math.sin(a) * 9); g.lineTo(Math.cos(a) * 28, 2 + Math.sin(a) * 16); g.stroke(); }
    flag(g, -24, -6, 10, o.color, o.color2);
  },
  w_cathedral: (g, o) => {
    shadow(g, 0, 14, 28, 5);
    house(g, 0, 14, 30, 18, '#e6dcc4', '#5a5a6a', 14);
    tower(g, -14, 14, 9, 36, '#e0d4b8', '#5a5a6a');
    tower(g, 14, 14, 9, 36, '#e0d4b8', '#5a5a6a');
    g.fillStyle = '#4a5a9a'; g.beginPath(); g.arc(0, 4, 4, 0, Math.PI * 2); g.fill();
    flag(g, -14, -33, 9, o.color, o.color2);
  },
  w_observatory: (g, o) => {
    tower(g, 0, 14, 16, 26, '#e0d6c0', '#7a8a96');
    g.fillStyle = '#9aa7ae'; g.beginPath(); g.arc(0, -12, 11, Math.PI, 0); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    g.fillStyle = '#3a3a3a'; g.save(); g.translate(0, -18); g.rotate(-0.8); g.fillRect(0, -2, 20, 4); g.restore();
    flag(g, -10, -2, 8, o.color, o.color2);
  },
};

// Asentamiento según su tamaño y fortificación
export function drawSettlement(g: G, tier: number, fort: number, color: string, color2: string, capital: boolean, variant: number) {
  if (tier === 0) {
    tent(g, -8, 2, 7, '#b59a72');
    tent(g, 8, -2, 6, '#c2a67c');
    tent(g, 2, 10, 6.5, '#a88b62');
    fire(g, -1, 4, 1.1);
  } else if (tier === 1) {
    roundHut(g, -12, 0, 6);
    roundHut(g, 12, -2, 6);
    house(g, 0, 4, 16, 8, '#c9a878', '#7d6235', 9);
    roundHut(g, -6, 13, 5.5);
    roundHut(g, 9, 13, 5.5);
  } else if (tier === 2) {
    house(g, -14, 0, 10, 8, '#d9c7a0', '#a2492f');
    house(g, 14, -2, 10, 8, '#e0d0aa', '#b0563a');
    house(g, 0, 2, 18, 12, '#e6d8b8', color, 10);
    house(g, -8, 14, 11, 8, '#d4c096', '#9a432b');
    house(g, 10, 14, 11, 8, '#dccbaa', '#a2492f');
  } else {
    const big = tier >= 4;
    house(g, -17, -2, 10, 12, '#e2d3b2', '#7a3a2a');
    house(g, 17, -4, 10, 13, '#d6c4a0', '#86402d');
    house(g, -9, 0, 9, 16, '#e8dcc0', '#7a3a2a');
    tower(g, 6, 2, 9, big ? 30 : 22, '#efe3c6', color);
    house(g, -14, 15, 12, 10, '#dccbaa', '#8a4530');
    house(g, 0, 16, 12, 12, '#e2d3b2', '#7a3a2a');
    house(g, 15, 15, 11, 10, '#e6d8b8', '#86402d');
    if (big) {
      g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(-4, -16, 6, Math.PI, 0); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = '#efe3c6'; g.fillRect(-10, -16, 12, 8); g.strokeRect(-10, -16, 12, 8);
    }
  }
  // murallas delante
  if (fort === 1) {
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.8;
    g.beginPath(); g.ellipse(0, 6, 27, 17, 0, 0.1, Math.PI - 0.1); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 0.6;
    for (let i = 0; i <= 14; i++) {
      const a = 0.15 + (i / 14) * (Math.PI - 0.3);
      const x = Math.cos(a) * 27, y = 6 + Math.sin(a) * 17;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 4); g.stroke();
    }
  } else if (fort >= 2) {
    const wc = fort === 3 ? '#b7ad98' : '#cfc5ad';
    g.strokeStyle = INK; g.lineWidth = 0.8;
    g.fillStyle = wc;
    for (let i = 0; i <= 16; i++) {
      const a = 0.12 + (i / 16) * (Math.PI - 0.24);
      const x = Math.cos(a) * 28, y = 8 + Math.sin(a) * 17;
      g.fillRect(x - 2.2, y - 5, 4.4, 5);
      g.strokeRect(x - 2.2, y - 5, 4.4, 5);
    }
    for (const a of [0.2, Math.PI / 2, Math.PI - 0.2]) {
      const x = Math.cos(a) * 28, y = 8 + Math.sin(a) * 17;
      tower(g, x, y + 2, fort === 3 ? 7 : 6, fort === 3 ? 13 : 9, wc, fort === 3 ? color : '#8a7a62');
    }
  }
  if (capital) flag(g, tier >= 3 ? 6 : 0, tier >= 3 ? (tier >= 4 ? -40 : -32) : -12, 12, color, color2);
  else flag(g, 16, -8, 9, color, color2);
  void variant;
}

export function settlementTier(pop: number) {
  return pop < 60 ? 0 : pop < 150 ? 1 : pop < 380 ? 2 : pop < 850 ? 3 : 4;
}

// Andamios de obra
export function drawScaffold(g: G) {
  g.strokeStyle = '#7a5a35';
  g.lineWidth = 1.3;
  g.beginPath();
  for (const x of [-12, 0, 12]) { g.moveTo(x, 10); g.lineTo(x, -12); }
  for (const y of [6, -3, -11]) { g.moveTo(-14, y); g.lineTo(14, y); }
  g.moveTo(-12, 10); g.lineTo(0, -3); g.moveTo(0, 10); g.lineTo(12, -3);
  g.stroke();
  stoneBlock(g, 16, 14, 6, 4, '#c9c2b0');
  stoneBlock(g, -17, 14, 7, 4, '#9b7a4d');
}
