// Eventos de sistema: sucesiones, primer contacto, ofertas de paz, demandas, revueltas, cambio de era.
import type { EventDef, EventChoice, EventCtx } from './eventTypes';
import type { FactionId, Leader } from './types';
import { RNG } from '../core/rng';
import { makeLeader } from './leaders';
import { FACTIONS, GOV, TRAIT } from '../data/politics';
import { factionUnlocked } from './economy';
import { ERAS } from '../data/techs';

const FACTION_TRAIT: Record<FactionId, string[]> = {
  commoners: ['just', 'generous', 'reformer'],
  warriors: ['brave', 'ambitious', 'cruel'],
  clergy: ['pious', 'just', 'charismatic'],
  merchants: ['merchant', 'diplomat', 'greedy'],
  scholars: ['scholar', 'wise', 'reformer'],
};

function candidates(c: EventCtx, n: number): { f: FactionId; l: Leader }[] {
  const rng = new RNG(Number(c.data.seed ?? 1));
  const facs = (Object.keys(FACTIONS) as FactionId[]).filter((f) => factionUnlocked(c.civ, f));
  rng.shuffle(facs);
  const out: { f: FactionId; l: Leader }[] = [];
  for (const f of facs.slice(0, n)) {
    const l = makeLeader(rng, c.civ, c.year, { age: rng.int(34, 62) });
    const main = rng.pick(FACTION_TRAIT[f]);
    l.traits = [main, ...l.traits.filter((t) => t !== main && t !== TRAIT[main]?.opposite)].slice(0, 3);
    l.title = GOV[c.civ.government].title;
    out.push({ f, l });
  }
  return out;
}

function traitTxt(l: Leader) {
  return l.traits.map((t) => TRAIT[t]?.name ?? t).join(', ');
}

function crown(l: Leader, f: FactionId | null, legit: number): EventChoice['fx'] {
  return [
    {
      t: 'custom', label: `${l.name} gobernará (${traitTxt(l)})`,
      run: (c) => {
        c.civ.leader = { ...l, reignStart: c.year, legitimacy: legit };
        c.civ.heir = null;
        c.state.chronicle.push({ year: c.year, civ: c.civ.id, kind: 'leader', important: true, text: `${l.title} ${l.name} tomó el poder${f ? `, con el apoyo de ${FACTIONS[f].name.toLowerCase()}` : ''}.` });
      },
    },
  ];
}

