import type { ParadaRuta, ProblemaRuta } from './tipos.js';
import { DEPOSITO, ORIGEN, periodoDelMinuto, viajeConCambioDePeriodo } from './tiempos.js';

/**
 * Representación numérica del problema para el motor: paradas = 0..n-1, origen = n, depósito = n+1.
 * Precalcula una matriz por período (ya multiplicada por el ritmo) para que evaluar una ruta no llame a nada externo.
 *
 * Un tramo que cruza un cambio de período avanza a la velocidad de cada período por la parte que le toca (modelo de Ichoua, Gendreau y
 * Potvin): así salir más tarde nunca hace llegar antes, cosa que pasaba al usar la velocidad de la salida para todo el tramo.
 */
export type Compilado = {
  readonly problema: ProblemaRuta;
  readonly n: number;
  readonly paradas: readonly ParadaRuta[];
  readonly indice: ReadonlyMap<string, number>;
  readonly servicio: Float64Array;
  readonly prioridad: Uint8Array;
  /** Lugar de cada parada en el orden de carga entre las de este problema (0..n-1), o -1 si no se sabe. */
  readonly rangoCarga: Int32Array;
  readonly origen: number;
  readonly deposito: number;
  readonly salida: number;
  viaje(de: number, a: number, minuto: number): number;
};

export const compilar = (problema: ProblemaRuta): Compilado => {
  const n = problema.paradas.length;
  const nodos = n + 2;
  const idNodo = (i: number): string => (i < n ? (problema.paradas[i]?.id ?? '') : i === n ? ORIGEN : DEPOSITO);
  const { cortes } = problema.tiempos;
  const periodos = cortes.length + 1;

  const caches: Float64Array[] = [];
  for (let p = 0; p < periodos; p++) {
    const minuto = p === 0 ? 0 : (cortes[p - 1] ?? 0);
    const matriz = new Float64Array(nodos * nodos);
    for (let i = 0; i < nodos; i++) {
      for (let j = 0; j < nodos; j++) {
        if (i !== j) matriz[i * nodos + j] = problema.tiempos.tiempo(idNodo(i), idNodo(j), minuto) * problema.ritmo;
      }
    }
    caches.push(matriz);
  }

  const viaje = (de: number, a: number, minuto: number): number => {
    const k = de * nodos + a;
    const p = periodoDelMinuto(cortes, minuto);
    const directo = caches[p]?.[k] ?? 0;
    // Lo común: el tramo termina dentro del mismo período (no hace falta repartirlo).
    if (periodos === 1 || directo <= 0 || minuto + directo <= minuto - (((minuto % 1440) + 1440) % 1440) + (cortes[p] ?? 1440)) return directo;
    return viajeConCambioDePeriodo(cortes, minuto, (q) => caches[q]?.[k] ?? 0);
  };

  const rangoCarga = new Int32Array(n).fill(-1);
  const conCarga = problema.paradas.flatMap((p, i) => (p.ordenCarga !== undefined ? [{ i, orden: p.ordenCarga }] : [])).sort((a, b) => a.orden - b.orden || a.i - b.i);
  conCarga.forEach((x, rango) => { rangoCarga[x.i] = rango; });

  return {
    problema,
    n,
    paradas: problema.paradas,
    indice: new Map(problema.paradas.map((p, i) => [p.id, i])),
    servicio: Float64Array.from(problema.paradas, (p) => p.servicioMin),
    prioridad: Uint8Array.from(problema.paradas, (p) => (p.prioridad ? 1 : 0)),
    rangoCarga,
    origen: n,
    deposito: n + 1,
    salida: problema.salida,
    viaje,
  };
};

export const conSalida = (c: Compilado, salida: number): Compilado => ({ ...c, salida });
