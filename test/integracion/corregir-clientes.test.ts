import { afterAll, describe, expect, it } from 'vitest';
import { PostgresCamionRepository } from '../../src/adapters/out/postgres/repositorio-camiones.js';
import { PostgresClienteRepository } from '../../src/adapters/out/postgres/repositorio-clientes.js';
import { PostgresEntregaRepository } from '../../src/adapters/out/postgres/repositorio-entregas.js';
import { PostgresFacturaRepository } from '../../src/adapters/out/postgres/repositorio-facturas.js';
import { PostgresRutaRepository } from '../../src/adapters/out/postgres/repositorio-rutas.js';
import { abrirDb, crearEmpresa, crearUsuario } from './utils.js';

const db = abrirDb();
const clientes = new PostgresClienteRepository(db);
const facturas = new PostgresFacturaRepository(db);
const entregas = new PostgresEntregaRepository(db);
const camiones = new PostgresCamionRepository(db);
const rutas = new PostgresRutaRepository(db);
afterAll(() => db.destroy());

/** Dos clientes: «Kiosko Sol» con dos direcciones y «Bazar Luna» con una. */
const sembrar = async () => {
  const empresa = await crearEmpresa(db);
  const usuario = await crearUsuario(db, empresa, 'chofer', `c${Math.random().toString(36).slice(2, 8)}`);
  await clientes.importar(empresa, [
    { claveCliente: 'k', razonSocial: 'Kiosko Sol', locales: [{ claveLocal: 'k|1', direccion: 'Calle 1 10', comuna: 'Maipú', indices: [0] }, { claveLocal: 'k|2', direccion: 'Calle 2 20', comuna: 'Maipú', indices: [1] }] },
    { claveCliente: 'b', razonSocial: 'Bazar Luna', locales: [{ claveLocal: 'b|1', direccion: 'Calle 3 30', comuna: 'Ñuñoa', indices: [2] }] },
  ]);
  const filas = await db.selectFrom('local as l').innerJoin('cliente as c', 'c.id', 'l.cliente_id').select(['l.id', 'l.cliente_id', 'l.direccion']).where('l.empresa_id', '=', empresa).execute();
  const de = (direccion: string) => filas.find((f) => f.direccion === direccion) ?? { id: '', cliente_id: '' };
  const camion = await camiones.crear(empresa, { patente: 'ABCD12' });
  if (!camion.ok) throw new Error('camión');
  const factura = async (localId: string) => {
    const f = await facturas.crear(empresa, { localId, fecha: '2026-10-08', camionId: camion.value.id, urgente: false, creadoPor: usuario });
    if (!f.ok) throw new Error('factura');
    return f.value.id;
  };
  return { empresa, usuario, camion: camion.value.id, k1: de('Calle 1 10'), k2: de('Calle 2 20'), b1: de('Calle 3 30'), factura };
};

const existeLocal = async (id: string) => (await db.selectFrom('local').select('id').where('id', '=', id).executeTakeFirst()) !== undefined;
const existeCliente = async (id: string) => (await db.selectFrom('cliente').select('id').where('id', '=', id).executeTakeFirst()) !== undefined;

describe('corregir los datos del cliente', () => {
  it('cambia el nombre (y se normaliza para buscarlo), solo dentro de su empresa', async () => {
    const s = await sembrar();
    expect(await clientes.corregirCliente(s.empresa, s.k1.cliente_id, { razonSocial: 'Kiosko El Sol' })).toBe('OK');
    const c = await db.selectFrom('cliente').select(['razon_social', 'razon_social_norm']).where('id', '=', s.k1.cliente_id).executeTakeFirstOrThrow();
    expect(c.razon_social).toBe('Kiosko El Sol');
    expect(c.razon_social_norm).toContain('el sol');
    expect(await clientes.corregirCliente(await crearEmpresa(db), s.k1.cliente_id, { razonSocial: 'Hackeado' })).toBe('NO_ENCONTRADO');
    expect(await clientes.corregirCliente(s.empresa, '00000000-0000-0000-0000-000000000000', { razonSocial: 'X' })).toBe('NO_ENCONTRADO');
  });

  it('pone, cambia y borra el RUT y el giro; un RUT ya usado por otro cliente se rechaza', async () => {
    const s = await sembrar();
    expect(await clientes.corregirCliente(s.empresa, s.k1.cliente_id, { rut: '77975918-0', giro: 'Kiosko' })).toBe('OK');
    expect(await db.selectFrom('cliente').select(['rut', 'giro']).where('id', '=', s.k1.cliente_id).executeTakeFirstOrThrow()).toEqual({ rut: '77975918-0', giro: 'Kiosko' });
    expect(await clientes.corregirCliente(s.empresa, s.b1.cliente_id, { rut: '77975918-0' })).toBe('RUT_DUPLICADO');
    expect(await clientes.corregirCliente(s.empresa, s.k1.cliente_id, { rut: null, giro: null })).toBe('OK');
    expect(await db.selectFrom('cliente').select(['rut', 'giro']).where('id', '=', s.k1.cliente_id).executeTakeFirstOrThrow()).toEqual({ rut: null, giro: null });
    expect(await clientes.corregirCliente(s.empresa, s.b1.cliente_id, { rut: '77975918-0' })).toBe('OK'); // ya quedó libre
  });
});

