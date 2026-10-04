-- Up Migration
-- Propuestas de pin (importación de pines de choferes, con revisión) y bloqueo por intentos de login fallidos.
create table propuesta_pin (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  local_id uuid references "local" (id) on delete cascade,
  rut text,
  direccion text not null,
  direccion_norm text generated always as (public.norm(direccion)) stored,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  distancia_actual_m real,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada', 'sin_local')),
  propuesto_por uuid not null references usuario (id),
  resuelto_por uuid references usuario (id),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);
create index propuesta_pin_estado_idx on propuesta_pin (empresa_id, estado, creado_en);
create index propuesta_pin_local_idx on propuesta_pin (local_id);

create table login_intento (
  usuario_id uuid primary key references usuario (id) on delete cascade,
  intentos smallint not null default 0,
  bloqueado_hasta timestamptz
);

alter table propuesta_pin enable row level security;
alter table login_intento enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on propuesta_pin, login_intento from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on propuesta_pin, login_intento from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists login_intento;
drop table if exists propuesta_pin;
