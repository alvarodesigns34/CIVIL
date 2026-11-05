import { ctrl } from '../game/controller';
import { notify } from '../game/store';
import { Icon } from './Icon';
import { EventArt } from './EventArt';
import { Emblem } from './Emblem';
import { EVENT, makeCtx, getChoices, getText, choiceAvailable, describeEffects, costText, type FxLine } from '../sim/events';
import { legacyBreakdown } from '../data/ambitions';
import { rankings } from '../sim/game';
import { calendarYear } from '../sim/names';
import { fmt, cls } from './util';

const CAT_NAME: Record<string, string> = {
  disaster: 'Desastre', society: 'Sociedad', politics: 'Política', religion: 'Religión', discovery: 'Descubrimiento', economy: 'Economía',
  diplomacy: 'Diplomacia', war: 'Guerra', leader: 'Corte', nature: 'Naturaleza', culture: 'Cultura',
};

function FxList({ lines }: { lines: FxLine[] }) {
  return (
    <div class="fx">
      {lines.map((l, i) => (
        <span key={i} class={cls(l.tone !== 'neutral' && l.tone, l.sub && 'sub')}>
          {l.text}
          {l.sub && <FxList lines={l.sub} />}
        </span>
      ))}
    </div>
  );
}

export function EventModal() {
  const pe = ctrl.blockingEvent();
  if (!pe) return null;
  const s = ctrl.state;
  const def = EVENT[pe.id];
  if (!def) {
    s.events.pending = s.events.pending.filter((x) => x !== pe);
    return null;
  }
  const civ = s.civs[pe.civ];
  const ctx = makeCtx(s, civ, pe.sid, pe.other, pe.data ?? {});
  const { title, text } = getText(def, ctx);
  const choices = getChoices(def, ctx);
  return (
    <div class="scrim">
      <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div class="event-art">
          <EventArt art={def.art} seed={pe.uid} />
          <div class="cat">{CAT_NAME[def.cat] ?? def.cat} · {calendarYear(s.calendarStart, s.year)}{ctx.other && def.needsOther ? ` · ${ctx.other.name}` : ''}</div>
        </div>
        <div class="modal-body scroll">
          <h2>{title}</h2>
          <p class="lead">{text}</p>
          {choices.map((ch, i) => {
            const ok = choiceAvailable(ch, ctx);
            const lines = describeEffects(ch.fx, ctx);
            const cost = costText(ch.cost);
            return (
              <button key={i} class="choice" disabled={!ok} onClick={() => ctrl.resolveEvent(pe, i)}>
                <div class="l">{ch.label}</div>
                {ch.hint && <div class="h">{ch.hint}</div>}
                {(lines.length > 0 || cost) && (
                  <FxList lines={[...(cost ? [{ text: `Cuesta ${cost}`, tone: 'bad' as const }] : []), ...lines]} />
                )}
                {!ok && <div class="h bad" style={{ marginTop: 4 }}>{ch.reqText ?? 'No puedes permitírtelo'}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ResultModal() {
  const r = ctrl.lastResult;
  if (!r || ctrl.blockingEvent()) return null;
  const close = () => { ctrl.lastResult = null; notify(); };
  return (
    <div class="scrim" onClick={close}>
      <div class="modal" style={{ width: 'min(420px,100%)' }} onClick={(e) => e.stopPropagation()}>
        <div class="modal-body">
          <div class="eyebrow">Consecuencias</div>
          <h2 style={{ fontSize: 22 }}>{r.title}</h2>
          {r.lines.map((l, i) => <p key={i} class="lead" style={{ margin: '8px 0' }}>{l}</p>)}
          <button class="btn" style={{ marginTop: 8, width: '100%' }} onClick={close}>Continuar</button>
        </div>
      </div>
    </div>
  );
}

export function GameOver() {
  const s = ctrl.state;
  const go = s.gameOver;
  if (!go) return null;
  const p = ctrl.player;
  const lb = legacyBreakdown(s, p);
  const rk = rankings(s);
  const myRank = rk.findIndex((r) => r.civ.id === p.id) + 1;
  const highlights = s.chronicle.filter((e) => e.important && (e.civ === p.id || e.civ === -1)).slice(-8);
  return (
    <div class="scrim">
      <div class="modal ending" style={{ width: 'min(620px,100%)' }}>
        <div class="event-art" style={{ height: 150 }}>
          <EventArt art={go.won ? 'crown' : 'ruins'} seed={s.seed} />
        </div>
        <div class="modal-body scroll">
          <div class="eyebrow">{calendarYear(s.calendarStart, go.year)} · fin de la partida</div>
          <h1 style={{ margin: '6px 0 8px' }}>{go.won ? 'Vuestro nombre perdurará' : 'Así termina vuestra historia'}</h1>
          <p class="lead">{go.reason}</p>
          <div class="grid2">
            <div class="card">
              <div class="eyebrow">Legado</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 650 }} class="num">{fmt(lb.total)}</div>
              <div class="muted">Puesto {myRank} de {rk.length}</div>
            </div>
            <div class="card">
              {rk.slice(0, 5).map((r, i) => (
                <div key={r.civ.id} class="kv" style={{ alignItems: 'center' }}>
                  <span class="k" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{i + 1}. <Emblem index={r.civ.emblem} color={r.civ.color} color2={r.civ.color2} size={16} /> {r.civ.name}</span>
                  <span class="v">{fmt(r.score)}</span>
                </div>
              ))}
            </div>
          </div>
          <div class="section">
            <span class="eyebrow">Momentos de vuestra historia</span>
            <div class="chron">
              {highlights.map((e, i) => (
                <div key={i} class="chron-item imp"><div class="y">{calendarYear(s.calendarStart, e.year)}</div><div>{e.text}</div></div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button class="btn accent" onClick={() => { s.gameOver = null; ctrl.paused = true; notify(); }} disabled={!p.alive}>Seguir jugando</button>
            <button class="btn ghost" onClick={() => { ctrl.screen = 'title'; notify(); }}>Volver al inicio</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MenuPanel() {
  const st = ctrl.settings;
  const set = (k: keyof typeof st) => { (st as any)[k] = !st[k]; ctrl.saveSettings(); };
  return (
    <section class="panel" role="dialog" aria-label="Menú">
      <div class="panel-head">
        <div><h2>Menú</h2><p>Partida, ajustes y controles.</p></div>
        <button class="close" onClick={() => { ctrl.panel = null; notify(); }} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <div class="panel-body scroll">
        <div class="grid2">
          <button class="btn" onClick={() => ctrl.save()}><Icon name="save" /> Guardar</button>
          <button class="btn ghost" onClick={() => { ctrl.load(); }}>Cargar</button>
        </div>
        <button class="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { ctrl.save(true); ctrl.screen = 'title'; ctrl.panel = null; notify(); }}>Salir al inicio</button>
        <div class="section">
          <span class="eyebrow">Ajustes</span>
          <div class="card">
            <label class="kv" style={{ cursor: 'pointer' }}><span class="k">Sonido</span><input type="checkbox" checked={st.sound} onChange={() => set('sound')} /></label>
            <label class="kv" style={{ cursor: 'pointer' }}><span class="k">Reducir animaciones</span><input type="checkbox" checked={st.reducedMotion} onChange={() => set('reducedMotion')} /></label>
          </div>
        </div>
        <div class="section">
          <span class="eyebrow">Controles</span>
          <div class="card" style={{ fontSize: 14 }}>
            <div class="kv"><span class="k">Mover el mapa</span><span class="v">Arrastrar · WASD · flechas</span></div>
            <div class="kv"><span class="k">Zoom</span><span class="v">Rueda · pellizcar · + / −</span></div>
            <div class="kv"><span class="k">Pausa</span><span class="v">Espacio</span></div>
            <div class="kv"><span class="k">Velocidad</span><span class="v">1 · 2 · 3 · 4</span></div>
            <div class="kv"><span class="k">Construir / Saber / Gobierno</span><span class="v">B · T · G</span></div>
            <div class="kv"><span class="k">Cancelar</span><span class="v">Esc · clic derecho</span></div>
          </div>
        </div>
        <div class="section">
          <span class="eyebrow">Cómo se juega</span>
          <div class="card" style={{ fontSize: 14, lineHeight: 1.55 }}>
            <p style={{ margin: '0 0 8px' }}>Cada año tu gente come, trabaja, nace y muere. Los edificios dan empleo; quien no tiene oficio recolecta en las casillas libres.</p>
            <p style={{ margin: '0 0 8px' }}>Un excedente de comida hace crecer la población, pero necesita vivienda. Al crecer, el pueblo exige bienes, y las facciones quieren cosas distintas: equilibrarlas sostiene la estabilidad.</p>
            <p style={{ margin: 0 }}>Investiga, adopta leyes, comercia, pacta o guerrea. La partida termina cuando alguien construye la máquina de vapor, cuando solo queda un pueblo o tras 900 años.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
