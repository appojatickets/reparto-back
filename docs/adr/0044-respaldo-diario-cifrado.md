# 0044 — Respaldo diario cifrado con GitHub Actions

Estado: aceptada. Pedido del dueño, 2026-10-11: «apliquemos, si es público, pero ojo con el ignore: que no suba nada sensible».

## Contexto
- Supabase Free no incluye respaldos. Los repos son públicos, así que Actions es gratis e ilimitado (la cuota que se agotó era de proyectos privados de la cuenta).
- En un repo público los artefactos los puede bajar cualquier usuario de GitHub.

## Decisión
- Workflow diario `respaldo.yml`: `pg_dump` del esquema `public` por el Session pooler (los runners son solo IPv4), cifrado con gpg simétrico AES-256, artefacto de 30 días.
- Los secretos `BACKUP_DATABASE_URL` y `BACKUP_PASSPHRASE` viven solo en GitHub Secrets; si faltan, el workflow avisa y termina sin fallar.
- Higiene del repo público: `.gitignore` endurecido (llaves, volcados, exportaciones, planillas) y `npm run secretos` (`scripts/revisar-secretos.mjs`), que revisa los archivos versionados en busca de claves, URLs con contraseña y teléfonos; corre en `npm run check` y en CI.

## Consecuencias
- Quedan fuera del respaldo los archivos del bucket `fotos`.
- La frase de cifrado es un punto único: si se pierde, los respaldos no se abren.
- El historial de git del front ya publicó datos de terceros en fixtures antiguos; limpiarlo exige reescribir historia y queda a decisión del dueño.
