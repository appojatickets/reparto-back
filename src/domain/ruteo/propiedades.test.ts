import fc from 'fast-check';
import { describe, it } from 'vitest';
import { verificarInvariantes } from './invariantes.js';
import { optimizar } from './optimizador.js';
import { problemaAleatorio } from './problemas.test-util.js';

// Pruebas basadas en propiedades: el generador produce problemas reproducibles a partir de (semilla, n, ventanas, ritmo, salida).
const problemas = fc.record({
  semilla: fc.integer({ min: 1, max: 1_000_000 }),
  n: fc.integer({ min: 0, max: 14 }),
  fraccion: fc.double({ min: 0, max: 1, noNaN: true }),
  ritmo: fc.double({ min: 0.7, max: 1.6, noNaN: true }),
  salida: fc.integer({ min: 360, max: 1080 }),
});

describe('propiedades del optimizador', () => {
  it('siempre cumple las invariantes (depósito, una vez cada parada, ETA y ventanas coherentes)', () => {
    fc.assert(
      fc.property(problemas, ({ semilla, n, fraccion, ritmo, salida }) => {
        const p = problemaAleatorio(semilla, n, { fraccionConVentana: fraccion, ritmo, salida });
        return verificarInvariantes(p, optimizar(p)).length === 0;
      }),
      { numRuns: 120 },
    );
  });

  it('cada parada aparece exactamente una vez: en el orden o en no atendidas', () => {
    fc.assert(
      fc.property(problemas, ({ semilla, n, fraccion, ritmo, salida }) => {
        const p = problemaAleatorio(semilla, n, { fraccionConVentana: fraccion, ritmo, salida });
        const s = optimizar(p);
        const ids = [...s.orden, ...s.noAtendidas.map((x) => x.paradaId)].sort();
        return JSON.stringify(ids) === JSON.stringify(p.paradas.map((x) => x.id).sort());
      }),
      { numRuns: 120 },
    );
  });

  it('volver a optimizar a partir de la solución nunca la empeora', () => {
    fc.assert(
      fc.property(problemas, ({ semilla, n, fraccion }) => {
        const p = problemaAleatorio(semilla, n, { fraccionConVentana: fraccion });
        const s = optimizar(p);
        return optimizar(p, { ordenInicial: s.orden }).costo <= s.costo + 1e-6;
      }),
      { numRuns: 60 },
    );
  });

  it('sin ventanas no hay paradas en riesgo ni no atendidas', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.integer({ min: 1, max: 12 }), (semilla, n) => {
        const s = optimizar(problemaAleatorio(semilla, n, { fraccionConVentana: 0 }));
        return s.enRiesgo.length === 0 && s.noAtendidas.length === 0 && s.orden.length === n;
      }),
      { numRuns: 60 },
    );
  });

  it('con ventanas que se pueden cumplir todas, ninguna queda en riesgo', () => {
    // Ventanas muy anchas (todo el día): siempre existe solución sin riesgos.
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.integer({ min: 1, max: 10 }), (semilla, n) => {
        const p = problemaAleatorio(semilla, n, { fraccionConVentana: 0 });
        const anchas = { ...p, paradas: p.paradas.map((x) => ({ ...x, ventanas: [{ apertura: 0, cierre: 1440 }] })) };
        return optimizar(anchas).enRiesgo.length === 0;
      }),
      { numRuns: 40 },
    );
  });
});
