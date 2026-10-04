import { intersectarConLimite, normalizarTramos, type VentanaHoraria } from '../valor/ventana-horaria.js';

/** 0 = domingo … 6 = sábado (igual que `horario_local.dias` en la base). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type FuenteHorario = 'confirmado' | 'aprendido' | 'sugerido' | 'giro';

export type HorarioLocal = {
  readonly dias: readonly DiaSemana[];
  readonly tramos: readonly VentanaHoraria[];
  readonly fuente: FuenteHorario;
  readonly confianza: number;
};

/** Lo que el despachador o el chofer fijan para hoy. Solo «antes de» altera la ventana; la prioridad la usa el ruteo. */
export type CondicionDia = { readonly antesDeMin?: number; readonly prioridad?: boolean; readonly nota?: string };

export type ResolucionHorario =
  | { readonly tipo: 'sin_restriccion' }
  | { readonly tipo: 'ventanas'; readonly ventanas: readonly VentanaHoraria[]; readonly fuente: FuenteHorario | 'condicion_del_dia' }
  | { readonly tipo: 'imposible'; readonly motivo: 'CERRADO_ESE_DIA' | 'CONDICION_ANTES_DE_APERTURA' };

/**
 * Precedencia de datos (de mayor a menor): condición del día → observación confirmada → aprendido → sugerido → giro.
 * La condición del día no reemplaza al horario: lo recorta (no se puede entregar con el local cerrado).
 */
const PRECEDENCIA: readonly FuenteHorario[] = ['confirmado', 'aprendido', 'sugerido', 'giro'];

/** Ventana que significa «ya cerró»: el motor la trata como vencida en lugar de ignorarla en silencio. */
export const VENTANA_VENCIDA: VentanaHoraria = Object.freeze({ apertura: 0, cierre: 0 });

export const resolverHorario = (
  horarios: readonly HorarioLocal[],
  dia: DiaSemana,
  condicion?: CondicionDia,
): ResolucionHorario => {
  const delDia = horarios.filter((h) => h.dias.includes(dia));
  const fuente = PRECEDENCIA.find((f) => delDia.some((h) => h.fuente === f));

  // Un día sin dato es un día sin restricción: no se inventan cierres. «Cerrado» es un dato explícito: una fila sin tramos.
  let ventanas: readonly VentanaHoraria[] | undefined;
  if (fuente) {
    ventanas = normalizarTramos(delDia.filter((h) => h.fuente === fuente).flatMap((h) => h.tramos));
    if (ventanas.length === 0) return { tipo: 'imposible', motivo: 'CERRADO_ESE_DIA' };
  }

  const limite = condicion?.antesDeMin;
  if (limite === undefined) {
    return fuente && ventanas ? { tipo: 'ventanas', ventanas, fuente } : { tipo: 'sin_restriccion' };
  }
  if (!ventanas) {
    return { tipo: 'ventanas', ventanas: [Object.freeze({ apertura: 0, cierre: limite })], fuente: 'condicion_del_dia' };
  }
  const recortadas = intersectarConLimite(ventanas, limite);
  return recortadas.length === 0 || !fuente
    ? { tipo: 'imposible', motivo: 'CONDICION_ANTES_DE_APERTURA' }
    : { tipo: 'ventanas', ventanas: recortadas, fuente };
};

/** Adapta la resolución al formato del motor: [] = sin restricción; imposible = ventana ya vencida. */
export const ventanasParaRuta = (r: ResolucionHorario): readonly VentanaHoraria[] => {
  switch (r.tipo) {
    case 'sin_restriccion':
      return [];
    case 'ventanas':
      return r.ventanas;
    case 'imposible':
      return [VENTANA_VENCIDA];
  }
};
