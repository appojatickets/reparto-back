import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

/** Celular chileno normalizado como 569 + 8 dígitos (sin «+», espacios ni guiones): el formato que pide WhatsApp. */
export type Celular = string & { readonly __marca: 'Celular' };

export const parsearCelular = (texto: string): Result<Celular, ErrorDominio> => {
  const digitos = texto.replace(/[\s().+-]/g, '');
  const sinPais = /^569\d{8}$/.test(digitos) ? digitos.slice(2) : /^9\d{8}$/.test(digitos) ? digitos : undefined;
  return sinPais === undefined
    ? err(errorDominio('CELULAR_INVALIDO', 'El celular debe tener 9 dígitos y empezar con 9 (por ejemplo 9 1234 5678).'))
    : ok(`56${sinPais}` as Celular);
};

/** Para mostrar: 56912345678 → +56 9 1234 5678. */
export const formatearCelular = (c: Celular): string => c.replace(/^56(9)(\d{4})(\d{4})$/, '+56 $1 $2 $3');
