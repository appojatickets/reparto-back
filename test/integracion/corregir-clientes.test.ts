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

describe('corregir la razón social', () => {
  it('cambia el nombre del cliente (y se normaliza para buscarlo), solo dentro de su empresa', async () => {
    const s = await sembrar();
    expect(await clientes.renombrarCliente(s.empresa, s.k1.cliente_id, 'Kiosko El Sol')).toBe(true);
    const c = await db.selectFrom('cliente').select(['razon_social', 'razon_social_norm']).where('id', '=', s.k1.cliente_id).executeTakeFirstOrThrow();
    expect(c.razon_social).toBe('Kiosko El Sol');
    expect(c.razon_social_norm).toContain('el sol');
    expect(await clientes.renombrarCliente(await crearEmpresa(db), s.k1.cliente_id, 'Hackeado')).toBe(false);
    expect(await clientes.renombrarCliente(s.empresa, '00000000-0000-0000-0000-000000000000', 'X')).toBe(false);
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
