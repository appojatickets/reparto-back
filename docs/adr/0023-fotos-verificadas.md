# 0023 — Fotos verificadas: dos listas, por verificar y verificadas

Estado: aceptada. Pedido del dueño, 2026-10-07: cada día se suben fotos nuevas; «si coloco un ✓ queda verificada y sale de la revisión, y las que no están verificadas las veo aparte: dos listas».

## Decisiones
- **Verificación por foto vigente:** el local guarda `foto_verificada_por` y `foto_verificada_en`. Una foto está verificada si tiene fecha de verificación. Cambiar la foto (`actualizarLocal` con `fotoPath`) o quitarla borra la verificación: una foto nueva siempre llega «por verificar». Una restricción (`local_foto_verificada_con_foto`) impide una verificación sin foto.
- **Dos listas en `GET /v1/fotos/revision`** (solo admin, `fotos:revisar`): `reportadas` (igual que antes), `porVerificar` (fotos vigentes sin verificar, las subidas más nuevas primero, hasta 100) y `verificadas` (la verificación más reciente primero, hasta 30, con quién y cuándo). **Reemplaza a `recientes`**, que mezclaba ambas.
- **Verificar:** `PUT /v1/locales/:id/foto/verificacion` con `{ fotoPath, verificada }`. `verificada: false` la devuelve a «por verificar» (por si se marcó sin querer). Repetir la misma decisión no falla.
- **Se verifica la foto que se vio:** el cuerpo lleva el `fotoPath` de la lista. Si mientras tanto el local cambió o perdió la foto, responde 409 (CONFLICTO) en vez de dar por buena una foto que nadie miró.
- **Dejar un reporte** (`descartar`) también deja la foto verificada: el admin ya la miró y la dio por buena, así no vuelve a aparecer en «por verificar».
- **Eliminar** sigue igual (`DELETE /v1/locales/:id/foto`, o eliminar desde un reporte): el local queda sin foto y sin verificación.
- Las fotos que ya estaban subidas antes de este cambio quedan todas «por verificar»; basta marcarlas una vez.
- Migración `1759690000000_foto-verificada.sql` (columnas, restricción e índice parcial de las por verificar). Sin tabla nueva: RLS sigue como estaba.

## Consecuencias
- El front debe leer `porVerificar` y `verificadas` (ya no existe `recientes`); se despliegan juntos.
