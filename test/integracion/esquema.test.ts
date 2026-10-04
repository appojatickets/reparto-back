import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizarTexto } from '../../src/domain/entidades/local.js';
import { abrirDb, crearEmpresa } from './utils.js';

const db = abrirDb();
afterAll(() => db.destroy());

describe('esquema', () => {
  it('todas las tablas de negocio tienen RLS activado (la clave publishable no debe leer ni escribir nada)', async () => {
    const r = await sql<{ relname: string; relrowsecurity: boolean }>`
      select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'pgmigrations' order by 1`.execute(db);
    const nombres = r.rows.map((f) => f.relname);
    expect(nombres).toEqual(['camion', 'cliente', 'empresa', 'entrega_evento', 'factura', 'horario_local', 'jornada', 'local', 'login_intento', 'parada_ruta', 'propuesta_pin', 'ruta', 'usuario']);
    expect(r.rows.filter((f) => !f.relrowsecurity)).toEqual([]);
  });

  it('norm() en SQL coincide con normalizarTexto del dominio (misma clave de negocio en ambos lados)', async () => {
    const muestras = [
      'Av. Providencia 1234', '  Rabelo   Mágica SpA ', 'Ñuñoa', 'PEDRO AGUIRRE CERDA 55-B', "O'Higgins #1020, Of. 3",
      'Kiosko "El Tío"', 'Cañón   del  Maipo', 'Estación Central', 'Calle 5 Norte / Sur', 'Peñalolén (esquina)', '', '   ',
    ];
    const r = await sql<{ t: string; n: string }>`select t, public.norm(t) as n from unnest(${muestras}::text[]) as t`.execute(db);
    for (const f of r.rows) expect(f.n, `muestra «${f.t}»`).toBe(normalizarTexto(f.t));
  });

  it('las restricciones rechazan datos inválidos', async () => {
    const e = await crearEmpresa(db);
    const c = await db.insertInto('cliente').values({ empresa_id: e, rut: '12345678-5', razon_social: 'X', giro: null }).returning('id').executeTakeFirstOrThrow();
    const local = (extra: object) => db.insertInto('local').values({ empresa_id: e, cliente_id: c.id, direccion: 'Calle 1', comuna: 'Maipú', lat: null, lng: null, pin_fuente: null, pin_confianza: null, foto_path: null, streetview_rumbo: null, nota: null, ...extra }).execute();
    await expect(local({ lat: -33.4 })).rejects.toThrow(); // lat sin lng
    await expect(local({ lat: 99, lng: 0 })).rejects.toThrow(); // fuera de rango
    await expect(local({ streetview_rumbo: 360 })).rejects.toThrow();
    await expect(local({ pin_estado: 'raro' })).rejects.toThrow();
    await expect(db.insertInto('cliente').values({ empresa_id: e, rut: 'abc', razon_social: 'Y', giro: null }).execute()).rejects.toThrow();
    await expect(db.insertInto('cliente').values({ empresa_id: e, rut: null, razon_social: '   ', giro: null }).execute()).rejects.toThrow();
  });

  it('el RUT es único por empresa y la dirección es única por cliente (sin importar tildes ni mayúsculas)', async () => {
    const e = await crearEmpresa(db);
    const otra = await crearEmpresa(db);
    const nuevo = (empresa: string) => db.insertInto('cliente').values({ empresa_id: empresa, rut: '11111111-1', razon_social: 'A', giro: null }).returning('id').executeTakeFirstOrThrow();
    const c = await nuevo(e);
    await expect(nuevo(e)).rejects.toThrow(/unique|duplicate/i);
    await expect(nuevo(otra)).resolves.toBeDefined(); // otra empresa: mismo RUT permitido
    const local = (dir: string) => db.insertInto('local').values({ empresa_id: e, cliente_id: c.id, direccion: dir, comuna: 'Maipú', lat: null, lng: null, pin_fuente: null, pin_confianza: null, foto_path: null, streetview_rumbo: null, nota: null }).execute();
    await local('Av. Pajaritos 100');
    await expect(local('AV PAJARITOS  100')).rejects.toThrow(/unique|duplicate/i);
  });
});
