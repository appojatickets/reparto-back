-- Up Migration
create table if not exists caja_carga (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references empresa(id),
 camion_id uuid not null references camion(id), fecha date not null, desde timestamptz not null,
 bultos numeric(12,2) check(bultos >= 0 and bultos <= 1000000),
 cargadas numeric(12,2) not null check(cargadas >= 0 and cargadas <= 1000000),
 rebajes numeric(12,2) check(rebajes >= 0 and rebajes <= cargadas),
 revision integer not null default 1, actualizado_por uuid not null references usuario(id), actualizado_en timestamptz not null,
 unique(empresa_id, camion_id, fecha, desde)
);
create table if not exists caja_cuenta (
 jornada_id uuid primary key references jornada(id), carga_id uuid not null references caja_carga(id),
 empresa_id uuid not null references empresa(id), usuario_id uuid not null references usuario(id),
 cargadas numeric(12,2) not null check(cargadas >= 0 and cargadas <= 1000000),
 cerrado numeric(12,2) not null default 0 check(cerrado >= 0), rebajes numeric(12,2) not null default 0 check(rebajes >= 0),
 tarifa numeric(12,2) not null default 15, cerrado_en timestamptz, actualizado_en timestamptz not null,
 check(cerrado + rebajes <= cargadas)
);
create index if not exists caja_cuenta_empresa_usuario on caja_cuenta(empresa_id,usuario_id);
create table if not exists caja_auditoria (
 id bigint generated always as identity primary key, empresa_id uuid not null references empresa(id),
 usuario_id uuid not null references usuario(id), jornada_id uuid not null references jornada(id),
 datos jsonb not null, creado_en timestamptz not null
);
alter table caja_carga enable row level security;
alter table caja_cuenta enable row level security;
alter table caja_auditoria enable row level security;
-- Down Migration
drop table caja_auditoria;
drop table caja_cuenta;
drop table caja_carga;
