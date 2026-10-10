import type { VentanaHoraria } from '../valor/ventana-horaria.js';
import type { ParametrosRuteo } from './parametros.js';
import type { TiemposViaje } from './tiempos.js';

export type ParadaRuta = {
  readonly id: string;
  readonly nombre: string;
  readonly comuna?: string;
  /** Tramos en que atiende. Lista vacía = sin restricción. Son ventanas duras. */
  readonly ventanas: readonly VentanaHoraria[];
  readonly servicioMin: number;
  readonly prioridad: boolean;
  /** En qué orden cargó el chofer esta factura (0 = la primera). Suele parecerse al orden en que entrega. */
  readonly ordenCarga?: number;
  /** Distancia en línea recta al depósito (km): sirve para partir por lo más lejano o por lo más cercano. */
  readonly distanciaDepositoKm?: number;
};

/**
 * Una ruta de UN vehículo. Las paradas hechas no entran: el prefijo `fijas` son las pendientes que el chofer
 * decidió hacer primero y que el motor no mueve.
 */
export type ProblemaRuta = {
  /** Hora de salida del depósito o, al reoptimizar, la hora actual (minutos del día). */
  readonly salida: number;
  readonly paradas: readonly ParadaRuta[];
  readonly fijas: readonly string[];
  readonly tiempos: TiemposViaje;
  /** Multiplica los tiempos de viaje (1 = ritmo esperado). */
  readonly ritmo: number;
  readonly parametros: ParametrosRuteo;
};

export type Motivo =
  | 'VENTANA_DURA'
  | 'PRIORIDAD'
  | 'CERCANIA_COMUNA'
  | 'COLACION'
  | 'FIJADA_POR_CHOFER'
  | 'MENOR_DESVIO';

export type Sugerencia = {
  readonly tipo: 'MOVER_AL_INICIO' | 'SALIR_ANTES' | 'OTRO_CAMION';
  readonly minutos?: number;
  readonly texto: string;
};

export type DetalleParada = {
  readonly id: string;
  readonly nombre: string;
  readonly posicion: number;
  readonly llegada: number;
  readonly inicioServicio: number;
  readonly salida: number;
  readonly espera: number;
  readonly atraso: number;
  readonly motivos: readonly Motivo[];
};

export type EnRiesgo = {
  readonly paradaId: string;
  readonly nombre: string;
  /** Cierre del último tramo (minutos del día). */
  readonly cierre: number;
  readonly conflictos: readonly string[];
  readonly sugerencias: readonly Sugerencia[];
};

export type NoAtendida = {
  readonly paradaId: string;
  readonly nombre: string;
  readonly motivo: 'VENTANA_VENCIDA';
  readonly conflictos: readonly string[];
};

export type Solucion = {
  readonly orden: readonly string[];
  readonly detalle: readonly DetalleParada[];
  readonly enRiesgo: readonly EnRiesgo[];
  readonly noAtendidas: readonly NoAtendida[];
  /** Hora estimada de regreso al depósito (minutos; puede pasar de 1440). */
  readonly regreso: number;
  /** Verdadero si el regreso supera la hora límite (alerta de las 21:00). */
  readonly regresoTardio: boolean;
  readonly costo: number;
};

/** Reloj inyectado (ms) para acotar el tiempo de cómputo sin usar `Date.now()` en el dominio. */
export type Presupuesto = { readonly reloj: () => number; readonly limiteMs: number };

export type OpcionesOptimizacion = {
  readonly presupuesto?: Presupuesto;
  /** Orden previo a mejorar (ids). Lo que no esté en él se inserta por inserción más barata. */
  readonly ordenInicial?: readonly string[];
};
