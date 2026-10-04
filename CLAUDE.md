# reparto-back

API Fastify + TypeScript estricto en Render (Free). Dos repos independientes (reparto-back / reparto-front), sin monorepo ni paquetes compartidos.

## Acuerdo de trabajo con el dueño (Matías)
- **Autorizado a subir directo a `main`** (sin PR, salvo que se pida uno). Objetivo: avanzar y usar el proyecto. `main` despliega solo (Render / Vercel), así que antes de subir debe pasar `npm run check` y el build.
- Se avanza **paso a paso, una cosa a la vez**; el dueño hace los pasos en los paneles (Supabase, Render, Vercel) y pega el avance.
- **Todo gratis.** Cualquier gasto, tarjeta o prueba con vencimiento: detenerse y preguntar.
- Secretos solo en variables de entorno, nunca en el repo ni pegados en el chat. Mantener .env.example al día.
- No tocar los proyectos ajenos de la cuenta (reencuentro-prod en Supabase, api-reencuentro y api ojatickets en Render).
- Supabase del proyecto: ref azokshimfbitsncidgdt, región us-west-2. Conexión desde Render por el Session pooler (aws-0-us-west-2.pooler.supabase.com:5432); la directa es solo IPv6.

## Reglas técnicas
- Arquitectura hexagonal estricta: domain ← application ← adapters ← main. Verificada por dependency-cruiser (npm run arch) y ESLint.
- TypeScript estricto (noUncheckedIndexedAccess, exactOptionalPropertyTypes); sin any ni "!". Errores de negocio con Result<T,E>. Hora/UUID/azar por puertos. zod solo en adaptadores de entrada.
- Tests primero en dominio y application. Commits convencionales, en español.
- Comandos: npm run check (lint, typecheck, tests, arquitectura) · npm run build · npm run openapi
- El contrato con el front es openapi.json: si cambia la API, regenerarlo (npm run openapi) y copiarlo al front.
- Decisiones no triviales en docs/adr/; spikes en docs/spikes/.
