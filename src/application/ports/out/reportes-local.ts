import type { TipoReporteLocal } from '../../../domain/entidades/reporte-local.js';

/** Un reporte abierto del nombre o de la ubicación de un local. */
export type ReporteLocal = {
  readonly id: string;
  readonly tipo: TipoReporteLocal;
  readonly localId: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly detalle?: string;
  /** Solo en «nombre»: cómo debería llamarse, según quien reportó. */
  readonly sugerido?: string;
  readonly reportadoPor?: string;
  readonly reportadoEn: Date;
  /** El nombre o el pin ya no es el que se reportó (alguien lo corrigió o el pin se movió): el reporte sigue abierto hasta que el admin lo cierre. */
  readonly cambioDesdeElReporte: boolean;
};

export type ResolucionReporteLocal = 'corregido' | 'descartado';

export interface ReporteLocalRepository {
  /** Toma nota de cómo estaba el nombre y el pin. Un mismo usuario no repite el mismo tipo de reporte mientras siga abierto (no falla, queda uno). */
  crear(empresaId: string, r: { readonly localId: string; readonly tipo: TipoReporteLocal; readonly detalle?: string; readonly sugerido?: string; readonly reportadoPor: string }): Promise<void>;
  /** Los reportes sin resolver, los más nuevos primero. */
  abiertos(empresaId: string, limite: number): Promise<readonly ReporteLocal[]>;
  obtener(empresaId: string, id: string): Promise<{ readonly id: string; readonly localId: string; readonly tipo: TipoReporteLocal; readonly abierto: boolean } | undefined>;
  resolver(empresaId: string, id: string, usuarioId: string, resolucion: ResolucionReporteLocal, ahora: Date): Promise<void>;
}