describe('corregir la dirección y la comuna del local', () => {
  it('cambia dirección y comuna; si el pin lo puso el buscador y nadie lo verificó, se borra para buscarlo de nuevo', async () => {
    const s = await sembrar();
    await clientes.fijarPinGeocodificado(s.empresa, s.k1.id, -33.51, -70.76, 0.6);
    expect(await clientes.corregirDireccion(s.empresa, s.k1.id, { direccion: 'Calle Corregida 55', comuna: 'Ñuñoa' })).toBe('OK');
    const l = await db.selectFrom('local').select(['direccion', 'direccion_norm', 'comuna', 'lat', 'lng', 'pin_fuente', 'geocod_intento_en']).where('id', '=', s.k1.id).executeTakeFirstOrThrow();
    expect(l).toMatchObject({ direccion: 'Calle Corregida 55', comuna: 'Ñuñoa', lat: null, lng: null, pin_fuente: null, geocod_intento_en: null });
    expect(l.direccion_norm).toContain('corregida 55');
  });

  it('un pin verificado o puesto a mano se conserva aunque cambie la dirección', async () => {
    const s = await sembrar();
    await clientes.actualizarLocal(s.empresa, s.k1.id, { pin: { lat: -33.5, lng: -70.7, estado: 'validado', fuente: 'manual' } });
    await clientes.corregirDireccion(s.empresa, s.k1.id, { direccion: 'Calle Corregida 55', comuna: 'Maipú' });
    expect(await db.selectFrom('local').select(['lat', 'pin_fuente']).where('id', '=', s.k1.id).executeTakeFirstOrThrow()).toEqual({ lat: -33.5, pin_fuente: 'manual' });
  });

  it('una dirección que el mismo cliente ya tiene es DUPLICADO; un local ajeno, NO_ENCONTRADO', async () => {
    const s = await sembrar();
    expect(await clientes.corregirDireccion(s.empresa, s.k1.id, { direccion: 'calle 2 20', comuna: 'Maipú' })).toBe('DUPLICADO');
    expect(await clientes.corregirDireccion(s.empresa, s.b1.id, { direccion: 'Calle 1 10', comuna: 'Ñuñoa' })).toBe('OK'); // otro cliente: se permite
    expect(await clientes.corregirDireccion(await crearEmpresa(db), s.k1.id, { direccion: 'X 1', comuna: 'Maipú' })).toBe('NO_ENCONTRADO');
  });
});

describe('listar los locales con lo entregado', () => {
  it('por comuna: primero los de pin por verificar, con RUT, pin, foto y lo entregado; lo ajeno no aparece', async () => {
    const s = await sembrar();
    await clientes.corregirCliente(s.empresa, s.k1.cliente_id, { rut: '77975918-0' });
    await clientes.actualizarLocal(s.empresa, s.k2.id, { pin: { lat: -33.5, lng: -70.7, estado: 'validado', fuente: 'manual' } });
    await clientes.verificarPin(s.empresa, s.k2.id, { por: s.usuario, en: new Date() });
    const entregada = await s.factura(s.k1.id);
    await db.updateTable('factura').set({ estado: 'entregada' }).where('id', '=', entregada).execute();
    const otra = await s.factura(s.k1.id);
    await db.updateTable('factura').set({ estado: 'entregada' }).where('id', '=', otra).execute();
    const pendiente = await s.factura(s.k1.id);
    await db.updateTable('factura').set({ total: 999 }).where('id', '=', pendiente).execute();

    const r = await clientes.listarLocales(s.empresa, { comuna: 'Maipú' }, 100);
    expect(r.total).toBe(2);
    expect(r.locales.map((l) => l.direccion)).toEqual(['Calle 1 10', 'Calle 2 20']); // por verificar primero
    expect(r.locales[0]).toMatchObject({ razonSocial: 'Kiosko Sol', rut: '77975918-0', pinVerificado: false, tieneFoto: false, entregas: 2 });
    expect(r.locales[1]).toMatchObject({ pinVerificado: true, pinVerificacion: 'persona', lat: -33.5, lng: -70.7, entregas: 0 });
    expect(await clientes.listarLocales(await crearEmpresa(db), { comuna: 'Maipú' }, 100)).toEqual({ total: 0, locales: [] });
  });

  it('busca por razón social, RUT o dirección en todas las comunas, y respeta el límite sin perder el total', async () => {
    const s = await sembrar();
    await clientes.corregirCliente(s.empresa, s.k1.cliente_id, { rut: '77975918-0' });
    expect((await clientes.listarLocales(s.empresa, { texto: 'bazar' }, 10)).locales.map((l) => l.razonSocial)).toEqual(['Bazar Luna']);
    expect((await clientes.listarLocales(s.empresa, { texto: '77.975.918' }, 10)).total).toBe(2);
    expect((await clientes.listarLocales(s.empresa, { texto: 'calle 3' }, 10)).locales).toHaveLength(1);
    const limitada = await clientes.listarLocales(s.empresa, {}, 1);
    expect(limitada.total).toBe(3);
    expect(limitada.locales).toHaveLength(1);
  });

  it('el resumen por comuna cuenta locales, verificados y sin pin', async () => {
    const s = await sembrar();
    await clientes.actualizarLocal(s.empresa, s.k1.id, { pin: { lat: -33.5, lng: -70.7, estado: 'validado', fuente: 'manual' } });
    await clientes.verificarPin(s.empresa, s.k1.id, { por: s.usuario, en: new Date() });
    expect(await clientes.resumenPorComuna(s.empresa)).toEqual([
      { comuna: 'Maipú', total: 2, verificados: 1, sinPin: 1 },
      { comuna: 'Ñuñoa', total: 1, verificados: 0, sinPin: 1 },
    ]);
  });
});

