import { describe, expect, it } from 'vitest';
import { compilar } from './compilar.js';
import { detallar, evaluar } from './evaluacion.js';
import { parada, problemaPlano, v } from './problemas.test-util.js';

// Valores calculados a mano. Viajes de 10 min, servicio de 5 min, salida 08:00 (480), ω = 0,3, μ = 5, riesgo = 10.000.
const paradas = [parada('A', { ventanas: [v(540, 600)] }), parada('B')];

describe('evaluación de una ruta', () => {
  const c = compilar(problemaPlano(paradas));

  it('[A, B]: espera hasta que A abre (09:00)', () => {
    // 10 (→A) + 0,3·50 (espera) + 10 (A→B) + 10 (B→depósito) = 45
    expect(evaluar(c, [0, 1], 2)).toBeCloseTo(45, 9);
    const it = detallar(c, [0, 1]);
    expect(it.llegada).toEqual([490, 555]);
    expect(it.inicio).toEqual([540, 555]);
    expect(it.espera).toEqual([50, 0]);
    expect(it.regreso).toBe(570);
  });

  it('[B, A]: espera menos y cuesta menos (40,5)', () => {
    expect(evaluar(c, [1, 0], 2)).toBeCloseTo(40.5, 9);
    const it = detallar(c, [1, 0]);
    expect(it.llegada).toEqual([490, 505]);
    expect(it.espera[1]).toBe(35);
    expect(it.regreso).toBe(555);
  });

  it('detallar y evaluar coinciden', () => {
    expect(detallar(c, [1, 0]).costo).toBe(evaluar(c, [1, 0], 2));
  });

  it('una llegada tardía suma riesgo + μ·atraso y no espera', () => {
    const tarde = compilar(problemaPlano([parada('B'), parada('C', { ventanas: [v(480, 500)] })]));
    // B primero: C llega a 505 (cierra 500) → atraso 5 → 10.000 + 5·5
    const it = detallar(tarde, [0, 1]);
    expect(it.atraso).toEqual([0, 5]);
    expect(evaluar(tarde, [0, 1], 2)).toBeCloseTo(10 + 10 + 10 + 10_000 + 25, 9);
    // C primero: llega a 490, sin atraso
    expect(detallar(tarde, [1, 0]).atraso).toEqual([0, 0]);
  });

  it('con colación elige el tramo que corresponde a la hora de llegada', () => {
    const colacion = compilar(problemaPlano([parada('X', { ventanas: [v(480, 500), v(780, 900)] })], { salida: 600 }));
    const it = detallar(colacion, [0]);
    expect(it.llegada[0]).toBe(610);
    expect(it.inicio[0]).toBe(780); // espera a que abra el segundo tramo
    expect(it.atraso[0]).toBe(0);
  });

  it('el ritmo del chofer multiplica los tiempos de viaje', () => {
    const lento = compilar(problemaPlano(paradas, { ritmo: 2 }));
    const it = detallar(lento, [1, 0]);
    expect(it.llegada).toEqual([500, 525]);
    expect(it.regreso).toBe(565); // 540 + 5 de servicio + 20 de vuelta
  });

  it('una ruta vacía solo viaja origen → depósito', () => {
    expect(evaluar(c, [], 0)).toBe(10);
    expect(detallar(c, []).regreso).toBe(490);
  });

  it('la poda por costo devuelve Infinity cuando se supera el corte', () => {
    expect(evaluar(c, [0, 1], 2, 20)).toBe(Infinity);
    expect(evaluar(c, [0, 1], 2, 1000)).toBeCloseTo(45, 9);
  });

  it('el término de prioridad adelanta las paradas prioritarias', () => {
    const p = compilar(problemaPlano([parada('A', { prioridad: true }), parada('B')]));
    expect(evaluar(p, [0, 1], 2)).toBeLessThan(evaluar(p, [1, 0], 2));
  });
});
