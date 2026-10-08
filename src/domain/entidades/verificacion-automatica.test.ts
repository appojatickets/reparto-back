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

  it('pin que nació de una entrega: una entrega con GPS firme (≤25 m) a ≤60 m lo confirma sola; entregado manda', () => {
    expect(confirmaElPin(PIN, 'chofer', entrega(0, 20), [])).toBe(true);
    expect(confirmaElPin(PIN, 'aprendido', entrega(0, 25), [])).toBe(true);
  });

  it('pin que nació de una entrega con GPS de 26 a 50 m: una sola no basta; con otra que coincida, en cualquier día, sí', () => {
    expect(confirmaElPin(PIN, 'chofer', entrega(0, 40), [visita(0, '2026-10-08')])).toBe(false);
    expect(confirmaElPin(PIN, 'chofer', entrega(0, 40), [visita(0, '2026-10-08'), visita(0.0002, '2026-10-08')])).toBe(true);
    expect(confirmaElPin(PIN, 'chofer', entrega(0, 40), [visita(0, '2026-10-08'), visita(0.0002, '2026-10-07')])).toBe(true);
  });

  it('una entrega a más de 60 m del pin nunca lo confirma, venga de donde venga', () => {
    expect(confirmaElPin(PIN, 'chofer', entrega(0.0008, 10), [])).toBe(false);
    expect(confirmaElPin(PIN, 'geocodificador', entrega(0.0008, 10), [])).toBe(false);
  });

  it('otras entregas lejos del pin o imprecisas no cuentan para el respaldo', () => {
    const lejos = { ...visita(0.004, '2026-10-07') };
    const imprecisa = { ...visita(0, '2026-10-06'), precisionM: 120 };
    expect(confirmaElPin(PIN, 'chofer', entrega(0, 40), [visita(0, '2026-10-08'), lejos, imprecisa])).toBe(false);
  });

  it('si no se sabe de dónde salió el pin se trata como uno que nació de una entrega', () => {
    expect(confirmaElPin(PIN, undefined, entrega(0, 40), [visita(0, '2026-10-08')])).toBe(false);
    expect(confirmaElPin(PIN, undefined, entrega(0, 10), [])).toBe(true);
  });
});
