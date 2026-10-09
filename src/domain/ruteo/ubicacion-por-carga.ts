import { resolverComuna } from '../comunas.js';
import type { Coordenada } from '../valor/coordenada.js';

/** Una factura del día con ubicación conocida (pin del local o, si ya se entregó, donde se entregó) y su lugar en el orden de carga. */
export type AnclaDeCarga = { readonly orden: number; readonly comuna: string; readonly coordenada: Coordenada };

const mismaComuna = (a: string, b: string): boolean => (resolverComuna(a) ?? a.trim().toLowerCase()) === (resolverComuna(b) ?? b.trim().toLowerCase());

/**
 * Dónde está, aproximadamente, una parada sin pin: el chofer carga las facturas casi en el orden en que va a entregar (correlación 0,8–0,9 en
 * las rutas reales), así que se ubica entre las facturas de su misma comuna con ubicación conocida que se cargaron justo antes y justo
 * después, en proporción a su lugar en la carga. Si solo hay una de las dos, en esa. Si no hay ninguna, no se sabe (`undefined`): queda el
 * centro de la comuna.
 *
 * En las rutas reales del 6 y 7 de octubre (la mayoría de las paradas sin pin) la siguiente parada sugerida pasó de coincidir con la del
 * chofer el 17 % de las veces (todas en el centro de la comuna) al 41 %.
 */
export const ubicarPorOrdenDeCarga = (parada: { readonly orden: number; readonly comuna: string }, anclas: readonly AnclaDeCarga[]): Coordenada | undefined => {
  let antes: AnclaDeCarga | undefined;
  let despues: AnclaDeCarga | undefined;
  for (const a of anclas) {
    if (!mismaComuna(a.comuna, parada.comuna) || a.orden === parada.orden) continue;
    if (a.orden < parada.orden && (antes === undefined || a.orden > antes.orden)) antes = a;
    if (a.orden > parada.orden && (despues === undefined || a.orden < despues.orden)) despues = a;
  }
  if (antes && despues) {
    const f = (parada.orden - antes.orden) / (despues.orden - antes.orden);
    return {
      lat: antes.coordenada.lat + f * (despues.coordenada.lat - antes.coordenada.lat),
      lng: antes.coordenada.lng + f * (despues.coordenada.lng - antes.coordenada.lng),
    };
  }
  const una = antes ?? despues;
  return una ? { lat: una.coordenada.lat, lng: una.coordenada.lng } : undefined;
};
