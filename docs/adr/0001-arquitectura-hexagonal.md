# ADR 0001: Arquitectura hexagonal estricta, verificada en CI

Fecha: 2026-10-04 · Estado: aceptada

Regla: `domain ← application ← adapters ← main`. `domain` y `application` no importan librerías
(solo tipos entre sí); `zod` solo en `adapters/in` y `config`; los adaptadores no dependen unos de otros.
Se verifica con dependency-cruiser (`npm run arch`), que falla el build. Hora, UUID y azar entran por puertos.
