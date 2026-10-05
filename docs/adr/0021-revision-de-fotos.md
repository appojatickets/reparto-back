# 0021 — Revisión de fotos por el admin

Estado: aceptada. Pedido del dueño, 2026-10-05: «si alguien sube mal una foto quiero reportarla y eliminarla como admin; agrégalo a mi panel para revisión».

## Decisiones
- **Quién y cuándo:** cada foto guarda quién la subió y cuándo (`local.foto_por`, `local.foto_en`). Las anteriores a este cambio no tienen el dato y salen al final de «subidas recientemente».
- **Reportar:** cualquiera que pueda subir fotos (chofer, ayudante, despachador, admin) reporta la foto de un local con un motivo (no es la fachada, se ven personas, borrosa, otro) y una explicación corta opcional. `POST /v1/locales/:id/foto/reportar`. Un mismo usuario no repite el reporte de la misma foto mientras siga abierto.
- **Revisar (solo admin, permiso `fotos:revisar`):** `GET /v1/fotos/revision` devuelve las reportadas y las subidas recientemente (30), con la persona y la fecha. La foto se mira con la misma URL firmada de lectura de siempre.
- **Decidir:** `POST /v1/fotos/reportes/:id/resolver` con `eliminar` (el local queda sin foto, el archivo se borra del almacenamiento y se cierran **todos** los reportes de esa foto) o `descartar` (la foto queda). Repetir la decisión no falla. Si el local ya cambió de foto, un reporte viejo nunca borra la nueva (el reporte guarda la ruta de la foto reportada).
- Eliminar desde «subidas recientemente» usa `DELETE /v1/locales/:id/foto` (ya existía; admin y despachador).
- Tabla `foto_reporte` con RLS activado y sin políticas, como el resto; migración `1759670000000_revision-de-fotos.sql`.
