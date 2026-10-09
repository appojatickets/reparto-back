import type { Vendedor } from './vendedores.js';

export type PersonaDeCamion = { readonly nombre: string; readonly usuarioId?: string };

/** Qué lleva un camión un día: quiénes van, qué vendedores atiende y qué comunas hace. */
export type AsignacionDia = {
  readonly fecha: string;
  readonly camion: { readonly id: string; readonly patente: string; readonly alias?: string };
  readonly chofer?: PersonaDeCamion;
  readonly ayudante?: PersonaDeCamion;
  readonly comunas: readonly string[];
  readonly vendedores: readonly Vendedor[];
};

export type NuevaAsignacion = {
  readonly camionId: string;
  readonly chofer?: PersonaDeCamion;
  readonly ayudante?: PersonaDeCamion;
  readonly comunas: readonly string[];
  readonly vendedorIds: readonly string[];
};

export interface PlanillaRepository {
  /** Guarda (o reemplaza) la asignación de cada camión de la lista ese día; los demás camiones no se tocan. */
  guardar(empresaId: string, fecha: string, filas: readonly NuevaAsignacion[], creadoPor: string): Promise<void>;
  obtener(empresaId: string, fecha: string): Promise<readonly AsignacionDia[]>;
  deCamion(empresaId: string, fecha: string, camionId: string): Promise<AsignacionDia | undefined>;
}
