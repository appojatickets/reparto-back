import { afterAll, describe, expect, it } from 'vitest';
import { PostgresClienteRepository } from '../../src/adapters/out/postgres/repositorio-clientes.js';
import { PostgresPropuestaPinRepository } from '../../src/adapters/out/postgres/repositorio-pines.js';
import { PostgresIntentosLoginRepository, PostgresUsuarioRepository } from '../../src/adapters/out/postgres/repositorio-usuarios.js';
import { abrirDb, crearEmpresa, crearUsuario } from './utils.js';

const db = abrirDb();
const clientes = new PostgresClienteRepository(db);
const pines = new PostgresPropuestaPinRepository(db);
const usuarios = new PostgresUsuarioRepository(db);
const intentos = new PostgresIntentosLoginRepository(db);
afterAll(() => db.destroy());

const sembrar = async () => {
  const e = await crearEmpresa(db);
  const chofer = await crearUsuario(db, e, 'chofer', `ch${Math.random().toString(36).slice(2, 8)}`);
  const admin = await crearUsuario(db, e, 'admin', `ad${Math.random().toString(36).slice(2, 8)}`);
  await clientes.importar(e, [
    { claveCliente: 'c', rut: '12345678-5', razonSocial: 'Rabelo', locales: [{ claveLocal: 'c|d', direccion: 'Calle 1 10', comuna: 'Maipú', lat: -33.5, lng: -70.7, indices: [0] }] },
  ]);
  const [{ id: localId } = { id: '' }] = await db.selectFrom('local').select('id').where('empresa_id', '=', e).execute();
  return { e, chofer, admin, localId };
};

describe('propuestas de pin', () => {
  it('crear → listar (primero las que más se alejan) → aceptar actualiza el pin del local en una transacción', async () => {
    const { e, chofer, admin, localId } = await sembrar();
    await pines.crearLote(e, chofer, [
      { localId, direccion: 'Calle 1 10', lat: -33.51, lng: -70.71, distanciaActualM: 40, estado: 'pendiente' },
      { localId, direccion: 'Calle 1 10', lat: -33.6, lng: -70.8, distanciaActualM: 900, estado: 'pendiente' },
      { direccion: 'Desconocida 5', lat: -33.4, lng: -70.6, estado: 'sin_local' },
    ]);
    const pendientes = await pines.listar(e, 'pendiente', 10);
    expect(pendientes.map((p) => p.distanciaActualM)).toEqual([900, 40]);
    expect(pendientes[0]).toMatchObject({ razonSocial: 'Rabelo', comuna: 'Maipú', pinActual: { lat: -33.5, lng: -70.7 } });

    const ahora = new Date('2026-10-05T12:00:00Z');
    expect(await pines.resolver(e, pendientes[0]?.id ?? '', admin, true, ahora)).toEqual({ ok: true, value: undefined });
    expect(await db.selectFrom('local').select(['lat', 'lng', 'pin_estado', 'pin_fuente']).where('id', '=', localId).executeTakeFirst()).toEqual({ lat: -33.6, lng: -70.8, pin_estado: 'validado', pin_fuente: 'importado' });
    expect(await pines.listar(e, 'aceptada', 10)).toHaveLength(1);
  });

  it('rechazar no toca el pin; resolver dos veces es YA_RESUELTA; «sin local» no se puede aceptar', async () => {
    const { e, chofer, admin, localId } = await sembrar();
    await pines.crearLote(e, chofer, [
      { localId, direccion: 'Calle 1 10', lat: -33.9, lng: -70.9, distanciaActualM: 50, estado: 'pendiente' },
      { direccion: 'Desconocida 5', lat: -33.4, lng: -70.6, estado: 'sin_local' },
    ]);
    const [pendiente] = await pines.listar(e, 'pendiente', 10);
    const [sinLocal] = await pines.listar(e, 'sin_local', 10);
    const ahora = new Date();
    expect(await pines.resolver(e, pendiente?.id ?? '', admin, false, ahora)).toEqual({ ok: true, value: undefined });
    expect((await db.selectFrom('local').select('lat').where('id', '=', localId).executeTakeFirst())?.lat).toBe(-33.5);
    expect(await pines.resolver(e, pendiente?.id ?? '', admin, true, ahora)).toEqual({ ok: false, error: 'YA_RESUELTA' });
    expect(await pines.resolver(e, sinLocal?.id ?? '', admin, true, ahora)).toEqual({ ok: false, error: 'SIN_LOCAL' });
    expect(await pines.resolver(e, '00000000-0000-0000-0000-000000000000', admin, true, ahora)).toEqual({ ok: false, error: 'NO_ENCONTRADA' });
  });

  it('una propuesta de otra empresa no se puede resolver ni ver', async () => {
    const { e, chofer, admin, localId } = await sembrar();
    const otra = await crearEmpresa(db);
    await pines.crearLote(e, chofer, [{ localId, direccion: 'Calle 1 10', lat: -33.9, lng: -70.9, distanciaActualM: 50, estado: 'pendiente' }]);
    const [p] = await pines.listar(e, 'pendiente', 10);
    expect(await pines.listar(otra, 'pendiente', 10)).toEqual([]);
    expect(await pines.resolver(otra, p?.id ?? '', admin, true, new Date())).toEqual({ ok: false, error: 'NO_ENCONTRADA' });
  });
});

