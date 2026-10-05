import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { err, ok, type Result } from '../shared/result.js';

export const MOTIVOS_REPORTE_FOTO = ['no_es_la_fachada', 'se_ven_personas', 'borrosa', 'otra'] as const;
export type MotivoReporteFoto = (typeof MOTIVOS_REPORTE_FOTO)[number];

export const TEXTO_MOTIVO_FOTO: Readonly<Record<MotivoReporteFoto, string>> = {
  no_es_la_fachada: 'No es la fachada del local',
  se_ven_personas: 'Se ven personas',
  borrosa: 'Está borrosa o oscura',
  otra: 'Otro motivo',
};

export const MAX_DETALLE_REPORTE = 200;

export type ReporteFotoCrudo = { readonly motivo?: string | undefined; readonly detalle?: string | undefined };
export type ReporteFotoValido = { readonly motivo: MotivoReporteFoto; readonly detalle?: string };

/** El reporte de una foto mal tomada: un motivo de la lista y, si quiere, una explicación corta. */
export const validarReporteFoto = (r: ReporteFotoCrudo): Result<ReporteFotoValido, ErrorDominio[]> => {
  const motivo = MOTIVOS_REPORTE_FOTO.find((m) => m === r.motivo);
  const detalle = (r.detalle ?? '').replace(/\s+/g, ' ').trim();
  const errores: ErrorDominio[] = [];
  if (!motivo) errores.push(errorDominio('MOTIVO_INVALIDO', 'Elige por qué reportas la foto.'));
  if (detalle.length > MAX_DETALLE_REPORTE) errores.push(errorDominio('DETALLE_LARGO', `La explicación supera ${MAX_DETALLE_REPORTE} caracteres.`));
  if (errores.length > 0 || !motivo) return err(errores);
  return ok({ motivo, ...(detalle !== '' ? { detalle } : {}) });
};
