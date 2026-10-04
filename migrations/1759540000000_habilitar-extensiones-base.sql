-- Up Migration
-- Aplicada a mano en Supabase (proyecto reparto-back) el 2026-10-04; es idempotente y portable.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
-- PostGIS solo si el servidor lo ofrece (Supabase sí; el Postgres local de pruebas puede no tenerlo).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'postgis') then
    create extension if not exists postgis with schema extensions;
  end if;
end $$;

-- Down Migration
-- Sin reversa: otras migraciones dependen de estas extensiones.
