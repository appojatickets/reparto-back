# ADR 0026 — Tiempos de manejar por calles (OpenRouteService)

Estado: aceptada (se activa al cargar la clave `ORS_API_KEY`).

## Contexto

La ruta calcula en línea recta × 1,35 (ADR 0025): es óptima en esa medida, pero no ve sentidos de calle, líneas de tren ni la Panamericana, y por eso los choferes siguen moviendo paradas. **Google Maps fue descartado por el dueño el 2026-10-07**: la matriz de rutas cuesta US$5 por 1.000 pares tras 10.000 gratis al mes y exige tarjeta (unos US$95 al mes con 3 camiones de 20 paradas y una matriz por día; bastante más con 40 paradas y recálculo en cada entrega), y sus condiciones al parecer no permiten guardar los tiempos devueltos, así que la caché permanente no serviría. No es «todo gratis».

## Decisión

- Usar **OpenRouteService** (datos de OpenStreetMap), plan gratuito con clave: 500 consultas de matriz al día, hasta 3.500 tramos (filas × columnas) por consulta. Sin tráfico en vivo. La clave va solo en la variable de entorno `ORS_API_KEY`.
- **Caché permanente** (`viaje_par`): cada tramo entre dos puntos (coordenadas redondeadas a ~11 m) se consulta una sola vez; los pines que se corrigen apenas siguen usando lo consultado. Las calles no cambian cada día.
- Solo se pide lo que el motor usa: entre paradas y hacia el depósito (cuando cambia el conjunto de paradas) y **solo la fila** del punto donde está el camión (cambia con cada entrega). Eso mantiene el uso muy por debajo de las 500 consultas diarias.
- **Nunca se bloquea la ruta:** sin clave, con un límite agotado, con red caída o con una respuesta rara, cada tramo que falte sigue en línea recta (`crearTiemposConViajes`). Las paradas sin pin siguen ubicadas por el centro de su comuna.
- Con tiempos por calles el ritmo aprendido deja de aplicarse (se midió contra la línea recta); se vuelve a aprender contra los tiempos nuevos.

## Pendiente

Aprender el ritmo contra los tiempos por calles; servidor propio de OpenStreetMap (con autorización del dueño, por el costo del plan) si el plan gratuito no alcanza. Sin tráfico en vivo: Google Maps está descartado.
