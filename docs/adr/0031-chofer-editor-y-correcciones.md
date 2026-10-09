# 0031 — Chofer con permiso de editor: corregir lo mal cargado

Estado: aceptada (2026-10-08). Sale del pedido del dueño: un chofer de confianza debe poder corregir errores de carga (foto mal subida, razón social con error de tipeo, dirección equivocada) sin depender del admin.

## Contexto
Hoy solo admin y despachador corrigen. Pero quien se equivoca (sube la foto de otro local a una dirección, escribe mal un nombre, crea una dirección que no era) es el chofer, en la calle, y el dato malo queda en la base hasta que alguien del escritorio lo vea.

## Decisión
- **Permiso `editor` por usuario** (columna `usuario.editor`, por defecto falso). Solo el **admin** lo da o lo quita (`PUT /v1/usuarios/:id/editor`), y solo a **chofer o ayudante** (admin y despachador ya tienen esos poderes). El permiso se lee en cada petición, así que quitarlo surte efecto al instante.
- **Qué suma el editor** (`PERMISOS_DE_EDITOR`): `clientes:escribir` (nota, pin, **quitar la foto** de la fachada, **corregir la razón social**: `PATCH /v1/clientes/:id`) y `locales:eliminar` (`DELETE /v1/locales/:id`). Nada más: ni usuarios, ni analítica, ni importaciones, ni revisar fotos.
- **Eliminar una dirección** es transaccional y conservador: si ya tiene entregas hechas (factura entregada / no entregada, o cualquier evento de entrega) responde 409 y **no borra**, para no perder el historial. Si no, borra sus paradas pendientes y facturas sin entregar, la foto (mejor esfuerzo), el local y, si era el último del cliente, el cliente.
- Migración aditiva `usuario_editor` (compatible hacia atrás).

## Consecuencias
- Un error de carga se corrige en el momento y por quien lo ve, sin abrir un camino a borrar historial.
- El despachador también puede eliminar direcciones (misma regla del historial).
