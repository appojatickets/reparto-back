# Acciones que solo puede hacer el dueño

Lista viva de lo que el agente **no puede** hacer (paneles, claves, decisiones de negocio, pruebas con personas).
Marca cada casilla al terminar. Nunca pegues claves secretas en el chat: cárgalas directo en el panel.

Última actualización: 2026-10-07 (aprendizaje en segundo plano, pines por verificar/verificados, ruta que prefiere lo cercano).

---

## ⭐ Lo que sigue: tus tareas, en orden

Lo más importante primero. Marca cada casilla al terminar; el detalle de cada una está más abajo (A19).

1. [ ] **Cargar los horarios de atención** (hoy hay 0): Importar clientes → **REVISAR LAS NOTAS CON HORARIOS** → **APLICAR**. Es lo más barato y hace que la ruta respete a quién le sirve cada hora.
2. [ ] **Buscar los pines que faltan:** 588 de 766 locales no tienen pin. Importar clientes → **BUSCAR LOS PINES POR DIRECCIÓN** y deja la pantalla abierta ~15 minutos. Es lo que más mejora la ruta: con los pines la siguiente parada coincide con la del chofer el 72 % de las veces; sin ellos, mucho menos. El buscador gratis encuentra ~1 de cada 3 direcciones; las demás se fijan solas con la primera entrega.
3. [ ] **Contarme 3 paradas que moviste a mano y por qué** (cierra pronto, sentido de la calle, queda de paso, pedido del cliente…). Con eso afino cómo ordena la ruta.
4. [ ] **Decidir las distancias por calles** (hoy la ruta mide en línea recta): ver A19-6. Recomendado: OpenRouteService, gratis.
5. [ ] **Pegar el enlace que no funcionó** (`maps.app.goo.gl/tQsDTWhhRh9eyaTC8`) en un local con **PEGAR UBICACIÓN** y contarme el mensaje que sale.
6. [ ] **Verificar pines** que ya sepas que están bien (ficha del local → **VERIFICAR PIN**): quedan fijos y las entregas dejan de moverlos.
7. [ ] **Pedir a los choferes** que trabajen con la app abierta y la pantalla encendida: el recorrido y la llegada automática solo funcionan así.
8. [ ] **Pedir a los choferes que carguen las facturas en el orden en que piensan entregarlas** (ya casi lo hacen: el orden de carga y el de entrega se parecen un 80–90 %). Desde el 7-oct la ruta usa ese orden como pista, sobre todo para ubicar las paradas que no tienen pin (ADR 0028 del back).

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

### A11. Cargar la lista de Google Maps (ADR 0006 del front)
Esperar ~2 min a que Vercel termine de desplegar.
- [ ] Admin → **IMPORTAR CLIENTES** → pegar la lista completa tal como se copió de Google Maps (no hace falta ordenarla). Debe decir «Lista de Google Maps: N lugares leídos» con cuántos están listos, cuántos tienen solo una referencia «Cerca de…» y cuántos hay que revisar.
- [ ] Mirar **Para revisar**: completar el nombre, la dirección o la comuna que falte; al completarse pasan a «listos». Los que no completes no se importan (puedes pegar la lista de nuevo después, no se duplica nada).
- [ ] Dejar marcada o no la casilla de las direcciones aproximadas (solo «Cerca de…»): si la dejas, entran con esa referencia como dirección.
- [ ] Tocar **IMPORTAR** y abrir 3 o 4 clientes (BUSCAR CLIENTE) para comprobar nombre, dirección, comuna, pin y nota (horarios, teléfonos, nombre comercial).
- [ ] Avísame qué quedó mal ordenado (qué nombre se leyó como dirección o al revés) y lo ajusto.
- [ ] Para traer también las coordenadas de los lugares que dicen «Cerca de…», hay que exportar la lista con coordenadas (por ejemplo con Google Takeout); mándame ese archivo y lo adapto.

### A12. Búsqueda automática del pin por la dirección (ADR 0019)
Esperar ~2 min a que Render termine de desplegar.
- [ ] (Opcional, recomendado) Render → `reparto-back` → **Environment** → agregar `GEOCODER_USER_AGENT` con algo como `reparto-api/1.0 (tu-correo@dominio.cl)`. El servicio gratuito de mapas pide identificar la aplicación; si no la defines, usa un valor por defecto.
- [ ] Probar como chofer: cargar 2 o 3 facturas de clientes **sin pin** (los que importaste con «Cerca de…») y tocar **Mi ruta**. La ruta se calcula igual; las paradas sin pin salen marcadas «ubicación aproximada».
- [ ] Esperar uno o dos minutos y recalcular: las direcciones que el mapa encontró ya tienen pin. Las rurales («Parcela 7») suelen no encontrarse; esas se afinan con el GPS de la entrega o pegando el enlace del vendedor.
- [ ] Como admin, pedir la búsqueda para toda la base (botón en IMPORTAR CLIENTES): tarda ~1 segundo por local.

