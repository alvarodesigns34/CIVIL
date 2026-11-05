import { RNG } from '../core/rng';

// Estilos culturales: cada civilización genera nombres coherentes con su "lengua".
export interface CultureStyle {
  id: string;
  onset: string[];
  nucleus: string[];
  coda: string[];
  endings: string[]; // para asentamientos
  personEndM: string[];
  dynasty: string[];
}

export const CULTURES: CultureStyle[] = [
  { id: 'river', onset: ['k', 'n', 'm', 's', 'sh', 'r', 'd', 'b', 'z', 'l'], nucleus: ['a', 'u', 'i', 'e', 'aa'], coda: ['', 'n', 'r', 'sh', 'm'], endings: ['ur', 'ash', 'ana', 'ipur', 'ek', 'esh', 'umma'], personEndM: ['ad', 'ur', 'il', 'anu', 'ish'], dynasty: ['de los Juncos', 'del Río Lento', 'de la Tablilla', 'del León Alado'] },
  { id: 'steppe', onset: ['t', 'k', 'b', 'q', 'y', 'ch', 'or', 'g', 'temu'], nucleus: ['a', 'o', 'u', 'e', 'ai'], coda: ['', 'n', 'r', 'k', 'gh', 'l'], endings: ['khan', 'tai', 'ur', 'gol', 'tash', 'ar', 'ak'], personEndM: ['ai', 'ur', 'ek', 'gan', 'tai'], dynasty: ['del Lobo Gris', 'del Halcón', 'de las Mil Yeguas', 'del Cielo Azul'] },
  { id: 'forest', onset: ['br', 'th', 'g', 'v', 'fr', 'h', 'w', 'sk', 'ul', 'a'], nucleus: ['a', 'e', 'o', 'i', 'ei', 'au'], coda: ['', 'n', 'r', 'ld', 'th', 'rk'], endings: ['heim', 'gard', 'vik', 'by', 'stad', 'mark', 'holm'], personEndM: ['ulf', 'rik', 'mund', 'ar', 'bjorn'], dynasty: ['del Fresno', 'del Oso Pardo', 'de la Runa', 'del Cuervo'] },
  { id: 'sea', onset: ['th', 'p', 'k', 'l', 'm', 'ph', 'al', 'e', 'd', 'kr'], nucleus: ['a', 'e', 'o', 'i', 'eo', 'y'], coda: ['', 's', 'n', 'r', 'x'], endings: ['os', 'ia', 'ene', 'ion', 'eia', 'opolis', 'ai'], personEndM: ['os', 'ion', 'eus', 'ides', 'as'], dynasty: ['de la Ola', 'del Delfín', 'de la Concha', 'del Faro'] },
  { id: 'mountain', onset: ['qu', 'p', 't', 'ch', 'w', 'h', 'y', 'm', 'c', 'inti'], nucleus: ['a', 'i', 'u', 'ua', 'ay'], coda: ['', 'n', 'q', 'y', 'l'], endings: ['pampa', 'marca', 'cocha', 'huasi', 'llacta', 'pata', 'tambo'], personEndM: ['ac', 'pa', 'qui', 'yupa', 'uri'], dynasty: ['del Cóndor', 'del Sol Naciente', 'de la Piedra Viva', 'del Puma'] },
  { id: 'desert', onset: ['s', 'kh', 'z', 'm', 'q', 'h', 'n', 'r', 'al', 'j'], nucleus: ['a', 'i', 'u', 'aa', 'ei'], coda: ['', 'r', 'd', 'm', 'b', 'n'], endings: ['abad', 'ara', 'iyya', 'an', 'udh', 'ir', 'kand'], personEndM: ['im', 'ad', 'ir', 'un', 'ar'], dynasty: ['del Oasis', 'de la Duna', 'del Escorpión', 'de la Estrella Fija'] },
  { id: 'jungle', onset: ['tz', 'x', 'k', 'ch', 'y', 'b', 'p', 'ix', 'na'], nucleus: ['a', 'e', 'i', 'o', 'u'], coda: ['', 'l', 'k', 'n', 'tz', 'm'], endings: ['tlan', 'apan', 'kal', 'tun', 'ek', 'ich', 'umal'], personEndM: ['tl', 'ak', 'ich', 'im', 'ok'], dynasty: ['del Jaguar', 'de la Serpiente Emplumada', 'del Quetzal', 'de la Ceiba'] },
];

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function syllable(rng: RNG, c: CultureStyle, coda = true) {
  return rng.pick(c.onset) + rng.pick(c.nucleus) + (coda && rng.chance(0.4) ? rng.pick(c.coda) : '');
}

export function makeRoot(rng: RNG, c: CultureStyle) {
  const n = rng.chance(0.6) ? 2 : 1;
  let s = '';
  for (let i = 0; i < n; i++) s += syllable(rng, c, i === n - 1);
  return s.replace(/(.)\1\1/g, '$1$1');
}

export function settlementName(rng: RNG, c: CultureStyle) {
  return cap(makeRoot(rng, c) + (rng.chance(0.65) ? rng.pick(c.endings) : ''));
}

export function personName(rng: RNG, c: CultureStyle) {
  return cap(syllable(rng, c, false) + (rng.chance(0.5) ? syllable(rng, c, false) : '') + rng.pick(c.personEndM));
}

export const CIV_COLORS: [string, string][] = [
  ['#b4432a', '#f1d9a8'], // bermellón
  ['#2f6f6a', '#e7dcc0'], // verdete
  ['#4a5a9a', '#ece3cd'], // índigo
  ['#7f3f6b', '#f0dfc6'], // púrpura de murex
  ['#b58a24', '#2b2119'], // ocre
  ['#3f6b2f', '#efe4cc'], // musgo
  ['#30353f', '#e6c87a'], // pizarra
];

export const PEOPLE_SUFFIX = ['ios', 'enses', 'itas', 'anos', 'eos', 'icos'];
export const STATE_NAMES = ['Tribu', 'Clanes', 'Pueblo', 'Confederación'];
