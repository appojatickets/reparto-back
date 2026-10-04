/** Fuente de azar con semilla: mismo problema + misma semilla = mismo resultado. */
export interface Azar {
  /** Número en [0, 1). */
  siguiente(): number;
  /** Entero en [0, max). */
  entero(max: number): number;
}

/** mulberry32: generador de 32 bits, rápido y suficiente para perturbar soluciones (no es criptográfico). */
export const crearAzar = (semilla: number): Azar => {
  let estado = semilla >>> 0;
  const siguiente = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { siguiente, entero: (max) => Math.floor(siguiente() * max) };
};
