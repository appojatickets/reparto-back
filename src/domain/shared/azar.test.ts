import { describe, expect, it } from 'vitest';
import { crearAzar } from './azar.js';

describe('crearAzar', () => {
  it('es reproducible con la misma semilla', () => {
    const a = crearAzar(42);
    const b = crearAzar(42);
    expect([a.siguiente(), a.siguiente(), a.siguiente()]).toEqual([b.siguiente(), b.siguiente(), b.siguiente()]);
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(crearAzar(1).siguiente()).not.toBe(crearAzar(2).siguiente());
  });

  it('siguiente() está en [0, 1) y entero(max) en [0, max)', () => {
    const r = crearAzar(7);
    for (let i = 0; i < 1000; i++) {
      const x = r.siguiente();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const e = r.entero(5);
      expect(Number.isInteger(e)).toBe(true);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThan(5);
    }
  });
});
