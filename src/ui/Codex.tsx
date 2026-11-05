import { useState } from 'preact/hooks';
import { PanelShell } from './panels/PanelShell';
import { Icon } from './Icon';
import { Thumb } from './Thumb';
import { UnitIcon } from './UnitCard';
import { UNITS } from '../data/units';
import { BUILDINGS, BCAT_NAME } from '../data/buildings';
import { ctrl } from '../game/controller';
import { cls } from './util';

const SECTIONS: { id: string; title: string; icon: string; body: string[] }[] = [
  { id: 'start', title: 'Primeros pasos', icon: 'star', body: [
    'Tu pueblo empieza con 50 personas, unas chozas, un campamento de caza y leñadores. El tiempo corre en años: pulsa ▶ para avanzar y la pausa para pensar.',
    'Elige siempre algo que investigar (Saber). La Agricultura multiplica la comida; la Alfarería trae graneros y talleres; la Cantería, piedra.',
    'Sigue los objetivos del Consejo de ancianos: enseñan lo esencial y dan recompensas.',
  ] },
  { id: 'people', title: 'Población y trabajo', icon: 'pop', body: [
    'Cada habitante come 1 de comida al año. Más o menos el 58% de la gente trabaja. Los edificios dan empleo: primero se cubren los de comida y materiales, luego el ejército, la fe, el saber y el comercio.',
    'Quien no tiene oficio recolecta en las casillas libres. Si la comida no alcanza, los jefes mandan a recolectar antes de abrir otros oficios.',
    'La gente nace si hay comida de sobra y vivienda libre. El hacinamiento trae enfermedad; el hambre, muerte. Las ciudades cercanas (menos de 7 casillas) comparten trabajadores.',
  ] },
  { id: 'cities', title: 'Ciudades', icon: 'cities', body: [
    'Toca una ciudad para abrir su ficha. Cada ciudad sube de nivel (Aldea, Pueblo, Villa, Ciudad, Metrópolis) cuando cubre sus necesidades: población, comida, vivienda, fe, bienes, lujos, comercio, saber y salud.',
    'Cada nivel da más vivienda, impuestos, saber y cultura. Si sus necesidades dejan de cubrirse durante cinco años, decae.',
    'Desde Aldea puedes especializarla (granero, minera, portuaria, santa, del saber, fortaleza…) y nombrar un gobernador. Funda nuevos asentamientos con colonos desde Construir.',
  ] },
  { id: 'war', title: 'Guerra', icon: 'sword', body: [
    'Recluta regimientos en la ficha de una ciudad (pestaña Ejército). Cada uno sale de 10 habitantes y cuesta recursos. Desde la Edad del Bronce, las tropas mejores exigen un cuartel y recursos estratégicos: cobre, hierro o caballos.',
    'Toca tus tropas para seleccionarlas y toca el mapa para moverlas. Toca un enemigo o una ciudad enemiga para atacar. Para tomar una ciudad hay que derribar sus murallas (la barra sobre ella) y entrar con infantería.',
    'Colinas, bosques, murallas y la orden Fortificar ayudan a defender. Los lanceros y piqueros doblan su fuerza contra jinetes. Las armas de asedio multiplican el daño contra murallas. Fuera de casa las tropas se desgastan; dentro, se curan.',
    'Los bárbaros salen de campamentos en tierra de nadie. Arrasa un campamento con tus tropas para obtener oro.',
  ] },
  { id: 'politics', title: 'Gobierno', icon: 'gov', body: [
    'Las cinco facciones quieren cosas distintas. Su aprobación, ponderada por su poder, sostiene la estabilidad. Por debajo de 30 hay disturbios; por encima de 75, edad dorada.',
    'Las leyes cuestan influencia y contentan a unos y molestan a otros. El régimen decide cuántas leyes admites y cómo se sucede el líder: herederos, elecciones, consejos o clero.',
    'Los decretos son órdenes directas: festivales, reparto de grano, levas, amnistías… Cada uno tiene un precio y un tiempo de espera.',
  ] },
  { id: 'faith', title: 'Fe y cultura', icon: 'culture', body: [
    'Santuarios, templos y megalitos generan fe. Al reunir suficiente, fundas una religión con su doctrina; un concilio posterior añade una segunda.',
    'La fe se difunde de ciudad en ciudad, más deprisa por rutas comerciales. Compartir religión acerca a los pueblos; las ciudades de otra fe restan estabilidad.',
    'La cultura amplía tus fronteras y desbloquea tradiciones permanentes. Los personajes ilustres nacen de lo que tu pueblo cultiva.',
  ] },
  { id: 'diplo', title: 'Diplomacia', icon: 'diplo', body: [
    'Conoce a otros pueblos explorando. Comercia, firma pactos de no agresión, abre fronteras, casa a tu dinastía o forma alianzas. Si alguien te teme lo bastante, puedes exigirle tributo… o vasallaje en una guerra ganada.',
    'Las ciudades-estado se ganan con emisarios y regalos: las amigas dan oro, cultura o tropas.',
    'Si te vuelves demasiado poderoso, los demás pueden formar una coalición contra ti.',
  ] },
  { id: 'victory', title: 'Victoria', icon: 'trophy', body: [
    'Científica: construir la primera máquina de vapor. Cultural: acumular 32.000 de cultura con 4 maravillas. Dominación: controlar todas las capitales originales. Diplomática: ser aliado de todos los grandes pueblos y amigo de la mitad de las ciudades-estado durante 15 años. Legado: tener la mayor puntuación tras 900 años.',
    'Las grandes crisis (migraciones, plagas, colapso del bronce, edad de hielo) golpean a todos. Prepárate.',
  ] },
];

