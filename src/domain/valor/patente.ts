import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

/** Patente chilena normalizada (mayúsculas, sin espacios ni guiones): 4 letras + 2 dígitos (actual) o 2 letras + 4 dígitos (antigua). */
export type Patente = string & { readonly __marca: 'Patente' };

export const parsearPatente = (texto: string): Result<Patente, ErrorDominio> => {
  const limpia = texto.replace(/[\s.-]/g, '').toUpperCase();
  return /^[A-Z]{4}\d{2}$/.test(limpia) || /^[A-Z]{2}\d{4}$/.test(limpia)
    ? ok(limpia as Patente)
    : err(errorDominio('PATENTE_INVALIDA', 'La patente debe tener 4 letras y 2 números (ABCD12) o 2 letras y 4 números (AB1234).'));
};

/** Para mostrar: letras y números separados (ABCD12 → ABCD·12, AB1234 → AB·1234). */
export const formatearPatente = (p: Patente): string => p.replace(/^([A-Z]+)(\d+)$/, '$1·$2');
