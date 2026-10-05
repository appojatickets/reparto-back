# Acciones que solo puede hacer el dueño

Lista viva de lo que el agente **no puede** hacer (paneles, claves, decisiones de negocio, pruebas con personas).
Marca cada casilla al terminar. Nunca pegues claves secretas en el chat: cárgalas directo en el panel.

Última actualización: 2026-10-04 (Fase 4a: el chofer elige camión, carga facturas y ve su ruta).

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

### A6. Probar la Fase 3a (facturas y camiones)
Esperar ~2 min a que Render y Vercel terminen de desplegar.
- [ ] Entrar como admin → **CAMIONES** → agregar al menos 2 patentes reales (ej. `AB1234`, `BCDF12`) con un nombre corto.
- [ ] **FACTURAS DEL DÍA** → ingresar 4–5 facturas con los clientes de ejemplo (camión, folio, «antes de» y urgente). Probar un folio repetido (debe avisar) y cambiar una factura de camión.
- [ ] Cuéntame qué se siente lento o confuso: esta pantalla es la que más se usará cada día.

### A7. Probar la Fase 3b (rutas del día)
Esperar ~2 min a que Render y Vercel terminen de desplegar.
- [ ] **CONFIGURACIÓN** (solo admin) → pegar las coordenadas del depósito (en Google Maps: toca y mantén el punto, copia las dos cifras de arriba) y confirmar la hora de salida y la hora límite de regreso.
- [ ] Revisar que los clientes con facturas tengan **pin** (si no, la ruta los lista aparte como «Sin ubicación»).
- [ ] **RUTAS DEL DÍA** → elegir día y camión → **CALCULAR RUTA SUGERIDA**. Mirar si el orden y las horas de llegada te parecen razonables.
- [ ] Probar SUBIR / BAJAR, «MÁS» → IR PRIMERO / DEJAR PARA DESPUÉS / QUITAR DEL CAMIÓN, y agregar una factura nueva al camión y usar **INSERTAR NUEVAS**.
- [ ] Anotar qué ruta te parece mala (qué camión, qué día y por qué): con eso calibro el motor (las velocidades hoy son estimadas, spike S1).
- [ ] Abrir un cliente (BUSCAR CLIENTE → tocar el cliente): ahí está **Ubicación del local (pin)** (pegar las coordenadas de Google Maps) y **Horario de atención**.
- [ ] Probar el horario con botones: elegir días (LUN A VIE), «Abre a las 10:00», «Cierra a las 18:00», colación 13 a 14, domingo CERRADO, o OTRO HORARIO; luego GUARDAR HORARIO. Después calcular la ruta de un camión con ese cliente: un local cerrado ese día sale en «No se pueden atender».
- [ ] Un día sin dato no tiene restricción (el sistema no inventa cierres); «cerrado» solo existe si tú lo marcas.

### A8. Probar la app del chofer (Fase 4a) — en un celular
Esperar ~2 min a que Render y Vercel terminen de desplegar.
- [ ] Crear (o reutilizar) un usuario **chofer** desde USUARIOS y entrar con él en el celular (de verdad, no en el computador).
- [ ] Al entrar pregunta «¿Qué camión manejas hoy?»: tocar un camión.
- [ ] **CARGAR FACTURAS**: dictar con el micrófono del teclado algo como «mil doscientos treinta y cuatro minimarket rabet» o escribir «1234 minimarket rabet». Tocar el cliente correcto y comprobar que queda guardada. Probar con 5 o 6 facturas reales.
- [ ] Anotar: ¿el dictado entiende bien el número y el nombre? ¿Qué pasa con nombres difíciles? ¿Qué te falta en la pantalla?
- [ ] Probar CONDICIONES en una factura (antes de las 13:00, urgente, nota).
- [ ] Tocar **CALCULAR MI RUTA** y revisar el orden y las horas. Probar SUBIR/BAJAR.
- [ ] Probar CAMBIAR DE CAMIÓN y TERMINAR MI DÍA.
- [ ] Si falta un cliente al buscarlo: anotar cuál (hoy el chofer no puede crear clientes; lo importa la oficina).

