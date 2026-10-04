import { describe, expect, it } from 'vitest';
import { formatearMinutos, minutosDesdeHora, minutosDelDia } from './minutos-del-dia.js';

describe('MinutosDelDia', () => {
  it('acepta enteros de 0 a 1439', () => {
    expect(minutosDelDia(0).ok).toBe(true);
    expect(minutosDelDia(1439).ok).toBe(true);
  });

  it.each([-1, 1440, 12.5, Number.NaN])('rechaza %s', (n) => {
    expect(minutosDelDia(n).ok).toBe(false);
  });

  it('parsea HH:MM', () => {
    const r = minutosDesdeHora('08:30');
    expect(r.ok && r.value).toBe(510);
    expect(minutosDesdeHora('8:05').ok).toBe(true);
  });

  it.each(['24:00', '12:60', 'abc', '12', '12:5'])('rechaza hora %s', (t) => {
    expect(minutosDesdeHora(t).ok).toBe(false);
  });

  it('formatea con cero a la izquierda y más allá de la medianoche', () => {
    expect(formatearMinutos(510)).toBe('08:30');
    expect(formatearMinutos(0)).toBe('00:00');
    expect(formatearMinutos(1500)).toBe('01:00');
  });
});
