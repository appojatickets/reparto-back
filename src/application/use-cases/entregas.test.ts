import type { Usuario } from '../../domain/entidades/usuario.js';
import type { LocalDetalle } from '../ports/out/clientes.js';
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

const localConPin = (extra: Partial<LocalDetalle> = {}): LocalDetalle => ({ id: 'l-1', clienteId: 'c-1', razonSocial: 'Rabelo', direccion: 'Av. Colón 765', comuna: 'San Bernardo', lat: -33.45, lng: -70.66, pinEstado: 'sugerido', pinFuente: 'chofer', pinVerificado: false, ...extra });
const montar = (factura = facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' }, local: { id: 'l-1', razonSocial: 'Rabelo', direccion: 'Av. Colón 765', comuna: 'San Bernardo', tienePin: false } }), jornada = JORNADA, locales: LocalDetalle[] = [localConPin()]) => {
  const facturas = fakeFacturas();
  facturas.obtener.mockResolvedValue(factura);
  const entregas = { registrar: vi.fn<EntregaRepository['registrar']>(() => Promise.resolve()), visitasConGps: vi.fn<EntregaRepository['visitasConGps']>(() => Promise.resolve([])), visitasConGpsDeLocales: vi.fn<EntregaRepository['visitasConGpsDeLocales']>(() => Promise.resolve(new Map())), ultimaPosicion: vi.fn<EntregaRepository['ultimaPosicion']>(() => Promise.resolve(undefined)), conLlegada: vi.fn<EntregaRepository['conLlegada']>(() => Promise.resolve(new Set<string>())), posicionesDeEntrega: vi.fn<EntregaRepository['posicionesDeEntrega']>(() => Promise.resolve([])) };
  const clientes = fakeClientes(locales);
  const rutas = fakeRutas();
  const reordenarTrasVisita = vi.fn<(actor: Usuario, camionId: string, fecha: string, facturaId: string) => Promise<boolean>>(() => Promise.resolve(true));
  const registrar = crearRegistrarEvento({ facturas, entregas, clientes, rutas: rutas.repo, resolverCamion: resolverDePrueba(jornada), reloj: { now: () => new Date('2026-10-08T15:00:00Z') }, reordenarTrasVisita });
  return { registrar, facturas, entregas, clientes, rutas, reordenarTrasVisita };
};

