# 0040 — Orden manual con un toque, aprender de la experiencia del chofer y «entregado sin pin»

Estado: aceptada. Pedido del dueño, 2026-10-10: «un chofer ordenó la ruta solo, cero vueltas: ese dato es oro»; poder pasar fácil de automático a manual; y poder entregar sin dejar el pin.

## Qué se guarda del orden (ya estaba, ahora documentado)
- `ruta_operacion`: cada vez que la ruta se calcula o se toca, queda el **orden resultante** completo, con el modo y quién lo hizo (planificar, subir, bajar, mover,
  primero, despues, quitar, ordenar, insertar, **fijar**, salida).
- `entrega_evento`: el orden real en que se hizo cada entrega (hora de cada aviso) y en qué lugar de la lista iba la parada (`posicion_en_ruta` / `paradas_en_ruta`).
- Los dos se conservan (el analizador mira los últimos 90 días). No hay que hacer nada para que el orden «se guarde».

## Decisión
1. **PASAR A MANUAL (`fijar`)**: nueva operación que congela el orden que se ve y deja la ruta en modo `carga` (el de «las agrego en orden»): desde ahí **nada se
   reordena solo**, lo que la persona mueve queda donde lo deja y lo nuevo entra al final. No recalcula ni reinicia al orden de carga. Volver a automático es `ordenar`.
   Un local cerrado que se deja «para más tarde» (`despues`) baja de lugar, como siempre. Migración `1759780000000_operacion-fijar.sql` (solo agrega un valor permitido).
2. **Aprender de los días en orden manual**: antes se descartaban (no había sugerencia contra la cual medirse). Ahora el analizador mide el día contra
   **lo que el sistema habría sugerido con las mismas paradas** (cálculo por distancia, sin horarios) y anota en `jornada_resumen`:
   - `origen_orden`: `sistema` (el orden lo calculó el sistema) o `chofer` (día en orden manual);
   - `cambios_manuales`: cuántas veces se movió una parada a mano (subir, bajar, arrastrar, ir primero). Un día `chofer` con 0 cambios es experiencia pura.
   Migración `1759790000000_jornada-origen-orden.sql`. ANALÍTICA los muestra aparte («Días en orden manual: la experiencia del chofer»).
   - Límite honesto: hoy esto **mide y deja marcado**; el motor todavía no reordena usando esos días. Con varias semanas de días `chofer` se puede calibrar
     el motor contra ellos (como se hizo con el orden de carga, ADR 0028) o aprender precedencias entre zonas.
3. **ENTREGADO SIN PIN**: `POST /v1/entregas/:id/eventos` acepta `sinPin: true` solo con `entregado`. La entrega queda hecha, la ruta se reordena como siempre, pero
   **la posición se descarta**: no se guarda en el aviso, no fija ni ajusta ni verifica el pin y no cuenta como evidencia. Antes el chofer quitaba la factura del camión
   para no dejar un pin errado y la parada desaparecía de la ruta.
