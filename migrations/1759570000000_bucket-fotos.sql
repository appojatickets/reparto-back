-- Up Migration
-- Bucket privado para fotos de fachada (~120 KB, solo webp/jpeg). Existe solo en Supabase; en un Postgres común
-- (pruebas de integración) no hay esquema `storage` y se omite.
-- La API no recibe los bytes: entrega URLs firmadas de subida y de lectura. Sin políticas en storage.objects, el
-- navegador no puede leer ni escribir con la clave publishable; todo pasa por URLs firmadas que emite la API.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('fotos', 'fotos', false, 307200, array['image/webp', 'image/jpeg'])
    on conflict (id) do nothing;
  end if;
end $$;

-- Down Migration
-- Sin reversa: borrar el bucket borraría las fotos.
