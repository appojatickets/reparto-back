-- Up Migration
alter table ruta add column if not exists orden_comunas text[] not null default '{}';

-- Down Migration
alter table ruta drop column orden_comunas;
