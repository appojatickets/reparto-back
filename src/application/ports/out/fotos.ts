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

/** La foto vigente de un local, para que el admin la mire aunque nadie la haya reportado. `fotoPath` identifica esa foto al verificarla. */
export type FotoSubida = {
  readonly localId: string;
  readonly fotoPath: string;
  readonly razonSocial: string;
  readonly direccion: string;
  readonly comuna: string;
  readonly subidaPor?: string;
  readonly subidaEn?: Date;
};

/** Una foto que el admin ya revisó y dio por buena. */
export type FotoVerificada = FotoSubida & { readonly verificadaPor?: string; readonly verificadaEn: Date };

export type ResolucionReporte = 'eliminada' | 'descartada';

export interface FotoReporteRepository {
  /** Un mismo usuario no repite el reporte de la misma foto mientras siga abierto (no falla, queda uno). */
  crear(empresaId: string, r: { readonly localId: string; readonly fotoPath: string; readonly motivo: MotivoReporteFoto; readonly detalle?: string; readonly reportadoPor: string }): Promise<void>;
  /** Solo los de la foto que el local tiene ahora: si la cambiaron, el reporte de la anterior ya no aplica. */
  abiertos(empresaId: string, limite: number): Promise<readonly ReporteFoto[]>;
  /** Fotos vigentes que el admin todavía no verifica: las subidas más nuevas primero (las sin fecha, al final). */
  porVerificar(empresaId: string, limite: number): Promise<readonly FotoSubida[]>;
  /** Fotos vigentes ya verificadas: la verificación más reciente primero. */
  verificadas(empresaId: string, limite: number): Promise<readonly FotoVerificada[]>;
  obtener(empresaId: string, id: string): Promise<{ readonly id: string; readonly localId: string; readonly fotoPath: string; readonly abierto: boolean } | undefined>;
  resolver(empresaId: string, id: string, usuarioId: string, resolucion: ResolucionReporte, ahora: Date): Promise<void>;
  /** Cierra todos los reportes abiertos de esa foto (cuando se elimina, uno o varios la reportaron). */
  resolverDeFoto(empresaId: string, localId: string, fotoPath: string, usuarioId: string, ahora: Date): Promise<void>;
}
