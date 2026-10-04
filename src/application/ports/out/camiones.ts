import type { Result } from '../../../domain/shared/result.js';

export type Camion = { readonly id: string; readonly patente: string; readonly alias?: string; readonly activo: boolean };

export interface CamionRepository {
  listar(empresaId: string, opciones: { soloActivos?: boolean }): Promise<readonly Camion[]>;
  crear(empresaId: string, datos: { patente: string; alias?: string }): Promise<Result<Camion, 'PATENTE_DUPLICADA'>>;
  /** `null` borra el alias. Devuelve undefined si el camión no existe en esa empresa. */
  actualizar(empresaId: string, id: string, cambios: { alias?: string | null; activo?: boolean }): Promise<Camion | undefined>;
}
