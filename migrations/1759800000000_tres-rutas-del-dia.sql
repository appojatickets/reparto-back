-- Up Migration
-- Las tres rutas del día (ADR 0045): la que sugirió el sistema, la que quedó al salir (con lo acomodado a mano) y la que de verdad se entregó,
-- en el orden de cada ENTREGADO. Las llena el analizador junto con la calidad de la ruta; son ids de factura.
alter table jornada_resumen
  add column orden_sugerido uuid[],
  add column orden_salida uuid[],
  add column orden_entregado uuid[],
  add column inversiones_salida int;

-- Down Migration
alter table jornada_resumen
  drop column if exists orden_sugerido, drop column if exists orden_salida, drop column if exists orden_entregado, drop column if exists inversiones_salida;
