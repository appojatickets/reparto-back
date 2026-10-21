import { normalizarTexto } from '../entidades/local.js';
import { direccionParaBuscar } from './direccion-busqueda.js';

/** La calle (o camino) de una dirección, escrita siempre igual, y el número de la puerta si lo trae. */
export type CalleYNumero = { readonly calle: string; readonly numero?: number };

const TIPO_DE_VIA = /^(?:avenida|calle|pasaje|camino|callejon|ruta)\s+/;
// Lo que sigue al número y no es la puerta: «Block 4», «Torre B», «Piso 3»…
const COMPLEMENTO = /\b(?:block|bloque|blk|torre|piso|bodega|bod|esquina|esq)\.?\s*[\dA-Za-z-]*/gi;

/**
 * Separa «Av. Providencia 1234 Of 5» en la calle («providencia») y el número (1234): sirve para saber qué facturas están en la misma calle y en
 * qué orden quedan a lo largo de ella. «Avenida», «calle», «pasaje»… no cuentan, así «Av. Los Leones 45» y «Los Leones 120» son la misma calle.
 * El número es el último que cierra la dirección («5 de Abril 1234» → calle «5 de abril», número 1234); si no cierra con un número (S/N,
 * «Camino El Alba») no hay número. Devuelve undefined si no se reconoce una calle.
 */
export const calleYNumero = (direccion: string, comuna?: string): CalleYNumero | undefined => {
  const buscable = direccionParaBuscar(direccion);
  if (buscable === undefined) return undefined;
  let t = normalizarTexto(buscable.replace(COMPLEMENTO, ' '));
  // Si la dirección termina con la comuna («… 123 Maipú»), no es parte de la calle.
  const c = comuna !== undefined ? normalizarTexto(comuna) : '';
  if (c !== '' && t.endsWith(` ${c}`)) t = t.slice(0, -(c.length + 1)).trim();
  const m = /^(.*?)\s+(\d{1,6})$/.exec(t);
  const nombre = (m?.[1] ?? t).replace(TIPO_DE_VIA, '').trim();
  // Una «calle» sin letras («123», «5») no sirve: no se sabe cuál es.
  if (!/\p{L}{3,}/u.test(nombre)) return undefined;
  return m?.[2] !== undefined ? { calle: nombre, numero: Number(m[2]) } : { calle: nombre };
};
