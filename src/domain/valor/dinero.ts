import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

/** Pesos chilenos enteros (CLP no tiene decimales). */
export type Dinero = number & { readonly __marca: 'Dinero' };

export const dinero = (n: number): Result<Dinero, ErrorDominio> =>
  Number.isSafeInteger(n) && n >= 0
    ? ok(n as Dinero)
    : err(errorDominio('DINERO_INVALIDO', 'El monto debe ser un número entero de pesos, sin decimales.'));

export const sumarDinero = (a: Dinero, b: Dinero): Dinero => (a + b) as Dinero;

export const formatearDinero = (d: Dinero): string => `$${String(d).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
