-- Up Migration
-- Tiempos y distancias de manejar entre dos puntos (de un servicio de rutas por calles), consultados una sola vez. Las calles no cambian cada día,
-- así que se guarda cada tramo: la clave es la coordenada redondeada a ~11 m («lat,lng» con 4 decimales) y no depende de la empresa.
create table viaje_par (
  desde text not null,
  hasta text not null,
  segundos real not null check (segundos >= 0),
  metros real not null check (metros >= 0),
  consultado_en timestamptz not null default now(),
  primary key (desde, hasta)
);
alter table viaje_par enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on viaje_par from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on viaje_par from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists viaje_par;
