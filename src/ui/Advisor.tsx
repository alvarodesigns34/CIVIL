import { ctrl } from '../game/controller';
import { notify } from '../game/store';
import { Icon } from './Icon';
import { civSettlements } from '../sim/world';
import { civEra } from '../data/techs';
import { fmt } from './util';
import { BUILDING } from '../data/buildings';

interface Alert { id: string; tone: 'bad' | 'warn' | 'good'; text: string; icon: string; go: () => void }

export function Alerts() {
  const s = ctrl.state;
  const p = ctrl.player;
  const L = p.ledger;
  const sets = civSettlements(s, p.id);
  const out: Alert[] = [];
  const open = (panel: string) => () => { ctrl.panel = panel; notify(); };
  if (!p.research) out.push({ id: 'res', tone: 'bad', icon: 'tech', text: 'Elige qué investigar', go: open('tech') });
  if (p.traditionOffer) out.push({ id: 'trad', tone: 'good', icon: 'star', text: 'Nueva tradición disponible', go: () => { ctrl.panel = 'gov'; notify(); } });
  if ((L as any).famine > 0) out.push({ id: 'fam', tone: 'bad', icon: 'food', text: 'Hambruna: la gente muere de hambre', go: open('build') });
  else if (L.net.food < 0) {
    const yrs = p.res.food / -L.net.food;
    out.push({ id: 'food', tone: yrs < 6 ? 'bad' : 'warn', icon: 'food', text: yrs < 30 ? `Comida: reservas para ${Math.max(1, Math.floor(yrs))} años` : `Déficit de comida (${fmt(L.net.food)}/año)`, go: open('build') });
  }
  for (const st of sets) {
    if (st.pop > st.housing * 1.02) { out.push({ id: 'h' + st.id, tone: 'warn', icon: 'cities', text: `Hacinamiento en ${st.name}`, go: () => ctrl.focusSettlement(st.id) }); break; }
  }
  const idle = sets.reduce((a, x) => a + Math.max(0, x.workforce - x.employed), 0);
  const era = civEra(p.techs);
  if (idle > 10 && era >= 0) out.push({ id: 'idle', tone: 'warn', icon: 'pop', text: `${fmt(idle)} personas sin oficio (recolectan)`, go: open('build') });
  const short = sets.reduce((a, x) => a + Math.max(0, x.jobs - x.workforce), 0);
  if (short > 10) out.push({ id: 'short', tone: 'warn', icon: 'pop', text: `Faltan ${fmt(short)} trabajadores`, go: open('cities') });
  if (p.stability < 30) out.push({ id: 'stab', tone: 'bad', icon: 'stability', text: p.stability < 15 ? 'Caos: el estado se desmorona' : 'Disturbios en las calles', go: open('gov') });
  if (era >= 1 && L.goodsMet < 0.7) out.push({ id: 'goods', tone: 'warn', icon: 'goods', text: `Escasez de bienes (${Math.round(L.goodsMet * 100)}%)`, go: open('build') });
  if (L.net.gold < 0 && p.res.gold < 40) out.push({ id: 'gold', tone: 'bad', icon: 'gold', text: 'El tesoro se vacía', go: open('cities') });
  for (const st of sets) if (st.health < -2) { out.push({ id: 'hl' + st.id, tone: 'warn', icon: 'health', text: `Insalubridad en ${st.name}`, go: () => ctrl.focusSettlement(st.id) }); break; }
  for (const [oid, r] of Object.entries(p.relations)) {
    if (r.state === 'war') out.push({ id: 'war' + oid, tone: r.warScore < -20 ? 'bad' : 'warn', icon: 'sword', text: `Guerra con ${s.civs[+oid].name} (${r.warScore > 0 ? '+' : ''}${Math.round(r.warScore)})`, go: open('diplo') });
  }
  // obras paradas por falta de recursos no aplica; asentamiento asediado
  for (const st of sets) if (st.siege > 0) out.push({ id: 's' + st.id, tone: 'bad', icon: 'shield', text: `${st.name} está sitiada`, go: () => ctrl.focusSettlement(st.id) });
  void BUILDING;
  if (!out.length) return null;
  return (
    <div class="alerts">
      {out.slice(0, 6).map((a) => (
        <button key={a.id} class={`alert ${a.tone}`} onClick={a.go}>
          <Icon name={a.icon} />
          <span>{a.text}</span>
        </button>
      ))}
    </div>
  );
}

export function ModeBar() {
  const o = ctrl.overlay;
  if (o.mode === 'select') return null;
  let t = '', sub = '';
  if (o.mode === 'build' && ctrl.buildType) {
    const d = BUILDING[ctrl.buildType];
    t = `Construir: ${d.name}`;
    const n = o.buildPreview ? [...o.buildPreview.values()].filter((x) => x.ok).length : 0;
    sub = n ? (ctrl.isTouch ? 'Toca una casilla resaltada y tócala otra vez para confirmar.' : 'Haz clic en una casilla resaltada. Las verdes son las mejores.') : `No hay casillas válidas. ${d.placeText}`;
  } else if (o.mode === 'colony') {
    t = 'Fundar asentamiento';
    sub = ctrl.isTouch ? 'Toca una casilla marcada y confirma con otro toque.' : 'Elige una casilla marcada con líneas discontinuas.';
  } else if (o.mode === 'scout') {
    t = 'Enviar exploradores';
    sub = 'Elige un destino, aunque esté sin explorar.';
  }
  const confirm = ctrl.pendingConfirm;
  return (
    <div class="modebar">
      <div>
        <div class="t">{t}</div>
        <div class="s">{sub}</div>
      </div>
      {confirm && (o.mode === 'build' || o.mode === 'colony') && (
        <button class="btn accent small" onClick={() => (o.mode === 'build' ? ctrl.tryBuild(confirm[0], confirm[1]) : ctrl.tryColony(confirm[0], confirm[1]))}>
          <Icon name="check" /> Aquí
        </button>
      )}
      <button class="btn ghost small" style={{ color: 'var(--night-text)', borderColor: 'rgba(255,240,200,.25)' }} onClick={() => ctrl.cancelMode()}>Cancelar</button>
    </div>
  );
}
