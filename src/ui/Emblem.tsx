import { useEffect, useRef } from 'preact/hooks';
import type { Leader } from '../sim/types';
import { hash2 } from '../core/rng';

// 12 emblemas heráldicos sencillos
export const EMBLEMS: string[] = [
  'M12 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-3v2m0 12v2m7-8h2M3 10h2m11.5-5.5 1.4-1.4M4.6 16.4 6 15m10.5 0 1.4 1.4M4.6 3.6 6 5', // sol
  'M15 3a8 8 0 1 0 5 13A7 7 0 0 1 15 3Z', // luna
  'M12 20v-6m0 0-4-3h3L7 7h3l2-4 2 4h3l-4 4h3l-4 3Z', // árbol
  'M2 18 9 6l4 6 2-3 7 9H2Z', // montaña
  'M2 10c3-3 5-3 8 0s5 3 8 0 3-1 4 0M2 15c3-3 5-3 8 0s5 3 8 0 3-1 4 0', // ola
  'M3 12c4-1 6-4 9-8 1 4 3 6 6 6l3 2-3 1c-3 0-5 1-7 4l-1 3-2-4c-2 0-4-1-5-4Z', // ave
  'M5 6c-1 2 0 4 2 4m12-4c1 2 0 4-2 4M7 10c0 4 2 8 5 8s5-4 5-8H7Zm3 4h.01M14 14h.01', // toro
  'M12 12m-1 0a1 1 0 1 0 2 0 3 3 0 1 0-6 0 5 5 0 1 0 10 0 7 7 0 1 0-14 0', // espiral
  'M12 2l2.6 6.6L21 9l-5 4.6L17.5 21 12 17.3 6.5 21 8 13.6 3 9l6.4-.4Z', // estrella
  'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', // ojo
  'M8 21V8m0 0c0-3 3-5 7-5-1 3-1 6 0 9-4 0-7-1-7-4Z', // hacha
  'M12 21V8m-4 0c0-2 2-4 4-5 2 1 4 3 4 5-2 0-3 1-4 2-1-1-2-2-4-2Zm-1 6c2 0 4 1 5 3 1-2 3-3 5-3', // espiga
];

export function Emblem({ index, color, color2, size = 36 }: { index: number; color: string; color2: string; size?: number }) {
  return (
    <svg class="emblem" width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true">
      <path d="M4 3h32v19c0 11-8 18-16 21C12 40 4 33 4 22V3Z" fill={color} stroke="#1a140e" stroke-width="1.6" />
      <path d="M4 3h32v19c0 11-8 18-16 21C12 40 4 33 4 22V3Z" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1" transform="translate(2 2) scale(.9)" />
      <g transform="translate(8 9) scale(1)">
        <path d={EMBLEMS[index % EMBLEMS.length]} fill="none" stroke={color2} stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>
  );
}

// Retrato procedural del líder
export function Portrait({ leader, color, size = 72 }: { leader: Leader; color: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const g = c.getContext('2d')!;
    g.setTransform((size * dpr) / 100, 0, 0, (size * dpr) / 100, 0, 0);
    drawPortrait(g, leader, color);
  }, [leader.portrait, leader.age, leader.title, color, size]);
  return <canvas ref={ref} class="portrait" style={{ width: size + 'px', height: size + 'px' }} />;
}

