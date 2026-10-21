import type { FranjaCierreProbable } from '../aprendizaje/ficha-aprendida.js';
import type { Compilado } from './compilar.js';

/** La franja de cierre probable en que cae la hora en que se empezaría a atender esa parada, si la hay. */
export const franjaDeCierre = (c: Compilado, j: number, minuto: number): FranjaCierreProbable | undefined => {
  const franjas = c.franjasCierre[j];
  if (!franjas || franjas.length === 0) return undefined;
  // El minuto puede pasar de 1440 (ruta que cruza la medianoche): las franjas son del día.
  const m = minuto % 1440;
  return franjas.find((f) => m >= f.desdeMin && m < f.hastaMin);
};

/**
 * Costo de una ruta: C = Σ viaje·ritmo + Σ(riesgo + μ·atraso) + ω·Σ espera (+ términos de prioridad y de llegada temprana).
 * Todos los términos son ≥ 0, así que se puede cortar en cuanto se supera `corte` (poda para la búsqueda local).
 */
export const evaluar = (c: Compilado, orden: ArrayLike<number>, largo: number, corte = Infinity): number => {
  const { mu, omega, penalizacionRiesgo, epsPrioridad, epsLlegada, pesoOrdenCarga, pesoOrdenCargaPin, pesoOrdenInicio, pesoCierreAprendido, pesoCalle } = c.problema.parametros;
  let t = c.salida;
  let previo = c.origen;
  let costo = 0;
  const conCarga = pesoOrdenCarga > 0 || (pesoOrdenCargaPin ?? 0) > 0;
  // Calles ya visitadas en esta ruta: se marcan con el número de esta evaluación, así no hay que limpiar nada entre una y otra.
  const evaluacion = (c.contadorDeEvaluaciones[0] = (c.contadorDeEvaluaciones[0] ?? 0) + 1);
  let calleAnterior = -1;

  for (let k = 0; k < largo; k++) {
    const j = orden[k] ?? 0;
    const viaje = c.viaje(previo, j, t);
    const llegada = t + viaje;
    costo += viaje;

    const ventanas = c.paradas[j]?.ventanas ?? [];
    let inicio = llegada;
    if (ventanas.length > 0) {
      inicio = -1;
      for (let q = 0; q < ventanas.length; q++) {
        const w = ventanas[q];
        if (w && llegada <= w.cierre) {
          inicio = llegada < w.apertura ? w.apertura : llegada;
          break;
        }
      }
      if (inicio < 0) {
        inicio = llegada;
        costo += penalizacionRiesgo + mu * (llegada - (ventanas[ventanas.length - 1]?.cierre ?? llegada));
      } else {
        costo += omega * (inicio - llegada);
      }
    }
    if (pesoCierreAprendido > 0) {
      const franja = franjaDeCierre(c, j, inicio);
      if (franja) costo += pesoCierreAprendido * franja.p;
    }
    if (c.prioridad[j] === 1) costo += epsPrioridad * (llegada - c.salida);
    if (epsLlegada > 0) costo += epsLlegada * (llegada - c.salida);
    if (conCarga) {
      const r = c.rangoCarga[j] ?? -1;
      if (r >= 0) costo += (c.pesoCarga[j] ?? 0) * Math.abs(k - r);
    }
    if (pesoCalle > 0) {
      const calle = c.calle[j] ?? -1;
      if (calle >= 0 && calle !== calleAnterior) {
        // Volver a una calle que ya se había dejado: sus números quedan partidos en dos visitas.
        if (c.callesVistas[calle] === evaluacion) costo += pesoCalle;
        c.callesVistas[calle] = evaluacion;
      }
      calleAnterior = calle;
    }
    if (pesoOrdenInicio > 0) {
      const r = c.rangoInicio[j] ?? -1;
      if (r >= 0) costo += pesoOrdenInicio * Math.abs(k - r);
    }
    if (costo >= corte) return Infinity;

    t = inicio + (c.servicio[j] ?? 0);
    previo = j;
  }
  costo += c.viaje(previo, c.deposito, t);
  return costo >= corte ? Infinity : costo;
};

export type Itinerario = {
  readonly llegada: number[];
  readonly inicio: number[];
  readonly salida: number[];
  readonly espera: number[];
  readonly atraso: number[];
  /** Para cada parada, la franja de cierre probable en que cae su atención (si la hay). */
  readonly cierre: (FranjaCierreProbable | undefined)[];
  readonly regreso: number;
  readonly costo: number;
};

/** Mismo cálculo que `evaluar`, pero guardando el detalle de cada parada. */
export const detallar = (c: Compilado, orden: readonly number[]): Itinerario => {
  const llegada: number[] = [];
  const inicio: number[] = [];
  const salida: number[] = [];
  const espera: number[] = [];
  const atraso: number[] = [];
  const cierre: (FranjaCierreProbable | undefined)[] = [];
  let t = c.salida;
  let previo = c.origen;
  for (const j of orden) {
    const arr = t + c.viaje(previo, j, t);
    const ventanas = c.paradas[j]?.ventanas ?? [];
    let ini = arr;
    let tarde = 0;
    if (ventanas.length > 0) {
      const tramo = ventanas.find((w) => arr <= w.cierre);
      if (tramo) ini = Math.max(arr, tramo.apertura);
      else tarde = arr - (ventanas[ventanas.length - 1]?.cierre ?? arr);
    }
    llegada.push(arr);
    inicio.push(ini);
    espera.push(ini - arr);
    atraso.push(tarde);
    cierre.push(c.problema.parametros.pesoCierreAprendido > 0 ? franjaDeCierre(c, j, ini) : undefined);
    t = ini + (c.servicio[j] ?? 0);
    salida.push(t);
    previo = j;
  }
  const regreso = t + c.viaje(previo, c.deposito, t);
  return { llegada, inicio, salida, espera, atraso, cierre, regreso, costo: evaluar(c, orden, orden.length) };
};
