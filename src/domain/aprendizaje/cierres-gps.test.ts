import { describe, expect, it } from 'vitest';
import type { EventoObs, LocalObs, PosicionObs } from './analisis.js';
import { validarCierresPorGps } from './cierres-gps.js';

const T0 = Date.parse('2026-10-05T13:00:00Z');
const en = (min: number): Date => new Date(T0 + min * 60_000);
const PIN = { lat: -33.5, lng: -70.7 };
const LEJOS = { lat: -33.52, lng: -70.7 };
const locales = new Map<string, LocalObs>([['l1', { id: 'l1', comuna: 'Maipú', ...PIN }]]);
const ev = (tipo: EventoObs['tipo'], min: number, extra: Partial<EventoObs> = {}): EventoObs => ({ facturaId: 'f1', localId: 'l1', camionId: 'cam-1', tipo, creadoEn: en(min), ...extra });
const punto = (min: number, cerca: boolean, extra: Partial<PosicionObs> = {}): PosicionObs => ({ camionId: 'cam-1', ...(cerca ? PIN : LEJOS), precisionM: 10, tomadoEn: en(min), ...extra });
/** Camión junto al pin entre `desde` y `hasta` (un punto por minuto) y lejos el resto de la ventana. */
const recorrido = (...tramos: [number, number][]): PosicionObs[] => {
  const salida: PosicionObs[] = [];
  for (let m = -10; m <= 120; m += 1) salida.push(punto(m, tramos.some(([d, h]) => m >= d && m <= h)));
  return salida;
};

describe('cierre deducido por GPS frente al botón', () => {
  it('pasó 2 min, se fue sin entregar y volvió a entregar: GPS dice cerrado; sin botón es un hallazgo solo del GPS, confirmado por el desenlace', () => {
    const r = validarCierresPorGps([ev('llegada', 0, { }), ev('entregado', 62)], locales, recorrido([0, 2], [60, 70]));
    expect(r).toMatchObject({ visitas: 2, cerradoDeducido: 1, atendidas: 1, soloGps: 1, soloGpsConfirmados: 1, coinciden: 0 });
    expect(r.casos).toEqual([expect.objectContaining({ tipo: 'solo_gps', facturaId: 'f1', entregadaDespues: true })]);
  });

  it('si además el chofer tocó CERRADO, coinciden', () => {
    const r = validarCierresPorGps([ev('llegada', 0), ev('cerrado', 2), ev('entregado', 62)], locales, recorrido([0, 2], [60, 70]));
    expect(r).toMatchObject({ cerradoDeducido: 1, botonCerrado: 1, coinciden: 1, soloGps: 0, soloBoton: 0 });
  });

  it('una visita en que se entregó es «atendida» aunque dure poco', () => {
    const r = validarCierresPorGps([ev('llegada', 0), ev('entregado', 1)], locales, recorrido([0, 2]));
    expect(r).toMatchObject({ visitas: 1, atendidas: 1, cerradoDeducido: 0 });
  });

  it('sin segundo intento no se puede juzgar: queda «sin desenlace» y no cuenta como cerrado deducido', () => {
    const r = validarCierresPorGps([ev('llegada', 0)], locales, recorrido([0, 2]));
    expect(r).toMatchObject({ visitas: 1, sinDesenlace: 1, cerradoDeducido: 0, soloGps: 0 });
  });

  it('un CERRADO sin que el camión haya vuelto tampoco es un error del GPS: se cuenta como botón sin desenlace', () => {
    const r = validarCierresPorGps([ev('llegada', 0), ev('cerrado', 1)], locales, recorrido([0, 2]));
    expect(r).toMatchObject({ botonCerrado: 1, botonSinDesenlace: 1, soloBoton: 0 });
  });

  it('el botón dice cerrado pero el camión se quedó 15 min y volvió: hallazgo solo del botón (la regla de permanencia no lo ve)', () => {
    const r = validarCierresPorGps([ev('llegada', 0), ev('cerrado', 14), ev('entregado', 62)], locales, recorrido([0, 15], [60, 70]));
    expect(r).toMatchObject({ botonCerrado: 1, coinciden: 0, soloBoton: 1 });
    expect(r.casos[0]).toMatchObject({ tipo: 'solo_boton' });
  });

  it('un tramo en que iba en marcha todo el rato (pasó de largo) no es una visita', () => {
    const enMarcha = recorrido([0, 2]).map((p) => (p.tomadoEn.getTime() <= en(2).getTime() && p.tomadoEn.getTime() >= en(0).getTime() ? { ...p, velocidadMs: 9 } : p));
    expect(validarCierresPorGps([ev('llegada', 0), ev('entregado', 62)], locales, enMarcha).cerradoDeducido).toBe(0);
  });

  it('un CERRADO que no tiene recorrido GPS junto al pin se cuenta aparte (cobertura del GPS)', () => {
    const r = validarCierresPorGps([ev('cerrado', 1)], locales, recorrido());
    expect(r).toMatchObject({ botonCerrado: 0, botonSinRecorrido: 1 });
  });

  it('da las medianas de permanencia: cerrados por botón frente a atendidas', () => {
    const r = validarCierresPorGps([ev('llegada', 0), ev('cerrado', 2), ev('entregado', 72)], locales, recorrido([0, 2], [70, 82]));
    expect(r.medianaMinCerradoBoton).toBeGreaterThan(0);
    expect(r.medianaMinAtendidas).toBeGreaterThan(r.medianaMinCerradoBoton ?? Infinity);
  });
});
