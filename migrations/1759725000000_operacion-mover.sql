-- Up Migration
-- Arrastrar y soltar una parada de la ruta: la operación «mover» se anota igual que subir o bajar (el sistema aprende de lo que corrige la gente).
alter table ruta_operacion drop constraint ruta_operacion_tipo_check;
alter table ruta_operacion add constraint ruta_operacion_tipo_check
  check (tipo in ('planificar', 'subir', 'bajar', 'mover', 'primero', 'despues', 'quitar', 'ordenar', 'insertar', 'salida'));

-- Down Migration
-- El registro solo se agrega: lo ya anotado como «mover» se conserva (la restricción vieja se exige solo a lo nuevo).
alter table ruta_operacion drop constraint ruta_operacion_tipo_check;
alter table ruta_operacion add constraint ruta_operacion_tipo_check
  check (tipo in ('planificar', 'subir', 'bajar', 'primero', 'despues', 'quitar', 'ordenar', 'insertar', 'salida')) not valid;
