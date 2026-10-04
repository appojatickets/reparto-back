-- Up Migration
-- Fase 3b: la ruta de un camión para un día. El orden se guarda; las horas de llegada se recalculan al ver la ruta
-- (así siempre reflejan el horario vigente y no hay datos que se desactualicen).
create table ruta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  camion_id uuid not null references camion (id),
  fecha_reparto date not null,
  salida_min smallint not null check (salida_min between 0 and 1439),
  modo text not null default 'sugerida' check (modo in ('sugerida', 'manual')),
  version int not null default 1,
  creado_por uuid references usuario (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, camion_id, fecha_reparto)
);

create table parada_ruta (
  ruta_id uuid not null references ruta (id) on delete cascade,
  factura_id uuid not null references factura (id),
  orden int not null check (orden >= 0),
  fijada boolean not null default false,
  primary key (ruta_id, factura_id),
  unique (ruta_id, orden) deferrable initially deferred
);
create index parada_ruta_factura_idx on parada_ruta (factura_id);

alter table ruta enable row level security;
alter table parada_ruta enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on ruta, parada_ruta from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on ruta, parada_ruta from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists parada_ruta;
drop table if exists ruta;
