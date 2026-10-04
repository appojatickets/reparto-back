import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { esFechaValida, type Fecha } from '../shared/fechas.js';

export type FacturaCruda = {
  readonly folio?: string | undefined;
  readonly fecha?: string | undefined;
  readonly total?: number | undefined;
  readonly antesDeMin?: number | undefined;
  readonly urgente?: boolean | undefined;
  readonly nota?: string | undefined;
};

export type DatosFactura = {
  readonly folio?: string;
  readonly fecha?: Fecha;
  readonly total?: number;
  readonly antesDeMin?: number;
  readonly urgente: boolean;
  readonly nota?: string;
};

const FOLIO = /^[A-Za-z0-9-]{1,20}$/;

export const normalizarFolio = (texto: string): string => texto.trim().replace(/\s+/g, '');

export const validarTotal = (total: number): boolean => Number.isSafeInteger(total) && total >= 0;
export const validarAntesDe = (min: number): boolean => Number.isInteger(min) && min >= 0 && min <= 1439;
export const validarNota = (nota: string): boolean => nota.trim().length <= 300;

/** Valida lo que se escribe al ingresar una entrega. El folio es opcional: si viene, debe ser válido. Junta todos los errores. */
export const validarFactura = (f: FacturaCruda): Result<DatosFactura, ErrorDominio[]> => {
  const errores: ErrorDominio[] = [];
  const folio = normalizarFolio(f.folio ?? '');
  if (folio !== '' && !FOLIO.test(folio)) errores.push(errorDominio('FOLIO_INVALIDO', 'El folio solo puede tener letras, números y guiones (máximo 20).'));
  if (f.fecha !== undefined && !esFechaValida(f.fecha)) errores.push(errorDominio('FECHA_INVALIDA', 'La fecha de reparto no es válida.'));
  if (f.total !== undefined && !validarTotal(f.total)) errores.push(errorDominio('TOTAL_INVALIDO', 'El total debe ser un número entero de pesos.'));
  if (f.antesDeMin !== undefined && !validarAntesDe(f.antesDeMin)) errores.push(errorDominio('HORA_LIMITE_INVALIDA', 'La hora límite no es válida.'));
  const nota = f.nota?.trim() ?? '';
  if (!validarNota(nota)) errores.push(errorDominio('NOTA_LARGA', 'La nota supera 300 caracteres.'));
  if (errores.length > 0) return err(errores);
  return ok({
    ...(folio !== '' ? { folio } : {}),
    ...(f.fecha !== undefined ? { fecha: f.fecha } : {}),
    ...(f.total !== undefined ? { total: f.total } : {}),
    ...(f.antesDeMin !== undefined ? { antesDeMin: f.antesDeMin } : {}),
    urgente: f.urgente ?? false,
    ...(nota !== '' ? { nota } : {}),
  });
};
