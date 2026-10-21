import { describe, expect, it } from 'vitest';
import { balanceCajas, centesimasDeCaja } from './cajas.js';
describe('cajas y pago por persona', () => {
  it('descuenta fracciones sin perder dinero ni cantidades', () => {
    expect(balanceCajas(10.5, 0.5, 3.5)).toEqual({ cargadas: 10.5, porCerrado: 0.5, rebajes: 3.5, entregadas: 6.5, descuentoPesos: 60, montoPesos: 97.5 });
    expect(balanceCajas(0.3, 0.1, 0.2)?.entregadas).toBe(0);
  });
  it('rechaza negativos, no finitos, exceso de precisión y descuentos mayores a la carga', () => {
    for (const n of [-1, NaN, Infinity, 0.001, 1_000_001]) expect(centesimasDeCaja(n)).toBeUndefined();
    expect(balanceCajas(3, 2, 2)).toBeUndefined();
  });
});
