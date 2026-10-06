import { distanciaKm, type Coordenada } from '../valor/coordenada.js';

/** Un punto de GPS del camión. */
export type PuntoGps = {
  readonly lat: number;
  readonly lng: number;
  readonly precisionM?: number;
  readonly velocidadMs?: number;
  readonly tomadoEn: Date;
};

/** A cuántos metros del pin se considera «en la puerta». */
export const RADIO_LLEGADA_M = 60;
/** Un punto con más error que esto no sirve para decir que el camión llegó. */
export const PRECISION_MAXIMA_LLEGADA_M = 50;
/** El camión debe quedarse al menos esto cerca del pin: así pasar de largo no cuenta como llegada. */
export const PERMANENCIA_MINIMA_S = 40;
/** Si todos los puntos del tramo van a más de esta velocidad (m/s ≈ 14 km/h) es un camión en marcha, no detenido. */
const VELOCIDAD_DETENIDO_MS = 4;

const cerca = (p: PuntoGps, destino: Coordenada): boolean =>
  (p.precisionM === undefined || p.precisionM <= PRECISION_MAXIMA_LLEGADA_M) && distanciaKm(p, destino) * 1000 <= RADIO_LLEGADA_M;

/**
 * ¿El camión llegó a este pin? Sí si hubo un tramo seguido de puntos cerca del pin (con buena precisión) que duró al menos
 * `PERMANENCIA_MINIMA_S` y en el que no iba corriendo. Devuelve el punto en que se confirmó la llegada (el primero del tramo).
 * `puntos` debe venir ordenado de más antiguo a más reciente.
 */
export const detectarLlegada = (puntos: readonly PuntoGps[], destino: Coordenada): PuntoGps | undefined => {
  let tramo: PuntoGps[] = [];
  const confirma = (): PuntoGps | undefined => {
    const primero = tramo[0];
    const ultimo = tramo[tramo.length - 1];
    if (!primero || !ultimo || tramo.length < 2) return undefined;
    if ((ultimo.tomadoEn.getTime() - primero.tomadoEn.getTime()) / 1000 < PERMANENCIA_MINIMA_S) return undefined;
    const enMarcha = tramo.every((p) => p.velocidadMs !== undefined && p.velocidadMs > VELOCIDAD_DETENIDO_MS);
    return enMarcha ? undefined : primero;
  };
  for (const p of puntos) {
    if (cerca(p, destino)) tramo.push(p);
    else {
      const r = confirma();
      if (r) return r;
      tramo = [];
    }
  }
  return confirma();
};
