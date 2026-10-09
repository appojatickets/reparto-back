-- Up Migration
-- Verificación de fotos por el admin: la foto vigente de un local queda «verificada» (quién y cuándo) o «por verificar».
-- Cambiar o quitar la foto borra la verificación (lo hace la API); la restricción impide una verificación sin foto.
alter table local
  add column foto_verificada_por uuid references usuario (id) on delete set null,
  add column foto_verificada_en timestamptz,
  add constraint local_foto_verificada_con_foto check (foto_verificada_en is null or foto_path is not null);

create index local_foto_por_verificar_idx on local (empresa_id, foto_en desc nulls last) where foto_path is not null and foto_verificada_en is null;

-- Down Migration
drop index if exists local_foto_por_verificar_idx;
alter table local
  drop constraint if exists local_foto_verificada_con_foto,
  drop column if exists foto_verificada_en,
  drop column if exists foto_verificada_por;
