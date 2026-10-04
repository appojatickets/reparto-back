import { describe, expect, it } from 'vitest';
import { dinero, formatearDinero, sumarDinero } from './dinero.js';

describe('Dinero (CLP entero)', () => {
  it('acepta enteros no negativos', () => {
    expect(dinero(0).ok).toBe(true);
    expect(dinero(150000).ok).toBe(true);
  });

  it.each([-1, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rechaza %s', (n) => {
    expect(dinero(n).ok).toBe(false);
  });

  it('suma sin errores de punto flotante', () => {
    const a = dinero(1990);
    const b = dinero(3010);
    expect(a.ok && b.ok && sumarDinero(a.value, b.value)).toBe(5000);
  });

  it('formatea con separador de miles chileno', () => {
    const d = dinero(1234567);
    expect(d.ok && formatearDinero(d.value)).toBe('$1.234.567');
    const z = dinero(0);
    expect(z.ok && formatearDinero(z.value)).toBe('$0');
  });
});
