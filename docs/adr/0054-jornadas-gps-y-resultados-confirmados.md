# ADR 0054 · Jornadas observadas y resultados confirmados

El GPS nativo permite medir recorrido y permanencias con la pantalla bloqueada, pero ninguna duración universal permite afirmar que un local estaba cerrado o que hubo entrega. Una visita corta, un reintento y no regresar son compatibles con varios resultados. Los cierres usados por la ficha y el motor siguen procediendo de avisos confirmados; las visitas sin resultado quedan pendientes de confirmación.

## Medición y aprendizaje

- Las llegadas automáticas conservan el instante del punto GPS validado, no la hora de recepción del lote. No se unen puntos separados por más de dos minutos para confirmar llegada.
- El analizador no fusiona permanencias a través de huecos de más de diez minutos. Solo atribuye una permanencia a una entrega si hay evidencia GPS cercana al aviso (dos minutos de margen); si no hay, no inventa una atención anterior.
- La reconstrucción diaria requiere precisión explícita de hasta 60 m, elimina duplicados por instante y excluye intervalos de más de cinco minutos o velocidades imposibles (>120 km/h). La distancia observada ignora oscilación menor que el error conjunto; es parcial, no un odómetro certificado ni distancia exacta por calles.
- Cada camión/día conserva primer/último GPS, inicio/fin registrados, salida/regreso observados al depósito, minutos cubiertos y sin evidencia, entregas, cierres confirmados y llegadas sin resultado confirmado. CERRADO seguido por NO ENTREGADO por cerrado en menos de 30 minutos es una visita.
- Regresar al depósito no termina la jornada automáticamente. Si hay varios integrantes del camión, solo se informa cierre confirmado cuando todos terminaron sus jornadas.
- La duración aprendida del día usa salida/regreso al depósito solo con jornada cerrada y al menos 80% de cobertura GPS tanto del tramo observado como de toda la jornada registrada. En los demás casos conserva el respaldo basado en eventos. El motor ya utiliza tiempos por local, ritmo por camión y franjas de cierres confirmados con confianza suficiente.

## Panel y compatibilidad

El resumen se guarda en el JSON de la ejecución del analizador y se expone opcionalmente en analítica, sin migración de tablas. Los últimos 60 camión/días se conservan en el resumen y el panel filtra los últimos 30 días. Se actualiza con el análisis (programado al terminar ruta y cada tres horas), no es un tablero de GPS en vivo.

Las claves históricas de la comparación GPS/botón (`soloGps`, `cerradoDeducido`) se mantienen por compatibilidad. Describen candidatos experimentales de visita breve para revisar, NO resultados de cerrado, no modifican facturas ni alimentan los horarios de cierre. La UI los presenta como visitas sin confirmar y aclara que entregas posteriores tampoco prueban un cierre anterior.

## Android

Se solicitan actualizaciones temporales aun estando detenido (distancia mínima cero). El servicio conserva su muestreo máximo cada 15 s, notificación, activación voluntaria, cola cifrada acotada y detención al salir/terminar. Requiere actualizar el APK para mejorar esta captura. La PWA mantiene su limitación de primer plano.
