# ADR 0058 — La organización de la ruta se elige al empezar a cargar, y sin ella no se cargan facturas

Estado: aceptada. Pedido del dueño (2026-10-21): el orden de comunas y las preferencias se preguntan una vez, cuando se empieza a cargar la ruta —no antes—, y si no se eligen no se deja cargar facturas.

## Contexto

El front ya pide la organización en la pantalla de carga (cómo se cargarán las facturas —en orden de entrega o sin orden— y el orden de comunas) y deja el campo de carga deshabilitado hasta guardarla. Pero era solo una restricción de pantalla: una app vieja, el teléfono Android o una llamada directa a la API podían cargar facturas sin organización, y entonces la ruta se calculaba sin saber lo que el dueño quería.

## Decisión

- `registrarFactura` (cargar una factura en un camión) exige que ya exista la organización guardada de la ruta de **ese camión y ese día**. Si no existe, responde `VALIDACION` con `detalle.codigo = RUTA_SIN_ORGANIZAR` y no crea nada.
- Se mira la fecha de la factura (no solo hoy). Una factura sin camión no tiene ruta que organizar y se carga como siempre.
- Al terminar la ruta del día la ruta guardada se borra, así que la siguiente jornada vuelve a preguntar la organización una sola vez, al empezar a cargar.
- La organización se guarda con «GUARDAR ORGANIZACIÓN» (ya existente), que crea la ruta del día vacía; después las facturas que se cargan entran a esa ruta ya organizada.

## Consecuencias

- Quien use una versión vieja de la app verá el mensaje «Antes de cargar facturas elige cómo se organizará la ruta…» en vez de cargar sin organización.
- No cambia la API ni hay migración.

## Pendiente

- Hoy la organización pregunta el modo de carga y el orden de comunas. La preferencia de por dónde parte la ruta (automático / más lejano / más cercano, ADR 0038) sigue en CONFIGURACIÓN de la empresa; si se quiere preguntarla también por ruta, hay que guardarla junto a la ruta.
