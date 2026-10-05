import { describe, expect, it } from 'vitest';
import { formatearCelular, parsearCelular } from './telefono.js';

describe('celular chileno', () => {
  it.each(['912345678', '9 1234 5678', '+56 9 1234 5678', '56912345678', '(9) 1234-5678'])('acepta «%s» y lo normaliza', (t) => {
    const r = parsearCelular(t);
    expect(r.ok && r.value).toBe('56912345678');
  });

  it.each(['', '12345678', '812345678', '5691234567', '+34 612 345 678', 'abc'])('rechaza «%s»', (t) => {
    const r = parsearCelular(t);
    expect(!r.ok && r.error.codigo).toBe('CELULAR_INVALIDO');
  });

  it('se muestra con espacios', () => {
    const r = parsearCelular('912345678');
    expect(r.ok && formatearCelular(r.value)).toBe('+56 9 1234 5678');
  });
});
