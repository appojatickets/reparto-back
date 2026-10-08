import { fechaEnChile } from '../shared/fechas.js';
import { distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { posicionSirveParaPin, RADIO_ACUERDO_PIN_M } from './pin-por-entregas.js';

/** Dónde y cuándo se avisó ENTREGADO en un local, con el GPS de ese momento. */
export type VisitaConGps = { readonly lat: number; readonly lng: number; readonly precisionM: number; readonly en: Date };

/**
 * Qué tan firme es un pin:
 * - `verificado`: una persona lo confirmó.
 * - `respaldado`: varias entregas, en días distintos, coinciden entre sí y quedan junto al pin.
 * - `en_conflicto`: las entregas no coinciden entre sí, o coinciden lejos del pin. Conviene mirarlo.
 * - `sin_respaldo`: todavía no hay entregas suficientes para saber (solo lo estimó el buscador, o hay una sola entrega).
 */
export type NivelRespaldoPin = 'verificado' | 'respaldado' | 'en_conflicto' | 'sin_respaldo';

export type RespaldoDelPin = {
  readonly nivel: NivelRespaldoPin;
  /** Cuántas entregas coinciden entre sí (el grupo más grande) y en cuántos días distintos (hora de Chile). */
  readonly entregas: number;
  readonly dias: number;
  /** A cuántos metros del pin queda el lugar donde coinciden esas entregas. */
  readonly distanciaM?: number;
};

/** Para respaldar un pin hacen falta al menos estas entregas que coincidan, en al menos estos días distintos. */
export const MINIMO_ENTREGAS_RESPALDO = 2;
export const MINIMO_DIAS_RESPALDO = 1;
/** Si las entregas coinciden a más de esto del pin, el pin y las entregas se contradicen (misma distancia que usa el analizador). */
export const DISTANCIA_CONFLICTO_PIN_M = 150;

const mediana = (v: readonly number[]): number => {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? (o[m] ?? 0) : ((o[m - 1] ?? 0) + (o[m] ?? 0)) / 2;
};

/**
 * Cuánto respaldan las entregas a un pin. Solo cuentan las entregas con buen GPS; entre ellas se mira el grupo más grande que coincide
 * (a menos de ~60 m una de otra), así una entrega avisada desde otro lado no deshace el respaldo. Una sola entrega nunca es conflicto:
 * puede ser el pin, pero también el lugar desde donde se tocó el botón.
 */
export const respaldoDelPin = (pin: Coordenada, verificado: boolean, visitas: readonly VisitaConGps[]): RespaldoDelPin => {
  const buenas = visitas.filter(posicionSirveParaPin);
  let grupo: readonly VisitaConGps[] = [];
  for (const candidata of buenas) {
    const coinciden = buenas.filter((v) => distanciaKm(v, candidata) * 1000 <= RADIO_ACUERDO_PIN_M);
    if (coinciden.length > grupo.length) grupo = coinciden;
  }
  const dias = new Set(grupo.map((v) => fechaEnChile(v.en))).size;
  const distanciaM = grupo.length > 0 ? Math.round(distanciaKm({ lat: mediana(grupo.map((v) => v.lat)), lng: mediana(grupo.map((v) => v.lng)) }, pin) * 1000) : undefined;
  const base = { entregas: grupo.length, dias, ...(distanciaM !== undefined ? { distanciaM } : {}) };

  if (verificado) return { nivel: 'verificado', ...base };
  if (grupo.length >= MINIMO_ENTREGAS_RESPALDO && (distanciaM ?? 0) > DISTANCIA_CONFLICTO_PIN_M) return { nivel: 'en_conflicto', ...base };
  if (buenas.length >= 2 && grupo.length < MINIMO_ENTREGAS_RESPALDO) return { nivel: 'en_conflicto', ...base };
  if (grupo.length >= MINIMO_ENTREGAS_RESPALDO && dias >= MINIMO_DIAS_RESPALDO) return { nivel: 'respaldado', ...base };
  return { nivel: 'sin_respaldo', ...base };
};