function drawPortrait(g: CanvasRenderingContext2D, l: Leader, color: string) {
  const h = (k: number) => hash2(l.portrait % 10007, k, 31);
  const skins = ['#f0cfa8', '#dcae84', '#c08a5e', '#9a6640', '#6f4a2f', '#e6bf98'];
  const hairs = ['#2a1d14', '#4a3020', '#6b4a2a', '#a07040', '#1a1410', '#8a8580'];
  const skin = skins[Math.floor(h(1) * skins.length)];
  let hair = hairs[Math.floor(h(2) * hairs.length)];
  if (l.age > 55) hair = '#c9c4ba';
  else if (l.age > 45 && h(9) > 0.5) hair = '#8a8580';
  // fondo
  const grd = g.createLinearGradient(0, 0, 0, 100);
  grd.addColorStop(0, '#e6d7b4');
  grd.addColorStop(1, '#c9b48a');
  g.fillStyle = grd;
  g.fillRect(0, 0, 100, 100);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  g.beginPath(); g.arc(50, 40, 44, 0, Math.PI * 2); g.fill();
  // cuerpo / ropaje
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(10, 100); g.quadraticCurveTo(14, 70, 50, 66); g.quadraticCurveTo(86, 70, 90, 100); g.closePath(); g.fill();
  g.strokeStyle = '#2a2119'; g.lineWidth = 1.6; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.moveTo(42, 68); g.lineTo(50, 86); g.lineTo(58, 68); g.closePath(); g.fill();
  // cuello
  g.fillStyle = skin;
  g.fillRect(43, 56, 14, 14);
  // pelo trasero
  const long = h(3) > 0.55;
  if (long) {
    g.fillStyle = hair;
    g.beginPath(); g.ellipse(50, 50, 22, 26, 0, 0, Math.PI * 2); g.fill();
  }
  // cara
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(50, 42, 16, 20, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a2119'; g.lineWidth = 1.4; g.stroke();
  // ojos
  g.fillStyle = '#2a2119';
  const ey = 40 + (h(4) - 0.5) * 2;
  g.beginPath(); g.ellipse(43.5, ey, 1.7, 1.3, 0, 0, Math.PI * 2); g.ellipse(56.5, ey, 1.7, 1.3, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(42,33,25,0.8)'; g.lineWidth = 1.3;
  const browTilt = l.traits.includes('cruel') || l.traits.includes('paranoid') ? 1.5 : l.traits.includes('generous') || l.traits.includes('charismatic') ? -1 : 0;
  g.beginPath(); g.moveTo(40, ey - 4 - browTilt); g.lineTo(47, ey - 4 + browTilt); g.moveTo(53, ey - 4 + browTilt); g.lineTo(60, ey - 4 - browTilt); g.stroke();
  // nariz y boca
  g.beginPath(); g.moveTo(50, ey + 1); g.lineTo(48.5, ey + 8); g.lineTo(51, ey + 8.5); g.stroke();
  const smile = l.traits.includes('charismatic') || l.traits.includes('generous') || l.traits.includes('drunkard') ? 2 : l.traits.includes('cruel') ? -1.5 : 0.5;
  g.beginPath(); g.moveTo(45, ey + 13); g.quadraticCurveTo(50, ey + 13 + smile, 55, ey + 13); g.stroke();
  if (l.age > 45) {
    g.strokeStyle = 'rgba(42,33,25,0.35)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(41, ey + 3); g.lineTo(43, ey + 5); g.moveTo(59, ey + 3); g.lineTo(57, ey + 5); g.stroke();
  }
  // barba
  if (h(5) > 0.45) {
    g.fillStyle = hair;
    g.beginPath(); g.moveTo(35, 44); g.quadraticCurveTo(36, 66, 50, 68); g.quadraticCurveTo(64, 66, 65, 44); g.quadraticCurveTo(58, 56, 50, 56); g.quadraticCurveTo(42, 56, 35, 44); g.fill();
    g.strokeStyle = '#2a2119'; g.lineWidth = 1; g.stroke();
  }
  // pelo
  g.fillStyle = hair;
  g.beginPath(); g.moveTo(33, 40); g.quadraticCurveTo(34, 18, 50, 20); g.quadraticCurveTo(66, 18, 67, 40); g.quadraticCurveTo(62, 28, 50, 28); g.quadraticCurveTo(38, 28, 33, 40); g.fill();
  // tocado según el título
  const t = l.title;
  g.strokeStyle = '#2a2119'; g.lineWidth = 1.2;
  if (t === 'Rey' || t === 'Emperador') {
    g.fillStyle = '#d6a836';
    g.beginPath(); g.moveTo(35, 24); g.lineTo(37, 12); g.lineTo(43, 19); g.lineTo(50, 9); g.lineTo(57, 19); g.lineTo(63, 12); g.lineTo(65, 24); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#b4432a'; g.beginPath(); g.arc(50, 20, 2, 0, Math.PI * 2); g.fill();
  } else if (t === 'Sumo Sacerdote') {
    g.fillStyle = '#efe4c8';
    g.beginPath(); g.moveTo(36, 26); g.lineTo(50, 4); g.lineTo(64, 26); g.closePath(); g.fill(); g.stroke();
  } else if (t === 'Gran Jefe') {
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? '#b4432a' : '#e6c46a';
      g.beginPath(); g.ellipse(38 + i * 6, 16, 2.4, 8, (i - 2) * 0.25, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.fillStyle = '#6b4a2a'; g.fillRect(34, 21, 32, 4);
  } else if (t === 'Anciano') {
    g.fillStyle = '#8a6a4a'; g.fillRect(34, 22, 32, 3);
  } else if (t === 'Cónsul' || t === 'Presidente') {
    g.strokeStyle = '#4a7a3a'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(50, 34, 17, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  }
}
