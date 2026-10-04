import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

/** Conexión por el pooler de Supabase (ver spike S4 para la URL correcta). */
export const createDb = (connectionString: string): Kysely<unknown> =>
  new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString, max: 5, ssl: { rejectUnauthorized: false } }),
    }),
  });
