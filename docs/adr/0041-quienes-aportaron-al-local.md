# 0041 — Reconocer a quienes aportan a un local

Estado: aceptada. Pedido del dueño, 2026-10-10: «los locales con foto y ubicación, con más de una entrega o verificada, que aparezca quién contribuyó (nombre e imagen chica), para crear incentivo a contribuir».

## Decisión
- Un local muestra quiénes aportaron **solo si** tiene foto **y** pin **y** además más de una entrega hecha o el pin verificado (`domain/entidades/contribuciones.ts`).
- Qué cuenta como aporte, por persona:
  - **foto**: quien subió la foto actual (`local.foto_por`);
  - **pin**: quien verificó el pin a mano (`local.pin_verificado_por`; si lo verificaron las entregas, nadie y solo se acredita a quienes entregaron);
  - **entregas**: cuántas facturas distintas entregó ahí (`entrega_evento`, tipo `entregado`; deshacer y volver a entregar la misma factura cuenta una vez).
- Orden: primero quien aportó de más maneras, luego quien más entregas hizo. Como mucho 10 personas.
- `GET /v1/locales/:id/contribuyentes` (permiso `clientes:leer`) devuelve nombre, `fotoEn` (foto de perfil, ADR 0039) y los aportes de cada uno. Un local que no cumple devuelve lista vacía; uno que no existe, 404.
  No hay migración: todo sale de lo que ya se guardaba.
- Visible para toda la empresa (choferes, ayudantes, oficina): la idea es justamente que se vea.

## Límite
- Las fotos y pines cargados antes de que existiera `foto_por` o con `usuario_id` vacío no acreditan a nadie.
