-- Up Migration
-- «Las agrego en orden» (ADR 0037): un tercer modo de ruta donde el orden es el que el chofer cargó las facturas.
alter table ruta drop constraint ruta_modo_check;
alter table ruta add constraint ruta_modo_check check (modo in ('sugerida', 'manual', 'carga'));
alter table ruta_operacion drop constraint ruta_operacion_modo_check;
alter table ruta_operacion add constraint ruta_operacion_modo_check check (modo in ('sugerida', 'manual', 'carga'));

-- Down Migration
update ruta set modo = 'manual' where modo = 'carga';
update ruta_operacion set modo = 'manual' where modo = 'carga';
alter table ruta_operacion drop constraint ruta_operacion_modo_check;
alter table ruta_operacion add constraint ruta_operacion_modo_check check (modo in ('sugerida', 'manual'));
alter table ruta drop constraint ruta_modo_check;
alter table ruta add constraint ruta_modo_check check (modo in ('sugerida', 'manual'));
