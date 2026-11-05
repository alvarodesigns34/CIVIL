// Definiciones de personajes ilustres (sin dependencias del motor de eventos, para evitar ciclos)
import type { EventDef, EventChoice } from '../sim/eventTypes';
import { civSettlements, tilesOfSettlement } from '../sim/world';

export const GP_TYPES = ['scholar', 'artist', 'merchant', 'general', 'prophet', 'engineer'] as const;
export type GPType = (typeof GP_TYPES)[number];

export const GP_INFO: Record<GPType, { name: string; plural: string; title: string; desc: string; color: string }> = {
  scholar: { name: 'Sabio', plural: 'Sabios', title: 'el Sabio', desc: 'Nacen donde hay escribas, academias y saber.', color: '#4a5a9a' },
  artist: { name: 'Artista', plural: 'Artistas', title: 'el Artista', desc: 'Nacen de la cultura: monumentos, templos y teatros.', color: '#8a4a8a' },
  merchant: { name: 'Mercader', plural: 'Mercaderes', title: 'el Mercader', desc: 'Nacen del comercio, los mercados y las rutas.', color: '#2f6f6a' },
  general: { name: 'Caudillo', plural: 'Caudillos', title: 'el Caudillo', desc: 'Nacen en ejércitos grandes y, sobre todo, en la guerra.', color: '#a23b2a' },
  prophet: { name: 'Profeta', plural: 'Profetas', title: 'el Profeta', desc: 'Nacen de la fe: santuarios, templos y un clero satisfecho.', color: '#b88a22' },
  engineer: { name: 'Ingeniero', plural: 'Ingenieros', title: 'el Ingeniero', desc: 'Nacen de la piedra, la madera y las grandes obras.', color: '#6b5b48' },
};

