# ADR 0055 · Cierre de ruta Android y estimaciones con atención GPS

## Error 415

La petición POST sin cuerpo de Android puede llevar Content-Type application/x-www-form-urlencoded implícito de HttpURLConnection. La API reproduce el 415. Para compatibilidad con APK instalados se tolera exclusivamente un cuerpo vacío de ese formato en POST /v1/jornada/terminar y POST /v1/analitica/ejecutar. Se conservan autenticación, permisos y rechazo de formularios con datos y de ese formato en otras rutas.

El APK nuevo envía {} con Content-Type application/json para las acciones POST/PUT/PATCH vacías. La normalización existe en el adaptador JS y en la política nativa Kotlin (también usada por peticiones internas). GET/HEAD no llevan cuerpo; JSON existente se conserva.

## Estimaciones que sobrevaloran la jornada

El motor conservaba diez minutos de atención por local salvo que existiesen diez muestras locales históricas. El promedio histórico general no se usa porque mezcla observaciones llegada→botón que pueden omitir descarga/estacionamiento. No se reduce arbitrariamente la hora final a 16:30 ni se altera el tráfico para imitar un día.

Se incorporan parámetros servicio_min con ámbitos gps:local:<id>, gps:camion:<id> y gps:global. Proceden únicamente de visitas GPS con precisión explícita <=60 m asociadas temporalmente a ENTREGADO confirmado. No proceden de cierres, visitas inciertas ni del intervalo entre dos entregas, que incluye conducción. Se deduplican facturas y descartan duraciones <30 s, >60 min o inválidas.

Con tres muestras de un local se usa su mediana; con cinco para camión/general se usa la mediana con cuatro observaciones virtuales del respaldo de diez minutos, para introducirlo gradualmente. Valores acotados a 2–40 min. Precedencia: GPS local → histórico local suficientemente respaldado → GPS camión → GPS general → diez minutos sin datos. La mediana limita el efecto de una espera extrema.

El analizador ahora corre cada hora y sigue programándose 30 segundos después de terminar ruta o iniciar el servidor. Las lecturas de la ruta recalculan ETAs con los parámetros publicados y la hora actual; la UI ya refresca periódicamente y al volver de Waze. El panel prioriza el promedio GPS cuando existe. Sin evidencia suficiente sigue habiendo incertidumbre y respaldo; no se promete una hora exacta.

No hay migración de tablas ni cambio de contrato HTTP. La firma Android se conserva; el APK debe actualizarse para la normalización nueva, mientras la compatibilidad del servidor soluciona la acción vacía del APK anterior.

La reconstrucción GPS se indexa por camión y día para evitar recorrer los 90 días completos por cada entrega, y se reutiliza entre el aprendizaje de atención y de viaje.