export const SYSTEM_EVENTS: EventDef[] = [
  {
    id: 'sys_intro', title: 'El primer fuego', cat: 'culture', art: 'council', weight: 0, chainOnly: true,
    text: 'Cincuenta almas se reúnen alrededor del fuego en {settlement}. Los ancianos cuentan de dónde vino vuestro pueblo, y lo que elijan contar esta noche será lo que vuestros hijos crean durante siglos.',
    choices: [
      { label: 'Somos hijos del río', hint: 'El agua da la vida: un pueblo de sembradores.', fx: [{ t: 'mod', id: 'myth', name: 'Mito: hijos del río', years: 1000000, fx: { food: 0.1, growth: 0.2 } }, { t: 'faction', f: 'commoners', v: 8 }], log: 'Los {people} se proclamaron hijos del río.' },
      { label: 'Somos hijos de la piedra', hint: 'Lo que se construye, perdura: un pueblo de constructores.', fx: [{ t: 'mod', id: 'myth', name: 'Mito: hijos de la piedra', years: 1000000, fx: { construction: 0.2, stone: 0.15 } }], log: 'Los {people} se proclamaron hijos de la piedra.' },
      { label: 'Somos hijos de las estrellas', hint: 'El cielo guarda los secretos: un pueblo de sabios y soñadores.', fx: [{ t: 'mod', id: 'myth', name: 'Mito: hijos de las estrellas', years: 1000000, fx: { knowledge: 0.1, culture: 0.1 } }], log: 'Los {people} se proclamaron hijos de las estrellas.' },
      { label: 'Somos hijos del lobo', hint: 'Nadie nos regaló nada: un pueblo de guerreros.', fx: [{ t: 'mod', id: 'myth', name: 'Mito: hijos del lobo', years: 1000000, fx: { military: 0.2, borders: 0.2 } }, { t: 'faction', f: 'warriors', v: 10 }], log: 'Los {people} se proclamaron hijos del lobo.' },
    ],
  },
  {
    id: 'sys_election', title: 'Elecciones', cat: 'politics', art: 'council', weight: 0, chainOnly: true,
    text: '{old} ha muerto. Los ciudadanos de {civ} acuden a votar.',
    choices: [],
    build: (c) => {
      const cs = candidates(c, 3);
      return {
        text: `Tras la muerte de ${c.data.old}, la asamblea de ${c.civ.name} debe elegir a su nuevo ${GOV[c.civ.government].title.toLowerCase()}. Cada facción presenta a su candidato, y apoyar a uno significa decepcionar a los demás.`,
        choices: cs.map(({ f, l }) => ({
          label: `Votar a ${l.name}`,
          hint: `Candidato de ${FACTIONS[f].name.toLowerCase()}. ${l.age} años. ${traitTxt(l)}.`,
          fx: [...crown(l, f, 62), { t: 'faction', f, v: 15 }, ...cs.filter((x) => x.f !== f).map((x) => ({ t: 'faction' as const, f: x.f, v: -5 }))],
        })),
      };
    },
  },
  {
    id: 'sys_council', title: 'El consejo de ancianos', cat: 'politics', art: 'council', weight: 0, chainOnly: true,
    text: '',
    choices: [],
    build: (c) => {
      const cs = candidates(c, 2);
      return {
        text: `${c.data.old} ya no se sentará junto al fuego. Los ancianos de los clanes de ${c.civ.name} deliberan durante tres noches. Dos nombres suenan con fuerza.`,
        choices: [
          ...cs.map(({ f, l }) => ({
            label: `Elegir a ${l.name}`,
            hint: `Respaldado por ${FACTIONS[f].name.toLowerCase()}. ${l.age} años. ${traitTxt(l)}.`,
            fx: [...crown(l, f, 58), { t: 'faction' as const, f, v: 10 }],
          })),
          {
            label: 'Que decidan los augurios',
            hint: 'Dejar la elección en manos de los espíritus agrada al pueblo, pero el resultado es incierto.',
            fx: [{ t: 'stability', v: 4 }, ...crown(new RNG(Number(c.data.seed) + 7).chance(0.5) ? cs[0].l : (cs[1] ?? cs[0]).l, null, 66)],
          },
        ],
      };
    },
  },
  {
    id: 'sys_succession_crisis', title: 'Crisis sucesoria', cat: 'politics', art: 'crown', weight: 0, chainOnly: true,
    text: '',
    choices: [],
    build: (c) => {
      const heir = c.civ.heir;
      const rng = new RNG(Number(c.data.seed ?? 3));
      const noble = makeLeader(rng, c.civ, c.year, { age: rng.int(30, 50) });
      noble.traits = ['ambitious', ...noble.traits.filter((t) => t !== 'ambitious')].slice(0, 3);
      noble.title = GOV[c.civ.government].title;
      const choices: EventChoice[] = [];
      if (heir) {
        const young = heir.age < 16;
        choices.push({
          label: young ? `Coronar al niño ${heir.name} con un regente` : `Coronar a ${heir.name}, el heredero`,
          hint: young ? `Solo tiene ${heir.age} años. La legitimidad sufrirá hasta que crezca.` : `${heir.age} años. ${traitTxt(heir)}. La línea dinástica continúa.`,
          fx: [...crown({ ...heir, title: GOV[c.civ.government].title }, null, young ? 35 : 55), ...(young ? [{ t: 'mod' as const, id: 'regency', name: 'Regencia', years: 16 - heir.age, fx: { stability: -5, influenceFlat: -1 } }] : [])],
        });
      }
      choices.push({
        label: `Aceptar a ${noble.name}, el señor de la guerra`,
        hint: `${noble.age} años. ${traitTxt(noble)}. Los guerreros le adoran; otros le temen.`,
        fx: [...crown({ ...noble, dynasty: noble.dynasty }, 'warriors', 40), { t: 'faction', f: 'warriors', v: 15 }, { t: 'faction', f: 'commoners', v: -8 }, { t: 'stability', v: -5 }],
      });
      choices.push({
        label: 'Convocar una asamblea de notables',
        hint: 'Una solución de consenso: menos legitimidad, pero menos sangre.',
        cost: { influence: 20 },
        fx: [...crown(makeLeader(new RNG(Number(c.data.seed ?? 3) + 11), c.civ, c.year, { age: 50 }), null, 50), { t: 'stability', v: 3 }],
      });
      return {
        text: `La muerte de ${c.data.old} deja el trono de ${c.civ.name} en disputa. ${heir ? `El heredero, ${heir.name}, tiene ${heir.age} años.` : 'No hay un heredero claro.'} En los salones se afilan cuchillos.`,
        choices,
      };
    },
  },
  {
    id: 'sys_contact', title: 'Primer contacto', cat: 'diplomacy', art: 'envoy', weight: 0, chainOnly: true, needsOther: true,
    text: 'Nuestros exploradores han encontrado a otro pueblo: los {otherPeople} de {other}, gobernados por {otherLeader}. Hablan una lengua extraña, pero sus gestos son claros: esperan nuestra respuesta.',
    choices: [
      { label: 'Enviar regalos', hint: 'Empezar con buen pie cuesta algo de oro o comida.', cost: { food: 20 }, fx: [{ t: 'opinion', v: 20, label: 'Regalos de bienvenida' }], log: 'Los {people} recibieron a los {otherPeople} con regalos.' },
      { label: 'Intercambiar historias', hint: 'Compartir conocimientos acerca a ambos pueblos.', fx: [{ t: 'opinion', v: 8, label: 'Primer encuentro cordial' }, { t: 'knowledge', v: 0.1 }] },
      { label: 'Mostrar nuestras armas', hint: 'Que sepan desde el principio con quién tratan.', fx: [{ t: 'opinion', v: -15, label: 'Primer encuentro hostil' }, { t: 'faction', f: 'warriors', v: 8 }] },
    ],
  },
  {
    id: 'sys_peace_offer', title: 'Emisarios de paz', cat: 'diplomacy', art: 'envoy', weight: 0, chainOnly: true, needsOther: true,
    text: 'Una delegación de {other} cruza nuestras líneas bajo bandera blanca. {otherLeader} propone poner fin a la guerra.',
    choices: [],
    build: (c) => {
      const tribute = Number(c.data.tribute ?? 0);
      return {
        text: `Una delegación de ${c.other?.name} cruza nuestras líneas bajo bandera blanca. ${c.other?.leader.name} propone poner fin a la guerra${tribute > 0 ? ` y ofrece ${tribute} de oro como compensación` : tribute < 0 ? `, a cambio de ${-tribute} de oro` : ''}.`,
        choices: [
          { label: 'Aceptar la paz', hint: 'Los soldados vuelven a casa.', req: (k) => tribute >= 0 || k.civ.res.gold >= -tribute, reqText: 'No tienes oro suficiente', fx: [{ t: 'peace' }, { t: 'res', r: 'gold', v: tribute }], log: 'Los {people} y los {otherPeople} firmaron la paz.' },
          { label: 'Rechazarla', hint: 'La guerra continúa.', fx: [{ t: 'faction', f: 'warriors', v: 4 }, { t: 'faction', f: 'commoners', v: -4 }] },
        ],
      };
    },
  },
  {
    id: 'sys_demand', title: 'Una exigencia', cat: 'diplomacy', art: 'army', weight: 0, chainOnly: true, needsOther: true,
    text: '',
    choices: [],
    build: (c) => {
      const amount = Number(c.data.amount ?? 30);
      return {
        text: `Un heraldo de ${c.other?.name} llega a ${c.s.name} con un mensaje de ${c.other?.leader.name}: «Vuestro pueblo es débil y el nuestro fuerte. Entregad ${amount} de oro como tributo, o tomaremos lo que queramos.»`,
        choices: [
          { label: `Pagar ${amount} de oro`, hint: 'Humillante, pero evita la guerra… por ahora.', cost: { gold: amount }, fx: [{ t: 'faction', f: 'warriors', v: -10 }, { t: 'legitimacy', v: -5 }, { t: 'opinion', v: 10, label: 'Tributo pagado' }], log: 'Los {people} pagaron tributo a los {otherPeople}.' },
          { label: 'Rechazar la exigencia', hint: 'Puede significar guerra.', fx: [{ t: 'faction', f: 'warriors', v: 6 }, { t: 'opinion', v: -20, label: 'Rechazó nuestra exigencia' }, { t: 'chance', p: 0.55, label: '55%: declaran la guerra', then: [{ t: 'war' }] }], log: 'Los {people} rechazaron someterse a los {otherPeople}.' },
        ],
      };
    },
  },
  {
    id: 'sys_ai_proposal', title: 'Propuesta comercial', cat: 'economy', art: 'caravan', weight: 0, chainOnly: true, needsOther: true,
    text: 'Mercaderes de {other} llegan con muestras de sus productos. {otherLeader} propone abrir una ruta comercial permanente entre nuestros pueblos.',
    choices: [
      {
        label: 'Abrir la ruta', hint: 'Oro para ambos y acceso a sus lujos.',
        fx: [{ t: 'custom', label: 'Acuerdo comercial con ellos', run: (c) => { if (c.other) { c.civ.relations[c.other.id].trade = true; c.other.relations[c.civ.id].trade = true; } } }, { t: 'opinion', v: 5, label: 'Socio comercial' }],
        log: 'Se abrió una ruta comercial entre los {people} y los {otherPeople}.',
      },
      { label: 'Rehusar', hint: 'No nos fiamos de ellos.', fx: [{ t: 'opinion', v: -8, label: 'Rechazó comerciar' }] },
    ],
  },
  {
    id: 'sys_revolt', title: 'Revolución', cat: 'politics', art: 'riot', weight: 0, chainOnly: true,
    text: '',
    choices: [],
    build: (c) => {
      const govs = Object.values(GOV).filter((g) => g.id !== c.civ.government && (!g.tech || c.civ.techs.includes(g.tech)));
      const rng = new RNG(Number(c.data.seed ?? 5));
      const g = rng.pick(govs.length ? govs : Object.values(GOV));
      return {
        text: `Años de caos han agotado la paciencia de ${c.civ.name}. Las calles de ${c.s.name} arden y los rebeldes exigen el fin de ${GOV[c.civ.government].name.toLowerCase()}. Sus líderes proclaman ${g.name.toLowerCase()}.`,
        choices: [
          {
            label: `Ceder: aceptar ${g.name.toLowerCase()}`, hint: 'El orden vuelve, pero el poder cambia de manos.',
            fx: [{ t: 'custom', label: `Nuevo gobierno: ${g.name}`, run: (k) => { k.civ.government = g.id; k.civ.govChanged = k.year; k.civ.leader = { ...makeLeader(new RNG(Number(k.data.seed) + 3), k.civ, k.year), title: g.title, legitimacy: 50 }; k.civ.policies = k.civ.policies.slice(0, g.slots); } }, { t: 'stability', v: 25 }],
            log: 'Una revolución derribó el antiguo régimen de los {people}.',
          },
          {
            label: 'Aplastar la revuelta', hint: 'Sangre en las calles. Si los soldados no bastan, perderemos mucho.',
            fx: [{ t: 'chance', p: Math.min(0.85, 0.3 + c.civ.soldiers / Math.max(1, c.pop()) * 4), label: 'Depende de la fuerza de tus soldados', then: [{ t: 'stability', v: 12 }, { t: 'faction', f: 'commoners', v: -15 }, { t: 'faction', f: 'warriors', v: 10 }, { t: 'pop', v: -0.06 }], else: [{ t: 'pop', v: -0.12 }, { t: 'killLeader' }, { t: 'stability', v: 10 }] }],
            log: '{leader} ordenó aplastar la revuelta de {settlement}.',
          },
          {
            label: 'Concesiones y pan', hint: 'Repartir riqueza para calmar los ánimos.', cost: { gold: Math.round(20 + c.pop() * 0.1) },
            fx: [{ t: 'stability', v: 15 }, { t: 'faction', f: 'commoners', v: 15 }, { t: 'legitimacy', v: -10 }],
          },
        ],
      };
    },
  },
  {
    id: 'sys_era', title: 'Una nueva era', cat: 'culture', art: 'stars', weight: 0, chainOnly: true,
    text: '',
    choices: [],
    build: (c) => {
      const era = Number(c.data.era ?? c.era);
      const name = ERAS[era]?.name ?? '';
      return {
        title: name,
        text: `Los ${c.civ.people} han entrado en la ${name}. Los ancianos dicen que cada era deja su huella en el carácter de un pueblo. ¿Qué espíritu guiará esta nueva etapa?`,
        choices: [
          { label: 'Espíritu de prosperidad', hint: 'Crecimiento y abundancia.', fx: [{ t: 'mod', id: `era${era}`, name: `Prosperidad (${ERAS[era]?.short})`, years: 60, fx: { food: 0.1, growth: 0.3, goods: 0.1 } }] },
          { label: 'Espíritu de conocimiento', hint: 'Saber y cultura.', fx: [{ t: 'mod', id: `era${era}`, name: `Conocimiento (${ERAS[era]?.short})`, years: 60, fx: { knowledge: 0.15, culture: 0.1 } }] },
          { label: 'Espíritu de poder', hint: 'Fuerza e influencia.', fx: [{ t: 'mod', id: `era${era}`, name: `Poder (${ERAS[era]?.short})`, years: 60, fx: { military: 0.2, influenceFlat: 1.5 } }] },
        ],
      };
    },
  },
  {
    id: 'sys_famine', title: 'Hambruna', cat: 'disaster', art: 'famine', weight: 0, chainOnly: true,
    text: 'Los graneros de {civ} están vacíos. Las familias comen raíces y corteza; los más débiles empiezan a morir. Hay que actuar.',
    choices: [
      { label: 'Racionar con mano dura', hint: 'Repartir lo poco que hay. Duro pero justo.', fx: [{ t: 'mod', id: 'rationing', name: 'Racionamiento', years: 5, fx: { growth: -0.5, stability: -3, foodFlat: 6 } }] },
      { label: 'Sacrificar los rebaños y semillas', hint: 'Comida ahora, menos cosecha después.', fx: [{ t: 'res', r: 'food', v: 25, scale: 'pop' }, { t: 'mod', id: 'seedcorn', name: 'Semilla consumida', years: 6, fx: { food: -0.12 } }] },
      { label: 'Comprar grano', hint: 'El oro se come también.', req: (c) => c.civ.res.gold >= 30, reqText: 'Necesitas 30 de oro', cost: { gold: 30 }, fx: [{ t: 'res', r: 'food', v: 18, scale: 'pop' }, { t: 'faction', f: 'commoners', v: 6 }] },
    ],
  },
];
