import { distanciaKm, type Coordenada } from '../valor/coordenada.js';

/** Una posición de GPS tomada al avisar ENTREGADO. */
export type PosicionDeEntrega = { readonly lat: number; readonly lng: number; readonly precisionM?: number };

/** Con GPS más impreciso que esto una entrega no sirve para mover un pin. */
export const PRECISION_AJUSTE_PIN_M = 50;
/** Cuántas de las últimas entregas se miran para decidir dónde queda el pin. */
export const ENTREGAS_PARA_PIN = 5;
/** Dos entregas «coinciden» si quedaron a menos de esta distancia una de otra. */
export const RADIO_ACUERDO_PIN_M = 60;

const mediana = (v: readonly number[]): number => {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? (o[m] ?? 0) : ((o[m - 1] ?? 0) + (o[m] ?? 0)) / 2;
};

export const posicionSirveParaPin = (p: PosicionDeEntrega): boolean => p.precisionM !== undefined && p.precisionM <= PRECISION_AJUSTE_PIN_M;

/**
 * Dónde queda el pin de un local según dónde se avisó ENTREGADO (la más reciente primero). Mientras el pin no esté verificado, el lugar
 * real de las entregas manda sobre el que había: con una sola entrega, ese punto; con varias, el punto donde coinciden la mayoría (la
 * mediana del grupo más grande; si empatan, el más reciente), así una entrega avisada desde otro lado no arrastra el pin.
 */
export const pinPorEntregas = (recientesPrimero: readonly PosicionDeEntrega[]): Coordenada | undefined => {
  const buenas = recientesPrimero.filter(posicionSirveParaPin).slice(0, ENTREGAS_PARA_PIN);
  if (buenas.length === 0) return undefined;
  let mejor: readonly PosicionDeEntrega[] = [];
  for (const candidata of buenas) {
    const grupo = buenas.filter((p) => distanciaKm(p, candidata) * 1000 <= RADIO_ACUERDO_PIN_M);
    if (grupo.length > mejor.length) mejor = grupo; // al empatar queda la más reciente (se recorre de la más reciente a la más antigua)
  }
  return { lat: mediana(mejor.map((p) => p.lat)), lng: mediana(mejor.map((p) => p.lng)) };
};
