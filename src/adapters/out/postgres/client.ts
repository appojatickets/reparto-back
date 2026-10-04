import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Tabla } from './db-types.js';

export type Db = Kysely<Tabla>;

/**
 * Conexión por el Session pooler de Supabase (la directa es solo IPv6; ver spike S4).
 * `search_path` incluye `extensions`, donde viven pg_trgm y unaccent, para que operadores como `<%` se resuelvan.
 */
export const createDb = (connectionString: string, opciones: { ssl?: boolean; max?: number } = {}): Db => {
  const pool = new pg.Pool({
    connectionString,
    max: opciones.max ?? 5,
    ...(opciones.ssl === false ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  pool.on('connect', (client) => {
    void client.query('set search_path to public, extensions');
  });
  return new Kysely<Tabla>({ dialect: new PostgresDialect({ pool }) });
};