describe('eliminar una dirección equivocada', () => {
  it('una dirección sin facturas se elimina; el cliente se queda mientras tenga otra dirección y se va cuando no le quedan', async () => {
    const s = await sembrar();
    expect(await clientes.eliminarLocal(s.empresa, s.k1.id)).toBe('ELIMINADO');
    expect(await existeLocal(s.k1.id)).toBe(false);
    expect(await existeCliente(s.k1.cliente_id)).toBe(true); // todavía tiene «Calle 2 20»
    expect(await clientes.eliminarLocal(s.empresa, s.k2.id)).toBe('ELIMINADO');
    expect(await existeCliente(s.k1.cliente_id)).toBe(false);
    expect(await existeCliente(s.b1.cliente_id)).toBe(true); // el otro cliente no se toca
  });

  it('sus facturas pendientes se eliminan con ella, también de la ruta guardada; el registro de aprendizaje se conserva sin la factura', async () => {
    const s = await sembrar();
    const f = await s.factura(s.b1.id);
    const otra = await s.factura(s.k1.id);
    await rutas.guardar(s.empresa, { camionId: s.camion, fecha: '2026-10-08', salidaMin: 480, modo: 'sugerida', usuarioId: s.usuario, orden: [f, otra], fijas: [] });
    await db.insertInto('ruta_operacion').values({ empresa_id: s.empresa, camion_id: s.camion, fecha_reparto: '2026-10-08', tipo: 'mover', factura_id: f, modo: 'manual', version: 2, orden: [f, otra] }).execute();

    expect(await clientes.eliminarLocal(s.empresa, s.b1.id)).toBe('ELIMINADO');
    expect(await existeLocal(s.b1.id)).toBe(false);
    expect(await db.selectFrom('factura').select('id').where('id', '=', f).executeTakeFirst()).toBeUndefined();
    expect(await db.selectFrom('parada_ruta').select('factura_id').where('factura_id', '=', f).execute()).toEqual([]);
    const registro = await db.selectFrom('ruta_operacion').select(['factura_id', 'tipo']).where('empresa_id', '=', s.empresa).execute();
    expect(registro).toEqual([{ factura_id: null, tipo: 'mover' }]);
    // La otra dirección y su factura siguen intactas.
    expect(await db.selectFrom('factura').select('id').where('id', '=', otra).executeTakeFirst()).toBeDefined();
  });

  it('si ya tiene un aviso de entrega, o una factura entregada, no se elimina nada', async () => {
    const s = await sembrar();
    const f = await s.factura(s.k1.id);
    await entregas.registrar(s.empresa, { tipo: 'entregado', facturaId: f, localId: s.k1.id, camionId: s.camion, usuarioId: s.usuario, nuevoEstado: 'entregada' });
    expect(await clientes.eliminarLocal(s.empresa, s.k1.id)).toBe('CON_ENTREGAS');
    expect(await existeLocal(s.k1.id)).toBe(true);
    expect(await db.selectFrom('factura').select('id').where('id', '=', f).executeTakeFirst()).toBeDefined();

    const g = await s.factura(s.b1.id);
    await entregas.registrar(s.empresa, { tipo: 'llegada', facturaId: g, localId: s.b1.id, camionId: s.camion, usuarioId: s.usuario });
    expect(await clientes.eliminarLocal(s.empresa, s.b1.id)).toBe('CON_ENTREGAS'); // con un aviso de llegada basta
  });

  it('una dirección de otra empresa o inexistente es NO_ENCONTRADO y no se toca', async () => {
    const s = await sembrar();
    expect(await clientes.eliminarLocal(await crearEmpresa(db), s.k1.id)).toBe('NO_ENCONTRADO');
    expect(await existeLocal(s.k1.id)).toBe(true);
    expect(await clientes.eliminarLocal(s.empresa, '00000000-0000-0000-0000-000000000000')).toBe('NO_ENCONTRADO');
  });
});
