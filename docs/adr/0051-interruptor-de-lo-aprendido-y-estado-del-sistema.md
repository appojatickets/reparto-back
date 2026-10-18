# 0051 — Interruptor de lo aprendido y pantalla de estado del sistema

Estado: aceptada. Recomendación aceptada por el dueño, 2026-10-15.

## Interruptor
`usarCierresAprendidos` en la configuración de la empresa (CONFIGURACIÓN, solo admin; sin indicar = se usa). Apagado, la ruta no lee los avisos de los locales ni marca cierres probables: se arma como antes del ADR 0050. Una pantalla vieja que no conoce el campo no lo borra al guardar. Solo cubre lo aprendido sobre cierres (lo nuevo y sin calibrar); el ritmo y el tiempo de atención aprendidos siguen como estaban.

## Estado del sistema
- `GET /v1/health` agrega `version`: el commit que corre en Render (`RENDER_GIT_COMMIT`, lo pone Render solo).
- El análisis agrega `fichas` al resumen: cuántos locales tienen hora habitual de entrega y cuántos tienen alguna franja de cierre probable (lo que la ruta puede usar), visible en `GET /v1/analitica`.
- La pantalla del front junta: versiones de la app y del servidor, último análisis, datos acumulados (jornadas, avisos, GPS, pines) y cuántos locales ya tienen lo aprendido, para saber cuándo hay datos suficientes para mirar la analítica.