export function CodexPanel() {
  const [tab, setTab] = useState('start');
  const sec = SECTIONS.find((s) => s.id === tab)!;
  const p = ctrl.player;
  return (
    <PanelShell wide title="Códice" sub="Todo lo que un buen gobernante debe saber." tabs={[...SECTIONS.map((s) => ({ id: s.id, label: s.title })), { id: 'units', label: 'Unidades' }, { id: 'buildings', label: 'Edificios' }]} tab={tab} onTab={setTab}>
      {sec && (
        <div class="codex">
          <div class="row" style={{ gap: 10, marginBottom: 8 }}><span class="medallion"><Icon name={sec.icon} /></span><h3 style={{ fontSize: 22 }}>{sec.title}</h3></div>
          {sec.body.map((t, i) => <p key={i}>{t}</p>)}
        </div>
      )}
      {tab === 'units' && (
        <div class="codex-grid">
          {UNITS.filter((u) => u.id !== 'raiders').map((u) => (
            <div key={u.id} class="card">
              <div class="row" style={{ gap: 10 }}>
                <UnitIcon type={u.id} color={p?.color ?? '#b4432a'} color2={p?.color2 ?? '#f1d9a8'} size={48} />
                <div><h4>{u.name}</h4><div class="muted" style={{ fontSize: 12.5 }}>Ataque {u.atk} · Defensa {u.def} · Velocidad {u.speed}</div></div>
              </div>
              <div class="desc">{u.desc}</div>
            </div>
          ))}
        </div>
      )}
      {tab === 'buildings' && (
        <div class="codex-grid">
          {BUILDINGS.filter((b) => !b.upgradeOf || true).map((b) => (
            <div key={b.id} class={cls('card')}>
              <div class="row" style={{ gap: 10 }}>
                <Thumb id={b.id} color={p?.color ?? '#b4432a'} color2={p?.color2 ?? '#f1d9a8'} size={48} />
                <div><h4>{b.name}</h4><div class="muted" style={{ fontSize: 12.5 }}>{BCAT_NAME[b.cat]}</div></div>
              </div>
              <div class="desc">{b.desc}</div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}
