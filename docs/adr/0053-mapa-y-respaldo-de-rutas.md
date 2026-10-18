# ADR 0053 — Mapa del orden elegido y tiempos de viaje por fuente

## Decisión

Agregar `GET /v1/rutas/trazado`, con la misma autorización de camión que `verRuta`. No recibe coordenadas arbitrarias del navegador, no geocodifica y no modifica el orden: dibuja el orden guardado. Devuelve segmentos entre depósito, entregas y regreso, su fuente (`porCalles`) y la versión de la ruta consultada. Las ubicaciones aproximadas interrumpen la línea para no saltarse una entrega.

OpenRouteService Directions GeoJSON se consulta en bloques solapados de hasta 50 puntos. La clave queda en el servidor. Se conserva una caché acotada en memoria por coordenadas y perfil durante 30 días; un respaldo se conserva solo un minuto. La geometría confirmada puede persistirse en el dispositivo. Sin clave o ante una falla, el mapa identifica explícitamente el respaldo en línea recta. No se ofrece navegación giro a giro ni tráfico en vivo.

`ORS_PROFILE` permite `driving-car` (predeterminado, compatible con la configuración existente) o `driving-hgv`. El segundo no sustituye configurar dimensiones, peso ni restricciones legales del vehículo. No se cambia a pesado sin datos del vehículo.

## Correcciones

- Matrices divididas en bloques de hasta 3.500 pares, secuenciales, omitiendo bloques completos ya conocidos. Un bloque parcial puede repetir pares conocidos; no se promete que cada par falte individualmente.
- Errores de lectura/escritura de caché no bloquean la ruta. Segundos y metros negativos o no finitos se descartan.
- `conCalles` depende de datos disponibles, no de una clave configurada. El ritmo aprendido afecta solo los arcos Haversine, incluso con cobertura mixta.
- La caché de tiempos distingue proveedor/versión/perfil y vence a los 30 días. Se reutiliza la tabla existente, sin migración. Filas antiguas permanecen pero no se confunden con la nueva versión.
- El presupuesto se consulta en construcción y dentro de los vecindarios. Al agotarse se conservan todas las paradas y el prefijo fijado; no es una garantía de tiempo de pared para red/BD ni para generar explicaciones.
- Búsqueda desde tres caracteres significativos, coincidencias exactas y prefijos antes de aproximadas, desempate estable por id. Reconoce comuna al final de una dirección con número o coma.

## Alcance y verificación

Se parte del `main` vigente, no de la rama predeterminada antigua de Claude. Se conservan sus reglas: nunca quitar entregas por horario, tiempos de atención y aprendizaje de cierres. No se cambia Nominatim ni se incorpora para el mapa.

Pruebas de matrices grandes, fallos de proveedor/caché, tiempos mixtos, presupuesto, bloques de geometría y ubicaciones inciertas. Validación de lint, tipos, pruebas, arquitectura, secretos y build. No se requiere una nueva variable si `ORS_API_KEY` ya está configurada. Sin ella el mapa base y los puntos funcionan, pero el recorrido por calles no está disponible.

Pendientes separados de esta entrega: alias comerciales y métricas de búsqueda requieren diseño de persistencia; redistribución entre camiones y dimensiones por vehículo requieren datos operativos. El servicio de mapas de fondo no determina el orden ni calcula los tiempos.
