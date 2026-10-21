import { describe, expect, it } from 'vitest';
import { optimizar, evaluarOrden } from './optimizador.js';
import { parada, problemaPlano } from './problemas.test-util.js';
import { DEPOSITO, ORIGEN } from './tiempos.js';

describe('preferencia de comunas', () => {
  it('agrupa comunas en la secuencia elegida aunque las facturas lleguen mezcladas', () => {
    const p = problemaPlano([parada('S1', { comuna: 'San Bernardo' }), parada('M1', { comuna: 'Maipú' }), parada('S2', { comuna: 'San Bernardo' }), parada('M2', { comuna: 'Maipú' }), parada('X', { comuna: 'Otra' })], { ordenComunas: ['Maipú', 'San Bernardo'] });
    const s = optimizar(p);
    expect(s.orden.map(id => p.paradas.find(x => x.id === id)?.comuna)).toEqual(['Maipú', 'Maipú', 'San Bernardo', 'San Bernardo', 'Otra']);
  });
  it('elige la última parada de una comuna considerando la entrada a la siguiente', () => {
    const x: Record<string, number> = { [ORIGEN]: 0, A: 1, B: 10, C: 11, D: 12, [DEPOSITO]: 0 };
    const p = problemaPlano([parada('B', { comuna: 'Uno' }), parada('D', { comuna: 'Dos' }), parada('A', { comuna: 'Uno' }), parada('C', { comuna: 'Dos' })], { ordenComunas: ['Uno', 'Dos'], tiempos: { cortes: [], tiempo: (a, b) => Math.abs((x[a] ?? 0) - (x[b] ?? 0)) }, parametros: { ...problemaPlano([]).parametros, epsLlegada: 0.5 } });
    expect(optimizar(p).orden).toEqual(['A', 'B', 'C', 'D']);
  });
  it('el orden manual se evalúa tal cual incluso contra la preferencia de comunas', () => {
    const p = problemaPlano([parada('A', { comuna: 'Uno' }), parada('B', { comuna: 'Dos' })], { ordenComunas: ['Uno', 'Dos'] });
    expect(evaluarOrden(p, ['B', 'A']).orden).toEqual(['B', 'A']);
    expect(optimizar({ ...p, fijas: ['B'] }).orden[0]).toBe('B');
  });
});
