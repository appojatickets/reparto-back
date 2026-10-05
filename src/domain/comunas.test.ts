import { describe, expect, it } from 'vitest';
import { centroDeComuna, COMUNAS_RM, resolverComuna } from './comunas.js';
import { dentroDeRegionMetropolitana } from './valor/coordenada.js';

describe('catálogo de comunas de la Región Metropolitana', () => {
  it('tiene las 52 comunas, sin repetidas', () => {
    expect(COMUNAS_RM).toHaveLength(52);
    expect(new Set(COMUNAS_RM).size).toBe(52);
  });

  it('resuelve ignorando tildes, mayúsculas y espacios', () => {
    expect(resolverComuna('ñuñoa')).toBe('Ñuñoa');
    expect(resolverComuna('  MAIPU ')).toBe('Maipú');
    expect(resolverComuna('san   josé de maipo')).toBe('San José de Maipo');
    expect(resolverComuna('Estacion Central')).toBe('Estación Central');
  });

  it('una comuna que no es de la RM no se resuelve', () => {
    expect(resolverComuna('Valparaíso')).toBeUndefined();
    expect(resolverComuna('')).toBeUndefined();
  });
});

describe('centro de cada comuna', () => {
  it('las 52 comunas tienen un centro dentro de la Región Metropolitana', () => {
    for (const c of COMUNAS_RM) {
      const centro = centroDeComuna(c);
      expect(centro, c).toBeDefined();
      if (centro) expect(dentroDeRegionMetropolitana(centro), c).toBe(true);
    }
  });

  it('acepta el nombre sin tildes y rechaza lo que no es una comuna de la RM', () => {
    expect(centroDeComuna('penaflor')).toEqual({ lat: -33.61, lng: -70.88 });
    expect(centroDeComuna('Valparaíso')).toBeUndefined();
  });
});
