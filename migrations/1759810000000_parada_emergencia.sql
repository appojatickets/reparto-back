-- Up Migration
-- Kit de emergencia (ADR 0048): cuando al chofer se le pincha un neumático o se le echa a perder el camión, busca un mecánico o una vulcanización
-- desde la app y queda registrada esa parada (con la hora y dónde estaba), aparte de las entregas: explica el tiempo perdido y no cuenta como entrega.
create table parada_emergencia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  camion_id uuid not null references camion (id),
  usuario_id uuid references usuario (id),
  tipo text not null check (tipo in ('mecanico', 'vulcanizacion', 'otro')),
  texto text check (texto is null or char_length(texto) <= 80),
  lat double precision,
  lng double precision,
  precision_m real check (precision_m >= 0),
  creado_en timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check (lat is null or (lat between -90 and 90 and lng between -180 and 180))
);
create index parada_emergencia_dia_idx on parada_emergencia (empresa_id, camion_id, creado_en);

alter table parada_emergencia enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on parada_emergencia from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on parada_emergencia from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists parada_emergencia;
