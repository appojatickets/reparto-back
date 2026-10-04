import { describe, expect, it } from 'vitest';
import { distanciaMetros, validarPropuestaPin } from './propuesta-pin.js';

describe('validarPropuestaPin', () => {
  it('normaliza y acepta una propuesta con RUT opcional', () => {
    const r = validarPropuestaPin({ rut: '12.345.678-5', direccion: ' Calle  Falsa 123 ', lat: -33.45, lng: '-70,66' });
    expect(r.ok && r.value).toEqual({ rut: '12345678-5', direccion: 'Calle Falsa 123', lat: -33.45, lng: -70.66 });
    const sinRut = validarPropuestaPin({ direccion: 'Calle Falsa 123', lat: -33.45, lng: -70.66 });
    expect(sinRut.ok && sinRut.value.rut).toBeUndefined();
  });

  it.each([
    [{ direccion: '', lat: -33.4, lng: -70.6 }, 'DIRECCION_REQUERIDA'],
    [{ direccion: 'x', lat: 'a', lng: -70.6 }, 'PIN_INVALIDO'],
    [{ direccion: 'x', lat: -41.4, lng: -72.9 }, 'PIN_FUERA_DE_REGION'],
    [{ direccion: 'x', rut: '1-8', lat: -33.4, lng: -70.6 }, 'RUT_DV_INVALIDO'],
  ])('rechaza %j con %s', (entrada, codigo) => {
    const r = validarPropuestaPin(entrada);
    expect(!r.ok && r.error.map((e) => e.codigo)).toContain(codigo);
  });
});

describe('distanciaMetros', () => {
  it('mide en metros', () => {
    const d = distanciaMetros({ lat: -33.4372, lng: -70.6506 }, { lat: -33.4372, lng: -70.6496 });
    expect(d).toBeGreaterThan(85);
    expect(d).toBeLessThan(95);
  });
});
