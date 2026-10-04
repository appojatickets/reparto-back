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
