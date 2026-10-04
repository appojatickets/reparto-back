import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { compilar } from './compilar.js';
import { evaluar } from './evaluacion.js';
import { evaluarOrden, optimizar } from './optimizador.js';
import type { TiemposViaje } from './tiempos.js';
import type { OpcionesOptimizacion, ParadaRuta, ProblemaRuta, Solucion } from './tipos.js';

/** Lo que el chofer ve: el problema vigente y el orden actual de sus paradas pendientes. */
export type EstadoRuta = { readonly problema: ProblemaRuta; readonly orden: readonly string[] };
export type ResultadoOperacion = { readonly problema: ProblemaRuta; readonly solucion: Solucion };

const noExiste = () => err(errorDominio('PARADA_NO_ENCONTRADA', 'La parada no está en la ruta.'));

/** + AGREGAR PARADA. `tiempos` debe incluir ya a la parada nueva. Devuelve la posición (null si ya está vencida) y la ETA. */
export const agregarParada = (
  estado: EstadoRuta,
  nueva: ParadaRuta,
  tiempos: TiemposViaje,
  opciones: OpcionesOptimizacion = {},
): Result<ResultadoOperacion & { posicion: number | null; eta: number | null }, ErrorDominio> => {
  if (estado.problema.paradas.some((p) => p.id === nueva.id)) {
    return err(errorDominio('PARADA_DUPLICADA', 'Esa parada ya está en la ruta.'));
  }
  const problema: ProblemaRuta = { ...estado.problema, paradas: [...estado.problema.paradas, nueva], tiempos };
  const solucion = optimizar(problema, { ...opciones, ordenInicial: estado.orden });
  const posicion = solucion.orden.indexOf(nueva.id);
  return ok({
    problema,
    solucion,
    posicion: posicion < 0 ? null : posicion,
    eta: solucion.detalle[posicion]?.llegada ?? null,
  });
};

/** IR PRIMERO A ESTA: pasa a ser la siguiente, queda fijada y el resto se reoptimiza. */
export const moverAlFrente = (estado: EstadoRuta, id: string, opciones: OpcionesOptimizacion = {}): Result<ResultadoOperacion, ErrorDominio> => {
  if (!estado.problema.paradas.some((p) => p.id === id)) return noExiste();
  const problema: ProblemaRuta = { ...estado.problema, fijas: [id, ...estado.problema.fijas.filter((x) => x !== id)] };
  return ok({ problema, solucion: optimizar(problema, { ...opciones, ordenInicial: estado.orden }) });
};

/**
 * DEJAR PARA DESPUÉS: se saca de su lugar y se reinserta en la mejor posición posterior. No se vuelve a optimizar el
 * resto a propósito: una búsqueda local la devolvería al mismo sitio, que es justo lo que el chofer pidió evitar.
 */
export const posponer = (estado: EstadoRuta, id: string): Result<ResultadoOperacion, ErrorDominio> => {
  const idx = estado.orden.indexOf(id);
  if (idx < 0) return noExiste();
  const problema: ProblemaRuta = { ...estado.problema, fijas: estado.problema.fijas.filter((x) => x !== id) };
  const c = compilar(problema);
  const sinEsta = estado.orden.filter((x) => x !== id).flatMap((x) => c.indice.get(x) ?? []);
  const parada = c.indice.get(id);
  if (parada === undefined) return noExiste();

  const f = Math.min(problema.fijas.length, sinEsta.length);
  let mejorPos = sinEsta.length;
  let mejorCosto = Infinity;
  for (let pos = Math.max(f, Math.min(idx + 1, sinEsta.length)); pos <= sinEsta.length; pos++) {
    const candidata = [...sinEsta.slice(0, pos), parada, ...sinEsta.slice(pos)];
    const costo = evaluar(c, candidata, candidata.length);
    if (costo < mejorCosto) {
      mejorCosto = costo;
      mejorPos = pos;
    }
  }
  const orden = [...sinEsta.slice(0, mejorPos), parada, ...sinEsta.slice(mejorPos)];
  const ids = orden.flatMap((i) => c.paradas[i]?.id ?? []);
  return ok({ problema, solucion: evaluarOrden(problema, ids) });
};

/** QUITAR: se retira de la ruta; el resto se reordena con una mejora corta. */
export const quitar = (estado: EstadoRuta, id: string, opciones: OpcionesOptimizacion = {}): Result<ResultadoOperacion, ErrorDominio> => {
  if (!estado.problema.paradas.some((p) => p.id === id)) return noExiste();
  const problema: ProblemaRuta = {
    ...estado.problema,
    paradas: estado.problema.paradas.filter((p) => p.id !== id),
    fijas: estado.problema.fijas.filter((x) => x !== id),
  };
  return ok({ problema, solucion: optimizar(problema, { ...opciones, ordenInicial: estado.orden.filter((x) => x !== id) }) });
};

/** ORDENAR LO QUE QUEDA: reoptimiza todo lo no fijado; se queda con lo mejor entre empezar de cero y mejorar el orden actual. */
export const ordenarPendientes = (estado: EstadoRuta, opciones: OpcionesOptimizacion = {}): ResultadoOperacion => {
  const desdeCero = optimizar(estado.problema, opciones);
  const desdeActual = optimizar(estado.problema, { ...opciones, ordenInicial: estado.orden });
  return { problema: estado.problema, solucion: desdeActual.costo < desdeCero.costo ? desdeActual : desdeCero };
};