describe('registrar evento de entrega', () => {
  it('al entregar o no entregar, la ruta de ese camión se reordena sola si la parada no era la siguiente (llegar no la toca)', async () => {
    const t = montar();
    await t.registrar(chofer, 'f-1', { tipo: 'llegada', ...pos });
    expect(t.reordenarTrasVisita).not.toHaveBeenCalled();
    await t.registrar(chofer, 'f-1', { tipo: 'entregado', ...pos });
    expect(t.reordenarTrasVisita).toHaveBeenCalledWith(chofer, 'cam-1', expect.any(String), 'f-1');
  });

  it('si reordenar la ruta falla, el aviso igual queda hecho', async () => {
    const t = montar();
    t.reordenarTrasVisita.mockRejectedValueOnce(new Error('caída'));
    const r = await t.registrar(chofer, 'f-1', { tipo: 'entregado', ...pos });
    expect(r.ok && r.value.estado).toBe('entregada');
  });

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

  it('ENTREGADO con buen GPS deja el pin donde se entregó, por sobre el que había (mientras no esté verificado)', async () => {
    const t = montar(facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' } })); // el local ya tiene pin
    t.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 40 }]);
    const r = await t.registrar(chofer, 'f-1', { tipo: 'entregado', ...pos, precisionM: 40 });
    expect(r.ok && r.value).toEqual({ estado: 'entregada', pinFijado: true });
    expect(t.entregas.posicionesDeEntrega).toHaveBeenCalledWith('empresa-1', 'l-1', 5);
    expect(t.clientes.ajustarPinPorEntrega).toHaveBeenCalledWith('empresa-1', 'l-1', { lat: -33.45, lng: -70.66 });
    expect(t.clientes.fijarPinSiFalta).not.toHaveBeenCalled();
  });

  it('con varias entregas el pin queda donde coinciden las demás: una avisada desde otro lado no lo arrastra', async () => {
    const t = montar(facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' } }));
    t.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.5, lng: -70.7, precisionM: 10 }, { lat: -33.4999, lng: -70.7, precisionM: 12 }, { lat: -33.45, lng: -70.66, precisionM: 9 }]);
    await t.registrar(chofer, 'f-1', { tipo: 'entregado', lat: -33.5, lng: -70.7, precisionM: 10 });
    const llamada = t.clientes.ajustarPinPorEntrega.mock.calls[0]?.[2];
    expect(llamada?.lat).toBeCloseTo(-33.49995, 5);
  });

  it('si el pin está verificado el repositorio no lo mueve (pinFijado queda en false) y la entrega igual se registra', async () => {
    const t = montar(facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' } }));
    t.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 15 }]);
    t.clientes.ajustarPinPorEntrega.mockResolvedValueOnce(false);
    const r = await t.registrar(chofer, 'f-1', { tipo: 'entregado', ...pos });
    expect(r.ok && r.value.pinFijado).toBe(false);
    expect(t.entregas.registrar).toHaveBeenCalledTimes(1);
  });

  it('ENTREGADO con GPS de más de 50 m no mueve un pin que ya existe; si el local no tiene pin, vale hasta 100 m', async () => {
    const conPin = montar(facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' } }));
    await conPin.registrar(chofer, 'f-1', { tipo: 'entregado', lat: -33.45, lng: -70.66, precisionM: 80 });
    expect(conPin.clientes.ajustarPinPorEntrega).not.toHaveBeenCalled();
    const sinPin = montar();
    const r = await sinPin.registrar(chofer, 'f-1', { tipo: 'entregado', lat: -33.45, lng: -70.66, precisionM: 80 });
    expect(r.ok && r.value.pinFijado).toBe(true);
    expect(sinPin.clientes.fijarPinSiFalta).toHaveBeenCalledWith('empresa-1', 'l-1', -33.45, -70.66);
  });

  it('ENTREGADO SIN PIN: la entrega queda hecha y la ruta se reordena, pero no se guarda la posición ni se toca el pin', async () => {
    const t = montar(facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' } })); // el local ya tiene pin sin verificar
    t.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 10 }]);
    const r = await t.registrar(chofer, 'f-1', { tipo: 'entregado', sinPin: true, ...pos });
    expect(r).toEqual({ ok: true, value: { estado: 'entregada', pinFijado: false } });
    const guardado = t.entregas.registrar.mock.calls[0]?.[1];
    expect(guardado).toMatchObject({ tipo: 'entregado', facturaId: 'f-1', nuevoEstado: 'entregada' });
    expect(guardado).not.toHaveProperty('lat');
    expect(guardado).not.toHaveProperty('sinPin');
    expect(t.clientes.ajustarPinPorEntrega).not.toHaveBeenCalled();
    expect(t.clientes.verificarPinPorEntregas).not.toHaveBeenCalled();
    expect(t.clientes.fijarPinSiFalta).not.toHaveBeenCalled();
    expect(t.reordenarTrasVisita).toHaveBeenCalledWith(chofer, 'cam-1', expect.any(String), 'f-1');
  });

  it('ENTREGADO SIN PIN en un local sin pin no lo crea con la posición del chofer', async () => {
    const t = montar();
    const r = await t.registrar(chofer, 'f-1', { tipo: 'entregado', sinPin: true, ...pos });
    expect(r.ok && r.value.pinFijado).toBe(false);
    expect(t.clientes.fijarPinSiFalta).not.toHaveBeenCalled();
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

describe('el pin se verifica solo cuando las entregas lo confirman (ADR 0032)', () => {
  const facturaDeCamion = () => facturaDe({ camion: { id: 'cam-1', patente: 'ABCD12' } });
  const entrega = { tipo: 'entregado' as const, lat: -33.45, lng: -70.66, precisionM: 15 };

  it('pin del buscador (o de un enlace, planilla o persona) + entrega con buen GPS a ≤60 m: queda verificado tal cual, sin moverlo', async () => {
    const t = montar(facturaDeCamion(), JORNADA, [localConPin({ pinFuente: 'geocodificador', lat: -33.4502, lng: -70.6602 })]);
    const r = await t.registrar(chofer, 'f-1', entrega);
    expect(t.clientes.verificarPinPorEntregas).toHaveBeenCalledWith('empresa-1', 'l-1', new Date('2026-10-08T15:00:00Z'));
    expect(t.clientes.ajustarPinPorEntrega).not.toHaveBeenCalled();
    expect(r.ok && r.value.pinFijado).toBe(false);
  });

  it('pin del buscador y entrega a más de 60 m: el pin se ajusta a donde se entregó; con GPS firme (≤25 m) queda verificado ahí, con GPS de 26 a 50 m no', async () => {
    const lejos = () => montar(facturaDeCamion(), JORNADA, [localConPin({ pinFuente: 'geocodificador', lat: -33.4510, lng: -70.6610 })]);
    const firme = lejos();
    firme.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 15 }]);
    await firme.registrar(chofer, 'f-1', entrega);
    expect(firme.clientes.ajustarPinPorEntrega).toHaveBeenCalled();
    expect(firme.clientes.verificarPinPorEntregas).toHaveBeenCalledTimes(1);
    const flojo = lejos();
    flojo.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 40 }]);
    await flojo.registrar(chofer, 'f-1', { ...entrega, precisionM: 40 });
    expect(flojo.clientes.ajustarPinPorEntrega).toHaveBeenCalled();
    expect(flojo.clientes.verificarPinPorEntregas).not.toHaveBeenCalled();
  });

  it('pin que nació de una entrega: con GPS firme (≤25 m) una sola entrega lo verifica; con 26 a 50 m hace falta otra', async () => {
    const firme = montar(facturaDeCamion());
    firme.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 15 }]);
    await firme.registrar(chofer, 'f-1', entrega);
    expect(firme.clientes.verificarPinPorEntregas).toHaveBeenCalledTimes(1);
    const flojo = montar(facturaDeCamion());
    flojo.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 40 }]);
    flojo.entregas.visitasConGps.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 40, en: new Date('2026-10-08T15:00:00Z') }]);
    await flojo.registrar(chofer, 'f-1', { ...entrega, precisionM: 40 });
    expect(flojo.clientes.verificarPinPorEntregas).not.toHaveBeenCalled();
  });

  it('pin que nació de una entrega con GPS de 26 a 50 m: la segunda entrega junto al pin, de cualquier día, lo verifica', async () => {
    const t = montar(facturaDeCamion());
    t.entregas.posicionesDeEntrega.mockResolvedValue([{ lat: -33.45, lng: -70.66, precisionM: 40 }]);
    t.clientes.ajustarPinPorEntrega.mockResolvedValue(false);
    t.entregas.visitasConGps.mockResolvedValue([
      { lat: -33.4501, lng: -70.6601, precisionM: 40, en: new Date('2026-10-08T15:00:00Z') },
      { lat: -33.45, lng: -70.66, precisionM: 35, en: new Date('2026-10-07T15:00:00Z') },
    ]);
    await t.registrar(chofer, 'f-1', { ...entrega, precisionM: 40 });
    expect(t.clientes.verificarPinPorEntregas).toHaveBeenCalled();
  });

  it('un pin ya verificado (por una persona o por las entregas) no se mueve ni se vuelve a verificar', async () => {
    const t = montar(facturaDeCamion(), JORNADA, [localConPin({ pinFuente: 'geocodificador', pinVerificado: true, pinVerificacion: 'entregas' })]);
    await t.registrar(chofer, 'f-1', { ...entrega, lat: -33.5, lng: -70.7 });
    expect(t.clientes.verificarPinPorEntregas).not.toHaveBeenCalled();
    expect(t.clientes.ajustarPinPorEntrega).not.toHaveBeenCalled();
  });

  it('con GPS impreciso (más de 50 m) no verifica nada, y si falla la verificación el aviso igual queda hecho', async () => {
    const t = montar(facturaDeCamion(), JORNADA, [localConPin({ pinFuente: 'importado' })]);
    await t.registrar(chofer, 'f-1', { ...entrega, precisionM: 80 });
    expect(t.clientes.verificarPinPorEntregas).not.toHaveBeenCalled();
    const u = montar(facturaDeCamion(), JORNADA, [localConPin({ pinFuente: 'importado' })]);
    u.clientes.verificarPinPorEntregas.mockRejectedValueOnce(new Error('caída'));
    const r = await u.registrar(chofer, 'f-1', entrega);
    expect(r.ok && r.value.estado).toBe('entregada');
  });
});
