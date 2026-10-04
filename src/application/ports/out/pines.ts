import type { Result } from '../../../domain/shared/result.js';

export type EstadoPropuesta = 'pendiente' | 'aceptada' | 'rechazada' | 'sin_local';

export type NuevaPropuestaPin = {
  readonly localId?: string;
  readonly rut?: string;
  readonly direccion: string;
  readonly lat: number;
  readonly lng: number;
  readonly distanciaActualM?: number;
  readonly estado: 'pendiente' | 'sin_local';
};

export type PropuestaPin = {
  readonly id: string;
  readonly localId?: string;
  readonly rut?: string;
  readonly direccion: string;
  readonly lat: number;
  readonly lng: number;
  readonly distanciaActualM?: number;
  readonly estado: EstadoPropuesta;
  readonly proponenteId: string;
  readonly creadaEn: Date;
  readonly razonSocial?: string;
  readonly comuna?: string;
  readonly pinActual?: { readonly lat: number; readonly lng: number };
};

export type ErrorResolucion = 'NO_ENCONTRADA' | 'YA_RESUELTA' | 'SIN_LOCAL';

export interface PropuestaPinRepository {
  crearLote(empresaId: string, proponenteId: string, propuestas: readonly NuevaPropuestaPin[]): Promise<number>;
  listar(empresaId: string, estado: EstadoPropuesta, limite: number): Promise<readonly PropuestaPin[]>;
  /** Al aceptar, el pin del local pasa a «validado» en una sola transacción con el cambio de estado. */
  resolver(empresaId: string, id: string, resolutorId: string, aceptar: boolean, ahora: Date): Promise<Result<void, ErrorResolucion>>;
}
