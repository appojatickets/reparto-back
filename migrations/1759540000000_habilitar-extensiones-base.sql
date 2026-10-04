-- Up Migration
-- Ya aplicada a mano en Supabase (proyecto reparto-back) el 2026-10-04; es idempotente.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists postgis with schema extensions;

-- Down Migration
-- Sin reversa: otras migraciones dependerán de estas extensiones.
