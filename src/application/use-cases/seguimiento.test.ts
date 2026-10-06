import { describe, expect, it } from 'vitest';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeRegistro, JORNADA, resolverDePrueba } from './fakes-facturas.test-util.js';
import { fakeEntregasRuta, fakeRutas, paradaDe } from './fakes-rutas.test-util.js';
import { crearRegistrarPosiciones } from './seguimiento.js';

const chofer = usuarioDe({ id: 'u-chofer', rol: 'chofer' });
const { clock } = crearReloj('2026-10-05T12:00:00Z');
const AHORA = new Date('2026-10-05T12:00:00Z').getTime();
const PIN = { lat: -33.5, lng: -70.7 };
const punto = (segAntes: number, extra: Record<string, unknown> = {}) => ({ lat: PIN.lat + 0.0002, lng: PIN.lng, tomadoEn: new Date(AHORA - segAntes * 1000), ...extra });

const montar = (opciones: { yaLlego?: string[]; sinJornada?: boolean } = {}) => {
  const registro = fakeRegistro();
  const rutas = fakeRutas([paradaDe('A', { lat: PIN.lat, lng: PIN.lng }), paradaDe('B', { lat: -33.6, lng: -70.6 }), paradaDe('C', { lat: PIN.lat, lng: PIN.lng, pinAproximado: true })]);
  const entregas = fakeEntregasRuta();
  entregas.conLlegada.mockResolvedValue(new Set(opciones.yaLlego ?? []));
  const caso = crearRegistrarPosiciones({ registro, rutas: rutas.repo, entregas, resolverCamion: resolverDePrueba(opciones.sinJornada ? undefined : JORNADA), clock });
  // «registro» devuelve lo que se guardó, como la base real.
  registro.registrarPosiciones.mockImplementation((_e, _c, _u, p) => {
    guardados.push(...p);
    return Promise.resolve();
  });
  registro.posicionesDesde.mockImplementation(() => Promise.resolve(guardados));
  const guardados: Parameters<typeof registro.registrarPosiciones>[3][number][] = [];
  return { caso, registro, entregas };
};

describe('seguimiento del camión', () => {
  it('guarda los puntos válidos, descarta los que están fuera de la región, son del futuro o muy viejos', async () => {
    const t = montar();
    const r = await t.caso(chofer, [punto(30), { lat: 40, lng: 2, tomadoEn: new Date(AHORA) }, punto(-3600), punto(7 * 3600)]);
    expect(r.ok && r.value).toMatchObject({ guardados: 1, descartados: 3 });
  });

  it('sin camión de hoy no recibe posiciones', async () => {
    const t = montar({ sinJornada: true });
    const r = await t.caso(chofer, [punto(10)]);
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
  });

  it('si el camión se quedó junto al pin de una entrega pendiente, el servidor anota la llegada solo', async () => {
    const t = montar();
    const r = await t.caso(chofer, [punto(120), punto(60), punto(10)]);
    expect(r.ok && r.value.llegadasAutomaticas).toEqual(['f-A']);
    expect(t.entregas.registrar).toHaveBeenCalledTimes(1);
    expect(t.entregas.registrar).toHaveBeenCalledWith('empresa-1', expect.objectContaining({ tipo: 'llegada', facturaId: 'f-A', camionId: 'cam-1', usuarioId: 'u-chofer', origen: 'auto' }));
  });

  it('no repite la llegada si una persona (o un aviso anterior) ya la anotó', async () => {
    const t = montar({ yaLlego: ['f-A'] });
    const r = await t.caso(chofer, [punto(120), punto(60), punto(10)]);
    expect(r.ok && r.value.llegadasAutomaticas).toEqual([]);
    expect(t.entregas.registrar).not.toHaveBeenCalled();
  });

  it('pasar de largo o un pin aproximado no son llegada', async () => {
    const t = montar();
    const r = await t.caso(chofer, [punto(10)]);
    expect(r.ok && r.value.llegadasAutomaticas).toEqual([]);
    expect(t.entregas.registrar).not.toHaveBeenCalled();
  });
});
