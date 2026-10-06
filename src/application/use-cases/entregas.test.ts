import { describe, expect, it, vi } from 'vitest';
import type { EntregaRepository } from '../ports/out/entregas.js';
import { usuarioDe } from './fakes.test-util.js';
import { facturaDe, fakeFacturas, JORNADA, resolverDePrueba } from './fakes-facturas.test-util.js';
import { fakeClientes } from './fakes-clientes.test-util.js';
import { fakeRutas } from './fakes-rutas.test-util.js';
import { crearRegistrarEvento } from './entregas.js';

const chofer = usuarioDe({ id: 'u-chofer', rol: 'chofer' });
const ayudante = usuarioDe({ id: 'u-ayud', rol: 'ayudante' });
const despachador = usuarioDe({ id: 'u-d', rol: 'despachador' });
const pos = { lat: -33.45, lng: -70.66, precisionM: 15 };

const montar = (factura = facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' }, local: { id: 'l-1', razonSocial: 'Rabelo', direccion: 'Av. Colón 765', comuna: 'San Bernardo', tienePin: false } }), jornada = JORNADA) => {
  const facturas = fakeFacturas();
  facturas.obtener.mockResolvedValue(factura);
  const entregas = { registrar: vi.fn<EntregaRepository['registrar']>(() => Promise.resolve()), ultimaPosicion: vi.fn<EntregaRepository['ultimaPosicion']>(() => Promise.resolve(undefined)), conLlegada: vi.fn<EntregaRepository['conLlegada']>(() => Promise.resolve(new Set<string>())) };
  const clientes = fakeClientes();
  const rutas = fakeRutas();
  const registrar = crearRegistrarEvento({ facturas, entregas, clientes, rutas: rutas.repo, resolverCamion: resolverDePrueba(jornada) });
  return { registrar, facturas, entregas, clientes, rutas };
};

