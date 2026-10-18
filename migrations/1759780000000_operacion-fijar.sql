-- Up Migration
-- PASAR A MANUAL: la operación «fijar» congela el orden que se ve (la ruta pasa a modo «carga»: nada se reordena solo). Se anota para aprender.
alter table ruta_operacion drop constraint ruta_operacion_tipo_check;
alter table ruta_operacion add constraint ruta_operacion_tipo_check
  check (tipo in ('planificar', 'subir', 'bajar', 'mover', 'primero', 'despues', 'quitar', 'ordenar', 'insertar', 'fijar', 'salida'));

-- Down Migration
-- El registro solo se agrega: lo ya anotado como «fijar» se conserva (la restricción vieja se exige solo a lo nuevo).
alter table ruta_operacion drop constraint ruta_operacion_tipo_check;
alter table ruta_operacion add constraint ruta_operacion_tipo_check
  check (tipo in ('planificar', 'subir', 'bajar', 'mover', 'primero', 'despues', 'quitar', 'ordenar', 'insertar', 'salida')) not valid;
