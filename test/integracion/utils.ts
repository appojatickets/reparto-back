import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { createDb, type Db } from '../../src/adapters/out/postgres/client.js';

export const abrirDb = (): Db => {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) throw new Error('Falta TEST_DATABASE_URL');
  return createDb(url, { ssl: false, max: 10 });
};

export const crearEmpresa = async (db: Db, nombre = 'Empresa de prueba'): Promise<string> =>
  (await db.insertInto('empresa').values({ nombre, config: '{}' }).returning('id').executeTakeFirstOrThrow()).id;

/** Crea la cuenta (auth.users) y el perfil (usuario) con el rol indicado. */
export const crearUsuario = async (db: Db, empresaId: string, rol: 'admin' | 'despachador' | 'chofer', username: string): Promise<string> => {
  const id = randomUUID();
  await sql`insert into auth.users (id, email) values (${id}, ${`${username}@test`})`.execute(db);
  await db.insertInto('usuario').values({ id, empresa_id: empresaId, rol, username, nombre: username }).execute();
  return id;
};