### A9. Probar vendedores y el aviso de local cerrado
Esperar ~2 min a que Render y Vercel terminen de desplegar.
- [ ] Admin → **VENDEDORES** → agregar V01…V16 con nombre y, si lo tienes, celular (9 dígitos). Probar un código repetido (debe avisar) y cambiar o borrar un celular.
- [ ] En el celular, como chofer: en una parada tocar **ESTÁ CERRADO**. Debe haber un botón de WhatsApp por cada vendedor con celular; tocar uno y comprobar que abre ese chat con el mensaje armado.
- [ ] Responder (me sirve saber): ¿el aviso va al vendedor dueño de cada cliente o a cualquiera del camión? ¿Existe esa asignación cliente → vendedor en tu sistema? ¿Cómo es la planilla de la mañana (chofer, ayudante, camión, vendedores)?

### A10. Probar el pin colaborativo (ADR 0018) — en un celular
Esperar ~2 min a que Render y Vercel terminen de desplegar.
- [ ] Como chofer: en una parada de un local **sin pin**, tocar **ENTREGADO** (con el GPS permitido). Después, en CLIENTES, abrir ese local: debe tener pin «sugerido».
- [ ] En una parada, tocar **UBICACIÓN DEL VENDEDOR** y pegar un enlace de Google Maps (de «Compartir» → copiar enlace) y otro de Waze. Probar uno corto (`maps.app.goo.gl/…`): ese se abre desde el servidor y no pude probarlo desde mi entorno, avísame si falla.
- [ ] Pegar un enlace en un local que tú ya fijaste a mano: debe decir que quedó **propuesta** y aparecer en PINES DE LOCALES.
- [ ] En ESTÁ CERRADO escribir el nombre de la guía y comprobar el mensaje de WhatsApp.
- [ ] Probar el **modo oscuro** desde la cabecera.

## B. Antes de usar el sistema con choferes reales

### B1. Respaldos
Supabase Free **no** incluye respaldos automáticos (a verificar en la fecha). Fase 7 los resuelve; mientras tanto no cargues datos que no puedas volver a importar.

### B2. Subir Render a Starter (~US$7/mes) — DESPUÉS de la semana de pruebas
Con esto el servidor deja de dormirse (ver `docs/adr/0006-render-starter-pagado.md`). Decisión tuya: se activa cuando el sistema esté terminado y lleve ~1 semana de uso de prueba en plan gratis. Mientras tanto, el primer toque tras 15 min de inactividad espera hasta 1 minuto (con aviso en pantalla). Es la única excepción a «todo gratis».
- [ ] (Más adelante) Render → servicio `reparto-back` → **Settings → Instance Type → Starter**. Pide tarjeta; lo haces tú en el panel.
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
- [x] **Camión y chofer:** los choferes rotan y a veces cambian a mitad del día por pana (decidido, ADR 0010). Pendiente: lista de las patentes de los 12 camiones (se cargan desde la pantalla CAMIONES).
- [x] **O-06:** el chofer recibe su montón de facturas impresas de la oficina y las carga él mismo por voz o texto (ADR 0012). Pendiente: ¿la oficina decide qué facturas lleva cada camión, o el chofer saca las que le tocan de un montón común?

---

## D. Hecho por el agente (para que sepas qué no necesitas tocar)

- Migraciones de la Fase 2 aplicadas en Supabase (7 tablas con RLS activado y sin políticas, bucket privado `fotos`); extensiones `pg_trgm`, `unaccent`, `postgis` habilitadas.
- Fila de `empresa` creada (nombre provisorio «Mi empresa»; se puede renombrar desde la configuración cuando exista).
- Despliegue automático: cada push a `main` redespliega Render y Vercel.
