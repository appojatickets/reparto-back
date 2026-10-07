import type { Compilado } from './compilar.js';

/**
 * Costo de una ruta: C = Σ viaje·ritmo + Σ(riesgo + μ·atraso) + ω·Σ espera (+ términos de prioridad y de llegada temprana).
 * Todos los términos son ≥ 0, así que se puede cortar en cuanto se supera `corte` (poda para la búsqueda local).
 */
export const evaluar = (c: Compilado, orden: ArrayLike<number>, largo: number, corte = Infinity): number => {
  const { mu, omega, penalizacionRiesgo, epsPrioridad, epsLlegada } = c.problema.parametros;
  let t = c.salida;
  let previo = c.origen;
  let costo = 0;

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
    if (c.prioridad[j] === 1) costo += epsPrioridad * (llegada - c.salida);
    if (epsLlegada > 0) costo += epsLlegada * (llegada - c.salida);
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
    t = ini + (c.servicio[j] ?? 0);
    salida.push(t);
    previo = j;
  }
  const regreso = t + c.viaje(previo, c.deposito, t);
  return { llegada, inicio, salida, espera, atraso, regreso, costo: evaluar(c, orden, orden.length) };
};
