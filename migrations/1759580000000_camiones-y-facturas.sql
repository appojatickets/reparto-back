-- Up Migration
-- Fase 3a: camiones y facturas. Una factura es lo que hay que entregar en un local; el despachador la asigna a mano a un
-- camión y a un día de reparto, con sus condiciones del día («antes de», urgente, nota). La ruta se arma en la fase 3b.
create table camion (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  patente text not null check (patente ~ '^[A-Z]{4}[0-9]{2}$' or patente ~ '^[A-Z]{2}[0-9]{4}$'),
  alias text check (length(alias) <= 40),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, patente)
);

create table factura (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  folio text not null check (folio ~ '^[A-Za-z0-9-]{1,20}$'),
  local_id uuid not null references "local" (id),
  camion_id uuid references camion (id),
  fecha_reparto date not null,
  total integer check (total >= 0),
  antes_de_min smallint check (antes_de_min between 0 and 1439),
  urgente boolean not null default false,
  nota text check (length(nota) <= 300),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'anulada')),
  creado_por uuid references usuario (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, folio)
);
create index factura_dia_idx on factura (empresa_id, fecha_reparto, camion_id);
create index factura_local_idx on factura (local_id);

alter table camion enable row level security;
alter table factura enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on camion, factura from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on camion, factura from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists factura;
drop table if exists camion;
