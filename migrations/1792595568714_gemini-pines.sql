-- Up Migration
alter table "local" drop constraint if exists local_pin_fuente_check;
alter table "local" add constraint local_pin_fuente_check
  check (pin_fuente in ('geocodificador', 'manual', 'importado', 'aprendido', 'chofer', 'enlace', 'gemini'));

-- Down Migration
-- No se pierde la ubicación si se vuelve al código anterior.
update "local" set pin_fuente = 'geocodificador' where pin_fuente = 'gemini';
alter table "local" drop constraint if exists local_pin_fuente_check;
alter table "local" add constraint local_pin_fuente_check
  check (pin_fuente in ('geocodificador', 'manual', 'importado', 'aprendido', 'chofer', 'enlace'));
