import { readFile } from 'node:fs/promises';
import { sql } from 'kysely';
import type { Db } from './client.js';
/** Migración aditiva al desplegar: la conexión privada del servidor ya administra el esquema del proyecto. */
export const asegurarEsquemaCajas = async (db: Db): Promise<void> => {
 const archivo = await readFile(new URL('../../../../migrations/1759820000000_control_cajas.sql', import.meta.url), 'utf8');
 const up = archivo.split('-- Down Migration')[0];
 if (!up) throw new Error('Falta migración de cajas');
 await db.transaction().execute(async trx => {
  await sql`select pg_advisory_xact_lock(hashtextextended('reparto:esquema:cajas:v1',0))`.execute(trx);
  const r = await sql<{ existe: boolean }>`select to_regclass('public.caja_carga') is not null as existe`.execute(trx);
  if (!r.rows[0]?.existe) await sql.raw(up).execute(trx);
 });
};
