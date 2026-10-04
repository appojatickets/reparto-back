-- Up Migration
-- Fase 4a: jornada = el camión que un usuario maneja un día (los choferes rotan y cambian por panas; ADR 0010).
-- Una jornada abierta (`hasta` nulo) es la vigente; cada usuario tiene a lo más una abierta, y la del día anterior
-- ya no cuenta aunque no se haya cerrado.
create table jornada (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  usuario_id uuid not null references usuario (id),
  camion_id uuid not null references camion (id),
  fecha_reparto date not null,
  desde timestamptz not null default now(),
  hasta timestamptz,
  check (hasta is null or hasta >= desde)
);
create unique index jornada_abierta_por_usuario on jornada (usuario_id) where hasta is null;
create index jornada_camion_idx on jornada (empresa_id, camion_id, fecha_reparto);

alter table jornada enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on jornada from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on jornada from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists jornada;
