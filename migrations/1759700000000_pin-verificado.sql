-- Up Migration
-- Un pin «verificado» lo confirmó una persona: ya no se mueve solo. Mientras no lo esté («por verificar»), el lugar real donde se avisa
-- ENTREGADO lo va ajustando (ADR 0024). Quién y cuándo lo verificó queda anotado.
alter table "local" add column pin_verificado_por uuid references usuario (id);
alter table "local" add column pin_verificado_en timestamptz;
create index local_pin_por_verificar_idx on "local" (empresa_id) where lat is not null and pin_verificado_en is null;

-- Down Migration
drop index if exists local_pin_por_verificar_idx;
alter table "local" drop column if exists pin_verificado_en;
alter table "local" drop column if exists pin_verificado_por;
