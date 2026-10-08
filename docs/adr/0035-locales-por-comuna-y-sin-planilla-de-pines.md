# 0035 — Locales por comuna (listar y editar todo) y fin de la planilla de pines

Estado: aceptada (2026-10-08). Pedido del dueño: «una sección que vea los datos por comuna, ordenados por verificados y no verificados, donde pueda editar fácilmente cualquier dato; con buscadores; que muestre lo recaudado, razón social, RUT, dirección, foto y ubicación del pin; todo fácil de compartir». Y: «la planilla de proponer pines no me sirve, elimina esa lógica».

## Decisión
- **Se elimina «Proponer pines»** (pegar una planilla con dirección, latitud y longitud): `POST /v1/pines/importaciones`, su caso de uso, su validación y `coincidenciaDeDireccion`. La tabla `propuesta_pin` **no se toca** (sus datos siguen). Se conserva la revisión de las propuestas que el sistema arma solo (lo que aprende de las entregas y los enlaces de vendedores sobre un pin ya confirmado), ahora bajo el nombre «Propuestas de pin».
- **`GET /v1/locales?comuna=&texto=&limite=`**: locales con los datos de su cliente (razón social, RUT, giro), dirección, pin, foto (si tiene), nota y **lo entregado** (facturas en estado «entregada» y la suma de sus totales). Primero los de pin por verificar. El texto busca por razón social, RUT o dirección, en todas las comunas o dentro de la elegida. Tope de 500 por consulta, con el total para avisar si hay más.
- **`GET /v1/locales/comunas`**: por comuna, cuántos locales hay, cuántos con pin verificado y cuántos sin pin.
- **Editar cualquier dato**: `PATCH /v1/clientes/:id` ahora acepta `razonSocial`, `rut` y `giro` (vacíos borran el RUT o el giro; un RUT ya usado por otro cliente responde 409). `PATCH /v1/locales/:id` acepta además `direccion` y `comuna` (409 si el mismo cliente ya tiene esa dirección). Al cambiar la dirección, un pin que halló el buscador y nadie verificó se borra y se vuelve a buscar con la dirección corregida; uno verificado o puesto por una persona se conserva.
- Permiso `clientes:escribir` (admin, despachador y el chofer o ayudante con permiso de editor). No hay migración.

## Lo «recaudado»
El sistema no registra cobros ni pagos: «recaudado» es la suma de los totales de las facturas entregadas a ese local. Si más adelante se registran pagos, se cambia la fuente de ese número.

## Consecuencias
Un error de carga se corrige desde una sola pantalla, sin abrir ficha por ficha, y el dato malo no se arrastra a las rutas.
