import { distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { posicionSirveParaPin, RADIO_ACUERDO_PIN_M, type PosicionDeEntrega } from './pin-por-entregas.js';
import type { VisitaConGps } from './respaldo-del-pin.js';

/** De dónde salió el pin del local. */
export type FuentePinVerificable = 'geocodificador' | 'manual' | 'importado' | 'aprendido' | 'chofer' | 'enlace';

/**
 * Fuentes que no dependen de una entrega: el buscador por dirección, un enlace pegado, una planilla o una persona. Una entrega con buen
 * GPS junto a uno de esos pines lo confirma por sí sola.
 */
export const FUENTES_INDEPENDIENTES: readonly FuentePinVerificable[] = ['geocodificador', 'enlace', 'importado', 'manual'];

/**
 * GPS «firme»: con esta precisión o mejor, una sola entrega ya es evidencia suficiente aunque el pin haya nacido de ella. Entregado manda: en
 * las entregas reales, 71 de 94 pines nacidos de una entrega tienen una con ≤25 m de precisión; con 26–50 m hace falta una segunda.
 */
export const PRECISION_FIRME_M = 25;

/**
 * ¿Esta entrega confirma el pin sin que nadie lo mire? La entrega (≤50 m de precisión) tiene que quedar a ≤60 m del pin, y además:
 * - pin de otra fuente (buscador, enlace, planilla, persona): basta esa entrega (12 de 14 pines así quedaron a ≤60 m);
 * - pin que nació de una entrega: basta si el GPS es firme (≤25 m); si no, hace falta otra entrega que coincida (en cualquier día).
 * Lo que manda es lo que se hace: dónde de verdad se entrega.
 */
export const confirmaElPin = (pin: Coordenada, fuente: FuentePinVerificable | undefined, entrega: PosicionDeEntrega, visitas: readonly VisitaConGps[]): boolean => {
  if (!posicionSirveParaPin(entrega)) return false;
  if (distanciaKm(pin, entrega) * 1000 > RADIO_ACUERDO_PIN_M) return false;
  if (fuente !== undefined && FUENTES_INDEPENDIENTES.includes(fuente)) return true;
  if ((entrega.precisionM ?? Infinity) <= PRECISION_FIRME_M) return true;
  return visitas.filter((v) => posicionSirveParaPin(v) && distanciaKm(pin, v) * 1000 <= RADIO_ACUERDO_PIN_M).length >= 2;
};
