import { describe, expect, it } from 'vitest';
import { evaluarGeocodificacion } from './geocodificacion.js';

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
