import { describe, expect, it } from 'vitest';
import { crearVentana, intersectarConLimite, normalizarTramos, type VentanaHoraria } from './ventana-horaria.js';

const v = (a: number, b: number): VentanaHoraria => {
  const r = crearVentana(a, b);
  if (!r.ok) throw new Error('ventana inválida en el test');
  return r.value;
};

describe('VentanaHoraria', () => {
  it('exige apertura < cierre y rango válido', () => {
    expect(crearVentana(600, 600).ok).toBe(false);
    expect(crearVentana(700, 600).ok).toBe(false);
    expect(crearVentana(-1, 600).ok).toBe(false);
    expect(crearVentana(0, 1441).ok).toBe(false);
    expect(crearVentana(0, 1440).ok).toBe(true);
  });

  it('normalizarTramos ordena y fusiona los que se solapan o se tocan', () => {
    expect(normalizarTramos([v(780, 900), v(480, 720), v(700, 790)])).toEqual([v(480, 900)]);
    expect(normalizarTramos([v(780, 900), v(480, 720)])).toEqual([v(480, 720), v(780, 900)]);
    expect(normalizarTramos([])).toEqual([]);
  });

  it('intersectarConLimite recorta por «antes de» y descarta los tramos que quedan vacíos', () => {
    const tramos = [v(480, 720), v(840, 1080)];
    expect(intersectarConLimite(tramos, 600)).toEqual([v(480, 600)]);
    expect(intersectarConLimite(tramos, 480)).toEqual([]);
    expect(intersectarConLimite(tramos, 1200)).toEqual(tramos);
  });
});