### A13. Cargar listas de «dirección + enlace de Google Maps» (ADR 0010 del front)
- [ ] Entra a **Importar clientes** y pega la lista (dirección con comuna al final, y debajo su enlace `maps.app.goo.gl` o de búsqueda). Toca **IMPORTAR N DIRECCIONES**: crea los clientes y fija el pin exacto con los enlaces cortos.
- [ ] Para los de enlace de búsqueda (sin lugar) y para los **495 locales que hoy no tienen pin** (441 tienen número de calle, así que se pueden buscar), toca **BUSCAR LOS PINES POR DIRECCIÓN** al final de la misma pantalla (A12). Hoy ninguno se ha buscado todavía; tarda unos 9 minutos (1 por segundo).

### A14. Exportar datos y manejar fotos (ADR 0009 del front)
- [ ] Menú del admin → **EXPORTAR DATOS**: elige comunas y filtros, marca las columnas (razón social, RUT, dirección, comuna, pin, foto…), mira cuántos son y descarga el CSV (se abre bien en Excel).
- [ ] Toma una foto de una fachada desde la ruta (o desde la ficha del local) y comprueba que se ve para todos; en la ficha, **QUITAR FOTO** la borra del almacén.

### A15. Probar la ruta con entregas nuevas (celular del chofer)
- [ ] Carga 3 o 4 entregas más con la ruta ya calculada: deben ordenarse solas (sin botón). Mueve una con ⬆ ⬇ y carga otra: se inserta sin deshacer lo que moviste. Elige **Primera entrega** y comprueba que el resto se reordena desde ahí.
- [ ] La ruta ya no muestra horas ni tiempos estimados (no eran confiables); cuéntame si falta algún dato para decidir.

### A16. Probar el fin de la ruta (celular del chofer, ADR 0020)
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces (comprobar la versión al final de IMPORTAR CLIENTES).
- [ ] Con una ruta con entregas: marca una como ENTREGADO y baja hasta el final de la lista: debe estar **TERMINAR RUTA**. Tócalo con entregas pendientes: pide confirmar y dice cuántas quedan; con «NO, SEGUIR» no pasa nada.
- [ ] Termina la ruta: muestra el resumen (entregadas, no entregadas, sin hacer) y VOLVER AL INICIO. Al elegir camión de nuevo la lista parte limpia (las pendientes quedan en su día).
- [ ] Llegada al depósito: con la pantalla abierta y al menos una entrega hecha, acércate a menos de 150 m del depósito «Ibiza»: debe preguntar «¿Terminaste la ruta?» (o terminar sola si no queda nada). Si tu teléfono no da el aviso, avísame con el modelo.

### A17. Horarios desde las notas y revisión de fotos (ADR 0011 y 0012 del front, ADR 0021)
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces.
- [ ] **Horarios:** Importar clientes → al final **REVISAR LAS NOTAS CON HORARIOS** → mira cuántos entendió y cómo quedarían → **APLICAR**. Abre la ficha de un cliente con horario y comprueba que quedó de lunes a sábado.
- [ ] **Fotos:** como chofer, abre una parada con foto y toca **REPORTAR ESTA FOTO** (elige un motivo). Como admin, menú **REVISAR FOTOS**: debe aparecer el reporte con quién reportó y quién subió; prueba **LA FOTO ESTÁ BIEN** y **ELIMINAR LA FOTO**.
- [ ] La foto de Av. Providencia 2500 que ya subiste no tiene quién/cuándo (es anterior a este cambio); aparece al final de «Subidas hace poco».

### A18. Fotos verificadas: por verificar y verificadas (ADR 0023 del back, ADR 0014 del front)
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces. La migración ya está aplicada en Supabase.
- [ ] Menú del admin → **REVISAR FOTOS**: debe haber **Reportadas**, **Por verificar (N)** y **Verificadas (0)**. Todas las fotos que ya estaban subidas aparecen en «Por verificar».
- [ ] Toca **✓ VERIFICADA** en una foto: sale de «Por verificar» y «Verificadas» sube a 1. Toca **VER LAS VERIFICADAS**: está ahí con tu nombre y la hora. Toca **VOLVER A POR VERIFICAR**: regresa a la primera lista.
- [ ] Prueba **ELIMINAR LA FOTO** en una de «Por verificar» (pide confirmar).
- [ ] Como chofer, sube una foto nueva (o cambia la de un local ya verificado): debe aparecer en «Por verificar», no en «Verificadas».

