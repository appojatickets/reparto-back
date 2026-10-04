import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import type { DiaSemana, HorarioLocal } from './horario.js';

export type TramoDia = { readonly desde: number; readonly hasta: number };

/**
 * Lo que una persona declara de un día de la semana: «cerrado» o los tramos en que atiende (varios si hay colación).
 * Los días que no se mencionan quedan sin dato: no tienen restricción.
 */
export type DiaHorario = { readonly dia: DiaSemana; readonly cerrado: boolean; readonly tramos: readonly TramoDia[] };

export type DiaHorarioCrudo = { readonly dia: number; readonly cerrado: boolean; readonly tramos: readonly TramoDia[] };

const MAX_TRAMOS = 3;
const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
const esDia = (d: number): d is DiaSemana => Number.isInteger(d) && d >= 0 && d <= 6;

export const validarHorarioSemanal = (entrada: readonly DiaHorarioCrudo[]): Result<readonly DiaHorario[], readonly ErrorDominio[]> => {
  const errores: ErrorDominio[] = [];
  const vistos = new Set<number>();
  const dias: DiaHorario[] = [];

  for (const d of entrada) {
    if (!esDia(d.dia)) {
      errores.push(errorDominio('DIA_INVALIDO', 'El día de la semana no es válido.'));
      continue;
    }
    const nombre = NOMBRE_DIA[d.dia];
    if (vistos.has(d.dia)) {
      errores.push(errorDominio('DIA_REPETIDO', `El ${nombre} está repetido.`));
      continue;
    }
    vistos.add(d.dia);
    if (d.cerrado) {
      if (d.tramos.length > 0) errores.push(errorDominio('CERRADO_CON_TRAMOS', `El ${nombre} está cerrado: no puede tener horas de atención.`));
      else dias.push({ dia: d.dia, cerrado: true, tramos: [] });
      continue;
    }
    if (d.tramos.length === 0 || d.tramos.length > MAX_TRAMOS) {
      errores.push(errorDominio('TRAMOS_INVALIDOS', `El ${nombre} debe tener entre 1 y ${MAX_TRAMOS} tramos de atención.`));
      continue;
    }
    const tramos = [...d.tramos].sort((a, b) => a.desde - b.desde);
    const malo = tramos.some((t) => !Number.isInteger(t.desde) || !Number.isInteger(t.hasta) || t.desde < 0 || t.hasta > 1439 || t.desde >= t.hasta);
    if (malo) {
      errores.push(errorDominio('TRAMO_INVALIDO', `El ${nombre}: cada tramo debe abrir antes de cerrar, dentro del día.`));
      continue;
    }
    if (tramos.some((t, i) => i > 0 && t.desde <= (tramos[i - 1]?.hasta ?? 0))) {
      errores.push(errorDominio('TRAMOS_SOLAPADOS', `El ${nombre}: los tramos se solapan o se tocan; si hay colación debe quedar un espacio entre ellos.`));
      continue;
    }
    dias.push({ dia: d.dia, cerrado: false, tramos });
  }
  return errores.length > 0 ? err(errores) : ok(dias.sort((a, b) => a.dia - b.dia));
};

const clave = (d: DiaHorario): string => (d.cerrado ? 'cerrado' : d.tramos.map((t) => `${t.desde}-${t.hasta}`).join(','));

/** Junta los días con el mismo horario en un solo registro (es como se guarda). «Cerrado» = registro sin tramos. */
export const agruparDias = (dias: readonly DiaHorario[]): readonly { readonly dias: readonly DiaSemana[]; readonly tramos: readonly TramoDia[] }[] => {
  const grupos = new Map<string, { dias: DiaSemana[]; tramos: readonly TramoDia[] }>();
  for (const d of dias) {
    const k = clave(d);
    const g = grupos.get(k) ?? { dias: [], tramos: d.tramos };
    g.dias.push(d.dia);
    grupos.set(k, g);
  }
  return [...grupos.values()];
};

/** Operación inversa de `agruparDias`, a partir de los horarios confirmados guardados. */
export const diasDeHorarios = (horarios: readonly Pick<HorarioLocal, 'dias' | 'tramos'>[]): readonly DiaHorario[] => {
  const porDia = new Map<DiaSemana, TramoDia[]>();
  const cerrados = new Set<DiaSemana>();
  for (const h of horarios) {
    for (const dia of h.dias) {
      if (h.tramos.length === 0) cerrados.add(dia);
      else porDia.set(dia, [...(porDia.get(dia) ?? []), ...h.tramos.map((t) => ({ desde: t.apertura, hasta: t.cierre }))]);
    }
  }
  const resultado: DiaHorario[] = [];
  for (let dia = 0 as DiaSemana; dia <= 6; dia = (dia + 1) as DiaSemana) {
    const tramos = porDia.get(dia);
    if (tramos) resultado.push({ dia, cerrado: false, tramos: [...tramos].sort((a, b) => a.desde - b.desde) });
    else if (cerrados.has(dia)) resultado.push({ dia, cerrado: true, tramos: [] });
  }
  return resultado;
};
