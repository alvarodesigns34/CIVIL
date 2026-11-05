// Eventos narrativos del juego. Todo el texto visible va en español; los identificadores, en inglés.
// Las cadenas (chain) enlazan con eventos `chainOnly` que sólo se disparan por cadena.
import type { EventChoice, EventCtx, EventDef } from '../sim/eventTypes';
import type { ResId } from '../sim/types';

const NOMBRE: Record<ResId, string> = {
  food: 'comida', wood: 'madera', stone: 'piedra', metal: 'metal',
  goods: 'bienes', gold: 'oro', influence: 'influencia',
};

// Requisito de recursos para poder pagar un coste
const tiene = (r: ResId, v: number): Pick<EventChoice, 'req' | 'reqText'> => ({
  req: (c: EventCtx) => c.res(r) >= v,
  reqText: `Hacen falta ${v} de ${NOMBRE[r]}`,
});

// Dos civilizaciones en paz
const enPaz = (c: EventCtx) => !!c.other && c.civ.relations[c.other.id]?.state === 'peace';

export const EVENTS: EventDef[] = [
  // ───────────── Naturaleza y desastres (era 0 en adelante)
  {
    id: 'hambre_graneros', title: 'Los graneros vacíos', cat: 'disaster', art: 'famine', weight: 2.5, cooldown: 20,
    cond: (c) => c.res('food') < c.foodNeed() * 0.3,
    text: 'Los graneros de {civ} están casi vacíos. En {settlement} los niños ya no lloran: se quedan callados, y eso asusta más. El consejo espera una decisión antes de que el hambre la tome por él.',
    choices: [
      {
        label: 'Repartir las últimas reservas',
        hint: 'Calma al pueblo hoy, pero la siembra de mañana irá sin grano.',
        fx: [
          { t: 'faction', f: 'commoners', v: 12 }, { t: 'stability', v: 3 },
          { t: 'mod', id: 'siembra_escasa', name: 'Siembra escasa', years: 2, fx: { food: -0.1 } },
        ],
        log: '{leader} ordenó repartir las últimas reservas de {settlement}.',
        ai: 1,
      },
      {
        label: 'Enviar a todos al bosque y al río',
        hint: 'Cazar, recoger y pescar: la comida llega, aunque algunos no vuelvan.',
        fx: [
          { t: 'res', r: 'food', v: 18, scale: 'era' },
          { t: 'faction', f: 'warriors', v: 6 }, { t: 'faction', f: 'commoners', v: -4 },
          { t: 'chance', p: 0.3, label: '30%: una partida se pierde en la espesura', then: [{ t: 'pop', v: -0.02, where: 'ctx' }] },
        ],
        log: '{leader} mandó a los hombres de {settlement} a cazar y pescar en pleno hambre.',
        ai: 2,
      },
      {
        label: 'Rezar y ayunar',
        hint: 'Los dioses pueden salvar la cosecha. O no.',
        fx: [
          { t: 'faction', f: 'clergy', v: 12 }, { t: 'stability', v: 4 },
          { t: 'chance', p: 0.5, label: '50%: llueve y la tierra vuelve a dar', then: [{ t: 'res', r: 'food', v: 12, scale: 'era' }], else: [{ t: 'stability', v: -4 }] },
        ],
      },
    ],
  },
  {
    id: 'tormenta_costera', title: 'Tormenta en la costa', cat: 'nature', art: 'storm', weight: 1.5, cooldown: 25,
    ctxSettlement: 'coastal',
    cond: (c) => c.coastal(),
    text: 'Una tormenta del oeste ha caído sobre la costa de {civ}. Las olas han arrancado los muelles de {settlement} y dejado las barcas hechas astillas. Los pescadores piden madera y promesas a partes iguales.',
    choices: [
      {
        label: 'Reparar muelles y barcas', cost: { wood: 20 }, ...tiene('wood', 20),
        hint: 'Gastar madera ahora para no perder la pesca de un año.',
        fx: [{ t: 'faction', f: 'commoners', v: 6 }],
        ai: 2,
      },
      {
        label: 'Dejar que el mar se lleve lo que quiera',
        hint: 'Ahorrar esfuerzos, perder barcos y paciencia.',
        fx: [{ t: 'destroy', cat: 'food' }, { t: 'unrest', v: 10 }, { t: 'faction', f: 'commoners', v: -6 }],
      },
      {
        label: 'Ofrecer sacrificios a los dioses del mar',
        hint: 'Apaciguar al mar con fe, y apostar a que funcione.',
        fx: [
          { t: 'faction', f: 'clergy', v: 8 },
          { t: 'chance', p: 0.5, label: '50%: el mar se calma', then: [], else: [{ t: 'destroy', cat: 'food' }] },
        ],
      },
    ],
  },
  {
    id: 'inundacion_rio', title: 'El río se sale', cat: 'nature', art: 'flood', weight: 1.5, cooldown: 25,
    ctxSettlement: 'largest',
    cond: (c) => c.river(),
    text: 'El río de {settlement} se ha salido de su cauce durante la noche. El agua llega a los campos y a las puertas de las casas, y los vecinos cargan sus cosas sobre la cabeza entre gritos.',
    choices: [
      {
        label: 'Levantar diques de tierra', cost: { wood: 25 }, ...tiene('wood', 25),
        hint: 'Trabajo duro y madera; si el río gana, habrá pérdidas.',
        fx: [{
          t: 'chance', p: 0.7, label: '70%: los diques aguantan',
          then: [{ t: 'faction', f: 'commoners', v: 6 }],
          else: [{ t: 'destroy', cat: 'housing' }, { t: 'faction', f: 'commoners', v: -6 }],
        }],
        ai: 2,
      },
      {
        label: 'Dejar que el agua se retire',
        hint: 'El limo fertiliza los campos, aunque alguna casa no lo cuente.',
        fx: [
          { t: 'res', r: 'food', v: 14, scale: 'era' },
          { t: 'mod', id: 'limo_fertil', name: 'Limo fértil', years: 4, fx: { food: 0.08 } },
          { t: 'destroy', cat: 'housing' },
        ],
        log: 'Las aguas del río cubrieron {settlement} y dejaron el limo en los campos.',
      },
      {
        label: 'Pedir a los sacerdotes que hablen con el río',
        hint: 'Fe en lugar de piedra. El pueblo quiere respuestas, no discursos.',
        fx: [{ t: 'faction', f: 'clergy', v: 10 }, { t: 'stability', v: -2 }],
      },
    ],
  },
  {
    id: 'sequia', title: 'Sin lluvia', cat: 'nature', art: 'drought', weight: 1.5, cooldown: 25,
    cond: (c) => c.net('food') < 0,
    text: 'Hace tres meses que no llueve sobre {civ}. Los pozos bajan, la hierba se quiebra y los rebaños adelgazan a ojos vistas. Los campesinos miran al cielo como si el cielo les debiera algo.',
    choices: [
      {
        label: 'Excavar pozos y canales', cost: { stone: 15 }, ...tiene('stone', 15),
        hint: 'Piedra y paciencia: el agua llegará, pero tarde.',
        fx: [
          { t: 'mod', id: 'pozos_nuevos', name: 'Pozos nuevos', years: 10, fx: { food: 0.05 } },
          { t: 'faction', f: 'commoners', v: 5 },
        ],
        ai: 2,
      },
      {
        label: 'Procesión y rito de lluvia',
        hint: 'El clero se llena de fervor. La lluvia, al fin y al cabo, es asunto de los dioses.',
        fx: [
          { t: 'faction', f: 'clergy', v: 12 },
          {
            t: 'chance', p: 0.4, label: '40%: llueve al tercer día',
            then: [{ t: 'res', r: 'food', v: 20, scale: 'era' }, { t: 'faction', f: 'clergy', v: 6 }],
            else: [{ t: 'faction', f: 'commoners', v: -8 }],
          },
        ],
      },
      {
        label: 'Racionar el grano y el agua',
        hint: 'Nadie pasa hambre del todo, pero nadie está contento.',
        fx: [
          { t: 'mod', id: 'racionamiento', name: 'Racionamiento', years: 3, fx: { growth: -0.3 } },
          { t: 'faction', f: 'commoners', v: -8 }, { t: 'stability', v: -2 },
        ],
      },
    ],
  },
  {
    id: 'langosta', title: 'La nube de langosta', cat: 'nature', art: 'beast', weight: 1, cooldown: 30,
    minEra: 0, maxEra: 2,
    cond: (c) => c.count('farm') >= 3,
    text: 'Una nube oscura se levanta desde el sur y cae sobre los campos de {settlement}. Es langosta, millones de patas que devoran la hierba y el trigo en una tarde. El año está perdido, aunque los graneros aún no lo sepan.',
    choices: [
      {
        label: 'Encender hogueras y hacer ruido', cost: { wood: 10 }, ...tiene('wood', 10),
        hint: 'Humo y tambores: ahuyentan a parte de la plaga.',
        fx: [{
          t: 'chance', p: 0.5, label: '50%: la nube se aleja',
          then: [],
          else: [{ t: 'mod', id: 'langosta', name: 'Campos devorados', years: 2, fx: { food: -0.2 } }],
        }],
      },
      {
        label: 'Recoger los insectos y cocinarlos',
        hint: 'El hambre convertida en comida. Asco de sobra, pero comida.',
        fx: [
          { t: 'res', r: 'food', v: 6, scale: 'era' },
          { t: 'faction', f: 'commoners', v: 4 }, { t: 'faction', f: 'clergy', v: -3 },
          { t: 'mod', id: 'langosta', name: 'Campos devorados', years: 2, fx: { food: -0.1 } },
        ],
        ai: 2,
      },
      {
        label: 'Dejar que pase y rezar a la tierra',
        hint: 'Nada se puede hacer. Pero el clero lo agradecerá.',
        fx: [
          { t: 'mod', id: 'langosta', name: 'Campos devorados', years: 2, fx: { food: -0.2 } },
          { t: 'faction', f: 'clergy', v: 5 },
        ],
      },
    ],
  },
  {
    id: 'buena_cosecha', title: 'Año de abundancia', cat: 'nature', art: 'harvest', weight: 1.5, cooldown: 20,
    cond: (c) => c.count('farm') >= 2 && c.net('food') > 5,
    text: 'Los campos de {settlement} han dado más de lo que nadie esperaba. Las espigas se doblan hasta el suelo y los carros hacen cola hasta el camino. ¿Qué se hace con tanta abundancia?',
    choices: [
      {
        label: 'Llenar los graneros para los años malos',
        hint: 'La despensa llena es el mejor consejero de la paz.',
        fx: [
          { t: 'res', r: 'food', v: 25, scale: 'era' },
          { t: 'mod', id: 'despensa', name: 'Despensa llena', years: 6, fx: { growth: 0.2 } },
        ],
        ai: 2,
      },
      {
        label: 'Celebrar la cosecha con banquetes',
        hint: 'Que el pueblo vea que el año ha sido bueno, aunque la comida se gaste más deprisa.',
        fx: [
          { t: 'stability', v: 5 }, { t: 'faction', f: 'commoners', v: 8 },
          { t: 'res', r: 'food', v: -8, scale: 'era' },
        ],
        log: '{leader} celebró la cosecha de {settlement} con banquetes en las plazas.',
      },
      {
        label: 'Vender el excedente a los mercaderes', req: (c) => c.has('currency'), reqText: 'Hace falta la moneda',
        hint: 'Oro hoy; el pueblo nota que el grano sale de su aldea.',
        fx: [
          { t: 'res', r: 'gold', v: 30, scale: 'era' },
          { t: 'faction', f: 'merchants', v: 6 }, { t: 'faction', f: 'commoners', v: -4 },
        ],
      },
    ],
  },
  {
    id: 'terremoto', title: 'La tierra tiembla', cat: 'disaster', art: 'earthquake', weight: 1, cooldown: 35,
    cond: (c) => c.count('house') >= 3 || c.count('townhouse') >= 1,
    text: 'La tierra ha gemido bajo los pies de {settlement}. Los muros se agrietaron, las ollas cayeron de los estantes y un templo viejo se ha venido abajo como un muro de barro mojado. Hay heridos bajo los escombros y ni un solo fuego encendido.',
    choices: [
      {
        label: 'Reconstruir con piedra y paciencia', cost: { stone: 25 }, ...tiene('stone', 25),
        hint: 'Más caro, pero el próximo temblor será menos cruel.',
        fx: [
          { t: 'mod', id: 'muros_reforzados', name: 'Muros reforzados', years: 12, fx: { construction: 0.1 } },
          { t: 'faction', f: 'commoners', v: 5 },
        ],
        ai: 2,
      },
      {
        label: 'Rezar y pedir perdón a la tierra',
        hint: 'Los dioses fueron ofendidos. Que lo expliquen ellos.',
        fx: [{ t: 'faction', f: 'clergy', v: 12 }, { t: 'destroy', cat: 'faith' }, { t: 'faction', f: 'commoners', v: -4 }],
      },
      {
        label: 'Repartir la gente en tiendas por el campo',
        hint: 'Techo provisional y mucho descontento.',
        fx: [{ t: 'unrest', v: 8 }, { t: 'faction', f: 'commoners', v: -3 }, { t: 'res', r: 'wood', v: -10, scale: 'era' }],
      },
    ],
  },
  {
    id: 'mina_derrumbe', title: 'Derrumbe en la mina', cat: 'disaster', art: 'mine', weight: 1.2, cooldown: 25,
    minEra: 1,
    cond: (c) => c.count('mine') >= 1,
    text: 'Una galería de la mina de {settlement} se ha hundido. Hay cuadrillas enteras atrapadas bajo la montaña, golpeando la roca con los mangos de sus picos. Cada hora que pasa, las voces son más débiles.',
    choices: [
      {
        label: 'Excavar día y noche para sacarlos', cost: { food: 15 }, ...tiene('food', 15),
        hint: 'Comida para los rescatadores y esperanza para las familias.',
        fx: [{
          t: 'chance', p: 0.6, label: '60%: los rescatan con vida',
          then: [{ t: 'faction', f: 'commoners', v: 10 }],
          else: [{ t: 'pop', v: -0.02, where: 'ctx' }, { t: 'faction', f: 'commoners', v: -10 }],
        }],
        ai: 2,
      },
      {
        label: 'Sellar la galería y dar por perdidos a los atrapados',
        hint: 'Lo perdido está perdido. La mina seguirá siendo peligrosa.',
        fx: [
          { t: 'destroy', cat: 'materials' }, { t: 'faction', f: 'commoners', v: -8 },
          { t: 'mod', id: 'luto_minero', name: 'Luto minero', years: 3, fx: { metal: -0.1 } },
        ],
      },
      {
        label: 'Reforzar las vigas de todas las galerías', cost: { wood: 15 }, ...tiene('wood', 15),
        hint: 'Lento y caro, pero evita la próxima tragedia.',
        fx: [
          { t: 'mod', id: 'vigas_nuevas', name: 'Vigas reforzadas', years: 8, fx: { metal: 0.05 } },
          { t: 'faction', f: 'commoners', v: 5 },
        ],
      },
    ],
  },
  {
    id: 'incendio_ciudad', title: 'Fuego en {settlement}', cat: 'disaster', art: 'fire', weight: 1.2, cooldown: 30,
    ctxSettlement: 'largest',
    cond: (c) => c.count('workshop') >= 1 || c.count('house') >= 3,
    text: 'Una lámpara volcada en un taller de {settlement} ha prendido la paja de los tejados. El humo sube en columna y las casas de adobe arden como cestas secas. Los vecinos forman filas con cubos, pero el viento no ayuda.',
    choices: [
      {
        label: 'Organizar cadenas de cubos y mantas mojadas',
        hint: 'Trabajo colectivo. El fuego no siempre cede.',
        fx: [{
          t: 'chance', p: 0.7, label: '70%: el fuego se controla a tiempo',
          then: [{ t: 'faction', f: 'commoners', v: 6 }],
          else: [{ t: 'destroy', cat: 'housing' }, { t: 'faction', f: 'commoners', v: -4 }],
        }],
        ai: 2,
      },
      {
        label: 'Buscar al culpable de la lámpara',
        hint: 'Un nombre para el miedo y un juicio para la plaza. Mientras, el barrio arde.',
        fx: [
          { t: 'destroy', cat: 'housing' }, { t: 'faction', f: 'commoners', v: 5 },
          { t: 'flag', name: 'arsonist_hunt' }, { t: 'chain', id: 'juicio_incendiario', years: 6 },
        ],
      },
      {
        label: 'Derribar casas para cortar el fuego',
        hint: 'Sacrificar un barrio para salvar la ciudad.',
        fx: [{ t: 'destroy', cat: 'housing' }, { t: 'faction', f: 'commoners', v: -10 }, { t: 'stability', v: -3 }],
      },
    ],
  },
  {
    id: 'plaga_ciudad', title: 'La peste en los barrios bajos', cat: 'disaster', art: 'plague', weight: 1.5, cooldown: 25,
    minEra: 1, ctxSettlement: 'largest',
    cond: (c) => c.era >= 1 && c.health() < 2 && c.pop() > 150,
    text: 'Las calles de {settlement} huelen a cal y a vinagre. Las casas se hacinan, el agua de los pozos ya no es clara y cada noche sacan a alguien envuelto en una manta. Los médicos piden decisiones que el consejo no quiere tomar.',
    choices: [
      {
        label: 'Sanear: aguas, letrinas y mercados', cost: { stone: 20 }, ...tiene('stone', 20),
        hint: 'Obras de larga duración contra un enemigo invisible.',
        fx: [
          { t: 'mod', id: 'saneamiento', name: 'Saneamiento', years: 10, fx: { health: 2 } },
          { t: 'pop', v: -0.01, where: 'ctx' },
        ],
        ai: 2,
      },
      {
        label: 'Dispersar a la población por los campos',
        hint: 'Menos gente junta, menos enfermos. Pero más caminos y más hambre.',
        fx: [
          { t: 'pop', v: -0.02, where: 'ctx' }, { t: 'faction', f: 'commoners', v: -8 },
          { t: 'mod', id: 'dispersion', name: 'Gente dispersa', years: 4, fx: { growth: -0.2 } },
        ],
      },
      {
        label: 'Confiar en los sacerdotes y sus rezos',
        hint: 'Velas y cantos: el consuelo sale barato, la enfermedad no tanto.',
        fx: [
          { t: 'faction', f: 'clergy', v: 10 },
          {
            t: 'chance', p: 0.45, label: '45%: la peste se retira sola',
            then: [],
            else: [{ t: 'pop', v: -0.07, where: 'ctx' }, { t: 'faction', f: 'commoners', v: -10 }],
          },
        ],
      },
    ],
  },
  // ───────────── Descubrimiento y ciencia
  {
    id: 'ruinas_antiguas', title: 'Ruinas bajo la maleza', cat: 'discovery', art: 'ruins', weight: 1.2, cooldown: 40,
    once: true,
    ctxSettlement: 'random',
    text: 'Bajo la maleza, junto a {settlement}, han aparecido muros de piedra que nadie recuerda haber levantado. Entre los escombros brillan fragmentos de cerámica pintada con signos que ningún escriba de {civ} sabe leer.',
    choices: [
      {
        label: 'Excavar con cuidado y registrar cada hallazgo',
        hint: 'Saber a cambio de tiempo. Quizá no salga nada.',
        fx: [{
          t: 'chance', p: 0.6, label: '60%: las tablillas revelan secretos',
          then: [{ t: 'knowledge', v: 0.3 }],
          else: [{ t: 'text', v: 'Las excavaciones solo dan barro y huesos.' }],
        }],
        ai: 2,
      },
      {
        label: 'Desmontar las piedras para construir',
        hint: 'Materiales gratis, y la memoria de otros se pierde con ellos.',
        fx: [{ t: 'res', r: 'stone', v: 40, scale: 'era' }, { t: 'faction', f: 'clergy', v: -6 }],
      },
      {
        label: 'Consagrar el lugar a los antepasados',
        hint: 'Los muertos de otros también merecen descanso.',
        fx: [{ t: 'culture', v: 0.15 }, { t: 'faction', f: 'clergy', v: 6 }],
      },
    ],
  },
  {
    id: 'inventor_genio', title: 'Un inventor de manos negras', cat: 'discovery', art: 'scroll', weight: 1, cooldown: 35,
    minEra: 1, maxEra: 4,
    cond: (c) => c.has('bronze') && c.count('workshop') >= 1,
    text: 'Un hombre de manos ennegrecidas y ojos enrojecidos ha ideado una rueda dentada que mueve el agua del canal sin bueyes. Dice que con el mismo principio se podría moler el grano sin tanto brazo. Nadie en el consejo entiende la mitad de lo que dice, pero todos quieren que se quede.',
    choices: [
      {
        label: 'Financiarle un taller propio', cost: { gold: 40 }, ...tiene('gold', 40),
        hint: 'Oro hoy, máquinas mañana, o un fracaso caro.',
        fx: [
          { t: 'knowledge', v: 0.3 },
          {
            t: 'chance', p: 0.5, label: '50%: la máquina funciona',
            then: [{ t: 'res', r: 'goods', v: 20, scale: 'era' }, { t: 'faction', f: 'merchants', v: 5 }],
            else: [{ t: 'text', v: 'La máquina se rompe al primer uso. El inventor se encoge de hombros.' }],
          },
        ],
      },
      {
        label: 'Dejar que trabaje en el taller del pueblo',
        hint: 'Que la comunidad se beneficie del ingenio, sin gastar oro.',
        fx: [{ t: 'knowledge', v: 0.1 }, { t: 'faction', f: 'commoners', v: 4 }],
        ai: 2,
      },
      {
        label: 'Patentar la máquina para el trono',
        hint: 'Propiedad de la corona. El pueblo no lo verá con buenos ojos.',
        fx: [
          { t: 'knowledge', v: 0.15 }, { t: 'faction', f: 'merchants', v: 8 },
          { t: 'faction', f: 'commoners', v: -4 }, { t: 'faction', f: 'scholars', v: -4 },
        ],
      },
    ],
  },
  {
    id: 'imprenta_libre', title: 'El panfleto de la prensa', cat: 'discovery', art: 'scroll', weight: 1.2, cooldown: 60,
    minEra: 5, once: true,
    cond: (c) => c.has('printing'),
    text: 'Las primeras prensas de {settlement} han impreso un panfleto de cuatro páginas sobre los abusos del clero. Se vendió en una mañana, se copió a mano por la tarde y ya se lee en las plazas de otras ciudades. Los sacerdotes piden que se queme la prensa.',
    choices: [
      {
        label: 'Imprimir sin censura',
        hint: 'El saber libre también lleva el veneno de los panfletos.',
        fx: [
          { t: 'knowledge', v: 0.2 }, { t: 'faction', f: 'scholars', v: 10 }, { t: 'faction', f: 'clergy', v: -10 },
          { t: 'flag', name: 'printing_free' }, { t: 'chain', id: 'herejia_impresa', years: 8 },
        ],
        log: '{leader} permitió que las prensas de {settlement} imprimieran sin censura.',
      },
      {
        label: 'Censurar y revisar cada página',
        hint: 'Una prensa que solo imprime lo permitido. Los eruditos no lo olvidarán.',
        fx: [{ t: 'faction', f: 'scholars', v: -12 }, { t: 'faction', f: 'clergy', v: 8 }],
        ai: 2,
      },
      {
        label: 'Quemar la prensa en la plaza',
        hint: 'Un gesto de fuego. Muchos aplaudirán, y el siglo seguirá su curso.',
        fx: [
          { t: 'faction', f: 'clergy', v: 12 }, { t: 'faction', f: 'scholars', v: -15 },
          { t: 'faction', f: 'commoners', v: -5 },
        ],
      },
    ],
  },
  {
    id: 'escribas_disputa', title: 'Eruditos contra sacerdotes', cat: 'politics', art: 'scroll', weight: 1, cooldown: 35,
    ctxSettlement: 'capital',
    cond: (c) => c.has('writing') && c.faction('scholars') > 55 && c.faction('clergy') > 55,
    text: 'Los eruditos de {civ} afirman que la tierra gira alrededor del sol. Los sacerdotes replican que el sol gira alrededor del templo. Ambos grupos han llevado sus tablillas al consejo, y a nadie le sorprende que griten.',
    choices: [
      {
        label: 'Dar la razón a los eruditos',
        hint: 'La razón por delante, y los templos a la espera.',
        fx: [{ t: 'faction', f: 'scholars', v: 10 }, { t: 'faction', f: 'clergy', v: -10 }, { t: 'knowledge', v: 0.1 }],
      },
      {
        label: 'Dar la razón a los sacerdotes',
        hint: 'La tradición como ancla. Los libros, a un cajón.',
        fx: [{ t: 'faction', f: 'clergy', v: 10 }, { t: 'faction', f: 'scholars', v: -10 }, { t: 'culture', v: 0.1 }],
      },
      {
        label: 'Organizar un debate público', req: (c) => c.has('philosophy'), reqText: 'Hace falta la filosofía',
        hint: 'Que hablen en la plaza. Gana el que mejor habla, no el que tiene razón.',
        fx: [
          { t: 'stability', v: 2 }, { t: 'knowledge', v: 0.05 },
          { t: 'mod', id: 'debate_publico', name: 'Debate público', years: 5, fx: { culture: 0.1 } },
        ],
        ai: 2,
      },
    ],
  },
  {
    id: 'fabricas_vapor', title: 'Humo sobre los telares', cat: 'economy', art: 'mine', weight: 1.2, cooldown: 40,
    minEra: 5,
    cond: (c) => c.has('science') && c.count('workshop') >= 2,
    text: 'Las primeras máquinas de vapor de {settlement} mueven telares y bombas sin descanso. El humo ennegrece las fachadas, los jornales bajan y los niños de los barrios nuevos duermen junto a las calderas. Los mercaderes celebran cada turno de la campana.',
    choices: [
      {
        label: 'Fomentar las fábricas sin límites',
        hint: 'Riqueza veloz y una clase obrera sin voz.',
        fx: [
          { t: 'res', r: 'goods', v: 40, scale: 'era' }, { t: 'res', r: 'gold', v: 30, scale: 'era' },
          { t: 'faction', f: 'merchants', v: 10 }, { t: 'faction', f: 'commoners', v: -12 },
        ],
      },
      {
        label: 'Regular las horas y la seguridad de las máquinas',
        hint: 'Menos beneficio; más vida y pan para los obreros.',
        fx: [
          { t: 'faction', f: 'commoners', v: 12 }, { t: 'faction', f: 'merchants', v: -8 },
          { t: 'mod', id: 'horas_reguladas', name: 'Horas reguladas', years: 10, fx: { workforce: -0.03, health: 1 } },
        ],
        ai: 2,
      },
      {
        label: 'Pedir a los ingenieros que mejoren las máquinas', cost: { gold: 30 }, ...tiene('gold', 30),
        hint: 'Ciencia para la fábrica, no para el obrero.',
        fx: [{ t: 'knowledge', v: 0.2 }, { t: 'res', r: 'goods', v: 20, scale: 'era' }, { t: 'faction', f: 'scholars', v: 8 }],
      },
    ],
  },
  // ───────────── Sociedad, economía y culto
  {
    id: 'fiesta_pueblo', title: 'Fiesta en la plaza', cat: 'culture', art: 'festival', weight: 1, cooldown: 20,
    cond: (c) => c.stability() > 70,
    text: 'En {settlement} la gente ya no se mira con recelo. Los mercados cuelgan banderas y los músicos tocan hasta el amanecer. Alguien propone una fiesta mayor, y nadie se atreve a decir que no.',
    choices: [
      {
        label: 'Feria de un mes con todos los gremios', cost: { goods: 15 }, ...tiene('goods', 15),
        hint: 'Gasto y alegría. El pueblo se acuerda de quien la paga.',
        fx: [{ t: 'stability', v: 4 }, { t: 'faction', f: 'commoners', v: 8 }, { t: 'culture', v: 0.15 }],
      },
      {
        label: 'Fiesta modesta en la plaza',
        hint: 'Pan, vino y canciones, sin tocar el tesoro.',
        fx: [{ t: 'stability', v: 2 }, { t: 'faction', f: 'commoners', v: 4 }],
        ai: 2,
      },
      {
        label: 'Prohibir el derroche y guardar el oro',
        hint: 'Austeridad en plena prosperidad. El tesoro lo agradece.',
        fx: [
          { t: 'res', r: 'gold', v: 20, scale: 'era' },
          { t: 'faction', f: 'commoners', v: -6 }, { t: 'faction', f: 'merchants', v: 4 },
        ],
      },
    ],
  },
  {
    id: 'edad_dorada', title: 'Tiempos dorados', cat: 'society', art: 'crown', weight: 1, cooldown: 50,
    minEra: 1,
    cond: (c) => c.stability() > 75,
    text: 'Hace años que en {civ} no hay hambruna ni guerra. Los artesanos trabajan con orgullo, y las calles se llenan de carros cargados de cosas bonitas. Quien vive hoy lo llama la edad dorada; quien venga después la llamará de otro modo.',
    choices: [
      {
        label: 'Levantar obras que duren siglos', cost: { stone: 30 }, ...tiene('stone', 30),
        hint: 'Piedra para la eternidad.',
        fx: [
          { t: 'culture', v: 0.2 },
          { t: 'mod', id: 'edad_dorada', name: 'Edad dorada', years: 10, fx: { stability: 3, construction: 0.1 } },
        ],
      },
      {
        label: 'Patrocinar a poetas, pintores y sabios',
        hint: 'Gastar en cultura y en saber.',
        fx: [{ t: 'culture', v: 0.25 }, { t: 'knowledge', v: 0.1 }, { t: 'faction', f: 'scholars', v: 8 }],
        ai: 2,
      },
      {
        label: 'Guardar el tesoro para tiempos peores',
        hint: 'Un fondo de reserva: aburrido, pero eficaz.',
        fx: [{ t: 'res', r: 'gold', v: 40, scale: 'era' }, { t: 'faction', f: 'warriors', v: -4 }],
      },
    ],
  },
  {
    id: 'gran_artista', title: 'La cabeza de piedra', cat: 'culture', art: 'festival', weight: 1, cooldown: 40,
    minEra: 1,
    cond: (c) => c.stability() >= 50,
    text: 'Un escultor de {settlement} ha tallado una cabeza de piedra tan viva que la gente le habla en la calle. Los templos la quieren, los mercaderes también, y el propio escultor pide tiempo, madera y una casa propia para trabajar.',
    choices: [
      {
        label: 'Encargarle un monumento para la ciudad', cost: { stone: 25 }, ...tiene('stone', 25),
        hint: 'Su obra en la plaza, durante generaciones.',
        fx: [{ t: 'culture', v: 0.2 }, { t: 'stability', v: 3 }],
      },
      {
        label: 'Pedirle que decore el templo',
        hint: 'La fe se llena de color. El clero está encantado.',
        fx: [{ t: 'faction', f: 'clergy', v: 8 }, { t: 'culture', v: 0.1 }],
      },
      {
        label: 'Dejarle libre: que pinte para quien quiera',
        hint: 'Arte para el pueblo, y ninguna corte que lo encargue.',
        fx: [{ t: 'faction', f: 'commoners', v: 6 }, { t: 'faction', f: 'merchants', v: -4 }, { t: 'culture', v: 0.15 }],
        ai: 2,
      },
    ],
  },
  {
    id: 'revuelta_campesina', title: 'Antorchas ante la casa del consejo', cat: 'society', art: 'riot', weight: 2.5, cooldown: 15,
    ctxSettlement: 'largest',
    cond: (c) => c.faction('commoners') < 30,
    text: 'Los campesinos de {settlement} han dejado los arados y se han plantado ante la casa del consejo con antorchas. Piden tierras, menos tributos y que alguien escuche su voz. Nadie está seguro de cuánto durará la calma.',
    choices: [
      {
        label: 'Conceder tierras y bajar los tributos',
        hint: 'Ceder ahora para no tener que ceder con sangre después.',
        fx: [
          { t: 'faction', f: 'commoners', v: 18 }, { t: 'faction', f: 'warriors', v: -8 },
          { t: 'mod', id: 'tributos_aliviados', name: 'Tributos aliviados', years: 5, fx: { tax: -0.3 } },
          { t: 'flag', name: 'concessions_made' }, { t: 'chain', id: 'promesa_incumplida', years: 15 },
        ],
        log: '{leader} concedió tierras y tributos más bajos a los campesinos de {settlement}.',
        ai: 2,
      },
      {
        label: 'Reprimir con la guardia del trono',
        hint: 'Orden por la fuerza. El miedo también es una lealtad, aunque corta.',
        fx: [
          { t: 'faction', f: 'commoners', v: -10 }, { t: 'faction', f: 'warriors', v: 6 }, { t: 'stability', v: -5 },
          {
            t: 'chance', p: 0.3, label: '30%: la plaza se llena de muertos',
            then: [{ t: 'pop', v: -0.05, where: 'ctx' }, { t: 'opinion', v: -10, who: 'all', label: 'Masacre en la plaza' }],
          },
        ],
      },
      {
        label: 'Negociar con el clero como mediador', req: (c) => c.faction('clergy') >= 40, reqText: 'El clero debe tener peso en la corte',
        hint: 'Un intermediario sagrado que suavice el choque.',
        fx: [{ t: 'faction', f: 'commoners', v: 8 }, { t: 'faction', f: 'clergy', v: 4 }, { t: 'stability', v: 2 }],
      },
    ],
  },
  {
    id: 'promesa_incumplida', title: 'La promesa de hace quince años', cat: 'society', art: 'riot', weight: 2, cooldown: 20,
    chainOnly: true,
    cond: (c) => c.flag('concessions_made') > 0 && c.faction('commoners') < 50,
    text: 'Hace quince años los campesinos de {settlement} recibieron una promesa: tierras y menos tributos. Las tierras nunca llegaron, y los tributos han vuelto a subir con otro nombre. Los hijos de aquellos campesinos ya no tienen paciencia.',
    choices: [
      {
        label: 'Cumplir la promesa, por fin', cost: { gold: 25 }, ...tiene('gold', 25),
        hint: 'Pagar una deuda antigua. Caro, pero honesto.',
        fx: [{ t: 'faction', f: 'commoners', v: 12 }, { t: 'flag', name: 'concessions_made', v: 0 }],
        ai: 2,
      },
      {
        label: 'Ofrecer las tierras de los guerreros',
        hint: 'Quitar a unos para dar a otros: justicia que no a todos gusta.',
        fx: [{ t: 'faction', f: 'commoners', v: 12 }, { t: 'faction', f: 'warriors', v: -14 }, { t: 'stability', v: -2 }, { t: 'flag', name: 'concessions_made', v: 0 }],
      },
      {
        label: 'Negar la promesa y castigar a los agitadores',
        hint: 'Recordar a los campesinos quién manda aquí.',
        fx: [{ t: 'faction', f: 'commoners', v: -15 }, { t: 'unrest', v: 10 }, { t: 'stability', v: -3 }, { t: 'flag', name: 'concessions_made', v: 0 }],
      },
    ],
  },
  {
    id: 'gremio_mercaderes', title: 'Lista de agravios de los mercaderes', cat: 'economy', art: 'market', weight: 1.5, cooldown: 30,
    ctxSettlement: 'capital',
    cond: (c) => c.has('currency') && c.res('gold') > 30,
    text: 'Los mercaderes de {civ} han escrito una lista de agravios y la han leído en voz alta frente al mercado. Piden menos tasas en las ferias, un sello propio para sus pesos y voz en el consejo. Su dinero vale mucho, y ellos lo saben.',
    choices: [
      {
        label: 'Conceder franquicias en las ferias',
        hint: 'Ceder impuestos a cambio de caravanas y de oro futuro.',
        fx: [
          { t: 'mod', id: 'franquicia', name: 'Franquicia mercantil', years: 10, fx: { trade: 0.15, tax: -0.1 } },
          { t: 'faction', f: 'merchants', v: 12 }, { t: 'faction', f: 'commoners', v: -4 },
        ],
        ai: 2,
      },
      {
        label: 'Negarse y cobrarles una multa',
        hint: 'La autoridad de la corona, aunque el tesoro lo note.',
        fx: [{ t: 'res', r: 'gold', v: 20, scale: 'era' }, { t: 'faction', f: 'merchants', v: -12 }, { t: 'stability', v: -2 }],
      },
      {
        label: 'Crear una cámara de comercio conjunta', req: (c) => c.has('guilds'), reqText: 'Hacen falta los gremios',
        hint: 'Un consejo mixto: los mercaderes se sienten escuchados y el poder no pierde nada.',
        fx: [{ t: 'faction', f: 'merchants', v: 8 }, { t: 'res', r: 'influence', v: 2 }],
      },
    ],
  },
  {
    id: 'prestamo_mercaderes', title: 'Un banquero llama a la puerta', cat: 'economy', art: 'market', weight: 1.5, cooldown: 25,
    cond: (c) => c.has('currency') && c.res('gold') < 40,
    text: 'Un banquero de la calle de los cambistas ha llamado a la puerta de palacio. Ofrece oro para las obras, sin preguntas y sin intereses visibles. Lo que no dice es cuándo vendrá a cobrar.',
    choices: [
      {
        label: 'Aceptar el préstamo',
        hint: 'Oro ahora, deuda después. El futuro también cuenta.',
        fx: [
          { t: 'res', r: 'gold', v: 60, scale: 'era' }, { t: 'faction', f: 'merchants', v: 6 },
          { t: 'flag', name: 'debt_taken' }, { t: 'chain', id: 'deuda_vence', years: 10 },
        ],
        log: '{leader} aceptó un préstamo de los mercaderes de {civ}.',
        ai: 2,
      },
      {
        label: 'Rechazarlo y apretar el cinturón',
        hint: 'Sin deudas. Se notará en el día a día.',
        fx: [
          { t: 'mod', id: 'austeridad', name: 'Austeridad', years: 4, fx: { tax: 0.15, stability: -2 } },
          { t: 'faction', f: 'merchants', v: -6 },
        ],
      },
      {
        label: 'Fundir el oro de la corte',
        hint: 'Todo lo que había ahí dentro. Eso también dice algo.',
        fx: [{ t: 'res', r: 'gold', v: 20, scale: 'era' }, { t: 'faction', f: 'warriors', v: -4 }, { t: 'faction', f: 'merchants', v: 3 }],
      },
    ],
  },
  {
    id: 'deuda_vence', title: 'Vence la deuda', cat: 'economy', art: 'market', weight: 2, cooldown: 20,
    chainOnly: true,
    cond: (c) => c.flag('debt_taken') > 0,
    text: 'Diez años después, el banquero vuelve con un notario y una lista de intereses. Dice que la deuda ha crecido y que la ciudad debe pagarla hoy. Sus compañeros de la calle de los cambistas ya han cerrado sus cuentas con otros reinos.',
    choices: [
      {
        label: 'Pagar en oro', cost: { gold: 50 }, ...tiene('gold', 50),
        hint: 'Sin más trampas. Oro que se va.',
        fx: [{ t: 'flag', name: 'debt_taken', v: 0 }, { t: 'faction', f: 'merchants', v: 6 }],
      },
      {
        label: 'Pagar con bienes', cost: { goods: 40 }, ...tiene('goods', 40),
        hint: 'Telas, barro y herramientas por el precio de la cuenta.',
        fx: [{ t: 'flag', name: 'debt_taken', v: 0 }, { t: 'faction', f: 'merchants', v: -4 }, { t: 'faction', f: 'commoners', v: -4 }],
        ai: 2,
      },
      {
        label: 'Negar la deuda y expulsar al banquero',
        hint: 'Orgullo de corona. Los mercaderes no olvidan las deudas impagadas.',
        fx: [
          { t: 'flag', name: 'debt_taken', v: 0 }, { t: 'faction', f: 'merchants', v: -20 }, { t: 'stability', v: -6 },
          { t: 'mod', id: 'credito_perdido', name: 'Crédito perdido', years: 8, fx: { gold: -0.1 } },
        ],
      },
    ],
  },
  {
    id: 'cometa_presagio', title: 'La estrella con cola', cat: 'nature', art: 'comet', weight: 1, cooldown: 30,
    cond: (c) => c.year > 5,
    text: 'Una estrella con cola de fuego ha cruzado el cielo de {civ} durante siete noches. En {settlement} la gente se ha reunido en las calles para mirarla, sin saber si es un aviso, un adorno o una amenaza.',
    choices: [
      {
        label: 'Declararlo presagio de ruina',
        hint: 'Miedo que sirve al clero, pero que también nos vuelve sombríos.',
        fx: [
          { t: 'flag', name: 'omen_doom' }, { t: 'faction', f: 'clergy', v: 8 }, { t: 'stability', v: -4 },
          { t: 'chain', id: 'eclipse_cumplido', years: 8 },
        ],
        log: '{leader} proclamó que la estrella anunciaba la ruina de {civ}.',
      },
      {
        label: 'Pedir a los astrónomos que la midan', req: (c) => c.has('calendar'), reqText: 'Hace falta el calendario',
        hint: 'Medir y anotar: la ciencia de hoy es la profecía de mañana.',
        fx: [{ t: 'knowledge', v: 0.15 }, { t: 'faction', f: 'scholars', v: 8 }, { t: 'flag', name: 'omen_science' }],
        ai: 2,
      },
      {
        label: 'Callar y seguir como si nada',
        hint: 'Ni alarma ni estudio. Ojalá no sea nada.',
        fx: [{ t: 'stability', v: 1 }, { t: 'flag', name: 'omen_ignored' }],
      },
    ],
  },
  {
    id: 'eclipse_cumplido', title: 'El sol se apaga', cat: 'nature', art: 'stars', weight: 2, cooldown: 20,
    chainOnly: true,
    cond: (c) => c.flag('omen_doom') > 0,
    text: 'A mediodía la luz se va de {settlement} como si alguien hubiera cerrado una puerta. Los pájaros callan y los vecinos se arrodillan en la tierra. Quienes hablaron del cometa piden ahora que se les crea.',
    choices: [
      {
        label: 'Aprovechar el miedo para subir los impuestos',
        hint: 'Un año de temor es un buen momento para pedir más.',
        fx: [
          { t: 'mod', id: 'miedo_sagrado', name: 'Miedo sagrado', years: 6, fx: { tax: 0.2 } },
          { t: 'faction', f: 'commoners', v: -8 }, { t: 'faction', f: 'clergy', v: 6 },
          { t: 'flag', name: 'omen_doom', v: 0 },
        ],
      },
      {
        label: 'Ofrecer un gran sacrificio',
        hint: 'El fuego del altar, y la esperanza de que el sol regrese.',
        fx: [
          { t: 'res', r: 'goods', v: -20, scale: 'era' }, { t: 'faction', f: 'clergy', v: 12 },
          {
            t: 'chance', p: 0.5, label: '50%: el sol vuelve con fuerza',
            then: [{ t: 'stability', v: 6 }], else: [{ t: 'stability', v: -6 }],
          },
          { t: 'flag', name: 'omen_doom', v: 0 },
        ],
      },
      {
        label: 'Explicar el eclipse a la gente', req: (c) => c.has('philosophy'), reqText: 'Hace falta la filosofía',
        hint: 'Decir que es un movimiento del cielo, no un castigo. Pocos lo agradecerán ahora.',
        fx: [
          { t: 'faction', f: 'scholars', v: 12 }, { t: 'faction', f: 'clergy', v: -8 },
          { t: 'stability', v: 2 }, { t: 'knowledge', v: 0.1 }, { t: 'flag', name: 'omen_doom', v: 0 },
        ],
        ai: 2,
      },
    ],
  },
  // ───────────── Religión y herejía
  {
    id: 'profeta_forastero', title: 'Un profeta descalzo', cat: 'religion', art: 'stars', weight: 1.5, cooldown: 40,
    once: true, minEra: 0, maxEra: 2,
    cond: (c) => c.faction('clergy') < 70,
    text: 'Un hombre descalzo ha llegado a {settlement} con el rostro quemado por el sol. Dice haber hablado con los muertos y que el mundo está a punto de ser ordenado de nuevo. Los niños le siguen, y los viejos no saben si reírse o temblar.',
    choices: [
      {
        label: 'Escucharle en la plaza',
        hint: 'Dejar que hable: la gente lo quiere, y el clero lo odia.',
        fx: [
          { t: 'flag', name: 'prophet_heard' }, { t: 'faction', f: 'commoners', v: 6 }, { t: 'faction', f: 'clergy', v: -8 },
          { t: 'chain', id: 'sectarios_profeta', years: 12 },
        ],
        log: '{leader} permitió que un profeta forastero predicara en {settlement}.',
      },
      {
        label: 'Entregarle a los sacerdotes',
        hint: 'Que los templos se encarguen de él, y de sus preguntas.',
        fx: [{ t: 'faction', f: 'clergy', v: 10 }, { t: 'faction', f: 'commoners', v: -4 }],
        ai: 2,
      },
      {
        label: 'Expulsarle del poblado',
        hint: 'Sin escándalo, pero con el orgullo de los fieles herido.',
        fx: [{ t: 'faction', f: 'clergy', v: 4 }, { t: 'faction', f: 'commoners', v: -6 }, { t: 'unrest', v: 5 }],
      },
    ],
  },
  {
    id: 'sectarios_profeta', title: 'Los hermanos de la cueva', cat: 'religion', art: 'temple', weight: 2, cooldown: 30,
    chainOnly: true,
    cond: (c) => c.flag('prophet_heard') > 0,
    text: 'Los seguidores del profeta ya tienen nombre y lugar de reunión: una cueva junto al río. Cantan sus versos en las noches de luna y llaman "hermanos" a quienes nunca han visto. El clero exige una respuesta.',
    choices: [
      {
        label: 'Reconocer su fe como una vía nueva',
        hint: 'Un dios nuevo para el pueblo, y un enemigo para los sacerdotes.',
        fx: [
          { t: 'flag', name: 'new_faith' }, { t: 'faction', f: 'commoners', v: 10 }, { t: 'faction', f: 'clergy', v: -12 },
          { t: 'culture', v: 0.1 }, { t: 'chain', id: 'cisma_fe', years: 10 },
        ],
      },
      {
        label: 'Prohibir las reuniones',
        hint: 'El orden primero. Los mártires se hacen solos.',
        fx: [
          { t: 'faction', f: 'clergy', v: 8 }, { t: 'faction', f: 'commoners', v: -8 }, { t: 'unrest', v: 6 },
          { t: 'chance', p: 0.4, label: '40%: los presos se convierten en héroes', then: [{ t: 'unrest', v: 6 }] },
        ],
      },
      {
        label: 'Negociar con el profeta a puerta cerrada', cost: { gold: 20 }, ...tiene('gold', 20),
        hint: 'Pagar silencio y ganar tiempo.',
        fx: [
          { t: 'stability', v: 2 },
          { t: 'mod', id: 'pacto_profeta', name: 'Pacto con el profeta', years: 8, fx: { stability: 2, faction: { clergy: 4 } } },
        ],
        ai: 2,
      },
    ],
  },
  {
    id: 'cisma_fe', title: 'Dos altares, una ciudad', cat: 'religion', art: 'temple', weight: 2, cooldown: 30,
    chainOnly: true, minEra: 1,
    cond: (c) => c.flag('new_faith') > 0 && c.faction('clergy') < 55,
    text: 'El templo mayor de {settlement} amanece con las puertas cerradas: la mitad de los sacerdotes se ha ido con los fieles del profeta. Ahora hay dos dioses en la misma ciudad, y ninguno acepta compartir el altar.',
    choices: [
      {
        label: 'Reconciliar a ambas partes en un gran rito', cost: { goods: 15 }, ...tiene('goods', 15),
        hint: 'Un solo altar, dos cantos. Cuesta, y no contenta a nadie del todo.',
        fx: [
          { t: 'faction', f: 'clergy', v: 6 }, { t: 'faction', f: 'commoners', v: 6 }, { t: 'stability', v: 3 },
          { t: 'flag', name: 'new_faith', v: 0 },
        ],
        ai: 2,
      },
      {
        label: 'Dejar que se separen',
        hint: 'Dos iglesias, dos grupos de fieles y una ciudad dividida.',
        fx: [
          { t: 'pop', v: -0.05, where: 'ctx' }, { t: 'stability', v: -5 },
          { t: 'mod', id: 'ciudad_dividida', name: 'Ciudad dividida', years: 10, fx: { stability: -2 } },
          { t: 'flag', name: 'new_faith', v: 0 },
        ],
      },
      {
        label: 'Declarar a los disidentes herejes y expulsarlos',
        hint: 'La autoridad del templo, a costa de la paz de las calles.',
        fx: [
          { t: 'faction', f: 'clergy', v: 12 }, { t: 'faction', f: 'commoners', v: -12 },
          { t: 'chance', p: 0.3, label: '30%: los expulsados se llevan el grano del templo', then: [{ t: 'res', r: 'food', v: -20, scale: 'era' }] },
          { t: 'flag', name: 'new_faith', v: 0 },
        ],
      },
    ],
  },
  {
    id: 'hereje_clero', title: 'Cantos sin sacerdotes', cat: 'religion', art: 'temple', weight: 1.5, cooldown: 25,
    minEra: 1,
    cond: (c) => c.faction('clergy') < 35,
    text: 'En {settlement} un grupo de vecinos se reúne de noche para cantar sin sacerdotes. Dicen que la tierra es sagrada sin intermediarios y que el diezmo es un robo. El clero pide que se castigue a los cabecillas antes de que el ejemplo se extienda.',
    choices: [
      {
        label: 'Quemar a los cabecillas en la plaza',
        hint: 'Escarmiento sangriento. El clero se reconcilia contigo.',
        fx: [
          { t: 'faction', f: 'clergy', v: 14 }, { t: 'faction', f: 'scholars', v: -10 }, { t: 'faction', f: 'commoners', v: -8 },
          { t: 'flag', name: 'heretic_burned' }, { t: 'chain', id: 'martir_culto', years: 10 },
        ],
      },
      {
        label: 'Tolerar sus reuniones',
        hint: 'Dejar que canten, mientras no cambien las leyes.',
        fx: [{ t: 'faction', f: 'clergy', v: -10 }, { t: 'faction', f: 'commoners', v: 6 }, { t: 'faction', f: 'scholars', v: 4 }],
        ai: 2,
      },
      {
        label: 'Enviar a un teólogo a discutir con ellos', req: (c) => c.has('theology'), reqText: 'Hace falta la teología',
        hint: 'Una disputa pública. Puede ganar la razón, o la paciencia.',
        fx: [{
          t: 'chance', p: 0.5, label: '50%: el teólogo los convence',
          then: [{ t: 'faction', f: 'clergy', v: 6 }, { t: 'faction', f: 'scholars', v: 4 }],
          else: [{ t: 'faction', f: 'commoners', v: 6 }, { t: 'faction', f: 'clergy', v: -8 }],
        }],
      },
    ],
  },
  {
    id: 'herejia_impresa', title: 'Los libros hablan', cat: 'religion', art: 'temple', weight: 2, cooldown: 30,
    chainOnly: true, minEra: 5,
    cond: (c) => c.flag('printing_free') > 0 && c.faction('clergy') < 50,
    text: 'Las ideas del panfleto han prendido. En las plazas de {settlement} se discuten en voz alta cosas que antes se susurraban. Hay quien asegura que los dioses no hablan a través de los sacerdotes, sino a través de los libros.',
    choices: [
      {
        label: 'Abrir debates en los templos',
        hint: 'Que la fe se defienda con argumentos. El clero se resentirá.',
        fx: [
          { t: 'faction', f: 'scholars', v: 8 }, { t: 'faction', f: 'clergy', v: -6 }, { t: 'stability', v: 2 },
          { t: 'flag', name: 'printing_free', v: 0 },
        ],
      },
      {
        label: 'Declarar herejes los escritos',
        hint: 'Los libros prohibidos se convierten en leyenda.',
        fx: [
          { t: 'faction', f: 'clergy', v: 12 }, { t: 'faction', f: 'scholars', v: -10 }, { t: 'flag', name: 'printing_free', v: 0 },
          {
            t: 'chance', p: 0.5, label: '50%: el autor se convierte en mártir',
            then: [{ t: 'flag', name: 'heretic_burned' }, { t: 'chain', id: 'martir_culto', years: 10 }],
          },
        ],
      },
      {
        label: 'Dejar que el debate se apague solo',
        hint: 'El tiempo es un censor silencioso.',
        fx: [{ t: 'stability', v: -2 }, { t: 'flag', name: 'printing_free', v: 0 }],
      },
    ],
  },
  {
    id: 'martir_culto', title: 'El túmulo del mártir', cat: 'religion', art: 'temple', weight: 2, cooldown: 30,
    chainOnly: true,
    cond: (c) => c.flag('heretic_burned') > 0,
    text: 'Los vecinos han enterrado al hereje quemado bajo un montón de piedras, y ahora hay flores en el lugar. Algunos aseguran que oyen su voz de noche, y cada semana aparecen más velas junto al túmulo.',
    choices: [
      {
        label: 'Demoler el túmulo y prohibir las visitas',
        hint: 'Borrar la huella. El miedo también se olvida.',
        fx: [
          { t: 'flag', name: 'heretic_burned', v: 0 }, { t: 'faction', f: 'clergy', v: 6 },
          { t: 'faction', f: 'commoners', v: -6 }, { t: 'unrest', v: 4 },
        ],
      },
      {
        label: 'Convertirlo en santuario oficial', cost: { stone: 15 }, ...tiene('stone', 15),
        hint: 'Un mártir en la corte: los fieles lo amarán, los demás lo mirarán de reojo.',
        fx: [
          { t: 'flag', name: 'heretic_burned', v: 0 }, { t: 'culture', v: 0.15 },
          { t: 'faction', f: 'commoners', v: 6 }, { t: 'faction', f: 'clergy', v: -4 },
        ],
      },
      {
        label: 'Ignorarlo: que las velas se apaguen solas',
        hint: 'Dejar pasar. Quizá lo haga el tiempo.',
        fx: [{ t: 'flag', name: 'heretic_burned', v: 0 }, { t: 'stability', v: -2 }],
        ai: 2,
      },
    ],
  },
  // ───────────── Política interior y ejército
  {
    id: 'golpe_guerreros', title: 'Los jefes de clan se reúnen', cat: 'politics', art: 'army', weight: 2, cooldown: 20,
    ctxSettlement: 'capital',
    cond: (c) => c.faction('warriors') < 25,
    text: 'Los jefes de los clanes guerreros se han reunido en una sala cerrada del palacio. Dicen que el {title} ha olvidado a quienes derramaron sangre por él. Sus hombres esperan a las afueras de {settlement}, con las lanzas apoyadas en el hombro.',
    choices: [
      {
        label: 'Ceder a sus exigencias',
        hint: 'Gloria, cargos y tierras para los guerreros. A cambio, paz frágil.',
        fx: [
          { t: 'faction', f: 'warriors', v: 18 }, { t: 'faction', f: 'commoners', v: -8 }, { t: 'stability', v: -3 },
          { t: 'mod', id: 'gloria_guerrera', name: 'Gloria guerrera', years: 8, fx: { military: 0.1 } },
        ],
        ai: 2,
      },
      {
        label: 'Enfrentarlos con la guardia del trono',
        hint: 'Mano dura. Si la guardia duda, perderemos la corona.',
        fx: [{
          t: 'chance', p: 0.5, label: '50%: la guardia aguanta',
          then: [{ t: 'stability', v: 2 }, { t: 'faction', f: 'warriors', v: -10 }],
          else: [{ t: 'killLeader' }],
        }],
      },
      {
        label: 'Entregar el mando del ejército a uno de ellos',
        hint: 'Dividir el poder. El mando ya no será solo tuyo.',
        fx: [
          { t: 'faction', f: 'warriors', v: 10 }, { t: 'legitimacy', v: -5 },
          { t: 'mod', id: 'mando_compartido', name: 'Mando compartido', years: 6, fx: { military: 0.05 } },
        ],
      },
    ],
  },
  {
    id: 'rival_intriga', title: 'Un pariente ambicioso', cat: 'politics', art: 'council', weight: 1.2, cooldown: 30,
    ctxSettlement: 'capital',
    cond: (c) => c.trait('ambitious') || c.faction('warriors') > 55,
    text: 'Un pariente de {leader} reúne a los jóvenes guerreros en su casa, reparte vino y promesas. Todo el consejo lo sabe, y nadie lo dice en voz alta.',
    choices: [
      {
        label: 'Desterrarle al otro lado de las montañas',
        hint: 'Lejos de la corte, pero no lejos de sus amigos.',
        fx: [
          { t: 'flag', name: 'exiled_rival' }, { t: 'faction', f: 'warriors', v: -8 },
          { t: 'chain', id: 'rival_regresa', years: 12 },
        ],
        ai: 2,
      },
      {
        label: 'Ejecutarle en público',
        hint: 'El escarmiento más rápido, y el más cruel.',
        fx: [
          { t: 'faction', f: 'warriors', v: -15 }, { t: 'faction', f: 'commoners', v: -4 },
          { t: 'legitimacy', v: -4 }, { t: 'trait', add: 'cruel' },
        ],
      },
      {
        label: 'Darle un cargo para tenerle vigilado', cost: { influence: 10 }, ...tiene('influence', 10),
        hint: 'Quien tiene un cargo tiene también un precio.',
        fx: [{ t: 'faction', f: 'warriors', v: 8 }, { t: 'stability', v: 1 }],
      },
    ],
  },
  {
    id: 'rival_regresa', title: 'El desterrado vuelve', cat: 'politics', art: 'army', weight: 2, cooldown: 20,
    chainOnly: true,
    cond: (c) => c.flag('exiled_rival') > 0,
    text: 'El desterrado ha vuelto con un centenar de hombres de otras tierras, armados y con hambre de tierra. Llegan a {settlement} al amanecer y piden ver al {title}. La lealtad que aún conservan a los jefes de antes es ahora una amenaza.',
    choices: [
      {
        label: 'Negociar su perdón',
        hint: 'Indulto a cambio de juramentos y de un puesto de honor.',
        fx: [{ t: 'flag', name: 'exiled_rival', v: 0 }, { t: 'faction', f: 'warriors', v: 6 }, { t: 'stability', v: 2 }],
        ai: 2,
      },
      {
        label: 'Plantarles cara en el campo',
        hint: 'Una batalla, y la corona mirando de lejos.',
        fx: [
          { t: 'flag', name: 'exiled_rival', v: 0 },
          {
            t: 'chance', p: 0.5, label: '50%: la guardia vence',
            then: [{ t: 'faction', f: 'warriors', v: 10 }, { t: 'legitimacy', v: 5 }],
            else: [{ t: 'stability', v: -10 }, { t: 'faction', f: 'warriors', v: -10 }, { t: 'pop', v: -0.04, where: 'ctx' }],
          },
        ],
      },
      {
        label: 'Ceder un cuarto del territorio para evitar la guerra',
        hint: 'Paz por tierra. No todos los pueblos lo verán bien.',
        fx: [
          { t: 'flag', name: 'exiled_rival', v: 0 }, { t: 'pop', v: -0.1, where: 'ctx' },
          { t: 'faction', f: 'commoners', v: -10 }, { t: 'stability', v: -3 },
        ],
      },
    ],
  },
  {
    id: 'complot_asesinato', title: 'Una cuchilla bajo la almohada', cat: 'politics', art: 'riot', weight: 1.5, cooldown: 25,
    ctxSettlement: 'capital',
    cond: (c) => c.stability() < 45,
    text: 'Una daga envuelta en seda ha aparecido bajo la almohada del {title}, y un criado confiesa haber cobrado por dejarla allí. Hay nombres que el consejo prefiere no pronunciar. Los cómplices, dicen, son más de los que parece.',
    choices: [
      {
        label: 'Investigar a fondo y castigar a los cómplices',
        hint: 'Justicia dura: quien conspira, paga.',
        fx: [{
          t: 'chance', p: 0.75, label: '75%: la conjura queda desarmada',
          then: [{ t: 'faction', f: 'warriors', v: -8 }, { t: 'stability', v: 4 }],
          else: [{ t: 'killLeader' }],
        }],
      },
      {
        label: 'Ofrecer cargos a los conspiradores',
        hint: 'Comprar a los enemigos antes de que se conviertan en mártires.',
        fx: [{ t: 'faction', f: 'warriors', v: 8 }, { t: 'stability', v: 3 }, { t: 'res', r: 'influence', v: -5 }],
        ai: 2,
      },
      {
        label: 'Ignorarlo y confiar en la guardia',
        hint: 'Quien no se mueve no levanta sospechas. Hasta que lo hace.',
        fx: [{
          t: 'chance', p: 0.4, label: '40%: la guardia se duerme',
          then: [{ t: 'killLeader' }],
          else: [{ t: 'legitimacy', v: 2 }],
        }],
      },
    ],
  },
  {
    id: 'revuelta_esclavos', title: 'Las cadenas se rompen', cat: 'society', art: 'riot', weight: 2.2, cooldown: 25,
    cond: (c) => c.policy('slavery'),
    text: 'Los cautivos que trabajan en las canteras de {settlement} se han levantado. Han roto las cadenas con las herramientas que les dejaron para picar piedra, y ahora bajan hacia la ciudad cantando en una lengua que nadie entiende. Los capataces han huido.',
    choices: [
      {
        label: 'Aplastarlos con el ejército',
        hint: 'Ningún esclavo se levanta si el miedo es mayor.',
        fx: [
          { t: 'faction', f: 'warriors', v: 10 }, { t: 'faction', f: 'commoners', v: -6 },
          { t: 'opinion', v: -8, who: 'all', label: 'Represión de los cautivos' }, { t: 'pop', v: -0.02, where: 'ctx' },
        ],
      },
      {
        label: 'Ofrecer la libertad a los que se rindan',
        hint: 'Más brazos libres y menos cadenas en la ley.',
        fx: [
          { t: 'faction', f: 'commoners', v: 6 }, { t: 'faction', f: 'warriors', v: -8 }, { t: 'faction', f: 'scholars', v: 6 },
          { t: 'chance', p: 0.3, label: '30%: los guerreros se rebelan contra el pacto', then: [{ t: 'stability', v: -6 }] },
        ],
      },
      {
        label: 'Negociar: jornadas más cortas y comida',
        hint: 'Un acuerdo que no rompe la ley, pero la estira.',
        fx: [
          { t: 'mod', id: 'jornadas_cortas', name: 'Jornadas cortas', years: 10, fx: { workforce: -0.03, stability: 2 } },
          { t: 'faction', f: 'commoners', v: 3 }, { t: 'res', r: 'food', v: -10, scale: 'era' },
        ],
        ai: 2,
      },
    ],
  },
  {
    id: 'mercenarios_oferta', title: 'Espadas a sueldo', cat: 'war', art: 'army', weight: 1.5, cooldown: 25,
    minEra: 1,
    cond: (c) => c.atWar() && c.res('gold') < 60,
    text: 'Una compañía de mercenarios llega al campamento de {settlement} con las espadas al hombro y una lista de precios escrita en piel de cabra. Dicen que pelean por quien paga, y que el primer pago es siempre el más importante.',
    choices: [
      {
        label: 'Pagarles por adelantado', cost: { gold: 40 }, ...tiene('gold', 40),
        hint: 'Oro ahora, tropas que no discuten.',
        fx: [
          { t: 'mod', id: 'mercenarios_pagados', name: 'Mercenarios pagados', years: 6, fx: { military: 0.2 } },
          { t: 'faction', f: 'warriors', v: 6 },
        ],
        ai: 2,
      },
      {
        label: 'Prometerles el pago al final de la guerra',
        hint: 'Tropas hoy y una deuda que pesará mañana.',
        fx: [
          { t: 'mod', id: 'mercenarios_credito', name: 'Mercenarios a crédito', years: 6, fx: { military: 0.2 } },
          { t: 'flag', name: 'mercs_unpaid' }, { t: 'chain', id: 'motin_mercenarios', years: 4 },
        ],
      },
      {
        label: 'Rechazarlos: somos un pueblo de guerreros',
        hint: 'Orgullo propio, sin ayuda ajena.',
        fx: [{ t: 'faction', f: 'warriors', v: -8 }, { t: 'faction', f: 'commoners', v: 6 }],
      },
    ],
  },
  {
    id: 'motin_mercenarios', title: 'Los mercenarios reclaman', cat: 'war', art: 'riot', weight: 2, cooldown: 20,
    chainOnly: true,
    cond: (c) => c.flag('mercs_unpaid') > 0,
    text: 'Los mercenarios no han olvidado la promesa. Han cerrado el paso al campamento de {settlement} y piden su paga con una mezcla de cortesía y amenaza. Los soldados de {civ} los miran sin saber de qué lado están.',
    choices: [
      {
        label: 'Pagarles con bienes del almacén', cost: { goods: 30 }, ...tiene('goods', 30),
        hint: 'Telas, herramientas y cerveza: lo que haga falta para que se vayan.',
        fx: [{ t: 'flag', name: 'mercs_unpaid', v: 0 }, { t: 'faction', f: 'merchants', v: -4 }],
        ai: 2,
      },
      {
        label: 'Dejarles saquear el poblado',
        hint: 'Un día de saqueo y un odio que dura generaciones.',
        fx: [
          { t: 'flag', name: 'mercs_unpaid', v: 0 }, { t: 'res', r: 'goods', v: -25, scale: 'era' },
          { t: 'faction', f: 'commoners', v: -15 }, { t: 'stability', v: -5 },
        ],
      },
      {
        label: 'Enfrentarlos con los propios soldados',
        hint: 'Sangre y disciplina. Los que queden en pie aprenderán.',
        fx: [
          { t: 'flag', name: 'mercs_unpaid', v: 0 },
          {
            t: 'chance', p: 0.5, label: '50%: los mercenarios huyen',
            then: [{ t: 'faction', f: 'warriors', v: 6 }],
            else: [{ t: 'pop', v: -0.03, where: 'ctx' }, { t: 'faction', f: 'warriors', v: -10 }],
          },
        ],
      },
    ],
  },
  {
    id: 'juicio_incendiario', title: 'El juicio de la plaza', cat: 'politics', art: 'council', weight: 2, cooldown: 25,
    chainOnly: true,
    cond: (c) => c.flag('arsonist_hunt') > 0,
    text: 'Medio año después del incendio, la plaza de {settlement} exige un juicio. Un carpintero forastero, sin amigos ni testigos, es señalado por todos. Hay quien dice que lo vio, y hay quien dice que lo vio otro.',
    choices: [
      {
        label: 'Condenarle para calmar a la plaza',
        hint: 'Justicia de prisa. El miedo se va, pero la duda queda.',
        fx: [{ t: 'flag', name: 'arsonist_hunt', v: 0 }, { t: 'faction', f: 'commoners', v: 10 }, { t: 'legitimacy', v: -3 }],
      },
      {
        label: 'Absolverle y pedir pruebas',
        hint: 'La ley antes que la plaza, aunque la plaza no lo entienda.',
        fx: [
          { t: 'flag', name: 'arsonist_hunt', v: 0 }, { t: 'legitimacy', v: 3 },
          { t: 'faction', f: 'commoners', v: -6 }, { t: 'faction', f: 'scholars', v: 6 },
        ],
        ai: 2,
      },
      {
        label: 'Pagar a los vecinos un resarcimiento', cost: { gold: 20 }, ...tiene('gold', 20),
        hint: 'Un silencio caro, y la ciudad se queda con las dudas.',
        fx: [{ t: 'flag', name: 'arsonist_hunt', v: 0 }, { t: 'faction', f: 'commoners', v: 4 }, { t: 'faction', f: 'merchants', v: -4 }],
      },
    ],
  },
  {
    id: 'heredero_estudiar', title: 'El heredero quiere ver el mundo', cat: 'leader', art: 'scroll', weight: 1, cooldown: 40,
    minEra: 1,
    cond: (c) => c.civ.heir !== null,
    text: 'El heredero, hijo de {leader}, quiere estudiar en tierras lejanas. Dice que las academias de {civ} aún enseñan lo que se enseñaba hace un siglo, y que un príncipe debe ver el mundo antes de gobernarlo. El consejo se divide.',
    choices: [
      {
        label: 'Enviarle a estudiar al extranjero',
        hint: 'Ver otros mundos a cambio de un hijo que vuelve distinto.',
        fx: [
          { t: 'flag', name: 'heir_abroad' }, { t: 'chain', id: 'heredero_vuelve', years: 15 },
          { t: 'knowledge', v: 0.1 }, { t: 'faction', f: 'scholars', v: 6 },
        ],
        log: 'El heredero de {civ} partió a estudiar a tierras lejanas.',
      },
      {
        label: 'Mantenerle en la corte',
        hint: 'Aprendizaje de palacio: lo de siempre, y el orgullo de los viejos.',
        fx: [{ t: 'faction', f: 'warriors', v: 4 }, { t: 'faction', f: 'scholars', v: -6 }],
        ai: 2,
      },
      {
        label: 'Enviarle a la frontera con los guerreros',
        hint: 'Disciplina de campamento y alguna herida con honor.',
        fx: [
          { t: 'faction', f: 'warriors', v: 10 },
          { t: 'mod', id: 'instruccion', name: 'Instrucción militar', years: 10, fx: { military: 0.1 } },
        ],
      },
    ],
  },
  {
    id: 'heredero_vuelve', title: 'El heredero vuelve distinto', cat: 'leader', art: 'scroll', weight: 2, cooldown: 30,
    chainOnly: true,
    cond: (c) => c.flag('heir_abroad') > 0,
    text: 'El heredero regresa de sus estudios con libros, cartas y una barba que nadie en {settlement} entiende. Habla de máquinas, de ciudades de piedra y de leyes escritas en el aire. El consejo le mira con recelo y con curiosidad.',
    choices: [
      {
        label: 'Escucharle y adoptar algunas reformas',
        hint: 'Ideas nuevas para un reino viejo. El padre se deja aconsejar.',
        fx: [
          { t: 'flag', name: 'heir_abroad', v: 0 }, { t: 'culture', v: 0.1 },
          { t: 'faction', f: 'scholars', v: 10 }, { t: 'faction', f: 'clergy', v: -8 },
          { t: 'trait', add: 'reformer' },
        ],
      },
      {
        label: 'Apartarle de la corte',
        hint: 'Sus ideas son peligrosas. Que se pudra entre sus libros.',
        fx: [
          { t: 'flag', name: 'heir_abroad', v: 0 }, { t: 'faction', f: 'scholars', v: -8 },
          { t: 'faction', f: 'warriors', v: 6 }, { t: 'stability', v: -2 },
        ],
      },
      {
        label: 'Casarle con la hija de un notable',
        hint: 'Alianzas de familia. Con esposa, los libros se leen menos.',
        fx: [
          { t: 'flag', name: 'heir_abroad', v: 0 }, { t: 'stability', v: 4 }, { t: 'faction', f: 'merchants', v: 6 },
        ],
        ai: 2,
      },
    ],
  },
  {
    id: 'caravana_forastera', title: 'Caravana de tierras lejanas', cat: 'economy', art: 'caravan', weight: 1.5, cooldown: 25,
    minEra: 1,
    cond: (c) => c.has('wheel'),
    text: 'Una caravana llega a {settlement} desde tierras lejanas: camellos cargados de sal, telas de colores y historias de ciudades sin murallas. Pregunta por precios, por rutas y por quién manda aquí.',
    choices: [
      {
        label: 'Comerciar con todo lo que traen',
        hint: 'Riqueza inmediata, y el riesgo de que algo más viaje con ellos.',
        fx: [
          { t: 'res', r: 'gold', v: 30, scale: 'era' }, { t: 'res', r: 'goods', v: 15, scale: 'era' },
          {
            t: 'chance', p: 0.25, label: '25%: entre las mercancías viaja la peste',
            then: [{ t: 'flag', name: 'caravan_plague' }, { t: 'chain', id: 'peste_caravana', years: 6 }],
          },
        ],
        ai: 2,
      },
      {
        label: 'Pedir mapas y noticias de las rutas',
        hint: 'Saber del mundo: menos oro, más conocimiento.',
        fx: [{ t: 'knowledge', v: 0.2 }, { t: 'opinion', v: 5, who: 'all' }],
      },
      {
        label: 'Cobrar un peaje y dejarlos pasar',
        hint: 'Tasar al forastero: caro para ellos, poco amistoso para los mercaderes.',
        fx: [{ t: 'res', r: 'gold', v: 15, scale: 'era' }, { t: 'faction', f: 'merchants', v: -6 }, { t: 'faction', f: 'commoners', v: 3 }],
      },
    ],
  },
  {
    id: 'peste_caravana', title: 'La fiebre de la caravana', cat: 'disaster', art: 'plague', weight: 2, cooldown: 20,
    chainOnly: true, minEra: 1, ctxSettlement: 'largest',
    cond: (c) => c.flag('caravan_plague') > 0,
    text: 'Hace unas semanas llegaron a {settlement} unos mercaderes enfermos. Ahora las fiebres se extienden por los barrios bajos y los sacerdotes cuentan muertos en vez de ofrendas. Nadie sabe si la peste viajó con el oro o con las telas.',
    choices: [
      {
        label: 'Cuarentena estricta: cerrar las puertas del barrio',
        hint: 'Aislar a los enfermos. Duro, pero limita el contagio.',
        fx: [
          { t: 'flag', name: 'caravan_plague', v: 0 }, { t: 'pop', v: -0.03, where: 'ctx' },
          { t: 'mod', id: 'cuarentena', name: 'Cuarentena', years: 3, fx: { trade: -0.2 } },
          { t: 'faction', f: 'merchants', v: -8 },
        ],
        ai: 2,
      },
      {
        label: 'Quemar las ropas y las casas de los enfermos',
        hint: 'Fuego contra el mal. Destruye también lo que se podía salvar.',
        fx: [
          { t: 'flag', name: 'caravan_plague', v: 0 }, { t: 'destroy', cat: 'housing' },
          { t: 'pop', v: -0.01, where: 'ctx' }, { t: 'faction', f: 'commoners', v: -6 },
        ],
      },
      {
        label: 'Rezar en los templos',
        hint: 'La fe es buena medicina, aunque no siempre.',
        fx: [
          { t: 'flag', name: 'caravan_plague', v: 0 }, { t: 'faction', f: 'clergy', v: 10 },
          { t: 'chance', p: 0.5, label: '50%: la enfermedad sigue su curso', then: [{ t: 'pop', v: -0.05, where: 'ctx' }] },
        ],
      },
    ],
  },
  {
    id: 'veteranos_vuelven', title: 'Los veteranos vuelven', cat: 'war', art: 'army', weight: 1.5, cooldown: 30,
    chainOnly: true,
    cond: (c) => c.flag('campaign') > 0 && !c.atWar(),
    text: 'Los soldados que marcharon a la frontera vuelven a casa con vendas, cicatrices y la costumbre de la violencia. Algunos traen oro y cuentan batallas; otros regresan sin brazo y sin pensión. Las calles de {settlement} se llenan de historias que no todos quieren oír.',
    choices: [
      {
        label: 'Premiarles con tierras y pensiones', cost: { gold: 25 }, ...tiene('gold', 25),
        hint: 'La gratitud del reino, pagada en monedas.',
        fx: [{ t: 'flag', name: 'campaign', v: 0 }, { t: 'faction', f: 'warriors', v: 12 }, { t: 'faction', f: 'commoners', v: -4 }],
      },
      {
        label: 'Darles un discurso y poco más',
        hint: 'Honor sin oro. Los veteranos se acordarán.',
        fx: [{ t: 'flag', name: 'campaign', v: 0 }, { t: 'faction', f: 'warriors', v: -6 }, { t: 'stability', v: 1 }],
      },
      {
        label: 'Integrarlos en la guardia del pueblo',
        hint: 'Los soldados vuelven al trabajo, pero no al arado.',
        fx: [
          { t: 'flag', name: 'campaign', v: 0 },
          { t: 'mod', id: 'veteranos_guardia', name: 'Veteranos de guardia', years: 8, fx: { military: 0.1 } },
          { t: 'faction', f: 'commoners', v: -6 },
        ],
        ai: 2,
      },
    ],
  },
  {
    id: 'frontera_incidente', title: 'Cruzaron la línea de mojones', cat: 'war', art: 'army', weight: 1.5, cooldown: 20,
    needsOther: true, ctxSettlement: 'frontier',
    cond: (c) => enPaz(c) && c.settlements() > 1,
    text: 'Soldados de {other} han cruzado la línea de mojones junto a {settlement} y se han llevado ganado y dos pastores. Dicen que la hierba es de su pueblo desde antes de que existiera el mojón. Los pastores siguen sin volver.',
    choices: [
      {
        label: 'Protestar formalmente por escrito',
        hint: 'Palabras escritas, que cuestan poco y pueden costar mucho.',
        fx: [{ t: 'opinion', v: -6, who: 'other' }, { t: 'flag', name: 'border_protest' }],
        ai: 2,
      },
      {
        label: 'Responder con las armas',
        hint: 'Un castigo rápido. Y quizá no tan rápido.',
        fx: [{
          t: 'chance', p: 0.4, label: '40%: la respuesta enciende la guerra',
          then: [{ t: 'war', who: 'other' }, { t: 'flag', name: 'campaign' }, { t: 'chain', id: 'veteranos_vuelven', years: 8 }],
          else: [{ t: 'faction', f: 'warriors', v: 8 }, { t: 'opinion', v: -12, who: 'other' }],
        }],
      },
      {
        label: 'Pagar una compensación y recuperar el ganado', cost: { gold: 25 }, ...tiene('gold', 25),
        hint: 'Dinero por paz: el orgullo de los guerreros se queda en la hierba.',
        fx: [{ t: 'opinion', v: 6, who: 'other' }, { t: 'faction', f: 'warriors', v: -8 }, { t: 'faction', f: 'merchants', v: 4 }],
      },
    ],
  },
  // ───────────── Diplomacia con otra civilización
  {
    id: 'banquete_insulto', title: 'Una burla en el banquete', cat: 'diplomacy', art: 'festival', weight: 1.2, cooldown: 30,
    needsOther: true,
    cond: (c) => enPaz(c),
    text: '{otherLeader} se burló de las costumbres de este pueblo durante el banquete, con una frase que nadie esperaba. El salón entero se ha quedado en silencio y espera la respuesta del {title}.',
    choices: [
      {
        label: 'Responder con humor y pedir disculpas',
        hint: 'Un gesto civilizado que a algunos guerreros les sabe a derrota.',
        fx: [{ t: 'opinion', v: 8, who: 'other' }, { t: 'faction', f: 'warriors', v: -6 }],
        ai: 2,
      },
      {
        label: 'Responder con una burla más afilada',
        hint: 'Que se entienda: aquí no se consienten las burlas.',
        fx: [
          { t: 'opinion', v: -15, who: 'other' }, { t: 'faction', f: 'warriors', v: 8 },
          { t: 'chance', p: 0.2, label: '20%: la respuesta encoleriza a la corte rival', then: [{ t: 'war', who: 'other' }] },
        ],
      },
      {
        label: 'Dejarlo pasar sin decir nada',
        hint: 'La cortesía es una forma de paciencia.',
        fx: [{ t: 'opinion', v: -4, who: 'other' }, { t: 'stability', v: 1 }],
      },
    ],
  },
  {
    id: 'espias_extranjeros', title: 'Un escriba con demasiada curiosidad', cat: 'diplomacy', art: 'envoy', weight: 1, cooldown: 35,
    needsOther: true, ctxSettlement: 'capital',
    cond: (c) => !!c.other && c.has('writing'),
    text: 'Un escriba de {other} ha sido sorprendido copiando los planos de las murallas. Dice ser un comerciante de sal, pero sus notas están escritas con la letra de quien ya lo sabe todo.',
    choices: [
      {
        label: 'Expulsarle con escolta',
        hint: 'Un mensaje claro, sin ir más allá.',
        fx: [{ t: 'opinion', v: -10, who: 'other' }, { t: 'stability', v: 1 }],
        ai: 2,
      },
      {
        label: 'Alimentarle con informes falsos',
        hint: 'Engañar al enemigo: arriesgado, pero útil.',
        fx: [{
          t: 'chance', p: 0.6, label: '60%: se creen los informes',
          then: [{ t: 'opinion', v: -5, who: 'other' }],
          else: [{ t: 'opinion', v: -18, who: 'other' }],
        }],
      },
      {
        label: 'Ofrecerle un tratado de comercio por sus secretos',
        hint: 'Quien compra secretos también puede vender sal.',
        fx: [{ t: 'res', r: 'gold', v: 20, scale: 'era' }, { t: 'opinion', v: 3, who: 'other' }, { t: 'faction', f: 'scholars', v: -4 }],
      },
    ],
  },
  {
    id: 'boda_propuesta', title: 'Una propuesta de boda', cat: 'diplomacy', art: 'wedding', weight: 1, cooldown: 40,
    needsOther: true,
    cond: (c) => enPaz(c) && c.other !== null && (c.civ.relations[c.other.id]?.opinion ?? 0) > 20,
    text: 'Los embajadores de {other} traen una propuesta escrita en tablillas de cera: una hija de su casa real para el heredero de {civ}. Dicen que es una señal de amistad. El consejo sabe que también es un precio.',
    choices: [
      {
        label: 'Aceptar la boda',
        hint: 'Lazos de sangre: amistad duradera y herederos de dos pueblos.',
        fx: [
          { t: 'opinion', v: 15, who: 'other' }, { t: 'stability', v: 2 }, { t: 'flag', name: 'royal_marriage' },
          { t: 'chain', id: 'hijo_de_dos_pueblos', years: 14 },
        ],
        ai: 2,
      },
      {
        label: 'Rechazar con cortesía',
        hint: 'No es un no. Es un todavía no.',
        fx: [{ t: 'opinion', v: -5, who: 'other' }],
      },
      {
        label: 'Pedir una dote de oro y de piedra',
        hint: 'El amor se paga, y más si lo paga el otro.',
        fx: [
          { t: 'res', r: 'gold', v: 40, scale: 'era' }, { t: 'res', r: 'stone', v: 20, scale: 'era' },
          { t: 'opinion', v: -8, who: 'other' },
        ],
      },
    ],
  },
  {
    id: 'hijo_de_dos_pueblos', title: 'Un niño de dos pueblos', cat: 'leader', art: 'birth', weight: 2, cooldown: 30,
    chainOnly: true,
    cond: (c) => c.flag('royal_marriage') > 0,
    text: 'Ha nacido el primer hijo de la alianza de sangre con otro pueblo. Los sacerdotes cantan en el templo en dos lenguas a la vez, y en las calles nadie sabe si es un niño de paz o un heredero con dos lealtades.',
    choices: [
      {
        label: 'Reconocerle como heredero del trono',
        hint: 'Un príncipe de dos pueblos: el reino entero lo verá distinto.',
        fx: [
          { t: 'flag', name: 'royal_marriage', v: 0 }, { t: 'stability', v: 4 },
          { t: 'opinion', v: 8, who: 'all' }, { t: 'faction', f: 'clergy', v: -4 },
        ],
      },
      {
        label: 'Criarle en la corte, lejos de las disputas',
        hint: 'Un niño sin poder y sin enemigos, al menos de momento.',
        fx: [{ t: 'flag', name: 'royal_marriage', v: 0 }, { t: 'faction', f: 'scholars', v: 6 }, { t: 'faction', f: 'warriors', v: -4 }],
        ai: 2,
      },
      {
        label: 'Ocultar su origen extranjero',
        hint: 'Un secreto de palacio. Si sale a la luz, nadie lo olvidará.',
        fx: [{
          t: 'flag', name: 'royal_marriage', v: 0,
        }, {
          t: 'chance', p: 0.5, label: '50%: el secreto se mantiene',
          then: [{ t: 'stability', v: 2 }],
          else: [{ t: 'stability', v: -8 }, { t: 'faction', f: 'commoners', v: -8 }],
        }],
      },
    ],
  },
  {
    id: 'refugiados_otro', title: 'Carros en la frontera', cat: 'diplomacy', art: 'caravan', weight: 1.5, cooldown: 30,
    needsOther: true, ctxSettlement: 'frontier',
    cond: (c) => !!c.other && c.other.stability < 40,
    text: 'Familias enteras de {other} cruzan la frontera con los carros cargados de cacharros y de niños. Vienen de una tierra donde el hambre y la guerra se han repartido el año. Piden un techo y un poco de grano hasta la siguiente cosecha.',
    choices: [
      {
        label: 'Acogerlos en las aldeas de la frontera',
        hint: 'Brazos nuevos y bocas nuevas.',
        fx: [
          { t: 'pop', v: 0.02, where: 'ctx' }, { t: 'faction', f: 'commoners', v: 6 },
          { t: 'opinion', v: 10, who: 'other' }, { t: 'res', r: 'food', v: -15, scale: 'era' },
        ],
      },
      {
        label: 'Darles grano para que sigan camino', cost: { food: 30 }, ...tiene('food', 30),
        hint: 'Ayuda sin quedarse con ellos.',
        fx: [{ t: 'opinion', v: 12, who: 'other' }, { t: 'faction', f: 'commoners', v: 3 }],
        ai: 2,
      },
      {
        label: 'Cerrar la frontera',
        hint: 'Ver al vecino sufrir es una forma de seguridad. Poca.',
        fx: [{ t: 'opinion', v: -10, who: 'other' }, { t: 'faction', f: 'commoners', v: -6 }, { t: 'faction', f: 'warriors', v: 4 }],
      },
    ],
  },
  {
    id: 'reliquia_robada', title: 'El cuenco del altar', cat: 'religion', art: 'temple', weight: 1.2, cooldown: 35,
    needsOther: true,
    cond: (c) => !!c.other,
    text: 'Los sacerdotes han descubierto que el cuenco de plata del altar mayor ya no está. Un comerciante de {other} lo compró en la última feria, y dice haberlo heredado "por justicia". Piden que el {title} decida qué hacer.',
    choices: [
      {
        label: 'Exigir su devolución',
        hint: 'Una demanda formal que el otro reino recordará.',
        fx: [
          { t: 'opinion', v: -8, who: 'other' },
          {
            t: 'chance', p: 0.6, label: '60%: la reliquia vuelve a casa',
            then: [{ t: 'faction', f: 'clergy', v: 10 }, { t: 'flag', name: 'relic_returned' }, { t: 'chain', id: 'regalo_de_otro', years: 10 }],
            else: [{ t: 'faction', f: 'clergy', v: -6 }],
          },
        ],
      },
      {
        label: 'Pagar un rescate por la reliquia', cost: { gold: 30 }, ...tiene('gold', 30),
        hint: 'Dinero por el honor de los sacerdotes.',
        fx: [{ t: 'faction', f: 'clergy', v: 8 }, { t: 'opinion', v: 4, who: 'other' }],
        ai: 2,
      },
      {
        label: 'Dejarla donde esté: no vale una guerra',
        hint: 'Un santo que se marcha. El mundo no se acaba por eso.',
        fx: [{ t: 'faction', f: 'clergy', v: -10 }, { t: 'stability', v: -2 }],
      },
    ],
  },
  {
    id: 'regalo_de_otro', title: 'Un regalo tardío', cat: 'diplomacy', art: 'envoy', weight: 2, cooldown: 30,
    chainOnly: true,
    cond: (c) => c.flag('relic_returned') > 0,
    text: 'Los embajadores de otro reino llegan con un regalo a cambio de la reliquia devuelta: lingotes de bronce o un cofre de especias. Los sacerdotes desconfían de los regalos de quien antes robó.',
    choices: [
      {
        label: 'Aceptar el regalo con gratitud',
        hint: 'Metal para la corte y buena voluntad.',
        fx: [{ t: 'flag', name: 'relic_returned', v: 0 }, { t: 'res', r: 'metal', v: 12, scale: 'era' }, { t: 'stability', v: 2 }],
        ai: 2,
      },
      {
        label: 'Rechazarlo para no deberle nada',
        hint: 'Orgullo y deuda que no se paga. Los sacerdotes lo aplaudirán.',
        fx: [{ t: 'flag', name: 'relic_returned', v: 0 }, { t: 'faction', f: 'clergy', v: 6 }, { t: 'faction', f: 'merchants', v: -4 }],
      },
      {
        label: 'Negociar un acuerdo comercial con ellos',
        hint: 'Convertir el gesto en oro, y en rutas.',
        fx: [
          { t: 'flag', name: 'relic_returned', v: 0 }, { t: 'res', r: 'gold', v: 20, scale: 'era' },
          { t: 'faction', f: 'merchants', v: 6 }, { t: 'faction', f: 'clergy', v: -4 },
        ],
      },
    ],
  },
  // ───────────── Líder
  {
    id: 'enfermedad_lider', title: 'Fiebre en palacio', cat: 'leader', art: 'death', weight: 1.2, cooldown: 25,
    ctxSettlement: 'capital',
    cond: (c) => c.leaderAge() > 45 || c.trait('sickly'),
    text: '{leader} lleva tres días sin salir de sus aposentos. Tiene fiebre, manos temblorosas y un dolor en el costado que no se alivia con vino. Los cortesanos murmuran, los médicos discuten y el {title} aún no ha firmado la lista de tributos.',
    choices: [
      {
        label: 'Llamar al mejor médico de la corte', cost: { gold: 15 }, ...tiene('gold', 15),
        hint: 'Remedios caros, y un médico que se juega la cabeza.',
        fx: [{ t: 'leaderAge', v: -3 }, { t: 'legitimacy', v: 2 }],
        ai: 2,
      },
      {
        label: 'Confiar en el curandero del pueblo',
        hint: 'Hierbas, cantos y una apuesta contra la muerte.',
        fx: [{
          t: 'chance', p: 0.25, label: '25%: el líder no despierta',
          then: [{ t: 'killLeader' }],
          else: [{ t: 'leaderAge', v: -4 }, { t: 'faction', f: 'clergy', v: -4 }],
        }],
      },
      {
        label: 'Ocultar la enfermedad y gobernar desde la cama',
        hint: 'La corte no debe saber que el {title} tiembla.',
        fx: [{ t: 'legitimacy', v: -4 }, { t: 'stability', v: -2 }, { t: 'flag', name: 'hidden_illness' }],
      },
    ],
  },
  {
    id: 'amante_lider', title: 'Un romance en el mercado', cat: 'leader', art: 'wedding', weight: 0.8, cooldown: 40,
    cond: (c) => c.leaderAge() >= 25 && c.leaderAge() < 55,
    text: '{leader} ha sido visto saliendo al alba de la casa de una tejedora de {settlement}. Las lenguas ya lo cuentan en el mercado, y los consejeros se preguntan si el romance es un capricho o un plan.',
    choices: [
      {
        label: 'Reconocer el romance públicamente',
        hint: 'La sinceridad como arma. Los cortesanos no lo perdonarán.',
        fx: [{ t: 'faction', f: 'commoners', v: 8 }, { t: 'faction', f: 'warriors', v: -5 }, { t: 'trait', add: 'charismatic' }],
      },
      {
        label: 'Negarlo y apartar a la tejedora',
        hint: 'La corte lo sabe, pero nadie lo dice.',
        fx: [{ t: 'faction', f: 'clergy', v: 4 }, { t: 'stability', v: 1 }, { t: 'legitimacy', v: -2 }],
        ai: 2,
      },
      {
        label: 'Casarse con ella ante los dioses',
        hint: 'Un matrimonio sin dote, pero con un pueblo entero de testigos.',
        fx: [{ t: 'faction', f: 'commoners', v: 10 }, { t: 'faction', f: 'clergy', v: -6 }, { t: 'trait', add: 'generous' }],
      },
    ],
  },
  {
    id: 'duelo_lider', title: 'Desafío en la plaza', cat: 'leader', art: 'battle', weight: 1, cooldown: 35,
    cond: (c) => c.faction('warriors') > 40 && c.leaderAge() < 60,
    text: 'Un jefe de clan de {settlement}, enorme y tatuado, grita desafíos delante del {title}. Dice que el trono se gana con la lanza y no con tratados, y pide un duelo a muerte frente a todos los guerreros del reino.',
    choices: [
      {
        label: 'Aceptar el duelo',
        hint: 'Honor y riesgo: quien quede en pie reinará con más gloria.',
        fx: [{
          t: 'chance', p: 0.3, label: '30%: el líder cae',
          then: [{ t: 'killLeader' }],
          else: [{ t: 'trait', add: 'brave', remove: 'craven' }, { t: 'faction', f: 'warriors', v: 12 }, { t: 'legitimacy', v: 4 }],
        }],
      },
      {
        label: 'Enviar a un campeón de la guardia',
        hint: 'Que luche otro. La gloria es ajena, pero el resultado casi cuenta lo mismo.',
        fx: [{
          t: 'chance', p: 0.5, label: '50%: el campeón gana',
          then: [{ t: 'faction', f: 'warriors', v: 8 }],
          else: [{ t: 'faction', f: 'warriors', v: -10 }, { t: 'legitimacy', v: -4 }],
        }],
        ai: 2,
      },
      {
        label: 'Rechazar el duelo',
        hint: 'La corona no lucha con sus propios súbditos. El desprecio tiene precio.',
        fx: [{ t: 'trait', add: 'craven', remove: 'brave' }, { t: 'faction', f: 'warriors', v: -12 }, { t: 'legitimacy', v: -3 }],
      },
    ],
  },
  {
    id: 'locura_lider', title: 'Voces en la noche', cat: 'leader', art: 'stars', weight: 0.8, cooldown: 40,
    cond: (c) => c.leaderAge() > 55 || c.trait('paranoid'),
    text: '{leader} pasa las noches hablando con su difunto padre, y se despierta gritando que hay serpientes entre las sábanas. Los criados bajan la mirada cuando pasa, como si fuera a morder. Los consejeros temen que la locura sea contagiosa.',
    choices: [
      {
        label: 'Llamar a los sanadores y a los sabios', cost: { gold: 15 }, ...tiene('gold', 15),
        hint: 'Hierbas, hipnosis y consejo. A veces la mente vuelve.',
        fx: [{ t: 'trait', remove: 'paranoid' }, { t: 'stability', v: 3 }, { t: 'knowledge', v: 0.05 }],
        ai: 2,
      },
      {
        label: 'Encerrarle en un templo a dormir',
        hint: 'El clero tomará las riendas de los sueños.',
        fx: [{ t: 'faction', f: 'clergy', v: 10 }, { t: 'trait', add: 'pious' }, { t: 'legitimacy', v: -2 }],
      },
      {
        label: 'Dejar que el consejo gobierne en su nombre',
        hint: 'El trono sigue en pie. El mando, no.',
        fx: [{ t: 'legitimacy', v: -6 }, { t: 'faction', f: 'scholars', v: 6 }, { t: 'faction', f: 'warriors', v: -6 }],
      },
    ],
  },
  {
    id: 'vejez_lider', title: 'El trono y los años', cat: 'leader', art: 'death', weight: 1.2, cooldown: 30,
    cond: (c) => c.leaderAge() > 60,
    text: '{leader} tiene ya más años de los que los médicos creían posibles. Camina con bastón, olvida nombres y sigue firmando decretos con mano temblorosa. Todo el reino pregunta quién vendrá después.',
    choices: [
      {
        label: 'Nombrar ya al heredero',
        hint: 'Una sucesión ordenada, aunque el viejo no quiera.',
        fx: [{ t: 'stability', v: 4 }, { t: 'legitimacy', v: 5 }],
        ai: 2,
      },
      {
        label: 'Retirarse al templo a rezar',
        hint: 'Un anciano sabio que cede el trono a la fe.',
        fx: [{ t: 'faction', f: 'clergy', v: 12 }, { t: 'trait', add: 'pious' }, { t: 'legitimacy', v: -3 }],
      },
      {
        label: 'Aferrarse al trono hasta el final',
        hint: 'Mientras tenga aliento, gobernará. Su cuerpo, de pronto, parece obedecerle.',
        fx: [{ t: 'legitimacy', v: -5 }, { t: 'faction', f: 'warriors', v: 4 }, { t: 'leaderAge', v: -3 }],
      },
    ],
  },
];
