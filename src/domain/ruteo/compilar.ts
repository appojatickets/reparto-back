import type { FranjaCierreProbable } from '../aprendizaje/ficha-aprendida.js';
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
  readonly preferencias: readonly { readonly antes:number; readonly despues:number; readonly peso:number }[];
  readonly rangoComuna: readonly number[];
  readonly n: number;
  readonly paradas: readonly ParadaRuta[];
  readonly indice: ReadonlyMap<string, number>;
  readonly servicio: Float64Array;
  readonly prioridad: Uint8Array;
  /** Lugar de cada parada en el orden de carga entre las de este problema (0..n-1), o -1 si no se sabe. */
  readonly rangoCarga: Int32Array;
  /** Número de la calle de cada parada (0..calles-1), o -1 si no se sabe. */
  readonly calle: Int32Array;
  /** Memoria de trabajo de `evaluar` para saber qué calles ya se visitaron en la ruta que evalúa (no es parte del problema). */
  readonly callesVistas: Int32Array;
  readonly contadorDeEvaluaciones: Int32Array;
  /** Lugar que le toca a cada parada según su distancia al depósito (0 = la primera); -1 si no se prefiere ningún orden. */
  readonly rangoInicio: Int32Array;
  /** Franjas en que cada parada suele estar cerrada (vacío = sin pista); solo se usa si `pesoCierreAprendido` > 0. */
  readonly franjasCierre: readonly (readonly FranjaCierreProbable[])[];
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

  const numeroDeCalle = new Map<string, number>();
  const calle = new Int32Array(n).fill(-1);
  if (problema.parametros.pesoCalle > 0) {
    problema.paradas.forEach((p, i) => {
      if (p.calle === undefined) return;
      const numero = numeroDeCalle.get(p.calle) ?? numeroDeCalle.size;
      numeroDeCalle.set(p.calle, numero);
      calle[i] = numero;
    });
  }

  const rangoInicio = new Int32Array(n).fill(-1);
  const { ordenInicio, pesoOrdenInicio } = problema.parametros;
  if (ordenInicio !== 'automatico' && pesoOrdenInicio > 0) {
    const signo = ordenInicio === 'lejano' ? -1 : 1;
    problema.paradas
      .flatMap((p, i) => (p.distanciaDepositoKm !== undefined ? [{ i, d: signo * p.distanciaDepositoKm }] : []))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .forEach((x, rango) => { rangoInicio[x.i] = rango; });
  }

  const indice = new Map(problema.paradas.map((p,i)=>[p.id,i]));
  const preferencias=(problema.preferenciasRecorrido??[]).slice(0,100).flatMap(p=>{const antes=indice.get(p.antes),despues=indice.get(p.despues);return antes!==undefined&&despues!==undefined?[{antes,despues,peso:Math.max(0,Math.min(1.5,p.peso))}]:[];});
  return {
    rangoComuna: problema.paradas.map(p => { const i=(problema.ordenComunas ?? []).indexOf(p.comuna ?? ''); return i < 0 ? (problema.ordenComunas?.length ?? 0) : i; }),
    preferencias,
    problema,
    n,
    paradas: problema.paradas,
    indice: new Map(problema.paradas.map((p, i) => [p.id, i])),
    servicio: Float64Array.from(problema.paradas, (p) => p.servicioMin),
    prioridad: Uint8Array.from(problema.paradas, (p) => (p.prioridad ? 1 : 0)),
    rangoCarga,
    calle,
    callesVistas: new Int32Array(numeroDeCalle.size),
    contadorDeEvaluaciones: new Int32Array(1),
    rangoInicio,
    franjasCierre: (problema.avisarCierresAprendidos || problema.parametros.pesoCierreAprendido > 0) ? problema.paradas.map((p) => p.cierreProbable ?? []) : problema.paradas.map(() => []),
    origen: n,
    deposito: n + 1,
    salida: problema.salida,
    viaje,
  };
};

export const conSalida = (c: Compilado, salida: number): Compilado => ({ ...c, salida });
