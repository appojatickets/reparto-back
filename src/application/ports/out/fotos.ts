import type { MotivoReporteFoto } from '../../../domain/entidades/foto-reporte.js';

/** Un reporte abierto de una foto mal tomada, con los datos del local y de quien la subió. */
export type ReporteFoto = {
  readonly id: string;
  readonly localId: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly motivo: MotivoReporteFoto;
  readonly detalle?: string;
  readonly reportadoPor?: string;
  readonly reportadoEn: Date;
  readonly subidaPor?: string;
  readonly subidaEn?: Date;
};

/** Una foto subida hace poco (para que el admin la mire aunque nadie la haya reportado). */
export type FotoReciente = {
  readonly localId: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly subidaPor?: string;
  readonly subidaEn?: Date;
};

export type ResolucionReporte = 'eliminada' | 'descartada';

export interface FotoReporteRepository {
  /** Un mismo usuario no repite el reporte de la misma foto mientras siga abierto (no falla, queda uno). */
  crear(empresaId: string, r: { readonly localId: string; readonly fotoPath: string; readonly motivo: MotivoReporteFoto; readonly detalle?: string; readonly reportadoPor: string }): Promise<void>;
  /** Solo los de la foto que el local tiene ahora: si la cambiaron, el reporte de la anterior ya no aplica. */
  abiertos(empresaId: string, limite: number): Promise<readonly ReporteFoto[]>;
  recientes(empresaId: string, limite: number): Promise<readonly FotoReciente[]>;
  obtener(empresaId: string, id: string): Promise<{ readonly id: string; readonly localId: string; readonly fotoPath: string; readonly abierto: boolean } | undefined>;
  resolver(empresaId: string, id: string, usuarioId: string, resolucion: ResolucionReporte, ahora: Date): Promise<void>;
  /** Cierra todos los reportes abiertos de esa foto (cuando se elimina, uno o varios la reportaron). */
  resolverDeFoto(empresaId: string, localId: string, fotoPath: string, usuarioId: string, ahora: Date): Promise<void>;
}
