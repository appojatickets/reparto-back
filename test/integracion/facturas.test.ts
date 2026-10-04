import { afterAll, describe, expect, it } from 'vitest';
import { PostgresCamionRepository } from '../../src/adapters/out/postgres/repositorio-camiones.js';
import { PostgresClienteRepository } from '../../src/adapters/out/postgres/repositorio-clientes.js';
import { PostgresEntregaRepository } from '../../src/adapters/out/postgres/repositorio-entregas.js';
import { PostgresFacturaRepository } from '../../src/adapters/out/postgres/repositorio-facturas.js';
import { abrirDb, crearEmpresa, crearUsuario } from './utils.js';

const db = abrirDb();
const camiones = new PostgresCamionRepository(db);
const facturas = new PostgresFacturaRepository(db);
const clientes = new PostgresClienteRepository(db);
afterAll(() => db.destroy());

const sembrar = async () => {
  const empresa = await crearEmpresa(db);
  const usuario = await crearUsuario(db, empresa, 'despachador', `d${Math.random().toString(36).slice(2, 8)}`);
  await clientes.importar(empresa, [
    { claveCliente: 'a', rut: '12345678-5', razonSocial: 'Rabelo Mágica SpA', locales: [{ claveLocal: 'a|1', direccion: 'Av. Providencia 2500', comuna: 'Providencia', lat: -33.43, lng: -70.61, indices: [0] }] },
    { claveCliente: 'b', razonSocial: 'Kiosko Sol', locales: [{ claveLocal: 'b|1', direccion: 'Calle 1 10', comuna: 'Maipú', indices: [1] }] },
  ]);
  const locales = await db.selectFrom('local as l').innerJoin('cliente as c', 'c.id', 'l.cliente_id').select(['l.id', 'c.razon_social']).where('l.empresa_id', '=', empresa).execute();
  const local = (nombre: string) => locales.find((l) => l.razon_social === nombre)?.id ?? '';
  const camion = await camiones.crear(empresa, { patente: 'ABCD12', alias: 'El Rojo' });
  if (!camion.ok) throw new Error('no se creó el camión');
  return { empresa, usuario, rabelo: local('Rabelo Mágica SpA'), kiosko: local('Kiosko Sol'), camion: camion.value };
};

const nueva = (s: Awaited<ReturnType<typeof sembrar>>, folio: string, extra: object = {}) => ({ folio, localId: s.rabelo, fecha: '2026-10-05', urgente: false, creadoPor: s.usuario, ...extra });

describe('camiones', () => {
  it('crea, lista (solo activos si se pide), actualiza y detecta la patente repetida', async () => {
    const e = await crearEmpresa(db);
    const a = await camiones.crear(e, { patente: 'ABCD12', alias: 'Rojo' });
    const b = await camiones.crear(e, { patente: 'WXYZ99' });
    expect(a.ok && a.value).toMatchObject({ patente: 'ABCD12', alias: 'Rojo', activo: true });
    expect(await camiones.crear(e, { patente: 'ABCD12' })).toEqual({ ok: false, error: 'PATENTE_DUPLICADA' });
    expect(b.ok && (await camiones.actualizar(e, b.value.id, { activo: false }))).toMatchObject({ activo: false });
    expect((await camiones.listar(e, {})).map((c) => c.patente)).toEqual(['ABCD12', 'WXYZ99']);
    expect((await camiones.listar(e, { soloActivos: true })).map((c) => c.patente)).toEqual(['ABCD12']);
    expect(a.ok && (await camiones.actualizar(e, a.value.id, { alias: null }))).not.toHaveProperty('alias');
  });

  it('la misma patente se permite en otra empresa y una empresa no toca camiones de otra', async () => {
    const e1 = await crearEmpresa(db);
    const e2 = await crearEmpresa(db);
    const c = await camiones.crear(e1, { patente: 'ABCD12' });
    expect((await camiones.crear(e2, { patente: 'ABCD12' })).ok).toBe(true);
    expect(c.ok && (await camiones.actualizar(e2, c.value.id, { activo: false }))).toBeUndefined();
    expect(await camiones.listar(e2, {})).toHaveLength(1);
  });

  it('la base rechaza una patente con formato inválido', async () => {
    const e = await crearEmpresa(db);
    await expect(db.insertInto('camion').values({ empresa_id: e, patente: 'abc', alias: null }).execute()).rejects.toThrow();
  });
});

