import { describe, expect, it } from 'vitest';
import { distanciaKm, type Coordenada } from '../valor/coordenada.js';
import { ubicarPorCalle, type AnclaDeCalle, type ParadaPorUbicar } from './ubicacion-por-calle.js';

const SIN_CARGA = (): undefined => undefined;
const ancla = (calle: string, numero: number | undefined, lat: number, lng: number, comuna = 'San Bernardo'): AnclaDeCalle => ({ comuna, calle, ...(numero !== undefined ? { numero } : {}), coordenada: { lat, lng } });
const sinPin = (id: string, calle: string, numero: number | undefined, orden = 0, comuna = 'San Bernardo'): ParadaPorUbicar => ({ id, comuna, calle, ...(numero !== undefined ? { numero } : {}), orden });
const km = (a: Coordenada | undefined, b: Coordenada | undefined): number => (a && b ? distanciaKm(a, b) : NaN);

describe('ubicarPorCalle', () => {
  it('con puertas conocidas en su calle cae entre las dos vecinas según su número', () => {
    const r = ubicarPorCalle([sinPin('a', 'colon', 500)], [ancla('colon', 100, -33.6, -70.7), ancla('colon', 900, -33.6, -70.69)], SIN_CARGA);
    expect(r.ubicadas.get('a')?.lat).toBeCloseTo(-33.6, 6);
    expect(r.ubicadas.get('a')?.lng).toBeCloseTo(-70.695, 6);
  });

  it('un pin exacto de otra factura del mismo día también sirve de puerta conocida', () => {
    const pin: ParadaPorUbicar = { id: 'pin', comuna: 'San Bernardo', calle: 'colon', numero: 100, orden: 0, coordenada: { lat: -33.6, lng: -70.7 } };
    const r = ubicarPorCalle([pin, sinPin('a', 'colon', 140)], [], SIN_CARGA);
    expect(r.ubicadas.has('pin')).toBe(false);
    // 40 números más allá de la única puerta conocida: a unos 40 m, no en otra parte de la comuna.
    expect(km(r.ubicadas.get('a'), pin.coordenada)).toBeLessThan(0.06);
  });

  it('fuera de lo conocido sigue la calle en la dirección que llevan las puertas vecinas', () => {
    const r = ubicarPorCalle([sinPin('a', 'colon', 1100), sinPin('b', 'colon', 0)], [ancla('colon', 100, -33.6, -70.7), ancla('colon', 900, -33.6, -70.691)], SIN_CARGA);
    // Hacia números mayores sigue al este; hacia menores, al oeste.
    expect(r.ubicadas.get('a')?.lng).toBeGreaterThan(-70.691);
    expect(r.ubicadas.get('b')?.lng).toBeLessThan(-70.7);
    expect(r.ubicadas.get('a')?.lat).toBeCloseTo(-33.6, 5);
  });

  it('números muy distintos en la misma calle quedan lejos entre sí y los parecidos cerca', () => {
    const r = ubicarPorCalle([sinPin('a', 'larga', 100), sinPin('b', 'larga', 130), sinPin('c', 'larga', 4500)], [ancla('larga', 120, -33.6, -70.7)], SIN_CARGA);
    expect(km(r.ubicadas.get('a'), r.ubicadas.get('b'))).toBeLessThan(0.05);
    expect(km(r.ubicadas.get('a'), r.ubicadas.get('c'))).toBeGreaterThan(1);
  });

  it('si nada de la calle se conoce, todas sus facturas quedan juntas (y en orden por número) en el lugar que da el orden de carga', () => {
    const porCarga = (_c: string, orden: number): Coordenada => ({ lat: -33.55 - orden / 1000, lng: -70.7 });
    const r = ubicarPorCalle([sinPin('a', 'norte', 300, 2), sinPin('b', 'norte', 310, 20), sinPin('c', 'norte', 305, 4)], [], porCarga);
    // Mediana del orden de carga = 4: las tres quedan alrededor de ese punto, no repartidas entre los lugares 2 y 20.
    expect(km(r.ubicadas.get('a'), porCarga('', 4))).toBeLessThan(0.02);
    expect(km(r.ubicadas.get('b'), porCarga('', 4))).toBeLessThan(0.02);
    expect((r.ubicadas.get('a')?.lng ?? 0) < (r.ubicadas.get('c')?.lng ?? 0)).toBe(true);
    expect((r.ubicadas.get('c')?.lng ?? 0) < (r.ubicadas.get('b')?.lng ?? 0)).toBe(true);
  });

  it('sin pista de carga usa el centro de la comuna', () => {
    const r = ubicarPorCalle([sinPin('a', 'norte', 300), sinPin('b', 'norte', 310)], [], SIN_CARGA);
    expect(km(r.ubicadas.get('a'), { lat: -33.59, lng: -70.7 })).toBeLessThan(0.1);
  });

  it('un pin aproximado (solo hasta la calle) es el punto de partida de su calle, ordenado por número', () => {
    const punto = { lat: -33.6, lng: -70.7 };
    const aprox = (id: string, numero: number): ParadaPorUbicar => ({ id, comuna: 'San Bernardo', calle: 'norte', numero, orden: 0, coordenada: punto, aproximada: true });
    const r = ubicarPorCalle([aprox('a', 100), aprox('b', 400), aprox('c', 250)], [], SIN_CARGA);
    expect(km(r.ubicadas.get('a'), r.ubicadas.get('b'))).toBeGreaterThan(0.25);
    expect((r.ubicadas.get('a')?.lng ?? 0) < (r.ubicadas.get('c')?.lng ?? 0)).toBe(true);
    expect((r.ubicadas.get('c')?.lng ?? 0) < (r.ubicadas.get('b')?.lng ?? 0)).toBe(true);
  });

  it('la misma calle en otra comuna no es la misma calle', () => {
    const r = ubicarPorCalle([sinPin('a', 'colon', 500, 0, 'Maipú')], [ancla('colon', 500, -33.6, -70.7, 'San Bernardo')], SIN_CARGA);
    expect(km(r.ubicadas.get('a'), { lat: -33.6, lng: -70.7 })).toBeGreaterThan(5);
  });

  it('dice cuáles se ubicaron sin ninguna puerta conocida de su calle', () => {
    const r = ubicarPorCalle([sinPin('a', 'norte', 300), sinPin('b', 'colon', 100)], [ancla('colon', 120, -33.6, -70.7)], SIN_CARGA);
    expect([...r.sinPuertasConocidas]).toEqual(['a']);
  });

  it('sin número usa el promedio de las puertas conocidas de su calle', () => {
    const r = ubicarPorCalle([sinPin('a', 'colon', undefined)], [ancla('colon', 100, -33.6, -70.7), ancla('colon', 900, -33.6, -70.69)], SIN_CARGA);
    expect(r.ubicadas.get('a')?.lng).toBeCloseTo(-70.695, 6);
  });
});
