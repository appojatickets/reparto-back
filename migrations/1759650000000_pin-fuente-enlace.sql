-- Up Migration
-- Pin tomado de un enlace de Google Maps o Waze que comparte el vendedor (ADR 0018): es la fuente más fiable después del admin.
alter table "local" drop constraint if exists local_pin_fuente_check;
alter table "local" add constraint local_pin_fuente_check
  check (pin_fuente in ('geocodificador', 'manual', 'importado', 'aprendido', 'chofer', 'enlace'));

-- Down Migration
alter table "local" drop constraint if exists local_pin_fuente_check;
alter table "local" add constraint local_pin_fuente_check
  check (pin_fuente in ('geocodificador', 'manual', 'importado', 'aprendido', 'chofer'));
