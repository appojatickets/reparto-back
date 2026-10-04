/**
 * Parámetros del motor. Los valores por defecto son un punto de partida razonable, NO calibrado:
 * se ajustan con datos propios durante el piloto (viven en `empresa.config.ruteo`).
 */
export type ParametrosRuteo = {
  /** μ: costo por minuto de atraso respecto del cierre de un local. */
  readonly mu: number;
  /**
   * Costo fijo por cada parada en riesgo. Con un valor alto, cualquier ruta sin riesgos le gana a una con riesgos:
   * es lo que convierte las ventanas duras en duras («respetadas cuando hay solución»).
   */
  readonly penalizacionRiesgo: number;
  /** w_j: costo de dejar sin atender una parada (ventana ya vencida). */
  readonly pesoNoAtendida: number;
  readonly pesoNoAtendidaPrioridad: number;
  /** ω: costo por minuto de espera frente a un local que aún no abre. */
  readonly omega: number;
  /**
   * Costo por minuto de llegada para paradas con prioridad (adelantarlas). PLACEHOLDER: falta definir con el dueño
   * qué significa exactamente «prioridad» (ver preguntas abiertas).
   */
  readonly epsPrioridad: number;
  /** Hora de regreso al depósito desde la cual se avisa (minutos del día). 21:00 por defecto. */
  readonly horaLimiteRegresoMin: number;
  /** Perturbaciones de la búsqueda local iterada. */
  readonly reinicios: number;
  readonly semilla: number;
  readonly maxPasadas: number;
};

export const PARAMETROS_POR_DEFECTO: ParametrosRuteo = Object.freeze({
  mu: 5,
  penalizacionRiesgo: 10_000,
  pesoNoAtendida: 1_000,
  pesoNoAtendidaPrioridad: 5_000,
  omega: 0.3,
  epsPrioridad: 0.1,
  horaLimiteRegresoMin: 21 * 60,
  reinicios: 6,
  semilla: 20261004,
  maxPasadas: 50,
});

/** Servicio por defecto en minutos si el local no tiene uno aprendido (inicial por giro: 8 min). */
export const SERVICIO_POR_DEFECTO_MIN = 8;
