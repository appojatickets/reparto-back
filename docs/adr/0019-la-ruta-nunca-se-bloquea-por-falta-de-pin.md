# 0019 — La ruta nunca se bloquea por falta de pin; el sistema busca la dirección solo

Estado: aceptada. Decisión del dueño, 2026-10-05.

## Contexto
El caso de uso real: el equipo nutre la base (clientes, pines, ubicaciones), pero cada día cada chofer carga sus 30 o más facturas y **escribe solo la dirección que dice la factura**. Después se cruzan datos (RUT, teléfonos, razones sociales). El sistema debe ubicar la dirección, ordenar con lógica (horarios, urgencias, cercanía) y adaptarse si el chofer mueve una parada o encuentra un local cerrado. Que un local no tenga pin **no puede impedir calcular la ruta**.

## Decisiones
1. **Sin pin, la ruta igual se calcula.** El motor ubica la parada en el centro de su comuna (`domain/comunas.ts`) y la marca `ubicacionAproximada`. Solo queda en «sin ubicación» si ni la comuna se conoce. Se afina sola cuando aparece un pin mejor.
2. **El sistema busca la dirección en el mapa (Nominatim / OpenStreetMap, gratuito).** Al cargar una factura cuyo local no tiene pin, y al calcular o ver una ruta con locales sin pin, se encolan en una cola en memoria que consulta de a una por segundo (política del servicio) sin hacer esperar a nadie. Cada dirección se busca una vez: se anota el intento y no se repite una búsqueda sin resultado durante 7 días.
3. **Qué se acepta del mapa:** la dirección se limpia (sin parcela, sitio, lote, S/N; abreviaturas completas) y se busca como «calle, comuna, Región Metropolitana, Chile». Se descarta lo que cae fuera de la RM, lo que solo ubica una zona y lo que el mapa pone en otra comuna. Un número de casa entra con confianza 0,85 y una calle con 0,6.
4. **Pin aproximado:** con confianza menor a 0,7 el pin sirve para ordenar pero se marca «aproximado» y no cuenta como pin (`tienePin = false`); el **GPS de la primera entrega lo reemplaza** (pin «sugerido» de fuente chofer). Un pin fijado por una persona (admin, enlace del vendedor) nunca se pisa.
5. **Búsqueda masiva:** el admin puede pedir buscar el pin de todos los locales sin pin (`POST /v1/locales/buscar-pines`, hasta 1.000 por pedido) y ver el avance (`GET`). Es una cola en memoria: si el servidor reinicia, se vuelve a pedir; nada se pierde.

## Límites
- Las direcciones rurales de Chile («Parcela 7, Camino Santa Rita») están poco cubiertas en OpenStreetMap: se hallará la calle o el camino, no la parcela. Para eso están el GPS de la entrega y el enlace del vendedor.
- Nominatim pide una consulta por segundo y un User-Agent que identifique la aplicación (`GEOCODER_USER_AGENT`, con un correo o la URL del sitio). Si el volumen crece, hay que pasar a otro proveedor (propio o de pago, con autorización del dueño).
- La ubicación por comuna es solo para ordenar: no es una dirección ni sirve para navegar (se navega con la dirección escrita).
