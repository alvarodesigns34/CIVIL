// Iconos de depósitos sobre el mapa (canvas).
import type { DepositId } from '../sim/types';

const DEP_COLOR: Record<DepositId, string> = {
  wheat: '#d9b851', cattle: '#8a5a3a', deer: '#9a6a3a', fish: '#5a8eaa', copper: '#c46a3a', iron: '#6a7078', horses: '#7a5030',
  marble: '#e8e4da', gold: '#e2c044', gems: '#7a4ab0', spices: '#c0502a', wine: '#7a2a4a', incense: '#b08a5a', furs: '#8a6a4a',
  salt: '#f0efe8', pearls: '#e8e0f0', silk: '#c05a8a',
};

export function drawDepositIcon(g: CanvasRenderingContext2D, d: DepositId, x: number, y: number, z: number) {
  const r = 6.5;
  g.fillStyle = 'rgba(42,33,25,0.3)';
  g.beginPath(); g.arc(x + 0.8, y + 1, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f3ead6';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a2119';
  g.lineWidth = 0.9;
  g.stroke();
  const c = DEP_COLOR[d];
  g.fillStyle = c;
  g.strokeStyle = '#2a2119';
  g.lineWidth = 0.6;
  switch (d) {
    case 'wheat':
      for (const o of [-2, 0, 2]) { g.beginPath(); g.ellipse(x + o, y - 1, 0.9, 2.6, o * 0.15, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x, y + 4); g.stroke();
      break;
    case 'fish':
    case 'pearls':
      g.beginPath(); g.ellipse(x - 0.5, y, 3.2, 1.8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x + 2.5, y); g.lineTo(x + 4.5, y - 2); g.lineTo(x + 4.5, y + 2); g.closePath(); g.fill();
      break;
    case 'gold': case 'copper': case 'iron': case 'gems':
      g.beginPath(); g.moveTo(x, y - 3.5); g.lineTo(x + 3.2, y); g.lineTo(x, y + 3.5); g.lineTo(x - 3.2, y); g.closePath(); g.fill(); g.stroke();
      break;
    case 'marble': case 'salt':
      g.fillRect(x - 3, y - 2.5, 6, 5); g.strokeRect(x - 3, y - 2.5, 6, 5);
      break;
    case 'horses': case 'cattle': case 'deer':
      g.beginPath(); g.ellipse(x - 0.5, y + 0.5, 3, 1.8, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(x + 1.5, y - 3, 1.5, 3);
      g.fillRect(x - 3, y + 1.5, 0.9, 2.2); g.fillRect(x + 1.5, y + 1.5, 0.9, 2.2);
      if (d === 'deer') { g.beginPath(); g.moveTo(x + 2, y - 3); g.lineTo(x + 1, y - 5); g.moveTo(x + 2.6, y - 3); g.lineTo(x + 3.6, y - 5); g.stroke(); }
      break;
    case 'wine':
      for (const [ox, oy] of [[-1.5, -1.5], [1.5, -1.5], [0, 1], [-1.5, 1], [1.5, 1], [0, 3]]) { g.beginPath(); g.arc(x + ox, y + oy - 0.5, 1.3, 0, Math.PI * 2); g.fill(); }
      break;
    default:
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  void z;
}
