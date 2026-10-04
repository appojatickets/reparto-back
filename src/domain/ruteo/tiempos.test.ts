import { describe, expect, it } from 'vitest';
import { crearCoordenada, distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { crearTiemposHaversine } from './tiempos.js';

const c = (lat: number, lng: number): Coordenada => {
  const r = crearCoordenada(lat, lng);
  if (!r.ok) throw new Error('coordenada inválida');
  return r.value;
};
const a = c(-33.45, -70.66);
const b = c(-33.5, -70.7);
const mapa = new Map([['a', a], ['b', b]]);

describe('crearTiemposHaversine', () => {
  const t = crearTiemposHaversine(mapa);

  it('tiempo = distancia × circuidad ÷ velocidad del período', () => {
    const km = distanciaKm(a, b);
    expect(t.tiempo('a', 'b', 12 * 60)).toBeCloseTo(((km * 1.35) / 30) * 60, 9); // valle: 30 km/h
    expect(t.tiempo('a', 'b', 8 * 60)).toBeCloseTo(((km * 1.35) / 22) * 60, 9); // punta mañana: 22 km/h
  });

  it('en punta se tarda más que en el valle', () => {
    expect(t.tiempo('a', 'b', 8 * 60)).toBeGreaterThan(t.tiempo('a', 'b', 12 * 60));
  });

  it('de un nodo a sí mismo es 0 y es simétrico', () => {
    expect(t.tiempo('a', 'a', 600)).toBe(0);
    expect(t.tiempo('a', 'b', 600)).toBeCloseTo(t.tiempo('b', 'a', 600), 9);
  });

  it('pasada la medianoche reduce módulo 1440; fuera de períodos usa la velocidad base', () => {
    expect(t.tiempo('a', 'b', 1440 + 12 * 60)).toBeCloseTo(t.tiempo('a', 'b', 12 * 60), 9);
    expect(t.tiempo('a', 'b', 23 * 60)).toBeCloseTo(t.tiempo('a', 'b', 12 * 60), 9);
  });

  it('expone los cortes de período ordenados', () => {
    expect(t.cortes).toEqual([420, 570, 1050, 1230]);
  });

  it('una coordenada faltante es un error inesperado', () => {
    expect(() => t.tiempo('a', 'zzz', 600)).toThrow('Falta la coordenada');
  });
});
