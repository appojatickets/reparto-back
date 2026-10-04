import type { Rut } from '../valor/rut.js';

export type EstadoCliente = 'nuevo' | 'activo' | 'inactivo' | 'cerrado' | 'archivado';

export type Cliente = {
  readonly id: string;
  readonly rut?: Rut;
  readonly razonSocial: string;
  readonly giro?: string;
  readonly estado: EstadoCliente;
};

/** Un cliente «nuevo» (creado por el chofer, pendiente de revisión) igual se reparte. */
export const disponibleParaReparto = (estado: EstadoCliente): boolean => estado === 'nuevo' || estado === 'activo';
