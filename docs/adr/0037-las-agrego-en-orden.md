# 0037 — «Las agrego en orden»: la ruta puede ser el orden en que el chofer cargó las facturas

Estado: aceptada. Pedido del dueño, 2026-10-07.

## Contexto
A veces el chofer se sabe el recorrido de memoria y carga las facturas en el orden exacto en que las va a entregar. Hasta ahora el orden de carga
solo pesaba de forma suave en el cálculo (ADR 0028) y el sistema podía reordenar lo que el chofer ya tenía resuelto.

## Decisión
1. **Tercer modo de ruta, `carga`** (además de `sugerida` y `manual`). `POST /v1/rutas/planificar` acepta `orden: 'calcular' | 'carga'`
   (por defecto `calcular`, como siempre).
2. En modo `carga` la ruta **es** el orden de carga: no se optimiza. Las horas de llegada y el regreso se siguen calculando sobre ese orden.
3. Lo que el chofer mueve (SUBIR, BAJAR, arrastrar, IR PRIMERO, DEJAR PARA DESPUÉS) queda donde lo dejó y **la ruta sigue en modo `carga`**:
   nada de lo de abajo se reordena solo.
4. Las facturas que agrega después entran **al final, en su orden de carga** (operación `insertar`). Quitar una no reordena las demás.
5. Avisar una parada que no era la siguiente **no reordena** lo que queda (`reordenarTrasVisita` no actúa en este modo).
6. **CALCULAR MI RUTA** (`ordenar`) saca la ruta del orden de carga: pasa a `sugerida` y la ordena el sistema. Volver a planificar con
   `orden: 'carga'` o `'calcular'` reemplaza la ruta por una u otra.
7. **Para aprender:** cada planificación queda anotada con su modo. Un día en `carga` no tiene ruta sugerida contra la cual medirse, así que
   no entra en la comparación «sugerida frente a manejada» (ADR 0022).

## Migración
`1759760000000_ruta-en-orden-de-carga.sql` amplía las restricciones `ruta.modo` y `ruta_operacion.modo` con `'carga'`. Solo agrega un valor
permitido: la versión anterior de la API sigue funcionando.
