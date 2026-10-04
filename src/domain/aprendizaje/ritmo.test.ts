import { describe, expect, it } from 'vitest';
import { confianzaHorario, ritmoChofer, ritmoEsConfiable, ritmoObservado, servicioNuevo } from './ritmo.js';

describe('ritmo del chofer', () => {
  it('ritmo observado = Σ reales ÷ Σ planificados', () => {
    expect(ritmoObservado([{ minutosReales: 12, minutosPlanificados: 10 }, { minutosReales: 24, minutosPlanificados: 20 }])).toEqual({ ritmoObs: 1.2, n: 2 });
  });

  it('excluye las pausas (brechas > 40 min) y los tramos sin plan', () => {
    const r = ritmoObservado([
      { minutosReales: 10, minutosPlanificados: 10 },
      { minutosReales: 90, minutosPlanificados: 10 }, // almuerzo
      { minutosReales: 5, minutosPlanificados: 0 },
    ]);
    expect(r).toEqual({ ritmoObs: 1, n: 1 });
  });

  it('sin tramos válidos no hay ritmo observado', () => {
    expect(ritmoObservado([])).toBeUndefined();
    expect(ritmoObservado([{ minutosReales: 90, minutosPlanificados: 10 }])).toBeUndefined();
  });

  it('con pocos datos el ritmo se queda cerca de 1,0 y con muchos converge al observado', () => {
    expect(ritmoChofer(1.5, 0)).toBe(1);
    expect(ritmoChofer(1.5, 20)).toBeCloseTo(1.25, 9);
    expect(ritmoChofer(1.5, 2000)).toBeCloseTo(1.5, 2);
  });

  it('es confiable con n ≥ 40', () => {
    expect(ritmoEsConfiable(39)).toBe(false);
    expect(ritmoEsConfiable(40)).toBe(true);
  });
});

describe('servicio y confianza de horario', () => {
  it('servicio_nuevo = 0,3·observado + 0,7·anterior, con el observado acotado a [1, 45]', () => {
    expect(servicioNuevo(10, 8)).toBeCloseTo(8.6, 9);
    expect(servicioNuevo(300, 8)).toBeCloseTo(0.3 * 45 + 0.7 * 8, 9);
    expect(servicioNuevo(0, 8)).toBeCloseTo(0.3 + 5.6, 9);
  });

  it('confianza_horario = (aciertos + 1) / (intentos + 2)', () => {
    expect(confianzaHorario(0, 0)).toBe(0.5);
    expect(confianzaHorario(9, 9)).toBeCloseTo(10 / 11, 9);
    expect(confianzaHorario(0, 4)).toBeCloseTo(1 / 6, 9);
  });
});
