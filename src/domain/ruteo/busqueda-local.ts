import type { Azar } from '../shared/azar.js';
import type { Compilado } from './compilar.js';
import { evaluar } from './evaluacion.js';

const EPS = 1e-9;

/**
 * Descenso por vecindarios: 2-opt, Or-opt (segmentos de 1 a 3, que incluye relocate) y swap, con primera mejora.
 * Las primeras `f` posiciones (paradas fijadas por el chofer) no se mueven. Muta `orden` y devuelve su costo.
 *
 * Nota: la factibilidad se comprueba evaluando la ruta completa (O(n)) con poda por costo, no en O(1) con holguras:
 * los tiempos de viaje cambian por período, así que las holguras clásicas no son exactas. Con 50 paradas sobra velocidad.
 */
export const descenso = (c: Compilado, orden: number[], f: number, agotado: () => boolean): number => {
  const m = orden.length;
  const candidata = new Array<number>(m).fill(0);
  let costo = evaluar(c, orden, m);

  const probar = (): boolean => {
    const e = evaluar(c, candidata, m, costo - EPS);
    if (e < costo - EPS) {
      for (let k = 0; k < m; k++) orden[k] = candidata[k] ?? 0;
      costo = e;
      return true;
    }
    return false;
  };
  const copiar = (): void => {
    for (let k = 0; k < m; k++) candidata[k] = orden[k] ?? 0;
  };

  for (let pasada = 0; pasada < c.problema.parametros.maxPasadas; pasada++) {
    if (agotado()) break;
    let mejoro = false;

    for (let i = f; i < m - 1; i++) {
      for (let j = i + 1; j < m; j++) {
        copiar();
        for (let a = i, b = j; a < b; a++, b--) {
          const x = candidata[a] ?? 0;
          candidata[a] = candidata[b] ?? 0;
          candidata[b] = x;
        }
        if (probar()) mejoro = true;
      }
    }

    for (let largo = 1; largo <= 3; largo++) {
      for (let i = f; i + largo <= m; i++) {
        const segmento = orden.slice(i, i + largo);
        const resto = [...orden.slice(0, i), ...orden.slice(i + largo)];
        for (let pos = f; pos <= resto.length; pos++) {
          if (pos === i) continue;
          let w = 0;
          for (let k = 0; k < pos; k++) candidata[w++] = resto[k] ?? 0;
          for (const s of segmento) candidata[w++] = s;
          for (let k = pos; k < resto.length; k++) candidata[w++] = resto[k] ?? 0;
          if (probar()) {
            mejoro = true;
            break;
          }
        }
      }
    }

    for (let i = f; i < m - 1; i++) {
      for (let j = i + 1; j < m; j++) {
        copiar();
        candidata[i] = orden[j] ?? 0;
        candidata[j] = orden[i] ?? 0;
        if (probar()) mejoro = true;
      }
    }

    if (!mejoro) break;
  }
  return costo;
};

/** Perturbación: intercambia dos tramos de la parte móvil (double-bridge) o, si es muy corta, dos paradas. */
const perturbar = (orden: readonly number[], f: number, azar: Azar): number[] => {
  const salida = [...orden];
  const libres = orden.length - f;
  if (libres < 2) return salida;
  if (libres < 5) {
    const i = f + azar.entero(libres);
    const j = f + azar.entero(libres);
    [salida[i], salida[j]] = [salida[j] ?? 0, salida[i] ?? 0];
    return salida;
  }
  const c1 = 1 + azar.entero(libres - 3);
  const c2 = c1 + 1 + azar.entero(libres - c1 - 2);
  const c3 = c2 + 1 + azar.entero(libres - c2 - 1);
  const p1 = f + c1;
  const p2 = f + c2;
  const p3 = f + c3;
  return [...orden.slice(0, p1), ...orden.slice(p2, p3), ...orden.slice(p1, p2), ...orden.slice(p3)];
};

/** Búsqueda local iterada: descenso + perturbaciones con semilla fija; se queda con la mejor ruta. */
export const mejorar = (
  c: Compilado,
  inicial: readonly number[],
  f: number,
  azar: Azar,
  agotado: () => boolean,
): { orden: number[]; costo: number } => {
  let mejor = [...inicial];
  let costoMejor = descenso(c, mejor, f, agotado);
  for (let r = 0; r < c.problema.parametros.reinicios && !agotado(); r++) {
    const candidata = perturbar(mejor, f, azar);
    const costo = descenso(c, candidata, f, agotado);
    if (costo < costoMejor - EPS) {
      mejor = candidata;
      costoMejor = costo;
    }
  }
  return { orden: mejor, costo: costoMejor };
};
