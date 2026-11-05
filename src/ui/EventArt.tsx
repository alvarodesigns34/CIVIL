// Ilustraciones procedurales para los eventos: siluetas de tinta sobre cielos pintados.
import { useEffect, useRef } from 'preact/hooks';
import type { ArtKey } from '../sim/eventTypes';

type G = CanvasRenderingContext2D;
const INK = '#1e1610';

interface Mood { sky: [string, string, string]; ground: string; light: 'sun' | 'moon' | 'none' | 'red'; }
const MOODS: Record<string, Mood> = {
  warm: { sky: ['#f2c27a', '#e08a52', '#8a4a3a'], ground: '#3a2a1e', light: 'sun' },
  calm: { sky: ['#e8dcb4', '#b9c9b4', '#7a9a9a'], ground: '#33402e', light: 'sun' },
  night: { sky: ['#2a3550', '#1b2338', '#0e1220'], ground: '#0c0f16', light: 'moon' },
  dread: { sky: ['#8a7a6a', '#5a4a44', '#2a2422'], ground: '#1a1512', light: 'none' },
  fire: { sky: ['#f0a050', '#c04a2a', '#3a1a12'], ground: '#1a0e0a', light: 'red' },
  sea: { sky: ['#c9dbe0', '#7fa6b8', '#3a5a72'], ground: '#21384a', light: 'sun' },
  gold: { sky: ['#f6e2a0', '#e2b45a', '#9a6a3a'], ground: '#3a2a18', light: 'sun' },
  storm: { sky: ['#6a7480', '#3a4450', '#1a2028'], ground: '#121820', light: 'none' },
};

const ART_MOOD: Record<ArtKey, keyof typeof MOODS> = {
  famine: 'dread', plague: 'dread', fire: 'fire', flood: 'storm', earthquake: 'dread', storm: 'storm', comet: 'night', festival: 'night',
  council: 'warm', crown: 'gold', temple: 'gold', scroll: 'calm', market: 'warm', caravan: 'warm', ship: 'sea', battle: 'fire',
  army: 'dread', envoy: 'calm', birth: 'calm', death: 'night', harvest: 'gold', mine: 'dread', forest: 'calm', mountain: 'calm',
  riot: 'fire', stars: 'night', beast: 'night', ruins: 'warm', wedding: 'gold', drought: 'warm',
};

export function EventArt({ art, seed = 1 }: { art: ArtKey; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 560, h = c.clientHeight || 170;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(g, w, h, art, seed);
  }, [art, seed]);
  return <canvas ref={ref} />;
}

