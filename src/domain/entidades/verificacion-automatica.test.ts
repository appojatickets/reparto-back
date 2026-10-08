import { describe, expect, it } from 'vitest';
import { confirmaElPin } from './verificacion-automatica.js';
import type { VisitaConGps } from './respaldo-del-pin.js';

const PIN = { lat: -33.45, lng: -70.66 };
const entrega = (dLat = 0, precisionM = 15) => ({ lat: PIN.lat + dLat, lng: PIN.lng, precisionM });
const visita = (dLat: number, dia: string): VisitaConGps => ({ lat: PIN.lat + dLat, lng: PIN.lng, precisionM: 15, en: new Date(`${dia}T15:00:00Z`) });

describe('confirmaElPin', () => {
  it('pin del buscador, de un enlace, de una planilla o de una persona: una entrega a ≤60 m lo confirma', () => {
    for (const fuente of ['geocodificador', 'enlace', 'importado', 'manual'] as const) {
      expect(confirmaElPin(PIN, fuente, entrega(0.0004), [])).toBe(true); // ~44 m
    }
  });

  it('esos mismos pines no se confirman con una entrega a más de 60 m ni con GPS impreciso', () => {
    expect(confirmaElPin(PIN, 'geocodificador', entrega(0.0008), [])).toBe(false); // ~89 m
    expect(confirmaElPin(PIN, 'geocodificador', entrega(0, 80), [])).toBe(false);
  });

  it('pin que nació de una entrega: una sola entrega no basta, aunque caiga justo encima', () => {
    expect(confirmaElPin(PIN, 'chofer', entrega(), [visita(0, '2026-10-08')])).toBe(false);
    expect(confirmaElPin(PIN, 'aprendido', entrega(), [])).toBe(false);
  });

  it('pin que nació de una entrega: dos entregas que coinciden, en dos días, junto al pin, lo confirman', () => {
    expect(confirmaElPin(PIN, 'chofer', entrega(), [visita(0, '2026-10-08'), visita(0.0002, '2026-10-07')])).toBe(true);
  });

  it('pin que nació de una entrega: dos entregas el mismo día no cuentan como confirmación independiente', () => {
    expect(confirmaElPin(PIN, 'chofer', entrega(), [visita(0, '2026-10-08'), visita(0.0002, '2026-10-08')])).toBe(false);
  });

  it('si no se sabe de dónde salió el pin se trata como uno que nació de una entrega', () => {
    expect(confirmaElPin(PIN, undefined, entrega(), [visita(0, '2026-10-08')])).toBe(false);
  });
});
