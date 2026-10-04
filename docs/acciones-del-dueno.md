# Acciones que solo puede hacer el dueño

Lista viva de lo que el agente **no puede** hacer (paneles, claves, decisiones de negocio, pruebas con personas).
Marca cada casilla al terminar. Nunca pegues claves secretas en el chat: cárgalas directo en el panel.

Última actualización: 2026-10-04 (Fase 2: login real funcionando; faltan las pruebas con datos).

---

## A. Ahora: bloquea el uso de la Fase 2

### A1. Cambiar la contraseña de la base de datos (Supabase)
La contraseña original quedó escrita en el chat.
- [ ] Supabase → proyecto `reparto-back` → **Project Settings → Database → Reset database password**. Usa solo letras y números.
- [ ] Render → servicio `reparto-back` → **Environment** → editar `DATABASE_URL`:
  `postgresql://postgres.azokshimfbitsncidgdt:LA_NUEVA_CLAVE@aws-0-us-west-2.pooler.supabase.com:5432/postgres`

### A2. Variables nuevas en Render
Render → `reparto-back` → **Environment** → agregar:
- [ ] `SUPABASE_ANON_KEY` = la clave **publishable** (`sb_publishable_…`, Supabase → Project Settings → API Keys). Es pública; con ella la API inicia sesión de los usuarios.
- [ ] `AUTH_EMAIL_DOMAIN` = `usuarios.reparto.test` (dominio inventado para los correos sintéticos; **nunca se envía un correo**). Si Supabase rechazara ese dominio al crear usuarios, cámbialo por uno que controles y avísame.
- [ ] Verificar que `SUPABASE_SERVICE_ROLE_KEY` contenga la clave **secret** (Project Settings → API Keys → *secret* o *service_role*), no la publishable.
- [ ] Verificar que `FRONT_ORIGIN` sea exactamente `https://reparto-front.vercel.app` (sin `/` al final).

### A3. Cerrar el registro público en Supabase
Sin esto, cualquiera con la clave publishable (que viaja en el navegador) podría crear cuentas de Auth. No tendrían acceso (la API exige un perfil), pero es mejor cerrarlo.
- [ ] Supabase → **Authentication → Sign In / Providers** → desactivar **Allow new users to sign up**.
- [ ] En el mismo lugar, comprobar que **Confirm email** quede activado (las cuentas se crean ya confirmadas).
- [ ] **Authentication → Providers → Email**: largo mínimo de contraseña en **6** (las claves de los choferes son de 6 dígitos).

### A4. Crear tu usuario administrador — HECHO
- [x] Supabase → **Authentication → Users → Add user → Create new user**.
  - Email: `admin@usuarios.reparto.test` (o `<tu usuario>@<AUTH_EMAIL_DOMAIN>`)
  - Password: 6 dígitos que no sean triviales (nada de 123456 ni 111111)
  - Marcar **Auto Confirm User**.
- [x] Avísame el nombre de usuario elegido (la parte antes de la `@`). Yo creo la empresa y enlazo tu perfil como `admin` (no requiere que me pases ninguna clave).

### A5. Probar el login en el navegador
- [x] Abrir `https://reparto-front.vercel.app`, entrar con tu usuario y clave. (Funciona.)
- [ ] Importar los clientes de ejemplo, buscar «rabe», subir una foto de prueba (Storage aún no verificado de punta a punta).
- [ ] Crear un chofer de prueba desde la pantalla de usuarios y entrar con él en una ventana privada. Confirmar que **no** ve el menú de administración.

---

## B. Antes de usar el sistema con choferes reales

### B1. Respaldos
Supabase Free **no** incluye respaldos automáticos (a verificar en la fecha). Fase 7 los resuelve; mientras tanto no cargues datos que no puedas volver a importar.

### B2. Subir Render a Starter (decisión tuya, ~US$7/mes)
Con esto el servidor deja de dormirse (ver `docs/adr/0006-render-starter-pagado.md`). Es la única excepción a «todo gratis».
- [ ] Render → servicio `reparto-back` → **Settings → Instance Type → Starter**. Pide tarjeta; lo haces tú en el panel.
- [ ] Cuando lo cambies avísame: verifico en los logs que ya no se duerme.

### B3. Revisar el ping diario
- [ ] GitHub → repo `reparto-back` → **Actions → Ping antes de la jornada**: comprobar que corre de lunes a sábado y anotar el tiempo de despertar que muestra el resumen ("Ping OK en Ns").

### B4. Aviso de privacidad (Ley 21.719)
La ley rige desde el 1-dic-2026 (hay un proyecto para aplazarla, aún en trámite).
- [ ] Revisar con quien corresponda el texto del aviso a choferes y clientes: qué se registra (hora de cada entrega, posición puntual), para qué, quién lo ve y por cuánto tiempo (12 meses).
- [ ] Informar a los choferes antes de usar la app.

### B5. Spikes que requieren personas o dispositivos
- [ ] **S5 voz:** probar dictado y lectura en voz alta en español de Chile en un iPhone y un Android reales (te preparo una página de prueba).
- [ ] **S2 mapas:** decidir proveedor de teselas tras revisar términos comerciales (el agente no puede abrir esos sitios desde su entorno).
- [ ] **S1 / S3:** el entorno del agente no alcanza OSRM ni Nominatim. Decidir si se miden con un workflow manual de GitHub Actions (recomendado) o con pares reales de direcciones que tú entregues.

---

## C. Decisiones de negocio pendientes

- [ ] **Prioridad:** ¿qué significa exactamente «prioridad» en una factura? (hoy solo adelanta la llegada con un peso pequeño y sube el costo de no atenderla).
- [ ] **Frío (O-02):** ¿hay un tiempo máximo fuera del freezer? Está desactivado hasta que lo definas.
- [ ] **Pines:** ¿quién revisa los pines que proponen los choferes? (hoy: admin y despachador).
- [ ] **Roles:** ¿hace falta el rol despachador en la práctica o lo hace el administrador?
- [ ] **O-05/O-07:** ¿puedes exportar los clientes del sistema de facturación (aunque sea una planilla) para sembrar la base?
- [ ] **O-08:** línea base actual: km, horas de ruta, hora de regreso y rechazos por local cerrado, en un día normal por camión.
- [ ] **O-09:** marca, modelo y tamaño de pantalla de los celulares de los choferes.
- [ ] **Camión y chofer:** ¿cada chofer maneja siempre el mismo camión o rotan? Con eso se define si la elección del camión al empezar el día es obligatoria o se asigna sola (ver `docs/adr/0005-identidad-del-chofer-y-camion.md`). Además: lista de las patentes de los 12 camiones.
- [ ] **O-06:** ¿quién reparte las facturas entre los 12 camiones y con qué criterio? (V1: manual).

---

## D. Hecho por el agente (para que sepas qué no necesitas tocar)

- Migraciones de la Fase 2 aplicadas en Supabase (7 tablas con RLS activado y sin políticas, bucket privado `fotos`); extensiones `pg_trgm`, `unaccent`, `postgis` habilitadas.
- Fila de `empresa` creada (nombre provisorio «Mi empresa»; se puede renombrar desde la configuración cuando exista).
- Despliegue automático: cada push a `main` redespliega Render y Vercel.
