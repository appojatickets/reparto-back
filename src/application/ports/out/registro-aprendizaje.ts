import type { Jornada } from './jornadas.js';

export type TipoOperacionRuta = 'planificar' | 'subir' | 'bajar' | 'primero' | 'despues' | 'mover' | 'quitar' | 'ordenar' | 'insertar' | 'salida';

/** Cada cálculo o movimiento de la ruta, con el orden que quedó: es lo que permite comparar lo que sugirió el sistema con lo que se hizo. */
export type OperacionRuta = {
  readonly camionId: string;
  readonly fecha: string;
  readonly usuarioId: string;
  readonly tipo: TipoOperacionRuta;
  readonly facturaId?: string;
  readonly modo: 'sugerida' | 'manual';
  readonly version: number;
  readonly orden: readonly string[];
};

/** Dónde estaba el camión (se sigue al camión, no a la persona). */
export type PuntoPosicion = {
  readonly lat: number;
  readonly lng: number;
  readonly precisionM?: number;
  readonly velocidadMs?: number;
  readonly tomadoEn: Date;
};

export type ResumenDeJornada = {
  readonly jornadaId: string;
  readonly camionId: string;
  readonly fecha: string;
  readonly paradas: number;
  readonly entregadas: number;
  readonly noEntregadas: number;
  readonly sinHacer: number;
  /** Las que iban en la ruta y no se alcanzaron: al soltarlas del camión se perdería este dato. */
  readonly sinHacerIds: readonly string[];
  readonly duracionMin: number;
};

/** Lo que se guarda para siempre con el fin de que el sistema aprenda. Nada de aquí se borra al terminar la ruta. */
export interface RegistroAprendizajeRepository {
  registrarOperacion(empresaId: string, op: OperacionRuta): Promise<void>;
  registrarPosiciones(empresaId: string, camionId: string, usuarioId: string, puntos: readonly PuntoPosicion[]): Promise<void>;
  /** Las posiciones del camión desde ese momento, de la más antigua a la más reciente. */
  posicionesDesde(empresaId: string, camionId: string, desde: Date): Promise<readonly PuntoPosicion[]>;
  guardarResumenDeJornada(empresaId: string, resumen: ResumenDeJornada): Promise<void>;
}

export type { Jornada };