describe('usuarios y bloqueo de login', () => {
  it('crear, buscar por id y por usuario, listar y desactivar', async () => {
    const e = await crearEmpresa(db);
    const otra = await crearEmpresa(db);
    const id = await crearUsuario(db, e, 'chofer', 'jperez');
    expect(await usuarios.porId(id)).toMatchObject({ username: 'jperez', rol: 'chofer', activo: true, empresaId: e });
    expect((await usuarios.porUsername('jperez'))?.id).toBe(id);
    expect([...(await usuarios.usernamesDeEmpresa(e))]).toEqual(['jperez']);
    expect(await usuarios.cambiarActivo(otra, id, false)).toBe(false); // otra empresa no puede
    expect(await usuarios.cambiarActivo(e, id, false)).toBe(true);
    expect((await usuarios.porId(id))?.activo).toBe(false);
    expect((await usuarios.listar(e)).map((u) => u.username)).toEqual(['jperez']);
  });

  it('un username inválido o repetido en la empresa se rechaza', async () => {
    const e = await crearEmpresa(db);
    await crearUsuario(db, e, 'chofer', 'repetido');
    await expect(crearUsuario(db, e, 'chofer', 'repetido')).rejects.toThrow();
    await expect(crearUsuario(db, e, 'chofer', 'Con Espacio')).rejects.toThrow();
  });

  it('5 fallos bloquean; 5 fallos simultáneos tampoco se pisan; el contador se reinicia al vencer el bloqueo', async () => {
    const e = await crearEmpresa(db);
    const id = await crearUsuario(db, e, 'chofer', 'bloqueado');
    const t0 = new Date('2026-10-05T12:00:00Z');
    const ms = 15 * 60_000;

    const r = await Promise.all(Array.from({ length: 5 }, () => intentos.registrarFallo(id, t0, 5, ms)));
    expect(Math.max(...r.map((x) => x.intentos))).toBe(5);
    const est = await intentos.obtener(id);
    expect(est.intentos).toBe(5);
    expect(est.bloqueadoHasta?.getTime()).toBe(t0.getTime() + ms);

    // Pasado el bloqueo, el siguiente error cuenta como el primero (no vuelve a bloquear de inmediato).
    const despues = new Date(t0.getTime() + ms + 1000);
    const nuevo = await intentos.registrarFallo(id, despues, 5, ms);
    expect(nuevo.intentos).toBe(1);
    expect(nuevo.bloqueadoHasta).toBeUndefined();

    await intentos.reiniciar(id);
    expect(await intentos.obtener(id)).toEqual({ intentos: 0 });
  });
});

describe('permiso de editor en Postgres', () => {
  it('nace apagado, el admin lo enciende y apaga, y solo vale dentro de la empresa', async () => {
    const e = await crearEmpresa(db);
    const otra = await crearEmpresa(db);
    const id = await crearUsuario(db, e, 'chofer', `c${Math.random().toString(36).slice(2, 8)}`);
    const repo = new PostgresUsuarioRepository(db);
    expect((await repo.porId(id))?.editor).toBe(false);
    expect(await repo.cambiarEditor(e, id, true)).toBe(true);
    expect((await repo.porId(id))?.editor).toBe(true);
    expect((await repo.listar(e)).find((u) => u.id === id)?.editor).toBe(true);
    expect(await repo.cambiarEditor(otra, id, false)).toBe(false); // otra empresa: no lo toca
    expect((await repo.porId(id))?.editor).toBe(true);
    expect(await repo.cambiarEditor(e, id, false)).toBe(true);
    expect((await repo.porId(id))?.editor).toBe(false);
  });
});
