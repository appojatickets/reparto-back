-- Up Migration
-- Esquema base (fase 2): empresa, usuario, cliente, local y horario_local.
-- Todas las tablas llevan empresa_id desde el primer día (multiempresa).
-- La API se conecta como rol de servicio y aplica los permisos ella misma. Aun así se activa RLS SIN políticas en
-- cada tabla: Supabase expone `public` por PostgREST y la clave publishable viaja al navegador, así que sin RLS
-- cualquiera podría leer o escribir las tablas directamente.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() es STABLE; los índices y columnas generadas exigen IMMUTABLE. `search_path = ''` evita que cambie
-- el significado de los nombres según quién la llame, por eso todo va calificado.
create or replace function public.immutable_unaccent(t text)
returns text language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

-- Normalización única para buscar y para la clave de negocio: minúsculas, sin tildes ni puntuación, espacios simples.
-- Debe coincidir con `normalizarTexto` del dominio (hay un test de paridad).
create or replace function public.norm(t text)
returns text language sql immutable parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(lower(public.immutable_unaccent(coalesce(t, ''))), '[^[:alnum:][:space:]]', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

create table empresa (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  config jsonb not null default '{}'::jsonb,
  config_version int not null default 1,
  creado_en timestamptz not null default now()
);

-- 1:1 con auth.users de Supabase. El rol vive aquí (no en el JWT) para poder cambiarlo y desactivar sin esperar a que
-- expire una sesión.
create table usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references empresa (id),
  rol text not null check (rol in ('admin', 'despachador', 'chofer')),
  username text not null check (username ~ '^[a-z0-9]{3,30}$'),
  nombre text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, username)
);

create table cliente (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  rut text check (rut ~ '^[0-9]{1,8}-[0-9K]$'),
  razon_social text not null check (length(btrim(razon_social)) > 0),
  razon_social_norm text generated always as (public.norm(razon_social)) stored,
  giro text,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'activo', 'inactivo', 'cerrado', 'archivado')),
  creado_en timestamptz not null default now()
);
create unique index cliente_rut_unico on cliente (empresa_id, rut) where rut is not null;
create index cliente_razon_trgm on cliente using gin (razon_social_norm extensions.gin_trgm_ops);
create index cliente_estado_idx on cliente (empresa_id, estado);
create index cliente_razon_norm_idx on cliente (empresa_id, razon_social_norm) where rut is null;

create table "local" (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  cliente_id uuid not null references cliente (id) on delete cascade,
  direccion text not null check (length(btrim(direccion)) > 0),
  direccion_norm text generated always as (public.norm(direccion)) stored,
  comuna text not null,
  lat double precision,
  lng double precision,
  pin_estado text not null default 'pendiente' check (pin_estado in ('pendiente', 'sugerido', 'validado')),
  pin_fuente text check (pin_fuente in ('geocodificador', 'manual', 'importado', 'aprendido', 'chofer')),
  pin_confianza real check (pin_confianza between 0 and 1),
  foto_path text,
  streetview_rumbo smallint check (streetview_rumbo between 0 and 359),
  nota text,
  creado_en timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check (lat is null or (lat between -90 and 90 and lng between -180 and 180))
);
-- Clave de negocio: RUT (en cliente) + dirección (aquí). Un cliente no repite dirección.
create unique index local_clave_negocio on "local" (cliente_id, direccion_norm);
create index local_direccion_trgm on "local" using gin (direccion_norm extensions.gin_trgm_ops);
create index local_empresa_idx on "local" (empresa_id, cliente_id);

create table horario_local (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  local_id uuid not null references "local" (id) on delete cascade,
  dias smallint[] not null check (cardinality(dias) > 0 and dias <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  desde time not null,
  hasta time not null check (hasta > desde),
  fuente text not null check (fuente in ('confirmado', 'aprendido', 'sugerido', 'giro')),
  confianza real not null default 0.5 check (confianza between 0 and 1),
  observado_en timestamptz not null default now()
);
create index horario_local_idx on horario_local (local_id);

alter table empresa enable row level security;
alter table usuario enable row level security;
alter table cliente enable row level security;
alter table "local" enable row level security;
alter table horario_local enable row level security;

-- Defensa en profundidad: ni siquiera con RLS deben existir permisos para los roles públicos de Supabase.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on empresa, usuario, cliente, "local", horario_local from anon';
    execute 'revoke execute on function public.norm(text), public.immutable_unaccent(text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on empresa, usuario, cliente, "local", horario_local from authenticated';
    execute 'revoke execute on function public.norm(text), public.immutable_unaccent(text) from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists horario_local;
drop table if exists "local";
drop table if exists cliente;
drop table if exists usuario;
drop table if exists empresa;
drop function if exists public.norm(text);
drop function if exists public.immutable_unaccent(text);
