import { render } from 'preact';
import '@fontsource-variable/fraunces';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import './ui/style.css';
import { App } from './ui/App';

render(<App />, document.getElementById('app')!);

// Safari en iPad ignora user-scalable=no: bloqueamos el zoom de página por gestos y doble toque.
// (El mapa tiene su propio zoom con dos dedos.)
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false } as any);
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 320 && !(e.target as HTMLElement)?.closest('button, a, input, label, select, textarea, canvas, [role=tab]')) e.preventDefault();
  lastTouch = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => { if ((e as TouchEvent).touches.length > 1 && !(e.target as HTMLElement)?.closest('canvas')) e.preventDefault(); }, { passive: false });
// Si por cualquier motivo la página quedó ampliada o desplazada, recolocarla
window.addEventListener('resize', () => window.scrollTo(0, 0));

// Aplicación instalable y juego sin conexión (sólo en producción y fuera de marcos)
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  try {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch {}
}
