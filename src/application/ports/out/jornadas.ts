import type { Result } from '../../../domain/shared/result.js';

export type Jornada = {
  readonly id: string;
  readonly usuarioId: string;
  readonly fecha: string;
  readonly desde: Date;
  readonly camion: { readonly id: string; readonly patente: string; readonly alias?: string };
};

export interface JornadaRepository {
  /** La jornada abierta del usuario si es de esa fecha; una abierta de otro día no cuenta. */
  activa(empresaId: string, usuarioId: string, fecha: string): Promise<Jornada | undefined>;
  /** Cierra la jornada abierta del usuario (si hay) y abre una en ese camión. */
  iniciar(empresaId: string, usuarioId: string, camionId: string, fecha: string, ahora: Date): Promise<Result<Jornada, 'CAMION_NO_DISPONIBLE'>>;
  /**
   * La ventana de trabajo del camión ese día (ADR 0045): el camión es dueño de la ruta y puede tener varias personas a la vez, así que se juntan
   * sus jornadas traslapadas. Marca desde cuándo cuenta lo hecho en la lista de la ruta; `hasta` solo si ya nadie sigue en el camión.
   */
  ultimaDelCamion(empresaId: string, camionId: string, fecha: string): Promise<{ readonly desde: Date; readonly hasta?: Date } | undefined>;
  /** Cuántas personas siguen con jornada abierta en ese camión ese día. */
  abiertasEnCamion(empresaId: string, camionId: string, fecha: string): Promise<number>;
  /** Cierra la jornada abierta. Devuelve false si no había. */
  terminar(empresaId: string, usuarioId: string, ahora: Date): Promise<boolean>;
}
