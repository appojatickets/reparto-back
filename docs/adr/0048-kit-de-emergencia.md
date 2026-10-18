# 0048 — Kit de emergencia: teléfonos, búsqueda de mecánico o vulcanización y parada registrada

Estado: aceptada. Pedido del dueño, 2026-10-15: arriba, en rojo, un kit de emergencia con los números de PDI, Carabineros y Bomberos, y un buscador de mecánicos o vulcanizaciones en Google (más una palabra libre); que al ir quede registrado en la pantalla de las entregas.

- **Teléfonos** (Chile, gratuitos): Carabineros 133, PDI 134, Bomberos 132 y ambulancia (SAMU) 131. Son enlaces `tel:`; viven en el front.
- **Buscar en Google Maps**: MECÁNICO, VULCANIZACIÓN, o una palabra libre (grúa, gomería…). Se abre Maps con la búsqueda centrada donde está el camión.
- **Registro** (`POST /v1/emergencias`): al tocar una búsqueda queda una **parada de emergencia** del camión de la jornada (tipo `mecanico`, `vulcanizacion` u `otro` con el texto), con la hora y la posición del GPS si hay. No es una entrega: no toca facturas, no cuenta como cerrado ni como entregado. `GET /v1/emergencias?fecha&camionId` las lista; aparecen en la pantalla de la ruta junto a «Hechas hoy», para que se vea el tiempo perdido y dónde.
- Tabla `parada_emergencia` (migración `1759810000000`), sin acceso para `anon` ni `authenticated`.
- Límite: si el GPS falla o no hay jornada, la búsqueda abre igual (pedir ayuda no se bloquea) y el registro se omite.
