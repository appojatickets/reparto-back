import type { Result } from '../../../domain/shared/result.js';

export type EstadoFactura = 'pendiente' | 'anulada';

export type FacturaDetallada = {
  readonly id: string;
  readonly folio: string;
  readonly fecha: string;
  readonly estado: EstadoFactura;
  readonly total?: number;
  readonly antesDeMin?: number;
  readonly urgente: boolean;
  readonly nota?: string;
  readonly camion?: { readonly id: string; readonly patente: string; readonly alias?: string };
  readonly local: { readonly id: string; readonly razonSocial: string; readonly direccion: string; readonly comuna: string; readonly tienePin: boolean };
};

export type NuevaFactura = {
  readonly folio: string;
  readonly localId: string;
  readonly fecha: string;
  readonly camionId?: string;
  readonly total?: number;
  readonly antesDeMin?: number;
  readonly urgente: boolean;
  readonly nota?: string;
  readonly creadoPor: string;
};

/** `null` borra el valor. */
export type CambiosFactura = {
  readonly camionId?: string | null;
  readonly fecha?: string;
  readonly total?: number | null;
  readonly antesDeMin?: number | null;
  readonly urgente?: boolean;
  readonly nota?: string | null;
  readonly estado?: EstadoFactura;
};

export type FiltroFacturas = { readonly fecha: string; readonly camionId?: string; readonly sinCamion?: boolean; readonly incluirAnuladas?: boolean };

export interface FacturaRepository {
  crear(empresaId: string, f: NuevaFactura): Promise<Result<FacturaDetallada, 'FOLIO_DUPLICADO' | 'LOCAL_NO_EXISTE' | 'CAMION_NO_DISPONIBLE'>>;
  obtener(empresaId: string, id: string): Promise<FacturaDetallada | undefined>;
  listar(empresaId: string, filtro: FiltroFacturas): Promise<readonly FacturaDetallada[]>;
  actualizar(empresaId: string, id: string, cambios: CambiosFactura): Promise<Result<FacturaDetallada, 'NO_ENCONTRADA' | 'CAMION_NO_DISPONIBLE'>>;
}
