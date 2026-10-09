import { describe, expect, it, vi } from 'vitest';
import type { EventoObs } from '../../domain/aprendizaje/analisis.js';
import type { AprendizajeRepository, DatosAnalisis } from '../ports/out/aprendizaje.js';
import type { PropuestaPinRepository } from '../ports/out/pines.js';
import { crearAnalizarAprendizaje } from './analizar-aprendizaje.js';
import { crearReloj } from './fakes.test-util.js';
import { fakeEmpresas } from './fakes-rutas.test-util.js';

const { clock } = crearReloj('2026-10-05T12:00:00Z');
const T0 = Date.parse('2026-10-01T13:00:00Z');
const en = (min: number): Date => new Date(T0 + min * 60_000);
const ev = (facturaId: string, localId: string, tipo: EventoObs['tipo'], min: number, extra: Partial<EventoObs> = {}): EventoObs => ({ facturaId, localId, camionId: 'cam-1', usuarioId: 'u-1', tipo, creadoEn: en(min), ...extra });

const datos = (): DatosAnalisis => ({
  locales: [
    ...[1, 2, 3, 4, 5].map((n) => ({ id: `l${n}`, comuna: 'San Bernardo', direccion: `Calle ${n}`, lat: -33.5 + n * 0.01, lng: -70.7, pinVerificado: true })),
    { id: 'lp', comuna: 'Buin', direccion: 'Pasaje Mal Pinchado 1', lat: -33.7, lng: -70.7, pinVerificado: true },
  ],
  eventos: [
    ...[1, 2, 3, 4, 5].flatMap((n) => [ev(`f${n}`, `l${n}`, 'llegada', n * 30), ev(`f${n}`, `l${n}`, 'entregado', n * 30 + 8)]),
    // Tres visitas en días distintos a 1,3 km del pin guardado.
    ...[0, 1, 2].map((d) => ev(`p${d}`, 'lp', 'llegada', d * 1440, { lat: -33.7 + 0.012, lng: -70.7, precisionM: 10 })),
  ],
  jornadas: [{ id: 'j-1', camionId: 'cam-1', fecha: '2026-10-01', desde: en(-30), hasta: en(400) }],
  posiciones: [],
  operaciones: [{ camionId: 'cam-1', fecha: '2026-10-01', tipo: 'planificar', modo: 'sugerida', orden: ['f1', 'f2', 'f3', 'f4', 'f5'], creadoEn: en(-20) }],
});

const montar = (d = datos(), pendientes: Awaited<ReturnType<PropuestaPinRepository['listar']>> = []) => {
  const aprendizaje = {
    empresas: vi.fn<AprendizajeRepository['empresas']>(() => Promise.resolve(['empresa-1'])),
    datosParaAnalizar: vi.fn<AprendizajeRepository['datosParaAnalizar']>(() => Promise.resolve(d)),
    parametros: vi.fn<AprendizajeRepository['parametros']>(() => Promise.resolve([])),
    guardarParametros: vi.fn<AprendizajeRepository['guardarParametros']>(() => Promise.resolve()),
    guardarCalidad: vi.fn<AprendizajeRepository['guardarCalidad']>(() => Promise.resolve()),
    registrarEjecucion: vi.fn<AprendizajeRepository['registrarEjecucion']>(() => Promise.resolve()),
    ultimaEjecucion: vi.fn<AprendizajeRepository['ultimaEjecucion']>(() => Promise.resolve(undefined)),
  } satisfies AprendizajeRepository;
  const pines = {
    crearLote: vi.fn<PropuestaPinRepository['crearLote']>((_e, _u, p) => Promise.resolve(p.length)),
    listar: vi.fn<PropuestaPinRepository['listar']>(() => Promise.resolve(pendientes)),
    resolver: vi.fn<PropuestaPinRepository['resolver']>(),
  } satisfies PropuestaPinRepository;
  return { analizar: crearAnalizarAprendizaje({ aprendizaje, empresas: fakeEmpresas(), pines, clock }), aprendizaje, pines };
};