function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function paint(g: G, w: number, h: number, art: ArtKey, seed: number) {
  const m = MOODS[ART_MOOD[art] ?? 'calm'];
  const r = rnd(seed * 97 + art.length * 13);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, m.sky[2]);
  sky.addColorStop(0.55, m.sky[1]);
  sky.addColorStop(1, m.sky[0]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // grano
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,240,210,${r() * 0.05})`;
    g.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
  // astro
  const lx = w * (0.65 + r() * 0.2), ly = h * 0.35;
  if (m.light === 'sun' || m.light === 'red') {
    const grd = g.createRadialGradient(lx, ly, 4, lx, ly, 90);
    grd.addColorStop(0, m.light === 'red' ? 'rgba(255,200,120,0.9)' : 'rgba(255,245,210,0.95)');
    grd.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = m.light === 'red' ? '#ffd08a' : '#fff4d6';
    g.beginPath(); g.arc(lx, ly, 18, 0, Math.PI * 2); g.fill();
  } else if (m.light === 'moon') {
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.6})`;
      g.fillRect(r() * w, r() * h * 0.7, 1.3, 1.3);
    }
    g.fillStyle = '#f2ead0';
    g.beginPath(); g.arc(lx, ly, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = m.sky[2];
    g.beginPath(); g.arc(lx + 6, ly - 3, 12, 0, Math.PI * 2); g.fill();
  }
  // colinas lejanas
  g.fillStyle = 'rgba(30,22,16,0.35)';
  g.beginPath();
  g.moveTo(0, h * 0.72);
  for (let x = 0; x <= w; x += 20) g.lineTo(x, h * 0.66 + Math.sin(x * 0.012 + seed) * 10 + r() * 5);
  g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
  // suelo
  g.fillStyle = m.ground;
  g.beginPath();
  g.moveTo(0, h * 0.82);
  for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.8 + Math.sin(x * 0.02 + seed * 2) * 4);
  g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
  const gy = h * 0.82;
  const cx = w * 0.42;
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  switch (art) {
    case 'famine': case 'drought':
      deadTree(g, cx - 60, gy, 1.2);
      for (let i = 0; i < 5; i++) crack(g, cx + i * 40 - 20, gy + 8, r);
      vulture(g, w * 0.7, h * 0.25); vulture(g, w * 0.78, h * 0.32);
      if (art === 'famine') { figure(g, cx + 40, gy, 1.1, true); figure(g, cx + 60, gy, 0.8, true); }
      break;
    case 'plague':
      houses(g, cx - 80, gy, 4, r);
      figure(g, cx + 70, gy, 1.2, true); figure(g, cx + 95, gy, 1.2);
      g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 120, gy); g.lineTo(cx + 120, gy - 40); g.moveTo(cx + 110, gy - 30); g.lineTo(cx + 130, gy - 30); g.stroke();
      break;
    case 'fire': case 'riot':
      houses(g, cx - 90, gy, 5, r);
      for (let i = 0; i < 6; i++) flame(g, cx - 80 + i * 32 + r() * 10, gy - 30 - r() * 20, 0.8 + r() * 0.8);
      if (art === 'riot') for (let i = 0; i < 6; i++) { figure(g, cx - 40 + i * 22, gy + 4, 1); torch(g, cx - 36 + i * 22, gy - 26); }
      break;
    case 'flood': case 'storm':
      houses(g, cx - 40, gy, 3, r);
      rain(g, w, h, r);
      waves(g, w, gy - 4, 4);
      if (art === 'storm') lightning(g, w * 0.7, 10, gy - 30);
      break;
    case 'earthquake':
      ruinsCols(g, cx - 40, gy, r);
      for (let i = 0; i < 4; i++) crack(g, cx - 60 + i * 50, gy + 6, r);
      break;
    case 'comet': case 'stars':
      if (art === 'comet') comet(g, w * 0.25, h * 0.22);
      figure(g, cx, gy, 1.3); figure(g, cx + 26, gy, 1.1);
      g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 4, gy - 32); g.lineTo(w * 0.25, h * 0.25); g.stroke();
      break;
    case 'festival': case 'wedding':
      for (let i = 0; i < 7; i++) lantern(g, 40 + i * (w - 80) / 6, 30 + Math.sin(i) * 10);
      g.lineWidth = 1; g.beginPath(); g.moveTo(30, 28); for (let i = 0; i < 7; i++) g.lineTo(40 + i * (w - 80) / 6, 26 + Math.sin(i) * 10); g.stroke();
      fireBig(g, cx + 40, gy);
      for (let i = 0; i < 6; i++) figure(g, cx - 60 + i * 26 + (i > 2 ? 60 : 0), gy, 0.9 + r() * 0.3, false, i % 2 ? 1 : -1);
      break;
    case 'council':
      fireBig(g, cx, gy);
      for (let i = 0; i < 7; i++) figure(g, cx - 90 + i * 30 + (i > 2 ? 30 : 0), gy, 1.1, true);
      break;
    case 'crown':
      crown(g, cx + 20, h * 0.48, 2.2);
      break;
    case 'temple':
      templeSil(g, cx, gy);
      figure(g, cx - 120, gy, 1); figure(g, cx + 120, gy, 1);
      break;
    case 'scroll':
      scroll(g, cx + 20, h * 0.5);
      break;
    case 'market': case 'caravan':
      if (art === 'market') for (let i = 0; i < 4; i++) stall(g, 50 + i * (w - 100) / 3, gy);
      else for (let i = 0; i < 4; i++) camel(g, cx - 100 + i * 60, gy, i === 0);
      break;
    case 'ship':
      waves(g, w, gy - 10, 3);
      shipSil(g, cx + 20, gy - 12);
      break;
    case 'battle': case 'army':
      for (let i = 0; i < 9; i++) soldier(g, cx - 140 + i * 34, gy, r);
      banner(g, cx - 120, gy - 50); banner(g, cx + 140, gy - 50);
      break;
    case 'envoy':
      figure(g, cx - 30, gy, 1.3); figure(g, cx + 30, gy, 1.3, false, -1);
      banner(g, cx - 60, gy - 40); banner(g, cx + 60, gy - 40);
      break;
    case 'birth':
      houses(g, cx - 40, gy, 2, r);
      figure(g, cx + 70, gy, 1.2); g.beginPath(); g.ellipse(cx + 70, gy - 28, 7, 4, 0, 0, Math.PI * 2); g.fill();
      break;
    case 'death':
      grave(g, cx, gy); grave(g, cx + 50, gy); grave(g, cx - 60, gy);
      deadTree(g, cx + 140, gy, 1);
      break;
    case 'harvest':
      for (let i = 0; i < 18; i++) wheat(g, 20 + i * (w - 40) / 17, gy, r);
      figure(g, cx + 60, gy, 1.2); g.lineWidth = 2; g.beginPath(); g.arc(cx + 72, gy - 30, 10, Math.PI, Math.PI * 1.7); g.stroke();
      break;
    case 'mine': case 'mountain':
      mountainSil(g, cx, gy, w);
      if (art === 'mine') { g.fillStyle = '#0a0705'; g.beginPath(); g.arc(cx, gy, 18, Math.PI, 0); g.fill(); torch(g, cx - 26, gy - 20); }
      break;
    case 'forest': case 'beast':
      for (let i = 0; i < 9; i++) pine(g, 20 + i * (w - 40) / 8 + r() * 10, gy, 1 + r() * 0.6);
      if (art === 'beast') wolf(g, cx + 30, gy);
      break;
    case 'ruins':
      ruinsCols(g, cx - 30, gy, r);
      figure(g, cx + 110, gy, 1.2);
      break;
  }
  // viñeta
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}

