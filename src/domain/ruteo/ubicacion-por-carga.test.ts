import { describe, expect, it } from 'vitest';
import { ubicarPorOrdenDeCarga, type AnclaDeCarga } from './ubicacion-por-carga.js';

const ancla = (orden: number, lat: number, lng: number, comuna = 'San Bernardo'): AnclaDeCarga => ({ orden, comuna, coordenada: { lat, lng } });

describe('ubicarPorOrdenDeCarga', () => {
  it('entre la cargada justo antes y la cargada justo después, en proporción a su lugar en la carga', () => {
    const anclas = [ancla(0, -33.6, -70.7), ancla(4, -33.64, -70.66), ancla(9, -33.5, -70.5)];
    const u = ubicarPorOrdenDeCarga({ orden: 1, comuna: 'San Bernardo' }, anclas);
    expect(u?.lat).toBeCloseTo(-33.61, 6);
    expect(u?.lng).toBeCloseTo(-70.69, 6);
  });

  it('si solo hay una vecina con ubicación, queda en esa', () => {
    expect(ubicarPorOrdenDeCarga({ orden: 7, comuna: 'San Bernardo' }, [ancla(2, -33.6, -70.7)])).toEqual({ lat: -33.6, lng: -70.7 });
  });

  it('solo cuentan las de su misma comuna (escrita igual o con otras mayúsculas o tildes)', () => {
    const anclas = [ancla(1, -33.52, -70.58, 'La Florida'), ancla(3, -33.6, -70.7, 'san bernardo')];
    expect(ubicarPorOrdenDeCarga({ orden: 2, comuna: 'San Bernardo' }, anclas)).toEqual({ lat: -33.6, lng: -70.7 });
  });

  it('sin vecinas con ubicación en su comuna no se sabe dónde está', () => {
    expect(ubicarPorOrdenDeCarga({ orden: 2, comuna: 'Talagante' }, [ancla(1, -33.6, -70.7)])).toBeUndefined();
    expect(ubicarPorOrdenDeCarga({ orden: 2, comuna: 'Talagante' }, [])).toBeUndefined();
  });
});
