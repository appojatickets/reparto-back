# 0039 — Foto de perfil de cada persona

Estado: aceptada. Pedido del dueño, 2026-10-10: «poder subir una imagen y que se vea en el perfil en un tamaño adecuado, al entrar a la app, y en los otros lugares más chica».

## Decisión
- Cada persona sube **su propia** foto (no la de otro; el admin no la cambia por ella). Quitarla también es solo propio.
- Mismo mecanismo que la foto de fachada (ADR 0009 y siguientes): la API **no recibe los bytes**, entrega una URL firmada de subida y el navegador sube directo al
  bucket privado `fotos`. Carpeta propia: `{empresa}/perfil/{usuario}/{uuid}.{webp|jpeg}`. La empresa y el usuario salen del servidor: el caso de uso solo
  acepta un `path` de la carpeta de quien lo registra.
- `usuario.foto_path` y `usuario.foto_en` (migración `1759770000000_usuario-foto.sql`, ya aplicada en Supabase). Al cambiar la foto se borra el archivo anterior.
- Los usuarios públicos (`/v1/auth/login`, `/v1/me`, `/v1/usuarios`) traen `fotoEn` (fecha ISO, solo si hay foto). La foto en sí se pide aparte:
  `GET /v1/usuarios/:id/foto-url` (URL firmada de 5 minutos) para cualquiera de la **misma empresa**; sin foto o de otra empresa responde 404.
  `fotoEn` sirve al front de «versión»: si cambia, pide una URL nueva.
- Endpoints propios: `POST /v1/me/foto/url-subida`, `PUT /v1/me/foto`, `DELETE /v1/me/foto`. Cualquier rol con sesión (no hay permiso especial).

## Por qué no una URL pública
El bucket sigue privado (sin políticas): las caras de choferes y ayudantes no quedan en un enlace permanente que se pueda compartir. La URL firmada vence en minutos.

## Pendiente
- Mostrar la foto en más lugares (asignación del día, reportes) cuando esas respuestas traigan `fotoEn` de las personas.
