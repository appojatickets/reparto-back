import { describe, expect, it } from 'vitest';
import { evaluarGeocodificacion, evaluarPuntoDeModelo } from './geocodificacion.js';

const base = { lat: -33.72, lng: -70.59, precision: 'calle' as const };

describe('evaluar lo que devolvió el mapa', () => {
  it('una calle o un número en la comuna del local sirven, con distinta confianza', () => {
    expect(evaluarGeocodificacion({ ...base, comuna: 'Pirque' }, 'Pirque')?.confianza).toBe(0.6);
    expect(evaluarGeocodificacion({ ...base, precision: 'exacta', comuna: 'Pirque' }, 'pirque')?.confianza).toBe(0.85);
  });

  it('si el mapa no dice la comuna, se acepta', () => {
    expect(evaluarGeocodificacion(base, 'Pirque')).toBeDefined();
  });

  it('se descarta lo que cae en otra comuna, fuera de la RM o que es solo una zona', () => {
    expect(evaluarGeocodificacion({ ...base, comuna: 'Buin' }, 'Pirque')).toBeUndefined();
    expect(evaluarGeocodificacion({ ...base, lat: -36.8, lng: -73 }, 'Pirque')).toBeUndefined();
    expect(evaluarGeocodificacion({ ...base, precision: 'zona' }, 'Pirque')).toBeUndefined();
  });
});

describe('evaluar el punto que estimó un modelo de lenguaje', () => {
  it('un punto creíble dentro de su comuna sirve, pero siempre como aproximado (nunca llega a pin preciso)', () => {
    const r = evaluarPuntoDeModelo({ lat: -33.595, lng: -70.705 }, 'San Bernardo');
    expect(r?.confianza).toBe(0.3);
    expect(r?.confianza).toBeLessThan(0.7);
  });

  it('se descarta lo que cae fuera de la Región Metropolitana, lejos de su comuna, o con números imposibles', () => {
    expect(evaluarPuntoDeModelo({ lat: -41.4, lng: -72.9 }, 'San Bernardo')).toBeUndefined();
    expect(evaluarPuntoDeModelo({ lat: -33.4, lng: -70.4 }, 'Ñuñoa')).toBeUndefined();
    expect(evaluarPuntoDeModelo({ lat: Number.NaN, lng: -70.7 }, 'San Bernardo')).toBeUndefined();
  });

  it('una comuna grande y rural admite más distancia que una urbana pequeña', () => {
    const lejos = { lat: -33.74, lng: -70.95 };
    expect(evaluarPuntoDeModelo(lejos, 'Melipilla')).toBeDefined();
    expect(evaluarPuntoDeModelo({ lat: -33.6, lng: -70.9 }, 'Lo Prado')).toBeUndefined();
  });

  it('sin una comuna conocida no hay con qué comprobarlo', () => {
    expect(evaluarPuntoDeModelo({ lat: -33.5, lng: -70.6 }, 'Narnia')).toBeUndefined();
  });
});
