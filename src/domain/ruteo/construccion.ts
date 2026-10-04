import type { Compilado } from './compilar.js';
import { evaluar } from './evaluacion.js';

/**
 * Inserción más barata: parte de `base` (cuyas primeras `protegidas` posiciones no se tocan) e inserta de a una
 * la parada y la posición que menos encarecen la ruta. Una parada sin posición factible igual se inserta donde
 * menos duele (queda en riesgo); nunca se descarta.
 */
export const construir = (c: Compilado, base: readonly number[], restantes: readonly number[], protegidas: number): number[] => {
  const orden = [...base];
  const pendientes = [...restantes];
  const candidata = new Array<number>(orden.length + pendientes.length + 1).fill(0);

  while (pendientes.length > 0) {
    let mejorCosto = Infinity;
    let mejorParada = -1;
    let mejorPosicion = protegidas;
    for (const p of pendientes) {
      for (let pos = protegidas; pos <= orden.length; pos++) {
        for (let k = 0; k < pos; k++) candidata[k] = orden[k] ?? 0;
        candidata[pos] = p;
        for (let k = pos; k < orden.length; k++) candidata[k + 1] = orden[k] ?? 0;
        const costo = evaluar(c, candidata, orden.length + 1, mejorCosto);
        if (costo < mejorCosto) {
          mejorCosto = costo;
          mejorParada = p;
          mejorPosicion = pos;
        }
      }
    }
    if (mejorParada < 0) {
      // Todas las candidatas costaron Infinity (no ocurre con costos finitos); se insertan al final por seguridad.
      mejorParada = pendientes[0] ?? 0;
      mejorPosicion = orden.length;
    }
    orden.splice(mejorPosicion, 0, mejorParada);
    pendientes.splice(pendientes.indexOf(mejorParada), 1);
  }
  return orden;
};
