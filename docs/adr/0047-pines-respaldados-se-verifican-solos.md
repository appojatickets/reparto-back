# 0047 — Los pines respaldados por entregas se verifican solos

Estado: aceptada. Pedido del dueño, 2026-10-15: la persona solo debería verificar dos casos: **pines sin entregas** y **pines con entregas en lugares distintos**; si dos entregas parecidas respaldan el pin, que quede verificado sin tocar nada.

## Problema
La verificación automática (ADR 0032) solo corría **al registrar una entrega**. Los pines con dos entregas parecidas que ya estaban así (o cuya segunda entrega no alcanzó la precisión en su momento) quedaban en «por verificar» —arriba de la lista, como «respaldados»— esperando que una persona los confirmara.

## Decisión
- `crearVerificarPinesRespaldados` revisa los pines «por verificar» y verifica los que `respaldoDelPin` clasifica como **respaldados** (≥ 2 entregas con GPS ≤ 50 m que coinciden entre sí, a ≤ 60 m) **y** cuyo grupo queda a ≤ 60 m del pin. Queda como verificado «por entregas» (sin persona), igual que la verificación al entregar.
- Corre antes de cada análisis de segundo plano (cada 3 h, poco después de terminar una ruta y con ANALIZAR AHORA), así que también limpia lo atrasado.
- Quedan para la persona solo: **sin respaldo** (sin entregas, o una sola) y **en conflicto** (entregas en lugares distintos, o juntas pero lejos del pin).
