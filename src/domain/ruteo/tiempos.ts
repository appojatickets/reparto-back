import { distanciaKm, type Coordenada } from '../valor/coordenada.js';

/** Nodos especiales del problema: dónde está el vehículo ahora y el depósito donde termina. */
export const ORIGEN = '__origen__';
export const DEPOSITO = '__deposito__';

/** Puerto de dominio: tiempos de viaje en minutos por período del día. Las matrices reales las aportan los adaptadores. */
export interface TiemposViaje {
  /** Minutos de viaje de `desde` a `hacia` saliendo en `minuto` (minuto del día; pasada la medianoche se reduce módulo 1440). */
  tiempo(desde: string, hacia: string, minuto: number): number;
  /** Minutos del día (ordenados) en que cambia el período; permite cachear una matriz por período. */
  readonly cortes: readonly number[];
}

/** Período del día (0..cortes.length) en que cae un minuto; pasada la medianoche se reduce módulo 1440. */
export const periodoDelMinuto = (cortes: readonly number[], minuto: number): number => {
  const m = ((minuto % 1440) + 1440) % 1440;
  let p = 0;
  while (p < cortes.length && (cortes[p] ?? Infinity) <= m) p++;
  return p;
};

/**
 * Minutos de un tramo que sale en `minuto`, cuando el tramo entero tardaría `enPeriodo(p)` a la velocidad del período p. Si el tramo cruza un
 * cambio de período, cada parte avanza a la velocidad de su período (modelo de Ichoua, Gendreau y Potvin): salir más tarde nunca hace
 * llegar antes, cosa que sí pasaba usando para todo el tramo la velocidad de la hora de salida.
 */
export const viajeConCambioDePeriodo = (cortes: readonly number[], minuto: number, enPeriodo: (p: number) => number): number => {
  const periodos = cortes.length + 1;
  let p = periodoDelMinuto(cortes, minuto);
  let t = minuto;
  let falta = 1; // fracción del tramo que queda por recorrer
  for (let paso = 0; paso <= periodos; paso++) {
    const entero = enPeriodo(p);
    if (!(entero > 0)) return t - minuto;
    const fin = t - (((t % 1440) + 1440) % 1440) + (cortes[p] ?? 1440);
    if (t + falta * entero <= fin) return t + falta * entero - minuto;
    falta -= (fin - t) / entero;
    t = fin;
    p = (p + 1) % periodos;
  }
  return t + falta * enPeriodo(p) - minuto;
};

/** Minutos de manejar de `desde` a `hacia` saliendo en `minuto`, con el cambio de velocidad a mitad de tramo y el ritmo del camión. */
export const tiempoDeViaje = (tiempos: TiemposViaje, desde: string, hacia: string, minuto: number, ritmo = 1): number =>
  viajeConCambioDePeriodo(tiempos.cortes, minuto, (p) => tiempos.tiempo(desde, hacia, p === 0 ? 0 : (tiempos.cortes[p - 1] ?? 0)) * ritmo);

export type PeriodoVelocidad = { readonly desde: number; readonly hasta: number; readonly velocidadKmh: number };

export type ConfigHaversine = {
  /** Cuánto más largo es el recorrido real que la línea recta. */
  readonly circuidad: number;
  readonly periodos: readonly PeriodoVelocidad[];
  /** Velocidad fuera de los períodos listados. */
  readonly velocidadBaseKmh: number;
};

/** Valores iniciales a calibrar en el spike S1 (circuidad 1,35; 22/30/22 km/h en punta mañana/valle/punta tarde). */
export const CONFIG_HAVERSINE_POR_DEFECTO: ConfigHaversine = Object.freeze({
  circuidad: 1.35,
  velocidadBaseKmh: 30,
  periodos: [
    { desde: 7 * 60, hasta: 9 * 60 + 30, velocidadKmh: 22 },
    { desde: 9 * 60 + 30, hasta: 17 * 60 + 30, velocidadKmh: 30 },
    { desde: 17 * 60 + 30, hasta: 20 * 60 + 30, velocidadKmh: 22 },
  ],
});

/** Tiempo = distancia en línea recta × circuidad ÷ velocidad del período en que se sale. */
export const crearTiemposHaversine = (
  coordenadas: ReadonlyMap<string, Coordenada>,
  config: ConfigHaversine = CONFIG_HAVERSINE_POR_DEFECTO,
): TiemposViaje => {
  const cortes = [...new Set(config.periodos.flatMap((p) => [p.desde, p.hasta]))].sort((a, b) => a - b);
  const velocidadEn = (minuto: number): number =>
    config.periodos.find((p) => minuto >= p.desde && minuto < p.hasta)?.velocidadKmh ?? config.velocidadBaseKmh;
  const coord = (id: string): Coordenada => {
    const c = coordenadas.get(id);
    if (!c) throw new Error(`Falta la coordenada de ${id}`);
    return c;
  };
  return {
    cortes,
    tiempo: (desde, hacia, minuto) => {
      if (desde === hacia) return 0;
      const m = ((minuto % 1440) + 1440) % 1440;
      return ((distanciaKm(coord(desde), coord(hacia)) * config.circuidad) / velocidadEn(m)) * 60;
    },
  };
};

/**
 * Cuánto más lento se anda en el período de `minuto` que fuera de los períodos listados (1 en horario normal; 30/22 ≈ 1,36 en hora punta).
 * El servicio de calles da un solo tiempo por tramo, sin tráfico: así conserva la diferencia entre la hora punta y el resto del día.
 */
export const crearFactorHorario = (config: ConfigHaversine = CONFIG_HAVERSINE_POR_DEFECTO) => (minuto: number): number => {
  const m = ((minuto % 1440) + 1440) % 1440;
  const v = config.periodos.find((p) => m >= p.desde && m < p.hasta)?.velocidadKmh ?? config.velocidadBaseKmh;
  return v > 0 ? config.velocidadBaseKmh / v : 1;
};

/**
 * Tiempos por calles: donde se conoce el tiempo real de manejar entre dos puntos (minutos, de un servicio de rutas) se usa ese, ajustado por
 * la hora del día con `factor`; donde no, el cálculo en línea recta de respaldo. Así una consulta que falla o un par que falta nunca deja la
 * ruta sin tiempos.
 */
export const crearTiemposConViajes = (
  respaldo: TiemposViaje,
  viajeMin: (desde: string, hasta: string) => number | undefined,
  factor: (minuto: number) => number = () => 1,
): TiemposViaje => ({
  cortes: respaldo.cortes,
  tiempo: (desde, hasta, minuto) => {
    if (desde === hasta) return 0;
    const m = viajeMin(desde, hasta);
    return m !== undefined && Number.isFinite(m) && m >= 0 ? m * factor(minuto) : respaldo.tiempo(desde, hasta, minuto);
  },
});