### A19. Aprendizaje, pines por verificar y ruta que sigue lo que haces (ADR 0022, 0024 y 0025 del back; 0013 y 0015 del front)
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces (la etiqueta de versión está al pie de IMPORTAR CLIENTES).
- [ ] **Permisos:** al abrir la app debe pedir **ubicación** y **micrófono**. Acepta los dos. Si rechazaste alguno, aparece un aviso con cómo activarlo (candado junto a la dirección → Permitir).
- [ ] **Pin que sale de la entrega:** como chofer, marca **ENTREGADO** estando en la puerta del cliente. En la ficha del local el pin debe quedar **POR VERIFICAR** y moverse a donde estás. Después de varias entregas queda donde coinciden.
- [ ] **Verificar un pin:** ficha del local → **VERIFICAR PIN** (admin o despachador). Pasa a **PIN VERIFICADO ✓** y las entregas ya no lo mueven. **QUITAR VERIFICACIÓN** lo vuelve a ajustar.
- [ ] **Decidir:** los 33 pines exactos que pegaste desde enlaces de Google Maps también se ajustan con el camión hasta que los verifiques. ¿Los verifico todos de una vez con un botón? (dime sí o no).
- [ ] **ANALÍTICA** (menú del admin): mira cuántos avisos con ubicación hay, cuántas llegadas dedujo del recorrido, los pines verificados / por verificar / sin pin y «La siguiente parada fue la que mostraba la ruta». **ANALIZAR AHORA** lo recalcula.
- [ ] **Ruta que prefiere lo cercano:** calcula una ruta con varias paradas y comprueba si ahora la siguiente parada coincide más con lo que tú harías. Si todavía mueves paradas, anota cuáles y por qué (es la tarea 3 de arriba).
- [x] **Mover paradas:** resuelto: ahora se arrastra con el dedo (ver A20).

### A19-6. Distancias por calles (decisión tuya)
La ruta hoy mide en línea recta × 1,35. Es óptima en esa medida, pero no ve sentidos de calle, líneas de tren ni la Panamericana.
- [ ] **Opción recomendada, gratis: OpenRouteService** (datos de OpenStreetMap). Crea la cuenta en `account.heigit.org`, genera una clave API y cárgala en Render → `reparto-back` → **Environment** como `ORS_API_KEY` (nunca la pegues en el chat). Plan gratis: 500 consultas de matriz al día. **Si te pide tarjeta, detente y avísame.** Ya está implementado (ADR 0026): cuando la cargues, la ruta usa calles sola (no hay que hacer nada más); con caché y vuelve a línea recta si algo falla.
- [ ] Cuando la hayas cargado, avísame «listo» (sin la clave): compruebo en los registros que ya consulta (la tabla de caché ya está creada en tu base).
- [x] **Google Maps: descartado por ti (2026-10-07).** Habría costado con tarjeta (≈ US$95 al mes con 3 camiones de 20 paradas, más con rutas largas) y no permite guardar los tiempos. No se usa.
- [ ] **Alternativa propia (más adelante):** servidor de rutas propio con datos de OpenStreetMap. Necesita un plan de Render más grande que el Starter (costo extra): no lo haré sin tu autorización.

### A20. Mover paradas arrastrándolas (ADR 0027 del back, ADR 0016 del front)
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces. La migración ya está aplicada en Supabase.
- [ ] En **RUTAS** o **MI RUTA**, cada parada trae un botón **↕ MOVER** (ya no hay SUBIR ni BAJAR). **Mantén el dedo apoyado en MOVER y arrastra hacia arriba o abajo**: la parada sigue tu dedo y las otras se corren para abrirle el hueco. **Suelta**: la parada queda en ese lugar.
- [ ] **Lista larga:** arrastra una parada hasta el borde de arriba o de abajo de la pantalla y quédate ahí: la lista debe **desplazarse sola**. Suelta cuando llegues al lugar que quieres.
- [ ] Apoyar MOVER y soltar sin mover no cambia nada. La parada queda en su lugar al instante y, al confirmar, lo que está **debajo** se ordena solo (ADR 0029); lo de arriba queda como lo dejaste.
- [ ] Sin señal: arrastra una parada con el celular en modo avión. Debe **volver a su sitio** y avisar que no se pudo.
- [ ] Anota si se te cruza con el scroll normal de la página (por ejemplo, si al querer desplazar la lista tocas MOVER sin querer): lo ajusto.

