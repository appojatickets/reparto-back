# 0050 — La ruta usa lo aprendido sobre cierres (pista blanda, con compuertas)

Estado: aceptada. Pedido del dueño, 2026-10-15: pasar de una analítica avanzada a aplicarla; «si no hay datos o las probabilidades no son altas, no las considera».

## Qué hace
- Para cada local de la ruta se arma su ficha (ADR 0049) con los avisos de los últimos 180 días y se toman **solo las franjas de 2 horas con ≥ 3 visitas y probabilidad de cerrado ≥ 0,6** (`cierreProbableDe`). Sin datos o con probabilidades bajas no hay franjas y la ruta se arma exactamente como antes.
- El motor suma un costo **blando** por atender una parada dentro de una franja así: `30 min × probabilidad` (≈ lo que cuesta ir, encontrarlo cerrado y volver). Si hay otra cosa útil que hacer antes, deja esa parada para después de la franja; si no, la visita igual.
- Esa parada sale con el motivo **CIERRE_PROBABLE** («Suele estar cerrado a esa hora») para que el chofer lo sepa y decida.

## Lo que NO hace
- No saca ninguna parada de la ruta ni la marca en riesgo (ADR 0042). Un horario duro pesa 10 000; lo aprendido, 30 como máximo: **lo cargado por una persona y lo que se hace manda**.
- No toca un orden que una persona dejó acomodado (`evaluarOrden`): solo le agrega el aviso.
- Si no se pueden leer los avisos, la ruta se arma igual.

## Cómo se controla
- `PESO_CIERRE_APRENDIDO = 30` (parametros.ts; 0 lo apaga) y los umbrales `MINIMO_VISITAS_CIERRE_RUTA = 3` y `UMBRAL_CIERRE_RUTA = 0,6` (ficha-aprendida.ts). No están calibrados: el banco de pruebas de la analítica sigue midiendo si lo aprendido acierta y es la señal para endurecer o aflojar estos valores (o apagarlo).

## Límites
Las franjas mezclan todos los días de la semana. El cierre deducido por GPS (ADR 0046) todavía no alimenta la ficha. Los tiempos de llegada son estimados: una franja de 2 horas absorbe ese error.
