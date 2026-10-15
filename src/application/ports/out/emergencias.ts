import type { EmergenciaValida } from '../../../domain/entidades/emergencia.js';

export type NuevaEmergencia = EmergenciaValida & { readonly camionId: string; readonly usuarioId: string };

/** Una parada de emergencia ya registrada: cuándo, dónde estaba el camión y qué se fue a buscar. */
export type EmergenciaRegistrada = EmergenciaValida & {
  readonly id: string;
  readonly camionId: string;
  readonly usuarioId?: string;
  readonly creadoEn: Date;
};

export interface EmergenciaRepository {
  registrar(empresaId: string, e: NuevaEmergencia): Promise<EmergenciaRegistrada>;
  /** Las paradas de emergencia de ese día (hora de Chile), de la más antigua a la más reciente; de un camión o de todos. */
  delDia(empresaId: string, fecha: string, camionId?: string): Promise<readonly EmergenciaRegistrada[]>;
}