### A21. Chofer editor, corregir y eliminar direcciones, CERRADO en la fila (ADR 0031 del back, ADR 0018 del front)
Probado por el dueño el 2026-10-08: funciona.
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces. La migración ya está aplicada en Supabase.
- [x] **ADMIN → USUARIOS:** en un chofer o ayudante aparece **DAR PERMISO DE EDITOR**. Tócalo: queda con la insignia **EDITOR** y el botón cambia a **QUITAR PERMISO DE EDITOR**. En admin y despachador no aparece.
- [x] Entra como ese chofer (cierra sesión y vuelve a entrar para que lo tome). En **INICIO** aparece **BUSCAR CLIENTE**; en cada parada, **CORREGIR ESTA DIRECCIÓN**.
- [x] En la ficha del local: **QUITAR FOTO** (borra la foto sin reemplazarla), **Razón social (corrige un error de tipeo)** + **GUARDAR NOMBRE**, y **ELIMINAR ESTA DIRECCIÓN** (pide confirmar con SÍ, ELIMINAR / NO, DEJARLA).
- [x] Una dirección que **ya tuvo entregas** no se deja eliminar y lo explica (para no perder el historial). Prueba con una creada por error, sin entregas: debe borrarse y volver a la búsqueda.
- [x] Un chofer **sin** el permiso no ve nada de lo anterior.
- [x] **ADMIN → REVISAR FOTOS:** las fotos reportadas aparecen en «Reportadas» aunque la foto ya se haya reemplazado (con el aviso «foto reemplazada»).
- [x] **Dirección nueva del chofer (CARGAR → NO ESTÁ):** el campo ahora dice **Razón social** (antes «Nombre del local (opcional)») y eso es lo que se guarda como razón social.
- [x] **Fila de cada parada:** ahora trae **MOVER · ENTREGADO · CERRADO · IR**. Toca **CERRADO**: se anota y se despliega la lista habitual (**AVISAR AL VENDEDOR POR WHATSAPP**, **ESPERAR 10 MIN**, **VOLVER MÁS TARDE**); **MÁS OPCIONES** suma ESPERAR 15/20 MIN y **DEJAR PARA OTRO DÍA**. Tocar CERRADO otra vez cierra la lista.

### A22. Direcciones que no se encuentran y paradas sin ubicación precisa (ADR 0034 del back, ADR 0021 del front)
Probado por el dueño el 2026-10-08: funciona.
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces. No hay migración. Para el segundo buscador hace falta `ORS_API_KEY` (la misma de las rutas por calles, ver A19-6).
- [x] **Segundo buscador:** carga una factura con una dirección que antes no se encontraba. Si el primer buscador no la halla, el segundo la prueba solo. Mira unos minutos después en la ficha del local si quedó con pin (**PIN POR VERIFICAR**).
- [x] **En la ruta (RUTAS o MI RUTA):** las paradas sin ubicación precisa salen en **naranja** con la insignia **SIN UBICACIÓN PRECISA**, y arriba aparece el aviso «N paradas sin ubicación precisa: la ruta las ubica por estimación».
- [x] Abre una de esas paradas: dice **«No se encontró esta dirección en el mapa y no tiene pin»** (o «Todavía no tiene pin: se está buscando» si aún no se busca) y recomienda pegar la ubicación del vendedor (botón **UBICACIÓN DEL VENDEDOR**) o fijar el pin.
- [x] Marca **ENTREGADO** en la puerta de una parada sin pin: la ruta avisa **«La ubicación de … quedó guardada con tu GPS»**, la insignia naranja desaparece en la siguiente visita y lo que queda se reordena.

