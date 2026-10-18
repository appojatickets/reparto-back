import { describe, expect, it, vi } from 'vitest';
import { ok } from '../../domain/shared/result.js';
import { crearReloj, usuarioDe } from './fakes.test-util.js';
import { fakeJornadas, fakeRegistro, resolverDePrueba } from './fakes-facturas.test-util.js';
import { CAMION_ID, FECHA, fakeCamionesRuta, fakeEmpresas, fakeEntregasRuta, fakeFacturasRuta, fakeRutas, paradaDe } from './fakes-rutas.test-util.js';
import type { ProveedorTrazado } from '../ports/out/trazado.js';
import { crearServiciosDeRuta } from './rutas.js';
import { crearVerTrazado } from './trazado.js';
const montar = (n = 3) => {
  const rutas = fakeRutas(Array.from({ length: n }, (_, i) => paradaDe(String(i))));
  const servicios = crearServiciosDeRuta({ rutas: rutas.repo, empresas: fakeEmpresas(), camiones: fakeCamionesRuta(), facturas: fakeFacturasRuta(), entregas: fakeEntregasRuta(), jornadas: fakeJornadas(), registro: fakeRegistro(), clock: crearReloj('2026-10-05T10:00:00Z').clock, resolverCamion: resolverDePrueba() });
  const trazar = vi.fn<ProveedorTrazado['trazar']>((puntos) => Promise.resolve({ perfil: 'driving-car', tramos: puntos.slice(1).map((p, i) => ({ coordenadas: [[puntos[i]?.lng ?? 0, puntos[i]?.lat ?? 0], [p.lng, p.lat]], porCalles: true })) }));
  return { servicios, trazar };
};
const actor = usuarioDe({ rol: 'despachador' });
const entrada = { camionId: CAMION_ID, fecha: FECHA };
describe('mapa de la ruta autorizada', () => {
  it('conserva el orden elegido, incluido el depósito, sin optimizar otra vez', async () => {
    const { servicios, trazar } = montar();
    const plan = await servicios.planificar(actor, { ...entrada, orden: 'carga' });
    expect(plan.ok).toBe(true);
    const r = await crearVerTrazado({ ver: servicios.ver, proveedor: { trazar } })(actor, entrada);
    expect(r.ok).toBe(true);
    expect(trazar.mock.calls[0]?.[0]).toHaveLength(5);
    expect(r.ok && r.value.tramos).toHaveLength(4);
  });
  it('divide más de 50 puntos sin perder el tramo de unión', async () => {
    const { servicios, trazar } = montar(65);
    await servicios.planificar(actor, { ...entrada, orden: 'carga' });
    const r = await crearVerTrazado({ ver: servicios.ver, proveedor: { trazar } })(actor, entrada);
    expect(r.ok && r.value.tramos).toHaveLength(66);
    expect(trazar).toHaveBeenCalledTimes(2);
    expect(trazar.mock.calls[0]?.[0].at(-1)).toEqual(trazar.mock.calls[1]?.[0][0]);
  });
  it('no une puntos a través de una entrega con ubicación aproximada', async () => {
    const { servicios, trazar } = montar();
    await servicios.planificar(actor, { ...entrada, orden: 'carga' });
    const r = await servicios.ver(actor, entrada);
    if (!r.ok) throw new Error('ruta de prueba');
    const paradas = r.value.paradas.map((p, i) => i === 1 ? { ...p, ubicacionAproximada: true } : p);
    const ver = vi.fn<typeof servicios.ver>(() => Promise.resolve(ok({ ...r.value, paradas })));
    const mapa = await crearVerTrazado({ ver, proveedor: { trazar } })(actor, entrada);
    expect(mapa.ok && mapa.value.tramos.map((t) => t.porCalles)).toEqual([true, false, false, true]);
  });
});
