# S4 · Infraestructura (Supabase ↔ Render ↔ Vercel)

Fecha: 2026-10-04 · Estado: **parcial** (conexión resuelta; falta medir el despertar)

## Verificado
- **Conexión a la base desde Render:** funciona por el **Session pooler** de Supabase
  (`aws-0-us-west-2.pooler.supabase.com:5432`, usuario `postgres.<ref>`). `/v1/health` (hace `select 1`)
  responde 200 en los logs de Render tras el deploy. La conexión directa `db.<ref>.supabase.co` es solo IPv6
  y el complemento IPv4 es de pago, por lo que **no se usa**.
- **Cadena completa:** Vercel (`reparto-front.vercel.app`) → Render (`reparto-back.onrender.com`) → Supabase
  (proyecto `reparto-back`, us-west-2) muestra «Servidor listo» (captura del dueño, 2026-10-04).
- Región: Supabase y Render en Oregon (us-west-2), por lo que el tráfico API↔base queda en la misma región.
- Extensiones `pg_trgm`, `unaccent`, `postgis` habilitadas (en el esquema `extensions`).

## Hallazgos que cambian el diseño
- `NODE_ENV=production` hace que `npm ci` omita devDependencies y `tsc` no exista: el build usa `npm ci --include=dev`.
- Vercel no admite variables `VITE_*` con visibilidad «secret»; deben ser «config» (son públicas por diseño).
- La cuota de 750 h/mes de Render Free es **por workspace** y ya existe `api-reencuentro` en free (riesgo abierto).

## Pendiente
- Medir el **tiempo de despertar** de Render: el workflow `ping.yml` lo registra cada día en el resumen del run
  (ver "Ping OK en Ns"). Decidir con 1 semana de datos si basta el ping de las 07:50.
- Confirmar que el ping diario mantiene activo el proyecto de Supabase (sin pausa) tras 7 días.

## Decisión
Session pooler + ping diario por GitHub Actions (lun–sáb, 10:50 UTC). Revisar el horario en abril de 2027 (cambio de hora en Chile).
