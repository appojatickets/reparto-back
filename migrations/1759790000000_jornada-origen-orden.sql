-- Up Migration
-- Aprender de los días en orden manual: el analizador anota quién armó el orden del día (el sistema o el chofer, con «las agrego en orden»)
-- y cuántas veces se movió una parada a mano. Un día del chofer sin cambios es su experiencia pura.
alter table jornada_resumen
  add column origen_orden text check (origen_orden in ('sistema', 'chofer')),
  add column cambios_manuales int;

-- Down Migration
alter table jornada_resumen drop column if exists origen_orden, drop column if exists cambios_manuales;
