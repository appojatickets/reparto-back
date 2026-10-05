-- Up Migration
-- Búsqueda automática del pin por la dirección (ADR 0019): se anota cuándo se intentó, para no repetir una búsqueda sin resultado cada vez.
alter table "local" add column if not exists geocod_intento_en timestamptz;
create index if not exists local_sin_pin_idx on "local" (empresa_id) where lat is null;

-- Down Migration
drop index if exists local_sin_pin_idx;
alter table "local" drop column if exists geocod_intento_en;
