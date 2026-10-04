-- Up Migration
-- El número de factura deja de ser obligatorio: una entrega se identifica por el cliente (ADR 0014).
-- La unicidad por empresa sigue valiendo para los folios que se indiquen (varios nulos no chocan).
alter table factura alter column folio drop not null;

-- Down Migration
update factura set folio = 'S-' || left(id::text, 8) where folio is null;
alter table factura alter column folio set not null;
