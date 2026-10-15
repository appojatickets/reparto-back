import { describe, expect, it } from 'vitest';
import { leerConfig } from './repositorio-empresa.js';

describe('leer la configuración de la empresa', () => {
  it('el interruptor de lo aprendido sobre cierres solo cuenta si es verdadero o falso; sin él, no se indica (se usa)', () => {
    expect(leerConfig({}).usarCierresAprendidos).toBeUndefined();
    expect(leerConfig({ usarCierresAprendidos: false }).usarCierresAprendidos).toBe(false);
    expect(leerConfig({ usarCierresAprendidos: true }).usarCierresAprendidos).toBe(true);
    expect(leerConfig({ usarCierresAprendidos: 'no' }).usarCierresAprendidos).toBeUndefined();
  });

  it('lo que falte o venga roto usa los valores por defecto', () => {
    expect(leerConfig(null)).toEqual({ salidaPorDefectoMin: 480, horaLimiteRegresoMin: 1260 });
  });
});
