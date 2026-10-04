import type { EventoValido } from '../../../domain/entidades/entrega.js';

export type NuevoEvento = EventoValido & {
  readonly facturaId: string;
  readonly localId: string;
  readonly camionId?: string;
  readonly usuarioId: string;
  /** Si se indica, la factura pasa a ese estado en la misma operación que guarda el aviso. */
  readonly nuevoEstado?: 'entregada' | 'no_entregada';
};

export type PosicionConocida = { readonly lat: number; readonly lng: number; readonly en: Date };

export interface EntregaRepository {
  registrar(empresaId: string, evento: NuevoEvento): Promise<void>;
  /** La última posición informada por ese camión en ese día de reparto (hora de Chile), si hay. */
  ultimaPosicion(empresaId: string, camionId: string, fecha: string): Promise<PosicionConocida | undefined>;
}
