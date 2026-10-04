import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

/** Clave del chofer: 6 dígitos. Se rechazan las triviales (todos iguales o secuencia 123456 / 654321). */
export const validarPin = (pin: string): Result<string, ErrorDominio> => {
  if (!/^\d{6}$/.test(pin)) {
    return err(errorDominio('PIN_FORMATO_INVALIDO', 'La clave debe tener exactamente 6 dígitos.'));
  }
  const d = pin.split('').map(Number); // solo dígitos ASCII (validado arriba)
  const pasos = d.slice(1).map((x, i) => x - (d[i] ?? 0));
  const igual = pasos.every((p) => p === 0);
  const secuencia = pasos.every((p) => p === 1) || pasos.every((p) => p === -1);
  return igual || secuencia ? err(errorDominio('PIN_DEBIL', 'La clave es demasiado fácil de adivinar.')) : ok(pin);
};
