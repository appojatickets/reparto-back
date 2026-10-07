# ADR 0025 — Lo que se hace manda sobre lo sugerido

Estado: aceptada.

## Contexto

Los choferes siguen moviendo paradas a mano aunque la ruta sugerida es óptima en línea recta: en 4 rutas reales (13, 10, 18 y 20 paradas) el sistema quedó a 0–2 % del mejor recorrido posible y 7–14 % más corto que lo que se manejó. Pero la siguiente parada que sugiere coincidió con la que se hizo solo el 54 % de las veces; ir siempre al más cercano coincidió el 65 % y elegir entre las 3 más cercanas el 82 %. Los choferes terminan un sector antes de saltar a otro; el óptimo a veces pide saltarse una parada cercana. Además la ruta no conoce calles, sentidos, horarios ni cómo se carga el camión.

## Decisión

- **El orden que se hace manda; el sugerido se considera.** En vivo ya era así: al mover una parada la ruta pasa a «manual» y el sistema solo evalúa e inserta las nuevas sin mover las demás; solo «ordenar» o «volver a calcular» la recalculan. Lo que se hace de verdad (los avisos ENTREGADO, con hora y lugar) es la verdad contra la que se mide el sistema.
- **Estilo de ruta calibrado con lo que se hace.** El motor suma `epsLlegada` = 0,5 por cada minuto que tarda en llegar cada parada (`EPS_LLEGADA_CALIBRADO`): prefiere visitar antes lo cercano. Con 57 decisiones reales la coincidencia sube de 54 % a 61 % y el recorrido total crece 1,7 %. El motor puro (`PARAMETROS_POR_DEFECTO`) queda sin ese término. La muestra es chica (2 camiones, 4 rutas): se vuelve a calibrar a medida que haya datos.
- **Indicador de seguimiento** (`seguimientoDeLaRuta`, en el panel de analítica): en cuántas entregas la hecha fue la primera que quedaba en la lista que se veía, y cuántas de las hechas con la ruta tal como la dejó el sistema (sin que una persona la moviera) siguieron su siguiente parada. Es la medida de cuánto hay que corregir a mano.
- Aún no hay locales que se repitan entre días (67 entregas, ningún local repetido), así que lo que se aprende de lo que se hace es por patrón y zona, no por local.

## Pendiente

Distancias por calles (OpenStreetMap, gratis) en vez de línea recta; horarios cargados; preguntar por qué se mueve una parada.
