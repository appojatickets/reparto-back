import { err, ok, type Result } from '../shared/result.js';
import { errorDominio, type ErrorDominio } from '../shared/errores.js';
import { crearCoordenada, dentroDeRegionMetropolitana } from '../valor/coordenada.js';

/** Qué se fue a buscar cuando algo le pasó al camión: un mecánico, una vulcanización (neumáticos) u otra cosa que el chofer escribió. */
export const TIPOS_EMERGENCIA = ['mecanico', 'vulcanizacion', 'otro'] as const;
export type TipoEmergencia = (typeof TIPOS_EMERGENCIA)[number];

export const MAX_TEXTO_EMERGENCIA = 80;

export type EmergenciaCruda = {
  readonly tipo: string;
  readonly texto?: string | undefined;
  readonly lat?: number | undefined;
  readonly lng?: number | undefined;
  readonly precisionM?: number | undefined;
};

export type EmergenciaValida = {
  readonly tipo: TipoEmergencia;
  readonly texto?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly precisionM?: number;
};

const esTipo = (t: string): t is TipoEmergencia => (TIPOS_EMERGENCIA as readonly string[]).includes(t);

/**
 * Valida el aviso «voy a un mecánico / vulcanización». La posición es opcional (el GPS puede fallar y no por eso se impide pedir ayuda),
 * pero si viene debe ser coherente y estar en la Región Metropolitana. Con «otro» hace falta decir qué se busca.
 */
export const validarEmergencia = (e: EmergenciaCruda): Result<EmergenciaValida, ErrorDominio[]> => {
  if (!esTipo(e.tipo)) return err([errorDominio('TIPO_INVALIDO', 'El tipo de emergencia no es válido.')]);
  const errores: ErrorDominio[] = [];
  const texto = e.texto?.replace(/\s+/g, ' ').trim();
  if (texto !== undefined && texto.length > MAX_TEXTO_EMERGENCIA) errores.push(errorDominio('TEXTO_LARGO', `Lo que buscas no puede pasar de ${MAX_TEXTO_EMERGENCIA} letras.`));
  if (e.tipo === 'otro' && (texto === undefined || texto === '')) errores.push(errorDominio('TEXTO_REQUERIDO', 'Escribe qué necesitas buscar.'));

  let posicion: { lat: number; lng: number } | undefined;
  if ((e.lat === undefined) !== (e.lng === undefined)) errores.push(errorDominio('POSICION_INCOMPLETA', 'La posición necesita latitud y longitud.'));
  else if (e.lat !== undefined && e.lng !== undefined) {
    const c = crearCoordenada(e.lat, e.lng);
    if (!c.ok || !dentroDeRegionMetropolitana(c.value)) errores.push(errorDominio('POSICION_INVALIDA', 'La posición no es válida o está fuera de la Región Metropolitana.'));
    else posicion = { lat: c.value.lat, lng: c.value.lng };
  }
  if (e.precisionM !== undefined && (!Number.isFinite(e.precisionM) || e.precisionM < 0 || e.precisionM > 100_000)) errores.push(errorDominio('PRECISION_INVALIDA', 'La precisión de la posición no es válida.'));
  if (errores.length > 0) return err(errores);
  return ok({
    tipo: e.tipo,
    ...(texto !== undefined && texto !== '' ? { texto } : {}),
    ...(posicion ?? {}),
    ...(posicion && e.precisionM !== undefined ? { precisionM: e.precisionM } : {}),
  });
};
