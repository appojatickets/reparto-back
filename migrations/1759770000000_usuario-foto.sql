-- Up Migration
-- Foto de perfil: cada persona sube la suya (bucket privado `fotos`, carpeta `{empresa}/perfil/{usuario}/`). `foto_en` dice cuándo se puso.
alter table usuario add column foto_path text, add column foto_en timestamptz;

-- Down Migration
alter table usuario drop column if exists foto_path, drop column if exists foto_en;