describe('registrar evento de entrega', () => {
  it('llegar a un local sin pin guarda el aviso y fija el pin con la posición (colaborativo)', async () => {
    const t = montar();
    const r = await t.registrar(chofer, 'f-1', { tipo: 'llegada', ...pos });
    expect(r).toEqual({ ok: true, value: { estado: 'pendiente', pinFijado: true } });
    expect(t.entregas.registrar).toHaveBeenCalledWith('empresa-1', expect.objectContaining({ tipo: 'llegada', facturaId: 'f-1', localId: 'l-1', camionId: 'cam-1', usuarioId: 'u-chofer', lat: -33.45, lng: -70.66 }));
    expect(t.clientes.fijarPinSiFalta).toHaveBeenCalledWith('empresa-1', 'l-1', -33.45, -70.66);
  });

  it('el aviso guarda en qué lugar de la ruta iba la parada y cuántas había, y que lo avisó una persona', async () => {
    const t = montar();
    t.rutas.repo.obtener.mockResolvedValue({ id: 'r-1', camionId: 'cam-1', fecha: '2026-10-05', salidaMin: 480, modo: 'sugerida', version: 3, orden: ['f-9', 'f-8', 'f-1', 'f-7'], fijas: [] });
    await t.registrar(chofer, 'f-1', { tipo: 'llegada', ...pos });
    expect(t.entregas.registrar).toHaveBeenCalledWith('empresa-1', expect.objectContaining({ origen: 'manual', posicionEnRuta: 3, paradasEnRuta: 4 }));
  });

  it('si el local ya tiene pin, la posición queda solo como evidencia', async () => {
    const t = montar(facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' } }));
    const r = await t.registrar(chofer, 'f-1', { tipo: 'llegada', ...pos });
    expect(r.ok && r.value.pinFijado).toBe(false);
    expect(t.clientes.fijarPinSiFalta).not.toHaveBeenCalled();
    expect(t.entregas.registrar).toHaveBeenCalledTimes(1);
  });

  it('una posición imprecisa no fija el pin, pero el aviso se guarda', async () => {
    const t = montar();
    const r = await t.registrar(chofer, 'f-1', { tipo: 'llegada', lat: -33.45, lng: -70.66, precisionM: 400 });
    expect(r.ok && r.value.pinFijado).toBe(false);
    expect(t.entregas.registrar).toHaveBeenCalledTimes(1);
  });

  it('entregado deja la factura entregada (en el mismo registro) y no se puede marcar dos veces', async () => {
    const t = montar();
    const r = await t.registrar(chofer, 'f-1', { tipo: 'entregado', ...pos });
    expect(r.ok && r.value.estado).toBe('entregada');
    expect(t.entregas.registrar).toHaveBeenCalledWith('empresa-1', expect.objectContaining({ nuevoEstado: 'entregada' }));
    const ya = montar(facturaDe({ estado: 'entregada', camion: { id: 'cam-1', patente: 'ABCD12' } }));
    const otra = await ya.registrar(chofer, 'f-1', { tipo: 'entregado' });
    expect(!otra.ok && otra.error).toMatchObject({ codigo: 'CONFLICTO', mensaje: 'Esa entrega ya está marcada como entregada.' });
    expect(ya.entregas.registrar).not.toHaveBeenCalled();
  });

  it('no entregado exige motivo y cambia el estado; cerrado, espera y vuelvo más tarde no cambian la factura', async () => {
    const t = montar();
    const falta = await t.registrar(chofer, 'f-1', { tipo: 'no_entregado' });
    expect(!falta.ok && falta.error.codigo).toBe('VALIDACION');
    const ok = await t.registrar(chofer, 'f-1', { tipo: 'no_entregado', motivo: 'cerrado' });
    expect(ok.ok && ok.value.estado).toBe('no_entregada');
    for (const e of [{ tipo: 'cerrado' }, { tipo: 'espera', minutos: 15 }, { tipo: 'vuelve_mas_tarde' }]) {
      const r = await montar().registrar(chofer, 'f-1', e);
      expect(r.ok && r.value.estado).toBe('pendiente');
    }
  });

  it('el ayudante avisa igual que el chofer, sobre el camión de su jornada', async () => {
    const t = montar(undefined, { ...JORNADA, usuarioId: 'u-ayud' });
    expect((await t.registrar(ayudante, 'f-1', { tipo: 'llegada', ...pos })).ok).toBe(true);
  });

  it('un chofer no avisa sobre entregas de otro camión ni sin camión elegido', async () => {
    const ajena = montar(facturaDe({ camion: { id: 'cam-2', patente: 'WXYZ99' } }));
    const r = await ajena.registrar(chofer, 'f-1', { tipo: 'entregado' });
    expect(!r.ok && r.error).toMatchObject({ codigo: 'SIN_PERMISO', mensaje: 'Esa entrega no es de tu camión de hoy.' });
    const sinCamion = montar(facturaDe());
    expect((await sinCamion.registrar(chofer, 'f-1', { tipo: 'entregado' })).ok).toBe(false);
    const sinJornada = crearRegistrarEvento({ facturas: ajena.facturas, entregas: ajena.entregas, clientes: ajena.clientes, rutas: fakeRutas().repo, resolverCamion: resolverDePrueba() });
    const s = await sinJornada(chofer, 'f-1', { tipo: 'llegada' });
    expect(!s.ok && s.error).toMatchObject({ detalle: { codigo: 'SIN_JORNADA' } });
    expect(ajena.entregas.registrar).not.toHaveBeenCalled();
  });

  it('el despachador puede avisar por cualquier camión', async () => {
    const t = montar(facturaDe({ camion: { id: 'cam-9', patente: 'WXYZ99' } }));
    expect((await t.registrar(despachador, 'f-1', { tipo: 'entregado' })).ok).toBe(true);
  });

  it('una entrega inexistente o quitada responde claro; una posición inválida es VALIDACION', async () => {
    const t = montar(facturaDe({ estado: 'anulada', camion: { id: 'cam-1', patente: 'ABCD12' } }));
    const quitada = await t.registrar(chofer, 'f-1', { tipo: 'llegada' });
    expect(!quitada.ok && quitada.error.codigo).toBe('CONFLICTO');
    t.facturas.obtener.mockResolvedValue(undefined);
    const nada = await t.registrar(chofer, 'f-1', { tipo: 'llegada' });
    expect(!nada.ok && nada.error.codigo).toBe('NO_ENCONTRADO');
    const mal = await montar().registrar(chofer, 'f-1', { tipo: 'llegada', lat: 10, lng: 10 });
    expect(!mal.ok && mal.error.codigo).toBe('VALIDACION');
  });
});
