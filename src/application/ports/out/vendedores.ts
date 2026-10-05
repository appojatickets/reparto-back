import type { Result } from '../../../domain/shared/result.js';

export type Vendedor = { readonly id: string; readonly codigo: string; readonly nombre: string; readonly celular?: string; readonly activo: boolean };

export interface VendedorRepository {
  listar(empresaId: string, opciones: { soloActivos?: boolean }): Promise<readonly Vendedor[]>;
  crear(empresaId: string, datos: { codigo: string; nombre: string; celular?: string }): Promise<Result<Vendedor, 'CODIGO_DUPLICADO'>>;
  /** `null` borra el celular. Devuelve undefined si el vendedor no existe en esa empresa. */
  actualizar(empresaId: string, id: string, cambios: { nombre?: string; celular?: string | null; activo?: boolean }): Promise<Vendedor | undefined>;
}
