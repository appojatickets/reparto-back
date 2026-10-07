import { describe, expect, it } from 'vitest';
import { crearCoordenada, distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { crearTiemposConViajes, crearTiemposHaversine } from './tiempos.js';

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

describe('crearTiemposConViajes (tiempos por calles con respaldo en línea recta)', () => {
  const coords = new Map<string, Coordenada>([['A', c(-33.45, -70.65)], ['B', c(-33.5, -70.7)], ['C', c(-33.55, -70.75)]]);
  const recta = crearTiemposHaversine(coords);

  it('usa el tiempo real donde se conoce y la línea recta donde falta', () => {
    const t = crearTiemposConViajes(recta, (a, b) => (a === 'A' && b === 'B' ? 7.5 : undefined));
    expect(t.tiempo('A', 'B', 600)).toBe(7.5);
    expect(t.tiempo('B', 'C', 600)).toBe(recta.tiempo('B', 'C', 600));
    expect(t.tiempo('A', 'A', 600)).toBe(0);
    expect(t.cortes).toEqual(recta.cortes);
  });

  it('ignora un valor que no sirve (negativo o no numérico) y usa el respaldo', () => {
    const t = crearTiemposConViajes(recta, () => -3);
    expect(t.tiempo('A', 'B', 600)).toBe(recta.tiempo('A', 'B', 600));
    expect(crearTiemposConViajes(recta, () => Number.NaN).tiempo('A', 'C', 600)).toBe(recta.tiempo('A', 'C', 600));
  });
});