function figure(g: G, x: number, y: number, s: number, hood = false, dir = 1) {
  g.beginPath();
  g.moveTo(x - 7 * s, y);
  g.lineTo(x - 4 * s, y - 22 * s);
  g.lineTo(x + 4 * s, y - 22 * s);
  g.lineTo(x + 7 * s, y);
  g.closePath();
  g.fill();
  g.beginPath(); g.arc(x, y - 27 * s, 5 * s, 0, Math.PI * 2); g.fill();
  if (hood) { g.beginPath(); g.moveTo(x - 6 * s, y - 24 * s); g.lineTo(x, y - 36 * s); g.lineTo(x + 6 * s, y - 24 * s); g.fill(); }
  g.lineWidth = 2.4 * s;
  g.beginPath(); g.moveTo(x + 3 * dir * s, y - 18 * s); g.lineTo(x + 11 * dir * s, y - 10 * s); g.stroke();
}
function houses(g: G, x: number, y: number, n: number, r: () => number) {
  for (let i = 0; i < n; i++) {
    const hx = x + i * 38, w = 30 + r() * 8, hh = 22 + r() * 12;
    g.fillRect(hx, y - hh, w, hh);
    g.beginPath(); g.moveTo(hx - 4, y - hh); g.lineTo(hx + w / 2, y - hh - 16); g.lineTo(hx + w + 4, y - hh); g.closePath(); g.fill();
  }
}
function deadTree(g: G, x: number, y: number, s: number) {
  g.lineWidth = 5 * s;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 60 * s); g.stroke();
  g.lineWidth = 2.5 * s;
  g.beginPath();
  g.moveTo(x, y - 40 * s); g.lineTo(x - 22 * s, y - 62 * s);
  g.moveTo(x, y - 50 * s); g.lineTo(x + 18 * s, y - 72 * s);
  g.moveTo(x - 12 * s, y - 52 * s); g.lineTo(x - 14 * s, y - 70 * s);
  g.stroke();
}
function crack(g: G, x: number, y: number, r: () => number) {
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.beginPath(); g.moveTo(x, y);
  let cx = x, cy = y;
  for (let i = 0; i < 4; i++) { cx += 6 + r() * 6; cy += (r() - 0.5) * 8; g.lineTo(cx, cy); }
  g.stroke(); g.strokeStyle = INK;
}
function vulture(g: G, x: number, y: number) {
  g.lineWidth = 2; g.beginPath(); g.moveTo(x - 12, y); g.quadraticCurveTo(x - 6, y - 6, x, y); g.quadraticCurveTo(x + 6, y - 6, x + 12, y); g.stroke();
}
function flame(g: G, x: number, y: number, s: number) {
  g.fillStyle = 'rgba(255,170,60,0.9)';
  g.beginPath(); g.moveTo(x - 10 * s, y + 20 * s); g.quadraticCurveTo(x - 12 * s, y - 4 * s, x, y - 24 * s); g.quadraticCurveTo(x + 12 * s, y - 4 * s, x + 10 * s, y + 20 * s); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,230,140,0.9)';
  g.beginPath(); g.moveTo(x - 5 * s, y + 18 * s); g.quadraticCurveTo(x - 6 * s, y + 4 * s, x, y - 8 * s); g.quadraticCurveTo(x + 6 * s, y + 4 * s, x + 5 * s, y + 18 * s); g.closePath(); g.fill();
  g.fillStyle = INK;
}
function fireBig(g: G, x: number, y: number) {
  flame(g, x, y - 22, 1);
  g.lineWidth = 4; g.beginPath(); g.moveTo(x - 16, y); g.lineTo(x + 16, y - 6); g.moveTo(x - 16, y - 6); g.lineTo(x + 16, y); g.stroke();
}
function torch(g: G, x: number, y: number) {
  g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 14); g.lineTo(x, y); g.stroke();
  flame(g, x, y - 6, 0.35);
}
function rain(g: G, w: number, h: number, r: () => number) {
  g.strokeStyle = 'rgba(200,215,230,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 120; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 12); g.stroke(); }
  g.strokeStyle = INK;
}
function waves(g: G, w: number, y: number, n: number) {
  g.fillStyle = '#1d3346';
  g.fillRect(0, y, w, 200);
  g.strokeStyle = 'rgba(220,235,240,0.5)'; g.lineWidth = 1.6;
  for (let k = 0; k < n; k++) {
    g.beginPath();
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + 6 + k * 10 + Math.sin(x * 0.08 + k) * 3);
    g.stroke();
  }
  g.fillStyle = INK; g.strokeStyle = INK;
}
function lightning(g: G, x: number, y0: number, y1: number) {
  g.strokeStyle = '#fff8d0'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(x, y0); g.lineTo(x - 10, (y0 + y1) / 2); g.lineTo(x + 6, (y0 + y1) / 2 + 4); g.lineTo(x - 6, y1); g.stroke();
  g.strokeStyle = INK;
}
function ruinsCols(g: G, x: number, y: number, r: () => number) {
  for (let i = 0; i < 5; i++) {
    const hh = 30 + r() * 50;
    g.fillRect(x + i * 30, y - hh, 12, hh);
    g.fillRect(x + i * 30 - 3, y - hh - 4, 18, 5);
  }
  g.fillRect(x - 6, y - 4, 150, 6);
  g.save(); g.translate(x + 160, y - 4); g.rotate(-0.3); g.fillRect(0, 0, 40, 10); g.restore();
}
function comet(g: G, x: number, y: number) {
  const grd = g.createLinearGradient(x - 120, y - 50, x, y);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(1, 'rgba(255,250,220,0.9)');
  g.strokeStyle = grd; g.lineWidth = 6;
  g.beginPath(); g.moveTo(x - 120, y - 50); g.lineTo(x, y); g.stroke();
  g.fillStyle = '#fffbe6'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.fillStyle = INK;
}
function lantern(g: G, x: number, y: number) {
  g.fillStyle = 'rgba(255,190,90,0.95)';
  g.beginPath(); g.ellipse(x, y + 8, 6, 8, 0, 0, Math.PI * 2); g.fill();
  const grd = g.createRadialGradient(x, y + 8, 2, x, y + 8, 26);
  grd.addColorStop(0, 'rgba(255,200,110,0.4)'); grd.addColorStop(1, 'rgba(255,200,110,0)');
  g.fillStyle = grd; g.fillRect(x - 26, y - 18, 52, 52);
  g.fillStyle = INK;
}
function crown(g: G, x: number, y: number, s: number) {
  g.fillStyle = '#d6a836';
  g.beginPath();
  g.moveTo(x - 30 * s, y + 14 * s); g.lineTo(x - 34 * s, y - 14 * s); g.lineTo(x - 16 * s, y); g.lineTo(x, y - 22 * s); g.lineTo(x + 16 * s, y); g.lineTo(x + 34 * s, y - 14 * s); g.lineTo(x + 30 * s, y + 14 * s); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#b4432a'; g.beginPath(); g.arc(x, y + 4 * s, 4 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = INK;
}
function templeSil(g: G, x: number, y: number) {
  g.fillRect(x - 70, y - 8, 140, 8);
  g.fillRect(x - 62, y - 14, 124, 6);
  for (let i = 0; i < 6; i++) g.fillRect(x - 54 + i * 21, y - 56, 8, 42);
  g.fillRect(x - 64, y - 62, 128, 6);
  g.beginPath(); g.moveTo(x - 66, y - 62); g.lineTo(x, y - 88); g.lineTo(x + 66, y - 62); g.closePath(); g.fill();
}
function scroll(g: G, x: number, y: number) {
  g.fillStyle = '#efe2c0';
  g.fillRect(x - 70, y - 28, 140, 56);
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x - 70, y - 28, 140, 56);
  g.fillStyle = '#c9b48a';
  g.beginPath(); g.ellipse(x - 70, y, 8, 30, 0, 0, Math.PI * 2); g.ellipse(x + 70, y, 8, 30, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(42,33,25,0.6)'; g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x - 50, y - 14 + i * 9); g.lineTo(x + 40 - (i % 2) * 20, y - 14 + i * 9); g.stroke(); }
  g.strokeStyle = INK; g.fillStyle = INK;
}
function stall(g: G, x: number, y: number) {
  g.fillRect(x - 24, y - 20, 48, 20);
  g.fillStyle = '#b4432a';
  g.beginPath(); g.moveTo(x - 30, y - 22); g.lineTo(x, y - 40); g.lineTo(x + 30, y - 22); g.closePath(); g.fill();
  g.fillStyle = INK;
  figure(g, x + 36, y, 0.9);
}
function camel(g: G, x: number, y: number, lead: boolean) {
  g.beginPath(); g.ellipse(x, y - 24, 18, 9, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(x - 4, y - 32, 8, 7, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(x - 12, y - 18); g.lineTo(x - 12, y); g.moveTo(x + 12, y - 18); g.lineTo(x + 12, y); g.moveTo(x + 16, y - 26); g.lineTo(x + 26, y - 40); g.stroke();
  g.beginPath(); g.ellipse(x + 28, y - 41, 5, 3, 0, 0, Math.PI * 2); g.fill();
  if (lead) figure(g, x + 44, y, 0.9);
}
function shipSil(g: G, x: number, y: number) {
  g.beginPath(); g.moveTo(x - 60, y); g.lineTo(x + 60, y); g.lineTo(x + 46, y + 18); g.lineTo(x - 46, y + 18); g.closePath(); g.fill();
  g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 80); g.stroke();
  g.fillStyle = '#efe2c0';
  g.beginPath(); g.moveTo(x - 36, y - 74); g.quadraticCurveTo(x - 30, y - 40, x - 36, y - 8); g.lineTo(x + 36, y - 8); g.quadraticCurveTo(x + 42, y - 40, x + 36, y - 74); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#b4432a'; g.fillRect(x - 36, y - 46, 72, 8);
  g.fillStyle = INK;
}
function soldier(g: G, x: number, y: number, r: () => number) {
  figure(g, x, y, 1);
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(x + 8, y + 2); g.lineTo(x + 8 + r() * 4, y - 52); g.stroke();
  g.beginPath(); g.moveTo(x + 8, y - 52); g.lineTo(x + 5, y - 46); g.lineTo(x + 11, y - 46); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(x - 6, y - 14, 6, 9, 0, 0, Math.PI * 2); g.fill();
}
function banner(g: G, x: number, y: number) {
  g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y + 50); g.lineTo(x, y - 20); g.stroke();
  g.fillStyle = '#b4432a';
  g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 30, y - 16); g.lineTo(x + 24, y - 6); g.lineTo(x + 30, y + 4); g.lineTo(x, y + 2); g.closePath(); g.fill();
  g.fillStyle = INK;
}
function grave(g: G, x: number, y: number) {
  g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 10, y - 26); g.arc(x, y - 26, 10, Math.PI, 0); g.lineTo(x + 10, y); g.closePath(); g.fill();
}
function wheat(g: G, x: number, y: number, r: () => number) {
  const hh = 30 + r() * 20;
  g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - hh / 2, x + 2, y - hh); g.stroke();
  g.fillStyle = '#d9a83a';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x + 2, y - hh + i * 5, 2.5, 4, 0.3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = INK;
}
function mountainSil(g: G, x: number, y: number, w: number) {
  g.beginPath(); g.moveTo(x - 200, y); g.lineTo(x - 60, y - 100); g.lineTo(x + 10, y - 60); g.lineTo(x + 90, y - 120); g.lineTo(x + 240, y); g.closePath(); g.fill();
  g.fillStyle = '#e8e4d8';
  g.beginPath(); g.moveTo(x + 90, y - 120); g.lineTo(x + 72, y - 96); g.lineTo(x + 92, y - 100); g.lineTo(x + 106, y - 92); g.closePath(); g.fill();
  g.fillStyle = INK;
  void w;
}
function pine(g: G, x: number, y: number, s: number) {
  g.beginPath(); g.moveTo(x, y - 60 * s); g.lineTo(x + 16 * s, y - 10 * s); g.lineTo(x - 16 * s, y - 10 * s); g.closePath(); g.fill();
  g.fillRect(x - 2 * s, y - 12 * s, 4 * s, 12 * s);
}
function wolf(g: G, x: number, y: number) {
  g.beginPath(); g.ellipse(x, y - 16, 22, 9, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(x + 16, y - 20); g.lineTo(x + 30, y - 32); g.lineTo(x + 36, y - 22); g.lineTo(x + 26, y - 14); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x + 28, y - 30); g.lineTo(x + 30, y - 40); g.lineTo(x + 33, y - 30); g.fill();
  g.lineWidth = 3; g.beginPath(); g.moveTo(x - 14, y - 10); g.lineTo(x - 16, y); g.moveTo(x + 12, y - 10); g.lineTo(x + 14, y); g.moveTo(x - 20, y - 18); g.lineTo(x - 34, y - 24); g.stroke();
  g.fillStyle = '#f0d060'; g.beginPath(); g.arc(x + 30, y - 26, 1.6, 0, Math.PI * 2); g.fill(); g.fillStyle = INK;
}