describe('analizador de segundo plano', () => {
  it('calcula lo aprendido, lo guarda, mide la ruta sugerida contra la manejada y deja anotada la ejecución', async () => {
    const t = montar();
    const r = await t.analizar('empresa-1');
    const guardados = t.aprendizaje.guardarParametros.mock.calls[0]?.[1] ?? [];
    expect(guardados.find((p) => p.clave === 'servicio_min' && p.ambito === 'global')).toMatchObject({ valor: 8, muestras: 5 });
    expect(r).toMatchObject({ eventos: 13, jornadas: 1, jornadasComparadas: 1, parametros: guardados.length });
    expect(t.aprendizaje.guardarCalidad).toHaveBeenCalledWith('empresa-1', [expect.objectContaining({ jornadaId: 'j-1', comparadas: 5, inversiones: 0 })], clock.now());
    expect(t.aprendizaje.registrarEjecucion).toHaveBeenCalledWith('empresa-1', expect.objectContaining({ resumen: r }));
  });

  it('propone mover un pin que las visitas contradicen, una sola vez', async () => {
    const t = montar();
    const r = await t.analizar('empresa-1');
    expect(r).toMatchObject({ pinesSugeridos: 1, pinesProponidos: 1 });
    expect(t.pines.crearLote).toHaveBeenCalledWith('empresa-1', 'u-1', [expect.objectContaining({ localId: 'lp', direccion: 'Pasaje Mal Pinchado 1', estado: 'pendiente' })]);
    const repetido = montar(datos(), [{ id: 'pp-1', localId: 'lp', direccion: 'x', lat: 0, lng: 0, estado: 'pendiente', proponenteId: 'u-1', creadaEn: clock.now() }]);
    expect((await repetido.analizar('empresa-1')).pinesProponidos).toBe(0);
    expect(repetido.pines.crearLote).not.toHaveBeenCalled();
  });

  it('mide la atención con el recorrido cuando el chofer toca ENTREGADO al llegar y nunca avisa LLEGUÉ', async () => {
    const d = datos();
    // Cinco entregas avisadas al llegar; el camión se queda 8 min junto al pin (puntos cada 4 min, llegando y yéndose).
    const sinLlegada = [1, 2, 3, 4, 5].map((n) => ev(`g${n}`, `l${n}`, 'entregado', 200 + n * 30));
    const recorrido = [1, 2, 3, 4, 5].flatMap((n) => {
      const base = 200 + n * 30;
      const cerca = -33.5 + n * 0.01 + 0.0001;
      return [{ camionId: 'cam-1', lat: -33.5 + n * 0.01 + 0.03, lng: -70.7, precisionM: 15, tomadoEn: en(base - 4) }, { camionId: 'cam-1', lat: cerca, lng: -70.7, precisionM: 15, tomadoEn: en(base) }, { camionId: 'cam-1', lat: cerca, lng: -70.7, precisionM: 15, tomadoEn: en(base + 4) }, { camionId: 'cam-1', lat: -33.5 + n * 0.01 + 0.03, lng: -70.7, precisionM: 15, tomadoEn: en(base + 8) }];
    });
    const t = montar({ ...d, eventos: sinLlegada, posiciones: recorrido });
    const r = await t.analizar('empresa-1');
    expect(r.llegadasDeducidas).toBe(5);
    const guardados = t.aprendizaje.guardarParametros.mock.calls[0]?.[1] ?? [];
    expect(guardados.find((p) => p.clave === 'servicio_min' && p.ambito === 'global')).toMatchObject({ valor: 8, muestras: 5 });
  });

  it('avisa de los locales donde se entregó lejos del pin', async () => {
    const d = datos();
    const t = montar({ ...d, eventos: [...d.eventos, ev('z1', 'l1', 'entregado', 500, { lat: -33.5 + 0.01 + 0.02, lng: -70.7, precisionM: 10 })] });
    const r = await t.analizar('empresa-1');
    expect(r.pinesDudosos[0]).toMatchObject({ localId: 'l1', visitas: 1 });
  });

  it('sin datos no inventa nada', async () => {
    const t = montar({ locales: [], eventos: [], jornadas: [], operaciones: [], posiciones: [] });
    expect(await t.analizar('empresa-1')).toMatchObject({ eventos: 0, parametros: 0, pinesSugeridos: 0, cierresFrecuentes: [] });
    expect(t.aprendizaje.guardarCalidad).not.toHaveBeenCalled();
  });
});
