-- Up Migration
-- Registro permanente para que el sistema aprenda (ADR 0022). Lo que se limpia en la pantalla del chofer NO se borra de aquí:
--  · ruta_operacion: cada vez que se calcula o se mueve la ruta, el orden resultante (el primero es lo que sugirió el sistema; los
--    siguientes son las correcciones de las personas).
--  · posicion_camion: dónde estaba el camión mientras la app estaba abierta (se sigue al camión, no a la persona).
--  · jornada_resumen: lo que pasó en la jornada (hechas, no hechas, las que no se alcanzaron) y la calidad de la ruta.
--  · aprendizaje_parametro: lo que el analizador en segundo plano calcula y la ruta usa (ritmo, tiempo de atención, capacidad…).
--  · entrega_evento: si el aviso fue de una persona o automático, y en qué lugar de la ruta iba la parada.

create table ruta_operacion (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  camion_id uuid not null references camion (id),
  fecha_reparto date not null,
  usuario_id uuid references usuario (id),
  tipo text not null check (tipo in ('planificar', 'subir', 'bajar', 'primero', 'despues', 'quitar', 'ordenar', 'insertar', 'salida')),
  factura_id uuid references factura (id),
  modo text not null check (modo in ('sugerida', 'manual')),
  version int not null,
  orden uuid[] not null,
  creado_en timestamptz not null default now()
);
create index ruta_operacion_dia_idx on ruta_operacion (empresa_id, camion_id, fecha_reparto, creado_en);

create table posicion_camion (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references empresa (id),
  camion_id uuid not null references camion (id),
  usuario_id uuid references usuario (id),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  precision_m real check (precision_m >= 0),
  velocidad_ms real check (velocidad_ms >= 0),
  tomado_en timestamptz not null,
  creado_en timestamptz not null default now()
);
create index posicion_camion_idx on posicion_camion (empresa_id, camion_id, tomado_en);

create table jornada_resumen (
  jornada_id uuid primary key references jornada (id) on delete cascade,
  empresa_id uuid not null references empresa (id),
  camion_id uuid not null references camion (id),
  fecha_reparto date not null,
  paradas int not null,
  entregadas int not null,
  no_entregadas int not null,
  sin_hacer int not null,
  sin_hacer_ids uuid[] not null default '{}',
  duracion_min int,
  -- los llena el analizador en segundo plano:
  dist_sugerida_m int,
  dist_real_m int,
  inversiones int,
  analizado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index jornada_resumen_dia_idx on jornada_resumen (empresa_id, fecha_reparto);

create table aprendizaje_parametro (
  empresa_id uuid not null references empresa (id),
  clave text not null check (clave in ('ritmo', 'servicio_min', 'capacidad_paradas', 'duracion_jornada_min')),
  ambito text not null,
  valor double precision not null,
  muestras int not null check (muestras >= 0),
  confianza real not null check (confianza between 0 and 1),
  calculado_en timestamptz not null default now(),
  primary key (empresa_id, clave, ambito)
);

create table aprendizaje_ejecucion (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  iniciado_en timestamptz not null,
  terminado_en timestamptz not null,
  resumen jsonb not null
);
create index aprendizaje_ejecucion_idx on aprendizaje_ejecucion (empresa_id, terminado_en desc);

alter table entrega_evento add column origen text not null default 'manual' check (origen in ('manual', 'auto'));
alter table entrega_evento add column posicion_en_ruta smallint check (posicion_en_ruta >= 1);
alter table entrega_evento add column paradas_en_ruta smallint check (paradas_en_ruta >= 0);
create index entrega_evento_tipo_idx on entrega_evento (empresa_id, creado_en);

alter table ruta_operacion enable row level security;
alter table posicion_camion enable row level security;
alter table jornada_resumen enable row level security;
alter table aprendizaje_parametro enable row level security;
alter table aprendizaje_ejecucion enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on ruta_operacion, posicion_camion, jornada_resumen, aprendizaje_parametro, aprendizaje_ejecucion from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on ruta_operacion, posicion_camion, jornada_resumen, aprendizaje_parametro, aprendizaje_ejecucion from authenticated';
  end if;
end $$;

-- Down Migration
alter table entrega_evento drop column if exists paradas_en_ruta;
alter table entrega_evento drop column if exists posicion_en_ruta;
alter table entrega_evento drop column if exists origen;
drop table if exists aprendizaje_ejecucion;
drop table if exists aprendizaje_parametro;
drop table if exists jornada_resumen;
drop table if exists posicion_camion;
drop table if exists ruta_operacion;
