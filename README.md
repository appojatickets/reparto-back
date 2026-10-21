# reparto-api

API de ruteo inteligente de reparto (Fastify + TypeScript estricto, arquitectura hexagonal). Despliegue: Render Free.
Contrato con el front: `openapi.json` (generado con `npm run openapi`, verificado en CI).

## Comandos
`npm run check` ejecuta lint, typecheck, tests y verificación de arquitectura. `npm run dev` levanta la API (requiere `.env`, ver `.env.example`).

## Estructura
`src/domain` (puro) ← `src/application` (casos de uso + puertos) ← `src/adapters` ← `src/main.ts` (composición). Decisiones en `docs/adr/`, spikes en `docs/spikes/`.

## Búsqueda opcional de pines con Gemini
En Render, `GEMINI_API_KEY` y `GEMINI_ENABLED=true` activan la búsqueda asistida; el valor predeterminado del interruptor es `false`. El modelo predeterminado es `gemini-3.5-flash-lite`. Para mostrar el origen y la propuesta de corrección, actualizar también la web y el APK.

Primero se reutiliza el pin guardado y se consultan Nominatim/ORS. Si no hay resultado ni errores, Gemini dispone de la función `buscar_mapa`: hasta tres búsquedas conservando calle, números y comuna. El servidor ejecuta las consultas con los proveedores existentes (sin activar Google Maps Grounding), filtra región, comuna, calle y número, y devuelve identificadores de candidatos. Gemini solo puede elegir uno de esos identificadores. Nunca se usan coordenadas redactadas por la IA. El pin se guarda con fuente `gemini`, confianza 0,6 y sin verificar. Sin coincidencia suficiente, se mantiene la alternativa estimada de la ruta. Los pines existentes no se sustituyen.

Un pin Gemini se consolida tras dos visitas del mismo local, separadas al menos 30 minutos y en facturas distintas. Cada una exige entrega confirmada y al menos 60 segundos de detención GPS, muestras con precisión ≤30 m, separadas como máximo 120 segundos y sin dispersión mayor a 30 m. La detención debe quedar junto al aviso de entrega y dentro de los 10 minutos anteriores o 2 posteriores. Las dos visitas deben coincidir a ≤60 m entre sí y con el pin. Un botón aislado, pasar en marcha o GPS impreciso no bastan. Si las visitas coinciden lejos, la ficha muestra una propuesta de corrección: no se mueve el pin automáticamente. El verificador de segundo plano usa la misma evidencia y una comparación del pin esperado para evitar confirmar una ubicación cambiada concurrentemente.

Solo se envían dirección, comuna, país y resultados de la herramienta; nunca nombres ni recorridos GPS. Las interacciones son sin estado (`store=false`, historial en cada llamada). Hay caché de 24 h, timeout de 15 s por solicitud, hasta cuatro turnos y pausa ante errores/cuota agotada. Los logs distinguen timeout, red y JSON inválido sin exponer los datos consultados. `GEMINI_DAILY_LIMIT=50` limita solicitudes al modelo por proceso y día UTC: una búsqueda puede consumir varias; el contador se reinicia al desplegar y no sustituye las cuotas de Google AI Studio. La búsqueda corre en la cola de segundo plano, sin bloquear el reparto.