### A23. Locales por comuna: ver, buscar, editar y compartir (ADR 0035 del back, ADR 0022 del front)
Probado por el dueño el 2026-10-08: funciona.
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces. No hay migración.
- [x] **Menú → LOCALES POR COMUNA** (admin, despachador y chofer editor). Elige una comuna: el selector dice cuántos locales tiene y cuántos sin pin.
- [x] Los locales salen separados en **POR VERIFICAR (n)** —incluye los sin pin— y **VERIFICADOS (n)**. Cada uno muestra razón social, RUT, dirección, insignia del pin, cuántas entregas tiene («N entregas hechas») y la nota.
- [x] **Buscador:** escribe un nombre, RUT o parte de la dirección; busca en todas las comunas (o solo en la elegida).
- [x] **EDITAR:** razón social, RUT, giro, dirección, comuna, nota y la ubicación del pin (pega el enlace de Google Maps o las coordenadas). Solo se guarda lo que cambiaste. **ELIMINAR ESTA DIRECCIÓN** pide confirmar; con entregas hechas no se deja.
- [x] **VERIFICAR PIN**, **VER EN EL MAPA** y **VER FOTO** funcionan desde cada local.
- [x] **COMPARTIR:** en el celular abre el menú de compartir con nombre, RUT, dirección y el enlace al pin (con la foto si el teléfono lo permite); si no, ofrece **ENVIAR POR WHATSAPP** y **COPIAR EL TEXTO**.
- [x] **Se quitó «Proponer pines»** (la planilla). El menú ahora dice **PROPUESTAS DE PIN** y solo muestra lo que propone el sistema. Dime si también quieres sacar eso.

### A24. Última parada fija: volver a la empresa (ADR 0022 del front)
Probado por el dueño el 2026-10-08: funciona.
Esperar ~2 min a que Vercel termine de desplegar y abrir la app dos veces. Solo cambia el front.
- [x] **CONFIGURACIÓN → Nombre del depósito:** escribe cómo quieres que se llame (por ejemplo «Ibiza»). Si no hay nombre, dice «LA EMPRESA». El depósito (dirección en el mapa) tiene que estar configurado.
- [x] En **MI RUTA** y **RUTAS**, al final de la lista de paradas aparece una fila fija con doble borde: **VOLVER A IBIZA**, con la hora estimada de regreso y los botones **IR** y **WAZE**. No tiene MOVER: no se puede mover ni entregar.
- [x] Al hacer la **última entrega** esa fila se destaca: **«Terminaste las entregas · VUELVE A IBIZA»**.

### A25. Probar la planilla del día (ADR 0036 del back)
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces. La migración ya está aplicada en Supabase.
- [ ] Entra como admin o despachador a **PLANILLA DEL DÍA** y pega la tabla de la mañana (con los encabezados Chofer, Ayudante, Camión, Vendedor y, si la tienes, Comuna). Revisa la vista previa y confirma.
- [ ] Mira el resultado fila por fila: camiones creados (con su nombre de dos dígitos), vendedores creados, y quién quedó **sin usuario** (hay que crearlo en USUARIOS y volver a pegar).
- [ ] Entra como chofer (o ayudante) de esa planilla: debe abrir la app **ya con su camión del día** y ver sus vendedores y comunas.
- [ ] En **VENDEDORES** carga el celular de cada uno; en un local cerrado, el WhatsApp debe ofrecer solo a los vendedores de ese camión.

### A26. Elegir cómo se arma la ruta: «calcular mi ruta» o «las agrego en orden» (ADR 0037 del back)
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces. La migración ya está aplicada en Supabase.
- [ ] Como chofer, carga varias facturas **en el orden en que las vas a entregar** y elige **LAS AGREGO EN ORDEN**: la ruta debe quedar exactamente en ese orden.
- [ ] Agrega una factura más: debe quedar **al final**. Mueve una parada con ↕ MOVER: debe quedarse donde la soltaste y las demás no se mueven solas.
- [ ] Toca **CALCULAR MI RUTA**: ahí sí la ordena el sistema.

### A27. Elegir por dónde parte la ruta (ADR 0038 del back, ADR 0025 del front)
Esperar ~2 min a que Render y Vercel terminen de desplegar y abrir la app dos veces.
- [ ] Como admin, **CONFIGURACIÓN** → «Por dónde parte la ruta»: elige **MÁS LEJANO DEL DEPÓSITO** y guarda. Calcula una ruta de un camión con varias comunas: debe partir por lo más lejano y volver acercándose. Prueba también **MÁS CERCANO** y **AUTOMÁTICO** (como antes).
- [ ] Un local que cierra temprano debe atenderse antes aunque esté cerca: el horario manda sobre esta preferencia.

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
- [ ] Revisar con quien corresponda el texto del aviso a choferes y clientes: qué se registra (hora de cada entrega, posición al avisar, **posición del camión cada minuto mientras la app está abierta**, llegadas detectadas solas, lo que mueven en la ruta), para qué (mejorar las rutas; se sigue al camión, no al chofer), quién lo ve y por cuánto tiempo (12 meses).
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
- [ ] **Pines verificados:** ¿quién verifica pines y con qué criterio? (hoy: admin y despachador, desde la ficha del local).
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
