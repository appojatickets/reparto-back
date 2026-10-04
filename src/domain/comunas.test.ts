import { describe, expect, it } from 'vitest';
import { COMUNAS_RM, resolverComuna } from './comunas.js';

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
