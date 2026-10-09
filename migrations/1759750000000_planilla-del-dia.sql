-- Up Migration
-- Planilla de la mañana: qué chofer, ayudante, vendedores y comunas lleva cada camión ese día (ADR 0023).
-- Los vendedores ya existen (migración 1759640000000_vendedores).
create table asignacion_dia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  fecha_reparto date not null,
  camion_id uuid not null references camion (id),
  chofer_usuario_id uuid references usuario (id),
  chofer_nombre text,
  ayudante_usuario_id uuid references usuario (id),
  ayudante_nombre text,
  comunas text[] not null default '{}',
  creado_por uuid references usuario (id),
  creado_en timestamptz not null default now(),
  unique (empresa_id, fecha_reparto, camion_id)
);

create table asignacion_vendedor (
  asignacion_id uuid not null references asignacion_dia (id) on delete cascade,
  vendedor_id uuid not null references vendedor (id),
  primary key (asignacion_id, vendedor_id)
);

alter table asignacion_dia enable row level security;
alter table asignacion_vendedor enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on asignacion_dia, asignacion_vendedor from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on asignacion_dia, asignacion_vendedor from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists asignacion_vendedor;
drop table if exists asignacion_dia;
