import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

export type Rut = { readonly cuerpo: number; readonly dv: string };

const FACTORES = [2, 3, 4, 5, 6, 7];

/** Dígito verificador por módulo 11: suma ponderada de derecha a izquierda con la serie 2..7. */
const calcularDv = (cuerpo: number): string => {
  let suma = 0;
  let i = 0;
  for (let resto = cuerpo; resto > 0; resto = Math.floor(resto / 10)) {
    suma += (resto % 10) * (FACTORES[i % FACTORES.length] ?? 0);
    i++;
  }
  const dv = 11 - (suma % 11);
  if (dv === 11) return '0';
  if (dv === 10) return 'K';
  return String(dv);
};

export const parsearRut = (texto: string): Result<Rut, ErrorDominio> => {
  const limpio = texto.replace(/[.\s-]/g, '').toUpperCase();
  const m = /^(\d{1,8})([\dK])$/.exec(limpio);
  if (!m) return err(errorDominio('RUT_FORMATO_INVALIDO', 'El RUT no tiene un formato válido.'));
  const cuerpo = Number(m[1]);
  const dv = m[2] ?? '';
  if (cuerpo < 1) return err(errorDominio('RUT_FORMATO_INVALIDO', 'El RUT no tiene un formato válido.'));
  if (calcularDv(cuerpo) !== dv) return err(errorDominio('RUT_DV_INVALIDO', 'El dígito verificador del RUT no coincide.'));
  return ok(Object.freeze({ cuerpo, dv }));
};

/** Forma de almacenamiento: sin puntos y con guion (`12345678-5`). */
export const normalizarRut = (rut: Rut): string => `${rut.cuerpo}-${rut.dv}`;

export const formatearRut = (rut: Rut): string =>
  `${String(rut.cuerpo).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rut.dv}`;
