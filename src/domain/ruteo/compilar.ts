import type { ParadaRuta, ProblemaRuta } from './tipos.js';
import { DEPOSITO, ORIGEN } from './tiempos.js';

/**
 * Representación numérica del problema para el motor: paradas = 0..n-1, origen = n, depósito = n+1.
 * Precalcula una matriz por período (ya multiplicada por el ritmo) para que evaluar una ruta no llame a nada externo.
 */
export type Compilado = {
  readonly problema: ProblemaRuta;
  readonly n: number;
  readonly paradas: readonly ParadaRuta[];
  readonly indice: ReadonlyMap<string, number>;
  readonly servicio: Float64Array;
  readonly prioridad: Uint8Array;
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

  const periodoDe = (minuto: number): number => {
    const m = ((minuto % 1440) + 1440) % 1440;
    let p = 0;
    while (p < cortes.length && (cortes[p] ?? Infinity) <= m) p++;
    return p;
  };

  return {
    problema,
    n,
    paradas: problema.paradas,
    indice: new Map(problema.paradas.map((p, i) => [p.id, i])),
    servicio: Float64Array.from(problema.paradas, (p) => p.servicioMin),
    prioridad: Uint8Array.from(problema.paradas, (p) => (p.prioridad ? 1 : 0)),
    origen: n,
    deposito: n + 1,
    salida: problema.salida,
    viaje: (de, a, minuto) => caches[periodoDe(minuto)]?.[de * nodos + a] ?? 0,
  };
};

export const conSalida = (c: Compilado, salida: number): Compilado => ({ ...c, salida });