function choicesFor(type: GPType): EventChoice[] {
  switch (type) {
    case 'scholar':
      return [
        { label: 'Escribir un gran tratado', hint: 'Un salto inmediato en la investigación actual.', fx: [{ t: 'knowledge', v: 0.8 }], log: '{name} escribió un tratado que cambió el pensamiento de los {people}.' },
        { label: 'Fundar una escuela', hint: 'Menos brillo hoy, más sabios mañana.', fx: [{ t: 'mod', id: 'gp_school', name: 'Escuela de {name}', years: 60, fx: { knowledge: 0.12 } }, { t: 'faction', f: 'scholars', v: 10 }], log: '{name} fundó una escuela que formó a generaciones.', ai: 2 },
      ];
    case 'artist':
      return [
        { label: 'Crear una obra maestra', hint: 'Orgullo colectivo y cultura a raudales.', fx: [{ t: 'culture', v: 0.9 }, { t: 'stability', v: 8 }], log: 'La obra maestra de {name} maravilló a los {people}.' },
        { label: 'Embellecer la capital', hint: 'Un taller de artistas que durará décadas.', fx: [{ t: 'mod', id: 'gp_art', name: 'Taller de {name}', years: 60, fx: { culture: 0.2, stability: 3 } }], log: '{name} llenó la capital de frescos y estatuas.', ai: 2 },
      ];
    case 'merchant':
      return [
        { label: 'Gran expedición comercial', hint: 'Una fortuna en oro, de una vez.', fx: [{ t: 'res', r: 'gold', v: 80, scale: 'era' }], log: 'La expedición de {name} volvió cargada de oro.' },
        { label: 'Fundar una casa de comercio', hint: 'Mejores tratos durante décadas.', fx: [{ t: 'mod', id: 'gp_trade', name: 'Casa de {name}', years: 60, fx: { trade: 0.3, gold: 0.1 } }, { t: 'faction', f: 'merchants', v: 10 }], log: '{name} fundó una casa de comercio famosa en todo el mundo.', ai: 2 },
      ];
    case 'general':
      return [
        { label: 'Ponerle al frente del ejército', hint: 'Veinte años de victorias probables.', fx: [{ t: 'mod', id: 'gp_general', name: 'Mando de {name}', years: 20, fx: { military: 0.35 } }, { t: 'faction', f: 'warriors', v: 12 }], log: '{name} tomó el mando de los ejércitos de los {people}.', ai: 2 },
        { label: 'Fortificar las fronteras', hint: 'Todas las ciudades mejoran sus defensas un nivel.', fx: [{ t: 'custom', label: 'Todas tus ciudades suben un nivel de murallas', run: (c) => { for (const s of civSettlements(c.state, c.civ.id)) s.fort = Math.min(3, s.fort + 1); } }], log: '{name} levantó murallas en todo el territorio.' },
      ];
    case 'prophet':
      return [
        { label: 'Predicar al pueblo', hint: 'Fervor, estabilidad y un clero entregado.', fx: [{ t: 'stability', v: 12 }, { t: 'faction', f: 'clergy', v: 18 }, { t: 'legitimacy', v: 10 }], log: 'Las palabras de {name} encendieron la fe de los {people}.' },
        { label: 'Escribir las escrituras', hint: 'Una fe organizada que perdura generaciones.', fx: [{ t: 'mod', id: 'gp_faith', name: 'Escrituras de {name}', years: 80, fx: { stability: 5, culture: 0.1, faction: { clergy: 8 } } }], log: '{name} puso por escrito la fe de los {people}.', ai: 2 },
      ];
    case 'engineer':
      return [
        { label: 'Acelerar todas las obras', hint: 'Todo lo que está en construcción avanza de golpe.', fx: [{ t: 'custom', label: 'Las obras en curso avanzan un 60%', run: (c) => { for (const s of civSettlements(c.state, c.civ.id)) for (const [, , t] of tilesOfSettlement(c.state, s)) if (t.b && t.b.progress < 1) t.b.progress = Math.min(0.999, t.b.progress + 0.6); } }], log: '{name} dirigió las obras con mano maestra.', ai: 2 },
        { label: 'Enseñar su oficio', hint: 'Constructores más rápidos durante décadas.', fx: [{ t: 'mod', id: 'gp_eng', name: 'Escuela de {name}', years: 60, fx: { construction: 0.3, stone: 0.15 } }], log: '{name} formó a los mejores constructores de su tiempo.' },
      ];
  }
}

export const GREAT_EVENT: EventDef = {
  id: 'sys_great', title: 'Ha nacido un personaje ilustre', cat: 'culture', art: 'birth', weight: 0, chainOnly: true,
  text: '',
  choices: [],
  build: (c) => {
    const t = (c.data.type as GPType) ?? 'scholar';
    const info = GP_INFO[t];
    const flavor: Record<GPType, string> = {
      scholar: 'Desde niño hacía preguntas que nadie sabía responder. Ahora es él quien responde las de todos.',
      artist: 'Sus manos convierten el barro y el pigmento en algo que hace llorar a los ancianos.',
      merchant: 'Habla cinco lenguas, conoce cada camino y cada puerto, y nunca ha perdido un trato.',
      general: 'Los soldados le seguirían hasta el fin del mundo. Algunos dicen que ya lo han hecho.',
      prophet: 'Dicen que los dioses le hablan en sueños. Lo cierto es que la gente le escucha despierta.',
      engineer: 'Mide el mundo con cuerdas y estacas, y donde mira se levantan puentes y murallas.',
    };
    return {
      title: `${c.data.name} ${info.title}`,
      text: `Entre los ${c.civ.people} ha surgido una figura extraordinaria: ${c.data.name}, ${info.name.toLowerCase()}. ${flavor[t]} ¿Cómo aprovecharemos su talento?`,
      choices: choicesFor(t).map((ch) => ({
        ...ch,
        fx: ch.fx.map((e) => (e.t === 'mod' ? { ...e, name: e.name.replace('{name}', String(c.data.name)) } : e)),
        log: ch.log?.replace('{name}', String(c.data.name)),
      })),
    };
  },
};
