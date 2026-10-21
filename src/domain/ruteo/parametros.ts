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
  /**
   * ¿Los horarios de los locales gobiernan el orden? Si es false (la cercanía manda), el horario no cuesta nada al ordenar —ni riesgo, ni atraso,
   * ni espera— y las paradas que ya cerraron no se mandan al final: se ordenan por cercanía como las demás. El horario sigue sirviendo para avisar
   * («llegaría a las 14:10 y cierra a las 13:00»). Es la decisión de la aplicación (ADR 0056); el motor puro lo deja en true.
   */
  readonly horariosGobiernan: boolean;
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
  /**
   * Lo mismo para las paradas cuya ubicación sí se conoce (pin exacto, o ubicadas por su calle y número). Si no se indica, vale `pesoOrdenCarga`.
   * Ahí la geometría ya dice qué queda cerca de qué: seguir el orden de carga contra ella es lo que hace ir y volver por las mismas calles, así
   * que la aplicación lo deja en 0. `pesoOrdenCarga` queda para las que no se sabe dónde están.
   */
  readonly pesoOrdenCargaPin?: number;
  /**
   * Costo (minutos) de volver a una calle que la ruta ya había dejado: cada calle se visita de una vez, con todos sus números juntos. Es un
   * castigo blando; un horario duro puede obligar a partirla.
   */
  readonly pesoCalle: number;
  /** Por dónde parte la ruta: `lejano` / `cercano` prefieren las paradas ordenadas por su distancia al depósito (ver `pesoOrdenInicio`). */
  readonly ordenInicio: OrdenInicio;
  /** Costo por cada lugar que una parada se aleja del que le tocaría según su distancia al depósito (0 = no se considera). */
  readonly pesoOrdenInicio: number;
  /**
   * Costo (en minutos de manejo) de llegar a un local en una franja en que suele estar cerrado, multiplicado por la probabilidad (ADR 0050). Es lo que
   * se espera perder: ir, encontrarlo cerrado y volver otra vez. 0 = no se usa lo aprendido.
   */
  readonly pesoCierreAprendido: number;
  /** Hora de regreso al depósito desde la cual se avisa (minutos del día). 21:00 por defecto. */
  readonly horaLimiteRegresoMin: number;
  /** Perturbaciones de la búsqueda local iterada. */
  readonly reinicios: number;
  readonly semilla: number;
  readonly maxPasadas: number;
};

export const PARAMETROS_POR_DEFECTO: ParametrosRuteo = Object.freeze({
  horariosGobiernan: true,
  mu: 5,
  penalizacionRiesgo: 10_000,
  pesoNoAtendida: 1_000,
  pesoNoAtendidaPrioridad: 5_000,
  omega: 0.3,
  epsPrioridad: 0.1,
  epsLlegada: 0,
  pesoOrdenCarga: 0,
  pesoCalle: 0,
  ordenInicio: 'automatico',
  pesoOrdenInicio: 0,
  pesoCierreAprendido: 0,
  horaLimiteRegresoMin: 21 * 60,
  reinicios: 6,
  semilla: 20261004,
  maxPasadas: 50,
});

/** Estándar de atención por local, en minutos, mientras no haya datos suficientes para ajustarlo (incluye estacionar, caminar y entregar). */
export const SERVICIO_POR_DEFECTO_MIN = 10;

/**
 * Inclinación mínima por llegar antes a lo cercano que usa la aplicación: solo desempata entre dos recorridos igual de largos (cuál de los dos
 * sentidos de un mismo circuito, empezando por lo cercano). Antes valía 0,5, pensando en terminar un sector antes de saltar a otro, y eso era
 * justamente lo que cruzaba la ruta consigo misma: pagar medio minuto por cada minuto de llegada de CADA parada hace que acortar los primeros
 * tramos valga más que el recorrido completo. En 20 rutas simuladas de 30 paradas con pin exacto, con 0,5 la ruta se cruzaba 1,25 veces y
 * recorría 8 % más; con 0,005 no se cruza ninguna vez y recorre lo mismo que sin ninguna inclinación.
 */
export const EPS_LLEGADA_DESEMPATE = 0.005;

/**
 * Peso del orden de carga que usa la aplicación (minutos por lugar de diferencia). Calibrado con las mismas rutas reales (64 decisiones de
 * 4 rutas, 6 y 7 de octubre): con los pines conocidos la siguiente parada sugerida coincide con la del chofer el 72 % de las veces en vez del
 * 64 % (y está entre las 3 primeras el 86 % en vez del 77 %), con un recorrido que sigue siendo más corto que el manejado.
 */
export const PESO_ORDEN_CARGA_CALIBRADO = 1;

/**
 * Peso del orden de carga para las paradas cuya ubicación se conoce (pin exacto, o ubicadas por su calle y número). Ahí la geometría sabe qué
 * queda cerca de qué; seguir además el orden en que se cargaron las facturas (que no sigue las calles) la saca de ahí y la hace ir y volver por
 * las mismas zonas. Solo guía a las que no se sabe dónde están, que es cuando de verdad ayuda.
 */
export const PESO_ORDEN_CARGA_CON_PIN = 0;

/**
 * Castigo (minutos) por volver a una calle que la ruta ya había dejado, en la ruta que arma la aplicación. Una calle se hace de una vez: 3, 7 y
 * 12 de «Calle X» seguidas y no «3, otra calle, 12». Es blando para que un horario duro, que sí puede partir una calle, siga mandando.
 */
export const PESO_CALLE = 10;

/**
 * Peso del orden de inicio que usa la aplicación cuando el dueño elige partir por lo más lejano o más cercano (minutos por lugar de diferencia).
 * Es una decisión del dueño, no un ajuste fino: pesa cinco veces el orden de carga, así que gana a las pistas suaves y a un desvío pequeño,
 * pero no a un horario duro. No está calibrado con datos. Con «más lejano» se apaga la inclinación por lo cercano (`epsLlegada`), que
 * empuja justo al revés.
 */
export const PESO_ORDEN_INICIO = 5;

/**
 * Peso de lo aprendido sobre cierres que usa la aplicación (minutos de manejo por unidad de probabilidad): ir y volver a un local cerrado cuesta
 * del orden de media hora. Es una pista blanda: pesa menos que cualquier horario duro y no saca paradas de la ruta. No está calibrado con datos:
 * el banco de pruebas de la analítica sigue midiendo si lo aprendido acierta.
 */
export const PESO_CIERRE_APRENDIDO = 30;

/**
 * ¿Los horarios gobiernan el orden de la ruta que arma la aplicación? No: la cercanía de las paradas es lo único firme; los horarios (cargados a
 * mano o aprendidos), las urgencias y los locales cerrados cambian durante el día y los maneja el chofer en terreno (ADR 0056). En 20 rutas
 * simuladas de 30 paradas con horario en el 30 % de los locales, con los horarios mandando la ruta recorría 96 km y se cruzaba 5,7 veces; cuando
 * solo avisan, 73,5 km y 0,1 cruces (sin horarios: 70,9 km).
 */
export const HORARIOS_GOBIERNAN_EL_ORDEN = false;

/** Con los horarios sin gobernar: no cuestan nada al ordenar. Lo aprendido sobre cierres conserva un peso ínfimo solo para seguir avisando CIERRE_PROBABLE. */
export const PARAMETROS_HORARIOS_SOLO_AVISAN = Object.freeze({ horariosGobiernan: false, penalizacionRiesgo: 0, mu: 0, omega: 0, pesoCierreAprendido: 0.001 });
