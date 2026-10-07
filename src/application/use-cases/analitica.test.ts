import { describe, expect, it, vi } from 'vitest';
import type { AnaliticaRepository } from '../ports/out/analitica.js';
import type { AprendizajeRepository } from '../ports/out/aprendizaje.js';
import { crearVerAnalitica } from './analitica.js';
import { crearReloj } from './fakes.test-util.js';
import { fakeClientes } from './fakes-clientes.test-util.js';
import { fakeCamionesRuta } from './fakes-rutas.test-util.js';

const COBERTURA = { jornadas: 3, jornadasTerminadas: 2, avisos: 40, avisosConGps: 38, avisosAutomaticos: 5, paradasConLlegada: 20, paradasResueltas: 30, puntosGps: 500, operacionesRuta: 12, correccionesManuales: 4 };

describe('panel de analítica', () => {
  it('junta lo registrado y lo aprendido, con el nombre del camión y de los locales', async () => {
    const analitica = {
      cobertura: vi.fn<AnaliticaRepository['cobertura']>(() => Promise.resolve(COBERTURA)),
      porDia: vi.fn<AnaliticaRepository['porDia']>(() => Promise.resolve([{ fecha: '2026-10-05', jornadas: 2, atendidas: 60, sinHacer: 3 }])),
      calidad: vi.fn<AnaliticaRepository['calidad']>(() => Promise.resolve([{ fecha: '2026-10-05', camionId: 'cam-1', distSugeridaM: 40_000, distRealM: 44_000, inversiones: 3 }])),
      etiquetasDeLocales: vi.fn<AnaliticaRepository['etiquetasDeLocales']>(() => Promise.resolve(new Map([['l-1', { razonSocial: 'Kiosko Ana', direccion: 'Calle 1', comuna: 'Buin' }]]))),
    } satisfies AnaliticaRepository;
    const aprendizaje = {
      empresas: vi.fn<AprendizajeRepository['empresas']>(),
      datosParaAnalizar: vi.fn<AprendizajeRepository['datosParaAnalizar']>(),
      parametros: vi.fn<AprendizajeRepository['parametros']>(() => Promise.resolve([
        { clave: 'ritmo', ambito: 'camion:cam-1', valor: 1.2, muestras: 40, confianza: 1 },
        { clave: 'servicio_min', ambito: 'local:l-1', valor: 22, muestras: 4, confianza: 0.5 },
        { clave: 'servicio_min', ambito: 'global', valor: 9, muestras: 30, confianza: 0.7 },
        { clave: 'capacidad_paradas', ambito: 'global', valor: 32, muestras: 6, confianza: 0.5 },
      ])),
      guardarParametros: vi.fn<AprendizajeRepository['guardarParametros']>(),
      guardarCalidad: vi.fn<AprendizajeRepository['guardarCalidad']>(),
      registrarEjecucion: vi.fn<AprendizajeRepository['registrarEjecucion']>(),
      ultimaEjecucion: vi.fn<AprendizajeRepository['ultimaEjecucion']>(() => Promise.resolve({ iniciadoEn: new Date('2026-10-05T20:00:00Z'), terminadoEn: new Date('2026-10-05T20:00:02Z'), resumen: { eventos: 80, jornadas: 6, parametros: 5, jornadasComparadas: 1, pinesSugeridos: 0, pinesProponidos: 0, llegadasDeducidas: 12, cierresFrecuentes: [], pinesDudosos: [{ localId: 'l-1', distanciaM: 1800, visitas: 2, fuente: 'geocodificador' }] } })),
    } satisfies AprendizajeRepository;
    const p = await crearVerAnalitica({ analitica, aprendizaje, camiones: fakeCamionesRuta(), clientes: fakeClientes(), clock: crearReloj().clock })('empresa-1');
    expect(p.cobertura).toEqual(COBERTURA);
    expect(p.pines).toEqual({ verificados: 0, porVerificar: 0, sinPin: 0 });
    expect(p.aprendido.ritmo[0]).toMatchObject({ ambito: 'camion:cam-1', camion: 'ABCD12', valor: 1.2 });
    expect(p.aprendido.servicioGeneral?.valor).toBe(9);
    expect(p.aprendido.localesLentos[0]).toMatchObject({ ambito: 'local:l-1', etiqueta: { razonSocial: 'Kiosko Ana' } });
    expect(p.aprendido.capacidad).toHaveLength(1);
    expect(p.calidad[0]).toMatchObject({ camion: 'ABCD12', inversiones: 3 });
    expect(p.pinesDudosos).toEqual([{ localId: 'l-1', distanciaM: 1800, visitas: 2, fuente: 'geocodificador', etiqueta: { razonSocial: 'Kiosko Ana', direccion: 'Calle 1', comuna: 'Buin' } }]);
    expect(p.ultimaEjecucion?.resumen.llegadasDeducidas).toBe(12);
  });
});
