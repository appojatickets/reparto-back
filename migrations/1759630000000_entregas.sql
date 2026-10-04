-- Up Migration
-- Fase 4b: entregas. La factura termina «entregada» o «no entregada»; cada aviso del chofer (llegué, entregué, está cerrado,
-- espero, no se entregó, vuelvo más tarde) queda registrado con su posición: es la evidencia con la que se completan los
-- pines (colaborativo) y, más adelante, se aprenden los horarios (ADR 0007, 0009, 0014, 0016).
-- El ayudante usa la app con su propio usuario, anclado al camión del día (ADR 0016).
alter table usuario drop constraint usuario_rol_check;
alter table usuario add constraint usuario_rol_check check (rol in ('admin', 'despachador', 'chofer', 'ayudante'));

alter table factura drop constraint factura_estado_check;
alter table factura add constraint factura_estado_check check (estado in ('pendiente', 'entregada', 'no_entregada', 'anulada'));

create table entrega_evento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  factura_id uuid not null references factura (id),
  local_id uuid not null references "local" (id),
  camion_id uuid references camion (id),
  usuario_id uuid references usuario (id),
  tipo text not null check (tipo in ('llegada', 'entregado', 'cerrado', 'espera', 'no_entregado', 'vuelve_mas_tarde')),
  motivo text check (motivo in ('cerrado', 'no_recibe', 'direccion', 'otro')),
  minutos smallint check (minutos between 1 and 240),
  lat double precision,
  lng double precision,
  precision_m real check (precision_m >= 0),
  creado_en timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check (lat is null or (lat between -90 and 90 and lng between -180 and 180))
);
create index entrega_evento_local_idx on entrega_evento (empresa_id, local_id, creado_en);
create index entrega_evento_camion_idx on entrega_evento (empresa_id, camion_id, creado_en);
create index entrega_evento_factura_idx on entrega_evento (factura_id);

alter table entrega_evento enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on entrega_evento from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on entrega_evento from authenticated';
  end if;
end $$;

-- Down Migration
drop table if exists entrega_evento;
update usuario set rol = 'chofer' where rol = 'ayudante';
alter table usuario drop constraint usuario_rol_check;
alter table usuario add constraint usuario_rol_check check (rol in ('admin', 'despachador', 'chofer'));
update factura set estado = 'pendiente' where estado in ('entregada', 'no_entregada');
alter table factura drop constraint factura_estado_check;
alter table factura add constraint factura_estado_check check (estado in ('pendiente', 'anulada'));
