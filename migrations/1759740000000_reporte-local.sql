-- Up Migration
-- Reportes de un local: «el nombre está mal» y «la ubicación (pin) está mal». Los de foto siguen en foto_reporte; el admin los ve juntos.
-- Se guarda cómo estaba el nombre y el pin al reportar, para saber si ya lo corrigieron después.
create table reporte_local (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  local_id uuid not null references local (id) on delete cascade,
  tipo text not null check (tipo in ('nombre', 'ubicacion')),
  detalle text check (detalle is null or length(detalle) <= 200),
  -- Solo para «nombre»: cómo debería llamarse, según quien reporta.
  sugerido text check (sugerido is null or length(sugerido) <= 120),
  razon_social_al_reportar text not null,
  lat_al_reportar double precision,
  lng_al_reportar double precision,
  reportado_por uuid references usuario (id) on delete set null,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references usuario (id) on delete set null,
  resolucion text check (resolucion in ('corregido', 'descartado')),
  check ((resuelto_en is null) = (resolucion is null))
);
create index reporte_local_abiertos_idx on reporte_local (empresa_id, creado_en desc) where resuelto_en is null;
-- Un mismo usuario no repite el mismo tipo de reporte del mismo local mientras siga abierto.
create unique index reporte_local_unico_abierto on reporte_local (local_id, tipo, reportado_por) where resuelto_en is null;

alter table reporte_local enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on reporte_local from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on reporte_local from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists reporte_local;
