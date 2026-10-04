import { describe, expect, it } from 'vitest';
import { formatearRut, normalizarRut, parsearRut } from './rut.js';

describe('Rut (módulo 11)', () => {
  it.each([
    ['12.345.678-5', '12345678-5'],
    ['11111111-1', '11111111-1'],
    ['7.654.321-6', '7654321-6'],
    ['10.000.013-k', '10000013-K'],
    ['76086428-5', '76086428-5'],
  ])('acepta %s', (entrada, esperado) => {
    const r = parsearRut(entrada);
    expect(r.ok).toBe(true);
    if (r.ok) expect(normalizarRut(r.value)).toBe(esperado);
  });

  it('calcula dígito verificador 0 (suma múltiplo de 11)', () => {
    // cuerpo 10000004: suma ponderada 4·2 + 1·3 = 11·... → resto 0 → dv 0
    expect(parsearRut('10.000.004-0').ok).toBe(true);
    expect(parsearRut('10.000.004-K').ok).toBe(false);
  });

  it('formatea con puntos y guion', () => {
    const r = parsearRut('123456785');
    expect(r.ok && formatearRut(r.value)).toBe('12.345.678-5');
  });

  it.each(['12.345.678-4', '', 'abc', '1-8', '123456789012-3', '12.345.67a-5'])('rechaza %s', (entrada) => {
    expect(parsearRut(entrada).ok).toBe(false);
  });

  it('el error trae un código y un mensaje en español', () => {
    const r = parsearRut('12.345.678-4');
    expect(!r.ok && r.error.codigo).toBe('RUT_DV_INVALIDO');
    expect(!r.ok && r.error.mensaje).toContain('dígito');
  });
});
