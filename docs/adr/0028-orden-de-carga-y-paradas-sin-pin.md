# ADR 0028 — Orden de carga, paradas sin pin y tiempos que cruzan la hora punta

Estado: aceptada (2026-10-07).

## Contexto

Auditoría del motor con las rutas reales del 6 y 7 de octubre (4 rutas, 64 decisiones del chofer):

- **El problema no era el algoritmo, eran los pines.** Al calcular la ruta casi ninguna parada tenía pin: 5 de 13, 0 de 9, 2 de 18 y 3 de 28.
  El buscador gratuito (Nominatim) encontró 30 de unas 97 direcciones (31 %). Todas las demás quedaban en el centro de su comuna, el orden
  salía casi al azar, y el 7-oct el chofer tocó SUBIR 111 veces y después dejó de seguir la lista.
  - Lo que vio el chofer coincidía en la siguiente parada el **17 %** de las veces.
  - Con los pines que hay hoy, la ruta habría coincidido el 64 %.
- **El chofer carga las facturas casi en el orden en que va a entregar.** La correlación entre el orden de carga y el de entrega fue de 0,91,
  0,78 y 0,79. Es una pista gratis que llega todos los días.
- Lo que hacen otros:
  - En el desafío de rutas de Amazon de 2021 ganó una búsqueda local con penalizaciones aprendidas de las rutas de los choferes, sin
    aprendizaje profundo. Los métodos que aprenden secuencias necesitan miles de rutas.
  - VROOM y OR-Tools no mejorarían más de un 2 % sobre nuestro motor.
  - Dos correcciones técnicas valían la pena:
    - Un tramo que cruza el cambio de período debe ir a la velocidad de cada período. Antes, salir a las 09:31 llegaba antes que salir a las
      09:29.
    - Probar los segmentos dados vuelta, porque con tiempos por calles la ida no dura lo mismo que la vuelta.

## Decisión

1. **Paradas sin pin ubicadas por el orden de carga** (`ubicarPorOrdenDeCarga`). La parada queda entre las facturas de su comuna con
   ubicación conocida que se cargaron justo antes y justo después, en proporción a su lugar en la carga. Las ubicaciones conocidas son las
   pendientes con pin y las ya entregadas ese día. Si no hay ninguna, sigue en el centro de la comuna.
   - Solo sirve para ordenar: no se guarda como pin ni se usa para navegar.
2. **Preferencia suave por el orden de carga** (`pesoOrdenCarga`, 1 minuto por cada lugar de diferencia, `PESO_ORDEN_CARGA_CALIBRADO`).
   - No pesa contra las ventanas horarias.
   - El motor puro (`PARAMETROS_POR_DEFECTO`) lo deja en 0.
3. **Tramos que cruzan el cambio de período** (modelo de Ichoua, Gendreau y Potvin), en el motor y en la verificación de invariantes
   (`viajeConCambioDePeriodo`, `tiempoDeViaje`).
4. **Tiempos por calles con hora punta.** OpenRouteService da un solo tiempo, sin tráfico. Se multiplica por 30/22 en los períodos de
   punta (`crearFactorHorario`).
5. **Or-opt con el segmento dado vuelta** (segmentos de 2 y 3 paradas).

## Resultados (prueba con las 4 rutas reales, `siguiente` = la siguiente sugerida es la que hizo el chofer)

| Situación | Antes | Ahora |
|---|---|---|
| Como fue (casi sin pines) | siguiente 17 %, entre las 3 primeras 41 % | siguiente 44 %, entre las 3 primeras 73 % |
| Con todos los pines | siguiente 64 %, entre las 3 primeras 77 % | siguiente 72 %, entre las 3 primeras 86 % |

Con todos los pines, la ruta sugerida sigue siendo un 8 % más corta (en línea recta) que lo que se manejó. Son pocos datos (64 decisiones):
el peso se vuelve a calibrar cuando haya más semanas.

## Pendiente

- **Pines antes de salir:** sigue siendo lo que más mejora la ruta.
  - Con la clave de OpenRouteService se puede probar su buscador de direcciones.
  - Sumar la ubicación por la misma calle con pines propios (hoy alcanza a 38 de 588 locales sin pin).
- Aprender precedencias y zonas de las rutas de cada chofer cuando haya más semanas.
- Medir el desvío de secuencia (métrica de Amazon) en ANALÍTICA.
