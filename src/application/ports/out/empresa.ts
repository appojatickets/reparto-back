import type { ConfigEmpresa } from '../../../domain/entidades/config-empresa.js';

export interface EmpresaRepository {
  /** `undefined` si la empresa no existe; los valores que falten en la base se completan con los por defecto. */
  obtenerConfig(empresaId: string): Promise<ConfigEmpresa | undefined>;
  guardarConfig(empresaId: string, config: ConfigEmpresa): Promise<void>;
}
