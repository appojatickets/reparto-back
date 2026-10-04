/** Constantes del plan (sección 8): K = 20 observaciones «virtuales» de ritmo 1,0; confiable con n ≥ 40; pausas > 40 min se excluyen. */
export const K_RITMO = 20;
export const N_CONFIABLE = 40;
export const BRECHA_PAUSA_MIN = 40;

export type TramoObservado = { readonly minutosReales: number; readonly minutosPlanificados: number };

/**
 * ritmo_obs = Σ minutos reales / Σ minutos planificados, comparando contra el plan de la propia ruta del chofer.
 * Se excluyen los tramos cuyo tiempo real supera la brecha de pausa (almuerzo, trámites): no miden el ritmo.
 * Devuelve `n` = tramos usados.
 */
export const ritmoObservado = (
  tramos: readonly TramoObservado[],
  brechaPausaMin: number = BRECHA_PAUSA_MIN,
): { ritmoObs: number; n: number } | undefined => {
  const validos = tramos.filter((t) => t.minutosReales <= brechaPausaMin && t.minutosPlanificados > 0);
  const planificados = validos.reduce((s, t) => s + t.minutosPlanificados, 0);
  if (validos.length === 0 || planificados <= 0) return undefined;
  return { ritmoObs: validos.reduce((s, t) => s + t.minutosReales, 0) / planificados, n: validos.length };
};

/** ritmo = (n·obs + K·1,0) / (n + K): con pocos datos se acerca a 1,0; con muchos, al observado. */
export const ritmoChofer = (ritmoObs: number, n: number, k: number = K_RITMO): number => (n * ritmoObs + k) / (n + k);

export const ritmoEsConfiable = (n: number): boolean => n >= N_CONFIABLE;

/** servicio_nuevo = α·observado + (1−α)·anterior, con el observado acotado a [1, 45] min. */
export const servicioNuevo = (observadoMin: number, anteriorMin: number, alfa = 0.3): number => {
  const acotado = Math.min(45, Math.max(1, observadoMin));
  return alfa * acotado + (1 - alfa) * anteriorMin;
};

/** confianza_horario = (aciertos + 1) / (intentos + 2). «Local cerrado» cuenta como intento fallido. */
export const confianzaHorario = (aciertos: number, intentos: number): number => (aciertos + 1) / (intentos + 2);
