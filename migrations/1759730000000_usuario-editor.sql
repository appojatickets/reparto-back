-- Up Migration
-- Permiso de editor: un chofer o ayudante con este permiso (lo da el admin) puede corregir clientes, quitar fotos y eliminar direcciones equivocadas.
alter table usuario add column editor boolean not null default false;

-- Down Migration
alter table usuario drop column if exists editor;
