import { describe, expect, it } from 'vitest';
import { crearCoordenada, distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { crearFactorHorario, crearTiemposConViajes, crearTiemposHaversine, tiempoDeViaje } from './tiempos.js';

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

describe('tiempoDeViaje · un tramo que cruza el cambio de período', () => {
  const t = crearTiemposHaversine(mapa);
  const llegada = (minuto: number): number => minuto + tiempoDeViaje(t, 'a', 'b', minuto);

  it('salir más tarde nunca hace llegar antes (antes, salir a las 09:29 llegaba más tarde que salir a las 09:31)', () => {
    for (let m = 9 * 60; m <= 9 * 60 + 40; m++) expect(llegada(m + 1)).toBeGreaterThanOrEqual(llegada(m) - 1e-9);
    for (let m = 20 * 60; m <= 20 * 60 + 40; m++) expect(llegada(m + 1)).toBeGreaterThanOrEqual(llegada(m) - 1e-9);
  });

  it('cada parte del tramo va a la velocidad de su período', () => {
    const km = distanciaKm(a, b) * 1.35;
    const salida = 9 * 60 + 25; // 5 min a 22 km/h y el resto a 30 km/h
    const resto = km - (22 * 5) / 60;
    expect(tiempoDeViaje(t, 'a', 'b', salida)).toBeCloseTo(5 + (resto / 30) * 60, 9);
  });

  it('dentro de un mismo período es igual que antes', () => {
    expect(tiempoDeViaje(t, 'a', 'b', 12 * 60)).toBeCloseTo(t.tiempo('a', 'b', 12 * 60), 9);
    expect(tiempoDeViaje(t, 'a', 'b', 12 * 60, 1.5)).toBeCloseTo(t.tiempo('a', 'b', 12 * 60) * 1.5, 9);
  });
});

describe('crearFactorHorario · tiempos por calles en hora punta', () => {
  const factor = crearFactorHorario();

  it('fuera de la punta el tiempo de calles queda igual; en punta se alarga como la velocidad (30/22)', () => {
    expect(factor(12 * 60)).toBe(1);
    expect(factor(8 * 60)).toBeCloseTo(30 / 22, 9);
    const conCalles = crearTiemposConViajes(crearTiemposHaversine(mapa), () => 20, factor);
    expect(conCalles.tiempo('a', 'b', 12 * 60)).toBe(20);
    expect(conCalles.tiempo('a', 'b', 18 * 60)).toBeCloseTo(20 * (30 / 22), 9);
  });
});
