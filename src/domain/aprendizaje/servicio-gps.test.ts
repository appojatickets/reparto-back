import { describe, expect, it } from 'vitest';
import { servicioGpsAprendido } from './servicio-gps.js';
const t0 = Date.parse('2026-10-05T12:00:00Z');
const visita = (id: number, minutos: number, localId = 'l1') => ({ facturaId: `f${id}`, localId, camionId: 'cam1', llegada: new Date(t0 + id * 86_400_000), salida: new Date(t0 + id * 86_400_000 + minutos * 60_000) });

describe('atención medida por GPS', () => {
  it('aprende entregas cortas reales sin imponer diez minutos en todos los locales', () => {
    const p = servicioGpsAprendido([0, 1, 2, 3, 4].map((i) => visita(i, 2, `l${i}`)));
    expect(p.find((x) => x.ambito === 'gps:global')).toMatchObject({ valor: 5.56, muestras: 5 });
    expect(p.find((x) => x.ambito === 'gps:camion:cam1')?.valor).toBeLessThan(10);
  });
  it('la mediana local resiste una permanencia extrema y no duplica avisos de la misma factura', () => {
    const v = [visita(0, 2), visita(1, 3), visita(2, 50)];
    expect(servicioGpsAprendido([...v, ...v]).find((x) => x.ambito === 'gps:local:l1')).toMatchObject({ valor: 3, muestras: 3 });
  });
  it('no inventa datos con pocos casos, tiempos negativos, segundos sueltos o más de una hora', () => {
    expect(servicioGpsAprendido([visita(0, -1), visita(1, 0.1), visita(2, 90), visita(3, 2)])).toEqual([]);
  });
});
