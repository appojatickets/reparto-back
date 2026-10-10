import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { crearCoordenada, dentroDeRegionMetropolitana } from '../valor/coordenada.js';

export const TIPOS_EVENTO = ['llegada', 'entregado', 'cerrado', 'espera', 'no_entregado', 'vuelve_mas_tarde'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const MOTIVOS_NO_ENTREGA = ['cerrado', 'no_recibe', 'direccion', 'otro'] as const;
export type MotivoNoEntrega = (typeof MOTIVOS_NO_ENTREGA)[number];

export type EventoCrudo = {
  readonly tipo: string;
  readonly lat?: number | undefined;
  readonly lng?: number | undefined;
  readonly precisionM?: number | undefined;
  readonly motivo?: string | undefined;
  readonly minutos?: number | undefined;
  /** Solo al entregar: la entrega queda hecha pero esta posición no se usa (se avisó lejos de la puerta y fijaría un pin errado). */
  readonly sinPin?: boolean | undefined;
};

export type EventoValido = {
  readonly tipo: TipoEvento;
  readonly lat?: number;
  readonly lng?: number;
  readonly precisionM?: number;
  readonly motivo?: MotivoNoEntrega;
  readonly minutos?: number;
  /** Entregada sin dejar el pin: no lleva posición y el pin del local no se toca. */
  readonly sinPin?: true;
};

/** Un punto con más error que esto (en metros) no sirve para fijar el pin de un local. */
export const PRECISION_MAXIMA_PIN_M = 100;
const MAX_ESPERA_MIN = 240;

const esTipo = (t: string): t is TipoEvento => (TIPOS_EVENTO as readonly string[]).includes(t);
const esMotivo = (m: string): m is MotivoNoEntrega => (MOTIVOS_NO_ENTREGA as readonly string[]).includes(m);

/**
 * Valida lo que informa el teléfono al llegar, entregar o encontrar el local cerrado. La posición es opcional (el GPS puede
 * fallar y no por eso se impide anotar la entrega), pero si viene debe ser coherente y estar en la Región Metropolitana.
 */
export const validarEvento = (e: EventoCrudo): Result<EventoValido, ErrorDominio[]> => {
  const errores: ErrorDominio[] = [];
  if (!esTipo(e.tipo)) return err([errorDominio('TIPO_INVALIDO', 'El tipo de aviso no es válido.')]);
  const tipo = e.tipo;

  let posicion: { lat: number; lng: number } | undefined;
  if ((e.lat === undefined) !== (e.lng === undefined)) errores.push(errorDominio('POSICION_INCOMPLETA', 'La posición necesita latitud y longitud.'));
  else if (e.lat !== undefined && e.lng !== undefined) {
    const c = crearCoordenada(e.lat, e.lng);
    if (!c.ok || !dentroDeRegionMetropolitana(c.value)) errores.push(errorDominio('POSICION_INVALIDA', 'La posición no es válida o está fuera de la Región Metropolitana.'));
    else posicion = { lat: c.value.lat, lng: c.value.lng };
  }
  if (e.precisionM !== undefined && (!Number.isFinite(e.precisionM) || e.precisionM < 0 || e.precisionM > 100_000)) {
    errores.push(errorDominio('PRECISION_INVALIDA', 'La precisión de la posición no es válida.'));
  }

  if (tipo === 'espera') {
    if (e.minutos === undefined || !Number.isInteger(e.minutos) || e.minutos < 1 || e.minutos > MAX_ESPERA_MIN) {
      errores.push(errorDominio('MINUTOS_INVALIDOS', `Los minutos de espera deben ser un entero entre 1 y ${MAX_ESPERA_MIN}.`));
    }
  } else if (e.minutos !== undefined) errores.push(errorDominio('MINUTOS_NO_APLICA', 'Los minutos solo se indican al esperar.'));

  if (tipo === 'no_entregado') {
    if (e.motivo === undefined || !esMotivo(e.motivo)) errores.push(errorDominio('MOTIVO_REQUERIDO', 'Indica por qué no se entregó (cerrado, no recibe, dirección, otro).'));
  } else if (e.motivo !== undefined) errores.push(errorDominio('MOTIVO_NO_APLICA', 'El motivo solo se indica cuando no se entrega.'));

  if (e.sinPin === true && tipo !== 'entregado') errores.push(errorDominio('SIN_PIN_NO_APLICA', '«Sin pin» solo se indica al entregar.'));

  if (errores.length > 0) return err(errores);
  // Entregada sin pin: la posición se descarta para que no sirva ni para el pin ni como evidencia de dónde está el local.
  if (e.sinPin === true) return ok({ tipo, sinPin: true });
  return ok({
    tipo,
    ...(posicion ? posicion : {}),
    ...(posicion && e.precisionM !== undefined ? { precisionM: e.precisionM } : {}),
    ...(e.motivo !== undefined && esMotivo(e.motivo) ? { motivo: e.motivo } : {}),
    ...(e.minutos !== undefined ? { minutos: e.minutos } : {}),
  });
};

/** El estado en que deja la factura cada tipo de aviso (los demás no la cambian). */
export const estadoTras = (tipo: TipoEvento): 'entregada' | 'no_entregada' | undefined => {
  if (tipo === 'entregado') return 'entregada';
  if (tipo === 'no_entregado') return 'no_entregada';
  return undefined;
};

/**
 * Pin colaborativo (ADR 0014): un local sin pin toma la posición del chofer si es suficientemente precisa; si ya tiene pin,
 * la posición queda solo como evidencia (el pin no se mueve por una lectura).
 */
export const puedeFijarPin = (e: EventoValido, localTienePin: boolean): boolean =>
  !localTienePin && e.lat !== undefined && e.lng !== undefined && e.precisionM !== undefined && e.precisionM <= PRECISION_MAXIMA_PIN_M
  && (e.tipo === 'llegada' || e.tipo === 'entregado' || e.tipo === 'cerrado');
