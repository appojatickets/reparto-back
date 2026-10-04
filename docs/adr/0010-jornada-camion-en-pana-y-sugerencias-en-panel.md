# 0010 — Camión por jornada, camión en pana, deep links y sugerencias revisadas en el panel

Estado: aceptada. Respuestas del dueño, 2026-10-04.

## Contexto
Los choferes **rotan de camión** y a veces un camión queda en pana y siguen en otro. Se quiere que la app piense las rutas
y se apoye en las apps de mapas del teléfono. Las sugerencias aprendidas (ADR 0007, 0009) deben validarse con datos reales
y con la experiencia del dueño.

## Decisión
1. **Jornada**: el chofer elige su camión al empezar el día (un toque, lista de camiones activos). Puede cambiarlo durante el
   día; cada cambio cierra la jornada anterior y abre otra (`jornada`: usuario, camión, desde, hasta).
2. **Camión en pana**: acción del despachador o del chofer. Lo entregado se queda con ese camión; las facturas pendientes
   (estado `pendiente`/`en_ruta`) se **reasignan** a otro camión o se reparten entre varios. El sistema sugiere el reparto
   (cercanía y carga) y recalcula esas rutas desde la última posición conocida; el despachador puede cambiarlo a mano.
   Requiere ampliar los estados de factura (`pendiente`, `en_ruta`, `entregada`, `no_entregada`, `anulada`) en 3b/4.
3. **Apps del teléfono**: solo por **deep links** (Waze `waze.com/ul?ll=…&navigate=yes`, Google Maps `maps/dir/?api=1&destination=…&waypoints=…`
   con hasta 8 paradas por tramo, Apple Maps). Son de un solo sentido: no devuelven posición ni llegada. La posición se toma al
   marcar ENTREGADO (ADR 0009); no hay seguimiento en segundo plano (no es confiable en una PWA/iOS y gasta batería y datos).
4. **Sugerencias en el panel admin**: pantalla «Sugerencias» con la evidencia (nº de entregas, fechas, horas, comparación
   con lo normal) y acciones aceptar / rechazar / editar. **Nada se aplica solo**; el aplicar automático por tipo podría
   activarse más adelante solo por decisión del dueño.
5. **Estadística diaria** de todas las rutas: orden planificado vs real, minutos por parada, caminatas, locales cerrados,
   desvío respecto del plan. Alimenta las sugerencias y mide si el sistema mejora.

## Consecuencias
- 3b: estados de factura ampliados, reasignación masiva de facturas entre camiones y recálculo.
- Fase 4: tabla `jornada`, elección de camión del día, botón «camión en pana», botón NAVEGAR por parada.
- Fase 5/6: pantalla de sugerencias con evidencia y panel de estadísticas.
