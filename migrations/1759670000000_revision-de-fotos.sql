-- Up Migration
-- Revisión de fotos por el admin: quién y cuándo subió la foto de un local, y los reportes de fotos mal tomadas.
alter table local
  add column foto_por uuid references usuario (id) on delete set null,
  add column foto_en timestamptz;

create table foto_reporte (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  local_id uuid not null references local (id) on delete cascade,
  -- La foto reportada: si el local cambia de foto, el reporte deja de aplicar a la nueva.
  foto_path text not null,
  motivo text not null check (motivo in ('no_es_la_fachada', 'se_ven_personas', 'borrosa', 'otra')),
  detalle text check (detalle is null or length(detalle) <= 200),
  reportado_por uuid references usuario (id) on delete set null,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references usuario (id) on delete set null,
  resolucion text check (resolucion in ('eliminada', 'descartada')),
  check ((resuelto_en is null) = (resolucion is null))
);
create index foto_reporte_abiertos_idx on foto_reporte (empresa_id, creado_en desc) where resuelto_en is null;
-- Un mismo usuario no repite el reporte de la misma foto mientras siga abierto.
create unique index foto_reporte_unico_abierto on foto_reporte (local_id, foto_path, reportado_por) where resuelto_en is null;

alter table foto_reporte enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on foto_reporte from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on foto_reporte from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists foto_reporte;
alter table local drop column if exists foto_en, drop column if exists foto_por;
