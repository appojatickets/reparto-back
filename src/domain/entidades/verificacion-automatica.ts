import { distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { posicionSirveParaPin, RADIO_ACUERDO_PIN_M, type PosicionDeEntrega } from './pin-por-entregas.js';
import { respaldoDelPin, type VisitaConGps } from './respaldo-del-pin.js';

/** De dónde salió el pin del local. */
export type FuentePinVerificable = 'geocodificador' | 'manual' | 'importado' | 'aprendido' | 'chofer' | 'enlace';

/**
 * Fuentes que no dependen de una entrega: el buscador por dirección, un enlace pegado, una planilla o una persona. Una entrega con buen
 * GPS junto a uno de esos pines lo confirma por sí sola. Un pin que nació de una entrega («chofer», «aprendido») coincide siempre con esa
 * misma entrega, así que necesita otra, en otro día.
 */
export const FUENTES_INDEPENDIENTES: readonly FuentePinVerificable[] = ['geocodificador', 'enlace', 'importado', 'manual'];

/**
 * ¿Esta entrega confirma el pin sin que nadie lo mire? Pin de otra fuente + entrega con buen GPS a ≤60 m: sí (en las entregas reales 12 de
 * 14 pines así quedaron a ≤60 m). Pin nacido de una entrega: hace falta que el respaldo de las entregas lo confirme (≥2 entregas que
 * coinciden, en ≥2 días distintos, junto al pin).
 */
export const confirmaElPin = (pin: Coordenada, fuente: FuentePinVerificable | undefined, entrega: PosicionDeEntrega, visitas: readonly VisitaConGps[]): boolean => {
  if (!posicionSirveParaPin(entrega)) return false;
  if (fuente !== undefined && FUENTES_INDEPENDIENTES.includes(fuente)) return distanciaKm(pin, entrega) * 1000 <= RADIO_ACUERDO_PIN_M;
  const r = respaldoDelPin(pin, false, visitas);
  return r.nivel === 'respaldado' && (r.distanciaM ?? Infinity) <= RADIO_ACUERDO_PIN_M;
};
