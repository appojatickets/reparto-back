# 0013 — La entrega se identifica por el cliente, no por el folio; datos que importan de la factura

Estado: aceptada. Aclaraciones del dueño con una factura real, 2026-10-04.

## Contexto
El número de factura no le sirve al chofer ni al reparto. Lo que identifica una entrega es **a quién se le lleva**: razón social, dirección, RUT y giro (el plan original ya los usaba para encontrar al cliente). La factura real de ejemplo (factura electrónica con timbre SII) muestra además datos útiles y una marca escrita a mano: «Rechazo – cerrado».

## Decisión
1. **El folio pasa a ser opcional.** Cargar una factura es elegir al cliente (por nombre, dirección, RUT o giro; hoy ya busca por nombre y dirección, se agregan RUT y giro). Si el chofer dice o escribe un número, se guarda, pero no se exige ni se muestra como dato principal. Sin folio, la entrega queda identificada por cliente + día + camión; si ya hay una entrega pendiente de ese cliente ese día en ese camión, se avisa (se permite cargar otra).
2. **Datos relevantes de la factura** (a capturar de forma opcional, sin frenar la carga): cliente (razón social, RUT, dirección, comuna, giro), fecha de emisión, **total**, **cantidad de cajas** (alimenta el tiempo de descarga por local), **vendedor** (el código «Vxx» viene en Observaciones), condición de pago (transferencia/débito/depósito) y el acuse de recibo (nombre, RUT, firma de quien recibe).
3. **Rechazo / no entregado**: los choferes ya lo anotan a mano («rechazo – cerrado»). La app debe ofrecer **NO ENTREGADO con motivo** (cerrado, no recibe, dirección incorrecta, otro). Es el dato más valioso para aprender horarios (ADR 0007) y para la línea base de rechazos por local cerrado.
4. **Al llegar a una parada** («ESTOY AQUÍ»): sacar foto de la fachada, anotar o corregir la dirección y fijar el pin con el GPS (ADR 0009).
5. **Prueba de entrega:** al marcar ENTREGADO se puede guardar quién recibió (nombre/RUT) y una foto de la factura firmada.
6. **Preferencia de orden** en la configuración de la empresa: automático / partir por lo más lejano / partir por lo más cercano al depósito (un peso pequeño en el costo, que desempata sin pelear con los horarios).
7. **Código de barras del timbre SII (PDF417)** podría dar RUT, razón social, folio y monto sin dictar. Con la foto de ejemplo (casual, 900×1600) no se pudo leer; queda como experimento con la cámara en vivo y de cerca (BarcodeDetector en Android, biblioteca en iOS). No se promete hasta probarlo en teléfonos reales.

## Consecuencias
- API: `folio` opcional en facturas (columna nullable; la unicidad por empresa sigue valiendo para los que lo tengan).
- Búsqueda de clientes por RUT y por giro.
- Fase 4b: ENTREGADO / NO ENTREGADO con motivo, ESTOY AQUÍ (foto, dirección, pin), prueba de entrega; botones NAVEGAR (Waze, Google Maps) por parada.
