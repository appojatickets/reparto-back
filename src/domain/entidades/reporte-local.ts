import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { err, ok, type Result } from '../shared/result.js';

/** Lo que se puede reportar de un local además de su foto: el nombre del cliente o la ubicación (el pin). */
export const TIPOS_REPORTE_LOCAL = ['nombre', 'ubicacion'] as const;
export type TipoReporteLocal = (typeof TIPOS_REPORTE_LOCAL)[number];

export const MAX_DETALLE_REPORTE_LOCAL = 200;
export const MAX_NOMBRE_SUGERIDO = 120;

export type ReporteLocalCrudo = { readonly tipo?: string | undefined; readonly detalle?: string | undefined; readonly sugerido?: string | undefined };
export type ReporteLocalValido = { readonly tipo: TipoReporteLocal; readonly detalle?: string; readonly sugerido?: string };

const limpiar = (t: string | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();

/** El reporte del nombre o de la ubicación de un local: el tipo y, si quiere, una explicación corta (y, para el nombre, cómo debería llamarse). */
export const validarReporteLocal = (r: ReporteLocalCrudo): Result<ReporteLocalValido, ErrorDominio[]> => {
  const tipo = TIPOS_REPORTE_LOCAL.find((t) => t === r.tipo);
  const detalle = limpiar(r.detalle);
  const sugerido = limpiar(r.sugerido);
  const errores: ErrorDominio[] = [];
  if (!tipo) errores.push(errorDominio('TIPO_INVALIDO', 'Elige qué reportas: el nombre o la ubicación.'));
  if (detalle.length > MAX_DETALLE_REPORTE_LOCAL) errores.push(errorDominio('DETALLE_LARGO', `La explicación supera ${String(MAX_DETALLE_REPORTE_LOCAL)} caracteres.`));
  if (sugerido.length > MAX_NOMBRE_SUGERIDO) errores.push(errorDominio('NOMBRE_LARGO', `El nombre supera ${String(MAX_NOMBRE_SUGERIDO)} caracteres.`));
  if (errores.length > 0 || !tipo) return err(errores);
  return ok({ tipo, ...(detalle !== '' ? { detalle } : {}), ...(tipo === 'nombre' && sugerido !== '' ? { sugerido } : {}) });
};
