-- Up Migration
-- Vendedores (V01…V16) con su celular: el chofer les avisa por WhatsApp cuando un local está cerrado (ADR 0016, punto 4).
create table vendedor (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  codigo text not null check (codigo ~ '^[A-Z0-9-]{1,10}$'),
  nombre text not null check (length(nombre) between 1 and 60),
  celular text check (celular ~ '^569[0-9]{8}$'),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, codigo)
);

alter table vendedor enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on vendedor from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on vendedor from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists vendedor;
