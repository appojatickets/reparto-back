# 0034 — Segundo buscador de direcciones y paradas sin ubicación precisa

Estado: aceptada (2026-10-08). Todo gratis. Sale del pedido del dueño: «si no lo encuentra que diga que no se encontró, que se note en la ruta, y que se fije al entregar».

## Contexto
El buscador de direcciones (Nominatim, OpenStreetMap) encontró solo 31 % de las direcciones reales (ADR 0028): en Chile los números de calle están poco cargados. Las paradas sin pin se ordenan por estimación (orden de carga o centro de la comuna), y el chofer no podía distinguirlas de las demás.

## Decisión
- **Cadena de buscadores** (`crearGeocodificarLocal` recibe una lista): primero Nominatim; si no encuentra la dirección (o devuelve algo que no sirve: otra comuna, solo una zona), se prueba con el **geocodificador de OpenRouteService** (Pelias), con la misma clave `ORS_API_KEY` de las rutas por calles (plan gratuito: 1.000 búsquedas al día). Sin clave, solo Nominatim. El segundo solo se consulta cuando el primero falla, para cuidar el cupo.
  - Un número exacto vale «exacta»; uno interpolado o solo la calle, «calle» (confianza 0,6: pin aproximado); un barrio o una comuna, «zona» (no se usa).
  - Si algún buscador no respondió (caído o sin cupo) y ninguno dio un punto, no se anota el intento y se vuelve a probar. Si todos respondieron sin resultado, se anota y no se reintenta por 7 días.
- **La ruta distingue tres casos** (campo `noEncontradaEnMapa` en cada parada, más `ubicacionAproximada` que ya existía): sin pin y aún sin buscar, sin pin y buscada sin éxito («no se encontró en el mapa»), y pin aproximado del buscador. Se calcula con `local.geocod_intento_en`; no hay migración.
- **No se inventa un pin**: lo que no se encuentra sigue sin pin; la ruta lo ubica por estimación y el pin se fija al entregar con buen GPS (ADR 0024) o al pegar la ubicación del vendedor.

## Fuera de alcance
Geocodificadores de pago (Google, HERE): se descartaron por costo y, en Google, porque sus condiciones limitan a 30 días el tiempo que se pueden guardar los resultados.