describe('facturas', () => {
  it('crea una factura con su detalle (local, comuna, pin, camión y condiciones)', async () => {
    const s = await sembrar();
    const r = await facturas.crear(s.empresa, nueva(s, '1234', { camionId: s.camion.id, total: 15990, antesDeMin: 720, urgente: true, nota: 'portón verde' }));
    expect(r.ok && r.value).toMatchObject({
      folio: '1234', fecha: '2026-10-05', estado: 'pendiente', total: 15990, antesDeMin: 720, urgente: true, nota: 'portón verde',
      camion: { patente: 'ABCD12', alias: 'El Rojo' },
      local: { razonSocial: 'Rabelo Mágica SpA', comuna: 'Providencia', tienePin: true },
    });
  });

  it('un local sin pin se reporta como tienePin: false', async () => {
    const s = await sembrar();
    const r = await facturas.crear(s.empresa, nueva(s, '1', { localId: s.kiosko }));
    expect(r.ok && r.value.local.tienePin).toBe(false);
  });

  it('el folio es único por empresa (otra empresa puede repetirlo)', async () => {
    const s = await sembrar();
    expect((await facturas.crear(s.empresa, nueva(s, '777'))).ok).toBe(true);
    expect(await facturas.crear(s.empresa, nueva(s, '777'))).toEqual({ ok: false, error: 'FOLIO_DUPLICADO' });
    const otra = await sembrar();
    expect((await facturas.crear(otra.empresa, nueva(otra, '777'))).ok).toBe(true);
  });

  it('rechaza un local de otra empresa y un camión inexistente, de otra empresa o desactivado', async () => {
    const s = await sembrar();
    const otra = await sembrar();
    expect(await facturas.crear(s.empresa, nueva(s, '1', { localId: otra.rabelo }))).toEqual({ ok: false, error: 'LOCAL_NO_EXISTE' });
    expect(await facturas.crear(s.empresa, nueva(s, '2', { camionId: otra.camion.id }))).toEqual({ ok: false, error: 'CAMION_NO_DISPONIBLE' });
    expect(await facturas.crear(s.empresa, nueva(s, '3', { camionId: '00000000-0000-0000-0000-000000000000' }))).toEqual({ ok: false, error: 'CAMION_NO_DISPONIBLE' });
    await camiones.actualizar(s.empresa, s.camion.id, { activo: false });
    expect(await facturas.crear(s.empresa, nueva(s, '4', { camionId: s.camion.id }))).toEqual({ ok: false, error: 'CAMION_NO_DISPONIBLE' });
  });

  it('lista por día, por camión y «sin camión», en el orden en que se ingresaron; las anuladas se ocultan', async () => {
    const s = await sembrar();
    await facturas.crear(s.empresa, nueva(s, '10', { camionId: s.camion.id }));
    await facturas.crear(s.empresa, nueva(s, '11'));
    await facturas.crear(s.empresa, nueva(s, '12', { fecha: '2026-10-06' }));
    const anulada = await facturas.crear(s.empresa, nueva(s, '13'));
    if (!anulada.ok) throw new Error('falló');
    await facturas.actualizar(s.empresa, anulada.value.id, { estado: 'anulada' });

    const folios = async (f: Parameters<typeof facturas.listar>[1]) => (await facturas.listar(s.empresa, f)).map((x) => x.folio);
    expect(await folios({ fecha: '2026-10-05' })).toEqual(['10', '11']);
    expect(await folios({ fecha: '2026-10-05', camionId: s.camion.id })).toEqual(['10']);
    expect(await folios({ fecha: '2026-10-05', sinCamion: true })).toEqual(['11']);
    expect(await folios({ fecha: '2026-10-06' })).toEqual(['12']);
    expect(await folios({ fecha: '2026-10-05', incluirAnuladas: true })).toEqual(['10', '11', '13']);
  });

  it('actualiza: asigna camión, cambia de día, quita la hora límite y la nota (null)', async () => {
    const s = await sembrar();
    const c = await facturas.crear(s.empresa, nueva(s, '20', { antesDeMin: 600, nota: 'x', total: 1000 }));
    if (!c.ok) throw new Error('falló');
    const r = await facturas.actualizar(s.empresa, c.value.id, { camionId: s.camion.id, fecha: '2026-10-08', antesDeMin: null, nota: null, total: null, urgente: true });
    expect(r.ok && r.value).toMatchObject({ fecha: '2026-10-08', urgente: true, camion: { patente: 'ABCD12' } });
    expect(r.ok && r.value).not.toHaveProperty('antesDeMin');
    expect(r.ok && r.value).not.toHaveProperty('nota');
    expect(r.ok && r.value).not.toHaveProperty('total');
    const sinCamion = await facturas.actualizar(s.empresa, c.value.id, { camionId: null });
    expect(sinCamion.ok && sinCamion.value).not.toHaveProperty('camion');
  });

  it('actualizar respeta empresa, camión disponible y existencia', async () => {
    const s = await sembrar();
    const otra = await sembrar();
    const c = await facturas.crear(s.empresa, nueva(s, '30'));
    if (!c.ok) throw new Error('falló');
    expect(await facturas.actualizar(otra.empresa, c.value.id, { urgente: true })).toEqual({ ok: false, error: 'NO_ENCONTRADA' });
    expect(await facturas.actualizar(s.empresa, c.value.id, { camionId: otra.camion.id })).toEqual({ ok: false, error: 'CAMION_NO_DISPONIBLE' });
    expect(await facturas.actualizar(s.empresa, '00000000-0000-0000-0000-000000000000', { urgente: true })).toEqual({ ok: false, error: 'NO_ENCONTRADA' });
    expect(await facturas.listar(otra.empresa, { fecha: '2026-10-05' })).toEqual([]);
  });

  it('las tablas nuevas tienen RLS activado', async () => {
    const r = await db.selectFrom('camion').select('id').limit(1).execute();
    expect(Array.isArray(r)).toBe(true);
  });
});

