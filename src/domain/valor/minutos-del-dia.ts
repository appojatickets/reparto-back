import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';

/** Hora del día como minutos desde las 00:00 (0..1439). */
export type MinutosDelDia = number & { readonly __marca: 'MinutosDelDia' };

export const minutosDelDia = (n: number): Result<MinutosDelDia, ErrorDominio> =>
  Number.isInteger(n) && n >= 0 && n < 1440
    ? ok(n as MinutosDelDia)
    : err(errorDominio('MINUTOS_INVALIDOS', 'La hora debe estar entre 00:00 y 23:59.'));

export const minutosDesdeHora = (texto: string): Result<MinutosDelDia, ErrorDominio> => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return err(errorDominio('HORA_INVALIDA', 'La hora debe tener el formato HH:MM.'));
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (minutos > 59) return err(errorDominio('HORA_INVALIDA', 'La hora debe tener el formato HH:MM.'));
  return minutosDelDia(horas * 60 + minutos);
};

/** Formatea minutos como HH:MM; pasada la medianoche vuelve a empezar (1500 → 01:00). */
export const formatearMinutos = (minutos: number): string => {
  const dentroDelDia = ((Math.round(minutos) % 1440) + 1440) % 1440;
  const h = Math.floor(dentroDelDia / 60);
  const m = dentroDelDia % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
