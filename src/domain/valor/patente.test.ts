import { describe, expect, it } from 'vitest';
import { formatearPatente, parsearPatente } from './patente.js';

describe('Patente', () => {
  it.each([['abcd12', 'ABCD12'], ['AB-CD 12', 'ABCD12'], ['ab.12-34', 'AB1234'], [' xy1234 ', 'XY1234']])('normaliza %s → %s', (entrada, esperado) => {
    const r = parsearPatente(entrada);
    expect(r.ok && r.value).toBe(esperado);
  });

  it.each(['', 'ABC123', 'ABCDE1', '1234AB', 'AB123', 'ABCD1', 'ÑÑÑÑ12'])('rechaza %s', (entrada) => {
    const r = parsearPatente(entrada);
    expect(!r.ok && r.error.codigo).toBe('PATENTE_INVALIDA');
  });

  it('formatea para mostrar', () => {
    const p = parsearPatente('abcd12');
    expect(p.ok && formatearPatente(p.value)).toBe('ABCD·12');
    const v = parsearPatente('ab1234');
    expect(v.ok && formatearPatente(v.value)).toBe('AB·1234');
  });
});
