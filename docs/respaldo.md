# Respaldo y restauración

Supabase Free no trae respaldos automáticos. El workflow `.github/workflows/respaldo.yml` hace uno cada día (06:17 UTC) y también a mano (**Actions → Respaldo diario → Run workflow**).

- Copia el esquema `public` (todos los datos de la app) con `pg_dump` en formato custom.
- Lo **cifra** (gpg, AES-256) antes de subirlo: el repo es público y cualquiera con cuenta de GitHub podría bajar un artefacto sin cifrar.
- Se guarda como artefacto 30 días (`respaldo-AAAA-MM-DD.dump.gpg`).
- No incluye los archivos del bucket `fotos` (solo la base). Las fotos se pueden volver a tomar; los pines y datos viven en la base.

## Puesta en marcha (una vez, la haces tú)
1. Supabase → **Connect → Session pooler**: copia la cadena (`aws-0-us-west-2.pooler.supabase.com:5432`). Los runners de GitHub no tienen IPv6, por eso no sirve la conexión directa.
2. GitHub → repo `reparto-back` → **Settings → Secrets and variables → Actions → New repository secret**:
   - `BACKUP_DATABASE_URL`: esa cadena con tu clave real.
   - `BACKUP_PASSPHRASE`: una frase larga inventada por ti.
3. **Guarda la frase fuera de GitHub** (gestor de claves o papel). Sin ella los respaldos no se pueden abrir.
4. Corre el workflow a mano una vez y comprueba que aparece el artefacto.

Nunca pegues estos valores en el chat ni en archivos del repo.

## Restaurar
```bash
gpg --output respaldo.dump --decrypt respaldo-AAAA-MM-DD.dump.gpg     # pide la frase
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname "$URL_DE_DESTINO" respaldo.dump
```
Haz la prueba de restauración primero en un proyecto Supabase vacío (nunca sobre reencuentro-prod ni sobre otro proyecto ajeno). El destino necesita las extensiones (`pg_trgm`, `unaccent`, `postgis` en el esquema `extensions`), que crean las migraciones.

## Aviso
GitHub desactiva los workflows programados de un repo público tras 60 días sin actividad; mientras haya commits no pasa. Si un día falta el respaldo, revisa Actions.
