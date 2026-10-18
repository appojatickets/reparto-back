import { describe, expect, it } from 'vitest';
import { contribuciones, type DatosContribucion } from './contribuciones.js';

const datos = (extra: Partial<DatosContribucion> = {}): DatosContribucion => ({ tieneFoto: true, tienePin: true, pinVerificado: false, entregasPor: [], ...extra });

describe('quiénes aportaron a un local', () => {
  it('un local sin foto o sin pin no muestra aportes, aunque tenga entregas o esté verificado', () => {
    const entregasPor = [{ usuarioId: 'a', entregas: 5 }];
    expect(contribuciones(datos({ tieneFoto: false, entregasPor, pinVerificado: true }))).toEqual([]);
    expect(contribuciones(datos({ tienePin: false, entregasPor, pinVerificado: true }))).toEqual([]);
  });

  it('con foto y pin pero una sola entrega y sin verificar, todavía no (hace falta más de una entrega o la verificación)', () => {
    expect(contribuciones(datos({ fotoPor: 'a', entregasPor: [{ usuarioId: 'a', entregas: 1 }] }))).toEqual([]);
  });

  it('más de una entrega (de una persona o de varias) basta', () => {
    expect(contribuciones(datos({ entregasPor: [{ usuarioId: 'a', entregas: 2 }] }))).toEqual([{ usuarioId: 'a', aportes: ['entregas'], entregas: 2 }]);
    expect(contribuciones(datos({ entregasPor: [{ usuarioId: 'a', entregas: 1 }, { usuarioId: 'b', entregas: 1 }] })).map((c) => c.usuarioId)).toEqual(['a', 'b']);
  });

  it('un pin verificado basta, aunque no haya entregas, y acredita a quien lo verificó', () => {
    expect(contribuciones(datos({ pinVerificado: true, pinVerificadoPor: 'm' }))).toEqual([{ usuarioId: 'm', aportes: ['pin'], entregas: 0 }]);
  });

  it('un pin verificado por las entregas (nadie lo verificó a mano) acredita solo a quienes entregaron', () => {
    expect(contribuciones(datos({ pinVerificado: true, entregasPor: [{ usuarioId: 'a', entregas: 1 }] }))).toEqual([{ usuarioId: 'a', aportes: ['entregas'], entregas: 1 }]);
  });

  it('une los aportes de una misma persona y ordena primero a quien más aportó', () => {
    const r = contribuciones(datos({
      pinVerificado: true,
      fotoPor: 'a',
      pinVerificadoPor: 'm',
      entregasPor: [{ usuarioId: 'b', entregas: 4 }, { usuarioId: 'a', entregas: 2 }],
    }));
    expect(r).toEqual([
      { usuarioId: 'a', aportes: ['foto', 'entregas'], entregas: 2 },
      { usuarioId: 'b', aportes: ['entregas'], entregas: 4 },
      { usuarioId: 'm', aportes: ['pin'], entregas: 0 },
    ]);
  });

  it('quien subió la foto no aparece por eso solo si el local no cumple la condición', () => {
    expect(contribuciones(datos({ fotoPor: 'a' }))).toEqual([]);
  });

  it('muestra como mucho 10 personas', () => {
    const entregasPor = Array.from({ length: 15 }, (_, i) => ({ usuarioId: `u${String(i).padStart(2, '0')}`, entregas: 2 }));
    expect(contribuciones(datos({ entregasPor }))).toHaveLength(10);
  });
});
