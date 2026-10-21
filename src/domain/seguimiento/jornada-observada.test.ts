import { describe, expect, it } from 'vitest';
import { jornadasObservadas } from './jornada-observada.js';
const base = new Date('2026-10-05T12:00:00Z').getTime();
const punto = (min: number, lat = -33.5, extra = {}) => ({ camionId: 'cam', lat, lng: -70.7, precisionM: 10, tomadoEn: new Date(base + min * 60_000), ...extra });
const evento = (tipo: string, min: number, extra = {}) => ({ camionId: 'cam', localId: 'l', facturaId: 'f', tipo, creadoEn: new Date(base + min * 60_000), ...extra });

describe('jornada observada por GPS', () => {
  it('separa entregas de cierres, elimina duplicados y no cierra una jornada por estar detenido', () => {
    const r = jornadasObservadas([punto(0), punto(1), punto(1), punto(2)], [evento('llegada', 0, { facturaId: 'sin-confirmar' }), evento('cerrado', 0), evento('no_entregado', 1, { motivo: 'cerrado' }), evento('entregado', 2), evento('entregado', 2)], [{ camionId: 'cam', fecha: '2026-10-05', desde: new Date(base) }]);
    expect(r[0]).toMatchObject({ puntos: 3, minutosObservados: 2, kmObservados: 0, entregadas: 1, visitasCerrado: 1, visitasSinResultado: 1, jornadaCerrada: false, cobertura: 1 });
    expect(r[0]?.finRegistrado).toBeUndefined();
  });
  it('no inventa recorridos ni tiempo observado durante huecos de señal o saltos imposibles', () => {
    const r = jornadasObservadas([punto(0), punto(1), punto(31), punto(32, -34.5)], [], []);
    expect(r[0]).toMatchObject({ minutosObservados: 1, minutosSinSenal: 31, kmObservados: 0 });
  });
  it('registra salida y regreso al depósito sin confundirlos con el término confirmado', () => {
    const r = jornadasObservadas([punto(0), punto(1, -33.51), punto(2, -33.51), punto(3)], [], [], { lat: -33.5, lng: -70.7 });
    expect(r[0]?.salidaDeposito).toBe(new Date(base + 60_000).toISOString());
    expect(r[0]?.regresoDeposito).toBe(new Date(base + 180_000).toISOString());
    expect(r[0]?.jornadaCerrada).toBe(false);
  });
  it('no usa mala precisión ni mezcla otro camión y exige terminar a todo el equipo', () => {
    const ventanas = [{ camionId: 'cam', fecha: '2026-10-05', desde: new Date(base), hasta: new Date(base + 60_000) }, { camionId: 'cam', fecha: '2026-10-05', desde: new Date(base) }];
    const puntos = [punto(0), punto(1), punto(2, -33.5, { precisionM: 200 }), punto(2, -33.5, { camionId: 'otro' })];
    expect(jornadasObservadas(puntos, [], ventanas)[0]).toMatchObject({ puntos: 2, jornadaCerrada: false });
    expect(jornadasObservadas(puntos, [], ventanas.slice(0, 1))[0]?.finRegistrado).toBe(new Date(base + 60_000).toISOString());
  });
});
