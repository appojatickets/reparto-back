# ADR 0033 — Reportes del local: foto, nombre y ubicación en una sola sección

Estado: aceptada (2026-10-08). Pedido del dueño: «en el panel admin nunca llegó lo de las fotos reportadas; debe haber una sección con pines e imágenes o nombres, donde aparezca reportar imagen, nombre o ubicación».

## Contexto
Los reportes de foto sí llegaban a la base (hay uno abierto del 8-oct), pero solo se veían dentro de «REVISAR FOTOS» y un reporte de una foto ya reemplazada quedaba fuera del panel (arreglado en d75ea47). Nombre y ubicación no se podían reportar.

## Decisión
- **Se puede reportar tres cosas de un local**: la foto (como hasta ahora), el **nombre** del cliente (con cómo debería llamarse, si quien reporta lo sabe) y la **ubicación** (pin). Cualquiera del equipo con permiso `archivos:subir`: `POST /v1/locales/:id/reportes`.
- **Reportar la ubicación saca al pin de «verificado»**: vuelve a «por verificar» y se sigue ajustando con las entregas (ADR 0024). Un local sin pin no tiene ubicación que reportar.
- **Una sola lista para el admin** (`GET /v1/reportes`, permiso nuevo `reportes:revisar`, admin y despachador): fotos, nombres y ubicaciones juntos, del más nuevo al más antiguo, con quién reportó y cuándo.
- Al reportar se guarda cómo estaba el nombre y el pin (tabla `reporte_local`). Si después alguien lo corrige, el reporte sigue abierto pero dice «ya cambió desde el reporte», para que el admin lo cierre sin dudar.
- **Cerrar** (`POST /v1/reportes/:id/resolver`): `corregido`, `descartar` o, en la ubicación, `verificar_pin` (el pin está bien: queda verificado y el reporte cerrado). Los de foto se siguen cerrando con eliminar o dejar la foto.
- Un mismo usuario no repite el mismo tipo de reporte del mismo local mientras siga abierto.
- Sin cambios en `foto_reporte`.

## Insignias (misma entrega)
La ficha, la búsqueda de clientes y cada parada de la ruta traen `pinVerificado` y `fotoVerificada` para mostrar las insignias «✓ PIN» y «✓ FOTO». La foto verificada deja de serlo si se cambia la foto.
