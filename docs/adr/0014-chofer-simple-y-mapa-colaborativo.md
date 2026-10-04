# 0014 — El chofer solo carga, sigue una ruta inteligente y navega; el mapa se completa entre todos

Estado: aceptada. Aclaración del dueño, 2026-10-04 (reemplaza lo de «cajas» y «número de factura» del ADR 0013).

## Lo que el chofer quiere (y nada más)
1. **Anotar la entrega lo más rápido posible** (voz o texto). No le interesa el número de factura, ni las cajas, ni el total.
2. **Una ruta inteligente:** por cercanía y por horarios de apertura y cierre.
3. **Navegar** (Waze o Google Maps) y saber **cuándo** llega.
4. Si el local está **cerrado**: hablar con el **vendedor**.
5. Si no encuentra la dirección: **mandarla por WhatsApp** (al vendedor u oficina).
6. **Al llegar, georreferenciar el pin**, de forma **colaborativa**: lo que marca un chofer sirve a todos.

## Decisión
- **Fuera de la app del chofer:** número de factura (queda opcional y oculto), cajas, total, pago, acuse de recibo. Se descartan los puntos 2, 5 y parte del 1 del ADR 0013.
- **El chofer puede crear clientes** al cargar («NO LO ENCUENTRO → AGREGAR CLIENTE»: nombre, dirección y comuna, por voz o texto). Así la base se completa con el uso: la meta es tenerla completa en ~1 mes si todos usan la app y cargan sus entregas con dirección.
- **Pin colaborativo:** en la parada, «ESTOY AQUÍ» toma el GPS. Si el local no tiene pin, ese punto pasa a ser su pin (estado *sugerido*, fuente *chofer*) y se usa de inmediato para rutear. Si ya tiene pin, el punto queda como evidencia y, con varias entregas coherentes, se propone validarlo o corregirlo (ADR 0009). El admin puede corregir cualquiera.
- **Sin pin todavía:** NAVEGAR abre Waze/Google Maps con la **dirección escrita** (no hace falta coordenada), y la parada se ordena después de las ubicadas. Más adelante, un geocodificador gratuito propondrá un pin automático al crear el cliente (spike S3).
- **Cerrado:** botón «ESTÁ CERRADO» (queda como *no entregado – cerrado*, con hora y GPS; alimenta el aprendizaje de horarios, ADR 0007) y accesos a «LLAMAR» y «WHATSAPP» al vendedor. Los vendedores (V01…V16) con su teléfono se cargan aparte (admin), y cada camión sabe sus vendedores por la «planilla del día».
- **Dirección que no encuentra:** botón «ENVIAR POR WHATSAPP» con el mensaje ya armado (cliente, dirección, comuna y, si hay, el pin). WhatsApp se abre por enlace; no hay costo ni integración.
- **Estados de entrega:** pendiente → entregada | no entregada (cerrado, no recibe, dirección incorrecta, otro).
- **Preferencia de orden** (más lejano / más cercano / automático) en la configuración, como pidió el dueño.

## Orden de construcción
1. Cargar sin folio + chofer crea clientes.
2. NAVEGAR por parada (con pin o con dirección escrita) + ENTREGADO / ESTÁ CERRADO / ESTOY AQUÍ (pin colaborativo).
3. WhatsApp y llamada al vendedor; registro de vendedores y planilla del día.
4. Preferencia de orden; geocodificador automático.
