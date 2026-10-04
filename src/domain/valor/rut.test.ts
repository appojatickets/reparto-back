import { describe, expect, it } from 'vitest';
import { dichoComoRut, formatearRut, normalizarRut, parsearRut } from './rut.js';

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

describe('dichoComoRut', () => {
  it('reconoce un RUT escrito solo con números, con o sin signos y dígito verificador', () => {
    expect(dichoComoRut('77975918')).toBe('77975918');
    expect(dichoComoRut('77.975.918-0')).toBe('779759180');
    expect(dichoComoRut('7797591 8 0')).toBe('779759180');
    expect(dichoComoRut('1234567k')).toBe('1234567K');
    expect(dichoComoRut('12345')).toBe('12345');
  });

  it('no confunde un número de calle, una dirección ni un nombre con un RUT', () => {
    for (const t of ['765', '1234', 'Av. Colón 765', 'minimarket 12345', '12 de octubre 123456', '', 'rabet', '123456789012']) expect(dichoComoRut(t), t).toBeUndefined();
  });
});
