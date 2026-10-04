import { crearAzar } from '../shared/azar.js';
import { compilar, type Compilado } from './compilar.js';
import { construir } from './construccion.js';
import { armarSolucion } from './explicaciones.js';
import { mejorar } from './busqueda-local.js';
import type { OpcionesOptimizacion, ProblemaRuta, Solucion } from './tipos.js';

const unicos = (xs: readonly number[]): number[] => [...new Set(xs)];

const indicesDe = (c: Compilado, ids: readonly string[]): number[] =>
  unicos(ids.flatMap((id) => {
    const i = c.indice.get(id);
    return i === undefined ? [] : [i];
  }));

/**
 * Paradas cuya última ventana cierra antes de la hora más temprana a la que se podría llegar (yendo directo).
 * No se descartan en silencio: salen en `noAtendidas` con su conflicto. Las fijadas por el chofer nunca se excluyen.
 */
const detectarVencidas = (c: Compilado, fijas: readonly number[]): number[] => {
  const protegidas = new Set(fijas);
  const vencidas: number[] = [];
  for (let i = 0; i < c.n; i++) {
    const ventanas = c.paradas[i]?.ventanas ?? [];
    const cierre = ventanas[ventanas.length - 1]?.cierre;
    if (protegidas.has(i) || cierre === undefined) continue;
    if (c.salida + c.viaje(c.origen, i, c.salida) > cierre) vencidas.push(i);
  }
  return vencidas;
};

const prepararBase = (problema: ProblemaRuta, ordenInicial: readonly string[] = []) => {
  const c = compilar(problema);
  const fijas = indicesDe(c, problema.fijas);
  const vencidas = detectarVencidas(c, fijas);
  const excluidas = new Set([...fijas, ...vencidas]);
  const previas = indicesDe(c, ordenInicial).filter((i) => !excluidas.has(i));
  const enBase = new Set([...fijas, ...previas]);
  const restantes = Array.from({ length: c.n }, (_, i) => i).filter((i) => !enBase.has(i) && !vencidas.includes(i));
  return { c, fijas, vencidas, base: [...fijas, ...previas], restantes };
};

/** Ordena las paradas pendientes de un vehículo. Mismo problema + misma semilla = mismo resultado. */
export const optimizar = (problema: ProblemaRuta, opciones: OpcionesOptimizacion = {}): Solucion => {
  const { c, fijas, vencidas, base, restantes } = prepararBase(problema, opciones.ordenInicial);
  const f = fijas.length;

  const { presupuesto } = opciones;
  const inicio = presupuesto?.reloj() ?? 0;
  // El reloj solo acota el tiempo de cómputo (válvula de seguridad); sin presupuesto el resultado no depende de él.
  const agotado = presupuesto ? () => presupuesto.reloj() - inicio >= presupuesto.limiteMs : () => false;

  const inicial = construir(c, base, restantes, f);
  const { orden } = mejorar(c, inicial, f, crearAzar(problema.parametros.semilla), agotado);
  return armarSolucion(c, orden, vencidas, f);
};

/** Evalúa un orden dado (sin optimizar): sirve para reinsertar, medir y comparar. Descarta ids desconocidos. */
export const evaluarOrden = (problema: ProblemaRuta, ordenIds: readonly string[]): Solucion => {
  const c = compilar(problema);
  const fijas = indicesDe(c, problema.fijas);
  const vencidas = detectarVencidas(c, fijas);
  const orden = indicesDe(c, ordenIds).filter((i) => !vencidas.includes(i));
  return armarSolucion(c, orden, vencidas, fijas.length);
};
