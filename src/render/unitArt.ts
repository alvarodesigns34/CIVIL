// Dibujo de regimientos: tres figuras con el arma de su tipo y un estandarte.
import type { UnitGlyph } from '../data/units';

type G = CanvasRenderingContext2D;
const INK = '#2a2119';
const SKIN = '#d9b48c';

function soldier(g: G, x: number, y: number, color: string, glyph: UnitGlyph, step: number, s = 1) {
  const leg = Math.sin(step) * 1.2 * s;
  // piernas
  g.strokeStyle = '#3b2a1c';
  g.lineWidth = 1.1 * s;
  g.beginPath();
  g.moveTo(x - 0.8 * s, y - 2.5 * s); g.lineTo(x - 0.8 * s + leg, y);
  g.moveTo(x + 0.8 * s, y - 2.5 * s); g.lineTo(x + 0.8 * s - leg, y);
  g.stroke();
  // cuerpo
  g.fillStyle = color;
  g.fillRect(x - 1.6 * s, y - 6.5 * s, 3.2 * s, 4.4 * s);
  g.strokeStyle = 'rgba(30,20,10,0.7)';
  g.lineWidth = 0.5;
  g.strokeRect(x - 1.6 * s, y - 6.5 * s, 3.2 * s, 4.4 * s);
  // cabeza / casco
  g.fillStyle = SKIN;
  g.beginPath(); g.arc(x, y - 7.8 * s, 1.35 * s, 0, Math.PI * 2); g.fill();
  if (glyph === 'sword' || glyph === 'pike' || glyph === 'knight' || glyph === 'spear') {
    g.fillStyle = '#8c949c';
    g.beginPath(); g.arc(x, y - 8.2 * s, 1.45 * s, Math.PI, 0); g.fill();
  }
  // arma
  g.strokeStyle = '#5a4630';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  switch (glyph) {
    case 'spear': case 'pike':
      g.moveTo(x + 2.2 * s, y + 0.5 * s); g.lineTo(x + 2.2 * s, y - (glyph === 'pike' ? 15 : 12) * s);
      g.stroke();
      g.fillStyle = '#b0b6bc';
      g.beginPath(); g.moveTo(x + 2.2 * s, y - (glyph === 'pike' ? 17 : 14) * s); g.lineTo(x + 3.2 * s, y - (glyph === 'pike' ? 14.5 : 11.5) * s); g.lineTo(x + 1.2 * s, y - (glyph === 'pike' ? 14.5 : 11.5) * s); g.fill();
      break;
    case 'bow':
      g.strokeStyle = '#6b4a2a';
      g.arc(x + 2.6 * s, y - 5 * s, 3.2 * s, -1.2, 1.2); g.stroke();
      g.strokeStyle = 'rgba(240,230,210,.8)'; g.lineWidth = 0.4;
      g.beginPath(); g.moveTo(x + 3.8 * s, y - 8 * s); g.lineTo(x + 3.8 * s, y - 2 * s); g.stroke();
      break;
    case 'sword':
      g.strokeStyle = '#c4cad0'; g.lineWidth = 1 * s;
      g.moveTo(x + 2 * s, y - 4 * s); g.lineTo(x + 4.5 * s, y - 9 * s); g.stroke();
      g.fillStyle = color; g.beginPath(); g.ellipse(x - 2.3 * s, y - 4.5 * s, 1.4 * s, 2.4 * s, 0, 0, Math.PI * 2); g.fill();
      break;
    case 'gun':
      g.strokeStyle = '#3a3a3a'; g.lineWidth = 1.1 * s;
      g.moveTo(x + 1 * s, y - 4 * s); g.lineTo(x + 6 * s, y - 7 * s); g.stroke();
      break;
    case 'club': case 'raider':
    default:
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.2 * s;
      g.moveTo(x + 2 * s, y - 3 * s); g.lineTo(x + 3.5 * s, y - 9 * s); g.stroke();
      g.fillStyle = '#7a7268'; g.beginPath(); g.arc(x + 3.6 * s, y - 9.3 * s, 1.3 * s, 0, Math.PI * 2); g.fill();
  }
}

