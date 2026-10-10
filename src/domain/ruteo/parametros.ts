import type { OrdenInicio } from '../entidades/config-empresa.js';

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
  /**
   * Costo por minuto de llegada de CADA parada (0 = ninguno). Con un valor positivo la ruta prefiere visitar antes lo que queda cerca, como
   * hacen los choferes: terminar un sector antes de saltar a otro, aunque el recorrido total quede algo más largo. Se calibra con lo que
   * los choferes de verdad hacen (el orden que se hace manda sobre el sugerido).
   */
  readonly epsLlegada: number;
  /**
   * Costo por cada lugar que una parada se aleja del orden en que el chofer cargó las facturas (0 = no se considera). El orden de carga se
   * parece al de entrega (correlación 0,8–0,9 en las rutas reales), así que es una pista de lo que el chofer piensa hacer.
   */
  readonly pesoOrdenCarga: number;
  /** Por dónde parte la ruta: `lejano` / `cercano` prefieren las paradas ordenadas por su distancia al depósito (ver `pesoOrdenInicio`). */
  readonly ordenInicio: OrdenInicio;
  /** Costo por cada lugar que una parada se aleja del que le tocaría según su distancia al depósito (0 = no se considera). */
  readonly pesoOrdenInicio: number;
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
  epsLlegada: 0,
  pesoOrdenCarga: 0,
  ordenInicio: 'automatico',
  pesoOrdenInicio: 0,
  horaLimiteRegresoMin: 21 * 60,
  reinicios: 6,
  semilla: 20261004,
  maxPasadas: 50,
});

/** Servicio por defecto en minutos si el local no tiene uno aprendido (inicial por giro: 8 min). */
export const SERVICIO_POR_DEFECTO_MIN = 8;

/**
 * Estilo de ruta que usa la aplicación: prefiere visitar antes lo que queda cerca (terminar un sector antes de saltar a otro), como hacen los
 * choferes. Calibrado con 57 decisiones reales (4 rutas de 2 camiones): la siguiente parada que sugiere coincide con la que se hace el 61 %
 * de las veces en vez del 54 %, y el recorrido total crece 1,7 %. El motor puro (`PARAMETROS_POR_DEFECTO`) no lo incluye.
 */
export const EPS_LLEGADA_CALIBRADO = 0.5;

/**
 * Peso del orden de carga que usa la aplicación (minutos por lugar de diferencia). Calibrado con las mismas rutas reales (64 decisiones de
 * 4 rutas, 6 y 7 de octubre): con los pines conocidos la siguiente parada sugerida coincide con la del chofer el 72 % de las veces en vez del
 * 64 % (y está entre las 3 primeras el 86 % en vez del 77 %), con un recorrido que sigue siendo más corto que el manejado.
 */
export const PESO_ORDEN_CARGA_CALIBRADO = 1;

/**
 * Peso del orden de inicio que usa la aplicación cuando el dueño elige partir por lo más lejano o más cercano (minutos por lugar de diferencia).
 * Es una decisión del dueño, no un ajuste fino: pesa cinco veces el orden de carga, así que gana a las pistas suaves y a un desvío pequeño,
 * pero no a un horario duro. No está calibrado con datos. Con «más lejano» se apaga la inclinación por lo cercano (`epsLlegada`), que
 * empuja justo al revés.
 */
export const PESO_ORDEN_INICIO = 5;
