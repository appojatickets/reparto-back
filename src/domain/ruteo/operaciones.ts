import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { compilar } from './compilar.js';
import { evaluar } from './evaluacion.js';
import { evaluarOrden, insertarFaltantes, optimizar } from './optimizador.js';
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

/**
 * ARRASTRAR Y SOLTAR: la parada queda exactamente en `destino` (0 = la primera; fuera de la lista se acota a los extremos) y las demás
 * conservan su orden relativo. No se reoptimiza: lo que la persona soltó es lo que manda.
 */
export const moverAPosicion = (estado: EstadoRuta, id: string, destino: number): Result<ResultadoOperacion, ErrorDominio> => {
  const idx = estado.orden.indexOf(id);
  if (idx < 0) return noExiste();
  const sinEsta = estado.orden.filter((x) => x !== id);
  const posicion = Math.max(0, Math.min(Math.trunc(destino), sinEsta.length));
  const orden = [...sinEsta.slice(0, posicion), id, ...sinEsta.slice(posicion)];
  // Una fijada solo sigue fijada mientras siga encabezando la ruta.
  const fijadas = new Set(estado.problema.fijas);
  const fijas: string[] = [];
  for (const x of orden) {
    if (!fijadas.has(x)) break;
    fijas.push(x);
  }
  const problema: ProblemaRuta = { ...estado.problema, fijas };
  return ok({ problema, solucion: evaluarOrden(problema, orden) });
};

/**
 * Lo que se cambia a mano manda y lo de abajo se ordena solo: la parada `id` y todo lo que quedó arriba de ella se fija tal cual está (así
 * lo dejó la persona) y lo que está debajo se vuelve a ordenar desde ahí. Se usa después de subir, bajar o arrastrar una parada.
 */
export const ordenarDebajoDe = (estado: EstadoRuta, id: string, opciones: OpcionesOptimizacion = {}): Result<ResultadoOperacion, ErrorDominio> => {
  const idx = estado.orden.indexOf(id);
  if (idx < 0) return noExiste();
  const enProblema = new Set(estado.problema.paradas.map((p) => p.id));
  const fijas = estado.orden.slice(0, idx + 1).filter((x) => enProblema.has(x));
  return ok(ordenarPendientes({ problema: { ...estado.problema, fijas }, orden: estado.orden }, opciones));
};

/** SUBIR / BAJAR: la parada pasa un lugar arriba o abajo (se intercambia con su vecina); el resto queda como estaba. */
export const moverParada = (estado: EstadoRuta, id: string, delta: -1 | 1): Result<ResultadoOperacion, ErrorDominio> => {
  const idx = estado.orden.indexOf(id);
  return idx < 0 ? noExiste() : moverAPosicion(estado, id, idx + delta);
};

/** Mete en la ruta las paradas del problema que aún no tienen lugar, sin reordenar las demás. */
export const insertarNuevas = (estado: EstadoRuta): ResultadoOperacion => ({
  problema: estado.problema,
  solucion: insertarFaltantes(estado.problema, estado.orden),
});

/**
 * «LAS AGREGO EN ORDEN»: el chofer se sabe el recorrido y carga las facturas en el orden en que las entregará, así que la ruta es ese
 * orden, sin optimizar. Lo que ya tenía lugar lo conserva (también lo que movió a mano) y lo nuevo entra al final según el orden en que
 * se cargó. Una parada sin lugar de carga conocido va después de las que sí lo tienen, por su id para que el resultado sea estable.
 */
export const ordenarPorCarga = (estado: EstadoRuta, ordenCarga: ReadonlyMap<string, number>): ResultadoOperacion => {
  const enProblema = new Set(estado.problema.paradas.map((p) => p.id));
  const conservadas: string[] = [];
  for (const id of estado.orden) if (enProblema.has(id) && !conservadas.includes(id)) conservadas.push(id);
  const ya = new Set(conservadas);
  const nuevas = estado.problema.paradas
    .map((p) => p.id)
    .filter((id) => !ya.has(id))
    .sort((a, b) => (ordenCarga.get(a) ?? Infinity) - (ordenCarga.get(b) ?? Infinity) || (a < b ? -1 : a > b ? 1 : 0));
  const orden = [...conservadas, ...nuevas];
  // Una fijada solo sigue fijada mientras siga encabezando la ruta.
  const fijadas = new Set(estado.problema.fijas);
  const fijas: string[] = [];
  for (const id of orden) {
    if (!fijadas.has(id)) break;
    fijas.push(id);
  }
  const problema: ProblemaRuta = { ...estado.problema, fijas };
  return { problema, solucion: evaluarOrden(problema, orden) };
};
