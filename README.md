# reparto-api

API de ruteo inteligente de reparto (Fastify + TypeScript estricto, arquitectura hexagonal). Despliegue: Render Free.
Contrato con el front: `openapi.json` (generado con `npm run openapi`, verificado en CI).

## Comandos
`npm run check` ejecuta lint, typecheck, tests y verificación de arquitectura. `npm run dev` levanta la API (requiere `.env`, ver `.env.example`).

## Estructura
`src/domain` (puro) ← `src/application` (casos de uso + puertos) ← `src/adapters` ← `src/main.ts` (composición). Decisiones en `docs/adr/`, spikes en `docs/spikes/`.