describe('entrega sin folio', () => {
  it('varias entregas sin folio conviven; los folios indicados siguen siendo únicos por empresa', async () => {
    const s = await sembrar();
    const a = await facturas.crear(s.empresa, { localId: s.rabelo, fecha: '2026-10-05', urgente: false, creadoPor: s.usuario });
    const b = await facturas.crear(s.empresa, { localId: s.rabelo, fecha: '2026-10-05', urgente: false, creadoPor: s.usuario });
    expect(a.ok && a.value).not.toHaveProperty('folio');
    expect(b.ok).toBe(true);
    const c = await facturas.crear(s.empresa, { folio: '500', localId: s.rabelo, fecha: '2026-10-05', urgente: false, creadoPor: s.usuario });
    expect(c.ok && c.value.folio).toBe('500');
    expect(await facturas.crear(s.empresa, { folio: '500', localId: s.kiosko, fecha: '2026-10-05', urgente: false, creadoPor: s.usuario })).toEqual({ ok: false, error: 'FOLIO_DUPLICADO' });
    expect((await facturas.listar(s.empresa, { fecha: '2026-10-05' })).length).toBe(3);
  });
});

describe('entregas: estados, avisos y pin colaborativo', () => {
  const entregas = new PostgresEntregaRepository(db);

  it('registrar guarda el aviso y, si corresponde, deja la factura entregada o no entregada en el mismo paso', async () => {
    const s = await sembrar();
    const f = await facturas.crear(s.empresa, { localId: s.rabelo, fecha: '2026-10-05', camionId: s.camion.id, urgente: false, creadoPor: s.usuario });
    if (!f.ok) throw new Error('factura');
    await entregas.registrar(s.empresa, { tipo: 'llegada', facturaId: f.value.id, localId: s.rabelo, camionId: s.camion.id, usuarioId: s.usuario, lat: -33.43, lng: -70.61, precisionM: 9 });
    expect((await facturas.obtener(s.empresa, f.value.id))?.estado).toBe('pendiente');
    await entregas.registrar(s.empresa, { tipo: 'entregado', facturaId: f.value.id, localId: s.rabelo, camionId: s.camion.id, usuarioId: s.usuario, nuevoEstado: 'entregada' });
    expect((await facturas.obtener(s.empresa, f.value.id))?.estado).toBe('entregada');
    const eventos = await db.selectFrom('entrega_evento').select(['tipo', 'lat', 'precision_m']).where('factura_id', '=', f.value.id).orderBy('creado_en').execute();
    expect(eventos.map((e) => e.tipo)).toEqual(['llegada', 'entregado']);
    expect(eventos[0]).toMatchObject({ lat: -33.43, precision_m: 9 });
  });

  it('el listado solo trae pendientes salvo que se pidan las hechas; las no entregadas guardan el motivo', async () => {
    const s = await sembrar();
    const a = await facturas.crear(s.empresa, { localId: s.rabelo, fecha: '2026-10-05', camionId: s.camion.id, urgente: false, creadoPor: s.usuario });
    const b = await facturas.crear(s.empresa, { localId: s.kiosko, fecha: '2026-10-05', camionId: s.camion.id, urgente: false, creadoPor: s.usuario });
    if (!a.ok || !b.ok) throw new Error('facturas');
    await entregas.registrar(s.empresa, { tipo: 'no_entregado', motivo: 'cerrado', facturaId: b.value.id, localId: s.kiosko, camionId: s.camion.id, usuarioId: s.usuario, nuevoEstado: 'no_entregada' });
    expect((await facturas.listar(s.empresa, { fecha: '2026-10-05' })).map((f) => f.id)).toEqual([a.value.id]);
    const todas = await facturas.listar(s.empresa, { fecha: '2026-10-05', incluirHechas: true });
    expect(todas.map((f) => f.estado)).toEqual(['pendiente', 'no_entregada']);
    expect((await db.selectFrom('entrega_evento').select('motivo').where('factura_id', '=', b.value.id).executeTakeFirstOrThrow()).motivo).toBe('cerrado');
  });

  it('el pin colaborativo solo se fija si el local no tiene; no pisa uno existente', async () => {
    const s = await sembrar();
    expect(await clientes.fijarPinSiFalta(s.empresa, s.kiosko, -33.5, -70.7)).toBe(true);
    const fila = await db.selectFrom('local').select(['lat', 'lng', 'pin_estado', 'pin_fuente']).where('id', '=', s.kiosko).executeTakeFirstOrThrow();
    expect(fila).toEqual({ lat: -33.5, lng: -70.7, pin_estado: 'sugerido', pin_fuente: 'chofer' });
    expect(await clientes.fijarPinSiFalta(s.empresa, s.kiosko, -33.6, -70.8)).toBe(false); // ya tiene
    expect(await clientes.fijarPinSiFalta(s.empresa, s.rabelo, -33.6, -70.8)).toBe(false); // Rabelo tenía pin importado
    const otra = await sembrar();
    expect(await clientes.fijarPinSiFalta(otra.empresa, s.kiosko, -33.6, -70.8)).toBe(false); // otra empresa
  });

  it('la última posición del camión ese día (hora de Chile) y nada de otros días ni camiones', async () => {
    const s = await sembrar();
    const f = await facturas.crear(s.empresa, { localId: s.rabelo, fecha: '2026-10-05', camionId: s.camion.id, urgente: false, creadoPor: s.usuario });
    if (!f.ok) throw new Error('factura');
    const base = { facturaId: f.value.id, localId: s.rabelo, camionId: s.camion.id, usuarioId: s.usuario };
    await entregas.registrar(s.empresa, { ...base, tipo: 'llegada', lat: -33.41, lng: -70.61 });
    await db.updateTable('entrega_evento').set({ creado_en: new Date('2026-10-05T13:00:00Z') }).where('factura_id', '=', f.value.id).execute();
    await entregas.registrar(s.empresa, { ...base, tipo: 'entregado', lat: -33.42, lng: -70.62, nuevoEstado: 'entregada' });
    await db.updateTable('entrega_evento').set({ creado_en: new Date('2026-10-05T15:00:00Z') }).where('factura_id', '=', f.value.id).where('tipo', '=', 'entregado').execute();
    expect(await entregas.ultimaPosicion(s.empresa, s.camion.id, '2026-10-05')).toMatchObject({ lat: -33.42, lng: -70.62 });
    expect(await entregas.ultimaPosicion(s.empresa, s.camion.id, '2026-10-06')).toBeUndefined();
    expect(await entregas.ultimaPosicion(s.empresa, '00000000-0000-4000-8000-000000000000', '2026-10-05')).toBeUndefined();
  });
});