function horse(g: G, x: number, y: number, color: string, glyph: UnitGlyph, step: number, s = 1) {
  const bob = Math.abs(Math.sin(step)) * 0.8 * s;
  g.fillStyle = glyph === 'knight' ? '#5a4030' : '#7a5232';
  g.beginPath(); g.ellipse(x, y - 4 * s - bob, 4.6 * s, 2.3 * s, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(x + 3.5 * s, y - 5 * s - bob); g.lineTo(x + 6.5 * s, y - 8.5 * s - bob); g.lineTo(x + 7 * s, y - 7 * s - bob); g.lineTo(x + 4.6 * s, y - 3.5 * s - bob); g.fill();
  g.strokeStyle = '#4a3020'; g.lineWidth = 0.9 * s;
  const l = Math.sin(step) * 1.5 * s;
  g.beginPath();
  g.moveTo(x - 3 * s, y - 3 * s - bob); g.lineTo(x - 3 * s + l, y);
  g.moveTo(x + 3 * s, y - 3 * s - bob); g.lineTo(x + 3 * s - l, y);
  g.stroke();
  if (glyph === 'knight') { g.fillStyle = color; g.fillRect(x - 4 * s, y - 5.5 * s - bob, 8 * s, 2.5 * s); }
  // jinete
  g.fillStyle = color;
  g.fillRect(x - 1.3 * s, y - 10 * s - bob, 2.6 * s, 4 * s);
  g.fillStyle = SKIN;
  g.beginPath(); g.arc(x, y - 11.2 * s - bob, 1.25 * s, 0, Math.PI * 2); g.fill();
  if (glyph === 'knight') {
    g.fillStyle = '#9aa2aa'; g.beginPath(); g.arc(x, y - 11.5 * s - bob, 1.45 * s, Math.PI, 0); g.fill();
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 0.9 * s; g.beginPath(); g.moveTo(x + 1 * s, y - 9 * s - bob); g.lineTo(x + 9 * s, y - 12 * s - bob); g.stroke();
  } else {
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 0.8 * s; g.beginPath(); g.moveTo(x + 1.5 * s, y - 8 * s - bob); g.lineTo(x + 4 * s, y - 14 * s - bob); g.stroke();
  }
}

function chariot(g: G, x: number, y: number, color: string, step: number, s = 1) {
  horse(g, x + 5 * s, y, color, 'horse', step, s * 0.85);
  g.fillStyle = '#8a6440';
  g.fillRect(x - 6 * s, y - 6 * s, 6 * s, 4 * s);
  g.strokeStyle = INK; g.lineWidth = 0.6; g.strokeRect(x - 6 * s, y - 6 * s, 6 * s, 4 * s);
  g.strokeStyle = '#3b2a1c'; g.lineWidth = 1 * s;
  g.beginPath(); g.arc(x - 3 * s, y - 1.6 * s, 2 * s, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x - 3 * s + Math.cos(step) * 2 * s, y - 1.6 * s + Math.sin(step) * 2 * s); g.lineTo(x - 3 * s - Math.cos(step) * 2 * s, y - 1.6 * s - Math.sin(step) * 2 * s); g.stroke();
  soldier(g, x - 3 * s, y - 4 * s, color, 'bow', 0, s * 0.85);
}

function engine(g: G, x: number, y: number, glyph: UnitGlyph, color: string, s = 1) {
  g.strokeStyle = '#5a3f26'; g.lineWidth = 1.4 * s; g.fillStyle = '#8a6440';
  if (glyph === 'cannon') {
    g.fillStyle = '#3a3a3e'; g.beginPath(); g.ellipse(x, y - 4 * s, 6 * s, 2.2 * s, -0.3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a3020'; g.beginPath(); g.arc(x - 2 * s, y - 1.5 * s, 2 * s, 0, Math.PI * 2); g.stroke();
  } else {
    g.fillRect(x - 6 * s, y - 3 * s, 12 * s, 2 * s);
    g.beginPath(); g.moveTo(x - 4 * s, y - 2 * s); g.lineTo(x + 1 * s, y - (glyph === 'trebuchet' ? 14 : 8) * s); g.lineTo(x + 5 * s, y - 2 * s); g.stroke();
    g.beginPath(); g.moveTo(x + 1 * s, y - (glyph === 'trebuchet' ? 14 : 8) * s); g.lineTo(x - 7 * s, y - (glyph === 'trebuchet' ? 18 : 11) * s); g.stroke();
    g.fillStyle = '#6a6a6a'; g.beginPath(); g.arc(x - 7 * s, y - (glyph === 'trebuchet' ? 18 : 11) * s, 1.3 * s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3b2a1c'; g.lineWidth = 1 * s;
    g.beginPath(); g.arc(x - 4 * s, y - 0.8 * s, 1.6 * s, 0, Math.PI * 2); g.arc(x + 4 * s, y - 0.8 * s, 1.6 * s, 0, Math.PI * 2); g.stroke();
  }
  soldier(g, x + 7 * s, y, color, 'club', 0, s * 0.8);
}

export function drawRegiment(g: G, glyph: UnitGlyph, color: string, color2: string, t: number, moving: boolean, s = 1) {
  const step = moving ? t * 10 : 0;
  // sombra
  g.fillStyle = 'rgba(30,20,10,0.28)';
  g.beginPath(); g.ellipse(0, 1, 11 * s, 3.2 * s, 0, 0, Math.PI * 2); g.fill();
  // estandarte detrás
  g.strokeStyle = INK; g.lineWidth = 0.9 * s;
  g.beginPath(); g.moveTo(-8 * s, 0); g.lineTo(-8 * s, -19 * s); g.stroke();
  const wave = Math.sin(t * 4) * 1.2 * s;
  g.fillStyle = color;
  g.beginPath(); g.moveTo(-8 * s, -19 * s); g.quadraticCurveTo(-3 * s, -19 * s + wave, 1 * s, -18 * s); g.lineTo(1 * s, -13 * s); g.quadraticCurveTo(-3 * s, -14 * s + wave, -8 * s, -13 * s); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,20,10,.7)'; g.lineWidth = 0.6; g.stroke();
  g.fillStyle = color2; g.beginPath(); g.arc(-3.5 * s, -16 * s, 1.3 * s, 0, Math.PI * 2); g.fill();
  if (glyph === 'raider') {
    g.fillStyle = '#efe4c8'; g.beginPath(); g.arc(-3.5 * s, -16 * s, 1.5 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK; g.fillRect(-4.3 * s, -16.4 * s, 0.6 * s, 0.6 * s); g.fillRect(-3.1 * s, -16.4 * s, 0.6 * s, 0.6 * s);
  }
  if (glyph === 'horse' || glyph === 'knight') {
    horse(g, -2 * s, 0, color, glyph, step, s);
    horse(g, 6 * s, 2 * s, color, glyph, step + 1.3, s * 0.9);
  } else if (glyph === 'chariot') {
    chariot(g, 1 * s, 1 * s, color, step, s);
  } else if (glyph === 'catapult' || glyph === 'trebuchet' || glyph === 'cannon') {
    engine(g, 0, 1 * s, glyph, color, s);
  } else {
    soldier(g, -3 * s, -1 * s, color, glyph, step, s);
    soldier(g, 3 * s, -1.5 * s, color, glyph, step + 1.5, s);
    soldier(g, 0, 2 * s, color, glyph, step + 0.7, s);
  }
}

export function drawCamp(g: G, x: number, y: number, t: number) {
  g.fillStyle = 'rgba(30,20,10,0.25)';
  g.beginPath(); g.ellipse(x, y + 4, 18, 5, 0, 0, Math.PI * 2); g.fill();
  for (const [ox, oy, c] of [[-8, 2, '#6b3a2a'], [7, -2, '#5a3424'], [0, 8, '#7a4a30']] as const) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(x + ox - 7, y + oy); g.lineTo(x + ox, y + oy - 10); g.lineTo(x + ox + 7, y + oy); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
  }
  // hoguera
  const fl = 0.7 + Math.sin(t * 11) * 0.3;
  g.fillStyle = `rgba(240,130,40,${fl})`;
  g.beginPath(); g.moveTo(x - 3, y + 2); g.quadraticCurveTo(x, y - 8 * fl, x + 3, y + 2); g.fill();
  // estandarte con calavera
  g.strokeStyle = INK; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x + 14, y + 6); g.lineTo(x + 14, y - 16); g.stroke();
  g.fillStyle = '#2a1a14'; g.fillRect(x + 14, y - 16, 9, 7);
  g.fillStyle = '#efe4c8'; g.beginPath(); g.arc(x + 18.5, y - 12.8, 2, 0, Math.PI * 2); g.fill();
}
