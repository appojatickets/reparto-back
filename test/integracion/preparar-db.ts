import { execFileSync } from 'node:child_process';
import pg from 'pg';

/**
 * Deja la base de pruebas limpia y con TODAS las migraciones aplicadas (las mismas que van a producción).
 * Borra el esquema `public`: por eso se niega a correr salvo contra una base local cuyo nombre contenga «test».
 */
export default async function preparar(): Promise<void> {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) throw new Error('Falta TEST_DATABASE_URL (p. ej. postgres://postgres@127.0.0.1:5432/reparto_test).');
  const u = new URL(url);
  const baseLocal = ['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(u.hostname);
  if (!baseLocal || !/test/i.test(u.pathname)) {
    throw new Error(`Por seguridad solo se prepara una base local de pruebas (host ${u.hostname}, base ${u.pathname}).`);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('drop extension if exists pg_trgm cascade');
    await client.query('drop extension if exists unaccent cascade');
    await client.query('drop schema if exists public cascade');
    await client.query('drop schema if exists extensions cascade');
    await client.query('drop schema if exists auth cascade');
    await client.query('create schema public');
    // Réplica mínima de lo que Supabase ya trae: la FK de usuario apunta a auth.users.
    await client.query('create schema auth');
    await client.query('create table auth.users (id uuid primary key default gen_random_uuid(), email text)');
  } finally {
    await client.end();
  }

  execFileSync('npx', ['node-pg-migrate', 'up', '--migrations-dir', 'migrations'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
