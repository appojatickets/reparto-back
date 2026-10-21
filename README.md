# reparto-api

API de ruteo inteligente de reparto (Fastify + TypeScript estricto, arquitectura hexagonal). Despliegue: Render Free.
Contrato con el front: `openapi.json` (generado con `npm run openapi`, verificado en CI).

## Comandos
`npm run check` ejecuta lint, typecheck, tests y verificación de arquitectura. `npm run dev` levanta la API (requiere `.env`, ver `.env.example`).

## Estructura
`src/domain` (puro) ← `src/application` (casos de uso + puertos) ← `src/adapters` ← `src/main.ts` (composición). Decisiones en `docs/adr/`, spikes en `docs/spikes/`.

## Asistencia opcional de Gemini
En Render: `GEMINI_API_KEY` (secreta) y `GEMINI_ENABLED=true` activan la ayuda para direcciones; por defecto está desactivada. `GEMINI_MODEL` usa `gemini-3.5-flash-lite` por defecto. No requiere modificar la web ni el APK.

Solo se consulta después de que Nominatim y OpenRouteService no encuentren una dirección y no tengan errores. Gemini propone otra escritura; los números y palabras identificadoras se validan antes de volver a consultar los mapas. Las coordenadas siempre proceden del mapa, pasan los filtros de región/comuna y quedan como aproximadas. Los pines existentes no se sobrescriben. No cambia las preferencias de ruta ni el orden manual.

Se envían únicamente dirección, comuna y país; no nombres, teléfonos ni recorridos. Las interacciones usan `store=false`, que no cambia las condiciones del nivel gratuito de Google sobre uso de contenido. Hay caché de 24 horas, timeout de 8 segundos y pausa ante errores o cuota agotada. `GEMINI_DAILY_LIMIT=50` limita llamadas por proceso y día UTC; el contador se reinicia al desplegar y no sustituye los límites/cuotas de Google AI Studio. Si falla la IA, la aplicación continúa con los mapas habituales.
