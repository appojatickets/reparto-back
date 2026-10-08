import { describe, expect, it } from 'vitest';
import { respaldoDelPin, type VisitaConGps } from './respaldo-del-pin.js';

// 0,0001° de latitud son ~11 m: así se arman distancias conocidas sin geometría rebuscada.
const PIN = { lat: -33.5, lng: -70.7 };
const visita = (dLat: number, dia: string, precisionM = 10, dLng = 0): VisitaConGps => ({ lat: PIN.lat + dLat, lng: PIN.lng + dLng, precisionM, en: new Date(`${dia}T15:00:00Z`) });
const AQUI = 0; // sobre el pin

describe('respaldoDelPin', () => {
  it('sin entregas con GPS no hay respaldo', () => {
    expect(respaldoDelPin(PIN, false, [])).toEqual({ nivel: 'sin_respaldo', entregas: 0, dias: 0 });
  });

  it('una sola entrega, aunque quede lejos del pin, no alcanza para llamarlo conflicto ni respaldo', () => {
    const lejos = respaldoDelPin(PIN, false, [visita(0.08, '2026-10-06')]); // ~8,9 km
    expect(lejos.nivel).toBe('sin_respaldo');
    expect(lejos.entregas).toBe(1);
    expect(respaldoDelPin(PIN, false, [visita(AQUI, '2026-10-06')]).nivel).toBe('sin_respaldo');
  });

  it('dos entregas que coinciden en días distintos y quedan junto al pin: respaldado por entregas', () => {
    const r = respaldoDelPin(PIN, false, [visita(AQUI, '2026-10-06'), visita(0.0002, '2026-10-07')]);
    expect(r).toMatchObject({ nivel: 'respaldado', entregas: 2, dias: 2 });
    expect(r.distanciaM).toBeLessThan(30);
  });

  it('dos entregas el mismo día coinciden pero no son una confirmación independiente', () => {
    const r = respaldoDelPin(PIN, false, [visita(AQUI, '2026-10-06'), visita(0.0001, '2026-10-06')]);
    expect(r).toMatchObject({ nivel: 'sin_respaldo', entregas: 2, dias: 1 });
  });

  it('los días se cuentan en hora de Chile, no en UTC', () => {
    const tarde = { ...visita(AQUI, '2026-10-06'), en: new Date('2026-10-06T02:30:00Z') }; // 5 oct 23:30 en Chile
    const madrugada = { ...visita(AQUI, '2026-10-06'), en: new Date('2026-10-06T04:00:00Z') }; // 6 oct 01:00 en Chile
    expect(respaldoDelPin(PIN, false, [tarde, madrugada])).toMatchObject({ nivel: 'respaldado', dias: 2 });
  });

  it('una entrega con GPS impreciso no cuenta', () => {
    const r = respaldoDelPin(PIN, false, [visita(AQUI, '2026-10-06'), visita(AQUI, '2026-10-07', 120)]);
    expect(r).toMatchObject({ nivel: 'sin_respaldo', entregas: 1 });
  });

  it('entregas que no coinciden entre sí son un conflicto', () => {
    const r = respaldoDelPin(PIN, false, [visita(AQUI, '2026-10-06'), visita(0.005, '2026-10-07')]); // ~550 m entre sí
    expect(r.nivel).toBe('en_conflicto');
  });

  it('entregas que coinciden entre sí pero lejos del pin: conflicto con la distancia', () => {
    const r = respaldoDelPin(PIN, false, [visita(0.004, '2026-10-06'), visita(0.0041, '2026-10-07')]); // ~445 m del pin
    expect(r.nivel).toBe('en_conflicto');
    expect(r.distanciaM).toBeGreaterThan(400);
  });

  it('manda el grupo más grande: una entrega suelta lejos no deshace el respaldo', () => {
    const r = respaldoDelPin(PIN, false, [visita(AQUI, '2026-10-05'), visita(0.0001, '2026-10-06'), visita(0.0002, '2026-10-07'), visita(0.06, '2026-10-08')]);
    expect(r).toMatchObject({ nivel: 'respaldado', entregas: 3, dias: 3 });
  });

  it('un pin verificado por una persona queda como verificado, aunque haya o no entregas', () => {
    expect(respaldoDelPin(PIN, true, []).nivel).toBe('verificado');
    expect(respaldoDelPin(PIN, true, [visita(0.004, '2026-10-06'), visita(0.0041, '2026-10-07')]).nivel).toBe('verificado');
  });
});
