import { describe, expect, it } from 'vitest';
import { crearCoordenada, dentroDeRegionMetropolitana, distanciaKm } from './coordenada.js';

const c = (lat: number, lng: number) => {
  const r = crearCoordenada(lat, lng);
  if (!r.ok) throw new Error('coordenada inválida en el test');
  return r.value;
};

describe('Coordenada', () => {
  it('rechaza valores fuera de rango o no finitos', () => {
    expect(crearCoordenada(91, 0).ok).toBe(false);
    expect(crearCoordenada(0, 181).ok).toBe(false);
    expect(crearCoordenada(Number.NaN, 0).ok).toBe(false);
  });

  it('distancia haversine conocida: Plaza de Armas → Costanera Center ≈ 5,2 km', () => {
    const km = distanciaKm(c(-33.4372, -70.6506), c(-33.4172, -70.6065));
    expect(km).toBeGreaterThan(4.5);
    expect(km).toBeLessThan(5.5);
  });

  it('distancia a sí misma es 0 y es simétrica', () => {
    const a = c(-33.45, -70.66);
    const b = c(-33.5, -70.7);
    expect(distanciaKm(a, a)).toBe(0);
    expect(distanciaKm(a, b)).toBeCloseTo(distanciaKm(b, a), 10);
  });

  it('detecta si cae dentro de la Región Metropolitana (caja aproximada)', () => {
    expect(dentroDeRegionMetropolitana(c(-33.45, -70.66))).toBe(true);
    expect(dentroDeRegionMetropolitana(c(-41.47, -72.94))).toBe(false);
  });

  it('es inmutable', () => {
    expect(Object.isFrozen(c(-33, -70))).toBe(true);
  });
});
